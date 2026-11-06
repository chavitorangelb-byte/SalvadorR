// Captura de la página real para el video completo: 60 fps a 3x con reloj virtual
// (page.clock para JS/rAF + matica.capTick para CSS/WAAPI), siguiendo timeline.json.
// - Acciones (taps con onda, scrolls con inercia del arnés, ocultar piezas que viven en 3D...).
// - Sondas: rects de elementos en su instante (foco de push-ins y blancos de la gota).
// - Rastros: rect por cuadro de piezas que se mueven mientras están en 3D (Agregar).
// - Texturas de piezas 3D a 3x (tarjeta cold brew, botón Agregar, reseñas 1-3).
// - En los scrolls guarda 4 subcapturas por cuadro (motion blur real del contenido).
//
// Uso: matica/tools/serve.sh && node matica/video/capture/capture.mjs [--dpr 3] [--q 90]
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { scrollAt } from '../timeline/timeline.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const VIDEO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = process.env.OUT ? path.resolve(process.env.OUT) : path.join(VIDEO, 'build', 'capture');   // OUT=... para capturar aparte
const BASE = process.env.BASE || 'http://127.0.0.1:8124/';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? Number(process.argv[i + 1]) : d; };
const DPR = arg('dpr', 3), Q = arg('q', 90), FPS = 60, SUB = 4;
const TL = JSON.parse(fs.readFileSync(path.join(VIDEO, 'timeline', 'timeline.json'), 'utf8'));
const T = TL.T;
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, 'frames'), { recursive: true });
fs.mkdirSync(path.join(OUT, 'tex'), { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: DPR, isMobile: true, hasTouch: true, locale: 'es-MX', timezoneId: 'America/Mexico_City' });
const page = await ctx.newPage();
const errs = [];
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
await page.clock.pauseAt(new Date('2026-11-05T10:40:10-06:00'));
const E = (fn, a) => page.evaluate(fn, a);
const HDR = await E(() => document.querySelector('#hdr').offsetHeight);
const docTop = (sel) => E((s) => { const e = document.querySelector(s); return e.getBoundingClientRect().top + scrollY; }, sel);
const rectOf = (sel) => E((s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; }, sel);
const TARGETS = {
  menu: async () => (await docTop('#menu')) - HDR + 4,
  vive: async () => (await docTop('#vive')) - HDR - 6,
  reviews: async () => (await docTop('#revs')) - HDR - 14,
  visit: async () => (await docTop('#visitanos')) - HDR + 2,
};
// piezas 3D: textura (antes de ocultarlas) y rect
async function grabTex(name, sel, { trackScroll = false } = {}) {
  let restore = null;
  if (trackScroll) {   // tarjetas dentro de un carrusel: se trae cada una a la vista solo para fotografiarla
    restore = await E((s) => { const el = document.querySelector(s), tr = el.parentElement; const x0 = tr.scrollLeft;
      tr.style.scrollSnapType = 'none'; tr.scrollLeft = el.offsetLeft - 20; return x0; }, sel);
  }
  const r = await rectOf(sel);
  const clip = { x: Math.max(0, r.x), y: Math.max(0, r.y), width: Math.min(390, r.x + r.w) - Math.max(0, r.x), height: Math.min(844, r.y + r.h) - Math.max(0, r.y) };
  await page.screenshot({ path: path.join(OUT, 'tex', name + '.png'), clip });
  if (trackScroll) await E(([s, x0]) => { const tr = document.querySelector(s).parentElement; tr.scrollLeft = x0; tr.style.scrollSnapType = ''; }, [sel, restore]);
  manifest.tex[name] = { file: 'tex/' + name + '.png', rect: await rectOf(sel), shotRect: { x: clip.x, y: clip.y, w: clip.width, h: clip.height } };
}
const TEX_AT = [
  { t: T.cardOut[0], name: 'coldBrewCard', sel: '#item-cold-brew-tonic' },
  { t: T.pressAdd[0], name: 'siAdd', sel: '#si-add' },          // sin presionar (el 3D despega al soltar)
  { t: T.fanOut[0], name: 'rev1', sel: '#rev-1', trackScroll: true },
  { t: T.fanOut[0], name: 'rev2', sel: '#rev-2', trackScroll: true },
  { t: T.fanOut[0], name: 'rev3', sel: '#rev-3', trackScroll: true },
];
// la gota rodea "Agregar" mientras la ficha todavía sube: su rect se rastrea cuadro por cuadro
const TRACKS = [{ name: 'siAdd', sel: '#si-add', t: [T.dropCircleAdd[0] - 0.05, T.addLift3D[1] + 0.05] }];

const f0 = Math.round(TL.SCREEN[0] * FPS), f1 = Math.round(TL.SCREEN[1] * FPS);
const manifest = { dpr: DPR, fps: FPS, sub: SUB, screen: TL.SCREEN, viewport: [390, 844], header: HDR, f0, f1, frames: {}, rects: {}, tracks: {}, tex: {} };
const acts = TL.PAGE_ACTIONS.map((a) => ({ ...a, start: Array.isArray(a.t) ? a.t[0] : a.t, done: false }));
const probes = TL.PROBES.map((p) => ({ ...p, done: false }));
const texs = TEX_AT.map((x) => ({ ...x, done: false }));
const releases = [];
let y = 0, seg = null, vt = 0, segX = null;
const scrollSegs = acts.filter((a) => a.type === 'scroll' || a.type === 'scrollX');
const inScroll = (t) => scrollSegs.some((a) => t >= a.t[0] - 1 / FPS && t <= a.t[1] + 1 / FPS);
const t0 = Date.now();
for (let f = f0; f <= f1; f++) {
  const t = f / FPS;
  const target = Math.round((f - f0) * 1000 / FPS);
  if (target > vt) { await page.clock.runFor(target - vt); vt = target; }
  // texturas de piezas 3D antes de que se oculten
  for (const x of texs) if (!x.done && t >= x.t - 1e-9) { x.done = true; await grabTex(x.name, x.sel, x); }
  for (const a of acts) {
    if (a.done || t < a.start - 1e-9) continue;
    a.done = true;
    if (a.type === 'intro') await E(() => window.matica.intro());
    else if (a.type === 'tap') { if (a.quiet) await E((s) => document.querySelector(s).click(), a.sel); else await E((s) => window.matica.tap(s), a.sel); }
    else if (a.type === 'scroll') { seg = { t: a.t, y0: y, y1: await TARGETS[a.to]() }; manifest.scrollTo = { ...(manifest.scrollTo || {}), [a.to]: seg.y1 }; }
    else if (a.type === 'scrollX') {   // hasta que la pieza quede completa a la vista con su margen
      const [x0, x1] = await E(([s, to]) => { const el = document.querySelector(s), r = document.querySelector(to).getBoundingClientRect();
        const gut = parseFloat(getComputedStyle(el).paddingRight) || 16;
        return [el.scrollLeft, Math.min(el.scrollWidth - el.clientWidth, el.scrollLeft + Math.max(0, r.right - (el.clientWidth - gut)))]; }, [a.sel, a.to]);
      segX = { t: a.t, sel: a.sel, x0, x1 }; manifest.scrollX = { ...(manifest.scrollX || {}), [a.to]: [x0, x1] };
    }
    else if (a.type === 'hide') await E(([s, on]) => window.matica.hide(s, on), [a.sel, a.on]);
    else if (a.type === 'add') await E((sp) => window.matica.addToCart(sp), a.spec);
    else if (a.type === 'press') { await E((s) => window.matica.press(s, true), a.sel); releases.push({ t: a.t[1], sel: a.sel }); }
    else if (a.type === 'closeSheet') await E(() => window.matica.closeSheet());
    else if (a.type === 'review') await E(([i, d]) => window.matica.goReview(i, d), [a.i, Math.round(a.dur * 1000)]);
    else if (a.type === 'dropPin') await E(() => window.matica.dropPin());
  }
  for (const r of releases) if (!r.done && t >= r.t - 1e-9) { r.done = true; await E((s) => window.matica.press(s, false), r.sel); }
  for (const p of probes) if (!p.done && t >= p.t - 1e-9) { p.done = true; manifest.rects[p.name] = { t: p.t, ...(await rectOf(p.sel)) }; }
  // scroll del arnés (con inercia); en sus tramos, 4 subcapturas por cuadro
  const yAt = (tt) => (seg && tt >= seg.t[0] ? scrollAt(tt, seg.t, seg.y0, seg.y1) : y);
  const subs = inScroll(t) ? Array.from({ length: SUB }, (_, k) => t + (-0.5 + (k + 0.5) / SUB) / (2 * FPS)) : [t];
  await E((ms) => window.matica.capTick(ms), vt);
  const fr = { files: [], scrollY: [] };
  for (let k = 0; k < subs.length; k++) {
    const yy = yAt(subs[k]);
    await E((v) => scrollTo(0, v), yy);
    if (segX && subs[k] >= segX.t[0] - 1 / FPS && subs[k] <= segX.t[1] + 2 / FPS) await E(([s, v]) => { document.querySelector(s).scrollLeft = v; }, [segX.sel, scrollAt(subs[k], segX.t, segX.x0, segX.x1)]);
    const file = `f${String(f).padStart(4, '0')}${subs.length > 1 ? '_' + k : ''}.jpg`;
    await page.screenshot({ path: path.join(OUT, 'frames', file), type: 'jpeg', quality: Q });
    fr.files.push(file); fr.scrollY.push(Math.round(yy * 100) / 100);
  }
  y = yAt(t);
  await E((v) => scrollTo(0, v), y);
  for (const tr of TRACKS) if (t >= tr.t[0] && t <= tr.t[1]) { (manifest.tracks[tr.name] = manifest.tracks[tr.name] || {})[f] = await rectOf(tr.sel); }
  manifest.frames[f] = fr;
  if ((f - f0) % 120 === 0) console.log(`t=${t.toFixed(2)} s · ${f - f0 + 1}/${f1 - f0 + 1} · ${((Date.now() - t0) / 1000).toFixed(0)} s`);
}
const state = await E(() => ({ total: window.matica.total, count: window.matica.count, tab: window.matica.state.tab }));
await browser.close();
fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest));
console.log('estado final', state, '· errores:', errs.length ? errs : 'ninguno', `· ${((Date.now() - t0) / 60000).toFixed(1)} min`);
