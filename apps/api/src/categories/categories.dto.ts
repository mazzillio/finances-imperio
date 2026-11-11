import { IsBoolean, IsIn, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { TRANSACTION_TYPES, type TransactionType } from '../common/money.js';

export class CreateCategoryDto {
  @IsString({ message: 'informe o nome da categoria' })
  @MinLength(1, { message: 'informe o nome da categoria' })
  @MaxLength(60, { message: 'use no máximo 60 caracteres no nome' })
  name: string;

  @IsIn(TRANSACTION_TYPES, { message: 'o tipo deve ser entrada ou saida' })
  type: TransactionType;

  @IsOptional()
  @Matches(/^#[0-9a-fA-F]{6}$/, { message: 'use uma cor no formato #rrggbb' })
  color?: string;
}

export class UpdateCategoryDto {
  @IsOptional()
  @IsString({ message: 'informe o nome da categoria' })
  @MinLength(1, { message: 'informe o nome da categoria' })
  @MaxLength(60, { message: 'use no máximo 60 caracteres no nome' })
  name?: string;

  @IsOptional()
  @Matches(/^#[0-9a-fA-F]{6}$/, { message: 'use uma cor no formato #rrggbb' })
  color?: string;

  @IsOptional()
  @IsBoolean({ message: 'archived deve ser verdadeiro ou falso' })
  archived?: boolean;
}
