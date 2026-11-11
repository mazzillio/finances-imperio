import { CalendarDays, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { monthRange, todayISO } from '../lib/money';

/*
 * Calendários próprios, no lugar dos <input type="date|month"> do navegador,
 * para seguirem a identidade do clube. Valores sempre em texto ISO ("2026-11-10" / "2026-11"),
 * montados à mão para não sofrer com fuso horário.
 */

const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const WEEKDAYS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

const pad = (n: number) => String(n).padStart(2, '0');
const toISO = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;
const parseISO = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return { y, m: m - 1, d: d ?? 1 };
};
const shortDate = (iso: string) => {
  const { y, m, d } = parseISO(iso);
  return `${pad(d)} ${MONTHS[m].slice(0, 3).toLowerCase()} ${y}`;
};

/* ---------- Popover ---------- */

function usePopover() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);
  return { open, setOpen, ref };
}

function Panel({ align = 'left', children }: { align?: 'left' | 'right'; children: ReactNode }) {
  return (
    <div
      role="dialog"
      className={`absolute top-full z-50 mt-2 w-72 rounded-[var(--radius-card)] border bg-card p-3 shadow-2xl shadow-black/60 ring-1 ring-primary/10 pop-in ${
        align === 'right' ? 'left-0 sm:right-0 sm:left-auto' : 'left-0'
      }`}
    >
      {children}
    </div>
  );
}

function NavHeader({ title, onPrev, onNext, onTitle }: { title: string; onPrev: () => void; onNext: () => void; onTitle?: () => void }) {
  return (
    <div className="mb-2 flex items-center justify-between">
      <button type="button" onClick={onPrev} className="btn btn-ghost btn-icon" aria-label="Anterior">
        <ChevronLeft />
      </button>
      <button
        type="button"
        onClick={onTitle}
        disabled={!onTitle}
        className="rounded-md px-2 py-1 font-semibold text-gold-300 transition-colors enabled:cursor-pointer enabled:hover:bg-muted disabled:cursor-default"
      >
        {title}
      </button>
      <button type="button" onClick={onNext} className="btn btn-ghost btn-icon" aria-label="Próximo">
        <ChevronRight />
      </button>
    </div>
  );
}

function MonthGrid({ year, selected, onPick }: { year: number; selected?: { y: number; m: number }; onPick: (m: number) => void }) {
  const now = parseISO(todayISO());
  return (
    <div className="grid grid-cols-3 gap-1.5">
      {MONTHS.map((name, m) => {
        const isSel = selected?.y === year && selected.m === m;
        const isNow = now.y === year && now.m === m;
        return (
          <button
            key={name}
            type="button"
            onClick={() => onPick(m)}
            className={`h-10 cursor-pointer rounded-md text-sm font-medium transition-colors ${
              isSel
                ? 'bg-primary text-primary-foreground'
                : `hover:bg-muted hover:text-gold-300 ${isNow ? 'text-gold-300 ring-1 ring-primary/50' : ''}`
            }`}
          >
            {name.slice(0, 3)}
          </button>
        );
      })}
    </div>
  );
}

/* ---------- Seletor de data ---------- */

type DatePickerProps = {
  value: string;
  onChange: (iso: string) => void;
  /** Para usar dentro de <form>: gera um input escondido com este nome. */
  name?: string;
  placeholder?: string;
  'aria-label'?: string;
  /** Mostra o botão de limpar (filtros). */
  clearable?: boolean;
  align?: 'left' | 'right';
  className?: string;
};

export function DatePicker({ value, onChange, name, placeholder = 'Data', clearable, align, className = '', ...rest }: DatePickerProps) {
  const { open, setOpen, ref } = usePopover();
  const today = todayISO();
  const base = parseISO(value || today);
  const [view, setView] = useState({ y: base.y, m: base.m });
  const [mode, setMode] = useState<'days' | 'months'>('days');

  const toggle = () => {
    if (!open) {
      setView({ y: base.y, m: base.m });
      setMode('days');
    }
    setOpen(!open);
  };
  const pick = (iso: string) => {
    onChange(iso);
    setOpen(false);
  };
  const move = (delta: number) => {
    const d = new Date(view.y, view.m + delta, 1);
    setView({ y: d.getFullYear(), m: d.getMonth() });
  };

  // 6 semanas fixas, começando no domingo, para o painel não mudar de altura.
  const first = new Date(view.y, view.m, 1);
  const start = new Date(view.y, view.m, 1 - first.getDay());
  const cells = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    return { iso: toISO(d.getFullYear(), d.getMonth(), d.getDate()), day: d.getDate(), inMonth: d.getMonth() === view.m };
  });

  return (
    <div ref={ref} className={`relative ${className}`}>
      {name && <input type="hidden" name={name} value={value} />}
      <button
        type="button"
        onClick={toggle}
        aria-label={rest['aria-label']}
        aria-expanded={open}
        className={`field flex w-full cursor-pointer items-center gap-2 text-left ${open ? 'border-ring ring-[3px] ring-ring/50' : ''}`}
      >
        <CalendarDays className="size-4 shrink-0 text-gold-400" />
        <span className={`flex-1 truncate ${value ? '' : 'text-muted-foreground'}`}>{value ? shortDate(value) : placeholder}</span>
        {clearable && value && (
          <span
            role="button"
            tabIndex={0}
            aria-label="Limpar data"
            onClick={(e) => {
              e.stopPropagation();
              onChange('');
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                e.stopPropagation();
                onChange('');
              }
            }}
            className="-mr-1 rounded p-0.5 text-muted-foreground hover:bg-border hover:text-foreground"
          >
            <X className="size-3.5" />
          </span>
        )}
      </button>

      {open && (
        <Panel align={align}>
          {mode === 'days' ? (
            <>
              <NavHeader
                title={`${MONTHS[view.m]} ${view.y}`}
                onPrev={() => move(-1)}
                onNext={() => move(1)}
                onTitle={() => setMode('months')}
              />
              <div className="grid grid-cols-7 gap-1 text-center">
                {WEEKDAYS.map((w, i) => (
                  <span key={i} className="py-1 text-[11px] font-semibold text-muted-foreground uppercase">
                    {w}
                  </span>
                ))}
                {cells.map((c) => {
                  const isSel = c.iso === value;
                  const isToday = c.iso === today;
                  return (
                    <button
                      key={c.iso}
                      type="button"
                      onClick={() => pick(c.iso)}
                      className={`grid aspect-square cursor-pointer place-items-center rounded-md text-sm tabular-nums transition-colors ${
                        isSel
                          ? 'bg-primary font-semibold text-primary-foreground'
                          : `hover:bg-muted hover:text-gold-300 ${c.inMonth ? '' : 'text-muted-foreground/40'} ${
                              isToday ? 'font-semibold text-gold-300 ring-1 ring-primary/50' : ''
                            }`
                      }`}
                    >
                      {c.day}
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <>
              <NavHeader
                title={String(view.y)}
                onPrev={() => setView({ ...view, y: view.y - 1 })}
                onNext={() => setView({ ...view, y: view.y + 1 })}
              />
              <MonthGrid
                year={view.y}
                selected={value ? parseISO(value) : undefined}
                onPick={(m) => {
                  setView({ y: view.y, m });
                  setMode('days');
                }}
              />
            </>
          )}
          <div className="mt-3 flex items-center justify-between gap-2 border-t pt-3">
            {clearable ? (
              <button type="button" disabled={!value} onClick={() => pick('')} className="btn btn-ghost btn-sm">
                Limpar
              </button>
            ) : (
              <span />
            )}
            <button type="button" onClick={() => pick(today)} className="btn btn-outline btn-sm">
              Hoje
            </button>
          </div>
        </Panel>
      )}
    </div>
  );
}

/* ---------- Período (De / Até) ---------- */

export interface DateRange {
  from: string;
  to: string;
}

/** Dois calendários, De e Até, com atalhos. Mantém sempre De <= Até. */
export function DateRangePicker({ value, onChange }: { value: DateRange; onChange: (range: DateRange) => void }) {
  const today = todayISO();
  const month = monthRange(today.slice(0, 7));
  const isToday = value.from === today && value.to === today;
  const isMonth = value.from === month.from && value.to === month.to;
  const shortcut = (on: boolean) => `btn btn-sm ${on ? 'bg-muted text-gold-300' : 'btn-ghost text-muted-foreground'}`;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1">
        <button type="button" onClick={() => onChange({ from: today, to: today })} className={shortcut(isToday)}>
          Hoje
        </button>
        <button type="button" onClick={() => onChange(month)} className={shortcut(isMonth)}>
          Este mês
        </button>
      </div>
      <div className="flex flex-1 items-center gap-2 sm:flex-none">
        <DatePicker
          value={value.from}
          onChange={(from) => from && onChange({ from, to: from > value.to ? from : value.to })}
          placeholder="De"
          aria-label="De"
          className="min-w-36 flex-1 sm:w-40 sm:flex-none"
        />
        <span className="text-sm text-muted-foreground">até</span>
        <DatePicker
          value={value.to}
          onChange={(to) => to && onChange({ from: to < value.from ? to : value.from, to })}
          placeholder="Até"
          aria-label="Até"
          align="right"
          className="min-w-36 flex-1 sm:w-40 sm:flex-none"
        />
      </div>
    </div>
  );
}
