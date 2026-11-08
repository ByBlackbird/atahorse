// Entegrasyon: tRPC çağırıcısı + bellek içi SQLite (sunucu süreci başlatılmaz).
// Akış: atıf kodu → kayıt → hedefli kurs → ön test → Bugün yolu → yanlış cevaplar → zayıf nokta → plan → bildirim → final → kazanç → yönetim.
process.env.NODE_ENV = 'test';
process.env.AI_PROVIDER = 'none';
process.env.FREE_COURSE_LIMIT = '5';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const { migrate, db } = await import('../server/db/client');
migrate();
const { appRouter } = await import('../server/trpc/router');
const { users, courses } = await import('../server/db/schema');
const { eq } = await import('drizzle-orm');
const { parseDoc } = await import('../server/services/courses');
const { finalItems, itemsOf } = await import('../server/services/learning');

function caller(cookie = '') {
  const resHeaders = new Headers();
  const req = new Request('http://localhost/api/trpc', { headers: { cookie, 'user-agent': 'test' } });
  return { resHeaders, make: async () => appRouter.createCaller(await (await import('../server/trpc/core')).createContext({ req, resHeaders })) };
}
const cookieOf = (h: Headers) => (h.get('set-cookie') ?? '').split(';')[0];
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

test('kişisel yol uçtan uca (API)', async () => {
  // yönetici + atıf kodu
  const adminReg = caller();
  await (await adminReg.make()).auth.register({ username: 'yonetici', email: 'admin@example.com', password: 'Sifre12345', locale: 'tr' });
  await db.update(users).set({ role: 'admin' }).where(eq(users.username, 'yonetici')).run();
  const admin = await caller(cookieOf(adminReg.resHeaders)).make();
  await admin.admin.createRef({ code: 'ayse-tr', label: 'Ayşe (TikTok)', kind: 'creator', market: 'TR' });
  await assert.rejects(admin.admin.createRef({ code: 'yonetici', label: 'x', kind: 'creator', market: '' }), /code_taken/);

  // atıflı kayıt + bekleme listesi
  const pub = await caller().make();
  await pub.pub.joinWaitlist({ email: 'w@example.com', locale: 'tr', role: 'learner', ref: 'ayse-tr' });
  const reg = caller();
  await (await reg.make()).auth.register({ username: 'ogrenci', email: 'o@example.com', password: 'Sifre12345', locale: 'tr', ref: 'AYSE-TR' });
  const me = await caller(cookieOf(reg.resHeaders)).make();
  const inv = caller();
  await (await inv.make()).auth.register({ username: 'arkadas', email: 'a@example.com', password: 'Sifre12345', locale: 'tr', ref: 'ogrenci' });
  assert.equal((await me.profile.invites()).joined, 1);

  // hedefli kurs (şablon motoru)
  const target = new Date(Date.now() + 20 * 86_400_000).toISOString().slice(0, 10);
  const { courseId, jobId } = await me.course.create({ topic: 'Fotosentez', level: 'beginner', locale: 'tr', goal: { why: 'Biyoloji sınavı', targetDate: target, minutesPerDay: 45 } });
  for (let i = 0; i < 100; i++) { if ((await me.course.job({ jobId })).stage === 'done') break; await wait(50); }
  await assert.rejects(me.course.setGoal({ courseId, why: '', targetDate: '2020-01-01', minutesPerDay: 30 }), /bad_date/);

  // ön test: bekliyor → cevaplanır → kapanır
  const pre = await me.learn.pretest({ courseId });
  assert.equal(pre.status, 'pending');
  assert.equal(pre.items.length, 6);
  assert.ok(!('correct' in pre.items[0]), 'ön testte doğru cevap istemciye gitmez');
  const preRes = await me.learn.submitPretest({ courseId, answers: Object.fromEntries(pre.items.map((it) => [it.id, -1])) });
  assert.equal(preRes.skipped, false);
  assert.equal((await me.learn.pretest({ courseId })).status, 'done');
  await assert.rejects(me.learn.submitPretest({ courseId, answers: null }), /pretest_closed/);

  // Bugün yolu: hedefli kurs için modül adımı
  const path0 = await me.learn.path();
  const mod = path0.steps.find((s) => s.kind === 'module');
  assert.ok(mod && mod.kind === 'module' && mod.courseId === courseId);

  // modül 0 kontrollerine yanlış cevap → zayıf nokta
  const row = (await db.select().from(courses).where(eq(courses.id, courseId)).get())!;
  const doc = parseDoc(row.doc);
  const checks = doc.modules[0].sections.map((s) => s.check!).filter(Boolean);
  for (const c of checks) await me.learn.check({ courseId, itemId: c.id, choice: (c.correct + 1) % c.options.length, confidence: 2 });
  await me.learn.quiz({ courseId, moduleIdx: 0, answers: doc.modules[0].quiz.map((q) => (q.correct + 1) % q.options.length), locale: 'tr' });
  const cp = await me.learn.coursePath({ courseId });
  assert.equal(cp.modules[0].band, 'weak');
  assert.equal(cp.weak, 1);
  assert.equal(cp.goal.minutesPerDay, 45);
  assert.ok(['on_track', 'tight', 'behind'].includes(cp.plan.status));
  const recap = await me.learn.recap({ courseId });
  assert.ok(recap.items.length > 0 && recap.items.every((i) => i.moduleIdx === 0));
  assert.equal((await me.learn.path()).steps.find((s) => s.kind === 'recap')?.kind, 'recap');

  // içerik bildirimi → yönetim kuyruğu
  await me.learn.report({ courseId, itemId: checks[0].id, kind: 'unclear', note: 'Şık B muğlak' });
  const reports = await admin.admin.reports({ status: 'open' });
  assert.equal(reports.length, 1);
  assert.equal(reports[0].excerpt, checks[0].q);
  await admin.admin.setReport({ id: reports[0].id, status: 'resolved' });
  assert.equal((await admin.admin.reports({ status: 'open' })).length, 0);

  // kursu tamamla → final → eşleştirilmiş kazanç
  for (let i = 0; i < doc.modules.length; i++) {
    await me.learn.task({ courseId, moduleIdx: i, reflection: 'Bu modülde ana fikri kendi cümlelerimle özetledim.', locale: 'tr' });
    await me.learn.quiz({ courseId, moduleIdx: i, answers: doc.modules[i].quiz.map((q) => q.correct), locale: 'tr' });
  }
  const meRow = (await db.select().from(users).where(eq(users.username, 'ogrenci')).get())!;
  const fin = finalItems(doc, courseId, meRow.id);
  const r = await me.learn.submitFinal({ courseId, answers: Object.fromEntries(fin.map((q) => [q.id, q.correct])), locale: 'tr' });
  assert.ok(r.passed);
  const after = await me.learn.coursePath({ courseId });
  assert.equal(after.gain?.pre, 0);
  assert.equal(after.gain?.post, 1);
  assert.equal(after.gain?.g, 1);
  assert.equal(after.plan.status, 'done');
  assert.ok(itemsOf(doc).size > 0);

  // yönetim: sonuç + atıf ölçümü
  const out = await admin.admin.outcomes();
  assert.equal(out.paired, 1);
  assert.equal(out.gainAvg, 1);
  const refs = await admin.admin.refs();
  const ayse = refs.codes.find((c) => c.code === 'ayse-tr')!;
  assert.equal(ayse.signups, 1);
  assert.equal(ayse.waitlist, 1);
  assert.equal(ayse.activated, 1, 'modül tamamlayan kayıt aktif sayılır');
  assert.equal(refs.invites.signups, 1);
});
