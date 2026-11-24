import { Body, Controller, Delete, Get, Header, HttpCode, Param, Patch, Post, Put, Query, StreamableFile, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { MAX_COVER_SIZE } from './cover';
import { uuidPipe } from '../common/http';
import { CreateGameDto } from './dto/create-game.dto';
import { QueryGamesDto } from './dto/query-games.dto';
import { UpdateGameDto } from './dto/update-game.dto';
import { GamesService } from './games.service';

@Controller('games')
export class GamesController {
  constructor(private readonly games: GamesService) {}

  @Post()
  create(@Body() input: CreateGameDto) {
    return this.games.create(input);
  }

  @Get()
  findAll(@Query() query: QueryGamesDto) {
    return this.games.findAll(query);
  }

  @Get(':id')
  findById(@Param('id', uuidPipe('id')) id: string) {
    return this.games.findById(id);
  }

  @Patch(':id')
  update(@Param('id', uuidPipe('id')) id: string, @Body() input: UpdateGameDto) {
    return this.games.update(id, input);
  }

  @Put(':id/cover')
  @UseInterceptors(FileInterceptor('file', {
    limits: { fileSize: MAX_COVER_SIZE + 1, files: 1, fields: 0 },
  }))
  uploadCover(@Param('id', uuidPipe('id')) id: string, @UploadedFile() file?: Express.Multer.File) {
    return this.games.replaceCover(id, file);
  }

  @Get(':id/cover')
  @Header('Cache-Control', 'no-store')
  @Header('X-Content-Type-Options', 'nosniff')
  async findCover(@Param('id', uuidPipe('id')) id: string) {
    const { buffer, type } = await this.games.findCover(id);
    return new StreamableFile(buffer, { type });
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id', uuidPipe('id')) id: string) {
    return this.games.remove(id);
  }
}
