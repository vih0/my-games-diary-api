import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { SearchDto } from '../common/dto';
import { uuidPipe } from '../common/http';
import { CreateListDto } from './dto/create-list.dto';
import { UpdateListDto } from './dto/update-list.dto';
import { ListsService } from './lists.service';

@Controller('lists')
export class ListsController {
  constructor(private readonly lists: ListsService) {}

  @Post()
  create(@Body() input: CreateListDto) {
    return this.lists.create(input);
  }

  @Get()
  findAll(@Query() query: SearchDto) {
    return this.lists.findAll(query);
  }

  @Get(':id')
  findById(@Param('id', uuidPipe('id')) id: string) {
    return this.lists.findById(id);
  }

  @Patch(':id')
  update(@Param('id', uuidPipe('id')) id: string, @Body() input: UpdateListDto) {
    return this.lists.update(id, input);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id', uuidPipe('id')) id: string) {
    return this.lists.remove(id);
  }

  @Get(':id/games')
  findGames(@Param('id', uuidPipe('id')) id: string, @Query() query: SearchDto) {
    return this.lists.findGames(id, query);
  }

  @Post(':id/games/:gameId')
  addGame(
    @Param('id', uuidPipe('id')) id: string,
    @Param('gameId', uuidPipe('gameId')) gameId: string,
  ) {
    return this.lists.addGame(id, gameId);
  }

  @Delete(':id/games/:gameId')
  @HttpCode(204)
  removeGame(
    @Param('id', uuidPipe('id')) id: string,
    @Param('gameId', uuidPipe('gameId')) gameId: string,
  ) {
    return this.lists.removeGame(id, gameId);
  }
}
