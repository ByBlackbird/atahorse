// Premium yükseltme — tek içerik iki yüzeyde: global modal (karartma + bulanıklık) ve /premium sayfası.
// Modal; sunucu PAYMENT_REQUIRED döndürdüğünde (ör. ücretsiz kurs hakkı doldu) ya da Premium öğesine tıklanınca açılır.
import { useEffect, useState } from 'react';
import { LuCrown, LuCheck, LuInfinity, LuLanguages, LuSparkles, LuAward, LuX, LuArrowRight } from 'react-icons/lu';
import { Link } from '../lib/router';
import { trpc, errCode } from '../lib/trpc';
import { useErr, useI18n } from '../i18n/index';
import { onUpgrade, openUpgrade, type UpgradeReason } from '../lib/upgrade-bus';
import { ErrorBox, Modal, Spinner, cx } from './kit';
import { useMe } from './providers';

export { openUpgrade };

/** Premium gerektiren eylemi sar: ücretsiz kullanıcıda modal açılır, Premium'da eylem çalışır. */
export function usePremium() {
  const { me } = useMe();
  const premium = me?.plan === 'premium' || me?.role === 'admin';
  return { premium, guard: (fn: () => void) => (premium ? fn() : openUpgrade('feature')) };
}

export function UpgradeCard({ reason, onClose, page }: { reason?: UpgradeReason; onClose?: () => void; page?: boolean }) {
  const { t } = useI18n();
  const err = useErr();
  const { me } = useMe();
  const utils = trpc.useUtils();
  const up = trpc.profile.upgrade.useMutation({ onSuccess: () => { void utils.auth.me.invalidate(); void utils.profile.invalidate(); void utils.catalog.invalidate(); } });
  const premium = me?.plan === 'premium' || up.isSuccess;
  const perks = [
    { icon: <LuInfinity />, title: t('up_p1'), body: t('up_p1_d') },
    { icon: <LuLanguages />, title: t('up_p2'), body: t('up_p2_d') },
    { icon: <LuSparkles />, title: t('up_p3'), body: t('up_p3_d') },
    { icon: <LuAward />, title: t('up_p4'), body: t('up_p4_d') },
  ];
  return (
    <div className="relative">
      {onClose && <button className="btn btn-ghost btn-icon absolute right-3 top-3 z-10" onClick={onClose} aria-label={t('close')}><LuX /></button>}
      {/* Üst bant: koyu marka yüzeyi, temadan bağımsız */}
      <div className={cx('bg-night px-6 pb-6 pt-8 text-on-night', page ? 'rounded-t-[16px]' : 'sm:rounded-t-[16px]')}>
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-gold text-xl text-on-gold"><LuCrown aria-hidden /></span>
        <h2 className="h-display mt-5 text-2xl md:text-3xl">{premium ? t('u_done') : t('up_title')}</h2>
        <p className="mt-2 text-sm text-on-night-2">{reason === 'limit' ? t('up_reason_limit') : reason === 'feature' ? t('up_reason_feature') : t('u_sub')}</p>
      </div>
      <div className="p-6">
        <ul className="grid gap-3 sm:grid-cols-2">
          {perks.map((p, i) => (
            <li key={p.title} className="anim-rise flex gap-3 rounded-xl border border-line bg-surface-2 p-3.5 transition-all duration-200 hover:-translate-y-0.5 hover:border-line-strong" style={{ animationDelay: `${60 + i * 50}ms` }}>
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent-ink">{p.icon}</span>
              <span><span className="block text-sm font-semibold">{p.title}</span><span className="mt-0.5 block text-xs text-ink-2">{p.body}</span></span>
            </li>
          ))}
        </ul>
        {up.error && <ErrorBox className="mt-4">{err(errCode(up.error))}</ErrorBox>}
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
          {premium ? (
            <Link to="/kurs-olustur" className="btn btn-primary" onClick={onClose}>{t('nav_new')} <LuArrowRight /></Link>
          ) : (
            <>
              {onClose && <button className="btn btn-ghost" onClick={onClose}>{t('up_later')}</button>}
              <button className="btn btn-gold btn-lg" disabled={up.isPending} onClick={() => up.mutate()}>
                {up.isPending ? <Spinner className="h-4 w-4" /> : <><LuCrown /> {t('u_btn')}</>}
              </button>
            </>
          )}
        </div>
        {premium && <p className="mt-3 flex items-center justify-end gap-1.5 text-sm font-semibold text-ok"><LuCheck /> {t('u_done')}</p>}
      </div>
    </div>
  );
}

/** Uygulama kökünde bir kez: olay kanalını dinler, modalı gösterir. */
export function UpgradeHost() {
  const { t } = useI18n();
  const { me } = useMe();
  const [reason, setReason] = useState<UpgradeReason | null>(null);
  useEffect(() => onUpgrade((r) => setReason(r)), []);
  if (!me) return null;
  return (
    <Modal open={reason !== null} onClose={() => setReason(null)} bare label={t('up_title')}>
      <UpgradeCard reason={reason ?? 'manual'} onClose={() => setReason(null)} />
    </Modal>
  );
}
