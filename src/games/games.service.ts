import {
  BadRequestException, ConflictException, Inject, Injectable, NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Database, SqlClient, SqlValue } from '../database';
import { normalizeName } from '../common/search';
import { CreateGameDto } from './dto/create-game.dto';
import { UpdateGameDto } from './dto/update-game.dto';
import { QueryGamesDto } from './dto/query-games.dto';
import { Game, GameStatus } from './game.model';
import { detectCoverType } from './cover';

type GameRow = Omit<Game, 'favorite' | 'completed'> & { favorite: number; coverType: string | null };

const gameColumns = `id, name, status, progress, favorite, platform, genre, rating, notes,
  image_url AS "imageUrl", cover_type AS "coverType"`;

function toGame({ coverType, ...row }: GameRow): Game {
  return {
    ...row,
    imageUrl: coverType ? `/api/games/${row.id}/cover` : row.imageUrl,
    favorite: row.favorite === 1,
    completed: row.status === GameStatus.Completed,
  };
}

@Injectable()
export class GamesService {
  constructor(@Inject(Database) private readonly db: SqlClient) {}

  async create(input: CreateGameDto): Promise<Game> {
    const state = this.resolveProgress(input.status ?? GameStatus.Playing, input.progress);
    const [row] = await this.db.query<GameRow>(`
      INSERT INTO games (id, name, search_name, status, progress, favorite,
        platform, genre, rating, image_url, notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING ${gameColumns}
    `, randomUUID(), input.name, normalizeName(input.name), state.status, state.progress,
    Number(input.favorite ?? false), input.platform ?? 'PC', input.genre || null,
    input.rating ?? null, input.imageUrl ?? null, input.notes || null);
    return toGame(row);
  }

  async findAll(query: QueryGamesDto = {}, listId?: string): Promise<Game[]> {
    const rows = await this.db.query<GameRow>(`
      SELECT ${gameColumns} FROM games
      WHERE strpos(search_name, $1) > 0
        AND (CAST($2 AS TEXT) IS NULL OR status = $2)
        AND (CAST($3 AS INTEGER) IS NULL OR favorite = $3)
        AND (CAST($4 AS TEXT) IS NULL OR EXISTS (
          SELECT 1 FROM list_games WHERE list_id = $4 AND game_id = games.id
        ))
      ORDER BY search_name, id
    `, normalizeName(query.search ?? ''), query.status ?? null,
    query.favorite === undefined ? null : Number(query.favorite), listId ?? null);
    return rows.map(toGame);
  }

  async findById(id: string): Promise<Game> {
    const [row] = await this.db.query<GameRow>(`SELECT ${gameColumns} FROM games WHERE id = $1`, id);
    if (!row) throw new NotFoundException('Jogo não encontrado.');
    return toGame(row);
  }

  async update(id: string, input: UpdateGameDto, expectedStatus?: GameStatus): Promise<Game> {
    const { name, status, progress, favorite, platform, genre, rating, imageUrl, notes } = input;
    if ([name, status, progress, favorite, platform, genre, rating, imageUrl, notes]
      .every(value => value === undefined)) {
      throw new BadRequestException('Informe pelo menos um campo para atualizar o jogo.');
    }

    // Releia o estado se outra atualização de progresso ocorrer entre a leitura e a escrita.
    for (let attempt = 0; attempt < 5; attempt++) {
      const current = await this.findById(id);
      if (expectedStatus && current.status !== expectedStatus) {
        throw new NotFoundException('Jogo não encontrado na wishlist.');
      }
      const nextStatus = status ?? current.status;
      const fallback = nextStatus === GameStatus.Wishlist ||
        (current.completed && nextStatus !== current.status) ? 0 : current.progress;
      const state = this.resolveProgress(nextStatus, progress, fallback);
      const values: SqlValue[] = [id, current.status, current.progress];
      const assignments: string[] = [];
      const set = (column: string, value: SqlValue) => {
        assignments.push(`${column} = $${values.push(value)}`);
      };

      set('status', state.status);
      set('progress', state.progress);
      if (name !== undefined) {
        set('name', name);
        set('search_name', normalizeName(name));
      }
      if (favorite !== undefined) set('favorite', Number(favorite));
      if (platform !== undefined) set('platform', platform);
      if (genre !== undefined) set('genre', genre || null);
      if (rating !== undefined) set('rating', rating);
      if (notes !== undefined) set('notes', notes || null);
      if (imageUrl !== undefined) {
        set('image_url', imageUrl);
        assignments.push('cover = NULL', 'cover_type = NULL');
      }

      const [row] = await this.db.query<GameRow>(`
        UPDATE games SET ${assignments.join(', ')}
        WHERE id = $1 AND status = $2 AND progress = $3
        RETURNING ${gameColumns}
      `, ...values);
      if (row) return toGame(row);
    }
    throw new ConflictException('O progresso do jogo mudou durante a atualização. Tente novamente.');
  }

  async remove(id: string): Promise<void> {
    const [row] = await this.db.query('DELETE FROM games WHERE id = $1 RETURNING id', id);
    if (!row) throw new NotFoundException('Jogo não encontrado.');
  }

  async replaceCover(id: string, file: Express.Multer.File | undefined): Promise<Game> {
    if (!file?.buffer.length) throw new BadRequestException('Envie uma imagem no campo file.');
    const type = detectCoverType(file.buffer);
    const [row] = await this.db.query<GameRow>(`
      UPDATE games SET cover = $2, cover_type = $3, image_url = NULL
      WHERE id = $1 RETURNING ${gameColumns}
    `, id, file.buffer, type);
    if (!row) throw new NotFoundException('Jogo não encontrado.');
    return toGame(row);
  }

  async findCover(id: string) {
    const [row] = await this.db.query<{ cover: Uint8Array | null; type: string | null }>(
      'SELECT cover, cover_type AS type FROM games WHERE id = $1', id,
    );
    if (!row?.cover || !row.type) throw new NotFoundException('Capa não encontrada.');
    return { buffer: Buffer.from(row.cover), type: row.type };
  }

  private resolveProgress(status: GameStatus, progress?: number, fallback = 0) {
    if (status === GameStatus.Completed) {
      if (progress !== undefined && progress !== 100) {
        throw new BadRequestException('Um jogo finalizado deve ter progresso de 100%.');
      }
      return { status, progress: 100 };
    }
    if (status === GameStatus.Wishlist && progress !== undefined && progress !== 0) {
      throw new BadRequestException('Um jogo na wishlist deve ter progresso de 0%.');
    }
    const value = progress ?? fallback;
    return { status: value === 100 ? GameStatus.Completed : status, progress: value };
  }
}
