// Web paketi derleyici: esbuild (TS/React, kod bölme) + Tailwind CSS v4 (programatik derleme).
// Kullanım: tsx scripts/build-web.ts [--watch]   →   dist/web/{index.html, assets/*}
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import * as esbuild from 'esbuild';
import { compile } from 'tailwindcss';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = path.join(ROOT, 'dist/web');
const ASSETS = path.join(OUT, 'assets');
const watch = process.argv.includes('--watch');
const prod = !watch;
const require = createRequire(import.meta.url);

const walk = (d: string): string[] => fs.existsSync(d)
  ? fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]))
  : [];

/** Tailwind sınıf adaylarını kaynaklardan çıkarır (v4 oxide tarayıcısının eşdeğeri, regex tabanlı). */
function candidates() {
  const set = new Set<string>();
  for (const f of [...walk(path.join(ROOT, 'src')), ...walk(path.join(ROOT, 'shared'))].filter((x) => /\.(tsx?|html)$/.test(x))) {
    const txt = fs.readFileSync(f, 'utf8');
    // Köşeli parantezli keyfi değerler (ör. grid-cols-[250px_minmax(0,1fr)]) bütün kalmalı:
    // yalnızca boşluk/tırnak/süslü parantezde böl, sonra parantez/virgülle ikincil parçaları da ekle.
    for (const m of txt.matchAll(/[^\s"'`<>{}\\;]+/g)) {
      const c = m[0];
      if (c.length < 2 || c.length > 160) continue;
      set.add(c);
      for (const part of c.split(/[(),]/)) if (part.length > 1) set.add(part);
      if (c.endsWith(':')) set.add(c.slice(0, -1));
    }
  }
  return [...set];
}

async function buildCss() {
  const entry = path.join(ROOT, 'src/styles.css');
  const css = fs.readFileSync(entry, 'utf8');
  const twDir = path.dirname(require.resolve('tailwindcss/package.json'));
  const compiler = await compile(css, {
    base: path.dirname(entry),
    loadStylesheet: async (id: string, base: string) => {
      const file = id === 'tailwindcss' ? path.join(twDir, 'index.css')
        : id.startsWith('tailwindcss/') ? path.join(twDir, id.slice('tailwindcss/'.length))
        : path.resolve(base, id);
      return { path: file, base: path.dirname(file), content: fs.readFileSync(file, 'utf8') };
    },
    loadModule: async () => { throw new Error('Tailwind JS eklentileri desteklenmiyor'); },
  } as Parameters<typeof compile>[1]);
  const out = compiler.build(candidates());
  const min = prod ? (await esbuild.transform(out, { loader: 'css', minify: true })).code : out;
  return min;
}

const hash8 = (s: string | Uint8Array) => crypto.createHash('sha256').update(s).digest('hex').slice(0, 8);

async function writeIndex(jsFile: string, cssFile: string) {
  const tpl = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const html = tpl
    .replace('<!--CSS-->', `<link rel="stylesheet" href="/assets/${cssFile}" />`)
    .replace('<!--JS-->', `<script type="module" src="/assets/${jsFile}"></script>`);
  fs.writeFileSync(path.join(OUT, 'index.html'), html);
}

function copyPublic() {
  const pub = path.join(ROOT, 'public');
  for (const f of walk(pub)) {
    const dst = path.join(OUT, path.relative(pub, f));
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.copyFileSync(f, dst);
  }
}

const esbuildOptions: esbuild.BuildOptions = {
  entryPoints: { app: path.join(ROOT, 'src/main.tsx') },
  bundle: true,
  splitting: true,
  format: 'esm',
  outdir: ASSETS,
  entryNames: prod ? '[name]-[hash]' : '[name]',
  chunkNames: 'chunk-[hash]',
  minify: prod,
  sourcemap: prod ? false : 'inline',
  target: ['es2022', 'chrome110', 'safari16', 'firefox115'],
  jsx: 'automatic',
  metafile: true,
  legalComments: 'none',
  define: { 'process.env.NODE_ENV': JSON.stringify(prod ? 'production' : 'development') },
  alias: { '@': path.join(ROOT, 'src'), '@shared': path.join(ROOT, 'shared') },
  logLevel: 'warning',
};

async function once() {
  const t0 = Date.now();
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(ASSETS, { recursive: true });
  copyPublic();
  const res = await esbuild.build(esbuildOptions);
  const js = Object.keys(res.metafile!.outputs).find((k) => /assets\/app(-\w+)?\.js$/.test(k))!;
  const css = await buildCss();
  const cssFile = `app-${hash8(css)}.css`;
  fs.writeFileSync(path.join(ASSETS, cssFile), css);
  await writeIndex(path.basename(js), cssFile);
  const size = Object.entries(res.metafile!.outputs).filter(([k]) => k.endsWith('.js')).reduce((s, [, v]) => s + v.bytes, 0);
  console.log(`[web] ${((Date.now() - t0) / 1000).toFixed(1)} sn · js ${(size / 1024).toFixed(0)} KB · css ${(css.length / 1024).toFixed(0)} KB`);
}

if (!watch) {
  await once();
} else {
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(ASSETS, { recursive: true });
  copyPublic();
  const ctx = await esbuild.context({
    ...esbuildOptions,
    plugins: [{
      name: 'css-and-html',
      setup(b) {
        b.onEnd(async (r) => {
          if (r.errors.length) return;
          const css = await buildCss();
          fs.writeFileSync(path.join(ASSETS, 'app.css'), css);
          await writeIndex('app.js', 'app.css');
          console.log(`[web] yeniden derlendi ${new Date().toLocaleTimeString()}`);
        });
      },
    }],
  });
  await ctx.watch();
  console.log('[web] izleniyor…');
}
