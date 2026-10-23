import { LuArrowRight, LuClock, LuSigma, LuSparkle } from 'react-icons/lu';
import { Link } from '../lib/router';
import { trpc } from '../lib/trpc';
import { useI18n } from '../i18n/index';
import { Shell } from '../app/Shell';
import { ErrorBox, PageLoader } from '../ui/kit';

export default function Shared({ slug }: { slug: string }) {
  const { t } = useI18n();
  const q = trpc.pub.shared.useQuery({ slug }, { retry: false });
  if (q.error) return <Shell><ErrorBox>{t('not_found')}</ErrorBox></Shell>;
  if (!q.data) return <Shell><PageLoader /></Shell>;
  const d = q.data;
  return (
    <Shell>
      <div className="mx-auto max-w-3xl">
        <p className="eyebrow">{t('sh_eyebrow')}</p>
        <h1 className="h-display mt-3 text-3xl md:text-4xl">{d.title}</h1>
        <p className="mt-3 text-lg text-ink-2">{d.subtitle}</p>
        <ul className="mt-6 grid gap-2 sm:grid-cols-2">{d.objectives.map((o, i) => <li key={i} className="card-flat p-3 text-sm">{o}</li>)}</ul>
        <ol className="card mt-6 divide-y divide-line">
          {d.modules.map((m, i) => (
            <li key={i} className="flex items-start gap-3 p-4">
              <span className="font-display text-gold">{String(i + 1).padStart(2, '0')}</span>
              <div className="flex-1"><p className="font-semibold">{m.title}</p><p className="text-sm text-ink-2">{m.summary}</p></div>
              <span className="chip"><LuClock /> {t('s_chip_min', { n: m.minutes })}</span>
            </li>
          ))}
        </ol>
        <h2 className="mt-10 text-lg font-semibold">{t('sh_preview')}: {d.preview.title}</h2>
        {d.preview.sections.slice(0, 1).map((s) => (
          <section key={s.heading} className="mt-4">
            <h3 className="h-display text-2xl">{s.heading}</h3>
            <div className="prose-learn mt-3">{s.paragraphs.map((p, i) => <p key={i}>{p}</p>)}</div>
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <div className="card p-5"><p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-brand"><LuSigma /> {s.analytic.title}</p><ul className="mt-2 space-y-1.5 text-sm">{s.analytic.points.map((p, i) => <li key={i}>• {p}</li>)}</ul></div>
              <div className="rounded-[14px] border border-gold/40 bg-gold-soft p-5"><p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-gold-ink"><LuSparkle /> {s.holistic.title}</p><p className="mt-2 text-sm">{s.holistic.text}</p></div>
            </div>
          </section>
        ))}
        <div className="card mt-10 flex flex-wrap items-center justify-between gap-4 bg-night p-6 text-[#EEF0EE]">
          <p className="h-display text-xl">{t('sh_cta')}</p>
          <Link to="/kayit" className="btn btn-gold">{t('l_cta')} <LuArrowRight /></Link>
        </div>
      </div>
    </Shell>
  );
}
