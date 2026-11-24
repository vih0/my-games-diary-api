import { IsString, Length } from 'class-validator';
import { Trim } from '../../common/dto';

export class CreateListDto {
  @Trim()
  @IsString({ message: 'name deve ser texto.' })
  @Length(1, 150, { message: 'name deve ter entre 1 e 150 caracteres.' })
  name!: string;
}
