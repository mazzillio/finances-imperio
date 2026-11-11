import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { Response } from 'express';
import { and, asc, desc, eq, gte, ilike, inArray, isNull, lte, sql, type SQL } from 'drizzle-orm';
import type { Db, Tx } from '../db/client.js';
import { DB } from '../db/db.module.js';
import { categories, dailyTotals, transactionAudit, transactions, users } from '../db/schema.js';
import { writeTransactionsXlsx } from './transactions.export.js';
import type {
  CreateTransactionDto,
  ListTransactionsQuery,
  SummaryQuery,
  UpdateTransactionDto,
} from './transactions.dto.js';

type TransactionRow = typeof transactions.$inferSelect;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function encodeCursor(row: { occurredOn: string; id: string }) {
  return Buffer.from(`${row.occurredOn}|${row.id}`).toString('base64url');
}

function decodeCursor(cursor: string) {
  const [occurredOn, id] = Buffer.from(cursor, 'base64url').toString().split('|');
  if (!occurredOn || !id || !/^\d{4}-\d{2}-\d{2}$/.test(occurredOn) || !UUID_RE.test(id)) {
    throw new BadRequestException('Cursor de página inválido. Volte para a primeira página.');
  }
  return { occurredOn, id };
}

@Injectable()
export class TransactionsService {
  constructor(@Inject(DB) private readonly db: Db) {}

  /** `withTotals = false` pula a soma em daily_totals (a exportação não precisa dela a cada lote). */
  async list(query: ListTransactionsQuery, withTotals = true) {
    const limit = query.limit ?? 20;
    const filters: SQL[] = [isNull(transactions.deletedAt)];
    const totalsFilters: SQL[] = [];
    if (query.from) {
      filters.push(gte(transactions.occurredOn, query.from));
      totalsFilters.push(gte(dailyTotals.day, query.from));
    }
    if (query.to) {
      filters.push(lte(transactions.occurredOn, query.to));
      totalsFilters.push(lte(dailyTotals.day, query.to));
    }
    if (query.type) {
      filters.push(eq(transactions.type, query.type));
      totalsFilters.push(eq(dailyTotals.type, query.type));
    }
    if (query.categoryId) {
      filters.push(eq(transactions.categoryId, query.categoryId));
      totalsFilters.push(eq(dailyTotals.categoryId, query.categoryId));
    }
    const q = query.q?.trim();
    if (q) filters.push(ilike(transactions.description, `%${q.replace(/[%_\\]/g, '\\$&')}%`));

    const pageFilters = [...filters];
    if (query.cursor) {
      const c = decodeCursor(query.cursor);
      // Paginação por cursor (keyset): usa o índice (occurred_on desc, id desc) e não fica lenta no fim.
      pageFilters.push(sql`(${transactions.occurredOn}, ${transactions.id}) < (${c.occurredOn}, ${c.id})`);
    }

    const [rows, totals] = await Promise.all([
      this.db
        .select({
          id: transactions.id,
          type: transactions.type,
          categoryId: transactions.categoryId,
          categoryName: categories.name,
          categoryColor: categories.color,
          amountCents: transactions.amountCents,
          description: transactions.description,
          occurredOn: transactions.occurredOn,
          createdAt: transactions.createdAt,
          /** Quem lançou (nome de usuário). */
          createdByName: users.username,
        })
        .from(transactions)
        .innerJoin(categories, eq(categories.id, transactions.categoryId))
        .innerJoin(users, eq(users.id, transactions.createdBy))
        .where(and(...pageFilters))
        .orderBy(desc(transactions.occurredOn), desc(transactions.id))
        .limit(limit + 1),
      // Total e somas vêm de daily_totals (rápido em qualquer volume). Com busca por texto
      // não dá para usar o resumo, então devolvemos null e a tela mostra só "próxima".
      q || !withTotals
        ? Promise.resolve(null)
        : this.db
            .select({
              count: sql<number>`coalesce(sum(${dailyTotals.count}), 0)::int`,
              inCents: sql<number>`coalesce(sum(${dailyTotals.totalCents}) filter (where ${dailyTotals.type} = 'entrada'), 0)::bigint`,
              outCents: sql<number>`coalesce(sum(${dailyTotals.totalCents}) filter (where ${dailyTotals.type} = 'saida'), 0)::bigint`,
            })
            .from(dailyTotals)
            .where(totalsFilters.length ? and(...totalsFilters) : undefined)
            .then(([t]) => ({ count: Number(t.count), inCents: Number(t.inCents), outCents: Number(t.outCents) })),
    ]);

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const edits = await this.lastEdits(page.map((r) => r.id));
    const items = page.map((r) => ({
      ...r,
      /** Última alteração (quem e quando); null se o lançamento nunca foi editado. */
      editedAt: edits.get(r.id)?.at ?? null,
      editedByName: edits.get(r.id)?.username ?? null,
    }));
    return {
      items,
      nextCursor: hasMore ? encodeCursor(items[items.length - 1]) : null,
      totals,
    };
  }

  async summary({ from, to }: SummaryQuery) {
    if (from > to) throw new BadRequestException('A data inicial precisa ser antes da final');
    const range = and(gte(dailyTotals.day, from), lte(dailyTotals.day, to));
    const inSum = sql<number>`coalesce(sum(${dailyTotals.totalCents}) filter (where ${dailyTotals.type} = 'entrada'), 0)::bigint`;
    const outSum = sql<number>`coalesce(sum(${dailyTotals.totalCents}) filter (where ${dailyTotals.type} = 'saida'), 0)::bigint`;
    const month = sql<string>`to_char(${dailyTotals.day}, 'YYYY-MM')`;

    const [[totals], byCategory, byMonth] = await Promise.all([
      this.db.select({ inCents: inSum, outCents: outSum, count: sql<number>`coalesce(sum(${dailyTotals.count}), 0)::int` }).from(dailyTotals).where(range),
      this.db
        .select({
          categoryId: dailyTotals.categoryId,
          name: categories.name,
          color: categories.color,
          type: dailyTotals.type,
          totalCents: sql<number>`sum(${dailyTotals.totalCents})::bigint`,
          count: sql<number>`sum(${dailyTotals.count})::int`,
        })
        .from(dailyTotals)
        .innerJoin(categories, eq(categories.id, dailyTotals.categoryId))
        .where(range)
        .groupBy(dailyTotals.categoryId, categories.name, categories.color, dailyTotals.type)
        .having(sql`sum(${dailyTotals.count}) > 0`)
        .orderBy(sql`sum(${dailyTotals.totalCents}) desc`, asc(dailyTotals.categoryId)),
      this.db
        .select({ month, inCents: inSum, outCents: outSum })
        .from(dailyTotals)
        .where(range)
        .groupBy(month)
        .orderBy(month),
    ]);

    const num = <T extends Record<string, unknown>>(r: T, keys: (keyof T)[]) =>
      ({ ...r, ...Object.fromEntries(keys.map((k) => [k, Number(r[k])])) }) as T;
    const inCents = Number(totals.inCents);
    const outCents = Number(totals.outCents);
    return {
      from,
      to,
      inCents,
      outCents,
      balanceCents: inCents - outCents,
      count: Number(totals.count),
      byCategory: byCategory.map((r) => num(r, ['totalCents', 'count'])),
      byMonth: byMonth.map((r) => {
        const x = num(r, ['inCents', 'outCents']);
        return { ...x, balanceCents: x.inCents - x.outCents };
      }),
    };
  }

  /**
   * Exporta para Excel os lançamentos com os mesmos filtros da lista (sem limite de página).
   * Lê em lotes pelo cursor e escreve direto na resposta: a memória não cresce com o volume.
   */
  async exportXlsx(query: ListTransactionsQuery, res: Response) {
    const { limit: _limit, cursor: _cursor, ...filters } = query;
    if (filters.from && filters.to && filters.from > filters.to) {
      throw new BadRequestException('A data inicial precisa ser antes da final');
    }
    const batches = async function* (this: TransactionsService) {
      let cursor: string | undefined;
      do {
        const page = await this.list({ ...filters, limit: 1000, cursor }, false);
        yield page.items;
        cursor = page.nextCursor ?? undefined;
      } while (cursor);
    }.call(this);
    await writeTransactionsXlsx(res, filters, batches);
  }

  create(dto: CreateTransactionDto, userId: string) {
    return this.db.transaction(async (tx) => {
      await this.assertCategory(tx, dto.categoryId, dto.type);
      const [row] = await tx
        .insert(transactions)
        .values({ ...dto, description: dto.description?.trim() ?? '', createdBy: userId })
        .returning();
      await this.applyTotals(tx, row, 1);
      await tx.insert(transactionAudit).values({ transactionId: row.id, action: 'criado', after: row, userId });
      return row;
    });
  }

  update(id: string, dto: UpdateTransactionDto, userId: string) {
    return this.db.transaction(async (tx) => {
      const before = await this.lockActive(tx, id);
      // Só os campos enviados sobrescrevem o lançamento atual.
      const changes = Object.fromEntries(Object.entries(dto).filter(([, v]) => v !== undefined));
      const next = { ...before, ...changes, description: dto.description?.trim() ?? before.description };
      await this.assertCategory(tx, next.categoryId, next.type);
      await this.applyTotals(tx, before, -1);
      const [after] = await tx
        .update(transactions)
        .set({
          type: next.type,
          categoryId: next.categoryId,
          amountCents: next.amountCents,
          description: next.description,
          occurredOn: next.occurredOn,
        })
        .where(eq(transactions.id, id))
        .returning();
      await this.applyTotals(tx, after, 1);
      await tx.insert(transactionAudit).values({ transactionId: id, action: 'alterado', before, after, userId });
      return after;
    });
  }

  remove(id: string, userId: string) {
    return this.db.transaction(async (tx) => {
      const before = await this.lockActive(tx, id);
      await tx.update(transactions).set({ deletedAt: new Date() }).where(eq(transactions.id, id));
      await this.applyTotals(tx, before, -1);
      await tx.insert(transactionAudit).values({ transactionId: id, action: 'excluido', before, userId });
    });
  }

  /** Última edição de cada lançamento, lida do histórico (índice transaction_id, at). Só os da página. */
  private async lastEdits(ids: string[]) {
    if (ids.length === 0) return new Map<string, { at: Date; username: string }>();
    const rows = await this.db
      .selectDistinctOn([transactionAudit.transactionId], {
        transactionId: transactionAudit.transactionId,
        at: transactionAudit.at,
        username: users.username,
      })
      .from(transactionAudit)
      .innerJoin(users, eq(users.id, transactionAudit.userId))
      .where(and(inArray(transactionAudit.transactionId, ids), eq(transactionAudit.action, 'alterado')))
      .orderBy(transactionAudit.transactionId, desc(transactionAudit.at));
    return new Map(rows.map((r) => [r.transactionId, { at: r.at, username: r.username }]));
  }

  /** Lê o lançamento travando a linha, para duas edições simultâneas não bagunçarem os totais. */
  private async lockActive(tx: Tx, id: string) {
    if (!UUID_RE.test(id)) throw new NotFoundException('Lançamento não encontrado');
    const [row] = await tx
      .select()
      .from(transactions)
      .where(and(eq(transactions.id, id), isNull(transactions.deletedAt)))
      .for('update');
    if (!row) throw new NotFoundException('Lançamento não encontrado');
    return row;
  }

  private async assertCategory(tx: Tx, categoryId: number, type: string) {
    const [cat] = await tx.select().from(categories).where(eq(categories.id, categoryId));
    if (!cat) throw new BadRequestException('Categoria não encontrada');
    if (cat.type !== type) {
      throw new BadRequestException(
        `A categoria "${cat.name}" é de ${cat.type === 'entrada' ? 'entradas' : 'saídas'}. Escolha uma categoria do mesmo tipo do lançamento.`,
      );
    }
    if (cat.archived) throw new BadRequestException(`A categoria "${cat.name}" está arquivada`);
  }

  /** Soma (sign = 1) ou subtrai (sign = -1) o lançamento do resumo diário, no mesmo tx. */
  private async applyTotals(tx: Tx, row: TransactionRow, sign: 1 | -1) {
    const delta = row.amountCents * sign;
    await tx
      .insert(dailyTotals)
      .values({
        day: row.occurredOn,
        categoryId: row.categoryId,
        type: row.type,
        totalCents: delta,
        count: sign,
      })
      .onConflictDoUpdate({
        target: [dailyTotals.day, dailyTotals.categoryId],
        set: {
          totalCents: sql`${dailyTotals.totalCents} + ${delta}`,
          count: sql`${dailyTotals.count} + ${sign}`,
        },
      });
  }
}
