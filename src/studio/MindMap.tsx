// Zihin haritası — marka imzası: inci zemin + noktalı ızgara, düz çizgiler, beyaz hap düğümler.
// Sürükle-bırak, kaydır/yakınlaştır, dal ekle/sil, yeniden adlandır, otomatik yerleşim, AI önerisi, otomatik kayıt.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LuPlus, LuTrash2, LuWandSparkles, LuSparkles, LuScan, LuDownload, LuCheck, LuZoomIn, LuZoomOut } from 'react-icons/lu';
import { trpc, errCode } from '../lib/trpc';
import { useErr, useI18n } from '../i18n/index';
import { useToast } from '../ui/providers';
import { PageLoader, Spinner, cx } from '../ui/kit';
import { autoLayout } from '../../shared/engine/generate';
import type { MindNode } from '../../shared/types';

const nodeW = (n: MindNode) => Math.min(220, Math.max(70, n.label.length * 7.4 + (n.kind === 'root' ? 44 : 30)));
const nodeH = (n: MindNode) => (n.kind === 'root' ? 44 : n.kind === 'module' ? 36 : 30);
const uid = () => `n${Math.random().toString(36).slice(2, 9)}`;

export default function MindMap({ courseId }: { courseId: number }) {
  const { t, lang } = useI18n();
  const err = useErr();
  const toast = useToast();
  const q = trpc.ai.mindmap.useQuery({ courseId });
  const save = trpc.ai.saveMindmap.useMutation();
  const suggest = trpc.ai.suggest.useMutation({ onError: (e) => toast.push('error', err(errCode(e))) });
  const [nodes, setNodes] = useState<MindNode[] | null>(null);
  const [sel, setSel] = useState<string | null>('root');
  const [view, setView] = useState({ x: 0, y: 0, k: 0.8 });
  const [dirty, setDirty] = useState(false);
  const svg = useRef<SVGSVGElement>(null);
  const labelInput = useRef<HTMLInputElement>(null);
  const drag = useRef<{ kind: 'pan' | 'node'; id?: string; sx: number; sy: number; ox: number; oy: number; moved: boolean } | null>(null);

  useEffect(() => { if (q.data && !nodes) setNodes(q.data.nodes); }, [q.data, nodes]);

  // Otomatik kayıt (debounce)
  useEffect(() => {
    if (!dirty || !nodes) return;
    const id = window.setTimeout(() => { save.mutate({ courseId, nodes }, { onSuccess: () => setDirty(false) }); }, 1200);
    return () => window.clearTimeout(id);
  }, [nodes, dirty, courseId]); // eslint-disable-line react-hooks/exhaustive-deps

  const update = useCallback((fn: (n: MindNode[]) => MindNode[]) => { setNodes((s) => (s ? fn(s) : s)); setDirty(true); }, []);

  const fit = useCallback(() => {
    if (!nodes || !svg.current) return;
    const r = svg.current.getBoundingClientRect();
    const xs = nodes.flatMap((n) => [n.x - nodeW(n) / 2, n.x + nodeW(n) / 2]);
    const ys = nodes.flatMap((n) => [n.y - 30, n.y + 30]);
    const w = Math.max(...xs) - Math.min(...xs) + 80, h = Math.max(...ys) - Math.min(...ys) + 80;
    const k = Math.min(1.4, Math.max(0.25, Math.min(r.width / w, r.height / h)));
    const cx0 = (Math.max(...xs) + Math.min(...xs)) / 2, cy0 = (Math.max(...ys) + Math.min(...ys)) / 2;
    setView({ k, x: r.width / 2 - cx0 * k, y: r.height / 2 - cy0 * k });
  }, [nodes]);
  const fitted = useRef(false);
  useEffect(() => { if (nodes && !fitted.current) { fitted.current = true; requestAnimationFrame(fit); } }, [nodes, fit]);

  const onDown = (e: React.PointerEvent, id?: string) => {
    e.stopPropagation();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    if (id) {
      const n = nodes!.find((x) => x.id === id)!;
      setSel(id);
      drag.current = { kind: 'node', id, sx: e.clientX, sy: e.clientY, ox: n.x, oy: n.y, moved: false };
    } else {
      drag.current = { kind: 'pan', sx: e.clientX, sy: e.clientY, ox: view.x, oy: view.y, moved: false };
    }
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.sx, dy = e.clientY - d.sy;
    if (Math.abs(dx) + Math.abs(dy) > 3) d.moved = true;
    if (d.kind === 'pan') setView((v) => ({ ...v, x: d.ox + dx, y: d.oy + dy }));
    else if (d.moved) update((s) => s.map((n) => (n.id === d.id ? { ...n, x: Math.round(d.ox + dx / view.k), y: Math.round(d.oy + dy / view.k) } : n)));
  };
  const onUp = () => {
    const d = drag.current;
    drag.current = null;
    if (d?.kind === 'pan' && !d.moved) setSel(null);
  };
  const onWheel = (e: React.WheelEvent) => {
    const r = svg.current!.getBoundingClientRect();
    const k = Math.max(0.25, Math.min(2.2, view.k * (e.deltaY < 0 ? 1.1 : 0.9)));
    const px = e.clientX - r.left, py = e.clientY - r.top;
    setView((v) => ({ k, x: px - ((px - v.x) / v.k) * k, y: py - ((py - v.y) / v.k) * k }));
  };
  const zoom = (f: number) => setView((v) => {
    const r = svg.current!.getBoundingClientRect();
    const k = Math.max(0.25, Math.min(2.2, v.k * f));
    return { k, x: r.width / 2 - ((r.width / 2 - v.x) / v.k) * k, y: r.height / 2 - ((r.height / 2 - v.y) / v.k) * k };
  });

  const addChild = (parentId: string, label = t('m_new_node'), kind: MindNode['kind'] = 'custom') => {
    const p = nodes!.find((n) => n.id === parentId);
    if (!p) return;
    const gp = p.parentId ? nodes!.find((n) => n.id === p.parentId) : null;
    const siblings = nodes!.filter((n) => n.parentId === parentId).length;
    const base = gp ? Math.atan2(p.y - gp.y, p.x - gp.x) : (siblings / 6) * Math.PI * 2;
    const a = base + (siblings % 2 ? 1 : -1) * Math.ceil(siblings / 2) * 0.42;
    const id = uid();
    update((s) => [...s, { id, label: label.slice(0, 78), x: Math.round(p.x + Math.cos(a) * 190), y: Math.round(p.y + Math.sin(a) * 120), parentId, kind, moduleIdx: p.moduleIdx }]);
    return id;
  };
  const removeSel = () => {
    if (!sel || sel === 'root') return;
    const kill = new Set([sel]);
    let grew = true;
    while (grew) { grew = false; for (const n of nodes!) if (n.parentId && kill.has(n.parentId) && !kill.has(n.id)) { kill.add(n.id); grew = true; } }
    update((s) => s.filter((n) => !kill.has(n.id)));
    setSel(null);
  };
  const relayout = () => { update((s) => autoLayout(s)); requestAnimationFrame(fit); };
  const download = () => {
    if (!svg.current) return;
    const clone = svg.current.cloneNode(true) as SVGSVGElement;
    const cs = getComputedStyle(document.documentElement);
    let src = new XMLSerializer().serializeToString(clone);
    src = src.replace(/var\((--[\w-]+)\)/g, (_m, v) => cs.getPropertyValue(v).trim() || '#000');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([src], { type: 'image/svg+xml' }));
    a.download = 'atahorse-zihin-haritasi.svg';
    a.click();
    URL.revokeObjectURL(a.href);
  };

  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input, textarea')) return;
      if ((e.key === 'Delete' || e.key === 'Backspace') && sel) { e.preventDefault(); removeSel(); }
      if (e.key === 'Tab' && sel) { e.preventDefault(); const id = addChild(sel); if (id) setSel(id); }
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  });

  const byId = useMemo(() => new Map((nodes ?? []).map((n) => [n.id, n])), [nodes]);
  if (!nodes) return <PageLoader />;
  const selected = sel ? byId.get(sel) : undefined;

  return (
    <div className="space-y-3">
      <div className="card flex flex-wrap items-center gap-2 p-2">
        <button className="btn btn-outline btn-sm" disabled={!selected} onClick={() => { const id = sel && addChild(sel); if (id) setSel(id); }}><LuPlus /> {t('m_add')}</button>
        <button className="btn btn-ghost btn-sm" disabled={!selected || selected.kind === 'root'} onClick={removeSel}><LuTrash2 /> {t('m_delete')}</button>
        <input ref={labelInput} className="input !h-8 min-w-40 max-w-64 flex-1 !text-sm" placeholder={t('m_select')} disabled={!selected} value={selected?.label ?? ''} maxLength={78}
          onChange={(e) => { const v = e.target.value; update((s) => s.map((n) => (n.id === sel ? { ...n, label: v || '·' } : n))); }} />
        <button className="btn btn-outline btn-sm" disabled={!selected || suggest.isPending} onClick={() => sel && suggest.mutate({ courseId, nodeId: sel, nodes, locale: lang })}>
          {suggest.isPending ? <Spinner className="h-3.5 w-3.5" /> : <LuSparkles />} {t('m_suggest')}
        </button>
        <span className="mx-1 hidden h-5 w-px bg-line md:block" />
        <button className="btn btn-ghost btn-sm" onClick={relayout}><LuWandSparkles /> {t('m_layout')}</button>
        <button className="btn btn-ghost btn-icon" onClick={() => zoom(1.15)} aria-label="zoom in"><LuZoomIn /></button>
        <button className="btn btn-ghost btn-icon" onClick={() => zoom(0.87)} aria-label="zoom out"><LuZoomOut /></button>
        <button className="btn btn-ghost btn-icon" onClick={fit} title={t('m_fit')} aria-label={t('m_fit')}><LuScan /></button>
        <button className="btn btn-ghost btn-icon" onClick={download} title="SVG" aria-label="SVG"><LuDownload /></button>
        <span className="ml-auto flex items-center gap-1.5 pr-2 text-xs text-ink-3">
          {save.isPending || dirty ? <><Spinner className="h-3 w-3" /> {t('m_saving')}</> : <><LuCheck className="text-ok" /> {t('saved')}</>} · {t('m_nodes_n', { n: nodes.length })}
        </span>
      </div>

      {suggest.data && suggest.variables?.nodeId === sel && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-ink-3">{t('m_suggestions')}:</span>
          {suggest.data.branches.map((b) => (
            <button key={b} className="chip chip-brand hover:opacity-80" onClick={() => sel && addChild(sel, b, 'ai')}><LuPlus /> {b}</button>
          ))}
        </div>
      )}

      <div className="card dotgrid relative h-[68vh] min-h-[420px] overflow-hidden" style={{ backgroundPosition: `${view.x}px ${view.y}px`, backgroundSize: `${22 * view.k}px ${22 * view.k}px` }}>
        <svg ref={svg} className="h-full w-full touch-none select-none" onPointerDown={(e) => onDown(e)} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onWheel={onWheel}>
          <g transform={`translate(${view.x},${view.y}) scale(${view.k})`}>
            {nodes.map((n) => {
              const p = n.parentId ? byId.get(n.parentId) : null;
              return p ? <line key={`e${n.id}`} x1={p.x} y1={p.y} x2={n.x} y2={n.y} stroke={n.kind === 'ai' ? 'var(--c-brand)' : 'var(--c-line-strong)'} strokeWidth={n.kind === 'module' ? 1.6 : 1.2} strokeDasharray={n.kind === 'ai' ? '5 4' : undefined} /> : null;
            })}
            {nodes.map((n) => {
              const w = nodeW(n), h = nodeH(n);
              const isSel = n.id === sel;
              const fill = n.kind === 'root' ? 'var(--c-night)' : n.kind === 'ai' ? 'var(--c-brand-soft)' : 'var(--c-surface)';
              const color = n.kind === 'root' ? '#F5D9A0' : 'var(--c-ink)';
              const label = n.label.length > 30 ? `${n.label.slice(0, 29)}…` : n.label;
              return (
                <g key={n.id} transform={`translate(${n.x - w / 2},${n.y - h / 2})`} className="cursor-grab active:cursor-grabbing"
                  onPointerDown={(e) => onDown(e, n.id)} onDoubleClick={(e) => { e.stopPropagation(); setSel(n.id); requestAnimationFrame(() => labelInput.current?.select()); }}>
                  <rect width={w} height={h} rx={h / 2} fill={fill} stroke={isSel ? 'var(--c-brand)' : n.kind === 'root' ? 'var(--c-night)' : 'var(--c-line-strong)'} strokeWidth={isSel ? 2.2 : 1} />
                  {n.kind === 'module' && <circle cx={14} cy={h / 2} r={4} fill="var(--c-gold)" />}
                  {n.kind === 'custom' && <circle cx={13} cy={h / 2} r={3} fill="var(--c-brand)" />}
                  <text x={w / 2 + (n.kind === 'module' || n.kind === 'custom' ? 5 : 0)} y={h / 2 + 4.5} textAnchor="middle" fontSize={n.kind === 'root' ? 15 : n.kind === 'module' ? 13 : 12} fontWeight={n.kind === 'section' ? 500 : 600} fill={color} fontFamily="Inter, system-ui, sans-serif">{label}</text>
                  <title>{n.label}</title>
                </g>
              );
            })}
          </g>
        </svg>
        <p className={cx('pointer-events-none absolute bottom-3 left-3 rounded-full border border-line bg-surface px-3 py-1 text-xs text-ink-3')}>{t('m_hint')}</p>
      </div>
    </div>
  );
}
