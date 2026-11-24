import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { SqlClient, SqlValue } from './database';
import { GamesService } from './games/games.service';
import { GameStatus } from './games/game.model';
import { ListsService } from './lists/lists.service';

test('executa o esquema e o fluxo do diário em PostgreSQL', async t => {
  const pg = new PGlite();
  t.after(() => pg.close());
  await pg.exec(readFileSync(resolve(__dirname, '../supabase/schema.sql'), 'utf8'));
  await pg.exec('SET search_path TO my_games_diary');
  const db: SqlClient = {
    query: async <T>(sql: string, ...values: SqlValue[]) => (await pg.query<T>(sql, values)).rows,
  };
  const games = new GamesService(db);
  const lists = new ListsService(db, games);
  const game = await games.create({
    name: 'Pokémon', platform: 'Switch', genre: 'RPG', rating: 5,
    imageUrl: 'https://example.com/cover.png', notes: 'Começar no fim de semana',
    status: GameStatus.Wishlist, favorite: true,
  });
  assert.equal(game.platform, 'Switch');
  assert.equal(game.rating, 5);
  assert.equal(game.imageUrl, 'https://example.com/cover.png');
  const list = await lists.create({ name: 'Para jogar' });
  await lists.addGame(list.id, game.id);
  assert.deepEqual(await lists.findGames(list.id, { search: 'POKEMON' }), [game]);
  assert.deepEqual(await games.findAll({ favorite: false }), []);
  const updated = await games.update(game.id, { rating: null, progress: 50, status: GameStatus.Playing });
  assert.equal(updated.progress, 50);
  assert.equal(updated.rating, null);
  assert.equal(updated.notes, game.notes);
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a4XcAAAAASUVORK5CYII=', 'base64');
  const covered = await games.replaceCover(game.id, { buffer: png } as Express.Multer.File);
  assert.equal(covered.imageUrl, `/api/games/${game.id}/cover`);
  assert.deepEqual(await games.findCover(game.id), { buffer: png, type: 'image/png' });
  await games.remove(game.id);
  assert.deepEqual(await lists.findGames(list.id), []);
});
