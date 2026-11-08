// Entegrasyon: learn.lesson — kilit denetimi, şablon üretimi, önbellek, dil (sunucu başlatılmaz).
process.env.NODE_ENV = 'test';
process.env.AI_PROVIDER = 'none';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const { migrate, db } = await import('../server/db/client');
migrate();
const { appRouter } = await import('../server/trpc/router');
const { visualLessons } = await import('../server/db/schema');
const { createContext } = await import('../server/trpc/core');

function caller(cookie = '') {
  const resHeaders = new Headers();
  const req = new Request('http://localhost/api/trpc', { headers: { cookie, 'user-agent': 'test' } });
  return { resHeaders, make: async () => appRouter.createCaller(await createContext({ req, resHeaders })) };
}
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

test('görsel ders uç noktası', async () => {
  const reg = caller();
  await (await reg.make()).auth.register({ username: 'izleyici', email: 'i@example.com', password: 'Sifre12345', locale: 'tr' });
  const me = await caller((reg.resHeaders.get('set-cookie') ?? '').split(';')[0]).make();
  const { courseId, jobId } = await me.course.create({ topic: 'Fotosentez', level: 'beginner', locale: 'tr' });
  for (let i = 0; i < 100; i++) { if ((await me.course.job({ jobId })).stage === 'done') break; await wait(50); }

  const l = await me.learn.lesson({ courseId, moduleIdx: 0 });
  assert.equal(l.source, 'template');
  assert.equal(l.moduleIdx, 0);
  assert.ok(l.scenes.some((s) => s.kind === 'check'));
  const again = await me.learn.lesson({ courseId, moduleIdx: 0 });
  assert.deepEqual(again, l, 'ikinci çağrı önbellekten aynı dersi döndürür');
  assert.equal((await db.select().from(visualLessons).all()).length, 1);

  await assert.rejects(me.learn.lesson({ courseId, moduleIdx: 1 }), /module_locked/);
  await assert.rejects(me.learn.lesson({ courseId, moduleIdx: 99 }), /bad_module/);

  const other = caller();
  await (await other.make()).auth.register({ username: 'yabanci', email: 'y@example.com', password: 'Sifre12345', locale: 'tr' });
  const stranger = await caller((other.resHeaders.get('set-cookie') ?? '').split(';')[0]).make();
  await assert.rejects(stranger.learn.lesson({ courseId, moduleIdx: 0 }), /forbidden/);
});
