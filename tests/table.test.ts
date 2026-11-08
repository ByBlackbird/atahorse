// Veri tablosu mantığı — `npm test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tableView } from '../src/ui/DataTable';

const rows = Array.from({ length: 23 }, (_, i) => ({ id: i + 1, name: ['Çiçek', 'Arı', 'İnci', 'Zeytin', 'Ilgaz'][i % 5] + ` ${i + 1}`, n: (i * 7) % 11, v: i % 4 === 0 ? null : i }));
const base = { query: '', dir: 'asc' as const, page: 1, pageSize: 10, locale: 'tr-TR' };

test('sayfalama ve aralık', () => {
  const v = tableView(rows, base);
  assert.equal(v.rows.length, 10); assert.equal(v.pages, 3); assert.equal(v.from, 1); assert.equal(v.to, 10);
  const last = tableView(rows, { ...base, page: 9 });
  assert.equal(last.page, 3, 'taşan sayfa son sayfaya sıkışır'); assert.equal(last.rows.length, 3); assert.equal(last.to, 23);
});

test('arama dile duyarlı ve büyük/küçük harf bağımsız', () => {
  const v = tableView(rows, { ...base, query: 'İNCİ', search: (r) => r.name });
  assert.ok(v.total > 0 && v.rows.every((r) => r.name.startsWith('İnci')));
  assert.equal(tableView(rows, { ...base, query: 'yok', search: (r) => r.name }).total, 0);
});

test('sıralama: Türkçe alfabe, sayısal, boşlar sonda', () => {
  const names = tableView(rows, { ...base, pageSize: 50, sort: (r) => r.name.split(' ')[0] }).rows.map((r) => r.name.split(' ')[0]);
  assert.deepEqual([...new Set(names)], ['Arı', 'Çiçek', 'Ilgaz', 'İnci', 'Zeytin']);
  const desc = tableView(rows, { ...base, pageSize: 50, dir: 'desc', sort: (r) => r.v }).rows.map((r) => r.v);
  assert.equal(desc[0], 22); assert.equal(desc.at(-1), null);
  const asc = tableView(rows, { ...base, pageSize: 50, sort: (r) => r.v }).rows.map((r) => r.v);
  assert.equal(asc.at(-1), null, 'boş değer artan sıralamada da sonda');
});
