import { useQuery } from '@tanstack/react-query';
import { BarChart3, Table2 } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { formatCents } from '../config';
import { api } from '../lib/api';
import { monthRange } from '../lib/money';
import type { Summary } from '../lib/types';

/*
 * Gráficos feitos em HTML/CSS (sem biblioteca), seguindo a paleta do clube.
 * Entradas e saídas usam os tokens `in`/`out`; a identidade nunca depende só da cor:
 * legenda, ordem fixa (entradas antes de saídas), rótulos e tooltip.
 */

const MONTHS_SHORT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const compact = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact', maximumFractionDigits: 1 });
const formatCompact = (cents: number) => compact.format(cents / 100);
const monthLabel = (ym: string) => {
  const [y, m] = ym.split('-');
  return `${MONTHS_SHORT[Number(m) - 1]}/${y.slice(2)}`;
};

/** Escala com degraus redondos (1, 2, 2,5, 5 × 10^n) para o eixo. */
function niceTicks(maxCents: number, count = 4) {
  if (maxCents <= 0) return [0, 25_000, 50_000, 75_000, 100_000];
  const raw = maxCents / count;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((f) => f * pow).find((s) => s >= raw)!;
  const ticks = [0];
  while (ticks[ticks.length - 1] < maxCents) ticks.push(ticks.length * step);
  return ticks;
}

function ChartCard({ title, subtitle, action, children }: { title: string; subtitle?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="card grid gap-4 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="grid gap-0.5">
          <h2 className="text-base font-semibold">{title}</h2>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function Legend() {
  return (
    <div className="flex items-center gap-4 text-xs text-muted-foreground">
      <span className="flex items-center gap-1.5">
        <span className="size-2.5 rounded-sm bg-in" /> Entradas
      </span>
      <span className="flex items-center gap-1.5">
        <span className="size-2.5 rounded-sm bg-out" /> Saídas
      </span>
    </div>
  );
}

/* ---------- Entradas e saídas por mês (12 meses até o mês escolhido) ---------- */

export function MonthlyChart({ month }: { month: string }) {
  const [y, m] = month.split('-').map(Number);
  const start = new Date(y, m - 12, 1);
  const from = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-01`;
  const { to } = monthRange(month);
  const [asTable, setAsTable] = useState(false);
  const [hover, setHover] = useState<string | null>(null);

  const { data, isPending, isError } = useQuery({
    queryKey: ['summary', from, to],
    queryFn: () => api.summary(from, to),
  });

  // Os 12 meses sempre aparecem, mesmo os sem lançamentos.
  const months = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const row = data?.byMonth.find((r) => r.month === key);
    return { key, inCents: row?.inCents ?? 0, outCents: row?.outCents ?? 0, balanceCents: row?.balanceCents ?? 0 };
  });
  const max = Math.max(...months.flatMap((r) => [r.inCents, r.outCents]));
  const ticks = niceTicks(max);
  const top = ticks[ticks.length - 1];
  const hovered = months.find((r) => r.key === hover);

  return (
    <ChartCard
      title="Entradas e saídas por mês"
      subtitle="12 meses até o fim do período"
      action={
        <button
          type="button"
          onClick={() => setAsTable(!asTable)}
          className="btn btn-ghost btn-icon"
          title={asTable ? 'Ver gráfico' : 'Ver tabela'}
          aria-label={asTable ? 'Ver gráfico' : 'Ver tabela'}
        >
          {asTable ? <BarChart3 /> : <Table2 />}
        </button>
      }
    >
      {isError ? (
        <p className="text-sm text-out">Não foi possível carregar o gráfico.</p>
      ) : isPending ? (
        <div className="h-52 animate-pulse rounded-lg bg-muted/60" />
      ) : asTable ? (
        <div className="max-h-72 overflow-y-auto">
          <table className="w-full text-sm tabular-nums">
            <thead className="sticky top-0 bg-card text-left text-xs text-muted-foreground">
              <tr>
                <th className="py-1.5 font-medium">Mês</th>
                <th className="py-1.5 text-right font-medium">Entradas</th>
                <th className="py-1.5 text-right font-medium">Saídas</th>
                <th className="py-1.5 text-right font-medium">Saldo</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {months.map((r) => (
                <tr key={r.key} className={r.key === month ? 'text-gold-300' : ''}>
                  <td className="py-1.5">{monthLabel(r.key)}</td>
                  <td className="py-1.5 text-right">{formatCents(r.inCents)}</td>
                  <td className="py-1.5 text-right">{formatCents(r.outCents)}</td>
                  <td className={`py-1.5 text-right ${r.balanceCents < 0 ? 'text-out' : ''}`}>{formatCents(r.balanceCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid gap-3">
          <Legend />
          <div className="relative mt-4 grid grid-cols-[auto_1fr] gap-2">
            {/* Eixo Y */}
            <div className="relative h-48 w-14 text-right text-[10px] text-muted-foreground tabular-nums">
              {ticks.map((t) => (
                <span key={t} className="absolute right-0 -translate-y-1/2" style={{ bottom: `${(t / top) * 100}%` }}>
                  {formatCompact(t)}
                </span>
              ))}
            </div>
            <div className="relative h-48">
              {/* Linhas de grade */}
              {ticks.map((t) => (
                <span key={t} className="absolute inset-x-0 border-t" style={{ bottom: `${(t / top) * 100}%` }} />
              ))}
              {/* Colunas: entradas e saídas lado a lado, 2px de espaço, ponta arredondada só em cima */}
              <div className="absolute inset-0 grid grid-cols-12">
                {months.map((r) => (
                  <div
                    key={r.key}
                    onPointerEnter={() => setHover(r.key)}
                    onPointerLeave={() => setHover(null)}
                    className={`flex items-end justify-center gap-0.5 rounded-sm ${hover === r.key ? 'bg-muted/60' : ''}`}
                  >
                    <span className="w-full max-w-3 rounded-t-[3px] bg-in" style={{ height: `${(r.inCents / top) * 100}%` }} />
                    <span className="w-full max-w-3 rounded-t-[3px] bg-out" style={{ height: `${(r.outCents / top) * 100}%` }} />
                  </div>
                ))}
              </div>
              {hovered && (
                <div
                  className="pointer-events-none absolute -top-2 z-10 grid w-44 gap-1 rounded-lg border bg-popover p-2.5 text-xs shadow-xl shadow-black/50"
                  style={{
                    left: `${Math.min(Math.max(((months.indexOf(hovered) + 0.5) / 12) * 100, 20), 80)}%`,
                    transform: 'translate(-50%, -100%)',
                  }}
                >
                  <span className="font-semibold text-gold-300">{monthLabel(hovered.key)}</span>
                  <TooltipRow swatch="bg-in" label="Entradas" value={hovered.inCents} />
                  <TooltipRow swatch="bg-out" label="Saídas" value={hovered.outCents} />
                  <div className="mt-0.5 flex justify-between border-t pt-1">
                    <span className="text-muted-foreground">Saldo</span>
                    <span className="font-semibold tabular-nums">{formatCents(hovered.balanceCents)}</span>
                  </div>
                </div>
              )}
            </div>
            {/* Eixo X */}
            <span />
            <div className="grid grid-cols-12 text-center text-[10px] text-muted-foreground">
              {months.map((r, i) => (
                <span key={r.key} className={r.key === month ? 'font-semibold text-gold-300' : i % 2 ? 'max-sm:invisible' : ''}>
                  {MONTHS_SHORT[Number(r.key.slice(5)) - 1]}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </ChartCard>
  );
}

function TooltipRow({ swatch, label, value }: { swatch: string; label: string; value: number }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="flex items-center gap-1.5 text-muted-foreground">
        <span className={`size-2 rounded-sm ${swatch}`} /> {label}
      </span>
      <span className="tabular-nums">{formatCents(value)}</span>
    </div>
  );
}

/* ---------- Barras horizontais (categorias) ---------- */

function HBar({ label, icon, cents, max, barClass, title }: { label: ReactNode; icon?: ReactNode; cents: number; max: number; barClass: string; title: string }) {
  return (
    <li className="group grid gap-1" title={title}>
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="flex min-w-0 items-center gap-2">
          {icon}
          <span className="truncate">{label}</span>
        </span>
        <span className="shrink-0 font-medium tabular-nums">{formatCents(cents)}</span>
      </div>
      <div className="h-2 rounded-full bg-muted/60">
        <div
          className={`h-full rounded-full transition-[width] group-hover:brightness-110 ${barClass}`}
          style={{ width: `${max > 0 ? Math.max((cents / max) * 100, cents > 0 ? 1.5 : 0) : 0}%` }}
        />
      </div>
    </li>
  );
}

export function CategoryChart({ summary }: { summary?: Summary }) {
  const groups = [
    { type: 'entrada' as const, title: 'Entradas', bar: 'bg-in', total: summary?.inCents ?? 0 },
    { type: 'saida' as const, title: 'Saídas', bar: 'bg-out', total: summary?.outCents ?? 0 },
  ];
  return (
    <ChartCard title="Por categoria" subtitle="Período escolhido">
      {!summary ? (
        <div className="h-40 animate-pulse rounded-lg bg-muted/60" />
      ) : summary.byCategory.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum lançamento neste período.</p>
      ) : (
        groups.map((g) => {
          const rows = summary.byCategory.filter((c) => c.type === g.type);
          if (rows.length === 0) return null;
          const max = Math.max(...rows.map((r) => r.totalCents));
          return (
            <div key={g.type} className="grid gap-2.5">
              <div className="flex items-baseline justify-between">
                <span className="label">{g.title}</span>
                <span className="text-xs text-muted-foreground tabular-nums">{formatCents(g.total)}</span>
              </div>
              <ul className="grid gap-2.5">
                {rows.map((c) => (
                  <HBar
                    key={c.categoryId}
                    label={c.name}
                    icon={<span className="size-2.5 shrink-0 rounded-full" style={{ background: c.color }} />}
                    cents={c.totalCents}
                    max={max}
                    barClass={g.bar}
                    title={`${c.name}: ${formatCents(c.totalCents)} · ${c.count} lançamento(s) · ${g.total ? Math.round((c.totalCents / g.total) * 100) : 0}% das ${g.title.toLowerCase()}`}
                  />
                ))}
              </ul>
            </div>
          );
        })
      )}
    </ChartCard>
  );
}
