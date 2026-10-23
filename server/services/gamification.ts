// XP defteri, seri, aktivite ve rozet ödülleri — tümü sunucu otoriter ve idempotent.
import { and, count, eq, isNotNull, like, sql } from 'drizzle-orm';
import { db } from '../db/client';
import { activityDays, certificates, checkAnswers, mindmaps, modeUsage, moduleProgress, userBadges, users, xpEvents } from '../db/schema';
import { BADGES, XP, evaluateBadges, levelFromXp, nextStreak, type BadgeStats, type XpKind } from '../../shared/engine/gamification';
import type { Locale } from '../../shared/types';

export const today = () => new Date().toISOString().slice(0, 10);

/** Günlük aktiviteyi işler ve seriyi günceller. */
export async function touchActivity(userId: number, seconds = 0, xp = 0) {
  const day = today();
  await db.insert(activityDays).values({ userId, day, seconds, xp })
    .onConflictDoUpdate({ target: [activityDays.userId, activityDays.day], set: { seconds: sql`${activityDays.seconds} + ${seconds}`, xp: sql`${activityDays.xp} + ${xp}` } }).run();
  const u = await db.select({ streak: users.streak, longest: users.longestStreak, last: users.lastActiveDay }).from(users).where(eq(users.id, userId)).get();
  if (!u || u.last === day) return;
  const streak = nextStreak(u.last, day, u.streak);
  await db.update(users).set({ streak, longestStreak: Math.max(u.longest, streak), lastActiveDay: day }).where(eq(users.id, userId)).run();
}

export interface XpResult { gained: number; total: number; level: ReturnType<typeof levelFromXp>; badges: { key: string; name: string }[] }

/** refKey benzersizdir: aynı ödül iki kez verilmez. */
export async function awardXp(userId: number, kind: XpKind, refKey: string, locale: Locale): Promise<XpResult> {
  const amount = XP[kind];
  const ins = await db.insert(xpEvents).values({ userId, kind, amount, refKey }).onConflictDoNothing().returning({ id: xpEvents.id }).all();
  const gained = ins.length ? amount : 0;
  if (gained) {
    await db.update(users).set({ xp: sql`${users.xp} + ${gained}` }).where(eq(users.id, userId)).run();
    await touchActivity(userId, 0, gained);
  }
  const total = (await db.select({ xp: users.xp }).from(users).where(eq(users.id, userId)).get())?.xp ?? 0;
  const badges = await refreshBadges(userId, locale);
  return { gained, total, level: levelFromXp(total), badges };
}

export async function badgeStats(userId: number): Promise<BadgeStats> {
  const [u, mods, quizzes, modes, maps, reviews, certs] = await Promise.all([
    db.select({ streak: users.streak, longest: users.longestStreak }).from(users).where(eq(users.id, userId)).get(),
    db.select({ n: count() }).from(moduleProgress).where(and(eq(moduleProgress.userId, userId), isNotNull(moduleProgress.completedAt))).get(),
    db.select({ n: count() }).from(moduleProgress).where(and(eq(moduleProgress.userId, userId), isNotNull(moduleProgress.quizPassedAt))).get(),
    db.select({ mode: modeUsage.mode }).from(modeUsage).where(and(eq(modeUsage.userId, userId), sql`${modeUsage.seconds} >= 20`)).all(),
    db.select({ n: sql<number>`max(json_array_length(${mindmaps.nodes}))` }).from(mindmaps).where(eq(mindmaps.userId, userId)).get(),
    db.select({ n: count() }).from(checkAnswers).where(and(eq(checkAnswers.userId, userId), like(checkAnswers.itemId, 'rv:%'))).get(),
    db.select({ n: count() }).from(certificates).where(eq(certificates.userId, userId)).get(),
  ]);
  return {
    modulesCompleted: mods?.n ?? 0,
    streak: u?.streak ?? 0,
    longestStreak: u?.longest ?? 0,
    quizzesPassed: quizzes?.n ?? 0,
    modesUsed: modes.map((m) => m.mode),
    maxMindmapNodes: Number(maps?.n ?? 0),
    reviewsDone: reviews?.n ?? 0,
    certificates: certs?.n ?? 0,
  };
}

/** Yeni kazanılan rozetleri kalıcılaştırır ve döndürür (bildirim için). */
export async function refreshBadges(userId: number, locale: Locale) {
  const stats = await badgeStats(userId);
  const have = new Set((await db.select({ k: userBadges.badgeKey }).from(userBadges).where(eq(userBadges.userId, userId)).all()).map((r) => r.k));
  const fresh: { key: string; name: string }[] = [];
  for (const b of BADGES) {
    if (!have.has(b.key) && b.value(stats) >= b.target) {
      const r = await db.insert(userBadges).values({ userId, badgeKey: b.key }).onConflictDoNothing().returning({ k: userBadges.badgeKey }).all();
      if (r.length) fresh.push({ key: b.key, name: b.name[locale] });
    }
  }
  return fresh;
}

export async function badgeBoard(userId: number, locale: Locale) {
  const stats = await badgeStats(userId);
  const awarded = new Map((await db.select().from(userBadges).where(eq(userBadges.userId, userId)).all()).map((r) => [r.badgeKey, r.awardedAt]));
  return { stats, badges: evaluateBadges(stats, locale).map((b) => ({ ...b, earned: b.earned || awarded.has(b.key), awardedAt: awarded.get(b.key) ?? null })) };
}

export async function recordMode(userId: number, mode: string, seconds: number) {
  await db.insert(modeUsage).values({ userId, mode, seconds })
    .onConflictDoUpdate({ target: [modeUsage.userId, modeUsage.mode], set: { seconds: sql`${modeUsage.seconds} + ${seconds}` } }).run();
}

/** Son 28 günün aktivite ısı haritası. */
export async function activityHeatmap(userId: number) {
  const since = new Date(Date.now() - 27 * 86_400_000).toISOString().slice(0, 10);
  const rows = await db.select().from(activityDays).where(and(eq(activityDays.userId, userId), sql`${activityDays.day} >= ${since}`)).all();
  const map = new Map(rows.map((r) => [r.day, r]));
  return Array.from({ length: 28 }, (_, i) => {
    const d = new Date(Date.now() - (27 - i) * 86_400_000).toISOString().slice(0, 10);
    const r = map.get(d);
    return { day: d, xp: r?.xp ?? 0, minutes: Math.round((r?.seconds ?? 0) / 60) };
  });
}
