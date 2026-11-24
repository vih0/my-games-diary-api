import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Database, SqlClient } from '../database';
import { SearchDto } from '../common/dto';
import { normalizeName } from '../common/search';
import { GamesService } from '../games/games.service';
import { CreateListDto } from './dto/create-list.dto';
import { UpdateListDto } from './dto/update-list.dto';
import { GameList } from './list.model';

@Injectable()
export class ListsService {
  constructor(@Inject(Database) private readonly db: SqlClient, private readonly games: GamesService) {}

  async create({ name }: CreateListDto): Promise<GameList> {
    const [list] = await this.db.query<GameList>(
      'INSERT INTO lists (id, name, search_name) VALUES ($1, $2, $3) RETURNING id, name',
      randomUUID(), name, normalizeName(name),
    );
    return list;
  }

  async findAll({ search = '' }: SearchDto = {}): Promise<GameList[]> {
    return this.db.query<GameList>(
      'SELECT id, name FROM lists WHERE strpos(search_name, $1) > 0 ORDER BY search_name, id',
      normalizeName(search),
    );
  }

  async findById(id: string): Promise<GameList> {
    const [list] = await this.db.query<GameList>('SELECT id, name FROM lists WHERE id = $1', id);
    if (!list) throw new NotFoundException('Lista não encontrada.');
    return list;
  }

  async update(id: string, { name }: UpdateListDto): Promise<GameList> {
    const [list] = await this.db.query<GameList>(
      'UPDATE lists SET name = $2, search_name = $3 WHERE id = $1 RETURNING id, name',
      id, name, normalizeName(name),
    );
    if (!list) throw new NotFoundException('Lista não encontrada.');
    return list;
  }

  async remove(id: string): Promise<void> {
    const [row] = await this.db.query('DELETE FROM lists WHERE id = $1 RETURNING id', id);
    if (!row) throw new NotFoundException('Lista não encontrada.');
  }

  async findGames(id: string, query: SearchDto = {}) {
    await this.findById(id);
    return this.games.findAll(query, id);
  }

  async addGame(id: string, gameId: string) {
    await this.findById(id);
    const game = await this.games.findById(gameId);
    try {
      const [row] = await this.db.query(`
        INSERT INTO list_games (list_id, game_id) VALUES ($1, $2)
        ON CONFLICT(list_id, game_id) DO NOTHING RETURNING game_id
      `, id, gameId);
      if (!row) throw new ConflictException('Este jogo já está na lista.');
      return game;
    } catch (error) {
      if (error && typeof error === 'object' &&
        (('code' in error && error.code === '23503') || ('errcode' in error && error.errcode === 787))) {
        throw new NotFoundException('A lista ou o jogo foi removido.');
      }
      throw error;
    }
  }

  async removeGame(id: string, gameId: string): Promise<void> {
    await this.findById(id);
    const [row] = await this.db.query(
      'DELETE FROM list_games WHERE list_id = $1 AND game_id = $2 RETURNING game_id', id, gameId,
    );
    if (!row) throw new NotFoundException('Jogo não encontrado nesta lista.');
  }
}
