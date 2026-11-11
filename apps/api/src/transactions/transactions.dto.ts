import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  DAY_RE,
  PAGE_SIZES,
  TRANSACTION_TYPES,
  type TransactionType,
} from '../common/money.js';

/** Teto por lançamento: R$ 20 milhões (cabe com folga em integer de centavos). */
export const MAX_AMOUNT_CENTS = 2_000_000_000;

export class CreateTransactionDto {
  @IsIn(TRANSACTION_TYPES, { message: 'o tipo deve ser entrada ou saida' })
  type: TransactionType;

  @IsInt({ message: 'escolha a categoria' })
  @Min(1, { message: 'escolha a categoria' })
  categoryId: number;

  @IsInt({ message: 'informe o valor em centavos (número inteiro)' })
  @Min(1, { message: 'o valor deve ser maior que zero' })
  @Max(MAX_AMOUNT_CENTS, { message: 'o valor passa do limite de R$ 20 milhões por lançamento' })
  amountCents: number;

  @IsOptional()
  @IsString({ message: 'a descrição deve ser um texto' })
  @MaxLength(200, { message: 'use no máximo 200 caracteres na descrição' })
  description?: string;

  @Matches(DAY_RE, { message: 'informe a data no formato AAAA-MM-DD' })
  occurredOn: string;
}

export class UpdateTransactionDto {
  @IsOptional()
  @IsIn(TRANSACTION_TYPES, { message: 'o tipo deve ser entrada ou saida' })
  type?: TransactionType;

  @IsOptional()
  @IsInt({ message: 'escolha a categoria' })
  @Min(1, { message: 'escolha a categoria' })
  categoryId?: number;

  @IsOptional()
  @IsInt({ message: 'informe o valor em centavos (número inteiro)' })
  @Min(1, { message: 'o valor deve ser maior que zero' })
  @Max(MAX_AMOUNT_CENTS, { message: 'o valor passa do limite de R$ 20 milhões por lançamento' })
  amountCents?: number;

  @IsOptional()
  @IsString({ message: 'a descrição deve ser um texto' })
  @MaxLength(200, { message: 'use no máximo 200 caracteres na descrição' })
  description?: string;

  @IsOptional()
  @Matches(DAY_RE, { message: 'informe a data no formato AAAA-MM-DD' })
  occurredOn?: string;
}

export class ListTransactionsQuery {
  @IsOptional()
  @Matches(DAY_RE, { message: 'use a data inicial no formato AAAA-MM-DD' })
  from?: string;

  @IsOptional()
  @Matches(DAY_RE, { message: 'use a data final no formato AAAA-MM-DD' })
  to?: string;

  @IsOptional()
  @IsIn(TRANSACTION_TYPES, { message: 'o tipo deve ser entrada ou saida' })
  type?: TransactionType;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'categoria inválida' })
  categoryId?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100, { message: 'use no máximo 100 caracteres na busca' })
  q?: string;

  @IsOptional()
  @Type(() => Number)
  @IsIn(PAGE_SIZES, { message: 'escolha 20, 50, 100 ou 200 por página' })
  limit?: number;

  /** Cursor devolvido em `nextCursor` da página anterior. */
  @IsOptional()
  @IsString()
  cursor?: string;
}

export class SummaryQuery {
  @Matches(DAY_RE, { message: 'use a data inicial no formato AAAA-MM-DD' })
  from: string;

  @Matches(DAY_RE, { message: 'use a data final no formato AAAA-MM-DD' })
  to: string;
}
