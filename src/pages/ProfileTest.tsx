import { useMemo, useState } from 'react';
import { LuArrowLeft, LuArrowRight, LuBookOpen, LuHeadphones, LuPresentation, LuRotateCcw } from 'react-icons/lu';
import { Link } from '../lib/router';
import { trpc, errCode } from '../lib/trpc';
import { useErr, useI18n } from '../i18n/index';
import { Shell } from '../app/Shell';
import { Bar, ErrorBox, Spinner, cx } from '../ui/kit';
import { PROFILE_TEST, PROFILES } from '../../shared/engine/profiles';
import { METHODS } from '../../shared/engine/methods';
import type { ProfileKey } from '../../shared/types';

const MODE_ICON = { read: <LuBookOpen />, podcast: <LuHeadphones />, slides: <LuPresentation /> } as const;

export default function ProfileTest() {
  const { t, lang } = useI18n();
  const err = useErr();
  const utils = trpc.useUtils();
  const [step, setStep] = useState(-1);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const save = trpc.profile.saveTest.useMutation({ onSuccess: () => { void utils.auth.me.invalidate(); void utils.profile.invalidate(); } });
  // Eksenleri karıştırarak sor (ardışık aynı eksen yorgunluğunu azaltır)
  const qs = useMemo(() => {
    const m = PROFILE_TEST.filter((q) => q.axis === 'modality');
    const r = PROFILE_TEST.filter((q) => q.axis === 'reasoning');
    return m.flatMap((q, i) => (r[i] ? [q, r[i]] : [q]));
  }, []);

  const pick = (qid: string, v: string) => {
    const next = { ...answers, [qid]: v };
    setAnswers(next);
    if (step < qs.length - 1) window.setTimeout(() => setStep((s) => s + 1), 220);
    else save.mutate({ answers: next });
  };

  const result = save.data;
  const prof = result ? PROFILES[result.key as ProfileKey] : null;

  return (
    <Shell>
      <div className="mx-auto max-w-2xl">
        {step < 0 && (
          <div className="card anim-rise p-7 md:p-10">
            <p className="eyebrow">{t('t_eyebrow')}</p>
            <h1 className="h-display mt-3 text-3xl">{t('t_title')}</h1>
            <p className="mt-4 leading-relaxed text-ink-2">{t('t_body')}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <button className="btn btn-primary btn-lg" onClick={() => setStep(0)}>{t('t_start')} <LuArrowRight /></button>
              <Link to="/panel" className="btn btn-ghost btn-lg">{t('t_skip')}</Link>
            </div>
          </div>
        )}

        {step >= 0 && !result && (
          <div className="card p-7 md:p-10">
            <div className="flex items-center justify-between text-sm text-ink-3">
              <span>{t('t_q', { a: step + 1, b: qs.length })}</span>
              {step > 0 && <button className="btn btn-ghost btn-sm" onClick={() => setStep((s) => s - 1)}><LuArrowLeft /> {t('back')}</button>}
            </div>
            <Bar value={(step + (answers[qs[step].id] ? 1 : 0)) / qs.length} className="mt-3" />
            <h2 key={qs[step].id} className="anim-rise mt-8 text-xl font-semibold md:text-2xl">{qs[step].q[lang]}</h2>
            <div className="mt-6 grid gap-2.5">
              {qs[step].options.map((o) => (
                <button key={o.value} disabled={save.isPending}
                  className={cx('rounded-xl border px-4 py-3.5 text-left transition-colors', answers[qs[step].id] === o.value ? 'border-brand bg-brand-soft' : 'border-line bg-surface hover:border-line-strong')}
                  onClick={() => pick(qs[step].id, o.value)}>{o.label[lang]}</button>
              ))}
            </div>
            {save.isPending && <div className="mt-6 flex justify-center"><Spinner /></div>}
            {save.error && <ErrorBox className="mt-4">{err(errCode(save.error))}</ErrorBox>}
          </div>
        )}

        {result && prof && (
          <div className="card anim-rise p-7 md:p-10">
            <p className="eyebrow">{t('t_result')}</p>
            <h1 className="h-display mt-3 text-3xl">{prof.name[lang]}</h1>
            <p className="mt-2 text-lg text-ink-2">{prof.tagline[lang]}</p>
            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              <div className="card-flat p-4">
                <p className="text-xs text-ink-3">{t('t_entry')}</p>
                <p className="mt-1 inline-flex items-center gap-2 font-semibold">{MODE_ICON[prof.entryMode]} {t(`s_mode_${prof.entryMode}`)}</p>
              </div>
              <div className="card-flat p-4">
                <p className="text-xs text-ink-3">{t('t_method')}</p>
                <p className="mt-1 font-semibold">{METHODS[prof.defaultMethod].name[lang]}</p>
              </div>
            </div>
            <div className="mt-6 space-y-3">
              <p className="text-sm font-medium">{t('t_channels')}</p>
              {(['visual', 'auditory', 'kinesthetic'] as const).map((k) => (
                <div key={k} className="grid grid-cols-[7rem_1fr_3rem] items-center gap-3 text-sm">
                  <span className="text-ink-2">{t(`modality_${k}`)}</span><Bar value={result.scores[k] / 100} color="bg-brand" /><span className="text-right tabular-nums text-ink-3">{result.scores[k]}%</span>
                </div>
              ))}
              <p className="pt-2 text-sm font-medium">{t('t_reasoning')}</p>
              {(['analytic', 'holistic'] as const).map((k) => (
                <div key={k} className="grid grid-cols-[7rem_1fr_3rem] items-center gap-3 text-sm">
                  <span className="text-ink-2">{t(`reasoning_${k}`)}</span><Bar value={result.scores[k] / 100} /><span className="text-right tabular-nums text-ink-3">{result.scores[k]}%</span>
                </div>
              ))}
            </div>
            <p className="mt-6 rounded-xl bg-surface-2 p-4 text-sm leading-relaxed text-ink-2">{t('l_honest')}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/kurs-olustur" className="btn btn-primary btn-lg">{t('t_go')} <LuArrowRight /></Link>
              <button className="btn btn-ghost btn-lg" onClick={() => { save.reset(); setAnswers({}); setStep(0); }}><LuRotateCcw /> {t('t_retake')}</button>
            </div>
          </div>
        )}
      </div>
    </Shell>
  );
}
