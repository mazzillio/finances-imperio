import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Download, Inbox, Pencil, RotateCw, Search, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { formatCents } from '../config';
import { api, friendlyError } from '../lib/api';
import { PAGE_SIZES, type Category, type PageSize, type Transaction, type TransactionFilters } from '../lib/types';
import { TransactionEditDialog } from './transaction-edit-dialog';

const createdAtFormat = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
/** "11/11/2026 às 10:24" */
const formatCreatedAt = (iso: string) => createdAtFormat.format(new Date(iso)).replace(', ', ' às ');

/**
 * Paginação por cursor: a API devolve `nextCursor`; guardamos os cursores já vistos
 * numa pilha para o botão "Anterior" funcionar sem OFFSET.
 * O período (De/Até) vem do topo do painel e vale para a tela inteira.
 */
export function TransactionList({ categories, range }: { categories: Category[]; range: { from: string; to: string } }) {
  const qc = useQueryClient();
  const [filters, setFilters] = useState<TransactionFilters>({});
  const [pageSize, setPageSize] = useState<PageSize>(20);
  // A pilha de cursores vale para um período: guardar junto faz a página voltar à primeira quando ele muda.
  const rangeKey = `${range.from}|${range.to}`;
  const [paging, setPaging] = useState<{ key: string; cursors: (string | undefined)[] }>({ key: rangeKey, cursors: [undefined] });
  const cursors = paging.key === rangeKey ? paging.cursors : [undefined];
  const setCursors = (next: (string | undefined)[]) => setPaging({ key: rangeKey, cursors: next });
  const page = cursors.length - 1;
  const effective = { ...stripEmpty(filters), ...range };

  const [editing, setEditing] = useState<Transaction | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [rowError, setRowError] = useState<{ id: string; message: string } | null>(null);

  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ['transactions', effective, pageSize, cursors[page]],
    queryFn: () => api.listTransactions(effective, pageSize, cursors[page]),
    placeholderData: keepPreviousData,
  });

  const remove = useMutation({
    mutationFn: api.deleteTransaction,
    onSuccess: () => {
      setConfirmDelete(null);
      setRowError(null);
      // Se era o último da página, volta uma para não ficar numa página vazia.
      if (data?.items.length === 1 && page > 0) setCursors(cursors.slice(0, -1));
      void qc.invalidateQueries({ queryKey: ['transactions'] });
      void qc.invalidateQueries({ queryKey: ['summary'] });
    },
    onError: (err, id) => setRowError({ id, message: friendlyError(err, 'Esse lançamento já foi excluído.') }),
  });

  const update = (patch: Partial<TransactionFilters>) => {
    setFilters((f) => ({ ...f, ...patch }));
    setCursors([undefined]);
  };
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const exportXlsx = async () => {
    setExporting(true);
    setExportError(null);
    try {
      await api.exportTransactions(effective, `lancamentos_${range.from}_a_${range.to}.xlsx`);
    } catch (err) {
      setExportError(friendlyError(err));
    } finally {
      setExporting(false);
    }
  };
  const total = data?.totals?.count;
  const pages = total !== undefined ? Math.max(1, Math.ceil(total / pageSize)) : null;

  return (
    <section className="card grid gap-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Lançamentos</h2>
        <button
          onClick={() => void exportXlsx()}
          disabled={exporting || data?.items.length === 0}
          className="btn btn-outline btn-sm"
          title="Baixar planilha com o período e os filtros atuais"
        >
          <Download /> {exporting ? 'Gerando…' : 'Exportar Excel'}
        </button>
      </div>
      {exportError && (
        <p role="alert" className="text-sm text-out">
          {exportError}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <select
          aria-label="Tipo"
          onChange={(e) => update({ type: (e.target.value || undefined) as TransactionFilters['type'] })}
          className="field"
        >
          <option value="">Todos</option>
          <option value="entrada">Entradas</option>
          <option value="saida">Saídas</option>
        </select>
        <select
          aria-label="Categoria"
          onChange={(e) => update({ categoryId: Number(e.target.value) || undefined })}
          className="field"
        >
          <option value="">Todas as categorias</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <div className="relative min-w-40 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            placeholder="Buscar descrição"
            aria-label="Buscar descrição"
            onChange={(e) => update({ q: e.target.value || undefined })}
            className="field w-full pl-9"
          />
        </div>
      </div>

      {isError ? (
        <p className="flex flex-wrap items-center gap-2 text-out">
          Não foi possível carregar os lançamentos.
          <button onClick={() => void refetch()} className="btn btn-outline btn-sm text-foreground">
            <RotateCw /> Tentar de novo
          </button>
        </p>
      ) : isPending ? (
        <p className="text-muted-foreground">Carregando…</p>
      ) : data.items.length === 0 ? (
        <div className="grid place-items-center gap-2 rounded-lg border border-dashed p-6 text-center text-muted-foreground">
          <Inbox className="size-6" />
          Nenhum lançamento neste período com esses filtros.
        </div>
      ) : (
        <ul className="max-h-[1200px] divide-y overflow-y-auto">
          {data.items.map((t) => (
            <li key={t.id} className="grid gap-1 py-2.5">
              <div className="grid grid-cols-[auto_1fr_auto] items-center gap-x-3 gap-y-1 sm:grid-cols-[auto_1fr_auto_auto]">
                <span className="size-2.5 rounded-full" style={{ background: t.categoryColor }} />
                <div className="min-w-0">
                  <p className="truncate font-medium">{t.description || t.categoryName}</p>
                  <p className="text-xs text-muted-foreground">
                    {t.occurredOn.split('-').reverse().join('/')} · {t.categoryName}
                  </p>
                  {/* Uma linha só: a última alteração do registro (edição, ou o lançamento se nunca foi editado). */}
                  <p className="text-xs text-muted-foreground/80">
                    {t.editedAt ? 'Editado' : 'Lançado'} por{' '}
                    <span className="font-medium text-muted-foreground">{t.editedByName ?? t.createdByName}</span> em{' '}
                    {formatCreatedAt(t.editedAt ?? t.createdAt)}
                  </p>
                </div>
                <span className={`font-semibold tabular-nums ${t.type === 'entrada' ? 'text-in' : 'text-out'}`}>
                  {t.type === 'entrada' ? '+' : '−'} {formatCents(t.amountCents)}
                </span>
                <div className="col-span-3 flex items-center justify-end gap-1 sm:col-span-1">
                  {confirmDelete === t.id ? (
                    <>
                      <span className="mr-1 text-xs text-muted-foreground">Excluir?</span>
                      <button
                        onClick={() => remove.mutate(t.id)}
                        disabled={remove.isPending}
                        className="btn btn-sm bg-out/15 text-out hover:bg-out/25"
                      >
                        {remove.isPending ? 'Excluindo…' : 'Sim, excluir'}
                      </button>
                      <button onClick={() => setConfirmDelete(null)} className="btn btn-ghost btn-sm">
                        Não
                      </button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => setEditing(t)} className="btn btn-ghost btn-icon" title="Editar" aria-label="Editar lançamento">
                        <Pencil />
                      </button>
                      <button
                        onClick={() => {
                          setRowError(null);
                          setConfirmDelete(t.id);
                        }}
                        className="btn btn-ghost btn-icon hover:text-out"
                        title="Excluir"
                        aria-label="Excluir lançamento"
                      >
                        <Trash2 />
                      </button>
                    </>
                  )}
                </div>
              </div>
              {rowError?.id === t.id && (
                <p role="alert" className="text-right text-sm text-out">
                  {rowError.message}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3 text-sm text-muted-foreground">
        <span>{total !== undefined ? `${total} ${total === 1 ? 'lançamento' : 'lançamentos'}` : 'Busca por texto'}</span>
        <label className="flex items-center gap-2">
          Por página
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value) as PageSize);
              setCursors([undefined]);
            }}
            className="field h-8"
          >
            {PAGE_SIZES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <div className="flex items-center gap-2">
          <button disabled={page === 0} onClick={() => setCursors(cursors.slice(0, -1))} className="btn btn-outline btn-sm">
            <ChevronLeft /> Anterior
          </button>
          <span>
            Página {page + 1}
            {pages ? ` de ${pages}` : ''}
          </span>
          <button
            disabled={!data?.nextCursor}
            onClick={() => data?.nextCursor && setCursors([...cursors, data.nextCursor])}
            className="btn btn-outline btn-sm"
          >
            Próxima <ChevronRight />
          </button>
        </div>
      </div>

      {editing && <TransactionEditDialog transaction={editing} categories={categories} onClose={() => setEditing(null)} />}
    </section>
  );
}

function stripEmpty(f: TransactionFilters): TransactionFilters {
  return Object.fromEntries(Object.entries(f).filter(([, v]) => v !== undefined && v !== '')) as TransactionFilters;
}
