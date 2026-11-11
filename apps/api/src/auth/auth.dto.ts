import { IsString, MinLength } from 'class-validator';

export class LoginDto {
  @IsString({ message: 'informe o usuário' })
  @MinLength(1, { message: 'informe o usuário' })
  username: string;

  @IsString({ message: 'informe a senha' })
  @MinLength(1, { message: 'informe a senha' })
  password: string;
}
