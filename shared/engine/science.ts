// Öğrenme bilimi çekirdeği: her kursa, profilden bağımsız uygulanan değişmez ilkeler +
// kullanıcının gerçek sonuçlarına göre metot uyarlayan seçici (learning graph'ın ilk katmanı).
import { METHOD_KEYS, type Locale, type MethodKey } from '../types';
import type { L10n } from './profiles';

export interface Principle {
  id: string;
  name: L10n;
  how: L10n;
  evidence: string;
}

/** Ürün içinde "Neden böyle?" panelinde ve LLM sistem talimatında kullanılır. */
export const PRINCIPLES: Principle[] = [
  {
    id: 'retrieval',
    name: { tr: 'Geri çağırma pratiği', en: 'Retrieval practice', ru: 'Практика припоминания' },
    how: {
      tr: 'Her bölüm sonunda anlık kontrol sorusu, her modül sonunda kilit açan quiz.',
      en: 'A pop-up check after each section, an unlocking quiz after each module.',
      ru: 'Проверка после каждого раздела и квиз, открывающий следующий модуль.',
    },
    evidence: 'Roediger & Karpicke (2006); Dunlosky et al. (2013) — "high utility".',
  },
  {
    id: 'spacing',
    name: { tr: 'Aralıklı tekrar', en: 'Spaced repetition', ru: 'Интервальное повторение' },
    how: {
      tr: 'Cevapladığın sorular FSRS algoritmasıyla unutma eşiğinden hemen önce geri gelir.',
      en: 'Questions you answered return just before you would forget them (FSRS).',
      ru: 'Вопросы возвращаются перед моментом забывания (FSRS).',
    },
    evidence: 'Cepeda et al. (2006); Dunlosky et al. (2013) — "high utility".',
  },
  {
    id: 'dual-coding',
    name: { tr: 'İkili kodlama', en: 'Dual coding', ru: 'Двойное кодирование' },
    how: {
      tr: 'Her bölümde analitik kutu (yapı) + bütüncül kutu (resim) + görsel şema birlikte.',
      en: 'Every section pairs an analytic box (structure), a holistic box (picture) and a diagram.',
      ru: 'Каждый раздел: аналитический блок, целостный блок и схема.',
    },
    evidence: 'Paivio (1986); Mayer, Multimedia Learning (2009).',
  },
  {
    id: 'segmenting',
    name: { tr: 'Bölümleme ve işaretleme', en: 'Segmenting & signaling', ru: 'Сегментация и сигналы' },
    how: {
      tr: 'Kısa bölümler, açık hedefler, içindekiler ve süre çipleri bilişsel yükü düşürür.',
      en: 'Short sections, explicit goals, a table of contents and time chips lower cognitive load.',
      ru: 'Короткие разделы, цели и оглавление снижают когнитивную нагрузку.',
    },
    evidence: 'Sweller, Cognitive Load Theory (1988); Mayer (2009).',
  },
  {
    id: 'worked-examples',
    name: { tr: 'Çözümlü örnek → azalan destek', en: 'Worked examples → fading', ru: 'Разобранные примеры → угасание помощи' },
    how: {
      tr: 'Önce tam çözülmüş örnek, sonra eksik adımlı görev.',
      en: 'A fully worked example first, then a task with steps removed.',
      ru: 'Сначала полностью разобранный пример, затем задание с пропусками.',
    },
    evidence: 'Sweller & Cooper (1985); Renkl (2014).',
  },
  {
    id: 'elaboration',
    name: { tr: 'Detaylandırarak sorgulama', en: 'Elaborative interrogation', ru: 'Уточняющие вопросы' },
    how: {
      tr: '"Neden?" ve "Nasıl?" sorularıyla yeni bilgiyi eskisine bağlarsın.',
      en: '"Why?" and "how?" prompts tie new knowledge to what you already know.',
      ru: 'Вопросы «почему?» и «как?» связывают новое с известным.',
    },
    evidence: 'Dunlosky et al. (2013) — "moderate utility".',
  },
  {
    id: 'interleaving',
    name: { tr: 'Karışık tekrar', en: 'Interleaving', ru: 'Чередование' },
    how: {
      tr: 'Final değerlendirmesi ve tekrar oturumu modülleri karıştırır.',
      en: 'The final assessment and review sessions mix modules together.',
      ru: 'Итоговая проверка и повторение смешивают модули.',
    },
    evidence: 'Rohrer & Taylor (2007); Dunlosky et al. (2013).',
  },
  {
    id: 'no-meshing',
    name: { tr: 'Tercih ≠ kader', en: 'Preference ≠ destiny', ru: 'Предпочтение ≠ судьба' },
    how: {
      tr: 'Profilin giriş kapını seçer; üç mod da her zaman açıktır. Metot, gerçek sonuçlarına göre uyarlanır.',
      en: 'Your profile picks the front door; all three modes stay open. The method adapts to your actual results.',
      ru: 'Профиль выбирает вход; все три режима открыты. Метод адаптируется к вашим результатам.',
    },
    evidence: 'Pashler et al. (2008), Psychological Science in the Public Interest.',
  },
];

export const principleText = (p: Principle, l: Locale) => ({ name: p.name[l], how: p.how[l], evidence: p.evidence });

/** Ortak LLM sistem talimatı (model-agnostik). */
export const SCIENCE_DIRECTIVE = [
  'You are the curriculum engine of Atahorse, a personal school system.',
  'Non-negotiable learning-science rules for every module:',
  '- Segment: 3-4 sections, each 180-320 words, with an explicit heading.',
  '- Dual coding: every section has an "analytic" box (structured points) AND a "holistic" box (metaphor / big picture) AND a visual spec.',
  '- Retrieval: every section ends with one multiple-choice check question with a short explanation; each module has 3-5 quiz items spanning Bloom levels.',
  '- Worked example then fading: at least one concrete, realistic example per section; the module task asks the learner to complete a similar problem.',
  '- Elaboration: include "why/how" reasoning, not just facts.',
  '- Honesty: never invent statistics, quotes or URLs. If unsure, state the general principle without numbers.',
  '- The learner profile changes the DELIVERY (order, tone, examples), never the factual content or depth.',
].join('\n');

export interface MethodStat { method: MethodKey; attempts: number; correct: number }

/**
 * Metot seçici: profil varsayılanıyla başlar; yeterli veri birikince (≥ 8 deneme) gerçek doğruluk
 * oranına göre en iyi metodu seçer, %15 olasılıkla az denenmiş metodu keşfeder (epsilon-greedy).
 * Deterministik olması için rastgelelik dışarıdan verilir.
 */
export function chooseMethod(defaultMethod: MethodKey, stats: MethodStat[], rnd: number = Math.random()): { method: MethodKey; reason: 'default' | 'evidence' | 'explore' } {
  const total = stats.reduce((s, x) => s + x.attempts, 0);
  if (total < 8) return { method: defaultMethod, reason: 'default' };
  if (rnd < 0.15) {
    const least = [...METHOD_KEYS].sort((a, b) =>
      (stats.find((s) => s.method === a)?.attempts ?? 0) - (stats.find((s) => s.method === b)?.attempts ?? 0))[0];
    return { method: least, reason: 'explore' };
  }
  // Laplace düzeltmeli doğruluk (az veriyle aşırı uca kaçmasın)
  const score = (m: MethodKey) => {
    const s = stats.find((x) => x.method === m);
    return ((s?.correct ?? 0) + 1) / ((s?.attempts ?? 0) + 2) + (m === defaultMethod ? 0.02 : 0);
  };
  const best = [...METHOD_KEYS].sort((a, b) => score(b) - score(a))[0];
  return { method: best, reason: best === defaultMethod ? 'default' : 'evidence' };
}

/** Okuma süresi tahmini (dk) — yetişkin sessiz okuma ~200-230 kelime/dk; dil öğrenenler için muhafazakâr 180. */
export const readingMinutes = (words: number) => Math.max(1, Math.round(words / 180));

export const wordCount = (s: string) => (s.trim().match(/\S+/g) || []).length;
