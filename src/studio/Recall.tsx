// Serbest yanıtlı hatırlama (yol haritası Faz 0 · Ultralearning: geri çağırma · Dirksen Böl. 4: tanıma yetmez).
// Sıra hep aynı: önce dene (yaz) → sonra örnek cevabı gör → kendini puanla. Cevap, öğrenci yazmadan gelmez.
// Geri bildirim cümlesi soruya göre değişir (alışmaya karşı çeşitlilik); renk tek başına anlam taşımaz (ikon + kelime).
import { useState } from 'react';
import { LuCheck, LuCircleHelp, LuPencilLine, LuX, LuMinus } from 'react-icons/lu';
import { trpc } from '../lib/trpc';
import { useErr, useI18n } from '../i18n/index';
import { errCode } from '../lib/trpc';
import { ErrorBox, Spinner, cx } from '../ui/kit';

const variant = (seed: string, n: number) => [...seed].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7) % n;

export default function Recall({ courseId, itemId, prompt, context, onDone, autoFocus }: {
  courseId: number; itemId: string; prompt?: string; context: 'check' | 'review' | 'drill';
  onDone?: (grade: 1 | 2 | 3) => void; autoFocus?: boolean;
}) {
  const { t } = useI18n();
  const err = useErr();
  const [text, setText] = useState('');
  const reveal = trpc.learn.recall.useMutation();
  const grade = trpc.learn.recallGrade.useMutation({ onSuccess: (r) => onDone?.(r.grade) });
  const shown = reveal.data;
  const g = grade.data?.grade;
  const fb = (k: 1 | 2 | 3) => t(`rc_fb_${k}_${variant(itemId, 3) + 1}`);

  return (
    <div className="space-y-3">
      {prompt && <p className="font-semibold leading-snug">{prompt}</p>}
      {!shown ? (
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (text.trim().length >= 3) reveal.mutate({ courseId, itemId, text, context }); }}>
          <label className="block">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-ink-2"><LuPencilLine aria-hidden /> {t('rc_write')}</span>
            <textarea className="input mt-1.5 min-h-24 py-2.5 leading-relaxed" value={text} onChange={(e) => setText(e.target.value)} maxLength={1500}
              placeholder={t('rc_ph')} autoFocus={autoFocus} />
          </label>
          {reveal.error && <ErrorBox>{err(errCode(reveal.error))}</ErrorBox>}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-ink-3">{text.trim().length < 3 ? t('rc_need') : t('rc_tip')}</p>
            <button className="btn btn-primary btn-sm" disabled={text.trim().length < 3 || reveal.isPending} aria-busy={reveal.isPending || undefined}>
              {reveal.isPending ? <Spinner className="h-3.5 w-3.5" /> : t('rc_compare')}
            </button>
          </div>
        </form>
      ) : (
        <div className="space-y-3">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-line bg-surface p-3.5">
              <p className="text-xs font-semibold uppercase tracking-wider text-ink-3">{t('rc_yours')}</p>
              <p className="mt-1.5 whitespace-pre-wrap text-sm">{text.trim()}</p>
            </div>
            <div className="rounded-xl border border-brand/30 bg-brand-soft p-3.5">
              <p className="text-xs font-semibold uppercase tracking-wider text-brand">{t('rc_model')}</p>
              <p className="mt-1.5 text-sm font-semibold">{shown.answer}</p>
              {shown.explain && <p className="mt-1.5 text-sm text-ink-2">{shown.explain}</p>}
            </div>
          </div>
          {!g ? (
            <div>
              <p className="text-sm font-semibold">{t('rc_rate')}</p>
              <div className="mt-2 grid grid-cols-3 gap-2" role="group" aria-label={t('rc_rate')}>
                {([1, 2, 3] as const).map((k) => (
                  <button key={k} type="button" className="btn btn-outline btn-sm flex-col !gap-0.5 !py-2" disabled={grade.isPending} onClick={() => grade.mutate({ recallId: shown.recallId, grade: k })}>
                    <span className="inline-flex items-center gap-1.5">{k === 1 ? <LuX aria-hidden /> : k === 2 ? <LuMinus aria-hidden /> : <LuCheck aria-hidden />}{t(`rc_g${k}`)}</span>
                    <span className="text-[11px] font-normal text-ink-3">{t(`rc_g${k}_d`)}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <p className={cx('flex items-start gap-2 rounded-xl p-3 text-sm', g === 1 ? 'bg-bad-soft' : g === 2 ? 'bg-surface-2' : 'bg-ok-soft')}>
              {g === 1 ? <LuCircleHelp className="mt-0.5 shrink-0 text-bad" aria-hidden /> : g === 2 ? <LuMinus className="mt-0.5 shrink-0 text-ink-2" aria-hidden /> : <LuCheck className="mt-0.5 shrink-0 text-ok" aria-hidden />}
              <span><strong>{t(`rc_g${g}`)}.</strong> {fb(g)}</span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
