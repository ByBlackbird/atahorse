// Bilişsel profil, kişisel panel özeti ve ayarlar.
import { and, count, desc, eq, isNotNull, sql } from 'drizzle-orm';
import { db } from '../db/client';
import { activityDays, checkAnswers, cognitiveProfiles, courses, methodStats, modeUsage, moduleProgress, users } from '../db/schema';
import { PROFILE_TEST, PROFILES, scoreProfile, type ProfileAnswer } from '../../shared/engine/profiles';
import { METHODS } from '../../shared/engine/methods';
import { levelFromXp } from '../../shared/engine/gamification';
import { PlanPrefs, type Locale } from '../../shared/types';
import { AppError, listCourses } from './courses';
import { activityHeatmap, badgeBoard } from './gamification';
import { dueCount, myCertificates } from './learning';
import type { User } from './auth';

export async function saveProfileTest(user: User, answers: Record<string, string>) {
  const list: ProfileAnswer[] = [];
  for (const q of PROFILE_TEST) {
    const v = answers[q.id];
    if (!v) continue;
    if (!q.options.some((o) => o.value === v)) throw new AppError('bad_answers');
    list.push({ axis: q.axis, value: v as ProfileAnswer['value'] });
  }
  if (list.filter((a) => a.axis === 'modality').length < 3 || list.filter((a) => a.axis === 'reasoning').length < 3) throw new AppError('bad_answers');
  const r = scoreProfile(list);
  await db.insert(cognitiveProfiles).values({ userId: user.id, modality: r.modality, reasoning: r.reasoning, profileKey: r.key, scores: r.scores, updatedAt: Date.now() })
    .onConflictDoUpdate({ target: cognitiveProfiles.userId, set: { modality: r.modality, reasoning: r.reasoning, profileKey: r.key, scores: r.scores, updatedAt: Date.now() } }).run();
  await db.update(users).set({ onboardedAt: sql`coalesce(${users.onboardedAt}, ${Date.now()})` }).where(eq(users.id, user.id)).run();
  return r;
}

export async function getCognitive(userId: number) {
  const p = await db.select().from(cognitiveProfiles).where(eq(cognitiveProfiles.userId, userId)).get();
  const stats = await db.select().from(methodStats).where(eq(methodStats.userId, userId)).all();
  const modes = await db.select().from(modeUsage).where(eq(modeUsage.userId, userId)).all();
  return {
    profile: p ? { key: p.profileKey, modality: p.modality, reasoning: p.reasoning, scores: p.scores, updatedAt: p.updatedAt } : null,
    methods: stats.map((s) => ({ method: s.method, attempts: s.attempts, accuracy: s.attempts ? Math.round((s.correct / s.attempts) * 100) : 0 })),
    modes: modes.map((m) => ({ mode: m.mode, minutes: Math.round(m.seconds / 60) })),
  };
}

export async function dashboard(user: User, locale: Locale = 'tr') {
  const rows = await listCourses(user.id);
  const prog = await db.select({ courseId: moduleProgress.courseId, done: count() }).from(moduleProgress)
    .where(and(eq(moduleProgress.userId, user.id), isNotNull(moduleProgress.completedAt))).groupBy(moduleProgress.courseId).all();
  const last = await db.select({ courseId: checkAnswers.courseId }).from(checkAnswers).where(eq(checkAnswers.userId, user.id)).orderBy(desc(checkAnswers.id)).limit(1).get();
  const doneMap = new Map(prog.map((p) => [p.courseId, p.done]));
  const list = rows.map((r) => {
    const total = Math.max(1, r.moduleCount || 6);
    const done = doneMap.get(r.id) ?? 0;
    return { ...r, modulesDone: done, percent: Math.round((done / total) * 100) };
  });
  const u = await db.select().from(users).where(eq(users.id, user.id)).get();
  const xp = u?.xp ?? 0;
  return {
    xp, level: levelFromXp(xp), streak: u?.streak ?? 0, longestStreak: u?.longestStreak ?? 0,
    dueReviews: await dueCount(user.id),
    heatmap: await activityHeatmap(user.id),
    insight: await learningInsight(user.id, locale),
    courses: list,
    continueId: last?.courseId ?? list.find((c) => c.status === 'ready' && !c.completedAt)?.id ?? null,
  };
}

/** Öğrenme analizi (learning analytics + metacognition): metot isabeti, mod tercihi, özgüven kalibrasyonu.
 *  Kaynak: zaten yazılan methodStats / modeUsage / checkAnswers satırları — şema değişikliği yok. */
async function learningInsight(userId: number, locale: Locale) {
  const [methods, modes, conf] = await Promise.all([
    db.select().from(methodStats).where(eq(methodStats.userId, userId)).all(),
    db.select().from(modeUsage).where(eq(modeUsage.userId, userId)).all(),
    db.select({ confidence: checkAnswers.confidence, correct: checkAnswers.correct })
      .from(checkAnswers)
      .where(and(eq(checkAnswers.userId, userId), sql`${checkAnswers.itemId} not like 'rv:%'`)).all(),
  ]);
  const named = methods
    .filter((m) => m.attempts >= 5)
    .map((m) => ({ method: m.method, accuracy: Math.round((m.correct / m.attempts) * 100), name: METHODS[m.method as keyof typeof METHODS]?.name[locale] ?? m.method }))
    .sort((a, b) => b.accuracy - a.accuracy);
  const topMode = modes.map((m) => ({ mode: m.mode, minutes: Math.round(m.seconds / 60) })).sort((a, b) => b.minutes - a.minutes)[0] ?? null;
  const high = conf.filter((c) => c.confidence === 3);
  const highConfAcc = high.length >= 5 ? Math.round((high.filter((c) => c.correct).length / high.length) * 100) : null;
  return {
    topMethod: named[0] ?? null,
    weakMethod: named.length > 1 ? named[named.length - 1] : null,
    topMode,
    highConfAcc,
    answers: conf.length,
  };
}

export async function profilePage(user: User, locale: Locale) {
  const u = (await db.select().from(users).where(eq(users.id, user.id)).get())!;
  const [board, cog, certs, heat] = await Promise.all([badgeBoard(user.id, locale), getCognitive(user.id), myCertificates(user.id), activityHeatmap(user.id)]);
  const courseCount = (await db.select({ n: count() }).from(courses).where(eq(courses.userId, user.id)).get())?.n ?? 0;
  const done = (await db.select({ n: count() }).from(courses).where(and(eq(courses.userId, user.id), isNotNull(courses.completedAt))).get())?.n ?? 0;
  const minutes = Math.round((await db.select({ s: sql<number>`coalesce(sum(${moduleProgress.seconds}),0)` }).from(moduleProgress).where(eq(moduleProgress.userId, user.id)).get())!.s / 60);
  const acc = await db.select({ n: count(), ok: sql<number>`coalesce(sum(${checkAnswers.correct}),0)` }).from(checkAnswers).where(eq(checkAnswers.userId, user.id)).get();
  return {
    user: { fullName: u.fullName, username: u.username, email: u.email, plan: u.plan, locale: u.locale, theme: u.theme, createdAt: u.createdAt },
    xp: u.xp, level: levelFromXp(u.xp), streak: u.streak, longestStreak: u.longestStreak,
    stats: { courses: courseCount, completedCourses: done, minutes, answers: acc?.n ?? 0, accuracy: acc?.n ? Math.round((Number(acc.ok) / acc.n) * 100) : 0, certificates: certs.length },
    badges: board.badges, cognitive: cog, certificates: certs, heatmap: heat,
    profileName: cog.profile ? PROFILES[cog.profile.key as keyof typeof PROFILES]?.name[locale] : null,
  };
}

export async function updateSettings(user: User, s: { fullName?: string; locale?: Locale; theme?: 'paper' | 'ink' }) {
  const set: Partial<typeof users.$inferInsert> = {};
  if (s.fullName !== undefined) set.fullName = s.fullName.trim().slice(0, 80);
  if (s.locale) set.locale = s.locale;
  if (s.theme) set.theme = s.theme;
  if (Object.keys(set).length) await db.update(users).set(set).where(eq(users.id, user.id)).run();
  return { ok: true };
}

/** KVKK/GDPR: tek tıkla hesap ve tüm öğrenme verisini silme (cascade). */
export async function deleteAccount(user: User) {
  await db.delete(users).where(eq(users.id, user.id)).run();
}

/* ---------------- haftalık öğrenme planı (implementation intention) ---------------- */

function mondayUtc(): string {
  const d = new Date();
  const day = (d.getUTCDay() + 6) % 7; // Pazartesi = 0
  d.setUTCDate(d.getUTCDate() - day);
  return d.toISOString().slice(0, 10);
}

export async function getPlan(user: User) {
  const u = await db.select({ planPrefs: users.planPrefs }).from(users).where(eq(users.id, user.id)).get();
  let prefs: PlanPrefs | null = null;
  if (u?.planPrefs) { try { prefs = PlanPrefs.parse(JSON.parse(u.planPrefs)); } catch { prefs = null; } }
  const since = mondayUtc();
  const week = await db.select({ day: activityDays.day, seconds: activityDays.seconds })
    .from(activityDays).where(and(eq(activityDays.userId, user.id), sql`${activityDays.day} >= ${since}`)).all();
  const daysDone = week.filter((w) => w.seconds >= 60).length;
  const minutesDone = Math.round(week.reduce((s, w) => s + w.seconds, 0) / 60);
  return { prefs, week: { daysDone, minutesDone, since } };
}

export async function savePlan(user: User, input: PlanPrefs) {
  const prefs = PlanPrefs.parse(input);
  await db.update(users).set({ planPrefs: JSON.stringify(prefs) }).where(eq(users.id, user.id)).run();
  return { ok: true as const, prefs };
}
