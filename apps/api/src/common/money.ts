/** Formato de mês aceito na API: AAAA-MM. */
export const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
/** Formato de dia aceito na API: AAAA-MM-DD. */
export const DAY_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

export const PAGE_SIZES = [20, 50, 100, 200] as const;
export const TRANSACTION_TYPES = ['entrada', 'saida'] as const;

export type TransactionType = (typeof TRANSACTION_TYPES)[number];
