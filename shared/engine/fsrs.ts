// FSRS-4.5 çekirdeği (Free Spaced Repetition Scheduler, varsayılan ağırlıklar).
// Kart durumu: stability (S, gün), difficulty (D, 1-10). Hedef hatırlama olasılığı: 0.9.
export type Grade = 1 | 2 | 3 | 4; // again | hard | good | easy

const W = [0.4872, 1.4003, 3.7145, 13.8206, 5.1618, 1.2298, 0.8975, 0.031, 1.6474, 0.1367, 1.0461, 2.1072, 0.0793, 0.3246, 1.587, 0.2272, 2.8755];
const DECAY = -0.5;
const FACTOR = 19 / 81; // 0.9^(1/DECAY) - 1
export const DESIRED_RETENTION = 0.9;
const DAY = 86_400_000;

export interface CardState {
  stability: number;
  difficulty: number;
  reps: number;
  lapses: number;
  lastReview: number | null; // epoch ms
  due: number; // epoch ms
}

const clampD = (d: number) => Math.min(10, Math.max(1, d));

export const retrievability = (elapsedDays: number, stability: number) =>
  Math.pow(1 + (FACTOR * elapsedDays) / stability, DECAY);

const initDifficulty = (g: Grade) => clampD(W[4] - (g - 3) * W[5]);

const nextInterval = (s: number) => {
  const days = (s / FACTOR) * (Math.pow(DESIRED_RETENTION, 1 / DECAY) - 1);
  return Math.min(365, Math.max(1, Math.round(days)));
};

export function newCard(now = Date.now()): CardState {
  return { stability: 0, difficulty: 0, reps: 0, lapses: 0, lastReview: null, due: now };
}

export function review(card: CardState, grade: Grade, now = Date.now()): CardState {
  if (card.reps === 0 || card.lastReview === null) {
    const s = W[grade - 1];
    const d = initDifficulty(grade);
    const ivl = grade === 1 ? 0 : nextInterval(s);
    return { stability: s, difficulty: d, reps: 1, lapses: grade === 1 ? 1 : 0, lastReview: now, due: now + (ivl || 0.007) * DAY };
  }
  const elapsed = Math.max(0, (now - card.lastReview) / DAY);
  const r = retrievability(elapsed, card.stability);
  const d0 = initDifficulty(3);
  const dPrime = card.difficulty - W[6] * (grade - 3);
  const d = clampD(W[7] * d0 + (1 - W[7]) * dPrime);
  let s: number;
  if (grade === 1) {
    s = W[11] * Math.pow(d, -W[12]) * (Math.pow(card.stability + 1, W[13]) - 1) * Math.exp(W[14] * (1 - r));
    s = Math.min(s, card.stability);
  } else {
    const hard = grade === 2 ? W[15] : 1;
    const easy = grade === 4 ? W[16] : 1;
    s = card.stability * (Math.exp(W[8]) * (11 - d) * Math.pow(card.stability, -W[9]) * (Math.exp(W[10] * (1 - r)) - 1) * hard * easy + 1);
  }
  const ivl = grade === 1 ? 0.007 : nextInterval(s); // again → ~10 dk sonra
  return {
    stability: Math.max(0.1, s),
    difficulty: d,
    reps: card.reps + 1,
    lapses: card.lapses + (grade === 1 ? 1 : 0),
    lastReview: now,
    due: now + ivl * DAY,
  };
}

/** Çoktan seçmeli cevaptan derece: yanlış → again; doğru + düşük güven → hard; doğru → good; doğru + yüksek güven + hızlı → easy. */
export function gradeFromAnswer(correct: boolean, confidence: 1 | 2 | 3 = 2): Grade {
  if (!correct) return 1;
  if (confidence === 1) return 2;
  if (confidence === 3) return 4;
  return 3;
}
