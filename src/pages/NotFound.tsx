import { Link } from '../lib/router';
import { useI18n } from '../i18n/index';
import { Shell } from '../app/Shell';

export default function NotFound() {
  const { t } = useI18n();
  return (
    <Shell>
      <div className="grid min-h-[60vh] place-items-center text-center">
        <div>
          <p className="font-display text-6xl text-gold">404</p>
          <h1 className="h-display mt-4 text-2xl">{t('notfound_t')}</h1>
          <p className="mt-2 text-ink-2">{t('notfound_s')}</p>
          <Link to="/" className="btn btn-primary mt-6">{t('home')}</Link>
        </div>
      </div>
    </Shell>
  );
}
