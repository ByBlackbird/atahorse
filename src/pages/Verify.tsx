import { useState } from 'react';
import { LuShieldCheck, LuShieldX } from 'react-icons/lu';
import { Link, useRouter } from '../lib/router';
import { trpc } from '../lib/trpc';
import { fmtDate, useI18n } from '../i18n/index';
import { Shell } from '../app/Shell';
import { Spinner } from '../ui/kit';

export default function Verify() {
  const { t, lang } = useI18n();
  const { search } = useRouter();
  const [input, setInput] = useState(search.get('kod') ?? '');
  const [code, setCode] = useState(search.get('kod') ?? '');
  const q = trpc.pub.verify.useQuery({ code }, { enabled: code.length >= 6 });
  return (
    <Shell>
      <div className="mx-auto max-w-lg">
        <h1 className="h-display text-3xl">{t('v_title')}</h1>
        <p className="mt-2 text-ink-2">{t('v_sub')}</p>
        <form className="mt-6 flex gap-2" onSubmit={(e) => { e.preventDefault(); setCode(input.trim().toUpperCase()); }}>
          <input className="input font-mono tracking-wider" placeholder="ATA-2026-XXXXXXXX" value={input} onChange={(e) => setInput(e.target.value)} />
          <button className="btn btn-primary" disabled={input.trim().length < 6}>{t('v_btn')}</button>
        </form>
        {q.isFetching && <div className="mt-6 flex justify-center"><Spinner /></div>}
        {q.data && (q.data.valid ? (
          <div className="card anim-rise mt-6 border-ok/40 p-6">
            <p className="flex items-center gap-2 font-semibold text-ok"><LuShieldCheck /> {t('v_valid')}</p>
            <p className="h-display mt-4 text-2xl">{q.data.name}</p>
            <p className="mt-1">{q.data.title}</p>
            <p className="mt-3 text-sm text-ink-3">{fmtDate(q.data.issuedAt, lang)} · %{q.data.scorePct} · {q.data.code}</p>
            <Link to={`/sertifika/${q.data.code}`} className="btn btn-outline btn-sm mt-4">{t('s_view_cert')}</Link>
          </div>
        ) : (
          <div className="card anim-rise mt-6 border-bad/30 p-6"><p className="flex items-center gap-2 font-semibold text-bad"><LuShieldX /> {t('v_invalid')}</p></div>
        ))}
      </div>
    </Shell>
  );
}
