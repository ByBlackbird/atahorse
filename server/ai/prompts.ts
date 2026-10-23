// İstem şablonları. Sistem talimatı = öğrenme bilimi çekirdeği + profil + metot.
// Çıktılar zod ile doğrulanır; şema metni istemde açıkça verilir (model-agnostik JSON modu).
import { z } from 'zod';
import { QuizItem, Section, Task, type Level, type Locale, type MethodKey, type Module, type ProfileKey } from '../../shared/types';
import { PROFILES } from '../../shared/engine/profiles';
import { METHODS } from '../../shared/engine/methods';
import { SCIENCE_DIRECTIVE } from '../../shared/engine/science';

export const LANG_NAME: Record<Locale, string> = { tr: 'Turkish', en: 'English', ru: 'Russian' };
const LEVEL_DESC: Record<Level, string> = {
  beginner: 'beginner (no prior knowledge; define every term, concrete examples)',
  intermediate: 'intermediate (knows basics; connect concepts, justify, apply)',
  advanced: 'advanced (fluent in basics; edge cases, trade-offs, alternative models)',
};

export function systemFor(profileKey: ProfileKey, method: MethodKey, locale: Locale) {
  const p = PROFILES[profileKey];
  const m = METHODS[method];
  return [
    SCIENCE_DIRECTIVE,
    '',
    `Learner delivery profile: ${p.name.en} (${p.modality}/${p.reasoning}). ${p.directive}`,
    `Teaching method: ${m.name.en}. ${m.directive}`,
    `Write ALL learner-facing text in ${LANG_NAME[locale]} only. Never mix languages.`,
    'Respond with valid JSON only. No markdown fences, no commentary.',
  ].join('\n');
}

/* ---------------- taslak ---------------- */
export const OutlineSchema = z.object({
  title: z.string().min(3).max(200),
  subtitle: z.string().min(3).max(300),
  objectives: z.array(z.string().min(3).max(240)).min(2).max(6),
  prerequisites: z.array(z.string().max(200)).max(5).default([]),
  modules: z.array(z.object({
    title: z.string().min(3).max(160),
    summary: z.string().min(3).max(600),
    objectives: z.array(z.string().min(3).max(240)).min(1).max(5),
    sections: z.array(z.string().min(2).max(160)).min(2).max(5),
  })).min(3).max(10),
  glossary: z.array(z.object({ term: z.string().min(1).max(80), def: z.string().min(1).max(400) })).max(20).default([]),
  sources: z.array(z.object({ title: z.string().min(2).max(200), url: z.string().url().optional(), note: z.string().max(200).optional() })).max(10).default([]),
});
export type Outline = z.infer<typeof OutlineSchema>;

export function outlinePrompt(o: { topic: string; level: Level; locale: Locale; meb?: { grade: string; subjectName: string; unit?: string; units?: string[] } }) {
  const scope = o.meb
    ? o.meb.unit
      ? `Turkish national curriculum (MEB), grade ${o.meb.grade}, subject "${o.meb.subjectName}", unit "${o.meb.unit}". Align with the official learning outcomes (kazanımlar) for this grade; use age-appropriate language. Create exactly 6 modules: outcomes & prior knowledge, core concepts, worked examples, practice & problem solving, common mistakes, mixed review.`
      : `Turkish national curriculum (MEB), grade ${o.meb.grade}, subject "${o.meb.subjectName}". Create one module per unit, in this order: ${(o.meb.units ?? []).map((u) => `"${u}"`).join(', ')}.`
    : `Topic: "${o.topic}". Create exactly 6 modules progressing from foundations to synthesis (foundations → core concepts → mechanisms → worked application → mistakes/edge cases → synthesis project).`;
  return `${scope}
Level: ${LEVEL_DESC[o.level]}.
Return JSON:
{
  "title": string, "subtitle": string,
  "objectives": string[3-4]  // measurable, start with an action verb (Bloom),
  "prerequisites": string[0-3],
  "modules": [{ "title": string, "summary": string (1-2 sentences), "objectives": string[2-3], "sections": string[3-4] /* section headings */ }],
  "glossary": [{ "term": string, "def": string }] (6-10 items),
  "sources": [{ "title": string, "url"?: string, "note"?: string }] (3-6 reputable, stable sources: textbooks, official bodies, university courses; OMIT "url" unless you are certain it exists)
}`;
}

/* ---------------- derin modül ---------------- */
export const ModuleBodySchema = z.object({
  summary: z.string().min(3).max(600),
  minutes: z.number().int().min(5).max(240).optional(),
  sections: z.array(Section).min(2).max(5),
  keyPoints: z.array(z.string().min(3).max(260)).min(2).max(6),
  task: Task,
  quiz: z.array(QuizItem).min(3).max(5),
});
export type ModuleBody = z.infer<typeof ModuleBodySchema>;

export function modulePrompt(o: { courseTitle: string; level: Level; idx: number; total: number; mod: Outline['modules'][number]; previous: string[] }) {
  return `Course: "${o.courseTitle}" — module ${o.idx + 1} of ${o.total}: "${o.mod.title}".
Module objectives: ${o.mod.objectives.join(' | ')}
Section headings to write, in order: ${o.mod.sections.map((s) => `"${s}"`).join(', ')}
Already covered in previous modules (do not repeat, build on it): ${o.previous.join(' | ') || 'nothing yet'}
Level: ${LEVEL_DESC[o.level]}.

Return JSON:
{
  "summary": string,
  "minutes": number,
  "sections": [{
    "id": "s1", "heading": string,
    "paragraphs": string[2-4]   // 180-320 words total per section, concrete, accurate,
    "analytic": { "title": string, "points": string[3-5] },     // definitions, steps, cause→effect
    "holistic": { "title": string, "text": string },            // metaphor / big picture, 2-4 sentences
    "example": string,                                          // a worked, realistic example
    "check": { "id": "c1", "q": string, "options": string[4], "correct": 0-3, "explain": string, "bloom": "remember|understand|apply|analyze" },
    "visual": { "type": "network|bars|orbit|pyramid|cycle|flow", "title": string, "labels": string[3-6] /* max 4 words each */, "values"?: number[] /* 0-100, only for bars */ }
  }],
  "keyPoints": string[3-4],
  "task": { "title": string, "steps": string[3-4], "evidence": "check|note|audio", "minutes": number },
  "quiz": [{ "id": "q1", "q": string, "options": string[4], "correct": 0-3, "explain": string, "bloom": string }] (3-5 items spanning remember→analyze; vary the correct index)
}`;
}

export function toModule(idx: number, title: string, objectives: string[], body: ModuleBody): Omit<Module, 'slides'> {
  return {
    idx, title, objectives,
    summary: body.summary,
    minutes: body.minutes ?? 25,
    sections: body.sections,
    keyPoints: body.keyPoints,
    task: body.task,
    quiz: body.quiz,
  };
}

/* ---------------- asistan ---------------- */
export const ExplainSchema = z.object({ title: z.string(), text: z.string(), bullets: z.array(z.string()).max(6).default([]) });
export const DiagramSchema = z.object({ title: z.string(), tree: z.array(z.object({ label: z.string().max(60), children: z.array(z.string().max(60)).max(6) })).min(2).max(7) });
export const SuggestSchema = z.object({ branches: z.array(z.string().min(2).max(60)).min(2).max(6) });

export const assistPrompts = {
  explain: (ctx: string) => `Explain this module section again in a fresh way: one vivid everyday example, then a precise explanation, then 3 bullet takeaways.\n\nContent:\n${ctx}\n\nReturn JSON: { "title": string, "text": string (120-220 words), "bullets": string[3] }`,
  summarize: (ctx: string) => `Summarize for quick review (spoken-friendly, 80-140 words) and give 4 key bullets.\n\nContent:\n${ctx}\n\nReturn JSON: { "title": string, "text": string, "bullets": string[4] }`,
  diagram: (ctx: string) => `Turn this content into a hierarchical concept diagram: 3-6 main nodes, each with 2-4 short children (max 4 words each).\n\nContent:\n${ctx}\n\nReturn JSON: { "title": string, "tree": [{ "label": string, "children": string[] }] }`,
  reteach: (ctx: string, methodName: string, directive: string) => `Re-teach this content using ${methodName}. ${directive} 150-260 words, end with one self-check question.\n\nContent:\n${ctx}\n\nReturn JSON: { "title": string, "text": string, "bullets": string[2-4] }`,
  slides: (ctx: string) => `Create a 5-slide presentation deck from this content.\n\nContent:\n${ctx}\n\nReturn JSON: { "slides": [{ "id": "x1", "kicker": string (1-3 words), "title": string, "bullets": string[2-4], "highlight": string, "notes": string (speaker notes, 40-90 words), "visual": { "type": "network|bars|orbit|pyramid|cycle|flow", "title": string, "labels": string[3-5], "values"?: number[] } }] }`,
  suggest: (topic: string, branch: string, existing: string[]) => `Mind map for "${topic}". Suggest 4 new, specific sub-branches for the node "${branch}" that deepen understanding (not duplicates of: ${existing.join(', ') || 'none'}). Max 5 words each.\nReturn JSON: { "branches": string[4] }`,
};

/* ---------------- çeviri ---------------- */
export function translatePrompt(json: string, from: Locale, to: Locale) {
  return `Translate every learner-facing string value in this JSON from ${LANG_NAME[from]} to ${LANG_NAME[to]}.
Rules: keep the exact JSON structure, keys, ids, numbers, enum values ("type", "bloom", "evidence") and URLs unchanged; translate meaning faithfully, natural register; do not add or drop items.
JSON:
${json}`;
}
