// Tasarım sözleşmesi denetimi — CONVENTIONS.md'deki kesin kuralların makine tarafı.
// İnsan ya da ajan: kural ihlali derlemeyi durdurur. Kullanım: npm run lint:design
// Bilinçli istisna: satıra `design-ok: <gerekçe>` yorumu (gerekçesiz istisna yok).
import fs from 'node:fs';
import path from 'node:path';
import { DICT } from '../src/i18n/dict';

const ROOT = path.resolve(import.meta.dirname, '..');
const SRC = path.join(ROOT, 'src');
/** Ham rengin yaşayabileceği tek iki dosya. */
const COLOR_ALLOW = new Set(['src/styles.css', 'src/lib/brand.ts']);

interface Rule { id: string; test: RegExp; why: string; files: RegExp; allow?: (rel: string) => boolean }
const RULES: Rule[] = [
  { id: 'raw-color', test: /#[0-9a-fA-F]{3,8}\b(?![;"'\w]*&)|\brgba?\(|\bhsla?\(/, why: 'Ham renk yerine belirteç (bg-brand, var(--c-ink), BRAND.*) kullan.', files: /\.(tsx?)$/, allow: (r) => COLOR_ALLOW.has(r) },
  { id: 'gradient', test: /bg-gradient-|linear-gradient|radial-gradient|conic-gradient/, why: 'Marka kuralı: gradient yok.', files: /\.(tsx?|css)$/ },
  { id: 'accent-rail', test: /border-l-(?:[3-9]|\[)/, why: 'Kalın sol vurgu çizgisi ajan üretimi kalıbıdır; kart ayrımı için yüzey/aralık kullan.', files: /\.tsx$/ },
  { id: 'glow-shadow', test: /shadow-(?:brand|gold|ok|bad|night)\b|shadow-\[/, why: 'Renkli/ışıyan gölge yok; yalnız .elev-1/2/3.', files: /\.tsx$/ },
  { id: 'font', test: /fontFamily\s*:|font-\[/, why: 'Yazı ailesi yalnız tasarım sisteminden: font-display (Plus Jakarta Sans) / font-sans (Inter) / h-brand (Cinzel, yalnız marka).', files: /\.tsx$/ },
];

const walk = (d: string): string[] => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
const files = walk(SRC);
const problems: string[] = [];
const isComment = (line: string) => /^\s*(\/\/|\/\*|\*)/.test(line);

for (const f of files) {
  const rel = path.relative(ROOT, f).split(path.sep).join('/');
  const lines = fs.readFileSync(f, 'utf8').split('\n');
  for (const r of RULES) {
    if (!r.files.test(rel) || r.allow?.(rel)) continue;
    lines.forEach((line, i) => {
      if (isComment(line) || line.includes('design-ok:')) return;
      const code = line.replace(/\/\/.*$/, '').replace(/&#x?[0-9a-fA-F]+;/g, '');
      if (r.test.test(code)) problems.push(`${rel}:${i + 1} [${r.id}] ${r.why}\n    ${line.trim().slice(0, 140)}`);
    });
  }
}

/* Sözlük: her anahtar 3 dilde dolu; kodda kullanılan sabit anahtarların hepsi sözlükte. */
const dict = DICT as Record<string, readonly string[]>;
for (const [k, row] of Object.entries(dict)) {
  if (row.length !== 3 || row.some((x) => !x || !x.trim())) problems.push(`src/i18n/dict.ts [i18n] "${k}" TR/EN/RU üçü de dolu olmalı.`);
}
for (const f of files.filter((x) => /\.tsx?$/.test(x))) {
  const rel = path.relative(ROOT, f).split(path.sep).join('/');
  const text = fs.readFileSync(f, 'utf8');
  for (const m of text.matchAll(/\bt\(\s*'([a-z0-9_]+)'/g)) {
    if (!(m[1] in dict)) {
      const line = text.slice(0, m.index).split('\n').length;
      problems.push(`${rel}:${line} [i18n] "${m[1]}" sözlükte yok (kullanıcı genel hata metni görür).`);
    }
  }
}

if (problems.length) {
  console.error(`✗ Tasarım sözleşmesi: ${problems.length} ihlal\n`);
  for (const p of problems) console.error(`  ${p}`);
  process.exit(1);
}
console.log(`✓ Tasarım sözleşmesi: ${files.length} dosya, ${RULES.length} kural + sözlük denetimi temiz.`);
