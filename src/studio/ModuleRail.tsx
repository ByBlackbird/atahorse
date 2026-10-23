import { useState } from 'react';
import { LuCheck, LuLock, LuCircleDot, LuCircle, LuBookMarked, LuLink, LuFlaskConical, LuAward } from 'react-icons/lu';
import { Link } from '../lib/router';
import { useI18n } from '../i18n/index';
import { Bar, cx } from '../ui/kit';
import { PROFILES } from '../../shared/engine/profiles';
import { METHODS } from '../../shared/engine/methods';
import type { MethodKey, ProfileKey } from '../../shared/types';
import type { View } from './types';
import WhyModal from './WhyModal';

export default function ModuleRail({ view, current, onSelect }: { view: View; current: number; onSelect: (i: number) => void }) {
  const { t, lang } = useI18n();
  const [why, setWhy] = useState(false);
  const [extra, setExtra] = useState<'sources' | 'glossary' | null>(null);
  const prof = PROFILES[view.course.profileKey as ProfileKey];
  const method = METHODS[view.course.method as MethodKey];
  return (
    <div className="space-y-5">
      <div>
        <p className="eyebrow mb-2">{t('s_modules')}</p>
        <ol className="space-y-1">
          {view.doc.modules.map((m, i) => {
            const p = view.progress[i];
            const icon = p.completed ? <LuCheck className="text-ok" /> : !p.unlocked ? <LuLock className="text-ink-3" /> : i === current ? <LuCircleDot className="text-brand" /> : <LuCircle className="text-ink-3" />;
            return (
              <li key={i}>
                <button disabled={!p.unlocked} onClick={() => onSelect(i)} title={!p.unlocked ? t('s_locked') : undefined}
                  className={cx('flex w-full items-start gap-2.5 rounded-xl px-2.5 py-2 text-left text-sm transition-colors', i === current ? 'bg-surface ring-1 ring-line-strong' : 'hover:bg-surface-2', !p.unlocked && 'opacity-60')}>
                  <span className="mt-0.5 shrink-0">{icon}</span>
                  <span className="min-w-0">
                    <span className="block text-[11px] text-ink-3">{String(i + 1).padStart(2, '0')} · {t('s_chip_min', { n: m.minutes })}</span>
                    <span className={cx('line-clamp-2', i === current && 'font-semibold')}>{m.title.replace(`${view.doc.topic}: `, '')}</span>
                    {p.unlocked && !p.completed && (p.taskDone || p.quizPassed) && (
                      <span className="mt-1 flex gap-1">
                        <span className={cx('h-1 w-6 rounded-full', p.taskDone ? 'bg-gold' : 'bg-line')} />
                        <span className={cx('h-1 w-6 rounded-full', p.quizPassed ? 'bg-gold' : 'bg-line')} />
                      </span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>

      <div className="card p-4">
        <p className="flex items-center gap-1.5 text-sm font-semibold"><LuAward className="text-gold" /> {t('s_goals')}</p>
        <ul className="mt-3 space-y-2.5">
          {view.goals.map((g) => (
            <li key={g.key}>
              <div className="flex justify-between text-xs"><span className={cx(g.done >= g.total ? 'text-ink' : 'text-ink-2')}>{t(`goal_${g.key}`)}</span><span className="tabular-nums text-ink-3">{g.done}/{g.total}</span></div>
              <Bar value={g.done / g.total} className="mt-1" />
            </li>
          ))}
        </ul>
        {view.certificate ? (
          <Link to={`/sertifika/${view.certificate.code}`} className="btn btn-gold btn-sm mt-4 w-full">{t('s_view_cert')}</Link>
        ) : view.course.completedAt ? (
          <Link to={`/kurs/${view.course.id}/final`} className="btn btn-primary btn-sm mt-4 w-full">{t('s_go_final')}</Link>
        ) : null}
      </div>

      <div className="space-y-1.5 text-xs text-ink-3">
        {prof && <p><span className="text-ink-2">{prof.name[lang]}</span> · {method?.name[lang]}</p>}
        <p>{view.course.generator === 'ai' ? t('s_generator_ai') : t('s_generator_template')}</p>
        <div className="flex flex-wrap gap-1 pt-1">
          <button className="btn btn-ghost btn-sm !px-2" onClick={() => setWhy(true)}><LuFlaskConical /> {t('s_why')}</button>
          {view.doc.sources.length > 0 && <button className="btn btn-ghost btn-sm !px-2" onClick={() => setExtra(extra === 'sources' ? null : 'sources')}><LuLink /> {t('s_sources')}</button>}
          {view.doc.glossary.length > 0 && <button className="btn btn-ghost btn-sm !px-2" onClick={() => setExtra(extra === 'glossary' ? null : 'glossary')}><LuBookMarked /> {t('s_glossary')}</button>}
        </div>
        {extra === 'sources' && (
          <ul className="card space-y-2 p-3 text-ink-2">
            {view.doc.sources.map((s, i) => (
              <li key={i}>{s.url ? <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-brand hover:underline">{s.title}</a> : s.title}{s.note && <span className="block text-ink-3">{s.note}</span>}</li>
            ))}
          </ul>
        )}
        {extra === 'glossary' && (
          <dl className="card space-y-2 p-3">
            {view.doc.glossary.map((g) => <div key={g.term}><dt className="font-semibold text-ink">{g.term}</dt><dd className="text-ink-2">{g.def}</dd></div>)}
          </dl>
        )}
      </div>
      <WhyModal open={why} onClose={() => setWhy(false)} />
    </div>
  );
}
