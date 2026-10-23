// Drizzle şemasından SQLite DDL üretir → server/db/migrations/NNNN_name.sql
// Kullanım: npx tsx scripts/gen-migration.ts init
// Not: ilk sürüm tam şemayı üretir; sonraki değişiklikler için yeni dosyaya ALTER yazılır
// (veya drizzle-kit generate kullanılır).
import fs from 'node:fs';
import path from 'node:path';
import { getTableConfig, SQLiteTable } from 'drizzle-orm/sqlite-core';
import * as schema from '../server/db/schema';

const lit = (v: unknown) => (typeof v === 'string' ? `'${v.replace(/'/g, "''")}'` : typeof v === 'boolean' ? (v ? '1' : '0') : String(v));

const out: string[] = [];
for (const t of Object.values(schema)) {
  if (!(t instanceof SQLiteTable)) continue;
  const c = getTableConfig(t);
  const lines: string[] = [];
  const compositePk = c.primaryKeys.length > 0;
  for (const col of c.columns) {
    let l = `  "${col.name}" ${col.getSQLType()}`;
    if (col.primary && !compositePk) l += ' PRIMARY KEY' + ((col as unknown as { autoIncrement?: boolean }).autoIncrement ? ' AUTOINCREMENT' : '');
    if (col.notNull && !col.primary) l += ' NOT NULL';
    if (col.default !== undefined && typeof col.default !== 'object') l += ` DEFAULT ${lit(col.default)}`;
    if (col.isUnique) l += ' UNIQUE';
    lines.push(l);
  }
  for (const pk of c.primaryKeys) lines.push(`  PRIMARY KEY (${pk.columns.map((x) => `"${x.name}"`).join(', ')})`);
  for (const fk of c.foreignKeys) {
    const r = fk.reference();
    const ft = getTableConfig(r.foreignTable as SQLiteTable).name;
    lines.push(`  FOREIGN KEY (${r.columns.map((x) => `"${x.name}"`).join(', ')}) REFERENCES "${ft}"(${r.foreignColumns.map((x) => `"${x.name}"`).join(', ')}) ON DELETE ${(fk.onDelete ?? 'no action').toUpperCase()}`);
  }
  out.push(`CREATE TABLE IF NOT EXISTS "${c.name}" (\n${lines.join(',\n')}\n);`);
  for (const ix of c.indexes) {
    const cfg = ix.config;
    out.push(`CREATE ${cfg.unique ? 'UNIQUE ' : ''}INDEX IF NOT EXISTS "${cfg.name}" ON "${c.name}" (${cfg.columns.map((x) => `"${(x as { name: string }).name}"`).join(', ')});`);
  }
}
const name = process.argv[2] || 'init';
const dir = path.join(import.meta.dirname, '../server/db/migrations');
fs.mkdirSync(dir, { recursive: true });
const n = String(fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).length + 1).padStart(4, '0');
const file = path.join(dir, `${n}_${name}.sql`);
fs.writeFileSync(file, `-- Atahorse migration ${n}: ${name} (drizzle şemasından üretildi)\n${out.join('\n\n')}\n`);
console.log('→', file);
