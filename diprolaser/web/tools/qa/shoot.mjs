// Capturas de revisión: node tools/qa/shoot.mjs <url> <outdir> [ancho] [alto] [scale]
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
import fs from 'node:fs';
const [url = 'http://localhost:4173/?qa', out = 'shots', w = '390', h = '844', scale = '1'] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: +scale, hasTouch: +w < 800, isMobile: +w < 800 });
const page = await ctx.newPage();
const logs = [];
page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) logs.push(`${m.type()}: ${m.text()}`); });
page.on('pageerror', (e) => logs.push(`pageerror: ${e.message}`));
await page.goto(url, { waitUntil: 'load' });
await page.waitForTimeout(2500);
await page.screenshot({ path: `${out}/00-hero.jpg`, quality: 70 });
const ids = ['configurador', 'placa', 'regalos', 'tecnicas', 'proceso', 'videos', 'aguascalientes', 'contacto'];
for (const [i, id] of ids.entries()) {
  await page.evaluate((id) => document.getElementById(id).scrollIntoView({ block: 'start' }), id);
  await page.waitForTimeout(id === 'configurador' ? 9000 : 2200);
  await page.screenshot({ path: `${out}/${String(i + 1).padStart(2, '0')}-${id}.jpg`, quality: 70 });
}
const sw = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
console.log(JSON.stringify(sw));
console.log(logs.slice(0, 30).join('\n'));
await browser.close();
