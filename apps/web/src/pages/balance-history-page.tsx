import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { DateRangePicker, type DateRange } from '../components/date-pickers';
import { SiteHeader } from '../components/site-header';
import { formatCents } from '../config';
import { api } from '../lib/api';
import { monthRange, todayISO } from '../lib/money';

const WEEKDAYS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

/** "2026-11-10" -> "10/11/2026" e o dia da semana, sem passar por fuso horário. */
function dayLabel(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  return { date: `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`, weekday: WEEKDAYS[new Date(y, m - 1, d).getDay()] };
}

const signed = (cents: number) => (cents > 0 ? '+' : '') + formatCents(cents);
const tone = (cents: number) => (cents < 0 ? 'text-out' : cents > 0 ? 'text-in' : 'text-muted-foreground');

/** Fechamento dia a dia: quanto entrou, quanto saiu e com quanto o caixa fechou em cada dia trabalhado. */
export function BalanceHistoryPage() {
  // Abre no mês atual.
  const [range, setRange] = useState<DateRange>(() => monthRange(todayISO().slice(0, 7)));
  // Chave começa por 'summary': qualquer lançamento novo, editado ou excluído já invalida esta tela.
  const { data, isPending, isError } = useQuery({
    queryKey: ['summary', 'balance-history', range.from, range.to],
    queryFn: () => api.balanceHistory(range.from, range.to),
  });
  const days = data?.days ?? [];

  return (
    <>
      <SiteHeader />
      <main className="mx-auto grid max-w-6xl gap-4 px-4 py-8">
        <div className="grid gap-1">
          <h1 className="text-2xl text-gold-300">Histórico de saldo</h1>
          <p className="text-sm text-muted-foreground">
            Só aparecem os dias com lançamentos. O fechamento é o saldo acumulado ao fim de cada dia.
          </p>
        </div>
        <DateRangePicker value={range} onChange={setRange} />

        {isError ? (
          <p className="text-out">Não foi possível carregar o histórico.</p>
        ) : isPending ? (
          <p className="text-muted-foreground">Carregando…</p>
        ) : days.length === 0 ? (
          <p className="card p-6 text-center text-muted-foreground">Nenhum dia com lançamentos neste período.</p>
        ) : (
          <section className="card overflow-x-auto">
            <table className="w-full text-sm whitespace-nowrap">
              <thead>
                <tr className="border-b text-left">
                  <th className="label px-4 py-3 font-semibold">Dia</th>
                  <th className="label px-4 py-3 text-right font-semibold">Entradas</th>
                  <th className="label px-4 py-3 text-right font-semibold">Saídas</th>
                  <th className="label px-4 py-3 text-right font-semibold">Saldo do dia</th>
                  <th className="label px-4 py-3 text-right font-semibold">Fechamento</th>
                </tr>
              </thead>
              <tbody className="divide-y tabular-nums">
                {days.map((d) => {
                  const { date, weekday } = dayLabel(d.day);
                  return (
                    <tr key={d.day} className="transition-colors hover:bg-muted/40">
                      <td className="px-4 py-3">
                        <span className="font-medium">{date}</span>{' '}
                        <span className="text-muted-foreground">
                          {weekday} · {d.count} {d.count === 1 ? 'lançamento' : 'lançamentos'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-in">{formatCents(d.inCents)}</td>
                      <td className="px-4 py-3 text-right text-out">{formatCents(d.outCents)}</td>
                      <td className={`px-4 py-3 text-right ${tone(d.netCents)}`}>{signed(d.netCents)}</td>
                      <td className={`px-4 py-3 text-right text-base font-semibold ${d.closingCents < 0 ? 'text-out' : 'text-gold-300'}`}>
                        {formatCents(d.closingCents)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        )}
      </main>
    </>
  );
}
