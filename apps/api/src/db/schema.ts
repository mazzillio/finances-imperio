import { relations, sql } from 'drizzle-orm';
import {
  bigint,
  bigserial,
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { uuidv7 } from 'uuidv7';

export const transactionTypeEnum = pgEnum('transaction_type', ['entrada', 'saida']);
export const auditActionEnum = pgEnum('audit_action', ['criado', 'alterado', 'excluido']);

export const users = pgTable(
  'users',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    username: text('username').notNull(),
    passwordHash: text('password_hash').notNull(),
    /** Administrador pode convidar colaboradores. Quem entra por convite não é admin. */
    isAdmin: boolean('is_admin').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('users_username_lower_idx').on(sql`lower(${t.username})`)],
);

/**
 * Convite para um colaborador criar a própria conta. O link leva um token aleatório;
 * aqui fica só o hash (SHA-256), então quem ler o banco não consegue montar o link.
 */
export const invites = pgTable(
  'invites',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    /** Nome de usuário que a conta terá (definido pelo admin). */
    username: text('username').notNull(),
    tokenHash: text('token_hash').notNull(),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    /** Preenchido quando a conta é criada: o convite vale uma vez só. */
    usedAt: timestamp('used_at', { withTimezone: true }),
  },
  (t) => [uniqueIndex('invites_token_hash_idx').on(t.tokenHash), index('invites_created_by_idx').on(t.createdBy)],
);

export const categories = pgTable(
  'categories',
  {
    id: serial('id').primaryKey(),
    name: text('name').notNull(),
    /** Uma categoria pertence só a entradas ou só a saídas. */
    type: transactionTypeEnum('type').notNull(),
    /** Cor em hex (#rrggbb) usada nos gráficos. */
    color: text('color').notNull().default('#7d8790'),
    /** Arquivada some dos formulários, mas continua nos relatórios antigos. */
    archived: boolean('archived').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('categories_type_name_lower_idx').on(t.type, sql`lower(${t.name})`)],
);

export const transactions = pgTable(
  'transactions',
  {
    /** UUID v7: ordenado no tempo, então o índice da PK cresce no fim e não se fragmenta. */
    id: uuid('id')
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    type: transactionTypeEnum('type').notNull(),
    // Sem cascade de propósito: categoria com lançamentos não pode sumir (arquive em vez de apagar).
    categoryId: integer('category_id')
      .notNull()
      .references(() => categories.id, { onDelete: 'restrict' }),
    /** Em centavos, sempre positivo. O sinal vem de `type`. */
    amountCents: integer('amount_cents').notNull(),
    description: text('description').notNull().default(''),
    /** Dia do lançamento (competência), sem hora. */
    occurredOn: date('occurred_on', { mode: 'string' }).notNull(),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    /** Exclusão lógica: lançamento financeiro nunca é apagado de verdade. */
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    check('transactions_amount_positive', sql`${t.amountCents} > 0`),
    // Lista principal e paginação por cursor. O Postgres lê o índice de trás para frente para o
    // ORDER BY occurred_on DESC, id DESC. Não declare DESC NULLS LAST aqui: com essa ordem o
    // índice deixa de servir para o ORDER BY padrão. Parcial: ignora excluídos.
    index('transactions_occurred_idx')
      .on(t.occurredOn, t.id)
      .where(sql`${t.deletedAt} is null`),
    index('transactions_category_occurred_idx').on(t.categoryId, t.occurredOn),
    index('transactions_created_by_idx').on(t.createdBy),
    // Busca "contém" na descrição sem varrer a tabela (precisa da extensão pg_trgm).
    index('transactions_description_trgm_idx').using('gin', sql`${t.description} gin_trgm_ops`),
  ],
);

/**
 * Totais por dia e categoria. Atualizado na mesma transação de cada
 * lançamento, então cards, gráficos e relatórios leem daqui e não varrem `transactions`.
 */
export const dailyTotals = pgTable(
  'daily_totals',
  {
    day: date('day', { mode: 'string' }).notNull(),
    // sem índice próprio: coberto pelo índice (category_id, day) abaixo
    categoryId: integer('category_id')
      .notNull()
      .references(() => categories.id, { onDelete: 'restrict' }),
    type: transactionTypeEnum('type').notNull(),
    /** Soma em centavos. bigint porque a soma de muitos lançamentos passa do limite de integer. */
    totalCents: bigint('total_cents', { mode: 'number' }).notNull().default(0),
    count: integer('count').notNull().default(0),
  },
  (t) => [
    primaryKey({ columns: [t.day, t.categoryId] }),
    index('daily_totals_category_day_idx').on(t.categoryId, t.day),
  ],
);

/** Histórico de alterações: quem mudou, quando, e o lançamento antes e depois. */
export const transactionAudit = pgTable(
  'transaction_audit',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    transactionId: uuid('transaction_id')
      .notNull()
      .references(() => transactions.id, { onDelete: 'restrict' }),
    action: auditActionEnum('action').notNull(),
    before: jsonb('before'),
    after: jsonb('after'),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('transaction_audit_transaction_idx').on(t.transactionId, t.at),
    index('transaction_audit_user_idx').on(t.userId),
  ],
);

export const categoriesRelations = relations(categories, ({ many }) => ({
  transactions: many(transactions),
}));

export const transactionsRelations = relations(transactions, ({ one }) => ({
  category: one(categories, { fields: [transactions.categoryId], references: [categories.id] }),
  author: one(users, { fields: [transactions.createdBy], references: [users.id] }),
}));
