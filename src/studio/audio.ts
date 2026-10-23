// Ses motorları: (1) cümle bazlı konuşma sentezi + kelime sınırı olayları, (2) Web Audio ile
// prosedürel odak sesleri — harici dosya yok, lisans sorunu yok, çevrimdışı çalışır.
import type { Locale } from '../../shared/types';

export type Ambient = 'off' | 'focus' | 'lofi' | 'nature';
const BCP: Record<Locale, string> = { tr: 'tr-TR', en: 'en-US', ru: 'ru-RU' };

export const ttsSupported = () => typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;

export function voicesFor(locale: Locale): SpeechSynthesisVoice[] {
  if (!ttsSupported()) return [];
  const pre = BCP[locale].slice(0, 2);
  const score = (v: SpeechSynthesisVoice) => (/natural|neural|google|premium|enhanced/i.test(v.name) ? 2 : 0) + (v.lang === BCP[locale] ? 1 : 0) + (v.localService ? 0 : 0.5);
  return speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith(pre)).sort((a, b) => score(b) - score(a));
}

export interface SpeakHandlers { onWord: (charIndex: number) => void; onEnd: () => void; onError: () => void }

/** Tek cümle seslendirir. Uzun metinleri cümlelere bölmek Chrome'un ~15 sn kesme hatasını da önler. */
export function speak(text: string, locale: Locale, rate: number, voice: SpeechSynthesisVoice | null, h: SpeakHandlers) {
  const u = new SpeechSynthesisUtterance(text);
  u.lang = BCP[locale];
  u.rate = rate;
  u.pitch = 1;
  if (voice) u.voice = voice;
  let ended = false;
  u.onboundary = (e) => { if (e.name === 'word' || e.charIndex !== undefined) h.onWord(e.charIndex); };
  u.onend = () => { if (!ended) { ended = true; h.onEnd(); } };
  u.onerror = (e) => { if (!ended && e.error !== 'interrupted' && e.error !== 'canceled') { ended = true; h.onError(); } };
  speechSynthesis.speak(u);
  return () => { ended = true; speechSynthesis.cancel(); };
}

/* ---------------- prosedürel ortam sesleri ---------------- */
function noiseBuffer(ctx: AudioContext, kind: 'brown' | 'pink' | 'white', seconds = 4) {
  const len = ctx.sampleRate * seconds;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0, b0 = 0, b1 = 0, b2 = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    if (kind === 'white') d[i] = w * 0.5;
    else if (kind === 'brown') { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.2; }
    else { b0 = 0.997 * b0 + w * 0.029591; b1 = 0.985 * b1 + w * 0.032534; b2 = 0.95 * b2 + w * 0.048056; d[i] = (b0 + b1 + b2 + w * 0.05) * 0.6; }
  }
  return buf;
}

export class AmbientEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private nodes: AudioNode[] = [];
  private timers: number[] = [];
  private vol = 0.35;
  kind: Ambient = 'off';

  private ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return { ctx: this.ctx, out: this.master! };
  }

  setVolume(v: number) {
    this.vol = v;
    if (this.ctx && this.master && this.kind !== 'off') this.master.gain.setTargetAtTime(v * 0.6, this.ctx.currentTime, 0.2);
  }

  private stopAll() {
    this.timers.forEach((t) => window.clearInterval(t));
    this.timers = [];
    this.nodes.forEach((n) => { try { (n as AudioScheduledSourceNode).stop?.(); } catch { /* zaten durdu */ } n.disconnect(); });
    this.nodes = [];
  }

  play(kind: Ambient) {
    this.kind = kind;
    if (kind === 'off') {
      if (this.ctx && this.master) this.master.gain.setTargetAtTime(0, this.ctx.currentTime, 0.25);
      window.setTimeout(() => { if (this.kind === 'off') this.stopAll(); }, 900);
      return;
    }
    const { ctx, out } = this.ensure();
    this.stopAll();
    const keep = <T extends AudioNode>(n: T) => { this.nodes.push(n); return n; };
    const loopNoise = (k: 'brown' | 'pink' | 'white') => { const s = keep(ctx.createBufferSource()); s.buffer = noiseBuffer(ctx, k); s.loop = true; s.start(); return s; };

    if (kind === 'focus') {
      // Kahverengi gürültü + yumuşak, düşük frekanslı drone (konuşmayı maskelemeyen sakin zemin)
      const n = loopNoise('brown');
      const lp = keep(ctx.createBiquadFilter()); lp.type = 'lowpass'; lp.frequency.value = 420;
      const g = keep(ctx.createGain()); g.gain.value = 0.55;
      n.connect(lp).connect(g).connect(out);
      for (const [f, gv] of [[110, 0.035], [164.8, 0.022], [220.4, 0.012]] as const) {
        const o = keep(ctx.createOscillator()); o.type = 'sine'; o.frequency.value = f;
        const og = keep(ctx.createGain()); og.gain.value = gv;
        const lfo = keep(ctx.createOscillator()); lfo.frequency.value = 0.05 + Math.random() * 0.05;
        const lg = keep(ctx.createGain()); lg.gain.value = gv * 0.6;
        lfo.connect(lg).connect(og.gain); o.connect(og).connect(out); o.start(); lfo.start();
      }
    }

    if (kind === 'lofi') {
      // 72 BPM: sıcak akor pedleri (ii–V–I–vi), yumuşak kick, filtrelenmiş hi-hat, plak cızırtısı
      const lp = keep(ctx.createBiquadFilter()); lp.type = 'lowpass'; lp.frequency.value = 1100; lp.Q.value = 0.4;
      lp.connect(out);
      const crackle = loopNoise('white');
      const hp = keep(ctx.createBiquadFilter()); hp.type = 'highpass'; hp.frequency.value = 3000;
      const cg = keep(ctx.createGain()); cg.gain.value = 0.012;
      crackle.connect(hp).connect(cg).connect(out);
      const chords = [[146.8, 174.6, 220, 261.6], [196, 246.9, 293.7, 349.2], [130.8, 164.8, 196, 246.9], [110, 130.8, 164.8, 196]];
      const beat = 60 / 72;
      let step = 0;
      let next = ctx.currentTime + 0.1;
      const hat = noiseBuffer(ctx, 'white', 0.2);
      const schedule = () => {
        while (next < ctx.currentTime + 0.5) {
          const bar = Math.floor(step / 4) % 4;
          if (step % 4 === 0) {
            for (const f of chords[bar]) {
              const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = f; o.detune.value = (Math.random() - 0.5) * 8;
              const g = ctx.createGain(); g.gain.setValueAtTime(0, next); g.gain.linearRampToValueAtTime(0.035, next + 0.4); g.gain.exponentialRampToValueAtTime(0.001, next + beat * 4);
              o.connect(g).connect(lp); o.start(next); o.stop(next + beat * 4 + 0.1);
            }
          }
          if (step % 2 === 0) {
            const k = ctx.createOscillator(); k.frequency.setValueAtTime(120, next); k.frequency.exponentialRampToValueAtTime(42, next + 0.18);
            const kg = ctx.createGain(); kg.gain.setValueAtTime(0.28, next); kg.gain.exponentialRampToValueAtTime(0.001, next + 0.25);
            k.connect(kg).connect(out); k.start(next); k.stop(next + 0.3);
          }
          const h = ctx.createBufferSource(); h.buffer = hat;
          const hf = ctx.createBiquadFilter(); hf.type = 'highpass'; hf.frequency.value = 7000;
          const hg = ctx.createGain(); hg.gain.setValueAtTime(step % 2 ? 0.05 : 0.025, next + beat / 2); hg.gain.exponentialRampToValueAtTime(0.001, next + beat / 2 + 0.06);
          h.connect(hf).connect(hg).connect(out); h.start(next + beat / 2); h.stop(next + beat / 2 + 0.1);
          next += beat;
          step++;
        }
      };
      schedule();
      this.timers.push(window.setInterval(schedule, 200));
    }

    if (kind === 'nature') {
      // Yağmur (pembe gürültü bant filtresi) + rüzgâr nefesi + seyrek kuş cıvıltıları
      const rain = loopNoise('pink');
      const bp = keep(ctx.createBiquadFilter()); bp.type = 'bandpass'; bp.frequency.value = 1400; bp.Q.value = 0.5;
      const rg = keep(ctx.createGain()); rg.gain.value = 0.5;
      rain.connect(bp).connect(rg).connect(out);
      const wind = loopNoise('brown');
      const wl = keep(ctx.createBiquadFilter()); wl.type = 'lowpass'; wl.frequency.value = 300;
      const wg = keep(ctx.createGain()); wg.gain.value = 0.25;
      const lfo = keep(ctx.createOscillator()); lfo.frequency.value = 0.07;
      const lg = keep(ctx.createGain()); lg.gain.value = 0.18;
      lfo.connect(lg).connect(wg.gain); lfo.start();
      wind.connect(wl).connect(wg).connect(out);
      const chirp = () => {
        if (Math.random() > 0.45) return;
        const t0 = ctx.currentTime + Math.random() * 0.5;
        const n = 2 + Math.floor(Math.random() * 3);
        const base = 2200 + Math.random() * 1600;
        for (let i = 0; i < n; i++) {
          const t = t0 + i * 0.13;
          const o = ctx.createOscillator(); o.type = 'sine';
          o.frequency.setValueAtTime(base, t); o.frequency.exponentialRampToValueAtTime(base * 1.45, t + 0.07);
          const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.03, t + 0.015); g.gain.exponentialRampToValueAtTime(0.0005, t + 0.1);
          o.connect(g).connect(out); o.start(t); o.stop(t + 0.12);
        }
      };
      this.timers.push(window.setInterval(chirp, 1800));
    }
    out.gain.cancelScheduledValues(ctx.currentTime);
    out.gain.setTargetAtTime(this.vol * 0.6, ctx.currentTime, 0.4);
  }

  dispose() {
    this.stopAll();
    void this.ctx?.close();
    this.ctx = null;
  }
}
