// Core Engine — deterministik kurs derleyici. AI çıktısı da buradaki yardımcılarla tamamlanır
// (eksik slayt/görsel/kontrol sorusu doldurma) böylece her kurs aynı pedagojik iskelete oturur.
import type { CourseDoc, Level, Locale, MethodKey, MindNode, Module, ProfileKey, QuizItem, Section, Slide, Visual, VisualType } from '../types';
import { BANKS, type Bank } from './bank';
import { METHODS } from './methods';
import { PROFILES } from './profiles';
import { mebSubject, type MebGrade } from './meb';
import { wordCount, readingMinutes } from './science';

export function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
export function rng(seed: number) {
  let a = seed || 1;
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** Doğru cevap 0. indekste gelir; deterministik karıştırır. */
export function shuffleOptions(options: string[], seed: string) {
  const r = rng(hash(seed));
  const idx = options.map((_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
  return { options: idx.map((i) => options[i]), correct: idx.indexOf(0) };
}

export interface GenInput {
  topic: string;
  level: Level;
  locale: Locale;
  profileKey: ProfileKey;
  method: MethodKey;
  meb?: { grade: MebGrade; subject: string; unit?: string };
}

const bankFor = (l: Locale): Bank => BANKS[l];

function checkFrom(b: Bank, k: number, t: string, f: string, id: string, bloom: QuizItem['bloom']): QuizItem {
  const c = b.checks[k % b.checks.length];
  const opts = typeof c.options === 'function' ? c.options(t, f) : c.options;
  const s = shuffleOptions(opts, id + t);
  return { id, q: c.q(t, f), options: s.options, correct: s.correct, explain: c.explain, bloom };
}

function visualFor(type: VisualType, title: string, labels: string[], seed: string): Visual {
  const r = rng(hash(seed));
  const ls = labels.map((l) => l.slice(0, 46)).slice(0, 6);
  while (ls.length < 3) ls.push(['A', 'B', 'C'][ls.length]);
  return { type, title: title.slice(0, 118), labels: ls, values: ls.map(() => Math.round(30 + r() * 65)) };
}

function paragraphs(b: Bank, method: MethodKey, level: Level, t: string, f: string) {
  const flow = METHODS[method].flow.map((beat) => b.beats[beat](t, f));
  return [flow.slice(0, 2).join(' '), flow.slice(2, 4).join(' '), `${flow[4] ?? ''} ${b.levelLine[level]}`.trim()];
}

export function buildSection(input: GenInput, b: Bank, moduleIdx: number, sIdx: number, heading: string, t: string): Section {
  const prof = PROFILES[input.profileKey];
  const id = `m${moduleIdx}s${sIdx}`;
  const f = heading;
  const vtype = prof.visuals[(moduleIdx + sIdx) % prof.visuals.length];
  const points = (prof.reasoning === 'analytic' ? b.analytic : [b.analytic[0], b.analytic[2], b.analytic[3]]).map((fn) => fn(t, f));
  return {
    id,
    heading,
    paragraphs: paragraphs(b, input.method, input.level, t, f),
    analytic: { title: b.analyticTitle, points },
    holistic: { title: b.holisticTitle, text: b.metaphors[(moduleIdx * 3 + sIdx) % b.metaphors.length](t, f) },
    example: b.example(t, f),
    check: checkFrom(b, moduleIdx + sIdx, t, f, `${id}c`, METHODS[input.method].checkBloom),
    visual: visualFor(vtype, heading, [t, ...points.map((p) => p.split(':')[0])], id + t),
  };
}

/** Slayt destesi — AI modülleri dahil her modül için aynı ray-sahne-panel kurgusu. */
export function buildSlides(mod: Omit<Module, 'slides'>, topic: string, locale: Locale, profileKey: ProfileKey): Slide[] {
  const b = bankFor(locale);
  const prof = PROFILES[profileKey];
  const v = (i: number): VisualType => prof.visuals[i % prof.visuals.length];
  const slides: Slide[] = [{
    id: `m${mod.idx}-intro`,
    kicker: b.slide.module(mod.idx + 1),
    title: mod.title,
    bullets: mod.objectives.slice(0, 3),
    highlight: mod.summary.slice(0, 238),
    notes: b.slide.notesIntro(topic, mod.title),
    visual: visualFor('network', mod.title, [topic, ...mod.sections.map((s) => s.heading)], mod.title),
  }];
  mod.sections.forEach((s, i) => {
    slides.push({
      id: `m${mod.idx}-s${i}`,
      kicker: b.slide.section(i + 1),
      title: s.heading,
      bullets: s.analytic.points.slice(0, 3).map((p) => p.slice(0, 198)),
      highlight: s.holistic.text.slice(0, 238),
      notes: `${b.slide.notesSection(topic, s.heading)} ${s.paragraphs[0].slice(0, 600)}`.slice(0, 1190),
      visual: s.visual ?? visualFor(v(i), s.heading, s.analytic.points.map((p) => p.split(':')[0]), s.id),
    });
  });
  slides.push({
    id: `m${mod.idx}-task`,
    kicker: b.slide.task,
    title: mod.task.title,
    bullets: mod.task.steps.slice(0, 4).map((x) => x.slice(0, 198)),
    highlight: b.slide.taskHighlight,
    notes: b.slide.notesTask(mod.task.title),
    visual: visualFor('flow', mod.task.title, mod.task.steps.map((_, i) => `${i + 1}`), mod.task.title),
  });
  slides.push({
    id: `m${mod.idx}-recap`,
    kicker: b.slide.recap,
    title: b.slide.recapTitle,
    bullets: mod.keyPoints.slice(0, 3).map((x) => x.slice(0, 198)),
    highlight: mod.summary.slice(0, 238),
    notes: b.slide.notesRecap,
    visual: visualFor('pyramid', b.slide.recapTitle, mod.keyPoints.map((_, i) => `${i + 1}`), mod.summary),
  });
  return slides;
}

export function templateModule(input: GenInput, idx: number, override?: { title?: string; sections?: string[]; topicForText?: string }): Module {
  const b = bankFor(input.locale);
  const meb = input.meb && input.locale === 'tr' && input.meb.unit ? b.meb : null;
  const subjectScope = input.meb && !input.meb.unit;
  const t = override?.topicForText ?? input.topic;
  const arche = meb ? meb[idx % meb.length] : b.archetypes[idx % b.archetypes.length];
  let title: string, summary: string, objectives: string[], headings: string[], task: Module['task'];
  if (subjectScope) {
    const o = b.mebOverview;
    title = override?.title ?? t;
    summary = o.summary(t); objectives = o.objectives(t); headings = override?.sections ?? o.sections;
    task = { title: o.task.title, steps: o.task.steps(t), evidence: 'note', minutes: 15 };
  } else {
    title = override?.title ?? arche.title(t);
    summary = arche.summary(t); objectives = arche.objectives(t); headings = override?.sections ?? arche.sections;
    task = { title: arche.task.title, steps: arche.task.steps(t), evidence: idx === 0 ? 'check' : 'note', minutes: 10 + idx * 3 };
  }
  const sections = headings.map((h, i) => buildSection(input, b, idx, i, h, t));
  const keyPoints = headings.slice(0, 3).map((h, i) => b.keyPoint[(idx + i) % b.keyPoint.length](t, h));
  const quiz = [0, 1, 2].map((k) => checkFrom(b, idx + k + 2, t, headings[k % headings.length], `m${idx}q${k}`, (['remember', 'understand', 'apply'] as const)[k]));
  const words = sections.reduce((n, s) => n + wordCount(s.paragraphs.join(' ')) + wordCount(s.holistic.text) + s.analytic.points.length * 10, 0);
  const base = { idx, title, summary, objectives, minutes: readingMinutes(words) + task.minutes, sections, keyPoints, task, quiz };
  return { ...base, slides: buildSlides(base, t, input.locale, input.profileKey) };
}

export function generateTemplateCourse(input: GenInput): CourseDoc {
  const b = bankFor(input.locale);
  const prof = PROFILES[input.profileKey];
  const method = METHODS[input.method];
  let modules: Module[];
  let topic = input.topic;
  let mebTitle: string | null = null;
  if (input.meb) {
    const subj = mebSubject(input.meb.subject);
    const sName = subj?.name(input.meb.grade) ?? input.meb.subject;
    if (input.meb.unit) {
      topic = input.meb.unit;
      mebTitle = `${input.meb.grade}. ${input.locale === 'tr' ? 'Sınıf' : 'Grade'} ${sName} · ${input.meb.unit}`;
      modules = Array.from({ length: 6 }, (_, i) => templateModule({ ...input, topic }, i, input.locale === 'tr' ? undefined : { topicForText: topic }));
    } else {
      const units = (subj?.units[input.meb.grade] ?? []).slice(0, 10);
      topic = `${input.meb.grade}. ${input.locale === 'tr' ? 'Sınıf' : 'Grade'} ${sName}`;
      modules = units.map((u, i) => templateModule({ ...input, topic: u }, i, { title: u, topicForText: u }));
    }
  } else {
    modules = Array.from({ length: 6 }, (_, i) => templateModule(input, i));
  }
  return {
    version: 1,
    title: mebTitle ?? (input.meb ? topic : b.title(topic, input.level)),
    subtitle: b.subtitle(topic, prof.name[input.locale], method.name[input.locale]),
    topic,
    level: input.level,
    locale: input.locale,
    profileKey: input.profileKey,
    method: input.method,
    generator: 'template',
    objectives: b.objectives(topic),
    prerequisites: b.prereq[input.level],
    modules,
    glossary: [],
    sources: b.sources(topic),
    meb: input.meb ? { grade: input.meb.grade, subject: input.meb.subject, unit: input.meb.unit } : undefined,
  };
}

/** AI modülünü normalize et: slayt yoksa üret, eksik kontrol/görselleri tamamla. */
export function completeModule(mod: Omit<Module, 'slides'> & { slides?: Slide[] }, input: GenInput): Module {
  const b = bankFor(input.locale);
  const prof = PROFILES[input.profileKey];
  const sections = mod.sections.map((s, i) => ({
    ...s,
    id: `m${mod.idx}s${i}`,
    check: s.check ? { ...s.check, id: `m${mod.idx}s${i}c` } : checkFrom(b, mod.idx + i, input.topic, s.heading, `m${mod.idx}s${i}c`, 'understand'),
    visual: s.visual ?? visualFor(prof.visuals[i % prof.visuals.length], s.heading, s.analytic.points.map((p) => p.split(':')[0]), s.heading),
  }));
  const quiz = mod.quiz.map((q, k) => ({ ...q, id: `m${mod.idx}q${k}` }));
  const base = { ...mod, sections, quiz };
  const slides = mod.slides?.length ? mod.slides.map((s, i) => ({ ...s, id: `m${mod.idx}-x${i}` })) : buildSlides(base, input.topic, input.locale, input.profileKey);
  return { ...base, slides };
}

export function moduleWords(m: Module) {
  return m.sections.reduce((n, s) => n + wordCount(s.paragraphs.join(' ')) + wordCount(s.holistic.text) + wordCount(s.analytic.points.join(' ')), 0);
}

/* ---------------- Podcast senaryosu ---------------- */
export interface PodcastLine { id: string; sectionId: string | null; kind: 'intro' | 'body' | 'box' | 'recap'; text: string }

export function splitSentences(text: string): string[] {
  return (text.replace(/\s+/g, ' ').match(/[^.!?…]+[.!?…]+["”»]?|[^.!?…]+$/g) || [])
    .map((s) => s.trim()).filter((s) => s.length > 1);
}

const PODCAST_CUES: Record<Locale, { intro: (t: string) => string; box: string; recap: string }> = {
  tr: { intro: (t) => `Hoş geldin. Bu bölümde “${t}” modülünü dinliyoruz.`, box: 'Şimdi büyük resme bakalım.', recap: 'Kısa bir özet:' },
  en: { intro: (t) => `Welcome. In this episode we listen to the module “${t}”.`, box: 'Now, the big picture.', recap: 'A quick recap:' },
  ru: { intro: (t) => `Добро пожаловать. В этом выпуске — модуль «${t}».`, box: 'Теперь — общая картина.', recap: 'Коротко об итогах:' },
};

export type PodcastSource = Pick<Module, 'title' | 'summary' | 'keyPoints'> & { sections: Pick<Section, 'id' | 'heading' | 'paragraphs' | 'holistic'>[] };

export function podcastScript(m: PodcastSource, locale: Locale): PodcastLine[] {
  const c = PODCAST_CUES[locale];
  const out: PodcastLine[] = [];
  const push = (sectionId: string | null, kind: PodcastLine['kind'], text: string) =>
    splitSentences(text).forEach((s) => out.push({ id: `p${out.length}`, sectionId, kind, text: s }));
  push(null, 'intro', `${c.intro(m.title)} ${m.summary}`);
  for (const s of m.sections) {
    push(s.id, 'body', `${s.heading}. ${s.paragraphs.join(' ')}`);
    push(s.id, 'box', `${c.box} ${s.holistic.text}`);
  }
  push(null, 'recap', `${c.recap} ${m.keyPoints.join(' ')}`);
  return out;
}

/* ---------------- Zihin haritası tohumu + otomatik yerleşim ---------------- */
export function seedMindmap(course: CourseDoc): MindNode[] {
  const nodes: MindNode[] = [{ id: 'root', label: course.topic.slice(0, 78), x: 0, y: 0, parentId: null, kind: 'root' }];
  course.modules.forEach((m, i) => {
    nodes.push({ id: `m${i}`, label: m.title.replace(`${course.topic}: `, '').slice(0, 78), x: 0, y: 0, parentId: 'root', kind: 'module', moduleIdx: i });
    m.sections.forEach((s, j) => nodes.push({ id: `m${i}s${j}`, label: s.heading.slice(0, 78), x: 0, y: 0, parentId: `m${i}`, kind: 'section', moduleIdx: i }));
  });
  return autoLayout(nodes);
}

/** Radyal ağaç yerleşimi: yaprak sayısına orantılı açı dilimleri, derinliğe göre yarıçap. */
export function autoLayout(nodes: MindNode[]): MindNode[] {
  const byParent = new Map<string | null, MindNode[]>();
  for (const n of nodes) { const k = n.parentId; byParent.set(k, [...(byParent.get(k) ?? []), n]); }
  const roots = byParent.get(null) ?? [];
  const leaves = (n: MindNode): number => { const ch = byParent.get(n.id) ?? []; return ch.length ? ch.reduce((s, c) => s + leaves(c), 0) : 1; };
  const out = new Map<string, MindNode>();
  const R = [0, 260, 470, 650, 800];
  const place = (n: MindNode, depth: number, a0: number, a1: number) => {
    const a = (a0 + a1) / 2;
    const r = R[Math.min(depth, R.length - 1)] + (depth > 4 ? (depth - 4) * 140 : 0);
    out.set(n.id, { ...n, x: Math.round(Math.cos(a) * r), y: Math.round(Math.sin(a) * r * 0.78) });
    const ch = byParent.get(n.id) ?? [];
    const total = ch.reduce((s, c) => s + leaves(c), 0) || 1;
    let cur = a0;
    for (const c of ch) { const span = ((a1 - a0) * leaves(c)) / total; place(c, depth + 1, cur, cur + span); cur += span; }
  };
  roots.forEach((r, i) => place(r, 0, -Math.PI + (i * 2 * Math.PI) / roots.length, Math.PI + (i * 2 * Math.PI) / roots.length));
  // Ebeveyni kayıp düğümler (veri bütünlüğü): kökün altına
  for (const n of nodes) if (!out.has(n.id)) out.set(n.id, { ...n, parentId: 'root' });
  return nodes.map((n) => out.get(n.id)!);
}
