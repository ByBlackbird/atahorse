// Anlık pekiştirme: önce hatırla, güven derecesini seç, sonra kontrol et (kalibrasyon + FSRS).
import { useState } from 'react';
import { LuCheck, LuX, LuBrain } from 'react-icons/lu';
import { trpc } from '../lib/trpc';
import { useI18n } from '../i18n/index';
import { Spinner, cx } from '../ui/kit';
import type { SItem } from './types';

export default function Check({ courseId, item, answered, onResult, compact }: { courseId: number; item: SItem; answered?: boolean; onResult?: (ok: boolean) => void; compact?: boolean }) {
  const { t } = useI18n();
  const utils = trpc.useUtils();
  const [pick, setPick] = useState<number | null>(null);
  const [conf, setConf] = useState<1 | 2 | 3>(2);
  const m = trpc.learn.check.useMutation({ onSuccess: (r) => { onResult?.(r.correct); void utils.course.view.invalidate(); } });
  const res = m.data;
  return (
    <div className={cx('rounded-[14px] border p-5', res ? (res.correct ? 'border-ok/40 bg-ok-soft' : 'border-bad/30 bg-bad-soft') : 'border-gold/50 bg-gold-soft')}>
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-gold-ink"><LuBrain /> {t('s_check')}</p>
        {answered && !res && <span className="chip"><LuCheck /> {t('s_answered')}</span>}
      </div>
      <p className="mt-2 font-semibold leading-snug">{item.q}</p>
      {!compact && !res && <p className="mt-1 text-xs text-ink-2">{t('s_check_hint')}</p>}
      <div className="mt-3 grid gap-2">
        {item.options.map((o, i) => {
          const right = res && i === res.correctIndex;
          const wrong = res && pick === i && !res.correct;
          return (
            <button key={i} disabled={!!res || m.isPending} onClick={() => setPick(i)}
              className={cx('flex items-start gap-2 rounded-xl border bg-surface px-3.5 py-2.5 text-left text-sm transition-colors',
                right ? 'border-ok text-ok' : wrong ? 'border-bad text-bad' : pick === i ? 'border-brand ring-1 ring-brand' : 'border-line hover:border-line-strong')}>
              <span className="mt-px font-semibold text-ink-3">{String.fromCharCode(65 + i)}</span><span className="flex-1">{o}</span>
              {right && <LuCheck className="mt-0.5" />}{wrong && <LuX className="mt-0.5" />}
            </button>
          );
        })}
      </div>
      {!res ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-ink-2">
            <span>{t('s_confidence')}</span>
            <div className="seg">
              {([1, 2, 3] as const).map((c) => <button key={c} className="!h-7 !px-2.5 !text-xs" aria-pressed={conf === c} onClick={() => setConf(c)}>{t(`s_conf_${c}`)}</button>)}
            </div>
          </div>
          <button className="btn btn-primary btn-sm" disabled={pick === null || m.isPending} onClick={() => pick !== null && m.mutate({ courseId, itemId: item.id, choice: pick, confidence: conf })}>
            {m.isPending ? <Spinner className="h-3.5 w-3.5" /> : t('s_check_btn')}
          </button>
        </div>
      ) : (
        <p className="mt-3 text-sm"><strong>{res.correct ? t('s_right') : t('s_wrong')}.</strong> {res.explain}</p>
      )}
    </div>
  );
}
