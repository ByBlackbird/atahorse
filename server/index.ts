// Atahorse sunucusu — Hono + tRPC (fetch adaptörü) + statik SPA. Tek süreç, tek port.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { secureHeaders } from 'hono/secure-headers';
import { bodyLimit } from 'hono/body-limit';
import { csrf } from 'hono/csrf';
import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { and, eq } from 'drizzle-orm';
import { env, isProd } from './env';
import { db, migrate, UPLOAD_DIR } from './db/client';
import { submissions } from './db/schema';
import { appRouter } from './trpc/router';
import { createContext } from './trpc/core';
import { readCookie, userFromToken, purgeSessions, seedAdmin } from './services/auth';
import { ownCourse, resumeJobs } from './services/courses';
import { purgeExpired } from './ai/cache';
import { aiInfo } from './ai/provider';
import { clientIp, rateLimit, LIMITS } from './security';

migrate();
await seedAdmin();
await resumeJobs();

const app = new Hono();

app.use('*', secureHeaders({
  contentSecurityPolicy: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'"],
    styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
    fontSrc: ["'self'", 'https://fonts.gstatic.com'],
    imgSrc: ["'self'", 'data:', 'blob:'],
    mediaSrc: ["'self'", 'blob:'],
    connectSrc: ["'self'"],
    frameAncestors: ["'none'"],
    objectSrc: ["'none'"],
    baseUri: ["'self'"],
  },
  strictTransportSecurity: isProd ? 'max-age=31536000; includeSubDomains' : false,
  referrerPolicy: 'strict-origin-when-cross-origin',
  permissionsPolicy: { camera: [], geolocation: [], microphone: ['self'] },
}));
// CSRF: köken, APP_URL ya da isteğin kendi Host'u ile aynı olmalı (Render/proxy arkasında da çalışır)
app.use('/api/*', csrf({
  origin: (origin, c) => {
    if (!origin || !isProd) return true;
    try {
      const o = new URL(origin);
      return o.origin === new URL(env.APP_URL).origin || o.host === (c.req.header('x-forwarded-host') ?? c.req.header('host'));
    } catch { return false; }
  },
}));
app.use('/api/trpc/*', bodyLimit({ maxSize: 512 * 1024 }));

app.get('/api/health', (c) => c.json({ ok: true, ai: aiInfo().provider, time: Date.now() }));

app.all('/api/trpc/*', (c) =>
  fetchRequestHandler({
    endpoint: '/api/trpc',
    req: c.req.raw,
    router: appRouter,
    createContext: ({ req, resHeaders }) => createContext({ req, resHeaders }),
    onError: ({ error, path: p }) => {
      if (error.code === 'INTERNAL_SERVER_ERROR') console.error(`[trpc] ${p}:`, error.cause ?? error);
    },
  }));

/* ---------------- görev kanıtı yükleme (not / ses) ---------------- */
const ALLOWED: Record<'note' | 'audio', Record<string, string>> = {
  note: { '.txt': 'text/plain', '.md': 'text/markdown', '.pdf': 'application/pdf', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg' },
  audio: { '.webm': 'audio/webm', '.ogg': 'audio/ogg', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.wav': 'audio/wav' },
};

app.post('/api/upload', bodyLimit({ maxSize: 10 * 1024 * 1024 }), async (c) => {
  const user = await userFromToken(readCookie(c.req.header('cookie') ?? null));
  if (!user) return c.json({ error: 'unauthorized' }, 401);
  const rl = rateLimit(`upload:${user.id}`, LIMITS.upload.limit, LIMITS.upload.windowMs);
  if (!rl.ok) return c.json({ error: 'rate_limited' }, 429);
  const form = await c.req.formData();
  const file = form.get('file');
  const kind = form.get('kind') === 'audio' ? 'audio' : 'note';
  const courseId = Number(form.get('courseId'));
  const moduleIdx = Number(form.get('moduleIdx'));
  if (!(file instanceof File) || !Number.isInteger(courseId) || !Number.isInteger(moduleIdx)) return c.json({ error: 'bad_request' }, 400);
  try { await ownCourse(user, courseId); } catch { return c.json({ error: 'forbidden' }, 403); }
  const ext = path.extname(file.name).toLowerCase() || (kind === 'audio' ? '.webm' : '');
  const mime = ALLOWED[kind][ext];
  if (!mime) return c.json({ error: 'bad_file' }, 400);
  const stored = crypto.randomBytes(16).toString('hex') + ext;
  await fs.promises.writeFile(path.join(UPLOAD_DIR, stored), Buffer.from(await file.arrayBuffer()));
  const [row] = await db.insert(submissions).values({ userId: user.id, courseId, moduleIdx, kind, filename: file.name.slice(0, 120), stored, mime, size: file.size }).returning({ id: submissions.id }).all();
  return c.json({ ok: true, id: row.id });
});

app.get('/api/files/:id', async (c) => {
  const user = await userFromToken(readCookie(c.req.header('cookie') ?? null));
  if (!user) return c.json({ error: 'unauthorized' }, 401);
  const idNum = Number(c.req.param('id'));
  const s = await db.select().from(submissions).where(user.role === 'admin' ? eq(submissions.id, idNum) : and(eq(submissions.id, idNum), eq(submissions.userId, user.id))).get();
  if (!s) return c.json({ error: 'not_found' }, 404);
  const p = path.join(UPLOAD_DIR, path.basename(s.stored));
  if (!fs.existsSync(p)) return c.json({ error: 'not_found' }, 404);
  return new Response(fs.createReadStream(p) as unknown as ReadableStream, {
    headers: { 'content-type': s.mime, 'content-disposition': `attachment; filename="${encodeURIComponent(s.filename)}"`, 'x-content-type-options': 'nosniff' },
  });
});

app.all('/api/*', (c) => c.json({ error: 'not_found' }, 404));

/* ---------------- statik SPA ---------------- */
const WEB = [path.resolve('dist/web'), path.resolve(import.meta.dirname, '../dist/web'), path.resolve(import.meta.dirname, 'web')].find((d) => fs.existsSync(path.join(d, 'index.html')));
if (WEB) {
  const rel = path.relative(process.cwd(), WEB) || '.';
  app.use('/assets/*', serveStatic({ root: rel, onFound: (_p, c) => { c.header('cache-control', 'public, max-age=31536000, immutable'); } }));
  app.use('*', serveStatic({ root: rel }));
  const readIndex = () => fs.readFileSync(path.join(WEB, 'index.html'), 'utf8');
  const cachedIndex = readIndex();
  app.get('*', (c) => {
    // Eksik statik dosya → 404 (SPA HTML'i yanlış MIME ile dönmesin)
    if (c.req.path.startsWith('/assets/') || /\.[a-z0-9]{2,5}$/i.test(c.req.path)) return c.text('Not found', 404);
    return c.html(isProd ? cachedIndex : readIndex(), 200, { 'cache-control': 'no-cache' });
  });
} else {
  app.get('*', (c) => c.text('Web paketi bulunamadı. Önce `npm run build:web` çalıştırın.', 503));
}

setInterval(() => { void purgeSessions(); void purgeExpired(); }, 6 * 3_600_000).unref();

serve({ fetch: app.fetch, port: env.PORT, hostname: env.HOST }, (info) => {
  console.log(`[atahorse] http://localhost:${info.port} · AI: ${aiInfo().provider} (${aiInfo().models.light} / ${aiInfo().models.heavy})`);
});

// Yalnızca istemci IP yardımcı fonksiyonunu dışa ver (testler)
export { clientIp };
