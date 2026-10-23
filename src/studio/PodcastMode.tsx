// Podcast modu — cümle cümle karaoke takibi, kelime akışı sahnesi, hız (0.75/1/1.5), döngü, odak sesleri.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LuPlay, LuPause, LuSkipBack, LuSkipForward, LuRepeat, LuRepeat1, LuMusic, LuVolume2, LuMic } from 'react-icons/lu';
import { useI18n } from '../i18n/index';
import { cx } from '../ui/kit';
import { podcastScript } from '../../shared/engine/generate';
import type { Locale } from '../../shared/types';
import type { SModule } from './types';
import { AmbientEngine, speak, ttsSupported, voicesFor, type Ambient } from './audio';

type Loop = 'off' | 'sentence' | 'module';
const RATES = [0.75, 1, 1.5] as const;

function wordSpans(text: string) {
  const out: { w: string; start: number }[] = [];
  const re = /\S+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) out.push({ w: m[0], start: m.index });
  return out;
}

export default function PodcastMode({ mod, locale, onSection }: { mod: SModule; locale: Locale; onSection: (i: number) => void }) {
  const { t } = useI18n();
  const lines = useMemo(() => podcastScript(mod, locale), [mod, locale]);
  const [idx, setIdx] = useState(0);
  const [word, setWord] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [rate, setRate] = useState<(typeof RATES)[number]>(1);
  const [loop, setLoop] = useState<Loop>('off');
  const [amb, setAmb] = useState<Ambient>('off');
  const [vol, setVol] = useState(0.35);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceName, setVoiceName] = useState<string>('');
  const tts = ttsSupported();
  const cancel = useRef<(() => void) | null>(null);
  const timer = useRef<number | null>(null);
  const boundaryRef = useRef(false);
  const engine = useRef<AmbientEngine | null>(null);
  const listRef = useRef<HTMLOListElement>(null);
  const playRef = useRef<(i: number) => void>(() => {});
  const state = useRef({ idx, playing, loop, rate });
  state.current = { idx, playing, loop, rate };

  useEffect(() => {
    if (!tts) return;
    const load = () => { const v = voicesFor(locale); setVoices(v); setVoiceName((n) => n || v[0]?.name || ''); };
    load();
    speechSynthesis.addEventListener('voiceschanged', load);
    return () => speechSynthesis.removeEventListener('voiceschanged', load);
  }, [locale, tts]);

  const stop = useCallback(() => {
    cancel.current?.(); cancel.current = null;
    if (timer.current) { window.clearInterval(timer.current); timer.current = null; }
  }, []);

  const advance = useCallback(() => {
    const s = state.current;
    if (!s.playing) return;
    if (s.loop === 'sentence') { playRef.current(s.idx); return; }
    if (s.idx + 1 < lines.length) { setIdx(s.idx + 1); state.current.idx = s.idx + 1; playRef.current(s.idx + 1); return; }
    if (s.loop === 'module') { setIdx(0); state.current.idx = 0; playRef.current(0); return; }
    setPlaying(false);
    setWord(-1);
  }, [lines.length]);

  /** Bir cümleyi çalar; kelime sınırı olayı yoksa süreye göre tahmin eder. */
  const play = useCallback((i: number) => {
    stop();
    const line = lines[i];
    if (!line) return;
    const spans = wordSpans(line.text);
    setWord(0);
    boundaryRef.current = false;
    const msPerWord = 60000 / (165 * state.current.rate);
    const startedAt = performance.now();
    timer.current = window.setInterval(() => {
      const el = performance.now() - startedAt;
      if (!boundaryRef.current) setWord(Math.min(spans.length - 1, Math.floor(el / msPerWord)));
      if (!tts && el > spans.length * msPerWord + 250) { stop(); advance(); }
    }, 80);
    if (tts) {
      const voice = voices.find((v) => v.name === voiceName) ?? null;
      cancel.current = speak(line.text, locale, state.current.rate, voice, {
        onWord: (ci) => { boundaryRef.current = true; const w = spans.findIndex((s, k) => ci >= s.start && (k === spans.length - 1 || ci < spans[k + 1].start)); if (w >= 0) setWord(w); },
        onEnd: () => { stop(); advance(); },
        onError: () => { stop(); advance(); },
      });
    }
  }, [lines, locale, voices, voiceName, tts, stop, advance]);
  playRef.current = play;

  useEffect(() => () => { stop(); if (tts) speechSynthesis.cancel(); engine.current?.dispose(); }, [stop, tts]);
  useEffect(() => { const s = lines[idx]?.sectionId; if (s) { const k = mod.sections.findIndex((x) => x.id === s); if (k >= 0) onSection(k); } }, [idx, lines, mod.sections, onSection]);
  useEffect(() => { listRef.current?.querySelector(`[data-i="${idx}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }, [idx]);
  useEffect(() => { if (playing) play(idx); }, [rate, voiceName]); // eslint-disable-line react-hooks/exhaustive-deps

  // Klavye: boşluk oynat/duraklat, ←/→ cümle
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input, textarea, select')) return;
      if (e.code === 'Space') { e.preventDefault(); toggle(); }
      if (e.key === 'ArrowRight') jump(Math.min(lines.length - 1, state.current.idx + 1));
      if (e.key === 'ArrowLeft') jump(Math.max(0, state.current.idx - 1));
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  });

  const toggle = () => {
    if (playing) { setPlaying(false); stop(); setWord(-1); }
    else { setPlaying(true); state.current.playing = true; play(idx); }
  };
  const jump = (i: number) => { setIdx(i); if (playing) play(i); else setWord(-1); };
  const setAmbient = (a: Ambient) => {
    setAmb(a);
    if (!engine.current) engine.current = new AmbientEngine();
    engine.current.setVolume(vol);
    engine.current.play(a);
  };

  const cur = lines[idx];
  const spans = cur ? wordSpans(cur.text) : [];

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      {!tts && <p className="rounded-xl bg-surface-2 p-3 text-sm text-ink-2">{t('p_no_tts')}</p>}

      {/* Kelime akışı sahnesi */}
      <div className="card dotgrid relative overflow-hidden px-6 py-10 md:px-12 md:py-14">
        <div className="absolute left-4 top-4 flex items-center gap-2">
          <span className="chip">{t('p_stage')}</span>
          <span className="flex h-4 items-end gap-0.5" aria-hidden>
            {[0, 1, 2, 3].map((b) => <span key={b} className={cx('w-1 rounded-sm bg-gold', playing ? 'eq-bar' : '')} style={{ height: playing ? `${40 + b * 15}%` : '25%', animationDelay: `${b * 0.12}s` }} />)}
          </span>
        </div>
        <span className="absolute right-4 top-4 text-xs tabular-nums text-ink-3">{t('p_sentence_n', { a: idx + 1, b: lines.length })}</span>
        <p className="mx-auto mt-4 line-clamp-2 max-w-2xl text-center text-sm text-ink-3">{lines[idx - 1]?.text ?? ' '}</p>
        <p className="mx-auto mt-4 max-w-2xl text-center text-2xl font-medium leading-snug md:text-[28px]" aria-live="polite">
          {spans.map((s, i) => (
            <span key={i} className={cx('kw px-0.5', word < 0 ? 'kw-past' : i < word ? 'kw-past' : i === word ? 'kw-now' : 'kw-future')}>{s.w} </span>
          ))}
        </p>
        <p className="mx-auto mt-4 line-clamp-2 max-w-2xl text-center text-sm text-ink-3">{lines[idx + 1]?.text ?? ' '}</p>
      </div>

      {/* Kontroller */}
      <div className="card p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1">
            <button className="btn btn-ghost btn-icon" onClick={() => jump(Math.max(0, idx - 1))} aria-label={t('p_prev')}><LuSkipBack /></button>
            <button className="btn btn-primary h-12 w-12 rounded-full p-0 text-lg" onClick={toggle} aria-label={playing ? t('p_pause') : t('p_play')}>{playing ? <LuPause /> : <LuPlay className="translate-x-px" />}</button>
            <button className="btn btn-ghost btn-icon" onClick={() => jump(Math.min(lines.length - 1, idx + 1))} aria-label={t('p_next')}><LuSkipForward /></button>
          </div>
          <input type="range" min={0} max={lines.length - 1} value={idx} onChange={(e) => jump(Number(e.target.value))} className="min-w-32 flex-1 accent-[var(--c-gold)]" aria-label={t('p_sentence_n', { a: idx + 1, b: lines.length })} />
          <div className="flex items-center gap-2 text-xs text-ink-3">
            <span>{t('p_speed')}</span>
            <div className="seg">{RATES.map((r) => <button key={r} className="!h-7 !px-2.5 !text-xs" aria-pressed={rate === r} onClick={() => setRate(r)}>{r}×</button>)}</div>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-3 border-t border-line pt-3 text-xs text-ink-3">
          <div className="flex items-center gap-2">
            {loop === 'sentence' ? <LuRepeat1 /> : <LuRepeat />}<span>{t('p_loop')}</span>
            <div className="seg">{(['off', 'sentence', 'module'] as const).map((l) => <button key={l} className="!h-7 !px-2.5 !text-xs" aria-pressed={loop === l} onClick={() => setLoop(l)}>{t(`p_loop_${l}`)}</button>)}</div>
          </div>
          <div className="flex items-center gap-2">
            <LuMusic /><span>{t('p_music')}</span>
            <div className="seg">{(['off', 'focus', 'lofi', 'nature'] as const).map((a) => <button key={a} className="!h-7 !px-2.5 !text-xs" aria-pressed={amb === a} onClick={() => setAmbient(a)}>{t(`p_music_${a}`)}</button>)}</div>
          </div>
          <label className="flex items-center gap-2"><LuVolume2 /><span className="sr-only">{t('p_volume')}</span>
            <input type="range" min={0} max={1} step={0.05} value={vol} onChange={(e) => { const v = Number(e.target.value); setVol(v); engine.current?.setVolume(v); }} className="w-24 accent-[var(--c-gold)]" />
          </label>
          {voices.length > 1 && (
            <label className="flex items-center gap-2"><LuMic /><span>{t('p_voice')}</span>
              <select className="input !h-8 !w-44 !text-xs" value={voiceName} onChange={(e) => setVoiceName(e.target.value)}>{voices.map((v) => <option key={v.name} value={v.name}>{v.name}</option>)}</select>
            </label>
          )}
        </div>
      </div>

      {/* Döküm (karaoke) */}
      <div className="card p-2">
        <p className="px-3 pt-2 text-xs font-semibold uppercase tracking-wider text-ink-3">{t('p_transcript')}</p>
        <ol ref={listRef} className="max-h-[22rem] overflow-auto scrollbar-thin p-1">
          {lines.map((l, i) => (
            <li key={l.id} data-i={i}>
              <button onClick={() => jump(i)} className={cx('w-full rounded-lg px-3 py-1.5 text-left text-[15px] leading-relaxed transition-colors',
                i === idx ? 'bg-gold-soft text-ink' : i < idx ? 'text-ink-2 hover:bg-surface-2' : 'text-ink-3 hover:bg-surface-2',
                l.kind === 'box' && 'italic', l.kind === 'intro' || l.kind === 'recap' ? 'font-medium' : '')}>
                {l.text}
              </button>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
