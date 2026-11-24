import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum } from 'class-validator';
import { SearchDto, WhenProvided } from '../../common/dto';
import { GameStatus } from '../game.model';

export class QueryGamesDto extends SearchDto {
  @WhenProvided()
  @IsEnum(GameStatus, { message: 'status deve ser wishlist, playing, played ou completed.' })
  status?: GameStatus;

  @WhenProvided()
  @Transform(({ value }: { value: unknown }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsBoolean({ message: 'favorite deve ser true ou false.' })
  favorite?: boolean;
}
