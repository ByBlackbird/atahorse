// İki oturum tek ekranda:
//  · Aralıklı tekrar (/tekrar): FSRS ile vadesi gelen kartlar, tüm kurslardan karışık.
//  · Zayıf nokta tekrarı (/tekrar?kurs=ID&mod=zayif): en düşük ustalıktaki modüllerden karışık sorular.
//  · Hedefli drill (/tekrar?kurs=ID&mod=drill&modul=M): kalınan quizden sonra modülün en zayıf 3–5 sorusu.
// Varsayılan cevap biçimi serbest yanıt (yaz → karşılaştır → kendini puanla); "Seçenekle" yedek yoldur.
import { useState } from 'react';
import { LuCheck, LuRepeat, LuX, LuArrowRight, LuTarget, LuCrosshair } from 'react-icons/lu';
import { Link, useRouter } from '../lib/router';
import { trpc } from '../lib/trpc';
import { fmtDate, useI18n } from '../i18n/index';
import { Shell } from '../app/Shell';
import { Bar, Empty, PageHero, PageLoader, Spinner, cx } from '../ui/kit';
import ReportButton from '../ui/ReportButton';
import Recall from '../studio/Recall';

interface Card { key: string; courseId: number; label: string; itemId: string; q: string; options: string[]; cardId?: number }
interface Result { correct: boolean; correctIndex: number; explain: string; nextDue?: number }

function Session({ cards, title, sub, icon, emptyText, answer, pending, recallContext, onRecalled, doneAction, eyebrow }: {
  cards: Card[]; title: string; sub: string; icon: React.ReactNode; emptyText: string;
  answer: (c: Card, choice: number, conf: 1 | 2 | 3) => Promise<Result>; pending: boolean;
  recallContext: 'review' | 'drill'; onRecalled?: () => void; doneAction?: React.ReactNode; eyebrow?: string;
}) {
  const { t, lang } = useI18n();
  const [mode, setMode] = useState<'write' | 'choose'>('write');
  const [graded, setGraded] = useState<1 | 2 | 3 | null>(null);
  const [i, setI] = useState(0);
  const [pick, setPick] = useState<number | null>(null);
  const [conf, setConf] = useState<1 | 2 | 3>(2);
  const [r, setR] = useState<Result | null>(null);
  const [right, setRight] = useState(0);
  const card = cards[i];
  const next = () => { setI((x) => x + 1); setPick(null); setConf(2); setR(null); setGraded(null); };
  const submit = async () => {
    if (!card || pick === null) return;
    const res = await answer(card, pick, conf);
    setR(res);
    if (res.correct) setRight((x) => x + 1);
  };

  return (
    <div className="mx-auto max-w-2xl">
      <PageHero icon={icon} eyebrow={eyebrow} title={title} sub={sub} />
      {cards.length === 0 ? (
        <div className="mt-8"><Empty icon={<LuCheck />} title={emptyText} action={<Link to="/panel" className="btn btn-outline">{t('nav_dashboard')}</Link>} /></div>
      ) : !card ? (
        <div className="mt-8"><Empty icon={<LuCheck />} title={t('r_done')} body={`${right} / ${cards.length}`} action={doneAction ?? <Link to="/panel" className="btn btn-primary">{t('nav_dashboard')}</Link>} /></div>
      ) : (
        <div className="mt-8">
          <div className="mb-2 flex justify-between gap-3 text-xs text-ink-3"><span className="truncate">{card.label}</span><span className="shrink-0">{t('r_progress', { a: i + 1, b: cards.length })}</span></div>
          <Bar value={i / cards.length} />
          <div key={card.key} className="card anim-rise mt-5 p-6">
            {!r && !graded && (
              <div className="mb-4 flex justify-end">
                <div className="seg" role="tablist" aria-label={t('s_check')}>
                  <button role="tab" className="!h-7 !px-2.5 !text-xs" aria-pressed={mode === 'write'} onClick={() => setMode('write')}>{t('rc_mode_write')}</button>
                  <button role="tab" className="!h-7 !px-2.5 !text-xs" aria-pressed={mode === 'choose'} onClick={() => setMode('choose')}>{t('rc_mode_choose')}</button>
                </div>
              </div>
            )}
            {mode === 'write' && !r ? (
              <>
                <Recall key={card.key} courseId={card.courseId} itemId={card.itemId} prompt={card.q} context={recallContext} autoFocus
                  onDone={(g) => { setGraded(g); if (g >= 2) setRight((x) => x + 1); onRecalled?.(); }} />
                {graded && (
                  <div className="mt-4 flex items-center justify-between gap-2">
                    <ReportButton courseId={card.courseId} itemId={card.itemId} className="-ml-2" />
                    <button className="btn btn-primary" onClick={next}>{t('continue')} <LuArrowRight /></button>
                  </div>
                )}
              </>
            ) : (<>
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
            </>)}
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
    <Session cards={cards} title={t('r_title')} sub={t('r_sub')} icon={<LuRepeat />} emptyText={t('r_empty')} pending={m.isPending} recallContext="review"
      onRecalled={() => { void utils.profile.dashboard.invalidate(); void utils.learn.path.invalidate(); }}
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
    <Session cards={cards} title={t('rc_title')} sub={t('rc_sub')} icon={<LuTarget />} emptyText={t('rc_empty')} pending={m.isPending} recallContext="drill"
      answer={(c, choice, confidence) => m.mutateAsync({ courseId, itemId: c.itemId, choice, confidence })} />
  );
}

/** Hedefli drill: kalınan modül quizinden sonra en zayıf kavrama dar alıştırma, sonra quiz yeniden. */
function Drill({ courseId, moduleIdx }: { courseId: number; moduleIdx: number }) {
  const { t, lang } = useI18n();
  const utils = trpc.useUtils();
  const q = trpc.learn.drill.useQuery({ courseId, moduleIdx, locale: lang }, { staleTime: Infinity });
  const done = trpc.learn.drillDone.useMutation();
  const m = trpc.learn.check.useMutation({ onSuccess: () => { void utils.course.view.invalidate(); } });
  if (!q.data) return <PageLoader />;
  const cards: Card[] = q.data.items.map((it) => ({ key: it.id, courseId, label: `${q.data.moduleTitle}`, itemId: it.id, q: it.q, options: it.options }));
  const toQuiz = `/kurs/${courseId}/m/${moduleIdx}#quiz`;
  return (
    <Session cards={cards} eyebrow={t('dr_eyebrow')} title={t('dr_title', { s: q.data.weakest })} sub={t('dr_sub')} icon={<LuCrosshair />} emptyText={t('rc_empty')} pending={m.isPending} recallContext="drill"
      answer={(c, choice, confidence) => m.mutateAsync({ courseId, itemId: c.itemId, choice, confidence })}
      doneAction={<Link to={toQuiz} className="btn btn-primary" onClick={() => done.mutate({ courseId, moduleIdx })}>{t('dr_retry_quiz')} <LuArrowRight /></Link>} />
  );
}

export default function Review() {
  const { search } = useRouter();
  const courseId = Number(search.get('kurs'));
  const okCourse = Number.isInteger(courseId) && courseId > 0;
  const mod = search.get('mod');
  const moduleIdx = Number(search.get('modul'));
  if (okCourse && mod === 'drill' && Number.isInteger(moduleIdx) && moduleIdx >= 0) return <Shell><Drill courseId={courseId} moduleIdx={moduleIdx} /></Shell>;
  return <Shell>{okCourse && mod === 'zayif' ? <Recap courseId={courseId} /> : <SpacedReview />}</Shell>;
}
