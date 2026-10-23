// Öğrenme Stüdyosu — üçlü mod (Okuma / Podcast / Slayt) + Zihin Haritası + AI Asistan + hesap verebilirlik.
import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LuArrowLeft, LuBookOpen, LuHeadphones, LuPresentation, LuNetwork, LuSparkles, LuLanguages, LuShare2, LuMenu, LuX } from 'react-icons/lu';
import { Link } from '../lib/router';
import { trpc, errCode } from '../lib/trpc';
import { useErr, useI18n } from '../i18n/index';
import { Shell } from '../app/Shell';
import { ErrorBox, PageLoader, Ring, Spinner, cx } from '../ui/kit';
import { useToast } from '../ui/providers';
import { PROFILES } from '../../shared/engine/profiles';
import { LOCALES, type Locale, type ProfileKey } from '../../shared/types';
import type { Mode, SSlide } from './types';
import ModuleRail from './ModuleRail';
import ReadingMode from './ReadingMode';
import ModuleFooter from './ModuleFooter';
import AiPanel from './AiPanel';

const PodcastMode = lazy(() => import('./PodcastMode'));
const SlideMode = lazy(() => import('./SlideMode'));
const MindMap = lazy(() => import('./MindMap'));

function Translate({ courseId, current, original }: { courseId: number; current: Locale; original: Locale }) {
  const { t, lang } = useI18n();
  const err = useErr();
  const { push } = useToast();
  const utils = trpc.useUtils();
  const [open, setOpen] = useState(false);
  const [job, setJob] = useState<string | null>(null);
  const tr = trpc.course.translate.useMutation({
    onSuccess: (r) => { if (r.ready) void utils.course.view.invalidate(); else setJob(r.jobId); },
    onError: (e) => push('error', err(errCode(e))),
  });
  const jobQ = trpc.course.job.useQuery({ jobId: job ?? '00000000-0000-0000-0000-000000000000' }, { enabled: !!job, refetchInterval: 1500 });
  useEffect(() => {
    if (jobQ.data?.stage === 'done') { setJob(null); void utils.course.view.invalidate(); }
    if (jobQ.data?.stage === 'failed') { setJob(null); push('error', t('e_generic')); }
  }, [jobQ.data, utils, push, t]);
  const needs = current !== lang;
  return (
    <div className="relative">
      <button className={cx('btn btn-sm', needs ? 'btn-outline !border-brand !text-brand' : 'btn-ghost')} onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        {job || tr.isPending ? <Spinner className="h-3.5 w-3.5" /> : <LuLanguages />}
        <span className="hidden lg:inline">{job ? `${t('s_translating')} ${jobQ.data?.percent ?? 0}%` : t('s_translate')}</span>
        <span className="uppercase">{current}</span>
      </button>
      {open && (
        <div className="card anim-pop absolute right-0 top-10 z-40 w-44 p-1.5">
          {LOCALES.map((l) => (
            <button key={l} className={cx('flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm hover:bg-surface-2', l === current && 'font-semibold')}
              onClick={() => { setOpen(false); tr.mutate({ courseId, to: l }); }}>
              <span>{({ tr: 'Türkçe', en: 'English', ru: 'Русский' } as const)[l]}</span>
              <span className="text-xs uppercase text-ink-3">{l === original ? '•' : ''}{l}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Studio({ courseId }: { courseId: number }) {
  const { t, lang } = useI18n();
  const err = useErr();
  const { push } = useToast();
  const [viewLocale, setViewLocale] = useState<Locale>(lang);
  useEffect(() => setViewLocale(lang), [lang]);
  const q = trpc.course.view.useQuery({ courseId, locale: viewLocale }, {
    refetchInterval: (s) => (s.state.data && s.state.data.status !== 'ready' && s.state.data.status !== 'failed' ? 1500 : false),
  });
  const v = q.data?.status === 'ready' ? q.data : null;
  const [moduleIdx, setModuleIdx] = useState<number | null>(null);
  const [mode, setMode] = useState<Mode | null>(null);
  const [map, setMap] = useState(false);
  const [ai, setAi] = useState(false);
  const [railOpen, setRailOpen] = useState(false);
  const [sectionIdx, setSectionIdx] = useState(0);
  const [aiDeck, setAiDeck] = useState<SSlide[] | null>(null);
  const [lastWrong, setLastWrong] = useState(false);
  const share = trpc.course.share.useMutation({
    onSuccess: async ({ slug }) => {
      const url = `${window.location.origin}/p/${slug}`;
      try { await navigator.clipboard.writeText(url); push('ok', t('s_share_done')); } catch { window.prompt(t('s_share'), url); }
    },
  });

  // Başlangıç: ilk tamamlanmamış açık modül; profil giriş modu
  useEffect(() => {
    if (!v) return;
    if (moduleIdx === null) {
      const i = v.progress.findIndex((p) => p.unlocked && !p.completed);
      setModuleIdx(i >= 0 ? i : 0);
    }
    if (mode === null) setMode(PROFILES[v.course.profileKey as ProfileKey]?.entryMode ?? 'read');
    if (window.matchMedia('(min-width: 1280px)').matches && ai === false && moduleIdx === null) setAi(true);
  }, [v, moduleIdx, mode, ai]);

  // Kalp atışı: görünür sekmede 30 sn'de bir süre + mod kaydı
  const hb = trpc.learn.heartbeat.useMutation();
  const tick = useRef(Date.now());
  useEffect(() => {
    if (moduleIdx === null || !mode) return;
    tick.current = Date.now();
    const send = () => {
      const s = (Date.now() - tick.current) / 1000;
      tick.current = Date.now();
      if (document.visibilityState === 'visible' && s > 3) hb.mutate({ courseId, moduleIdx, mode: map ? 'mindmap' : mode, seconds: Math.min(120, s) });
    };
    const id = window.setInterval(send, 30_000);
    return () => { window.clearInterval(id); send(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId, moduleIdx, mode, map]);

  useEffect(() => { window.scrollTo({ top: 0 }); }, [mode, map]);

  const selectModule = useCallback((i: number) => { setModuleIdx(i); setSectionIdx(0); setAiDeck(null); setRailOpen(false); window.scrollTo({ top: 0 }); }, []);

  const mod = v && moduleIdx !== null ? v.doc.modules[moduleIdx] : null;
  const prog = v && moduleIdx !== null ? v.progress[moduleIdx] : null;
  const modeBtns = useMemo(() => [
    { k: 'read' as const, icon: <LuBookOpen />, label: t('s_mode_read') },
    { k: 'podcast' as const, icon: <LuHeadphones />, label: t('s_mode_podcast') },
    { k: 'slides' as const, icon: <LuPresentation />, label: t('s_mode_slides') },
  ], [t]);

  if (q.error) return <Shell><ErrorBox>{err(errCode(q.error))}</ErrorBox></Shell>;
  if (!q.data) return <Shell><PageLoader /></Shell>;
  if (q.data.status !== 'ready') {
    return (
      <Shell>
        <div className="card mx-auto mt-10 max-w-md p-8 text-center">
          {q.data.status === 'failed' ? <ErrorBox>{t('g_failed')}</ErrorBox> : <><Spinner className="mx-auto h-7 w-7" /><p className="mt-4 text-ink-2">{t('g_title')}</p></>}
          <Link to="/panel" className="btn btn-ghost mt-6">{t('back')}</Link>
        </div>
      </Shell>
    );
  }
  if (!v || !mod || !prog || !mode || moduleIdx === null) return <Shell><PageLoader /></Shell>;

  return (
    <Shell wide>
      {/* Üst şerit */}
      <div className="no-print sticky top-14 z-40 -mx-4 -mt-6 mb-5 border-b border-line bg-bg/95 px-4 py-3 backdrop-blur md:-mx-6 md:-mt-8 md:px-6">
        <div className="flex flex-wrap items-center gap-2">
          <button className="btn btn-ghost btn-icon lg:hidden" onClick={() => setRailOpen(true)} aria-label={t('s_modules')}><LuMenu /></button>
          <Link to="/panel" className="btn btn-ghost btn-icon hidden lg:inline-flex" aria-label={t('back')}><LuArrowLeft /></Link>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs text-ink-3">{v.doc.title}</p>
            <p className="truncate font-semibold">{mod.title}</p>
          </div>
          <div className="seg order-last w-full sm:order-none sm:w-auto" role="tablist" aria-label="mode">
            {modeBtns.map((b) => (
              <button key={b.k} role="tab" className="flex-1 justify-center" aria-pressed={!map && mode === b.k} onClick={() => { setMode(b.k); setMap(false); }}>
                {b.icon}<span className="hidden sm:inline">{b.label}</span>
              </button>
            ))}
            <button role="tab" className="flex-1 justify-center" aria-pressed={map} onClick={() => setMap((m) => !m)}><LuNetwork /><span className="hidden sm:inline">{t('s_map')}</span></button>
          </div>
          <Translate courseId={courseId} current={v.course.shownLocale} original={v.course.locale} />
          <button className="btn btn-ghost btn-sm" onClick={() => share.mutate({ courseId })} title={t('s_share')}><LuShare2 /><span className="hidden xl:inline">{t('s_share')}</span></button>
          <button className={cx('btn btn-sm', ai ? 'btn-primary' : 'btn-outline')} onClick={() => setAi((a) => !a)} aria-pressed={ai}><LuSparkles /><span className="hidden md:inline">{t('s_ai')}</span></button>
          <Ring value={v.percent / 100} size={38} stroke={4} label={t('s_progress')}><span className="text-[10px] font-semibold">{v.percent}</span></Ring>
        </div>
      </div>

      <div className={cx('grid gap-6', ai ? 'lg:grid-cols-[250px_minmax(0,1fr)] xl:grid-cols-[250px_minmax(0,1fr)_360px]' : 'lg:grid-cols-[250px_minmax(0,1fr)]')}>
        {/* Sol ray */}
        <aside className="hidden lg:block">
          <div className="sticky top-[8.5rem] max-h-[calc(100dvh-10rem)] overflow-auto scrollbar-thin pr-1">
            <ModuleRail view={v} current={moduleIdx} onSelect={selectModule} />
          </div>
        </aside>
        {railOpen && (
          <div className="fixed inset-0 z-[80] bg-night/50 lg:hidden" onClick={() => setRailOpen(false)}>
            <div className="h-full w-[85%] max-w-xs overflow-auto bg-bg p-4" onClick={(e) => e.stopPropagation()}>
              <button className="btn btn-ghost btn-icon mb-2" onClick={() => setRailOpen(false)} aria-label={t('close')}><LuX /></button>
              <ModuleRail view={v} current={moduleIdx} onSelect={selectModule} />
            </div>
          </div>
        )}

        {/* Sahne */}
        <section className="min-w-0">
          <Suspense fallback={<PageLoader />}>
            {map ? (
              <MindMap courseId={courseId} />
            ) : mode === 'read' ? (
              <ReadingMode key={`${moduleIdx}-${v.course.shownLocale}`} view={v} mod={mod} onSection={setSectionIdx} onCheck={(ok) => setLastWrong(!ok)} />
            ) : mode === 'podcast' ? (
              <PodcastMode key={`${moduleIdx}-${v.course.shownLocale}`} mod={mod} locale={v.course.shownLocale} onSection={setSectionIdx} />
            ) : (
              <SlideMode key={`${moduleIdx}-${aiDeck ? 'ai' : 'm'}`} slides={aiDeck ?? mod.slides} isAiDeck={!!aiDeck} onExitAiDeck={() => setAiDeck(null)} onSection={setSectionIdx} />
            )}
          </Suspense>
          {!map && <ModuleFooter key={moduleIdx} view={v} mod={mod} prog={prog} onNext={() => selectModule(moduleIdx + 1)} />}
        </section>

        {/* AI paneli */}
        {ai && (
          <aside className="fixed inset-x-0 bottom-0 z-[70] max-h-[75dvh] overflow-auto rounded-t-2xl border-t border-line bg-bg p-4 xl:static xl:z-auto xl:max-h-none xl:overflow-visible xl:rounded-none xl:border-0 xl:bg-transparent xl:p-0">
            <div className="xl:sticky xl:top-[8.5rem] xl:max-h-[calc(100dvh-10rem)] xl:overflow-auto scrollbar-thin">
              <AiPanel
                courseId={courseId} mod={mod} moduleIdx={moduleIdx} sectionIdx={sectionIdx} lastWrong={lastWrong} method={v.course.method}
                onClose={() => setAi(false)}
                onDeck={(s) => { setAiDeck(s); setMode('slides'); setMap(false); }}
              />
            </div>
          </aside>
        )}
      </div>
    </Shell>
  );
}
