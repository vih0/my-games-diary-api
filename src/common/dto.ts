import { Transform } from 'class-transformer';
import { IsString, Length, ValidateIf } from 'class-validator';

export function Trim() {
  return Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value);
}

export function WhenProvided() {
  return ValidateIf((_object, value: unknown) => value !== undefined);
}

export class SearchDto {
  @WhenProvided()
  @Trim()
  @IsString({ message: 'search deve ser texto.' })
  @Length(0, 150, { message: 'search deve ter até 150 caracteres.' })
  search?: string;
}
