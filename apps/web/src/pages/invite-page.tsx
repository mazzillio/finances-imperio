import { useQuery } from '@tanstack/react-query';
import { KeyRound, LinkIcon } from 'lucide-react';
import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router';
import { api, friendlyError } from '../lib/api';
import { session } from '../lib/session';

const INVALID = 'Este convite é inválido, já foi usado ou expirou. Peça um novo link ao administrador.';

/** Página pública do link de convite: o colaborador confere o nome e cria a senha. */
export function InvitePage() {
  const navigate = useNavigate();
  // O token vem depois do "#", que o navegador não envia ao servidor.
  const [token] = useState(() => window.location.hash.slice(1));
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const invite = useQuery({
    queryKey: ['invite', token],
    queryFn: () => api.lookupInvite(token),
    enabled: token.length >= 20,
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: Infinity,
  });

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const password = String(form.get('password') ?? '');
    if (password.length < 8) return setError('Use pelo menos 8 caracteres na senha.');
    if (password !== String(form.get('confirm') ?? '')) return setError('As duas senhas não são iguais.');
    setPending(true);
    setError(null);
    try {
      const res = await api.acceptInvite(token, password);
      session.signIn(res.accessToken, res.username);
      void navigate('/', { replace: true });
    } catch (err) {
      setError(friendlyError(err, INVALID));
      setPending(false);
    }
  }

  let content: ReactNode;
  if (token.length < 20 || invite.isError) {
    content = (
      <div className="card grid gap-4 p-6 text-center">
        <LinkIcon className="mx-auto size-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{invite.isError ? friendlyError(invite.error, INVALID) : INVALID}</p>
        <Link to="/login" className="btn btn-outline">
          Ir para o login
        </Link>
      </div>
    );
  } else if (invite.isPending) {
    content = <div className="card p-6 text-center text-muted-foreground">Conferindo o convite…</div>;
  } else {
    content = (
      <form onSubmit={onSubmit} className="card grid gap-6 p-6">
        <div className="grid gap-1.5">
          <h1 className="text-xl">Criar sua conta</h1>
          <p className="text-sm text-muted-foreground">
            Você foi convidado como <strong className="text-gold-300">{invite.data.username}</strong>. Esse será o seu usuário para
            entrar. Escolha uma senha.
          </p>
        </div>
        {/* Campo escondido com o usuário: ajuda o gerenciador de senhas a salvar o par certo. */}
        <input type="text" name="username" value={invite.data.username} autoComplete="username" readOnly hidden />
        <label className="grid gap-2 text-sm font-medium">
          Senha
          <input name="password" type="password" required minLength={8} maxLength={72} autoComplete="new-password" autoFocus className="field" />
          <span className="text-xs font-normal text-muted-foreground">Pelo menos 8 caracteres.</span>
        </label>
        <label className="grid gap-2 text-sm font-medium">
          Repita a senha
          <input name="confirm" type="password" required minLength={8} maxLength={72} autoComplete="new-password" className="field" />
        </label>
        {error && (
          <p role="alert" className="text-sm text-out">
            {error}
          </p>
        )}
        <button disabled={pending} className="btn btn-primary w-full">
          <KeyRound /> {pending ? 'Criando conta…' : 'Criar conta e entrar'}
        </button>
      </form>
    );
  }

  return (
    <main className="grid min-h-screen place-items-center px-4">
      <div className="grid w-full max-w-sm gap-6">
        <div className="flex flex-col items-center gap-2">
          <img src="/logo-imperio.png" alt="" width={72} height={72} />
          <span className="font-semibold text-gold-300">Império Poker · Finanças</span>
        </div>
        {content}
      </div>
    </main>
  );
}
