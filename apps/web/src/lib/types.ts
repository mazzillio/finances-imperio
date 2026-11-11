export type TransactionType = 'entrada' | 'saida';

export const PAGE_SIZES = [20, 50, 100, 200] as const;
export type PageSize = (typeof PAGE_SIZES)[number];

export interface Me {
  username: string;
  isAdmin: boolean;
}

export interface Invite {
  id: string;
  username: string;
  createdAt: string;
  expiresAt: string;
  usedAt: string | null;
  createdByName: string;
}

/** Resposta da criação: o token só existe aqui, o servidor não guarda. */
export interface CreatedInvite {
  id: string;
  username: string;
  expiresAt: string;
  token: string;
}

export interface Category {
  id: number;
  name: string;
  type: TransactionType;
  color: string;
  archived: boolean;
}

export interface CategoryInput {
  name: string;
  type: TransactionType;
  color?: string;
}

export type CategoryPatch = Partial<Pick<Category, 'name' | 'color' | 'archived'>>;

export interface Transaction {
  id: string;
  type: TransactionType;
  categoryId: number;
  categoryName: string;
  categoryColor: string;
  amountCents: number;
  description: string;
  occurredOn: string;
  /** Quando foi lançado (ISO) e por quem. */
  createdAt: string;
  createdByName: string;
  /** Última edição (ISO) e quem fez; null se nunca foi editado. */
  editedAt: string | null;
  editedByName: string | null;
}

export interface TransactionPage {
  items: Transaction[];
  nextCursor: string | null;
  totals: { count: number; inCents: number; outCents: number } | null;
}

export interface Summary {
  from: string;
  to: string;
  inCents: number;
  outCents: number;
  balanceCents: number;
  /** Saldo acumulado desde o primeiro lançamento (não depende do período). */
  totalBalanceCents: number;
  count: number;
  byCategory: { categoryId: number; name: string; color: string; type: TransactionType; totalCents: number; count: number }[];
  byMonth: { month: string; inCents: number; outCents: number; balanceCents: number }[];
}

/** Fechamento de um dia com movimento. */
export interface BalanceDay {
  day: string;
  inCents: number;
  outCents: number;
  /** Resultado do dia: entradas menos saídas. */
  netCents: number;
  /** Saldo acumulado ao fim do dia. */
  closingCents: number;
  count: number;
}

export interface BalanceHistory {
  from: string;
  to: string;
  /** Do dia mais recente para o mais antigo. */
  days: BalanceDay[];
}

export interface TransactionInput {
  type: TransactionType;
  categoryId: number;
  amountCents: number;
  description: string;
  occurredOn: string;
}

export interface TransactionFilters {
  from?: string;
  to?: string;
  type?: TransactionType;
  categoryId?: number;
  q?: string;
}
