import { config } from '../config';
import { session } from './session';
import type {
  BalanceHistory,
  Category,
  CreatedInvite,
  Invite,
  Me,
  CategoryInput,
  CategoryPatch,
  PageSize,
  Summary,
  TransactionFilters,
  TransactionInput,
  TransactionPage,
} from './types';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(
  path: string,
  { method = 'GET', body, auth = true }: { method?: string; body?: unknown; auth?: boolean } = {},
): Promise<T> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const token = session.get().token;
  if (auth && token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(config.apiUrl + path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'Não foi possível falar com o servidor. Verifique sua conexão.');
  }
  if (res.status === 401 && auth) session.expire();
  if (res.status === 204) return undefined as T;
  const data = (await res.json().catch(() => ({}))) as { message?: string | string[] };
  if (!res.ok) {
    const msg = Array.isArray(data.message) ? data.message.join('. ') : data.message;
    throw new ApiError(res.status, msg ?? 'Algo deu errado. Tente de novo.');
  }
  return data as T;
}

const qs = (params: Record<string, string | number | undefined>) => {
  const s = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') s.set(k, String(v));
  const str = s.toString();
  return str ? `?${str}` : '';
};

export const api = {
  login: (username: string, password: string) =>
    request<{ accessToken: string; username: string }>('/auth/login', {
      method: 'POST',
      body: { username, password },
      auth: false,
    }),
  me: () => request<Me>('/auth/me'),
  listInvites: () => request<Invite[]>('/invites'),
  createInvite: (username: string) => request<CreatedInvite>('/invites', { method: 'POST', body: { username } }),
  revokeInvite: (id: string) => request<void>(`/invites/${id}`, { method: 'DELETE' }),
  /** Públicos: quem recebeu o link ainda não tem conta. */
  lookupInvite: (token: string) =>
    request<{ username: string; expiresAt: string }>('/invites/lookup', { method: 'POST', body: { token }, auth: false }),
  acceptInvite: (token: string, password: string) =>
    request<{ accessToken: string; username: string }>('/invites/accept', {
      method: 'POST',
      body: { token, password },
      auth: false,
    }),
  listCategories: () => request<Category[]>('/categories'),
  listTransactions: (filters: TransactionFilters, limit: PageSize, cursor?: string) =>
    request<TransactionPage>(`/transactions${qs({ ...filters, limit, cursor })}`),
  summary: (from: string, to: string) => request<Summary>(`/transactions/summary${qs({ from, to })}`),
  balanceHistory: (from: string, to: string) =>
    request<BalanceHistory>(`/transactions/balance-history${qs({ from, to })}`),
  createTransaction: (input: TransactionInput) =>
    request('/transactions', { method: 'POST', body: input }),
  updateTransaction: (id: string, input: Partial<TransactionInput>) =>
    request(`/transactions/${id}`, { method: 'PATCH', body: input }),
  deleteTransaction: (id: string) => request<void>(`/transactions/${id}`, { method: 'DELETE' }),
  createCategory: (input: CategoryInput) => request<Category>('/categories', { method: 'POST', body: input }),
  updateCategory: (id: number, patch: CategoryPatch) =>
    request<Category>(`/categories/${id}`, { method: 'PATCH', body: patch }),
  /** Baixa a planilha .xlsx com os mesmos filtros da lista. */
  exportTransactions: async (filters: TransactionFilters, filename: string) => {
    const token = session.get().token;
    let res: Response;
    try {
      res = await fetch(`${config.apiUrl}/transactions/export${qs({ ...filters })}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
    } catch {
      throw new ApiError(0, 'Não foi possível falar com o servidor. Verifique sua conexão.');
    }
    if (res.status === 401) session.expire();
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { message?: string | string[] };
      const msg = Array.isArray(data.message) ? data.message.join('. ') : data.message;
      throw new ApiError(res.status, msg ?? 'Não foi possível gerar a planilha.');
    }
    const url = URL.createObjectURL(await res.blob());
    const a = Object.assign(document.createElement('a'), { href: url, download: filename });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },
};

export function friendlyError(error: unknown, notFound = 'Não encontrado.') {
  if (!(error instanceof ApiError)) return 'Algo deu errado. Tente de novo.';
  if (error.status === 0) return error.message;
  if (error.status === 401) return 'Sua sessão expirou. Entre de novo.';
  if (error.status === 404) return notFound;
  if (error.status === 403) return 'Só administradores podem fazer isso.';
  if (error.status === 400 || error.status === 409) return error.message;
  return 'O servidor não respondeu como esperado. Tente de novo em instantes.';
}
