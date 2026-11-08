// Veri tablosu — arama, sütun sıralama, sayfalama, satır seçimi (tık) ve satır eylemi (çift tık / Enter).
// Dile duyarlı sıralama (Intl.Collator), "/" kısayolu ile arama odağı, boş/sonuç yok durumu, klavye erişimi.
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { LuSearch, LuChevronUp, LuChevronDown, LuChevronsUpDown, LuChevronLeft, LuChevronRight, LuX } from 'react-icons/lu';
import { useI18n } from '../i18n/index';
import { cx } from './kit';

export interface Column<T> {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  /** Sıralama değeri; verilmezse sütun sıralanmaz. */
  sort?: (row: T) => string | number | null;
  align?: 'left' | 'right' | 'center';
  className?: string;
  /** Dar ekranda gizle */
  hideSm?: boolean;
}

type Dir = 'asc' | 'desc';
/** Dokunmatikte çift tık yok: tek dokunuş açar. */
const coarse = () => typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;

/** Saf mantık (test edilebilir): filtrele → sırala → sayfala. */
export function tableView<T>(rows: T[], o: { query: string; search?: (r: T) => string; sort?: (r: T) => string | number | null; dir: Dir; page: number; pageSize: number; locale: string }) {
  const q = o.query.trim().toLocaleLowerCase(o.locale);
  const filtered = q && o.search ? rows.filter((r) => o.search!(r).toLocaleLowerCase(o.locale).includes(q)) : rows;
  const col = new Intl.Collator(o.locale, { numeric: true, sensitivity: 'base' });
  const sorted = o.sort
    ? [...filtered].sort((a, b) => {
        const x = o.sort!(a), y = o.sort!(b);
        if (x === y) return 0;
        if (x === null) return 1;            // boş değerler her zaman sonda
        if (y === null) return -1;
        const c = typeof x === 'number' && typeof y === 'number' ? x - y : col.compare(String(x), String(y));
        return o.dir === 'asc' ? c : -c;
      })
    : filtered;
  const pages = Math.max(1, Math.ceil(sorted.length / o.pageSize));
  const page = Math.min(Math.max(1, o.page), pages);
  const start = (page - 1) * o.pageSize;
  return { rows: sorted.slice(start, start + o.pageSize), total: sorted.length, pages, page, from: sorted.length ? start + 1 : 0, to: Math.min(sorted.length, start + o.pageSize) };
}

export default function DataTable<T>({
  rows, columns, rowKey, search, initialSort, pageSize: ps = 10, onOpen, toolbar, empty, title, dense,
}: {
  rows: T[];
  columns: Column<T>[];
  rowKey: (r: T) => string | number;
  search?: (r: T) => string;
  initialSort?: { key: string; dir: Dir };
  pageSize?: number;
  onOpen?: (r: T) => void;
  toolbar?: ReactNode;
  empty?: ReactNode;
  title?: ReactNode;
  dense?: boolean;
}) {
  const { t, lang } = useI18n();
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState(initialSort?.key ?? null);
  const [dir, setDir] = useState<Dir>(initialSort?.dir ?? 'asc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(ps);
  const [sel, setSel] = useState<string | number | null>(null);
  const [pulse, setPulse] = useState<string | number | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const root = useRef<HTMLDivElement>(null);

  const sortCol = columns.find((c) => c.key === sortKey);
  const v = useMemo(() => tableView(rows, { query, search, sort: sortCol?.sort, dir, page, pageSize, locale: lang }), [rows, query, search, sortCol, dir, page, pageSize, lang]);
  useEffect(() => setPage(1), [query, pageSize]);

  // "/" → arama (yalnız bu tablo görünürken ve yazı alanında değilken)
  useEffect(() => {
    if (!search) return;
    const on = (e: KeyboardEvent) => {
      if (e.key !== '/' || (e.target as HTMLElement).closest('input, textarea, select, [contenteditable]')) return;
      const r = root.current?.getBoundingClientRect();
      if (!r || r.bottom < 0 || r.top > window.innerHeight) return;
      e.preventDefault(); input.current?.focus();
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, [search]);

  const toggleSort = (k: string) => {
    if (sortKey === k) setDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(k); setDir('asc'); }
  };
  const open = (r: T) => {
    if (!onOpen) return;
    const k = rowKey(r);
    setPulse(k);
    window.setTimeout(() => { setPulse(null); onOpen(r); }, 180);
  };
  const al = (a?: Column<T>['align']) => (a === 'right' ? 'text-right' : a === 'center' ? 'text-center' : 'text-left');

  return (
    <div ref={root} className="min-w-0">
      {(title || search || toolbar) && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {title && <div className="mr-auto min-w-0">{title}</div>}
          {search && (
            <label className="relative w-full sm:w-64">
              <span className="sr-only">{t('dt_search')}</span>
              <LuSearch aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
              <input ref={input} className="input input-sm !pl-9 !pr-14" placeholder={t('dt_search')} value={query} onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Escape') setQuery(''); }} />
              {query ? (
                <button className="absolute right-1.5 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-md text-ink-3 transition-all duration-200 hover:bg-surface-2 hover:text-ink" onClick={() => { setQuery(''); input.current?.focus(); }} aria-label={t('dt_clear')}><LuX /></button>
              ) : <span className="kbd pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 sm:inline-flex">/</span>}
            </label>
          )}
          {toolbar}
        </div>
      )}

      <div className="overflow-x-auto rounded-[12px] border border-line scrollbar-thin">
        <table className="dt">
          <thead>
            <tr>
              {columns.map((c) => {
                const active = sortKey === c.key;
                return (
                  <th key={c.key} className={cx(al(c.align), c.hideSm && 'hidden md:table-cell', c.className)} aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : undefined}>
                    {c.sort ? (
                      <button className={cx('dt-sort', c.align === 'right' && 'flex-row-reverse')} data-active={active ? 'true' : undefined} onClick={() => toggleSort(c.key)} title={t('dt_sort')}>
                        {c.header}
                        {active ? (dir === 'asc' ? <LuChevronUp className="text-accent" /> : <LuChevronDown className="text-accent" />) : <LuChevronsUpDown className="opacity-50" />}
                      </button>
                    ) : c.header}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {v.rows.map((r) => {
              const k = rowKey(r);
              return (
                <tr key={k} aria-selected={sel === k} data-pulse={pulse === k ? '1' : undefined} tabIndex={onOpen ? 0 : undefined}
                  className={cx(onOpen && 'cursor-pointer', dense && '[&>td]:py-2')}
                  onClick={() => { setSel(k); if (coarse()) open(r); }} onDoubleClick={() => open(r)} onKeyDown={(e) => { if (e.key === 'Enter') open(r); }}>
                  {columns.map((c) => <td key={c.key} className={cx(al(c.align), c.hideSm && 'hidden md:table-cell', c.className)}>{c.cell(r)}</td>)}
                </tr>
              );
            })}
            {v.total === 0 && (
              <tr><td colSpan={columns.length} className="!py-10 text-center text-sm text-ink-3">{query ? t('dt_no_match', { q: query }) : (empty ?? t('pr_no_data'))}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {v.total > Math.min(pageSize, 10) && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm text-ink-2">
          <span className="tabular-nums">{t('dt_range', { a: v.from, b: v.to, n: v.total })}</span>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 text-xs text-ink-3">{t('dt_rows')}
              <select className="input input-sm !w-auto !pr-2" value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))}>{[10, 25, 50].map((n) => <option key={n} value={n}>{n}</option>)}</select>
            </label>
            <button className="btn btn-outline btn-icon btn-sm" disabled={v.page <= 1} onClick={() => setPage(v.page - 1)} aria-label={t('dt_prev')}><LuChevronLeft /></button>
            <span className="min-w-[3.5rem] text-center tabular-nums">{v.page} / {v.pages}</span>
            <button className="btn btn-outline btn-icon btn-sm" disabled={v.page >= v.pages} onClick={() => setPage(v.page + 1)} aria-label={t('dt_next')}><LuChevronRight /></button>
          </div>
        </div>
      )}
      {onOpen && v.total > 0 && <p className="mt-2 hidden text-xs text-ink-3 md:block">{t('dt_open_hint')}</p>}
    </div>
  );
}
