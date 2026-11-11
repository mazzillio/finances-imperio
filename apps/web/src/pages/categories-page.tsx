import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Archive, ArchiveRestore, ArrowDownCircle, ArrowUpCircle, Check, Pencil, Plus, X } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { SiteHeader } from '../components/site-header';
import { api, friendlyError } from '../lib/api';
import type { Category, CategoryPatch, TransactionType } from '../lib/types';

/** Cores sugeridas: claras o bastante para aparecer no fundo escuro. */
const SWATCHES = ['#2ebd7f', '#3fb6b6', '#4f9be0', '#8b7cf0', '#d26ab2', '#e5484d', '#ef8a3c', '#e0b050', '#9aa3ad'];

export function CategoriesPage() {
  const qc = useQueryClient();
  const { data, isPending, isError } = useQuery({ queryKey: ['categories'], queryFn: api.listCategories });
  const [showArchived, setShowArchived] = useState(false);

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['categories'] });
    void qc.invalidateQueries({ queryKey: ['summary'] });
    void qc.invalidateQueries({ queryKey: ['transactions'] });
  };

  const archivedCount = data?.filter((c) => c.archived).length ?? 0;
  const groups: { type: TransactionType; title: string; icon: typeof ArrowUpCircle; cls: string }[] = [
    { type: 'entrada', title: 'Entradas', icon: ArrowUpCircle, cls: 'text-in' },
    { type: 'saida', title: 'Saídas', icon: ArrowDownCircle, cls: 'text-out' },
  ];

  return (
    <>
      <SiteHeader />
      <main className="mx-auto grid max-w-6xl gap-4 px-4 py-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="grid gap-1">
            <h1 className="text-2xl text-gold-300">Categorias</h1>
            <p className="text-sm text-muted-foreground">
              Arquivar tira a categoria dos formulários, mas os lançamentos antigos continuam nos relatórios.
            </p>
          </div>
          {archivedCount > 0 && (
            <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={showArchived}
                onChange={(e) => setShowArchived(e.target.checked)}
                className="size-4 accent-[var(--color-primary)]"
              />
              Mostrar arquivadas ({archivedCount})
            </label>
          )}
        </div>

        <NewCategoryForm onCreated={invalidate} />

        {isError ? (
          <p className="text-out">Não foi possível carregar as categorias.</p>
        ) : isPending ? (
          <p className="text-muted-foreground">Carregando…</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {groups.map((g) => {
              const rows = data.filter((c) => c.type === g.type && (showArchived || !c.archived));
              return (
                <section key={g.type} className="card grid content-start gap-1 p-4">
                  <h2 className="mb-2 flex items-center gap-2 text-lg font-semibold">
                    <g.icon className={`size-5 ${g.cls}`} /> {g.title}
                    <span className="text-sm font-normal text-muted-foreground">({rows.length})</span>
                  </h2>
                  {rows.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhuma categoria.</p>
                  ) : (
                    <ul className="divide-y">
                      {rows.map((c) => (
                        <CategoryRow key={c.id} category={c} onSaved={invalidate} />
                      ))}
                    </ul>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </main>
    </>
  );
}

function NewCategoryForm({ onCreated }: { onCreated: () => void }) {
  const [type, setType] = useState<TransactionType>('entrada');
  const [color, setColor] = useState(SWATCHES[0]);
  const [error, setError] = useState<string | null>(null);
  const create = useMutation({ mutationFn: api.createCategory });

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formEl = e.currentTarget;
    const name = String(new FormData(formEl).get('name') ?? '').trim();
    if (!name) return setError('Informe o nome da categoria.');
    setError(null);
    create.mutate(
      { name, type, color },
      {
        onSuccess: () => {
          formEl.reset();
          onCreated();
        },
        onError: (err) => setError(friendlyError(err)),
      },
    );
  }

  return (
    <form onSubmit={onSubmit} className="card grid gap-3 p-4 md:grid-cols-[auto_1fr_auto_auto] md:items-center">
      <div className="segmented grid-cols-2" role="group" aria-label="Tipo">
        <button
          type="button"
          onClick={() => setType('entrada')}
          className={`segment ${type === 'entrada' ? 'bg-in/15 text-in hover:text-in' : ''}`}
        >
          <ArrowUpCircle /> Entrada
        </button>
        <button
          type="button"
          onClick={() => setType('saida')}
          className={`segment ${type === 'saida' ? 'bg-out/15 text-out hover:text-out' : ''}`}
        >
          <ArrowDownCircle /> Saída
        </button>
      </div>
      <input name="name" placeholder="Nome da nova categoria" maxLength={60} aria-label="Nome" className="field" />
      <ColorPicker value={color} onChange={setColor} />
      <button disabled={create.isPending} className="btn btn-primary">
        <Plus /> {create.isPending ? 'Criando…' : 'Criar'}
      </button>
      {error && (
        <p role="alert" className="text-sm text-out md:col-span-4">
          {error}
        </p>
      )}
    </form>
  );
}

function CategoryRow({ category: c, onSaved }: { category: Category; onSaved: () => void }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(c.name);
  const [error, setError] = useState<string | null>(null);
  const update = useMutation({
    mutationFn: (patch: CategoryPatch) => api.updateCategory(c.id, patch),
    onSuccess: () => {
      setError(null);
      setEditing(false);
      onSaved();
    },
    onError: (err) => setError(friendlyError(err, 'Categoria não encontrada.')),
  });

  const saveName = () => {
    const next = name.trim();
    if (!next || next === c.name) {
      setName(c.name);
      setEditing(false);
      return;
    }
    update.mutate({ name: next });
  };

  return (
    <li className={`grid gap-1 py-2 ${c.archived ? 'opacity-60' : ''}`}>
      <div className="flex items-center gap-3">
        <ColorPicker value={c.color} onChange={(color) => update.mutate({ color })} compact />
        {editing ? (
          <input
            autoFocus
            value={name}
            maxLength={60}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') saveName();
              if (e.key === 'Escape') {
                setName(c.name);
                setEditing(false);
              }
            }}
            aria-label="Nome da categoria"
            className="field h-8 flex-1"
          />
        ) : (
          <span className="flex min-w-0 flex-1 items-center gap-2">
            <span className="truncate font-medium">{c.name}</span>
            {c.archived && <span className="rounded border px-1.5 py-0.5 text-[10px] text-muted-foreground uppercase">Arquivada</span>}
          </span>
        )}
        <div className="flex items-center gap-1">
          {editing ? (
            <>
              <button onClick={saveName} disabled={update.isPending} className="btn btn-ghost btn-icon" title="Salvar" aria-label="Salvar">
                <Check />
              </button>
              <button
                onClick={() => {
                  setName(c.name);
                  setEditing(false);
                }}
                className="btn btn-ghost btn-icon"
                title="Cancelar"
                aria-label="Cancelar"
              >
                <X />
              </button>
            </>
          ) : (
            <>
              <button onClick={() => setEditing(true)} className="btn btn-ghost btn-icon" title="Renomear" aria-label="Renomear">
                <Pencil />
              </button>
              <button
                onClick={() => update.mutate({ archived: !c.archived })}
                disabled={update.isPending}
                className="btn btn-ghost btn-icon"
                title={c.archived ? 'Desarquivar' : 'Arquivar'}
                aria-label={c.archived ? 'Desarquivar' : 'Arquivar'}
              >
                {c.archived ? <ArchiveRestore /> : <Archive />}
              </button>
            </>
          )}
        </div>
      </div>
      {error && (
        <p role="alert" className="text-sm text-out">
          {error}
        </p>
      )}
    </li>
  );
}

/** Amostras prontas + seletor livre do navegador, num popover simples. */
function ColorPicker({ value, onChange, compact }: { value: string; onChange: (hex: string) => void; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className="relative"
      onBlur={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && setOpen(false)}
    >
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-label="Cor"
        title="Cor"
        className={`grid cursor-pointer place-items-center rounded-md border bg-muted/60 transition-colors hover:border-primary/60 ${compact ? 'size-8' : 'size-9'}`}
      >
        <span className="size-4 rounded-full ring-2 ring-black/30" style={{ background: value }} />
      </button>
      {open && (
        <div className="pop-in absolute top-full left-0 z-50 mt-2 grid w-48 gap-2 rounded-lg border bg-card p-2.5 shadow-2xl shadow-black/60">
          <div className="grid grid-cols-5 gap-1.5">
            {SWATCHES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => {
                  onChange(s);
                  setOpen(false);
                }}
                className={`size-7 cursor-pointer rounded-md transition-transform hover:scale-110 ${s.toLowerCase() === value.toLowerCase() ? 'ring-2 ring-foreground ring-offset-2 ring-offset-card' : ''}`}
                style={{ background: s }}
                aria-label={s}
              />
            ))}
            <label className="grid size-7 cursor-pointer place-items-center rounded-md border border-dashed text-muted-foreground hover:text-foreground" title="Outra cor">
              <Plus className="size-4" />
              <NativeColor value={value} onCommit={onChange} />
            </label>
          </div>
        </div>
      )}
    </div>
  );
}

/** No React, onChange do <input type="color"> dispara a cada arraste; aqui só salva ao fechar o seletor. */
function NativeColor({ value, onCommit }: { value: string; onCommit: (hex: string) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const commit = useRef(onCommit);
  commit.current = onCommit;
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onChange = () => commit.current(el.value);
    el.addEventListener('change', onChange);
    return () => el.removeEventListener('change', onChange);
  }, []);
  return <input ref={ref} type="color" defaultValue={value} className="sr-only" />;
}
