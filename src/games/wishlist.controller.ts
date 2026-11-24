import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Query } from '@nestjs/common';
import { SearchDto } from '../common/dto';
import { uuidPipe } from '../common/http';
import { CreateWishlistGameDto } from './dto/create-wishlist-game.dto';
import { GameStatus } from './game.model';
import { GamesService } from './games.service';

@Controller('wishlist')
export class WishlistController {
  constructor(private readonly games: GamesService) {}

  @Get()
  findAll(@Query() query: SearchDto) {
    return this.games.findAll({ ...query, status: GameStatus.Wishlist });
  }

  @Post()
  create(@Body() input: CreateWishlistGameDto) {
    return this.games.create({ ...input, status: GameStatus.Wishlist });
  }

  @Put(':id')
  add(@Param('id', uuidPipe('id')) id: string) {
    return this.games.update(id, { status: GameStatus.Wishlist });
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id', uuidPipe('id')) id: string) {
    await this.games.update(id, { status: GameStatus.Playing }, GameStatus.Wishlist);
  }
}
