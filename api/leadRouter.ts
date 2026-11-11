import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { desc, eq } from "drizzle-orm";
import { adminQuery, createRouter, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { leadNotes, leads } from "@db/schema";
import { explainMailError, sendLeadNotification } from "./lib/mailer";
import { clientIp, rateLimit } from "./lib/codes";
import { logAppError } from "./lib/usage";
import { recordEvent } from "./lib/siteEvents";
import { FOLLOW_UP_DAYS, LEAD_STAGE_LABEL, LEAD_STAGES, LOST_REASONS, statusFromStage, type LostReason } from "@contracts/funnel";
import { emptyToNull, formatCompanyName, formatPersonName, formatPhoneTR, normalizeEmail } from "@contracts/normalize";

export const leadRouter = createRouter({
  /** Halka açık danışmanlık başvuru formu */
  submit: publicQuery
    .input(
      z.object({
        name: z.string().transform(formatPersonName).pipe(z.string().min(2, "Adınızı girin.").max(255)),
        companyName: z.string().max(255).optional(),
        email: z
          .string()
          .transform(normalizeEmail)
          .pipe(z.string().email("Geçerli bir e-posta girin.").max(320).or(z.literal("")))
          .optional(),
        phone: z.string().max(64).optional(),
        interest: z.string().max(120).optional(),
        quizJson: z.string().max(4000).optional(),
        message: z.string().max(4000).optional(),
        /** Site oturumu (src/lib/track.ts) — başvurunun hangi kaynak / kampanyadan geldiğini eşler */
        sid: z.string().regex(/^[a-z0-9]{8,24}$/i).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Spam koruması: IP başına saatte 5 başvuru
      if (!rateLimit(`lead:${clientIp(ctx.req.headers)}`, 5, 60 * 60_000)) {
        throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Çok fazla başvuru gönderildi. Lütfen daha sonra tekrar deneyin." });
      }
      if (!input.email && !input.phone?.trim()) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Size ulaşabilmemiz için e-posta veya telefon bırakın.",
        });
      }
      const row = {
        name: input.name,
        companyName: input.companyName ? formatCompanyName(input.companyName) || null : null,
        email: input.email || null,
        phone: input.phone ? formatPhoneTR(input.phone) || null : null,
        interest: emptyToNull(input.interest),
        quizJson: input.quizJson || null,
        message: input.message ? input.message.trim() || null : null,
      };
      await getDb().insert(leads).values({ ...row, sid: input.sid ?? null });
      if (input.sid) {
        let path = "/danismanlik";
        try {
          path = new URL(ctx.req.headers.get("referer") ?? "").pathname || path;
        } catch {
          // yönlendiren adres yoksa varsayılan
        }
        void recordEvent(ctx.req.headers, { type: "lead", sid: input.sid, path }).catch(() => undefined);
      }
      // Bildirim e-postası — SMTP kurulu değilse sessizce geçilir, talep yine kaydedildi
      sendLeadNotification(row)
        .then((sent) => {
          if (sent) console.log("[mail] talep bildirimi gönderildi");
          else {
            console.log("[mail] talep bildirimi atlandı: e-posta ayarlı değil");
            void logAppError({ source: "http", path: "lead.submit", code: "MAIL_OFF", message: "Danışmanlık başvurusu kaydedildi ama bildirim e-postası gitmedi: e-posta gönderimi ayarlı değil." });
          }
        })
        .catch((err) => {
          const msg = explainMailError(err);
          console.error("[mail] talep bildirimi gönderilemedi:", msg);
          void logAppError({ source: "http", path: "lead.submit", code: "MAIL_FAIL", message: `Danışmanlık başvurusu kaydedildi ama bildirim e-postası gönderilemedi: ${msg}` });
        });
      return { ok: true };
    }),

  /**
   * Gelen talepler — YALNIZ site yöneticisi (users.role = admin, OWNER_UNION_ID) görür.
   * Eskiden siteye kayıtlı her şirketin yöneticisi tüm başvuruları (ad, telefon, e-posta) görebiliyordu:
   * KVKK açısından kişisel veri ifşası — kapatıldı.
   */
  list: adminQuery.query(async () => {
    const db = getDb();
    const rows = await db.query.leads.findMany({ orderBy: desc(leads.createdAt) });
    const cases = await db.query.consultingCases.findMany({ columns: { id: true, leadId: true, refCode: true } });
    return rows.map((l) => ({ ...l, caseRef: cases.find((c) => c.leadId === l.id)?.refCode ?? null }));
  }),

  setStatus: adminQuery
    .input(z.object({ id: z.number(), status: z.enum(["new", "contacted", "done"]) }))
    .mutation(async ({ input }) => {
      await getDb().update(leads).set({ status: input.status }).where(eq(leads.id, input.id));
      return { ok: true };
    }),

  /** Huni aşaması (contracts/funnel.ts). Kayıpta neden zorunlu; aşama değişince takip sayacı sıfırlanır. */
  setStage: adminQuery
    .input(
      z.object({
        id: z.number(),
        stage: z.enum(LEAD_STAGES),
        lostReason: z.enum(LOST_REASONS.map((r) => r.id) as [LostReason, ...LostReason[]]).optional(),
        lostNote: z.string().trim().max(255).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (input.stage === "kayip" && !input.lostReason) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Kaybedilen başvuru için bir neden seçin." });
      }
      await getDb()
        .update(leads)
        .set({
          stage: input.stage,
          stageAt: new Date(),
          followUps: 0,
          status: statusFromStage(input.stage),
          lostReason: input.stage === "kayip" ? input.lostReason ?? "diger" : null,
          lostNote: input.stage === "kayip" ? input.lostNote || null : null,
        })
        .where(eq(leads.id, input.id));
      const reason = input.stage === "kayip" ? LOST_REASONS.find((r) => r.id === input.lostReason)?.label : null;
      await getDb()
        .insert(leadNotes)
        .values({
          leadId: input.id,
          kind: "stage",
          body: `Aşama: ${LEAD_STAGE_LABEL[input.stage]}${reason ? ` — neden: ${reason}` : ""}${input.stage === "kayip" && input.lostNote ? ` (${input.lostNote})` : ""}`,
          userId: ctx.user.id,
        })
        .catch(() => undefined);
      return { ok: true };
    }),

  /** Teklif takibi yapıldı (3./7./14. gün) */
  followUpDone: adminQuery.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
    const db = getDb();
    const l = await db.query.leads.findFirst({ where: eq(leads.id, input.id), columns: { followUps: true } });
    if (!l) throw new TRPCError({ code: "NOT_FOUND", message: "Başvuru bulunamadı." });
    const n = Math.min(l.followUps + 1, FOLLOW_UP_DAYS.length);
    await db.update(leads).set({ followUps: n }).where(eq(leads.id, input.id));
    await db
      .insert(leadNotes)
      .values({ leadId: input.id, kind: "followup", body: `Teklif takibi yapıldı (${FOLLOW_UP_DAYS[n - 1]}. gün)`, userId: ctx.user.id })
      .catch(() => undefined);
    return { ok: true };
  }),
});
