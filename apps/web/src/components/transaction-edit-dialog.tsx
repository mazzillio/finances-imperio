import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowDownCircle, ArrowUpCircle, Check, X } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { api, friendlyError } from '../lib/api';
import { parseMoney } from '../lib/money';
import type { Category, Transaction, TransactionType } from '../lib/types';
import { DatePicker } from './date-pickers';

/** Centavos no formato que a pessoa digita: 21700 -> "217,00". */
const centsToInput = (cents: number) => (cents / 100).toFixed(2).replace('.', ',');

export function TransactionEditDialog({
  transaction: t,
  categories,
  onClose,
}: {
  transaction: Transaction;
  categories: Category[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [type, setType] = useState<TransactionType>(t.type);
  const [categoryId, setCategoryId] = useState(t.categoryId);
  const [occurredOn, setOccurredOn] = useState(t.occurredOn);
  const [error, setError] = useState<string | null>(null);
  // Categorias do tipo escolhido; a atual aparece mesmo se já foi arquivada.
  const options = categories.filter((c) => c.type === type && (!c.archived || c.id === t.categoryId));

  const save = useMutation({
    mutationFn: (input: Parameters<typeof api.updateTransaction>[1]) => api.updateTransaction(t.id, input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['transactions'] });
      void qc.invalidateQueries({ queryKey: ['summary'] });
      onClose();
    },
    onError: (err) => setError(friendlyError(err, 'Esse lançamento não existe mais.')),
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const changeType = (next: TransactionType) => {
    setType(next);
    // A categoria pertence a um tipo só: ao trocar o tipo, escolhe a primeira do novo tipo.
    const first = categories.find((c) => c.type === next && !c.archived);
    setCategoryId(next === t.type ? t.categoryId : (first?.id ?? 0));
  };

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const amountCents = parseMoney(String(form.get('amount') ?? ''));
    if (!amountCents) return setError('Informe um valor maior que zero, por exemplo 150,90.');
    if (!categoryId) return setError('Escolha a categoria.');
    setError(null);
    save.mutate({ type, categoryId, amountCents, description: String(form.get('description') ?? ''), occurredOn });
  }

  const seg = (on: boolean, cls: string) => `segment ${on ? cls : ''}`;

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm"
      onPointerDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <form
        onSubmit={onSubmit}
        role="dialog"
        aria-modal="true"
        aria-label="Editar lançamento"
        className="card pop-in grid w-full max-w-md gap-4 p-5 shadow-2xl shadow-black/60"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Editar lançamento</h2>
          <button type="button" onClick={onClose} className="btn btn-ghost btn-icon" aria-label="Fechar" title="Fechar">
            <X />
          </button>
        </div>

        <div className="segmented grid-cols-2" role="group" aria-label="Tipo">
          <button type="button" onClick={() => changeType('entrada')} className={seg(type === 'entrada', 'bg-in/15 text-in hover:text-in')}>
            <ArrowUpCircle /> Entrada
          </button>
          <button type="button" onClick={() => changeType('saida')} className={seg(type === 'saida', 'bg-out/15 text-out hover:text-out')}>
            <ArrowDownCircle /> Saída
          </button>
        </div>

        <label className="grid gap-1.5 text-sm font-medium">
          Categoria
          <select value={categoryId} onChange={(e) => setCategoryId(Number(e.target.value))} className="field">
            {options.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.archived ? ' (arquivada)' : ''}
              </option>
            ))}
          </select>
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="grid gap-1.5 text-sm font-medium">
            Valor (R$)
            <input name="amount" inputMode="decimal" defaultValue={centsToInput(t.amountCents)} autoFocus className="field" />
          </label>
          <div className="grid gap-1.5 text-sm font-medium">
            Data
            <DatePicker value={occurredOn} onChange={setOccurredOn} aria-label="Data" align="right" />
          </div>
        </div>

        <label className="grid gap-1.5 text-sm font-medium">
          Descrição
          <input name="description" defaultValue={t.description} maxLength={200} className="field" />
        </label>

        {error && (
          <p role="alert" className="text-sm text-out">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn btn-ghost">
            Cancelar
          </button>
          <button disabled={save.isPending} className="btn btn-primary">
            <Check /> {save.isPending ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </form>
    </div>
  );
}
