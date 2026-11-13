// Campo líquido compartido: geometría de la línea, sus pliegues, la trenza, la "S" y el cristal,
// convertida a campos de distancia con signo (SDF) exactos. Todos los morphs mezclan SDF, nunca opacidad.
// Unidades: px de diseño del cuadro 1080×1920, y hacia abajo. Todo es función pura de t.

export const W = 1080, H = 1920;
export const T = {                // tiempos (s) bloqueados a la voz; ver timeline.json
  burst: 0.16, folds: [1.00, 1.50, 2.00], foldDur: 0.20,
  braid0: 2.00, braid1: 2.50, s0: 2.55, s1: 2.92, disk0: 2.80, disk1: 3.00,
  frame0: 3.00, frame1: 3.40,
};
const L = 740;                    // media longitud de la línea (mundo); cruza el cuadro de lado a lado
const GAP = 7;                    // radio del doblez más interno = medio hueco entre capas
const N_PTS = 1481;

export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const smooth = (a, b, x) => { const k = clamp((x - a) / (b - a)); return k * k * (3 - 2 * k); };
export const easeIO = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
export const easeOutExpo = (k) => (k >= 1 ? 1 : 1 - Math.pow(2, -10 * k));
export const lerp = (a, b, k) => a + (b - a) * k;

// ---------- Pliegues: cada uno dobla el plano a la derecha de xf alrededor de C (mundo, y arriba) ----------
function foldPoint(x, y, F, th) {
  if (x <= F.xf || th <= 0) return [x, y];
  const add = F.rc * Math.sin(th) * Math.sin(th / 2);        // se enrolla con radio amplio y se cierra al caer
  const cy = F.cy + add, r = cy - y, s = x - F.xf;
  if (s <= r * th) { const a = -Math.PI / 2 + s / r; return [F.xf + r * Math.cos(a), cy + r * Math.sin(a)]; }
  const a = -Math.PI / 2 + th;
  const ex = F.xf + r * Math.cos(a), ey = cy + r * Math.sin(a);
  return [ex + (s - r * th) * Math.cos(th), ey + (s - r * th) * Math.sin(th)];
}
function bounds(pts) {
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (const [x, y] of pts) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  return { x0, x1, y0, y1, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, w: x1 - x0, h: y1 - y0 };
}
const BASE = Array.from({ length: N_PTS }, (_, i) => [-L + (2 * L * i) / (N_PTS - 1), 0]);
const FOLDS = [];
const KEYS = [];                  // estado completo tras cada pliegue (para la cámara)
{
  let pts = BASE;
  KEYS.push(bounds(pts));
  for (let i = 0; i < 3; i++) {
    const b = bounds(pts);
    const F = { xf: b.cx, cy: b.y1 + GAP, rc: 0.30 * (b.x1 - b.cx) };
    FOLDS.push(F);
    pts = pts.map(([x, y]) => foldPoint(x, y, F, Math.PI));
    KEYS.push(bounds(pts));
  }
}
function foldAngle(i, t) {
  const T1 = T.folds[i], k = clamp((t - (T1 - T.foldDur)) / T.foldDur);
  return Math.PI * Math.pow(0.5 - 0.5 * Math.cos(Math.PI * k), 1.25);   // acelera hacia el golpe
}
function squash(t) {             // la masa se aplasta un poco al caer y se recupera
  let s = 1;
  for (const T1 of T.folds) { const k = (t - T1) / 0.16; if (k >= 0 && k < 1) s *= 1 - 0.13 * (1 - k) * (1 - k); }
  return s;
}
// polilínea de la línea plegada en el mundo
export function ribbon(t) {
  const ths = [0, 1, 2].map((i) => foldAngle(i, t));
  const sq = squash(t);
  const ext = t < 0 ? 0 : L * easeOutExpo(t / T.burst);
  const out = [];
  for (const [x0, y0] of BASE) {
    if (Math.abs(x0) > ext + 1e-6) continue;
    let p = [x0, y0];
    for (let i = 0; i < 3; i++) p = foldPoint(p[0], p[1], FOLDS[i], ths[i]);
    out.push([p[0], p[1] * sq]);
  }
  return out;
}
export const thickness = (t) => lerp(3, 10, smooth(0.70, 1.0, t));   // grosor de la cinta (mundo)

// cámara: centro (mundo) y zoom; se acomoda en cada pliegue
const fitZ = (b) => Math.min(3.2, 760 / Math.max(b.w + 20, 1), 420 / Math.max(b.h + 20, 1));
const CAMS = KEYS.map((b, i) => ({ cx: i === 0 ? 0 : b.cx, cy: i === 0 ? 0 : b.cy, z: i === 0 ? 1 : fitZ(b) }));
export function camera(t) {
  let c = { ...CAMS[0] };
  for (let i = 0; i < 3; i++) {
    const k = easeIO(clamp((t - (T.folds[i] - 0.26)) / 0.42));
    c = { cx: lerp(c.cx, CAMS[i + 1].cx, k), cy: lerp(c.cy, CAMS[i + 1].cy, k), z: lerp(c.z, CAMS[i + 1].z, k) };
  }
  return c;
}
export const toScreen = (c, [x, y]) => [W / 2 + (x - c.cx) * c.z, H / 2 - (y - c.cy) * c.z];

// ---------- Formas de la trenza y de la "S" (pantalla) ----------
export const BRAID = { cx: 540, cy: 960, half: 300, A: 58, lambda: 400, T: 92 };
export const braidPhase = (t) => 0.9 * (t - T.braid0);
export function braidStrand(sign, t) {
  const { cx, cy, half, A, lambda } = BRAID, ph = braidPhase(t), pts = [];
  for (let i = 0; i <= 140; i++) {
    const x = cx - half + (2 * half * i) / 140;
    pts.push([x, cy + sign * A * Math.sin((2 * Math.PI * (x - cx + 0.25 * lambda)) / lambda + ph)]);
  }
  return pts;
}
export const S_SHAPE = { cx: 540, cy: 960, R: 128, r0: 26, T: 62 };
export function sArm(top) {
  const { cx, cy, R, r0 } = S_SHAPE, pts = [];
  for (let i = 0; i <= 160; i++) {
    const k = i / 160;
    if (top) { const a = -1.5 * Math.PI * k, r = lerp(r0, R, k); pts.push([cx + r * Math.cos(a), cy - R + r * Math.sin(a)]); }
    else { const a = -Math.PI / 2 + 1.5 * Math.PI * k, r = lerp(R, r0, k); pts.push([cx + r * Math.cos(a), cy + R + r * Math.sin(a)]); }
  }
  return pts;
}
export const DISK = { cx: 540, cy: 960, r: 215 };
export const FRAME = { cx: 540, cy: 960, hw: 440, hh: 790, r: 70 };
export const AVATAR_END = { cx: 540, cy: 318, r: 54 };

// ---------- SDF ----------
// Distancia euclidiana exacta (Felzenszwalb & Huttenlocher) sobre una rejilla.
const INF = 1e20;
function edt1d(f, n, d, v, z) {
  let k = 0; v[0] = 0; z[0] = -INF; z[1] = INF;
  for (let q = 1; q < n; q++) {
    let s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    while (s <= z[k]) { k--; s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]); }
    k++; v[k] = q; z[k] = s; z[k + 1] = INF;
  }
  k = 0;
  for (let q = 0; q < n; q++) { while (z[k + 1] < q) k++; const dq = q - v[k]; d[q] = dq * dq + f[v[k]]; }
}
function edt(grid, w, h) {          // grid: 0 en los pixeles semilla, INF en el resto → distancia²
  const n = Math.max(w, h), f = new Float64Array(n), d = new Float64Array(n), v = new Int32Array(n), z = new Float64Array(n + 1);
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) f[y] = grid[y * w + x];
    edt1d(f, h, d, v, z);
    for (let y = 0; y < h; y++) grid[y * w + x] = d[y];
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) f[x] = grid[y * w + x];
    edt1d(f, w, d, v, z);
    for (let x = 0; x < w; x++) grid[y * w + x] = d[x];
  }
}

export class Field {
  constructor(scale) {          // scale: px de la rejilla por px de diseño
    this.s = scale; this.w = Math.round(W * scale); this.h = Math.round(H * scale);
    this.cv = new OffscreenCanvas(this.w, this.h);
    this.ctx = this.cv.getContext('2d', { willReadFrequently: true });
    this.a = new Float64Array(this.w * this.h); this.b = new Float64Array(this.w * this.h);
  }
  // SDF (px de diseño) de un conjunto de polilíneas con grosor (px de diseño)
  strokes(paths, width) {
    const { ctx, w, h, s } = this;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
    ctx.setTransform(s, 0, 0, s, 0, 0);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = width; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const pts of paths) {
      if (pts.length < 2) continue;
      ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.stroke();
    }
    return this.fromMask(ctx.getImageData(0, 0, w, h).data);
  }
  fromMask(px) {
    const { a, b, w, h, s } = this, n = w * h;
    let any = false;
    for (let i = 0; i < n; i++) { const inside = px[i * 4] >= 128; any ||= inside; a[i] = inside ? 0 : INF; b[i] = inside ? INF : 0; }
    const out = new Float32Array(n);
    if (!any) { out.fill(1e4); return out; }
    edt(a, w, h); edt(b, w, h);
    for (let i = 0; i < n; i++) out[i] = (a[i] === 0 ? 0.5 - Math.sqrt(b[i]) : Math.sqrt(a[i]) - 0.5) / s;
    return out;
  }
  analytic(fn) {                  // fn(x, y) en px de diseño
    const { w, h, s } = this, out = new Float32Array(w * h);
    for (let j = 0; j < h; j++) { const y = (j + 0.5) / s; for (let i = 0; i < w; i++) out[j * w + i] = fn((i + 0.5) / s, y); }
    return out;
  }
}
export const mixSDF = (A, B, k) => { if (k <= 0) return A; if (k >= 1) return B; const o = new Float32Array(A.length); for (let i = 0; i < A.length; i++) o[i] = A[i] + (B[i] - A[i]) * k; return o; };
export const sdSeg = (px, py, ax, ay, bx, by) => {
  const pax = px - ax, pay = py - ay, bax = bx - ax, bay = by - ay;
  const hh = clamp((pax * bax + pay * bay) / (bax * bax + bay * bay || 1));
  return Math.hypot(pax - bax * hh, pay - bay * hh);
};
export const sdCircle = (x, y, c) => Math.hypot(x - c.cx, y - c.cy) - c.r;
export const sdRoundRect = (x, y, R) => {
  const qx = Math.abs(x - R.cx) - R.hw + R.r, qy = Math.abs(y - R.cy) - R.hh + R.r;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - R.r;
};
export const smin = (a, b, k) => { const h = clamp(0.5 + 0.5 * (b - a) / k); return lerp(b, a, h) - k * h * (1 - h); };
