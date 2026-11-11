/**
 * Kurucu Paneli — Trafik / Canlı / Kampanya / SEO sekmeleri (Shopify Analytics karşılığı, HAIZ verisine göre).
 * Veri: founder.traffic · founder.live · founder.campaigns · founder.seo (api/founderTraffic.ts)
 */
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/providers/trpc";
import { isTrackingOff, setTrackingOff } from "@/lib/track";
import { buildCampaignUrl, RANGE_OPTIONS, UTM_PRESETS, type RangeDays } from "@contracts/traffic";
import { CONSULTING_PACKAGES } from "@contracts/consulting";
import { Copy, ExternalLink, RefreshCw } from "lucide-react";

const MONTHS = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
const dayLabel = (d: string) => `${Number(d.slice(8, 10))} ${MONTHS[Number(d.slice(5, 7)) - 1]}`;
const timeTR = (d: string | Date) => new Date(d).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Istanbul" });
const dateTimeTR = (d: string | Date) => new Date(d).toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Istanbul" });
const inputCls = "chamfer-sm h-11 w-full border border-border bg-background px-3 text-[16px] outline-none focus:border-foreground md:text-[14px]";
const pct = (n: number) => `%${n.toLocaleString("tr-TR")}`;

function Seg<T extends number>({ value, options, onChange, label }: { value: T; options: readonly { days: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.days}
          role="radio"
          aria-checked={value === o.days}
          onClick={() => onChange(o.days)}
          className={`chamfer-sm min-h-[44px] border px-3.5 text-[13px] font-semibold ${value === o.days ? "border-foreground bg-foreground text-background" : "border-border bg-card hover:bg-secondary"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Önceki döneme göre değişim (Shopify'daki ▲ / ▼) */
function Delta({ cur, prev, invert }: { cur: number; prev: number; invert?: boolean }) {
  if (!prev && !cur) return <span className="text-muted-foreground">—</span>;
  if (!prev) return <span className="text-mint">yeni</span>;
  const d = Math.round(((cur - prev) / prev) * 100);
  if (d === 0) return <span className="text-muted-foreground">değişmedi</span>;
  const good = invert ? d < 0 : d > 0;
  return (
    <span className={good ? "font-semibold text-mint" : "font-semibold text-destructive"}>
      {d > 0 ? "▲" : "▼"} %{Math.abs(d)}
    </span>
  );
}

function KPI({ label, value, cur, prev, invert, hint }: { label: string; value: string; cur: number; prev: number; invert?: boolean; hint?: string }) {
  return (
    <div className="chamfer min-w-0 border border-border bg-card p-4" title={hint}>
      <div className="label-caps !text-[10px]">{label}</div>
      <div className="mt-1 font-display text-[22px] font-bold leading-tight tnum">{value}</div>
      <div className="mt-0.5 text-[11.5px] tnum">
        <Delta cur={cur} prev={prev} invert={invert} /> <span className="text-muted-foreground">önceki döneme göre</span>
      </div>
    </div>
  );
}

function Card({ title, children, right }: { title: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <section className="chamfer min-w-0 border border-border bg-card p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="label-caps">{title}</h3>
        {right}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

/** Sıralı liste: etiket · oturum çubuğu · başvuru · dönüşüm */
function Rank({ rows, empty = "Henüz veri yok.", unit = "oturum" }: { rows: { key: string; label?: string; sessions: number; leads: number; conv: number }[]; empty?: string; unit?: string }) {
  if (!rows.length) return <p className="text-[13px] text-muted-foreground">{empty}</p>;
  const max = Math.max(1, ...rows.map((r) => r.sessions));
  return (
    <table className="w-full text-[12.5px]">
      <thead>
        <tr className="text-left text-[10.5px] text-muted-foreground">
          <th className="pb-1.5 font-semibold">&nbsp;</th>
          <th className="w-16 pb-1.5 text-right font-semibold">{unit}</th>
          <th className="w-16 pb-1.5 text-right font-semibold">başvuru</th>
          <th className="w-14 pb-1.5 text-right font-semibold">dönüşüm</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.key} className="border-t border-border/50">
            <td className="py-1.5 pr-2">
              <div className="truncate" title={r.key}>{r.label ?? r.key}</div>
              <div className="mt-1 h-1 bg-secondary" aria-hidden>
                <div className="h-full bg-foreground" style={{ width: `${(r.sessions / max) * 100}%` }} />
              </div>
            </td>
            <td className="py-1.5 text-right font-semibold tnum">{r.sessions}</td>
            <td className={`py-1.5 text-right tnum ${r.leads ? "font-semibold text-mint" : "text-muted-foreground"}`}>{r.leads}</td>
            <td className="py-1.5 text-right tnum text-muted-foreground">{pct(r.conv)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function TrackingToggle() {
  const [off, setOff] = useState(true);
  useEffect(() => setOff(isTrackingOff()), []);
  return (
    <label className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 text-[12.5px]">
      <input
        type="checkbox"
        checked={off}
        onChange={(e) => {
          setTrackingOff(e.target.checked);
          setOff(e.target.checked);
        }}
        className="h-5 w-5 accent-[hsl(var(--mint))]"
      />
      Bu tarayıcıdaki ziyaretlerimi sayma
    </label>
  );
}

// ---------------- Trafik ----------------

export function TrafikTab() {
  const [days, setDays] = useState<RangeDays>(7);
  const q = trpc.founder.traffic.useQuery({ days }, { refetchInterval: 60_000 });
  const d = q.data;
  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Seg value={days} options={RANGE_OPTIONS} onChange={setDays} label="Dönem" />
        <TrackingToggle />
      </div>
      {q.isLoading && <div className="chamfer mt-4 h-40 animate-pulse bg-secondary" />}
      {q.error && <p className="mt-4 text-[13px] text-destructive">{q.error.message}</p>}
      {d && (
        <>
          <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KPI label="Oturum" value={String(d.summary.sessions)} cur={d.summary.sessions} prev={d.prev.sessions} hint="Bir ziyaretçinin 30 dakikalık hareketsizliğe kadar süren tek ziyareti" />
            <KPI label="Tekil ziyaretçi" value={String(d.summary.visitors)} cur={d.summary.visitors} prev={d.prev.visitors} hint="Gün bazında tekil; çerez kullanılmadığı için günler arası aynı kişi ayrı sayılır" />
            <KPI label="Danışmanlık başvurusu" value={String(d.summary.leads)} cur={d.summary.leads} prev={d.prev.leads} />
            <KPI label="Dönüşüm oranı" value={pct(d.summary.conv)} cur={d.summary.conv} prev={d.prev.conv} hint="Başvuru yapılan oturum ÷ tüm oturumlar" />
            <KPI label="Sayfa görüntüleme" value={String(d.summary.views)} cur={d.summary.views} prev={d.prev.views} />
            <KPI label="Oturum başına sayfa" value={d.summary.pagesPerSession.toLocaleString("tr-TR")} cur={d.summary.pagesPerSession} prev={d.prev.pagesPerSession} />
            <KPI label="Tek sayfada çıkış" value={pct(d.summary.bounce)} cur={d.summary.bounce} prev={d.prev.bounce} invert hint="Tek sayfa görüp başvurmadan ayrılan oturumlar" />
            <KPI label="Yeni üye (yazılım)" value={String(d.summary.signups)} cur={d.summary.signups} prev={d.prev.signups} />
          </div>

          <div className="mt-4">
            <Card title={d.hourly ? "OTURUMLAR · SAATLİK" : "OTURUMLAR · GÜNLÜK"}>
              <SeriesChart series={d.series} hourly={d.hourly} />
            </Card>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card title="DÖNÜŞÜM HUNİSİ">
              <Funnel steps={d.funnel} />
            </Card>
            <Card title="KANALLARA GÖRE">
              <Rank rows={d.channels.map((c) => ({ key: c.id, label: c.label, sessions: c.sessions, leads: c.leads, conv: c.conv }))} />
            </Card>
            <Card title="AÇILIŞ SAYFALARI">
              <Rank rows={d.landing} />
            </Card>
            <Card title="YÖNLENDİREN SİTELER">
              <Rank rows={d.referrers} empty="Başka siteden gelen ziyaret yok." />
            </Card>
            <Card title="EN ÇOK GÖRÜNTÜLENEN SAYFALAR">
              {d.pages.length ? (
                <ul className="space-y-1.5 text-[12.5px]">
                  {d.pages.map((p) => (
                    <li key={p.path} className="flex justify-between gap-2 border-t border-border/50 pt-1.5 first:border-0 first:pt-0">
                      <span className="truncate" title={p.path}>{p.label}</span>
                      <span className="font-semibold tnum">{p.views}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[13px] text-muted-foreground">Henüz veri yok.</p>
              )}
            </Card>
            <Card title="ÇIKIŞ SAYFALARI">
              <Rank rows={d.exits} />
            </Card>
            <Card title="CİHAZ">
              <Rank rows={d.devices} />
            </Card>
            <Card title="KONUM (SAAT DİLİMİ)">
              <Rank rows={d.locations} />
            </Card>
          </div>
          <p className="mt-4 text-[12px] leading-relaxed text-muted-foreground">
            Yalnız halka açık sayfalar sayılır (ana sayfa, danışmanlık ve paket sayfaları, restorasyon, giriş). Çerez kullanılmaz, IP adresi saklanmaz; botlar sayılmaz.
            Reklam engelleyici kullanan ziyaretçiler de sayılır (kayıt kendi sunucumuza gider). Konum, tarayıcının saat diliminden okunur.
          </p>
        </>
      )}
    </div>
  );
}

function SeriesChart({ series, hourly }: { series: { key: string; sessions: number; leads: number }[]; hourly: boolean }) {
  const max = Math.max(1, ...series.map((s) => s.sessions));
  const step = series.length > 31 ? 7 : series.length > 12 ? 3 : 1;
  return (
    <>
      <div className="flex h-36 items-end gap-[2px] sm:gap-1">
        {series.map((s, i) => (
          <div key={s.key} className="flex h-full min-w-0 flex-1 flex-col justify-end" title={`${hourly ? `${s.key}:00` : dayLabel(s.key)} · ${s.sessions} oturum · ${s.leads} başvuru`}>
            <div className="relative bg-foreground" style={{ height: `${(s.sessions / max) * 100}%`, minHeight: s.sessions ? 2 : 0 }}>
              {s.leads > 0 && <div className="absolute inset-x-0 bottom-0 bg-mint" style={{ height: `${Math.max(8, (s.leads / Math.max(1, s.sessions)) * 100)}%` }} />}
            </div>
            <div className="mt-1 h-3 truncate text-center text-[9.5px] text-muted-foreground tnum">{i % step === 0 ? (hourly ? s.key : dayLabel(s.key)) : ""}</div>
          </div>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 bg-foreground" /> Oturum</span>
        <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 bg-mint" /> Başvuru olan</span>
      </div>
    </>
  );
}

function Funnel({ steps }: { steps: { label: string; n: number }[] }) {
  const top = Math.max(1, steps[0]?.n ?? 1);
  return (
    <div className="space-y-1.5">
      {steps.map((s, i) => {
        const prev = i ? steps[i - 1].n : 0;
        const pass = i && prev ? Math.round((s.n / prev) * 100) : null;
        return (
          <div key={s.label} className="grid grid-cols-[8.5rem_1fr_3rem_3.2rem] items-center gap-2 text-[12.5px]">
            <span className="truncate">{s.label}</span>
            <div className="h-3 bg-secondary">
              <div className={i >= 3 ? "h-full bg-mint" : "h-full bg-foreground"} style={{ width: `${(s.n / top) * 100}%` }} />
            </div>
            <span className="text-right font-semibold tnum">{s.n}</span>
            <span className="text-right text-[11px] text-muted-foreground tnum">{pass === null ? "" : `%${pass}`}</span>
          </div>
        );
      })}
      <p className="pt-1 text-[11px] text-muted-foreground">Sağdaki yüzde: bir önceki adımdan geçenlerin oranı. İmza, Talepler ekranındaki aşamadan gelir.</p>
    </div>
  );
}

// ---------------- Canlı ----------------

export function CanliTab() {
  const q = trpc.founder.live.useQuery(undefined, { refetchInterval: 15_000 });
  const d = q.data;
  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[12.5px] text-muted-foreground">15 saniyede bir yenilenir{d ? ` · son: ${timeTR(d.at)}` : ""}</p>
        <button onClick={() => q.refetch()} className="chamfer-sm inline-flex min-h-[44px] items-center gap-1.5 border border-border bg-card px-3.5 text-[13px] font-semibold hover:bg-secondary">
          <RefreshCw className={`h-4 w-4 ${q.isFetching ? "animate-spin" : ""}`} /> Yenile
        </button>
      </div>
      {q.isLoading && <div className="chamfer mt-4 h-40 animate-pulse bg-secondary" />}
      {d && (
        <>
          <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className={`chamfer border p-4 ${d.activeNow ? "border-mint bg-mint-soft" : "border-border bg-card"}`}>
              <div className="label-caps !text-[10px]">Şu an sitede</div>
              <div className="mt-1 flex items-center gap-2 font-display text-[28px] font-bold leading-tight tnum">
                {d.activeNow > 0 && <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-mint" aria-hidden />}
                {d.activeNow}
              </div>
              <div className="mt-0.5 text-[11.5px] text-muted-foreground">son 5 dakikada hareket eden</div>
            </div>
            <div className="chamfer border border-border bg-card p-4">
              <div className="label-caps !text-[10px]">Bugün oturum</div>
              <div className="mt-1 font-display text-[22px] font-bold tnum">{d.today.sessions}</div>
            </div>
            <div className="chamfer border border-border bg-card p-4">
              <div className="label-caps !text-[10px]">Bugün ziyaretçi</div>
              <div className="mt-1 font-display text-[22px] font-bold tnum">{d.today.visitors}</div>
            </div>
            <div className={`chamfer border p-4 ${d.today.leads ? "border-mint bg-mint-soft" : "border-border bg-card"}`}>
              <div className="label-caps !text-[10px]">Bugün başvuru</div>
              <div className="mt-1 font-display text-[22px] font-bold tnum">{d.today.leads}</div>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card title="ŞU AN HANGİ SAYFADA">
              <Rank rows={d.pagesNow} empty="Şu an kimse yok." unit="kişi" />
            </Card>
            <Card title="NEREDEN GELDİLER">
              <Rank rows={d.channelsNow} empty="—" unit="kişi" />
            </Card>
            <Card title="CİHAZ">
              <Rank rows={d.devicesNow} empty="—" unit="kişi" />
            </Card>
          </div>
          <div className="mt-4">
            <Card title="SON HAREKETLER · 30 DAKİKA">
              {d.recent.length ? (
                <ul className="divide-y divide-border/60 text-[12.5px]">
                  {d.recent.map((e) => (
                    <li key={e.id} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 py-1.5">
                      <span className="w-11 shrink-0 text-muted-foreground tnum">{timeTR(e.at)}</span>
                      {e.type === "lead" ? (
                        <span className="chamfer-sm bg-mint px-1.5 text-[11px] font-bold text-white">BAŞVURU</span>
                      ) : (
                        <span className="text-[11px] text-muted-foreground">görüntüleme</span>
                      )}
                      <span className="min-w-0 flex-1 truncate font-semibold">{e.label}</span>
                      <span className="text-muted-foreground">
                        {e.channel}
                        {e.campaign ? ` · ${e.campaign}` : ""} · {e.device}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[13px] text-muted-foreground">Son 30 dakikada ziyaret yok.</p>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

// ---------------- Kampanya ----------------

const CAMPAIGN_RANGES = [
  { days: 7 as const, label: "7 gün" },
  { days: 30 as const, label: "30 gün" },
  { days: 90 as const, label: "90 gün" },
];

export function KampanyaTab() {
  const [days, setDays] = useState<7 | 30 | 90>(30);
  const q = trpc.founder.campaigns.useQuery({ days });
  const d = q.data;
  return (
    <div className="mt-6">
      <Seg value={days} options={CAMPAIGN_RANGES} onChange={setDays} label="Dönem" />
      {q.isLoading && <div className="chamfer mt-4 h-40 animate-pulse bg-secondary" />}
      {d && (
        <>
          <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="chamfer border border-border bg-card p-4">
              <div className="label-caps !text-[10px]">Kampanya sayısı</div>
              <div className="mt-1 font-display text-[22px] font-bold tnum">{d.campaigns.length}</div>
            </div>
            <div className="chamfer border border-border bg-card p-4">
              <div className="label-caps !text-[10px]">Kampanyalı oturum</div>
              <div className="mt-1 font-display text-[22px] font-bold tnum">{d.campaigns.reduce((t, c) => t + c.sessions, 0)}</div>
            </div>
            <div className="chamfer border border-border bg-card p-4">
              <div className="label-caps !text-[10px]">Reklamdan gelen</div>
              <div className="mt-1 font-display text-[22px] font-bold tnum">{d.paid.sessions}</div>
              <div className="mt-0.5 text-[11.5px] text-muted-foreground">{d.paid.leads} başvuru</div>
            </div>
            <div className={`chamfer border p-4 ${d.paid.noUtm ? "border-primary bg-primary/15" : "border-border bg-card"}`}>
              <div className="label-caps !text-[10px]">Etiketsiz reklam tıklaması</div>
              <div className="mt-1 font-display text-[22px] font-bold tnum">{d.paid.noUtm}</div>
              <div className="mt-0.5 text-[11.5px] text-muted-foreground">Kampanya adı yok; aşağıdaki bağlantıyı kullanın</div>
            </div>
          </div>

          <div className="mt-4">
            <Card title="KAMPANYA PERFORMANSI (UTM)">
              {d.campaigns.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] text-[12.5px]">
                    <thead>
                      <tr className="text-left text-[10.5px] text-muted-foreground">
                        {["Kampanya", "Kaynak / ortam", "Oturum", "Ziyaretçi", "Başvuru", "Dönüşüm", "İmza"].map((h) => (
                          <th key={h} className="pb-1.5 font-semibold">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {d.campaigns.map((c) => (
                        <tr key={`${c.campaign}|${c.source}|${c.medium}`} className="border-t border-border/50">
                          <td className="py-1.5 pr-2 font-semibold">{c.campaign}</td>
                          <td className="py-1.5 pr-2 text-muted-foreground">{c.source} / {c.medium}</td>
                          <td className="py-1.5 tnum">{c.sessions}</td>
                          <td className="py-1.5 tnum">{c.visitors}</td>
                          <td className={`py-1.5 tnum ${c.leads ? "font-semibold text-mint" : ""}`}>{c.leads}</td>
                          <td className="py-1.5 tnum">{pct(c.conv)}</td>
                          <td className={`py-1.5 tnum ${c.imza ? "font-bold text-mint" : ""}`}>{c.imza}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-[13px] text-muted-foreground">Bu dönemde kampanya etiketli ziyaret yok. Paylaşım ve reklamlarda aşağıdaki bağlantı oluşturucuyu kullanın.</p>
              )}
            </Card>
          </div>

          <div className="mt-4">
            <UtmBuilder />
          </div>

          <div className="mt-4">
            <Card title="BAŞVURULAR NEREDEN GELDİ">
              {d.leadSources.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[680px] text-[12.5px]">
                    <thead>
                      <tr className="text-left text-[10.5px] text-muted-foreground">
                        {["Tarih", "Başvuran", "İlgi", "Kanal", "Kampanya / site", "Açılış", "Aşama"].map((h) => (
                          <th key={h} className="pb-1.5 font-semibold">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {d.leadSources.map((l) => (
                        <tr key={l.id} className="border-t border-border/50">
                          <td className="py-1.5 pr-2 text-muted-foreground tnum">{dateTimeTR(l.at)}</td>
                          <td className="py-1.5 pr-2 font-semibold">{l.who}</td>
                          <td className="py-1.5 pr-2">{l.interest ?? "—"}</td>
                          <td className="py-1.5 pr-2">{l.channel ?? <span className="text-muted-foreground">bilinmiyor</span>}</td>
                          <td className="py-1.5 pr-2 text-muted-foreground">{l.campaign ?? l.refHost ?? "—"}</td>
                          <td className="py-1.5 pr-2 text-muted-foreground">{l.landing ?? "—"}</td>
                          <td className="py-1.5">{l.stage}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-[13px] text-muted-foreground">Bu dönemde başvuru yok.</p>
              )}
              <p className="mt-2 text-[11px] text-muted-foreground">"Bilinmiyor": güncelleme 45 öncesi başvurular veya ziyaret kaydı kapalı tarayıcılar.</p>
            </Card>
          </div>
          <p className="mt-4 text-[12px] leading-relaxed text-muted-foreground">
            Reklam harcaması, gösterim ve tıklama sayıları Meta Reklam Yöneticisi ve LinkedIn Campaign Manager'da kalır; bu ekran o tıklamaların sitede ne yaptığını (oturum, başvuru, imza) gösterir.
            Google Ads / Meta tıklama kimliği (gclid, fbclid) olan ziyaretler etiket olmasa da "Reklam" sayılır.
          </p>
        </>
      )}
    </div>
  );
}

function UtmBuilder() {
  const [preset, setPreset] = useState<string>(UTM_PRESETS[0].id);
  const [campaign, setCampaign] = useState("");
  const [content, setContent] = useState("");
  const [target, setTarget] = useState("/danismanlik");
  const p = UTM_PRESETS.find((x) => x.id === preset) ?? UTM_PRESETS[0];
  const url = useMemo(() => (campaign.trim() ? buildCampaignUrl(`https://haiz.org${target}`, { source: p.source, medium: p.medium, campaign, content }) : ""), [p, campaign, content, target]);
  return (
    <Card title="KAMPANYA BAĞLANTISI OLUŞTUR">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-[12px]">
          <span className="mb-1 block text-muted-foreground">Nerede paylaşılacak</span>
          <select value={preset} onChange={(e) => setPreset(e.target.value)} className={inputCls}>
            {UTM_PRESETS.map((x) => (
              <option key={x.id} value={x.id}>{x.label}</option>
            ))}
          </select>
        </label>
        <label className="text-[12px]">
          <span className="mb-1 block text-muted-foreground">Kampanya adı</span>
          <input value={campaign} onChange={(e) => setCampaign(e.target.value)} placeholder="ör. ofis-rontgeni-kasim" className={inputCls} />
        </label>
        <label className="text-[12px]">
          <span className="mb-1 block text-muted-foreground">Gönderi / reklam (isteğe bağlı)</span>
          <input value={content} onChange={(e) => setContent(e.target.value)} placeholder="ör. hafta3-karusel" className={inputCls} />
        </label>
        <label className="text-[12px]">
          <span className="mb-1 block text-muted-foreground">Açılacak sayfa</span>
          <select value={target} onChange={(e) => setTarget(e.target.value)} className={inputCls}>
            <option value="/danismanlik">Danışmanlık</option>
            <option value="/">Ana sayfa</option>
            <option value="/restorasyon">Restorasyon</option>
            {CONSULTING_PACKAGES.map((x) => (
              <option key={x.id} value={`/danismanlik/${x.id}`}>Paket · {x.name}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <output className="chamfer-sm flex min-h-[44px] min-w-0 flex-1 items-center break-all border border-border bg-background px-3 py-2 font-data text-[12px]">
          {url || <span className="text-muted-foreground">Kampanya adını yazın</span>}
        </output>
        <button
          disabled={!url}
          onClick={() => navigator.clipboard.writeText(url).then(() => toast.success("Bağlantı kopyalandı"), () => toast.error("Kopyalanamadı"))}
          className="chamfer-sm inline-flex min-h-[44px] items-center justify-center gap-1.5 bg-primary px-4 text-[13px] font-semibold text-primary-foreground hover-cta disabled:opacity-50"
        >
          <Copy className="h-4 w-4" /> Kopyala
        </button>
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">Instagram profil bağlantısı, LinkedIn gönderileri ve reklamlarda bu adresi kullanın; ziyaret ve başvurular bu kampanya adıyla yukarıda görünür.</p>
    </Card>
  );
}

// ---------------- SEO ----------------

const ST: Record<string, { label: string; cls: string }> = {
  ok: { label: "TAMAM", cls: "bg-mint text-white" },
  warn: { label: "İYİLEŞTİR", cls: "bg-primary text-foreground" },
  fail: { label: "EKSİK", cls: "bg-destructive text-white" },
  skip: { label: "ATLANDI", cls: "bg-secondary text-muted-foreground" },
};

export function SeoTab() {
  const q = trpc.founder.seo.useQuery(undefined, { staleTime: 5 * 60_000 });
  const d = q.data;
  const groups: string[] = d ? Array.from(new Set<string>(d.checks.map((c) => String(c.group)))) : [];
  return (
    <div className="mt-6">
      {q.isLoading && <div className="chamfer h-40 animate-pulse bg-secondary" />}
      {q.error && <p className="text-[13px] text-destructive">{q.error.message}</p>}
      {d && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className={`chamfer border p-4 ${d.score >= 80 ? "border-mint bg-mint-soft" : d.score >= 50 ? "border-primary bg-primary/15" : "border-destructive/50 bg-destructive/[0.06]"}`}>
              <div className="label-caps !text-[10px]">Teknik SEO puanı</div>
              <div className="mt-1 font-display text-[28px] font-bold leading-tight tnum">{d.score}</div>
              <div className="mt-0.5 text-[11.5px] text-muted-foreground">tamam olan kontrol oranı</div>
            </div>
            <div className="chamfer border border-border bg-card p-4">
              <div className="label-caps !text-[10px]">Organik oturum · 28 gün</div>
              <div className="mt-1 font-display text-[22px] font-bold tnum">{d.organic.sessions}</div>
              <div className="mt-0.5 text-[11.5px] text-muted-foreground">tüm oturumların %{d.organic.share}'i</div>
            </div>
            <div className="chamfer border border-border bg-card p-4">
              <div className="label-caps !text-[10px]">Organikten başvuru</div>
              <div className="mt-1 font-display text-[22px] font-bold tnum">{d.organic.leads}</div>
            </div>
            <button onClick={() => q.refetch()} className="chamfer inline-flex min-h-[44px] flex-col items-start justify-center border border-border bg-card p-4 text-left hover:border-foreground/40">
              <span className="label-caps !text-[10px]">Yeniden kontrol et</span>
              <span className="mt-1 inline-flex items-center gap-1.5 text-[13px] font-semibold">
                <RefreshCw className={`h-4 w-4 ${q.isFetching ? "animate-spin" : ""}`} /> Şimdi çalıştır
              </span>
            </button>
          </div>

          <div className="mt-4 space-y-4">
            {groups.map((g) => (
              <Card key={g} title={g.toLocaleUpperCase("tr")}>
                <ul className="divide-y divide-border/60">
                  {d.checks
                    .filter((c) => c.group === g)
                    .map((c) => (
                      <li key={c.id} className="grid grid-cols-[5.5rem_1fr] gap-3 py-2">
                        <span className={`chamfer-sm h-6 self-start px-1.5 pt-[3px] text-center text-[10.5px] font-bold ${ST[c.status].cls}`}>{ST[c.status].label}</span>
                        <div className="min-w-0 text-[13px]">
                          <div className="font-semibold">{c.label}</div>
                          <div className="break-words text-[12px] text-muted-foreground">{c.detail}</div>
                          {c.fix && <div className="mt-0.5 text-[12px]">→ {c.fix}</div>}
                        </div>
                      </li>
                    ))}
                </ul>
              </Card>
            ))}
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card title="ORGANİK · ARAMA MOTORLARI">
              <Rank rows={d.organic.engines} empty="Aramadan gelen ziyaret henüz yok." />
            </Card>
            <Card title="ORGANİK · AÇILIŞ SAYFALARI">
              <Rank rows={d.organic.landing} empty="Aramadan gelen ziyaret henüz yok." />
            </Card>
          </div>

          <div className="mt-4">
            <Card title="GOOGLE ARAÇLARI">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {[
                  { href: d.links.performance, label: "Search Console · Arama sonuçları", sub: "Hangi aramada kaç gösterim, tıklama, sıra" },
                  { href: d.links.searchConsole, label: "Search Console · Genel bakış", sub: "Dizine eklenen sayfalar, site haritası" },
                  { href: d.links.pageSpeed, label: "PageSpeed · Danışmanlık sayfası", sub: "Hız ve mobil uyum puanı" },
                  { href: d.links.richResults, label: "Zengin sonuç testi", sub: "Yapılandırılmış veri kontrolü" },
                ].map((l) => (
                  <a key={l.href} href={l.href} target="_blank" rel="noreferrer" className="chamfer-sm flex min-h-[44px] items-center justify-between gap-3 border border-border px-3 py-2 hover:bg-secondary">
                    <span className="min-w-0">
                      <span className="block text-[13px] font-semibold">{l.label}</span>
                      <span className="block truncate text-[11.5px] text-muted-foreground">{l.sub}</span>
                    </span>
                    <ExternalLink className="h-4 w-4 shrink-0" />
                  </a>
                ))}
              </div>
              <p className="mt-2 text-[11.5px] text-muted-foreground">
                Arama sorguları, gösterim ve Google sırası yalnız Search Console'da tutulur. Bu ekrana çekmek için Google hizmet hesabı anahtarı gerekir (yalnız Render ortam değişkenine konur) — ayrı onayınızla eklenir.
              </p>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
