// Görsel ders motoru — `npm test`. Şema içerikten gelir, uydurma sayı yok, vuruş cümleyle eşzamanlı.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateTemplateCourse } from '../shared/engine/generate';
import { Lesson, chaptersOf, partsOf, readSeconds, shownAt, templateLesson, withChecks } from '../shared/engine/lesson';
import { LOCALES, PROFILE_KEYS } from '../shared/types';

test('şablon ders: her dil ve profil için geçerli, içerikten çizilir', () => {
  for (const locale of LOCALES) for (const profileKey of PROFILE_KEYS) {
    const doc = generateTemplateCourse({ topic: 'Fotosentez', level: 'beginner', locale, profileKey, method: 'first_principles' });
    const mod = doc.modules[0];
    const l = Lesson.parse(templateLesson(mod, locale, profileKey));
    assert.equal(l.source, 'template');
    // her bölüm için öğretim sahnesi + bölüm sonu sorusu
    for (const [si, s] of mod.sections.entries()) {
      assert.ok(l.scenes.some((x) => x.kind === 'teach' && x.sectionIdx === si), `bölüm ${si} anlatılmalı`);
      if (s.check) assert.ok(l.scenes.some((x) => x.kind === 'check' && x.itemId === s.check!.id));
    }
    // açılış haritası bölüm başlıklarını taşır (genel "1, 2, 3" etiketi yok)
    const map = l.scenes[0];
    assert.ok(map.kind === 'teach' && map.diagram.type === 'concept');
    if (map.kind === 'teach' && map.diagram.type === 'concept') {
      map.diagram.links.forEach((x, i) => assert.ok(mod.sections[i].heading.replace(/[“”"]/g, '').startsWith(x.node.label.replace('…', '')), x.node.label));
    }
    const json = JSON.stringify(l);
    assert.ok(!/"value"/.test(json), 'şablon derste sayı (stat) uydurulmaz');
    // soru sahnesi cevapsız geçilmesin diye kendi bölüm kimliğini taşır
    for (const x of l.scenes) if (x.kind === 'teach') assert.ok(x.narration.length >= 1);
  }
});

test('profil sırası: analitik önce yapı, bütüncül önce büyük resim', () => {
  const doc = generateTemplateCourse({ topic: 'Fotosentez', level: 'beginner', locale: 'tr', profileKey: 'visual-analytic', method: 'first_principles' });
  const a = templateLesson(doc.modules[0], 'tr', 'visual-analytic').scenes.filter((s) => s.sectionIdx === 0);
  const h = templateLesson(doc.modules[0], 'tr', 'visual-holistic').scenes.filter((s) => s.sectionIdx === 0);
  assert.ok(a[0].kind === 'teach' && a[0].diagram.type === 'flow');
  assert.ok(h[0].kind === 'teach' && h[0].diagram.type === 'analogy');
});

test('vuruş: ilk cümle ilk parçayı, son cümle tümünü açar', () => {
  assert.equal(shownAt(0, 4, 4), 1);
  assert.equal(shownAt(3, 4, 4), 4);
  assert.equal(shownAt(0, 2, 5), 3);
  assert.equal(shownAt(1, 2, 5), 5);
  assert.equal(shownAt(0, 1, 3), 3);
  assert.equal(partsOf({ type: 'cause', effect: { label: 'x', detail: '', tone: 'gold' }, causes: [{ label: 'a', detail: '', tone: 'brand' }, { label: 'b', detail: '', tone: 'brand' }] }), 3);
  assert.ok(readSeconds('bir iki üç dört beş altı yedi sekiz dokuz on', 1) > readSeconds('bir iki üç dört beş altı yedi sekiz dokuz on', 1.25));
});

test('bölümler ve AI sahnelerine soru ekleme', () => {
  const doc = generateTemplateCourse({ topic: 'Fotosentez', level: 'beginner', locale: 'tr', profileKey: 'visual-analytic', method: 'first_principles' });
  const mod = doc.modules[0];
  const l = templateLesson(mod, 'tr', 'visual-analytic');
  const ch = chaptersOf(l);
  assert.equal(ch[0].start, 0);
  assert.equal(ch.filter((c) => c.sectionIdx >= 0).length, mod.sections.length);
  // AI yalnız öğretim sahnesi döndürür; sorular belgeden eklenir, kimlikler tekil olur
  const teach = l.scenes.filter((s) => s.kind === 'teach').map((s) => ({ ...s, id: 'dup' }));
  const merged = withChecks(mod, teach);
  assert.equal(new Set(merged.map((s) => s.id)).size, merged.length);
  assert.equal(merged.filter((s) => s.kind === 'check').length, mod.sections.filter((s) => s.check).length);
});
