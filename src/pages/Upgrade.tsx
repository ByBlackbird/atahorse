import { Shell } from '../app/Shell';
import { UpgradeCard } from '../ui/Upgrade';

export default function Upgrade() {
  return (
    <Shell>
      <div className="card elev-2 mx-auto max-w-2xl overflow-hidden">
        <UpgradeCard reason="manual" page />
      </div>
    </Shell>
  );
}
