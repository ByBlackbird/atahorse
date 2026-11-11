/**
 * Kurucu paneli — yalnız site yöneticisi (users.role = admin).
 * Tek ekranda: üyelikler ve kullanım, gelen / giden para, yardım ve geri bildirim, hata kayıtları,
 * danışmanlık dosyaları + süre kaydı + haftalık kapasite.
 * Yapay zekâ yok; her sayı kayıtlardan hesaplanır.
 *
 * Site trafiği (Shopify Analytics karşılığı): traffic, live, campaigns, seo — api/founderTraffic.ts.
 *
 * Kullanıcı tarafı (authedQuery): feedbackSubmit, myFeedback — "Yardım ve geri bildirim" penceresi.
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { adminQuery, authedQuery, createRouter } from "./middleware";
import { getDb } from "./queries/connection";
import {
  appErrors,
  billingRequests,
  companies,
  companyMembers,
  consultingCases,
  consultingTime,
  feedback,
  financeEntries,
  leads,
  notifications,
  projects,
  usageCounters,
  users,
} from "@db/schema";
import { getEntitlements } from "./lib/entitlements";
import { storageByCompany } from "./lib/usage";
import { getPackage } from "@contracts/consulting";
import { dueFollowUp, LEAD_STAGES, LOST_REASONS, type LeadStage } from "@contracts/funnel";
import { AI_MONTHLY_QUOTA, periodOf, quotaPct, STORAGE_QUOTA_BYTES } from "@contracts/quotas";
import { capacityRule, FEEDBACK_KIND_IDS, WEEKLY_CAPACITY_HOURS, weekStartOf } from "@contracts/founder";
import { todayTR } from "../contracts/workflow";
import { campaignReport, liveReport, seoReport, trafficReport } from "./founderTraffic";
import { addLeadNote, badges, contactsList, leadDetail, leadsList, productsReport } from "./founderLeads";
import { env } from "./lib/env";

const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tarih YYYY-AA-GG olmalı");

function monthsBack(n: number): string[] {
  const now = periodOf();
  const [y, m] = now.split("-").map(Number);
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(y, m - 1 - i, 1));
    out.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  }
  return out;
}

function addDaysYmd(d: string, n: number): string {
  const t = new Date(`${d}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
}

async function weeklyCapacity(weeks: number) {
  const db = getDb();
  const thisWeek = weekStartOf(todayTR());
  const from = addDaysYmd(thisWeek, -7 * (weeks - 1));
  const rows = await db
    .select({ workDate: consultingTime.workDate, minutes: consultingTime.minutes })
    .from(consultingTime)
    .where(gte(consultingTime.workDate, from));
  const out: { week: string; minutes: number; pct: number }[] = [];
  for (let i = 0; i < weeks; i++) {
    const w = addDaysYmd(from, i * 7);
    const minutes = rows.filter((r) => weekStartOf(String(r.workDate).slice(0, 10)) === w).reduce((t, r) => t + r.minutes, 0);
    out.push({ week: w, minutes, pct: Math.round((minutes / (WEEKLY_CAPACITY_HOURS * 60)) * 100) });
  }
  const current = out[out.length - 1];
  return { weeks: out, current, rule: capacityRule(current.pct), capacityHours: WEEKLY_CAPACITY_HOURS };
}

export const founderRouter = createRouter({
  // ---------------- Kullanıcı tarafı ----------------

  feedbackSubmit: authedQuery
    .input(z.object({ kind: z.enum(FEEDBACK_KIND_IDS), message: z.string().trim().min(5, "Biraz daha ayrıntı yazın.").max(4000), page: z.string().max(160).optional() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const m = await db.query.companyMembers.findFirst({ where: eq(companyMembers.userId, ctx.user.id), columns: { companyId: true } });
      await db.insert(feedback).values({ companyId: m?.companyId ?? null, userId: ctx.user.id, kind: input.kind, page: input.page ?? null, message: input.message });
      return { ok: true };
    }),

  myFeedback: authedQuery.query(async ({ ctx }) => {
    return getDb().query.feedback.findMany({ where: eq(feedback.userId, ctx.user.id), orderBy: desc(feedback.createdAt), limit: 20 });
  }),

  // ---------------- Kurucu ----------------

  /** Özet: üyelik, para, açık talepler, hata, kapasite */
  overview: adminQuery.query(async ({ ctx }) => {
    const db = getDb();
    const period = periodOf();
    const months = monthsBack(12);
    const since30 = new Date(Date.now() - 30 * 86_400_000);
    const since7 = new Date(Date.now() - 7 * 86_400_000);

    const [companyRows, memberRows, projectCounts, userCount, newUsers, reqs, aiRows, storage, openFb, err7, myMember] = await Promise.all([
      db.select({ id: companies.id, name: companies.name, city: companies.city, createdAt: companies.createdAt }).from(companies),
      db.select({ companyId: companyMembers.companyId, n: sql<number>`COUNT(*)`, last: sql<string | null>`MAX(${companyMembers.lastSeenAt})` }).from(companyMembers).groupBy(companyMembers.companyId),
      db.select({ companyId: projects.companyId, n: sql<number>`COUNT(*)` }).from(projects).groupBy(projects.companyId),
      db.select({ n: sql<number>`COUNT(*)` }).from(users),
      db.select({ n: sql<number>`COUNT(*)` }).from(users).where(gte(users.createdAt, since30)),
      db.query.billingRequests.findMany({ orderBy: desc(billingRequests.createdAt) }),
      db.query.usageCounters.findMany({ where: and(eq(usageCounters.period, period), eq(usageCounters.kind, "ai")) }),
      storageByCompany(),
      db.select({ n: sql<number>`COUNT(*)` }).from(feedback).where(eq(feedback.status, "open")),
      db.select({ n: sql<number>`COUNT(*)` }).from(appErrors).where(gte(appErrors.createdAt, since7)),
      db.query.companyMembers.findFirst({ where: eq(companyMembers.userId, ctx.user.id), columns: { companyId: true } }),
    ]);

    // Üyelikler
    const list = [];
    let premiumPaid = 0;
    let trial = 0;
    for (const c of companyRows) {
      const ent = await getEntitlements(c.id);
      if (ent.source === "paid") premiumPaid++;
      if (ent.source === "trial") trial++;
      const used = storage.get(c.id) ?? 0;
      const ai = aiRows.find((r) => r.companyId === c.id)?.n ?? 0;
      const mem = memberRows.find((r) => r.companyId === c.id);
      list.push({
        id: c.id,
        name: c.name,
        city: c.city,
        createdAt: c.createdAt,
        tier: ent.tier,
        source: ent.source,
        trialEndsAt: ent.trialEndsAt,
        periodEnd: ent.periodEnd,
        members: Number(mem?.n ?? 0),
        lastSeenAt: mem?.last ?? null,
        projects: Number(projectCounts.find((r) => r.companyId === c.id)?.n ?? 0),
        storageBytes: used,
        storagePct: quotaPct(used, STORAGE_QUOTA_BYTES[ent.tier]),
        aiUsed: ai,
        aiPct: quotaPct(ai, AI_MONTHLY_QUOTA[ent.tier]),
      });
    }
    list.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));

    // Gelen para: onaylanan abonelik ödemeleri (onay ayına göre)
    const approved = reqs.filter((r) => r.status === "approved" && r.decidedAt);
    const incoming = months.map((m) => ({
      month: m,
      amount: approved.filter((r) => periodOf(new Date(r.decidedAt!)) === m).reduce((t, r) => t + r.amount, 0),
    }));
    // Aylık tekrarlayan gelir tahmini: son onaylı ödemesi yıllıksa /12
    const lastByCompany = new Map<number, (typeof approved)[number]>();
    for (const r of approved) if (!lastByCompany.has(r.companyId)) lastByCompany.set(r.companyId, r);
    let mrr = 0;
    for (const c of list) {
      if (c.source !== "paid") continue;
      const r = lastByCompany.get(c.id);
      if (r) mrr += r.billingInterval === "yearly" ? r.amount / 12 : r.amount;
    }
    const pending = reqs.filter((r) => r.status === "pending");

    // Giden para: kurucunun kendi şirketinin Patron panelindeki ödemeleri
    let outgoing: { month: string; amount: number }[] = months.map((m) => ({ month: m, amount: 0 }));
    let incomingOther: { month: string; amount: number }[] = months.map((m) => ({ month: m, amount: 0 }));
    if (myMember) {
      const fin = await db.query.financeEntries.findMany({
        where: and(eq(financeEntries.companyId, myMember.companyId), gte(financeEntries.entryDate, `${months[0]}-01`), inArray(financeEntries.status, ["approved", "done"])),
      });
      outgoing = months.map((m) => ({ month: m, amount: fin.filter((f) => f.direction === "out" && f.entryDate.startsWith(m)).reduce((t, f) => t + f.amount, 0) }));
      incomingOther = months.map((m) => ({ month: m, amount: fin.filter((f) => f.direction === "in" && f.entryDate.startsWith(m)).reduce((t, f) => t + f.amount, 0) }));
    }

    const cap = await weeklyCapacity(8);
    const activeCases = await db.select({ n: sql<number>`COUNT(*)` }).from(consultingCases).where(eq(consultingCases.status, "active"));

    // Satış hunisi — son 90 gün (contracts/funnel.ts)
    const since90 = new Date(Date.now() - 90 * 86_400_000);
    const leadRows = await db.query.leads.findMany({
      where: gte(leads.createdAt, since90),
      columns: { stage: true, stageAt: true, createdAt: true, followUps: true, lostReason: true },
    });
    const byStage = Object.fromEntries(LEAD_STAGES.map((st) => [st, leadRows.filter((l) => l.stage === st).length])) as Record<LeadStage, number>;
    const closed = byStage.imza + byStage.kayip;
    const lostReasons = LOST_REASONS.map((r) => ({ id: r.id, label: r.label, n: leadRows.filter((l) => l.stage === "kayip" && l.lostReason === r.id).length }))
      .filter((r) => r.n > 0)
      .sort((a, b) => b.n - a.n);
    const dueNow = leadRows.filter((l) => dueFollowUp(l)).length;

    // Abonelik tutunması: ilk onaylı Premium ödemesi 90+ gün önce olan şirketlerden kaçı hâlâ ücretli
    const firstPaid = new Map<number, Date>();
    for (const r of [...approved].reverse()) if (!firstPaid.has(r.companyId)) firstPaid.set(r.companyId, new Date(r.decidedAt!));
    const cohort = [...firstPaid.entries()].filter(([, d]) => d <= since90).map(([id]) => id);
    const retained = cohort.filter((id) => list.find((c) => c.id === id)?.source === "paid").length;

    return {
      members: {
        users: Number(userCount[0]?.n ?? 0),
        newUsers30: Number(newUsers[0]?.n ?? 0),
        companies: companyRows.length,
        newCompanies30: companyRows.filter((c) => new Date(c.createdAt) >= since30).length,
        premiumPaid,
        trial,
        list,
      },
      money: {
        months,
        incoming,
        incomingOther,
        outgoing,
        mrr: Math.round(mrr),
        pendingCount: pending.length,
        pendingAmount: pending.reduce((t, r) => t + r.amount, 0),
        hasOwnCompany: !!myMember,
      },
      openFeedback: Number(openFb[0]?.n ?? 0),
      errors7: Number(err7[0]?.n ?? 0),
      capacity: cap,
      activeCases: Number(activeCases[0]?.n ?? 0),
      funnel: {
        total: leadRows.length,
        byStage,
        closeRate: closed ? Math.round((byStage.imza / closed) * 100) : null,
        lostReasons,
        dueNow,
      },
      retention: { cohort: cohort.length, retained, pct: cohort.length ? Math.round((retained / cohort.length) * 100) : null },
    };
  }),

  // ---- Yan menü rozetleri · Başvurular · Ürünler · Müşteriler (Shopify Orders / Products / Customers karşılığı)
  badges: adminQuery.query(() => badges()),
  leads: adminQuery.query(() => leadsList()),
  lead: adminQuery.input(z.object({ id: z.number() })).query(async ({ input }) => {
    const d = await leadDetail(input.id);
    if (!d) throw new TRPCError({ code: "NOT_FOUND", message: "Başvuru bulunamadı." });
    return d;
  }),
  leadNote: adminQuery
    .input(z.object({ id: z.number(), body: z.string().trim().min(1, "Notu yazın.").max(1000) }))
    .mutation(async ({ ctx, input }) => {
      await addLeadNote(input.id, input.body, ctx.user.id);
      return { ok: true };
    }),
  products: adminQuery.input(z.object({ days: z.union([z.literal(30), z.literal(90), z.literal(365)]) })).query(({ input }) => productsReport(input.days)),
  contacts: adminQuery.query(() => contactsList()),

  // ---- Site trafiği · canlı · kampanya · SEO
  traffic: adminQuery.input(z.object({ days: z.union([z.literal(1), z.literal(7), z.literal(30), z.literal(90)]) })).query(({ input }) => trafficReport(input.days)),
  live: adminQuery.query(() => liveReport()),
  campaigns: adminQuery.input(z.object({ days: z.union([z.literal(7), z.literal(30), z.literal(90)]) })).query(({ input }) => campaignReport(input.days)),
  seo: adminQuery.query(() => seoReport(env.isProduction)),

  // ---- Yardım ve geri bildirim
  feedbackList: adminQuery.input(z.object({ status: z.enum(["open", "answered", "closed", "all"]).default("open") }).optional()).query(async ({ input }) => {
    const db = getDb();
    const st = input?.status ?? "open";
    const rows = await db.query.feedback.findMany({
      where: st === "all" ? undefined : eq(feedback.status, st),
      orderBy: desc(feedback.createdAt),
      limit: 200,
    });
    const uids = [...new Set(rows.map((r) => r.userId))];
    const cids = [...new Set(rows.map((r) => r.companyId).filter((x): x is number => !!x))];
    const [us, cs] = await Promise.all([
      uids.length ? db.select({ id: users.id, name: users.name, email: users.email }).from(users).where(inArray(users.id, uids)) : [],
      cids.length ? db.select({ id: companies.id, name: companies.name }).from(companies).where(inArray(companies.id, cids)) : [],
    ]);
    return rows.map((r) => ({
      ...r,
      user: us.find((u) => u.id === r.userId) ?? null,
      companyName: cs.find((c) => c.id === r.companyId)?.name ?? null,
    }));
  }),

  feedbackReply: adminQuery
    .input(z.object({ id: z.number(), reply: z.string().trim().min(1).max(4000) }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const f = await db.query.feedback.findFirst({ where: eq(feedback.id, input.id) });
      if (!f) throw new TRPCError({ code: "NOT_FOUND", message: "Kayıt bulunamadı." });
      await db.update(feedback).set({ reply: input.reply, status: "answered", answeredAt: new Date() }).where(eq(feedback.id, f.id));
      if (f.companyId) {
        await db
          .insert(notifications)
          .values({
            companyId: f.companyId,
            userId: f.userId,
            kind: "feedback",
            severity: "info",
            title: "Sorunuz cevaplandı",
            body: input.reply.slice(0, 1000),
            link: null,
            dedupeKey: `feedback:${f.id}`,
          })
          .onDuplicateKeyUpdate({ set: { body: input.reply.slice(0, 1000), readAt: null } });
      }
      return { ok: true };
    }),

  feedbackSetStatus: adminQuery
    .input(z.object({ id: z.number(), status: z.enum(["open", "answered", "closed"]) }))
    .mutation(async ({ input }) => {
      await getDb().update(feedback).set({ status: input.status }).where(eq(feedback.id, input.id));
      return { ok: true };
    }),

  // ---- Hata kayıtları
  errorsList: adminQuery.input(z.object({ source: z.enum(["all", "trpc", "ai", "http"]).default("all") }).optional()).query(async ({ input }) => {
    const src = input?.source ?? "all";
    return getDb().query.appErrors.findMany({
      where: src === "all" ? undefined : eq(appErrors.source, src),
      orderBy: desc(appErrors.createdAt),
      limit: 200,
    });
  }),

  errorsClear: adminQuery.mutation(async () => {
    await getDb().delete(appErrors);
    return { ok: true };
  }),

  // ---- Danışmanlık dosyaları + süre
  cases: adminQuery.query(async () => {
    const db = getDb();
    const thisWeek = weekStartOf(todayTR());
    const [rows, times] = await Promise.all([
      db.query.consultingCases.findMany({ orderBy: desc(consultingCases.updatedAt), limit: 300 }),
      db.select({ caseId: consultingTime.caseId, workDate: consultingTime.workDate, minutes: consultingTime.minutes }).from(consultingTime),
    ]);
    return rows.map((c) => {
      const pkg = getPackage(c.packageId);
      const mine = times.filter((t) => t.caseId === c.id);
      return {
        id: c.id,
        refCode: c.refCode,
        clientName: c.clientName,
        companyName: c.companyName,
        packageId: c.packageId,
        packageCode: pkg?.code ?? "?",
        packageName: pkg?.name ?? c.packageId,
        stageLabel: pkg?.stages[c.stageIndex]?.label ?? "-",
        stageIndex: c.stageIndex,
        stageCount: pkg?.stages.length ?? 0,
        status: c.status,
        approval: c.approval,
        targetDate: c.targetDate,
        totalMinutes: mine.reduce((t, r) => t + r.minutes, 0),
        weekMinutes: mine.filter((r) => weekStartOf(String(r.workDate).slice(0, 10)) === thisWeek).reduce((t, r) => t + r.minutes, 0),
      };
    });
  }),

  timeList: adminQuery.input(z.object({ caseId: z.number() })).query(async ({ input }) => {
    const db = getDb();
    const rows = await db.query.consultingTime.findMany({ where: eq(consultingTime.caseId, input.caseId), orderBy: [desc(consultingTime.workDate), desc(consultingTime.id)] });
    return rows;
  }),

  timeAdd: adminQuery
    .input(
      z.object({
        caseId: z.number(),
        workDate: ymd,
        minutes: z.number().int().min(5, "En az 5 dakika.").max(16 * 60, "Bir günde en fazla 16 saat."),
        note: z.string().trim().max(255).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const c = await db.query.consultingCases.findFirst({ where: eq(consultingCases.id, input.caseId), columns: { id: true } });
      if (!c) throw new TRPCError({ code: "NOT_FOUND", message: "Dosya bulunamadı." });
      await db.insert(consultingTime).values({ caseId: c.id, workDate: input.workDate, minutes: input.minutes, note: input.note || null, userId: ctx.user.id });
      return { ok: true };
    }),

  timeRemove: adminQuery.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
    await getDb().delete(consultingTime).where(eq(consultingTime.id, input.id));
    return { ok: true };
  }),
});
