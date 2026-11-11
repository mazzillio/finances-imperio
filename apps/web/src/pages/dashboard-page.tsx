import { useQuery } from '@tanstack/react-query';
import { ChevronRight, Landmark } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { CategoryChart, MonthlyChart } from '../components/charts';
import { DateRangePicker, type DateRange } from '../components/date-pickers';
import { SiteHeader } from '../components/site-header';
import { SummaryCards } from '../components/summary-cards';
import { TransactionForm } from '../components/transaction-form';
import { TransactionList } from '../components/transaction-list';
import { formatCents } from '../config';
import { api } from '../lib/api';
import { todayISO } from '../lib/money';

export function DashboardPage() {
  // O painel abre sempre no dia de hoje.
  const [range, setRange] = useState<DateRange>(() => ({ from: todayISO(), to: todayISO() }));
  const categories = useQuery({ queryKey: ['categories'], queryFn: api.listCategories });
  // Mesma chave dos cards de resumo: uma requisição só para cards e gráficos do período.
  const summary = useQuery({ queryKey: ['summary', range.from, range.to], queryFn: () => api.summary(range.from, range.to) });

  const total = summary.data?.totalBalanceCents ?? 0;

  return (
    <>
      <SiteHeader />
      <main className="mx-auto grid max-w-6xl gap-4 px-4 py-8">
        <h1 className="text-2xl text-gold-300">Finanças do clube</h1>
        {/* Mesma grade dos cards de resumo: o saldo acumulado ocupa a terceira coluna, alinhado ao "Saldo do período". */}
        <div className="grid items-center gap-3 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <DateRangePicker value={range} onChange={setRange} />
          </div>
          <Link
            to="/saldo"
            title="Ver o histórico de saldo, dia a dia"
            className="card group flex items-center gap-4 p-4 transition-colors hover:border-primary/60"
          >
            <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/15 text-gold-300">
              <Landmark className="size-5" />
            </span>
            <div className="grid gap-0.5">
              <span className="label">Saldo acumulado</span>
              <span className={`text-2xl font-semibold tabular-nums ${total < 0 ? 'text-out' : 'text-gold-300'}`}>
                {summary.isError ? '—' : summary.data ? formatCents(total) : '…'}
              </span>
            </div>
            <ChevronRight className="ml-auto size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-gold-300" />
          </Link>
        </div>
        <SummaryCards from={range.from} to={range.to} />
        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <div className="grid content-start gap-4">
            <TransactionForm categories={categories.data ?? []} />
            <TransactionList categories={categories.data ?? []} range={range} />
          </div>
          <aside className="grid content-start gap-4">
            <MonthlyChart month={range.to.slice(0, 7)} />
            <CategoryChart summary={summary.data} />
          </aside>
        </div>
      </main>
    </>
  );
}
