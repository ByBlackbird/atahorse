// AI önbelleği: (1) normalize edilmiş tam eşleşme, (2) semantik eşleşme —
// embedding modeli varsa kosinüs benzerliği, yoksa karakter-trigram Jaccard (sıfır maliyet).
import crypto from 'node:crypto';
import { and, desc, eq, gt, sql } from 'drizzle-orm';
import { db } from '../db/client';
import { aiCache } from '../db/schema';

const FOLD: Record<string, string> = { ı: 'i', İ: 'i', ğ: 'g', ş: 's', ç: 'c', ö: 'o', ü: 'u', â: 'a', î: 'i', û: 'u', ё: 'е' };

export function normalize(s: string) {
  return s
    .toLowerCase()
    .replace(/[ıİğşçöüâîûё]/g, (c) => FOLD[c] ?? c)
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export const sha = (s: string) => crypto.createHash('sha256').update(s).digest('hex');

export function cacheKey(task: string, model: string, system: string, prompt: string) {
  return sha(`${task}\u0000${model}\u0000${sha(system)}\u0000${normalize(prompt)}`);
}

function trigrams(s: string) {
  const t = new Set<string>();
  const x = `  ${s} `;
  for (let i = 0; i < x.length - 2; i++) t.add(x.slice(i, i + 3));
  return t;
}
export function jaccard(a: string, b: string) {
  const A = trigrams(a), B = trigrams(b);
  let inter = 0;
  for (const g of A) if (B.has(g)) inter++;
  return inter / (A.size + B.size - inter || 1);
}
export function cosine(a: number[], b: number[]) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
}

export async function getExact(key: string) {
  const row = await db.select().from(aiCache).where(and(eq(aiCache.key, key), gt(aiCache.expiresAt, Date.now()))).get();
  if (row) await db.update(aiCache).set({ hits: sql`${aiCache.hits} + 1` }).where(eq(aiCache.key, key)).run();
  return row?.output ?? null;
}

/** Semantik eşleşme yalnızca aynı görev + model içinde, son N kayıt arasında aranır. */
export async function getSemantic(task: string, model: string, prompt: string, embedding: number[] | null, threshold: { cosine: number; jaccard: number }) {
  const rows = await db.select({ key: aiCache.key, normInput: aiCache.normInput, embedding: aiCache.embedding, output: aiCache.output })
    .from(aiCache)
    .where(and(eq(aiCache.task, task), eq(aiCache.model, model), gt(aiCache.expiresAt, Date.now())))
    .orderBy(desc(aiCache.createdAt)).limit(300).all();
  const n = normalize(prompt);
  let best: { key: string; output: string; score: number } | null = null;
  for (const r of rows) {
    let score = 0;
    if (embedding && r.embedding) {
      score = cosine(embedding, JSON.parse(r.embedding) as number[]);
      if (score < threshold.cosine) continue;
    } else {
      score = jaccard(n, r.normInput);
      if (score < threshold.jaccard) continue;
    }
    if (!best || score > best.score) best = { key: r.key, output: r.output, score };
  }
  if (best) await db.update(aiCache).set({ hits: sql`${aiCache.hits} + 1` }).where(eq(aiCache.key, best.key)).run();
  return best;
}

export async function put(entry: { key: string; task: string; model: string; prompt: string; embedding: number[] | null; output: string; ttlDays: number }) {
  if (entry.ttlDays <= 0) return;
  await db.insert(aiCache).values({
    key: entry.key, task: entry.task, model: entry.model,
    normInput: normalize(entry.prompt).slice(0, 4000),
    embedding: entry.embedding ? JSON.stringify(entry.embedding.map((v) => Math.round(v * 1e5) / 1e5)) : null,
    output: entry.output,
    expiresAt: Date.now() + entry.ttlDays * 86_400_000,
  }).onConflictDoUpdate({ target: aiCache.key, set: { output: entry.output, expiresAt: Date.now() + entry.ttlDays * 86_400_000 } }).run();
}

export async function purgeExpired() {
  await db.delete(aiCache).where(sql`${aiCache.expiresAt} < ${Date.now()}`).run();
}
