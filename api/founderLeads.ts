/**
 * Kurucu Paneli · Başvurular (Shopify "Orders"), Başvuru ayrıntısı (Order detail), Ürünler (Products),
 * Müşteriler (Customers) ve yan menü rozetleri.
 * Kaynak: leads + lead_notes + site_events + consulting_cases. Yapay zekâ yok.
 */
import { and, asc, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { getDb } from "./queries/connection";
import { appErrors, billingRequests, consultingCases, feedback, leadNotes, leads, siteEvents, users } from "@db/schema";
import { buildSessions, pageLabel, type Session } from "./founderTraffic";
import { CHANNEL_LABEL, DEVICE_LABEL, tzLabel } from "@contracts/traffic";
import { CONSULTING_PACKAGES, getPackage } from "@contracts/consulting";
import { dueFollowUp, LEAD_STAGE_LABEL, LOST_REASONS, type LeadStage } from "@contracts/funnel";
import { packageIdFromInterest } from "@contracts/founder";

const DAY = 86_400_000;

/** Oturum kimliklerine göre ziyaret bilgisi */
async function sessionsFor(sids: string[]): Promise<Map<string, Session>> {
  if (!sids.length) return new Map();
  const rows = await getDb().select().from(siteEvents).where(inArray(siteEvents.sid, sids));
  return buildSessions(rows);
}

const contactKey = (l: { email: string | null; phone: string | null; name: string }) =>
  (l.email?.toLowerCase() || l.phone?.replace(/\D/g, "").slice(-10) || l.name.toLocaleLowerCase("tr")).trim();

// ---------------- Yan menü rozetleri ----------------

export async function badges() {
  const db = getDb();
  const since7 = new Date(Date.now() - 7 * DAY);
  const [open, fb, err, pay] = await Promise.all([
    db.query.leads.findMany({ where: inArray(leads.stage, ["basvuru", "teklif"]), columns: { stage: true, stageAt: true, createdAt: true, followUps: true } }),
    db.select({ n: sql<number>`COUNT(*)` }).from(feedback).where(eq(feedback.status, "open")),
    db.select({ n: sql<number>`COUNT(*)` }).from(appErrors).where(gte(appErrors.createdAt, since7)),
    db.select({ n: sql<number>`COUNT(*)` }).from(billingRequests).where(eq(billingRequests.status, "pending")),
  ]);
  return {
    newLeads: open.filter((l) => l.stage === "basvuru").length,
    /** 24 saati geçmiş, yanıtlanmamış başvuru */
    overdueLeads: open.filter((l) => l.stage === "basvuru" && dueFollowUp(l)).length,
    /** Takip günü gelmiş teklif */
    dueFollowUps: open.filter((l) => l.stage === "teklif" && dueFollowUp(l)).length,
    openFeedback: Number(fb[0]?.n ?? 0),
    errors7: Number(err[0]?.n ?? 0),
    pendingPayments: Number(pay[0]?.n ?? 0),
  };
}

// ---------------- Başvurular ----------------

export async function leadsList() {
  const db = getDb();
  const [rows, cases] = await Promise.all([
    db.query.leads.findMany({ orderBy: desc(leads.createdAt), limit: 500 }),
    db.query.consultingCases.findMany({ columns: { leadId: true, refCode: true } }),
  ]);
  const ses = await sessionsFor(rows.map((r) => r.sid).filter((x): x is string => !!x));
  return rows.map((l) => {
    const s = l.sid ? ses.get(l.sid) : undefined;
    const pkg = getPackage(packageIdFromInterest(l.interest, CONSULTING_PACKAGES));
    const due = dueFollowUp(l);
    return {
      id: l.id,
      createdAt: l.createdAt,
      name: l.name,
      companyName: l.companyName,
      email: l.email,
      phone: l.phone,
      interest: l.interest,
      packageCode: pkg?.code ?? null,
      packageName: pkg?.name ?? null,
      stage: l.stage as LeadStage,
      due: due?.label ?? null,
      dueUrgent: !!due?.urgent,
      channel: s ? CHANNEL_LABEL[s.channel] : null,
      campaign: s?.utmCampaign ?? null,
      caseRef: cases.find((c) => c.leadId === l.id)?.refCode ?? null,
    };
  });
}

export async function leadDetail(id: number) {
  const db = getDb();
  const l = await db.query.leads.findFirst({ where: eq(leads.id, id) });
  if (!l) return null;
  const [notes, kase, all, notesUsers] = await Promise.all([
    db.query.leadNotes.findMany({ where: eq(leadNotes.leadId, id), orderBy: asc(leadNotes.createdAt) }),
    db.query.consultingCases.findFirst({ where: eq(consultingCases.leadId, id), columns: { id: true, refCode: true, status: true } }),
    db.query.leads.findMany({ columns: { id: true, name: true, email: true, phone: true, createdAt: true }, orderBy: desc(leads.createdAt) }),
    db.select({ id: users.id, name: users.name }).from(users).where(eq(users.role, "admin")),
  ]);

  // Aynı kişinin başvuruları (e-posta / telefon / ad)
  const key = contactKey(l);
  const same = all.filter((x) => contactKey(x) === key).sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt));
  const order = same.findIndex((x) => x.id === l.id) + 1;

  // Önceki / sonraki başvuru (liste sırası: yeni → eski)
  const idx = all.findIndex((x) => x.id === l.id);
  const newerId = idx > 0 ? all[idx - 1].id : null;
  const olderId = idx >= 0 && idx < all.length - 1 ? all[idx + 1].id : null;

  // Dönüşüm özeti
  let conversion = null as null | {
    channel: string;
    refHost: string | null;
    campaign: string | null;
    source: string | null;
    medium: string | null;
    landing: string;
    device: string;
    location: string;
    firstSeen: Date;
    minutesToLead: number;
    views: number;
    pages: string[];
  };
  if (l.sid) {
    const s = (await sessionsFor([l.sid])).get(l.sid);
    if (s) {
      conversion = {
        channel: CHANNEL_LABEL[s.channel],
        refHost: s.refHost,
        campaign: s.utmCampaign,
        source: s.utmSource,
        medium: s.utmMedium,
        landing: pageLabel(s.landing),
        device: DEVICE_LABEL[s.device],
        location: tzLabel(s.tz),
        firstSeen: new Date(s.start),
        minutesToLead: Math.max(0, Math.round((+new Date(l.createdAt) - s.start) / 60_000)),
        views: s.views,
        pages: [...s.paths].map(pageLabel),
      };
    }
  }

  // Ofis Röntgeni test sonucu (varsa)
  let quiz: null | { endeks?: number; zayif?: string; oneri?: string | null; alanlar?: Record<string, number> } = null;
  try {
    quiz = l.quizJson ? JSON.parse(l.quizJson) : null;
  } catch {
    quiz = null;
  }

  const pkg = getPackage(packageIdFromInterest(l.interest, CONSULTING_PACKAGES));
  const due = dueFollowUp(l);
  const nameOf = (uid: number | null) => notesUsers.find((u) => u.id === uid)?.name ?? null;

  const timeline = [
    { id: `c${l.id}`, at: l.createdAt, kind: "system", body: `Başvuru alındı${conversion ? ` · ${conversion.channel}${conversion.campaign ? ` / ${conversion.campaign}` : ""}` : ""}`, by: null as string | null },
    ...notes.map((n) => ({ id: `n${n.id}`, at: n.createdAt, kind: n.kind, body: n.body, by: nameOf(n.userId) })),
  ].sort((a, b) => +new Date(b.at) - +new Date(a.at));

  return {
    lead: {
      id: l.id,
      name: l.name,
      companyName: l.companyName,
      email: l.email,
      phone: l.phone,
      interest: l.interest,
      message: l.message,
      stage: l.stage,
      stageAt: l.stageAt,
      createdAt: l.createdAt,
      followUps: l.followUps,
      lostReason: l.lostReason,
      lostNote: l.lostNote,
      lostReasonLabel: l.lostReason ? LOST_REASONS.find((r) => r.id === l.lostReason)?.label ?? l.lostReason : null,
    },
    stageLabel: LEAD_STAGE_LABEL[l.stage as LeadStage] ?? l.stage,
    due: due ? { label: due.label, urgent: due.urgent } : null,
    pkg: pkg ? { id: pkg.id, code: pkg.code, name: pkg.name, duration: pkg.duration, question: pkg.question, comingSoon: !!pkg.comingSoon } : null,
    quiz,
    contact: { order, total: same.length },
    conversion,
    caseRef: kase?.refCode ?? null,
    timeline,
    newerId,
    olderId,
  };
}

export async function addLeadNote(leadId: number, body: string, userId: number) {
  await getDb().insert(leadNotes).values({ leadId, kind: "note", body, userId });
}

// ---------------- Ürünler ----------------

export async function productsReport(days: number) {
  const db = getDb();
  const from = new Date(Date.now() - days * DAY);
  const [views, leadRows] = await Promise.all([
    db
      .select({ path: siteEvents.path, n: sql<number>`COUNT(*)`, s: sql<number>`COUNT(DISTINCT ${siteEvents.sid})` })
      .from(siteEvents)
      .where(and(eq(siteEvents.type, "view"), gte(siteEvents.createdAt, from)))
      .groupBy(siteEvents.path),
    db.query.leads.findMany({ where: gte(leads.createdAt, from), columns: { interest: true, stage: true } }),
  ]);
  return CONSULTING_PACKAGES.map((p) => {
    const v = views.find((x) => x.path === `/danismanlik/${p.id}`);
    const mine = leadRows.filter((l) => packageIdFromInterest(l.interest, CONSULTING_PACKAGES) === p.id);
    const sessions = Number(v?.s ?? 0);
    return {
      id: p.id,
      code: p.code,
      name: p.name,
      line: p.line,
      duration: p.duration,
      comingSoon: !!p.comingSoon,
      draft: !!p.draft,
      views: Number(v?.n ?? 0),
      sessions,
      leads: mine.length,
      open: mine.filter((l) => !["imza", "kayip"].includes(l.stage)).length,
      imza: mine.filter((l) => l.stage === "imza").length,
      conv: sessions ? Math.round((mine.length / sessions) * 1000) / 10 : 0,
    };
  });
}

// ---------------- Müşteriler (danışmanlık kişileri) ----------------

export async function contactsList() {
  const db = getDb();
  const rows = await db.query.leads.findMany({ orderBy: desc(leads.createdAt), limit: 2000 });
  const m = new Map<string, { key: string; name: string; companyName: string | null; email: string | null; phone: string | null; leads: number; imza: number; lastAt: Date; lastStage: string; lastId: number }>();
  for (const l of rows) {
    const k = contactKey(l);
    const v = m.get(k);
    if (!v) {
      m.set(k, { key: k, name: l.name, companyName: l.companyName, email: l.email, phone: l.phone, leads: 1, imza: l.stage === "imza" ? 1 : 0, lastAt: l.createdAt, lastStage: LEAD_STAGE_LABEL[l.stage as LeadStage] ?? l.stage, lastId: l.id });
    } else {
      v.leads++;
      if (l.stage === "imza") v.imza++;
      v.companyName ??= l.companyName;
      v.email ??= l.email;
      v.phone ??= l.phone;
    }
  }
  return [...m.values()];
}
