// Modül sonu hesap verebilirlik katmanı: görev onayı (+20) → modül quizi (+25, kilit açar) → modül (+100) → kurs (+150).
import { useEffect, useRef, useState } from 'react';
import { LuCheck, LuClipboardCheck, LuPaperclip, LuMic, LuSquare, LuArrowRight, LuTrophy, LuRotateCcw, LuX } from 'react-icons/lu';
import { Link } from '../lib/router';
import { trpc, errCode } from '../lib/trpc';
import { useErr, useI18n } from '../i18n/index';
import { useToast } from '../ui/providers';
import { ErrorBox, Spinner, cx } from '../ui/kit';
import type { Progress, SModule, View } from './types';

async function upload(courseId: number, moduleIdx: number, kind: 'note' | 'audio', file: File) {
  const fd = new FormData();
  fd.set('courseId', String(courseId)); fd.set('moduleIdx', String(moduleIdx)); fd.set('kind', kind); fd.set('file', file);
  const r = await fetch('/api/upload', { method: 'POST', body: fd, credentials: 'same-origin' });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? 'e_generic');
}

function TaskCard({ view, mod, prog }: { view: View; mod: SModule; prog: Progress }) {
  const { t, lang } = useI18n();
  const err = useErr();
  const toast = useToast();
  const utils = trpc.useUtils();
  const [steps, setSteps] = useState<boolean[]>(() => mod.task.steps.map(() => prog.taskDone));
  const [text, setText] = useState('');
  const [files, setFiles] = useState<string[]>([]);
  const [rec, setRec] = useState<MediaRecorder | null>(null);
  const [upErr, setUpErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const approve = trpc.learn.task.useMutation({
    onSuccess: (r) => { toast.xp(r.xp); void utils.course.view.invalidate(); },
  });

  const send = async (kind: 'note' | 'audio', f: File) => {
    setUpErr(null);
    try { await upload(view.course.id, mod.idx, kind, f); setFiles((s) => [...s, f.name]); } catch (e) { setUpErr(err((e as Error).message)); }
  };
  const toggleRec = async () => {
    if (rec) { rec.stop(); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      mr.ondataavailable = (e) => chunks.push(e.data);
      mr.onstop = () => {
        stream.getTracks().forEach((tr) => tr.stop());
        setRec(null);
        void send('audio', new File([new Blob(chunks, { type: 'audio/webm' })], `ses-notu-${Date.now()}.webm`, { type: 'audio/webm' }));
      };
      mr.start();
      setRec(mr);
    } catch { setUpErr(t('forbidden')); }
  };

  const done = prog.taskDone;
  return (
    <div className={cx('card p-6', done && 'border-ok/40')}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-ink-3"><LuClipboardCheck /> {t('s_task')} · {t('s_chip_min', { n: mod.task.minutes })}</p>
          <h3 className="mt-1.5 text-lg font-semibold">{mod.task.title}</h3>
        </div>
        {done ? <span className="chip !border-ok/40 !text-ok"><LuCheck /> {t('s_task_done')}</span> : <span className="chip chip-gold">+20 XP</span>}
      </div>
      <ol className="mt-4 space-y-2">
        {mod.task.steps.map((s, i) => (
          <li key={i}>
            <label className="flex cursor-pointer items-start gap-3 rounded-xl px-2 py-1.5 hover:bg-surface-2">
              <input type="checkbox" className="mt-1 h-4 w-4 accent-[var(--c-brand)]" checked={steps[i]} disabled={done} onChange={() => setSteps((x) => x.map((v, j) => (j === i ? !v : v)))} />
              <span className={cx('text-[15px]', steps[i] && 'text-ink-2 line-through decoration-ink-3')}>{s}</span>
            </label>
          </li>
        ))}
      </ol>
      {!done && (
        <div className="mt-5 space-y-3">
          <label className="block">
            <span className="text-sm font-medium">{t('s_reflection')}</span>
            <textarea className="input mt-1.5" rows={3} value={text} maxLength={2000} onChange={(e) => setText(e.target.value)} />
            <span className="mt-1 block text-xs text-ink-3">{t('s_reflection_h')}</span>
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <input ref={fileRef} type="file" hidden accept=".txt,.md,.pdf,.png,.jpg,.jpeg" onChange={(e) => { const f = e.target.files?.[0]; if (f) void send('note', f); e.target.value = ''; }} />
            <button className="btn btn-outline btn-sm" onClick={() => fileRef.current?.click()}><LuPaperclip /> {t('s_attach')}</button>
            {'MediaRecorder' in window && (
              <button className={cx('btn btn-sm', rec ? 'btn-primary' : 'btn-outline')} onClick={toggleRec}>{rec ? <><LuSquare /> {t('s_recording')}</> : <><LuMic /> {t('s_record')}</>}</button>
            )}
            {files.map((f) => <span key={f} className="chip"><LuCheck className="text-ok" /> {f.length > 24 ? `${f.slice(0, 22)}…` : f}</span>)}
          </div>
          {upErr && <ErrorBox>{upErr}</ErrorBox>}
          {approve.error && <ErrorBox>{err(errCode(approve.error))}</ErrorBox>}
          <button className="btn btn-primary" disabled={approve.isPending || text.trim().length < 15 || !steps.every(Boolean)}
            onClick={() => approve.mutate({ courseId: view.course.id, moduleIdx: mod.idx, reflection: text, locale: lang })}>
            {approve.isPending ? <Spinner className="h-4 w-4" /> : <><LuCheck /> {t('s_task_btn')}</>}
          </button>
        </div>
      )}
    </div>
  );
}

function ModuleQuiz({ view, mod, prog, onNext }: { view: View; mod: SModule; prog: Progress; onNext: () => void }) {
  const { t, lang } = useI18n();
  const err = useErr();
  const toast = useToast();
  const utils = trpc.useUtils();
  const [ans, setAns] = useState<number[]>(() => mod.quiz.map(() => -1));
  const [open, setOpen] = useState(!prog.quizPassed);
  const quiz = trpc.learn.quiz.useMutation({ onSuccess: (r) => { toast.xp(r.xp); void utils.course.view.invalidate(); } });
  useEffect(() => { setAns(mod.quiz.map(() => -1)); quiz.reset(); }, [mod]); // eslint-disable-line react-hooks/exhaustive-deps
  const r = quiz.data;
  const resultFor = (id: string) => r?.results.find((x) => x.id === id);
  const isLast = mod.idx === view.doc.modules.length - 1;

  if (prog.quizPassed && !open) {
    return (
      <div className="card flex flex-wrap items-center justify-between gap-3 border-ok/40 p-5">
        <p className="flex items-center gap-2 font-semibold"><LuCheck className="text-ok" /> {t('s_quiz_passed', { n: prog.quizBest })}</p>
        <div className="flex gap-2">
          <button className="btn btn-ghost btn-sm" onClick={() => setOpen(true)}><LuRotateCcw /> {t('retry')}</button>
          {!isLast && <button className="btn btn-primary btn-sm" onClick={onNext}>{t('s_next_module')} <LuArrowRight /></button>}
        </div>
      </div>
    );
  }
  return (
    <div className="card p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">{t('s_quiz')}</h3>
          <p className="text-sm text-ink-2">{t('s_quiz_s')}</p>
        </div>
        <span className="chip chip-gold">+25 XP</span>
      </div>
      <ol className="mt-5 space-y-6">
        {mod.quiz.map((q, qi) => {
          const res = resultFor(q.id);
          return (
            <li key={q.id}>
              <p className="font-medium"><span className="mr-1.5 text-ink-3">{qi + 1}.</span>{q.q}</p>
              <div className="mt-2.5 grid gap-2">
                {q.options.map((o, i) => {
                  const right = res && i === res.correct;
                  const wrong = res && ans[qi] === i && !res.ok;
                  return (
                    <label key={i} className={cx('flex cursor-pointer items-start gap-3 rounded-xl border px-3.5 py-2.5 text-sm transition-colors',
                      right ? 'border-ok bg-ok-soft' : wrong ? 'border-bad bg-bad-soft' : ans[qi] === i ? 'border-brand bg-brand-soft' : 'border-line hover:border-line-strong')}>
                      <input type="radio" name={q.id} className="mt-0.5 accent-[var(--c-brand)]" checked={ans[qi] === i} disabled={!!r} onChange={() => setAns((a) => a.map((v, j) => (j === qi ? i : v)))} />
                      <span>{o}</span>
                    </label>
                  );
                })}
              </div>
              {res && <p className="mt-2 text-sm text-ink-2">{res.ok ? '✓' : '✗'} {res.explain}</p>}
            </li>
          );
        })}
      </ol>
      {quiz.error && <ErrorBox className="mt-4">{err(errCode(quiz.error))}</ErrorBox>}
      {!r ? (
        <button className="btn btn-primary mt-6" disabled={ans.some((a) => a < 0) || quiz.isPending}
          onClick={() => quiz.mutate({ courseId: view.course.id, moduleIdx: mod.idx, answers: ans, locale: lang })}>
          {quiz.isPending ? <Spinner className="h-4 w-4" /> : t('s_quiz_submit')}
        </button>
      ) : (
        <div className={cx('mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl p-4', r.passed ? 'bg-ok-soft' : 'bg-bad-soft')}>
          <p className="text-sm"><strong>{t('s_quiz_result', { a: r.score, b: r.total })}</strong> — {r.passed ? t('s_quiz_pass') : t('s_quiz_fail')}</p>
          <div className="flex gap-2">
            {!r.passed && <button className="btn btn-outline btn-sm" onClick={() => { quiz.reset(); setAns(mod.quiz.map(() => -1)); }}><LuRotateCcw /> {t('retry')}</button>}
            {r.passed && !isLast && <button className="btn btn-primary btn-sm" onClick={onNext}>{t('s_next_module')} <LuArrowRight /></button>}
            {r.passed && prog.quizPassed && <button className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}><LuX /></button>}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ModuleFooter({ view, mod, prog, onNext }: { view: View; mod: SModule; prog: Progress; onNext: () => void }) {
  const { t } = useI18n();
  return (
    <div className="mx-auto mt-14 max-w-3xl space-y-4 border-t border-line pt-10">
      <TaskCard key={`t${mod.idx}${prog.taskDone}`} view={view} mod={mod} prog={prog} />
      <ModuleQuiz view={view} mod={mod} prog={prog} onNext={onNext} />
      {view.course.completedAt && (
        <div className="card flex flex-wrap items-center justify-between gap-4 border-gold/50 bg-gold-soft p-6">
          <div>
            <p className="flex items-center gap-2 text-lg font-semibold"><LuTrophy className="text-gold" /> {t('s_course_done')}</p>
            <p className="mt-1 text-sm text-ink-2">{t('s_course_done_s')}</p>
          </div>
          {view.certificate
            ? <Link to={`/sertifika/${view.certificate.code}`} className="btn btn-gold">{t('s_view_cert')}</Link>
            : <Link to={`/kurs/${view.course.id}/final`} className="btn btn-primary">{t('s_go_final')} <LuArrowRight /></Link>}
        </div>
      )}
    </div>
  );
}
