// Bilişsel profil, kişisel panel özeti ve ayarlar.
import { and, count, desc, eq, isNotNull, sql } from 'drizzle-orm';
import { db } from '../db/client';
import { checkAnswers, cognitiveProfiles, courses, methodStats, modeUsage, moduleProgress, users } from '../db/schema';
import { PROFILE_TEST, PROFILES, scoreProfile, type ProfileAnswer } from '../../shared/engine/profiles';
import { levelFromXp } from '../../shared/engine/gamification';
import type { Locale } from '../../shared/types';
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

export async function dashboard(user: User) {
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
    courses: list,
    continueId: last?.courseId ?? list.find((c) => c.status === 'ready' && !c.completedAt)?.id ?? null,
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
