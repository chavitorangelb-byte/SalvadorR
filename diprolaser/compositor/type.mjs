// Tipografia en lienzo 2D. Todo se centra por la caja de TINTA real (actualBoundingBox),
// no por la caja tipografica: asi el texto queda centrado de verdad dentro de cada cristal.

export const FONTS = {
  head: (s) => `400 ${s}px "Archivo Black"`,
  cond: (s) => `400 ${s}px Anton`,
  ui: (s, w = 700) => `${w} ${s}px Inter`,
};

export function font(ctx, f, tracking = 0) { ctx.font = f; ctx.letterSpacing = `${tracking}px`; }

export function ink(ctx, text) {
  const m = ctx.measureText(text);
  return { l: m.actualBoundingBoxLeft, r: m.actualBoundingBoxRight, a: m.actualBoundingBoxAscent, d: m.actualBoundingBoxDescent,
    w: m.actualBoundingBoxLeft + m.actualBoundingBoxRight, h: m.actualBoundingBoxAscent + m.actualBoundingBoxDescent, adv: m.width };
}

// relleno segun estilo, calculado sobre la caja de tinta en coordenadas locales
export function paint(ctx, style, box) {
  const y0 = -box.a, y1 = box.d;
  if (style === 'gold') {
    const g = ctx.createLinearGradient(0, y0, 0, y1);
    g.addColorStop(0, '#F8E6A6'); g.addColorStop(0.45, '#D8B25C'); g.addColorStop(1, '#A57B2E'); return g;
  }
  if (style === 'silver') {
    const g = ctx.createLinearGradient(0, y0, 0, y1);
    g.addColorStop(0, '#FFFFFF'); g.addColorStop(0.55, '#D9DBE0'); g.addColorStop(1, '#9EA2AA'); return g;
  }
  if (style === 'red') {
    const g = ctx.createLinearGradient(0, y0, 0, y1);
    g.addColorStop(0, '#FF4A50'); g.addColorStop(1, '#C4161F'); return g;
  }
  return style;
}

// Texto centrado por tinta en (x, y). opts: f, tracking, style, alpha, scale, rot, glow
export function text(ctx, str, x, y, o = {}) {
  ctx.save();
  font(ctx, o.f, o.tracking || 0);
  const b = ink(ctx, str);
  ctx.translate(x, y);
  if (o.rot) ctx.rotate(o.rot);
  const sc = o.scale ?? 1; ctx.scale(sc * (o.sx ?? 1), sc);
  ctx.globalAlpha = Math.max(0, Math.min(1, o.alpha ?? 1));
  const ox = o.align === 'left' ? b.l : o.align === 'right' ? -b.r : -(b.r - b.l) / 2;
  const oy = (b.a - b.d) / 2;
  ctx.translate(ox, oy);
  if (o.glow) { ctx.shadowColor = o.glow; ctx.shadowBlur = o.glowR || 30; }
  if (o.composite) ctx.globalCompositeOperation = o.composite;
  ctx.fillStyle = paint(ctx, o.style || '#fff', b);
  ctx.fillText(str, 0, 0);
  ctx.restore();
  return b;
}

// Letras individuales (para tracking animado y coreografia por letra). fn(i, n) -> {dx, dy, a, s, r}
export function letters(ctx, str, x, y, o, fn) {
  ctx.save();
  font(ctx, o.f, 0);
  const chars = [...str];
  const tr = o.tracking || 0;
  const adv = chars.map((c) => ctx.measureText(c).width);
  const total = adv.reduce((s, v) => s + v, 0) + tr * (chars.length - 1);
  const whole = ink(ctx, str);
  let cx = x - total / 2;
  const oy = (whole.a - whole.d) / 2;
  chars.forEach((c, i) => {
    const k = fn ? fn(i, chars.length) : {};
    const a = Math.max(0, Math.min(1, (k.a ?? 1) * (o.alpha ?? 1)));
    if (a > 0.003 && c !== ' ') {
      ctx.save();
      ctx.translate(cx + adv[i] / 2 + (k.dx || 0), y + oy + (k.dy || 0));
      if (k.r) ctx.rotate(k.r);
      const s = k.s ?? 1; ctx.scale(s, s);
      ctx.globalAlpha = a;
      if (o.composite) ctx.globalCompositeOperation = o.composite;
      if (o.glow) { ctx.shadowColor = o.glow; ctx.shadowBlur = o.glowR || 30; }
      ctx.fillStyle = k.fill || paint(ctx, o.style || '#fff', whole);
      ctx.textAlign = 'center';
      ctx.fillText(c, 0, 0);
      ctx.restore();
    }
    cx += adv[i] + tr;
  });
  ctx.restore();
  return { w: total, h: whole.h };
}

export function inkWidth(ctx, str, f, tracking = 0) { ctx.save(); font(ctx, f, tracking); const b = ink(ctx, str); ctx.restore(); return b.w; }

// Icono de WhatsApp dibujado (burbuja con auricular), linea blanca
export function waIcon(ctx, x, y, r, color = '#fff', alpha = 1) {
  ctx.save(); ctx.translate(x, y); ctx.globalAlpha = alpha;
  ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = r * 0.13; ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.86, Math.PI * 0.72, Math.PI * 2.62);
  ctx.lineTo(-r * 0.86, r * 0.92);
  ctx.closePath(); ctx.stroke();
  // auricular
  ctx.save(); ctx.rotate(-0.15); ctx.scale(r / 100, r / 100);
  ctx.beginPath();
  ctx.moveTo(-34, -40); ctx.bezierCurveTo(-48, -26, -40, 6, -12, 30); ctx.bezierCurveTo(14, 52, 40, 54, 48, 40);
  ctx.lineTo(44, 26); ctx.lineTo(24, 18); ctx.lineTo(14, 28); ctx.bezierCurveTo(-2, 22, -16, 6, -22, -10);
  ctx.lineTo(-12, -20); ctx.lineTo(-18, -42); ctx.closePath(); ctx.fill();
  ctx.restore();
  ctx.restore();
}

// Rect redondeado
export function rrect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }
