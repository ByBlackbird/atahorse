// Ön test: kurs başında kısa yoklama. Puanlanmaz, cevaplar gösterilmez (ölçüm bozulmasın).
// Finalde aynı sorular tekrar gelir → eşleştirilmiş öğrenme kazancı. Atlanabilir.
import { useState } from 'react';
import { LuClipboardCheck } from 'react-icons/lu';
import { trpc } from '../lib/trpc';
import { useI18n } from '../i18n/index';
import { Modal, Spinner, cx } from '../ui/kit';

export default function Pretest({ courseId }: { courseId: number }) {
  const { t, lang } = useI18n();
  const utils = trpc.useUtils();
  const q = trpc.learn.pretest.useQuery({ courseId, locale: lang }, { staleTime: Infinity });
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [closed, setClosed] = useState(false);
  const m = trpc.learn.submitPretest.useMutation({ onSuccess: () => void utils.learn.coursePath.invalidate() });
  const items = q.data?.items ?? [];
  const open = !closed && q.data?.status === 'pending' && items.length > 0;
  const done = m.data;
  const close = () => { setClosed(true); void utils.learn.pretest.invalidate({ courseId }); };
  const skip = () => { m.mutate({ courseId, answers: null }, { onSuccess: close }); };
  const all = items.every((it) => answers[it.id] !== undefined);

  return (
    <Modal open={open} onClose={done ? close : skip} title={t('pt_title')} wide>
      {done && !done.skipped ? (
        <div className="space-y-4 text-center">
          <LuClipboardCheck className="mx-auto h-10 w-10 text-brand" />
          <p className="font-medium">{t('pt_done', { a: done.score, b: done.total })}</p>
          <button className="btn btn-primary" onClick={close}>{t('pt_start')}</button>
        </div>
      ) : (
        <div className="space-y-5">
          <p className="text-sm text-ink-2">{t('pt_sub', { n: items.length })}</p>
          <ol className="space-y-5">
            {items.map((it, i) => (
              <li key={it.id}>
                <p className="font-medium">{i + 1}. {it.q}</p>
                <div className="mt-2 grid gap-1.5">
                  {[...it.options.map((o, k) => ({ k, o })), { k: -1, o: t('pt_unknown') }].map(({ k, o }) => (
                    <button key={k} type="button" onClick={() => setAnswers((a) => ({ ...a, [it.id]: k }))}
                      className={cx('rounded-xl border px-3.5 py-2 text-left text-sm', answers[it.id] === k ? 'border-brand bg-brand-soft' : 'border-line hover:border-line-strong', k === -1 && 'italic text-ink-2')}>
                      {o}
                    </button>
                  ))}
                </div>
              </li>
            ))}
          </ol>
          <div className="flex justify-between gap-2 border-t border-line pt-4">
            <button className="btn btn-ghost" disabled={m.isPending} onClick={skip}>{t('pt_skip')}</button>
            <button className="btn btn-primary" disabled={!all || m.isPending} onClick={() => m.mutate({ courseId, answers })}>
              {m.isPending ? <Spinner className="h-4 w-4" /> : t('pt_submit')}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
