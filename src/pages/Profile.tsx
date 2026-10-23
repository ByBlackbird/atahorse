// /profil — istatistikler, 8 kazanım rozeti, öğrenme grafiği, sertifikalar, Kağıt/Mürekkep tema, güvenlik.
import { useState } from 'react';
import { LuFootprints, LuFlame, LuCalendarCheck, LuBrain, LuLayers, LuMap, LuRepeat, LuAward, LuLock, LuBookOpen, LuClock, LuTarget, LuSun, LuMoon, LuLogOut, LuTrash2, LuSparkles, LuArrowRight } from 'react-icons/lu';
import { Link, useNavigate } from '../lib/router';
import { trpc } from '../lib/trpc';
import { fmtDate, useI18n } from '../i18n/index';
import { useTheme, useToast } from '../ui/providers';
import { Shell, LangSelect } from '../app/Shell';
import { Bar, Field, Modal, PageLoader, Ring, Stat, cx } from '../ui/kit';
import { METHODS } from '../../shared/engine/methods';
import type { MethodKey } from '../../shared/types';

const BADGE_ICON = { footprints: <LuFootprints />, flame: <LuFlame />, calendar: <LuCalendarCheck />, brain: <LuBrain />, layers: <LuLayers />, map: <LuMap />, repeat: <LuRepeat />, award: <LuAward /> } as const;

export default function Profile() {
  const { t, lang } = useI18n();
  const { theme, setTheme } = useTheme();
  const toast = useToast();
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const q = trpc.profile.page.useQuery({ locale: lang });
  const settings = trpc.profile.settings.useMutation({ onSuccess: () => { void utils.auth.me.invalidate(); toast.push('ok', t('saved')); } });
  const logoutAll = trpc.auth.logoutAll.useMutation({ onSuccess: async () => { await utils.invalidate(); navigate('/'); } });
  const del = trpc.profile.deleteAccount.useMutation({ onSuccess: async () => { await utils.invalidate(); navigate('/'); } });
  const [name, setName] = useState<string | null>(null);
  const [delOpen, setDelOpen] = useState(false);
  const [confirm, setConfirm] = useState('');
  if (!q.data) return <Shell><PageLoader /></Shell>;
  const d = q.data;
  const earned = d.badges.filter((b) => b.earned).length;

  return (
    <Shell>
      {/* Başlık */}
      <div className="card flex flex-wrap items-center gap-6 p-6">
        <Ring value={d.level.progress} size={92} stroke={6}>
          <div><div className="text-[10px] uppercase tracking-wider text-ink-3">Lv</div><div className="text-2xl font-semibold">{d.level.level}</div></div>
        </Ring>
        <div className="min-w-0 flex-1">
          <h1 className="h-display text-2xl">{d.user.fullName || d.user.username}</h1>
          <p className="text-sm text-ink-3">@{d.user.username} · {t('pr_member_since', { d: fmtDate(d.user.createdAt, lang) })}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="chip chip-gold">{d.xp} XP</span>
            <span className="chip"><LuFlame className={d.streak ? 'text-gold' : ''} /> {t('streak_n', { n: d.streak })}</span>
            {d.profileName && <span className="chip chip-brand"><LuSparkles /> {d.profileName}</span>}
            <span className="chip">{d.user.plan === 'premium' ? t('pr_plan_premium') : t('pr_plan_free')}</span>
          </div>
        </div>
        {d.user.plan !== 'premium' && <Link to="/premium" className="btn btn-outline btn-sm">{t('pr_upgrade')}</Link>}
      </div>

      {/* İstatistikler */}
      <h2 className="mt-8 text-lg font-semibold">{t('pr_stats')}</h2>
      <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-6">
        <Stat label={t('pr_courses')} value={d.stats.courses} icon={<LuBookOpen />} />
        <Stat label={t('pr_completed')} value={d.stats.completedCourses} icon={<LuTarget />} />
        <Stat label={t('pr_minutes')} value={d.stats.minutes} icon={<LuClock />} />
        <Stat label={t('pr_answers')} value={d.stats.answers} icon={<LuBrain />} />
        <Stat label={t('pr_accuracy')} value={`%${d.stats.accuracy}`} icon={<LuTarget />} />
        <Stat label={t('pr_certs')} value={d.stats.certificates} icon={<LuAward />} />
      </div>

      {/* Rozetler */}
      <div className="mt-8 flex items-end justify-between">
        <h2 className="text-lg font-semibold">{t('pr_badges')}</h2>
        <span className="text-sm text-ink-3">{t('pr_badges_s', { a: earned, b: d.badges.length })}</span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
        {d.badges.map((b) => (
          <div key={b.key} className={cx('card p-4', b.earned ? 'border-gold/50' : '')}>
            <div className="flex items-center justify-between">
              <span className={cx('grid h-10 w-10 place-items-center rounded-full text-lg', b.earned ? 'bg-gold text-[#1d1405]' : 'bg-surface-2 text-ink-3')}>{BADGE_ICON[b.icon as keyof typeof BADGE_ICON]}</span>
              {!b.earned && <LuLock className="text-ink-3" />}
            </div>
            <p className="mt-3 font-semibold">{b.name}</p>
            <p className="text-xs text-ink-2">{b.desc}</p>
            <Bar value={b.value / b.target} className="mt-3" />
            <p className="mt-1 text-right text-[11px] tabular-nums text-ink-3">{b.value}/{b.target}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        {/* Öğrenme grafiği */}
        <div className="card p-5">
          <h2 className="font-semibold">{t('pr_cognitive')}</h2>
          <p className="mt-1 text-sm text-ink-2">{t('pr_cognitive_s')}</p>
          <p className="mt-5 text-xs font-semibold uppercase tracking-wider text-ink-3">{t('pr_method_acc')}</p>
          {d.cognitive.methods.length ? (
            <ul className="mt-2 space-y-2">
              {d.cognitive.methods.map((m) => (
                <li key={m.method} className="grid grid-cols-[9rem_1fr_4.5rem] items-center gap-3 text-sm">
                  <span className="truncate text-ink-2">{METHODS[m.method as MethodKey]?.name[lang] ?? m.method}</span>
                  <Bar value={m.accuracy / 100} color="bg-brand" />
                  <span className="text-right tabular-nums text-ink-3">%{m.accuracy} · {m.attempts}</span>
                </li>
              ))}
            </ul>
          ) : <p className="mt-2 text-sm text-ink-3">{t('pr_no_data')}</p>}
          <p className="mt-5 text-xs font-semibold uppercase tracking-wider text-ink-3">{t('pr_mode_use')}</p>
          {d.cognitive.modes.length ? (
            <div className="mt-2 flex flex-wrap gap-2">{d.cognitive.modes.map((m) => <span key={m.mode} className="chip">{m.mode === 'mindmap' ? t('s_map') : t(`s_mode_${m.mode}`)} · {t('minutes_short', { n: m.minutes })}</span>)}</div>
          ) : <p className="mt-2 text-sm text-ink-3">{t('pr_no_data')}</p>}
          <Link to="/profil-testi" className="btn btn-ghost btn-sm mt-4 -ml-2">{t('t_retake')} <LuArrowRight /></Link>
        </div>

        {/* Sertifikalar */}
        <div className="card p-5">
          <h2 className="font-semibold">{t('pr_certificates')}</h2>
          {d.certificates.length ? (
            <ul className="mt-3 divide-y divide-line">
              {d.certificates.map((c) => (
                <li key={c.code} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0"><p className="truncate font-medium">{c.title}</p><p className="text-xs text-ink-3">{c.code} · {fmtDate(c.issuedAt, lang)}</p></div>
                  <Link to={`/sertifika/${c.code}`} className="btn btn-outline btn-sm"><LuAward /></Link>
                </li>
              ))}
            </ul>
          ) : <p className="mt-3 text-sm text-ink-3">{t('pr_no_data')}</p>}
        </div>
      </div>

      {/* Ayarlar */}
      <h2 className="mt-8 text-lg font-semibold">{t('pr_settings')}</h2>
      <div className="mt-3 grid gap-4 lg:grid-cols-2">
        <div className="card space-y-5 p-5">
          <div>
            <p className="text-sm font-medium">{t('pr_theme')}</p>
            <p className="text-xs text-ink-3">{t('pr_theme_s')}</p>
            <div className="mt-3 grid grid-cols-2 gap-3">
              {([['paper', <LuSun key="s" />, '#F6F7F6', '#121619'], ['ink', <LuMoon key="m" />, '#0D1A26', '#EEF0EE']] as const).map(([k, icon, bg, fg]) => (
                <button key={k} onClick={() => { setTheme(k); settings.mutate({ theme: k }); }}
                  className={cx('rounded-xl border p-3 text-left transition-colors', theme === k ? 'border-brand ring-1 ring-brand' : 'border-line hover:border-line-strong')}>
                  <div className="flex h-16 items-end rounded-lg border border-line p-2" style={{ background: bg, color: fg }}>
                    <span className="h-display text-sm">Aa</span><span className="ml-auto h-2 w-8 rounded-full" style={{ background: '#DCA037' }} />
                  </div>
                  <p className="mt-2 flex items-center gap-1.5 text-sm font-medium">{icon} {t(`theme_${k}`)}</p>
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 text-sm font-medium">{t('pr_language')}</p>
            <LangSelect />
          </div>
          <Field label={t('a_fullname')}>
            <div className="flex gap-2">
              <input className="input" value={name ?? d.user.fullName} onChange={(e) => setName(e.target.value)} maxLength={80} />
              <button className="btn btn-outline" disabled={name === null || settings.isPending} onClick={() => name !== null && settings.mutate({ fullName: name })}>{t('save')}</button>
            </div>
          </Field>
        </div>
        <div className="card space-y-3 p-5">
          <p className="text-sm font-medium">{t('pr_security')}</p>
          <p className="text-xs text-ink-3">{d.user.email}</p>
          <button className="btn btn-outline w-full justify-start" onClick={() => logoutAll.mutate()}><LuLogOut /> {t('pr_logout_all')}</button>
          <button className="btn btn-ghost w-full justify-start !text-bad" onClick={() => setDelOpen(true)}><LuTrash2 /> {t('pr_delete')}</button>
        </div>
      </div>

      <Modal open={delOpen} onClose={() => setDelOpen(false)} title={t('pr_delete')}>
        <p className="text-sm text-ink-2">{t('confirm_delete')}</p>
        <Field label={t('pr_delete_confirm')}><input className="input mt-1" value={confirm} onChange={(e) => setConfirm(e.target.value)} /></Field>
        <div className="mt-5 flex justify-end gap-2">
          <button className="btn btn-ghost" onClick={() => setDelOpen(false)}>{t('cancel')}</button>
          <button className="btn btn-primary !bg-bad" disabled={confirm !== 'DELETE' || del.isPending} onClick={() => del.mutate({ confirm: 'DELETE' })}>{t('delete')}</button>
        </div>
      </Modal>
    </Shell>
  );
}
