// Açılış sayfası — HIG "ikna" modu: tek ana eylem, ürünün kendisiyle kanıt, dürüst içerik.
// Sahte kullanıcı sayısı / yorum yok: kanıt = çalışan örnek ders + gerçek bekleme listesi.
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import {
  LuArrowRight, LuBookOpen, LuHeadphones, LuPresentation, LuCheck, LuX, LuGraduationCap, LuShieldCheck, LuSparkles,
  LuNetwork, LuChevronDown, LuPlay, LuPause, LuLayers, LuRepeat, LuLanguages, LuCircleCheck, LuQuote,
} from 'react-icons/lu';
import { Link } from '../lib/router';
import { getRef } from '../lib/ref';
import { trpc, errCode } from '../lib/trpc';
import { useI18n } from '../i18n/index';
import { useMe } from '../ui/providers';
import { ErrorBox, Logo, Spinner, cx } from '../ui/kit';
import { Shell, LangSelect } from '../app/Shell';
import { PRINCIPLES } from '../../shared/engine/science';
import { PROFILES } from '../../shared/engine/profiles';
import { METHODS } from '../../shared/engine/methods';
import type { Locale } from '../../shared/types';

/* ---------------- zihin haritası imzası ---------------- */
const ART: Record<Locale, string[]> = {
  tr: ['Fotosentez', 'Işık evresi', 'Calvin döngüsü', 'Klorofil', 'Glikoz', 'Karbon döngüsü', 'ATP'],
  en: ['Photosynthesis', 'Light reactions', 'Calvin cycle', 'Chlorophyll', 'Glucose', 'Carbon cycle', 'ATP'],
  ru: ['Фотосинтез', 'Световая фаза', 'Цикл Кальвина', 'Хлорофилл', 'Глюкоза', 'Цикл углерода', 'АТФ'],
};

function MindMapArt({ lang }: { lang: Locale }) {
  const L = ART[lang];
  const nodes = [
    { x: 300, y: 190, w: 140, label: L[0]!, root: true },
    { x: 130, y: 90, w: 128, label: L[1]! },
    { x: 470, y: 92, w: 128, label: L[2]! },
    { x: 120, y: 300, w: 112, label: L[3]! },
    { x: 480, y: 296, w: 108, label: L[4]! },
    { x: 300, y: 350, w: 128, label: L[5]! },
  ];
  return (
    <svg viewBox="0 0 600 420" className="h-full w-full" role="img" aria-label={L[0]}>
      {nodes.slice(1).map((n) => <line key={n.label} x1={300} y1={190} x2={n.x} y2={n.y} stroke="var(--c-line-strong)" strokeWidth="1.5" />)}
      {nodes.map((n) => (
        <g key={n.label} transform={`translate(${n.x - n.w / 2},${n.y - 17})`}>
          <rect width={n.w} height={34} rx={17} fill={n.root ? 'var(--c-brand)' : 'var(--c-surface)'} stroke={n.root ? 'var(--c-brand)' : 'var(--c-line-strong)'} />
          <text x={n.w / 2} y={22} textAnchor="middle" fontSize="13" fontWeight={600} fill={n.root ? 'var(--c-brand-ink)' : 'var(--c-ink)'} fontFamily="Inter, sans-serif">{n.label}</text>
        </g>
      ))}
    </svg>
  );
}

/* ---------------- canlı örnek ders: aynı konu, üç kapı ---------------- */
type Mode = 'read' | 'listen' | 'slides';

function ReadDemo() {
  const { t } = useI18n();
  const [pick, setPick] = useState<number | null>(null);
  const opts = [t('l_demo_o1'), t('l_demo_o2'), t('l_demo_o3')];
  const ok = pick === 0;
  return (
    <div className="flex h-full flex-col">
      <p className="t-callout text-ink">{t('l_demo_read_p')}</p>
      <div className="mt-5 rounded-xl border border-line bg-surface-2 p-4">
        <p className="text-sm font-semibold">{t('l_demo_q')}</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-3" role="group" aria-label={t('l_demo_q')}>
          {opts.map((o, i) => {
            const chosen = pick === i;
            return (
              <button key={o} type="button" onClick={() => setPick(i)} aria-pressed={chosen}
                className={cx('btn btn-sm justify-start', chosen ? (i === 0 ? '!border-ok !bg-ok-soft !text-ok' : '!border-bad !bg-bad-soft !text-bad') : 'btn-outline')}>
                {chosen ? (i === 0 ? <LuCheck /> : <LuX />) : null}{o}
              </button>
            );
          })}
        </div>
        {pick !== null && <p className={cx('anim-fade mt-3 text-sm', ok ? 'text-ok' : 'text-bad')} role="status">{t(ok ? 'l_demo_ok' : 'l_demo_no')}</p>}
      </div>
    </div>
  );
}

function ListenDemo() {
  const { t } = useI18n();
  const lines = [t('l_demo_s1'), t('l_demo_s2'), t('l_demo_s3')];
  const [i, setI] = useState(0);
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (!on) return;
    const id = window.setInterval(() => setI((x) => (x + 1) % lines.length), 2200);
    return () => window.clearInterval(id);
  }, [on, lines.length]);
  return (
    <div className="flex h-full flex-col">
      <ol className="space-y-3">
        {lines.map((l, k) => (
          <li key={k} className={cx('kw rounded-lg px-2 py-1 text-lg leading-snug', k === i ? 'kw-now font-semibold' : k < i ? 'kw-past' : 'kw-future')}>{l}</li>
        ))}
      </ol>
      <div className="mt-auto flex items-center gap-4 pt-6">
        <button type="button" className="btn btn-primary btn-icon !rounded-full" onClick={() => setOn((v) => !v)} aria-label={t(on ? 'l_demo_pause' : 'l_demo_play')}>
          {on ? <LuPause /> : <LuPlay />}
        </button>
        <div className="flex h-8 items-end gap-1" aria-hidden>
          {[0, 1, 2, 3, 4, 5, 6].map((b) => (
            <span key={b} className={cx('w-1.5 rounded-full bg-gold', on && 'eq-bar')} style={{ height: `${30 + ((b * 37) % 70)}%`, animationDelay: `${b * 0.09}s` }} />
          ))}
        </div>
        <span className="text-sm text-ink-3 tabular-nums">{i + 1} / {lines.length}</span>
      </div>
    </div>
  );
}

function SlidesDemo() {
  const { t } = useI18n();
  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-1 flex-col justify-center rounded-xl bg-night p-6 text-on-night">
        <p className="eyebrow !text-on-night-2">01 / 03</p>
        <h4 className="h-display mt-2 text-2xl">{t('l_demo_slide_t')}</h4>
        <ul className="mt-4 space-y-2.5 text-[15px]">
          {[t('l_demo_slide_b1'), t('l_demo_slide_b2'), t('l_demo_slide_b3')].map((b) => (
            <li key={b} className="flex gap-2.5"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />{b}</li>
          ))}
        </ul>
      </div>
      <div className="mt-4 flex justify-center gap-1.5" aria-hidden>
        <span className="h-1.5 w-6 rounded-full bg-brand" /><span className="h-1.5 w-1.5 rounded-full bg-line-strong" /><span className="h-1.5 w-1.5 rounded-full bg-line-strong" />
      </div>
    </div>
  );
}

function DemoCard() {
  const { t } = useI18n();
  const [mode, setMode] = useState<Mode>('read');
  const tabs: { k: Mode; icon: ReactNode; label: string }[] = [
    { k: 'read', icon: <LuBookOpen />, label: t('s_mode_read') },
    { k: 'listen', icon: <LuHeadphones />, label: t('s_mode_podcast') },
    { k: 'slides', icon: <LuPresentation />, label: t('s_mode_slides') },
  ];
  return (
    <div className="card elev-2 flex min-h-[400px] flex-col overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
        <div>
          <p className="eyebrow">{t('l_sample')}</p>
          <p className="t-headline mt-0.5">{t('l_demo_topic')}</p>
        </div>
        <div className="seg" role="tablist" aria-label={t('l_modes_k')}>
          {tabs.map((x) => (
            <button key={x.k} role="tab" id={`demo-tab-${x.k}`} aria-selected={mode === x.k} aria-controls="demo-panel" onClick={() => setMode(x.k)}>
              {x.icon}<span className="hidden sm:inline">{x.label}</span><span className="sr-only sm:hidden">{x.label}</span>
            </button>
          ))}
        </div>
      </div>
      <div id="demo-panel" role="tabpanel" aria-labelledby={`demo-tab-${mode}`} className="anim-fade flex-1 p-5 md:p-6" key={mode}>
        {mode === 'read' ? <ReadDemo /> : mode === 'listen' ? <ListenDemo /> : <SlidesDemo />}
      </div>
    </div>
  );
}

/* ---------------- bekleme listesi ---------------- */
function Waitlist() {
  const { t, lang } = useI18n();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'learner' | 'parent' | 'teacher' | 'school'>('learner');
  const [invalid, setInvalid] = useState(false);
  const join = trpc.pub.joinWaitlist.useMutation();
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const ok = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
    setInvalid(!ok);
    if (ok) join.mutate({ email: email.trim(), role, locale: lang, ref: getRef() });
  };
  if (join.isSuccess) {
    return (
      <div className="anim-pop flex items-start gap-3 rounded-2xl border border-ok/30 bg-ok-soft p-5 text-ok" role="status">
        <LuCircleCheck className="mt-0.5 shrink-0 text-xl" /><p className="font-semibold">{t('l_wl_ok')}</p>
      </div>
    );
  }
  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <div>
        <label htmlFor="wl-email" className="mb-1.5 block text-sm font-semibold">{t('l_wl_email')}</label>
        <input id="wl-email" type="email" inputMode="email" autoComplete="email" className="input" placeholder={t('l_wl_ph')}
          value={email} onChange={(e) => { setEmail(e.target.value); if (invalid) setInvalid(false); }}
          aria-invalid={invalid} aria-describedby={invalid ? 'wl-err' : 'wl-privacy'} />
        {invalid && <p id="wl-err" className="mt-1.5 text-sm text-bad">{t('l_wl_err_email')}</p>}
      </div>
      <fieldset>
        <legend className="mb-1.5 block text-sm font-semibold">{t('l_wl_role')}</legend>
        <div className="grid grid-cols-2 gap-2">
          {(['learner', 'parent', 'teacher', 'school'] as const).map((r) => (
            <button key={r} type="button" aria-pressed={role === r} onClick={() => setRole(r)}
              className={cx('btn btn-sm', role === r ? 'btn-tinted !border-brand' : 'btn-outline')}>{t(`l_wl_r_${r}`)}</button>
          ))}
        </div>
      </fieldset>
      {join.error && <ErrorBox>{errCode(join.error) === 'rate_limited' ? t('rate_limited') : t('e_generic')}</ErrorBox>}
      <button type="submit" className="btn btn-primary btn-lg w-full" disabled={join.isPending} aria-busy={join.isPending}>
        {join.isPending ? <Spinner className="h-4 w-4" /> : null}{t('l_wl_cta')}
      </button>
      <p id="wl-privacy" className="t-footnote text-ink-3">{t('l_wl_privacy')}</p>
    </form>
  );
}

/* ---------------- sayfa ---------------- */
function Section({ id, eyebrow, title, sub, children, tone }: { id?: string; eyebrow: string; title: string; sub?: string; children: ReactNode; tone?: 'surface' }) {
  return (
    <section id={id} className={cx(tone === 'surface' && 'border-y border-line bg-surface')}>
      <div className="wrap py-16 md:py-24">
        <p className="eyebrow">{eyebrow}</p>
        <h2 className="h-display t-title mt-3 max-w-3xl">{title}</h2>
        {sub && <p className="t-callout mt-4 max-w-2xl text-ink-2">{sub}</p>}
        <div className="mt-10 md:mt-12">{children}</div>
      </div>
    </section>
  );
}

export default function Landing() {
  const { t, lang } = useI18n();
  const { me } = useMe();
  const start = me ? '/panel' : '/kayit';
  const facts = [
    { icon: <LuLayers />, text: t('l_fact_modes') },
    { icon: <LuSparkles />, text: t('l_fact_engine') },
    { icon: <LuRepeat />, text: t('l_fact_fsrs') },
    { icon: <LuLanguages />, text: t('l_fact_langs') },
  ];
  const steps = [1, 2, 3].map((n) => ({ n, title: t(`l_how${n}_t`), body: t(`l_how${n}_d`) }));
  const modes = [
    { icon: <LuBookOpen />, title: t('l_mode_read'), body: t('l_mode_read_d') },
    { icon: <LuHeadphones />, title: t('l_mode_pod'), body: t('l_mode_pod_d') },
    { icon: <LuPresentation />, title: t('l_mode_slide'), body: t('l_mode_slide_d') },
  ];
  const journey = [1, 2, 3, 4].map((n) => ({ n, title: t(`l_jr${n}_t`), body: t(`l_jr${n}_d`) }));
  const faqs = [1, 2, 3, 4, 5].map((n) => ({ q: t(`l_faq${n}_q`), a: t(`l_faq${n}_a`) }));
  const headerNav = (
    <>
      <a href="#nasil" className="btn btn-ghost btn-sm">{t('nav_how')}</a>
      <a href="#bilim" className="btn btn-ghost btn-sm">{t('nav_science')}</a>
      <a href="#sss" className="btn btn-ghost btn-sm">{t('nav_faq')}</a>
    </>
  );

  return (
    <Shell bare headerNav={headerNav}>
      {/* HERO */}
      <section className="dotgrid border-b border-line">
        <div className="wrap grid items-center gap-12 py-14 md:py-20 lg:grid-cols-[1fr_1.05fr] lg:py-28">
          <div className="anim-rise">
            <p className="eyebrow">{t('l_eyebrow')}</p>
            <h1 className="h-display t-large mt-4">{t('l_title')}</h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink-2">{t('l_sub')}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to={start} className="btn btn-primary btn-lg">{me ? t('nav_dashboard') : t('l_cta')} <LuArrowRight /></Link>
              <a href="#bekleme-listesi" className="btn btn-outline btn-lg">{t('l_wl_cta')}</a>
            </div>
            <p className="t-footnote mt-4 text-ink-3">{t('l_note')}</p>
            <div className="mt-6 sm:hidden"><LangSelect compact /></div>
          </div>
          <DemoCard />
        </div>
      </section>

      {/* GERÇEK ÜRÜN GERÇEKLERİ */}
      <section className="border-b border-line bg-surface">
        <ul className="wrap grid grid-cols-2 gap-x-6 gap-y-4 py-6 md:grid-cols-4">
          {facts.map((f) => (
            <li key={f.text} className="flex items-center gap-2.5 text-sm font-semibold text-ink-2"><span className="text-lg text-gold">{f.icon}</span>{f.text}</li>
          ))}
        </ul>
      </section>

      {/* NASIL ÇALIŞIR — sıralı adımlar */}
      <Section id="nasil" eyebrow={t('l_how_k')} title={t('l_how_t')}>
        <ol className="grid gap-4 md:grid-cols-3">
          {steps.map((s) => (
            <li key={s.n} className="card p-6">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-brand text-sm font-bold text-brand-ink">{s.n}</span>
              <h3 className="t-headline mt-5">{s.title}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-ink-2">{s.body}</p>
            </li>
          ))}
        </ol>
      </Section>

      {/* İÇİNDE NE VAR — bento */}
      <Section eyebrow={t('l_feat_k')} title={t('l_feat_t')} sub={t('l_modes_s')} tone="surface">
        <div className="grid gap-4 md:grid-cols-3">
          {modes.map((m) => (
            <article key={m.title} className="card p-6">
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-brand-soft text-xl text-brand">{m.icon}</div>
              <h3 className="t-headline mt-5">{m.title}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-ink-2">{m.body}</p>
            </article>
          ))}
          <article className="card flex flex-col overflow-hidden md:col-span-2">
            <div className="flex items-start gap-3 p-6 pb-0">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-soft text-xl text-brand"><LuNetwork /></div>
              <div><h3 className="t-headline">{t('l_feat_map_t')}</h3><p className="mt-1 text-[15px] text-ink-2">{t('l_feat_map_d')}</p></div>
            </div>
            <div className="dotgrid mt-4 min-h-64 flex-1 border-t border-line"><MindMapArt lang={lang} /></div>
          </article>
          <div className="grid gap-4">
            <article className="card p-6">
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-gold-soft text-xl text-gold-ink"><LuSparkles /></div>
              <h3 className="t-headline mt-5">{t('l_feat_ai_t')}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-ink-2">{t('l_feat_ai_d')}</p>
            </article>
            <article className="card p-6">
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-brand-soft text-xl text-brand"><LuGraduationCap /></div>
              <h3 className="t-headline mt-5">{t('l_meb_t')}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-ink-2">{t('l_meb_s')}</p>
            </article>
          </div>
          <article className="card flex flex-col justify-between p-6 md:col-span-3 md:flex-row md:items-center md:gap-10">
            <div className="max-w-md">
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-gold-soft text-xl text-gold-ink"><LuShieldCheck /></div>
              <h3 className="t-headline mt-5">{t('l_feat_cert_t')}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-ink-2">{t('l_feat_cert_d')}</p>
              <p className="mt-2 text-[15px] leading-relaxed text-ink-2">{t('l_proof_s')}</p>
            </div>
            <div className="mt-6 flex-1 rounded-2xl border border-line-strong p-6 md:mt-0" aria-label={t('l_sample_cert')}>
              <div className="flex items-center justify-between"><Logo className="h-6" /><span className="chip">{t('l_sample_cert')}</span></div>
              <div className="py-6 text-center">
                <p className="eyebrow">{t('c_title')}</p>
                <p className="h-display mt-3 text-2xl text-ink-3">{t('l_sample_name')}</p>
                <p className="mt-2 text-sm font-semibold">{t('l_demo_topic')}</p>
              </div>
              <div className="flex items-center justify-between border-t border-line pt-3 text-xs text-ink-3"><span>{t('c_code')}: ATA-····</span><span className="inline-flex items-center gap-1"><LuShieldCheck /> QR</span></div>
            </div>
          </article>
        </div>
      </Section>

      {/* BİLİM */}
      <Section id="bilim" eyebrow={t('l_sci_k')} title={t('l_sci_t')} sub={t('l_sci_s')}>
        <ol className="grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
          {PRINCIPLES.map((p, i) => (
            <li key={p.id} className="bg-surface p-6">
              <div className="flex items-baseline gap-2.5">
                <span className="font-display text-sm font-semibold text-gold-ink">{String(i + 1).padStart(2, '0')}</span>
                <h3 className="t-headline">{p.name[lang]}</h3>
              </div>
              <p className="mt-2 text-[15px] text-ink-2">{p.how[lang]}</p>
              <p className="t-footnote mt-3 italic text-ink-3">{p.evidence}</p>
            </li>
          ))}
        </ol>
        <div className="mt-6 flex gap-3 rounded-2xl bg-surface-2 p-5">
          <LuCircleCheck className="mt-0.5 shrink-0 text-lg text-brand" />
          <p className="text-[15px] leading-relaxed text-ink-2">{t('l_honest')}</p>
        </div>
      </Section>

      {/* MOTOR */}
      <Section eyebrow={t('l_engine_k')} title={t('l_engine_t')} sub={t('l_engine_s')} tone="surface">
        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <div className="grid gap-3 sm:grid-cols-2">
            {Object.values(PROFILES).map((p) => (
              <div key={p.key} className="card p-5">
                <h3 className="t-headline">{p.name[lang]}</h3>
                <p className="mt-1.5 text-[15px] text-ink-2">{p.tagline[lang]}</p>
                <p className="mt-3"><span className="chip">{t(`modality_${p.modality}`)} · {t(`reasoning_${p.reasoning}`)}</span></p>
              </div>
            ))}
          </div>
          <div className="card p-6">
            <h3 className="eyebrow">{t('n_method')}</h3>
            <ul className="mt-2 divide-y divide-line">
              {Object.values(METHODS).map((m) => (
                <li key={m.key} className="py-3.5">
                  <p className="font-semibold">{m.name[lang]}</p>
                  <p className="mt-0.5 text-[15px] text-ink-2">{m.short[lang]}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Section>

      {/* YOLCULUK — zaman çizelgesi (gerçek aşamalar) */}
      <Section eyebrow={t('l_jr_k')} title={t('l_jr_t')} sub={t('l_jr_s')}>
        <ol className="relative grid gap-6 md:grid-cols-4 md:gap-4">
          <span aria-hidden className="absolute left-[19px] top-2 bottom-2 w-px bg-line-strong md:left-0 md:right-0 md:top-[19px] md:bottom-auto md:h-px md:w-auto" />
          {journey.map((j) => {
            const now = j.n === 3;
            const next = j.n === 4;
            return (
              <li key={j.n} className="relative flex gap-4 md:flex-col">
                <span className={cx('relative z-10 grid h-10 w-10 shrink-0 place-items-center rounded-full border-2 text-sm font-bold',
                  now ? 'border-brand bg-brand text-brand-ink' : next ? 'border-dashed border-line-strong bg-bg text-ink-3' : 'border-brand bg-surface text-brand')}>
                  {next ? <LuArrowRight /> : <LuCheck />}
                </span>
                <div>
                  <p className="t-headline flex flex-wrap items-center gap-2">{j.title}{now && <span className="chip chip-gold">{t('l_jr_now')}</span>}</p>
                  <p className="mt-1.5 text-[15px] leading-relaxed text-ink-2">{j.body}</p>
                </div>
              </li>
            );
          })}
        </ol>
      </Section>

      {/* KURUCUDAN + BEKLEME LİSTESİ */}
      <section id="bekleme-listesi" className="border-y border-line bg-surface">
        <div className="wrap grid gap-12 py-16 md:py-24 lg:grid-cols-2 lg:gap-16">
          <div className="flex flex-col">
            <p className="eyebrow">{t('l_fd_k')}</p>
            <figure className="mt-5">
              <LuQuote className="text-3xl text-gold" aria-hidden />
              <blockquote className="h-display mt-4 text-2xl leading-snug md:text-[1.75rem]">{t('l_fd_q')}</blockquote>
              <figcaption className="mt-6 flex items-center gap-3">
                <img src="/assets/apple-touch-icon.png" alt="" className="h-11 w-11 rounded-full" />
                <span><span className="block font-semibold">Işıl Can</span><span className="t-footnote block text-ink-3">{t('l_fd_role')}</span></span>
              </figcaption>
            </figure>
          </div>
          <div className="card elev-1 p-6 md:p-8">
            <p className="eyebrow">{t('l_wl_k')}</p>
            <h2 className="h-display t-title mt-3">{t('l_wl_t')}</h2>
            <p className="mt-3 text-[15px] leading-relaxed text-ink-2">{t('l_wl_s')}</p>
            <div className="mt-6"><Waitlist /></div>
          </div>
        </div>
      </section>

      {/* SSS — aşamalı açılım */}
      <Section id="sss" eyebrow={t('l_faq_k')} title={t('l_faq_t')}>
        <div className="max-w-3xl divide-y divide-line border-y border-line">
          {faqs.map((f) => (
            <details key={f.q} className="disclosure group">
              <summary className="px-1 text-[17px]">{f.q}<LuChevronDown className="chev shrink-0 text-ink-3" aria-hidden /></summary>
              <p className="px-1 pb-5 text-[15px] leading-relaxed text-ink-2">{f.a}</p>
            </details>
          ))}
        </div>
      </Section>

      {/* KAPANIŞ */}
      <section className="bg-night text-on-night">
        <div className="wrap flex flex-col items-center py-20 text-center md:py-24">
          <Logo variant="dark" className="h-9" />
          <p className="h-display mt-8 max-w-2xl text-2xl md:text-3xl">{t('l_close')}</p>
          <Link to={start} className="btn btn-gold btn-lg mt-8">{me ? t('nav_dashboard') : t('l_cta')} <LuArrowRight /></Link>
        </div>
      </section>
      <footer className="border-t border-line">
        <div className="wrap flex flex-col gap-4 py-8 text-sm text-ink-3 md:flex-row md:items-center md:justify-between">
          <span>© {new Date().getFullYear()} {t('l_footer')} · {t('l_ft_rights')}</span>
          <nav className="flex flex-wrap gap-x-1" aria-label="footer">
            <Link to="/dogrula" className="btn btn-ghost btn-sm">{t('nav_verify')}</Link>
            <a href="#bekleme-listesi" className="btn btn-ghost btn-sm">{t('l_wl_k')}</a>
            <Link to="/giris" className="btn btn-ghost btn-sm">{t('nav_login')}</Link>
          </nav>
        </div>
      </footer>
    </Shell>
  );
}
