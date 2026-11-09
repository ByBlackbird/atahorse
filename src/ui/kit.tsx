// Temel arayüz bileşenleri — düz yüzey, ince çizgi, token renkleri.
import { useEffect, useRef, type ReactNode } from 'react';
import { LuX, LuTriangleAlert } from 'react-icons/lu';
import { useTheme } from './providers';

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

export function Logo({ className = 'h-7', variant }: { className?: string; variant?: 'light' | 'dark' }) {
  const { theme } = useTheme();
  const dark = variant ? variant === 'dark' : theme === 'ink';
  return <img src={dark ? '/assets/wordmark-gold.png' : '/assets/wordmark-navy-gold.png'} alt="ATAhorse.ai" className={cx(className, 'w-auto select-none')} draggable={false} />;
}

/**
 * Amblem (at başı) — uygulama içinde yazılı logo yerine kullanılır.
 * Kural: yazılı logo yalnız tanıtım yüzeylerinde (ana sayfa üst çubuğu ve alt bilgisi). Uygulama, giriş ve
 * sertifikada amblem + gerekirse arayüz yazı tipinde "Atahorse" adı → logo, çevresindeki tipografiyle çatışmaz.
 */
export function Mark({ className = 'h-8', variant }: { className?: string; variant?: 'light' | 'dark' }) {
  const { theme } = useTheme();
  const dark = variant ? variant === 'dark' : theme === 'ink';
  return <img src={dark ? '/assets/emblem-gold.png' : '/assets/emblem-ink.png'} alt="" className={cx(className, 'w-auto select-none')} draggable={false} />;
}

/** Amblem + ad: uygulama kenar çubuğu gibi adın görünmesi gereken dar yerler için. */
export function BrandLockup({ variant, className }: { variant?: 'light' | 'dark'; className?: string }) {
  return (
    <span className={cx('inline-flex items-center gap-2.5', className)}>
      <Mark className="h-8" variant={variant} />
      <span className="font-display text-[22px] font-bold leading-none tracking-tight">Atahorse</span>
    </span>
  );
}

export function Ring({ value, size = 56, stroke = 5, color = 'var(--c-gold)', children, label }: { value: number; size?: number; stroke?: number; color?: string; children?: ReactNode; label?: string }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  return (
    <div className="relative inline-grid place-items-center" style={{ width: size, height: size }} role="img" aria-label={label ?? `${Math.round(v * 100)}%`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--c-line)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={`${v * c} ${c}`} style={{ transition: 'stroke-dasharray .6s cubic-bezier(.22,1,.36,1)' }} />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  );
}

export function Bar({ value, className, color = 'bg-gold' }: { value: number; className?: string; color?: string }) {
  return (
    <div className={cx('h-2.5 w-full overflow-hidden rounded-full bg-surface-3', className)} role="progressbar" aria-valuenow={Math.round(value * 100)} aria-valuemin={0} aria-valuemax={100}>
      <div className={cx('h-full rounded-full transition-[width] duration-500', color)} style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }} />
    </div>
  );
}

export function Spinner({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={cx(className, 'animate-spin text-ink-3')} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity=".25" strokeWidth="2.5" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

export function PageLoader() {
  return <div className="grid min-h-[50vh] place-items-center"><Spinner className="h-7 w-7" /></div>;
}

export function ErrorBox({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div role="alert" className={cx('flex items-start gap-2 rounded-xl border border-bad/30 bg-bad-soft px-3.5 py-2.5 text-sm text-bad', className)}>
      <LuTriangleAlert className="mt-0.5 shrink-0" /> <span>{children}</span>
    </div>
  );
}

/**
 * İç sayfa girişi (v5): lacivert bant, küçük üst başlık, büyük başlık, açıklama, eylemler.
 * Tüm iç sayfalar aynı girişle açılır → kullanıcı nerede olduğunu her ekranda aynı yerden okur.
 */
export function PageHero({ eyebrow, title, sub, icon, actions, aside, className }: {
  eyebrow?: ReactNode; title: ReactNode; sub?: ReactNode; icon?: ReactNode; actions?: ReactNode; aside?: ReactNode; className?: string;
}) {
  return (
    <header className={cx('hero-night flex flex-wrap items-center gap-6 p-6 md:p-8', className)}>
      {icon && <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-brand text-2xl text-brand-ink" aria-hidden>{icon}</span>}
      <div className="min-w-0 flex-1">
        {eyebrow && <p className="text-xs font-bold uppercase tracking-[0.14em] text-on-night-2">{eyebrow}</p>}
        <h1 className="h-display mt-1.5 text-3xl md:text-4xl">{title}</h1>
        {sub && <p className="hero-sub mt-2 max-w-2xl">{sub}</p>}
        {actions && <div className="mt-5 flex flex-wrap gap-3">{actions}</div>}
      </div>
      {aside}
    </header>
  );
}

export function Empty({ icon, title, body, action }: { icon: ReactNode; title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center px-6 py-14 text-center">
      <div className="mb-4 grid h-12 w-12 place-items-center rounded-full bg-surface-2 text-xl text-ink-2">{icon}</div>
      <h3 className="h-display text-lg">{title}</h3>
      {body && <p className="mt-2 max-w-md text-sm text-ink-2">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Modal({ open, onClose, title, children, wide, bare, label }: { open: boolean; onClose: () => void; title?: string; children: ReactNode; wide?: boolean; bare?: boolean; label?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const on = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key !== 'Tab' || !ref.current) return;
      // Odak tuzağı: Tab diyalog içinde döner
      const f = [...ref.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])')];
      if (!f.length) return;
      const first = f[0]!, last = f[f.length - 1]!;
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    window.addEventListener('keydown', on);
    ref.current?.querySelector<HTMLElement>('button, input, textarea, [tabindex]')?.focus();
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', on); document.body.style.overflow = ''; prev?.focus?.(); };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="scrim-blur anim-fade fixed inset-0 z-[90] grid place-items-end p-0 sm:place-items-center sm:p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={ref} role="dialog" aria-modal="true" aria-label={title ?? label} className={cx('card elev-3 anim-modal max-h-[90dvh] w-full overflow-auto rounded-b-none sm:rounded-b-[16px]', wide ? 'sm:max-w-2xl' : 'sm:max-w-lg', bare && '!p-0')}>
        {title && (
          <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
            <h2 className="font-semibold">{title}</h2>
            <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label="close"><LuX /></button>
          </div>
        )}
        {bare ? children : <div className="p-5">{children}</div>}
      </div>
    </div>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-ink-3">{hint}</span>}
    </label>
  );
}

export function Stat({ label, value, icon }: { label: string; value: ReactNode; icon?: ReactNode }) {
  return (
    <div className="card-i px-4 py-3.5">
      <div className="flex items-center gap-1.5 text-xs text-ink-3">{icon}{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}
