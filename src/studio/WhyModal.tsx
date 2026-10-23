import { trpc } from '../lib/trpc';
import { useI18n } from '../i18n/index';
import { Modal } from '../ui/kit';

export default function WhyModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, lang } = useI18n();
  const engine = trpc.catalog.engine.useQuery(undefined, { enabled: open });
  return (
    <Modal open={open} onClose={onClose} title={t('s_why')} wide>
      <ul className="space-y-4">
        {engine.data?.principles.map((p) => (
          <li key={p.id}>
            <p className="font-semibold">{p.name[lang]}</p>
            <p className="text-sm text-ink-2">{p.how[lang]}</p>
            <p className="text-xs italic text-ink-3">{p.evidence}</p>
          </li>
        ))}
      </ul>
    </Modal>
  );
}
