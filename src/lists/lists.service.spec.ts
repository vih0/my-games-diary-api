import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { Database } from '../database';
import { GamesService } from '../games/games.service';
import { ListsService } from './lists.service';

test('faz o CRUD de listas e pesquisa por nome', async t => {
  const db = new Database(':memory:');
  t.after(() => db.onModuleDestroy());
  const lists = new ListsService(db, new GamesService(db));
  const list = await lists.create({ name: 'Clássicos' });
  assert.deepEqual(await lists.findAll({ search: 'CLASSICO' }), [list]);
  assert.deepEqual(await lists.findById(list.id), list);
  assert.equal((await lists.update(list.id, { name: 'Indies' })).name, 'Indies');
  await lists.remove(list.id);
  assert.deepEqual(await lists.findAll(), []);
  await assert.rejects(() => lists.findGames(list.id), NotFoundException);
  await assert.rejects(() => lists.update(list.id, { name: 'RPGs' }), NotFoundException);
  await assert.rejects(() => lists.remove(list.id), NotFoundException);
});

test('gerencia vínculos, filtra jogos e remove vínculos em cascata', async t => {
  const db = new Database(':memory:');
  t.after(() => db.onModuleDestroy());
  const games = new GamesService(db);
  const lists = new ListsService(db, games);
  const game = await games.create({ name: 'Celeste' });
  const other = await games.create({ name: 'Hades' });
  const list = await lists.create({ name: 'Indies' });
  const second = await lists.create({ name: 'Favoritos' });
  await assert.rejects(() => lists.addGame(list.id, 'inexistente'), NotFoundException);
  assert.deepEqual(await lists.addGame(list.id, game.id), game);
  await lists.addGame(second.id, game.id);
  await lists.addGame(list.id, other.id);
  await assert.rejects(() => lists.addGame(list.id, game.id), ConflictException);
  assert.deepEqual(await lists.findGames(list.id, { search: 'CELE' }), [game]);
  await lists.removeGame(list.id, game.id);
  assert.deepEqual(await lists.findGames(list.id), [other]);
  await assert.rejects(() => lists.removeGame(list.id, game.id), NotFoundException);
  await lists.remove(list.id);
  assert.deepEqual(await games.findById(other.id), other);
  await games.remove(game.id);
  assert.deepEqual(await lists.findGames(second.id), []);
});
