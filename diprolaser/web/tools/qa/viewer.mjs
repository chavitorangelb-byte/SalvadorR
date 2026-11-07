// Capturas del visor fotorrealista: node tools/qa/viewer.mjs <outdir> [modelo] [logo] [tecnica] [vistas]
import { createRequire } from 'node:module';
import fs from 'node:fs';
const { chromium } = createRequire(import.meta.url)('playwright');
const [out = 'shots', model = 'tela', logo = '', tech = '', views = 'threeq,front,side,back'] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
await p.goto('http://localhost:4173/?qa'); await p.addStyleTag({ content: '.summary,.wa-float{display:none!important}' });
await p.evaluate(() => document.getElementById('configurador').scrollIntoView());
await p.waitForFunction(() => window.__cfg && document.querySelector('[data-cfg-canvas]').classList.contains('is-ready'), null, { timeout: 60000 });
if (logo) { await p.setInputFiles('[data-logo-input]', logo); await p.waitForTimeout(900); }
if (model !== 'tela') { await p.click(`[data-group="model"] [data-value="${model}"]`); await p.waitForTimeout(2500); }
if (tech) { await p.click(`[data-group="tech"] [data-value="${tech}"]`); await p.waitForTimeout(400); }
await p.evaluate(() => window.__cfg.stopAuto());
for (const v of views.split(',')) {
  await p.evaluate((v) => window.__cfg.setView(v), v); await p.waitForTimeout(1600);
  await (await p.$('[data-cfg-canvas]')).screenshot({ path: `${out}/${model}-${tech || 'def'}-${v}.png` });
}
console.log(errs.length ? errs.slice(0, 5).join('\n') : 'sin errores');
await b.close();
