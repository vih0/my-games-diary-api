import { Module } from '@nestjs/common';
import { Database } from './database';
import { GamesController } from './games/games.controller';
import { WishlistController } from './games/wishlist.controller';
import { GamesService } from './games/games.service';
import { ListsController } from './lists/lists.controller';
import { ListsService } from './lists/lists.service';

@Module({
  controllers: [GamesController, WishlistController, ListsController],
  providers: [
    {
      provide: Database,
      useFactory: async () => {
        const db = new Database(process.env.DB_PATH ?? 'data/my-games-diary.sqlite', process.env.DATABASE_URL);
        try {
          await db.query('SELECT platform, genre, rating, image_url, notes, cover_type FROM games LIMIT 0');
          return db;
        } catch (error) {
          await db.onModuleDestroy();
          if (error && typeof error === 'object' && 'code' in error && error.code === '42P01') {
            throw new Error('Esquema do MyGamesDiary ausente. Execute npm run db:setup.');
          }
          throw error;
        }
      },
    },
    GamesService,
    ListsService,
  ],
})
export class AppModule {}
