// Capturas de la gorra 3D en 4 ángulos: node tools/qa/cap4.mjs <url> <outdir> [logoPath]
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
import fs from 'node:fs';
const [url = 'http://localhost:4173/', out = 'cap4', logo = ''] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
const logs = []; page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.text()); }); page.on('pageerror', (e) => logs.push(e.message));
await page.goto(url, { waitUntil: 'load' });
await page.evaluate(() => document.getElementById('configurador').scrollIntoView());
await page.waitForFunction(() => window.__cfg, null, { timeout: 60000 });
if (logo) { await page.setInputFiles('[data-logo-input]', logo); await page.waitForTimeout(1500); }
const extra = process.env.MODEL; if (extra) { await page.click(`[data-group="model"] [data-value="${extra}"]`); await page.waitForTimeout(2200); }
const tech = process.env.TECH; if (tech) { await page.click(`[data-group="tech"] [data-value="${tech}"]`); await page.waitForTimeout(800); }
await page.evaluate(() => window.__cfg.stopAuto());
for (const v of ['front', 'side', 'back', 'visor']) {
  await page.evaluate((v) => window.__cfg.setView(v), v);
  await page.waitForTimeout(2600);
  const el = await page.$('[data-cfg-canvas]');
  await el.screenshot({ path: `${out}/${v}.png` });
}
console.log(logs.slice(0, 20).join('\n'));
await browser.close();
