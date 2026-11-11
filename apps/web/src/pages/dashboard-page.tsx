import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { CategoryChart, MonthlyChart } from '../components/charts';
import { DateRangePicker, type DateRange } from '../components/date-pickers';
import { SiteHeader } from '../components/site-header';
import { SummaryCards } from '../components/summary-cards';
import { TransactionForm } from '../components/transaction-form';
import { TransactionList } from '../components/transaction-list';
import { api } from '../lib/api';
import { todayISO } from '../lib/money';

export function DashboardPage() {
  // O painel abre sempre no dia de hoje.
  const [range, setRange] = useState<DateRange>(() => ({ from: todayISO(), to: todayISO() }));
  const categories = useQuery({ queryKey: ['categories'], queryFn: api.listCategories });
  // Mesma chave dos cards de resumo: uma requisição só para cards e gráficos do período.
  const summary = useQuery({ queryKey: ['summary', range.from, range.to], queryFn: () => api.summary(range.from, range.to) });

  return (
    <>
      <SiteHeader />
      <main className="mx-auto grid max-w-6xl gap-4 px-4 py-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl text-gold-300">Finanças do clube</h1>
          <DateRangePicker value={range} onChange={setRange} />
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
