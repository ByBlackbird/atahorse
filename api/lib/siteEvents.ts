/**
 * Site ziyaret kaydı — POST /api/e (navigator.sendBeacon, text/plain JSON).
 * Çerez yok, IP saklanmaz. vid = sha256(günlük tuz + IP + tarayıcı) ilk 16 hane; ertesi gün değişir.
 * Botlar, yöneticinin kendi tarayıcısı (istemci tarafı işaret) ve uygulama içi ekranlar sayılmaz.
 */
import type { Context } from "hono";
import { createHash } from "node:crypto";
import { lt, sql } from "drizzle-orm";
import { getDb } from "../queries/connection";
import { siteEvents } from "@db/schema";
import { clientIp, rateLimit } from "./codes";
import { BOT_UA, classifyChannel, deviceOf, isTrackedPath } from "@contracts/traffic";

const SALT = process.env.APP_SECRET ?? "haiz";
const clip = (v: unknown, n: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, n) : null);

function visitorId(ip: string, ua: string): string {
  const day = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Istanbul" });
  return createHash("sha256").update(`${SALT}|${day}|${ip}|${ua}`).digest("hex").slice(0, 16);
}

function hostOf(ref: string | null, ownHost: string | null): string | null {
  if (!ref) return null;
  try {
    const h = new URL(ref).hostname.replace(/^www\./, "").toLowerCase();
    if (!h || (ownHost && h === ownHost.replace(/^www\./, ""))) return null;
    return h.slice(0, 120);
  } catch {
    return null;
  }
}

export interface EventInput {
  type: "view" | "lead";
  sid: string;
  path: string;
  ref?: string | null;
  utm?: { source?: string | null; medium?: string | null; campaign?: string | null } | null;
  clickId?: boolean;
  tz?: string | null;
  width?: number | null;
}

export async function recordEvent(headers: Headers, e: EventInput): Promise<void> {
  const ua = headers.get("user-agent") ?? "";
  if (!ua || BOT_UA.test(ua)) return;
  const sid = clip(e.sid, 24);
  if (!sid || !/^[a-z0-9]{8,24}$/i.test(sid)) return;
  const path = (clip(e.path, 200) ?? "/").split("?")[0].split("#")[0] || "/";
  if (e.type === "view" && !isTrackedPath(path)) return;
  const ip = clientIp(headers);
  if (!rateLimit(`se:${ip}`, 120, 60_000)) return;
  const refHost = hostOf(clip(e.ref, 500), headers.get("host"));
  const utm = { source: clip(e.utm?.source, 80), medium: clip(e.utm?.medium, 80), campaign: clip(e.utm?.campaign, 120) };
  const db = getDb();
  await db.insert(siteEvents).values({
    type: e.type,
    sid,
    vid: visitorId(ip, ua),
    path,
    refHost,
    channel: classifyChannel(refHost, utm, !!e.clickId),
    utmSource: utm.source,
    utmMedium: utm.medium,
    utmCampaign: utm.campaign,
    device: deviceOf(ua, typeof e.width === "number" ? e.width : null),
    tz: clip(e.tz, 48),
  });
  // Arada bir 400 günden eski kayıtları sil
  if (Math.random() < 0.005) {
    await db.delete(siteEvents).where(lt(siteEvents.createdAt, sql`NOW() - INTERVAL 400 DAY`));
  }
}

/** POST /api/e */
export async function siteEventHandler(c: Context) {
  try {
    const raw = await c.req.text();
    if (raw.length > 4000) return c.body(null, 204);
    const b = JSON.parse(raw) as Record<string, unknown>;
    if (b.t !== "view") return c.body(null, 204);
    await recordEvent(c.req.raw.headers, {
      type: "view",
      sid: String(b.s ?? ""),
      path: String(b.p ?? "/"),
      ref: typeof b.r === "string" ? b.r : null,
      utm: typeof b.u === "object" && b.u ? (b.u as EventInput["utm"]) : null,
      clickId: b.k === 1,
      tz: typeof b.z === "string" ? b.z : null,
      width: typeof b.w === "number" ? b.w : null,
    });
  } catch {
    // kayıt hatası ziyaretçiye yansımaz
  }
  return c.body(null, 204);
}
