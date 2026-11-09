// Açılış sayfası — HIG "ikna" modu: tek ana eylem, ürünün kendisiyle kanıt, dürüst içerik.
// Sahte kullanıcı sayısı / yorum yok: kanıt = çalışan örnek ders + gerçek bekleme listesi.
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import {
  LuArrowRight, LuBookOpen, LuHeadphones, LuPresentation, LuCheck, LuX, LuShieldCheck, LuSparkles,
  LuNetwork, LuChevronDown, LuPlay, LuPause, LuRepeat, LuCircleCheck, LuQuote,
  LuSearch, LuFlame, LuTarget, LuRoute, LuLeaf, LuCode, LuLandmark, LuCoins, LuBrain, LuMusic,
} from 'react-icons/lu';
import { useNavigate } from '../lib/router';
import { Link } from '../lib/router';
import { getRef } from '../lib/ref';
import { trpc, errCode } from '../lib/trpc';
import { useI18n } from '../i18n/index';
import { useMe } from '../ui/providers';
import { ErrorBox, Logo, Spinner, cx } from '../ui/kit';
import { Shell, LangSelect } from '../app/Shell';
import { PRINCIPLES } from '../../shared/engine/science';
import { LessonRow } from '../ui/learn';

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
function Section({ id, eyebrow, title, sub, children, center }: { id?: string; eyebrow: string; title: string; sub?: string; children: ReactNode; center?: boolean }) {
  return (
    <section id={id}>
      <div className="wrap py-16 md:py-24">
        <div className={cx(center && 'mx-auto max-w-2xl text-center')}>
          <p className="eyebrow !text-brand">{eyebrow}</p>
          <h2 className={cx('h-display t-title mt-3', !center && 'max-w-3xl')}>{title}</h2>
          {center && <span className="mx-auto mt-4 block h-1 w-16 rounded-full bg-brand" aria-hidden />}
          {sub && <p className={cx('t-callout mt-4 text-ink-2', !center && 'max-w-2xl')}>{sub}</p>}
        </div>
        <div className="mt-10 md:mt-12">{children}</div>
      </div>
    </section>
  );
}

/** Konu arama kutusu (Nuton): yazılan konu saklanır, kayıttan sonra kurs oluşturmada hazır gelir. */
function TopicSearch({ big }: { big?: boolean }) {
  const { t } = useI18n();
  const { me } = useMe();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const go = (topic: string) => {
    const v = topic.trim();
    if (v) { try { localStorage.setItem('ah-topic', v.slice(0, 120)); } catch { /* gizli pencere */ } }
    navigate(me ? `/kurs-olustur${v ? `?konu=${encodeURIComponent(v)}` : ''}` : '/kayit');
  };
  const chips = [1, 2, 3, 4, 5].map((n) => t(`v5_topic_${n}`));
  return (
    <div>
      <form onSubmit={(e) => { e.preventDefault(); go(q); }} className={cx('glass flex items-center gap-2 p-2', big ? 'max-w-xl' : '')} role="search">
        <LuSearch className="ml-3 shrink-0 text-xl text-ink-3" aria-hidden />
        <label htmlFor="topic-q" className="sr-only">{t('v5_search_label')}</label>
        <input id="topic-q" className="min-w-0 flex-1 bg-transparent px-1 py-2.5 text-[16px] outline-none placeholder:text-ink-3" placeholder={t('v5_search_ph')} value={q} onChange={(e) => setQ(e.target.value)} maxLength={120} />
        <button type="submit" className="btn btn-pink shrink-0">{t('v5_search_go')} <LuArrowRight /></button>
      </form>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-ink-3">{t('v5_try')}</span>
        {chips.map((c) => <button key={c} type="button" onClick={() => go(c)} className="chip !min-h-8 cursor-pointer transition-colors duration-200 hover:!border-brand hover:!text-brand">{c}</button>)}
      </div>
    </div>
  );
}

/** Hero sağ tarafı: ürünün kendisinden parçalar (cam kartlar) — gerçek ekran öğeleri, sahte metrik yok. */
function HeroCollage() {
  const { t } = useI18n();
  return (
    <div className="relative mx-auto w-full max-w-xl lg:mx-0">
      <DemoCard />
      <div className="glass anim-rise absolute -left-10 -top-24 hidden w-56 p-4 md:block" style={{ animationDelay: '200ms' }} aria-hidden>
        <p className="flex items-center gap-2 text-sm font-bold"><LuFlame className="text-gold" /> {t('v5_card_streak')}</p>
        <div className="mt-3 flex gap-1.5">{[1, 1, 1, 1, 0, 0, 0].map((on, i) => <span key={i} className={cx('h-6 w-6 rounded-full', on ? 'bg-gold' : 'bg-surface-3')} />)}</div>
      </div>
      <div className="glass anim-rise absolute -bottom-8 -right-4 hidden w-60 p-4 md:block" style={{ animationDelay: '320ms' }} aria-hidden>
        <p className="flex items-center gap-2 text-sm font-bold"><LuTarget className="text-brand" /> {t('v4_goal')}</p>
        <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-surface-3"><div className="h-full w-2/3 rounded-full bg-brand" /></div>
        <p className="mt-2 text-xs font-semibold text-ink-3">20 / 30 XP</p>
      </div>
    </div>
  );
}

const SAMPLE_ICONS = [LuLeaf, LuCode, LuLandmark, LuCoins, LuBrain, LuMusic];

export default function Landing() {
  const { t, lang } = useI18n();
  const { me } = useMe();
  const start = me ? '/panel' : '/kayit';
  const features = [
    { icon: <LuSparkles />, title: t('v5_f1_t'), body: t('v5_f1_d') },
    { icon: <LuRoute />, title: t('v5_f2_t'), body: t('v5_f2_d') },
    { icon: <LuPresentation />, title: t('v5_f3_t'), body: t('v5_f3_d') },
    { icon: <LuRepeat />, title: t('v5_f4_t'), body: t('v5_f4_d') },
    { icon: <LuFlame />, title: t('v5_f5_t'), body: t('v5_f5_d') },
    { icon: <LuShieldCheck />, title: t('v5_f6_t'), body: t('v5_f6_d') },
  ];
  const steps = [1, 2, 3].map((n) => ({ n, title: t(`l_how${n}_t`), body: t(`l_how${n}_d`) }));
  const modes = [
    { icon: <LuBookOpen />, title: t('l_mode_read'), body: t('l_mode_read_d') },
    { icon: <LuHeadphones />, title: t('l_mode_pod'), body: t('l_mode_pod_d') },
    { icon: <LuPresentation />, title: t('s_mode_slides'), body: t('v5_mode_visual_d') },
    { icon: <LuNetwork />, title: t('l_feat_map_t'), body: t('l_feat_map_d') },
  ];
  const samples = [1, 2, 3, 4, 5, 6].map((n) => ({ n, title: t(`v5_s${n}_t`), units: t(`v5_s${n}_u`) }));
  const faqs = [1, 2, 3, 4, 5].map((n) => ({ q: t(`l_faq${n}_q`), a: t(`l_faq${n}_a`) }));
  const headerNav = (
    <>
      <a href="#ozellikler" className="btn btn-ghost btn-sm">{t('v5_nav_features')}</a>
      <a href="#nasil" className="btn btn-ghost btn-sm">{t('nav_how')}</a>
      <a href="#bilim" className="btn btn-ghost btn-sm">{t('nav_science')}</a>
      <a href="#fiyat" className="btn btn-ghost btn-sm">{t('v5_nav_pricing')}</a>
    </>
  );

  return (
    <Shell bare headerNav={headerNav}>
      {/* HERO — aurora zemin, büyük başlık, konu arama, ürün parçaları */}
      <section>
        <div className="wrap grid items-center gap-14 pb-20 pt-12 md:pt-16 lg:grid-cols-[1.05fr_1fr] lg:pb-28 lg:pt-20">
          <div className="anim-rise">
            <span className="chip chip-pink !min-h-8 !px-3"><span className="h-2 w-2 rounded-full bg-pink" aria-hidden /> {t('v5_badge')}</span>
            <h1 className="h-display mt-5 text-[clamp(2.75rem,6.4vw,5rem)]">{t('v5_title_a')} <span className="text-brand">{t('v5_title_b')}</span></h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink-2">{t('v5_sub')}</p>
            <div className="mt-8"><TopicSearch big /></div>
            <p className="t-footnote mt-5 flex items-center gap-2 text-ink-3"><LuCheck className="text-ok" aria-hidden /> {t('l_note')}</p>
            <div className="mt-6 sm:hidden"><LangSelect compact /></div>
          </div>
          <HeroCollage />
        </div>
      </section>

      {/* ÖZELLİKLER (Luma) — yuvarlak simgeli 3×2 ızgara */}
      <section id="ozellikler" className="border-y border-line bg-surface">
        <div className="wrap py-16 md:py-24">
          <div className="mx-auto max-w-2xl text-center">
            <p className="eyebrow !text-brand">{t('v5_feat_k')}</p>
            <h2 className="h-display t-title mt-3">{t('v5_feat_t')}</h2>
            <span className="mx-auto mt-4 block h-1 w-16 rounded-full bg-brand" aria-hidden />
          </div>
          <ul className="mt-12 grid gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <li key={f.title} className="flex gap-4">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-night text-xl text-on-night">{f.icon}</span>
                <span>
                  <span className="block text-lg font-semibold">{f.title}</span>
                  <span className="mt-1 block text-[15px] leading-relaxed text-ink-2">{f.body}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* NASIL ÇALIŞIR */}
      <Section id="nasil" eyebrow={t('l_how_k')} title={t('l_how_t')}>
        <ol className="grid gap-5 md:grid-cols-3">
          {steps.map((s) => (
            <li key={s.n} className="glass p-7">
              <span className="font-display text-5xl font-bold text-brand">{String(s.n).padStart(2, '0')}</span>
              <h3 className="mt-4 text-xl font-semibold">{s.title}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-ink-2">{s.body}</p>
            </li>
          ))}
        </ol>
      </Section>

      {/* ÖRNEK KURSLAR (Luma kurs kartları) — tıklayınca o konuyla başlar */}
      <Section eyebrow={t('v5_samples_k')} title={t('v5_samples_t')} sub={t('v5_samples_s')}>
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {samples.map((c, i) => {
            const Icon = SAMPLE_ICONS[i];
            return (
              <li key={c.n} data-k={(i % 6) + 1}>
                <Link to={start} onClick={() => { try { localStorage.setItem('ah-topic', c.title); } catch { /* gizli pencere */ } }} className="card-i group block overflow-hidden">
                  <div className="bg-k grid h-36 place-items-center">
                    <span className="grid h-16 w-16 place-items-center rounded-2xl bg-surface/20 text-3xl transition-transform duration-200 group-hover:scale-110"><Icon aria-hidden /></span>
                  </div>
                  <div className="p-5">
                    <h3 className="text-lg font-semibold leading-snug">{c.title}</h3>
                    <p className="mt-1 text-sm text-ink-3">{c.units}</p>
                    <p className="mt-4 flex items-center justify-between border-t border-line pt-3 text-sm font-semibold text-brand">{t('v5_samples_go')} <LuArrowRight className="transition-transform duration-200 group-hover:translate-x-1" /></p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      </Section>

      {/* DÖRT KAPI + KURS YOLU — ürünün içi */}
      <section className="border-y border-line bg-surface">
        <div className="wrap grid items-center gap-12 py-16 md:py-24 lg:grid-cols-2">
          <div>
            <p className="eyebrow !text-brand">{t('l_feat_k')}</p>
            <h2 className="h-display t-title mt-3">{t('v5_modes_t')}</h2>
            <p className="t-callout mt-4 text-ink-2">{t('l_modes_s')}</p>
            <ul className="mt-8 grid gap-4 sm:grid-cols-2">
              {modes.map((m) => (
                <li key={m.title} className="flex gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-lg text-brand">{m.icon}</span>
                  <span><span className="block font-semibold">{m.title}</span><span className="block text-sm text-ink-2">{m.body}</span></span>
                </li>
              ))}
            </ul>
          </div>
          {/* Kurs içeriği önizlemesi (gerçek LessonRow bileşeni) */}
          <div className="glass relative overflow-hidden p-6 md:p-8" data-k="1" aria-label={t('v5_path_label')}>
            <div className="band-k rounded-2xl p-5">
              <p className="text-xs font-bold uppercase tracking-[0.14em] opacity-85">{t('v4_unit', { n: 2 })}</p>
              <p className="h-display mt-1 text-2xl">{t('v5_path_unit')}</p>
            </div>
            <ol className="lesson-list mt-5">
              {(['done', 'done', 'current', 'open', 'locked'] as const).map((st, i) => (
                <LessonRow key={i} n={i + 1} state={st} quiz={i === 4} title={t(`v5_path_l${i + 1}` as 'v5_path_l1')}
                  meta={i === 4 ? undefined : t('v5_lesson_n', { n: i + 1 })} />
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* BİLİM */}
      <Section id="bilim" eyebrow={t('l_sci_k')} title={t('l_sci_t')} sub={t('l_sci_s')}>
        <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PRINCIPLES.map((p, i) => (
            <li key={p.id} className="glass p-6">
              <span className="font-display text-3xl font-bold text-brand">{String(i + 1).padStart(2, '0')}</span>
              <h3 className="mt-3 text-lg font-semibold">{p.name[lang]}</h3>
              <p className="mt-2 text-[15px] text-ink-2">{p.how[lang]}</p>
              <p className="t-footnote mt-3 italic text-ink-3">{p.evidence}</p>
            </li>
          ))}
        </ol>
        <div className="glass mt-6 flex gap-3 p-5">
          <LuCircleCheck className="mt-0.5 shrink-0 text-lg text-brand" />
          <p className="text-[15px] leading-relaxed text-ink-2">{t('l_honest')}</p>
        </div>
      </Section>

      {/* FİYAT (Luma) — fiyat yazılmaz: henüz test edilmedi */}
      <Section id="fiyat" eyebrow={t('v5_nav_pricing')} title={t('v5_price_t')} sub={t('v5_price_s')} center>
        <div className="mx-auto grid max-w-4xl gap-5 md:grid-cols-2">
          <div className="card flex flex-col p-7">
            <p className="text-sm font-bold uppercase tracking-[0.14em] text-ink-3">{t('v5_free')}</p>
            <p className="h-display mt-3 text-4xl">{t('v5_free_price')}</p>
            <ul className="mt-6 space-y-3 text-[15px]">
              {[1, 2, 3, 4].map((n) => <li key={n} className="flex gap-2.5"><LuCheck className="mt-0.5 shrink-0 text-ok" aria-hidden />{t(`v5_free_${n}`)}</li>)}
            </ul>
            <Link to={start} className="btn btn-outline btn-lg mt-8 w-full">{t('l_cta')}</Link>
          </div>
          <div className="relative flex flex-col overflow-hidden rounded-[16px] bg-night p-7 text-on-night">
            <span className="chip chip-pink absolute right-5 top-5">{t('v5_soon')}</span>
            <p className="text-sm font-bold uppercase tracking-[0.14em] text-on-night-2">Premium</p>
            <p className="h-display mt-3 text-4xl">{t('v5_premium_price')}</p>
            <ul className="mt-6 space-y-3 text-[15px]">
              {[1, 2, 3, 4].map((n) => <li key={n} className="flex gap-2.5"><LuCheck className="mt-0.5 shrink-0 text-on-night-gold" aria-hidden />{t(`v5_prem_${n}`)}</li>)}
            </ul>
            <a href="#bekleme-listesi" className="btn btn-pink btn-lg mt-8 w-full">{t('l_wl_cta')}</a>
          </div>
        </div>
      </Section>

      {/* KURUCUDAN + BEKLEME LİSTESİ */}
      <section id="bekleme-listesi" className="border-y border-line bg-surface">
        <div className="wrap grid gap-12 py-16 md:py-24 lg:grid-cols-2 lg:gap-16">
          <div className="flex flex-col">
            <p className="eyebrow !text-brand">{t('l_fd_k')}</p>
            <figure className="mt-5">
              <LuQuote className="text-3xl text-pink" aria-hidden />
              <blockquote className="h-display mt-4 text-2xl leading-snug md:text-3xl">{t('l_fd_q')}</blockquote>
              <figcaption className="mt-6 flex items-center gap-3">
                <img src="/assets/apple-touch-icon.png" alt="" className="h-11 w-11 rounded-full" />
                <span><span className="block font-semibold">Işıl Can</span><span className="t-footnote block text-ink-3">{t('l_fd_role')}</span></span>
              </figcaption>
            </figure>
          </div>
          <div className="glass p-6 md:p-8">
            <p className="eyebrow !text-pink">{t('l_wl_k')}</p>
            <h2 className="h-display t-title mt-3">{t('l_wl_t')}</h2>
            <p className="mt-3 text-[15px] leading-relaxed text-ink-2">{t('l_wl_s')}</p>
            <div className="mt-6"><Waitlist /></div>
          </div>
        </div>
      </section>

      {/* SSS */}
      <Section id="sss" eyebrow={t('l_faq_k')} title={t('l_faq_t')} center>
        <div className="mx-auto max-w-3xl divide-y divide-line overflow-hidden rounded-[16px] border border-line bg-surface">
          {faqs.map((f) => (
            <details key={f.q} className="disclosure group">
              <summary className="px-5 text-[17px]">{f.q}<LuChevronDown className="chev shrink-0 text-ink-3" aria-hidden /></summary>
              <p className="px-5 pb-5 text-[15px] leading-relaxed text-ink-2">{f.a}</p>
            </details>
          ))}
        </div>
      </Section>

      {/* KAPANIŞ + ALTBİLGİ (Luma lacivert) */}
      <footer className="bg-night text-on-night">
        <div className="wrap py-16 md:py-20">
          <div className="flex flex-col items-start justify-between gap-8 border-b border-on-night/15 pb-12 md:flex-row md:items-center">
            <p className="h-display max-w-xl text-3xl md:text-4xl">{t('l_close')}</p>
            <Link to={start} className="btn btn-pink btn-lg">{me ? t('nav_dashboard') : t('l_cta')} <LuArrowRight /></Link>
          </div>
          <div className="grid gap-10 pt-12 md:grid-cols-[1.4fr_1fr_1fr]">
            <div>
              <Logo variant="dark" className="h-8" />
              <p className="mt-4 max-w-sm text-sm leading-relaxed text-on-night-2">{t('v5_footer_about')}</p>
            </div>
            <nav aria-label={t('v5_footer_product')} className="flex flex-col gap-2 text-sm">
              <p className="mb-1 font-semibold">{t('v5_footer_product')}</p>
              <a href="#ozellikler" className="text-on-night-2 transition-colors hover:text-on-night">{t('v5_nav_features')}</a>
              <a href="#nasil" className="text-on-night-2 transition-colors hover:text-on-night">{t('nav_how')}</a>
              <a href="#fiyat" className="text-on-night-2 transition-colors hover:text-on-night">{t('v5_nav_pricing')}</a>
              <a href="#sss" className="text-on-night-2 transition-colors hover:text-on-night">{t('nav_faq')}</a>
            </nav>
            <nav aria-label={t('v5_footer_account')} className="flex flex-col gap-2 text-sm">
              <p className="mb-1 font-semibold">{t('v5_footer_account')}</p>
              <Link to="/kayit" className="text-on-night-2 transition-colors hover:text-on-night">{t('l_cta')}</Link>
              <Link to="/giris" className="text-on-night-2 transition-colors hover:text-on-night">{t('nav_login')}</Link>
              <Link to="/dogrula" className="text-on-night-2 transition-colors hover:text-on-night">{t('nav_verify')}</Link>
            </nav>
          </div>
          <p className="mt-12 text-xs text-on-night-2">© {new Date().getFullYear()} {t('l_footer')} · {t('l_ft_rights')}</p>
        </div>
      </footer>
    </Shell>
  );
}
