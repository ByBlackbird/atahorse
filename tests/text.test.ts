// Başlık biçimi — `npm test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { titleCase } from '../shared/engine/text';

test('Türkçe: i/İ doğru, bağlaçlar küçük, ekler korunur', () => {
  assert.equal(titleCase('istanbul ve izmir arasında iletişim', 'tr'), 'İstanbul ve İzmir Arasında İletişim');
  assert.equal(titleCase('ılık su ile ısı', 'tr'), 'Ilık Su ile Isı');
  assert.equal(titleCase("atatürk'ün ilkeleri", 'tr'), "Atatürk'ün İlkeleri");
  assert.equal(titleCase('  fotosentez:   ve   enerji  ', 'tr'), 'Fotosentez: Ve Enerji');
});

test('kısaltma, iç büyük harf, rakam korunur', () => {
  assert.equal(titleCase('DNA ve iPhone ile COVID-19', 'tr'), 'DNA ve iPhone ile COVID-19');
  assert.equal(titleCase('introduction to the theory of relativity', 'en'), 'Introduction to the Theory of Relativity');
  assert.equal(titleCase('python for data science', 'en'), 'Python for Data Science');
  assert.equal(titleCase('orta-doğu tarihi', 'tr'), 'Orta-Doğu Tarihi');
});

test('Rusça', () => {
  assert.equal(titleCase('история и культура россии', 'ru'), 'История и Культура России');
});
