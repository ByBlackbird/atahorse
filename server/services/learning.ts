// Öğrenme döngüsü: kilit → okuma/dinleme/slayt → anlık kontrol → görev onayı → modül quizi →
// modül tamamlama → kurs tamamlama → karma final → sertifika. Her ödül sunucu otoriter ve idempotent.
import crypto from 'node:crypto';
import { and, asc, count, eq, lte, sql } from 'drizzle-orm';
import { db } from '../db/client';
import { certificates, checkAnswers, courses, methodStats, moduleProgress, quizAttempts, reviewCards, users } from '../db/schema';
import type { CourseDoc, Locale, QuizItem } from '../../shared/types';
import { FINAL_PASS_RATIO, QUIZ_PASS_RATIO, levelFromXp } from '../../shared/engine/gamification';
import { gradeFromAnswer, newCard, review, type Grade } from '../../shared/engine/fsrs';
import { hash, rng } from '../../shared/engine/generate';
import { AppError, docFor, ownCourse, parseDoc, type CourseRow } from './courses';
import { awardXp, recordMode, touchActivity, type XpResult } from './gamification';
import type { User } from './auth';

/* ---------------- yardımcılar ---------------- */
export function itemsOf(doc: CourseDoc) {
  const map = new Map<string, { item: QuizItem; moduleIdx: number; kind: 'check' | 'quiz' }>();
  doc.modules.forEach((m, mi) => {
    m.sections.forEach((s) => { if (s.check) map.set(s.check.id, { item: s.check, moduleIdx: mi, kind: 'check' }); });
    m.quiz.forEach((q) => map.set(q.id, { item: q, moduleIdx: mi, kind: 'quiz' }));
  });
  return map;
}

const strip = (q: QuizItem) => ({ id: q.id, q: q.q, options: q.options, bloom: q.bloom });

async function progressRows(userId: number, courseId: number) {
  return db.select().from(moduleProgress).where(and(eq(moduleProgress.userId, userId), eq(moduleProgress.courseId, courseId))).all();
}

async function ensureRow(userId: number, courseId: number, moduleIdx: number) {
  await db.insert(moduleProgress).values({ userId, courseId, moduleIdx }).onConflictDoNothing().run();
}

export function unlockedList(n: number, rows: (typeof moduleProgress.$inferSelect)[]) {
  const passed = new Set(rows.filter((r) => r.quizPassedAt).map((r) => r.moduleIdx));
  return Array.from({ length: n }, (_, i) => i === 0 || passed.has(i - 1));
}

async function assertUnlocked(userId: number, c: CourseRow, moduleIdx: number) {
  const doc = parseDoc(c.doc);
  if (moduleIdx < 0 || moduleIdx >= doc.modules.length) throw new AppError('bad_module');
  const rows = await progressRows(userId, c.id);
  if (!unlockedList(doc.modules.length, rows)[moduleIdx]) throw new AppError('module_locked', 'FORBIDDEN');
  return doc;
}

async function bumpMethod(userId: number, method: string, correct: boolean) {
  await db.insert(methodStats).values({ userId, method, attempts: 1, correct: correct ? 1 : 0 })
    .onConflictDoUpdate({ target: [methodStats.userId, methodStats.method], set: { attempts: sql`${methodStats.attempts} + 1`, correct: sql`${methodStats.correct} + ${correct ? 1 : 0}` } }).run();
}

async function scheduleCard(userId: number, courseId: number, itemId: string, grade: Grade) {
  const cur = await db.select().from(reviewCards).where(and(eq(reviewCards.userId, userId), eq(reviewCards.courseId, courseId), eq(reviewCards.itemId, itemId))).get();
  const next = review(cur ? { stability: cur.stability, difficulty: cur.difficulty, reps: cur.reps, lapses: cur.lapses, lastReview: cur.lastReview, due: cur.due } : newCard(), grade);
  await db.insert(reviewCards).values({ userId, courseId, itemId, ...next })
    .onConflictDoUpdate({ target: [reviewCards.userId, reviewCards.courseId, reviewCards.itemId], set: next }).run();
}

/** Modül tamamlanma koşulu (görev + quiz) ve kurs tamamlanma koşulu; ödülleri birleştirir. */
async function settle(user: User, c: CourseRow, doc: CourseDoc, moduleIdx: number, locale: Locale) {
  const rows = await progressRows(user.id, c.id);
  const row = rows.find((r) => r.moduleIdx === moduleIdx);
  const rewards: XpResult[] = [];
  if (row && row.taskDoneAt && row.quizPassedAt && !row.completedAt) {
    await db.update(moduleProgress).set({ completedAt: Date.now() })
      .where(and(eq(moduleProgress.userId, user.id), eq(moduleProgress.courseId, c.id), eq(moduleProgress.moduleIdx, moduleIdx))).run();
    rewards.push(await awardXp(user.id, 'module', `module:${c.id}:${moduleIdx}`, locale));
  }
  const fresh = await progressRows(user.id, c.id);
  const done = fresh.filter((r) => r.completedAt).length;
  if (done === doc.modules.length && !c.completedAt) {
    await db.update(courses).set({ completedAt: Date.now() }).where(eq(courses.id, c.id)).run();
    rewards.push(await awardXp(user.id, 'course', `course:${c.id}`, locale));
  }
  return rewards;
}

const merge = (rs: XpResult[]) => rs.length === 0 ? null : {
  gained: rs.reduce((s, r) => s + r.gained, 0),
  total: rs[rs.length - 1].total,
  level: rs[rs.length - 1].level,
  badges: rs.flatMap((r) => r.badges),
};

/* ---------------- kurs görünümü ---------------- */
export async function courseView(user: User, courseId: number, locale?: Locale) {
  const c = await ownCourse(user, courseId);
  if (c.status !== 'ready') return { status: c.status, course: { id: c.id, title: c.title } } as const;
  const { doc, locale: shown } = await docFor(c, locale);
  const rows = await progressRows(user.id, c.id);
  const unlocked = unlockedList(doc.modules.length, rows);
  const answers = await db.select({ itemId: checkAnswers.itemId, correct: checkAnswers.correct }).from(checkAnswers)
    .where(and(eq(checkAnswers.userId, user.id), eq(checkAnswers.courseId, c.id))).all();
  const checks: Record<string, boolean> = {};
  for (const a of answers) if (!a.itemId.startsWith('rv:')) checks[a.itemId] = checks[a.itemId] || a.correct;
  const cert = await db.select().from(certificates).where(and(eq(certificates.userId, user.id), eq(certificates.courseId, c.id))).get();
  const final = await db.select().from(quizAttempts)
    .where(and(eq(quizAttempts.userId, user.id), eq(quizAttempts.courseId, c.id), eq(quizAttempts.moduleIdx, -1))).orderBy(sql`${quizAttempts.score} desc`).get();
  // Öğrenciye giden belgede doğru cevaplar yok — kontrol soruları sunucuda puanlanır.
  const safeDoc = {
    ...doc,
    modules: doc.modules.map((m) => ({
      ...m,
      sections: m.sections.map((s) => ({ ...s, check: s.check ? strip(s.check) : undefined })),
      quiz: m.quiz.map(strip),
    })),
  };
  const progress = doc.modules.map((_, i) => {
    const r = rows.find((x) => x.moduleIdx === i);
    return { idx: i, unlocked: unlocked[i], taskDone: !!r?.taskDoneAt, quizPassed: !!r?.quizPassedAt, quizBest: r?.quizBest ?? 0, completed: !!r?.completedAt, seconds: r?.seconds ?? 0 };
  });
  const completedModules = progress.filter((p) => p.completed).length;
  return {
    status: 'ready' as const,
    course: {
      id: c.id, title: doc.title, locale: c.locale, shownLocale: shown, level: c.level, source: c.source,
      generator: c.generator, profileKey: c.profileKey, method: c.method, shareSlug: c.shareSlug, completedAt: c.completedAt,
    },
    doc: safeDoc,
    progress,
    checks,
    percent: Math.round((completedModules / doc.modules.length) * 100),
    final: final ? { score: final.score, total: final.total, passed: final.passed } : null,
    certificate: cert ? { code: cert.code, issuedAt: cert.issuedAt, scorePct: cert.scorePct } : null,
    goals: [
      { key: 'tasks', done: progress.filter((p) => p.taskDone).length, total: doc.modules.length },
      { key: 'quizzes', done: progress.filter((p) => p.quizPassed).length, total: doc.modules.length },
      { key: 'modules', done: completedModules, total: doc.modules.length },
      { key: 'final', done: final?.passed ? 1 : 0, total: 1 },
    ],
  };
}

/* ---------------- anlık kontrol (pop-up) ---------------- */
export async function answerCheck(user: User, courseId: number, itemId: string, choice: number, confidence: 1 | 2 | 3) {
  const c = await ownCourse(user, courseId);
  const doc = parseDoc(c.doc);
  const found = itemsOf(doc).get(itemId);
  if (!found) throw new AppError('bad_item');
  await assertUnlocked(user.id, c, found.moduleIdx);
  const correct = choice === found.item.correct;
  await db.insert(checkAnswers).values({ userId: user.id, courseId: c.id, itemId, correct, confidence, method: c.method }).run();
  await bumpMethod(user.id, c.method, correct);
  await scheduleCard(user.id, c.id, itemId, gradeFromAnswer(correct, confidence));
  await touchActivity(user.id);
  return { correct, correctIndex: found.item.correct, explain: found.item.explain };
}

/* ---------------- görev onayı (+20) ---------------- */
export async function approveTask(user: User, courseId: number, moduleIdx: number, reflection: string, locale: Locale) {
  const c = await ownCourse(user, courseId);
  const doc = await assertUnlocked(user.id, c, moduleIdx);
  // Asgari kanıt: kısa bir yansıma notu (öz-açıklama etkisi). Boş onay yok.
  if (reflection.trim().length < 15) throw new AppError('reflection_short');
  await ensureRow(user.id, c.id, moduleIdx);
  await db.update(moduleProgress).set({ taskDoneAt: sql`coalesce(${moduleProgress.taskDoneAt}, ${Date.now()})` })
    .where(and(eq(moduleProgress.userId, user.id), eq(moduleProgress.courseId, c.id), eq(moduleProgress.moduleIdx, moduleIdx))).run();
  const rs = [await awardXp(user.id, 'task', `task:${c.id}:${moduleIdx}`, locale)];
  rs.push(...(await settle(user, c, doc, moduleIdx, locale)));
  return { xp: merge(rs) };
}

/* ---------------- modül quizi (+25, kilit açar) ---------------- */
export async function submitModuleQuiz(user: User, courseId: number, moduleIdx: number, answers: number[], locale: Locale) {
  const c = await ownCourse(user, courseId);
  const doc = await assertUnlocked(user.id, c, moduleIdx);
  const quiz = doc.modules[moduleIdx].quiz;
  if (answers.length !== quiz.length) throw new AppError('bad_answers');
  const results = quiz.map((q, i) => ({ id: q.id, chosen: answers[i], correct: q.correct, ok: answers[i] === q.correct, explain: q.explain }));
  const score = results.filter((r) => r.ok).length;
  const passed = score / quiz.length >= QUIZ_PASS_RATIO;
  await db.insert(quizAttempts).values({ userId: user.id, courseId: c.id, moduleIdx, answers, score, total: quiz.length, passed }).run();
  for (const r of results) {
    await bumpMethod(user.id, c.method, r.ok);
    await scheduleCard(user.id, c.id, r.id, r.ok ? 3 : 1);
  }
  await ensureRow(user.id, c.id, moduleIdx);
  const pct = Math.round((score / quiz.length) * 100);
  await db.update(moduleProgress).set({
    quizBest: sql`max(${moduleProgress.quizBest}, ${pct})`,
    ...(passed ? { quizPassedAt: sql`coalesce(${moduleProgress.quizPassedAt}, ${Date.now()})` } : {}),
  }).where(and(eq(moduleProgress.userId, user.id), eq(moduleProgress.courseId, c.id), eq(moduleProgress.moduleIdx, moduleIdx))).run();
  const rs: XpResult[] = [];
  if (passed) {
    rs.push(await awardXp(user.id, 'quiz', `quiz:${c.id}:${moduleIdx}`, locale));
    rs.push(...(await settle(user, c, doc, moduleIdx, locale)));
  } else {
    await touchActivity(user.id);
  }
  return { score, total: quiz.length, passed, results, xp: merge(rs), unlockedNext: passed && moduleIdx + 1 < doc.modules.length };
}

/* ---------------- final değerlendirme (karma) + sertifika ---------------- */
function finalItems(doc: CourseDoc, courseId: number, userId: number) {
  const all = [...itemsOf(doc).values()];
  const r = rng(hash(`final:${courseId}:${userId}`));
  // Karma tekrar: her modülden en az bir soru, sonra karıştır (interleaving)
  const perModule = doc.modules.map((_, mi) => all.filter((x) => x.moduleIdx === mi));
  const picked: QuizItem[] = [];
  for (const list of perModule) if (list.length) picked.push(list[Math.floor(r() * list.length)].item);
  const rest = all.map((x) => x.item).filter((q) => !picked.includes(q));
  while (picked.length < Math.min(10, all.length) && rest.length) picked.push(rest.splice(Math.floor(r() * rest.length), 1)[0]);
  for (let i = picked.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [picked[i], picked[j]] = [picked[j], picked[i]]; }
  return picked;
}

export async function getFinal(user: User, courseId: number, locale?: Locale) {
  const c = await ownCourse(user, courseId);
  if (!c.completedAt) throw new AppError('course_not_finished', 'FORBIDDEN');
  const { doc } = await docFor(c, locale);
  return { title: doc.title, items: finalItems(doc, c.id, user.id).map(strip) };
}

export async function submitFinal(user: User, courseId: number, answers: Record<string, number>, locale: Locale) {
  const c = await ownCourse(user, courseId);
  if (!c.completedAt) throw new AppError('course_not_finished', 'FORBIDDEN');
  const doc = parseDoc(c.doc);
  const items = finalItems(doc, c.id, user.id);
  const results = items.map((q) => ({ id: q.id, chosen: answers[q.id] ?? -1, correct: q.correct, ok: answers[q.id] === q.correct, explain: q.explain }));
  const score = results.filter((r) => r.ok).length;
  const passed = score / items.length >= FINAL_PASS_RATIO;
  await db.insert(quizAttempts).values({ userId: user.id, courseId: c.id, moduleIdx: -1, answers: items.map((q) => answers[q.id] ?? -1), score, total: items.length, passed }).run();
  for (const r of results) await scheduleCard(user.id, c.id, r.id, r.ok ? 3 : 1);
  let certificate: { code: string } | null = null;
  if (passed) {
    const existing = await db.select().from(certificates).where(and(eq(certificates.userId, user.id), eq(certificates.courseId, c.id))).get();
    if (existing) certificate = { code: existing.code };
    else {
      const code = `ATA-${new Date().getFullYear()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
      await db.insert(certificates).values({ code, userId: user.id, courseId: c.id, scorePct: Math.round((score / items.length) * 100) }).onConflictDoNothing().run();
      certificate = { code };
      await touchActivity(user.id);
    }
  }
  const badgeRefresh = passed ? await awardXp(user.id, 'quiz', `final:${c.id}`, locale) : null;
  return { score, total: items.length, passed, results, certificate, xp: badgeRefresh };
}

export async function verifyCertificate(code: string) {
  const row = await db.select({ code: certificates.code, issuedAt: certificates.issuedAt, scorePct: certificates.scorePct, fullName: users.fullName, username: users.username, title: courses.title, level: courses.level, locale: courses.locale })
    .from(certificates).innerJoin(users, eq(users.id, certificates.userId)).innerJoin(courses, eq(courses.id, certificates.courseId))
    .where(eq(certificates.code, code.trim().toUpperCase())).get();
  return row ? { valid: true as const, ...row, name: row.fullName || row.username } : { valid: false as const };
}

export async function myCertificates(userId: number) {
  return db.select({ code: certificates.code, issuedAt: certificates.issuedAt, scorePct: certificates.scorePct, title: courses.title, courseId: courses.id })
    .from(certificates).innerJoin(courses, eq(courses.id, certificates.courseId)).where(eq(certificates.userId, userId)).orderBy(sql`${certificates.issuedAt} desc`).all();
}

/* ---------------- süre / mod kullanımı ---------------- */
export async function heartbeat(user: User, courseId: number, moduleIdx: number, mode: string, seconds: number) {
  const s = Math.max(0, Math.min(120, Math.round(seconds)));
  if (!s) return;
  await ownCourse(user, courseId);
  await ensureRow(user.id, courseId, moduleIdx);
  await db.update(moduleProgress).set({ seconds: sql`${moduleProgress.seconds} + ${s}` })
    .where(and(eq(moduleProgress.userId, user.id), eq(moduleProgress.courseId, courseId), eq(moduleProgress.moduleIdx, moduleIdx))).run();
  await recordMode(user.id, mode, s);
  await touchActivity(user.id, s);
}

/* ---------------- aralıklı tekrar oturumu ---------------- */
export async function dueReviews(user: User, limit = 12) {
  const due = await db.select().from(reviewCards).where(and(eq(reviewCards.userId, user.id), lte(reviewCards.due, Date.now())))
    .orderBy(asc(reviewCards.due)).limit(limit * 2).all();
  const docs = new Map<number, CourseDoc | null>();
  const out: { cardId: number; courseId: number; courseTitle: string; item: ReturnType<typeof strip> }[] = [];
  for (const card of due) {
    if (!docs.has(card.courseId)) {
      const c = await db.select({ doc: courses.doc }).from(courses).where(eq(courses.id, card.courseId)).get();
      docs.set(card.courseId, c?.doc ? parseDoc(c.doc) : null);
    }
    const doc = docs.get(card.courseId);
    const found = doc ? itemsOf(doc).get(card.itemId) : undefined;
    if (doc && found) out.push({ cardId: card.id, courseId: card.courseId, courseTitle: doc.title, item: strip(found.item) });
    if (out.length >= limit) break;
  }
  // Karışık sıra (interleaving)
  return out.sort((a, b) => hash(`${a.cardId}`) - hash(`${b.cardId}`));
}

export async function dueCount(userId: number) {
  return (await db.select({ n: count() }).from(reviewCards).where(and(eq(reviewCards.userId, userId), lte(reviewCards.due, Date.now()))).get())?.n ?? 0;
}

export async function answerReview(user: User, cardId: number, choice: number, confidence: 1 | 2 | 3) {
  const card = await db.select().from(reviewCards).where(and(eq(reviewCards.id, cardId), eq(reviewCards.userId, user.id))).get();
  if (!card) throw new AppError('not_found', 'NOT_FOUND');
  const c = await db.select({ doc: courses.doc, method: courses.method }).from(courses).where(eq(courses.id, card.courseId)).get();
  const found = c?.doc ? itemsOf(parseDoc(c.doc)).get(card.itemId) : undefined;
  if (!found || !c) throw new AppError('not_found', 'NOT_FOUND');
  const correct = choice === found.item.correct;
  const next = review(card, gradeFromAnswer(correct, confidence));
  await db.update(reviewCards).set(next).where(eq(reviewCards.id, card.id)).run();
  await db.insert(checkAnswers).values({ userId: user.id, courseId: card.courseId, itemId: `rv:${card.itemId}`, correct, confidence, method: c.method }).run();
  await touchActivity(user.id);
  return { correct, correctIndex: found.item.correct, explain: found.item.explain, nextDue: next.due };
}

export const levelOf = levelFromXp;
