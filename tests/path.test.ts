// Kişisel yol motoru — `npm test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addDays, bandOf, courseMastery, daysBetween, learningGain, masteryOf, moduleMastery, pickRecap, planCourse, todayPath, type PathCourse } from '../shared/engine/path';

const NOW = Date.parse('2026-11-06T12:00:00Z');
const DAY = 86_400_000;

test('ustalık: kanıt yokken belirsiz, doğru cevaplarla yükselir, eski kanıt zayıflar', () => {
  const none = masteryOf([], NOW);
  assert.equal(none.n, 0);
  assert.equal(bandOf(none), 'unknown');
  const good = masteryOf(Array.from({ length: 8 }, () => ({ correct: true, at: NOW })), NOW);
  assert.ok(good.mean > 0.85 && good.lo < good.mean && good.hi <= 1);
  assert.equal(bandOf(good), 'strong');
  const old = masteryOf(Array.from({ length: 8 }, () => ({ correct: true, at: NOW - 90 * DAY })), NOW);
  assert.ok(old.mean < good.mean, '90 gün önceki kanıt daha az ağırlık taşır');
  assert.ok(old.hi - old.lo > good.hi - good.lo, 'eski kanıtta belirsizlik daha geniş');
  const weak = masteryOf([{ correct: false, at: NOW }, { correct: false, at: NOW }, { correct: true, at: NOW }, { correct: false, at: NOW }], NOW);
  assert.equal(bandOf(weak), 'weak');
});

test('kurs ustalığı yalnız kanıtlı modüllerden; kapsama oranı döner', () => {
  const mods = moduleMastery([
    ...Array.from({ length: 4 }, () => ({ moduleIdx: 0, correct: true, at: NOW })),
    ...Array.from({ length: 4 }, () => ({ moduleIdx: 1, correct: false, at: NOW })),
  ], 4, NOW);
  const c = courseMastery(mods, [20, 20, 20, 20])!;
  assert.equal(c.coverage, 0.5);
  assert.ok(c.mean > 0.4 && c.mean < 0.6);
  assert.equal(courseMastery(moduleMastery([], 4, NOW), [1, 1, 1, 1]), null);
});

test('plan: hedefsiz, rahat, sıkı ve geride senaryoları', () => {
  const modules = Array.from({ length: 6 }, (_, i) => ({ idx: i, minutes: 20, completed: false, startedSeconds: 0 }));
  const free = planCourse({ modules, today: '2026-11-06', targetDate: null, minutesPerDay: 30, finalDone: false });
  assert.equal(free.status, 'no_target');
  assert.equal(free.days[0].items[0].kind, 'module', 'hiç başlanmamışsa ilk gün tekrar yok');
  assert.ok(free.days.every((d) => d.minutes <= 30));
  const placed = free.days.flatMap((d) => d.items).filter((i) => i.kind === 'module').map((i) => (i as { moduleIdx: number }).moduleIdx);
  assert.deepEqual([...new Set(placed)], [0, 1, 2, 3, 4, 5], 'modüller sırayla');
  assert.ok(free.days.flatMap((d) => d.items).some((i) => i.kind === 'final'));
  assert.equal(free.projectedFinish, free.days[free.days.length - 1].day);

  const roomy = planCourse({ modules, today: '2026-11-06', targetDate: '2027-01-30', minutesPerDay: 30, finalDone: false });
  assert.equal(roomy.status, 'on_track');
  const behind = planCourse({ modules, today: '2026-11-06', targetDate: '2026-11-08', minutesPerDay: 30, finalDone: false });
  assert.equal(behind.status, 'behind');
  assert.ok((behind.requiredPerDay ?? 0) > 30, 'gerideyken gereken dk/gün bütçeyi aşar');
  const done = planCourse({ modules: modules.map((m) => ({ ...m, completed: true })), today: '2026-11-06', targetDate: null, minutesPerDay: 30, finalDone: true });
  assert.equal(done.status, 'done');
});

test('tarih yardımcıları', () => {
  assert.equal(addDays('2026-12-30', 3), '2027-01-02');
  assert.equal(daysBetween('2026-11-06', '2026-11-16'), 10);
});

test('Bugün yolu: tekrar → zayıf nokta → acil modül → final; en çok 4 adım', () => {
  const mk = (id: number, over: Partial<PathCourse>): PathCourse => ({ id, title: `K${id}`, status: 'ready', completed: false, finalPassed: false, nextModule: { idx: 0, title: 'M', minutes: 20 }, plan: null, weakModules: 0, lastActiveAt: id, ...over });
  const behindPlan = planCourse({ modules: [{ idx: 0, minutes: 60, completed: false, startedSeconds: 0 }], today: '2026-11-06', targetDate: '2026-11-06', minutesPerDay: 30, finalDone: false });
  const steps = todayPath([
    mk(1, {}),
    mk(2, { plan: behindPlan }),
    mk(3, { weakModules: 2 }),
    mk(4, { completed: true, nextModule: null }),
  ], 5);
  assert.equal(steps.length, 4);
  assert.equal(steps[0].kind, 'review');
  assert.equal(steps[1].kind, 'recap');
  assert.equal(steps[2].kind, 'module');
  assert.equal((steps[2] as { courseId: number }).courseId, 2, 'hedefin gerisindeki kurs önce');
  assert.equal(todayPath([], 0).length, 0);
});

test('zayıf nokta seçimi: en zayıf modülden başlar, modüller arasında dağıtır, yeni doğruları atlar', () => {
  const mastery = moduleMastery([
    ...Array.from({ length: 4 }, () => ({ moduleIdx: 0, correct: false, at: NOW })),
    ...Array.from({ length: 4 }, () => ({ moduleIdx: 1, correct: true, at: NOW })),
    { moduleIdx: 2, correct: false, at: NOW }, { moduleIdx: 2, correct: false, at: NOW }, { moduleIdx: 2, correct: true, at: NOW }, { moduleIdx: 2, correct: true, at: NOW },
  ], 3, NOW);
  const cands = [
    { id: 'a1', moduleIdx: 0, lastCorrectAt: null }, { id: 'a2', moduleIdx: 0, lastCorrectAt: null },
    { id: 'b1', moduleIdx: 1, lastCorrectAt: null },
    { id: 'c1', moduleIdx: 2, lastCorrectAt: NOW - 3600_000 }, { id: 'c2', moduleIdx: 2, lastCorrectAt: null },
  ];
  const ids = pickRecap(cands, mastery, 8, NOW);
  assert.equal(ids[0], 'a1');
  assert.ok(!ids.includes('b1'), 'güçlü modül dahil edilmez');
  assert.ok(!ids.includes('c1'), 'son 24 saatte doğru bilinen atlanır');
  assert.deepEqual(ids, ['a1', 'c2', 'a2']);
});

test('öğrenme kazancı (Hake)', () => {
  assert.equal(learningGain(0.5, 1), 1);
  assert.equal(learningGain(0.5, 0.75), 0.5);
  assert.equal(learningGain(1, 1), null);
  assert.ok((learningGain(0.6, 0.4) ?? 0) < 0);
});
