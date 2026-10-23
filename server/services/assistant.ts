// AI Asistan + zihin haritası servisleri. AI varsa yönlendirilmiş model, yoksa/başarısızsa şablon.
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/client';
import { mindmaps } from '../db/schema';
import { MindNode, Slide, type AssistAction, type AssistResult, type Locale, type MethodKey } from '../../shared/types';
import { sectionContext, templateAssist, templateBranches } from '../../shared/engine/assist';
import { autoLayout, completeModule, seedMindmap } from '../../shared/engine/generate';
import { METHODS } from '../../shared/engine/methods';
import { aiEnabled, completeJSON } from '../ai/provider';
import { DiagramSchema, ExplainSchema, SuggestSchema, assistPrompts, systemFor } from '../ai/prompts';
import { AppError, docFor, ownCourse, parseDoc } from './courses';
import type { User } from './auth';

const SlidesSchema = z.object({ slides: z.array(Slide).min(3).max(8) });

export async function assist(user: User, courseId: number, moduleIdx: number, sectionIdx: number | null, action: AssistAction, locale: Locale, method?: MethodKey): Promise<AssistResult> {
  const c = await ownCourse(user, courseId);
  const { doc } = await docFor(c, locale);
  const m = doc.modules[moduleIdx];
  if (!m) throw new AppError('bad_module');
  const s = sectionIdx !== null ? m.sections[sectionIdx] : undefined;
  const fallback = () => templateAssist(action, doc, m, s, locale, method);
  if (!aiEnabled()) return fallback();

  const system = systemFor(doc.profileKey, method ?? doc.method, locale);
  const ctx = sectionContext(m, s);
  try {
    switch (action) {
      case 'explain': {
        const r = await completeJSON({ task: 'assist.explain', system, prompt: assistPrompts.explain(ctx), userId: user.id }, ExplainSchema);
        return { action, ...r.data, source: r.source };
      }
      case 'summarize': {
        const r = await completeJSON({ task: 'assist.summarize', system, prompt: assistPrompts.summarize(ctx), userId: user.id }, ExplainSchema);
        return { action, ...r.data, source: r.source };
      }
      case 'diagram': {
        const r = await completeJSON({ task: 'assist.diagram', system, prompt: assistPrompts.diagram(ctx), userId: user.id }, DiagramSchema);
        return { action, title: r.data.title, text: m.summary, tree: r.data.tree, source: r.source };
      }
      case 'reteach': {
        const key = method ?? doc.method;
        const md = METHODS[key];
        const r = await completeJSON({ task: 'assist.reteach', system, prompt: assistPrompts.reteach(ctx, md.name.en, md.directive), userId: user.id }, ExplainSchema);
        return { action, ...r.data, method: key, source: r.source };
      }
      case 'slides': {
        const r = await completeJSON({ task: 'assist.slides', system, prompt: assistPrompts.slides(ctx), userId: user.id }, SlidesSchema);
        const slides = completeModule({ ...m, slides: r.data.slides }, { topic: doc.topic, level: doc.level, locale, profileKey: doc.profileKey, method: doc.method }).slides;
        return { action, title: fallback().title, text: fallback().text.replace(/\d+/, String(slides.length)), slides, source: r.source };
      }
    }
  } catch (e) {
    console.warn(`[assist] ${action} AI başarısız → şablon:`, (e as Error).message);
    return fallback();
  }
}

/* ---------------- zihin haritası ---------------- */
const NodesSchema = z.array(MindNode).min(1).max(250);

export async function getMindmap(user: User, courseId: number) {
  const c = await ownCourse(user, courseId);
  const row = await db.select().from(mindmaps).where(and(eq(mindmaps.userId, user.id), eq(mindmaps.courseId, c.id))).get();
  if (row) return { nodes: NodesSchema.parse(JSON.parse(row.nodes)), updatedAt: row.updatedAt };
  return { nodes: seedMindmap(parseDoc(c.doc)), updatedAt: null };
}

export async function saveMindmap(user: User, courseId: number, nodes: MindNode[]) {
  const c = await ownCourse(user, courseId);
  const valid = NodesSchema.parse(nodes);
  const ids = new Set(valid.map((n) => n.id));
  if (ids.size !== valid.length) throw new AppError('bad_nodes');
  if (valid.filter((n) => n.parentId === null).length !== 1) throw new AppError('bad_nodes');
  const clean = valid.map((n) => (n.parentId && !ids.has(n.parentId) ? { ...n, parentId: 'root' } : n));
  const json = JSON.stringify(clean);
  await db.insert(mindmaps).values({ userId: user.id, courseId: c.id, nodes: json, updatedAt: Date.now() })
    .onConflictDoUpdate({ target: [mindmaps.userId, mindmaps.courseId], set: { nodes: json, updatedAt: Date.now() } }).run();
  return { ok: true, count: clean.length };
}

export const layoutMindmap = (nodes: MindNode[]) => autoLayout(NodesSchema.parse(nodes));

export async function suggestBranches(user: User, courseId: number, nodes: MindNode[], nodeId: string, locale: Locale) {
  const c = await ownCourse(user, courseId);
  const { doc } = await docFor(c, locale);
  const node = nodes.find((n) => n.id === nodeId);
  if (!node) throw new AppError('bad_nodes');
  const siblings = nodes.filter((n) => n.parentId === nodeId).map((n) => n.label);
  if (aiEnabled()) {
    try {
      const r = await completeJSON({
        task: 'mindmap.suggest', system: systemFor(doc.profileKey, doc.method, locale), userId: user.id,
        prompt: assistPrompts.suggest(doc.topic, node.label, siblings),
      }, SuggestSchema);
      return { branches: r.data.branches.slice(0, 4), source: r.source };
    } catch (e) {
      console.warn('[mindmap] AI öneri başarısız → şablon:', (e as Error).message);
    }
  }
  return { branches: templateBranches(doc, nodes, nodeId, locale), source: 'template' as const };
}
