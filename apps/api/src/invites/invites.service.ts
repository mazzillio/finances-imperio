import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import { and, desc, eq, gt, isNull, sql } from 'drizzle-orm';
import { createHash, randomBytes } from 'node:crypto';
import type { Db } from '../db/client.js';
import { DB } from '../db/db.module.js';
import { invites, users } from '../db/schema.js';

/** Validade do link. */
const INVITE_DAYS = 7;
const UNIQUE_VIOLATION = '23505';

/** Mesma resposta para token inexistente, usado, cancelado ou vencido: não revela qual foi o caso. */
const invalidInvite = () => new NotFoundException('Convite inválido ou expirado. Peça um novo link ao administrador.');

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');
const sameName = (column: typeof users.username | typeof invites.username, name: string) =>
  sql`lower(${column}) = lower(${name})`;

@Injectable()
export class InvitesService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly jwt: JwtService,
  ) {}

  /**
   * Gera o convite e devolve o token UMA vez. No banco fica só o hash,
   * então nem o admin consegue recuperar o link depois: se perder, gera outro.
   */
  async create(username: string, adminId: string) {
    const token = randomBytes(32).toString('base64url'); // 256 bits
    const expiresAt = new Date(Date.now() + INVITE_DAYS * 24 * 60 * 60 * 1000);

    return this.db.transaction(async (tx) => {
      const [taken] = await tx.select({ id: users.id }).from(users).where(sameName(users.username, username)).limit(1);
      if (taken) throw new ConflictException(`Já existe um usuário chamado "${username}"`);
      // Um convite pendente por nome: gerar de novo invalida o link anterior.
      await tx.delete(invites).where(and(sameName(invites.username, username), isNull(invites.usedAt)));
      const [row] = await tx
        .insert(invites)
        .values({ username, tokenHash: hashToken(token), createdBy: adminId, expiresAt })
        .returning({ id: invites.id, username: invites.username, expiresAt: invites.expiresAt });
      return { ...row, token };
    });
  }

  list() {
    return this.db
      .select({
        id: invites.id,
        username: invites.username,
        createdAt: invites.createdAt,
        expiresAt: invites.expiresAt,
        usedAt: invites.usedAt,
        createdByName: users.username,
      })
      .from(invites)
      .innerJoin(users, eq(users.id, invites.createdBy))
      .orderBy(desc(invites.createdAt))
      .limit(100);
  }

  /** Cancela um convite que ainda não foi usado. */
  async revoke(id: string) {
    const [row] = await this.db
      .delete(invites)
      .where(and(eq(invites.id, id), isNull(invites.usedAt)))
      .returning({ id: invites.id });
    if (!row) throw new NotFoundException('Convite não encontrado ou já utilizado');
  }

  /** Tela do convite: confere o link e mostra para quem ele é. */
  async lookup(token: string) {
    const [invite] = await this.db
      .select({ username: invites.username, expiresAt: invites.expiresAt })
      .from(invites)
      .where(this.valid(token));
    if (!invite) throw invalidInvite();
    return invite;
  }

  /** Cria a conta do colaborador com a senha escolhida, marca o convite como usado e já devolve a sessão. */
  async accept(token: string, password: string) {
    // Confere o convite antes do bcrypt (lento): link inválido não gasta processamento.
    await this.lookup(token);
    const passwordHash = await bcrypt.hash(password, 12);

    const user = await this.db.transaction(async (tx) => {
      // FOR UPDATE: dois envios ao mesmo tempo não criam duas contas com o mesmo convite.
      const [invite] = await tx.select().from(invites).where(this.valid(token)).for('update');
      if (!invite) throw invalidInvite();
      try {
        const [created] = await tx
          .insert(users)
          .values({ username: invite.username, passwordHash, isAdmin: false })
          .returning({ id: users.id, username: users.username });
        await tx.update(invites).set({ usedAt: new Date() }).where(eq(invites.id, invite.id));
        return created;
      } catch (e) {
        const code = (e as { code?: string; cause?: { code?: string } }).code ?? (e as { cause?: { code?: string } }).cause?.code;
        if (code === UNIQUE_VIOLATION) throw new ConflictException('Já existe um usuário com esse nome. Peça um novo convite ao administrador.');
        throw e;
      }
    });

    const accessToken = await this.jwt.signAsync({ sub: user.id, username: user.username });
    return { accessToken, username: user.username };
  }

  /** Convite com esse token, ainda não usado e dentro da validade. */
  private valid(token: string) {
    return and(eq(invites.tokenHash, hashToken(token)), isNull(invites.usedAt), gt(invites.expiresAt, new Date()));
  }
}
