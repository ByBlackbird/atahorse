// Okuma modu — işaretleme (süre/bölüm/kelime çipleri, hedefler, içindekiler), ikili kodlama
// (analitik + bütüncül kutu + şema), çözümlü örnek ve bölüm sonu anlık pekiştirme (pop-up).
import { useEffect, useMemo, useRef, useState } from 'react';
import { LuClock, LuLayers, LuType, LuTarget, LuListTree, LuLightbulb, LuSigma, LuSparkle, LuX } from 'react-icons/lu';
import { useI18n } from '../i18n/index';
import { cx } from '../ui/kit';
import { PROFILES } from '../../shared/engine/profiles';
import type { ProfileKey } from '../../shared/types';
import type { SModule, SSection, View } from './types';
import Figure from './Figure';
import Check from './Check';

const words = (s: string) => (s.trim().match(/\S+/g) || []).length;

function Boxes({ s, order }: { s: SSection; order: readonly ('analytic' | 'holistic')[] }) {
  const boxes = {
    analytic: (
      <div key="a" className="rounded-[14px] border border-line bg-surface p-5">
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-brand"><LuSigma /> {s.analytic.title}</p>
        <ul className="mt-3 space-y-2 text-[15px] leading-relaxed">
          {s.analytic.points.map((p, i) => <li key={i} className="flex gap-2.5"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />{p}</li>)}
        </ul>
      </div>
    ),
    holistic: (
      <div key="h" className="rounded-[14px] border border-gold/40 bg-gold-soft p-5">
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-gold-ink"><LuSparkle /> {s.holistic.title}</p>
        <p className="mt-3 text-[15px] leading-relaxed">{s.holistic.text}</p>
      </div>
    ),
  };
  return <div className="grid gap-3 md:grid-cols-2">{order.map((k) => boxes[k])}</div>;
}

export default function ReadingMode({ view, mod, onSection, onCheck }: { view: View; mod: SModule; onSection: (i: number) => void; onCheck: (ok: boolean) => void }) {
  const { t } = useI18n();
  const order = PROFILES[view.course.profileKey as ProfileKey]?.boxOrder ?? ['analytic', 'holistic'];
  const total = useMemo(() => mod.sections.reduce((n, s) => n + words(s.paragraphs.join(' ')) + words(s.holistic.text) + words(s.analytic.points.join(' ')), 0), [mod]);
  const [active, setActive] = useState(0);
  const [popup, setPopup] = useState<number | null>(null);
  const seen = useRef(new Set<number>());
  const refs = useRef<(HTMLElement | null)[]>([]);
  const ends = useRef<(HTMLDivElement | null)[]>([]);

  // İçindekiler için kaydırma izleme
  useEffect(() => {
    const io = new IntersectionObserver((es) => {
      for (const e of es) if (e.isIntersecting) { const i = Number((e.target as HTMLElement).dataset.idx); setActive(i); onSection(i); }
    }, { rootMargin: '-35% 0px -55% 0px' });
    refs.current.forEach((r) => r && io.observe(r));
    return () => io.disconnect();
  }, [mod, onSection]);

  // Bölüm sonuna gelince anlık pekiştirme pop-up'ı (cevaplanmamışsa, bir kez)
  useEffect(() => {
    const io = new IntersectionObserver((es) => {
      for (const e of es) {
        const i = Number((e.target as HTMLElement).dataset.idx);
        const c = mod.sections[i]?.check;
        if (e.isIntersecting && c && !view.checks[c.id] && !seen.current.has(i)) { seen.current.add(i); setPopup(i); }
      }
    }, { threshold: 1 });
    ends.current.forEach((r) => r && io.observe(r));
    return () => io.disconnect();
  }, [mod, view.checks]);

  const popupItem = popup !== null ? mod.sections[popup]?.check : undefined;

  return (
    <article className="mx-auto max-w-3xl">
      <div className="flex flex-wrap gap-2">
        <span className="chip"><LuClock /> {t('s_chip_min', { n: mod.minutes })}</span>
        <span className="chip"><LuLayers /> {t('s_chip_sec', { n: mod.sections.length })}</span>
        <span className="chip"><LuType /> {t('s_chip_words', { n: total })}</span>
      </div>
      <h1 className="h-display mt-4 text-3xl md:text-4xl">{mod.title}</h1>
      <p className="mt-3 text-lg leading-relaxed text-ink-2">{mod.summary}</p>

      <div className="mt-6 grid gap-3 md:grid-cols-[1.2fr_1fr]">
        <div className="card p-5">
          <p className="flex items-center gap-1.5 text-sm font-semibold"><LuTarget className="text-gold" /> {t('s_objectives')}</p>
          <ul className="mt-3 space-y-2 text-sm">{mod.objectives.map((o, i) => <li key={i} className="flex gap-2"><span className="text-ink-3">{i + 1}.</span>{o}</li>)}</ul>
        </div>
        <nav className="card p-5" aria-label={t('s_toc')}>
          <p className="flex items-center gap-1.5 text-sm font-semibold"><LuListTree className="text-brand" /> {t('s_toc')}</p>
          <ol className="mt-3 space-y-1 text-sm">
            {mod.sections.map((s, i) => (
              <li key={s.id}>
                <button className={cx('w-full rounded-lg px-2 py-1 text-left transition-colors hover:bg-surface-2', active === i && 'bg-surface-2 font-semibold')}
                  onClick={() => refs.current[i]?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
                  <span className="mr-1.5 text-ink-3">{i + 1}</span>{s.heading}{s.check && view.checks[s.check.id] ? ' ✓' : ''}
                </button>
              </li>
            ))}
          </ol>
        </nav>
      </div>

      {mod.sections.map((s, i) => (
        <section key={s.id} ref={(el) => { refs.current[i] = el; }} data-idx={i} className="scroll-mt-40 pt-12">
          <p className="eyebrow">{String(i + 1).padStart(2, '0')}</p>
          <h2 className="h-display mt-2 text-2xl">{s.heading}</h2>
          <div className="prose-learn mt-4">{s.paragraphs.map((p, j) => <p key={j}>{p}</p>)}</div>
          <div className="mt-6"><Boxes s={s} order={order} /></div>
          {s.example && (
            <div className="mt-4 rounded-[14px] border border-line bg-surface-2 p-5">
              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-ink-2"><LuLightbulb /> {t('s_example')}</p>
              <p className="mt-2 text-[15px] leading-relaxed">{s.example}</p>
            </div>
          )}
          {s.visual && <div className="mt-4"><Figure v={s.visual} /></div>}
          <div ref={(el) => { ends.current[i] = el; }} data-idx={i} className="h-px" />
          {s.check && <div className="mt-6"><Check courseId={view.course.id} item={s.check} answered={view.checks[s.check.id] !== undefined} onResult={onCheck} /></div>}
        </section>
      ))}

      <div className="mt-12 rounded-[14px] border border-line bg-surface p-5">
        <p className="text-sm font-semibold">{t('s_keypoints')}</p>
        <ul className="mt-3 space-y-2">{mod.keyPoints.map((k, i) => <li key={i} className="flex gap-2.5 text-[15px]"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />{k}</li>)}</ul>
      </div>

      {popupItem && popup !== null && (
        <div className="fixed inset-x-3 bottom-20 z-[60] mx-auto max-w-lg md:bottom-6 anim-rise" role="dialog" aria-label={t('s_check')}>
          <div className="relative rounded-[16px] bg-bg">
            <button className="btn btn-ghost btn-icon absolute right-2 top-2 z-10" onClick={() => setPopup(null)} aria-label={t('close')}><LuX /></button>
            <Check courseId={view.course.id} item={popupItem} compact onResult={(ok) => { onCheck(ok); window.setTimeout(() => setPopup(null), 2600); }} />
          </div>
        </div>
      )}
    </article>
  );
}
