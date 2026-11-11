import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { trpc } from "@/providers/trpc";
import { ArrowLeft, ArrowRight, Check, ChevronDown, Clock, RotateCcw, Search, Send } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import {
  AREA_WHY,
  CONSULTING_PACKAGES,
  ENDEKS_AREAS,
  ENDEKS_QUESTIONS,
  endeksBand,
  endeksResult,
  getPackage,
  type ConsultingPackage,
} from "@contracts/consulting";
import { formatCompanyName, formatPersonName, formatPhoneTR, normalizeEmail } from "@contracts/normalize";
import SiteFooter from "@/components/SiteFooter";
import SiteHeader from "@/components/SiteHeader";
import { currentSid } from "@/lib/track";

/*
 * Danışmanlık sayfası — ziyaretçinin kafasındaki soru sırasıyla:
 *   1 Ne yapıyorsunuz?  →  2 Benim ofisim ne durumda? (test)  →  3 Neden?  →
 *   4 Ne yapılabilir?   →  5 Nasıl, ne kadar sürede?          →  6 Başvuru
 * Ziyaretçilerin çoğu telefondan geliyor: tek sütun, büyük dokunma alanları, soru soru ilerleyen test,
 * altta bağlama göre değişen sabit eylem çubuğu. Masaüstünde aynı akış, daha geniş.
 */

export function ChamferButton({
  children,
  variant = "primary",
  className = "",
  onClick,
  type = "button",
}: {
  children: React.ReactNode;
  variant?: "primary" | "outline";
  className?: string;
  onClick?: () => void;
  type?: "button" | "submit";
}) {
  const base =
    "chamfer inline-flex min-h-[48px] items-center justify-center gap-2 px-7 py-3.5 font-display font-semibold text-[15px] transition-colors duration-200";
  const styles =
    variant === "primary"
      ? "bg-primary text-primary-foreground hover-cta"
      : "bg-transparent text-foreground border border-foreground/30 hover:border-foreground hover:bg-foreground hover:text-background";
  return (
    <button type={type} onClick={onClick} className={`${base} ${styles} ${className}`}>
      {children}
    </button>
  );
}

const STEPS = ["Ne yapıyoruz?", "Ofisiniz ne durumda?", "Neden?", "Ne yapılabilir?", "Nasıl, ne kadar sürede?", "Başvuru"];

function StepLabel({ n, dark = false }: { n: number; dark?: boolean }) {
  return (
    <p className={`label-caps mb-3 flex items-center gap-2 ${dark ? "!text-background/55" : ""}`}>
      <span className={`font-mono tnum ${dark ? "text-primary" : "text-mint"}`}>
        {String(n).padStart(2, "0")}/{String(STEPS.length).padStart(2, "0")}
      </span>
      <span aria-hidden>·</span>
      {STEPS[n - 1].toLocaleUpperCase("tr")}
    </p>
  );
}

const BAND_CLS = {
  red: "bg-destructive",
  amber: "bg-[#E0A526]",
  mint: "bg-mint",
} as const;

const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
}

/* ---------------- paket satırı (açılır) ---------------- */

function PackageRow({
  p,
  highlight,
  defaultOpen = false,
  onPick,
}: {
  p: ConsultingPackage;
  highlight?: string;
  defaultOpen?: boolean;
  onPick: (p: ConsultingPackage) => void;
}) {
  return (
    <details
      open={defaultOpen}
      className={`group chamfer border bg-card ${highlight ? "border-mint" : "border-border"} [&_summary::-webkit-details-marker]:hidden`}
    >
      <summary className="flex cursor-pointer list-none items-start gap-3 p-4 sm:p-5">
        <span className="chamfer-sm mt-0.5 flex h-8 min-w-8 shrink-0 items-center justify-center bg-foreground px-2 font-display text-[13px] font-bold text-primary">
          {p.code}
        </span>
        <span className="min-w-0 flex-1">
          {highlight && (
            <span className="chamfer-sm mb-1.5 inline-block bg-mint-soft px-2 py-0.5 text-[10.5px] font-semibold text-mint">
              {highlight}
            </span>
          )}
          <span className="block font-display text-[16px] font-bold leading-snug sm:text-[17px]">{p.question}</span>
          <span className="mt-1 block text-[13px] text-muted-foreground">
            <span className="font-semibold text-foreground/85">{p.name}</span> · {p.duration}
            {p.comingSoon && !/yakında/i.test(p.duration) ? " · yakında" : ""}
          </span>
        </span>
        <ChevronDown className="mt-1 h-5 w-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>
      <div className="border-t border-border px-4 pb-5 pt-4 sm:px-5">
        <p className="text-[14.5px] font-medium leading-snug">{p.promise}</p>
        <p className="mt-2 text-[13.5px] leading-relaxed text-muted-foreground">{p.forWho}</p>
        <ul className="mt-3 space-y-2">
          {p.deliverables.slice(0, 4).map((d) => (
            <li key={d} className="flex gap-2 text-[13.5px] leading-snug">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-mint" /> <span>{d}</span>
            </li>
          ))}
        </ul>
        {p.haizIncluded && <p className="mt-3 text-[13px] font-medium text-foreground/80">{p.haizIncluded}</p>}
        <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3">
          <Link
            to={`/danismanlik/${p.id}`}
            className="inline-flex min-h-[44px] items-center gap-1.5 text-[14px] font-semibold text-foreground hover:underline"
          >
            Tüm kapsam, süreç ve kabul ölçütü <ArrowRight className="h-4 w-4" />
          </Link>
          <button
            type="button"
            onClick={() => onPick(p)}
            className="inline-flex min-h-[44px] items-center gap-1.5 text-[14px] font-semibold text-mint hover:underline"
          >
            {p.comingSoon ? "Ön kayıt bırak" : "Bu paketle başvur"}
          </button>
        </div>
      </div>
    </details>
  );
}

/* ---------------- sayfa ---------------- */

export default function Danismanlik() {
  const { isAuthenticated } = useAuth();
  const ctaTarget = isAuthenticated ? "/panel" : "/login";
  const [params] = useSearchParams();

  // ---- test: soru soru
  const N = ENDEKS_QUESTIONS.length;
  const [choices, setChoices] = useState<(number | null)[]>(Array(N).fill(null));
  const [qi, setQi] = useState(0);
  const [editing, setEditing] = useState(true);
  const answeredAll = choices.every((c) => c !== null);
  const answeredCount = choices.filter((c) => c !== null).length;
  const sonuc = useMemo(() => (answeredAll ? endeksResult(choices as number[]) : null), [answeredAll, choices]);
  const oneriPaket = sonuc ? getPackage(sonuc.packageId) : undefined;
  const advanceTimer = useRef<number | null>(null);

  const choose = (oi: number) => {
    const next = choices.map((c, k) => (k === qi ? oi : c));
    setChoices(next);
    if (advanceTimer.current) window.clearTimeout(advanceTimer.current);
    advanceTimer.current = window.setTimeout(() => {
      const firstEmpty = next.findIndex((c, k) => c === null && k > qi);
      const anyEmpty = next.findIndex((c) => c === null);
      if (firstEmpty >= 0) setQi(firstEmpty);
      else if (anyEmpty >= 0) setQi(anyEmpty);
      else {
        setEditing(false);
        window.setTimeout(() => scrollToId("neden"), 60);
      }
    }, 220);
  };
  useEffect(() => () => void (advanceTimer.current && window.clearTimeout(advanceTimer.current)), []);

  // ---- form
  const [name, setName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [interest, setInterest] = useState("");
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);
  const [contactErr, setContactErr] = useState("");

  // /danismanlik?paket=<id> → paket seçili gelsin
  useEffect(() => {
    const p = getPackage(params.get("paket"));
    if (p) setInterest(p.name);
  }, [params]);

  const submit = trpc.lead.submit.useMutation({ onSuccess: () => setSent(true) });

  // Düzen hattı ofis basamakları + Sürekli Eşlik; şantiye paketleri; AI hattı ayrı
  const ofis = CONSULTING_PACKAGES.filter((p) => p.group === "ofis" && p.line !== "ai");
  const platform = CONSULTING_PACKAGES.filter((p) => p.group === "platform" && p.line !== "ai");
  const aiHatti = CONSULTING_PACKAGES.filter((p) => p.line === "ai");
  const rontgen = getPackage("rontgen");

  const pick = (p: ConsultingPackage) => {
    setInterest(p.name);
    scrollToId("iletisim");
  };

  const applyWithResult = () => {
    setInterest("Ofis Röntgeni");
    if (sonuc) {
      setMessage(
        (m) =>
          m ||
          `Ofis Düzen Endeksi sonucum: ${sonuc.endeks}/100 — en zayıf alan: ${sonuc.zayif.label}. Önerilen ilk adım: ${oneriPaket?.name ?? "-"}. Ofis Röntgeni görüşmesi istiyorum.`,
      );
    }
    scrollToId("iletisim");
  };

  // ---- mobil alt çubuk: ilk ekran geçilince görünür, form görünürken ve gönderimden sonra gizlenir
  const heroRef = useRef<HTMLElement | null>(null);
  const formRef = useRef<HTMLElement | null>(null);
  const testRef = useRef<HTMLElement | null>(null);
  const [heroVisible, setHeroVisible] = useState(true);
  const [formVisible, setFormVisible] = useState(false);
  const [testVisible, setTestVisible] = useState(false);
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.target === heroRef.current) setHeroVisible(e.isIntersecting);
        if (e.target === formRef.current) setFormVisible(e.isIntersecting);
        if (e.target === testRef.current) setTestVisible(e.isIntersecting);
      }
    }, { rootMargin: "-20% 0px -20% 0px" });
    if (heroRef.current) io.observe(heroRef.current);
    if (formRef.current) io.observe(formRef.current);
    if (testRef.current) io.observe(testRef.current);
    return () => io.disconnect();
  }, []);
  // Test çözülürken çubuk soruların üstünü kapatmasın
  const showBar = !heroVisible && !formVisible && !sent && !(testVisible && (editing || !sonuc));

  const q = ENDEKS_QUESTIONS[qi];
  const qArea = ENDEKS_AREAS.find((a) => a.key === q.area);
  const inputCls =
    "chamfer-sm w-full border border-border bg-background px-3.5 py-3 text-[16px] outline-none focus:border-mint";

  return (
    <div className="min-h-screen bg-background pb-24 text-foreground md:pb-0">
      <SiteHeader />

      {/* 1 · NE YAPIYORUZ? */}
      <section ref={heroRef} className="bg-foreground text-background">
        <div className="mx-auto max-w-6xl px-5 pb-12 pt-10 md:py-24">
          <StepLabel n={1} dark />
          <h1 className="max-w-3xl font-display text-[34px] font-bold leading-[1.06] tracking-tight sm:text-5xl md:text-6xl">
            Mimarlık ofisinin <span className="text-primary">düzenini kuruyoruz.</span>
          </h1>
          <p className="mt-5 max-w-2xl text-[16px] leading-relaxed text-background/75">
            Dosyalar, teklifler, ekip, şantiye ve görünürlük: işi yavaşlatan düzensizliği önce ölçer, sonra kurar, sonra
            kendi yazılımımız HAIZ ile sahada çalışır hale getiririz.
          </p>
          <ul className="mt-6 grid gap-2.5 text-[14.5px] text-background/85 sm:grid-cols-3 sm:gap-4">
            {[
              "Mimar kökenliyiz — sektörü size anlattırmayız",
              "Kendi yazılımımızı geliştiriyoruz — teori değil",
              "Her iş ölçümle başlar, yazılı kabulle biter",
            ].map((t) => (
              <li key={t} className="flex gap-2">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span>{t}</span>
              </li>
            ))}
          </ul>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:gap-4">
            <ChamferButton className="w-full sm:w-auto" onClick={() => scrollToId("endeks")}>
              Ofisimin durumunu ölç · 3 dk <ArrowRight className="h-4 w-4" />
            </ChamferButton>
            <button
              type="button"
              onClick={() => scrollToId("iletisim")}
              className="min-h-[44px] text-left text-[14px] font-medium text-background/70 underline-offset-4 hover:text-primary hover:underline sm:self-center"
            >
              Testi atla, doğrudan başvur
            </button>
          </div>
          <Link
            to="/takip"
            className="mt-6 inline-flex min-h-[44px] items-center gap-1.5 text-[13px] font-medium text-background/60 hover:text-primary"
          >
            <Search className="h-3.5 w-3.5" /> Süreciniz başladı mı? Referans kodunuzla sorgulayın
          </Link>
        </div>
      </section>

      {/* 2 · OFİSİNİZ NE DURUMDA? — test */}
      <section id="endeks" ref={testRef} className="border-b border-border">
        <span id="test" className="block" aria-hidden />
        <div className="mx-auto max-w-2xl px-5 py-12 md:py-20">
          <StepLabel n={2} />
          <h2 className="font-display text-[26px] font-bold leading-tight tracking-tight md:text-4xl">
            Ofisiniz ne durumda?
          </h2>
          <p className="mt-2 font-display text-[17px] font-semibold text-mint">14 soru · 3 dakika</p>
          <p className="mt-3 text-[14.5px] leading-relaxed text-muted-foreground">
            7 alan ayrı ayrı puanlanır; en zayıf alan ilk adımı belirler. Cevaplar yalnız bu sayfada hesaplanır, başvuru
            göndermedikçe bize ulaşmaz.
          </p>

          {editing || !sonuc ? (
            <div className="chamfer mt-8 border border-border bg-card p-5 sm:p-7">
              <div className="flex items-center justify-between gap-3 text-[12.5px] text-muted-foreground">
                <span className="font-semibold text-mint">{qArea?.label}</span>
                <span className="tnum">
                  Soru {qi + 1} / {N}
                </span>
              </div>
              <div className="mt-2 h-1.5 bg-secondary" role="progressbar" aria-valuemin={0} aria-valuemax={N} aria-valuenow={answeredCount}>
                <div className="h-full bg-mint transition-[width] duration-300" style={{ width: `${(answeredCount / N) * 100}%` }} />
              </div>
              <p className="mt-5 font-display text-[18px] font-semibold leading-snug sm:text-[20px]" aria-live="polite">
                {q.q}
              </p>
              <div className="mt-4 grid gap-2.5">
                {q.a.map((opt, oi) => (
                  <button
                    key={oi}
                    type="button"
                    onClick={() => choose(oi)}
                    aria-pressed={choices[qi] === oi}
                    className={`chamfer-sm min-h-[52px] border px-4 py-3 text-left text-[15px] leading-snug transition-colors ${
                      choices[qi] === oi
                        ? "border-mint bg-mint-soft font-semibold"
                        : "border-border active:bg-secondary md:hover:border-foreground/40"
                    } ${opt.p === null ? "italic text-muted-foreground" : ""}`}
                  >
                    {opt.t}
                  </button>
                ))}
              </div>
              <div className="mt-5 flex items-center justify-between">
                <button
                  type="button"
                  disabled={qi === 0}
                  onClick={() => setQi((i) => Math.max(0, i - 1))}
                  className="inline-flex min-h-[44px] items-center gap-1.5 text-[14px] font-medium text-muted-foreground disabled:opacity-30"
                >
                  <ArrowLeft className="h-4 w-4" /> Önceki
                </button>
                {answeredAll ? (
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(false);
                      window.setTimeout(() => scrollToId("neden"), 60);
                    }}
                    className="inline-flex min-h-[44px] items-center gap-1.5 text-[14px] font-semibold text-mint"
                  >
                    Sonucu gör <ArrowRight className="h-4 w-4" />
                  </button>
                ) : (
                  choices[qi] !== null &&
                  qi < N - 1 && (
                    <button
                      type="button"
                      onClick={() => setQi((i) => Math.min(N - 1, i + 1))}
                      className="inline-flex min-h-[44px] items-center gap-1.5 text-[14px] font-medium text-muted-foreground"
                    >
                      Sonraki <ArrowRight className="h-4 w-4" />
                    </button>
                  )
                )}
              </div>
            </div>
          ) : (
            <div className="chamfer mt-8 flex flex-wrap items-center justify-between gap-3 border border-mint bg-mint-soft p-5">
              <p className="text-[14.5px]">
                <strong className="font-display text-2xl tnum">{sonuc.endeks}</strong>
                <span className="text-muted-foreground">/100 · {endeksBand(sonuc.endeks).label}</span>
              </p>
              <button
                type="button"
                onClick={() => {
                  setQi(0);
                  setEditing(true);
                }}
                className="inline-flex min-h-[44px] items-center gap-1.5 text-[14px] font-medium text-muted-foreground hover:text-foreground"
              >
                <RotateCcw className="h-4 w-4" /> Cevapları değiştir
              </button>
            </div>
          )}
        </div>
      </section>

      {/* 3 · NEDEN? */}
      <section id="neden" className="border-b border-border bg-secondary/40">
        <div className="mx-auto max-w-2xl px-5 py-12 md:py-20">
          <StepLabel n={3} />
          {sonuc ? (
            <>
              <h2 className="font-display text-[26px] font-bold leading-tight tracking-tight md:text-4xl">
                Ofis Düzen Endeksiniz {sonuc.endeks}/100 —{" "}
                <span className="whitespace-nowrap">{endeksBand(sonuc.endeks).label.toLocaleLowerCase("tr")}.</span>
              </h2>
              <div className="mt-6 space-y-3">
                {sonuc.alanlar.map((a) => {
                  const b = endeksBand(a.puan);
                  const weak = a.key === sonuc.zayif.key;
                  return (
                    <div key={a.key}>
                      <div className="flex items-baseline justify-between text-[14px]">
                        <span className={weak ? "font-semibold" : ""}>
                          {a.label}
                          {weak && <span className="ml-2 text-[11px] font-semibold text-destructive">EN ZAYIF</span>}
                        </span>
                        <span className="tnum text-muted-foreground">{a.puan}</span>
                      </div>
                      <div className="mt-1 h-2.5 bg-background">
                        <div className={`h-full ${BAND_CLS[b.tone]}`} style={{ width: `${Math.max(a.puan, 3)}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>

              {AREA_WHY[sonuc.zayif.key] && (
                <div className="chamfer mt-8 border border-border bg-card p-5 sm:p-7">
                  <p className="label-caps !text-mint">{sonuc.zayif.label} — neden zorlanıyorsunuz?</p>
                  <dl className="mt-4 space-y-4 text-[15px] leading-relaxed">
                    <div>
                      <dt className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">Gördüğünüz</dt>
                      <dd className="mt-1">{AREA_WHY[sonuc.zayif.key].belirti}</dd>
                    </div>
                    <div>
                      <dt className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">Asıl neden</dt>
                      <dd className="mt-1 font-medium">{AREA_WHY[sonuc.zayif.key].neden}</dd>
                    </div>
                  </dl>
                  <p className="mt-5 border-t border-border pt-4 text-[14px] leading-relaxed text-muted-foreground">
                    Sorun ekibin yeteneği değil; işin oturduğu düzen. Düzen kurulabilir bir şeydir.
                  </p>
                </div>
              )}
            </>
          ) : (
            <>
              <h2 className="font-display text-[26px] font-bold leading-tight tracking-tight md:text-4xl">
                Sorun çoğu zaman yetenek değil. Düzen.
              </h2>
              <p className="mt-3 text-[14.5px] leading-relaxed text-muted-foreground">
                Ofisler iyi mimar yetiştirir; ofisi taşıyacak düzen ise çoğu zaman hiç kurulmaz. Testi çözerseniz burada
                kendi en zayıf alanınızı ve nedenini görürsünüz. O zamana kadar, en sık gördüklerimiz:
              </p>
              <div className="mt-6 space-y-2.5">
                {ENDEKS_AREAS.map((a) => (
                  <details
                    key={a.key}
                    className="group chamfer-sm border border-border bg-card [&_summary::-webkit-details-marker]:hidden"
                  >
                    <summary className="flex min-h-[52px] cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-[15px] font-semibold">
                      {a.label}
                      <ChevronDown className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
                    </summary>
                    <div className="space-y-2 border-t border-border px-4 pb-4 pt-3 text-[14px] leading-relaxed">
                      <p>
                        <span className="font-semibold">Gördüğünüz: </span>
                        {AREA_WHY[a.key]?.belirti}
                      </p>
                      <p className="text-muted-foreground">
                        <span className="font-semibold text-foreground">Asıl neden: </span>
                        {AREA_WHY[a.key]?.neden}
                      </p>
                    </div>
                  </details>
                ))}
              </div>
              <ChamferButton className="mt-6 w-full sm:w-auto" onClick={() => scrollToId("endeks")}>
                Kendi ofisimi ölç <ArrowRight className="h-4 w-4" />
              </ChamferButton>
            </>
          )}
        </div>
      </section>

      {/* 4 · NE YAPILABİLİR? */}
      <section id="paketler" className="dotgrid border-b border-border">
        <div className="mx-auto max-w-2xl px-5 py-12 md:py-20">
          <StepLabel n={4} />
          <h2 className="font-display text-[26px] font-bold leading-tight tracking-tight md:text-4xl">
            {sonuc && oneriPaket ? `Sizin için ilk adım: ${oneriPaket.name}.` : "Her alanın bir çözümü var. Hepsi aynı kapıdan başlar."}
          </h2>
          {sonuc ? (
            <p className="mt-3 text-[14.5px] leading-relaxed text-muted-foreground">{sonuc.text}</p>
          ) : (
            <p className="mt-3 text-[14.5px] leading-relaxed text-muted-foreground">
              Giriş kapısı Ofis Röntgeni: tek görüşmede ölçer, nereden başlayacağınızı yazılı söyleriz. Sonraki her basamak
              tek başına ya da birlikte alınabilir.
            </p>
          )}

          <div className="mt-8 space-y-3">
            {rontgen && <PackageRow p={rontgen} highlight="GİRİŞ KAPISI · HERKES BURADAN BAŞLAR" defaultOpen={!sonuc} onPick={pick} />}
            {oneriPaket && oneriPaket.id !== "rontgen" && (
              <PackageRow p={oneriPaket} highlight="SİZİN İÇİN İLK ADIM" defaultOpen onPick={pick} />
            )}
          </div>

          <p className="label-caps mb-3 mt-12">OFİS MERDİVENİ</p>
          <div className="space-y-3">
            {ofis
              .filter((p) => p.id !== "rontgen" && p.id !== oneriPaket?.id)
              .map((p) => (
                <PackageRow key={p.id} p={p} onPick={pick} />
              ))}
          </div>

          <p className="label-caps mb-1 mt-12">ŞANTİYE DÜZENİ VE HAIZ KURULUMU</p>
          <p className="mb-3 text-[13.5px] leading-relaxed text-muted-foreground">
            Günlük rapor, roller, termin, zimmet ve kritik malzeme — kabul ölçütleri sayıyla yazılı.
          </p>
          <div className="space-y-3">
            {platform
              .filter((p) => p.id !== oneriPaket?.id)
              .map((p) => (
                <PackageRow key={p.id} p={p} onPick={pick} />
              ))}
          </div>

          <p className="label-caps mb-1 mt-12">AI HATTI</p>
          <p className="mb-3 text-[13.5px] leading-relaxed text-muted-foreground">
            Düzen kurulduktan sonra: tekrar eden işleri yapay zekâ ve otomasyona devretmek. Her paket keşifle başlar.
          </p>
          <div className="space-y-3">
            {aiHatti
              .filter((p) => p.id !== oneriPaket?.id)
              .map((p) => (
                <PackageRow key={p.id} p={p} onPick={pick} />
              ))}
          </div>
        </div>
      </section>

      {/* 5 · NASIL, NE KADAR SÜREDE? */}
      <section id="surec" className="border-b border-border">
        <div className="mx-auto max-w-2xl px-5 py-12 md:py-20">
          <StepLabel n={5} />
          <h2 className="font-display text-[26px] font-bold leading-tight tracking-tight md:text-4xl">
            Başvurudan teslime, adım adım.
          </h2>
          <ol className="mt-8 space-y-0">
            {[
              { t: "Başvuru", s: "1 iş günü içinde dönüş", d: "Formu gönderirsiniz; görüşme gününü birlikte belirleriz." },
              {
                t: "Ofis Röntgeni",
                s: "Tek görüşme · 2 saat",
                d: "Kendi ekranınızda canlı testler: son pafta, son teklif, dünkü şantiye bilgisi, son yedek. Sonunda yazılı karne ve ilk adım.",
              },
              {
                t: "Yazılı teklif",
                s: "Görüşmeden sonra",
                d: "Kapsam, takvim ve bedel yazılı gelir. Onay vermezseniz süreç orada biter; karne sizde kalır.",
              },
              {
                t: "Uygulama",
                s: "Pakete göre 3–12 hafta",
                d: "Kurulum, taşıma, şablonlar ve ekip eğitimi. Her aşamayı referans kodunuzla Süreç Takibi sayfasından izlersiniz.",
              },
              {
                t: "Teslim ve kabul",
                s: "Yazılı ölçütle",
                d: "Neyin teslim sayılacağı ilk gün yazılıdır; birlikte kontrol eder, onayınızla kapatırız. Şantiye paketlerinde ölçüt sağlanmazsa eşlik süresi ücretsiz uzar.",
              },
            ].map((s, i, arr) => (
              <li key={s.t} className="relative flex gap-4 pb-7 last:pb-0">
                {i < arr.length - 1 && <span className="absolute left-[15px] top-9 h-[calc(100%-2.25rem)] w-px bg-border" aria-hidden />}
                <span className="chamfer-sm flex h-8 w-8 shrink-0 items-center justify-center bg-foreground font-mono text-[12px] font-bold text-primary">
                  {i + 1}
                </span>
                <div className="min-w-0 pt-0.5">
                  <p className="font-display text-[17px] font-semibold">{s.t}</p>
                  <p className="mt-0.5 inline-flex items-center gap-1.5 text-[12.5px] font-medium text-mint">
                    <Clock className="h-3.5 w-3.5" /> {s.s}
                  </p>
                  <p className="mt-1.5 text-[14px] leading-relaxed text-muted-foreground">{s.d}</p>
                </div>
              </li>
            ))}
          </ol>

          <p className="label-caps mb-3 mt-12">SIK SORULANLAR</p>
          <div className="space-y-2.5">
            {[
              {
                q: "Bedeli ne kadar?",
                a: "Ofisinizin ölçeğine ve seçtiğiniz pakete göre değişir; Ofis Röntgeni görüşmesinden sonra yazılı teklifle verilir. Yazılım lisansları ve donanım ayrıca listelenir.",
              },
              {
                q: "Yerinde mi, çevrimiçi mi?",
                a: "İkisi de olur. İstanbul'da yerinde; diğer şehirlerde çevrimiçi ya da yol giderleri ayrıca olmak üzere yerinde.",
              },
              {
                q: "Ofisimizin bilgileri ne olur?",
                a: "Görüşmede ve uygulamada gördüklerimiz gizlilik sözleşmesiyle korunur; kişisel veriler KVKK'ya uygun işlenir. Bu sayfadaki test cevapları başvuru göndermedikçe bize ulaşmaz.",
              },
              {
                q: "HAIZ yazılımını kullanmak zorunda mıyız?",
                a: "Ofis paketleri mevcut araçlarınızla da kurulur. Şantiye paketleri HAIZ üzerine kurulur; bazı paketlerde HAIZ aboneliği belirli bir süre dahildir, sonrasında devam edip etmemek size kalır.",
              },
            ].map((f) => (
              <details key={f.q} className="group chamfer-sm border border-border bg-card [&_summary::-webkit-details-marker]:hidden">
                <summary className="flex min-h-[52px] cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-[15px] font-semibold">
                  {f.q}
                  <ChevronDown className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
                </summary>
                <p className="border-t border-border px-4 pb-4 pt-3 text-[14px] leading-relaxed text-muted-foreground">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* 6 · BAŞVURU */}
      <section id="iletisim" ref={formRef} className="dotgrid">
        <div className="mx-auto max-w-2xl px-5 py-12 md:py-20">
          <StepLabel n={6} />
          <h2 className="font-display text-[26px] font-bold leading-tight tracking-tight md:text-4xl">
            İlk görüşmeyi planlayalım.
          </h2>
          <p className="mt-3 text-[14.5px] leading-relaxed text-muted-foreground">
            Masada satış yok. 1 iş günü içinde dönüş yaparız.
          </p>

          {sent ? (
            <div className="chamfer mt-8 border border-mint bg-mint-soft p-7 text-center sm:p-10">
              <Check className="mx-auto h-10 w-10 text-mint" />
              <h3 className="mt-4 font-display text-xl font-bold">Başvurunuz ulaştı.</h3>
              <p className="mt-2 text-[14.5px] leading-relaxed text-muted-foreground">
                En geç 1 iş günü içinde size dönüyoruz. Süreç başladığında e-postanıza bir referans kodu gelir; aşamaları{" "}
                <Link to="/takip" className="font-semibold text-mint hover:underline">
                  Süreç Takibi
                </Link>{" "}
                sayfasından izleyebilirsiniz.
              </p>
              <Link to={ctaTarget} className="mt-6 inline-block">
                <ChamferButton>HAIZ'ı ücretsiz dene</ChamferButton>
              </Link>
            </div>
          ) : (
            <form
              className="chamfer mt-8 space-y-4 border border-border bg-card p-5 sm:p-7"
              onSubmit={(e) => {
                e.preventDefault();
                if (!email.trim() && !phone.trim()) {
                  setContactErr("Size ulaşabilmemiz için e-posta veya telefon bırakın.");
                  return;
                }
                setContactErr("");
                submit.mutate({
                  name: formatPersonName(name),
                  companyName: formatCompanyName(companyName) || undefined,
                  email: normalizeEmail(email) || undefined,
                  phone: formatPhoneTR(phone) || undefined,
                  interest: interest || undefined,
                  message: message.trim() || undefined,
                  quizJson: sonuc
                    ? JSON.stringify({
                        endeks: sonuc.endeks,
                        zayif: sonuc.zayif.label,
                        oneri: oneriPaket?.name ?? null,
                        alanlar: Object.fromEntries(sonuc.alanlar.map((a) => [a.key, a.puan])),
                      })
                    : undefined,
                  sid: currentSid(),
                });
              }}
            >
              {sonuc ? (
                <p className="chamfer-sm bg-mint-soft px-3.5 py-2.5 text-[13.5px]">
                  Test sonucunuz başvuruya eklenecek: <strong className="tnum">{sonuc.endeks}/100</strong> · en zayıf alan{" "}
                  <strong>{sonuc.zayif.label}</strong>
                </p>
              ) : (
                <p className="text-[13.5px] text-muted-foreground">
                  Testi çözmediniz; sorun değil.{" "}
                  <button type="button" onClick={() => scrollToId("endeks")} className="font-semibold text-mint underline-offset-4 hover:underline">
                    3 dakikada çözün
                  </button>
                  , sonucunuz başvuruya eklensin.
                </p>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="f-name" className="label-caps mb-1.5 block">
                    Ad Soyad *
                  </label>
                  <input
                    id="f-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onBlur={(e) => setName(formatPersonName(e.target.value))}
                    autoComplete="name"
                    required
                    minLength={2}
                    className={inputCls}
                    placeholder="Adınız Soyadınız"
                  />
                </div>
                <div>
                  <label htmlFor="f-company" className="label-caps mb-1.5 block">
                    Ofis / Şirket
                  </label>
                  <input
                    id="f-company"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    onBlur={(e) => setCompanyName(formatCompanyName(e.target.value))}
                    autoComplete="organization"
                    className={inputCls}
                    placeholder="Ofisiniz"
                  />
                </div>
                <div>
                  <label htmlFor="f-phone" className="label-caps mb-1.5 block">
                    Telefon
                  </label>
                  <input
                    id="f-phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    onBlur={(e) => setPhone(formatPhoneTR(e.target.value))}
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    className={inputCls}
                    placeholder="05xx xxx xx xx"
                  />
                </div>
                <div>
                  <label htmlFor="f-email" className="label-caps mb-1.5 block">
                    E-posta
                  </label>
                  <input
                    id="f-email"
                    type="email"
                    inputMode="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onBlur={(e) => setEmail(normalizeEmail(e.target.value))}
                    autoComplete="email"
                    className={inputCls}
                    placeholder="ornek@ofis.com"
                  />
                </div>
              </div>
              <p className="-mt-1 text-[12.5px] text-muted-foreground">Telefon veya e-postadan en az biri yeterli.</p>
              <div>
                <label htmlFor="f-interest" className="label-caps mb-1.5 block">
                  Neyle başlamak istersiniz?
                </label>
                <select id="f-interest" value={interest} onChange={(e) => setInterest(e.target.value)} className={inputCls}>
                  <option value="">Henüz emin değilim — birlikte karar verelim</option>
                  <optgroup label="Ofis merdiveni">
                    {ofis.map((p) => (
                      <option key={p.id} value={p.name}>
                        {p.code} — {p.name}
                        {p.comingSoon ? " (ön kayıt)" : ""}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Şantiye düzeni">
                    {platform.map((p) => (
                      <option key={p.id} value={p.name}>
                        {p.name}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="AI hattı">
                    {aiHatti.map((p) => (
                      <option key={p.id} value={p.name}>
                        {p.code} — {p.name}
                        {p.comingSoon ? " (ön kayıt)" : ""}
                      </option>
                    ))}
                  </optgroup>
                  <option value="HAIZ Restorasyon">HAIZ Restorasyon Revizyon Raporu</option>
                </select>
              </div>
              <div>
                <label htmlFor="f-msg" className="label-caps mb-1.5 block">
                  Kısaca anlatın
                </label>
                <textarea
                  id="f-msg"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={4}
                  className={inputCls}
                  placeholder="Kaç kişisiniz, en çok neyde zorlanıyorsunuz?"
                />
              </div>
              <button
                type="submit"
                disabled={submit.isPending}
                className="chamfer flex min-h-[52px] w-full items-center justify-center bg-primary px-7 py-4 font-display text-[16px] font-semibold text-primary-foreground hover-cta disabled:opacity-50"
              >
                <Send className="mr-2 h-4 w-4" />
                {submit.isPending ? "Gönderiliyor…" : "Başvurumu gönder"}
              </button>
              {(contactErr || submit.error) && (
                <p role="alert" className="text-[13.5px] text-destructive">
                  {contactErr || submit.error?.message}
                </p>
              )}
              <p className="text-[12.5px] text-muted-foreground">Bilgileriniz üçüncü kişilerle paylaşılmaz.</p>
            </form>
          )}
        </div>
      </section>

      {/* Biz kimiz */}
      <section id="hakkimizda" className="border-t border-border">
        <div className="mx-auto max-w-6xl px-5 py-12 md:py-20">
          <p className="label-caps mb-3">BİZ KİMİZ</p>
          <h2 className="max-w-2xl font-display text-[24px] font-bold leading-tight tracking-tight md:text-4xl">
            Mimar kökenli, tasarım gözlüklü bir yazılım şirketi.
          </h2>
          <p className="mt-3 max-w-2xl text-[14.5px] leading-relaxed text-muted-foreground">
            HAIZ, İstanbul'da bir mimar tarafından kuruldu. Şantiyede büyüyen, çizim masasında dijitalleşen bir ekibin
            ürünü: sahada gerçekten çalışan, ustanın da yöneticinin de sevdiği araçlar yapıyoruz.
          </p>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <div className="chamfer border border-border bg-card p-6">
              <p className="label-caps mb-3 !text-mint">VİZYON</p>
              <p className="text-[14.5px] leading-relaxed text-muted-foreground">
                Türkiye'deki her şantiyede — en küçük ekipte bile — yapay zekânın günlük iş akışının parçası olduğu bir
                inşaat sektörü. Teknoloji yalnızca büyük şirketlerin değil, herkesin hakkı.
              </p>
            </div>
            <div className="chamfer border border-border bg-card p-6">
              <p className="label-caps mb-3 !text-mint">MİSYON</p>
              <p className="text-[14.5px] leading-relaxed text-muted-foreground">
                Karmaşıklığı basitleştirmek: usta telefona konuşsun, rapor kendiliğinden yazılsın; restorasyon projesinde
                revizyon kaçmasın; mimarlık ofisleri düzenini uzman olmadan kursun.
              </p>
            </div>
          </div>
        </div>
      </section>

      <SiteFooter />

      {/* Mobil alt eylem çubuğu — bağlama göre */}
      <div
        className={`fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 backdrop-blur transition-transform duration-200 md:hidden ${
          showBar ? "translate-y-0" : "pointer-events-none translate-y-full"
        }`}
        inert={!showBar}
      >
        {sonuc ? (
          <ChamferButton className="w-full" onClick={applyWithResult}>
            Ofis Röntgeni için başvur <ArrowRight className="h-4 w-4" />
          </ChamferButton>
        ) : (
          <ChamferButton className="w-full" onClick={() => scrollToId("endeks")}>
            {answeredCount > 0 ? `Teste devam et · ${answeredCount}/${N}` : "Ofisimin durumunu ölç · 3 dk"}{" "}
            <ArrowRight className="h-4 w-4" />
          </ChamferButton>
        )}
      </div>
    </div>
  );
}
