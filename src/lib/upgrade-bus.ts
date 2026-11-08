// Premium modalı için bağımlılıksız olay kanalı (trpc istemcisi ↔ arayüz arasında döngüsel içe aktarma olmasın).
export type UpgradeReason = 'limit' | 'feature' | 'manual';
const EVT = 'ah:upgrade';
export const openUpgrade = (reason: UpgradeReason = 'manual') => window.dispatchEvent(new CustomEvent<UpgradeReason>(EVT, { detail: reason }));
export const onUpgrade = (fn: (r: UpgradeReason) => void) => {
  const h = (e: Event) => fn((e as CustomEvent<UpgradeReason>).detail);
  window.addEventListener(EVT, h);
  return () => window.removeEventListener(EVT, h);
};
/** Sunucu ödeme gerektiren hatası (PAYMENT_REQUIRED / limit_reached) → modal. */
export const isPaymentError = (e: unknown) => {
  const x = e as { message?: string; data?: { code?: string } } | null;
  return !!x && (x.data?.code === 'PAYMENT_REQUIRED' || x.message === 'limit_reached');
};
