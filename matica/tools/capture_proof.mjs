// Prueba del pipeline de captura: la página real, cuadro por cuadro, 60 fps a 3x,
// con reloj virtual (page.clock para JS/rAF + matica.capTick para CSS/WAAPI).
// No es el video: solo demuestra que cada interacción se puede filmar de forma
// determinista. La captura final se hace contra la línea de tiempo bloqueada a la voz.
//
// Uso: node matica/tools/capture_proof.mjs   (con la página en http://127.0.0.1:8124/)
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const __dir = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dir, '..');
const OUT = path.join(ROOT, 'video', 'build', 'capture_proof');
const BASE = process.env.BASE || 'http://127.0.0.1:8124/';
const FPS = 60, DPR = 3, DUR = 5.0;
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

// acciones en segundos (todas con onda de tap visible)
const ACTIONS = [
  { t: 0.35, sel: '#item-latte [data-temp="cold"]' },   // Caliente $60 -> Frío $65, conteo y foto
  { t: 1.45, sel: '#tab-especiales' },                   // indicador y panel
  { t: 2.45, sel: '#item-cold-brew-tonic .item-open' },  // ficha sube
  { t: 3.45, sel: '#si-add', press: 0.12 },              // Agregar: presionado y suelta
];

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: DPR, isMobile: true, hasTouch: true, locale: 'es-MX', timezoneId: 'America/Mexico_City' });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
await page.clock.install({ time: new Date('2026-11-05T10:40:00-06:00') });
await page.goto(BASE + '?capture=1', { waitUntil: 'networkidle' });
await page.waitForFunction(() => document.documentElement.dataset.ready === '1');
await page.evaluate(async () => {
  document.querySelectorAll('img[loading="lazy"]').forEach((i) => (i.loading = 'eager'));
  await document.fonts.ready;
  await Promise.all([...document.images].map((i) => i.decode().catch(() => {})));
});
await page.clock.runFor(1500);
await page.evaluate(() => { const el = document.querySelector('#item-latte'); scrollTo(0, el.getBoundingClientRect().top + scrollY - 330); });
await page.clock.runFor(500);
await page.clock.pauseAt(new Date('2026-11-05T10:40:10-06:00'));

const N = Math.round(DUR * FPS);
let vt = 0, done = new Set(), releases = [];
const t0 = Date.now();
for (let f = 0; f < N; f++) {
  const target = Math.round((f * 1000) / FPS);
  if (target > vt) { await page.clock.runFor(target - vt); vt = target; }
  const t = f / FPS;
  for (const [i, a] of ACTIONS.entries()) {
    if (!done.has(i) && t >= a.t) {
      done.add(i);
      if (a.press) { await page.evaluate((s) => window.matica.press(s, true), a.sel); releases.push({ t: a.t + a.press, a }); }
      else await page.evaluate((s) => window.matica.tap(s), a.sel);
    }
  }
  for (const r of releases.filter((r) => !r.done && t >= r.t)) {
    r.done = true;
    await page.evaluate((s) => { window.matica.press(s, false); window.matica.tap(s); }, r.a.sel);
  }
  await page.evaluate((ms) => window.matica.capTick(ms), vt);
  await page.screenshot({ path: path.join(OUT, `f${String(f).padStart(4, '0')}.png`) });
  if (f % 60 === 0) process.stdout.write(`cuadro ${f}/${N}\n`);
}
const state = await page.evaluate(() => ({ total: window.matica.total, count: window.matica.count, latte: window.matica.state.temps.latte, tab: window.matica.state.tab }));
await browser.close();
console.log('estado final', state, 'errores', errs.length ? errs : 'ninguno', `${((Date.now() - t0) / 1000).toFixed(0)} s`);

const preview = path.join(ROOT, 'review', 'fase0', 'prueba_captura_60fps.mp4');
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', path.join(OUT, 'f%04d.png'),
  '-vf', 'scale=780:-2:flags=lanczos', '-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', preview]);
console.log('vista previa', preview, (fs.statSync(preview).size / 1e6).toFixed(2), 'MB');
