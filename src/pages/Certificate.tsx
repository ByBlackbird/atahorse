// Sertifika v5 — herkese açık, yazdırılabilir (A4 yatay), QR ile doğrulanabilir.
// İki tasarım: "Klasik" (krem kâğıt, altın çerçeve, lacivert kurdele) ve "Gece" (altın kenarlı lacivert pano).
// Satın alınan iki şablonun dilinden uyarlandı; tüm süsler özgün SVG. Kurdelede yazılı logo yerine dizgi ad,
// marka işareti olarak yalnız mühürdeki amblem kullanılır (tek logo, tek odak).
// Uydurma imza/isim yok: alt bilgi platform + tarih, ortada mühür, sağda QR ve doğrulama kodu.
import { useEffect, useRef, useState } from 'react';
import { LuPrinter, LuShieldCheck, LuArrowLeft } from 'react-icons/lu';
import { BRAND, token } from '../lib/brand';
import { Link } from '../lib/router';
import { trpc } from '../lib/trpc';
import { fmtDate, useI18n } from '../i18n/index';
import { Shell } from '../app/Shell';
import { ErrorBox, PageLoader, cx } from '../ui/kit';
import { qrMatrix } from '../lib/qr';

type CertStyle = 'classic' | 'night';
const STYLE_KEY = 'ah:cert:style';
const readStyle = (): CertStyle => {
  const fromUrl = new URLSearchParams(window.location.search).get('stil');
  if (fromUrl === 'gece' || fromUrl === 'night') return 'night';
  if (fromUrl === 'klasik' || fromUrl === 'classic') return 'classic';
  try { return localStorage.getItem(STYLE_KEY) === 'night' ? 'night' : 'classic'; } catch { return 'classic'; }
};

/** QR her iki tasarımda da açık zemin üzerinde koyu modül: okutulabilirlik süsten önce gelir. */
function QR({ text }: { text: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const m = qrMatrix(text);
    const c = ref.current!;
    const q = 3, n = m.length + q * 2, s = 8;
    c.width = c.height = n * s;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = BRAND.paper.surface; ctx.fillRect(0, 0, c.width, c.height);
    ctx.fillStyle = token('--c-night', BRAND.paper.night, c);
    m.forEach((row, y) => row.forEach((on, x) => { if (on) ctx.fillRect((x + q) * s, (y + q) * s, s, s); }));
  }, [text]);
  return <canvas ref={ref} aria-label="QR" />;
}

/** Köşe süsü: çift çizgi + iki kıvrım + yaprak. currentColor ile boyanır (altın). */
function Corner({ pos }: { pos: 'tl' | 'tr' | 'bl' | 'br' }) {
  return (
    <svg className={`cert-corner ${pos}`} viewBox="0 0 120 120" fill="none" aria-hidden>
      <path d="M6 114V6h108" stroke="currentColor" strokeWidth="3" />
      <path d="M14 114V14h100" stroke="currentColor" strokeWidth="1.2" />
      <path d="M14 70c0-30 18-50 46-56" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M22 62c4-14 16-22 28-20 10 2 12 14 4 18-6 3-12-2-9-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M62 22c-14 4-22 16-20 28 2 10 14 12 18 4 3-6-2-12-7-9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M28 28c10 2 18 8 22 18-10-2-18-8-22-18Z" fill="currentColor" />
      <circle cx="14" cy="14" r="4" fill="currentColor" />
      <path d="M14 96c8 0 12-6 12-12M96 14c0 8-6 12-12 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

/** İsim altı kıvrımlı çizgi. */
function Flourish() {
  return (
    <svg className="cert-flourish" viewBox="0 0 580 24" fill="none" aria-hidden preserveAspectRatio="none">
      <path d="M40 12h500" stroke="currentColor" strokeWidth="1.5" />
      <path d="M40 12c-14 0-22-8-16-14 5-5 13 0 9 5-3 3-8 1-7-2M540 12c14 0 22-8 16-14-5-5-13 0-9 5 3 3 8 1 7-2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M290 4l8 8-8 8-8-8z" fill="currentColor" />
    </svg>
  );
}

/** Kurdele: logonun taşıyıcısı. Klasikte lacivert (altın logo), gecede altın (lacivert logo). */
function Ribbon({ style }: { style: CertStyle }) {
  const fill = style === 'classic' ? 'var(--c-night)' : 'var(--cert-gold)';
  const fold = style === 'classic' ? 'color-mix(in srgb, var(--c-night) 70%, black)' : 'var(--c-gold-ink)';
  return (
    <div className="cert-ribbon" aria-hidden>
      <svg viewBox="0 0 300 70" width="100%" fill="none">
        <path d="M0 22h34v40H0l12-20z" style={{ fill: fold }} />
        <path d="M300 22h-34v40h34l-12-20z" style={{ fill: fold }} />
        <path d="M22 12h256v44H22z" style={{ fill }} />
        <path d="M22 56l12 6V56zM278 56l-12 6V56z" style={{ fill: fold }} />
        <path d="M28 18h244M28 50h244" stroke="currentColor" strokeOpacity=".5" strokeWidth="1" style={{ color: style === 'classic' ? 'var(--c-gold)' : 'var(--c-night)' }} />
      </svg>
      <span className="cert-ribbon-name">Atahorse</span>
    </div>
  );
}

/** Mühür: 32 uçlu altın yıldız, çevresinde yazı, ortada Atahorse amblemi. */
function Seal({ text, style }: { text: string; style: CertStyle }) {
  const pts = Array.from({ length: 64 }, (_, i) => {
    const a = (i / 64) * Math.PI * 2, r = i % 2 ? 46 : 50;
    return `${(50 + r * Math.cos(a)).toFixed(2)},${(50 + r * Math.sin(a)).toFixed(2)}`;
  }).join(' ');
  return (
    <svg className="cert-seal" viewBox="0 0 100 100" aria-hidden>
      <defs><path id="seal-arc" d="M50 50m-33 0a33 33 0 1 1 66 0a33 33 0 1 1-66 0" /></defs>
      <polygon points={pts} style={{ fill: 'var(--cert-gold)' }} />
      <circle cx="50" cy="50" r="41" style={{ fill: style === 'classic' ? 'var(--c-night)' : 'var(--c-gold-ink)' }} />
      <circle cx="50" cy="50" r="38" fill="none" strokeWidth=".8" style={{ stroke: 'var(--c-gold)' }} />
      <circle cx="50" cy="50" r="26" fill="none" strokeWidth=".8" style={{ stroke: 'var(--c-gold)' }} />
      <text fontSize="6.2" fontFamily="Inter, sans-serif" fontWeight="700" letterSpacing="1.2" style={{ fill: 'var(--c-gold)' }}>
        <textPath href="#seal-arc">{text}{text}</textPath>
      </text>
      <image href="/assets/emblem-gold.png" x="31" y="31" width="38" height="38" />
    </svg>
  );
}

export function CertificateSheet({ style, name, title, level, issued, score, code, url }: {
  style: CertStyle; name: string; title: string; level: string; issued: string; score: number; code: string; url: string;
}) {
  const { t } = useI18n();
  return (
    <article data-sheet="paper" className={cx('cert print-sheet', style === 'classic' ? 'cert-classic' : 'cert-night')} aria-label={t('c_title')}>
      <div className="cert-panel">
        {(['tl', 'tr', 'bl', 'br'] as const).map((p) => <Corner key={p} pos={p} />)}
        <Ribbon style={style} />
        <p className="cert-big">{t('c_big')}</p>
        <p className="cert-kind">{t('c_title')}</p>
        <p className="cert-presented">{t('c_presented')}</p>
        <p className="cert-name">{name}</p>
        <Flourish />
        <p className="cert-body">{t('c_body')}</p>
        <p className="cert-course">{title}</p>
        <p className="cert-level">{level} · {t('c_score')} %{score}</p>
        <div className="cert-foot">
          <div className="cert-sign"><b>{t('c_platform')}</b>{t('c_date')}: {issued}</div>
          <Seal text={t('c_seal')} style={style} />
          <div className="cert-qr">
            <p><span>{t('c_code')}</span><strong>{code}</strong>{url.replace(/^https?:\/\//, '')}</p>
            <QR text={url} />
          </div>
        </div>
      </div>
    </article>
  );
}

export default function Certificate({ code }: { code: string }) {
  const { t, lang } = useI18n();
  const q = trpc.pub.verify.useQuery({ code });
  const [style, setStyle] = useState<CertStyle>(readStyle);
  useEffect(() => { try { localStorage.setItem(STYLE_KEY, style); } catch { /* gizli pencere */ } }, [style]);
  if (!q.data) return <Shell><PageLoader /></Shell>;
  if (!q.data.valid) return <Shell><ErrorBox>{t('v_invalid')}</ErrorBox></Shell>;
  const c = q.data;
  const url = `${window.location.origin}/dogrula?kod=${encodeURIComponent(c.code)}`;
  return (
    <Shell>
      <div className="no-print mb-5 flex flex-wrap items-center justify-between gap-3">
        <Link to="/profil" className="btn btn-ghost btn-sm -ml-2"><LuArrowLeft /> {t('nav_profile')}</Link>
        <div className="flex flex-wrap items-center gap-3">
          <span className="chip chip-gold"><LuShieldCheck /> {t('v_valid')}</span>
          <div className="seg" role="tablist" aria-label={t('c_style')}>
            <button role="tab" aria-pressed={style === 'classic'} onClick={() => setStyle('classic')}>{t('c_style_classic')}</button>
            <button role="tab" aria-pressed={style === 'night'} onClick={() => setStyle('night')}>{t('c_style_night')}</button>
          </div>
          <button className="btn btn-pink btn-sm" onClick={() => window.print()}><LuPrinter /> {t('c_print')}</button>
        </div>
      </div>
      <div className="mx-auto max-w-5xl overflow-hidden elev-3 rounded-2xl print:rounded-none">
        <CertificateSheet style={style} name={c.name} title={c.title} level={t(`lv_${c.level}`)} issued={fmtDate(c.issuedAt, lang)} score={c.scorePct} code={c.code} url={url} />
      </div>
    </Shell>
  );
}
