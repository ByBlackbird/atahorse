import { LuArrowRight, LuBookOpen, LuHeadphones, LuPresentation, LuCheck, LuGraduationCap, LuShieldCheck, LuRepeat, LuFlame, LuAward, LuZap } from 'react-icons/lu';
import { Link } from '../lib/router';
import { useI18n } from '../i18n/index';
import { useMe } from '../ui/providers';
import { Logo } from '../ui/kit';
import { Shell, LangSelect } from '../app/Shell';
import { PRINCIPLES } from '../../shared/engine/science';
import { PROFILES } from '../../shared/engine/profiles';
import { METHODS } from '../../shared/engine/methods';
import { XP } from '../../shared/engine/gamification';

/** Marka imzası: inci zemin + noktalı ızgara + düz çizgiler + beyaz hap düğümler. */
const ART: Record<'tr' | 'en' | 'ru', string[]> = {
  tr: ['Fotosentez', 'Işık evresi', 'Calvin döngüsü', 'Klorofil', 'Glikoz', 'Karbon döngüsü', 'ATP'],
  en: ['Photosynthesis', 'Light reactions', 'Calvin cycle', 'Chlorophyll', 'Glucose', 'Carbon cycle', 'ATP'],
  ru: ['Фотосинтез', 'Световая фаза', 'Цикл Кальвина', 'Хлорофилл', 'Глюкоза', 'Цикл углерода', 'АТФ'],
};

function MindMapArt({ lang }: { lang: 'tr' | 'en' | 'ru' }) {
  const L = ART[lang];
  const nodes = [
    { x: 300, y: 190, w: 140, label: L[0], root: true },
    { x: 120, y: 90, w: 124, label: L[1] },
    { x: 480, y: 92, w: 124, label: L[2] },
    { x: 110, y: 300, w: 112, label: L[3] },
    { x: 490, y: 296, w: 108, label: L[4] },
    { x: 300, y: 350, w: 124, label: L[5] },
    { x: 60, y: 190, w: 72, label: L[6] },
  ];
  return (
    <svg viewBox="0 0 600 420" className="h-full w-full" role="img" aria-label="Mind map">
      {nodes.slice(1).map((n) => <line key={n.label} x1={300} y1={190} x2={n.x} y2={n.y} stroke="var(--c-line-strong)" strokeWidth="1.5" />)}
      <line x1={120} y1={90} x2={60} y2={190} stroke="var(--c-line-strong)" strokeWidth="1.5" />
      {nodes.map((n) => (
        <g key={n.label} transform={`translate(${n.x - n.w / 2},${n.y - 17})`}>
          <rect width={n.w} height={34} rx={17} fill={n.root ? 'var(--c-night)' : 'var(--c-surface)'} stroke={n.root ? 'var(--c-night)' : 'var(--c-line-strong)'} />
          <text x={n.w / 2} y={22} textAnchor="middle" fontSize="13" fontWeight={600} fill={n.root ? '#F5D9A0' : 'var(--c-ink)'} fontFamily="Inter, sans-serif">{n.label}</text>
        </g>
      ))}
      <circle cx={480} cy={92} r={5} fill="var(--c-gold)" transform="translate(58,-14)" />
    </svg>
  );
}

export default function Landing() {
  const { t, lang } = useI18n();
  const { me } = useMe();
  const start = me ? '/panel' : '/kayit';
  const modes = [
    { icon: <LuBookOpen />, title: t('l_mode_read'), body: t('l_mode_read_d') },
    { icon: <LuHeadphones />, title: t('l_mode_pod'), body: t('l_mode_pod_d') },
    { icon: <LuPresentation />, title: t('l_mode_slide'), body: t('l_mode_slide_d') },
  ];
  return (
    <Shell bare>
      {/* HERO */}
      <section className="border-b border-line">
        <div className="wrap grid items-center gap-10 py-14 md:grid-cols-[1.05fr_1fr] md:py-24">
          <div className="anim-rise">
            <p className="eyebrow">{t('l_eyebrow')}</p>
            <h1 className="h-display mt-4 text-4xl md:text-6xl">{t('l_title')}</h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-ink-2">{t('l_sub')}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to={start} className="btn btn-primary btn-lg">{t('l_cta')} <LuArrowRight /></Link>
              <a href="#nasil" className="btn btn-outline btn-lg">{t('l_cta2')}</a>
            </div>
            <p className="mt-4 text-sm text-ink-3">{t('l_note')}</p>
            <div className="mt-6 sm:hidden"><LangSelect compact /></div>
          </div>
          <div className="card dotgrid relative aspect-[10/7] overflow-hidden">
            <div className="absolute left-4 top-4 z-10 seg">
              <button aria-pressed="true"><LuBookOpen /> {t('s_mode_read')}</button>
              <button aria-pressed="false"><LuHeadphones /> {t('s_mode_podcast')}</button>
              <button aria-pressed="false"><LuPresentation /> {t('s_mode_slides')}</button>
            </div>
            <div className="absolute inset-0 pt-10"><MindMapArt lang={lang} /></div>
            <div className="absolute bottom-4 right-4 chip chip-gold"><LuZap /> +{XP.task} XP</div>
          </div>
        </div>
      </section>

      {/* ÜÇ KAPI */}
      <section id="nasil" className="wrap py-16 md:py-24">
        <p className="eyebrow">{t('l_modes_k')}</p>
        <h2 className="h-display mt-3 max-w-2xl text-3xl md:text-4xl">{t('l_modes_t')}</h2>
        <p className="mt-3 max-w-2xl text-ink-2">{t('l_modes_s')}</p>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {modes.map((m, i) => (
            <article key={i} className="card p-6">
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-brand-soft text-xl text-brand">{m.icon}</div>
              <h3 className="mt-5 text-lg font-semibold">{m.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-2">{m.body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* BİLİM */}
      <section className="border-y border-line bg-surface">
        <div className="wrap py-16 md:py-24">
          <div className="grid gap-10 md:grid-cols-[1fr_1.4fr]">
            <div>
              <p className="eyebrow">{t('l_sci_k')}</p>
              <h2 className="h-display mt-3 text-3xl md:text-4xl">{t('l_sci_t')}</h2>
              <p className="mt-3 text-ink-2">{t('l_sci_s')}</p>
            </div>
            <ol className="grid gap-px overflow-hidden rounded-[14px] border border-line bg-line sm:grid-cols-2">
              {PRINCIPLES.map((p, i) => (
                <li key={p.id} className="bg-surface p-5">
                  <div className="flex items-baseline gap-2">
                    <span className="font-display text-sm text-gold">{String(i + 1).padStart(2, '0')}</span>
                    <h3 className="font-semibold">{p.name[lang]}</h3>
                  </div>
                  <p className="mt-1.5 text-sm text-ink-2">{p.how[lang]}</p>
                  <p className="mt-2 text-xs italic text-ink-3">{p.evidence}</p>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* MOTOR */}
      <section className="wrap py-16 md:py-24">
        <p className="eyebrow">{t('l_engine_k')}</p>
        <h2 className="h-display mt-3 text-3xl md:text-4xl">{t('l_engine_t')}</h2>
        <p className="mt-3 max-w-3xl text-ink-2">{t('l_engine_s')}</p>
        <div className="mt-10 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <div className="grid gap-3 sm:grid-cols-2">
            {Object.values(PROFILES).map((p) => (
              <div key={p.key} className="card p-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">{p.name[lang]}</h3>
                  <span className="chip">{t(`modality_${p.modality}`)} · {t(`reasoning_${p.reasoning}`)}</span>
                </div>
                <p className="mt-1.5 text-sm text-ink-2">{p.tagline[lang]}</p>
              </div>
            ))}
          </div>
          <div className="card p-5">
            <h3 className="eyebrow">{t('n_method')}</h3>
            <ul className="mt-3 divide-y divide-line">
              {Object.values(METHODS).map((m) => (
                <li key={m.key} className="py-3">
                  <p className="font-semibold">{m.name[lang]}</p>
                  <p className="text-sm text-ink-2">{m.short[lang]}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* KANIT */}
      <section className="border-y border-line bg-surface">
        <div className="wrap grid gap-10 py-16 md:grid-cols-2 md:py-24">
          <div>
            <p className="eyebrow">{t('l_proof_k')}</p>
            <h2 className="h-display mt-3 text-3xl md:text-4xl">{t('l_proof_t')}</h2>
            <p className="mt-3 text-ink-2">{t('l_proof_s')}</p>
            <ul className="mt-6 grid grid-cols-2 gap-3">
              {[
                [<LuCheck />, t('s_task'), XP.task],
                [<LuRepeat />, t('s_quiz'), XP.quiz],
                [<LuGraduationCap />, t('s_module_done'), XP.module],
                [<LuAward />, t('s_course_done'), XP.course],
              ].map(([icon, label, n], i) => (
                <li key={i} className="card-flat flex items-center gap-3 p-3.5">
                  <span className="text-gold">{icon}</span>
                  <span className="text-sm">{label}</span>
                  <span className="ml-auto text-sm font-semibold tabular-nums text-gold-ink">+{n as number}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="card flex flex-col justify-between p-7">
            <div className="flex items-center justify-between">
              <Logo className="h-6" />
              <span className="chip"><LuShieldCheck /> QR</span>
            </div>
            <div className="py-8 text-center">
              <p className="eyebrow">{t('c_title')}</p>
              <p className="h-display mt-4 text-2xl">Ayşe Yılmaz</p>
              <p className="mt-2 text-sm text-ink-2">{t('c_body')}</p>
              <p className="mt-3 font-semibold">Fotosentez — {t('lv_beginner')}</p>
            </div>
            <div className="flex items-center justify-between border-t border-line pt-4 text-xs text-ink-3">
              <span>{t('c_code')}: ATA-2026-········</span>
              <span className="inline-flex items-center gap-1"><LuFlame className="text-gold" /> 7</span>
            </div>
          </div>
        </div>
      </section>

      {/* MEB + DÜRÜST NOT */}
      <section className="wrap grid gap-4 py-16 md:grid-cols-2 md:py-20">
        <div className="card p-6">
          <LuGraduationCap className="text-2xl text-brand" />
          <h3 className="mt-4 text-xl font-semibold">{t('l_meb_t')}</h3>
          <p className="mt-2 text-ink-2">{t('l_meb_s')}</p>
        </div>
        <div className="card-flat p-6">
          <p className="eyebrow">{t('s_why')}</p>
          <p className="mt-3 leading-relaxed text-ink-2">{t('l_honest')}</p>
        </div>
      </section>

      {/* KAPANIŞ — koyu bant (Gece Ormanı + amber wordmark) */}
      <section className="bg-night text-[#EEF0EE]">
        <div className="wrap flex flex-col items-center py-20 text-center">
          <Logo variant="dark" className="h-9" />
          <p className="h-display mt-8 max-w-2xl text-2xl md:text-3xl">{t('l_close')}</p>
          <Link to={start} className="btn btn-gold btn-lg mt-8">{t('l_cta')} <LuArrowRight /></Link>
        </div>
      </section>
      <footer className="border-t border-line">
        <div className="wrap flex flex-wrap items-center justify-between gap-3 py-6 text-sm text-ink-3">
          <span>© {new Date().getFullYear()} {t('l_footer')}</span>
          <div className="flex gap-4">
            <Link to="/dogrula" className="hover:text-ink">{t('nav_verify')}</Link>
            <Link to="/giris" className="hover:text-ink">{t('nav_login')}</Link>
          </div>
        </div>
      </footer>
    </Shell>
  );
}
