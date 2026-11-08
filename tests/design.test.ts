// Tasarım sözleşmesi testleri: belirteç aynası kaymaz, denetleyici ihlali yakalar.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { BRAND } from '../src/lib/brand';

const css = fs.readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
const block = (selector: string) => css.slice(css.indexOf(selector), css.indexOf('}', css.indexOf(selector)));
const KEY: Record<string, string> = { bg: '--c-bg', surface: '--c-surface', ink: '--c-ink', ink3: '--c-ink-3', lineStrong: '--c-line-strong', brand: '--c-brand', gold: '--c-gold', night: '--c-night', onNightGold: '--c-on-night-gold' };

test('BRAND aynası styles.css belirteçleriyle birebir aynı', () => {
  for (const [theme, sel] of [['paper', '[data-sheet="paper"]'], ['ink', '[data-sheet="ink"]']] as const) {
    const b = block(sel);
    for (const [k, v] of Object.entries(BRAND[theme])) {
      const m = b.match(new RegExp(`${KEY[k]}:\\s*(#[0-9a-fA-F]{3,8})`));
      assert.ok(m, `${theme} ${KEY[k]} bulunamadı`);
      assert.equal(m![1].toLowerCase(), v.toLowerCase(), `${theme}.${k} kaydı`);
    }
  }
});

test('denetleyici: depo temiz, ham renk eklenince yakalar', () => {
  const run = () => execFileSync(process.execPath, ['--import', 'tsx', 'scripts/check-design.ts'], { stdio: 'pipe' }).toString();
  assert.match(run(), /temiz/);
  const probe = 'src/ui/__probe.tsx';
  fs.writeFileSync(probe, "export const P = () => <div className=\"text-[#ff0000] border-l-4 bg-gradient-to-r\" />;\n");
  try {
    assert.throws(run, (e: { stderr: Buffer }) => /raw-color/.test(e.stderr.toString()) && /accent-rail/.test(e.stderr.toString()) && /gradient/.test(e.stderr.toString()));
  } finally { fs.rmSync(probe); }
});
