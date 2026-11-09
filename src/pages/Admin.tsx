import { useState } from 'react';
import { LuUsers, LuBookOpen, LuAward, LuTarget, LuCpu, LuDatabase, LuMail, LuTrendingUp, LuFlag, LuMegaphone, LuTrash2, LuShieldCheck } from 'react-icons/lu';
import { trpc } from '../lib/trpc';
import { fmtDate, useI18n } from '../i18n/index';
import { Shell } from '../app/Shell';
import { ErrorBox, PageHero, PageLoader, Stat, cx } from '../ui/kit';
import DataTable from '../ui/DataTable';
import { errCode } from '../lib/trpc';
import { useErr } from '../i18n/index';

const pctOrDash = (x: number | null) => (x === null ? '—' : `%${Math.round(x * 100)}`);

/** Ürün kanıtı: ön test → final eşleştirilmiş kazanç (yatırımcıya giden tek gerçek sonuç metriği). */
function Outcomes() {
  const { t } = useI18n();
  const q = trpc.admin.outcomes.useQuery();
  if (!q.data) return null;
  const d = q.data;
  return (
    <div className="card mt-6 p-5">
      <h2 className="flex items-center gap-2 font-semibold"><LuTrendingUp /> {t('ad_outcomes')}</h2>
      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label={t('ad_paired')} value={`${d.paired} / ${d.taken}`} />
        <Stat label={t('ad_pre')} value={pctOrDash(d.preAvg)} />
        <Stat label={t('ad_post')} value={pctOrDash(d.postAvg)} />
        <Stat label={t('ad_gain')} value={pctOrDash(d.gainAvg)} />
      </div>
    </div>
  );
}

function Reports() {
  const { t, lang } = useI18n();
  const [status, setStatus] = useState<'open' | 'resolved' | 'dismissed'>('open');
  const utils = trpc.useUtils();
  const q = trpc.admin.reports.useQuery({ status });
  const set = trpc.admin.setReport.useMutation({ onSuccess: () => utils.admin.reports.invalidate() });
  return (
    <div className="card mt-6 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-semibold"><LuFlag /> {t('ad_reports')}</h2>
        <div className="seg">{(['open', 'resolved', 'dismissed'] as const).map((s) => <button key={s} aria-pressed={status === s} onClick={() => setStatus(s)}>{s}</button>)}</div>
      </div>
      <ul className="mt-4 divide-y divide-line">
        {q.data?.map((r) => (
          <li key={r.id} className="py-3 text-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-xs text-ink-3">#{r.courseId} · {r.courseTitle} · {r.itemId} · {fmtDate(r.createdAt, lang)}</p>
                <p className="mt-1 font-medium">{r.excerpt || '—'}</p>
                {r.options.length > 0 && <ol className="mt-1 list-[upper-alpha] pl-5 text-xs text-ink-2">{r.options.map((o, i) => <li key={i} className={cx(i === r.correct && 'font-semibold text-ok')}>{o}</li>)}</ol>}
                <p className="mt-1"><span className="chip !h-6 !text-[11px]">{t(`rp_kind_${r.kind}`)}</span> {r.note}</p>
              </div>
              <div className="flex gap-2">
                {r.status !== 'resolved' && <button className="btn btn-outline btn-sm" onClick={() => set.mutate({ id: r.id, status: 'resolved' })}>{t('ad_resolve')}</button>}
                {r.status !== 'dismissed' && <button className="btn btn-ghost btn-sm" onClick={() => set.mutate({ id: r.id, status: 'dismissed' })}>{t('ad_dismiss')}</button>}
                {r.status !== 'open' && <button className="btn btn-ghost btn-sm" onClick={() => set.mutate({ id: r.id, status: 'open' })}>{t('ad_reopen')}</button>}
              </div>
            </div>
          </li>
        ))}
        {q.data?.length === 0 && <li className="py-4 text-center text-sm text-ink-3">{t('pr_no_data')}</li>}
      </ul>
    </div>
  );
}

function Refs() {
  const { t } = useI18n();
  const err = useErr();
  const utils = trpc.useUtils();
  const q = trpc.admin.refs.useQuery();
  const [f, setF] = useState({ code: '', label: '', kind: 'creator' as 'creator' | 'ambassador' | 'partner' | 'campaign', market: 'TR' });
  const add = trpc.admin.createRef.useMutation({ onSuccess: () => { setF((x) => ({ ...x, code: '', label: '' })); void utils.admin.refs.invalidate(); } });
  const del = trpc.admin.deleteRef.useMutation({ onSuccess: () => utils.admin.refs.invalidate() });
  return (
    <div className="card mt-6 p-5">
      <h2 className="flex items-center gap-2 font-semibold"><LuMegaphone /> {t('ad_refs')}</h2>
      <p className="mt-1 text-xs text-ink-3">{t('ad_refs_s')}</p>
      <form className="mt-4 grid gap-2 sm:grid-cols-[1fr_1.4fr_1fr_0.6fr_auto]" onSubmit={(e) => { e.preventDefault(); add.mutate(f); }}>
        <input className="input input-sm" placeholder={t('ad_ref_code')} value={f.code} onChange={(e) => setF({ ...f, code: e.target.value.toLowerCase() })} />
        <input className="input input-sm" placeholder={t('ad_ref_label')} value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })} />
        <select className="input input-sm" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value as typeof f.kind })}>
          {(['creator', 'ambassador', 'partner', 'campaign'] as const).map((k) => <option key={k} value={k}>{t(`ref_${k}`)}</option>)}
        </select>
        <input className="input input-sm uppercase" placeholder={t('ad_ref_market')} maxLength={8} value={f.market} onChange={(e) => setF({ ...f, market: e.target.value })} />
        <button className="btn btn-primary btn-sm" disabled={add.isPending || f.code.length < 2 || !f.label}>{t('ad_ref_add')}</button>
      </form>
      {add.error && <ErrorBox className="mt-2">{err(errCode(add.error))}</ErrorBox>}
      <div className="mt-4">
        <DataTable dense rows={q.data?.codes ?? []} rowKey={(c) => c.code} search={(c) => `${c.code} ${c.label} ${c.market}`} initialSort={{ key: 'signups', dir: 'desc' }} columns={[
          { key: 'code', header: t('ad_ref_code'), sort: (c) => c.code, cell: (c) => <span className="font-mono text-xs">{c.code}</span> },
          { key: 'label', header: t('ad_ref_label'), sort: (c) => c.label, cell: (c) => c.label },
          { key: 'kind', header: t('ad_ref_kind'), sort: (c) => c.kind, hideSm: true, cell: (c) => t(`ref_${c.kind}`) },
          { key: 'market', header: t('ad_ref_market'), sort: (c) => c.market, hideSm: true, cell: (c) => c.market },
          { key: 'waitlist', header: t('ad_waitlist'), sort: (c) => c.waitlist, align: 'right', cell: (c) => <span className="tabular-nums">{c.waitlist}</span> },
          { key: 'signups', header: t('ad_signups'), sort: (c) => c.signups, align: 'right', cell: (c) => <span className="tabular-nums">{c.signups}</span> },
          { key: 'activated', header: t('ad_activated'), sort: (c) => c.activated, align: 'right', cell: (c) => <span className="tabular-nums">{c.activated}</span> },
          { key: 'x', header: '', align: 'right', cell: (c) => <button className="btn btn-ghost btn-icon btn-sm hover:!text-bad" aria-label={t('delete')} onClick={(e) => { e.stopPropagation(); if (window.confirm(t('confirm_delete'))) del.mutate({ code: c.code }); }}><LuTrash2 /></button> },
        ]} />
        {q.data && <p className="mt-2 text-sm text-ink-2">{t('ad_invites')}: <strong className="tabular-nums">{q.data.invites.signups}</strong> {t('ad_signups')} · <strong className="tabular-nums">{q.data.invites.activated}</strong> {t('ad_activated')}</p>}
      </div>
    </div>
  );
}

export default function Admin() {
  const { t, lang } = useI18n();
  const s = trpc.admin.stats.useQuery();
  const users = trpc.admin.users.useQuery();
  const utils = trpc.useUtils();
  const setPlan = trpc.admin.setPlan.useMutation({ onSuccess: () => utils.admin.users.invalidate() });
  if (!s.data) return <Shell><PageLoader /></Shell>;
  const d = s.data;
  const hitRate = d.ai.calls ? Math.round((d.ai.cachedCalls / d.ai.calls) * 100) : 0;
  return (
    <Shell wide>
      <PageHero icon={<LuShieldCheck />} title={t('ad_title')} />
      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
        <Stat label={t('ad_waitlist')} value={d.waitlist} icon={<LuMail />} />
        <Stat label={t('ad_users')} value={d.users} icon={<LuUsers />} />
        <Stat label={t('ad_new7')} value={d.newUsers7d} icon={<LuUsers />} />
        <Stat label={t('ad_courses')} value={d.courses} icon={<LuBookOpen />} />
        <Stat label={t('ad_completed')} value={d.completedCourses} icon={<LuTarget />} />
        <Stat label={t('pr_certs')} value={d.certificates} icon={<LuAward />} />
        <Stat label={t('ad_pass')} value={`%${d.quizPassRate}`} icon={<LuTarget />} />
      </div>

      <div className="card mt-6 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 font-semibold"><LuCpu /> {t('ad_ai')}</h2>
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="chip">{d.ai.provider} · {d.ai.models.light} / {d.ai.models.heavy}</span>
            <span className="chip chip-gold">{t('ad_cache_rate')}: %{hitRate}</span>
            <span className="chip"><LuDatabase /> {d.ai.cacheEntries} · {d.ai.cacheHits} hit</span>
            <span className="chip">{t('ad_tokens')}: {d.ai.inTokens.toLocaleString()} / {d.ai.outTokens.toLocaleString()}</span>
          </div>
        </div>
        <div className="mt-4">
          <DataTable dense rows={d.ai.byTask} rowKey={(r) => `${r.task}${r.tier}`} search={(r) => r.task} initialSort={{ key: 'calls', dir: 'desc' }} columns={[
            { key: 'task', header: 'task', sort: (r) => r.task, cell: (r) => <span className="font-mono text-xs">{r.task}</span> },
            { key: 'tier', header: 'tier', sort: (r) => r.tier, cell: (r) => <span className={r.tier === 'heavy' ? 'chip chip-brand' : 'chip'}>{r.tier}</span> },
            { key: 'calls', header: 'calls', sort: (r) => r.calls, align: 'right', cell: (r) => <span className="tabular-nums">{r.calls}</span> },
            { key: 'cached', header: 'cached', sort: (r) => r.cached, align: 'right', cell: (r) => <span className="tabular-nums">{r.cached}</span> },
            { key: 'failed', header: 'failed', sort: (r) => r.failed, align: 'right', cell: (r) => <span className={cx('tabular-nums', r.failed > 0 && 'font-semibold text-bad')}>{r.failed}</span> },
            { key: 'in', header: 'in', sort: (r) => r.inT, align: 'right', hideSm: true, cell: (r) => <span className="tabular-nums">{r.inT.toLocaleString()}</span> },
            { key: 'out', header: 'out', sort: (r) => r.outT, align: 'right', hideSm: true, cell: (r) => <span className="tabular-nums">{r.outT.toLocaleString()}</span> },
            { key: 'ms', header: 'ms', sort: (r) => r.ms, align: 'right', hideSm: true, cell: (r) => <span className="tabular-nums">{Math.round(r.ms)}</span> },
          ]} />
        </div>
      </div>

      <Outcomes />
      <Reports />
      <Refs />

      <div className="card mt-6 p-5">
        <DataTable rows={users.data ?? []} rowKey={(u) => u.id} search={(u) => `${u.username} ${u.fullName} ${u.email}`} initialSort={{ key: 'created', dir: 'desc' }}
          title={<h2 className="flex items-center gap-2 font-semibold"><LuUsers /> {t('ad_users')} <span className="text-sm font-normal text-ink-3">{users.data?.length ?? 0}</span></h2>}
          columns={[
            { key: 'id', header: '#', sort: (u) => u.id, cell: (u) => <span className="text-ink-3 tabular-nums">{u.id}</span> },
            { key: 'name', header: t('dt_user'), sort: (u) => u.fullName || u.username, cell: (u) => <span className="font-medium">{u.fullName || u.username}{u.role === 'admin' && <span className="chip chip-brand ml-2 !min-h-5">admin</span>}</span> },
            { key: 'email', header: 'e-mail', sort: (u) => u.email, hideSm: true, cell: (u) => <span className="text-ink-2">{u.email}</span> },
            { key: 'xp', header: 'XP', sort: (u) => u.xp, align: 'right', cell: (u) => <span className="tabular-nums">{u.xp}</span> },
            { key: 'streak', header: t('dt_streak'), sort: (u) => u.streak, align: 'right', hideSm: true, cell: (u) => <span className="tabular-nums">{u.streak}</span> },
            { key: 'plan', header: t('dt_plan'), sort: (u) => u.plan, cell: (u) => (
              <select className="input input-sm !w-28 !text-xs" value={u.plan} onClick={(e) => e.stopPropagation()} onChange={(e) => setPlan.mutate({ userId: u.id, plan: e.target.value as 'free' | 'premium' })}><option value="free">free</option><option value="premium">premium</option></select>
            ) },
            { key: 'created', header: t('dt_created'), sort: (u) => u.createdAt, align: 'right', hideSm: true, cell: (u) => <span className="text-xs tabular-nums text-ink-3">{fmtDate(u.createdAt, lang)}</span> },
          ]} />
      </div>
    </Shell>
  );
}
