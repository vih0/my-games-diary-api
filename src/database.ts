import { Logger, OnModuleDestroy } from '@nestjs/common';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { Pool } from 'pg';

export type SqlValue = string | number | null | Buffer;

export interface SqlClient {
  query<T>(sql: string, ...values: SqlValue[]): Promise<T[]>;
}

const gameFields = {
  platform: "TEXT NOT NULL DEFAULT 'PC'",
  genre: 'TEXT',
  rating: 'INTEGER CHECK (rating BETWEEN 1 AND 5)',
  image_url: 'TEXT',
  notes: 'TEXT',
  cover: 'BLOB',
  cover_type: 'TEXT',
};

export class Database implements SqlClient, OnModuleDestroy {
  private readonly sqlite?: DatabaseSync;
  private readonly pool?: Pool;

  constructor(path: string, connectionString?: string) {
    if (connectionString) {
      let url: URL;
      try {
        url = new URL(connectionString);
      } catch {
        throw new Error('DATABASE_URL deve ser uma URL PostgreSQL válida.');
      }
      if (url.protocol !== 'postgres:' && url.protocol !== 'postgresql:') {
        throw new Error('DATABASE_URL deve ser uma URL PostgreSQL.');
      }
      for (const key of ['sslmode', 'sslcert', 'sslkey', 'sslrootcert']) {
        url.searchParams.delete(key);
      }
      url.searchParams.delete('options');
      const caPath = process.env.DATABASE_CA_FILE ?? (url.hostname.endsWith('.supabase.co') ||
        url.hostname.endsWith('.pooler.supabase.com') ? resolve(__dirname, '../supabase/prod-ca-2021.crt') : undefined);
      this.pool = new Pool({
        onConnect: async client => { await client.query('SET search_path TO my_games_diary'); },
        connectionString: url.toString(),
        ssl: { rejectUnauthorized: true, ca: caPath ? readFileSync(caPath) : undefined },
        max: 4,
        connectionTimeoutMillis: 8000,
      });
      this.pool.on('error', error => new Logger(Database.name).error(error.message));
      return;
    }

    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
    const sqlite = this.sqlite = new DatabaseSync(path, {
      enableForeignKeyConstraints: true,
      timeout: 5000,
    });
    sqlite.function('strpos', (value, part) => String(value).indexOf(String(part)) + 1);
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS games (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, search_name TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('wishlist','playing','played','completed')),
        progress INTEGER NOT NULL CHECK (progress BETWEEN 0 AND 100),
        favorite INTEGER NOT NULL CHECK (favorite IN (0,1)),
        CHECK ((status = 'completed' AND progress = 100)
          OR (status = 'wishlist' AND progress = 0)
          OR (status IN ('played','playing') AND progress < 100))
      ) STRICT;
      CREATE TABLE IF NOT EXISTS lists (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, search_name TEXT NOT NULL
      ) STRICT;
      CREATE TABLE IF NOT EXISTS list_games (
        list_id TEXT NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
        game_id TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
        PRIMARY KEY (list_id, game_id)
      ) STRICT;
      CREATE INDEX IF NOT EXISTS list_games_game ON list_games(game_id);
      BEGIN IMMEDIATE;
    `);
    try {
      const columns = new Set(sqlite.prepare('PRAGMA table_info(games)').all().map(row => row.name));
      for (const [name, definition] of Object.entries(gameFields)) {
        if (!columns.has(name)) sqlite.exec(`ALTER TABLE games ADD COLUMN ${name} ${definition}`);
      }
      sqlite.exec('COMMIT');
    } catch (error) {
      sqlite.exec('ROLLBACK');
      sqlite.close();
      throw error;
    }
  }

  async query<T>(sql: string, ...values: SqlValue[]): Promise<T[]> {
    if (this.pool) return (await this.pool.query(sql, values)).rows as T[];
    const ordered: SqlValue[] = [];
    const statement = sql.replace(/\$(\d+)/g, (_match, index: string) => {
      ordered.push(values[Number(index) - 1]);
      return '?';
    });
    return this.sqlite!.prepare(statement).all(...ordered) as T[];
  }

  async transaction<T>(action: (db: SqlClient) => Promise<T>): Promise<T> {
    const client = await this.pool!.connect();
    try {
      await client.query('BEGIN');
      const result = await action({
        query: async <Row>(sql: string, ...values: SqlValue[]) =>
          (await client.query(sql, values)).rows as Row[],
      });
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async onModuleDestroy() {
    this.sqlite?.close();
    await this.pool?.end();
  }
}
