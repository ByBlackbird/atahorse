// İkili kodlama için hafif 2D şema (okuma modu). Slayt modunda aynı veri 3D sahnede çizilir.
import type { SSection } from './types';

type V = NonNullable<SSection['visual']>;
const W = 520, H = 240;

export default function Figure({ v }: { v: V }) {
  const L = v.labels.slice(0, 6);
  const n = L.length;
  const pill = (x: number, y: number, s: string, hi = false) => {
    const w = Math.min(150, 18 + s.length * 6.6);
    return (
      <g key={`${s}${x}${y}`} transform={`translate(${x - w / 2},${y - 13})`}>
        <rect width={w} height={26} rx={13} fill={hi ? 'var(--c-night)' : 'var(--c-surface)'} stroke={hi ? 'var(--c-night)' : 'var(--c-line-strong)'} />
        <text x={w / 2} y={17} textAnchor="middle" fontSize="11.5" fontWeight={600} fill={hi ? '#F5D9A0' : 'var(--c-ink)'}>{s.length > 22 ? `${s.slice(0, 21)}…` : s}</text>
      </g>
    );
  };
  let body: React.ReactNode;
  switch (v.type) {
    case 'bars': {
      const vals = v.values?.length ? v.values : L.map((_, i) => 40 + ((i * 37) % 55));
      const bw = (W - 80) / n;
      body = L.map((s, i) => {
        const h = (vals[i] ?? 50) * 1.6;
        return (
          <g key={s}>
            <rect x={40 + i * bw + bw * 0.18} y={200 - h} width={bw * 0.64} height={h} rx={4} fill={i === 0 ? 'var(--c-gold)' : 'var(--c-brand)'} opacity={i === 0 ? 1 : 0.85} />
            <text x={40 + i * bw + bw / 2} y={222} textAnchor="middle" fontSize="11" fill="var(--c-ink-2)">{s.length > 14 ? `${s.slice(0, 13)}…` : s}</text>
          </g>
        );
      });
      body = <>{body}<line x1={30} y1={200} x2={W - 30} y2={200} stroke="var(--c-line-strong)" /></>;
      break;
    }
    case 'flow': {
      const step = (W - 100) / Math.max(1, n - 1);
      body = <>{L.map((_, i) => i < n - 1 && <line key={`l${i}`} x1={50 + i * step} y1={120} x2={50 + (i + 1) * step} y2={120} stroke="var(--c-brand)" strokeWidth="1.5" markerEnd="url(#arr)" />)}
        {L.map((s, i) => pill(50 + i * step, i % 2 ? 150 : 90, s, i === 0))}</>;
      break;
    }
    case 'pyramid': {
      body = L.slice(0, 5).map((s, i, arr) => {
        const k = arr.length;
        const w = 120 + ((k - 1 - i) / Math.max(1, k - 1)) * 300;
        const y = 30 + i * 38;
        return (
          <g key={s}>
            <rect x={(W - w) / 2} y={y} width={w} height={32} rx={6} fill={i === 0 ? 'var(--c-gold-soft)' : 'var(--c-surface)'} stroke="var(--c-line-strong)" />
            <text x={W / 2} y={y + 21} textAnchor="middle" fontSize="12" fontWeight={600} fill="var(--c-ink)">{s}</text>
          </g>
        );
      });
      break;
    }
    case 'cycle': case 'orbit': {
      const cx = W / 2, cy = H / 2, rx = v.type === 'orbit' ? 200 : 160, ry = 88;
      body = <>
        <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="none" stroke="var(--c-line-strong)" strokeDasharray={v.type === 'orbit' ? '4 5' : undefined} />
        {v.type === 'orbit' && pill(cx, cy, v.title.slice(0, 22), true)}
        {L.map((s, i) => { const a = (i / n) * Math.PI * 2 - Math.PI / 2; return pill(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry, s, v.type === 'cycle' && i === 0); })}
      </>;
      break;
    }
    default: {
      const cx = W / 2, cy = H / 2;
      const pts = L.slice(1).map((s, i, arr) => { const a = (i / arr.length) * Math.PI * 2 - Math.PI / 2; return { s, x: cx + Math.cos(a) * 190, y: cy + Math.sin(a) * 85 }; });
      body = <>{pts.map((p) => <line key={`l${p.s}`} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="var(--c-line-strong)" />)}{pill(cx, cy, L[0], true)}{pts.map((p) => pill(p.x, p.y, p.s))}</>;
    }
  }
  return (
    <figure className="card dotgrid overflow-hidden">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={v.title}>
        <defs><marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="var(--c-brand)" /></marker></defs>
        {body}
      </svg>
      <figcaption className="border-t border-line bg-surface px-4 py-2 text-xs text-ink-3">{v.title}</figcaption>
    </figure>
  );
}
