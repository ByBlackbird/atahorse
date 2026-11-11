import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router";
import { toast } from "sonner";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import { RequireCompany } from "@/components/RequireCompany";
import { fmtTL } from "@contracts/patron";
import { fmtBytes, QUOTA_NUMBERS_CONFIRMED } from "@contracts/quotas";
import { ERROR_SOURCE_LABEL, FEEDBACK_KINDS, FEEDBACK_STATUS_LABEL, fmtMinutes, WEEKLY_CAPACITY_HOURS } from "@contracts/founder";
import { APPROVAL_LABEL, CASE_STATUS_LABEL, type ApprovalState, type CaseStatus } from "@contracts/consulting";
import { FUNNEL_ORDER, LEAD_STAGE_LABEL } from "@contracts/funnel";
import { Activity, BarChart3, Bug, Clock, Inbox, LifeBuoy, Megaphone, Plus, Search, Trash2, Users, Wallet } from "lucide-react";
import { CanliTab, KampanyaTab, SeoTab, TrafikTab } from "@/components/kurucu/TrafficTabs";
import { defaultFounderOptOut } from "@/lib/track";

type Ov = NonNullable<ReturnType<typeof trpc.founder.overview.useQuery>["data"]>;

const MONTHS = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
const monthLabel = (m: string) => `${MONTHS[Number(m.slice(5, 7)) - 1]} ${m.slice(2, 4)}`;
const dayLabel = (d: string) => `${Number(d.slice(8, 10))} ${MONTHS[Number(d.slice(5, 7)) - 1]}`;
const dateTR = (d: string | Date | null) => (d ? new Date(d).toLocaleDateString("tr-TR") : "—");
const dateTimeTR = (d: string | Date | null) => (d ? new Date(d).toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" }) : "—");
const todayYmd = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Istanbul" });
const inputCls = "chamfer-sm h-11 w-full border border-border bg-background px-3 text-[16px] outline-none focus:border-foreground md:text-[14px]";

const TABS = [
  { id: "ozet", label: "Özet", icon: Inbox },
  { id: "trafik", label: "Trafik", icon: BarChart3 },
  { id: "canli", label: "Canlı", icon: Activity },
  { id: "kampanya", label: "Kampanya", icon: Megaphone },
  { id: "seo", label: "SEO", icon: Search },
  { id: "uyelik", label: "Üyelikler", icon: Users },
  { id: "para", label: "Para", icon: Wallet },
  { id: "yardim", label: "Yardım", icon: LifeBuoy },
  { id: "hata", label: "Hatalar", icon: Bug },
  { id: "danismanlik", label: "Danışmanlık", icon: Clock },
] as const;
type TabId = (typeof TABS)[number]["id"];

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "good" | "bad" | "warn" }) {
  const cls = tone === "bad" ? "border-destructive/50 bg-destructive/[0.06]" : tone === "good" ? "border-mint bg-mint-soft" : tone === "warn" ? "border-primary bg-primary/15" : "border-border bg-card";
  return (
    <div className={`chamfer min-w-0 border p-4 ${cls}`}>
      <div className="label-caps !text-[10px]">{label}</div>
      <div className={`mt-1 font-display text-[22px] font-bold leading-tight tnum ${tone === "bad" ? "text-destructive" : ""}`}>{value}</div>
      {sub && <div className="mt-0.5 text-[11.5px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

function Meter({ pct }: { pct: number }) {
  const w = Math.min(100, pct);
  const color = pct >= 100 ? "bg-destructive" : pct >= 80 ? "bg-foreground" : "bg-mint";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 bg-secondary" aria-hidden>
        <div className={`h-full ${color}`} style={{ width: `${w}%` }} />
      </div>
      <span className={`font-data text-[11.5px] tnum ${pct >= 100 ? "font-bold text-destructive" : ""}`}>%{pct}</span>
    </div>
  );
}

/** Aylık gelen / giden çubukları */
function MoneyChart({ d }: { d: Ov["money"] }) {
  const rows = d.months.map((m, i) => ({ m, sub: d.incoming[i].amount, other: d.incomingOther[i].amount, out: d.outgoing[i].amount }));
  const max = Math.max(1, ...rows.map((r) => Math.max(r.sub + r.other, r.out)));
  const h = (v: number) => `${(v / max) * 100}%`;
  return (
    <div className="chamfer border border-border bg-card p-4">
      <div className="flex h-40 items-end gap-1.5 sm:gap-3">
        {rows.map((r) => (
          <div key={r.m} className="flex h-full min-w-0 flex-1 flex-col justify-end" title={`${monthLabel(r.m)} · abonelik ${fmtTL(r.sub)} · diğer gelir ${fmtTL(r.other)} · giden ${fmtTL(r.out)}`}>
            <div className="flex h-full items-end justify-center gap-[2px]">
              <div className="flex h-full w-1/2 max-w-4 flex-col justify-end">
                <div className="bg-mint/50" style={{ height: h(r.other) }} />
                <div className="bg-mint" style={{ height: h(r.sub) }} />
              </div>
              <div className="flex h-full w-1/2 max-w-4 flex-col justify-end">
                <div className="bg-foreground" style={{ height: h(r.out) }} />
              </div>
            </div>
            <div className="mt-1.5 truncate text-center text-[10px] text-muted-foreground tnum">{monthLabel(r.m)}</div>
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 bg-mint" /> Abonelik ödemesi</span>
        <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 bg-mint/50" /> Diğer tahsilat (Patron paneli)</span>
        <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 bg-foreground" /> Giden (Patron paneli)</span>
      </div>
    </div>
  );
}

/** Özet: son 7 gün site trafiği (Trafik sekmesinin kısa hali) */
function TrafficStrip({ go }: { go: (t: TabId) => void }) {
  const t = trpc.founder.traffic.useQuery({ days: 7 });
  const live = trpc.founder.live.useQuery(undefined, { refetchInterval: 30_000 });
  const s = t.data?.summary;
  return (
    <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
      <button onClick={() => go("canli")} className={`chamfer min-h-[44px] border p-4 text-left hover:border-foreground/40 ${live.data?.activeNow ? "border-mint bg-mint-soft" : "border-border bg-card"}`}>
        <div className="label-caps !text-[10px]">Şu an sitede</div>
        <div className="mt-1 font-display text-[18px] font-bold tnum">{live.data?.activeNow ?? "—"}</div>
        <div className="mt-0.5 text-[11.5px] text-muted-foreground">bugün {live.data?.today.sessions ?? "—"} oturum</div>
      </button>
      {[
        { label: "7 gün oturum", v: s ? String(s.sessions) : "—", sub: s ? `${s.visitors} tekil ziyaretçi` : "" },
        { label: "7 gün başvuru", v: s ? String(s.leads) : "—", sub: s ? `dönüşüm %${s.conv.toLocaleString("tr-TR")}` : "" },
        { label: "7 gün sayfa görüntüleme", v: s ? String(s.views) : "—", sub: s ? `oturum başına ${s.pagesPerSession.toLocaleString("tr-TR")}` : "" },
      ].map((x) => (
        <button key={x.label} onClick={() => go("trafik")} className="chamfer min-h-[44px] border border-border bg-card p-4 text-left hover:border-foreground/40">
          <div className="label-caps !text-[10px]">{x.label}</div>
          <div className="mt-1 font-display text-[18px] font-bold tnum">{x.v}</div>
          <div className="mt-0.5 text-[11.5px] text-muted-foreground">{x.sub}</div>
        </button>
      ))}
    </div>
  );
}

function OzetTab({ d, go }: { d: Ov; go: (t: TabId) => void }) {
  const cur = d.money.incoming[d.money.incoming.length - 1];
  const cap = d.capacity;
  const capTone = cap.rule.tone === "red" ? "bad" : cap.rule.tone === "amber" ? "warn" : "good";
  return (
    <>
      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Şirket" value={String(d.members.companies)} sub={`son 30 gün +${d.members.newCompanies30}`} />
        <Stat label="Ücretli / deneme" value={`${d.members.premiumPaid} / ${d.members.trial}`} sub={`${d.members.users} kullanıcı`} />
        <Stat label="Aylık tekrarlayan gelir" value={fmtTL(d.money.mrr)} sub={`bu ay tahsil ${fmtTL(cur.amount)}`} tone={d.money.mrr > 0 ? "good" : undefined} />
        <Stat label="Danışmanlık kapasitesi" value={`%${cap.current.pct}`} sub={`${fmtMinutes(cap.current.minutes)} / ${cap.capacityHours} sa · ${cap.rule.label}`} tone={capTone} />
      </div>
      <TrafficStrip go={go} />
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <button onClick={() => go("para")} className="chamfer min-h-[44px] border border-border bg-card p-4 text-left hover:border-foreground/40">
          <div className="label-caps !text-[10px]">Onay bekleyen ödeme</div>
          <div className="mt-1 font-display text-[18px] font-bold tnum">{d.money.pendingCount} · {fmtTL(d.money.pendingAmount)}</div>
          <div className="mt-0.5 text-[11.5px] text-muted-foreground">Onay Sistem Durumu ekranında</div>
        </button>
        <button onClick={() => go("yardim")} className={`chamfer min-h-[44px] border p-4 text-left hover:border-foreground/40 ${d.openFeedback ? "border-primary bg-primary/15" : "border-border bg-card"}`}>
          <div className="label-caps !text-[10px]">Açık yardım talebi</div>
          <div className="mt-1 font-display text-[18px] font-bold tnum">{d.openFeedback}</div>
          <div className="mt-0.5 text-[11.5px] text-muted-foreground">Cevap kullanıcıya bildirim olarak gider</div>
        </button>
        <button onClick={() => go("hata")} className={`chamfer min-h-[44px] border p-4 text-left hover:border-foreground/40 ${d.errors7 ? "border-destructive/50 bg-destructive/[0.06]" : "border-border bg-card"}`}>
          <div className="label-caps !text-[10px]">Son 7 gün sunucu hatası</div>
          <div className={`mt-1 font-display text-[18px] font-bold tnum ${d.errors7 ? "text-destructive" : ""}`}>{d.errors7}</div>
          <div className="mt-0.5 text-[11.5px] text-muted-foreground">Yetki ve form hataları sayılmaz</div>
        </button>
      </div>
      <p className="mt-4 text-[13px] text-muted-foreground">
        {cap.rule.advice} Aktif danışmanlık dosyası: {d.activeCases}.
      </p>
    </>
  );
}

function UyelikTab({ d }: { d: Ov }) {
  const [q, setQ] = useState("");
  const rows = d.members.list.filter((c) => !q || c.name.toLocaleLowerCase("tr").includes(q.toLocaleLowerCase("tr")));
  const SRC: Record<string, string> = { paid: "Ücretli", trial: "Deneme", admin: "Kurucu", free: "Ücretsiz" };
  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Şirket ara" aria-label="Şirket ara" className={`${inputCls} max-w-xs`} />
        <p className="text-[12px] text-muted-foreground">
          Depolama: saha fotoğrafı + restorasyon belgesi (çizimler hariç){QUOTA_NUMBERS_CONFIRMED ? "" : " · kota rakamları onay bekliyor"}
        </p>
        <p className="w-full text-[12.5px]">
          3. ay tutunma:{" "}
          <span className="font-semibold tnum">
            {d.retention.pct === null ? "henüz ölçülemiyor" : `%${d.retention.pct} (${d.retention.retained}/${d.retention.cohort})`}
          </span>
          <span className="text-muted-foreground"> · ilk Premium ödemesi 90+ gün önce olup hâlâ ücretli olan şirketler</span>
        </p>
      </div>
      <div className="chamfer mt-3 overflow-x-auto border border-border bg-card">
        <table className="w-full min-w-[760px] text-[13px]">
          <thead>
            <tr className="border-b border-border text-left">
              {["Şirket", "Paket", "Üye", "Şantiye", "Depolama", "AI (bu ay)", "Son görülme", "Kayıt"].map((h) => (
                <th key={h} className="label-caps !text-[10px] px-3 py-2.5 font-semibold">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id} className="border-b border-border/60 last:border-0">
                <td className="px-3 py-2.5">
                  <div className="font-semibold">{c.name}</div>
                  {c.city && <div className="text-[11.5px] text-muted-foreground">{c.city}</div>}
                </td>
                <td className="px-3 py-2.5">
                  <div>{SRC[c.source] ?? c.source}</div>
                  <div className="text-[11.5px] text-muted-foreground">
                    {c.source === "trial" ? `bitiş ${dateTR(c.trialEndsAt)}` : c.source === "paid" && c.periodEnd ? `dönem ${dateTR(c.periodEnd)}` : ""}
                  </div>
                </td>
                <td className="px-3 py-2.5 tnum">{c.members}</td>
                <td className="px-3 py-2.5 tnum">{c.projects}</td>
                <td className="px-3 py-2.5">
                  <div className="font-data text-[11.5px] tnum">{fmtBytes(c.storageBytes)}</div>
                  <Meter pct={c.storagePct} />
                </td>
                <td className="px-3 py-2.5">
                  <div className="font-data text-[11.5px] tnum">{c.aiUsed}</div>
                  <Meter pct={c.aiPct} />
                </td>
                <td className="px-3 py-2.5 text-[12px] text-muted-foreground">{dateTR(c.lastSeenAt)}</td>
                <td className="px-3 py-2.5 text-[12px] text-muted-foreground">{dateTR(c.createdAt)}</td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-muted-foreground">Kayıt yok.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-[12px] text-muted-foreground">
        Paket verme ve ödeme onayı: <Link to="/sistem" className="font-semibold text-foreground underline-offset-2 hover:underline">Sistem Durumu</Link>.
      </p>
    </div>
  );
}

function ParaTab({ d }: { d: Ov }) {
  const m = d.money;
  const sum = (a: { amount: number }[]) => a.reduce((t, r) => t + r.amount, 0);
  return (
    <div className="mt-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="12 ay abonelik" value={fmtTL(sum(m.incoming))} tone="good" />
        <Stat label="12 ay diğer tahsilat" value={fmtTL(sum(m.incomingOther))} />
        <Stat label="12 ay giden" value={fmtTL(sum(m.outgoing))} />
        <Stat label="Onay bekleyen" value={fmtTL(m.pendingAmount)} sub={`${m.pendingCount} ödeme bildirimi`} tone={m.pendingCount ? "warn" : undefined} />
      </div>
      <div className="mt-4">
        <MoneyChart d={m} />
      </div>
      <p className="mt-3 text-[12.5px] leading-relaxed text-muted-foreground">
        Abonelik geliri onaylanan ödeme bildirimlerinden hesaplanır. Danışmanlık tahsilatı ve giderler kendi şirketinizin{" "}
        <Link to="/patron" className="font-semibold text-foreground underline-offset-2 hover:underline">Patron panelinden</Link> gelir (onaylı ve gerçekleşen kayıtlar).
        {!m.hasOwnCompany && " Hesabınız bir şirkete bağlı değil; giden para görünmüyor."}
      </p>
    </div>
  );
}

function YardimTab() {
  const [status, setStatus] = useState<"open" | "answered" | "closed" | "all">("open");
  const utils = trpc.useUtils();
  const q = trpc.founder.feedbackList.useQuery({ status });
  const refresh = () => Promise.all([utils.founder.feedbackList.invalidate(), utils.founder.overview.invalidate()]);
  const reply = trpc.founder.feedbackReply.useMutation({ onSuccess: () => { toast.success("Cevap gönderildi"); refresh(); }, onError: (e) => toast.error(e.message) });
  const setSt = trpc.founder.feedbackSetStatus.useMutation({ onSuccess: refresh });
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const kindLabel = (k: string) => FEEDBACK_KINDS.find((x) => x.id === k)?.label ?? k;
  return (
    <div className="mt-6">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Durum">
        {(["open", "answered", "closed", "all"] as const).map((s) => (
          <button key={s} role="tab" aria-selected={status === s} onClick={() => setStatus(s)} className={`chamfer-sm min-h-[44px] border px-3.5 text-[13px] font-semibold ${status === s ? "border-foreground bg-foreground text-background" : "border-border bg-card"}`}>
            {s === "all" ? "Tümü" : FEEDBACK_STATUS_LABEL[s]}
          </button>
        ))}
      </div>
      {q.isLoading && <div className="chamfer mt-4 h-24 animate-pulse bg-secondary" />}
      {q.data && !q.data.length && <p className="mt-6 text-[13.5px] text-muted-foreground">Bu durumda talep yok.</p>}
      <div className="mt-4 space-y-3">
        {q.data?.map((f) => (
          <article key={f.id} className="chamfer border border-border bg-card p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-[12px] text-muted-foreground">
                <span className="font-semibold text-foreground">{kindLabel(f.kind)}</span> · {f.user?.name ?? "—"}
                {f.companyName ? ` · ${f.companyName}` : ""} · {dateTimeTR(f.createdAt)}
                {f.page ? ` · ${f.page}` : ""}
              </p>
              <span className="label-caps !text-[10px]">{FEEDBACK_STATUS_LABEL[f.status] ?? f.status}</span>
            </div>
            <p className="mt-2 whitespace-pre-wrap text-[14px] leading-relaxed">{f.message}</p>
            {f.user?.email && <p className="mt-1 text-[12px] text-muted-foreground">{f.user.email}</p>}
            {f.reply && (
              <div className="mt-3 border-l-2 border-mint pl-3 text-[13.5px] leading-relaxed">
                <p className="label-caps !text-[10px] !text-mint">CEVAP · {dateTimeTR(f.answeredAt)}</p>
                <p className="mt-1 whitespace-pre-wrap">{f.reply}</p>
              </div>
            )}
            {f.status !== "closed" && (
              <form
                className="mt-3 grid gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  const text = (drafts[f.id] ?? "").trim();
                  if (!text) return toast.error("Cevabı yazın");
                  reply.mutate({ id: f.id, reply: text }, { onSuccess: () => setDrafts((d) => ({ ...d, [f.id]: "" })) });
                }}
              >
                <label htmlFor={`fb-${f.id}`} className="sr-only">Cevap</label>
                <textarea id={`fb-${f.id}`} rows={2} value={drafts[f.id] ?? ""} onChange={(e) => setDrafts((d) => ({ ...d, [f.id]: e.target.value }))} placeholder={f.reply ? "Ek cevap yazın" : "Cevabınızı yazın — kullanıcıya bildirim olarak gider"} className="chamfer-sm w-full border border-border bg-background px-3 py-2.5 text-[16px] outline-none focus:border-foreground md:text-[14px]" />
                <div className="flex flex-wrap gap-2">
                  <button type="submit" disabled={reply.isPending} className="chamfer-sm min-h-[44px] bg-primary px-4 text-[13px] font-semibold text-primary-foreground hover-cta disabled:opacity-60">
                    {reply.isPending ? "Gönderiliyor…" : "Cevapla"}
                  </button>
                  <button type="button" onClick={() => setSt.mutate({ id: f.id, status: "closed" })} className="chamfer-sm min-h-[44px] border border-border px-4 text-[13px] font-semibold hover:bg-secondary">
                    Kapat
                  </button>
                </div>
              </form>
            )}
            {f.status === "closed" && (
              <button onClick={() => setSt.mutate({ id: f.id, status: "open" })} className="mt-3 min-h-[44px] text-[13px] font-semibold text-mint hover:underline">
                Yeniden aç
              </button>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}

function HataTab() {
  const [source, setSource] = useState<"all" | "trpc" | "ai" | "http">("all");
  const utils = trpc.useUtils();
  const q = trpc.founder.errorsList.useQuery({ source });
  const clear = trpc.founder.errorsClear.useMutation({
    onSuccess: () => { toast.success("Hata kaydı temizlendi"); utils.founder.errorsList.invalidate(); utils.founder.overview.invalidate(); },
  });
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          {(["all", "trpc", "ai"] as const).map((s) => (
            <button key={s} aria-pressed={source === s} onClick={() => setSource(s)} className={`chamfer-sm min-h-[44px] border px-3.5 text-[13px] font-semibold ${source === s ? "border-foreground bg-foreground text-background" : "border-border bg-card"}`}>
              {s === "all" ? "Tümü" : ERROR_SOURCE_LABEL[s]}
            </button>
          ))}
        </div>
        {confirm ? (
          <div className="flex gap-2">
            <button onClick={() => { clear.mutate(); setConfirm(false); }} className="chamfer-sm min-h-[44px] bg-destructive px-3.5 text-[13px] font-semibold text-white">Evet, temizle</button>
            <button onClick={() => setConfirm(false)} className="chamfer-sm min-h-[44px] border border-border px-3.5 text-[13px] font-semibold">Vazgeç</button>
          </div>
        ) : (
          <button onClick={() => setConfirm(true)} disabled={!q.data?.length} className="chamfer-sm inline-flex min-h-[44px] items-center gap-1.5 border border-border px-3.5 text-[13px] font-semibold hover:bg-secondary disabled:opacity-50">
            <Trash2 className="h-4 w-4" /> Kaydı temizle
          </button>
        )}
      </div>
      {q.isLoading && <div className="chamfer mt-4 h-24 animate-pulse bg-secondary" />}
      {q.data && !q.data.length && <p className="mt-6 text-[13.5px] text-muted-foreground">Kayıtlı hata yok.</p>}
      <ul className="mt-4 space-y-2">
        {q.data?.map((e) => (
          <li key={e.id} className="chamfer-sm border border-border bg-card p-3">
            <p className="text-[12px] text-muted-foreground">
              <span className="font-semibold text-foreground">{ERROR_SOURCE_LABEL[e.source] ?? e.source}</span> · {e.path ?? "—"} · {dateTimeTR(e.createdAt)}
              {e.userId ? ` · kullanıcı #${e.userId}` : ""}
            </p>
            <p className="mt-1 break-words font-data text-[12px] leading-relaxed">{e.message}</p>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-[12px] text-muted-foreground">Son 2000 kayıt tutulur. Mesajlardaki anahtar ve parola benzeri değerler maskelenir.</p>
    </div>
  );
}

function TimeLog({ caseId }: { caseId: number }) {
  const utils = trpc.useUtils();
  const q = trpc.founder.timeList.useQuery({ caseId });
  const refresh = () => Promise.all([utils.founder.timeList.invalidate({ caseId }), utils.founder.cases.invalidate(), utils.founder.overview.invalidate()]);
  const add = trpc.founder.timeAdd.useMutation({ onSuccess: () => { toast.success("Süre kaydedildi"); refresh(); }, onError: (e) => toast.error(e.message) });
  const remove = trpc.founder.timeRemove.useMutation({ onSuccess: refresh });
  const [date, setDate] = useState(todayYmd());
  const [hours, setHours] = useState("");
  const [note, setNote] = useState("");
  return (
    <div className="border-t border-border p-4">
      <form
        className="grid grid-cols-2 gap-2 sm:grid-cols-[150px_110px_1fr_auto]"
        onSubmit={(e) => {
          e.preventDefault();
          const h = Number(hours.replace(",", "."));
          if (!(h > 0)) return toast.error("Süreyi saat olarak yazın (ör. 1,5)");
          add.mutate({ caseId, workDate: date, minutes: Math.round(h * 60), note }, { onSuccess: () => { setHours(""); setNote(""); } });
        }}
      >
        <label className="sr-only" htmlFor={`td-${caseId}`}>Tarih</label>
        <input id={`td-${caseId}`} type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
        <label className="sr-only" htmlFor={`th-${caseId}`}>Saat</label>
        <input id={`th-${caseId}`} inputMode="decimal" value={hours} onChange={(e) => setHours(e.target.value)} placeholder="Saat (1,5)" className={inputCls} />
        <label className="sr-only" htmlFor={`tn-${caseId}`}>Not</label>
        <input id={`tn-${caseId}`} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ne yapıldı (isteğe bağlı)" className={`${inputCls} col-span-2 sm:col-span-1`} />
        <button type="submit" disabled={add.isPending} className="chamfer-sm col-span-2 inline-flex min-h-[44px] items-center justify-center gap-1.5 bg-primary px-4 text-[13px] font-semibold text-primary-foreground hover-cta disabled:opacity-60 sm:col-span-1">
          <Plus className="h-4 w-4" /> Ekle
        </button>
      </form>
      {q.data && q.data.length > 0 && (
        <ul className="mt-3 divide-y divide-border/60">
          {q.data.map((t) => (
            <li key={t.id} className="flex items-center gap-3 py-1.5 text-[13px]">
              <span className="w-16 shrink-0 text-muted-foreground tnum">{dayLabel(String(t.workDate))}</span>
              <span className="w-20 shrink-0 font-semibold tnum">{fmtMinutes(t.minutes)}</span>
              <span className="min-w-0 flex-1 truncate text-muted-foreground">{t.note ?? ""}</span>
              <button onClick={() => remove.mutate({ id: t.id })} aria-label="Kaydı sil" className="flex h-11 w-11 shrink-0 items-center justify-center text-muted-foreground hover:text-destructive">
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Satış hunisi — son 90 gün (HAIZ Kâr Planı, Adım 5) */
function FunnelCard({ f }: { f: Ov["funnel"] }) {
  const max = Math.max(1, ...FUNNEL_ORDER.map((st) => f.byStage[st]));
  return (
    <div className="chamfer border border-border bg-card p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="label-caps">SATIŞ HUNİSİ · SON 90 GÜN · {f.total} BAŞVURU</p>
        <p className="text-[12.5px]">
          Kapanış oranı: <span className="font-semibold tnum">{f.closeRate === null ? "henüz yok" : `%${f.closeRate}`}</span>
          <span className="text-muted-foreground"> · imza ÷ (imza + kayıp)</span>
        </p>
      </div>
      <div className="mt-3 space-y-1.5">
        {FUNNEL_ORDER.map((st) => (
          <div key={st} className="grid grid-cols-[8.5rem_1fr_2.5rem] items-center gap-2 text-[12.5px]">
            <span className="truncate">{LEAD_STAGE_LABEL[st]}</span>
            <div className="h-3 bg-secondary">
              <div className={st === "imza" ? "h-full bg-mint" : "h-full bg-foreground"} style={{ width: `${(f.byStage[st] / max) * 100}%` }} />
            </div>
            <span className="text-right font-semibold tnum">{f.byStage[st]}</span>
          </div>
        ))}
        <div className="grid grid-cols-[8.5rem_1fr_2.5rem] items-center gap-2 text-[12.5px] text-muted-foreground">
          <span>{LEAD_STAGE_LABEL.kayip}</span>
          <span className="truncate">{f.lostReasons.length ? f.lostReasons.map((r) => `${r.label} ${r.n}`).join(" · ") : "—"}</span>
          <span className="text-right font-semibold tnum">{f.byStage.kayip}</span>
        </div>
      </div>
      <p className="mt-3 text-[11.5px] text-muted-foreground">
        Çubuklar başvuruların şu anki aşamasını gösterir. Takip kuralı: başvuruya 24 saat içinde yanıt, teklife 3., 7. ve 14. günde takip.
        {f.dueNow > 0 && (
          <>
            {" "}
            <Link to="/talepler" className="font-semibold text-destructive underline underline-offset-2">
              Bekleyen takip: {f.dueNow}
            </Link>
          </>
        )}
      </p>
    </div>
  );
}

function DanismanlikTab({ d }: { d: Ov }) {
  const q = trpc.founder.cases.useQuery();
  const [open, setOpen] = useState<number | null>(null);
  const [showAll, setShowAll] = useState(false);
  const cap = d.capacity;
  const max = Math.max(WEEKLY_CAPACITY_HOURS * 60, ...cap.weeks.map((w) => w.minutes));
  const rows = (q.data ?? []).filter((c) => showAll || c.status === "active" || c.status === "on_hold");
  return (
    <div className="mt-6">
      <FunnelCard f={d.funnel} />
      <div className="chamfer mt-5 border border-border bg-card p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="label-caps">HAFTALIK KAPASİTE · {cap.capacityHours} SAAT</p>
          <p className="text-[12.5px]">
            <span className="font-semibold">{cap.rule.label}</span> · <span className="text-muted-foreground">{cap.rule.advice}</span>
          </p>
        </div>
        <div className="relative mt-4 flex h-28 items-end gap-2">
          <div className="pointer-events-none absolute inset-x-0 border-t border-dashed border-foreground/40" style={{ bottom: `${((WEEKLY_CAPACITY_HOURS * 60) / max) * 100}%` }} aria-hidden />
          {cap.weeks.map((w, i) => (
            <div key={w.week} className="flex h-full min-w-0 flex-1 flex-col justify-end" title={`${dayLabel(w.week)} haftası · ${fmtMinutes(w.minutes)} · %${w.pct}`}>
              <div className={`${w.pct >= 100 ? "bg-destructive" : w.pct >= 70 ? "bg-foreground" : "bg-mint"} ${i === cap.weeks.length - 1 ? "" : "opacity-70"}`} style={{ height: `${(w.minutes / max) * 100}%` }} />
              <div className={`mt-1 truncate text-center text-[10px] tnum ${i === cap.weeks.length - 1 ? "font-bold" : "text-muted-foreground"}`}>{dayLabel(w.week)}</div>
            </div>
          ))}
        </div>
        <p className="mt-2 text-[11.5px] text-muted-foreground">Kesikli çizgi: {cap.capacityHours} saat. %70'e kadar liste fiyatı · %70–99 yeni işe +%15 · dolu: bekleme listesi (acil +%25).</p>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
        <p className="label-caps">DOSYALAR</p>
        <div className="flex gap-2">
          <button onClick={() => setShowAll((v) => !v)} className="chamfer-sm min-h-[44px] border border-border px-3.5 text-[13px] font-semibold hover:bg-secondary">
            {showAll ? "Yalnız açık dosyalar" : "Kapananları da göster"}
          </button>
          <Link to="/talepler" className="chamfer-sm inline-flex min-h-[44px] items-center border border-border px-3.5 text-[13px] font-semibold hover:bg-secondary">
            Talepler ve süreç
          </Link>
        </div>
      </div>
      {q.isLoading && <div className="chamfer mt-3 h-24 animate-pulse bg-secondary" />}
      {q.data && !rows.length && <p className="mt-4 text-[13.5px] text-muted-foreground">Açık danışmanlık dosyası yok. Yeni dosya Talepler ekranından açılır.</p>}
      <div className="mt-3 space-y-2">
        {rows.map((c) => (
          <div key={c.id} className="chamfer border border-border bg-card">
            <button onClick={() => setOpen(open === c.id ? null : c.id)} aria-expanded={open === c.id} className="flex min-h-[44px] w-full flex-wrap items-center gap-x-4 gap-y-1 p-4 text-left">
              <span className="chamfer-sm flex h-8 min-w-8 items-center justify-center bg-foreground px-2 font-display text-[12px] font-bold text-primary">{c.packageCode}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{c.companyName || c.clientName}</span>
                <span className="block truncate text-[12px] text-muted-foreground">
                  {c.packageName} · {c.stageIndex + 1}/{c.stageCount} {c.stageLabel} · {CASE_STATUS_LABEL[c.status as CaseStatus] ?? c.status}
                  {c.approval !== "none" ? ` · ${APPROVAL_LABEL[c.approval as ApprovalState] ?? c.approval}` : ""}
                </span>
              </span>
              <span className="text-right text-[12px]">
                <span className="block font-semibold tnum">{fmtMinutes(c.totalMinutes)}</span>
                <span className="block text-muted-foreground tnum">bu hafta {fmtMinutes(c.weekMinutes)}</span>
              </span>
              <span className="font-data text-[11px] text-muted-foreground">{c.refCode}</span>
            </button>
            {open === c.id && <TimeLog caseId={c.id} />}
          </div>
        ))}
      </div>
    </div>
  );
}

/** /kurucu — yalnız site yöneticisi */
export default function Kurucu() {
  const { user, isLoading } = useAuth();
  const isAdmin = user?.role === "admin";
  const q = trpc.founder.overview.useQuery(undefined, { enabled: isAdmin, refetchInterval: 5 * 60_000 });
  const [tab, setTab] = useState<TabId>("ozet");
  // Kurucunun kendi ziyaretleri trafik sayımını şişirmesin (Trafik sekmesinden değiştirilebilir)
  useEffect(() => {
    if (isAdmin) defaultFounderOptOut();
  }, [isAdmin]);
  if (!isLoading && user && !isAdmin) return <Navigate to="/panel" replace />;
  const d = q.data;
  return (
    <RequireCompany>
    <div className="mx-auto max-w-[1100px] pb-16">
      <p className="label-caps">KURUCU PANELİ</p>
      <h1 className="mt-1 font-display text-2xl font-bold tracking-tight md:text-3xl">HAIZ tek ekranda</h1>
      <p className="mt-1 text-[13px] text-muted-foreground">Site trafiği, canlı ziyaret, kampanyalar, SEO, üyelikler, gelen ve giden para, yardım talepleri, hata kayıtları ve danışmanlık süresi.</p>

      <div className="-mx-1 mt-5 flex gap-1 overflow-x-auto px-1 pb-1" role="tablist" aria-label="Bölümler">
        {TABS.map((t) => {
          const badge = d && (t.id === "yardim" ? d.openFeedback : t.id === "hata" ? d.errors7 : 0);
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`chamfer-sm inline-flex min-h-[44px] shrink-0 items-center gap-1.5 border px-3.5 text-[13px] font-semibold ${tab === t.id ? "border-foreground bg-foreground text-background" : "border-border bg-card hover:bg-secondary"}`}
            >
              <t.icon className="h-4 w-4" /> {t.label}
              {badge ? <span className={`ml-0.5 min-w-5 px-1 text-center text-[11px] tnum ${tab === t.id ? "bg-primary text-foreground" : "bg-foreground text-background"}`}>{badge}</span> : null}
            </button>
          );
        })}
      </div>

      {q.error && <p className="mt-4 text-[13px] text-destructive">{q.error.message}</p>}
      {q.isLoading && <div className="chamfer mt-6 h-40 animate-pulse bg-secondary" />}
      {d && tab === "ozet" && <OzetTab d={d} go={setTab} />}
      {tab === "trafik" && isAdmin && <TrafikTab />}
      {tab === "canli" && isAdmin && <CanliTab />}
      {tab === "kampanya" && isAdmin && <KampanyaTab />}
      {tab === "seo" && isAdmin && <SeoTab />}
      {d && tab === "uyelik" && <UyelikTab d={d} />}
      {d && tab === "para" && <ParaTab d={d} />}
      {tab === "yardim" && isAdmin && <YardimTab />}
      {tab === "hata" && isAdmin && <HataTab />}
      {d && tab === "danismanlik" && <DanismanlikTab d={d} />}
    </div>
    </RequireCompany>
  );
}
