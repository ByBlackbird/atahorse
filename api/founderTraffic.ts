/**
 * Kurucu Paneli · Trafik / Canlı / Kampanya / SEO hesapları.
 * Kaynak: site_events (birinci taraf, çerezsiz) + leads (aşama) + users (yeni üye) + yayındaki index.html / robots / sitemap.
 * Yapay zekâ yok; her sayı kayıtlardan hesaplanır.
 */
import fs from "node:fs";
import path from "node:path";
import { and, gte, inArray, lt, sql } from "drizzle-orm";
import { getDb } from "./queries/connection";
import { leads, siteEvents, users } from "@db/schema";
import { CHANNEL_LABEL, CHANNELS, DEVICE_LABEL, DEVICES, tzLabel, type Channel, type Device } from "@contracts/traffic";
import { CONSULTING_PACKAGES } from "@contracts/consulting";
import { LEAD_STAGE_LABEL, type LeadStage } from "@contracts/funnel";
import { todayTR } from "../contracts/workflow";

type Ev = typeof siteEvents.$inferSelect;
const HOUR = 3_600_000;
const DAY = 86_400_000;
/** İstanbul UTC+3 (yaz saati yok) */
const TR_OFFSET = 3 * HOUR;

function startOfTodayTR(): number {
  const [y, m, d] = todayTR().split("-").map(Number);
  return Date.UTC(y, m - 1, d) - TR_OFFSET;
}

interface Session {
  sid: string;
  vid: string;
  start: number;
  last: number;
  landing: string;
  exit: string;
  channel: Channel;
  refHost: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  device: Device;
  tz: string | null;
  views: number;
  paths: Set<string>;
  lead: boolean;
}

function buildSessions(rows: Ev[]): Map<string, Session> {
  const out = new Map<string, Session>();
  const sorted = [...rows].sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt));
  for (const r of sorted) {
    const t = +new Date(r.createdAt);
    let s = out.get(r.sid);
    if (!s) {
      s = {
        sid: r.sid,
        vid: r.vid,
        start: t,
        last: t,
        landing: r.path,
        exit: r.path,
        channel: (CHANNELS as readonly string[]).includes(r.channel) ? (r.channel as Channel) : "dogrudan",
        refHost: r.refHost,
        utmSource: r.utmSource,
        utmMedium: r.utmMedium,
        utmCampaign: r.utmCampaign,
        device: (DEVICES as readonly string[]).includes(r.device) ? (r.device as Device) : "masaustu",
        tz: r.tz,
        views: 0,
        paths: new Set(),
        lead: false,
      };
      out.set(r.sid, s);
    }
    s.last = t;
    if (r.type === "view") {
      s.views++;
      s.exit = r.path;
      s.paths.add(r.path);
    } else if (r.type === "lead") s.lead = true;
  }
  return out;
}

async function loadEvents(from: number, to: number): Promise<Ev[]> {
  return getDb()
    .select()
    .from(siteEvents)
    .where(and(gte(siteEvents.createdAt, new Date(from)), lt(siteEvents.createdAt, new Date(to))));
}

function summarize(sessions: Session[]) {
  const n = sessions.length;
  const leadsN = sessions.filter((s) => s.lead).length;
  const views = sessions.reduce((t, s) => t + s.views, 0);
  const single = sessions.filter((s) => s.views <= 1 && !s.lead).length;
  // Tekil ziyaretçi: günlük tuz nedeniyle gün başına tekil; dönem toplamı = günlük tekillerin toplamı
  const visitors = new Set(sessions.map((s) => `${s.vid}|${new Date(s.start + TR_OFFSET).toISOString().slice(0, 10)}`)).size;
  return {
    sessions: n,
    visitors,
    views,
    leads: leadsN,
    conv: n ? Math.round((leadsN / n) * 1000) / 10 : 0,
    pagesPerSession: n ? Math.round((views / n) * 10) / 10 : 0,
    bounce: n ? Math.round((single / n) * 100) : 0,
  };
}

function topBy<T extends string>(sessions: Session[], key: (s: Session) => T | null, limit = 10) {
  const m = new Map<T, { sessions: number; leads: number }>();
  for (const s of sessions) {
    const k = key(s);
    if (k === null) continue;
    const v = m.get(k) ?? { sessions: 0, leads: 0 };
    v.sessions++;
    if (s.lead) v.leads++;
    m.set(k, v);
  }
  return [...m.entries()]
    .map(([k, v]) => ({ key: k, ...v, conv: v.sessions ? Math.round((v.leads / v.sessions) * 1000) / 10 : 0 }))
    .sort((a, b) => b.sessions - a.sessions || b.leads - a.leads)
    .slice(0, limit);
}

export function pageLabel(p: string): string {
  if (p === "/") return "Ana sayfa";
  if (p === "/danismanlik") return "Danışmanlık";
  if (p === "/restorasyon") return "Restorasyon";
  if (p === "/login") return "Giriş";
  if (p === "/katil") return "Ekibe katıl";
  if (p.startsWith("/danismanlik/")) {
    const pkg = CONSULTING_PACKAGES.find((x) => x.id === p.slice(13));
    return pkg ? `Paket · ${pkg.name}` : p;
  }
  return p;
}

/** Shopify "Overview + Acquisition + Behaviour" karşılığı */
export async function trafficReport(days: number) {
  const now = Date.now();
  const curStart = startOfTodayTR() - (days - 1) * DAY;
  const span = now - curStart;
  const prevStart = curStart - days * DAY;
  const prevEnd = prevStart + span;

  const [curRows, prevRows, newUsers, prevUsers] = await Promise.all([
    loadEvents(curStart, now + 1),
    loadEvents(prevStart, prevEnd),
    getDb().select({ n: sql<number>`COUNT(*)` }).from(users).where(gte(users.createdAt, new Date(curStart))),
    getDb()
      .select({ n: sql<number>`COUNT(*)` })
      .from(users)
      .where(and(gte(users.createdAt, new Date(prevStart)), lt(users.createdAt, new Date(prevEnd)))),
  ]);
  const cur = [...buildSessions(curRows).values()];
  const prev = [...buildSessions(prevRows).values()];

  // Zaman serisi: bugün → saatlik, diğerleri → günlük
  const hourly = days === 1;
  const bucketMs = hourly ? HOUR : DAY;
  const nb = hourly ? 24 : days;
  const series = Array.from({ length: nb }, (_, i) => {
    const from = curStart + i * bucketMs;
    const local = new Date(from + TR_OFFSET).toISOString();
    return { key: hourly ? local.slice(11, 13) : local.slice(0, 10), from, sessions: 0, leads: 0 };
  });
  for (const s of cur) {
    const i = Math.floor((s.start - curStart) / bucketMs);
    if (series[i]) {
      series[i].sessions++;
      if (s.lead) series[i].leads++;
    }
  }

  // Huni: oturum → danışmanlık sayfası → paket sayfası → başvuru → imza
  const sids = cur.filter((s) => s.lead).map((s) => s.sid);
  const leadRows = sids.length ? await getDb().select({ sid: leads.sid, stage: leads.stage }).from(leads).where(inArray(leads.sid, sids)) : [];
  const signed = new Set(leadRows.filter((l) => l.stage === "imza").map((l) => l.sid));
  const funnel = [
    { label: "Oturum", n: cur.length },
    { label: "Danışmanlık sayfası", n: cur.filter((s) => [...s.paths].some((p) => p.startsWith("/danismanlik"))).length },
    { label: "Paket sayfası", n: cur.filter((s) => [...s.paths].some((p) => p.startsWith("/danismanlik/"))).length },
    { label: "Başvuru", n: cur.filter((s) => s.lead).length },
    { label: "İmza", n: cur.filter((s) => signed.has(s.sid)).length },
  ];

  // En çok görüntülenen sayfalar (görüntüleme sayısı)
  const viewCount = new Map<string, number>();
  for (const r of curRows) if (r.type === "view") viewCount.set(r.path, (viewCount.get(r.path) ?? 0) + 1);
  const pages = [...viewCount.entries()].map(([p, n]) => ({ path: p, label: pageLabel(p), views: n })).sort((a, b) => b.views - a.views).slice(0, 10);

  return {
    days,
    hourly,
    summary: { ...summarize(cur), signups: Number(newUsers[0]?.n ?? 0) },
    prev: { ...summarize(prev), signups: Number(prevUsers[0]?.n ?? 0) },
    series: series.map(({ key, sessions, leads }) => ({ key, sessions, leads })),
    channels: CHANNELS.map((c) => {
      const ss = cur.filter((s) => s.channel === c);
      const l = ss.filter((s) => s.lead).length;
      return { id: c, label: CHANNEL_LABEL[c], sessions: ss.length, leads: l, conv: ss.length ? Math.round((l / ss.length) * 1000) / 10 : 0 };
    }).filter((c) => c.sessions > 0),
    referrers: topBy(cur, (s) => s.refHost),
    landing: topBy(cur, (s) => s.landing).map((r) => ({ ...r, label: pageLabel(r.key) })),
    exits: topBy(cur, (s) => s.exit).map((r) => ({ ...r, label: pageLabel(r.key) })),
    pages,
    devices: topBy(cur, (s) => s.device).map((r) => ({ ...r, label: DEVICE_LABEL[r.key as Device] ?? r.key })),
    locations: topBy(cur, (s) => tzLabel(s.tz), 8),
    funnel,
  };
}

/** Shopify "Live View" karşılığı — son 5 dakika */
export async function liveReport() {
  const now = Date.now();
  const since = now - 5 * 60_000;
  const [rows, todayRows] = await Promise.all([loadEvents(now - 30 * 60_000, now + 1), loadEvents(startOfTodayTR(), now + 1)]);
  const all = buildSessions(rows);
  const active = [...all.values()].filter((s) => s.last >= since);
  const today = [...buildSessions(todayRows).values()];
  const recent = [...rows]
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
    .slice(0, 25)
    .map((r) => {
      const s = all.get(r.sid);
      return {
        id: r.id,
        at: r.createdAt,
        type: r.type,
        path: r.path,
        label: pageLabel(r.path),
        channel: CHANNEL_LABEL[(s?.channel ?? "dogrudan") as Channel],
        campaign: s?.utmCampaign ?? null,
        device: DEVICE_LABEL[(s?.device ?? "masaustu") as Device],
      };
    });
  return {
    activeNow: active.length,
    pagesNow: topBy(active, (s) => s.exit, 8).map((r) => ({ ...r, label: pageLabel(r.key) })),
    channelsNow: topBy(active, (s) => CHANNEL_LABEL[s.channel], 6),
    devicesNow: topBy(active, (s) => DEVICE_LABEL[s.device], 3),
    today: { sessions: today.length, leads: today.filter((s) => s.lead).length, visitors: new Set(today.map((s) => s.vid)).size },
    recent,
    at: new Date(now),
  };
}

/** Kampanyalar (UTM) + başvuruların kaynağı */
export async function campaignReport(days: number) {
  const now = Date.now();
  const from = startOfTodayTR() - (days - 1) * DAY;
  // Başvuru oturumu dönem başından önce başlamış olabilir: 1 gün geriden yükle
  const rows = await loadEvents(from - DAY, now + 1);
  const sessions = [...buildSessions(rows).values()].filter((s) => s.start >= from || s.lead);
  const inRange = sessions.filter((s) => s.start >= from);

  const leadRows = await getDb()
    .select({ id: leads.id, sid: leads.sid, name: leads.name, companyName: leads.companyName, interest: leads.interest, stage: leads.stage, createdAt: leads.createdAt })
    .from(leads)
    .where(gte(leads.createdAt, new Date(from)));
  const bySid = new Map(sessions.map((s) => [s.sid, s]));

  const camp = new Map<string, { campaign: string; source: string; medium: string; sessions: number; visitors: Set<string>; leads: number; imza: number }>();
  for (const s of inRange) {
    if (!s.utmCampaign && !s.utmSource) continue;
    const k = `${s.utmCampaign ?? "(adsız)"}|${s.utmSource ?? "-"}|${s.utmMedium ?? "-"}`;
    const v = camp.get(k) ?? { campaign: s.utmCampaign ?? "(adsız)", source: s.utmSource ?? "-", medium: s.utmMedium ?? "-", sessions: 0, visitors: new Set(), leads: 0, imza: 0 };
    v.sessions++;
    v.visitors.add(s.vid);
    camp.set(k, v);
  }
  for (const l of leadRows) {
    const s = l.sid ? bySid.get(l.sid) : undefined;
    if (!s || (!s.utmCampaign && !s.utmSource)) continue;
    const k = `${s.utmCampaign ?? "(adsız)"}|${s.utmSource ?? "-"}|${s.utmMedium ?? "-"}`;
    const v = camp.get(k);
    if (!v) continue;
    v.leads++;
    if (l.stage === "imza") v.imza++;
  }
  const paidSessions = inRange.filter((s) => s.channel === "reklam");

  return {
    days,
    campaigns: [...camp.values()]
      .map((v) => ({ ...v, visitors: v.visitors.size, conv: v.sessions ? Math.round((v.leads / v.sessions) * 1000) / 10 : 0 }))
      .sort((a, b) => b.sessions - a.sessions),
    paid: { sessions: paidSessions.length, leads: paidSessions.filter((s) => s.lead).length, noUtm: paidSessions.filter((s) => !s.utmCampaign).length },
    leadSources: leadRows
      .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
      .slice(0, 50)
      .map((l) => {
        const s = l.sid ? bySid.get(l.sid) : undefined;
        return {
          id: l.id,
          at: l.createdAt,
          who: l.companyName || l.name,
          interest: l.interest,
          stage: LEAD_STAGE_LABEL[l.stage as LeadStage] ?? l.stage,
          channel: s ? CHANNEL_LABEL[s.channel] : null,
          refHost: s?.refHost ?? null,
          campaign: s?.utmCampaign ?? null,
          landing: s ? pageLabel(s.landing) : null,
        };
      }),
  };
}

// ---------------- SEO ----------------

type CheckStatus = "ok" | "warn" | "fail" | "skip";
interface Check {
  id: string;
  group: string;
  label: string;
  status: CheckStatus;
  detail: string;
  fix?: string;
}

function readPublic(file: string): string | null {
  const dirs = [path.resolve(import.meta.dirname, "../dist/public"), path.resolve(process.cwd(), "dist/public"), path.resolve(process.cwd(), "public"), process.cwd()];
  for (const d of dirs) {
    try {
      return fs.readFileSync(path.join(d, file), "utf-8");
    } catch {
      // sıradaki klasör
    }
  }
  return null;
}

const attr = (html: string, re: RegExp) => html.match(re)?.[1]?.trim() ?? null;
const SITE = "https://haiz.org";

async function httpStatus(p: string): Promise<number | null> {
  try {
    const port = process.env.PORT || "3000";
    const r = await fetch(`http://127.0.0.1:${port}${p}`, { headers: { accept: "text/html", "user-agent": "HAIZ-SEO-kontrol (render)" }, signal: AbortSignal.timeout(5000) });
    return r.status;
  } catch {
    return null;
  }
}

export async function seoReport(isProduction: boolean) {
  const checks: Check[] = [];
  const html = readPublic("index.html") ?? "";
  const robots = readPublic("robots.txt");
  const sitemap = readPublic("sitemap.xml");

  // --- Sayfa etiketleri (index.html)
  const title = attr(html, /<title>([\s\S]*?)<\/title>/i);
  const desc = attr(html, /<meta\s+name="description"\s+content="([^"]*)"/i);
  const canonical = attr(html, /<link\s+rel="canonical"\s+href="([^"]*)"/i);
  const ogImage = attr(html, /<meta\s+property="og:image"\s+content="([^"]*)"/i);
  const noindex = /<meta\s+name="robots"\s+content="[^"]*noindex/i.test(html);
  const ld = [...html.matchAll(/<script\s+type="application\/ld\+json">([\s\S]*?)<\/script>/gi)].map((m) => m[1]);
  const ldTypes = [...new Set(ld.flatMap((j) => [...j.matchAll(/"@type"\s*:\s*"([^"]+)"/g)].map((m) => m[1])))];

  checks.push(
    title
      ? { id: "title", group: "Etiketler", label: "Sayfa başlığı", status: title.length <= 65 && title.length >= 30 ? "ok" : "warn", detail: `${title.length} karakter · "${title}"`, fix: title.length > 65 ? "Google ~60 karakterden sonrasını keser; kısaltın." : undefined }
      : { id: "title", group: "Etiketler", label: "Sayfa başlığı", status: "fail", detail: "Başlık bulunamadı." },
    desc
      ? { id: "desc", group: "Etiketler", label: "Açıklama (meta description)", status: desc.length <= 160 && desc.length >= 70 ? "ok" : "warn", detail: `${desc.length} karakter`, fix: desc.length > 160 ? "160 karakteri aşan kısım arama sonucunda görünmez." : undefined }
      : { id: "desc", group: "Etiketler", label: "Açıklama (meta description)", status: "fail", detail: "Açıklama yok." },
    { id: "canonical", group: "Etiketler", label: "Asıl adres (canonical)", status: canonical ? "ok" : "fail", detail: canonical ?? "Yok" },
    { id: "og", group: "Etiketler", label: "Paylaşım görseli (Instagram / LinkedIn önizleme)", status: ogImage ? "ok" : "warn", detail: ogImage ?? "og:image yok" },
    { id: "noindex", group: "Etiketler", label: "Dizine eklenebilir", status: noindex ? "fail" : "ok", detail: noindex ? "noindex etiketi var — Google sayfayı listelemez!" : "noindex yok" },
    {
      id: "ld",
      group: "Etiketler",
      label: "Yapılandırılmış veri (JSON-LD)",
      status: ld.length ? (ldTypes.includes("FAQPage") || ldTypes.includes("Service") ? "ok" : "warn") : "fail",
      detail: ld.length ? `Türler: ${ldTypes.join(", ") || "—"}` : "Yok",
      fix: ld.length && !ldTypes.includes("Service") ? "Danışmanlık paketleri için Service / FAQ verisi onay bekliyor (SEO listesi dokümanı)." : undefined,
    },
    {
      id: "perroute",
      group: "Etiketler",
      label: "Her sayfanın kendi başlığı",
      status: "fail",
      detail: "Tüm sayfalar (danışmanlık ve 15 paket sayfası dahil) aynı başlık ve açıklamayla açılıyor.",
      fix: "Onay bekliyor: sunucu tarafı sayfa başlığı / açıklama / canonical (SEO listesi dokümanındaki öneriler).",
    },
  );

  // --- robots.txt
  checks.push(
    !robots
      ? { id: "robots", group: "Tarama", label: "robots.txt", status: "fail", detail: "Bulunamadı." }
      : /^Disallow:\s*\/\s*$/im.test(robots)
        ? { id: "robots", group: "Tarama", label: "robots.txt", status: "fail", detail: "Tüm site taramaya kapalı (Disallow: /)." }
        : { id: "robots", group: "Tarama", label: "robots.txt", status: /Sitemap:/i.test(robots) ? "ok" : "warn", detail: /Sitemap:/i.test(robots) ? "Tarama açık, site haritası belirtilmiş." : "Site haritası satırı yok." },
  );

  // --- sitemap.xml
  const urls = sitemap ? [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim()) : [];
  const paths = urls.map((u) => u.replace(SITE, "") || "/");
  const pkgPaths = CONSULTING_PACKAGES.map((p) => `/danismanlik/${p.id}`);
  const missingPkg = pkgPaths.filter((p) => !paths.includes(p));
  checks.push(
    { id: "sitemap", group: "Tarama", label: "Site haritası", status: urls.length ? "ok" : "fail", detail: urls.length ? `${urls.length} adres: ${paths.join(", ")}` : "Bulunamadı." },
    {
      id: "sitemap-pkg",
      group: "Tarama",
      label: "Paket sayfaları site haritasında",
      status: missingPkg.length ? "warn" : "ok",
      detail: missingPkg.length ? `${missingPkg.length}/${pkgPaths.length} paket sayfası haritada yok.` : "Tümü var.",
      fix: missingPkg.length ? "Onay bekliyor: site haritasına 15 paket sayfası eklenmesi." : undefined,
    },
    { id: "sitemap-login", group: "Tarama", label: "Giriş sayfası haritada değil", status: paths.includes("/login") ? "warn" : "ok", detail: paths.includes("/login") ? "/login haritada; aramada değeri yok." : "Doğru." },
  );

  // --- Canlı adres kontrolü (yalnız yayındaki sunucuda)
  if (isProduction) {
    const targets = [...new Set([...paths, "/danismanlik", ...pkgPaths.slice(0, 3)])];
    const results = await Promise.all(targets.map(async (p) => ({ p, st: await httpStatus(p) })));
    const bad = results.filter((r) => r.st !== 200);
    checks.push({
      id: "http200",
      group: "Sunucu",
      label: "Sayfalar 200 dönüyor",
      status: bad.length ? "fail" : "ok",
      detail: bad.length ? `Sorunlu: ${bad.map((b) => `${b.p} → ${b.st ?? "yanıt yok"}`).join(", ")}` : `${results.length} adres kontrol edildi, hepsi 200.`,
    });
    const st404 = await httpStatus(`/olmayan-sayfa-${Date.now().toString(36)}`);
    checks.push({ id: "http404", group: "Sunucu", label: "Olmayan sayfa 404 dönüyor", status: st404 === 404 ? "ok" : "warn", detail: `Durum: ${st404 ?? "yanıt yok"}`, fix: st404 === 200 ? "Olmayan sayfalar 200 dönerse Google 'soft 404' sayar." : undefined });
  } else {
    checks.push({ id: "http200", group: "Sunucu", label: "Sayfalar 200 dönüyor", status: "skip", detail: "Yalnız yayındaki sunucuda (Render) kontrol edilir." });
  }

  // --- Organik arama trafiği (son 28 gün, kendi kaydımız)
  const now = Date.now();
  const from = startOfTodayTR() - 27 * DAY;
  const rows = await loadEvents(from, now + 1);
  const ses = [...buildSessions(rows).values()];
  const org = ses.filter((s) => s.channel === "organik");
  const score = Math.round((checks.filter((c) => c.status === "ok").length / Math.max(1, checks.filter((c) => c.status !== "skip").length)) * 100);

  return {
    score,
    checks,
    organic: {
      sessions: org.length,
      share: ses.length ? Math.round((org.length / ses.length) * 100) : 0,
      leads: org.filter((s) => s.lead).length,
      engines: topBy(org, (s) => s.refHost ?? (s.utmSource || "bilinmiyor"), 6),
      landing: topBy(org, (s) => s.landing, 10).map((r) => ({ ...r, label: pageLabel(r.key) })),
    },
    links: {
      searchConsole: "https://search.google.com/search-console?resource_id=sc-domain%3Ahaiz.org",
      performance: "https://search.google.com/search-console/performance/search-analytics?resource_id=sc-domain%3Ahaiz.org",
      pageSpeed: `https://pagespeed.web.dev/analysis?url=${encodeURIComponent(`${SITE}/danismanlik`)}`,
      richResults: `https://search.google.com/test/rich-results?url=${encodeURIComponent(`${SITE}/danismanlik`)}`,
    },
  };
}
