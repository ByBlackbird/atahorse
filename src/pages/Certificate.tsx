// Sertifika — herkese açık, yazdırılabilir (A4 yatay), QR ile doğrulanabilir.
import { useEffect, useRef } from 'react';
import { LuPrinter, LuShieldCheck, LuArrowLeft } from 'react-icons/lu';
import { Link } from '../lib/router';
import { trpc } from '../lib/trpc';
import { fmtDate, useI18n } from '../i18n/index';
import { Shell } from '../app/Shell';
import { ErrorBox, Logo, PageLoader } from '../ui/kit';
import { qrMatrix } from '../lib/qr';

function QR({ text, size = 112 }: { text: string; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const m = qrMatrix(text);
    const c = ref.current!;
    const q = 4, n = m.length + q * 2, s = Math.floor((size * 2) / n);
    c.width = c.height = n * s;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
    ctx.fillStyle = '#121619';
    m.forEach((row, y) => row.forEach((on, x) => { if (on) ctx.fillRect((x + q) * s, (y + q) * s, s, s); }));
  }, [text, size]);
  return <canvas ref={ref} style={{ width: size, height: size }} aria-label="QR" />;
}

export default function Certificate({ code }: { code: string }) {
  const { t, lang } = useI18n();
  const q = trpc.pub.verify.useQuery({ code });
  if (!q.data) return <Shell><PageLoader /></Shell>;
  if (!q.data.valid) return <Shell><ErrorBox>{t('v_invalid')}</ErrorBox></Shell>;
  const c = q.data;
  const url = `${window.location.origin}/dogrula?kod=${encodeURIComponent(c.code)}`;
  return (
    <Shell>
      <div className="no-print mb-4 flex items-center justify-between">
        <Link to="/profil" className="btn btn-ghost btn-sm -ml-2"><LuArrowLeft /> {t('nav_profile')}</Link>
        <button className="btn btn-primary btn-sm" onClick={() => window.print()}><LuPrinter /> {t('c_print')}</button>
      </div>
      <article className="print-sheet mx-auto aspect-[1.414/1] w-full max-w-5xl border border-line bg-[#FDFCF8] p-[4%] text-[#121619]">
        <div className="flex h-full flex-col border border-[#DCA037] p-[4%]">
          <div className="flex items-start justify-between">
            <Logo variant="light" className="h-[clamp(20px,3vw,36px)]" />
            <span className="inline-flex items-center gap-1.5 text-[clamp(9px,1vw,12px)] uppercase tracking-[0.2em] text-[#4f5b63]"><LuShieldCheck /> {t('v_valid')}</span>
          </div>
          <div className="my-auto text-center">
            <p className="text-[clamp(10px,1.2vw,14px)] uppercase tracking-[0.3em] text-[#B5841F]">{t('c_title')}</p>
            <p className="h-display mt-[3%] text-[clamp(24px,4.5vw,56px)]">{c.name}</p>
            <p className="mx-auto mt-[2%] max-w-xl text-[clamp(11px,1.3vw,16px)] text-[#4f5b63]">{t('c_body')}</p>
            <p className="h-display mt-[2.5%] text-[clamp(16px,2.4vw,30px)]">{c.title}</p>
            <p className="mt-[1%] text-[clamp(10px,1.1vw,14px)] text-[#4f5b63]">{t(`lv_${c.level}`)}</p>
          </div>
          <div className="flex items-end justify-between gap-4 border-t border-[#dfe4e1] pt-[2%] text-[clamp(9px,1vw,13px)]">
            <div className="space-y-1">
              <p><span className="text-[#7c8891]">{t('c_date')}:</span> {fmtDate(c.issuedAt, lang)}</p>
              <p><span className="text-[#7c8891]">{t('c_score')}:</span> %{c.scorePct}</p>
              <p><span className="text-[#7c8891]">{t('c_code')}:</span> <span className="font-semibold tracking-wider">{c.code}</span></p>
              <p className="text-[#7c8891]">{t('c_verify_at', { u: url.replace(/^https?:\/\//, '') })}</p>
            </div>
            <QR text={url} />
          </div>
        </div>
      </article>
    </Shell>
  );
}
