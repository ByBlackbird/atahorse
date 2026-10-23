// Uçtan uca duman testi: kayıt → profil testi → kurs → okuma/podcast/slayt/harita/asistan → görev/quiz → panel/profil → tema/dil → mobil.
// Kullanım: BASE=http://localhost:3000 node tests/e2e.mjs [ekran-görüntüsü-klasörü]
import fs from 'node:fs';
import { chromium } from 'playwright';
const OUT = process.argv[2] || 'tests/screens';
fs.mkdirSync(OUT, { recursive: true });
const B = process.env.BASE || 'http://localhost:3000';
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, locale: 'tr-TR' });
await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message));
const shot = (n, full = false) => page.screenshot({ path: `${OUT}/${n}.png`, fullPage: full });
let failed = 0;
const step = async (name, fn) => { try { await fn(); console.log('✓', name); } catch (e) { failed++; console.log('✗', name, e.message.split('\n')[0]); await shot('fail-' + name.replace(/\W+/g, '_')); } };

await step('landing', async () => { await page.goto(B + '/'); await page.waitForSelector('h1'); await page.waitForTimeout(500); await shot('01-landing'); await shot('01-landing-full', true); });
await step('register', async () => {
  await page.goto(B + '/kayit');
  const inputs = page.locator('form input');
  await inputs.nth(0).fill('Ayşe Yılmaz'); const u = 'ayse' + Date.now().toString(36); await inputs.nth(1).fill(u); await inputs.nth(2).fill(u + '@example.com'); await inputs.nth(3).fill('Sifre12345');
  await shot('02-register');
  await page.locator('form button[class*=btn-primary]').click();
  await page.waitForURL('**/profil-testi');
});
await step('profile-test', async () => {
  await page.getByRole('button', { name: /Teste başla/ }).click();
  for (let i = 0; i < 12; i++) {
    const opts = page.locator('.card .grid > button');
    await opts.first().waitFor();
    if (i === 3) await shot('03-test-question');
    await opts.nth(i % 2).click();
    await page.waitForTimeout(350);
  }
  await page.getByText(/Başlangıç profilin/).waitFor({ timeout: 8000 });
  await shot('04-test-result');
});
await step('create-course', async () => {
  await page.goto(B + '/kurs-olustur');
  await page.locator('input.input').first().fill('Fotosentez');
  await shot('05-course-new');
  await page.getByRole('button', { name: /Kursu oluştur/ }).click();
  await page.waitForTimeout(400); await shot('06-generating');
  await page.waitForURL(/\/kurs\/\d+$/, { timeout: 30000 });
  globalThis.COURSE = new URL(page.url()).pathname;
  await page.waitForTimeout(1500);
});
await step('studio-entry', async () => { await shot('07-studio-entry'); });
await step('reading', async () => {
  await page.getByRole('tab', { name: /Okuma/ }).click();
  await page.waitForTimeout(800);
  await shot('08-reading');
  await page.mouse.wheel(0, 1600); await page.waitForTimeout(800); await shot('09-reading-boxes');
});
await step('check-popup', async () => {
  for (let k = 0; k < 6; k++) { await page.mouse.wheel(0, 600); await page.waitForTimeout(300); }
  const dlg = page.locator('div[role=dialog]');
  if (await dlg.count()) {
    await dlg.locator('.grid > button').nth(2).click();
    await dlg.getByRole('button', { name: /Kontrol et/ }).click();
    await page.waitForTimeout(700);
    await shot('10-check-popup');
  } else { await shot('10-check-inline'); }
});
await step('podcast', async () => {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.getByRole('tab', { name: /Podcast/ }).click();
  await page.waitForTimeout(1200);
  await page.getByRole('button', { name: /Oynat/ }).click();
  await page.waitForTimeout(1500);
  await shot('11-podcast');
  await page.getByRole('button', { name: /Duraklat/ }).click();
});
await step('slides', async () => {
  await page.getByRole('tab', { name: /Slayt/ }).click();
  await page.waitForTimeout(2500);
  await shot('12-slides');
  await page.keyboard.press('ArrowRight'); await page.waitForTimeout(1500); await shot('13-slides-2');
  await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight'); await page.waitForTimeout(1500); await shot('13b-slides-4');
});
await step('mindmap', async () => {
  await page.getByRole('tab', { name: /Harita/ }).click();
  await page.waitForTimeout(1500);
  await page.locator('svg g.cursor-grab').nth(1).click();
  await page.getByRole('button', { name: /AI dal önerisi/ }).click();
  await page.waitForTimeout(1200);
  const chip = page.locator('button.chip-brand').first();
  if (await chip.count()) await chip.click();
  await page.waitForTimeout(1800);
  await shot('14-mindmap');
});
await step('ai-panel', async () => {
  await page.getByRole('tab', { name: /Okuma/ }).click();
  await page.waitForTimeout(600);
  const panel = page.locator('aside').last();
  await panel.getByRole('button', { name: /Farklı metotla öğret/ }).first().click();
  await page.waitForTimeout(1200);
  await shot('15-ai-panel');
  await panel.getByRole('button', { name: /Şemaya dök/ }).click();
  await page.waitForTimeout(1000);
  await shot('16-ai-diagram');
});
await step('task+quiz', async () => {
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(600);
  const boxes = page.locator('input[type=checkbox]');
  for (let i = 0; i < await boxes.count(); i++) await boxes.nth(i).check();
  await page.locator('textarea').fill('Bugün fotosentezin büyük resmini kendi örneğimle açıkladım.');
  await page.getByRole('button', { name: /Görevi onayla/ }).click();
  await page.waitForTimeout(1200);
  await shot('17-task-done');
  // quiz: doğru cevabı bilmiyoruz → ilk denemede seçenekleri dene, açıklamalardan doğruyu oku
  const qs = page.locator('ol li:has(input[type=radio])');
  const n = await qs.count();
  for (let i = 0; i < n; i++) await qs.nth(i).locator('input[type=radio]').first().check();
  await page.getByRole('button', { name: /Cevapları gönder/ }).click();
  await page.waitForTimeout(1200);
  await shot('18-quiz-result');
});
await step('dashboard', async () => { await page.goto(B + '/panel'); await page.waitForTimeout(1200); await shot('19-dashboard'); });
await step('profile', async () => { await page.goto(B + '/profil'); await page.waitForTimeout(1200); await shot('20-profile'); await shot('20-profile-full', true); });
await step('ink-theme', async () => {
  await page.getByRole('button', { name: /Mürekkep/ }).first().click();
  await page.waitForTimeout(600);
  await page.goto(B + globalThis.COURSE); await page.waitForTimeout(1800); await shot('21-ink-studio');
});
await step('english', async () => {
  await page.goto(B + globalThis.COURSE);
  await page.locator('header').getByRole('button', { name: /^en$/i }).click({ timeout: 5000 });
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: /Translate/ }).click({ timeout: 5000 });
  await page.locator('button', { hasText: 'English' }).click({ timeout: 5000 });
  await page.waitForTimeout(1800);
  await shot('22-english');
});
await step('mobile', async () => {
  const m = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, storageState: await ctx.storageState() });
  await m.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  const p = await m.newPage();
  await p.goto(B + globalThis.COURSE); await p.waitForTimeout(1800);
  await p.screenshot({ path: `${OUT}/23-mobile-studio.png` });
  await p.goto(B + '/'); await p.waitForTimeout(800);
  await p.screenshot({ path: `${OUT}/24-mobile-landing.png` });
  await m.close();
});
const real = errors.filter((e) => !/ERR_FAILED/.test(e));
console.log('console errors:', real.length); real.slice(0, 15).forEach((e) => console.log('  ', e.slice(0, 220)));
if (failed) process.exitCode = 1;
await browser.close();
