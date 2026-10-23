// 5 öğretim metodu. Her metot: ders akışı (beat sırası), LLM yönergesi ve kontrol sorusu üslubu.
import type { Bloom, MethodKey } from '../types';
import type { L10n } from './profiles';

export type Beat = 'hook' | 'define' | 'mechanism' | 'example' | 'question' | 'analogy' | 'decompose' | 'case' | 'practice' | 'recall';

export interface TeachingMethod {
  key: MethodKey;
  name: L10n;
  short: L10n;
  /** Bir bölümün paragraf akışı. */
  flow: Beat[];
  /** Kontrol sorularının hedeflediği bilişsel düzey. */
  checkBloom: Bloom;
  directive: string;
}

export const METHODS: Record<MethodKey, TeachingMethod> = {
  feynman: {
    key: 'feynman',
    name: { tr: 'Feynman Tekniği', en: 'Feynman Technique', ru: 'Техника Фейнмана' },
    short: {
      tr: 'Jargonsuz anlat, benzetme kur, boşluğu bul, sadeleştir.',
      en: 'Explain without jargon, build an analogy, find the gap, simplify.',
      ru: 'Объясни без жаргона, найди аналогию и пробел, упрости.',
    },
    flow: ['hook', 'analogy', 'define', 'example', 'recall'],
    checkBloom: 'understand',
    directive: 'Use the Feynman technique: explain as if to a curious 12-year-old, one everyday analogy, then a precise definition, then name the most common misunderstanding.',
  },
  socratic: {
    key: 'socratic',
    name: { tr: 'Sokratik Sorgulama', en: 'Socratic Questioning', ru: 'Сократический метод' },
    short: {
      tr: 'Bilgiyi vermeden önce soruyla düşündür; cevabı birlikte kur.',
      en: 'Make the learner think with questions before giving the answer.',
      ru: 'Заставь думать вопросами, прежде чем дать ответ.',
    },
    flow: ['question', 'mechanism', 'question', 'define', 'recall'],
    checkBloom: 'analyze',
    directive: 'Use Socratic questioning: each section opens with a probing question, reasons through 2-3 follow-up questions, and lands on the principle. Never state the conclusion before the reasoning.',
  },
  first_principles: {
    key: 'first_principles',
    name: { tr: 'İlk İlkeler', en: 'First Principles', ru: 'Первые принципы' },
    short: {
      tr: 'Konuyu tartışılmaz temellerine ayır, sıfırdan yeniden kur.',
      en: 'Break the topic into undeniable basics, rebuild from scratch.',
      ru: 'Разложи на базовые истины и собери заново.',
    },
    flow: ['decompose', 'define', 'mechanism', 'example', 'recall'],
    checkBloom: 'analyze',
    directive: 'Use first-principles reasoning: list the irreducible facts, derive the concept from them step by step, and show how the familiar formulation follows.',
  },
  case_study: {
    key: 'case_study',
    name: { tr: 'Vaka Analizi', en: 'Case Study', ru: 'Кейс-анализ' },
    short: {
      tr: 'Gerçek bir vakadan başla, teoriyi vakadan çıkar.',
      en: 'Start from a real case and extract the theory from it.',
      ru: 'Начни с реального случая и выведи теорию.',
    },
    flow: ['case', 'question', 'mechanism', 'define', 'recall'],
    checkBloom: 'apply',
    directive: 'Use case-based learning: open with a concrete, realistic case (who, what, decision), analyze it, then generalize to the principle. Avoid fabricated statistics.',
  },
  retrieval: {
    key: 'retrieval',
    name: { tr: 'Aktif Geri Çağırma', en: 'Active Retrieval', ru: 'Активное припоминание' },
    short: {
      tr: 'Küçük bloklar; her bloktan sonra hatırla, sonra kontrol et.',
      en: 'Small chunks; recall after each, then check.',
      ru: 'Маленькие блоки; вспоминай после каждого и проверяй.',
    },
    flow: ['define', 'example', 'practice', 'recall', 'practice'],
    checkBloom: 'remember',
    directive: 'Use retrieval practice with worked examples: short chunks, a fully worked example, then a faded version the learner completes, then a recall prompt.',
  },
};
