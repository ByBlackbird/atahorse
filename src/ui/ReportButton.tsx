// İçerik denetimi: öğrenen bir soru/bölümde sorun görürse tek dokunuşla bildirir → yönetim kuyruğu.
import { useState } from 'react';
import { LuFlag } from 'react-icons/lu';
import { trpc, errCode } from '../lib/trpc';
import { useErr, useI18n } from '../i18n/index';
import { useToast } from './providers';
import { ErrorBox, Modal, Spinner, cx } from './kit';

const KINDS = ['wrong_answer', 'unclear', 'factual', 'other'] as const;

export default function ReportButton({ courseId, itemId, className }: { courseId: number; itemId: string; className?: string }) {
  const { t } = useI18n();
  const err = useErr();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<(typeof KINDS)[number]>('wrong_answer');
  const [note, setNote] = useState('');
  const m = trpc.learn.report.useMutation({ onSuccess: () => { setOpen(false); setNote(''); toast.push('ok', t('rp_done')); } });
  return (
    <>
      <button type="button" className={cx('btn btn-ghost btn-sm !h-8 !px-2 text-ink-3 hover:text-ink', className)} onClick={() => setOpen(true)} title={t('rp_title')}>
        <LuFlag /><span className="hidden sm:inline">{t('rp_btn')}</span>
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={t('rp_title')}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {KINDS.map((k) => (
              <button key={k} type="button" onClick={() => setKind(k)}
                className={cx('rounded-xl border px-3 py-2.5 text-left text-sm', kind === k ? 'border-brand bg-brand-soft font-semibold' : 'border-line hover:border-line-strong')}>
                {t(`rp_kind_${k}`)}
              </button>
            ))}
          </div>
          <label className="block text-sm">
            <span className="text-ink-2">{t('rp_note')}</span>
            <textarea className="input mt-1 !h-24 py-2" maxLength={600} value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
          {m.error && <ErrorBox>{err(errCode(m.error))}</ErrorBox>}
          <div className="flex justify-end gap-2">
            <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>{t('cancel')}</button>
            <button type="button" className="btn btn-primary" disabled={m.isPending} onClick={() => m.mutate({ courseId, itemId, kind, note })}>
              {m.isPending ? <Spinner className="h-4 w-4" /> : t('rp_send')}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
