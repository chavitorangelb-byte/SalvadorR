// Animatic de tiempos (540x960, 30 fps): storyboard dibujado directo de timeline.json, con las
// capturas reales de la página dentro del celular, la tipografía cinética en su cuadro de
// aterrizaje, el tecleo de la búsqueda, la voz en karaoke y el audio (voz + metrónomo).
// NO es el look final: sirve para aprobar ritmo y tiempos.
//
// Uso: python3 matica/video/tools/animatic_audio.py && node matica/video/tools/animatic.mjs
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const VIDEO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');   // matica/video
const MATICA = path.resolve(VIDEO, '..');
const BUILD = path.join(VIDEO, 'build', 'animatic');
const FRAMES = path.join(BUILD, 'frames');
const OUT = path.join(MATICA, 'review', 'fase2', 'animatic_tiempos.mp4');
const FPS = 30, W = 540, H = 960;
fs.rmSync(FRAMES, { recursive: true, force: true });
fs.mkdirSync(FRAMES, { recursive: true });
fs.mkdirSync(path.dirname(OUT), { recursive: true });

const TL = JSON.parse(fs.readFileSync(path.join(VIDEO, 'timeline', 'timeline.json'), 'utf8'));
const rel = (p) => path.relative(BUILD, p).split(path.sep).join('/');
const html = `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:Poppins;font-weight:400;src:url(${rel(path.join(MATICA, 'site/fonts/poppins-latin-400-normal.woff2'))})}
@font-face{font-family:Poppins;font-weight:600;src:url(${rel(path.join(MATICA, 'site/fonts/poppins-latin-600-normal.woff2'))})}
@font-face{font-family:Poppins;font-weight:700;src:url(${rel(path.join(MATICA, 'site/fonts/poppins-latin-700-normal.woff2'))})}
html,body{margin:0;background:#1A2226}canvas{display:block}
</style></head><body><canvas id="c" width="${W}" height="${H}"></canvas><script>
const TL = ${JSON.stringify(TL)};
const T = TL.T;
const W = ${W}, H = ${H};
const SHOTDIR = '${rel(path.join(MATICA, 'review/fase0'))}/';
const LOGO = '${rel(path.join(MATICA, 'site/img/logo-512.webp'))}';
const c = document.getElementById('c'), x = c.getContext('2d');
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, k) => a + (b - a) * k;
const eio = (k) => (k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
const st = (v) => Array.isArray(v) ? v[0] : v;
const SHOTS = [
  [T.screenOn, '01_portada'], [T.scrollMenu[0] + 0.35, '03_menu_cafe'], [T.tapFrio + 0.22, '04_latte_frio'],
  [T.panelEspeciales[0] + 0.15, '05_especiales'], [T.panelWaffles[0] + 0.15, '06_waffles'], [T.sheetUp[0] + 0.22, '07_ficha_waffle'],
  [T.sheetDown[0] + 0.25, '06_waffles'], [T.cartSheetUp[0] + 0.22, '10_pedido'], [T.cartSheetDown[0] + 0.25, '06_waffles'],
  [T.scrollVive[0] + 0.40, '13_asi_se_vive'], [T.scrollReviews[0] + 0.20, '14_resenas'], [T.swipe13[0] + 0.25, '15_resena_2'],
  [T.scrollVisit[0] + 0.30, '16_visitanos'],
];
const img = {};
const load = (k, src) => new Promise((r) => { const i = new Image(); i.onload = () => { img[k] = i; r(); }; i.onerror = r; i.src = src; });
window.ready = Promise.all([...new Set(SHOTS.map((s) => s[1]))].map((s) => load(s, SHOTDIR + s + '.png')).concat([load('logo', LOGO)]))
  .then(() => Promise.all(['400 20px Poppins', '600 20px Poppins', '700 20px Poppins'].map((f) => document.fonts.load(f))));

function cam(t) {
  const K = TL.CAMERA;
  if (t <= K[0].t) return K[0];
  for (let i = 0; i < K.length - 1; i++) {
    const a = K[i], b = K[i + 1];
    if (t <= b.t) { const k = eio(clamp((t - a.t) / Math.max(.01, b.t - a.t))); return { x: lerp(a.x, b.x, k), h: lerp(a.h, b.h, k), push: lerp(a.push, b.push, k), rotY: lerp(a.rotY ?? 0, b.rotY ?? (a.rotY ?? 0), k), note: k > .5 ? b.note : a.note }; }
  }
  return K[K.length - 1];
}
function rr(px, py, w, h, r) { x.beginPath(); x.roundRect(px, py, w, h, r); }
function label(txt, px, py, size = 13, color = 'rgba(244,241,234,.75)', weight = 500, align = 'left') {
  x.font = weight + ' ' + size + 'px Poppins'; x.fillStyle = color; x.textAlign = align; x.fillText(txt, px, py);
}
function draw(t) {
  const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#1A2226'); g.addColorStop(1, '#16301F');
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  // zonas seguras (250 px arriba, 340 abajo en 1920 -> 125 y 170 aquí)
  x.fillStyle = 'rgba(255,255,255,.025)'; x.fillRect(0, 0, W, 125); x.fillRect(0, H - 170, W, 170);
  const sc = TL.SCENES.find((s) => t >= s.t0 && t < s.t1) || TL.SCENES[TL.SCENES.length - 1];
  label(sc.name, 18, 30, 15, '#F4F1EA', 600);
  const f = Math.round(t * 60), beat = t / (60 / TL.BPM);
  label(t.toFixed(2) + ' s · f' + String(f).padStart(4, '0') + ' · compás ' + (Math.floor(beat / 4) + 1) + '.' + (Math.floor(beat % 4) + 1), W - 18, 30, 12, 'rgba(244,241,234,.6)', 500, 'right');
  label('ANIMATIC DE TIEMPOS · no es el look final', 18, 50, 10, 'rgba(124,172,137,.8)', 600);

  // ---- celular ----
  if (t >= T.dropOutline[0] && t < T.phoneAway[1] + 0.3) {
    const p = cam(t);
    const away = clamp((t - T.phoneAway[0]) / (T.phoneAway[1] - T.phoneAway[0]));
    const ph = p.h * H, pw = ph * 0.476, cx = p.x * W, cy = H * 0.5 + 10;
    const drawK = clamp((t - T.dropOutline[0]) / (T.dropOutline[1] - T.dropOutline[0]));
    x.save();
    x.globalAlpha = 1 - clamp((t - T.phoneAway[1]) / 0.3);
    if (drawK < 1) { x.setLineDash([drawK * 2 * (pw + ph), 9999]); }
    rr(cx - pw / 2, cy - ph / 2, pw, ph, 34); x.lineWidth = 3; x.strokeStyle = drawK < 1 ? '#8A4B1C' : 'rgba(255,255,255,.55)'; x.stroke();
    x.setLineDash([]);
    if (t >= T.screenOn) {
      let cur = SHOTS[0], prev = null;
      for (const s of SHOTS) if (t >= s[0]) { prev = cur; cur = s; }
      const fade = clamp((t - cur[0]) / 0.15);
      const sx = cx - pw / 2 + 8, sy = cy - ph / 2 + 8, sw = pw - 16, sh = ph - 16;
      x.save(); rr(sx, sy, sw, sh, 27); x.clip();
      const on = clamp((t - T.screenOn) / 0.25);
      x.globalAlpha = on;
      if (prev && fade < 1 && img[prev[1]]) x.drawImage(img[prev[1]], sx, sy, sw, sh);
      x.globalAlpha = on * fade;
      if (img[cur[1]]) x.drawImage(img[cur[1]], sx, sy, sw, sh);
      x.restore();
    }
    x.restore();
    if (p.push > 1.05 && t < T.phoneAway[0]) {
      label('PUSH-IN ×' + p.push.toFixed(1) + (p.note ? ' · ' + p.note : ''), cx, cy + ph / 2 + 22, 11, '#7CAC89', 600, 'center');
    }
    if (Math.abs(p.rotY) > 1 && t < T.phoneAway[1]) label('giro ' + Math.round(p.rotY) + '°', cx, cy - ph / 2 - 10, 10, 'rgba(244,241,234,.45)', 500, 'center');
  }

  // ---- gancho: barra y tecleo ----
  if (t < T.barOut[1]) {
    const k = clamp((t - T.barIn[0]) / (T.barIn[1] - T.barIn[0])) * (1 - clamp((t - T.barOut[0]) / (T.barOut[1] - T.barOut[0])));
    if (k > 0) {
      const bw = 470 * eio(k), bx = (W - bw) / 2, by = H * 0.46;
      rr(bx, by, bw, 56, 28); x.fillStyle = 'rgba(255,255,255,.10)'; x.fill(); x.strokeStyle = 'rgba(255,255,255,.35)'; x.lineWidth = 1; x.stroke();
      const typed = TL.TYPING.filter((c) => c.t <= t).map((c) => c.c).join('');
      x.font = '500 19px Poppins'; x.fillStyle = '#F4F1EA'; x.textAlign = 'left';
      x.fillText(typed, bx + 24, by + 35);
      const tw = x.measureText(typed).width;
      const blink = t < T.type[0] ? (Math.sin(t * 9) > 0 ? 1 : 0.35) : 1;
      x.beginPath(); x.arc(bx + 28 + tw, by + 28, 7, 0, 7); x.fillStyle = 'rgba(138,75,28,' + blink + ')'; x.fill();
    }
  }
  // la gota cae (f0)
  if (t < T.dropFall[1] + 0.05) {
    const k = clamp(t / (T.dropFall[1] - T.dropFall[0]));
    x.beginPath(); x.arc(W / 2, lerp(-20, H * 0.46 + 28, k * k), 9, 0, 7); x.fillStyle = '#8A4B1C'; x.fill();
  }

  // ---- tipografía cinética ----
  for (const gk of TL.KINETIC) {
    if (t < gk.in || t >= gk.out[1]) continue;
    const out = clamp((t - gk.out[0]) / (gk.out[1] - gk.out[0]));
    const p = cam(t);
    const pw = p.h * H * 0.476;
    const left = gk.side === 'left';
    const colX = left ? 22 : p.x * W + pw / 2 + 16;
    const colW = left ? p.x * W - pw / 2 - 38 : W - colX - 22;
    let y = H * 0.40;
    for (const line of gk.lines) {
      let xx = colX, size = 30;
      x.font = '700 ' + size + 'px Poppins';
      const full = line.map((w) => w.text).join(' ');
      while (x.measureText(full).width > colW && size > 18) { size -= 1; x.font = '700 ' + size + 'px Poppins'; }
      for (const w of line) {
        const k = clamp((t - (w.land - 0.08)) / 0.16);
        if (k > 0) {
          x.globalAlpha = k * (1 - out);
          x.fillStyle = '#F4F1EA'; x.textAlign = 'left';
          x.fillText(w.text, xx, y + (1 - eio(k)) * 14 - out * 10);
          x.globalAlpha = 1;
        }
        xx += x.measureText(w.text + ' ').width;
      }
      y += size * 1.15;
    }
    label('aterriza en la voz', colX, y + 4, 9, 'rgba(124,172,137,.7)', 600);
  }

  // ---- la gota: qué está haciendo ----
  const d = TL.DROP.filter((e) => { const a = st(e.t), b = Array.isArray(e.t) ? e.t[1] : e.t + 0.2; return t >= a && t < b; }).pop();
  if (d && t > T.dropFall[1]) {
    x.beginPath(); x.arc(30, H - 195, 7, 0, 7); x.fillStyle = '#8A4B1C'; x.fill();
    label('gota: ' + d.act, 44, H - 191, 12, '#E8C8A8', 500);
  }

  // ---- end card ----
  if (t >= T.logoIn[0]) {
    const k = eio(clamp((t - T.logoIn[0]) / (T.logoIn[1] - T.logoIn[0])));
    const s = 230 * (0.88 + 0.12 * k);
    x.globalAlpha = k;
    if (img.logo) x.drawImage(img.logo, (W - s) / 2, H * 0.38 - s / 2, s, s);
    x.globalAlpha = 1;
    if (t >= T.dropOnCup[0] && t < T.sparkle[1]) {
      const kk = clamp((t - T.dropOnCup[0]) / (T.dropOnCup[1] - T.dropOnCup[0]));
      x.beginPath(); x.arc(W / 2, lerp(H * 0.12, H * 0.34, kk * kk), 8 * (1 - clamp((t - T.sparkle[0]) / 0.4)), 0, 7); x.fillStyle = '#8A4B1C'; x.fill();
    }
    const tg = clamp((t - T.tagline[0]) / 0.3), dc = clamp((t - T.disclaimer[0]) / 0.3);
    x.globalAlpha = tg; label(TL.ENDCARD.tagline, W / 2, H * 0.62, 18, '#F4F1EA', 600, 'center');
    x.globalAlpha = dc; label(TL.ENDCARD.disclaimer, W / 2, H * 0.62 + 30, 11, 'rgba(244,241,234,.7)', 400, 'center');
    x.globalAlpha = 1;
  }

  // ---- voz: karaoke ----
  const clip = TL.VO.find((v) => t >= v.t0 - 0.25 && t <= v.t1 + 0.35);
  if (clip) {
    x.font = '600 17px Poppins'; x.textAlign = 'left';
    const words = clip.words.map((w) => w.w);
    const widths = words.map((w) => x.measureText(w + ' ').width);
    const lines = [[]]; let lw = 0;
    words.forEach((w, i) => { if (lw + widths[i] > W - 56 && lines[lines.length - 1].length) { lines.push([]); lw = 0; } lines[lines.length - 1].push(i); lw += widths[i]; });
    let y = H - 120 - (lines.length - 1) * 24;
    for (const ln of lines) {
      const tot = ln.reduce((s, i) => s + widths[i], 0);
      let xx = (W - tot) / 2;
      for (const i of ln) {
        const w = clip.words[i];
        x.fillStyle = t >= w.t0 && t < (clip.words[i + 1]?.t0 ?? clip.t1) ? '#7CAC89' : t >= w.t0 ? '#F4F1EA' : 'rgba(244,241,234,.35)';
        x.fillText(w.w, xx, y);
        xx += widths[i];
      }
      y += 24;
    }
  }
  label('voz guía (Eric, vidIQ) · se reemplaza con la toma de ElevenLabs', W / 2, H - 22, 9, 'rgba(244,241,234,.35)', 500, 'center');
}
window.draw = draw;
</script></body></html>`;
fs.writeFileSync(path.join(BUILD, 'index.html'), html);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
await page.goto('file://' + path.join(BUILD, 'index.html'));
await page.evaluate(() => window.ready);
const N = Math.round(TL.DUR * FPS);
const t0 = Date.now();
for (let i = 0; i < N; i++) {
  await page.evaluate((t) => window.draw(t), i / FPS);
  await page.screenshot({ path: path.join(FRAMES, `a${String(i).padStart(4, '0')}.jpg`), type: 'jpeg', quality: 88 });
}
await browser.close();
if (errs.length) console.log('errores:', errs);
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', path.join(FRAMES, 'a%04d.jpg'),
  '-i', path.join(BUILD, 'audio.wav'), '-c:v', 'libx264', '-preset', 'slow', '-crf', '21', '-pix_fmt', 'yuv420p',
  '-c:a', 'aac', '-b:a', '160k', '-shortest', '-movflags', '+faststart', OUT]);
console.log(`animatic: ${N} cuadros en ${((Date.now() - t0) / 1000).toFixed(0)} s ->`, path.relative(path.resolve(MATICA, '..'), OUT), (fs.statSync(OUT).size / 1e6).toFixed(2), 'MB');
