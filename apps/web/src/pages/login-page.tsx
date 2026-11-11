import { LogIn } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Navigate } from 'react-router';
import { api, friendlyError } from '../lib/api';
import { session, useSession } from '../lib/session';

// Mesmo layout do login do ranking (bloco "login-01" do shadcn).
export function LoginPage() {
  const { token, expired } = useSession();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  if (token) return <Navigate to="/" replace />;

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setPending(true);
    setError(null);
    try {
      const res = await api.login(String(form.get('username')), String(form.get('password')));
      session.signIn(res.accessToken, res.username);
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center px-4">
      <div className="grid w-full max-w-sm gap-6">
        <div className="flex flex-col items-center gap-2">
          <img src="/logo-imperio.png" alt="" width={72} height={72} />
          <span className="font-semibold text-gold-300">Império Poker · Finanças</span>
        </div>
        <form onSubmit={onSubmit} className="card grid gap-6 p-6">
          <div className="grid gap-1.5">
            <h1 className="text-xl">Entrar</h1>
            <p className="text-sm text-muted-foreground">
              {expired ? 'Sua sessão expirou. Entre de novo.' : 'Acesso ao controle de entradas e saídas.'}
            </p>
          </div>
          <label className="grid gap-2 text-sm font-medium">
            Usuário
            <input name="username" required autoComplete="username" className="field" />
          </label>
          <label className="grid gap-2 text-sm font-medium">
            Senha
            <input name="password" type="password" required autoComplete="current-password" className="field" />
          </label>
          {error && (
            <p role="alert" className="text-sm text-out">
              {error}
            </p>
          )}
          <button disabled={pending} className="btn btn-primary w-full">
            <LogIn />
            {pending ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
      </div>
    </main>
  );
}
