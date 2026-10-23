// Yönetim paneli verileri: büyüme, öğrenme sonuçları ve AI maliyet/önbellek görünürlüğü.
import { count, desc, eq, isNotNull, sql } from 'drizzle-orm';
import { db } from '../db/client';
import { aiCache, aiUsage, certificates, courses, quizAttempts, users } from '../db/schema';
import { aiInfo } from '../ai/provider';

export async function adminStats() {
  const one = async <T>(q: Promise<T | undefined>) => q;
  const weekAgo = Date.now() - 7 * 86_400_000;
  const [u, u7, p, c, cDone, certs, qa, ai, aiCached, cacheRows] = await Promise.all([
    one(db.select({ n: count() }).from(users).get()),
    one(db.select({ n: count() }).from(users).where(sql`${users.createdAt} >= ${weekAgo}`).get()),
    one(db.select({ n: count() }).from(users).where(eq(users.plan, 'premium')).get()),
    one(db.select({ n: count() }).from(courses).get()),
    one(db.select({ n: count() }).from(courses).where(isNotNull(courses.completedAt)).get()),
    one(db.select({ n: count() }).from(certificates).get()),
    one(db.select({ n: count(), passed: sql<number>`sum(${quizAttempts.passed})` }).from(quizAttempts).get()),
    one(db.select({ n: count(), inT: sql<number>`coalesce(sum(${aiUsage.inTokens}),0)`, outT: sql<number>`coalesce(sum(${aiUsage.outTokens}),0)` }).from(aiUsage).get()),
    one(db.select({ n: count() }).from(aiUsage).where(eq(aiUsage.cached, true)).get()),
    one(db.select({ n: count(), hits: sql<number>`coalesce(sum(${aiCache.hits}),0)` }).from(aiCache).get()),
  ]);
  const byTask = await db.select({
    task: aiUsage.task, tier: aiUsage.tier, calls: count(),
    cached: sql<number>`sum(${aiUsage.cached})`, failed: sql<number>`sum(1 - ${aiUsage.ok})`,
    inT: sql<number>`sum(${aiUsage.inTokens})`, outT: sql<number>`sum(${aiUsage.outTokens})`, ms: sql<number>`avg(${aiUsage.ms})`,
  }).from(aiUsage).groupBy(aiUsage.task, aiUsage.tier).orderBy(desc(count())).all();
  return {
    users: u?.n ?? 0, newUsers7d: u7?.n ?? 0, premium: p?.n ?? 0,
    courses: c?.n ?? 0, completedCourses: cDone?.n ?? 0, certificates: certs?.n ?? 0,
    quizAttempts: qa?.n ?? 0, quizPassRate: qa?.n ? Math.round(((qa.passed ?? 0) / qa.n) * 100) : 0,
    ai: { ...aiInfo(), calls: ai?.n ?? 0, cachedCalls: aiCached?.n ?? 0, inTokens: Number(ai?.inT ?? 0), outTokens: Number(ai?.outT ?? 0), cacheEntries: cacheRows?.n ?? 0, cacheHits: Number(cacheRows?.hits ?? 0), byTask },
  };
}

export async function adminUsers() {
  return db.select({ id: users.id, username: users.username, email: users.email, fullName: users.fullName, role: users.role, plan: users.plan, xp: users.xp, streak: users.streak, createdAt: users.createdAt })
    .from(users).orderBy(desc(users.id)).limit(500).all();
}

export async function adminSetPlan(id: number, plan: 'free' | 'premium') {
  await db.update(users).set({ plan }).where(eq(users.id, id)).run();
}

export async function adminCourses() {
  return db.select({ id: courses.id, title: courses.title, status: courses.status, generator: courses.generator, source: courses.source, locale: courses.locale, createdAt: courses.createdAt, username: users.username })
    .from(courses).innerJoin(users, eq(users.id, courses.userId)).orderBy(desc(courses.id)).limit(200).all();
}
