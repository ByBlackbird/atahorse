// Etkileşim geri bildirimi: çift tıklanan kart/satır kısa bir aksan halkasıyla "duyduğunu" gösterir.
// Tek tık/basılı tutma CSS :active ile (styles.css .card-i, .btn); burada yalnız çift tık nabzı.
import { useEffect } from 'react';

export function InteractionFeedback() {
  useEffect(() => {
    const on = (e: MouseEvent) => {
      const el = (e.target as HTMLElement | null)?.closest<HTMLElement>('.card-i, .dt tbody tr, .side-item, .side-sub');
      if (!el) return;
      el.dataset.pulse = '1';
      window.setTimeout(() => { delete el.dataset.pulse; }, 460);
    };
    window.addEventListener('dblclick', on);
    return () => window.removeEventListener('dblclick', on);
  }, []);
  return null;
}
