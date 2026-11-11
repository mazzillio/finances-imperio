import { CanActivate, ExecutionContext, ForbiddenException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { eq } from 'drizzle-orm';
import type { Request } from 'express';
import type { Db } from '../db/client.js';
import { DB } from '../db/db.module.js';
import { users } from '../db/schema.js';

export interface AuthUser {
  sub: string;
  username: string;
}

export type AuthedRequest = Request & { user: AuthUser };

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const [scheme, token] = req.headers.authorization?.split(' ') ?? [];
    if (scheme !== 'Bearer' || !token) throw new UnauthorizedException('Faça login para continuar');
    try {
      req.user = await this.jwt.verifyAsync<AuthUser>(token);
      return true;
    } catch {
      throw new UnauthorizedException('Sessão expirada. Faça login de novo');
    }
  }
}

/**
 * Só administradores. Use depois do AuthGuard: `@UseGuards(AuthGuard, AdminGuard)`.
 * Consulta o banco a cada chamada (e não o token), então tirar o admin de alguém vale na hora.
 */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(@Inject(DB) private readonly db: Db) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const [user] = await this.db.select({ isAdmin: users.isAdmin }).from(users).where(eq(users.id, req.user.sub));
    if (!user?.isAdmin) throw new ForbiddenException('Só administradores podem fazer isso');
    return true;
  }
}
