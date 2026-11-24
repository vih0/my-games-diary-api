import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DatabaseSync, SQLOutputValue } from 'node:sqlite';
import { Database, SqlValue } from './database';

function sqlValue(value: SQLOutputValue | undefined): SqlValue {
  if (value == null) return null;
  if (value instanceof Uint8Array) return Buffer.from(value);
  if (typeof value === 'bigint') throw new Error('Inteiro fora do formato esperado no SQLite.');
  return value;
}

async function run() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('Configure DATABASE_URL no .env.');
  const command = process.argv[2];
  const db = new Database(':memory:', connectionString);
  try {
    if (command === 'setup') {
      const schema = readFileSync(resolve(__dirname, '../supabase/schema.sql'), 'utf8');
      await db.transaction(async tx => {
        for (const statement of schema.split(';').map(sql => sql.trim()).filter(Boolean)) {
          await tx.query(statement);
        }
      });
      console.log('Esquema MyGamesDiary configurado.');
      return;
    }
    if (command !== 'import') throw new Error('Comando de banco inválido.');
    const source = new DatabaseSync(process.env.DB_PATH ?? 'data/my-games-diary.sqlite', { readOnly: true });
    try {
      source.exec('BEGIN');
      const games = source.prepare('SELECT * FROM games').all();
      const lists = source.prepare('SELECT id, name, search_name FROM lists').all();
      const links = source.prepare('SELECT list_id, game_id FROM list_games').all();
      source.exec('COMMIT');
      await db.transaction(async tx => {
        const columns = [
          'id', 'name', 'search_name', 'status', 'progress', 'favorite',
          'platform', 'genre', 'rating', 'image_url', 'notes', 'cover', 'cover_type',
        ];
        for (const game of games) {
          await tx.query(`
            INSERT INTO games (${columns.join(', ')})
            VALUES (${columns.map((_, index) => `$${index + 1}`).join(', ')})
            ON CONFLICT (id) DO NOTHING
          `, ...columns.map(column => sqlValue(game[column] ?? (column === 'platform' ? 'PC' : null))));
        }
        for (const list of lists) {
          await tx.query(`
            INSERT INTO lists (id, name, search_name) VALUES ($1, $2, $3)
            ON CONFLICT (id) DO NOTHING
          `, sqlValue(list.id), sqlValue(list.name), sqlValue(list.search_name));
        }
        for (const link of links) {
          await tx.query(`
            INSERT INTO list_games (list_id, game_id) VALUES ($1, $2)
            ON CONFLICT (list_id, game_id) DO NOTHING
          `, sqlValue(link.list_id), sqlValue(link.game_id));
        }
      });
      console.log('Importação concluída. Registros já existentes no destino foram preservados.');
    } finally {
      source.close();
    }
  } finally {
    await db.onModuleDestroy();
  }
}

void run().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Falha na configuração do banco.');
  process.exitCode = 1;
});
