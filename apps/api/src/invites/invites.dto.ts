import { Transform } from 'class-transformer';
import { IsString, Length, Matches, MaxLength, MinLength } from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value);

export class CreateInviteDto {
  /** Nome que o colaborador vai usar para entrar. */
  @Transform(trim)
  @IsString({ message: 'informe o nome do colaborador' })
  @Matches(/^[\p{L}\p{N}][\p{L}\p{N} ._-]{1,39}$/u, {
    message: 'use de 2 a 40 caracteres no nome: letras, números, espaço, ponto, hífen ou sublinhado',
  })
  username: string;
}

export class InviteTokenDto {
  @IsString({ message: 'convite inválido' })
  @Length(20, 100, { message: 'convite inválido' })
  token: string;
}

export class AcceptInviteDto extends InviteTokenDto {
  @IsString({ message: 'informe a senha' })
  @MinLength(8, { message: 'use pelo menos 8 caracteres na senha' })
  // O bcrypt só considera os primeiros 72 bytes.
  @MaxLength(72, { message: 'use no máximo 72 caracteres na senha' })
  password: string;
}
