/**
 * Danışmanlık süreç takibi.
 *
 *  - track (herkese açık): müşteri yalnız referans koduyla (HZ-XXXX-XXXX) sürecin aşamasını ve onay durumunu görür.
 *    Üye girişi gerekmez. Kişisel veri en aza indirilir (ad maskelenir, e-posta/telefon dönmez, iç notlar dönmez).
 *    Kaba kuvvet: kod ~40 bit + IP başına 10 dakikada 20 sorgu sınırı.
 *  - admin.* (yalnız site yöneticisi): süreç aç, aşama ilerlet, onay durumu, not, kodu e-postayla gönder.
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { asc, desc, eq } from "drizzle-orm";
import { adminQuery, createRouter, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { consultingCases, consultingEvents, leads, type ConsultingCase, type ConsultingEvent } from "@db/schema";
import {
  APPROVAL_LABEL,
  APPROVAL_STATES,
  CASE_STATUSES,
  CASE_STATUS_LABEL,
  CONSULTING_PACKAGES,
  defaultApprovalFor,
  getPackage,
  maskName,
  normalizeRefCode,
  type ApprovalState,
  type CaseStatus,
} from "@contracts/consulting";
import { emptyToNull, formatCompanyName, formatPersonName, formatPhoneTR, normalizeEmail } from "@contracts/normalize";
import { clientIp, generateRefCode, rateLimit } from "./lib/codes";
import { sendDirectMail } from "./lib/mailer";
import { logAppError } from "./lib/usage";

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tarih YYYY-AA-GG olmalı");
const packageIdSchema = z.string().refine((id) => !!getPackage(id), "Geçersiz paket.");

function asApproval(v: string): ApprovalState {
  return (APPROVAL_STATES as readonly string[]).includes(v) ? (v as ApprovalState) : "none";
}
function asStatus(v: string): CaseStatus {
  return (CASE_STATUSES as readonly string[]).includes(v) ? (v as CaseStatus) : "active";
}

/** Müşteriye gösterilen görünüm — iç not, e-posta, telefon YOK */
function publicView(c: ConsultingCase, events: ConsultingEvent[]) {
  const pkg = getPackage(c.packageId);
  const status = asStatus(c.status);
  const stages = (pkg?.stages ?? []).map((s, i) => ({
    key: s.key,
    label: s.label,
    desc: s.desc,
    needsApproval: !!s.needsApproval,
    state: (status === "completed" || i < c.stageIndex ? "done" : i === c.stageIndex ? "current" : "upcoming") as
      | "done"
      | "current"
      | "upcoming",
  }));
  const approval = asApproval(c.approval);
  const doneCount = stages.filter((s) => s.state === "done").length;
  return {
    refCode: c.refCode,
    clientLabel: maskName(c.clientName),
    companyName: c.companyName,
    packageId: c.packageId,
    packageName: pkg?.name ?? c.packageId,
    packageDuration: pkg?.duration ?? null,
    stages,
    stageIndex: c.stageIndex,
    currentStage: stages[c.stageIndex]?.label ?? null,
    progress: stages.length ? Math.round((doneCount / stages.length) * 100) : 0,
    approval,
    approvalLabel: APPROVAL_LABEL[approval],
    approvalNote: c.approvalNote,
    status,
    statusLabel: CASE_STATUS_LABEL[status],
    startDate: c.startDate ? String(c.startDate) : null,
    targetDate: c.targetDate ? String(c.targetDate) : null,
    updatedAt: c.updatedAt,
    events: events
      .filter((e) => e.isPublic)
      .map((e) => ({ id: e.id, kind: e.kind, title: e.title, body: e.body, createdAt: e.createdAt })),
  };
}

export type ConsultingPublicView = ReturnType<typeof publicView>;

async function loadCase(id: number) {
  const c = await getDb().query.consultingCases.findFirst({ where: eq(consultingCases.id, id) });
  if (!c) throw new TRPCError({ code: "NOT_FOUND", message: "Süreç kaydı bulunamadı." });
  return c;
}

async function addEvent(caseId: number, e: { kind: string; title: string; body?: string | null; isPublic?: boolean; by?: number | null }) {
  await getDb()
    .insert(consultingEvents)
    .values({
      caseId,
      kind: e.kind,
      title: e.title.slice(0, 255),
      body: e.body ?? null,
      isPublic: e.isPublic ?? true,
      createdById: e.by ?? null,
    });
}

function trackUrl(refCode: string) {
  const base = (process.env.PUBLIC_SITE_URL || "https://haiz.org").replace(/\/+$/, "");
  return `${base}/takip/${refCode}`;
}

/** Takip kodu e-postası. Başarısızsa nedeni Kurucu Paneli › Hatalar'a yazılır (eskiden sessizce yutuluyordu). */
async function mailRefCode(c: ConsultingCase): Promise<{ ok: boolean; error: string | null }> {
  if (!c.email) return { ok: false, error: "Kayıtta e-posta yok." };
  const pkg = getPackage(c.packageId);
  const res = await sendDirectMail({
    to: c.email,
    subject: `HAIZ danışmanlık süreç takip kodunuz: ${c.refCode}`,
    text: [
      `Merhaba ${c.clientName.split(" ")[0]},`,
      "",
      `${pkg?.name ?? "Danışmanlık"} süreciniz başlatıldı. Aşağıdaki kodla süreç aşamasını ve onay durumunu üye girişi yapmadan takip edebilirsiniz:`,
      "",
      `Referans kodu: ${c.refCode}`,
      `Takip sayfası: ${trackUrl(c.refCode)}`,
      "",
      "Bu kodu yalnız sizinle paylaşıyoruz; lütfen üçüncü kişilerle paylaşmayın.",
    ].join("\n"),
  });
  if (!res.ok) {
    void logAppError({ source: "http", path: "consulting.mailRefCode", code: "MAIL_FAIL", message: `Takip kodu e-postası gönderilemedi (${c.refCode} → ${c.email}): ${res.error ?? "bilinmeyen neden"}` });
  }
  return res;
}

export const consultingRouter = createRouter({
  /** Herkese açık takip: referans koduyla sorgu */
  track: publicQuery
    .input(z.object({ refCode: z.string().min(4).max(40) }))
    .query(async ({ ctx, input }) => {
      if (!rateLimit(`track:${clientIp(ctx.req.headers)}`, 20, 10 * 60_000)) {
        throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Çok fazla sorgu yapıldı. 10 dakika sonra tekrar deneyin." });
      }
      const code = normalizeRefCode(input.refCode);
      if (!code) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Kod biçimi hatalı. Örnek: HZ-7K3P-9QTX" });
      }
      const db = getDb();
      const c = await db.query.consultingCases.findFirst({ where: eq(consultingCases.refCode, code) });
      if (!c) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Bu referans koduyla kayıt bulunamadı. Kodu kontrol edin." });
      }
      const events = await db.query.consultingEvents.findMany({
        where: eq(consultingEvents.caseId, c.id),
        orderBy: desc(consultingEvents.createdAt),
      });
      return publicView(c, events);
    }),

  /** Paket listesi (sayfalar sözleşmeyi doğrudan da okuyabilir; yönetim formu için) */
  packages: publicQuery.query(() =>
    CONSULTING_PACKAGES.map((p) => ({ id: p.id, group: p.group, code: p.code, name: p.name, comingSoon: !!p.comingSoon, stageCount: p.stages.length })),
  ),

  admin: createRouter({
    list: adminQuery.query(async () => {
      const rows = await getDb().query.consultingCases.findMany({ orderBy: desc(consultingCases.updatedAt) });
      return rows.map((c) => {
        const pkg = getPackage(c.packageId);
        return {
          ...c,
          startDate: c.startDate ? String(c.startDate) : null,
          targetDate: c.targetDate ? String(c.targetDate) : null,
          packageName: pkg?.name ?? c.packageId,
          stageLabel: pkg?.stages[c.stageIndex]?.label ?? "—",
          stageCount: pkg?.stages.length ?? 0,
          approval: asApproval(c.approval),
          status: asStatus(c.status),
        };
      });
    }),

    get: adminQuery.input(z.object({ id: z.number() })).query(async ({ input }) => {
      const c = await loadCase(input.id);
      const events = await getDb().query.consultingEvents.findMany({
        where: eq(consultingEvents.caseId, c.id),
        orderBy: desc(consultingEvents.createdAt),
      });
      return {
        case: { ...c, startDate: c.startDate ? String(c.startDate) : null, targetDate: c.targetDate ? String(c.targetDate) : null },
        events,
        view: publicView(c, events),
      };
    }),

    create: adminQuery
      .input(
        z.object({
          leadId: z.number().nullable().optional(),
          clientName: z.string().transform(formatPersonName).pipe(z.string().min(2, "Müşteri adı gerekli.").max(255)),
          companyName: z.string().max(255).nullable().optional(),
          email: z
            .string()
            .transform(normalizeEmail)
            .pipe(z.string().email("Geçerli bir e-posta girin.").or(z.literal("")))
            .nullable()
            .optional(),
          phone: z.string().max(64).nullable().optional(),
          packageId: packageIdSchema,
          startDate: dateStr.nullable().optional(),
          targetDate: dateStr.nullable().optional(),
          notifyClient: z.boolean().default(true),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const db = getDb();
        if (input.leadId) {
          const lead = await db.query.leads.findFirst({ where: eq(leads.id, input.leadId) });
          if (!lead) throw new TRPCError({ code: "NOT_FOUND", message: "Talep bulunamadı." });
          const existing = await db.query.consultingCases.findFirst({ where: eq(consultingCases.leadId, input.leadId) });
          if (existing) {
            throw new TRPCError({ code: "CONFLICT", message: `Bu talep için zaten süreç var: ${existing.refCode}` });
          }
        }
        const pkg = getPackage(input.packageId)!;
        const refCode = await generateRefCode();
        const [{ id }] = await db
          .insert(consultingCases)
          .values({
            refCode,
            leadId: input.leadId ?? null,
            clientName: input.clientName,
            companyName: input.companyName ? formatCompanyName(input.companyName) || null : null,
            email: input.email || null,
            phone: input.phone ? formatPhoneTR(input.phone) || null : null,
            packageId: input.packageId,
            stageIndex: 0,
            approval: defaultApprovalFor(pkg.stages[0]),
            status: "active",
            startDate: input.startDate ?? null,
            targetDate: input.targetDate ?? null,
            createdById: ctx.user.id,
          })
          .$returningId();
        await addEvent(id, {
          kind: "created",
          title: `${pkg.name} süreci başlatıldı`,
          body: `İlk aşama: ${pkg.stages[0]?.label ?? "—"}`,
          by: ctx.user.id,
        });
        if (input.leadId) await db.update(leads).set({ status: "contacted" }).where(eq(leads.id, input.leadId));
        const created = await loadCase(id);
        const mail = input.notifyClient ? await mailRefCode(created) : null;
        return { id, refCode, mailed: !!mail?.ok, mailError: mail && !mail.ok ? mail.error : null };
      }),

    update: adminQuery
      .input(
        z.object({
          id: z.number(),
          clientName: z.string().transform(formatPersonName).pipe(z.string().min(2).max(255)).optional(),
          companyName: z.string().max(255).nullable().optional(),
          email: z.string().max(320).nullable().optional(),
          phone: z.string().max(64).nullable().optional(),
          startDate: dateStr.nullable().optional(),
          targetDate: dateStr.nullable().optional(),
          internalNote: z.string().max(5000).nullable().optional(),
        }),
      )
      .mutation(async ({ input }) => {
        await loadCase(input.id);
        const set: Partial<typeof consultingCases.$inferInsert> = {};
        if (input.clientName !== undefined) set.clientName = input.clientName;
        if (input.companyName !== undefined) set.companyName = input.companyName ? formatCompanyName(input.companyName) || null : null;
        if (input.email !== undefined) {
          const email = input.email ? normalizeEmail(input.email) : null;
          if (email && !z.string().email().safeParse(email).success) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "Geçerli bir e-posta girin." });
          }
          set.email = email;
        }
        if (input.phone !== undefined) set.phone = input.phone ? formatPhoneTR(input.phone) || null : null;
        if (input.startDate !== undefined) set.startDate = input.startDate;
        if (input.targetDate !== undefined) set.targetDate = input.targetDate;
        if (input.internalNote !== undefined) set.internalNote = emptyToNull(input.internalNote);
        if (Object.keys(set).length) await getDb().update(consultingCases).set(set).where(eq(consultingCases.id, input.id));
        return { ok: true };
      }),

    /** Aşamayı değiştir (ileri/geri). Yeni aşama onay gerektiriyorsa durum "onay bekleniyor" olur. */
    setStage: adminQuery
      .input(z.object({ id: z.number(), stageIndex: z.number().int().min(0), note: z.string().max(2000).optional() }))
      .mutation(async ({ ctx, input }) => {
        const c = await loadCase(input.id);
        const pkg = getPackage(c.packageId);
        if (!pkg || input.stageIndex >= pkg.stages.length) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Geçersiz aşama." });
        }
        if (input.stageIndex === c.stageIndex) return { ok: true };
        const stage = pkg.stages[input.stageIndex];
        await getDb()
          .update(consultingCases)
          .set({ stageIndex: input.stageIndex, approval: defaultApprovalFor(stage), approvalNote: null })
          .where(eq(consultingCases.id, c.id));
        await addEvent(c.id, {
          kind: "stage",
          title: input.stageIndex > c.stageIndex ? `Yeni aşama: ${stage.label}` : `Aşama geri alındı: ${stage.label}`,
          body: input.note?.trim() || stage.desc,
          by: ctx.user.id,
        });
        return { ok: true };
      }),

    setApproval: adminQuery
      .input(z.object({ id: z.number(), approval: z.enum(APPROVAL_STATES), note: z.string().max(500).optional() }))
      .mutation(async ({ ctx, input }) => {
        const c = await loadCase(input.id);
        const note = input.note?.trim() || null;
        await getDb()
          .update(consultingCases)
          .set({ approval: input.approval, approvalNote: note })
          .where(eq(consultingCases.id, c.id));
        const stage = getPackage(c.packageId)?.stages[c.stageIndex];
        await addEvent(c.id, {
          kind: "approval",
          title: `${stage?.label ?? "Aşama"}: ${APPROVAL_LABEL[input.approval]}`,
          body: note,
          by: ctx.user.id,
        });
        return { ok: true };
      }),

    setStatus: adminQuery
      .input(z.object({ id: z.number(), status: z.enum(CASE_STATUSES), note: z.string().max(500).optional() }))
      .mutation(async ({ ctx, input }) => {
        const c = await loadCase(input.id);
        if (c.status === input.status) return { ok: true };
        await getDb().update(consultingCases).set({ status: input.status }).where(eq(consultingCases.id, c.id));
        await addEvent(c.id, {
          kind: "status",
          title: `Süreç durumu: ${CASE_STATUS_LABEL[input.status]}`,
          body: input.note?.trim() || null,
          by: ctx.user.id,
        });
        return { ok: true };
      }),

    addNote: adminQuery
      .input(
        z.object({
          id: z.number(),
          title: z.string().trim().min(2).max(255),
          body: z.string().max(4000).optional(),
          isPublic: z.boolean().default(true),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        await loadCase(input.id);
        await addEvent(input.id, {
          kind: "note",
          title: input.title,
          body: input.body?.trim() || null,
          isPublic: input.isPublic,
          by: ctx.user.id,
        });
        // updatedAt'i tazele (liste sıralaması)
        await getDb().update(consultingCases).set({ updatedAt: new Date() }).where(eq(consultingCases.id, input.id));
        return { ok: true };
      }),

    removeEvent: adminQuery.input(z.object({ eventId: z.number() })).mutation(async ({ input }) => {
      await getDb().delete(consultingEvents).where(eq(consultingEvents.id, input.eventId));
      return { ok: true };
    }),

    sendCode: adminQuery.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
      const c = await loadCase(input.id);
      if (!c.email) throw new TRPCError({ code: "BAD_REQUEST", message: "Bu kayıtta e-posta yok." });
      const mail = await mailRefCode(c);
      if (!mail.ok) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: `E-posta gönderilemedi: ${mail.error ?? "nedeni bilinmiyor"}` });
      }
      return { ok: true };
    }),

    remove: adminQuery.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
      const db = getDb();
      await db.delete(consultingEvents).where(eq(consultingEvents.caseId, input.id));
      await db.delete(consultingCases).where(eq(consultingCases.id, input.id));
      return { ok: true };
    }),

    /** Talepten süreç açarken formu doldurmak için */
    leadOptions: adminQuery.query(async () => {
      const rows = await getDb().query.leads.findMany({ orderBy: asc(leads.createdAt) });
      return rows.map((l) => ({ id: l.id, name: l.name, companyName: l.companyName, email: l.email, phone: l.phone, interest: l.interest }));
    }),
  }),
});
