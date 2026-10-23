import { useState } from 'react';
import { LuArrowLeft, LuAward, LuShuffle } from 'react-icons/lu';
import { Link } from '../lib/router';
import { trpc, errCode } from '../lib/trpc';
import { useErr, useI18n } from '../i18n/index';
import { useToast } from '../ui/providers';
import { Shell } from '../app/Shell';
import { Bar, ErrorBox, PageLoader, Spinner, cx } from '../ui/kit';

export default function Final({ courseId }: { courseId: number }) {
  const { t, lang } = useI18n();
  const err = useErr();
  const toast = useToast();
  const utils = trpc.useUtils();
  const q = trpc.learn.final.useQuery({ courseId, locale: lang }, { retry: false });
  const [ans, setAns] = useState<Record<string, number>>({});
  const submit = trpc.learn.submitFinal.useMutation({ onSuccess: (r) => { toast.xp(r.xp); void utils.course.view.invalidate(); } });
  const r = submit.data;

  if (q.error) return <Shell><div className="mx-auto max-w-xl"><ErrorBox>{errCode(q.error) === 'course_not_finished' ? t('f_locked') : err(errCode(q.error))}</ErrorBox><Link to={`/kurs/${courseId}`} className="btn btn-ghost mt-4"><LuArrowLeft /> {t('back')}</Link></div></Shell>;
  if (!q.data) return <Shell><PageLoader /></Shell>;
  const items = q.data.items;
  const done = Object.keys(ans).length;
  const res = (id: string) => r?.results.find((x) => x.id === id);

  return (
    <Shell>
      <div className="mx-auto max-w-3xl">
        <Link to={`/kurs/${courseId}`} className="btn btn-ghost btn-sm -ml-2"><LuArrowLeft /> {q.data.title}</Link>
        <h1 className="h-display mt-3 text-3xl">{t('f_title')}</h1>
        <p className="mt-2 flex items-center gap-2 text-ink-2"><LuShuffle className="text-brand" /> {t('f_sub', { n: items.length })}</p>
        {!r && <Bar value={done / items.length} className="mt-5" />}

        {r && (
          <div className={cx('card mt-6 p-6', r.passed ? 'border-gold/50 bg-gold-soft' : 'border-bad/30 bg-bad-soft')}>
            <p className="text-3xl font-semibold tabular-nums">{r.score}/{r.total} <span className="text-base font-normal text-ink-2">· %{Math.round((r.score / r.total) * 100)}</span></p>
            <p className="mt-2">{r.passed ? t('f_pass') : t('f_fail')}</p>
            {r.certificate && <Link to={`/sertifika/${r.certificate.code}`} className="btn btn-gold mt-4"><LuAward /> {t('s_view_cert')}</Link>}
          </div>
        )}

        <ol className="mt-8 space-y-5">
          {items.map((it, qi) => {
            const x = res(it.id);
            return (
              <li key={it.id} className="card p-5">
                <p className="font-medium"><span className="mr-2 text-ink-3">{qi + 1}.</span>{it.q}</p>
                <div className="mt-3 grid gap-2">
                  {it.options.map((o, i) => (
                    <label key={i} className={cx('flex cursor-pointer items-start gap-3 rounded-xl border px-3.5 py-2.5 text-sm',
                      x ? (i === x.correct ? 'border-ok bg-ok-soft' : ans[it.id] === i ? 'border-bad bg-bad-soft' : 'border-line') : ans[it.id] === i ? 'border-brand bg-brand-soft' : 'border-line hover:border-line-strong')}>
                      <input type="radio" name={it.id} className="mt-0.5 accent-[var(--c-brand)]" disabled={!!r} checked={ans[it.id] === i} onChange={() => setAns((a) => ({ ...a, [it.id]: i }))} />
                      {o}
                    </label>
                  ))}
                </div>
                {x && <p className="mt-2 text-sm text-ink-2">{x.explain}</p>}
              </li>
            );
          })}
        </ol>
        {submit.error && <ErrorBox className="mt-4">{err(errCode(submit.error))}</ErrorBox>}
        {!r && (
          <button className="btn btn-primary btn-lg mt-6" disabled={done < items.length || submit.isPending} onClick={() => submit.mutate({ courseId, answers: ans, locale: lang })}>
            {submit.isPending ? <Spinner className="h-4 w-4" /> : t('f_submit')}
          </button>
        )}
      </div>
    </Shell>
  );
}
