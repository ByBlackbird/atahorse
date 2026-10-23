import { useEffect, useMemo, useState } from 'react';
import { LuArrowRight, LuCheck, LuGraduationCap, LuPencilLine, LuInfo } from 'react-icons/lu';
import { Link, useNavigate } from '../lib/router';
import { trpc, errCode } from '../lib/trpc';
import { useErr, useI18n } from '../i18n/index';
import { Shell } from '../app/Shell';
import { Bar, ErrorBox, Field, Spinner, cx } from '../ui/kit';
import { LOCALES, METHOD_KEYS, type Level, type Locale, type MethodKey } from '../../shared/types';
import { METHODS } from '../../shared/engine/methods';
import type { MebGrade } from '../../shared/engine/meb';

const STAGES = ['queued', 'profile', 'outline', 'writing', 'saving', 'done'] as const;

function Progress({ jobId, onDone }: { jobId: string; onDone: (courseId: number) => void }) {
  const { t } = useI18n();
  const job = trpc.course.job.useQuery({ jobId }, { refetchInterval: (q) => (q.state.data && ['done', 'failed'].includes(q.state.data.stage) ? false : 1200) });
  const j = job.data;
  useEffect(() => { if (j?.stage === 'done') { const id = window.setTimeout(() => onDone(j.courseId), 600); return () => window.clearTimeout(id); } }, [j, onDone]);
  const idx = j ? STAGES.indexOf(j.stage as (typeof STAGES)[number]) : 0;
  return (
    <div className="card anim-rise mx-auto max-w-lg p-8">
      <h2 className="h-display text-2xl">{t('g_title')}</h2>
      <div className="mt-6 flex items-baseline justify-between">
        <span className="text-sm text-ink-2">{j?.stage === 'failed' ? t('g_failed') : t(`g_${j?.stage ?? 'queued'}`)}</span>
        <span className="text-2xl font-semibold tabular-nums">{j?.percent ?? 2}%</span>
      </div>
      <Bar value={(j?.percent ?? 2) / 100} className="mt-3 !h-2" />
      <ol className="mt-6 space-y-2.5">
        {STAGES.slice(1).map((s, i) => {
          const state = j?.stage === 'failed' ? 'idle' : i + 1 < idx ? 'done' : i + 1 === idx ? 'now' : 'idle';
          return (
            <li key={s} className={cx('flex items-center gap-3 text-sm', state === 'idle' && 'text-ink-3')}>
              <span className={cx('grid h-5 w-5 place-items-center rounded-full border', state === 'done' ? 'border-ok bg-ok text-white' : state === 'now' ? 'border-gold' : 'border-line-strong')}>
                {state === 'done' ? <LuCheck className="h-3 w-3" /> : state === 'now' ? <span className="anim-pulse h-2 w-2 rounded-full bg-gold" /> : null}
              </span>
              {t(`g_${s}`)}
            </li>
          );
        })}
      </ol>
      {j?.stage === 'failed' && <ErrorBox className="mt-5">{t('g_failed')}</ErrorBox>}
    </div>
  );
}

export default function CourseNew() {
  const { t, lang } = useI18n();
  const err = useErr();
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const engine = trpc.catalog.engine.useQuery();
  const meb = trpc.catalog.meb.useQuery();
  const dash = trpc.profile.dashboard.useQuery();
  const { data: me } = trpc.auth.me.useQuery();
  const [tab, setTab] = useState<'free' | 'meb'>('free');
  const [topic, setTopic] = useState('');
  const [level, setLevel] = useState<Level>('beginner');
  const [locale, setLocale] = useState<Locale>(lang);
  const [method, setMethod] = useState<MethodKey | ''>('');
  const [grade, setGrade] = useState<MebGrade>('9');
  const [subject, setSubject] = useState('matematik');
  const [scope, setScope] = useState<'unit' | 'all'>('unit');
  const [unit, setUnit] = useState('');
  const [jobId, setJobId] = useState<string | null>(null);

  const gradeRow = meb.data?.catalog.find((g) => g.grade === grade);
  const subj = gradeRow?.subjects.find((s) => s.key === subject);
  useEffect(() => {
    if (gradeRow && !gradeRow.subjects.find((s) => s.key === subject)?.available) setSubject(gradeRow.subjects.find((s) => s.available)?.key ?? 'matematik');
  }, [gradeRow, subject]);
  useEffect(() => { setUnit(subj?.units[0] ?? ''); }, [subj]);
  useEffect(() => { if (tab === 'meb') setLocale('tr'); }, [tab]);

  const create = trpc.course.create.useMutation({ onSuccess: (r) => setJobId(r.jobId) });
  const used = dash.data?.courses.length ?? 0;
  const left = engine.data && me?.plan !== 'premium' && me?.role !== 'admin' ? Math.max(0, engine.data.freeLimit - used) : null;

  const submit = () => {
    const m = method || undefined;
    if (tab === 'free') create.mutate({ topic: topic.trim(), level, locale, method: m });
    else create.mutate({ level, locale, method: m, meb: { grade, subject, unit: scope === 'unit' ? unit : undefined } });
  };
  const canSubmit = tab === 'free' ? topic.trim().length >= 2 : !!subj?.available && (scope === 'all' || !!unit);
  const levels = useMemo(() => (['beginner', 'intermediate', 'advanced'] as const), []);

  if (jobId) return <Shell><Progress jobId={jobId} onDone={(id) => { void utils.profile.dashboard.invalidate(); navigate(`/kurs/${id}`, { replace: true }); }} /></Shell>;

  return (
    <Shell>
      <div className="mx-auto max-w-3xl">
        <h1 className="h-display text-3xl">{t('n_title')}</h1>
        <p className="mt-1 text-ink-2">{t('n_sub')}</p>

        <div className="seg mt-6" role="tablist">
          <button role="tab" aria-pressed={tab === 'free'} onClick={() => setTab('free')}><LuPencilLine /> {t('n_tab_free')}</button>
          <button role="tab" aria-pressed={tab === 'meb'} onClick={() => setTab('meb')}><LuGraduationCap /> {t('n_tab_meb')}</button>
        </div>

        <div className="card mt-4 space-y-6 p-6">
          {tab === 'free' ? (
            <Field label={t('n_topic')}>
              <input className="input !h-12 !text-base" placeholder={t('n_topic_ph')} value={topic} maxLength={120} onChange={(e) => setTopic(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && canSubmit) submit(); }} autoFocus />
            </Field>
          ) : (
            <div className="space-y-5">
              <Field label={t('n_grade')}>
                <div className="flex flex-wrap gap-2">
                  {(meb.data?.grades ?? []).map((g) => (
                    <button key={g} className={cx('btn btn-sm', grade === g ? 'btn-primary' : 'btn-outline')} onClick={() => setGrade(g)}>{t('n_grade_n', { n: g })}</button>
                  ))}
                </div>
              </Field>
              <Field label={t('n_subject')}>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {gradeRow?.subjects.map((s) => (
                    <button key={s.key} disabled={!s.available} className={cx('rounded-xl border px-3 py-2.5 text-left text-sm transition-colors', subject === s.key ? 'border-brand bg-brand-soft font-semibold' : 'border-line bg-surface hover:border-line-strong')} onClick={() => setSubject(s.key)}>
                      {s.name}<span className="block text-xs font-normal text-ink-3">{s.units.length ? `${s.units.length} ${t('n_unit').toLowerCase()}` : '—'}</span>
                    </button>
                  ))}
                </div>
              </Field>
              <Field label={t('n_scope')}>
                <div className="seg">
                  <button aria-pressed={scope === 'unit'} onClick={() => setScope('unit')}>{t('n_scope_unit')}</button>
                  <button aria-pressed={scope === 'all'} onClick={() => setScope('all')}>{t('n_scope_all')}</button>
                </div>
              </Field>
              {scope === 'unit' && (
                <Field label={t('n_unit')}>
                  <select className="input" value={unit} onChange={(e) => setUnit(e.target.value)}>
                    {subj?.units.map((u) => <option key={u} value={u}>{u}</option>)}
                  </select>
                </Field>
              )}
              <p className="flex gap-2 text-xs text-ink-3"><LuInfo className="mt-0.5 shrink-0" />{t('n_meb_note')}</p>
            </div>
          )}

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label={t('n_level')}>
              <div className="seg w-full">
                {levels.map((l) => <button key={l} className="flex-1 justify-center" aria-pressed={level === l} onClick={() => setLevel(l)}>{t(`lv_${l}`)}</button>)}
              </div>
            </Field>
            <Field label={t('n_lang')}>
              <div className="seg w-full">
                {LOCALES.map((l) => <button key={l} className="flex-1 justify-center uppercase" aria-pressed={locale === l} disabled={tab === 'meb' && l !== 'tr'} onClick={() => setLocale(l)}>{l}</button>)}
              </div>
            </Field>
          </div>

          <Field label={t('n_method')}>
            <select className="input" value={method} onChange={(e) => setMethod(e.target.value as MethodKey | '')}>
              <option value="">{t('n_method_auto')}</option>
              {METHOD_KEYS.map((k) => <option key={k} value={k}>{METHODS[k].name[lang]} — {METHODS[k].short[lang]}</option>)}
            </select>
          </Field>

          {engine.data && !engine.data.ai.enabled && <p className="flex gap-2 rounded-xl bg-surface-2 p-3 text-xs text-ink-2"><LuInfo className="mt-0.5 shrink-0" />{t('n_ai_off')}</p>}
          {create.error && (
            <ErrorBox>
              {err(errCode(create.error))} {errCode(create.error) === 'limit_reached' && <Link to="/premium" className="ml-1 font-semibold underline">{t('pr_upgrade')}</Link>}
            </ErrorBox>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
            <span className="text-sm text-ink-3">{left !== null ? t('n_free_left', { n: left }) : ''}</span>
            <button className="btn btn-primary btn-lg" disabled={!canSubmit || create.isPending} onClick={submit}>
              {create.isPending ? <Spinner className="h-4 w-4" /> : <>{t('n_create')} <LuArrowRight /></>}
            </button>
          </div>
        </div>
      </div>
    </Shell>
  );
}
