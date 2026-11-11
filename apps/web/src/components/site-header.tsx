import { useQuery } from '@tanstack/react-query';
import { Landmark, LayoutDashboard, LogOut, Tags, UserRound, Users } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link, NavLink } from 'react-router';
import { api } from '../lib/api';
import { session, useSession } from '../lib/session';

/** Cabeçalho fixo com o logo do clube, no mesmo desenho do ranking. */
export function SiteHeader({ children }: { children?: ReactNode }) {
  const { username } = useSession();
  // A chave leva o usuário: trocar de conta no mesmo navegador não reaproveita o perfil anterior.
  const me = useQuery({ queryKey: ['me', username], queryFn: api.me, staleTime: 60_000 });
  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4">
        <Link to="/" className="flex items-center gap-2 font-semibold whitespace-nowrap">
          <img src="/logo-imperio.png" alt="" width={36} height={36} />
          <span className="text-gold-300 max-sm:hidden">Império Poker</span>
          <span className="hidden text-muted-foreground sm:inline">· Finanças</span>
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          <NavLink to="/" end className={navClass} title="Painel">
            <LayoutDashboard /> <span className="max-md:hidden">Painel</span>
          </NavLink>
          <NavLink to="/saldo" className={navClass} title="Histórico de saldo">
            <Landmark /> <span className="max-md:hidden">Saldo</span>
          </NavLink>
          <NavLink to="/categorias" className={navClass} title="Categorias">
            <Tags /> <span className="max-md:hidden">Categorias</span>
          </NavLink>
          {me.data?.isAdmin && (
            <NavLink to="/usuarios" className={navClass} title="Usuários">
              <Users /> <span className="max-md:hidden">Usuários</span>
            </NavLink>
          )}
          {children && <span className="mx-1 h-6 border-l" />}
          {children}
          <span className="ml-1 hidden items-center gap-1.5 text-muted-foreground lg:flex">
            <UserRound className="size-4" />
            {username}
          </span>
          <button onClick={session.signOut} className="btn btn-ghost btn-icon" title="Sair" aria-label="Sair">
            <LogOut />
          </button>
        </nav>
      </div>
    </header>
  );
}

const navClass = ({ isActive }: { isActive: boolean }) =>
  `btn btn-sm max-md:size-8 max-md:px-0 ${isActive ? 'bg-muted text-gold-300' : 'btn-ghost text-muted-foreground'}`;
