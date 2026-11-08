// Görsel ders (anlatımlı sunum) — veri modeli + şablon üretici.
// İlke (Mayer, çoklu ortam öğrenmesi): şema metni süslemez, anlatılanı taşır (tutarlılık);
// anlatım ve görsel aynı anda gelir (zamansal bitişiklik); dikkat şemanın ilgili parçasına çekilir
// (işaretleme); ders kısa bölümlere ayrılır ve her bölüm geri çağırma sorusuyla kapanır (bölümleme).
// Renk anlam taşır: brand = ana kavram, gold = kilit fikir/sonuç, ok = olumlu/çıktı, bad = hata/risk.
import { z } from 'zod';
import type { Locale, Module, ProfileKey } from '../types';
import { splitSentences } from './generate';
import { PROFILES } from './profiles';

/** İstemcide simgeye eşlenen anlamlı anahtarlar (yapay zekâ yalnız bu listeden seçer). */
export const ICONS = [
  'idea', 'book', 'brain', 'leaf', 'sprout', 'sun', 'water', 'fire', 'energy', 'atom', 'dna', 'microscope', 'flask',
  'gear', 'factory', 'person', 'people', 'money', 'chart', 'time', 'globe', 'map', 'building', 'landmark', 'home',
  'heart', 'shield', 'check', 'warning', 'question', 'target', 'link', 'code', 'calculator', 'music', 'palette',
  'scale', 'rocket', 'mountain', 'cloud', 'car', 'message', 'tool', 'puzzle', 'key', 'eye', 'hand',
] as const;
export const Icon = z.enum(ICONS);
export type Icon = z.infer<typeof Icon>;
export const Tone = z.enum(['brand', 'gold', 'ok', 'bad', 'neutral']);
export type Tone = z.infer<typeof Tone>;

const label = z.string().trim().min(1).max(48);
const detail = z.string().trim().max(140).default('');
export const DNode = z.object({ label, detail, icon: Icon.optional(), tone: Tone.default('brand') });
export type DNode = z.infer<typeof DNode>;

export const Diagram = z.discriminatedUnion('type', [
  /** Sıralı süreç: adım → adım. */
  z.object({ type: z.literal('flow'), nodes: z.array(DNode).min(2).max(6) }),
  /** Kendini tekrar eden döngü. */
  z.object({ type: z.literal('cycle'), nodes: z.array(DNode).min(3).max(6) }),
  /** Nedenler → tek sonuç. */
  z.object({ type: z.literal('cause'), effect: DNode, causes: z.array(DNode).min(1).max(5) }),
  /** İki şeyin karşılaştırması (aynı sırada eşleşen maddeler). */
  z.object({ type: z.literal('compare'), a: z.object({ title: label, icon: Icon.optional(), items: z.array(z.string().trim().min(1).max(90)).min(1).max(5) }), b: z.object({ title: label, icon: Icon.optional(), items: z.array(z.string().trim().min(1).max(90)).min(1).max(5) }) }),
  /** Üst kavram → alt kavramlar. */
  z.object({ type: z.literal('hierarchy'), root: DNode, children: z.array(DNode).min(2).max(5) }),
  /** Merkez kavram + ilişkileriyle bağlı kavramlar (kenar etiketi = ilişki). */
  z.object({ type: z.literal('concept'), center: DNode, links: z.array(z.object({ node: DNode, relation: z.string().trim().max(32).default('') })).min(2).max(6) }),
  /** Benzetme: bilinen şey ↔ yeni kavram, eşleşen parçalar. */
  z.object({ type: z.literal('analogy'), source: DNode, target: DNode, pairs: z.array(z.object({ from: z.string().trim().min(1).max(40), to: z.string().trim().min(1).max(40) })).max(4).default([]) }),
  /** Zaman çizgisi: tarih/aşama + olay. */
  z.object({ type: z.literal('timeline'), events: z.array(z.object({ when: z.string().trim().min(1).max(24), node: DNode })).min(2).max(6) }),
  /** Büyük sayılar — yalnız içerikte gerçek sayı varsa. */
  z.object({ type: z.literal('stat'), stats: z.array(z.object({ value: z.string().trim().min(1).max(16), node: DNode })).min(1).max(3) }),
]);
export type Diagram = z.infer<typeof Diagram>;

export const Scene = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('teach'),
    id: z.string().max(40),
    sectionIdx: z.number().int().min(-1).max(10),
    title: z.string().trim().min(1).max(120),
    /** Her cümle bir "vuruş": cümle i okunurken şemanın i'nci parçası belirir. */
    narration: z.array(z.string().trim().min(1).max(400)).min(1).max(8),
    diagram: Diagram,
    takeaway: z.string().trim().max(160).default(''),
  }),
  /** Bölüm sonu geri çağırma: cevaplanmadan ilerlenmez. Soru metni kurs belgesinden gelir. */
  z.object({ kind: z.literal('check'), id: z.string().max(40), sectionIdx: z.number().int().min(0).max(10), itemId: z.string().max(40) }),
]);
export type Scene = z.infer<typeof Scene>;

export const Lesson = z.object({
  version: z.literal(1),
  moduleIdx: z.number().int().min(0),
  title: z.string().max(160),
  scenes: z.array(Scene).min(1).max(40),
  source: z.enum(['ai', 'template']),
});
export type Lesson = z.infer<typeof Lesson>;

/* ---------------- şemanın açılma sırası (vuruş) ---------------- */
/** Şemadaki sırayla açılan parça sayısı. */
export function partsOf(d: Diagram): number {
  switch (d.type) {
    case 'flow': case 'cycle': return d.nodes.length;
    case 'cause': return d.causes.length + 1;
    case 'compare': return Math.max(d.a.items.length, d.b.items.length) + 1;
    case 'hierarchy': return d.children.length + 1;
    case 'concept': return d.links.length + 1;
    case 'analogy': return 2 + d.pairs.length;
    case 'timeline': return d.events.length;
    case 'stat': return d.stats.length;
  }
}

/** Cümle i okunurken kaç parça görünür: ilk cümle ilk parçayı açar, son cümleye kadar hepsi açılmış olur. */
export function shownAt(sentence: number, sentences: number, parts: number): number {
  if (sentences <= 1) return parts;
  return Math.min(parts, Math.max(1, Math.ceil(((sentence + 1) / sentences) * parts)));
}

/** Okuma süresi tahmini (ses yokken sessiz akış ve ilerleme çubuğu için), saniye. */
export const readSeconds = (text: string, rate = 1) => Math.max(2.2, text.split(/\s+/).filter(Boolean).length / (2.6 * rate) + 0.6);

/* ---------------- şablon üretici (AI yokken / başarısızsa) ---------------- */
const short = (s: string, n = 46) => {
  const clean = s.replace(/[“”"]/g, '').trim();
  if (clean.length <= n) return clean;
  const cut = clean.slice(0, n);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), n - 12)).trim()}…`;
};
/** "Başlık: açıklama" → { label, detail }; iki nokta yoksa ilk kelimeler etiket olur. */
function splitPoint(p: string): { label: string; detail: string } {
  const i = p.indexOf(':');
  if (i > 1 && i < 40) return { label: short(p.slice(0, i), 40), detail: short(p.slice(i + 1), 120) };
  const words = p.replace(/[“”"]/g, '').split(/\s+/);
  return { label: short(words.slice(0, 4).join(' '), 40), detail: short(words.slice(4).join(' '), 120) };
}
const sentences = (text: string, max = 5) => splitSentences(text).filter((s) => s.length > 3).slice(0, max);
/** Benzetmenin bilinen tarafı: ilk cümlede bölüm adını içermeyen ilk yan cümle. */
function familiar(text: string, heading: string): string {
  const h = heading.toLowerCase();
  const clauses = (sentences(text, 1)[0] ?? '').replace(/[“”"]/g, '').split(/[:;—,]/).map((c) => c.trim()).filter((c) => c.length > 3);
  return clauses.find((c) => !c.toLowerCase().includes(h)) ?? '';
}
const ICON_CYCLE: Icon[] = ['idea', 'gear', 'link', 'target', 'check', 'puzzle'];

export function templateLesson(mod: Module, _locale: Locale, profileKey: ProfileKey): Lesson {
  const prof = PROFILES[profileKey];
  const analytic = prof.reasoning === 'analytic';
  const scenes: Scene[] = [];

  // Açılış: modülün haritası (merkez = modül, kollar = bölümler)
  scenes.push({
    kind: 'teach', id: `m${mod.idx}-map`, sectionIdx: -1, title: mod.title,
    narration: [mod.summary, ...mod.objectives.slice(0, 2)].slice(0, 3),
    diagram: { type: 'concept', center: { label: short(mod.title, 40), detail: '', icon: 'book', tone: 'gold' }, links: mod.sections.slice(0, 6).map((s, i) => ({ node: { label: short(s.heading, 40), detail: '', icon: ICON_CYCLE[i % ICON_CYCLE.length], tone: 'brand' as const }, relation: `${i + 1}` })) },
    takeaway: short(mod.objectives[0] ?? '', 150),
  });

  mod.sections.forEach((s, si) => {
    const pts = s.analytic.points.map(splitPoint);
    const structure: Scene = {
      kind: 'teach', id: `${s.id}-a`, sectionIdx: si, title: s.heading,
      narration: sentences(s.paragraphs.join(' '), Math.max(2, Math.min(5, pts.length + 1))),
      diagram: analytic
        ? { type: 'flow', nodes: pts.slice(0, 5).map((p, i) => ({ ...p, icon: ICON_CYCLE[i % ICON_CYCLE.length], tone: i === pts.length - 1 ? 'gold' as const : 'brand' as const })) }
        : { type: 'hierarchy', root: { label: short(s.heading, 40), detail: '', icon: 'idea', tone: 'gold' }, children: pts.slice(0, 5).map((p, i) => ({ ...p, icon: ICON_CYCLE[i % ICON_CYCLE.length], tone: 'brand' as const })) },
      takeaway: short(s.analytic.points[0] ?? '', 150),
    };
    const picture: Scene = {
      kind: 'teach', id: `${s.id}-b`, sectionIdx: si, title: s.heading,
      narration: sentences(s.holistic.text, 3).concat(s.example ? sentences(s.example, 1) : []),
      // Benzetmenin kendisi (ilk cümle) bilinen taraf; bölüm kavramı yeni taraf
      diagram: { type: 'analogy', source: { label: short(familiar(s.holistic.text, s.heading) || s.holistic.title, 40), detail: short(s.holistic.text, 120), icon: 'eye', tone: 'neutral' }, target: { label: short(s.heading, 40), detail: s.example ? short(s.example, 120) : '', icon: 'idea', tone: 'gold' }, pairs: [] },
      takeaway: '',
    };
    // Profil sırası: analitik → yapı önce; bütüncül → büyük resim önce
    if (analytic) scenes.push(structure, picture); else scenes.push(picture, structure);
    if (s.check) scenes.push({ kind: 'check', id: `${s.id}-q`, sectionIdx: si, itemId: s.check.id });
  });

  // Görev: gerçek adımlar
  scenes.push({
    kind: 'teach', id: `m${mod.idx}-task`, sectionIdx: -1, title: mod.task.title,
    narration: mod.task.steps.slice(0, 5),
    diagram: { type: 'flow', nodes: mod.task.steps.slice(0, 5).map((st, i, arr) => ({ label: short(st, 40), detail: '', icon: (i === arr.length - 1 ? 'check' : 'hand') as Icon, tone: (i === arr.length - 1 ? 'ok' : 'brand') as Tone })) },
    takeaway: '',
  });
  // Özet: kilit fikirler
  scenes.push({
    kind: 'teach', id: `m${mod.idx}-recap`, sectionIdx: -1, title: mod.title,
    narration: mod.keyPoints.slice(0, 4),
    diagram: { type: 'hierarchy', root: { label: short(mod.title, 40), detail: '', icon: 'target', tone: 'gold' }, children: mod.keyPoints.slice(0, 4).map((k) => ({ ...splitPoint(k), icon: 'key' as Icon, tone: 'brand' as Tone })) },
    takeaway: short(mod.summary, 150),
  });

  return Lesson.parse({ version: 1, moduleIdx: mod.idx, title: mod.title, scenes: fixDiagrams(scenes), source: 'template' });
}

/** Şema alt sınırlarını garanti eder (ör. akışta en az 2 düğüm); eksikse kavram şemasına düşer. */
function fixDiagrams(scenes: Scene[]): Scene[] {
  return scenes.map((s) => {
    if (s.kind !== 'teach') return s;
    const d = s.diagram;
    if (d.type === 'flow' && d.nodes.length < 2) return { ...s, diagram: { type: 'concept', center: d.nodes[0] ?? { label: short(s.title, 40), detail: '', tone: 'gold' }, links: [{ node: { label: short(s.title, 40), detail: '', tone: 'brand' }, relation: '' }, { node: { label: '…', detail: '', tone: 'neutral' }, relation: '' }] } };
    if (d.type === 'hierarchy' && d.children.length < 2) return { ...s, diagram: { ...d, children: [...d.children, { label: '…', detail: '', tone: 'neutral' as const }, { label: '…', detail: '', tone: 'neutral' as const }].slice(0, 2) } };
    if (d.type === 'concept' && d.links.length < 2) return { ...s, diagram: { ...d, links: [...d.links, { node: { label: '…', detail: '', tone: 'neutral' as const }, relation: '' }, { node: { label: '…', detail: '', tone: 'neutral' as const }, relation: '' }].slice(0, 2) } };
    return s;
  });
}

/** Oynatıcıdaki bölüm listesi: bölüm değişiminde yeni başlık; giriş/görev/özet sahneleri kendi başlığıdır. */
export function chaptersOf(lesson: Lesson): { start: number; sectionIdx: number; title: string }[] {
  const out: { start: number; sectionIdx: number; title: string }[] = [];
  lesson.scenes.forEach((s, i) => {
    const prev = lesson.scenes[i - 1];
    const fresh = !prev || prev.sectionIdx !== s.sectionIdx || (s.sectionIdx === -1 && s.kind === 'teach');
    if (fresh) out.push({ start: i, sectionIdx: s.sectionIdx, title: s.kind === 'teach' ? s.title : '' });
  });
  return out;
}

/** AI sahnelerine bölüm sonu sorularını ekler ve kimlikleri tekilleştirir. */
export function withChecks(mod: Module, scenes: Scene[]): Scene[] {
  const teach = scenes.filter((s) => s.kind === 'teach');
  const out: Scene[] = [];
  const seen = new Set<string>();
  teach.forEach((s, i) => {
    let id = s.id || `t${i}`;
    while (seen.has(id)) id = `${id}x`;
    seen.add(id);
    out.push({ ...s, id });
    const next = teach[i + 1];
    const sec = s.sectionIdx >= 0 ? mod.sections[s.sectionIdx] : undefined;
    if (sec?.check && (!next || next.sectionIdx !== s.sectionIdx)) out.push({ kind: 'check', id: `${sec.id}-q`, sectionIdx: s.sectionIdx, itemId: sec.check.id });
  });
  return out.slice(0, 40);
}
