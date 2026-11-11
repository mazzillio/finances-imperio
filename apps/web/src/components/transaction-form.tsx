import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowDownCircle, ArrowUpCircle, Plus } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { api, friendlyError } from '../lib/api';
import { DatePicker } from './date-pickers';
import { parseMoney, todayISO } from '../lib/money';
import type { Category, TransactionType } from '../lib/types';

export function TransactionForm({ categories }: { categories: Category[] }) {
  const qc = useQueryClient();
  const [type, setType] = useState<TransactionType>('entrada');
  const [occurredOn, setOccurredOn] = useState(todayISO());
  const [error, setError] = useState<string | null>(null);
  const options = categories.filter((c) => c.type === type && !c.archived);

  const create = useMutation({
    mutationFn: api.createTransaction,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['transactions'] });
      void qc.invalidateQueries({ queryKey: ['summary'] });
    },
  });

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formEl = e.currentTarget;
    const form = new FormData(formEl);
    const amountCents = parseMoney(String(form.get('amount') ?? ''));
    if (!amountCents) return setError('Informe um valor maior que zero, por exemplo 150,90.');
    const categoryId = Number(form.get('categoryId'));
    if (!categoryId) return setError('Escolha a categoria.');
    setError(null);
    create.mutate(
      {
        type,
        categoryId,
        amountCents,
        description: String(form.get('description') ?? ''),
        occurredOn: String(form.get('occurredOn')),
      },
      {
        onSuccess: () => {
          (formEl.elements.namedItem('amount') as HTMLInputElement).value = '';
          (formEl.elements.namedItem('description') as HTMLInputElement).value = '';
        },
        onError: (err) => setError(friendlyError(err)),
      },
    );
  }

  const active = (on: boolean, cls: string) =>
    `segment ${on ? cls : ''}`;

  return (
    <form onSubmit={onSubmit} className="card grid gap-3 p-4 sm:grid-cols-6">
      <h2 className="text-lg font-semibold sm:col-span-6">Novo lançamento</h2>
      <div className="segmented grid-cols-2 sm:col-span-2" role="group" aria-label="Tipo">
        <button
          type="button"
          onClick={() => setType('entrada')}
          className={active(type === 'entrada', 'bg-in/15 text-in hover:text-in')}
        >
          <ArrowUpCircle /> Entrada
        </button>
        <button
          type="button"
          onClick={() => setType('saida')}
          className={active(type === 'saida', 'bg-out/15 text-out hover:text-out')}
        >
          <ArrowDownCircle /> Saída
        </button>
      </div>
      <select name="categoryId" key={type} aria-label="Categoria" className="field sm:col-span-2">
        {options.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <input
        name="amount"
        inputMode="decimal"
        placeholder="Valor (R$)"
        aria-label="Valor"
        className="field sm:col-span-2"
      />
      <DatePicker
        name="occurredOn"
        value={occurredOn}
        onChange={setOccurredOn}
        aria-label="Data"
        className="sm:col-span-2"
      />
      <input
        name="description"
        placeholder="Descrição"
        maxLength={200}
        aria-label="Descrição"
        className="field sm:col-span-4"
      />
      <div className="flex flex-wrap items-center justify-end gap-3 sm:col-span-6">
        {error && (
          <p role="alert" className="text-sm text-out">
            {error}
          </p>
        )}
        <button disabled={create.isPending} className="btn btn-primary">
          <Plus />
          {create.isPending ? 'Salvando…' : 'Adicionar'}
        </button>
      </div>
    </form>
  );
}
