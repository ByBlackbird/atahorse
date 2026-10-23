// Hız sınırlama (kayan pencere, bellek içi) ve istemci IP çözümleme.
// Çok örnekli dağıtımda Redis'e taşınmalı; arayüz aynı kalır.
type Bucket = { hits: number[] };
const buckets = new Map<string, Bucket>();

export function rateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const b = buckets.get(key) ?? { hits: [] };
  b.hits = b.hits.filter((t) => now - t < windowMs);
  if (b.hits.length >= limit) {
    buckets.set(key, b);
    return { ok: false, retryAfter: Math.ceil((windowMs - (now - b.hits[0])) / 1000) };
  }
  b.hits.push(now);
  buckets.set(key, b);
  return { ok: true, retryAfter: 0 };
}

setInterval(() => {
  const now = Date.now();
  for (const [k, b] of buckets) if (!b.hits.some((t) => now - t < 3_600_000)) buckets.delete(k);
}, 600_000).unref();

export function clientIp(headers: Headers, fallback = 'local') {
  const xff = headers.get('x-forwarded-for');
  return (xff?.split(',')[0] ?? headers.get('x-real-ip') ?? fallback).trim();
}

export const LIMITS = {
  auth: { limit: 10, windowMs: 15 * 60_000 },
  generate: { limit: 6, windowMs: 60 * 60_000 },
  assist: { limit: 60, windowMs: 60 * 60_000 },
  translate: { limit: 10, windowMs: 60 * 60_000 },
  upload: { limit: 30, windowMs: 60 * 60_000 },
} as const;
