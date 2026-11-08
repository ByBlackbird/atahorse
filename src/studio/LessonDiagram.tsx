// Anlatımlı dersin şeması: anlatılan cümleyle birlikte sıradaki parça açılır, son açılan vurgulanır.
// Renk anlam taşır (brand = kavram, gold = kilit fikir, ok = doğru/çıktı, bad = hata/risk, neutral = bağlam).
import type { IconType } from 'react-icons';
import {
  LuLightbulb, LuBookOpen, LuBrain, LuLeaf, LuSprout, LuSun, LuDroplet, LuFlame, LuZap, LuAtom, LuDna, LuMicroscope, LuFlaskConical,
  LuSettings, LuFactory, LuUser, LuUsers, LuCoins, LuChartLine, LuClock, LuGlobe, LuMap, LuBuilding2, LuLandmark, LuHouse,
  LuHeart, LuShield, LuCircleCheck, LuTriangleAlert, LuCircleHelp, LuTarget, LuLink, LuCode, LuCalculator, LuMusic, LuPalette,
  LuScale, LuRocket, LuMountain, LuCloud, LuCar, LuMessageCircle, LuHammer, LuPuzzle, LuKey, LuEye, LuHand,
  LuArrowRight, LuArrowDown, LuArrowLeftRight,
} from 'react-icons/lu';
import { cx } from '../ui/kit';
import type { DNode, Diagram, Icon, Tone } from '../../shared/engine/lesson';

const ICON: Record<Icon, IconType> = {
  idea: LuLightbulb, book: LuBookOpen, brain: LuBrain, leaf: LuLeaf, sprout: LuSprout, sun: LuSun, water: LuDroplet, fire: LuFlame,
  energy: LuZap, atom: LuAtom, dna: LuDna, microscope: LuMicroscope, flask: LuFlaskConical, gear: LuSettings, factory: LuFactory,
  person: LuUser, people: LuUsers, money: LuCoins, chart: LuChartLine, time: LuClock, globe: LuGlobe, map: LuMap, building: LuBuilding2,
  landmark: LuLandmark, home: LuHouse, heart: LuHeart, shield: LuShield, check: LuCircleCheck, warning: LuTriangleAlert,
  question: LuCircleHelp, target: LuTarget, link: LuLink, code: LuCode, calculator: LuCalculator, music: LuMusic, palette: LuPalette,
  scale: LuScale, rocket: LuRocket, mountain: LuMountain, cloud: LuCloud, car: LuCar, message: LuMessageCircle, tool: LuHammer,
  puzzle: LuPuzzle, key: LuKey, eye: LuEye, hand: LuHand,
};

const TONE: Record<Tone, { chip: string; ring: string; edge: string }> = {
  brand: { chip: 'bg-brand-soft text-brand-ink', ring: 'border-brand ring-2 ring-brand/25', edge: 'border-brand/40' },
  gold: { chip: 'bg-gold-soft text-gold-ink', ring: 'border-gold ring-2 ring-gold/30', edge: 'border-gold/60' },
  ok: { chip: 'bg-ok-soft text-ok', ring: 'border-ok ring-2 ring-ok/25', edge: 'border-ok/40' },
  bad: { chip: 'bg-bad-soft text-bad', ring: 'border-bad ring-2 ring-bad/25', edge: 'border-bad/40' },
  neutral: { chip: 'bg-surface-2 text-ink-2', ring: 'border-line-strong ring-2 ring-line', edge: 'border-line' },
};

/** Görünürlük: gizli parça yer tutar (şema zıplamaz), açılınca yükselir; odaktaki parça halkalanır. */
const vis = (on: boolean) => cx('transition-all duration-500 ease-out', on ? 'opacity-100 translate-y-0' : 'pointer-events-none translate-y-2 opacity-0');

function Node({ n, on, focus, big, center }: { n: DNode; on: boolean; focus: boolean; big?: boolean; center?: boolean }) {
  const I = n.icon ? ICON[n.icon] : null;
  const t = TONE[n.tone];
  return (
    <div className={cx('rounded-[14px] border bg-surface p-3', vis(on), focus ? t.ring : t.edge, focus && 'scale-[1.02]', center && 'text-center')}>
      <div className={cx('flex gap-2.5', center ? 'flex-col items-center' : 'items-start')}>
        {I && <span className={cx('grid shrink-0 place-items-center rounded-full', t.chip, big ? 'h-11 w-11 text-xl' : 'h-9 w-9 text-lg')}><I aria-hidden /></span>}
        <div className="min-w-0">
          <p className={cx('line-clamp-2 font-semibold leading-snug', big ? 'text-base md:text-lg' : 'text-sm')} title={n.label}>{n.label}</p>
          {n.detail && <p className="mt-0.5 line-clamp-3 text-xs leading-snug text-ink-2">{n.detail}</p>}
        </div>
      </div>
    </div>
  );
}

const Arrow = ({ on, vertical }: { on: boolean; vertical?: boolean }) => (
  <span className={cx('grid shrink-0 place-items-center text-ink-3', vis(on))} aria-hidden>{vertical ? <LuArrowDown /> : <LuArrowRight />}</span>
);

/** Dairesel yerleşim için % konumları (üstten saat yönünde). */
const ring = (n: number, r = 38) => Array.from({ length: n }, (_, i) => {
  const a = -Math.PI / 2 + (i / n) * Math.PI * 2;
  return { x: 50 + r * Math.cos(a), y: 50 + r * Math.sin(a) };
});

export default function LessonDiagram({ d, shown }: { d: Diagram; shown: number }) {
  const f = shown - 1; // odak = son açılan parça
  switch (d.type) {
    case 'flow':
      return (
        <div className="flex flex-col items-stretch gap-2 md:flex-row md:items-center">
          {d.nodes.map((n, i) => (
            <div key={i} className="contents">
              {i > 0 && <><span className="hidden md:block"><Arrow on={i < shown} /></span><span className="self-center md:hidden"><Arrow on={i < shown} vertical /></span></>}
              <div className="min-w-0 md:flex-1"><Node n={n} on={i < shown} focus={i === f} /></div>
            </div>
          ))}
        </div>
      );
    case 'cycle': {
      const pos = ring(d.nodes.length);
      return (
        <>
          <div className="relative mx-auto hidden aspect-square w-full max-w-[520px] @3xl:block">
            <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full" aria-hidden>
              <circle cx="50" cy="50" r="38" fill="none" stroke="var(--c-line-strong)" strokeWidth="0.4" strokeDasharray="1.4 1.4" />
            </svg>
            {d.nodes.map((n, i) => (
              <div key={i} className="absolute w-[34%] -translate-x-1/2 -translate-y-1/2" style={{ left: `${pos[i].x}%`, top: `${pos[i].y}%` }}>
                <Node n={n} on={i < shown} focus={i === f} center />
              </div>
            ))}
          </div>
          <ol className="grid gap-2 @3xl:hidden">
            {d.nodes.map((n, i) => <li key={i}><Node n={n} on={i < shown} focus={i === f} /></li>)}
          </ol>
        </>
      );
    }
    case 'cause':
      return (
        <div className="grid items-center gap-3 md:grid-cols-[1fr_auto_1fr]">
          <div className="grid gap-2">{d.causes.map((n, i) => <Node key={i} n={n} on={i < shown} focus={i === f} />)}</div>
          <span className="justify-self-center"><span className="hidden md:block"><Arrow on={shown > d.causes.length} /></span><span className="md:hidden"><Arrow on={shown > d.causes.length} vertical /></span></span>
          <Node n={d.effect} on={shown > d.causes.length} focus={f === d.causes.length} big />
        </div>
      );
    case 'compare': {
      const rows = Math.max(d.a.items.length, d.b.items.length);
      const col = (side: typeof d.a, tone: 'brand' | 'gold') => {
        const I = side.icon ? ICON[side.icon] : null;
        return (
          <div className="grid content-start gap-2">
            <div className={cx('flex items-center gap-2 rounded-[14px] border bg-surface p-3 font-semibold', TONE[tone].edge)}>
              {I && <span className={cx('grid h-9 w-9 place-items-center rounded-full text-lg', TONE[tone].chip)}><I aria-hidden /></span>}{side.title}
            </div>
            {Array.from({ length: rows }, (_, r) => (
              <p key={r} className={cx('min-h-[2.75rem] rounded-xl border bg-surface px-3 py-2 text-sm', vis(r + 1 < shown), r + 1 === f ? TONE[tone].ring : 'border-line')}>{side.items[r] ?? ''}</p>
            ))}
          </div>
        );
      };
      return <div className="grid grid-cols-2 gap-3">{col(d.a, 'brand')}{col(d.b, 'gold')}</div>;
    }
    case 'hierarchy':
      return (
        <div className="grid gap-3">
          <div className="mx-auto w-full max-w-sm"><Node n={d.root} on={shown > 0} focus={f === 0} big center /></div>
          <div className={cx('mx-auto h-4 w-px bg-line-strong', vis(shown > 1))} aria-hidden />
          <div className={cx('grid gap-2 border-t border-line-strong pt-3', d.children.length > 3 ? 'sm:grid-cols-2 lg:grid-cols-4' : 'sm:grid-cols-3')}>
            {d.children.map((n, i) => <Node key={i} n={n} on={i + 1 < shown} focus={i + 1 === f} />)}
          </div>
        </div>
      );
    case 'concept': {
      const pos = ring(d.links.length, 36);
      return (
        <>
          <div className="relative mx-auto hidden aspect-[16/10] min-h-[380px] w-full @3xl:block">
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden>
              {d.links.map((_, i) => (
                <line key={i} x1="50" y1="50" x2={pos[i].x} y2={pos[i].y} stroke={i + 1 === f ? 'var(--c-gold)' : 'var(--c-line-strong)'} strokeWidth={i + 1 === f ? 0.6 : 0.35}
                  vectorEffect="non-scaling-stroke" className="transition-opacity duration-500" opacity={i + 1 < shown ? 1 : 0} />
              ))}
            </svg>
            <div className="absolute left-1/2 top-1/2 w-[30%] -translate-x-1/2 -translate-y-1/2"><Node n={d.center} on={shown > 0} focus={f === 0} big center /></div>
            {d.links.map((l, i) => (
              <div key={i} className="absolute w-[24%] -translate-x-1/2 -translate-y-1/2" style={{ left: `${pos[i].x}%`, top: `${pos[i].y}%` }}>
                {l.relation && <p className={cx('mb-1 text-center text-[11px] font-semibold uppercase tracking-wider text-ink-3', vis(i + 1 < shown))}>{l.relation}</p>}
                <Node n={l.node} on={i + 1 < shown} focus={i + 1 === f} center />
              </div>
            ))}
          </div>
          <div className="grid gap-2 @3xl:hidden">
            <Node n={d.center} on={shown > 0} focus={f === 0} big />
            {d.links.map((l, i) => (
              <div key={i} className="flex items-center gap-2 pl-4">
                <span className={cx('w-16 shrink-0 text-right text-[11px] font-semibold uppercase text-ink-3', vis(i + 1 < shown))}>{l.relation}</span>
                <div className="min-w-0 flex-1"><Node n={l.node} on={i + 1 < shown} focus={i + 1 === f} /></div>
              </div>
            ))}
          </div>
        </>
      );
    }
    case 'analogy':
      return (
        <div className="grid gap-4">
          <div className="grid items-center gap-3 md:grid-cols-[1fr_auto_1fr]">
            <Node n={d.source} on={shown > 0} focus={f === 0} big />
            <span className={cx('justify-self-center text-xl text-gold-ink', vis(shown > 1))} aria-hidden><LuArrowLeftRight /></span>
            <Node n={d.target} on={shown > 1} focus={f === 1} big />
          </div>
          {d.pairs.length > 0 && (
            <div className="grid gap-2">
              {d.pairs.map((p, i) => (
                <div key={i} className={cx('grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-xl border bg-surface px-3 py-2 text-sm', vis(i + 2 < shown), i + 2 === f ? TONE.gold.ring : 'border-line')}>
                  <span className="text-ink-2">{p.from}</span><LuArrowRight className="text-ink-3" aria-hidden /><span className="font-semibold">{p.to}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    case 'timeline':
      return (
        <ol className="relative grid gap-3 md:grid-flow-col md:auto-cols-fr md:gap-2">
          <span className="absolute bottom-2 left-[0.6rem] top-2 w-px bg-line-strong md:bottom-auto md:left-2 md:right-2 md:top-[0.6rem] md:h-px md:w-auto" aria-hidden />
          {d.events.map((e, i) => (
            <li key={i} className="relative pl-7 md:pl-0 md:pt-7">
              <span className={cx('absolute left-1 top-1 h-3 w-3 rounded-full border-2 border-surface md:left-1/2 md:-translate-x-1/2', i < shown ? (i === f ? 'bg-gold' : 'bg-brand') : 'bg-line')} aria-hidden />
              <p className={cx('mb-1 text-xs font-semibold tabular-nums text-gold-ink md:text-center', vis(i < shown))}>{e.when}</p>
              <Node n={e.node} on={i < shown} focus={i === f} />
            </li>
          ))}
        </ol>
      );
    case 'stat':
      return (
        <div className={cx('grid gap-3', d.stats.length === 2 && 'sm:grid-cols-2', d.stats.length >= 3 && 'sm:grid-cols-3')}>
          {d.stats.map((s, i) => (
            <div key={i} className={cx('rounded-[14px] border bg-surface p-4 text-center', vis(i < shown), i === f ? TONE[s.node.tone].ring : 'border-line')}>
              <p className="h-display text-4xl tabular-nums text-gold-ink md:text-5xl">{s.value}</p>
              <p className="mt-2 font-semibold">{s.node.label}</p>
              {s.node.detail && <p className="mt-0.5 text-xs text-ink-2">{s.node.detail}</p>}
            </div>
          ))}
        </div>
      );
  }
}
