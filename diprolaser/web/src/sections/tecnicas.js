// Seis demos en loop dibujadas en canvas (sin videos pesados). Solo animan las tarjetas visibles.
import { reducedMotion } from '../lib/state.js';

const W = 640, H = 420;
const loadImg = (url) => new Promise((res, rej) => { const i = new Image(); i.decoding = 'async'; i.onload = () => res(i); i.onerror = rej; i.src = url; });
const mk = (w = W, h = H) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const rand = (a, b) => a + Math.random() * (b - a);

function noiseTile(base, amp, size = 128, streak = false) {
  const c = mk(size, size); const x = c.getContext('2d'); const d = x.createImageData(size, size);
  for (let i = 0; i < d.data.length; i += 4) {
    const px = (i / 4) % size, py = Math.floor(i / 4 / size);
    const n = (Math.random() - .5) * amp + (streak ? Math.sin((px + py) * .9) * amp * .35 : 0);
    d.data[i] = base[0] + n; d.data[i + 1] = base[1] + n; d.data[i + 2] = base[2] + n; d.data[i + 3] = 255;
  }
  x.putImageData(d, 0, 0); return c;
}

/** Logo oficial como máscara (alfa) y como color, recortado al cuerpo del logo (sin resplandor). */
async function logoAssets() {
  const im = await loadImg('img/brand/logo-480.webp');
  const w = 300, h = Math.round(im.height * 300 / im.width);
  const c = mk(w, h); const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(im, 0, 0, w, h);
  const d = x.getImageData(0, 0, w, h);
  const mask = mk(w, h); const mx = mask.getContext('2d'); const md = mx.createImageData(w, h);
  const col = mk(w, h); const cx = col.getContext('2d'); const cd = cx.createImageData(w, h);
  for (let i = 0; i < d.data.length; i += 4) {
    const a = d.data[i + 3] / 255; const k = Math.max(0, Math.min(1, (a - .42) / .25));
    md.data[i] = md.data[i + 1] = md.data[i + 2] = 255; md.data[i + 3] = k * 255;
    cd.data[i] = d.data[i]; cd.data[i + 1] = d.data[i + 1]; cd.data[i + 2] = d.data[i + 2]; cd.data[i + 3] = k * 255;
  }
  mx.putImageData(md, 0, 0); cx.putImageData(cd, 0, 0);
  return { mask, col, w, h, data: cd.data };
}
function tinted(src, color) { const c = mk(src.width, src.height); const x = c.getContext('2d'); x.drawImage(src, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = color; x.fillRect(0, 0, c.width, c.height); return c; }

/* 1 · Láser: haz rojo con chispas que graba el logo línea por línea */
function laser(ctx, A) {
  const plate = noiseTile([24, 24, 28], 10, 128, true);
  const engr = tinted(A.mask, '#d9dce1');
  const ox = (W - A.w) / 2, oy = (H - A.h) / 2 + 6;
  let y = 0, hold = 0, sparks = [];
  return (t, dt) => {
    ctx.fillStyle = ctx.createPattern(plate, 'repeat'); ctx.fillRect(0, 0, W, H);
    const v = ctx.createRadialGradient(W / 2, H / 2, 40, W / 2, H / 2, 400); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.6)'); ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
    if (y < A.h) y += dt * 52; else { hold += dt; if (hold > 1.4) { y = 0; hold = 0; } }
    ctx.save(); ctx.beginPath(); ctx.rect(ox, oy, A.w, Math.min(y, A.h)); ctx.clip(); ctx.drawImage(engr, ox, oy); ctx.restore();
    if (y < A.h) {
      const lx = ox + (Math.sin(t * 9) * .5 + .5) * A.w, ly = oy + y;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = 'rgba(255,50,60,.85)'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(lx, 0); ctx.lineTo(lx, ly); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,40,50,.18)'; ctx.lineWidth = 12; ctx.stroke();
      const g = ctx.createRadialGradient(lx, ly, 0, lx, ly, 34); g.addColorStop(0, '#fff'); g.addColorStop(.25, 'rgba(255,120,80,.8)'); g.addColorStop(1, 'rgba(255,40,50,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(lx, ly, 34, 0, 7); ctx.fill();
      ctx.fillStyle = '#222'; ctx.fillRect(lx - 16, -2, 32, 22);
      ctx.restore();
      for (let k = 0; k < 3; k++) sparks.push({ x: lx, y: ly, vx: rand(-220, 220), vy: rand(-260, -40), l: 1 });
    }
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
    sparks = sparks.filter((p) => (p.l -= dt * 2.4) > 0);
    for (const p of sparks) { p.vy += 700 * dt; p.x += p.vx * dt; p.y += p.vy * dt; ctx.strokeStyle = `rgba(255,${170 + 80 * p.l},90,${p.l})`; ctx.lineWidth = 2 * p.l; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * .02, p.y - p.vy * .02); ctx.stroke(); }
    ctx.restore();
  };
}

/* 2 · A todo color: cuatro pasadas C, M, Y, K que forman un diseño a color */
function color(ctx) {
  const art = mk(320, 240); const a = art.getContext('2d', { willReadFrequently: true });
  const gr = a.createLinearGradient(40, 20, 280, 220); gr.addColorStop(0, '#e3262f'); gr.addColorStop(.5, '#ff9f1c'); gr.addColorStop(1, '#2ec4b6');
  a.fillStyle = gr; a.beginPath(); a.arc(160, 120, 104, 0, 7); a.fill();
  a.fillStyle = '#1d46b4'; a.beginPath(); a.arc(160, 120, 66, 0, 7); a.fill();
  a.fillStyle = '#ffd23f'; a.font = '900 54px Archivo, sans-serif'; a.textAlign = 'center'; a.textBaseline = 'middle'; a.fillText('TU LOGO', 160, 122);
  const d = a.getImageData(0, 0, 320, 240).data;
  const layers = [[0, 174, 239], [236, 0, 140], [255, 242, 0], [30, 30, 30]].map((c, ch) => {
    const l = mk(320, 240); const x = l.getContext('2d'); const o = x.createImageData(320, 240);
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 10) continue;
      const r = d[i] / 255, g = d[i + 1] / 255, b = d[i + 2] / 255; const k = 1 - Math.max(r, g, b);
      const v = ch === 3 ? k : (1 - [r, g, b][ch] - k) / (1 - k + 1e-4);
      const ink = Math.max(0, Math.min(1, v));
      o.data[i] = 255 - (255 - c[0]) * ink; o.data[i + 1] = 255 - (255 - c[1]) * ink; o.data[i + 2] = 255 - (255 - c[2]) * ink; o.data[i + 3] = 255 * Math.min(1, d[i + 3] / 255);
    }
    x.putImageData(o, 0, 0); return l;
  });
  const fabric = noiseTile([236, 234, 228], 14, 96, true);
  const names = ['C', 'M', 'Y', 'K']; const ink = ['#00aeef', '#ec008c', '#fff200', '#222'];
  let pass = 0, x = 0, hold = 0;
  const ox = (W - 320) / 2, oy = (H - 240) / 2;
  return (t, dt) => {
    ctx.fillStyle = ctx.createPattern(fabric, 'repeat'); ctx.fillRect(0, 0, W, H);
    ctx.save(); ctx.globalCompositeOperation = 'multiply';
    for (let i = 0; i < 4; i++) {
      if (i > pass) break;
      const reveal = i < pass ? 320 : x;
      const off = i < pass ? 0 : (1 - Math.min(1, x / 320)) * 10;
      ctx.save(); ctx.beginPath(); ctx.rect(ox, oy, reveal, 240); ctx.clip(); ctx.drawImage(layers[i], ox + off, oy); ctx.restore();
    }
    ctx.restore();
    if (pass < 4) {
      x += dt * 260;
      const hx = ox + Math.min(x, 320);
      ctx.fillStyle = 'rgba(20,20,24,.92)'; ctx.fillRect(hx - 14, oy - 30, 28, 300);
      ctx.fillStyle = ink[pass]; ctx.fillRect(hx - 10, oy - 24, 20, 20);
      ctx.fillStyle = '#fff'; ctx.font = '700 13px Inter, sans-serif'; ctx.textAlign = 'center'; ctx.fillText(names[pass], hx, oy - 9);
      if (x >= 320) { pass++; x = 0; }
    } else { hold += dt; if (hold > 1.6) { pass = 0; x = 0; hold = 0; } }
    ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.font = '600 14px Inter, sans-serif'; ctx.textAlign = 'left';
    ctx.fillText(['Cian', 'Magenta', 'Amarillo', 'Negro', 'A todo color'][Math.min(pass, 4)], 18, H - 18);
  };
}

/* 3 · Bordado: el hilo cose el logo, puntada por puntada */
function bordado(ctx, A) {
  const fabric = noiseTile([20, 20, 23], 12, 96, true);
  const ox = (W - A.w) / 2, oy = (H - A.h) / 2;
  const rows = []; const gap = 5;
  for (let y = 0; y < A.h; y += gap) {
    let x = 0;
    while (x < A.w) {
      while (x < A.w && A.data[(y * A.w + x) * 4 + 3] < 128) x++;
      const s = x; while (x < A.w && A.data[(y * A.w + x) * 4 + 3] >= 128) x++;
      if (x - s > 2) { const i = (y * A.w + Math.floor((s + x) / 2)) * 4; rows.push({ y, s, e: x, c: `rgb(${A.data[i]},${A.data[i + 1]},${A.data[i + 2]})` }); }
    }
  }
  const done = mk(); const dx = done.getContext('2d');
  let k = 0, hold = 0;
  const stitch = (r) => {
    dx.lineCap = 'round';
    for (let x = r.s; x < r.e; x += 3.2) {
      dx.strokeStyle = 'rgba(0,0,0,.5)'; dx.lineWidth = 3; dx.beginPath(); dx.moveTo(ox + x + 1, oy + r.y + 1); dx.lineTo(ox + x + 4, oy + r.y + gap + 1); dx.stroke();
      dx.strokeStyle = r.c; dx.lineWidth = 2.4; dx.beginPath(); dx.moveTo(ox + x, oy + r.y); dx.lineTo(ox + x + 3, oy + r.y + gap); dx.stroke();
      dx.strokeStyle = 'rgba(255,255,255,.28)'; dx.lineWidth = .8; dx.beginPath(); dx.moveTo(ox + x + .4, oy + r.y + .4); dx.lineTo(ox + x + 2, oy + r.y + gap * .5); dx.stroke();
    }
  };
  return (t, dt) => {
    ctx.fillStyle = ctx.createPattern(fabric, 'repeat'); ctx.fillRect(0, 0, W, H);
    const n = Math.ceil(dt * 70);
    for (let j = 0; j < n && k < rows.length; j++) stitch(rows[k++]);
    ctx.drawImage(done, 0, 0);
    if (k < rows.length) {
      const r = rows[k]; const nx = ox + r.s + (Math.sin(t * 30) * .5 + .5) * (r.e - r.s), ny = oy + r.y;
      const up = Math.abs(Math.sin(t * 24)) * 26;
      ctx.strokeStyle = r.c; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(nx, ny - up); ctx.quadraticCurveTo(nx + 30, ny - 120, nx + 60, -10); ctx.stroke();
      const g = ctx.createLinearGradient(nx - 3, 0, nx + 3, 0); g.addColorStop(0, '#888'); g.addColorStop(.5, '#f4f4f4'); g.addColorStop(1, '#777');
      ctx.fillStyle = g; ctx.fillRect(nx - 2, ny - up - 110, 4, 110);
    } else { hold += dt; if (hold > 1.6) { hold = 0; k = 0; dx.clearRect(0, 0, W, H); } }
  };
}

/* 4 · Placa metálica: disco oscuro con el logo grabado y un brillo que gira */
function placa(ctx, A) {
  const engr = tinted(A.mask, '#a9adb3');
  const R = 160, cx = W / 2, cy = H / 2;
  return (t) => {
    ctx.fillStyle = '#0c0c0f'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.beginPath(); ctx.ellipse(cx + 8, cy + 16, R, R * .96, 0, 0, 7); ctx.fill();
    const rim = ctx.createLinearGradient(cx - R, cy - R, cx + R, cy + R); rim.addColorStop(0, '#9a9ea6'); rim.addColorStop(.5, '#2a2b30'); rim.addColorStop(1, '#6d7078');
    ctx.fillStyle = rim; ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.fill();
    const face = ctx.createRadialGradient(cx - 40, cy - 50, 10, cx, cy, R); face.addColorStop(0, '#3b3c42'); face.addColorStop(1, '#141418');
    ctx.fillStyle = face; ctx.beginPath(); ctx.arc(cx, cy, R - 9, 0, 7); ctx.fill();
    const lw = 230, lh = lw * A.h / A.w;
    ctx.drawImage(engr, cx - lw / 2, cy - lh / 2, lw, lh);
    ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, R - 9, 0, 7); ctx.clip();
    ctx.globalCompositeOperation = 'screen';
    const a = t * .8; const sx = cx + Math.cos(a) * 120, sy = cy + Math.sin(a) * 60;
    const sp = ctx.createRadialGradient(sx, sy, 0, sx, sy, 190); sp.addColorStop(0, 'rgba(255,255,255,.28)'); sp.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = sp; ctx.fillRect(0, 0, W, H);
    ctx.restore();
  };
}

/* 5 · Parche: piel con pespunte que se cose y el logo quemado a láser */
function parche(ctx, A) {
  const fabric = noiseTile([22, 22, 25], 12, 96, true);
  const leather = noiseTile([150, 98, 58], 34, 128);
  const burn = tinted(A.mask, 'rgba(48,24,10,.92)');
  const rrect = (x, y, w, h, r) => { const p = new Path2D(); p.moveTo(x + r, y); p.arcTo(x + w, y, x + w, y + h, r); p.arcTo(x + w, y + h, x, y + h, r); p.arcTo(x, y + h, x, y, r); p.arcTo(x, y, x + w, y, r); p.closePath(); return p; };
  const patch = rrect(140, 80, 360, 260, 34);
  const seam = rrect(156, 96, 328, 228, 24);
  const per = 2 * (328 + 228) - 8 * 24 + 2 * Math.PI * 24;
  const stitches = mk(); const sx = stitches.getContext('2d');
  sx.setLineDash([11, 7]); sx.lineCap = 'round';
  sx.translate(1, 1.5); sx.strokeStyle = 'rgba(0,0,0,.45)'; sx.lineWidth = 3.4; sx.stroke(seam);
  sx.setTransform(1, 0, 0, 1, 0, 0); sx.strokeStyle = '#efe0c4'; sx.lineWidth = 2.6; sx.stroke(seam);
  const mask = mk(); const mx = mask.getContext('2d');
  let p = 0, b = 0, hold = 0, smoke = [];
  return (t, dt) => {
    ctx.fillStyle = ctx.createPattern(fabric, 'repeat'); ctx.fillRect(0, 0, W, H);
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.7)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 10; ctx.fillStyle = ctx.createPattern(leather, 'repeat'); ctx.fill(patch); ctx.restore();
    ctx.save(); ctx.clip(patch); const v = ctx.createRadialGradient(W / 2, H / 2, 60, W / 2, H / 2, 260); v.addColorStop(0, 'rgba(255,220,170,.12)'); v.addColorStop(1, 'rgba(40,16,0,.5)'); ctx.fillStyle = v; ctx.fillRect(0, 0, W, H); ctx.restore();
    if (p < 1) p = Math.min(1, p + dt * .45); else if (b < 1) b = Math.min(1, b + dt * .7); else { hold += dt; if (hold > 1.6) { p = b = hold = 0; } }
    // la costura avanza: máscara con el tramo ya cosido
    mx.globalCompositeOperation = 'source-over'; mx.clearRect(0, 0, W, H);
    mx.setLineDash([per * p, per * 2]); mx.lineWidth = 14; mx.strokeStyle = '#000'; mx.stroke(seam);
    mx.globalCompositeOperation = 'source-in'; mx.setLineDash([]); mx.drawImage(stitches, 0, 0);
    ctx.drawImage(mask, 0, 0);
    const lw = 250, lh = lw * A.h / A.w;
    if (b > 0) {
      ctx.save(); ctx.beginPath(); ctx.rect(W / 2 - lw / 2, 0, lw * b, H); ctx.clip(); ctx.drawImage(burn, W / 2 - lw / 2, H / 2 - lh / 2, lw, lh); ctx.restore();
      if (b < 1) { const x = W / 2 - lw / 2 + lw * b; for (let k = 0; k < 2; k++) smoke.push({ x, y: H / 2 + rand(-lh / 2, lh / 2), l: 1, r: rand(6, 12) }); ctx.fillStyle = 'rgba(255,90,60,.9)'; ctx.beginPath(); ctx.arc(x, H / 2 + Math.sin(t * 40) * lh * .4, 5, 0, 7); ctx.fill(); }
    }
    smoke = smoke.filter((s) => (s.l -= dt * 1.2) > 0);
    for (const s of smoke) { s.y -= dt * 60; s.r += dt * 18; ctx.fillStyle = `rgba(200,190,180,${s.l * .18})`; ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, 7); ctx.fill(); }
  };
}

/* 6 · Impermeable: gotas que caen, hacen perla y resbalan sin mojar */
function agua(ctx) {
  const fabric = noiseTile([26, 27, 31], 10, 96, true);
  let drops = []; let acc = 0;
  return (t, dt) => {
    ctx.fillStyle = ctx.createPattern(fabric, 'repeat'); ctx.fillRect(0, 0, W, H);
    for (let y = 0; y < H; y += 90) { ctx.fillStyle = 'rgba(0,0,0,.12)'; ctx.fillRect(0, y, W, 2); }
    const lg = ctx.createLinearGradient(0, 0, W, H); lg.addColorStop(0, 'rgba(255,255,255,.07)'); lg.addColorStop(1, 'rgba(0,0,0,.3)'); ctx.fillStyle = lg; ctx.fillRect(0, 0, W, H);
    acc += dt; if (acc > .16) { acc = 0; drops.push({ x: rand(40, W - 40), y: -20, vy: rand(380, 520), vx: 0, r: rand(7, 15), land: rand(70, 260), on: false, sl: 0 }); }
    drops = drops.filter((d) => d.y < H + 40);
    for (const d of drops) {
      if (!d.on) { d.vy += 900 * dt; d.y += d.vy * dt; if (d.y >= d.land) { d.on = true; d.vy = -d.vy * .18; d.vx = rand(-30, 30); } }
      else { d.vy += 260 * dt; d.vy = Math.min(d.vy, 180); d.y += d.vy * dt; d.x += d.vx * dt; d.sl += dt; }
      const sq = d.on ? 1 + Math.max(0, .35 - d.sl) : .75;
      ctx.save(); ctx.translate(d.x, d.y); ctx.scale(sq, 2 - sq);
      if (!d.on) { ctx.strokeStyle = 'rgba(180,210,255,.35)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(0, -d.r * 3); ctx.lineTo(0, -d.r); ctx.stroke(); }
      ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.arc(2, 4, d.r, 0, 7); ctx.fill();
      const g = ctx.createRadialGradient(-d.r * .3, -d.r * .4, 1, 0, 0, d.r); g.addColorStop(0, 'rgba(220,235,255,.55)'); g.addColorStop(.6, 'rgba(120,150,190,.25)'); g.addColorStop(1, 'rgba(200,220,255,.6)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, d.r, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.beginPath(); ctx.arc(-d.r * .35, -d.r * .4, d.r * .22, 0, 7); ctx.fill();
      ctx.restore();
    }
  };
}

const DEMOS = { laser, color, bordado, placa, parche, agua };

export async function initTecnicas() {
  const A = await logoAssets().catch(() => null);
  await document.fonts.load('900 54px Archivo').catch(() => {});
  const list = [...document.querySelectorAll('[data-demo]')].map((c) => {
    const ctx = c.getContext('2d');
    const step = DEMOS[c.dataset.demo]?.(ctx, A);
    return { c, step, on: false };
  });
  const io = new IntersectionObserver((es) => { for (const e of es) { const d = list.find((x) => x.c === e.target); if (d) d.on = e.isIntersecting; } start(); }, { threshold: .15 });
  list.forEach((d) => io.observe(d.c));
  let raf = 0, last = performance.now(), t = 0;
  const loop = (now) => {
    const dt = Math.max(0, Math.min(.05, (now - last) / 1000)); last = now; t += dt;
    let any = false;
    for (const d of list) if (d.on && d.step) { d.step(t, dt); any = true; }
    raf = any ? requestAnimationFrame(loop) : 0;
  };
  const start = () => { if (!raf) { last = performance.now(); raf = requestAnimationFrame(loop); } };
  if (reducedMotion.matches) { list.forEach((d) => { for (let i = 0; i < 400; i++) d.step?.(i * .05, .05); }); return; }
  start();
}
