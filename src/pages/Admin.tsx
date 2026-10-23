import { LuUsers, LuBookOpen, LuAward, LuTarget, LuCpu, LuDatabase } from 'react-icons/lu';
import { trpc } from '../lib/trpc';
import { fmtDate, useI18n } from '../i18n/index';
import { Shell } from '../app/Shell';
import { PageLoader, Stat } from '../ui/kit';

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
      <h1 className="h-display text-3xl">{t('ad_title')}</h1>
      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-6">
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
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-ink-3"><tr><th className="py-2">task</th><th>tier</th><th className="text-right">calls</th><th className="text-right">cached</th><th className="text-right">failed</th><th className="text-right">in</th><th className="text-right">out</th><th className="text-right">ms</th></tr></thead>
            <tbody className="divide-y divide-line">
              {d.ai.byTask.map((r) => (
                <tr key={`${r.task}${r.tier}`}><td className="py-2 font-mono text-xs">{r.task}</td><td><span className={r.tier === 'heavy' ? 'chip chip-brand' : 'chip'}>{r.tier}</span></td>
                  <td className="text-right tabular-nums">{r.calls}</td><td className="text-right tabular-nums">{r.cached}</td><td className="text-right tabular-nums">{r.failed}</td>
                  <td className="text-right tabular-nums">{r.inT}</td><td className="text-right tabular-nums">{r.outT}</td><td className="text-right tabular-nums">{Math.round(r.ms)}</td></tr>
              ))}
              {d.ai.byTask.length === 0 && <tr><td colSpan={8} className="py-4 text-center text-ink-3">{t('pr_no_data')}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card mt-6 overflow-x-auto p-5">
        <h2 className="font-semibold">{t('ad_users')}</h2>
        <table className="mt-3 w-full text-sm">
          <thead className="text-left text-xs text-ink-3"><tr><th className="py-2">#</th><th>user</th><th>email</th><th className="text-right">XP</th><th className="text-right">streak</th><th>plan</th><th>created</th></tr></thead>
          <tbody className="divide-y divide-line">
            {users.data?.map((u) => (
              <tr key={u.id}>
                <td className="py-2 text-ink-3">{u.id}</td><td>{u.fullName || u.username}{u.role === 'admin' && <span className="chip chip-brand ml-2 !h-5">admin</span>}</td><td className="text-ink-2">{u.email}</td>
                <td className="text-right tabular-nums">{u.xp}</td><td className="text-right tabular-nums">{u.streak}</td>
                <td><select className="input !h-8 !w-28 !text-xs" value={u.plan} onChange={(e) => setPlan.mutate({ userId: u.id, plan: e.target.value as 'free' | 'premium' })}><option value="free">free</option><option value="premium">premium</option></select></td>
                <td className="text-xs text-ink-3">{fmtDate(u.createdAt, lang)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Shell>
  );
}
