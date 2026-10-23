// AI Asistan paneli — Açıkla · Şemaya Dök · Özetle · Farklı Metotla Öğret · Sunum Hazırla.
// Proaktif: yanlış kontrol sonrası "farklı metot", uzun bekleyişte "özet" önerir. Yanıtlar kurs içeriğine dayanır.
import { useEffect, useState } from 'react';
import { LuSparkles, LuLightbulb, LuNetwork, LuListChecks, LuShuffle, LuPresentation, LuX, LuPlus, LuArrowRight } from 'react-icons/lu';
import { trpc, errCode, type RouterOutputs } from '../lib/trpc';
import { useErr, useI18n } from '../i18n/index';
import { useToast } from '../ui/providers';
import { ErrorBox, Spinner, cx } from '../ui/kit';
import { autoLayout } from '../../shared/engine/generate';
import { METHOD_KEYS, type AssistAction, type MethodKey, type MindNode } from '../../shared/types';
import { METHODS } from '../../shared/engine/methods';
import type { SModule, SSlide } from './types';

type Result = RouterOutputs['ai']['assist'];

export default function AiPanel({ courseId, mod, moduleIdx, sectionIdx, lastWrong, method, onClose, onDeck }: {
  courseId: number; mod: SModule; moduleIdx: number; sectionIdx: number; lastWrong: boolean; method: string;
  onClose: () => void; onDeck: (s: SSlide[]) => void;
}) {
  const { t, lang } = useI18n();
  const err = useErr();
  const toast = useToast();
  const utils = trpc.useUtils();
  const [scope, setScope] = useState<'section' | 'module'>('section');
  const [alt, setAlt] = useState<MethodKey>(() => METHOD_KEYS.find((k) => k !== method) ?? 'feynman');
  const [result, setResult] = useState<Result | null>(null);
  const [idle, setIdle] = useState(false);
  const assist = trpc.ai.assist.useMutation({ onSuccess: (r) => setResult(r) });
  const saveMap = trpc.ai.saveMindmap.useMutation({ onSuccess: () => { void utils.ai.mindmap.invalidate(); toast.push('ok', t('ai_added')); } });

  useEffect(() => { setResult(null); setIdle(false); const id = window.setTimeout(() => setIdle(true), 4 * 60_000); return () => window.clearTimeout(id); }, [moduleIdx, sectionIdx]);

  const run = (action: AssistAction) => assist.mutate({ courseId, moduleIdx, sectionIdx: scope === 'section' ? sectionIdx : null, action, locale: lang, method: action === 'reteach' ? alt : undefined });

  const addToMap = async () => {
    if (!result?.tree) return;
    const cur = await utils.ai.mindmap.fetch({ courseId });
    const parent = cur.nodes.find((n) => n.id === `m${moduleIdx}`)?.id ?? 'root';
    const id = () => `n${Math.random().toString(36).slice(2, 9)}`;
    const add: MindNode[] = [];
    for (const br of result.tree) {
      const bid = id();
      add.push({ id: bid, label: br.label.slice(0, 78), x: 0, y: 0, parentId: parent, kind: 'ai', moduleIdx });
      for (const c of br.children) add.push({ id: id(), label: c.slice(0, 78), x: 0, y: 0, parentId: bid, kind: 'ai', moduleIdx });
    }
    saveMap.mutate({ courseId, nodes: autoLayout([...cur.nodes, ...add]).slice(0, 250) });
  };

  const actions: { k: AssistAction; icon: React.ReactNode; label: string }[] = [
    { k: 'explain', icon: <LuLightbulb />, label: t('ai_explain') },
    { k: 'diagram', icon: <LuNetwork />, label: t('ai_diagram') },
    { k: 'summarize', icon: <LuListChecks />, label: t('ai_summarize') },
    { k: 'reteach', icon: <LuShuffle />, label: t('ai_reteach') },
    { k: 'slides', icon: <LuPresentation />, label: t('ai_slides') },
  ];
  const tip = lastWrong ? { text: t('ai_tip_wrong'), action: 'reteach' as const } : idle ? { text: t('ai_tip_long'), action: 'summarize' as const } : null;
  const section = mod.sections[sectionIdx];

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <div>
          <p className="flex items-center gap-1.5 font-semibold"><LuSparkles className="text-brand" /> {t('ai_title')}</p>
          <p className="text-xs text-ink-3">{t('ai_sub')}</p>
        </div>
        <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label={t('close')}><LuX /></button>
      </div>
      <div className="space-y-4 p-4">
        <div className="seg w-full">
          <button className="flex-1 justify-center" aria-pressed={scope === 'section'} onClick={() => setScope('section')}>{t('ai_scope_section')}</button>
          <button className="flex-1 justify-center" aria-pressed={scope === 'module'} onClick={() => setScope('module')}>{t('ai_scope_module')}</button>
        </div>
        {scope === 'section' && section && <p className="truncate text-xs text-ink-3">↳ {section.heading}</p>}

        {tip && !result && (
          <div className="rounded-xl border border-brand/30 bg-brand-soft p-3 text-sm">
            <p>{tip.text}</p>
            <button className="btn btn-primary btn-sm mt-2" onClick={() => run(tip.action)}>{tip.action === 'reteach' ? t('ai_reteach') : t('ai_summarize')} <LuArrowRight /></button>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          {actions.map((a) => (
            <button key={a.k} disabled={assist.isPending} onClick={() => run(a.k)}
              className={cx('flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-sm font-medium transition-colors', assist.variables?.action === a.k && (assist.isPending || result) ? 'border-brand bg-brand-soft text-brand' : 'border-line hover:border-line-strong', a.k === 'slides' && 'col-span-2')}>
              <span className="text-brand">{a.icon}</span>{a.label}
            </button>
          ))}
        </div>
        <label className="block text-xs text-ink-3">
          {t('ai_reteach')}:
          <select className="input mt-1 !h-9 !text-sm" value={alt} onChange={(e) => setAlt(e.target.value as MethodKey)}>
            {METHOD_KEYS.map((k) => <option key={k} value={k}>{METHODS[k].name[lang]}</option>)}
          </select>
        </label>

        {assist.isPending && <div className="flex justify-center py-6"><Spinner /></div>}
        {assist.error && <ErrorBox>{err(errCode(assist.error))}</ErrorBox>}
        {!assist.isPending && !result && !tip && <p className="text-xs text-ink-3">{t('ai_empty')}</p>}

        {result && !assist.isPending && (
          <div className="anim-rise space-y-3 border-t border-line pt-4">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-semibold leading-snug">{result.title}</h3>
              <span className="chip shrink-0 !h-6 !text-[11px]">{t(`ai_src_${result.source}`)}</span>
            </div>
            {result.text && <div className="space-y-2 text-sm leading-relaxed">{result.text.split(/\n{2,}|\n/).filter(Boolean).map((p, i) => <p key={i}>{p}</p>)}</div>}
            {result.bullets && result.bullets.length > 0 && (
              <ul className="space-y-1.5 text-sm">{result.bullets.map((b, i) => <li key={i} className="flex gap-2"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />{b}</li>)}</ul>
            )}
            {result.tree && (
              <>
                <ul className="space-y-2 text-sm">
                  {result.tree.map((b) => (
                    <li key={b.label} className="rounded-xl border border-line p-2.5">
                      <p className="font-semibold">{b.label}</p>
                      <div className="mt-1.5 flex flex-wrap gap-1">{b.children.map((c) => <span key={c} className="chip !h-6 !text-[11px]">{c}</span>)}</div>
                    </li>
                  ))}
                </ul>
                <button className="btn btn-outline btn-sm w-full" disabled={saveMap.isPending} onClick={addToMap}>{saveMap.isPending ? <Spinner className="h-3.5 w-3.5" /> : <LuPlus />} {t('ai_to_map')}</button>
              </>
            )}
            {result.slides && <button className="btn btn-primary btn-sm w-full" onClick={() => onDeck(result.slides!)}><LuPresentation /> {t('ai_open_slides')}</button>}
          </div>
        )}
      </div>
    </div>
  );
}
