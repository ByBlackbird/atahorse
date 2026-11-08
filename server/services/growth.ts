// Büyüme altyapısı: atıf kodları (creator / elçi / ortak / kampanya) ve kullanıcı davetleri.
// Amaç: her kanalın getirdiği kaydı ve "aktifleşmeyi" (en az bir modül tamamlama) ölçmek — gösteriş değil, eylem metriği.
import { titleCase } from '../../shared/engine/text';
import { and, count, desc, eq, inArray, isNotNull, like, sql } from 'drizzle-orm';
import { db } from '../db/client';
import { moduleProgress, refCodes, users, waitlist } from '../db/schema';
import { AppError } from './courses';
import type { User } from './auth';

export const RefCode = /^[a-z0-9][a-z0-9_-]{1,31}$/;

/** Gelen ?ref= değerini doğrular: tanımlı kod → kod; mevcut kullanıcı adı → "u:<ad>"; aksi halde null. */
export async function resolveRef(raw: string | undefined | null): Promise<string | null> {
  const code = (raw ?? '').trim().toLowerCase();
  if (!code || !RefCode.test(code)) return null;
  const known = await db.select({ code: refCodes.code }).from(refCodes).where(eq(refCodes.code, code)).get();
  if (known) return known.code;
  const u = await db.select({ username: users.username }).from(users).where(eq(users.username, code)).get();
  return u ? `u:${u.username}` : null;
}

export async function myInvites(user: User) {
  const n = (await db.select({ n: count() }).from(users).where(eq(users.refCode, `u:${user.username}`)).get())?.n ?? 0;
  return { code: user.username, joined: n };
}

export async function adminCreateRef(input: { code: string; label: string; kind: 'creator' | 'ambassador' | 'partner' | 'campaign'; market: string }) {
  const code = input.code.trim().toLowerCase();
  const label = titleCase(input.label);
  if (!RefCode.test(code)) throw new AppError('bad_code');
  const clash = await db.select({ id: users.id }).from(users).where(eq(users.username, code)).get();
  if (clash) throw new AppError('code_taken', 'CONFLICT');
  await db.insert(refCodes).values({ code, label, kind: input.kind, market: input.market.trim().toUpperCase().slice(0, 8) })
    .onConflictDoUpdate({ target: refCodes.code, set: { label, kind: input.kind, market: input.market.trim().toUpperCase().slice(0, 8) } }).run();
  return { ok: true };
}

/** Kod başına: kayıt, aktifleşen (≥1 modül tamamlayan), bekleme listesi. Kullanıcı davetleri tek satırda toplanır. */
export async function adminRefStats() {
  const codes = await db.select().from(refCodes).orderBy(desc(refCodes.createdAt)).all();
  const signups = await db.select({ ref: users.refCode, n: count() }).from(users).where(isNotNull(users.refCode)).groupBy(users.refCode).all();
  const activatedRows = await db.select({ ref: users.refCode, n: sql<number>`count(distinct ${users.id})` })
    .from(users).innerJoin(moduleProgress, and(eq(moduleProgress.userId, users.id), isNotNull(moduleProgress.completedAt)))
    .where(isNotNull(users.refCode)).groupBy(users.refCode).all();
  const wl = await db.select({ src: waitlist.source, n: count() }).from(waitlist).where(like(waitlist.source, 'ref:%')).groupBy(waitlist.source).all();
  const s = new Map(signups.map((r) => [r.ref, r.n]));
  const a = new Map(activatedRows.map((r) => [r.ref, Number(r.n)]));
  const w = new Map(wl.map((r) => [r.src.slice(4), r.n]));
  const sum = (m: Map<string | null, number>) => [...m.entries()].filter(([k]) => k?.startsWith('u:')).reduce((x, [, v]) => x + v, 0);
  return {
    codes: codes.map((c) => ({ ...c, signups: s.get(c.code) ?? 0, activated: a.get(c.code) ?? 0, waitlist: w.get(c.code) ?? 0 })),
    invites: { signups: sum(s), activated: sum(a) },
  };
}

export async function adminDeleteRef(code: string) {
  await db.delete(refCodes).where(inArray(refCodes.code, [code.toLowerCase()])).run();
}
