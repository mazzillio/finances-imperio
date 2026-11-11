import { useSyncExternalStore } from 'react';

// Sem servidor próprio para o front, o token fica no localStorage (não há cookie httpOnly).
const KEY = 'imperio-financas-session';

export interface Session {
  token: string | null;
  username: string | null;
  expired: boolean;
}

function read(): Session {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...(JSON.parse(raw) as Omit<Session, 'expired'>), expired: false };
  } catch {
    // modo privado ou storage bloqueado
  }
  return { token: null, username: null, expired: false };
}

let state = read();
const listeners = new Set<() => void>();

function set(next: Session) {
  state = next;
  try {
    if (next.token) localStorage.setItem(KEY, JSON.stringify({ token: next.token, username: next.username }));
    else localStorage.removeItem(KEY);
  } catch {
    // ignora
  }
  listeners.forEach((l) => l());
}

export const session = {
  get: () => state,
  signIn: (token: string, username: string) => set({ token, username, expired: false }),
  signOut: () => set({ token: null, username: null, expired: false }),
  expire: () => set({ token: null, username: null, expired: true }),
  subscribe: (l: () => void) => {
    listeners.add(l);
    return () => listeners.delete(l);
  },
};

export const useSession = () => useSyncExternalStore(session.subscribe, session.get);
