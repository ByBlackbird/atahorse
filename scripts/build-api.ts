// API paketi: server/index.ts → dist-server/index.js (tek dosya ESM) + migrations kopyası.
import fs from 'node:fs';
import path from 'node:path';
import * as esbuild from 'esbuild';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = path.join(ROOT, 'dist-server');
fs.rmSync(OUT, { recursive: true, force: true });

await esbuild.build({
  entryPoints: [path.join(ROOT, 'server/index.ts')],
  outfile: path.join(OUT, 'index.js'),
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  sourcemap: 'linked',
  legalComments: 'none',
  logLevel: 'warning',
  // CJS bağımlılıklar için require köprüsü
  banner: { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" },
});

fs.cpSync(path.join(ROOT, 'server/db/migrations'), path.join(OUT, 'migrations'), { recursive: true });
console.log('[api] dist-server/index.js hazır');
