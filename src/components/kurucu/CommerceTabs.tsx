/**
 * Kurucu Paneli — Shopify yönetim ekranlarının HAIZ karşılıkları:
 *   Ana sayfa (Home) · Başvurular (Orders) · Başvuru ayrıntısı (Order detail) · Ürünler (Products) · Müşteriler (Customers)
 * Veri: founder.badges · founder.leads · founder.lead · founder.products · founder.contacts (+ traffic, live, overview)
 */
import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { toast } from "sonner";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import { LeadStageControl } from "@/pages/Leads";
import { fmtTL } from "@contracts/patron";
import { PREMIUM_PRICE } from "@contracts/plans";
import { LEAD_STAGE_LABEL, type LeadStage } from "@contracts/funnel";
import { ENDEKS_AREAS, LINE_LABEL, type PackageLine } from "@contracts/consulting";
import {
  ArrowRight,
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  CircleAlert,
  ExternalLink,
  FileText,
  Mail,
  MessageCircle,
  Phone,
  Radio,
} from "lucide-react";

const MONTHS = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
const fullDate = (d: string | Date) =>
  new Date(d).toLocaleString("tr-TR", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Istanbul" });
const shortDate = (d: string | Date) => {
  const x = new Date(new Date(d).getTime() + 3 * 3_600_000);
  return `${x.getUTCDate()} ${MONTHS[x.getUTCMonth()]} ${String(x.getUTCHours()).padStart(2, "0")}:${String(x.getUTCMinutes()).padStart(2, "0")}`;
};
const pct = (n: number) => `%${n.toLocaleString("tr-TR")}`;
const inputCls = "chamfer-sm h-11 w-full border border-border bg-background px-3 text-[16px] outline-none focus:border-foreground md:text-[14px]";

/** Aşama rozeti — Shopify "Paid / Unfulfilled" rozetleri gibi */
export const STAGE_BADGE: Record<LeadStage, string> = {
  basvuru: "bg-primary text-foreground",
  yanit: "bg-secondary text-foreground",
  rontgen: "bg-secondary text-foreground",
  teklif: "bg-foreground text-background",
  imza: "bg-mint text-white",
  kayip: "bg-secondary text-muted-foreground line-through",
};

function StageBadge({ stage }: { stage: string }) {
  const st = (stage in STAGE_BADGE ? stage : "basvuru") as LeadStage;
  return <span className={`chamfer-sm inline-block whitespace-nowrap px-2 py-0.5 text-[11px] font-bold ${STAGE_BADGE[st]}`}>{st === "basvuru" ? "Yanıt bekliyor" : LEAD_STAGE_LABEL[st]}</span>;
}

function Card({ title, children, right, className = "" }: { title?: string; children: React.ReactNode; right?: React.ReactNode; className?: string }) {
  return (
    <section className={`chamfer min-w-0 border border-border bg-card p-4 ${className}`}>
      {(title || right) && (
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          {title && <h3 className="label-caps">{title}</h3>}
          {right}
        </div>
      )}
      {children}
    </section>
  );
}

/** Küçük çizgi grafik (Shopify ana sayfa metrik kartları) */
function Spark({ values, mint }: { values: number[]; mint?: boolean }) {
  if (values.length < 2) return null;
  const max = Math.max(1, ...values);
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * 100},${28 - (v / max) * 26}`).join(" ");
  return (
    <svg viewBox="0 0 100 30" preserveAspectRatio="none" className="mt-2 h-8 w-full" aria-hidden>
      <polyline points={pts} fill="none" strokeWidth="1.6" vectorEffect="non-scaling-stroke" className={mint ? "stroke-mint" : "stroke-foreground"} />
    </svg>
  );
}

function Delta({ cur, prev }: { cur: number; prev: number }) {
  if (!prev && !cur) return <span className="text-muted-foreground">—</span>;
  if (!prev) return <span className="font-semibold text-mint">yeni</span>;
  const d = Math.round(((cur - prev) / prev) * 100);
  if (!d) return <span className="text-muted-foreground">%0</span>;
  return <span className={`font-semibold ${d > 0 ? "text-mint" : "text-destructive"}`}>{d > 0 ? "▲" : "▼"} %{Math.abs(d)}</span>;
}

// =====================================================================
// Ana sayfa
// =====================================================================

type Ov = NonNullable<ReturnType<typeof trpc.founder.overview.useQuery>["data"]>;

export function AnaSayfa({ d }: { d: Ov }) {
  const { user } = useAuth();
  const [days, setDays] = useState<1 | 7 | 30>(7);
  const t = trpc.founder.traffic.useQuery({ days });
  const live = trpc.founder.live.useQuery(undefined, { refetchInterval: 30_000 });
  const b = trpc.founder.badges.useQuery(undefined, { refetchInterval: 60_000 });
  const leads = trpc.founder.leads.useQuery();
  const hour = Number(new Date().toLocaleString("en-GB", { hour: "2-digit", hour12: false, timeZone: "Europe/Istanbul" }));
  const greet = hour < 6 ? "İyi geceler" : hour < 12 ? "Günaydın" : hour < 18 ? "İyi günler" : "İyi akşamlar";
  const first = (user?.name ?? "").split(" ")[0];
  const s = t.data;
  const cap = d.capacity;

  const todo = [
    b.data?.overdueLeads ? { to: "/kurucu/basvurular?durum=basvuru", text: `${b.data.overdueLeads} başvuru 24 saatten uzun süredir yanıt bekliyor`, urgent: true } : null,
    b.data && b.data.newLeads - b.data.overdueLeads > 0 ? { to: "/kurucu/basvurular?durum=basvuru", text: `${b.data.newLeads - b.data.overdueLeads} yeni başvuruya yanıt verin` } : null,
    b.data?.dueFollowUps ? { to: "/kurucu/basvurular?durum=teklif", text: `${b.data.dueFollowUps} teklifin takip günü geldi`, urgent: true } : null,
    b.data?.pendingPayments ? { to: "/sistem", text: `${b.data.pendingPayments} abonelik ödemesi onay bekliyor` } : null,
    b.data?.openFeedback ? { to: "/kurucu/yardim", text: `${b.data.openFeedback} yardım talebi cevap bekliyor` } : null,
    b.data?.errors7 ? { to: "/kurucu/hatalar", text: `Son 7 günde ${b.data.errors7} sunucu hatası` } : null,
    cap.rule.tone !== "mint" ? { to: "/kurucu/dosyalar", text: `Danışmanlık kapasitesi %${cap.current.pct} — ${cap.rule.advice}` } : null,
  ].filter((x): x is { to: string; text: string; urgent?: boolean } => !!x);

  const metrics = s
    ? [
        { label: "Oturum", v: String(s.summary.sessions), cur: s.summary.sessions, prev: s.prev.sessions, spark: s.series.map((x) => x.sessions) },
        { label: "Başvuru", v: String(s.summary.leads), cur: s.summary.leads, prev: s.prev.leads, spark: s.series.map((x) => x.leads), mint: true },
        { label: "Dönüşüm oranı", v: pct(s.summary.conv), cur: s.summary.conv, prev: s.prev.conv, spark: s.series.map((x) => (x.sessions ? x.leads / x.sessions : 0)) },
        { label: "Yeni üye", v: String(s.summary.signups), cur: s.summary.signups, prev: s.prev.signups, spark: [] as number[] },
      ]
    : [];

  return (
    <div className="mt-2">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-[22px] font-bold tracking-tight">{greet}{first ? `, ${first}` : ""}</h2>
          <p className="text-[13px] text-muted-foreground">HAIZ'da bugün olanlar.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link to="/kurucu/canli" className={`chamfer-sm inline-flex min-h-[44px] items-center gap-2 border px-3.5 text-[13px] font-semibold ${live.data?.activeNow ? "border-mint bg-mint-soft" : "border-border bg-card"}`}>
            <Radio className={`h-4 w-4 ${live.data?.activeNow ? "text-mint" : "text-muted-foreground"}`} />
            {live.data?.activeNow ?? 0} kişi sitede
          </Link>
          <div className="flex gap-1" role="radiogroup" aria-label="Dönem">
            {([1, 7, 30] as const).map((x) => (
              <button key={x} role="radio" aria-checked={days === x} onClick={() => setDays(x)} className={`chamfer-sm min-h-[44px] border px-3 text-[13px] font-semibold ${days === x ? "border-foreground bg-foreground text-background" : "border-border bg-card hover:bg-secondary"}`}>
                {x === 1 ? "Bugün" : `${x} gün`}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Metrik şeridi */}
      <div className="chamfer mt-4 grid grid-cols-2 divide-border border border-border bg-card lg:grid-cols-4 lg:divide-x">
        {(metrics.length ? metrics : [0, 1, 2, 3].map(() => null)).map((m, i) => (
          <Link key={i} to="/kurucu/analitik" className="min-h-[44px] p-4 hover:bg-secondary/50">
            {m ? (
              <>
                <div className="text-[12px] font-semibold text-muted-foreground underline decoration-dotted underline-offset-4">{m.label}</div>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="font-display text-[22px] font-bold tnum">{m.v}</span>
                  <span className="text-[12px] tnum"><Delta cur={m.cur} prev={m.prev} /></span>
                </div>
                <Spark values={m.spark} mint={m.mint} />
              </>
            ) : (
              <div className="h-[86px] animate-pulse bg-secondary" />
            )}
          </Link>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-4">
          <Card title="YAPILACAKLAR">
            {todo.length ? (
              <ul className="divide-y divide-border/60">
                {todo.map((x) => (
                  <li key={x.text}>
                    <Link to={x.to} className="flex min-h-[44px] items-center gap-3 py-2 text-[13.5px] hover:underline">
                      <CircleAlert className={`h-4 w-4 shrink-0 ${x.urgent ? "text-destructive" : "text-foreground"}`} />
                      <span className={`flex-1 ${x.urgent ? "font-semibold" : ""}`}>{x.text}</span>
                      <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[13.5px] text-muted-foreground">Bekleyen iş yok.</p>
            )}
          </Card>

          <Card title="SON BAŞVURULAR" right={<Link to="/kurucu/basvurular" className="text-[12.5px] font-semibold underline-offset-2 hover:underline">Tümü →</Link>}>
            {leads.data?.length ? (
              <ul className="divide-y divide-border/60">
                {leads.data.slice(0, 6).map((l) => (
                  <li key={l.id}>
                    <Link to={`/kurucu/basvurular/${l.id}`} className="flex min-h-[44px] flex-wrap items-center gap-x-3 gap-y-1 py-2 text-[13px] hover:bg-secondary/40">
                      <span className="w-12 font-data text-[12px] text-muted-foreground">#{l.id}</span>
                      <span className="min-w-0 flex-1 truncate font-semibold">{l.companyName || l.name}</span>
                      <span className="hidden text-[12px] text-muted-foreground sm:inline">{l.packageName ?? l.interest ?? "—"}</span>
                      <StageBadge stage={l.stage} />
                      <span className="w-24 text-right text-[12px] text-muted-foreground tnum">{shortDate(l.createdAt)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[13.5px] text-muted-foreground">{leads.isLoading ? "Yükleniyor…" : "Henüz başvuru yok."}</p>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card title="ABONELİK">
            <dl className="grid grid-cols-2 gap-3 text-[13px]">
              <div>
                <dt className="text-muted-foreground">Aylık tekrarlayan gelir</dt>
                <dd className="font-display text-[20px] font-bold tnum">{fmtTL(d.money.mrr)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Ücretli / deneme</dt>
                <dd className="font-display text-[20px] font-bold tnum">{d.members.premiumPaid} / {d.members.trial}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Şirket</dt>
                <dd className="font-semibold tnum">{d.members.companies} <span className="font-normal text-muted-foreground">(30 gün +{d.members.newCompanies30})</span></dd>
              </div>
              <div>
                <dt className="text-muted-foreground">3. ay tutunma</dt>
                <dd className="font-semibold tnum">{d.retention.pct === null ? "—" : `%${d.retention.pct}`}</dd>
              </div>
            </dl>
          </Card>
          <Card title="SATIŞ HUNİSİ · 90 GÜN">
            <dl className="grid grid-cols-3 gap-3 text-[13px]">
              <div>
                <dt className="text-muted-foreground">Başvuru</dt>
                <dd className="font-display text-[20px] font-bold tnum">{d.funnel.total}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">İmza</dt>
                <dd className="font-display text-[20px] font-bold tnum text-mint">{d.funnel.byStage.imza}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Kapanış</dt>
                <dd className="font-display text-[20px] font-bold tnum">{d.funnel.closeRate === null ? "—" : `%${d.funnel.closeRate}`}</dd>
              </div>
            </dl>
          </Card>
          <Card title="KANALLAR" right={<Link to="/kurucu/analitik" className="text-[12.5px] font-semibold underline-offset-2 hover:underline">Analitik →</Link>}>
            {s?.channels.length ? (
              <ul className="space-y-1.5 text-[13px]">
                {s.channels.map((c) => (
                  <li key={c.id} className="flex justify-between gap-2">
                    <span>{c.label}</span>
                    <span className="tnum">
                      <b>{c.sessions}</b> <span className="text-muted-foreground">oturum · {c.leads} başvuru</span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[13px] text-muted-foreground">Bu dönemde ziyaret yok.</p>
            )}
          </Card>
          <Card title="DANIŞMANLIK KAPASİTESİ">
            <p className="text-[13px]">
              <b className="tnum">%{cap.current.pct}</b> · {cap.rule.label} <span className="text-muted-foreground">— {cap.rule.advice}</span>
            </p>
            <p className="mt-1 text-[12px] text-muted-foreground">Açık dosya: {d.activeCases}</p>
          </Card>
        </div>
      </div>
    </div>
  );
}

// =====================================================================
// Başvurular (Shopify Orders)
// =====================================================================

const FILTERS: { id: string; label: string; stages: LeadStage[] | null }[] = [
  { id: "tumu", label: "Tümü", stages: null },
  { id: "basvuru", label: "Yanıt bekleyen", stages: ["basvuru"] },
  { id: "surec", label: "Görüşmede", stages: ["yanit", "rontgen"] },
  { id: "teklif", label: "Teklifte", stages: ["teklif"] },
  { id: "imza", label: "İmzalanan", stages: ["imza"] },
  { id: "kayip", label: "Kaybedilen", stages: ["kayip"] },
];

export function BasvurularPage() {
  const q = trpc.founder.leads.useQuery();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const filter = FILTERS.find((f) => f.id === params.get("durum")) ?? FILTERS[0];
  const [search, setSearch] = useState("");
  const rows = useMemo(() => {
    const t = search.trim().toLocaleLowerCase("tr");
    return (q.data ?? []).filter(
      (l) =>
        (!filter.stages || filter.stages.includes(l.stage)) &&
        (!t || [l.name, l.companyName, l.email, l.phone, l.interest, String(l.id)].some((x) => x?.toLocaleLowerCase("tr").includes(t))),
    );
  }, [q.data, filter, search]);
  const count = (f: (typeof FILTERS)[number]) => (q.data ?? []).filter((l) => !f.stages || f.stages.includes(l.stage)).length;

  return (
    <div className="mt-2">
      <div className="chamfer border border-border bg-card">
        <div className="flex flex-wrap items-center gap-2 border-b border-border p-2">
          <div className="flex flex-1 gap-1 overflow-x-auto" role="tablist" aria-label="Duruma göre">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                role="tab"
                aria-selected={filter.id === f.id}
                onClick={() => setParams(f.id === "tumu" ? {} : { durum: f.id }, { replace: true })}
                className={`chamfer-sm inline-flex min-h-[44px] shrink-0 items-center gap-1.5 px-3 text-[13px] font-semibold ${filter.id === f.id ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary/60"}`}
              >
                {f.label}
                <span className="text-[11px] tnum text-muted-foreground">{count(f)}</span>
              </button>
            ))}
          </div>
          <label className="sr-only" htmlFor="lead-search">Başvuru ara</label>
          <input id="lead-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Ad, şirket, e-posta, telefon, no" className={`${inputCls} max-w-xs`} />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-[13px]">
            <thead>
              <tr className="border-b border-border text-left text-[11px] text-muted-foreground">
                {["No", "Tarih", "Başvuran", "Paket / ilgi", "Kanal", "Aşama", "Takip", "Dosya"].map((h) => (
                  <th key={h} className="px-3 py-2 font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((l) => (
                <tr key={l.id} onClick={() => navigate(`/kurucu/basvurular/${l.id}`)} className="cursor-pointer border-b border-border/60 last:border-0 hover:bg-secondary/40">
                  <td className="px-3 py-2.5">
                    <Link to={`/kurucu/basvurular/${l.id}`} onClick={(e) => e.stopPropagation()} className="font-data text-[12.5px] font-semibold hover:underline">#{l.id}</Link>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground tnum">{shortDate(l.createdAt)}</td>
                  <td className="px-3 py-2.5">
                    <div className="font-semibold">{l.name}</div>
                    {l.companyName && <div className="text-[11.5px] text-muted-foreground">{l.companyName}</div>}
                  </td>
                  <td className="px-3 py-2.5">
                    {l.packageCode && <span className="chamfer-sm mr-1.5 bg-foreground px-1.5 py-0.5 font-display text-[10.5px] font-bold text-primary">{l.packageCode}</span>}
                    <span className="text-[12.5px]">{l.packageName ?? l.interest ?? "—"}</span>
                  </td>
                  <td className="px-3 py-2.5 text-[12.5px]">
                    {l.channel ?? <span className="text-muted-foreground">—</span>}
                    {l.campaign && <div className="text-[11px] text-muted-foreground">{l.campaign}</div>}
                  </td>
                  <td className="px-3 py-2.5"><StageBadge stage={l.stage} /></td>
                  <td className={`px-3 py-2.5 text-[12px] ${l.dueUrgent ? "font-semibold text-destructive" : ""}`}>{l.due ?? ""}</td>
                  <td className="px-3 py-2.5 font-data text-[11.5px] text-muted-foreground">{l.caseRef ?? ""}</td>
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">{q.isLoading ? "Yükleniyor…" : "Bu filtrede başvuru yok."}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <p className="mt-3 text-[12px] text-muted-foreground">Satıra tıklayın: başvuru ayrıntısı, kaynağı, aşaması ve notlar. Kanal, Güncelleme 45'ten sonraki başvurularda görünür.</p>
    </div>
  );
}

// =====================================================================
// Başvuru ayrıntısı (Shopify Order detail)
// =====================================================================

const waLink = (phone: string) => {
  const d = phone.replace(/\D/g, "");
  const n = d.startsWith("90") ? d : d.startsWith("0") ? `9${d}` : `90${d}`;
  return `https://wa.me/${n}`;
};

export function BasvuruDetay({ id }: { id: number }) {
  const q = trpc.founder.lead.useQuery({ id });
  const utils = trpc.useUtils();
  const navigate = useNavigate();
  const refresh = () => Promise.all([utils.founder.lead.invalidate({ id }), utils.founder.leads.invalidate(), utils.founder.badges.invalidate(), utils.founder.overview.invalidate()]);
  const note = trpc.founder.leadNote.useMutation({ onSuccess: () => { setText(""); void refresh(); }, onError: (e) => toast.error(e.message) });
  const [text, setText] = useState("");
  const d = q.data;

  if (q.isLoading) return <div className="chamfer mt-4 h-60 animate-pulse bg-secondary" />;
  if (q.error || !d) return <p className="mt-4 text-[13px] text-destructive">{q.error?.message ?? "Başvuru bulunamadı."}</p>;
  const l = d.lead;

  return (
    <div className="mt-1">
      {/* Başlık satırı */}
      <div className="flex flex-wrap items-center gap-2">
        <Link to="/kurucu/basvurular" aria-label="Başvurulara dön" className="chamfer-sm flex h-11 w-11 items-center justify-center border border-border bg-card hover:bg-secondary">
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <h2 className="font-display text-[24px] font-bold tracking-tight">Başvuru #{l.id}</h2>
        <StageBadge stage={l.stage} />
        {d.due && <span className={`chamfer-sm px-2 py-0.5 text-[11px] font-bold ${d.due.urgent ? "bg-destructive text-white" : "bg-primary text-foreground"}`}>{d.due.label}</span>}
        <div className="ml-auto flex gap-1">
          <button disabled={!d.newerId} onClick={() => d.newerId && navigate(`/kurucu/basvurular/${d.newerId}`)} aria-label="Daha yeni başvuru" className="chamfer-sm flex h-11 w-11 items-center justify-center border border-border bg-card hover:bg-secondary disabled:opacity-40">
            <ChevronUp className="h-5 w-5" />
          </button>
          <button disabled={!d.olderId} onClick={() => d.olderId && navigate(`/kurucu/basvurular/${d.olderId}`)} aria-label="Daha eski başvuru" className="chamfer-sm flex h-11 w-11 items-center justify-center border border-border bg-card hover:bg-secondary disabled:opacity-40">
            <ChevronDown className="h-5 w-5" />
          </button>
        </div>
      </div>
      <p className="mt-1 text-[13px] text-muted-foreground">
        {fullDate(l.createdAt)} · {d.conversion ? `${d.conversion.channel} üzerinden` : "danışmanlık sayfasından"}
      </p>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[1fr_340px]">
        {/* Sol sütun */}
        <div className="min-w-0 space-y-4">
          {l.message && (
            <div>
              <p className="text-[12px] text-muted-foreground">Başvuranın mesajı</p>
              <p className="mt-1 inline whitespace-pre-wrap bg-primary/45 px-1 text-[14px] leading-relaxed [box-decoration-break:clone]">{l.message}</p>
            </div>
          )}

          <Card title="İLGİLENDİĞİ PAKET">
            {d.pkg ? (
              <div className="flex items-start gap-3">
                <span className="chamfer-sm flex h-10 min-w-10 items-center justify-center bg-foreground px-2 font-display text-[13px] font-bold text-primary">{d.pkg.code}</span>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold">{d.pkg.name}{d.pkg.comingSoon && <span className="ml-2 text-[11px] text-muted-foreground">(yakında)</span>}</div>
                  <div className="text-[12.5px] text-muted-foreground">{d.pkg.duration}</div>
                  <div className="mt-1 text-[13px]">“{d.pkg.question}”</div>
                </div>
                <Link to={`/danismanlik/${d.pkg.id}`} target="_blank" className="chamfer-sm flex h-11 w-11 shrink-0 items-center justify-center border border-border hover:bg-secondary" aria-label="Paket sayfasını aç">
                  <ExternalLink className="h-4 w-4" />
                </Link>
              </div>
            ) : (
              <p className="text-[13.5px]">{l.interest ?? <span className="text-muted-foreground">Paket belirtilmedi.</span>}</p>
            )}
            {d.quiz?.endeks !== undefined && (
              <div className="mt-3 border-t border-border pt-3 text-[13px]">
                <div className="label-caps !text-[10px]">OFİS ENDEKSİ TESTİ</div>
                <p className="mt-1">
                  Puan <b className="tnum">{d.quiz.endeks}</b>
                  {d.quiz.zayif && <> · en zayıf alan <b>{d.quiz.zayif}</b></>}
                  {d.quiz.oneri && <> · önerilen <b>{d.quiz.oneri}</b></>}
                </p>
                {d.quiz.alanlar && (
                  <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
                    {Object.entries(d.quiz.alanlar).map(([k, v]) => (
                      <div key={k} className="flex items-center gap-2 text-[12px]">
                        <span className="w-28 truncate text-muted-foreground" title={ENDEKS_AREAS.find((a) => a.key === k)?.label ?? k}>{ENDEKS_AREAS.find((a) => a.key === k)?.label ?? k}</span>
                        <div className="h-1.5 flex-1 bg-secondary"><div className="h-full bg-foreground" style={{ width: `${Math.min(100, Number(v))}%` }} /></div>
                        <span className="w-7 text-right tnum">{String(v)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </Card>

          <Card title="AŞAMA VE TAKİP">
            <LeadStageControl l={l} onDone={() => void refresh()} />
            {l.lostReasonLabel && <p className="mt-2 text-[12.5px] text-muted-foreground">Kayıp nedeni: {l.lostReasonLabel}{l.lostNote ? ` — ${l.lostNote}` : ""}</p>}
            <div className="mt-3 flex flex-wrap gap-2 border-t border-border pt-3">
              {d.caseRef ? (
                <Link to="/kurucu/dosyalar" className="chamfer-sm inline-flex min-h-[44px] items-center gap-1.5 border border-border px-3.5 text-[13px] font-semibold hover:bg-secondary">
                  <FileText className="h-4 w-4" /> Dosya {d.caseRef}
                </Link>
              ) : (
                <Link to={`/talepler?basvuru=${l.id}`} className="chamfer-sm inline-flex min-h-[44px] items-center gap-1.5 bg-primary px-4 text-[13px] font-semibold text-primary-foreground hover-cta">
                  <FileText className="h-4 w-4" /> Danışmanlık dosyası aç
                </Link>
              )}
            </div>
          </Card>

          <Card title="ZAMAN ÇİZELGESİ">
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (text.trim()) note.mutate({ id: l.id, body: text.trim() });
              }}
            >
              <label htmlFor="lead-note" className="sr-only">Not bırak</label>
              <input id="lead-note" value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} placeholder="Not bırakın (yalnız siz görürsünüz)" className={inputCls} />
              <button type="submit" disabled={note.isPending || !text.trim()} className="chamfer-sm min-h-[44px] shrink-0 bg-foreground px-4 text-[13px] font-semibold text-background disabled:opacity-50">
                Kaydet
              </button>
            </form>
            <ol className="mt-4 space-y-3 border-l border-border pl-4">
              {d.timeline.map((e) => (
                <li key={e.id} className="relative text-[13px]">
                  <span className={`absolute -left-[21px] top-1.5 h-2 w-2 rounded-full ${e.kind === "note" ? "bg-foreground" : e.kind === "stage" ? "bg-mint" : "bg-border"}`} aria-hidden />
                  <div className="flex flex-wrap justify-between gap-x-3">
                    <span className={e.kind === "note" ? "whitespace-pre-wrap" : "text-muted-foreground"}>{e.body}</span>
                    <span className="shrink-0 text-[11.5px] text-muted-foreground tnum">{shortDate(e.at)}{e.by ? ` · ${e.by}` : ""}</span>
                  </div>
                </li>
              ))}
            </ol>
          </Card>
        </div>

        {/* Sağ sütun */}
        <div className="space-y-4">
          <Card>
            <div className="font-display text-[17px] font-bold">{l.name}</div>
            {l.companyName && <div className="text-[13px]">{l.companyName}</div>}
            <ul className="mt-3 space-y-1 text-[13px]">
              {l.email && (
                <li>
                  <a href={`mailto:${l.email}`} className="flex min-h-[44px] items-center gap-2 break-all hover:underline"><Mail className="h-4 w-4 shrink-0" />{l.email}</a>
                </li>
              )}
              {l.phone && (
                <>
                  <li>
                    <a href={`tel:${l.phone.replace(/\s/g, "")}`} className="flex min-h-[44px] items-center gap-2 hover:underline"><Phone className="h-4 w-4 shrink-0" />{l.phone}</a>
                  </li>
                  <li>
                    <a href={waLink(l.phone)} target="_blank" rel="noreferrer" className="flex min-h-[44px] items-center gap-2 hover:underline"><MessageCircle className="h-4 w-4 shrink-0" />WhatsApp'tan yaz</a>
                  </li>
                </>
              )}
            </ul>
            <p className="mt-2 text-[12.5px] text-muted-foreground">
              {d.contact.total > 1 ? `${d.contact.order}. başvurusu (toplam ${d.contact.total})` : "İlk başvurusu"}
            </p>
          </Card>

          <Card title="DÖNÜŞÜM ÖZETİ">
            {d.conversion ? (
              <dl className="space-y-2 text-[13px]">
                {[
                  ["Kanal", d.conversion.channel],
                  ["Kaynak site", d.conversion.refHost],
                  ["Kampanya", d.conversion.campaign ? `${d.conversion.campaign}${d.conversion.source ? ` (${d.conversion.source}${d.conversion.medium ? ` / ${d.conversion.medium}` : ""})` : ""}` : null],
                  ["Açılış sayfası", d.conversion.landing],
                  ["Cihaz", d.conversion.device],
                  ["Konum", d.conversion.location],
                  ["İlk ziyaret → başvuru", d.conversion.minutesToLead < 60 ? `${d.conversion.minutesToLead} dk` : `${Math.round(d.conversion.minutesToLead / 60)} sa`],
                  ["Gezdiği sayfalar", `${d.conversion.views} görüntüleme · ${d.conversion.pages.join(", ")}`],
                ]
                  .filter(([, v]) => v)
                  .map(([k, v]) => (
                    <div key={k as string} className="grid grid-cols-[7.5rem_1fr] gap-2">
                      <dt className="text-muted-foreground">{k}</dt>
                      <dd className="break-words">{v}</dd>
                    </div>
                  ))}
              </dl>
            ) : (
              <p className="text-[13px] text-muted-foreground">Kaynak bilgisi yok — Güncelleme 45 öncesi başvuru ya da ziyaret kaydı kapalı tarayıcı.</p>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

// =====================================================================
// Ürünler (Shopify Products)
// =====================================================================

export function UrunlerPage({ d }: { d: Ov }) {
  const [days, setDays] = useState<30 | 90 | 365>(90);
  const q = trpc.founder.products.useQuery({ days });
  return (
    <div className="mt-2 space-y-4">
      <Card title="YAZILIM">
        <div className="grid grid-cols-2 gap-3 text-[13px] sm:grid-cols-4">
          <div>
            <div className="text-muted-foreground">HAIZ Premium · aylık</div>
            <div className="font-display text-[18px] font-bold tnum">{fmtTL(PREMIUM_PRICE.monthly)}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Yıllık (ay başına)</div>
            <div className="font-display text-[18px] font-bold tnum">{fmtTL(PREMIUM_PRICE.yearlyMonthly)}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Ücretli / deneme şirket</div>
            <div className="font-display text-[18px] font-bold tnum">{d.members.premiumPaid} / {d.members.trial}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Aylık tekrarlayan gelir</div>
            <div className="font-display text-[18px] font-bold tnum">{fmtTL(d.money.mrr)}</div>
          </div>
        </div>
      </Card>

      <Card
        title="DANIŞMANLIK PAKETLERİ"
        right={
          <div className="flex gap-1" role="radiogroup" aria-label="Dönem">
            {([30, 90, 365] as const).map((x) => (
              <button key={x} role="radio" aria-checked={days === x} onClick={() => setDays(x)} className={`chamfer-sm min-h-[44px] border px-3 text-[12.5px] font-semibold ${days === x ? "border-foreground bg-foreground text-background" : "border-border hover:bg-secondary"}`}>
                {x === 365 ? "1 yıl" : `${x} gün`}
              </button>
            ))}
          </div>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-[13px]">
            <thead>
              <tr className="border-b border-border text-left text-[11px] text-muted-foreground">
                {["Paket", "Hat", "Süre", "Sayfa görüntüleme", "Ziyaretçi", "Başvuru", "Açık", "İmza", "Dönüşüm", ""].map((h) => (
                  <th key={h} className="px-2 py-2 font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(q.data ?? []).map((p) => (
                <tr key={p.id} className="border-b border-border/60 last:border-0">
                  <td className="px-2 py-2">
                    <div className="flex items-center gap-2">
                      <span className="chamfer-sm bg-foreground px-1.5 py-0.5 font-display text-[10.5px] font-bold text-primary">{p.code}</span>
                      <span className="font-semibold">{p.name}</span>
                      {p.comingSoon && <span className="text-[10.5px] text-muted-foreground">yakında</span>}
                      {p.draft && <span className="text-[10.5px] text-muted-foreground">taslak</span>}
                    </div>
                  </td>
                  <td className="px-2 py-2 text-[12px] text-muted-foreground">{LINE_LABEL[p.line as PackageLine] ?? p.line}</td>
                  <td className="max-w-[12rem] px-2 py-2 text-[12px] text-muted-foreground">{p.duration}</td>
                  <td className="px-2 py-2 tnum">{p.views}</td>
                  <td className="px-2 py-2 tnum">{p.sessions}</td>
                  <td className={`px-2 py-2 tnum ${p.leads ? "font-semibold" : ""}`}>{p.leads}</td>
                  <td className="px-2 py-2 tnum">{p.open}</td>
                  <td className={`px-2 py-2 tnum ${p.imza ? "font-bold text-mint" : ""}`}>{p.imza}</td>
                  <td className="px-2 py-2 tnum">{pct(p.conv)}</td>
                  <td className="px-2 py-2">
                    <a href={`/danismanlik/${p.id}`} target="_blank" rel="noreferrer" aria-label={`${p.name} sayfası`} className="flex h-11 w-11 items-center justify-center hover:bg-secondary">
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </td>
                </tr>
              ))}
              {q.isLoading && (
                <tr>
                  <td colSpan={10} className="px-2 py-6 text-center text-muted-foreground">Yükleniyor…</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[11.5px] text-muted-foreground">
          Görüntüleme ve ziyaretçi: paketin kendi sayfası (Güncelleme 45'ten itibaren). Başvuru: başvurudaki "ilgilendiğim paket" seçimi. Fiyatlar sitede yayınlanmadığı için burada da yok.
        </p>
      </Card>
    </div>
  );
}

// =====================================================================
// Müşteriler — danışmanlık kişileri (yazılım üyeleri ayrı sekmede)
// =====================================================================

export function DanismanlikMusterileri() {
  const q = trpc.founder.contacts.useQuery();
  const [search, setSearch] = useState("");
  const t = search.trim().toLocaleLowerCase("tr");
  const rows = (q.data ?? []).filter((c) => !t || [c.name, c.companyName, c.email, c.phone].some((x) => x?.toLocaleLowerCase("tr").includes(t)));
  return (
    <div className="mt-4">
      <label className="sr-only" htmlFor="c-search">Müşteri ara</label>
      <input id="c-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Ad, şirket, e-posta, telefon" className={`${inputCls} max-w-xs`} />
      <div className="chamfer mt-3 overflow-x-auto border border-border bg-card">
        <table className="w-full min-w-[720px] text-[13px]">
          <thead>
            <tr className="border-b border-border text-left text-[11px] text-muted-foreground">
              {["Kişi / şirket", "İletişim", "Başvuru", "İmza", "Son durum", "Son başvuru"].map((h) => (
                <th key={h} className="px-3 py-2 font-semibold">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.key} className="border-b border-border/60 last:border-0 hover:bg-secondary/40">
                <td className="px-3 py-2.5">
                  <Link to={`/kurucu/basvurular/${c.lastId}`} className="font-semibold hover:underline">{c.name}</Link>
                  {c.companyName && <div className="text-[11.5px] text-muted-foreground">{c.companyName}</div>}
                </td>
                <td className="px-3 py-2.5 text-[12px]">
                  {c.email && <div className="break-all">{c.email}</div>}
                  {c.phone && <div className="text-muted-foreground">{c.phone}</div>}
                </td>
                <td className="px-3 py-2.5 tnum">{c.leads}</td>
                <td className={`px-3 py-2.5 tnum ${c.imza ? "font-bold text-mint" : ""}`}>{c.imza}</td>
                <td className="px-3 py-2.5 text-[12.5px]">{c.lastStage}</td>
                <td className="px-3 py-2.5 text-[12px] text-muted-foreground tnum">{shortDate(c.lastAt)}</td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">{q.isLoading ? "Yükleniyor…" : "Kayıt yok."}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
