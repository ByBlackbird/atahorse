// Atahorse — paylaşılan alan modeli (sunucu + istemci). Tek doğruluk kaynağı: zod şemaları.
import { z } from 'zod';

export const LOCALES = ['tr', 'en', 'ru'] as const;
export const Locale = z.enum(LOCALES);
export type Locale = z.infer<typeof Locale>;

export const Level = z.enum(['beginner', 'intermediate', 'advanced']);
export type Level = z.infer<typeof Level>;

/** Teslim tercihi (kanal). Kanıt notu: tercih giriş modunu belirler, içeriği kısıtlamaz. */
export const Modality = z.enum(['visual', 'auditory', 'kinesthetic']);
export type Modality = z.infer<typeof Modality>;

/** Düşünme üslubu: analitik (yapı → ayrıntı) / bütüncül (resim → yapı). */
export const Reasoning = z.enum(['analytic', 'holistic']);
export type Reasoning = z.infer<typeof Reasoning>;

export const PROFILE_KEYS = [
  'visual-analytic', 'visual-holistic',
  'auditory-analytic', 'auditory-holistic',
  'kinesthetic-analytic', 'kinesthetic-holistic',
] as const;
export const ProfileKey = z.enum(PROFILE_KEYS);
export type ProfileKey = z.infer<typeof ProfileKey>;

export const METHOD_KEYS = ['feynman', 'socratic', 'first_principles', 'case_study', 'retrieval'] as const;
export const MethodKey = z.enum(METHOD_KEYS);
export type MethodKey = z.infer<typeof MethodKey>;

export const LearnMode = z.enum(['read', 'podcast', 'slides']);
export type LearnMode = z.infer<typeof LearnMode>;

export const VISUAL_TYPES = ['network', 'bars', 'orbit', 'pyramid', 'cycle', 'flow'] as const;
export const VisualType = z.enum(VISUAL_TYPES);
export type VisualType = z.infer<typeof VisualType>;

export const Bloom = z.enum(['remember', 'understand', 'apply', 'analyze', 'evaluate', 'create']);
export type Bloom = z.infer<typeof Bloom>;

const str = (max = 2000) => z.string().trim().min(1).max(max);

export const QuizItem = z.object({
  id: str(40),
  q: str(400),
  options: z.array(str(240)).min(2).max(5),
  correct: z.number().int().min(0).max(4),
  explain: str(600),
  bloom: Bloom.default('understand'),
}).refine((x) => x.correct < x.options.length, { message: 'correct out of range' });
export type QuizItem = z.infer<typeof QuizItem>;

export const Visual = z.object({
  type: VisualType,
  title: str(120),
  labels: z.array(str(48)).min(2).max(8),
  values: z.array(z.number().min(0).max(100)).max(8).optional(),
});
export type Visual = z.infer<typeof Visual>;

export const Section = z.object({
  id: str(40),
  heading: str(160),
  paragraphs: z.array(str(1600)).min(1).max(6),
  /** Analitik kutu: yapı, tanım, adım, neden-sonuç. */
  analytic: z.object({ title: str(80), points: z.array(str(260)).min(2).max(6) }),
  /** Bütüncül kutu: metafor, hikâye, büyük resim. */
  holistic: z.object({ title: str(80), text: str(700) }),
  example: str(900).optional(),
  check: QuizItem.optional(),
  visual: Visual.optional(),
});
export type Section = z.infer<typeof Section>;

export const Slide = z.object({
  id: str(40),
  kicker: str(80),
  title: str(140),
  bullets: z.array(str(200)).min(1).max(5),
  highlight: str(240),
  notes: str(1200),
  visual: Visual,
});
export type Slide = z.infer<typeof Slide>;

export const Task = z.object({
  title: str(160),
  steps: z.array(str(260)).min(1).max(6),
  evidence: z.enum(['check', 'note', 'audio']).default('check'),
  minutes: z.number().int().min(2).max(120).default(10),
});
export type Task = z.infer<typeof Task>;

export const Module = z.object({
  idx: z.number().int().min(0),
  title: str(160),
  summary: str(600),
  objectives: z.array(str(240)).min(1).max(5),
  minutes: z.number().int().min(5).max(240),
  sections: z.array(Section).min(1).max(8),
  keyPoints: z.array(str(260)).min(1).max(6),
  task: Task,
  quiz: z.array(QuizItem).min(2).max(6),
  slides: z.array(Slide).min(1).max(12),
});
export type Module = z.infer<typeof Module>;

export const CourseDoc = z.object({
  version: z.literal(1),
  title: str(200),
  subtitle: str(300),
  topic: str(120),
  level: Level,
  locale: Locale,
  profileKey: ProfileKey,
  method: MethodKey,
  generator: z.enum(['ai', 'template']),
  objectives: z.array(str(240)).min(1).max(6),
  prerequisites: z.array(str(200)).max(5).default([]),
  modules: z.array(Module).min(1).max(12),
  glossary: z.array(z.object({ term: str(80), def: str(400) })).max(30).default([]),
  sources: z.array(z.object({ title: str(200), url: z.string().url().optional(), note: z.string().max(200).optional() })).max(20).default([]),
  meb: z.object({ grade: z.string(), subject: z.string(), unit: z.string().optional() }).optional(),
});
export type CourseDoc = z.infer<typeof CourseDoc>;

export const MindNode = z.object({
  id: str(40),
  label: str(80),
  x: z.number().min(-5000).max(5000),
  y: z.number().min(-5000).max(5000),
  parentId: z.string().max(40).nullable(),
  kind: z.enum(['root', 'module', 'section', 'custom', 'ai']),
  moduleIdx: z.number().int().optional(),
  note: z.string().max(400).optional(),
});
export type MindNode = z.infer<typeof MindNode>;

export const AssistAction = z.enum(['explain', 'diagram', 'summarize', 'reteach', 'slides']);
export type AssistAction = z.infer<typeof AssistAction>;

export const AssistResult = z.object({
  action: AssistAction,
  title: z.string(),
  text: z.string(),
  bullets: z.array(z.string()).optional(),
  tree: z.array(z.object({ label: z.string(), children: z.array(z.string()) })).optional(),
  slides: z.array(Slide).optional(),
  method: MethodKey.optional(),
  source: z.enum(['ai', 'template', 'cache']),
});
export type AssistResult = z.infer<typeof AssistResult>;

export type JobStage = 'queued' | 'profile' | 'outline' | 'writing' | 'saving' | 'done' | 'failed';
