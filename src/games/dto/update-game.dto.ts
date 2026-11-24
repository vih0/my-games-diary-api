import { IsString, Length } from 'class-validator';
import { Trim, WhenProvided } from '../../common/dto';
import { GameFieldsDto } from './create-game.dto';

export class UpdateGameDto extends GameFieldsDto {
  @WhenProvided()
  @Trim()
  @IsString({ message: 'name deve ser texto.' })
  @Length(1, 150, { message: 'name deve ter entre 1 e 150 caracteres.' })
  name?: string;
}
