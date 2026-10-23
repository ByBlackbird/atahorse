// Slayt stüdyosu — ray (küçük resimler) · sahne (16:9, canlı 3D) · panel (konuşmacı notu).
// Yön tuşları, boşluk, Home/End; F tam ekran; N not paneli; Esc çıkış.
import { useCallback, useEffect, useRef, useState } from 'react';
import { LuChevronLeft, LuChevronRight, LuMaximize, LuMinimize, LuStickyNote, LuSparkles, LuX } from 'react-icons/lu';
import { useI18n } from '../i18n/index';
import { useTheme } from '../ui/providers';
import { cx } from '../ui/kit';
import type { SSlide } from './types';
import Scene3D from './Scene3D';

function SlideFace({ s, n, total, themeKey, big }: { s: SSlide; n: number; total: number; themeKey: string; big?: boolean }) {
  return (
    <div className="grid h-full w-full grid-cols-1 bg-surface md:grid-cols-[1.05fr_1fr]">
      <div className={cx('flex min-h-0 flex-col', big ? 'p-[4.5%]' : 'p-6 md:p-8')}>
        <p className={cx('font-semibold uppercase tracking-[0.18em] text-gold-ink', big ? 'text-[1.1vw]' : 'text-[11px]')}>{s.kicker}</p>
        <h2 className={cx('h-display mt-3', big ? 'text-[2.8vw]' : 'text-2xl md:text-[28px]')}>{s.title}</h2>
        <ul className={cx('mt-5 space-y-3', big ? 'text-[1.45vw]' : 'text-[15px] md:text-base')}>
          {s.bullets.map((b, i) => <li key={i} className="flex gap-3"><span className={cx('mt-[0.55em] shrink-0 rounded-full bg-brand', big ? 'h-[0.5vw] w-[0.5vw]' : 'h-1.5 w-1.5')} />{b}</li>)}
        </ul>
        <p className={cx('mt-auto border-l-2 border-gold pl-4 italic text-ink-2', big ? 'text-[1.2vw]' : 'pt-5 text-sm')}>{s.highlight}</p>
        <p className={cx('mt-4 tabular-nums text-ink-3', big ? 'text-[0.9vw]' : 'text-xs')}>{n}/{total}</p>
      </div>
      <div className="dotgrid relative min-h-[240px] border-t border-line md:min-h-0 md:border-l md:border-t-0">
        <Scene3D visual={s.visual} themeKey={themeKey} className="absolute inset-0" />
        <span className={cx('absolute bottom-3 left-3 rounded-full border border-line bg-surface px-2.5 py-1 text-ink-3', big ? 'text-[0.85vw]' : 'text-[11px]')}>{s.visual.title}</span>
      </div>
    </div>
  );
}

export default function SlideMode({ slides, isAiDeck, onExitAiDeck, onSection }: { slides: SSlide[]; isAiDeck: boolean; onExitAiDeck: () => void; onSection: (i: number) => void }) {
  const { t } = useI18n();
  const { theme } = useTheme();
  const [i, setI] = useState(0);
  const [fs, setFs] = useState(false);
  const [notes, setNotes] = useState(true);
  const stage = useRef<HTMLDivElement>(null);
  const rail = useRef<HTMLDivElement>(null);
  const total = slides.length;
  const go = useCallback((k: number) => setI(Math.max(0, Math.min(total - 1, k))), [total]);

  useEffect(() => {
    const m = /-s(\d+)$/.exec(slides[i]?.id ?? '');
    if (m) onSection(Number(m[1]));
    rail.current?.querySelector(`[data-i="${i}"]`)?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
  }, [i, slides, onSection]);

  useEffect(() => {
    const on = () => setFs(document.fullscreenElement === stage.current);
    document.addEventListener('fullscreenchange', on);
    return () => document.removeEventListener('fullscreenchange', on);
  }, []);

  const toggleFs = useCallback(async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await stage.current?.requestFullscreen();
    } catch { /* tarayıcı reddetti */ }
  }, []);

  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input, textarea, select, [contenteditable]')) return;
      if (['ArrowRight', 'PageDown', ' '].includes(e.key)) { e.preventDefault(); go(i + 1); }
      else if (['ArrowLeft', 'PageUp'].includes(e.key)) { e.preventDefault(); go(i - 1); }
      else if (e.key === 'Home') go(0);
      else if (e.key === 'End') go(total - 1);
      else if (e.key.toLowerCase() === 'f') void toggleFs();
      else if (e.key.toLowerCase() === 'n') setNotes((x) => !x);
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, [i, go, total, toggleFs]);

  const s = slides[i];
  if (!s) return null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className={cx('chip', isAiDeck && 'chip-brand')}>{isAiDeck && <LuSparkles />}{isAiDeck ? t('sl_ai_deck') : t('sl_module_deck')}</span>
        {isAiDeck && <button className="btn btn-ghost btn-sm" onClick={onExitAiDeck}><LuX /> {t('sl_module_deck')}</button>}
        <span className="ml-auto hidden text-xs text-ink-3 md:inline">{t('sl_keys')}</span>
        <button className={cx('btn btn-sm', notes ? 'btn-outline' : 'btn-ghost')} onClick={() => setNotes((x) => !x)}><LuStickyNote /> {t('sl_notes')}</button>
        <button className="btn btn-outline btn-sm" onClick={toggleFs}><LuMaximize /> {t('sl_fullscreen')}</button>
      </div>

      <div className="@container">
      <div className={cx('grid gap-4', notes ? '@5xl:grid-cols-[150px_minmax(0,1fr)_270px]' : '@5xl:grid-cols-[150px_minmax(0,1fr)]')}>
        {/* Ray */}
        <div ref={rail} className="order-2 flex gap-2 overflow-x-auto scrollbar-thin pb-1 @5xl:order-none @5xl:max-h-[70vh] @5xl:flex-col @5xl:overflow-y-auto @5xl:overflow-x-visible @5xl:pb-0">
          {slides.map((x, k) => (
            <button key={x.id} data-i={k} onClick={() => go(k)} aria-current={k === i}
              className={cx('w-36 shrink-0 rounded-xl border bg-surface p-2.5 text-left transition-colors @5xl:w-full', k === i ? 'border-brand ring-1 ring-brand' : 'border-line hover:border-line-strong')}>
              <span className="text-[10px] tabular-nums text-ink-3">{k + 1}</span>
              <span className="mt-0.5 line-clamp-2 block text-xs font-medium">{x.title}</span>
            </button>
          ))}
        </div>

        {/* Sahne */}
        <div className="min-w-0">
          <div ref={stage} className={cx('relative overflow-hidden rounded-[14px] border border-line bg-surface', fs ? 'flex items-center justify-center !rounded-none !border-0 bg-bg' : 'md:aspect-video')}>
            <div className={cx(fs ? 'aspect-video w-[min(100vw,177.78vh)]' : 'h-full w-full')}>
              <SlideFace key={s.id} s={s} n={i + 1} total={total} themeKey={theme} big={fs} />
            </div>
            {fs && (
              <>
                <button className="btn btn-outline btn-sm absolute right-4 top-4" onClick={toggleFs}><LuMinimize /> {t('sl_exit')}</button>
                {notes && <div className="absolute bottom-4 left-1/2 max-w-3xl -translate-x-1/2 rounded-xl border border-line bg-surface/95 px-5 py-3 text-sm text-ink-2">{s.notes}</div>}
              </>
            )}
          </div>
          <div className="mt-3 flex items-center justify-between">
            <button className="btn btn-outline btn-sm" onClick={() => go(i - 1)} disabled={i === 0}><LuChevronLeft /> {t('back')}</button>
            <span className="text-sm tabular-nums text-ink-3">{t('sl_n', { a: i + 1, b: total })}</span>
            <button className="btn btn-primary btn-sm" onClick={() => go(i + 1)} disabled={i === total - 1}>{t('next')} <LuChevronRight /></button>
          </div>
        </div>

        {/* Panel */}
        {notes && (
          <aside className="order-3 grid gap-3 @2xl:grid-cols-2 @5xl:order-none @5xl:block @5xl:space-y-3">
            <div className="card p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-ink-3">{t('sl_notes')}</p>
              <p className="mt-2 text-sm leading-relaxed">{s.notes}</p>
            </div>
            <div className="rounded-[14px] border border-gold/40 bg-gold-soft p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-gold-ink">{t('sl_highlight')}</p>
              <p className="mt-2 text-sm">{s.highlight}</p>
            </div>
          </aside>
        )}
      </div>
      </div>
    </div>
  );
}
