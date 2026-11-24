import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Database } from '../database';
import { GamesService } from './games.service';
import { GameStatus } from './game.model';

test('faz o CRUD e atualiza o progresso e os favoritos', async t => {
  const db = new Database(':memory:');
  t.after(() => db.onModuleDestroy());
  const games = new GamesService(db);
  const game = await games.create({ name: 'Hades' });
  assert.deepEqual(await games.findById(game.id), {
    id: game.id, name: 'Hades', status: GameStatus.Playing, progress: 0,
    favorite: false, completed: false,
    platform: 'PC', genre: null, rating: null, imageUrl: null, notes: null,
  });
  const played = await games.update(game.id, { progress: 45, status: GameStatus.Played, favorite: true });
  assert.equal(played.progress, 45);
  assert.equal(played.completed, false);
  const finished = await games.update(game.id, { progress: 100 });
  assert.equal(finished.status, GameStatus.Completed);
  assert.equal(finished.completed, true);
  assert.equal(finished.favorite, true);
  assert.equal((await games.update(game.id, { status: GameStatus.Playing })).progress, 0);
  await games.remove(game.id);
  await assert.rejects(() => games.findById(game.id), NotFoundException);
  await assert.rejects(() => games.update(game.id, { favorite: false }), NotFoundException);
  await assert.rejects(() => games.remove(game.id), NotFoundException);
});

test('combina busca por nome, status e favoritos', async t => {
  const db = new Database(':memory:');
  t.after(() => db.onModuleDestroy());
  const games = new GamesService(db);
  const match = await games.create({ name: 'Pókemon Arceus', status: GameStatus.Wishlist, favorite: true });
  await games.create({ name: 'Pokémon Y', status: GameStatus.Wishlist });
  await games.create({ name: 'Pokémon X', favorite: true });
  assert.deepEqual(await games.findAll({ search: 'POKEMON', status: GameStatus.Wishlist, favorite: true }), [match]);
  assert.deepEqual(await games.findAll({ search: '%' }), []);
  assert.equal((await games.findAll({ favorite: false })).length, 1);
});

test('rejeita progresso incompatível e preserva o ID nas transições da wishlist', async t => {
  const db = new Database(':memory:');
  t.after(() => db.onModuleDestroy());
  const games = new GamesService(db);
  await assert.rejects(() => games.create({ name: 'Celeste', status: GameStatus.Completed, progress: 50 }), BadRequestException);
  const game = await games.create({ name: 'Celeste', status: GameStatus.Wishlist });
  await assert.rejects(() => games.update(game.id, { progress: 1 }), BadRequestException);
  await assert.rejects(() => games.update(game.id, {}), BadRequestException);
  assert.deepEqual(await games.findById(game.id), game);
  const updated = await games.update(game.id, { status: GameStatus.Playing, progress: 5 });
  assert.equal(updated.id, game.id);
  assert.equal(updated.progress, 5);
});
