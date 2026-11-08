// Görsel ders oynatıcısı — kısa, anlatımlı video gibi akar:
// sesli anlatım + altyazı (kelime takibi) · cümleyle eşzamanlı açılan şema · bölüm listesi · hız · kaldığın yerden devam ·
// her bölüm sonunda cevaplanmadan geçilmeyen geri çağırma sorusu. Ses yoksa okuma hızında sessiz akar.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LuPlay, LuPause, LuSkipBack, LuSkipForward, LuCaptions, LuListVideo, LuGauge, LuRotateCcw, LuMaximize, LuMinimize, LuX, LuKey, LuLock } from 'react-icons/lu';
import { trpc, errCode } from '../lib/trpc';
import { useErr, useI18n } from '../i18n/index';
import { ErrorBox, Spinner, cx } from '../ui/kit';
import type { Locale } from '../../shared/types';
import { chaptersOf, partsOf, readSeconds, shownAt, type Scene } from '../../shared/engine/lesson';
import { speak, ttsSupported, voicesFor } from './audio';
import LessonDiagram from './LessonDiagram';
import Check from './Check';
import type { SModule, View } from './types';

const RATES = [0.85, 1, 1.25] as const;
const store = {
  get(k: string): number | null { try { const v = localStorage.getItem(k); return v === null ? null : Number(v); } catch { return null; } },
  set(k: string, v: number) { try { localStorage.setItem(k, String(v)); } catch { /* gizli pencere */ } },
};

/** Cümledeki kelime başlangıçları (altyazı kelime takibi için). */
const wordSpans = (s: string) => { const out: { w: string; start: number }[] = []; const re = /\S+/g; let m; while ((m = re.exec(s))) out.push({ w: m[0], start: m.index }); return out; };

export default function LessonPlayer({ courseId, view, mod, moduleIdx, locale, onSection }: { courseId: number; view: View; mod: SModule; moduleIdx: number; locale: Locale; onSection: (i: number) => void }) {
  const { t } = useI18n();
  const err = useErr();
  const q = trpc.learn.lesson.useQuery({ courseId, moduleIdx, locale }, { staleTime: Infinity, retry: 1 });
  const lesson = q.data;
  const key = `ah:lesson:${courseId}:${moduleIdx}:${locale}`;

  const [si, setSi] = useState(0);            // sahne
  const [li, setLi] = useState(0);            // cümle
  const [word, setWord] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [started, setStarted] = useState<Set<string>>(() => new Set());
  const [rate, setRate] = useState<number>(() => store.get('ah:lesson:rate') ?? 1);
  const [cc, setCc] = useState(true);
  const [toc, setToc] = useState(false);
  const [fs, setFs] = useState(false);
  const [solved, setSolved] = useState<Set<string>>(() => new Set());
  const [resumeAt, setResumeAt] = useState<number | null>(null);
  const [voice, setVoice] = useState<SpeechSynthesisVoice | null>(null);
  const [mute, setMute] = useState(!ttsSupported());
  const stage = useRef<HTMLDivElement>(null);
  const wasPlaying = useRef(false);

  const scenes = lesson?.scenes ?? [];
  const scene: Scene | undefined = scenes[si];
  const chapters = useMemo(() => (lesson ? chaptersOf(lesson) : []), [lesson]);
  const chapterTitle = (c: { sectionIdx: number; title: string }) => (c.sectionIdx >= 0 ? mod.sections[c.sectionIdx]?.heading ?? c.title : c.title);
  const itemOf = useCallback((id: string) => mod.sections.find((s) => s.check?.id === id)?.check, [mod]);
  const isSolved = (s: Scene | undefined) => !s || s.kind !== 'check' || solved.has(s.itemId) || view.checks[s.itemId] !== undefined;

  // Ses: tarayıcı sesleri geç yüklenir
  useEffect(() => {
    if (!ttsSupported()) return;
    const pick = () => setVoice(voicesFor(locale)[0] ?? null);
    pick();
    speechSynthesis.addEventListener('voiceschanged', pick);
    return () => { speechSynthesis.removeEventListener('voiceschanged', pick); speechSynthesis.cancel(); };
  }, [locale]);

  // Kaldığın yer
  useEffect(() => {
    if (!lesson) return;
    const at = store.get(key);
    if (at !== null && at > 0 && at < lesson.scenes.length) setResumeAt(at);
  }, [lesson, key]);
  useEffect(() => { if (lesson && si > 0) store.set(key, si); }, [si, lesson, key]);
  useEffect(() => { if (scene && scene.sectionIdx >= 0) onSection(scene.sectionIdx); }, [scene, onSection]);

  const goScene = useCallback((k: number) => {
    if (!lesson) return;
    const n = Math.max(0, Math.min(lesson.scenes.length - 1, k));
    // Soru kapısı: cevaplanmamış sorunun ötesine atlanmaz
    for (let j = si; j < n; j++) if (!isSolved(lesson.scenes[j])) { setSi(j); setLi(0); setWord(-1); return; }
    if (ttsSupported()) speechSynthesis.cancel();
    setSi(n); setLi(0); setWord(-1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lesson, si, solved, view.checks]);

  // Akış motoru: cümle seslendir → bitince sonraki cümle/sahne
  useEffect(() => {
    if (!playing || !scene) return;
    if (scene.kind === 'check') { wasPlaying.current = true; setPlaying(false); return; }
    setStarted((s) => (s.has(scene.id) ? s : new Set(s).add(scene.id)));
    const text = scene.narration[li];
    let stop = () => {};
    let timer = 0;
    let done = false;
    const advance = () => {
      if (done) return;
      done = true;
      timer = window.setTimeout(() => {
        setWord(-1);
        if (li + 1 < scene.narration.length) setLi(li + 1);
        else if (si + 1 < scenes.length) { setSi(si + 1); setLi(0); }
        else { setPlaying(false); store.set(key, 0); }
      }, li + 1 < scene.narration.length ? 280 : 900);
    };
    const silent = () => { timer = window.setTimeout(advance, readSeconds(text, rate) * 1000); };
    if (mute || !ttsSupported()) silent();
    else {
      const spans = wordSpans(text);
      stop = speak(text, locale, rate, voice, {
        onWord: (ci) => { const w = spans.findIndex((s, k) => ci >= s.start && (k === spans.length - 1 || ci < spans[k + 1].start)); if (w >= 0) setWord(w); },
        onEnd: advance,
        onError: () => { setMute(true); silent(); },
      });
    }
    return () => { done = true; window.clearTimeout(timer); stop(); };
  }, [playing, scene, li, si, scenes.length, rate, mute, voice, locale, key]);

  // Tam ekran + klavye
  useEffect(() => {
    const on = () => setFs(document.fullscreenElement === stage.current);
    document.addEventListener('fullscreenchange', on);
    return () => document.removeEventListener('fullscreenchange', on);
  }, []);
  const toggleFs = useCallback(async () => {
    try { if (document.fullscreenElement) await document.exitFullscreen(); else await stage.current?.requestFullscreen(); } catch { /* reddedildi */ }
  }, []);
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input, textarea, select, button, [contenteditable]')) return;
      if (e.key === ' ' || e.key === 'k') { e.preventDefault(); setPlaying((p) => !p); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); goScene(si + 1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); goScene(si - 1); }
      else if (e.key.toLowerCase() === 'c') setCc((x) => !x);
      else if (e.key.toLowerCase() === 'f') void toggleFs();
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, [si, goScene, toggleFs]);

  if (q.error) return <ErrorBox>{err(errCode(q.error))}</ErrorBox>;
  if (!lesson || !scene) {
    return (
      <div className="card grid aspect-video place-items-center p-8 text-center">
        <div><Spinner className="mx-auto h-7 w-7" /><p className="mt-4 text-ink-2">{t('l_loading')}</p></div>
      </div>
    );
  }

  const total = scenes.length;
  const teach = scene.kind === 'teach' ? scene : null;
  const parts = teach ? partsOf(teach.diagram) : 0;
  const reveal = teach ? (started.has(teach.id) ? shownAt(li, teach.narration.length, parts) : parts) : 0;
  const line = teach?.narration[li] ?? '';
  const lastLine = teach ? li === teach.narration.length - 1 || !started.has(teach.id) : false;
  const gate = !isSolved(scene);
  const chapIdx = chapters.reduce((a, c, k) => (c.start <= si ? k : a), 0);
  const item = scene.kind === 'check' ? itemOf(scene.itemId) : undefined;
  const ended = !playing && si === total - 1 && started.has(scene.id) && lastLine;

  return (
    <div className="space-y-3">
      {resumeAt !== null && (
        <div className="anim-pop flex flex-wrap items-center gap-3 rounded-[14px] border border-line bg-surface px-4 py-3 text-sm">
          <LuRotateCcw className="text-brand" aria-hidden />
          <span className="flex-1">{t('l_resume_q')}</span>
          <button className="btn btn-primary btn-sm" onClick={() => { setSi(resumeAt); setLi(0); setResumeAt(null); }}>{t('l_resume')}</button>
          <button className="btn btn-ghost btn-sm" onClick={() => { setResumeAt(null); store.set(key, 0); }}>{t('l_from_start')}</button>
        </div>
      )}

      <div ref={stage} className={cx('overflow-hidden rounded-[18px] border border-line bg-surface', fs && 'flex h-full flex-col rounded-none border-0')}>
        {/* Sahne */}
        <div className={cx('dotgrid @container relative flex flex-col', fs ? 'flex-1 overflow-auto' : 'min-h-[420px] md:min-h-[500px]')}>
          <div className="flex items-start justify-between gap-3 px-5 pt-4 md:px-8 md:pt-6">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gold-ink">{chapterTitle(chapters[chapIdx] ?? { sectionIdx: -1, title: '' })}</p>
              <h2 className="h-display mt-1 text-xl md:text-2xl">{teach ? teach.title : t('l_check_title')}</h2>
            </div>
            <span className="shrink-0 rounded-full border border-line bg-surface px-2.5 py-1 text-[11px] tabular-nums text-ink-3">{si + 1}/{total}</span>
          </div>

          <div key={scene.id} className="anim-fade flex flex-1 flex-col justify-center px-5 py-4 md:px-8">
            {teach ? (
              <LessonDiagram d={teach.diagram} shown={reveal} />
            ) : item ? (
              <div className="mx-auto w-full max-w-xl">
                <Check courseId={courseId} item={item} answered={view.checks[item.id] !== undefined} compact
                  onResult={() => { setSolved((s) => new Set(s).add(item.id)); if (wasPlaying.current) window.setTimeout(() => { wasPlaying.current = false; setSi((x) => Math.min(total - 1, x + 1)); setLi(0); setPlaying(true); }, 2400); }} />
              </div>
            ) : (
              <p className="text-center text-ink-3">—</p>
            )}
            {teach?.takeaway && lastLine && (
              <p className="anim-rise mx-auto mt-4 flex max-w-2xl items-start gap-2 rounded-xl bg-gold-soft px-4 py-2.5 text-sm text-gold-ink">
                <LuKey className="mt-0.5 shrink-0" aria-hidden /><span><strong>{t('l_takeaway')}:</strong> {teach.takeaway}</span>
              </p>
            )}
          </div>

          {/* Altyazı */}
          {teach && cc && (
            <div className="px-5 pb-4 md:px-8">
              <p className="mx-auto max-w-3xl rounded-xl bg-night px-4 py-2.5 text-center text-[15px] leading-relaxed text-on-night md:text-base" aria-live="polite">
                {wordSpans(line).map((w, k) => <span key={k} className={cx('transition-colors', k === word ? 'text-on-night-gold' : k < word ? 'text-on-night' : 'text-on-night-2')}>{w.w} </span>)}
              </p>
            </div>
          )}

          {ended && (
            <div className="anim-fade absolute inset-0 grid place-items-center bg-night/50">
              <div className="card anim-pop max-w-sm p-6 text-center">
                <p className="h-display text-xl">{t('l_end')}</p>
                <p className="mt-2 text-sm text-ink-2">{t('l_end_hint')}</p>
                <button className="btn btn-outline btn-sm mt-4" onClick={() => { setSi(0); setLi(0); setStarted(new Set()); store.set(key, 0); }}><LuRotateCcw /> {t('l_replay')}</button>
              </div>
            </div>
          )}
        </div>

        {/* İlerleme çubuğu: sahne başına bir dilim, sorular altın nokta */}
        <div className="flex h-2 gap-px bg-line" role="progressbar" aria-valuemin={1} aria-valuemax={total} aria-valuenow={si + 1}>
          {scenes.map((s, k) => (
            <button key={s.id} className={cx('h-full flex-1 transition-colors', k < si ? 'bg-brand' : k === si ? 'bg-gold' : s.kind === 'check' ? 'bg-gold-soft' : 'bg-surface-2')}
              onClick={() => goScene(k)} aria-label={`${k + 1}`} title={s.kind === 'teach' ? s.title : t('l_check_title')} />
          ))}
        </div>

        {/* Denetimler */}
        <div className="flex flex-wrap items-center gap-1.5 border-t border-line px-3 py-2">
          <button className="btn btn-ghost btn-icon" onClick={() => goScene(si - 1)} disabled={si === 0} aria-label={t('l_prev')}><LuSkipBack /></button>
          <button className="btn btn-primary btn-icon" onClick={() => setPlaying((p) => !p)} disabled={gate} aria-label={playing ? t('l_pause') : t('l_play')}>{playing ? <LuPause /> : <LuPlay />}</button>
          <button className="btn btn-ghost btn-icon" onClick={() => goScene(si + 1)} disabled={si === total - 1 || gate} aria-label={t('l_next')}><LuSkipForward /></button>
          {gate ? <span className="ml-1 flex items-center gap-1.5 text-xs text-ink-2"><LuLock aria-hidden /> {t('l_gate')}</span>
            : mute && <span className="ml-1 hidden text-xs text-ink-3 sm:inline">{t('l_silent')}</span>}
          <span className="flex-1" />
          <div className="seg" aria-label={t('l_speed')}>
            <span className="hidden px-1.5 text-ink-3 sm:inline-flex"><LuGauge aria-hidden /></span>
            {RATES.map((r) => <button key={r} className="!h-7 !px-2 !text-xs tabular-nums" aria-pressed={rate === r} onClick={() => { setRate(r); store.set('ah:lesson:rate', r); }}>{r}×</button>)}
          </div>
          <button className={cx('btn btn-icon', cc ? 'btn-outline' : 'btn-ghost')} onClick={() => setCc((x) => !x)} aria-pressed={cc} aria-label={t('l_captions')}><LuCaptions /></button>
          <button className={cx('btn btn-icon', toc ? 'btn-outline' : 'btn-ghost')} onClick={() => setToc((x) => !x)} aria-pressed={toc} aria-label={t('l_chapters')}><LuListVideo /></button>
          <button className="btn btn-ghost btn-icon" onClick={() => void toggleFs()} aria-label={t('l_fullscreen')}>{fs ? <LuMinimize /> : <LuMaximize />}</button>
        </div>
      </div>

      {toc && (
        <div className="card anim-pop p-2">
          <div className="flex items-center justify-between px-2 py-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-3">{t('l_chapters')}</p>
            <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setToc(false)} aria-label={t('close')}><LuX /></button>
          </div>
          <ol>
            {chapters.map((c, k) => (
              <li key={c.start}>
                <button className={cx('flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-surface-2', k === chapIdx && 'bg-surface-2 font-semibold')} onClick={() => { goScene(c.start); setToc(false); }}>
                  <span className="w-5 text-right tabular-nums text-ink-3">{k + 1}</span><span className="flex-1">{chapterTitle(c)}</span>
                </button>
              </li>
            ))}
          </ol>
        </div>
      )}

      {lesson.source === 'template' && <p className="px-1 text-xs text-ink-3">{t('l_template_note')}</p>}
    </div>
  );
}
