// İki oturum tek ekranda:
//  · Aralıklı tekrar (/tekrar): FSRS ile vadesi gelen kartlar, tüm kurslardan karışık.
//  · Zayıf nokta tekrarı (/tekrar?kurs=ID&mod=zayif): en düşük ustalıktaki modüllerden karışık sorular.
// Her ikisinde de önce hatırla → güven derecesi → kontrol → gerekçeli geri bildirim.
import { useState } from 'react';
import { LuCheck, LuRepeat, LuX, LuArrowRight, LuTarget } from 'react-icons/lu';
import { Link, useRouter } from '../lib/router';
import { trpc } from '../lib/trpc';
import { fmtDate, useI18n } from '../i18n/index';
import { Shell } from '../app/Shell';
import { Bar, Empty, PageLoader, Spinner, cx } from '../ui/kit';
import ReportButton from '../ui/ReportButton';

interface Card { key: string; courseId: number; label: string; itemId: string; q: string; options: string[]; cardId?: number }
interface Result { correct: boolean; correctIndex: number; explain: string; nextDue?: number }

function Session({ cards, title, sub, icon, emptyText, answer, pending }: {
  cards: Card[]; title: string; sub: string; icon: React.ReactNode; emptyText: string;
  answer: (c: Card, choice: number, conf: 1 | 2 | 3) => Promise<Result>; pending: boolean;
}) {
  const { t, lang } = useI18n();
  const [i, setI] = useState(0);
  const [pick, setPick] = useState<number | null>(null);
  const [conf, setConf] = useState<1 | 2 | 3>(2);
  const [r, setR] = useState<Result | null>(null);
  const [right, setRight] = useState(0);
  const card = cards[i];
  const next = () => { setI((x) => x + 1); setPick(null); setConf(2); setR(null); };
  const submit = async () => {
    if (!card || pick === null) return;
    const res = await answer(card, pick, conf);
    setR(res);
    if (res.correct) setRight((x) => x + 1);
  };

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="h-display flex items-center gap-2 text-3xl">{icon} {title}</h1>
      <p className="mt-2 text-ink-2">{sub}</p>
      {cards.length === 0 ? (
        <div className="mt-8"><Empty icon={<LuCheck />} title={emptyText} action={<Link to="/panel" className="btn btn-outline">{t('nav_dashboard')}</Link>} /></div>
      ) : !card ? (
        <div className="mt-8"><Empty icon={<LuCheck />} title={t('r_done')} body={`${right} / ${cards.length}`} action={<Link to="/panel" className="btn btn-primary">{t('nav_dashboard')}</Link>} /></div>
      ) : (
        <div className="mt-8">
          <div className="mb-2 flex justify-between gap-3 text-xs text-ink-3"><span className="truncate">{card.label}</span><span className="shrink-0">{t('r_progress', { a: i + 1, b: cards.length })}</span></div>
          <Bar value={i / cards.length} />
          <div key={card.key} className="card anim-rise mt-5 p-6">
            <p className="text-lg font-medium">{card.q}</p>
            <div className="mt-4 grid gap-2">
              {card.options.map((o, k) => (
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
                <button className="btn btn-primary" disabled={pick === null || pending} onClick={() => void submit()}>
                  {pending ? <Spinner className="h-4 w-4" /> : t('s_check_btn')}
                </button>
              </div>
            ) : (
              <div className="mt-5 space-y-3">
                <p className="flex items-start gap-2 text-sm">{r.correct ? <LuCheck className="mt-0.5 shrink-0 text-ok" /> : <LuX className="mt-0.5 shrink-0 text-bad" />}<span><strong>{r.correct ? t('s_right') : t('s_wrong')}.</strong> {r.explain}</span></p>
                {r.nextDue && <p className="text-xs text-ink-3">{t('r_next_due', { d: fmtDate(r.nextDue, lang) })}</p>}
                <div className="flex items-center justify-between gap-2">
                  <ReportButton courseId={card.courseId} itemId={card.itemId} className="-ml-2" />
                  <button className="btn btn-primary" onClick={next}>{t('continue')} <LuArrowRight /></button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SpacedReview() {
  const { t } = useI18n();
  const utils = trpc.useUtils();
  const q = trpc.learn.reviews.useQuery(undefined, { staleTime: Infinity });
  const m = trpc.learn.review.useMutation({ onSuccess: () => { void utils.profile.dashboard.invalidate(); void utils.learn.path.invalidate(); } });
  if (!q.data) return <PageLoader />;
  const cards: Card[] = q.data.map((c) => ({ key: `c${c.cardId}`, cardId: c.cardId, courseId: c.courseId, label: c.courseTitle, itemId: c.item.id, q: c.item.q, options: c.item.options }));
  return (
    <Session cards={cards} title={t('r_title')} sub={t('r_sub')} icon={<LuRepeat className="text-brand" />} emptyText={t('r_empty')} pending={m.isPending}
      answer={(c, choice, confidence) => m.mutateAsync({ cardId: c.cardId!, choice, confidence })} />
  );
}

function Recap({ courseId }: { courseId: number }) {
  const { t, lang } = useI18n();
  const utils = trpc.useUtils();
  const q = trpc.learn.recap.useQuery({ courseId, locale: lang }, { staleTime: Infinity });
  const m = trpc.learn.check.useMutation({ onSuccess: () => { void utils.learn.path.invalidate(); void utils.learn.coursePath.invalidate(); void utils.profile.dashboard.invalidate(); } });
  if (!q.data) return <PageLoader />;
  const cards: Card[] = q.data.items.map((it) => ({ key: it.id, courseId, label: `${q.data.title} · ${it.moduleTitle}`, itemId: it.id, q: it.q, options: it.options }));
  return (
    <Session cards={cards} title={t('rc_title')} sub={t('rc_sub')} icon={<LuTarget className="text-brand" />} emptyText={t('rc_empty')} pending={m.isPending}
      answer={(c, choice, confidence) => m.mutateAsync({ courseId, itemId: c.itemId, choice, confidence })} />
  );
}

export default function Review() {
  const { search } = useRouter();
  const courseId = Number(search.get('kurs'));
  const recap = search.get('mod') === 'zayif' && Number.isInteger(courseId) && courseId > 0;
  return <Shell>{recap ? <Recap courseId={courseId} /> : <SpacedReview />}</Shell>;
}
