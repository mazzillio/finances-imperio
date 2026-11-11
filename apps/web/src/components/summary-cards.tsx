import { useQuery } from '@tanstack/react-query';
import { TrendingDown, TrendingUp, Wallet, type LucideIcon } from 'lucide-react';
import { formatCents } from '../config';
import { api } from '../lib/api';

export function SummaryCards({ from, to }: { from: string; to: string }) {
  const { data, isPending, isError } = useQuery({
    queryKey: ['summary', from, to],
    queryFn: () => api.summary(from, to),
  });
  if (isError) return <p className="text-out">Não foi possível carregar o resumo.</p>;
  const balance = data?.balanceCents ?? 0;
  const tiles: { label: string; value?: number; cls: string; icon: LucideIcon; iconCls: string }[] = [
    { label: 'Entradas', value: data?.inCents, cls: 'text-in', icon: TrendingUp, iconCls: 'bg-in/15 text-in' },
    { label: 'Saídas', value: data?.outCents, cls: 'text-out', icon: TrendingDown, iconCls: 'bg-out/15 text-out' },
    {
      label: 'Saldo',
      value: data?.balanceCents,
      cls: balance < 0 ? 'text-out' : 'text-gold-300',
      icon: Wallet,
      iconCls: 'bg-primary/15 text-gold-300',
    },
  ];
  return (
    <section className="grid gap-3 sm:grid-cols-3">
      {tiles.map((t) => (
        <div key={t.label} className="card flex items-center gap-4 p-4">
          <span className={`grid size-10 shrink-0 place-items-center rounded-lg ${t.iconCls}`}>
            <t.icon className="size-5" />
          </span>
          <div className="grid gap-0.5">
            <span className="label">{t.label}</span>
            <span className={`text-2xl font-semibold tabular-nums ${t.cls}`}>
              {isPending ? '…' : formatCents(t.value ?? 0)}
            </span>
          </div>
        </div>
      ))}
    </section>
  );
}
