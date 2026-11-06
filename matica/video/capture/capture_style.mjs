// Captura de la página real para la prueba de estilo: 60 fps con reloj virtual
// (page.clock para JS/rAF + matica.capTick para CSS/WAAPI), scroll con inercia,
// la tarjeta se oculta mientras vive en 3D. Textura de la tarjeta a 3x y su rect.
//
// Uso: node matica/video/capture/capture_style.mjs [--dpr 2]   (página en http://127.0.0.1:8124/)
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { STYLE } from '../timeline/style_test.mjs';
import { scrollAt } from '../timeline/timeline.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const VIDEO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(VIDEO, 'build', 'style');
const BASE = process.env.BASE || 'http://127.0.0.1:8124/';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? Number(process.argv[i + 1]) : d; };
const DPR = arg('dpr', 2);
const S = STYLE.T;
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, 'frames'), { recursive: true });

const browser = await chromium.launch();
const ctxOpts = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'es-MX', timezoneId: 'America/Mexico_City' };
const errs = [];

async function open(dpr) {
  const ctx = await browser.newContext({ ...ctxOpts, deviceScaleFactor: dpr });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errs.push(e.message));
  await page.clock.install({ time: new Date('2026-11-05T10:40:00-06:00') });
  await page.goto(BASE + '?capture=1&intro=hold', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.documentElement.dataset.ready === '1');
  await page.evaluate(async () => {
    document.querySelectorAll('img[loading="lazy"]').forEach((i) => (i.loading = 'eager'));
    await document.fonts.ready;
    await Promise.all([...document.images].filter((i) => i.getAttribute('src')).map((i) => i.decode().catch(() => {})));
  });
  await page.clock.runFor(800);
  return { ctx, page };
}

// 1) dónde termina el scroll: "De la casa" con su título bajo el encabezado
const { ctx, page } = await open(DPR);
const geo = await page.evaluate((sel) => {
  const hdr = document.querySelector('#hdr').offsetHeight;
  const sec = document.querySelector('#destacados').getBoundingClientRect().top + scrollY;
  return { hdr, target: Math.round(sec - hdr + 4), card: sel };
}, STYLE.CARD);

// 2) textura de la tarjeta a 3x (misma posición de scroll, antes de ocultarla)
{
  const c3 = await open(3);
  await c3.page.evaluate((y) => { document.documentElement.classList.remove('intro-pre'); scrollTo(0, y); }, geo.target);
  await c3.page.clock.runFor(1200);
  await c3.page.evaluate(() => window.matica.capTick(99999));
  await c3.page.locator(STYLE.CARD).screenshot({ path: path.join(OUT, 'card.png') });
  await c3.ctx.close();
}

// 3) cuadros de la página a 60 fps
await page.clock.pauseAt(new Date('2026-11-05T10:40:10-06:00'));
const N = Math.round(STYLE.DUR * STYLE.PAGE_FPS) + 1;
const manifest = { dpr: DPR, fps: STYLE.PAGE_FPS, viewport: [390, 844], header: geo.hdr, frames: [], cardRect: null };
let vt = 0, introDone = false, hidden = false;
const t0 = Date.now();
for (let f = 0; f < N; f++) {
  const tau = f / STYLE.PAGE_FPS;
  const target = Math.round((f * 1000) / STYLE.PAGE_FPS);
  if (target > vt) { await page.clock.runFor(target - vt); vt = target; }
  if (!introDone && tau >= S.intro) { await page.evaluate(() => window.matica.intro()); introDone = true; }
  const y = tau <= S.scroll[0] ? 0 : scrollAt(tau, S.scroll, 0, geo.target);
  await page.evaluate((yy) => scrollTo(0, yy), y);
  if (!hidden && tau >= S.lift[0]) {
    manifest.cardRect = await page.evaluate((sel) => { const r = document.querySelector(sel).getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; }, STYLE.CARD);
    await page.evaluate((sel) => window.matica.hide(sel, true), STYLE.CARD);
    hidden = true;
  }
  if (hidden && tau >= S.back[1]) { await page.evaluate((sel) => window.matica.hide(sel, false), STYLE.CARD); hidden = false; }
  await page.evaluate((ms) => window.matica.capTick(ms), vt);
  const file = `f${String(f).padStart(4, '0')}.jpg`;
  await page.screenshot({ path: path.join(OUT, 'frames', file), type: 'jpeg', quality: 92 });
  manifest.frames.push({ f, file, scrollY: Math.round(y * 100) / 100 });
}
await ctx.close();
await browser.close();
fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 1));
console.log(`captura: ${N} cuadros a ${DPR}x en ${((Date.now() - t0) / 1000).toFixed(0)} s · tarjeta`, manifest.cardRect, errs.length ? errs : 'sin errores');
