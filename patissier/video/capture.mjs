// Captura la página real cuadro por cuadro. Sin relojes: el estado de la página es función pura de t
// (window.pat.cap), así cualquier cuadro se puede volver a capturar suelto y siempre sale igual.
// Uso: node video/capture.mjs [--from 2.25] [--to 15.25] [--dpr 3]
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as TL from './timeline/timeline.mjs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'build/capture');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? Number(process.argv[i + 1]) : d; };
const DPR = arg('dpr', 3), T0 = arg('from', TL.SCREEN[0]), T1 = arg('to', TL.SCREEN[1]);
fs.mkdirSync(path.join(OUT, 'frames'), { recursive: true });

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: DPR, isMobile: true, hasTouch: true, locale: 'es-MX' });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  await page.goto('file://' + path.join(ROOT, 'site/index.html') + '?capture=1');
  await page.waitForFunction(() => document.documentElement.dataset.ready === '1');
  await page.evaluate(async () => { await Promise.all([...document.images].map((i) => i.decode().catch(() => {}))); });
  const rect = (sel) => page.evaluate((s) => window.pat.rect(s), sel);
  // destinos de scroll medidos en la página real (con todo en su estado final)
  await page.evaluate(() => window.pat.cap({ intro: 1, card: 1, typed: 1, gal: 1, order: 1, sizes: 1 }));
  const dest = {
    top: 0, card: 104,
    gallery: Math.round((await rect('#galeria .over')).docY - 96),
    order: Math.round((await rect('#sizes')).docY - 400),
  };
  const rects = {};
  for (const [k, sel] of Object.entries({ review: '#review', sizes: '#sizes', mediano: '#sizes .size[data-size="Mediano"]', cta: '#cta', shot: '#shot', title: '#title' })) rects[k] = await rect(sel);
  const center = (r, y) => ({ x: r.x + r.w / 2, y: r.docY + r.h / 2 - y });
  const scrollAt = (t) => { let y = 0; for (const s of TL.SCROLLS) { if (t >= s.t[0]) y = TL.lerp(y, dest[s.to], TL.scrollEase(TL.prog(t, s.t))); } return y; };

  const man = { dpr: DPR, fps: TL.FPS, viewport: [390, 844], dest, rects, frames: {} };
  // el primer cuadro tras abrir la página puede salir antes de que pinte: un cuadro de calentamiento que se descarta
  await page.evaluate(([yy, st]) => { window.scrollTo({ top: yy, behavior: 'instant' }); window.pat.cap(st); }, [scrollAt(T0), TL.pageState(T0)]);
  await page.screenshot({ type: 'jpeg', quality: 50 });
  const f0 = Math.round(T0 * TL.FPS), f1 = Math.round(T1 * TL.FPS), t00 = Date.now();
  for (let f = f0; f <= f1; f++) {
    const t = f / TL.FPS, y = scrollAt(t), st = TL.pageState(t);
    if (st.touch) { const c = center(st.touch.key === 'size' ? rects.mediano : rects.cta, y); st.touch = { ...st.touch, x: c.x + (st.touch.key === 'cta' ? 46 : 0), y: c.y + 4 }; }
    await page.evaluate(([yy, s]) => { window.scrollTo({ top: yy, behavior: 'instant' }); window.pat.cap(s); }, [y, st]);
    const file = `frames/f${String(f).padStart(4, '0')}.jpg`;
    await page.screenshot({ path: path.join(OUT, file), type: 'jpeg', quality: 93 });
    man.frames[f] = { file, y: Math.round(y * 100) / 100, v: Math.round((scrollAt(t + 1 / 120) - scrollAt(t - 1 / 120)) * 60 * 100) / 100 };
    if ((f - f0) % 60 === 0) console.log(`t=${t.toFixed(2)} y=${y.toFixed(0)} ${((Date.now() - t00) / 1000).toFixed(0)} s`);
  }
  man.errors = errs;
  // si se capturó un tramo, se conserva lo anterior del manifiesto
  const mp = path.join(OUT, 'manifest.json');
  if (fs.existsSync(mp)) { const old = JSON.parse(fs.readFileSync(mp)); man.frames = { ...old.frames, ...man.frames }; }
  fs.writeFileSync(mp, JSON.stringify(man));
  console.log('listo', Object.keys(man.frames).length, 'cuadros', dest, errs);
  await browser.close();
})();
