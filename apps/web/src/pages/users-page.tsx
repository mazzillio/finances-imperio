import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Copy, Link2, ShieldAlert, Trash2, UserPlus } from 'lucide-react';
import { useRef, useState, type FormEvent } from 'react';
import { SiteHeader } from '../components/site-header';
import { api, friendlyError } from '../lib/api';
import { useSession } from '../lib/session';
import type { CreatedInvite, Invite } from '../lib/types';

const dateTime = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const fmt = (iso: string) => dateTime.format(new Date(iso)).replace(', ', ' às ');

/** O token fica depois do "#": essa parte do endereço não é enviada ao servidor nem aparece em logs. */
const inviteUrl = (token: string) => `${window.location.origin}${import.meta.env.BASE_URL}convite#${token}`;

export function UsersPage() {
  const qc = useQueryClient();
  const { username } = useSession();
  const me = useQuery({ queryKey: ['me', username], queryFn: api.me, staleTime: 60_000 });
  const isAdmin = me.data?.isAdmin === true;
  const invites = useQuery({ queryKey: ['invites'], queryFn: api.listInvites, enabled: isAdmin });
  const [created, setCreated] = useState<CreatedInvite | null>(null);
  const [error, setError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: api.createInvite,
    onSuccess: (invite) => {
      setCreated(invite);
      setError(null);
      void qc.invalidateQueries({ queryKey: ['invites'] });
    },
    onError: (err) => setError(friendlyError(err)),
  });

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formEl = e.currentTarget;
    const name = String(new FormData(formEl).get('username') ?? '').trim();
    if (name.length < 2) return setError('Informe o nome do colaborador.');
    create.mutate(name, { onSuccess: () => formEl.reset() });
  }

  return (
    <>
      <SiteHeader />
      <main className="mx-auto grid max-w-3xl gap-4 px-4 py-8">
        <div className="grid gap-1">
          <h1 className="text-2xl text-gold-300">Usuários</h1>
          <p className="text-sm text-muted-foreground">
            Convide um colaborador: você informa o nome, envia o link e ele mesmo cria a senha.
          </p>
        </div>

        {me.isPending ? (
          <p className="text-muted-foreground">Carregando…</p>
        ) : !isAdmin ? (
          <div className="card flex items-center gap-3 p-4 text-muted-foreground">
            <ShieldAlert className="size-5 shrink-0 text-gold-400" />
            Só administradores podem convidar usuários.
          </div>
        ) : (
          <>
            <form onSubmit={onSubmit} className="card grid gap-3 p-4">
              <h2 className="text-lg font-semibold">Novo convite</h2>
              <div className="flex flex-wrap gap-2">
                <input
                  name="username"
                  placeholder="Nome do colaborador (será o usuário de acesso)"
                  maxLength={40}
                  autoComplete="off"
                  aria-label="Nome do colaborador"
                  className="field min-w-56 flex-1"
                />
                <button disabled={create.isPending} className="btn btn-primary">
                  <UserPlus /> {create.isPending ? 'Gerando…' : 'Gerar link'}
                </button>
              </div>
              {error && (
                <p role="alert" className="text-sm text-out">
                  {error}
                </p>
              )}
            </form>

            {created && <CreatedInviteCard invite={created} onDismiss={() => setCreated(null)} />}

            <section className="card grid gap-3 p-4">
              <h2 className="text-lg font-semibold">Convites</h2>
              {invites.isError ? (
                <p className="text-out">Não foi possível carregar os convites.</p>
              ) : invites.isPending ? (
                <p className="text-muted-foreground">Carregando…</p>
              ) : invites.data.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum convite gerado ainda.</p>
              ) : (
                <ul className="divide-y">
                  {invites.data.map((i) => (
                    <InviteRow key={i.id} invite={i} />
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </main>
    </>
  );
}

/** Mostra o link uma única vez, logo depois de gerar. */
function CreatedInviteCard({ invite, onDismiss }: { invite: CreatedInvite; onDismiss: () => void }) {
  const url = inviteUrl(invite.token);
  const inputRef = useRef<HTMLInputElement>(null);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Sem HTTPS (ex.: acesso pelo IP da rede) a área de transferência moderna não existe: usa o modo antigo.
      inputRef.current?.select();
      document.execCommand('copy');
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <section className="card grid gap-3 border-primary/40 p-4 ring-1 ring-primary/20">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <Link2 className="size-5 text-gold-400" /> Link de convite para <span className="text-gold-300">{invite.username}</span>
      </h2>
      <div className="flex flex-wrap gap-2">
        <input
          ref={inputRef}
          readOnly
          value={url}
          onFocus={(e) => e.currentTarget.select()}
          aria-label="Link de convite"
          className="field min-w-56 flex-1 font-mono text-xs"
        />
        <button type="button" onClick={() => void copy()} className="btn btn-primary">
          {copied ? <Check /> : <Copy />} {copied ? 'Copiado' : 'Copiar link'}
        </button>
      </div>
      <ul className="grid gap-1 text-sm text-muted-foreground">
        <li>
          <strong className="text-foreground">Copie agora.</strong> Por segurança o link não fica guardado e não aparece de novo. Se
          perder, gere outro.
        </li>
        <li>Vale até {fmt(invite.expiresAt)} e só pode ser usado uma vez.</li>
        <li>Envie só para {invite.username}: quem abrir o link define a senha da conta.</li>
      </ul>
      <div className="flex justify-end">
        <button type="button" onClick={onDismiss} className="btn btn-ghost btn-sm">
          Já copiei, fechar
        </button>
      </div>
    </section>
  );
}

function InviteRow({ invite: i }: { invite: Invite }) {
  const qc = useQueryClient();
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const revoke = useMutation({
    mutationFn: () => api.revokeInvite(i.id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['invites'] }),
    onError: (err) => setError(friendlyError(err, 'Esse convite já foi usado ou cancelado.')),
  });

  const expired = !i.usedAt && new Date(i.expiresAt) < new Date();
  const status = i.usedAt
    ? { label: 'Conta criada', cls: 'bg-in/15 text-in', detail: `em ${fmt(i.usedAt)}` }
    : expired
      ? { label: 'Expirado', cls: 'bg-muted text-muted-foreground', detail: `em ${fmt(i.expiresAt)}` }
      : { label: 'Aguardando', cls: 'bg-primary/15 text-gold-300', detail: `vale até ${fmt(i.expiresAt)}` };

  return (
    <li className="grid gap-1 py-2.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 font-medium">
            <span className="truncate">{i.username}</span>
            <span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${status.cls}`}>{status.label}</span>
          </p>
          <p className="text-xs text-muted-foreground">
            {status.detail} · convidado por {i.createdByName} em {fmt(i.createdAt)}
          </p>
        </div>
        {!i.usedAt &&
          (confirm ? (
            <div className="flex items-center gap-1">
              <span className="mr-1 text-xs text-muted-foreground">{expired ? 'Remover?' : 'Cancelar convite?'}</span>
              <button onClick={() => revoke.mutate()} disabled={revoke.isPending} className="btn btn-sm bg-out/15 text-out hover:bg-out/25">
                Sim
              </button>
              <button onClick={() => setConfirm(false)} className="btn btn-ghost btn-sm">
                Não
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirm(true)}
              className="btn btn-ghost btn-icon hover:text-out"
              title={expired ? 'Remover' : 'Cancelar convite'}
              aria-label={expired ? 'Remover convite' : 'Cancelar convite'}
            >
              <Trash2 />
            </button>
          ))}
      </div>
      {error && (
        <p role="alert" className="text-sm text-out">
          {error}
        </p>
      )}
    </li>
  );
}
