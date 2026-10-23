// Çekirdek motor birim testleri — `npm test` (node:test + tsx).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CourseDoc, LOCALES, METHOD_KEYS, PROFILE_KEYS, type MindNode } from '../shared/types';
import { generateTemplateCourse, autoLayout, seedMindmap, podcastScript, shuffleOptions } from '../shared/engine/generate';
import { newCard, review, retrievability, gradeFromAnswer } from '../shared/engine/fsrs';
import { scoreProfile, PROFILE_TEST } from '../shared/engine/profiles';
import { chooseMethod } from '../shared/engine/science';
import { levelFromXp, evaluateBadges, nextStreak, BADGES } from '../shared/engine/gamification';
import { templateAssist, templateBranches } from '../shared/engine/assist';
import { MEB_SUBJECTS, MEB_GRADES } from '../shared/engine/meb';
import { qrMatrix } from '../src/lib/qr';

test('şablon kurs: 6 profil × 5 metot × 3 dil şemaya uyar', () => {
  for (const locale of LOCALES) for (const profileKey of PROFILE_KEYS) for (const method of METHOD_KEYS) {
    const doc = generateTemplateCourse({ topic: 'Fotosentez', level: 'intermediate', locale, profileKey, method });
    const parsed = CourseDoc.parse(doc);
    assert.equal(parsed.modules.length, 6);
    for (const m of parsed.modules) {
      assert.ok(m.sections.every((s) => s.check && s.visual && s.analytic.points.length >= 2), 'ikili kodlama + kontrol');
      assert.ok(m.quiz.length >= 2 && m.slides.length >= 3);
    }
  }
});

test('MEB: her sınıf/ders/ünite kombinasyonu derlenir', () => {
  for (const g of MEB_GRADES) for (const s of MEB_SUBJECTS) {
    const units = s.units[g] ?? [];
    if (!units.length) continue;
    CourseDoc.parse(generateTemplateCourse({ topic: units[0], level: 'beginner', locale: 'tr', profileKey: 'visual-analytic', method: 'retrieval', meb: { grade: g, subject: s.key, unit: units[0] } }));
    const all = CourseDoc.parse(generateTemplateCourse({ topic: '', level: 'beginner', locale: 'tr', profileKey: 'visual-analytic', method: 'retrieval', meb: { grade: g, subject: s.key } }));
    assert.equal(all.modules.length, Math.min(10, units.length));
  }
});

test('karıştırma: doğru seçenek izlenir, deterministiktir', () => {
  const a = shuffleOptions(['doğru', 'b', 'c', 'd'], 'x');
  assert.equal(a.options[a.correct], 'doğru');
  assert.deepEqual(a, shuffleOptions(['doğru', 'b', 'c', 'd'], 'x'));
});

test('FSRS: doğru cevap aralığı büyütür, yanlış sıfırlar', () => {
  const t0 = Date.UTC(2026, 0, 1);
  let c = review(newCard(t0), 3, t0);
  const first = c.due - t0;
  c = review(c, 3, c.due);
  assert.ok(c.due - c.lastReview! > first, 'ikinci aralık daha uzun');
  const lapse = review(c, 1, c.due);
  assert.ok(lapse.stability <= c.stability && lapse.lapses === 1);
  assert.ok(Math.abs(retrievability(c.stability, c.stability) - 0.9) < 0.01, 'S gün sonra R≈0.9');
  assert.equal(gradeFromAnswer(false, 3), 1);
  assert.equal(gradeFromAnswer(true, 3), 4);
});

test('profil puanlama: çoğunluk + yüzdeler', () => {
  const r = scoreProfile(PROFILE_TEST.map((q) => ({ axis: q.axis, value: q.axis === 'modality' ? 'auditory' : 'holistic' })));
  assert.equal(r.key, 'auditory-holistic');
  assert.equal(r.scores.auditory, 100);
});

test('metot seçici: veri azken varsayılan, veri varken en iyi', () => {
  assert.equal(chooseMethod('feynman', [], 0.9).method, 'feynman');
  const stats = [{ method: 'feynman' as const, attempts: 10, correct: 3 }, { method: 'socratic' as const, attempts: 10, correct: 9 }];
  assert.equal(chooseMethod('feynman', stats, 0.9).method, 'socratic');
});

test('oyunlaştırma: seviye eğrisi, seri, 8 rozet', () => {
  assert.deepEqual([levelFromXp(0).level, levelFromXp(100).level, levelFromXp(250).level], [1, 2, 3]);
  assert.equal(nextStreak('2026-10-22', '2026-10-23', 4), 5);
  assert.equal(nextStreak('2026-10-20', '2026-10-23', 4), 1);
  assert.equal(BADGES.length, 8);
  const b = evaluateBadges({ modulesCompleted: 1, streak: 3, longestStreak: 3, quizzesPassed: 0, modesUsed: ['read', 'podcast', 'slides'], maxMindmapNodes: 0, reviewsDone: 0, certificates: 0 }, 'tr');
  assert.deepEqual(b.filter((x) => x.earned).map((x) => x.key), ['first_step', 'streak_3', 'multimodal']);
});

test('zihin haritası: tohum + otomatik yerleşim düğüm kaybetmez', () => {
  const doc = generateTemplateCourse({ topic: 'Kuantum', level: 'beginner', locale: 'en', profileKey: 'kinesthetic-analytic', method: 'socratic' });
  const nodes = seedMindmap(doc);
  assert.equal(nodes.length, 1 + 6 + 6 * 3);
  const extra: MindNode = { id: 'x', label: 'orphan', x: 0, y: 0, parentId: 'missing', kind: 'custom' };
  const laid = autoLayout([...nodes, extra]);
  assert.equal(laid.length, nodes.length + 1);
  assert.equal(laid.find((n) => n.id === 'x')!.parentId, 'root');
  assert.ok(templateBranches(doc, nodes, 'm0', 'en').length > 0);
});

test('asistan şablonu: 5 eylem + podcast senaryosu', () => {
  const doc = generateTemplateCourse({ topic: 'Osmosis', level: 'advanced', locale: 'ru', profileKey: 'visual-holistic', method: 'case_study' });
  const m = doc.modules[2];
  for (const a of ['explain', 'diagram', 'summarize', 'reteach', 'slides'] as const) {
    const r = templateAssist(a, doc, m, m.sections[0], 'ru', 'feynman');
    assert.ok(r.text.length > 10, a);
  }
  const lines = podcastScript(m, 'ru');
  assert.ok(lines.length > 10 && lines.every((l) => l.text.length > 1));
});

test('QR kodlayıcı: sürüm boyutu ve sabit desenler', () => {
  const m = qrMatrix('https://atahorse.ai/dogrula?kod=ATA-2026-ABCDEF12');
  assert.equal((m.length - 17) % 4, 0);
  // Sol üst konum deseninin merkezi koyu, ayırıcı açık
  assert.equal(m[3][3], true);
  assert.equal(m[7][7], false);
});
