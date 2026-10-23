// Uygulama API'si (tRPC). İstemci tipleri doğrudan buradan türetilir: `AppRouter`.
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { db } from '../db/client';
import { users } from '../db/schema';
import { AssistAction, Level, Locale, MethodKey, MindNode } from '../../shared/types';
import { MEB_GRADES, mebCatalog, MEB_SOURCE_NOTE } from '../../shared/engine/meb';
import { PROFILES, PROFILE_TEST } from '../../shared/engine/profiles';
import { METHODS } from '../../shared/engine/methods';
import { PRINCIPLES } from '../../shared/engine/science';
import { BADGES, XP, levelFromXp } from '../../shared/engine/gamification';
import { router, publicProcedure, authed, adminProcedure, limited } from './core';
import { clearCookie, createSession, destroyAllSessions, destroySession, hashPassword, publicUser, verifyPassword } from '../services/auth';
import { AppError, createCourse, deleteCourse, jobStatus, requestTranslation, retryCourse, shareCourse, parseDoc } from '../services/courses';
import { answerCheck, answerReview, approveTask, courseView, dueReviews, getFinal, heartbeat, myCertificates, submitFinal, submitModuleQuiz, verifyCertificate } from '../services/learning';
import { assist, getMindmap, layoutMindmap, saveMindmap, suggestBranches } from '../services/assistant';
import { dashboard, deleteAccount, getCognitive, profilePage, saveProfileTest, updateSettings } from '../services/profile';
import { adminCourses, adminSetPlan, adminStats, adminUsers } from '../services/admin';
import { aiInfo } from '../ai/provider';
import { env } from '../env';
import { courses } from '../db/schema';

const id = z.number().int().positive();
const Username = z.string().trim().toLowerCase().regex(/^[a-z0-9_]{3,24}$/);
const Password = z.string().min(8).max(200);

const authRouter = router({
  me: publicProcedure.query(({ ctx }) => (ctx.user ? publicUser(ctx.user) : null)),
  register: publicProcedure.use(limited('auth'))
    .input(z.object({ username: Username, email: z.string().trim().toLowerCase().email().max(160), password: Password, fullName: z.string().trim().max(80).default(''), locale: Locale.default('tr') }))
    .mutation(async ({ input, ctx }) => {
      const taken = await db.select({ id: users.id }).from(users).where(eq(users.username, input.username)).get()
        ?? await db.select({ id: users.id }).from(users).where(eq(users.email, input.email)).get();
      if (taken) throw new AppError('account_exists', 'CONFLICT');
      const [u] = await db.insert(users).values({ username: input.username, email: input.email, fullName: input.fullName, locale: input.locale, passwordHash: await hashPassword(input.password) }).returning().all();
      const s = await createSession(u.id, ctx.req.headers.get('user-agent') ?? '');
      ctx.resHeaders.append('set-cookie', s.cookie);
      return publicUser(u);
    }),
  login: publicProcedure.use(limited('auth'))
    .input(z.object({ identifier: z.string().trim().toLowerCase().min(3).max(160), password: z.string().min(1).max(200) }))
    .mutation(async ({ input, ctx }) => {
      const field = input.identifier.includes('@') ? users.email : users.username;
      const u = await db.select().from(users).where(eq(field, input.identifier)).get();
      // Zamanlama sızıntısını azaltmak için kullanıcı yoksa da özet hesaplanır
      const ok = u ? await verifyPassword(input.password, u.passwordHash) : (await hashPassword(input.password), false);
      if (!u || !ok) throw new AppError('bad_credentials', 'FORBIDDEN');
      const s = await createSession(u.id, ctx.req.headers.get('user-agent') ?? '');
      ctx.resHeaders.append('set-cookie', s.cookie);
      return publicUser(u);
    }),
  logout: publicProcedure.mutation(async ({ ctx }) => {
    await destroySession(ctx.token);
    ctx.resHeaders.append('set-cookie', clearCookie());
    return { ok: true };
  }),
  logoutAll: authed.mutation(async ({ ctx }) => {
    await destroyAllSessions(ctx.user.id);
    ctx.resHeaders.append('set-cookie', clearCookie());
    return { ok: true };
  }),
  changePassword: authed.use(limited('auth')).input(z.object({ current: z.string(), next: Password })).mutation(async ({ input, ctx }) => {
    if (!(await verifyPassword(input.current, ctx.user.passwordHash))) throw new AppError('bad_credentials', 'FORBIDDEN');
    await db.update(users).set({ passwordHash: await hashPassword(input.next) }).where(eq(users.id, ctx.user.id)).run();
    return { ok: true };
  }),
});

const catalogRouter = router({
  /** Motor meta verisi: profiller, metotlar, ilkeler, rozetler, XP tablosu, MEB kataloğu. */
  engine: publicProcedure.query(() => ({
    profiles: Object.values(PROFILES).map((p) => ({ key: p.key, modality: p.modality, reasoning: p.reasoning, name: p.name, tagline: p.tagline, entryMode: p.entryMode, defaultMethod: p.defaultMethod })),
    methods: Object.values(METHODS).map((m) => ({ key: m.key, name: m.name, short: m.short })),
    principles: PRINCIPLES,
    badges: BADGES.map((b) => ({ key: b.key, icon: b.icon, name: b.name, desc: b.desc, target: b.target })),
    xp: XP,
    profileTest: PROFILE_TEST,
    ai: { enabled: aiInfo().enabled, provider: aiInfo().provider },
    freeLimit: env.FREE_COURSE_LIMIT,
  })),
  meb: publicProcedure.query(() => ({ grades: MEB_GRADES, catalog: mebCatalog(), note: MEB_SOURCE_NOTE })),
});

const profileRouter = router({
  saveTest: authed.input(z.object({ answers: z.record(z.string(), z.string()) })).mutation(({ input, ctx }) => saveProfileTest(ctx.user, input.answers)),
  cognitive: authed.query(({ ctx }) => getCognitive(ctx.user.id)),
  dashboard: authed.query(({ ctx }) => dashboard(ctx.user)),
  page: authed.input(z.object({ locale: Locale })).query(({ input, ctx }) => profilePage(ctx.user, input.locale)),
  settings: authed.input(z.object({ fullName: z.string().max(80).optional(), locale: Locale.optional(), theme: z.enum(['paper', 'ink']).optional() })).mutation(({ input, ctx }) => updateSettings(ctx.user, input)),
  deleteAccount: authed.input(z.object({ confirm: z.literal('DELETE') })).mutation(async ({ ctx }) => {
    await deleteAccount(ctx.user);
    ctx.resHeaders.append('set-cookie', clearCookie());
    return { ok: true };
  }),
  certificates: authed.query(({ ctx }) => myCertificates(ctx.user.id)),
  upgrade: authed.mutation(async ({ ctx }) => {
    if (!env.ALLOW_SIMULATED_UPGRADE) throw new AppError('payments_disabled', 'FORBIDDEN');
    await db.update(users).set({ plan: 'premium' }).where(eq(users.id, ctx.user.id)).run();
    return { ok: true };
  }),
});

const courseRouter = router({
  create: authed.use(limited('generate'))
    .input(z.object({
      topic: z.string().trim().min(2).max(120).optional(), level: Level, locale: Locale, method: MethodKey.optional(),
      meb: z.object({ grade: z.enum(MEB_GRADES), subject: z.string().max(40), unit: z.string().max(160).optional() }).optional(),
    }))
    .mutation(({ input, ctx }) => createCourse(ctx.user, input)),
  job: authed.input(z.object({ jobId: z.string().uuid() })).query(({ input, ctx }) => jobStatus(ctx.user.id, input.jobId)),
  retry: authed.use(limited('generate')).input(z.object({ courseId: id })).mutation(({ input, ctx }) => retryCourse(ctx.user, input.courseId)),
  remove: authed.input(z.object({ courseId: id })).mutation(async ({ input, ctx }) => { await deleteCourse(ctx.user, input.courseId); return { ok: true }; }),
  view: authed.input(z.object({ courseId: id, locale: Locale.optional() })).query(({ input, ctx }) => courseView(ctx.user, input.courseId, input.locale)),
  translate: authed.use(limited('translate')).input(z.object({ courseId: id, to: Locale })).mutation(({ input, ctx }) => requestTranslation(ctx.user, input.courseId, input.to)),
  share: authed.input(z.object({ courseId: id })).mutation(async ({ input, ctx }) => ({ slug: await shareCourse(ctx.user, input.courseId) })),
});

const learnRouter = router({
  check: authed.input(z.object({ courseId: id, itemId: z.string().max(40), choice: z.number().int().min(0).max(4), confidence: z.union([z.literal(1), z.literal(2), z.literal(3)]).default(2) }))
    .mutation(({ input, ctx }) => answerCheck(ctx.user, input.courseId, input.itemId, input.choice, input.confidence)),
  task: authed.input(z.object({ courseId: id, moduleIdx: z.number().int().min(0), reflection: z.string().max(2000), locale: Locale }))
    .mutation(({ input, ctx }) => approveTask(ctx.user, input.courseId, input.moduleIdx, input.reflection, input.locale)),
  quiz: authed.input(z.object({ courseId: id, moduleIdx: z.number().int().min(0), answers: z.array(z.number().int().min(-1).max(4)).max(6), locale: Locale }))
    .mutation(({ input, ctx }) => submitModuleQuiz(ctx.user, input.courseId, input.moduleIdx, input.answers, input.locale)),
  heartbeat: authed.input(z.object({ courseId: id, moduleIdx: z.number().int().min(0), mode: z.enum(['read', 'podcast', 'slides', 'mindmap']), seconds: z.number().min(0).max(600) }))
    .mutation(async ({ input, ctx }) => { await heartbeat(ctx.user, input.courseId, input.moduleIdx, input.mode, input.seconds); return { ok: true }; }),
  final: authed.input(z.object({ courseId: id, locale: Locale.optional() })).query(({ input, ctx }) => getFinal(ctx.user, input.courseId, input.locale)),
  submitFinal: authed.input(z.object({ courseId: id, answers: z.record(z.string(), z.number().int()), locale: Locale }))
    .mutation(({ input, ctx }) => submitFinal(ctx.user, input.courseId, input.answers, input.locale)),
  reviews: authed.query(({ ctx }) => dueReviews(ctx.user)),
  review: authed.input(z.object({ cardId: id, choice: z.number().int().min(0).max(4), confidence: z.union([z.literal(1), z.literal(2), z.literal(3)]).default(2) }))
    .mutation(({ input, ctx }) => answerReview(ctx.user, input.cardId, input.choice, input.confidence)),
});

const aiRouter = router({
  assist: authed.use(limited('assist'))
    .input(z.object({ courseId: id, moduleIdx: z.number().int().min(0), sectionIdx: z.number().int().min(0).nullable(), action: AssistAction, locale: Locale, method: MethodKey.optional() }))
    .mutation(({ input, ctx }) => assist(ctx.user, input.courseId, input.moduleIdx, input.sectionIdx, input.action, input.locale, input.method)),
  mindmap: authed.input(z.object({ courseId: id })).query(({ input, ctx }) => getMindmap(ctx.user, input.courseId)),
  saveMindmap: authed.input(z.object({ courseId: id, nodes: z.array(MindNode).max(250) })).mutation(({ input, ctx }) => saveMindmap(ctx.user, input.courseId, input.nodes)),
  layout: authed.input(z.object({ nodes: z.array(MindNode).max(250) })).mutation(({ input }) => layoutMindmap(input.nodes)),
  suggest: authed.use(limited('assist')).input(z.object({ courseId: id, nodeId: z.string().max(40), nodes: z.array(MindNode).max(250), locale: Locale }))
    .mutation(({ input, ctx }) => suggestBranches(ctx.user, input.courseId, input.nodes, input.nodeId, input.locale)),
});

const publicRouter = router({
  verify: publicProcedure.input(z.object({ code: z.string().trim().min(6).max(40) })).query(({ input }) => verifyCertificate(input.code)),
  shared: publicProcedure.input(z.object({ slug: z.string().regex(/^[A-Za-z0-9_-]{6,16}$/) })).query(async ({ input }) => {
    const c = await db.select().from(courses).where(eq(courses.shareSlug, input.slug)).get();
    if (!c || c.status !== 'ready') throw new TRPCError({ code: 'NOT_FOUND', message: 'not_found' });
    const doc = parseDoc(c.doc);
    const m0 = doc.modules[0];
    return {
      title: doc.title, subtitle: doc.subtitle, level: doc.level, locale: doc.locale, profileKey: doc.profileKey, method: doc.method,
      objectives: doc.objectives, modules: doc.modules.map((m) => ({ title: m.title, summary: m.summary, minutes: m.minutes })),
      preview: { title: m0.title, sections: m0.sections.map((s) => ({ heading: s.heading, paragraphs: s.paragraphs, analytic: s.analytic, holistic: s.holistic })) },
    };
  }),
  level: publicProcedure.input(z.object({ xp: z.number().int().min(0) })).query(({ input }) => levelFromXp(input.xp)),
});

const adminRouter = router({
  stats: adminProcedure.query(() => adminStats()),
  users: adminProcedure.query(() => adminUsers()),
  courses: adminProcedure.query(() => adminCourses()),
  setPlan: adminProcedure.input(z.object({ userId: id, plan: z.enum(['free', 'premium']) })).mutation(async ({ input }) => { await adminSetPlan(input.userId, input.plan); return { ok: true }; }),
});

export const appRouter = router({
  auth: authRouter,
  catalog: catalogRouter,
  profile: profileRouter,
  course: courseRouter,
  learn: learnRouter,
  ai: aiRouter,
  pub: publicRouter,
  admin: adminRouter,
});

export type AppRouter = typeof appRouter;
