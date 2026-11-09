// Ürün ölçümü (Bilimsel Yol Haritası §7.2 · Ries: eyleme dönük, erişilebilir, denetlenebilir metrik).
// Gösteriş metriği (toplam kullanıcı/kurs) karar için kullanılmaz; her haftalık kayıt kohortu için beş metrik:
//  1 kurs tamamlama · 2 7 günde tekrara dönüş · 3 gecikmeli hatırlama (7 ve 30 gün) · 4 ikinci kurs · 5 ücretliye geçiş.
// Rakam uydurulmaz: payda yoksa değer null döner ve arayüz "veri yok" yazar.
import { and, eq, gte, inArray } from 'drizzle-orm';
import { db } from '../db/client';
import { events, users } from '../db/schema';

export type EventKind =
  | 'signup' | 'course_created' | 'course_started' | 'module_completed' | 'course_completed'
  | 'quiz_passed' | 'quiz_failed' | 'drill_done' | 'review_session' | 'review_answer'
  | 'final_passed' | 'second_course' | 'free_limit_hit' | 'upgraded';

/** Olay kaydı hiçbir zaman ana akışı bozmaz: hata yutulur (ölçüm, öğrenmenin önüne geçmez). */
export async function track(userId: number, kind: EventKind, opts: { courseId?: number; dedupe?: string; meta?: Record<string, unknown> } = {}) {
  try {
    await db.insert(events).values({ userId, kind, courseId: opts.courseId ?? null, dedupe: opts.dedupe ?? null, meta: opts.meta ?? null }).onConflictDoNothing().run();
  } catch { /* ölçüm hatası öğrenmeyi durdurmaz */ }
}

const DAY = 864e5;
const weekStart = (ms: number) => {
  const d = new Date(ms); d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); // Pazartesi
  return d.getTime();
};
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 1000) / 10 : null);

export interface CohortRow {
  week: string;            // YYYY-MM-DD (Pazartesi)
  users: number;
  started: number;         // en az bir kursa başlayan
  completion: number | null;   // 1: başlayanların % kaçı kursu bitirdi (finale ulaştı)
  return7: number | null;      // 2: ilk modülden sonraki 7 günde tekrar oturumu açanlar
  recall7: number | null;      // 3a: 6–13 gün aralıklı tekrar cevaplarında doğruluk
  recall30: number | null;     // 3b: 25–45 gün aralıklı tekrar cevaplarında doğruluk
  recallN: [number, number];   // 3: payda (7 / 30 gün cevap sayısı)
  secondCourse: number | null; // 4: sertifika alanların % kaçı yeni kurs açtı
  paid: number | null;         // 5: ücretsiz hakkını bitirenlerin % kaçı ücretliye geçti
}

/** Son `weeks` haftanın kayıt kohortları; en yeni üstte. */
export async function adminCohorts(weeks = 12): Promise<{ rows: CohortRow[]; generatedAt: number }> {
  const since = weekStart(Date.now()) - (weeks - 1) * 7 * DAY;
  const us = await db.select({ id: users.id, createdAt: users.createdAt }).from(users).where(gte(users.createdAt, since)).all();
  const ids = us.map((u) => u.id);
  const ev = ids.length ? await db.select().from(events).where(and(inArray(events.userId, ids), inArray(events.kind, [
    'course_started', 'course_completed', 'module_completed', 'review_session', 'review_answer', 'final_passed', 'second_course', 'free_limit_hit', 'upgraded',
  ]))).all() : [];
  const by = new Map<number, typeof ev>();
  for (const e of ev) { const l = by.get(e.userId) ?? []; l.push(e); by.set(e.userId, l); }

  const groups = new Map<number, typeof us>();
  for (const u of us) { const w = weekStart(u.createdAt); const l = groups.get(w) ?? []; l.push(u); groups.set(w, l); }

  const rows: CohortRow[] = [];
  for (const [w, members] of [...groups.entries()].sort((a, b) => b[0] - a[0])) {
    let started = 0, completed = 0, firstMod = 0, returned = 0, certified = 0, second = 0, limit = 0, paid = 0;
    let r7n = 0, r7ok = 0, r30n = 0, r30ok = 0;
    for (const u of members) {
      const e = by.get(u.id) ?? [];
      const has = (k: string) => e.some((x) => x.kind === k);
      if (has('course_started')) { started++; if (has('course_completed')) completed++; }
      const fm = e.filter((x) => x.kind === 'module_completed').sort((a, b) => a.createdAt - b.createdAt)[0];
      if (fm) { firstMod++; if (e.some((x) => x.kind === 'review_session' && x.createdAt > fm.createdAt && x.createdAt <= fm.createdAt + 7 * DAY)) returned++; }
      if (has('final_passed')) { certified++; if (has('second_course')) second++; }
      if (has('free_limit_hit')) { limit++; if (has('upgraded')) paid++; }
      for (const a of e.filter((x) => x.kind === 'review_answer')) {
        const m = (a.meta ?? {}) as { elapsedDays?: number; correct?: boolean };
        const d = m.elapsedDays ?? -1;
        if (d >= 6 && d <= 13) { r7n++; if (m.correct) r7ok++; }
        if (d >= 25 && d <= 45) { r30n++; if (m.correct) r30ok++; }
      }
    }
    rows.push({
      week: new Date(w).toISOString().slice(0, 10), users: members.length, started,
      completion: pct(completed, started), return7: pct(returned, firstMod),
      recall7: pct(r7ok, r7n), recall30: pct(r30ok, r30n), recallN: [r7n, r30n],
      secondCourse: pct(second, certified), paid: pct(paid, limit),
    });
  }
  return { rows, generatedAt: Date.now() };
}

/** Kullanıcının daha önce sertifika alıp almadığı (ikinci kurs metriği için). */
export async function hasEvent(userId: number, kind: EventKind) {
  return !!(await db.select({ id: events.id }).from(events).where(and(eq(events.userId, userId), eq(events.kind, kind))).get());
}
