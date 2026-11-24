import {
  IsBoolean, IsEnum, IsInt, IsOptional, IsString, IsUrl, Length, Max, MaxLength, Min,
} from 'class-validator';
import { Trim, WhenProvided } from '../../common/dto';
import { GameStatus } from '../game.model';

export class GameDetailsDto {
  @WhenProvided()
  @Trim()
  @IsString({ message: 'platform deve ser texto.' })
  @Length(1, 80, { message: 'platform deve ter entre 1 e 80 caracteres.' })
  platform?: string;

  @IsOptional()
  @Trim()
  @IsString({ message: 'genre deve ser texto.' })
  @MaxLength(80, { message: 'genre deve ter até 80 caracteres.' })
  genre?: string | null;

  @IsOptional()
  @IsInt({ message: 'rating deve ser um número inteiro.' })
  @Min(1, { message: 'rating deve ser pelo menos 1.' })
  @Max(5, { message: 'rating deve ser no máximo 5.' })
  rating?: number | null;

  @IsOptional()
  @Trim()
  @MaxLength(2048, { message: 'imageUrl deve ter até 2048 caracteres.' })
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true }, {
    message: 'imageUrl deve ser uma URL HTTP ou HTTPS válida.',
  })
  imageUrl?: string | null;

  @IsOptional()
  @Trim()
  @IsString({ message: 'notes deve ser texto.' })
  @MaxLength(5000, { message: 'notes deve ter até 5000 caracteres.' })
  notes?: string | null;

  @WhenProvided()
  @IsBoolean({ message: 'favorite deve ser true ou false.' })
  favorite?: boolean;
}

export class GameFieldsDto extends GameDetailsDto {
  @WhenProvided()
  @IsEnum(GameStatus, { message: 'status deve ser wishlist, playing, played ou completed.' })
  status?: GameStatus;

  @WhenProvided()
  @IsInt({ message: 'progress deve ser um número inteiro.' })
  @Min(0, { message: 'progress deve ser maior ou igual a 0.' })
  @Max(100, { message: 'progress deve ser menor ou igual a 100.' })
  progress?: number;
}

export class CreateGameDto extends GameFieldsDto {
  @Trim()
  @IsString({ message: 'name deve ser texto.' })
  @Length(1, 150, { message: 'name deve ter entre 1 e 150 caracteres.' })
  name!: string;
}
