// Veritabanı istemcisi: Node yerleşik SQLite (node:sqlite) + Drizzle (sqlite-proxy sürücüsü).
// Yerel derleme gerektiren bağımlılık yok; Postgres'e geçişte yalnızca bu dosya + schema değişir.
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { drizzle } from 'drizzle-orm/sqlite-proxy';
import { env } from '../env';
import * as schema from './schema';

type SqlValue = null | number | bigint | string | Uint8Array;

export const DATA_DIR = path.resolve(env.DATA_DIR);
export const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

export const sqlite = new DatabaseSync(env.NODE_ENV === 'test' ? ':memory:' : path.join(DATA_DIR, 'atahorse.db'));
sqlite.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA synchronous = NORMAL;
  PRAGMA foreign_keys = ON;
  PRAGMA busy_timeout = 5000;
`);

/** Statement önbelleği — aynı SQL'i tekrar hazırlamamak için. */
const stmtCache = new Map<string, ReturnType<DatabaseSync['prepare']>>();
const prep = (sql: string) => {
  let s = stmtCache.get(sql);
  if (!s) {
    s = sqlite.prepare(sql);
    if (stmtCache.size > 500) stmtCache.clear();
    stmtCache.set(sql, s);
  }
  return s;
};
const norm = (params: unknown[]): SqlValue[] =>
  params.map((p) => (typeof p === 'boolean' ? (p ? 1 : 0) : p === undefined ? null : (p as SqlValue)));

export const db = drizzle(async (sql, params, method) => {
  const st = prep(sql);
  const args = norm(params);
  if (method === 'run') {
    st.setReturnArrays(false);
    st.run(...args);
    return { rows: [] };
  }
  st.setReturnArrays(true);
  if (method === 'get') {
    const row = st.get(...args) as unknown[] | undefined;
    return { rows: (row ?? undefined) as unknown as unknown[] };
  }
  return { rows: st.all(...args) as unknown as unknown[][] };
}, { schema });

export type DB = typeof db;

/** Basit, sıralı migrator: server/db/migrations/*.sql dosyalarını bir kez uygular. */
export function migrate(dir = path.join(import.meta.dirname, 'migrations')) {
  const candidates = [dir, path.resolve('server/db/migrations'), path.resolve('dist-server/migrations')];
  const found = candidates.find((d) => fs.existsSync(d));
  if (!found) throw new Error('migrations klasörü bulunamadı');
  sqlite.exec('CREATE TABLE IF NOT EXISTS __migrations (name TEXT PRIMARY KEY, applied_at INTEGER NOT NULL)');
  const done = new Set((sqlite.prepare('SELECT name FROM __migrations').all() as { name: string }[]).map((r) => r.name));
  for (const f of fs.readdirSync(found).filter((x) => x.endsWith('.sql')).sort()) {
    if (done.has(f)) continue;
    const sql = fs.readFileSync(path.join(found, f), 'utf8');
    sqlite.exec('BEGIN');
    try {
      sqlite.exec(sql);
      sqlite.prepare('INSERT INTO __migrations (name, applied_at) VALUES (?, ?)').run(f, Date.now());
      sqlite.exec('COMMIT');
      console.log(`[db] migration uygulandı: ${f}`);
    } catch (e) {
      sqlite.exec('ROLLBACK');
      throw e;
    }
  }
}

/** Senkron, gerçek transaction (node:sqlite tek bağlantı) — yalnızca kısa, await içermeyen işler için. */
export function txSync<T>(fn: () => T): T {
  sqlite.exec('BEGIN IMMEDIATE');
  try {
    const r = fn();
    sqlite.exec('COMMIT');
    return r;
  } catch (e) {
    sqlite.exec('ROLLBACK');
    throw e;
  }
}
