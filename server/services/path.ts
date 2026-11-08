// Kişisel öğrenme yolu servisleri: hedef/plan, modül ustalığı, "Bugün" yolu, zayıf nokta tekrarı,
// ön test → öğrenme kazancı, içerik bildirimi. Hesaplar shared/engine/path.ts'teki saf fonksiyonlardadır.
import { and, asc, desc, eq, inArray, isNotNull } from 'drizzle-orm';
import { db } from '../db/client';
import { checkAnswers, contentReports, courses, moduleProgress, pretests, quizAttempts } from '../db/schema';
import type { CourseDoc } from '../../shared/types';
import {
  PRETEST_SIZE, bandOf, courseMastery, dayKey, learningGain, moduleMastery, pickRecap, planCourse, todayPath, weakCount,
  type AnswerEvent, type PathCourse, type Plan,
} from '../../shared/engine/path';
import { AppError, docFor, ownCourse, parseDoc, type CourseRow } from './courses';
import { dueCount, finalItems, itemsOf, progressRows, strip, unlockedList } from './learning';
import type { User } from './auth';
import type { Locale } from '../../shared/types';

/* ---------------- kanıt toplama ---------------- */
async function evidence(userId: number, c: CourseRow, doc: CourseDoc) {
  const items = itemsOf(doc);
  const events: AnswerEvent[] = [];
  const lastCorrect = new Map<string, number>();
  const answers = await db.select({ itemId: checkAnswers.itemId, correct: checkAnswers.correct, at: checkAnswers.createdAt })
    .from(checkAnswers).where(and(eq(checkAnswers.userId, userId), eq(checkAnswers.courseId, c.id))).all();
  for (const a of answers) {
    const id = a.itemId.startsWith('rv:') ? a.itemId.slice(3) : a.itemId;
    const f = items.get(id);
    if (!f) continue;
    events.push({ moduleIdx: f.moduleIdx, correct: a.correct, at: a.at });
    if (a.correct) lastCorrect.set(id, Math.max(lastCorrect.get(id) ?? 0, a.at));
  }
  const attempts = await db.select().from(quizAttempts).where(and(eq(quizAttempts.userId, userId), eq(quizAttempts.courseId, c.id))).all();
  const fin = finalItems(doc, c.id, userId);
  for (const qa of attempts) {
    const list = qa.moduleIdx >= 0 ? doc.modules[qa.moduleIdx]?.quiz ?? [] : fin;
    list.forEach((q, i) => {
      const f = items.get(q.id);
      if (!f) return;
      const ok = qa.answers[i] === q.correct;
      events.push({ moduleIdx: f.moduleIdx, correct: ok, at: qa.createdAt });
      if (ok) lastCorrect.set(q.id, Math.max(lastCorrect.get(q.id) ?? 0, qa.createdAt));
    });
  }
  return { events, lastCorrect, attempts, fin };
}

function buildPlan(c: CourseRow, doc: CourseDoc, rows: Awaited<ReturnType<typeof progressRows>>, finalPassed: boolean): Plan {
  return planCourse({
    modules: doc.modules.map((m, i) => {
      const r = rows.find((x) => x.moduleIdx === i);
      return { idx: i, minutes: m.minutes, completed: !!r?.completedAt, startedSeconds: r?.seconds ?? 0 };
    }),
    today: dayKey(Date.now()),
    targetDate: c.targetDate,
    minutesPerDay: c.minutesPerDay,
    finalDone: finalPassed,
  });
}

/* ---------------- ön test durumu ---------------- */
type PretestStatus = 'pending' | 'done' | 'skipped' | 'na';
async function pretestStatus(userId: number, courseId: number): Promise<{ status: PretestStatus; row: typeof pretests.$inferSelect | undefined }> {
  const row = await db.select().from(pretests).where(and(eq(pretests.userId, userId), eq(pretests.courseId, courseId))).get();
  if (row) return { status: row.skipped ? 'skipped' : 'done', row };
  const started = await db.select({ id: checkAnswers.id }).from(checkAnswers).where(and(eq(checkAnswers.userId, userId), eq(checkAnswers.courseId, courseId))).limit(1).get()
    ?? await db.select({ m: moduleProgress.moduleIdx }).from(moduleProgress).where(and(eq(moduleProgress.userId, userId), eq(moduleProgress.courseId, courseId), isNotNull(moduleProgress.quizPassedAt))).limit(1).get();
  // Öğrenmeye başlamış bir kursta ön test anlamsızdır (ölçüm bozulur): sorulmaz.
  return { status: started ? 'na' : 'pending', row: undefined };
}

/** Eşleştirilmiş kazanç: ön testteki aynı sorular finalde (ilk deneme) nasıl cevaplandı. */
function gainOf(pre: typeof pretests.$inferSelect | undefined, attempts: (typeof quizAttempts.$inferSelect)[], fin: ReturnType<typeof finalItems>) {
  if (!pre || pre.skipped || !pre.total) return null;
  const first = attempts.filter((a) => a.moduleIdx === -1).sort((a, b) => a.createdAt - b.createdAt)[0];
  if (!first) return { pre: pre.score / pre.total, post: null, g: null };
  const idx = new Map(fin.map((q, i) => [q.id, i]));
  let ok = 0, n = 0;
  pre.itemIds.forEach((id) => {
    const i = idx.get(id);
    if (i === undefined) return;
    n++;
    if (first.answers[i] === fin[i].correct) ok++;
  });
  if (!n) return { pre: pre.score / pre.total, post: null, g: null };
  const preFrac = pre.score / pre.total, post = ok / n;
  return { pre: preFrac, post, g: learningGain(preFrac, post) };
}

/* ---------------- kurs yolu (stüdyo "Yolum") ---------------- */
export async function coursePath(user: User, courseId: number, locale?: Locale) {
  const c = await ownCourse(user, courseId);
  if (c.status !== 'ready') throw new AppError('not_ready', 'CONFLICT');
  const doc = parseDoc(c.doc);
  const { doc: shown } = await docFor(c, locale);
  const rows = await progressRows(user.id, c.id);
  const { events, attempts, fin } = await evidence(user.id, c, doc);
  const mastery = moduleMastery(events, doc.modules.length);
  const finalPassed = attempts.some((a) => a.moduleIdx === -1 && a.passed);
  const plan = buildPlan(c, doc, rows, finalPassed);
  const pt = await pretestStatus(user.id, c.id);
  return {
    goal: { why: c.goalWhy ?? '', targetDate: c.targetDate, minutesPerDay: c.minutesPerDay },
    modules: shown.modules.map((m, i) => ({ idx: i, title: m.title, minutes: m.minutes, completed: !!rows.find((r) => r.moduleIdx === i)?.completedAt, band: bandOf(mastery[i]), ...mastery[i] })),
    overall: courseMastery(mastery, doc.modules.map((m) => m.minutes)),
    weak: weakCount(mastery),
    plan: { ...plan, days: plan.days.slice(0, 14) },
    pretest: pt.status,
    gain: gainOf(pt.row, attempts, fin),
  };
}

export async function setGoal(user: User, courseId: number, g: { why: string; targetDate: string | null; minutesPerDay: number }) {
  const c = await ownCourse(user, courseId);
  if (g.targetDate && g.targetDate < dayKey(Date.now())) throw new AppError('bad_date');
  await db.update(courses).set({ goalWhy: g.why.trim() || null, targetDate: g.targetDate, minutesPerDay: g.minutesPerDay, updatedAt: Date.now() }).where(eq(courses.id, c.id)).run();
  return { ok: true };
}

/* ---------------- "Bugün" yolu (panel) ---------------- */
export async function myPath(user: User) {
  const list = await db.select().from(courses).where(and(eq(courses.userId, user.id), eq(courses.status, 'ready'))).orderBy(desc(courses.updatedAt)).limit(20).all();
  const pcs: PathCourse[] = [];
  for (const c of list) {
    const doc = parseDoc(c.doc);
    const rows = await progressRows(user.id, c.id);
    const { events, attempts } = await evidence(user.id, c, doc);
    const mastery = moduleMastery(events, doc.modules.length);
    const finalPassed = attempts.some((a) => a.moduleIdx === -1 && a.passed);
    const unlocked = unlockedList(doc.modules.length, rows);
    const ni = doc.modules.findIndex((_, i) => unlocked[i] && !rows.find((r) => r.moduleIdx === i)?.completedAt);
    const last = Math.max(0, ...events.map((e) => e.at), ...attempts.map((a) => a.createdAt));
    pcs.push({
      id: c.id, title: doc.title, status: 'ready', completed: !!c.completedAt, finalPassed,
      nextModule: ni >= 0 ? { idx: ni, title: doc.modules[ni].title, minutes: doc.modules[ni].minutes } : null,
      plan: c.targetDate || c.goalWhy ? buildPlan(c, doc, rows, finalPassed) : null,
      weakModules: weakCount(mastery),
      lastActiveAt: last || c.updatedAt,
    });
  }
  const due = await dueCount(user.id);
  return { steps: todayPath(pcs, due), due };
}

/* ---------------- zayıf nokta oturumu ---------------- */
export async function recapSession(user: User, courseId: number, locale?: Locale) {
  const c = await ownCourse(user, courseId);
  const doc = parseDoc(c.doc);
  const { doc: shown } = await docFor(c, locale);
  const { events, lastCorrect } = await evidence(user.id, c, doc);
  const mastery = moduleMastery(events, doc.modules.length);
  const rows = await progressRows(user.id, c.id);
  const unlocked = unlockedList(doc.modules.length, rows);
  const cands = [...itemsOf(doc).entries()].filter(([, f]) => unlocked[f.moduleIdx]).map(([id, f]) => ({ id, moduleIdx: f.moduleIdx, lastCorrectAt: lastCorrect.get(id) ?? null }));
  const ids = pickRecap(cands, mastery);
  const shownItems = itemsOf(shown);
  return {
    courseId: c.id, title: shown.title,
    items: ids.map((id) => {
      const f = shownItems.get(id)!;
      return { ...strip(f.item), moduleIdx: f.moduleIdx, moduleTitle: shown.modules[f.moduleIdx].title };
    }),
  };
}

/* ---------------- ön test ---------------- */
export async function getPretest(user: User, courseId: number, locale?: Locale) {
  const c = await ownCourse(user, courseId);
  const pt = await pretestStatus(user.id, c.id);
  if (pt.status !== 'pending') return { status: pt.status, items: [] };
  const { doc } = await docFor(c, locale);
  const base = parseDoc(c.doc);
  const ids = finalItems(base, c.id, user.id).slice(0, PRETEST_SIZE).map((q) => q.id);
  const shown = itemsOf(doc);
  return { status: pt.status, items: ids.map((id) => shown.get(id)).filter((x): x is NonNullable<typeof x> => !!x).map((x) => strip(x.item)) };
}

/** Ön test cevapları gösterilmez (ölçümü bozmasın diye); yalnız başlangıç puanı döner. */
export async function submitPretest(user: User, courseId: number, answers: Record<string, number> | null) {
  const c = await ownCourse(user, courseId);
  const pt = await pretestStatus(user.id, c.id);
  if (pt.status !== 'pending') throw new AppError('pretest_closed', 'CONFLICT');
  const doc = parseDoc(c.doc);
  const items = finalItems(doc, c.id, user.id).slice(0, PRETEST_SIZE);
  if (!answers) {
    await db.insert(pretests).values({ userId: user.id, courseId: c.id, itemIds: [], answers: [], score: 0, total: 0, skipped: true }).onConflictDoNothing().run();
    return { skipped: true as const };
  }
  const arr = items.map((q) => (Number.isInteger(answers[q.id]) ? answers[q.id] : -1));
  const score = items.filter((q, i) => arr[i] === q.correct).length;
  await db.insert(pretests).values({ userId: user.id, courseId: c.id, itemIds: items.map((q) => q.id), answers: arr, score, total: items.length }).onConflictDoNothing().run();
  return { skipped: false as const, score, total: items.length };
}

/* ---------------- içerik bildirimi ---------------- */
export async function reportItem(user: User, courseId: number, itemId: string, kind: 'wrong_answer' | 'unclear' | 'factual' | 'other', note: string) {
  const c = await ownCourse(user, courseId);
  const id = itemId.startsWith('rv:') ? itemId.slice(3) : itemId;
  const doc = parseDoc(c.doc);
  const known = itemsOf(doc).has(id) || doc.modules.some((m) => m.sections.some((s) => s.id === id));
  if (!known) throw new AppError('bad_item');
  await db.insert(contentReports).values({ userId: user.id, courseId: c.id, itemId: id, kind, note: note.trim().slice(0, 600) })
    .onConflictDoUpdate({ target: [contentReports.userId, contentReports.courseId, contentReports.itemId], set: { kind, note: note.trim().slice(0, 600), status: 'open', createdAt: Date.now() } }).run();
  return { ok: true };
}

/* ---------------- yönetim: bildirim kuyruğu + sonuç ölçümü ---------------- */
export async function adminReports(status: 'open' | 'resolved' | 'dismissed' = 'open') {
  const rows = await db.select().from(contentReports).where(eq(contentReports.status, status)).orderBy(desc(contentReports.createdAt)).limit(100).all();
  const ids = [...new Set(rows.map((r) => r.courseId))];
  const cs = ids.length ? await db.select({ id: courses.id, title: courses.title, doc: courses.doc }).from(courses).where(inArray(courses.id, ids)).all() : [];
  const docs = new Map(cs.map((c) => [c.id, { title: c.title, doc: c.doc ? parseDoc(c.doc) : null }]));
  return rows.map((r) => {
    const d = docs.get(r.courseId);
    const item = d?.doc ? itemsOf(d.doc).get(r.itemId) : undefined;
    const section = d?.doc?.modules.flatMap((m) => m.sections).find((s) => s.id === r.itemId);
    return {
      id: r.id, courseId: r.courseId, courseTitle: d?.title ?? '', itemId: r.itemId, kind: r.kind, note: r.note, status: r.status, createdAt: r.createdAt,
      excerpt: item ? item.item.q : section ? section.heading : '',
      options: item?.item.options ?? [], correct: item?.item.correct ?? null, explain: item?.item.explain ?? '',
    };
  });
}

export async function adminSetReport(id: number, status: 'resolved' | 'dismissed' | 'open') {
  await db.update(contentReports).set({ status }).where(eq(contentReports.id, id)).run();
}

/** Ürün kanıtı: ön test yapılmış ve finali en az bir kez denenmiş kurslarda ortalama normalleştirilmiş kazanç. */
export async function adminOutcomes() {
  const pre = await db.select().from(pretests).where(eq(pretests.skipped, false)).orderBy(asc(pretests.createdAt)).limit(2000).all();
  const all = await db.select({ n: pretests.userId }).from(pretests).all();
  const gains: number[] = [];
  const pres: number[] = [];
  const posts: number[] = [];
  for (const p of pre) {
    const c = await db.select().from(courses).where(eq(courses.id, p.courseId)).get();
    if (!c?.doc) continue;
    const doc = parseDoc(c.doc);
    const attempts = await db.select().from(quizAttempts).where(and(eq(quizAttempts.userId, p.userId), eq(quizAttempts.courseId, p.courseId), eq(quizAttempts.moduleIdx, -1))).all();
    const g = gainOf(p, attempts, finalItems(doc, c.id, p.userId));
    if (g?.post !== null && g?.post !== undefined) { pres.push(g.pre); posts.push(g.post); if (g.g !== null) gains.push(g.g); }
  }
  const avg = (a: number[]) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : null);
  return { pretests: all.length, taken: pre.length, paired: posts.length, preAvg: avg(pres), postAvg: avg(posts), gainAvg: avg(gains) };
}
