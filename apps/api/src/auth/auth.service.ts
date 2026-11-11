import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import { eq, sql } from 'drizzle-orm';
import type { Db } from '../db/client.js';
import { DB } from '../db/db.module.js';
import { users } from '../db/schema.js';

@Injectable()
export class AuthService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly jwt: JwtService,
  ) {}

  async login(username: string, password: string) {
    const [user] = await this.db
      .select()
      .from(users)
      .where(sql`lower(${users.username}) = lower(${username})`)
      .limit(1);
    // Mesma mensagem para usuário inexistente e senha errada.
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new UnauthorizedException('Usuário ou senha inválidos');
    }
    const accessToken = await this.jwt.signAsync({ sub: user.id, username: user.username });
    return { accessToken, username: user.username };
  }

  async me(userId: string) {
    const [user] = await this.db
      .select({ username: users.username, isAdmin: users.isAdmin })
      .from(users)
      .where(eq(users.id, userId));
    if (!user) throw new UnauthorizedException('Sessão expirada. Faça login de novo');
    return user;
  }
}
