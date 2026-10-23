// Oyunlaştırma kuralları — sunucu otoriter, istemci yalnızca gösterir.
import type { Locale } from '../types';
import type { L10n } from './profiles';

export const XP = { task: 20, quiz: 25, module: 100, course: 150 } as const;
export type XpKind = keyof typeof XP;

/** Modül kilidi: önceki modülün quizi bu oranla geçilmeden sonraki açılmaz. */
export const QUIZ_PASS_RATIO = 0.7;
export const FINAL_PASS_RATIO = 0.7;

/** Seviye eğrisi: L1=0, L2=100, L3=250, L4=450, L5=700 … her basamak +50 artar. */
export function levelFromXp(xp: number) {
  let level = 1;
  let floor = 0;
  let step = 100;
  while (xp >= floor + step) {
    floor += step;
    level++;
    step += 50;
  }
  return { level, floor, next: floor + step, progress: (xp - floor) / step };
}

export interface BadgeStats {
  modulesCompleted: number;
  streak: number;
  longestStreak: number;
  quizzesPassed: number;
  modesUsed: string[];
  maxMindmapNodes: number;
  reviewsDone: number;
  certificates: number;
}

export interface BadgeDef {
  key: string;
  icon: 'footprints' | 'flame' | 'calendar' | 'brain' | 'layers' | 'map' | 'repeat' | 'award';
  name: L10n;
  desc: L10n;
  target: number;
  value: (s: BadgeStats) => number;
}

export const BADGES: BadgeDef[] = [
  { key: 'first_step', icon: 'footprints', target: 1, value: (s) => s.modulesCompleted,
    name: { tr: 'İlk Adım', en: 'First Step', ru: 'Первый шаг' },
    desc: { tr: 'İlk modülünü tamamla.', en: 'Complete your first module.', ru: 'Завершите первый модуль.' } },
  { key: 'streak_3', icon: 'flame', target: 3, value: (s) => Math.max(s.streak, s.longestStreak),
    name: { tr: 'Isınma Serisi', en: 'Warm-up Streak', ru: 'Разминка' },
    desc: { tr: '3 gün üst üste öğren.', en: 'Learn 3 days in a row.', ru: 'Учитесь 3 дня подряд.' } },
  { key: 'streak_7', icon: 'calendar', target: 7, value: (s) => Math.max(s.streak, s.longestStreak),
    name: { tr: 'Haftalık Ritim', en: 'Weekly Rhythm', ru: 'Недельный ритм' },
    desc: { tr: '7 gün üst üste öğren.', en: 'Learn 7 days in a row.', ru: 'Учитесь 7 дней подряд.' } },
  { key: 'quiz_master', icon: 'brain', target: 10, value: (s) => s.quizzesPassed,
    name: { tr: 'Geri Çağırma Ustası', en: 'Recall Master', ru: 'Мастер припоминания' },
    desc: { tr: '10 modül quizini geç.', en: 'Pass 10 module quizzes.', ru: 'Пройдите 10 квизов.' } },
  { key: 'multimodal', icon: 'layers', target: 3, value: (s) => new Set(s.modesUsed).size,
    name: { tr: 'Üç Kanal', en: 'Three Channels', ru: 'Три канала' },
    desc: { tr: 'Okuma, podcast ve slayt modlarının üçünü de kullan.', en: 'Use reading, podcast and slide modes.', ru: 'Используйте все три режима.' } },
  { key: 'cartographer', icon: 'map', target: 12, value: (s) => s.maxMindmapNodes,
    name: { tr: 'Harita Ustası', en: 'Cartographer', ru: 'Картограф' },
    desc: { tr: '12 düğümlü bir zihin haritası kur.', en: 'Build a 12-node mind map.', ru: 'Постройте карту из 12 узлов.' } },
  { key: 'memory_keeper', icon: 'repeat', target: 25, value: (s) => s.reviewsDone,
    name: { tr: 'Kalıcı Hafıza', en: 'Memory Keeper', ru: 'Хранитель памяти' },
    desc: { tr: '25 aralıklı tekrar kartı çöz.', en: 'Complete 25 spaced-review cards.', ru: 'Решите 25 карточек повторения.' } },
  { key: 'certified', icon: 'award', target: 1, value: (s) => s.certificates,
    name: { tr: 'Sertifikalı', en: 'Certified', ru: 'Сертифицирован' },
    desc: { tr: 'İlk doğrulanabilir sertifikanı al.', en: 'Earn your first verifiable certificate.', ru: 'Получите первый сертификат.' } },
];

export function evaluateBadges(stats: BadgeStats, locale: Locale) {
  return BADGES.map((b) => {
    const v = b.value(stats);
    return {
      key: b.key,
      icon: b.icon,
      name: b.name[locale],
      desc: b.desc[locale],
      value: Math.min(v, b.target),
      target: b.target,
      earned: v >= b.target,
    };
  });
}

/** Seri hesabı (yerel takvim günü, YYYY-MM-DD). */
export function nextStreak(lastActive: string | null, today: string, current: number) {
  if (lastActive === today) return current;
  const y = new Date(today + 'T00:00:00Z');
  y.setUTCDate(y.getUTCDate() - 1);
  const yesterday = y.toISOString().slice(0, 10);
  return lastActive === yesterday ? current + 1 : 1;
}
