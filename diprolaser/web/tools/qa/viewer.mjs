// Capturas del visor fotorrealista.
// node tools/qa/viewer.mjs <outdir> [modelo] [logo] [tecnicas: bordado,placa] [vistas: threeq,front] [colores: crown=camel,visor=negro]
import { createRequire } from 'node:module';
import fs from 'node:fs';
const { chromium } = createRequire(import.meta.url)('playwright');
const [out = 'shots', model = 'tela', logo = '', techs = 'bordado', views = 'threeq,front,side,back', colors = ''] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
await p.goto('http://localhost:4173/?qa'); await p.addStyleTag({ content: '.summary,.wa-float{display:none!important}' });
await p.evaluate(() => document.getElementById('configurador').scrollIntoView());
await p.waitForFunction(() => window.__cfg && document.querySelector('[data-cfg-canvas]').classList.contains('is-ready'), null, { timeout: 60000 });
if (logo) { await p.setInputFiles('[data-logo-input]', logo); await p.waitForTimeout(900); }
if (model !== 'tela') { await p.click(`[data-group="model"] [data-value="${model}"]`); await p.waitForTimeout(2500); }
for (const kv of colors.split(',').filter(Boolean)) {
  const [part, c] = kv.split('=');
  await p.click(`[data-part="${part}"]`); await p.click(`[data-group="color"] [data-value="${c}"]`); await p.waitForTimeout(1800);
}
await p.evaluate(() => window.__cfg.stopAuto());
const tag = colors ? colors.replace(/[=,]/g, '-') : 'preset';
for (const t of techs.split(',')) {
  await p.click(`[data-group="tech"] [data-value="${t}"]`); await p.waitForTimeout(600);
  for (const v of views.split(',')) {
    await p.evaluate((v) => window.__cfg.setView(v), v); await p.waitForTimeout(1600);
    await (await p.$('[data-cfg-canvas]')).screenshot({ path: `${out}/${model}-${tag}-${t}-${v}.png` });
  }
}
console.log(errs.length ? errs.slice(0, 5).join('\n') : 'sin errores');
await b.close();
