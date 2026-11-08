// Kişisel öğrenme yolu motoru — saf fonksiyonlar (sunucu + istemci + test).
// Hedef/tarih/günlük süre → kurs planı; cevaplardan modül ustalığı (aralıklı, güven bantlı);
// "Bugün" yolu (sıradaki tek net adım listesi); ön test → final ile öğrenme kazancı.
// İlke: tahmin yalnız yeterli veriyle ve aralıkla gösterilir; profil yalnız giriş kapısını seçer.

const DAY = 86_400_000;

/* ---------------- tarih yardımcıları (UTC gün) ---------------- */
export const dayKey = (ms: number) => new Date(ms).toISOString().slice(0, 10);
export const dayMs = (key: string) => Date.parse(`${key}T00:00:00Z`);
export const addDays = (key: string, n: number) => dayKey(dayMs(key) + n * DAY);
export const daysBetween = (a: string, b: string) => Math.round((dayMs(b) - dayMs(a)) / DAY);

/* ---------------- ustalık (Beta-Bernoulli, zamanla sönümlenen kanıt) ---------------- */
export interface AnswerEvent { moduleIdx: number; correct: boolean; at: number }
export interface Mastery { n: number; mean: number; lo: number; hi: number }

/** Yarı ömür: 21 gün önceki cevap bugünkünün yarısı kadar kanıttır (unutma eğrisiyle tutarlı). */
export const HALF_LIFE_DAYS = 21;
/** Ustalık bandı için z (%80 aralık). */
const Z = 1.2816;
export const MIN_EVIDENCE = 3;

export function masteryOf(events: { correct: boolean; at: number }[], now = Date.now()): Mastery {
  let a = 1, b = 1;
  for (const e of events) {
    const w = Math.pow(0.5, Math.max(0, now - e.at) / DAY / HALF_LIFE_DAYS);
    if (e.correct) a += w; else b += w;
  }
  const mean = a / (a + b);
  const sd = Math.sqrt((mean * (1 - mean)) / (a + b + 1));
  return { n: events.length, mean, lo: Math.max(0, mean - Z * sd), hi: Math.min(1, mean + Z * sd) };
}

export function moduleMastery(events: AnswerEvent[], moduleCount: number, now = Date.now()): Mastery[] {
  const by: { correct: boolean; at: number }[][] = Array.from({ length: moduleCount }, () => []);
  for (const e of events) if (e.moduleIdx >= 0 && e.moduleIdx < moduleCount) by[e.moduleIdx].push(e);
  return by.map((list) => masteryOf(list, now));
}

/** Kurs ustalığı: yalnız kanıtı olan modüllerin süre ağırlıklı ortalaması; bant varyanslardan. */
export function courseMastery(mods: Mastery[], minutes: number[]): (Mastery & { coverage: number }) | null {
  const seen = mods.map((m, i) => ({ m, w: minutes[i] ?? 1 })).filter((x) => x.m.n >= MIN_EVIDENCE);
  if (!seen.length) return null;
  const W = seen.reduce((s, x) => s + x.w, 0);
  const mean = seen.reduce((s, x) => s + x.m.mean * x.w, 0) / W;
  const varSum = seen.reduce((s, x) => s + Math.pow(((x.m.hi - x.m.lo) / (2 * Z)) * (x.w / W), 2), 0);
  const sd = Math.sqrt(varSum);
  return { n: seen.reduce((s, x) => s + x.m.n, 0), mean, lo: Math.max(0, mean - Z * sd), hi: Math.min(1, mean + Z * sd), coverage: seen.length / mods.length };
}

export type MasteryBand = 'unknown' | 'weak' | 'growing' | 'strong';
export function bandOf(m: Mastery): MasteryBand {
  if (m.n < MIN_EVIDENCE) return 'unknown';
  if (m.mean < 0.6) return 'weak';
  if (m.mean < 0.8) return 'growing';
  return 'strong';
}

/* ---------------- kurs planı ---------------- */
export interface PlanModule { idx: number; minutes: number; completed: boolean; startedSeconds: number }
export interface PlanInput {
  modules: PlanModule[];
  today: string;
  targetDate: string | null;
  minutesPerDay: number;
  finalDone: boolean;
}
export type PlanItem =
  | { kind: 'module'; moduleIdx: number; minutes: number; part: number; parts: number }
  | { kind: 'review'; minutes: number }
  | { kind: 'final'; minutes: number };
export interface PlanDay { day: string; items: PlanItem[]; minutes: number }
export interface Plan {
  days: PlanDay[];
  remainingMinutes: number;
  projectedFinish: string | null;
  daysLeft: number | null;
  /** Hedefe yetişmek için gereken dk/gün (hedef yoksa null). */
  requiredPerDay: number | null;
  status: 'done' | 'no_target' | 'on_track' | 'tight' | 'behind' | 'overdue';
}

/** Okuma süresine görev + quiz + kontrol yükü eklenir (ölçülen tipik oran). */
export const STUDY_OVERHEAD = 1.3;
/** Günlük bütçenin aralıklı tekrara ayrılan payı. */
export const REVIEW_SHARE = 0.15;
const FINAL_MINUTES = 15;
const HORIZON_DAYS = 120;

export function planCourse(p: PlanInput): Plan {
  const budget = Math.max(10, Math.round(p.minutesPerDay));
  const reviewMin = Math.max(5, Math.round(budget * REVIEW_SHARE));
  const studyBudget = budget - reviewMin;
  const queue = p.modules.filter((m) => !m.completed).map((m) => {
    const need = Math.max(5, Math.round(m.minutes * STUDY_OVERHEAD - m.startedSeconds / 60));
    return { idx: m.idx, left: need, parts: Math.max(1, Math.ceil(need / studyBudget)), part: 0 };
  });
  const remainingStudy = queue.reduce((s, q) => s + q.left, 0);
  const needsFinal = !p.finalDone;
  const remainingMinutes = remainingStudy + (needsFinal ? FINAL_MINUTES : 0);
  const daysLeft = p.targetDate ? daysBetween(p.today, p.targetDate) : null;

  if (remainingMinutes === 0 || (!queue.length && !needsFinal)) {
    return { days: [], remainingMinutes: 0, projectedFinish: p.today, daysLeft, requiredPerDay: null, status: 'done' };
  }

  const days: PlanDay[] = [];
  let finalPlaced = !needsFinal;
  for (let d = 0; d < HORIZON_DAYS && (queue.length || !finalPlaced); d++) {
    const day = addDays(p.today, d);
    const items: PlanItem[] = [];
    let free = studyBudget;
    const touchedAny = days.length > 0 || p.modules.some((m) => m.completed || m.startedSeconds > 0);
    if (touchedAny) items.push({ kind: 'review', minutes: reviewMin });
    else free += reviewMin;
    while (free > 0 && queue.length) {
      const q = queue[0];
      const take = Math.min(free, q.left);
      q.left -= take; free -= take; q.part += 1;
      items.push({ kind: 'module', moduleIdx: q.idx, minutes: take, part: q.part, parts: Math.max(q.parts, q.part) });
      if (q.left <= 0) queue.shift();
      if (free < 5) break;
    }
    if (!queue.length && !finalPlaced && free >= 5) { items.push({ kind: 'final', minutes: FINAL_MINUTES }); finalPlaced = true; }
    days.push({ day, items, minutes: items.reduce((s, i) => s + i.minutes, 0) });
  }
  const projectedFinish = days.length ? days[days.length - 1].day : p.today;

  let requiredPerDay: number | null = null;
  let status: Plan['status'] = 'no_target';
  if (daysLeft !== null) {
    if (daysLeft < 0) status = 'overdue';
    else {
      const usable = Math.max(1, daysLeft + 1);
      requiredPerDay = Math.ceil(remainingMinutes / usable / (1 - REVIEW_SHARE));
      const finishGap = daysBetween(projectedFinish, p.targetDate!);
      status = finishGap >= 2 ? 'on_track' : finishGap >= 0 ? 'tight' : 'behind';
    }
  }
  return { days, remainingMinutes, projectedFinish, daysLeft, requiredPerDay, status };
}

/* ---------------- "Bugün" yolu ---------------- */
export interface PathCourse {
  id: number;
  title: string;
  status: 'ready' | 'queued' | 'generating' | 'failed';
  completed: boolean;
  finalPassed: boolean;
  nextModule: { idx: number; title: string; minutes: number } | null;
  plan: Plan | null;
  weakModules: number;
  lastActiveAt: number | null;
}
export type PathStep =
  | { kind: 'review'; due: number; minutes: number }
  | { kind: 'recap'; courseId: number; title: string; weak: number; minutes: number }
  | { kind: 'module'; courseId: number; title: string; moduleIdx: number; moduleTitle: string; minutes: number; reason: 'behind' | 'tight' | 'plan' | 'continue' }
  | { kind: 'final'; courseId: number; title: string; minutes: number };

const URGENCY: Record<Plan['status'], number> = { overdue: 5, behind: 4, tight: 3, on_track: 2, no_target: 1, done: 0 };

/** En çok 4 adım: tekrar → zayıf nokta → plan baskısına göre modüller → final. Tek net yol. */
export function todayPath(courses: PathCourse[], dueReviews: number, max = 4): PathStep[] {
  const steps: PathStep[] = [];
  if (dueReviews > 0) steps.push({ kind: 'review', due: dueReviews, minutes: Math.max(3, Math.ceil(dueReviews * 0.6)) });
  const ready = courses.filter((c) => c.status === 'ready');
  const weak = ready.filter((c) => c.weakModules > 0).sort((a, b) => b.weakModules - a.weakModules)[0];
  if (weak) steps.push({ kind: 'recap', courseId: weak.id, title: weak.title, weak: weak.weakModules, minutes: 8 });
  const active = ready.filter((c) => !c.completed && c.nextModule)
    .sort((a, b) => (URGENCY[b.plan?.status ?? 'no_target'] - URGENCY[a.plan?.status ?? 'no_target']) || ((b.lastActiveAt ?? 0) - (a.lastActiveAt ?? 0)));
  for (const c of active.slice(0, 2)) {
    const today = c.plan?.days[0]?.items.find((i) => i.kind === 'module');
    const st = c.plan?.status;
    steps.push({
      kind: 'module', courseId: c.id, title: c.title, moduleIdx: c.nextModule!.idx, moduleTitle: c.nextModule!.title,
      minutes: today?.minutes ?? Math.min(30, Math.round(c.nextModule!.minutes * STUDY_OVERHEAD)),
      reason: st === 'behind' || st === 'overdue' ? 'behind' : st === 'tight' ? 'tight' : c.plan && st !== 'no_target' ? 'plan' : 'continue',
    });
  }
  const finalReady = ready.find((c) => c.completed && !c.finalPassed);
  if (finalReady) steps.push({ kind: 'final', courseId: finalReady.id, title: finalReady.title, minutes: FINAL_MINUTES });
  return steps.slice(0, max);
}

/* ---------------- zayıf nokta seçimi (karışık tekrar) ---------------- */
export interface RecapCandidate { id: string; moduleIdx: number; lastCorrectAt: number | null }

/** En zayıf modüllerden (kanıtı olan, ortalaması < 0.75) soru seçer; son 24 saatte doğru bilinenleri atlar; modüller arasında sırayla dağıtır. */
export function pickRecap(cands: RecapCandidate[], mastery: Mastery[], n = 8, now = Date.now()): string[] {
  const weakMods = mastery.map((m, i) => ({ i, m })).filter((x) => x.m.n >= MIN_EVIDENCE && x.m.mean < 0.75).sort((a, b) => a.m.mean - b.m.mean).map((x) => x.i);
  if (!weakMods.length) return [];
  const pools = weakMods.map((mi) => cands.filter((c) => c.moduleIdx === mi && !(c.lastCorrectAt && now - c.lastCorrectAt < DAY)));
  const out: string[] = [];
  for (let round = 0; out.length < n && pools.some((p) => p.length); round++) {
    for (const p of pools) { const c = p.shift(); if (c) out.push(c.id); if (out.length >= n) break; }
  }
  return out;
}

export const weakCount = (mastery: Mastery[]) => mastery.filter((m) => bandOf(m) === 'weak').length;

/* ---------------- öğrenme kazancı ---------------- */
/** Normalleştirilmiş kazanç (Hake 1998): g = (son − ön) / (1 − ön). Ön test tam ise tanımsız. */
export function learningGain(pre: number, post: number): number | null {
  if (pre >= 1) return null;
  return (post - pre) / (1 - pre);
}

/** Ön testte kullanılacak soru sayısı (finaldeki ilk N soru ile eşleşir → eşleştirilmiş ölçüm). */
export const PRETEST_SIZE = 6;
