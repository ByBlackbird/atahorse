import { useState } from 'react';
import { LuCheck, LuRepeat, LuX, LuArrowRight } from 'react-icons/lu';
import { Link } from '../lib/router';
import { trpc } from '../lib/trpc';
import { fmtDate, useI18n } from '../i18n/index';
import { Shell } from '../app/Shell';
import { Bar, Empty, PageLoader, Spinner, cx } from '../ui/kit';

export default function Review() {
  const { t, lang } = useI18n();
  const utils = trpc.useUtils();
  const q = trpc.learn.reviews.useQuery(undefined, { staleTime: Infinity });
  const [i, setI] = useState(0);
  const [pick, setPick] = useState<number | null>(null);
  const [conf, setConf] = useState<1 | 2 | 3>(2);
  const answer = trpc.learn.review.useMutation({ onSuccess: () => void utils.profile.dashboard.invalidate() });
  if (!q.data) return <Shell><PageLoader /></Shell>;
  const cards = q.data;
  const card = cards[i];
  const r = answer.data;
  const next = () => { setI((x) => x + 1); setPick(null); setConf(2); answer.reset(); };

  return (
    <Shell>
      <div className="mx-auto max-w-2xl">
        <h1 className="h-display flex items-center gap-2 text-3xl"><LuRepeat className="text-brand" /> {t('r_title')}</h1>
        <p className="mt-2 text-ink-2">{t('r_sub')}</p>
        {cards.length === 0 ? (
          <div className="mt-8"><Empty icon={<LuCheck />} title={t('r_empty')} action={<Link to="/panel" className="btn btn-outline">{t('nav_dashboard')}</Link>} /></div>
        ) : !card ? (
          <div className="mt-8"><Empty icon={<LuCheck />} title={t('r_done')} body={t('r_empty')} action={<Link to="/panel" className="btn btn-primary">{t('nav_dashboard')}</Link>} /></div>
        ) : (
          <div className="mt-8">
            <div className="mb-2 flex justify-between text-xs text-ink-3"><span>{card.courseTitle}</span><span>{t('r_progress', { a: i + 1, b: cards.length })}</span></div>
            <Bar value={i / cards.length} />
            <div key={card.cardId} className="card anim-rise mt-5 p-6">
              <p className="text-lg font-medium">{card.item.q}</p>
              <div className="mt-4 grid gap-2">
                {card.item.options.map((o, k) => (
                  <button key={k} disabled={!!r} onClick={() => setPick(k)}
                    className={cx('rounded-xl border px-4 py-3 text-left text-sm transition-colors',
                      r ? (k === r.correctIndex ? 'border-ok bg-ok-soft' : pick === k ? 'border-bad bg-bad-soft' : 'border-line') : pick === k ? 'border-brand bg-brand-soft' : 'border-line hover:border-line-strong')}>
                    {o}
                  </button>
                ))}
              </div>
              {!r ? (
                <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-xs text-ink-2">{t('s_confidence')}
                    <div className="seg">{([1, 2, 3] as const).map((c) => <button key={c} className="!h-7 !px-2.5 !text-xs" aria-pressed={conf === c} onClick={() => setConf(c)}>{t(`s_conf_${c}`)}</button>)}</div>
                  </div>
                  <button className="btn btn-primary" disabled={pick === null || answer.isPending} onClick={() => pick !== null && answer.mutate({ cardId: card.cardId, choice: pick, confidence: conf })}>
                    {answer.isPending ? <Spinner className="h-4 w-4" /> : t('s_check_btn')}
                  </button>
                </div>
              ) : (
                <div className="mt-5 space-y-3">
                  <p className="flex items-start gap-2 text-sm">{r.correct ? <LuCheck className="mt-0.5 text-ok" /> : <LuX className="mt-0.5 text-bad" />}<span><strong>{r.correct ? t('s_right') : t('s_wrong')}.</strong> {r.explain}</span></p>
                  <p className="text-xs text-ink-3">{t('r_next_due', { d: fmtDate(r.nextDue, lang) })}</p>
                  <button className="btn btn-primary" onClick={next}>{t('continue')} <LuArrowRight /></button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </Shell>
  );
}
