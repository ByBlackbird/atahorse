// AI katmanı — model-agnostik adaptör + görev yönlendirme + önbellek + kullanım kaydı.
// Kural: kısa özet/çeviri/öneri → hafif model; müfredat taslağı/derin modül yazımı → ağır model.
import { z } from 'zod';
import { env, modelsFor, resolveProvider, type ProviderName } from '../env';
import { db } from '../db/client';
import { aiUsage } from '../db/schema';
import { cacheKey, getExact, getSemantic, put } from './cache';

export type Tier = 'light' | 'heavy';
export type Task =
  | 'course.outline' | 'course.module'
  | 'assist.explain' | 'assist.summarize' | 'assist.diagram' | 'assist.reteach' | 'assist.slides'
  | 'mindmap.suggest' | 'translate.module' | 'translate.meta';

interface Route { tier: Tier; maxTokens: number; temperature: number; cacheDays: number; semantic: boolean }

/** Görev → model katmanı tablosu (maliyet yönlendirmesi burada tek yerde). */
export const ROUTES: Record<Task, Route> = {
  'course.outline':   { tier: 'heavy', maxTokens: 2200,  temperature: 0.4, cacheDays: 30, semantic: true },
  'course.module':    { tier: 'heavy', maxTokens: 9000,  temperature: 0.5, cacheDays: 30, semantic: false },
  'assist.explain':   { tier: 'light', maxTokens: 1200,  temperature: 0.5, cacheDays: 14, semantic: true },
  'assist.summarize': { tier: 'light', maxTokens: 700,   temperature: 0.3, cacheDays: 30, semantic: true },
  'assist.diagram':   { tier: 'light', maxTokens: 900,   temperature: 0.3, cacheDays: 30, semantic: true },
  'assist.reteach':   { tier: 'heavy', maxTokens: 1600,  temperature: 0.6, cacheDays: 14, semantic: true },
  'assist.slides':    { tier: 'light', maxTokens: 2400,  temperature: 0.4, cacheDays: 30, semantic: true },
  'mindmap.suggest':  { tier: 'light', maxTokens: 500,   temperature: 0.7, cacheDays: 7,  semantic: false },
  'translate.module': { tier: 'light', maxTokens: 9000,  temperature: 0.2, cacheDays: 90, semantic: false },
  'translate.meta':   { tier: 'light', maxTokens: 1500,  temperature: 0.2, cacheDays: 90, semantic: false },
};

const provider: ProviderName = resolveProvider();
const models = modelsFor(provider);
export const aiInfo = () => ({ provider, models, enabled: provider !== 'none', embeddings: !!env.AI_EMBED_MODEL && (provider === 'openai' || provider === 'ollama') });
export const aiEnabled = () => provider !== 'none';

/* ---------------- eşzamanlılık sınırlayıcı ---------------- */
class Semaphore {
  private q: (() => void)[] = [];
  constructor(private n: number) {}
  async run<T>(fn: () => Promise<T>): Promise<T> {
    if (this.n <= 0) await new Promise<void>((r) => this.q.push(r));
    this.n--;
    try { return await fn(); } finally { this.n++; this.q.shift()?.(); }
  }
}
const LIMIT: Record<Tier, Semaphore> = { light: new Semaphore(6), heavy: new Semaphore(3) };

/* ---------------- sağlayıcı çağrıları ---------------- */
interface ChatReq { model: string; system: string; prompt: string; maxTokens: number; temperature: number; json: boolean }
interface ChatRes { text: string; inTokens: number; outTokens: number }

async function post(url: string, headers: Record<string, string>, body: unknown): Promise<unknown> {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(env.AI_TIMEOUT_MS),
  });
  if (!r.ok) {
    const t = await r.text().catch(() => '');
    throw new Error(`AI HTTP ${r.status}: ${t.slice(0, 300)}`);
  }
  return r.json();
}

async function chat(req: ChatReq): Promise<ChatRes> {
  if (provider === 'anthropic') {
    const d = await post('https://api.anthropic.com/v1/messages', {
      'x-api-key': env.ANTHROPIC_API_KEY!, 'anthropic-version': '2023-06-01',
    }, {
      model: req.model, max_tokens: req.maxTokens, temperature: req.temperature, system: req.system,
      messages: [{ role: 'user', content: req.prompt }],
    }) as { content: { type: string; text?: string }[]; usage?: { input_tokens: number; output_tokens: number } };
    return { text: d.content.filter((c) => c.type === 'text').map((c) => c.text ?? '').join(''), inTokens: d.usage?.input_tokens ?? 0, outTokens: d.usage?.output_tokens ?? 0 };
  }
  if (provider === 'openai') {
    const d = await post(`${env.OPENAI_BASE_URL}/chat/completions`, { authorization: `Bearer ${env.OPENAI_API_KEY}` }, {
      model: req.model, max_tokens: req.maxTokens, temperature: req.temperature,
      messages: [{ role: 'system', content: req.system }, { role: 'user', content: req.prompt }],
      ...(req.json ? { response_format: { type: 'json_object' } } : {}),
    }) as { choices: { message: { content: string } }[]; usage?: { prompt_tokens: number; completion_tokens: number } };
    return { text: d.choices[0]?.message.content ?? '', inTokens: d.usage?.prompt_tokens ?? 0, outTokens: d.usage?.completion_tokens ?? 0 };
  }
  if (provider === 'ollama') {
    const d = await post(`${env.OLLAMA_URL}/api/chat`, {}, {
      model: req.model, stream: false, ...(req.json ? { format: 'json' } : {}),
      options: { temperature: req.temperature, num_predict: req.maxTokens },
      messages: [{ role: 'system', content: req.system }, { role: 'user', content: req.prompt }],
    }) as { message: { content: string }; prompt_eval_count?: number; eval_count?: number };
    return { text: d.message.content, inTokens: d.prompt_eval_count ?? 0, outTokens: d.eval_count ?? 0 };
  }
  throw new Error('AI sağlayıcı yapılandırılmamış');
}

async function embed(text: string): Promise<number[] | null> {
  if (!env.AI_EMBED_MODEL) return null;
  try {
    if (provider === 'openai') {
      const d = await post(`${env.OPENAI_BASE_URL}/embeddings`, { authorization: `Bearer ${env.OPENAI_API_KEY}` }, { model: env.AI_EMBED_MODEL, input: text.slice(0, 8000) }) as { data: { embedding: number[] }[] };
      return d.data[0]?.embedding ?? null;
    }
    if (provider === 'ollama') {
      const d = await post(`${env.OLLAMA_URL}/api/embed`, {}, { model: env.AI_EMBED_MODEL, input: text.slice(0, 8000) }) as { embeddings: number[][] };
      return d.embeddings[0] ?? null;
    }
  } catch (e) {
    console.warn('[ai] embedding başarısız:', (e as Error).message);
  }
  return null;
}

/* ---------------- genel API ---------------- */
export interface CompleteArgs { task: Task; system: string; prompt: string; json?: boolean; userId?: number | null; noCache?: boolean }
export interface CompleteOut { text: string; source: 'ai' | 'cache'; model: string }

async function logUsage(row: { userId?: number | null; task: Task; tier: Tier; model: string; inTokens?: number; outTokens?: number; cached: boolean; ms: number; ok: boolean }) {
  try {
    await db.insert(aiUsage).values({ userId: row.userId ?? null, task: row.task, tier: row.tier, provider, model: row.model, inTokens: row.inTokens ?? 0, outTokens: row.outTokens ?? 0, cached: row.cached, ms: row.ms, ok: row.ok }).run();
  } catch { /* kullanım kaydı kritik değil */ }
}

export async function complete(a: CompleteArgs): Promise<CompleteOut> {
  if (!aiEnabled()) throw new Error('ai_disabled');
  const route = ROUTES[a.task];
  const model = models[route.tier];
  const key = cacheKey(a.task, model, a.system, a.prompt);
  const t0 = Date.now();
  if (!a.noCache && route.cacheDays > 0) {
    const hit = await getExact(key);
    if (hit) { void logUsage({ ...a, tier: route.tier, model, cached: true, ms: Date.now() - t0, ok: true }); return { text: hit, source: 'cache', model }; }
  }
  let embedding: number[] | null = null;
  if (!a.noCache && route.semantic) {
    embedding = await embed(a.prompt);
    const sem = await getSemantic(a.task, model, a.prompt, embedding, { cosine: 0.96, jaccard: 0.9 });
    if (sem) { void logUsage({ ...a, tier: route.tier, model, cached: true, ms: Date.now() - t0, ok: true }); return { text: sem.output, source: 'cache', model }; }
  }
  try {
    const res = await LIMIT[route.tier].run(() => chat({ model, system: a.system, prompt: a.prompt, maxTokens: route.maxTokens, temperature: route.temperature, json: !!a.json }));
    void logUsage({ ...a, tier: route.tier, model, inTokens: res.inTokens, outTokens: res.outTokens, cached: false, ms: Date.now() - t0, ok: true });
    if (!a.noCache) await put({ key, task: a.task, model, prompt: a.prompt, embedding, output: res.text, ttlDays: route.cacheDays });
    return { text: res.text, source: 'ai', model };
  } catch (e) {
    void logUsage({ ...a, tier: route.tier, model, cached: false, ms: Date.now() - t0, ok: false });
    throw e;
  }
}

/** Metinden ilk dengeli JSON nesnesini/dizisini çıkarır (kod çiti, ön/son söz toleransı). */
export function extractJson(text: string): unknown {
  const s = text.replace(/```(?:json)?/gi, '').trim();
  const start = s.search(/[[{]/);
  if (start < 0) throw new Error('json_not_found');
  const open = s[start], close = open === '{' ? '}' : ']';
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (inStr) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') inStr = false; continue; }
    if (c === '"') inStr = true;
    else if (c === open) depth++;
    else if (c === close && --depth === 0) return JSON.parse(s.slice(start, i + 1));
  }
  throw new Error('json_unbalanced');
}

/** JSON üret + zod ile doğrula; başarısızsa hatayı modele geri verip bir kez onarım ister. */
export async function completeJSON<S extends z.ZodTypeAny>(a: CompleteArgs, schema: S): Promise<{ data: z.output<S>; source: 'ai' | 'cache' }> {
  const first = await complete({ ...a, json: true });
  try {
    return { data: schema.parse(extractJson(first.text)), source: first.source };
  } catch (e) {
    const issue = e instanceof z.ZodError ? JSON.stringify(e.issues.slice(0, 6)) : (e as Error).message;
    const repair = await complete({
      ...a, json: true, noCache: true,
      prompt: `${a.prompt}\n\nYour previous answer was invalid: ${issue}\nReturn ONLY the corrected JSON, no commentary.`,
    });
    const data = schema.parse(extractJson(repair.text));
    // onarılmış çıktıyı asıl anahtarla önbelleğe yaz
    const route = ROUTES[a.task];
    await put({ key: cacheKey(a.task, repair.model, a.system, a.prompt), task: a.task, model: repair.model, prompt: a.prompt, embedding: null, output: JSON.stringify(data), ttlDays: route.cacheDays });
    return { data, source: 'ai' };
  }
}
