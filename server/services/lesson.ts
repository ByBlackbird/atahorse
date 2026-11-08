// Anlatımlı görsel ders servisi: kilit denetimi → önbellek → (AI | şablon) → doğrula → sakla.
// Bölüm sonu soruları her zaman kurs belgesinden eklenir; AI yalnız anlatım + şema üretir.
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/client';
import { visualLessons } from '../db/schema';
import type { Locale, Module } from '../../shared/types';
import { ICONS, Lesson, Scene, templateLesson, withChecks } from '../../shared/engine/lesson';
import { PROFILES } from '../../shared/engine/profiles';
import { aiEnabled, completeJSON } from '../ai/provider';
import { lessonPrompt, systemFor } from '../ai/prompts';
import { assertUnlocked } from './learning';
import { docFor, ownCourse } from './courses';
import type { User } from './auth';

const TeachOnly = z.object({ scenes: z.array(Scene).min(4).max(30) });
const inflight = new Map<string, Promise<Lesson>>();

async function build(mod: Module, locale: Locale, profileKey: Parameters<typeof templateLesson>[2], method: Parameters<typeof systemFor>[1], userId: number): Promise<Lesson> {
  const fallback = () => templateLesson(mod, locale, profileKey);
  if (!aiEnabled()) return fallback();
  try {
    const body = { title: mod.title, summary: mod.summary, objectives: mod.objectives, sections: mod.sections.map((s, i) => ({ sectionIdx: i, heading: s.heading, paragraphs: s.paragraphs, points: s.analytic.points, picture: s.holistic.text, example: s.example })), task: mod.task, keyPoints: mod.keyPoints };
    const r = await completeJSON({ task: 'lesson.visual', system: systemFor(profileKey, method, locale), prompt: lessonPrompt(JSON.stringify(body), ICONS, PROFILES[profileKey].reasoning === 'analytic'), userId }, TeachOnly);
    const valid = r.data.scenes.filter((s) => s.kind === 'teach' && s.sectionIdx < mod.sections.length);
    return Lesson.parse({ version: 1, moduleIdx: mod.idx, title: mod.title, scenes: withChecks(mod, valid), source: 'ai' });
  } catch {
    return fallback();
  }
}

export async function getLesson(user: User, courseId: number, moduleIdx: number, locale?: Locale): Promise<Lesson> {
  const c = await ownCourse(user, courseId);
  await assertUnlocked(user.id, c, moduleIdx);
  const { doc, locale: loc } = await docFor(c, locale);
  const mod = doc.modules[moduleIdx];
  const hit = await db.select().from(visualLessons).where(and(eq(visualLessons.courseId, c.id), eq(visualLessons.moduleIdx, moduleIdx), eq(visualLessons.locale, loc))).get();
  if (hit) {
    const parsed = Lesson.safeParse(JSON.parse(hit.doc));
    // Şablon sürümü AI açıldığında yeniden üretilsin
    if (parsed.success && !(parsed.data.source === 'template' && aiEnabled())) return parsed.data;
  }
  const key = `${c.id}:${moduleIdx}:${loc}`;
  let p = inflight.get(key);
  if (!p) {
    p = (async () => {
      const lesson = await build(mod, loc, doc.profileKey, doc.method, user.id);
      await db.insert(visualLessons).values({ courseId: c.id, moduleIdx, locale: loc, doc: JSON.stringify(lesson), source: lesson.source })
        .onConflictDoUpdate({ target: [visualLessons.courseId, visualLessons.moduleIdx, visualLessons.locale], set: { doc: JSON.stringify(lesson), source: lesson.source, createdAt: Date.now() } }).run();
      return lesson;
    })().finally(() => inflight.delete(key));
    inflight.set(key, p);
  }
  return p;
}
