// Kurs üretimi: istek anında job_id döner; üretim kuyrukta koşar; aşama yüzdeleri gerçektir.
// AI yoksa veya bir adım başarısız olursa deterministik motor devreye girer — boş kurs üretilmez.
import crypto from 'node:crypto';
import { and, count, desc, eq, inArray } from 'drizzle-orm';
import { db } from '../db/client';
import { cognitiveProfiles, courseTranslations, courses, jobs, methodStats } from '../db/schema';
import { CourseDoc, type Level, type Locale, type MethodKey, type Module, type ProfileKey } from '../../shared/types';
import { completeModule, generateTemplateCourse, templateModule, type GenInput } from '../../shared/engine/generate';
import { DEFAULT_PROFILE, PROFILES } from '../../shared/engine/profiles';
import { chooseMethod, type MethodStat } from '../../shared/engine/science';
import { mebSubject, type MebGrade } from '../../shared/engine/meb';
import { aiEnabled, completeJSON } from '../ai/provider';
import { ModuleBodySchema, OutlineSchema, modulePrompt, outlinePrompt, systemFor, toModule, translatePrompt, type Outline } from '../ai/prompts';
import { Module as ModuleSchema } from '../../shared/types';
import { z } from 'zod';
import { env } from '../env';
import type { User } from './auth';

export type CourseRow = typeof courses.$inferSelect;

export class AppError extends Error {
  constructor(public code: string, public status: 'BAD_REQUEST' | 'FORBIDDEN' | 'NOT_FOUND' | 'CONFLICT' | 'TOO_MANY_REQUESTS' | 'PAYMENT_REQUIRED' = 'BAD_REQUEST') { super(code); }
}

export async function userProfileKey(userId: number): Promise<ProfileKey> {
  const p = await db.select({ k: cognitiveProfiles.profileKey }).from(cognitiveProfiles).where(eq(cognitiveProfiles.userId, userId)).get();
  return (p?.k as ProfileKey) ?? DEFAULT_PROFILE;
}

export async function pickMethod(userId: number, profileKey: ProfileKey, override?: MethodKey) {
  if (override) return { method: override, reason: 'chosen' as const };
  const stats = (await db.select().from(methodStats).where(eq(methodStats.userId, userId)).all()) as MethodStat[];
  return chooseMethod(PROFILES[profileKey].defaultMethod, stats);
}

export interface CreateInput {
  topic?: string;
  level: Level;
  locale: Locale;
  method?: MethodKey;
  meb?: { grade: MebGrade; subject: string; unit?: string };
}

export async function createCourse(user: User, input: CreateInput) {
  if (user.plan !== 'premium' && user.role !== 'admin') {
    const used = (await db.select({ n: count() }).from(courses).where(eq(courses.userId, user.id)).get())?.n ?? 0;
    if (used >= env.FREE_COURSE_LIMIT) throw new AppError('limit_reached', 'PAYMENT_REQUIRED');
  }
  const active = await db.select({ id: jobs.id }).from(jobs)
    .where(and(eq(jobs.userId, user.id), eq(jobs.kind, 'generate'), inArray(jobs.stage, ['queued', 'profile', 'outline', 'writing', 'saving']))).get();
  if (active) throw new AppError('job_in_progress', 'CONFLICT');

  let topic = input.topic?.trim() ?? '';
  if (input.meb) {
    const s = mebSubject(input.meb.subject);
    const units = s?.units[input.meb.grade] ?? [];
    if (!s || !units.length) throw new AppError('bad_meb');
    if (input.meb.unit && !units.includes(input.meb.unit)) throw new AppError('bad_meb');
    topic = input.meb.unit ?? `${input.meb.grade}. Sınıf ${s.name(input.meb.grade)}`;
  }
  if (topic.length < 2 || topic.length > 120) throw new AppError('bad_topic');

  const profileKey = await userProfileKey(user.id);
  const { method } = await pickMethod(user.id, profileKey, input.method);
  const [c] = await db.insert(courses).values({
    userId: user.id, title: topic, topic, level: input.level, locale: input.locale, profileKey, method,
    source: input.meb ? 'meb' : 'free', mebGrade: input.meb?.grade, mebSubject: input.meb?.subject, mebUnit: input.meb?.unit,
    status: 'queued',
  }).returning().all();
  const jobId = crypto.randomUUID();
  await db.insert(jobs).values({ id: jobId, userId: user.id, courseId: c.id, stage: 'queued', percent: 2 }).run();
  enqueue(jobId);
  return { courseId: c.id, jobId };
}

/* ---------------- kuyruk ---------------- */
const queue: string[] = [];
let running = 0;
const CONCURRENCY = 2;

export function enqueue(jobId: string) {
  queue.push(jobId);
  pump();
}
function pump() {
  while (running < CONCURRENCY && queue.length) {
    const id = queue.shift()!;
    running++;
    runJob(id).catch((e) => console.error('[job]', id, e)).finally(() => { running--; pump(); });
  }
}

/** Sunucu yeniden başlarsa yarım kalan işleri yeniden kuyruğa al. */
export async function resumeJobs() {
  const open = await db.select({ id: jobs.id }).from(jobs).where(inArray(jobs.stage, ['queued', 'profile', 'outline', 'writing', 'saving'])).all();
  open.forEach((j) => enqueue(j.id));
  if (open.length) console.log(`[job] ${open.length} iş yeniden kuyruğa alındı`);
}

async function stage(jobId: string, s: string, percent: number) {
  await db.update(jobs).set({ stage: s, percent, updatedAt: Date.now() }).where(eq(jobs.id, jobId)).run();
}

async function runJob(jobId: string) {
  const job = await db.select().from(jobs).where(eq(jobs.id, jobId)).get();
  if (!job) return;
  const c = await db.select().from(courses).where(eq(courses.id, job.courseId)).get();
  if (!c) return;
  if (job.kind === 'translate') return runTranslate(jobId, c, job.locale as Locale);
  await db.update(courses).set({ status: 'generating' }).where(eq(courses.id, c.id)).run();
  const input: GenInput = {
    topic: c.topic, level: c.level, locale: c.locale, profileKey: c.profileKey as ProfileKey, method: c.method as MethodKey,
    meb: c.mebGrade && c.mebSubject ? { grade: c.mebGrade as MebGrade, subject: c.mebSubject, unit: c.mebUnit ?? undefined } : undefined,
  };
  try {
    await stage(jobId, 'profile', 8);
    let doc: CourseDoc;
    if (aiEnabled()) doc = await generateWithAi(jobId, input, c.userId);
    else doc = generateTemplateCourse(input);
    await stage(jobId, 'saving', 95);
    const valid = CourseDoc.parse(doc);
    await db.update(courses).set({ title: valid.title, doc: JSON.stringify(valid), moduleCount: valid.modules.length, generator: valid.generator, status: 'ready', updatedAt: Date.now() }).where(eq(courses.id, c.id)).run();
    await stage(jobId, 'done', 100);
  } catch (e) {
    console.error('[job] üretim hatası', (e as Error).message);
    await db.update(courses).set({ status: 'failed' }).where(eq(courses.id, c.id)).run();
    await db.update(jobs).set({ stage: 'failed', error: (e as Error).message.slice(0, 300), updatedAt: Date.now() }).where(eq(jobs.id, jobId)).run();
  }
}

async function generateWithAi(jobId: string, input: GenInput, userId: number): Promise<CourseDoc> {
  const system = systemFor(input.profileKey, input.method, input.locale);
  const subj = input.meb ? mebSubject(input.meb.subject) : undefined;
  await stage(jobId, 'outline', 14);
  let outline: Outline;
  try {
    outline = (await completeJSON({
      task: 'course.outline', system, userId,
      prompt: outlinePrompt({
        topic: input.topic, level: input.level, locale: input.locale,
        meb: input.meb && subj ? { grade: input.meb.grade, subjectName: subj.name(input.meb.grade), unit: input.meb.unit, units: subj.units[input.meb.grade] } : undefined,
      }),
    }, OutlineSchema)).data;
  } catch (e) {
    console.warn('[ai] taslak başarısız → şablon motoru:', (e as Error).message);
    return generateTemplateCourse(input);
  }
  await stage(jobId, 'writing', 38);
  const modules: Module[] = [];
  const total = outline.modules.length;
  let aiModules = 0;
  for (let i = 0; i < total; i++) {
    const om = outline.modules[i];
    try {
      const body = (await completeJSON({
        task: 'course.module', system, userId,
        prompt: modulePrompt({ courseTitle: outline.title, level: input.level, idx: i, total, mod: om, previous: outline.modules.slice(0, i).map((m) => m.title) }),
      }, ModuleBodySchema)).data;
      modules.push(completeModule(toModule(i, om.title, om.objectives, body), input));
      aiModules++;
    } catch (e) {
      console.warn(`[ai] modül ${i + 1} başarısız → şablon:`, (e as Error).message);
      modules.push(templateModule(input, i, { title: om.title, sections: om.sections }));
    }
    await stage(jobId, 'writing', 38 + Math.round(((i + 1) / total) * 47));
  }
  return {
    version: 1,
    title: outline.title, subtitle: outline.subtitle, topic: input.meb?.unit ?? input.topic,
    level: input.level, locale: input.locale, profileKey: input.profileKey, method: input.method,
    generator: aiModules > 0 ? 'ai' : 'template',
    objectives: outline.objectives, prerequisites: outline.prerequisites,
    modules, glossary: outline.glossary, sources: outline.sources,
    meb: input.meb ? { grade: input.meb.grade, subject: input.meb.subject, unit: input.meb.unit } : undefined,
  };
}

/* ---------------- okuma ---------------- */
export async function ownCourse(user: User, courseId: number): Promise<CourseRow> {
  const c = await db.select().from(courses).where(eq(courses.id, courseId)).get();
  if (!c) throw new AppError('not_found', 'NOT_FOUND');
  if (c.userId !== user.id && user.role !== 'admin') throw new AppError('forbidden', 'FORBIDDEN');
  return c;
}

export function parseDoc(raw: string | null): CourseDoc {
  if (!raw) throw new AppError('not_ready', 'CONFLICT');
  return CourseDoc.parse(JSON.parse(raw));
}

/** İstenen dilde belge (varsa çeviri), yoksa özgün. */
export async function docFor(c: CourseRow, locale?: Locale) {
  if (locale && locale !== c.locale) {
    const t = await db.select().from(courseTranslations).where(and(eq(courseTranslations.courseId, c.id), eq(courseTranslations.locale, locale))).get();
    if (t) return { doc: parseDoc(t.doc), locale };
  }
  return { doc: parseDoc(c.doc), locale: c.locale };
}

export async function listCourses(userId: number) {
  return db.select({
    id: courses.id, title: courses.title, topic: courses.topic, level: courses.level, locale: courses.locale,
    status: courses.status, source: courses.source, generator: courses.generator, profileKey: courses.profileKey,
    method: courses.method, moduleCount: courses.moduleCount, completedAt: courses.completedAt, createdAt: courses.createdAt,
  }).from(courses).where(eq(courses.userId, userId)).orderBy(desc(courses.id)).all();
}

export async function jobStatus(userId: number, jobId: string) {
  const j = await db.select().from(jobs).where(and(eq(jobs.id, jobId), eq(jobs.userId, userId))).get();
  if (!j) throw new AppError('not_found', 'NOT_FOUND');
  return { stage: j.stage, percent: j.percent, error: j.error, courseId: j.courseId, kind: j.kind, locale: j.locale };
}

export async function retryCourse(user: User, courseId: number) {
  const c = await ownCourse(user, courseId);
  if (c.status !== 'failed') throw new AppError('bad_state', 'CONFLICT');
  const jobId = crypto.randomUUID();
  await db.update(courses).set({ status: 'queued' }).where(eq(courses.id, c.id)).run();
  await db.insert(jobs).values({ id: jobId, userId: c.userId, courseId: c.id, stage: 'queued', percent: 2 }).run();
  enqueue(jobId);
  return { jobId };
}

export async function deleteCourse(user: User, courseId: number) {
  const c = await ownCourse(user, courseId);
  await db.delete(courses).where(eq(courses.id, c.id)).run();
}

export async function shareCourse(user: User, courseId: number) {
  const c = await ownCourse(user, courseId);
  if (c.shareSlug) return c.shareSlug;
  const slug = crypto.randomBytes(6).toString('base64url');
  await db.update(courses).set({ shareSlug: slug }).where(eq(courses.id, c.id)).run();
  return slug;
}

/* ---------------- çeviri (TR/EN/RU) ---------------- */
const MetaSchema = z.object({
  title: z.string().min(1).max(200), subtitle: z.string().min(1).max(300),
  objectives: z.array(z.string().min(1).max(240)).min(1).max(6),
  prerequisites: z.array(z.string().max(200)).max(5),
  glossary: z.array(z.object({ term: z.string().min(1).max(80), def: z.string().min(1).max(400) })).max(30),
});

/** Çeviri talebi: varsa hazır döner; yoksa kuyruğa iş ekler (şablon kurslar anında yeniden derlenir). */
export async function requestTranslation(user: User, courseId: number, to: Locale) {
  const c = await ownCourse(user, courseId);
  if (c.status !== 'ready') throw new AppError('not_ready', 'CONFLICT');
  if (c.locale === to) return { ready: true as const };
  const have = await db.select({ l: courseTranslations.locale }).from(courseTranslations)
    .where(and(eq(courseTranslations.courseId, c.id), eq(courseTranslations.locale, to))).get();
  if (have) return { ready: true as const };
  const doc = parseDoc(c.doc);
  if (doc.generator === 'template') {
    const tdoc = translateTemplate(c, to);
    await db.insert(courseTranslations).values({ courseId: c.id, locale: to, doc: JSON.stringify(tdoc) }).onConflictDoNothing().run();
    return { ready: true as const };
  }
  const open = await db.select({ id: jobs.id }).from(jobs)
    .where(and(eq(jobs.courseId, c.id), eq(jobs.kind, 'translate'), eq(jobs.locale, to), inArray(jobs.stage, ['queued', 'writing', 'saving']))).get();
  if (open) return { ready: false as const, jobId: open.id };
  const jobId = crypto.randomUUID();
  await db.insert(jobs).values({ id: jobId, userId: c.userId, courseId: c.id, kind: 'translate', locale: to, stage: 'queued', percent: 2 }).run();
  enqueue(jobId);
  return { ready: false as const, jobId };
}

function translateTemplate(c: CourseRow, to: Locale): CourseDoc {
  const doc = generateTemplateCourse({
    topic: c.topic, level: c.level, locale: to, profileKey: c.profileKey as ProfileKey, method: c.method as MethodKey,
    meb: c.mebGrade && c.mebSubject ? { grade: c.mebGrade as MebGrade, subject: c.mebSubject, unit: c.mebUnit ?? undefined } : undefined,
  });
  return CourseDoc.parse(doc);
}

async function runTranslate(jobId: string, c: CourseRow, to: Locale) {
  try {
    const src = parseDoc(c.doc);
    if (!aiEnabled()) {
      await db.insert(courseTranslations).values({ courseId: c.id, locale: to, doc: JSON.stringify(translateTemplate(c, to)) }).onConflictDoNothing().run();
      await stage(jobId, 'done', 100);
      return;
    }
    const system = `You are a professional educational translator. Output valid JSON only.`;
    await stage(jobId, 'writing', 10);
    const meta = (await completeJSON({
      task: 'translate.meta', system, userId: c.userId,
      prompt: translatePrompt(JSON.stringify({ title: src.title, subtitle: src.subtitle, objectives: src.objectives, prerequisites: src.prerequisites, glossary: src.glossary }), src.locale, to),
    }, MetaSchema)).data;
    const modules: Module[] = [];
    for (let i = 0; i < src.modules.length; i++) {
      const m = src.modules[i];
      try {
        const tm = (await completeJSON({ task: 'translate.module', system, userId: c.userId, prompt: translatePrompt(JSON.stringify(m), src.locale, to) }, ModuleSchema)).data;
        modules.push({ ...tm, idx: m.idx });
      } catch (e) {
        console.warn(`[ai] modül ${i + 1} çevirisi başarısız → özgün korunur:`, (e as Error).message);
        modules.push(m);
      }
      await stage(jobId, 'writing', 10 + Math.round(((i + 1) / src.modules.length) * 85));
    }
    const doc = CourseDoc.parse({ ...src, ...meta, locale: to, modules });
    await db.insert(courseTranslations).values({ courseId: c.id, locale: to, doc: JSON.stringify(doc) })
      .onConflictDoUpdate({ target: [courseTranslations.courseId, courseTranslations.locale], set: { doc: JSON.stringify(doc) } }).run();
    await stage(jobId, 'done', 100);
  } catch (e) {
    await db.update(jobs).set({ stage: 'failed', error: (e as Error).message.slice(0, 300), updatedAt: Date.now() }).where(eq(jobs.id, jobId)).run();
  }
}
