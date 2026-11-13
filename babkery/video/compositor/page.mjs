// La página de Babkery dentro del marco de cristal, el cierre y el end card.
// Todo en px de diseño (1080×1920) y como función pura de t.
import { clamp, smooth, easeIO, lerp, FRAME, DISK, AVATAR_END } from './field.mjs';

export const C = { bg: '#1A0F0A', choc: '#3A2218', cream: '#F7E8B0', wine: '#7B1F2C', terra: '#B5683F', cara: '#E3A23B', core: '#FFF3C9' };
export const cream = (a) => `rgba(247,232,176,${a})`;

// ---------------------------------------------------------------- tiempos (bloqueados a la voz)
export function makeTimes(TL) {
  const w = (id, i) => TL.vo.find((p) => p.id === id).words[i].t;
  return {
    capa: w('vo1', 0), por: w('vo1', 1),
    croissants: w('vo2', 0), babkas: w('vo2', 1), masa: w('vo2', 3),
    siete: w('vo3', 2), google: w('vo3', 4),
    tu: w('vo4', 4), pagina: w('vo4', 6),
    pide: w('vo5', 0), wa: w('vo5', 2),
    babkery: w('vo6', 0), gdl: w('vo6', 1),
    mil: w('vo7', 3),
  };
}

// ---------------------------------------------------------------- maquetación de la página (coordenadas de página)
export const PG = {
  title: 452, sub: 500,
  hero: { x: 150, y: 540, w: 780, h: 470 },
  cards: { y: 1080, w: 250, h: 372, xs: [145, 415, 685] },
  chip: { x: 145, y: 1490 },
  rating: { label: 2330, num: 2530, stars: 2635, chip: 2730 },
  reviews: [3420, 3730, 4040],
  gallery: { y: 4660, w: 382, h: 500, gap: 20, x0: 148 },
  order: { head: 6390, sub: 6444, thumbs: 6580 },
  button: { x: 200, y: 6720, w: 680, h: 124 },
};
const SCROLL = [[5.78, 6.08, 0, 1595], [7.86, 8.14, 1595, 2875], [9.62, 10.02, 2875, 4210], [11.92, 12.16, 4210, 5622]];
export function scrollAt(t) {
  let sc = 0;
  for (const [a, b, f, to] of SCROLL) if (t >= a) sc = lerp(f, to, easeIO(clamp((t - a) / (b - a))));
  return sc;
}
// cámara de la página: zoom alrededor de un pivote (alejamiento en "TU PÁGINA" y pull-back final)
export function pageCam(t) {
  if (t < 14.0) {
    const out = easeIO(clamp((t - 9.45) / 0.5)) * (1 - easeIO(clamp((t - 11.9) / 0.25)));
    const push = 1 + 0.018 * smooth(3.4, 5.8, t) * (1 - smooth(5.78, 5.9, t));   // empuje lento sobre las tarjetas
    return { z: lerp(1, 0.80, out) * push, px: 540, py: out > 0 ? 1760 : 1300 };
  }
  return { z: lerp(1, 0.34, easeIO(clamp((t - 14.0) / 0.7))), px: 540, py: 960 };
}
export function camMatrix(t) {     // pagina → pantalla: (a, tx, ty), pantalla = a·p + (tx, ty)
  const c = pageCam(t), sc = scrollAt(t);
  return { a: c.z, tx: c.px * (1 - c.z), ty: c.py - c.z * (c.py + sc), sc, cam: c };
}
const camOnly = (t, x, y) => { const c = pageCam(t); return [c.px + (x - c.px) * c.z, c.py + (y - c.py) * c.z]; };

// ---------------------------------------------------------------- formas de cristal (pantalla)
export const LOGO_END = { cx: 540, cy: 790, r: 170 };
export const LOGO_CARD = { cx: 540, cy: 455, r: 100 };
export function frameRect(t) {
  const c = pageCam(t), shrink = easeIO(clamp((t - 14.7) / 0.22));
  const [cx, cy] = camOnly(t, FRAME.cx, FRAME.cy);
  return { cx, cy, hw: FRAME.hw * c.z * (1 - shrink) + 1e-3, hh: FRAME.hh * c.z * (1 - shrink) + 1e-3, r: Math.min(FRAME.r * c.z, FRAME.hw * c.z * (1 - shrink)) };
}
export function avatar(t) {
  if (t < 3.42) {
    const k = easeIO(clamp((t - 3.02) / 0.40));
    return { cx: lerp(DISK.cx, AVATAR_END.cx, k), cy: lerp(DISK.cy, AVATAR_END.cy, k), r: lerp(DISK.r, AVATAR_END.r, k), reveal: easeIO(clamp((t - 2.82) / 0.20)) };
  }
  if (t < 14.9) {
    const M = camMatrix(t);
    return { cx: M.a * AVATAR_END.cx + M.tx, cy: M.a * AVATAR_END.cy + M.ty, r: AVATAR_END.r * M.a, reveal: 1 };
  }
  const g = easeIO(clamp((t - 15.0) / 0.12)), e = easeIO(clamp((t - 15.72) / 0.36));
  return { cx: LOGO_END.cx, cy: lerp(LOGO_END.cy, LOGO_CARD.cy, e), r: lerp(LOGO_END.r, LOGO_CARD.r, e), reveal: g };
}

// ---------------------------------------------------------------- utilidades de dibujo
export function rrect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }
export function cover(ctx, im, x, y, w, h, zoom = 1, ox = 0, oy = 0) {
  const s = Math.max(w / im.width, h / im.height) * zoom, dw = im.width * s, dh = im.height * s;
  ctx.drawImage(im, x + (w - dw) / 2 + ox, y + (h - dh) / 2 + oy, dw, dh);
}
export function sheen(ctx, x, y, w, h, k, amt = 0.16) {
  if (k <= 0 || k >= 1) return;
  const cx = x - w * 0.6 + k * w * 2.2;
  const g = ctx.createLinearGradient(cx - 90, y, cx + 90, y + h * 0.35);
  g.addColorStop(0, 'rgba(255,243,201,0)'); g.addColorStop(0.5, `rgba(255,243,201,${amt * Math.sin(Math.PI * k)})`); g.addColorStop(1, 'rgba(255,243,201,0)');
  ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
}
// tipografía cinética: cada glifo aterriza (stagger) y sale enmascarado
export function glyphRow(ctx, t, text, font, size, cx, base, tLand, tOut, spacing, color, opt = {}) {
  ctx.font = font;
  const stagger = opt.stagger ?? 0.028, land = opt.land;
  const chars = [...text], ws = chars.map((ch) => ctx.measureText(ch).width);
  const total = ws.reduce((a, b) => a + b, 0) + spacing * (chars.length - 1);
  let x = opt.left ?? cx - total / 2, gi = 0;
  ctx.save(); ctx.beginPath(); ctx.rect(-2000, base - size * 1.05, 6000, size * 1.34); ctx.clip();
  chars.forEach((ch, i) => {
    if (ch !== ' ') {
      const tl = land ? land(gi) : tLand + gi * stagger, k = clamp((t - (tl - 0.17)) / 0.17);
      const e = k <= 0 ? 0 : 1 + 2.2 * Math.pow(k - 1, 3) + 1.2 * Math.pow(k - 1, 2);
      const ko = clamp((t - (tOut + gi * Math.min(stagger, 0.02))) / 0.2);
      const y = base + (1 - e) * size * 0.95 - Math.pow(ko, 2) * size * 1.1;
      const a = clamp(k * 2.2) * (1 - ko);
      if (a > 0) { ctx.globalAlpha = a; ctx.fillStyle = color; ctx.fillText(ch, x, y); }
      gi++;
    }
    x += ws[i] + spacing;
  });
  ctx.restore(); ctx.globalAlpha = 1;
  return { left: opt.left ?? cx - total / 2, width: total, ws, spacing };
}
// la línea caramelo como trazo de luz (núcleo crema, halo caramelo)
export function lightStroke(ctx, pts, a = 1, w = 4) {
  if (pts.length < 2 || a <= 0) return;
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const path = () => { ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (const p of pts) ctx.lineTo(p[0], p[1]); };
  ctx.globalAlpha = 0.35 * a; ctx.strokeStyle = C.cara; ctx.lineWidth = w * 5; ctx.filter = `blur(${w * 2.5}px)`; path(); ctx.stroke();
  ctx.filter = 'none'; ctx.globalAlpha = 0.9 * a; ctx.strokeStyle = C.cara; ctx.lineWidth = w * 1.8; path(); ctx.stroke();
  ctx.globalAlpha = a; ctx.strokeStyle = C.core; ctx.lineWidth = w * 0.7; path(); ctx.stroke();
  ctx.restore();
}
function star(ctx, cx, cy, R) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? R * 0.45 : R; ctx.lineTo(cx + r * Math.cos(a), cy + r * Math.sin(a)); }
  ctx.closePath();
}
// franja de cristal que desenfoca de verdad la foto que tiene detrás
function glassStrip(ctx, im, box, strip, zoom, ox, oy, tint = 0.55) {
  ctx.save(); rrect(ctx, strip.x, strip.y, strip.w, strip.h, 0); ctx.clip();
  ctx.filter = 'blur(32px) saturate(1.4)'; cover(ctx, im, box.x, box.y, box.w, box.h, zoom * 1.1, ox, oy); ctx.filter = 'none';
  ctx.fillStyle = `rgba(30,17,11,${tint})`; ctx.fillRect(strip.x, strip.y, strip.w, strip.h);
  ctx.fillStyle = cream(0.16); ctx.fillRect(strip.x, strip.y, strip.w, 1);
  ctx.restore();
}

// ---------------------------------------------------------------- piezas
function card(ctx, t, im, label, x, y, w, h, tLand) {
  const e = clamp((t - (tLand - 0.24)) / 0.30);
  if (e <= 0) return;
  const reveal = easeIO(clamp(e / 0.5)), tilt = easeIO(clamp((e - 0.15) / 0.85));
  const lift = 26 * tilt, a = lerp(1, 0.866, tilt), b = lerp(0, -0.5, tilt) * 0.42;
  const cx = x + w / 2, cy = y + h / 2;
  ctx.save(); ctx.filter = `blur(${(6 + 18 * tilt).toFixed(1)}px)`; ctx.fillStyle = `rgba(10,5,3,${0.55 * reveal})`;
  ctx.beginPath(); ctx.ellipse(cx + 16 * tilt, y + h + 8, w * 0.46, 12 + 10 * tilt, 0, 0, 7); ctx.fill(); ctx.restore();
  ctx.save();
  ctx.translate(cx, cy - lift); ctx.transform(a, b, 0, 1, 0, 0);
  ctx.beginPath(); ctx.rect(-w, h / 2 - h * reveal - 4, 2 * w, h * reveal + 30); ctx.clip();
  rrect(ctx, -w / 2 - 7 * tilt, -h / 2 + 9 * tilt, w, h, 22); ctx.fillStyle = '#24140D'; ctx.fill();
  rrect(ctx, -w / 2 - 3.5 * tilt, -h / 2 + 4.5 * tilt, w, h, 22); ctx.fillStyle = 'rgba(181,104,63,0.35)'; ctx.fill();
  rrect(ctx, -w / 2, -h / 2, w, h, 22); ctx.save(); ctx.clip();
  const box = { x: -w / 2, y: -h / 2, w, h }, oy = -6 * (t - tLand);
  cover(ctx, im, box.x, box.y, w, h, 1.08, 0, oy - 30);
  glassStrip(ctx, im, box, { x: -w / 2, y: h / 2 - 86, w, h: 86 }, 1.08, 0, oy - 30);
  const hl = ctx.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2);
  hl.addColorStop(0, 'rgba(255,243,201,0.12)'); hl.addColorStop(0.35, 'rgba(255,243,201,0)');
  ctx.fillStyle = hl; ctx.fillRect(-w / 2, -h / 2, w, h);
  sheen(ctx, -w / 2, -h / 2, w, h, (t - tLand - 0.05) / 0.7);
  ctx.restore();
  rrect(ctx, -w / 2 + 0.5, -h / 2 + 0.5, w - 1, h - 1, 22); ctx.strokeStyle = cream(0.18); ctx.lineWidth = 1; ctx.stroke();
  ctx.font = '600 26px Inter'; ctx.fillStyle = C.cream; ctx.textAlign = 'center';
  ctx.letterSpacing = '3px'; ctx.fillText(label, 1.5, h / 2 - 34); ctx.letterSpacing = '0px'; ctx.textAlign = 'left';
  ctx.restore();
}
function chip(ctx, t, text, x, y, tLand, center = false, fsz = 26) {
  const k = clamp((t - (tLand - 0.10)) / 0.22);
  if (k <= 0) return;
  ctx.font = `500 ${fsz}px Inter`;
  const w = ctx.measureText(text).width + 2 * fsz, h = fsz * 2.08, s = 0.86 + 0.14 * (1 + 2.0 * Math.pow(k - 1, 3) + 1.0 * Math.pow(k - 1, 2));
  const x0 = center ? x - w / 2 : x;
  ctx.save(); ctx.globalAlpha = clamp(k * 2); ctx.translate(x0 + w / 2, y + h / 2); ctx.scale(s, s); ctx.translate(-w / 2, -h / 2);
  rrect(ctx, 0, 0, w, h, h / 2); ctx.fillStyle = 'rgba(58,34,24,0.80)'; ctx.fill();
  ctx.strokeStyle = cream(0.24); ctx.lineWidth = 1; ctx.stroke();
  ctx.fillStyle = C.cream; ctx.fillText(text, fsz, h / 2 + fsz * 0.35);
  ctx.restore();
}
function glassPanel(ctx, x, y, w, h, r = 28) {
  rrect(ctx, x, y, w, h, r); ctx.fillStyle = 'rgba(58,34,24,0.62)'; ctx.fill();
  const g = ctx.createLinearGradient(x, y, x + w * 0.5, y + h);
  g.addColorStop(0, 'rgba(255,243,201,0.09)'); g.addColorStop(0.4, 'rgba(255,243,201,0)');
  ctx.fillStyle = g; ctx.fill();
  rrect(ctx, x + 0.5, y + 0.5, w - 1, h - 1, r); ctx.strokeStyle = cream(0.16); ctx.lineWidth = 1; ctx.stroke();
}
function review(ctx, t, i, y, lines, tIn, extra) {
  const k = clamp((t - tIn) / 0.30);
  if (k <= 0) return;
  const e = 1 - Math.pow(1 - k, 3), slide = (1 - e) * 760;
  const x = 140, w = 800, h = lines.length > 1 ? 280 : 210;
  ctx.save(); ctx.globalAlpha = clamp(k * 3);
  ctx.translate(slide, 0); glassPanel(ctx, x, y, w, h);
  ctx.translate(-slide * 0.18, 0);          // el texto va un poco detrás: paralaje dentro del cristal
  ctx.font = '500 24px Inter'; ctx.fillStyle = cream(0.72); ctx.letterSpacing = '2px'; ctx.fillText('RESEÑA DE GOOGLE', x + 48, y + 62); ctx.letterSpacing = '0px';
  ctx.font = 'italic 400 47px Fraunces'; ctx.fillStyle = C.cream;
  lines.forEach((ln, j) => ctx.fillText(ln, x + 48, y + 136 + j * 64));
  if (extra) extra(ctx, x + 48, y + 136);
  ctx.restore();
}

// ---------------------------------------------------------------- capa de la página (se recorta al marco en el shader)
export function drawPage(ctx, t, IM, TM, SCALE) {
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  if (t < 3.0 || t > 14.95) return;
  const M = camMatrix(t);
  ctx.setTransform(SCALE * M.a, 0, 0, SCALE * M.a, SCALE * M.tx, SCALE * M.ty);
  const vis = (y0, y1) => y1 > M.sc + 100 && y0 < M.sc + 1820;
  // encabezado
  if (vis(380, 520)) {
    glyphRow(ctx, t, 'Babkery', '600 78px Fraunces', 78, 540, PG.title, 3.50, 99, 1, C.cream);
    glyphRow(ctx, t, 'panadería y café · Guadalajara', '500 27px Inter', 27, 540, PG.sub, 3.62, 99, 1.2, cream(0.80), { stagger: 0.012 });
  }
  const hk = easeIO(clamp((t - 3.10) / 0.42));
  if (hk > 0 && vis(PG.hero.y, PG.hero.y + PG.hero.h)) {
    const { x, y, w, h } = PG.hero;
    ctx.save(); rrect(ctx, x, y, w, h * hk, 36); ctx.clip();
    cover(ctx, IM.hero, x, y, w, h, 1.12 - 0.05 * hk, 0, 30 * (1 - hk) - 16 * (t - 3.1));
    const g = ctx.createLinearGradient(0, y + h * 0.55, 0, y + h); g.addColorStop(0, 'rgba(26,15,10,0)'); g.addColorStop(1, 'rgba(26,15,10,0.35)');
    ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
    sheen(ctx, x, y, w, h, (t - 3.55) / 0.8);
    ctx.restore();
    rrect(ctx, x + 0.5, y + 0.5, w - 1, h * hk - 1, 36); ctx.strokeStyle = cream(0.16 * hk); ctx.lineWidth = 1; ctx.stroke();
  }
  if (vis(PG.cards.y - 60, PG.chip.y + 60)) {
    const { y, w, h, xs } = PG.cards;
    card(ctx, t, IM.c1, 'CROISSANTS', xs[0], y, w, h, Math.max(TM.croissants, 3.44));
    card(ctx, t, IM.c2, 'BABKAS', xs[1], y, w, h, TM.babkas);
    card(ctx, t, IM.c3, 'MASA MADRE', xs[2], y, w, h, TM.masa);
    // chip pegado a la tarjeta de croissants (afirmación del catálogo)
    const ck = clamp((t - 5.55) / 0.15);
    if (ck > 0) { ctx.fillStyle = cream(0.30 * ck); ctx.fillRect(PG.chip.x + 60, PG.cards.y + PG.cards.h + 2, 1, PG.chip.y - PG.cards.y - PG.cards.h - 2); }
    chip(ctx, t, '36 horas de fermentación', PG.chip.x, PG.chip.y, 5.65);
  }
  // calificación
  if (vis(PG.rating.label - 60, PG.rating.chip + 80)) {
    const R = PG.rating;
    glyphRow(ctx, t, 'CALIFICACIÓN EN GOOGLE', '500 30px Inter', 30, 540, R.label, 5.98, 99, 3, cream(0.75), { stagger: 0.01 });
    const steps = ['1.0', '2.0', '3.0', '4.0', '4.1', '4.2', '4.3', '4.4', '4.5', '4.6', '4.7'];
    const idx = t >= TM.siete ? 10 : Math.min(9, Math.floor(clamp((t - 6.0) / (TM.siete - 6.0)) * 10));
    const txt = t < 6.0 ? '' : steps[idx];
    if (txt) {
      const pop = t >= TM.siete ? 1 + 0.06 * Math.exp(-(t - TM.siete) / 0.08) : 1;
      ctx.save(); ctx.translate(540, R.num - 75); ctx.scale(pop, pop);
      ctx.font = '600 230px Fraunces'; ctx.textAlign = 'center'; ctx.fillStyle = C.cream; ctx.fillText(txt, 0, 75); ctx.restore(); ctx.textAlign = 'left';
    }
    for (let i = 0; i < 5; i++) {
      const ta = 6.05 + i * 0.12, k = clamp((t - ta) / 0.14);
      const cx = 540 + (i - 2) * 124, cy = R.stars + 30;
      star(ctx, cx, cy, 50); ctx.strokeStyle = cream(0.22); ctx.lineWidth = 1.5; ctx.stroke();
      if (k > 0) {
        const s = 0.6 + 0.4 * (1 + 2.0 * Math.pow(k - 1, 3) + 1.0 * Math.pow(k - 1, 2));
        ctx.save(); ctx.translate(cx, cy); ctx.scale(s, s);
        star(ctx, 0, 0, 50); ctx.save(); ctx.clip();
        const fill = i === 4 ? 0.7 : 1;
        const g = ctx.createLinearGradient(-50, -50, 50, 50); g.addColorStop(0, '#FFF3C9'); g.addColorStop(1, '#F7E8B0');
        ctx.fillStyle = g; ctx.fillRect(-52, -52, 104 * fill, 104);
        ctx.restore(); ctx.restore();
      }
    }
    chip(ctx, t, 'más de 140 reseñas en Google', 540, R.chip, TM.google, true, 32);
  }
  // reseñas (textuales, sin autor)
  if (vis(PG.reviews[0] - 40, PG.reviews[2] + 300)) {
    review(ctx, t, 0, PG.reviews[0], ['“De los mejores panes que', 'he probado en GDL.”'], 8.00);
    review(ctx, t, 1, PG.reviews[1], ['“Como están horneando', 'ahí mismo, todo está fresco.”'], 8.55, (c, x, y) => {
      const k = easeIO(clamp((t - 8.90) / 0.30));
      if (k <= 0) return;
      c.font = 'italic 400 47px Fraunces';
      const x0 = x + c.measureText('ahí mismo, ').width, w0 = c.measureText('todo está fresco').width;
      lightStroke(c, [[x0, y + 64 + 16], [x0 + w0 * k, y + 64 + 16]], 1, 3.2);
    });
    review(ctx, t, 2, PG.reviews[2], ['“Me atendieron muy bien”'], 9.10);
  }
  // galería: paneles de cristal con paralaje y reflejos
  if (vis(PG.gallery.y - 40, PG.gallery.y + 2 * PG.gallery.h + 60)) {
    const G = PG.gallery, items = [[IM.g1, 'Rosca de babka'], [IM.g2, 'Rol de canela y nuez'], [IM.g3, 'Barra rústica'], [IM.g4, 'Chocolatine']];
    items.forEach(([im, label], i) => {
      const t0 = 10.00 + i * 0.25, k = clamp((t - t0) / 0.32);
      if (k <= 0) return;
      const e = 1 - Math.pow(1 - k, 3);
      const x = G.x0 + (i % 2) * (G.w + G.gap), y = G.y + Math.floor(i / 2) * (G.h + G.gap) + (1 - e) * 70;
      const box = { x, y, w: G.w, h: G.h }, par = (t - t0) * (i % 2 ? -10 : 10);
      ctx.save(); ctx.globalAlpha = clamp(k * 2.5);
      ctx.save(); ctx.filter = 'blur(20px)'; ctx.fillStyle = 'rgba(8,4,2,0.5)'; rrect(ctx, x + 10, y + 22, G.w, G.h, 30); ctx.fill(); ctx.restore();
      rrect(ctx, x, y, G.w, G.h * (0.35 + 0.65 * e), 30); ctx.save(); ctx.clip();
      cover(ctx, im, x, y, G.w, G.h, 1.10 - 0.04 * e, par, -par * 0.6);
      glassStrip(ctx, im, box, { x, y: y + G.h - 78, w: G.w, h: 78 }, 1.10 - 0.04 * e, par, -par * 0.6, 0.5);
      ctx.font = '600 27px Inter'; ctx.fillStyle = C.cream; ctx.fillText(label, x + 26, y + G.h - 30);
      for (const [s0, d] of [[11.10, 0.45], [11.50, 0.45]]) sheen(ctx, x, y, G.w, G.h, (t - s0 - i * 0.05) / d, 0.2);
      ctx.restore();
      rrect(ctx, x + 0.5, y + 0.5, G.w - 1, G.h * (0.35 + 0.65 * e) - 1, 30); ctx.strokeStyle = cream(0.18); ctx.lineWidth = 1; ctx.stroke();
      ctx.restore();
    });
  }
  // pedido: encabezado, tres productos y el botón
  if (vis(PG.order.head - 120, PG.button.y + 300)) {
    const O = PG.order;
    glyphRow(ctx, t, 'Haz tu pedido', '600 76px Fraunces', 76, 540, O.head, 12.02, 99, 1, C.cream, { stagger: 0.022 });
    glyphRow(ctx, t, 'Croissants, babkas y masa madre', '500 29px Inter', 29, 540, O.sub, 12.12, 99, 0.6, cream(0.8), { stagger: 0.008 });
    [[IM.hero, 330], [IM.c2, 540], [IM.g2, 750]].forEach(([im, x], i) => {
      const k = clamp((t - (11.98 + i * 0.07)) / 0.26);
      if (k <= 0) return;
      const e = 1 - Math.pow(1 - k, 3), r = 88 * (0.7 + 0.3 * e), y = O.thumbs + (1 - e) * 50;
      ctx.save(); ctx.globalAlpha = clamp(k * 2.5);
      ctx.save(); ctx.filter = 'blur(16px)'; ctx.fillStyle = 'rgba(8,4,2,0.5)'; ctx.beginPath(); ctx.arc(x + 6, y + 16, r, 0, 7); ctx.fill(); ctx.restore();
      ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.save(); ctx.clip(); cover(ctx, im, x - r, y - r, 2 * r, 2 * r, 1.15, 0, -8 * (t - 12));
      sheen(ctx, x - r, y - r, 2 * r, 2 * r, (t - 12.6 - i * 0.06) / 0.5, 0.22); ctx.restore();
      ctx.strokeStyle = cream(0.22); ctx.lineWidth = 1.2; ctx.stroke();
      ctx.restore();
    });
  }
  // botón de WhatsApp
  if (vis(PG.button.y - 120, PG.button.y + 300)) {
    const B = PG.button, k = clamp((t - 12.0) / 0.25);
    if (k > 0) {
      const e = 1 - Math.pow(1 - k, 3);
      const press = 1 - 0.035 * Math.sin(Math.PI * clamp((t - TM.wa) / 0.14));
      const y = B.y + (1 - e) * 80;
      for (const tp of [13.0, 13.5]) {          // dos pulsos del anillo sobre el kick
        const p = clamp((t - tp) / 0.45);
        if (p > 0 && p < 1) {
          const g = 1 + 0.22 * (1 - Math.pow(1 - p, 2));
          ctx.save(); ctx.translate(540, y + B.h / 2); ctx.scale(g, 1 + (g - 1) * 2.2);
          rrect(ctx, -B.w / 2, -B.h / 2, B.w, B.h, B.h / 2); ctx.strokeStyle = cream(0.55 * (1 - p)); ctx.lineWidth = 2.5 / g; ctx.stroke(); ctx.restore();
        }
      }
      ctx.save(); ctx.globalAlpha = clamp(k * 2); ctx.translate(540, y + B.h / 2); ctx.scale(press, press);
      ctx.save(); ctx.filter = 'blur(22px)'; ctx.fillStyle = 'rgba(8,4,2,0.55)'; rrect(ctx, -B.w / 2 + 8, -B.h / 2 + 20, B.w, B.h, B.h / 2); ctx.fill(); ctx.restore();
      rrect(ctx, -B.w / 2, -B.h / 2 + 6, B.w, B.h, B.h / 2); ctx.fillStyle = '#4A1219'; ctx.fill();     // canto
      rrect(ctx, -B.w / 2, -B.h / 2, B.w, B.h, B.h / 2); ctx.fillStyle = C.wine; ctx.fill();
      const g = ctx.createLinearGradient(0, -B.h / 2, 0, B.h / 2); g.addColorStop(0, 'rgba(255,243,201,0.16)'); g.addColorStop(0.5, 'rgba(255,243,201,0)');
      ctx.fillStyle = g; ctx.fill();
      ctx.strokeStyle = cream(0.22); ctx.lineWidth = 1; ctx.stroke();
      ctx.font = '700 38px Inter'; ctx.letterSpacing = '3px'; ctx.fillStyle = C.cream; ctx.textAlign = 'center';
      ctx.fillText('PIDE POR WHATSAPP', 0, 13); const tw = ctx.measureText('PIDE POR WHATSAPP').width;
      ctx.letterSpacing = '0px'; ctx.textAlign = 'left';
      const u = easeIO(clamp((t - TM.pide) / Math.max(0.1, TM.wa - TM.pide)));     // la línea se vuelve el subrayado
      if (u > 0) lightStroke(ctx, [[-tw / 2, 34], [-tw / 2 + tw * u, 34]], 1, 3);
      ctx.restore();
    }
  }
}

// ---------------------------------------------------------------- capa libre: cierre y end card
export function drawClosing(ctx, t, TM) {
  // pull-back: queda un punto de luz que se vuelve la línea; la línea hace un último pliegue y cierra el anillo del logo
  const dotA = clamp((t - 14.72) / 0.12) * (1 - clamp((t - 15.0) / 0.06));
  if (dotA > 0) {
    const g = ctx.createRadialGradient(540, 960, 0, 540, 960, 48);
    g.addColorStop(0, `rgba(255,243,201,${dotA})`); g.addColorStop(0.25, `rgba(255,243,201,${0.5 * dotA})`); g.addColorStop(1, 'rgba(227,162,59,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(540, 960, 48, 0, 7); ctx.fill();
  }
  if (t >= 14.95 && t < 15.40) {
    const R = LOGO_END.r, cx = LOGO_END.cx, cy = LOGO_END.cy, half = Math.PI * R;
    const ext = half * (1 - Math.pow(2, -10 * clamp((t - 14.95) / 0.06)));
    const k = easeIO(clamp((t - 15.0) / 0.12)), curl = half * k;
    const a = 1 - clamp((t - 15.18) / 0.2);
    for (const side of [1, -1]) {
      const pts = [];
      for (let i = 0; i <= 90; i++) {
        const s = (ext * i) / 90;
        if (s <= curl) { const ang = Math.PI / 2 - side * (s / R); pts.push([cx + R * Math.cos(ang), cy + R * Math.sin(ang)]); }
        else {
          const ang = Math.PI / 2 - side * (curl / R);
          const px = cx + R * Math.cos(ang), py = cy + R * Math.sin(ang);
          const tx = side * Math.sin(ang), ty = -side * Math.cos(ang);   // tangente
          pts.push([px + tx * (s - curl), py + ty * (s - curl)]);
        }
      }
      lightStroke(ctx, pts, a, 4);
    }
  }
  glyphRow(ctx, t, 'Babkery · Guadalajara', '600 62px Fraunces', 62, 540, 1080, TM.gdl, 15.62, 1, C.cream, { stagger: 0.02 });
  // end card
  if (t >= 15.95) {
    const L1 = ['Precios accesibles', 'desde $1,000 pesos', 'por tu página'];
    L1.forEach((ln, j) => glyphRow(ctx, t, ln, '600 70px Fraunces', 70, 540, 700 + j * 86, 16.05 + j * 0.10, 99, 0, C.cream, { stagger: 0.008 }));
    glyphRow(ctx, t, 'Paquete de 3 videos promocionales: $1,500', '500 36px Inter', 36, 540, 1040, 16.40, 99, 0, C.cream, { stagger: 0.006 });
    const big = globalThis.FMT11 ? 1.3 : 1;      // en 1:1 los textos chicos del cierre crecen para seguir legibles
    glyphRow(ctx, t, 'ELEVATE NEGOCIOS · AGUASCALIENTES', `600 ${27 * big}px Inter`, 27 * big, 540, 1160 + (big - 1) * 30, 16.70, 99, 3, C.cream, { stagger: 0.006 });
    glyphRow(ctx, t, 'Demo de cortesía de Elevate Negocios · pieza no oficial', `400 ${23 * big}px Inter`, 23 * big, 540, 1222 + (big - 1) * 80, 16.90, 99, 0, cream(0.74), { stagger: 0.004 });
    // subrayado caramelo bajo "$1,000" cuando la voz dice "mil"
    const u = easeIO(clamp((t - TM.mil) / 0.30));
    if (u > 0) {
      ctx.font = '600 70px Fraunces';
      const full = ctx.measureText('desde $1,000 pesos').width, pre = ctx.measureText('desde ').width, num = ctx.measureText('$1,000').width;
      const x0 = 540 - full / 2 + pre;
      lightStroke(ctx, [[x0, 700 + 86 + 18], [x0 + num * u, 700 + 86 + 18]], 1, 3.4);
    }
  }
}
