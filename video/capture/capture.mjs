// Captura la pagina real cuadro por cuadro (60 fps, 3x) siguiendo la linea de tiempo.
// Reloj virtual de Playwright para JS/rAF + reloj propio para animaciones CSS/WAAPI.
// En tramos de scroll guarda 4 subcuadros por cuadro para el motion blur del compositor.
//
// Uso: node video/capture/capture.mjs [--from 2.95] [--to 23.96] [--dpr 3]
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import * as TL from '../timeline/timeline.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const __dir = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dir, '../..');
const OUT = path.join(ROOT, 'video/build/capture');
const BASE = process.env.BASE || 'http://127.0.0.1:8123/';
const REF = path.join(ROOT, 'assets/demo_referencia_cliente_boceto.jpg');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? Number(process.argv[i + 1]) : d; };
const DPR = arg('dpr', 3);
const T_FROM = arg('from', TL.SCREEN[0]);
const T_TO = arg('to', TL.SCREEN[1]);
const SUB = 4;

fs.mkdirSync(path.join(OUT, 'frames'), { recursive: true });
fs.mkdirSync(path.join(OUT, 'tex'), { recursive: true });
fs.mkdirSync(path.join(OUT, 'morph'), { recursive: true });

const scrollSegs = TL.PAGE_ACTIONS.filter((a) => a.type === 'scroll');
const inScroll = (t) => scrollSegs.some((a) => t >= a.t[0] - 1 / 60 && t <= a.t[1] + 1 / 60);

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: DPR, isMobile: true, hasTouch: true,
    locale: 'es-MX', timezoneId: 'America/Mexico_City',
  });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.clock.install({ time: new Date('2026-11-05T11:55:00-06:00') });
  await page.goto(BASE + '?capture=1', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.documentElement.dataset.ready === '1');
  await page.evaluate(async () => {
    document.querySelectorAll('img[loading="lazy"]').forEach((i) => (i.loading = 'eager'));
    await document.fonts.ready;
    await Promise.all([...document.images].filter((i) => i.getAttribute('src')).map((i) => i.decode().catch(() => {})));
  });
  await page.clock.pauseAt(new Date('2026-11-05T11:55:10-06:00'));
  const S = (fn, a) => page.evaluate(fn, a);
  let vt = 0;                      // reloj virtual de la pagina (ms desde SCREEN[0])
  const toMs = (t) => Math.round((t - TL.SCREEN[0]) * 1000);
  async function advanceTo(t) {
    const target = toMs(t);
    if (target > vt) { await page.clock.runFor(target - vt); vt = target; }
    await S((ms) => window.siniestro.capTick(ms), vt);
  }
  const docY = (sel) => S((s) => { const e = document.querySelector(s); return e.getBoundingClientRect().top + scrollY; }, sel);
  const center = (sel) => S((s) => { const r = document.querySelector(s).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height }; }, sel);

  // posiciones de scroll (se miden al momento de cada scroll, con el estado de ese instante)
  const HDR = await S(() => document.querySelector('#hdr').offsetHeight);
  const targets = {
    gallery: async () => (await docY('#grid')) - HDR - 70,
    formTop: async () => (await docY('#q-idea')) - 250,
    chips: async () => (await docY('.q-step[data-field="style"]')) - HDR - 6,
    photo: async () => (await docY('.q-step[data-field="photo"]')) - HDR - 40,
    submit: async () => (await docY('#q-submit')) - 600,
    top: async () => 0,
    care: async () => (await docY('#cuidados')) - HDR + 4,
    visit: async () => (await docY('#visitanos')) - HDR - 8,
  };

  const manifest = { dpr: DPR, fps: TL.FPS, screen: TL.SCREEN, viewport: [390, 844], header: HDR, frames: {}, taps: [], scrolls: [], tex: {}, rects: {}, morph: {} };
  let scroll = { y: 0, seg: null, y0: 0, y1: 0 };
  const pending = TL.PAGE_ACTIONS.map((a, i) => ({ ...a, i, start: Array.isArray(a.t) ? a.t[0] : a.t, done: false }))
    .concat(TL.PROBES.map((p) => ({ ...p, type: 'probe', start: p.t, done: false })))
    .sort((a, b) => a.start - b.start);
  let typing = null;
  let lastHash = null, lastFile = null, nShots = 0, nUnique = 0;

  async function applyScroll(y) {
    await S((yy) => {
      const rb = yy < 0 ? -yy : 0;
      window.scrollTo(0, Math.max(0, yy));
      for (const el of [document.querySelector('main'), document.querySelector('footer')]) el.style.transform = rb ? `translateY(${rb}px)` : '';
    }, y);
  }

  async function act(a) {
    if (a.type === 'scroll') {
      const y1 = Math.max(0, Math.round(await targets[a.to]()));
      scroll = { seg: a, y0: scroll.y, y1, rubber: a.rubber || 0 };
      manifest.scrolls.push({ t: a.t, to: a.to, y0: scroll.y0, y1 });
    } else if (a.type === 'tap' || a.type === 'tapPhoto') {
      const c = await center(a.sel);
      manifest.taps.push({ t: a.start, x: c.x, y: c.y, sel: a.sel });
      if (a.morph) await captureMorphLayers(a.morph, 'pre');
      await S((s) => window.siniestro.press(s, true), a.sel);
      a._release = a.start + 0.09;
    } else if (a.type === 'type') {
      const chars = [...a.text];
      typing = { chars, t: a.t, n: 0 };
    } else if (a.type === 'blur') {
      await S(() => document.activeElement && document.activeElement.blur());
    } else if (a.type === 'hideWorks') {
      if (a.ids.length) await captureCards(a.ids);
      await S((ids) => window.siniestro.hideWorks(ids), a.ids);
    } else if (a.type === 'probe') {
      manifest.rects[a.name] = await S((s) => { const e = document.querySelector(s); const b = e.getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height, docY: b.top + scrollY, scrollY }; }, a.sel);
      manifest.rects[a.name].t = a.start;
    } else if (a.type === 'hideSubmit') {
      if (a.on) await captureElement('#q-submit', 'wa_button');
      await S((on) => window.siniestro.hideSubmit(on), a.on);
    }
  }

  async function release(a) {
    await S((s) => window.siniestro.press(s, false), a.sel);
    if (a.type === 'tapPhoto') {
      await page.setInputFiles('#q-photo', REF);
      for (let i = 0; i < 300 && !(await S(() => window.siniestro.photoReady())); i++) await new Promise((r) => setTimeout(r, 50));
    } else {
      await S((s) => window.siniestro.click(s), a.sel);
    }
    if (a.morph) await captureMorphLayers(a.morph, 'post');
  }

  async function captureElement(sel, name) {
    await S(() => { document.querySelector('#fab').classList.add('cap-hide'); document.getAnimations().forEach((a) => { try { a.finish(); } catch (e) {} }); });
    const el = await page.$(sel);
    const file = `tex/${name}.png`;
    await el.screenshot({ path: path.join(OUT, file), animations: 'allow', caret: 'hide' });
    const r = await S((s) => { const b = document.querySelector(s).getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height, docY: b.top + scrollY }; }, sel);
    await S(() => document.querySelector('#fab').classList.remove('cap-hide'));
    manifest.tex[name] = { file, rect: r, scrollY: scroll.y };
  }
  async function captureCards(ids) {
    for (const id of ids) await captureElement(`.work-item[data-id="${id}"] .work-btn`, `card_${id}`);
  }
  async function captureMorphLayers(lang, phase) {
    // pre: estado antes del cambio; post: despues. Capas: completa, solo texto (PNG alfa) y sin texto.
    const tag = `${lang}_${phase}`;
    if (phase === 'post') await S(() => document.getAnimations().forEach((a) => { try { if (isFinite(a.effect.getComputedTiming().endTime)) a.finish(); } catch (e) {} }));
    const shot = async (file, opts = {}) => page.screenshot({ path: path.join(OUT, 'morph', file), caret: 'hide', ...opts });
    await shot(`${tag}_full.png`);
    await S(() => window.siniestro.capLayer('text'));
    await shot(`${tag}_text.png`, { omitBackground: true });
    await S(() => window.siniestro.capLayer('notext'));
    await shot(`${tag}_bg.png`);
    await S(() => window.siniestro.capLayer(null));
    manifest.morph[lang] = manifest.morph[lang] || {};
    manifest.morph[lang][phase] = { full: `morph/${tag}_full.png`, text: `morph/${tag}_text.png`, bg: `morph/${tag}_bg.png` };
  }

  async function snap(name) {
    const buf = await page.screenshot({ type: 'jpeg', quality: 92, caret: 'hide', animations: 'allow' });
    nShots++;
    const h = crypto.createHash('md5').update(buf).digest('hex');
    if (h === lastHash) return lastFile;
    const file = `frames/${name}.jpg`;
    fs.writeFileSync(path.join(OUT, file), buf);
    lastHash = h; lastFile = file; nUnique++;
    return file;
  }

  async function stateAt(t) {
    // acciones que tocan en este instante (en orden)
    for (const a of pending) {
      if (!a.done && a.start <= t + 1e-6) { await advanceTo(a.start); await act(a); a.done = true; }
      if (a._release && !a._released && a._release <= t + 1e-6) { await advanceTo(a._release); await release(a); a._released = true; }
    }
    if (typing) {
      const [t0, t1] = typing.t;
      const want = Math.min(typing.chars.length, Math.floor(TL.clamp((t - t0) / (t1 - t0)) * typing.chars.length + 1e-9));
      while (typing.n < want) {
        const tc = t0 + (t1 - t0) * (typing.n + 1) / typing.chars.length;
        await advanceTo(Math.min(t, tc));
        await page.keyboard.insertText(typing.chars[typing.n]);
        manifest.keys = manifest.keys || []; manifest.keys.push({ t: tc, c: typing.chars[typing.n] });
        typing.n++;
      }
      if (typing.n >= typing.chars.length && t > t1) typing = null;
    }
    await advanceTo(t);
    const ink = TL.prog(t, TL.T.inkUnderline);
    await S((p) => window.siniestro.setInkProgress(p), TL.easeInOut(ink));
    if (scroll.seg) {
      const y = TL.scrollAt(t, scroll.seg.t, scroll.y0, scroll.y1, scroll.rubber);
      scroll.y = t >= scroll.seg.t[1] ? scroll.y1 : y;
      if (t >= scroll.seg.t[1]) scroll.seg = null;
    }
    await applyScroll(scroll.y);
  }

  const f0 = Math.round(T_FROM * TL.FPS), f1 = Math.round(T_TO * TL.FPS);
  const tStart = Date.now();
  for (let f = f0; f <= f1; f++) {
    const t = f / TL.FPS;
    const subs = inScroll(t) ? SUB : 1;
    const files = [];
    const ys = [];
    for (let j = 0; j < subs; j++) {
      const ts = subs === 1 ? t : t + (-0.5 + (j + 0.5) / subs) / (TL.FPS * 2);   // obturador de 180 grados
      await stateAt(ts);
      files.push(await snap(`f${String(f).padStart(4, '0')}_${j}`));
      ys.push(Math.round(scroll.y * 100) / 100);
    }
    const meta = await S(() => ({ lang: window.siniestro.lang, solid: document.querySelector('#hdr').classList.contains('is-solid'),
      fab: document.querySelector('#fab').classList.contains('is-on'), focus: document.activeElement && document.activeElement.id }));
    manifest.frames[f] = { files, scrollY: ys, ...meta };
    if (f % 60 === 0) console.log(`t=${t.toFixed(2)}  shots=${nShots} unicas=${nUnique}  ${((Date.now() - tStart) / 1000).toFixed(0)} s`);
  }

  manifest.errors = errs;
  fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 1));
  console.log('listo', { shots: nShots, unicas: nUnique, errores: errs.length, seg: ((Date.now() - tStart) / 1000).toFixed(0) });
  await browser.close();
})();
