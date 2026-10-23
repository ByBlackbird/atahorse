// Kimlik doğrulama: scrypt parola özeti (yerleşik crypto), sunucu tarafı oturum tablosu,
// httpOnly + SameSite=Lax çerez. Çerezde yalnızca rastgele belirteç; DB'de belirtecin SHA-256'sı.
import crypto from 'node:crypto';
import { promisify } from 'node:util';
import { and, eq, gt, lt } from 'drizzle-orm';
import { db } from '../db/client';
import { sessions, users } from '../db/schema';
import { env, isProd } from '../env';
import { sha } from '../ai/cache';

const scrypt = promisify(crypto.scrypt) as (pw: string, salt: Buffer, keylen: number, opts: crypto.ScryptOptions) => Promise<Buffer>;
const SCRYPT = { N: 1 << 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

export async function hashPassword(pw: string) {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(pw.normalize('NFKC'), salt, 64, SCRYPT);
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString('base64')}$${key.toString('base64')}`;
}

export async function verifyPassword(pw: string, stored: string) {
  const [alg, n, r, p, saltB64, keyB64] = stored.split('$');
  if (alg !== 'scrypt') return false;
  const expected = Buffer.from(keyB64, 'base64');
  const key = await scrypt(pw.normalize('NFKC'), Buffer.from(saltB64, 'base64'), expected.length, { N: Number(n), r: Number(r), p: Number(p), maxmem: SCRYPT.maxmem });
  return crypto.timingSafeEqual(key, expected);
}

export const COOKIE = 'ah_sid';

export function sessionCookie(token: string, maxAgeSec: number) {
  const secure = env.COOKIE_SECURE ?? isProd;
  return [`${COOKIE}=${token}`, 'Path=/', 'HttpOnly', 'SameSite=Lax', `Max-Age=${maxAgeSec}`, secure ? 'Secure' : ''].filter(Boolean).join('; ');
}
export const clearCookie = () => sessionCookie('', 0);

export function readCookie(header: string | null, name = COOKIE) {
  if (!header) return null;
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return null;
}

export async function createSession(userId: number, userAgent: string) {
  const token = crypto.randomBytes(32).toString('base64url');
  const ttl = env.SESSION_TTL_DAYS * 86_400;
  await db.insert(sessions).values({ id: sha(token), userId, expiresAt: Date.now() + ttl * 1000, userAgent: userAgent.slice(0, 200) }).run();
  return { token, cookie: sessionCookie(token, ttl) };
}

export async function userFromToken(token: string | null) {
  if (!token || token.length > 100) return null;
  const row = await db.select({ user: users, expiresAt: sessions.expiresAt }).from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.id, sha(token)), gt(sessions.expiresAt, Date.now()))).get();
  if (!row) return null;
  // Kayan süre: oturumun yarısı geçtiyse uzat
  const ttl = env.SESSION_TTL_DAYS * 86_400_000;
  if (row.expiresAt - Date.now() < ttl / 2) {
    await db.update(sessions).set({ expiresAt: Date.now() + ttl }).where(eq(sessions.id, sha(token))).run();
  }
  return row.user;
}

export async function destroySession(token: string | null) {
  if (token) await db.delete(sessions).where(eq(sessions.id, sha(token))).run();
}

export async function destroyAllSessions(userId: number) {
  await db.delete(sessions).where(eq(sessions.userId, userId)).run();
}

export async function purgeSessions() {
  await db.delete(sessions).where(lt(sessions.expiresAt, Date.now())).run();
}

export type User = typeof users.$inferSelect;
export const publicUser = (u: User) => {
  const { passwordHash: _p, ...rest } = u;
  return rest;
};
export type PublicUser = ReturnType<typeof publicUser>;

/** İlk kurulum: ADMIN_EMAIL + ADMIN_PASSWORD verildiyse yönetici oluşturulur (sabit parola yok). */
export async function seedAdmin() {
  if (!env.ADMIN_EMAIL || !env.ADMIN_PASSWORD) return;
  const exists = await db.select({ id: users.id }).from(users).where(eq(users.email, env.ADMIN_EMAIL.toLowerCase())).get();
  if (exists) return;
  await db.insert(users).values({
    username: 'admin', email: env.ADMIN_EMAIL.toLowerCase(), passwordHash: await hashPassword(env.ADMIN_PASSWORD),
    fullName: 'Atahorse Yönetici', role: 'admin', plan: 'premium', onboardedAt: Date.now(),
  }).run();
  console.log(`[auth] yönetici oluşturuldu: ${env.ADMIN_EMAIL}`);
}
