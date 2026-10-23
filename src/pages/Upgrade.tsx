import { LuCheck, LuCrown } from 'react-icons/lu';
import { Link } from '../lib/router';
import { trpc, errCode } from '../lib/trpc';
import { useErr, useI18n } from '../i18n/index';
import { Shell } from '../app/Shell';
import { ErrorBox, Spinner } from '../ui/kit';
import { useMe } from '../ui/providers';

export default function Upgrade() {
  const { t } = useI18n();
  const err = useErr();
  const { me } = useMe();
  const utils = trpc.useUtils();
  const up = trpc.profile.upgrade.useMutation({ onSuccess: () => { void utils.auth.me.invalidate(); void utils.profile.invalidate(); } });
  const premium = me?.plan === 'premium' || up.isSuccess;
  return (
    <Shell>
      <div className="card mx-auto max-w-md p-8 text-center">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-gold text-xl text-[#1d1405]"><LuCrown /></span>
        <h1 className="h-display mt-5 text-3xl">{t('u_title')}</h1>
        <p className="mt-2 text-ink-2">{t('u_sub')}</p>
        <ul className="mx-auto mt-6 max-w-xs space-y-2 text-left text-sm">
          {[t('n_title'), t('s_translate'), t('ai_title'), t('c_title')].map((x) => <li key={x} className="flex items-center gap-2"><LuCheck className="text-ok" /> {x}</li>)}
        </ul>
        {up.error && <ErrorBox className="mt-5">{err(errCode(up.error))}</ErrorBox>}
        {premium ? (
          <><p className="mt-6 font-semibold text-ok">{t('u_done')}</p><Link to="/kurs-olustur" className="btn btn-primary mt-4">{t('nav_new')}</Link></>
        ) : (
          <button className="btn btn-primary btn-lg mt-6 w-full" disabled={up.isPending} onClick={() => up.mutate()}>{up.isPending ? <Spinner className="h-4 w-4" /> : t('u_btn')}</button>
        )}
      </div>
    </Shell>
  );
}
