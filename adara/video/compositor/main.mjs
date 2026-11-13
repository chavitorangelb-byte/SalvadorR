// Compositor determinista frame(t) del video de Adara Pastelería (Canvas 2D, 2.5D).
// Un solo plano continuo: una sola cámara, un solo campo de fondo y una sola línea de betún menta
// que se transforma (morph de forma, punto por punto) en remolino, aro del logo, marco del teléfono,
// cinta, órbita, contorno de tarjetas, subrayado del botón y raya del end card.
// 8 subcuadros por cuadro (obturador de 180°) para el motion blur.
// API para el render: window.renderFrame(f) deja el cuadro final en el canvas visible.
import * as TL from '../timeline/timeline.mjs';

const { T, clamp, lerp, prog, easeInOut, easeOut, easeOut5, easeIn, easeOutBack, spring, smooth } = TL;
const qs = new URLSearchParams(location.search);
const SCALE = Number(qs.get('scale') || 1);
const SUBS = Number(qs.get('subs') || 8);
const SAFE = qs.has('safe');
const W = 1080, H = 1920;
const RW = Math.round(W * SCALE), RH = Math.round(H * SCALE);

const C = { bg: '#1C1C1E', card: '#323232', mint: '#8FD6CB', mintD: '#5DA89D', orchid: '#C77DC0', ink: '#F5F5F5', mute: '#B8B8BE' };
const SERIF = '"Cormorant"', SANS = '"Jost"', SCRIPT = '"Parisienne"';

// ---------- lienzos ----------
const view = document.createElement('canvas');            // acumulador (lo que se captura)
view.width = RW; view.height = RH; document.body.appendChild(view);
const vctx = view.getContext('2d');
const work = document.createElement('canvas'); work.width = RW; work.height = RH;
const ctx = work.getContext('2d');
const BW = Math.max(2, Math.round(RW / 4)), BH = Math.max(2, Math.round(RH / 4));
const blurC = document.createElement('canvas'); blurC.width = BW; blurC.height = BH;
const bctx = blurC.getContext('2d');

// ---------- carga ----------
const fetchJSON = (u) => fetch(u).then((r) => r.json());
const loadImg = (u) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error(u)); i.src = u; });
const FONTS = [
  [SERIF, 'cormorant-garamond-latin-500-normal', '500', 'normal'], [SERIF, 'cormorant-garamond-latin-600-normal', '600', 'normal'],
  [SERIF, 'cormorant-garamond-latin-700-normal', '700', 'normal'], [SERIF, 'cormorant-garamond-latin-500-italic', '500', 'italic'],
  [SANS, 'jost-latin-400-normal', '400', 'normal'], [SANS, 'jost-latin-500-normal', '500', 'normal'], [SANS, 'jost-latin-600-normal', '600', 'normal'],
  [SCRIPT, 'parisienne-latin-400-normal', '400', 'normal'],
];
for (const [fam, file, weight, style] of FONTS) {
  const f = new FontFace(fam.replace(/"/g, ''), `url(../../site/fonts/${file}.woff2)`, { weight, style });
  document.fonts.add(await f.load());
}
const VO = await fetchJSON('../timeline/vo_words.json');
const MAN = await fetchJSON('../build/capture/manifest.json');
const IMG = {};
const PH = ['01_pastel_RyD_letras_doradas', '02_pastel_maceta_rosas_te_amo_mama', '03_pastel_corazon_gris', '04_galletas_decoradas_coleccion',
  '05_pastel_venom_spiderman', '06_galletas_estrella_navidad', '07_pastel_navidad_pinguinos', '08_galletas_con_flores',
  '09_pastel_mateo_dos_pisos', '10_pastel_among_us', '11_cupcakes_dinosaurios_cherry'];
await Promise.all([
  loadImg('../img/logo.png').then((i) => { IMG.logo = i; }),
  ...PH.map((n) => loadImg(`../img/${n}.png`).then((i) => { IMG['p' + n.slice(0, 2)] = i; })),
  loadImg('../build/capture/page_top.png').then((i) => { IMG.page = i; }),
  ...[0, 1, 2, 3, 4].map((k) => loadImg(`../build/capture/arma_${k}.png`).then((i) => { IMG['arma' + k] = i; })),
  ...MAN.typeSteps.map((k) => loadImg(`../build/capture/type_${String(k).padStart(2, '0')}.png`).then((i) => { IMG['type' + k] = i; })),
]);
for (const k of Object.keys(IMG)) { if (IMG[k].decode) await IMG[k].decode(); }

// texturas precalculadas
function offscreen(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
let seed = 11;
const rnd = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
const [noiseC, nx] = offscreen(256, 256);
{ const d = nx.createImageData(256, 256); for (let i = 0; i < d.data.length; i += 4) { const v = rnd() * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; } nx.putImageData(d, 0, 0); }
const noisePat = ctx.createPattern(noiseC, 'repeat');
// marmol tomado de la superficie real de sus fotos (esquina de la foto 07), muy difuminado
const [marbleC, mx] = offscreen(420, 420);
mx.filter = 'blur(3px) grayscale(1)'; mx.drawImage(IMG.p07, 0, 0, 280, 280, -10, -10, 440, 440); mx.filter = 'none';
const marblePat = ctx.createPattern(marbleC, 'repeat');
// foto 02 de heroe, desenfocada y oscurecida (fondo de la escena de fichas)
const [heroC, hx] = offscreen(540, 960);
hx.filter = 'blur(14px) saturate(120%)';
{ const i = IMG.p02, s = Math.max(600 / i.width, 1020 / i.height); hx.drawImage(i, 270 - i.width * s / 2, 480 - i.height * s / 2, i.width * s, i.height * s); }
hx.filter = 'none'; hx.fillStyle = 'rgba(20,20,22,0.68)'; hx.fillRect(0, 0, 540, 960);
// foto 04 (galletas con texto de terceros): solo pequena y desenfocada
const [p04C, p4x] = offscreen(219, 292);
p4x.filter = 'blur(3.2px)'; p4x.drawImage(IMG.p04, -6, -6, 231, 304); p4x.filter = 'none';

// voz: hora de cada palabra
const VW = {}; for (const l of VO) VW[l.id] = l.words.map((w) => w.t0);
const wt = (id, i) => VW[id][i];

// ---------- utilidades de dibujo ----------
function rrPath(c, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  c.moveTo(x + r, y); c.lineTo(x + w - r, y); c.arcTo(x + w, y, x + w, y + r, r);
  c.lineTo(x + w, y + h - r); c.arcTo(x + w, y + h, x + w - r, y + h, r);
  c.lineTo(x + r, y + h); c.arcTo(x, y + h, x, y + h - r, r);
  c.lineTo(x, y + r); c.arcTo(x, y, x + r, y, r); c.closePath();
}
function coverSrc(img, w, h) {              // recorte "cover" de la imagen para un rect w x h
  const ia = img.width / img.height, ra = w / h;
  if (ia > ra) { const sw = img.height * ra; return [(img.width - sw) / 2, 0, sw, img.height]; }
  const sh = img.width / ra; return [0, (img.height - sh) / 2, img.width, sh];
}
function drawCover(c, img, x, y, w, h) { const [sx, sy, sw, sh] = coverSrc(img, w, h); c.drawImage(img, sx, sy, sw, sh, x, y, w, h); }
const track = (keys) => (t) => {                // keyframes [[t, {..}], ...] con easeInOut entre llaves
  if (t <= keys[0][0]) return { ...keys[0][1] };
  for (let i = 1; i < keys.length; i++) {
    const [t1, v1] = keys[i], [t0, v0] = keys[i - 1];
    if (t <= t1) { const u = easeInOut((t - t0) / (t1 - t0)); const o = {}; for (const k in v1) o[k] = lerp(v0[k] ?? v1[k], v1[k], u); return o; }
  }
  return { ...keys[keys.length - 1][1] };
};

// snapshot desenfocado de lo que ya esta dibujado (para el cristal)
let snapT = -1;
function snap(t) {
  if (snapT === t) return;
  snapT = t;
  bctx.save(); bctx.setTransform(1, 0, 0, 1, 0, 0);
  bctx.filter = `blur(${Math.max(1, 34 * SCALE / 4).toFixed(2)}px) saturate(140%)`;
  bctx.drawImage(work, 0, 0, BW, BH); bctx.filter = 'none'; bctx.restore();
}
// panel de cristal: desenfoca de verdad lo de atras, tinte, marmol 5 %, ruido 2 %, brillo y borde de 1 px
function glass(pathFn, o = {}) {
  ctx.save(); ctx.beginPath(); pathFn(ctx); ctx.clip();
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(blurC, 0, 0, RW, RH); ctx.restore();
  ctx.fillStyle = o.tint || 'rgba(255,255,255,0.075)'; ctx.fill();
  if (o.marble !== false) { ctx.globalAlpha = o.marble ?? 0.05; ctx.fillStyle = marblePat; ctx.fill(); }
  ctx.globalAlpha = 0.02; ctx.fillStyle = noisePat; ctx.fill(); ctx.globalAlpha = 1;
  if (o.bounds) {
    const [x, y, w, h] = o.bounds;
    const g = ctx.createLinearGradient(x, y, x + w * 0.6, y + h);
    g.addColorStop(0, 'rgba(255,255,255,0.16)'); g.addColorStop(0.42, 'rgba(255,255,255,0.02)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fill();
  }
  ctx.restore();
  ctx.save(); ctx.beginPath(); pathFn(ctx);
  const m = ctx.getTransform(); const sc = Math.sqrt(Math.abs(m.a * m.d - m.b * m.c)) / SCALE;
  ctx.lineWidth = 1.2 / Math.max(0.2, sc);
  if (o.bounds) {
    const [x, y, w, h] = o.bounds;
    const g = ctx.createLinearGradient(x, y, x + w, y + h);
    g.addColorStop(0, 'rgba(255,255,255,0.55)'); g.addColorStop(0.5, 'rgba(255,255,255,0.12)'); g.addColorStop(1, 'rgba(255,255,255,0.30)');
    ctx.strokeStyle = g;
  } else ctx.strokeStyle = 'rgba(255,255,255,0.32)';
  ctx.stroke(); ctx.restore();
}
// grosor de una losa: copias desplazadas a lo largo de D, de la cara trasera a la frontal
function slab(pathFn, D, n, colA, colB) {
  for (let k = n; k >= 1; k--) {
    ctx.save(); ctx.translate(D[0] * k / n, D[1] * k / n); ctx.beginPath(); pathFn(ctx);
    ctx.fillStyle = k === n ? colA : colB; ctx.fill(); ctx.restore();
  }
}
function contactShadow(x, y, rx, ry, a) {
  if (a <= 0.002) return;
  ctx.save(); ctx.translate(x, y); ctx.scale(1, ry / rx);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
  g.addColorStop(0, `rgba(0,0,0,${0.55 * a})`); g.addColorStop(0.6, `rgba(0,0,0,${0.22 * a})`); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.fillRect(-rx, -rx, 2 * rx, 2 * rx); ctx.restore();
}

// ---------- la linea de betun (formas, remuestreo y morph) ----------
const N = 420;
function resample(pts, n = N) {
  const L = [0];
  for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const tot = L[L.length - 1] || 1, out = [];
  let j = 1;
  for (let k = 0; k < n; k++) {
    const d = (tot * k) / (n - 1);
    while (j < L.length - 1 && L[j] < d) j++;
    const u = (d - L[j - 1]) / ((L[j] - L[j - 1]) || 1);
    out.push([lerp(pts[j - 1][0], pts[j][0], u), lerp(pts[j - 1][1], pts[j][1], u)]);
  }
  return out;
}
const SW = { cx: 540, cy: 880, R: 250 };
function swirlPts() {                         // remolino de betun (como el del cupcake del logo)
  const p = [], { cx, cy, R } = SW, loops = 2.75;
  for (let i = 0; i <= 600; i++) {
    const s = i / 600, th = Math.PI * 0.92 + 2 * Math.PI * loops * s;
    const r = R * (1.0 - 0.80 * Math.pow(s, 1.1));
    const y = cy + R * 0.72 - s * R * 1.45 + r * 0.46 * Math.sin(th);
    p.push([cx + r * Math.cos(th), y]);
  }
  p.push([cx + R * 0.05, cy - R * 0.98]); p.push([cx - R * 0.10, cy - R * 1.08]);
  return resample(p);
}
const SWIRL = swirlPts();
function ringPts(cx, cy, R, a0 = -Math.PI / 2) {
  const p = []; for (let i = 0; i < N; i++) { const a = a0 + (2 * Math.PI * i) / (N - 1); p.push([cx + R * Math.cos(a), cy + R * Math.sin(a)]); } return p;
}
function rrectPts(cx, cy, w, h, r) {          // empieza arriba al centro, sentido horario (como el aro)
  const p = [], x0 = cx - w / 2, y0 = cy - h / 2, x1 = cx + w / 2, y1 = cy + h / 2;
  const arc = (ax, ay, a0, a1) => { for (let i = 0; i <= 10; i++) { const a = lerp(a0, a1, i / 10); p.push([ax + r * Math.cos(a), ay + r * Math.sin(a)]); } };
  p.push([cx, y0]); p.push([x1 - r, y0]); arc(x1 - r, y0 + r, -Math.PI / 2, 0); p.push([x1, y1 - r]); arc(x1 - r, y1 - r, 0, Math.PI / 2);
  p.push([x0 + r, y1]); arc(x0 + r, y1 - r, Math.PI / 2, Math.PI); p.push([x0, y0 + r]); arc(x0 + r, y0 + r, Math.PI, Math.PI * 1.5); p.push([cx, y0]);
  return resample(p);
}
function linePts(x0, x1, y, sag = 0) { const p = []; for (let i = 0; i < N; i++) { const u = i / (N - 1); p.push([lerp(x0, x1, u), y + sag * Math.sin(Math.PI * u)]); } return p; }
function curvePts(ctrl) {                     // Catmull-Rom por puntos de control
  const p = [];
  for (let i = 0; i < ctrl.length - 1; i++) {
    const p0 = ctrl[Math.max(0, i - 1)], p1 = ctrl[i], p2 = ctrl[i + 1], p3 = ctrl[Math.min(ctrl.length - 1, i + 2)];
    for (let k = 0; k < 24; k++) {
      const s = k / 24, s2 = s * s, s3 = s2 * s;
      p.push([0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * s + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * s2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * s3),
        0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * s + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * s2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * s3)]);
    }
  }
  p.push(ctrl[ctrl.length - 1]);
  return resample(p);
}
// morph liquido: cada punto llega con un pequeno retraso a lo largo del trazo y con una ondulacion que se apaga
function morph(A, B, u, t, stag = 0.3, amp = 18) {
  const out = [];
  for (let i = 0; i < N; i++) {
    const ui = easeInOut(clamp((u - (stag * i) / N) / (1 - stag)));
    const w = Math.sin(Math.PI * ui) * amp * Math.sin(i * 0.09 + t * 9);
    const dx = B[i][0] - A[i][0], dy = B[i][1] - A[i][1], L = Math.hypot(dx, dy) || 1;
    out.push([lerp(A[i][0], B[i][0], ui) - (dy / L) * w, lerp(A[i][1], B[i][1], ui) + (dx / L) * w]);
  }
  return out;
}
// trazo de betun: sombra, cuerpo menta con canto, brillo especular (se lee como manga pastelera, no como linea plana)
function frosting(pts, a, b, w, glow = 0) {
  const i0 = Math.max(0, Math.floor(a * (N - 1))), i1 = Math.min(N - 1, Math.ceil(b * (N - 1)));
  if (i1 - i0 < 1) return;
  const path = () => { ctx.beginPath(); ctx.moveTo(pts[i0][0], pts[i0][1]); for (let i = i0 + 1; i <= i1; i++) ctx.lineTo(pts[i][0], pts[i][1]); };
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (glow > 0) { path(); ctx.strokeStyle = `rgba(143,214,203,${0.10 * glow})`; ctx.lineWidth = w * 3.4; ctx.stroke(); }
  ctx.save(); ctx.translate(w * 0.28, w * 0.45); path(); ctx.strokeStyle = 'rgba(0,0,0,0.42)'; ctx.lineWidth = w * 1.15; ctx.stroke(); ctx.restore();
  path(); ctx.strokeStyle = C.mintD; ctx.lineWidth = w; ctx.stroke();
  path(); ctx.strokeStyle = C.mint; ctx.lineWidth = w * 0.72; ctx.stroke();
  ctx.save(); ctx.translate(-w * 0.14, -w * 0.18); path(); ctx.strokeStyle = 'rgba(236,255,251,0.85)'; ctx.lineWidth = w * 0.20; ctx.stroke(); ctx.restore();
  ctx.restore();
}

// ---------- tipografia cinetica (por glifo) ----------
const mcache = new Map();
function glyphs(text, font, track) {
  const key = text + '|' + font + '|' + track;
  if (mcache.has(key)) return mcache.get(key);
  ctx.save(); ctx.font = font; ctx.letterSpacing = '0px';
  const chars = [...text], xs = [];
  for (let i = 0; i < chars.length; i++) xs.push(ctx.measureText(chars.slice(0, i).join('')).width + i * track);
  const wl = ctx.measureText(chars[chars.length - 1]).width;
  const total = xs[xs.length - 1] + wl;
  const res = { chars, xs, ws: chars.map((c) => ctx.measureText(c).width), total };
  ctx.restore(); mcache.set(key, res); return res;
}
// estilos: drop (cae con giro), rise (sube por mascara), pop (escala con rebote), swing (gira sobre su eje), track (se cierra el tracking)
function word(text, x, y, o, tw, tOut = 99) {
  const font = o.font, size = o.size, tr = o.track || 0, st = o.style || 'rise', stag = o.stagger ?? 0.026;
  const g = glyphs(text, font, tr);
  const x0 = o.align === 'left' ? x : o.align === 'right' ? x - g.total : x - g.total / 2;
  ctx.save(); ctx.font = font; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = o.color || C.ink;
  if (o.shadow) { ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 22 * SCALE; ctx.shadowOffsetY = 4 * SCALE; }
  if (st === 'rise') { ctx.beginPath(); ctx.rect(x0 - 40, y - size * 1.15, g.total + 80, size * 1.55); ctx.clip(); }
  const n = g.chars.length;
  for (let i = 0; i < n; i++) {
    const ts = tw - 0.14 + i * stag;
    const u = (o.instant ? 1 : (t_ - ts) / 0.42);
    if (u <= 0) continue;
    const ue = clamp((t_ - (tOut + i * 0.018)) / 0.26);
    if (ue >= 1) continue;
    const e = easeIn(ue);
    let dx = 0, dy = 0, rot = 0, sx = 1, sy = 1;
    const sp = o.instant ? 1 : spring(u, 10, 6.5);
    if (st === 'drop') { dy = -size * 0.9 * (1 - sp); rot = -0.35 * (1 - sp); }
    else if (st === 'rise') { dy = size * 1.15 * (1 - easeOut5(clamp(u * 1.25))); }
    else if (st === 'pop') { sx = sy = Math.max(0, sp); }
    else if (st === 'swing') { sy = Math.max(0, sp); dy = -size * 0.15 * (1 - sp); }
    else if (st === 'track') { dx = (i - n / 2) * size * 0.35 * (1 - easeOut5(clamp(u * 1.3))); sx = sy = lerp(1.25, 1, easeOut5(clamp(u * 1.3))); }
    dy -= e * size * 0.9; sx *= 1 - e; sy *= 1 - e;
    const cx = x0 + g.xs[i] + g.ws[i] / 2;
    ctx.save(); ctx.translate(cx + dx, y + dy - size * 0.32); ctx.rotate(rot); ctx.scale(sx, sy);
    ctx.fillText(g.chars[i], -g.ws[i] / 2, size * 0.32); ctx.restore();
  }
  ctx.restore();
  return { x0, w: g.total };
}

// ---------- camara (una sola) ----------
const STAMPS = [T.cardSabor, T.cardRelleno, T.cardTamano, T.cardDiseno, T.card11, T.card06, T.card08, T.card04, T.endHit];
function camera(t) {
  let sx = 0, sy = 0;
  for (const ti of STAMPS) { const d = t - ti; if (d > 0 && d < 0.5) { const a = 7 * Math.exp(-d * 13); sx += a * Math.sin(d * 63); sy += a * Math.cos(d * 51); } }
  const drift = Math.sin(t * 0.6) * 6;
  let z = 1 + 0.012 * Math.sin(t * 0.45);
  z *= lerp(1, 1.035, smooth(prog(t, 17.2, 19.0)));            // respiro: acercamiento lento
  z *= lerp(1.06, 1, easeOut(prog(t, 0, 0.8)));                // golpe inicial
  return { x: drift + sx, y: sy, z, r: 0.004 * Math.sin(t * 0.37) };
}

// ---------- fondo: un solo campo liquido ----------
function background(t, cam) {
  ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
  const blobs = [
    [C.mint, 0.13, 260 + 120 * Math.sin(t * 0.31), 560 + 160 * Math.cos(t * 0.23), 640],
    [C.orchid, 0.10, 860 + 120 * Math.cos(t * 0.27), 1180 + 200 * Math.sin(t * 0.19), 700],
    [C.mint, 0.07, 640 + 200 * Math.sin(t * 0.17 + 2), 1650 + 90 * Math.cos(t * 0.29), 600],
    [C.orchid, 0.06, 200 + 80 * Math.cos(t * 0.21), 1400, 520],
  ];
  const burst = Math.exp(-Math.max(0, t - T.burst) * 4) * (t > T.burst - 0.05 ? 1 : 0);
  for (const [col, a, x, y, r] of blobs) {
    const rgb = col === C.mint ? '143,214,203' : '199,125,192';
    const g = ctx.createRadialGradient(x - cam.x * 0.4, y - cam.y * 0.4, 0, x - cam.x * 0.4, y - cam.y * 0.4, r);
    g.addColorStop(0, `rgba(${rgb},${a + burst * 0.08})`); g.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
  const v = ctx.createRadialGradient(W / 2, H * 0.48, H * 0.25, W / 2, H * 0.48, H * 0.75);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.45)');
  ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
}

// ---------- telefono ----------
const PW = 502, PHH = 1049, PR = 72, SCRW = 470, SCRH = 1017, SCR_R = 58, PT = SCRW / 390;
const phoneTrack = track([
  [3.00, { x: 540, y: 930, s: 0.92 }], [3.46, { x: 540, y: 990, s: 1 }], [5.95, { x: 540, y: 975, s: 1 }],
  [6.55, { x: 800, y: 1290, s: 0.5 }], [7.80, { x: 740, y: 1300, s: 0.5 }], [8.40, { x: 540, y: 1090, s: 0.78 }],
  [10.45, { x: 540, y: 1090, s: 0.78 }], [11.25, { x: 540, y: 960, s: 0.34 }], [13.85, { x: 540, y: 960, s: 0.34 }],
  [14.40, { x: 540, y: 1070, s: 0.92 }], [16.00, { x: 540, y: 1070, s: 0.92 }], [16.60, { x: 540, y: 820, s: 0.46 }],
  [17.10, { x: 540, y: 820, s: 0.46 }],
]);
function phoneAt(t) {
  const p = phoneTrack(t);
  p.rot = 0.02 * Math.sin(t * 0.9) * (t > 3.4 && t < 6 ? 1 : 0.5);
  return p;
}
const phoneOutline = (p, pad = 5) => rrectPts(p.x, p.y, (PW + pad * 2) * p.s, (PHH + pad * 2) * p.s, (PR + pad) * p.s);
const scrollTrack = track([
  [3.02, { v: 2330 }], [3.36, { v: 2521 }], [3.70, { v: 2521 }], [4.14, { v: 2819 }], [4.45, { v: 2819 }], [5.00, { v: 3270 }],
  [7.85, { v: 3270 }], [8.35, { v: 905 }], [13.85, { v: 905 }], [14.35, { v: 3682 }],
]);
const TAPS = [[T.tap1, MAN.taps[0]], [T.tap2, MAN.taps[1]], [T.tap3, MAN.taps[2]], [T.tapIdea, { x: MAN.idea.x + 60, y: MAN.idea.y + 20, w: 0, h: 0 }]];
function screenContent(t, scroll) {          // en puntos de la pagina (390 x 844)
  ctx.fillStyle = C.bg; ctx.fillRect(0, 0, 390, 844);
  ctx.save(); ctx.beginPath(); ctx.rect(0, 47, 390, 797); ctx.clip();
  ctx.translate(0, 47 - scroll);
  const top = scroll, bot = scroll + 797;
  ctx.drawImage(IMG.page, 0, top * 3, 1170, 797 * 3, 0, top, 390, 797);
  const ac = MAN.armaClip;
  let k = 0; if (t >= T.tap1) k = 1; if (t >= T.tap2) k = 2; if (t >= T.tap3) k = 3; if (t >= T.typeIdea[1]) k = 4;
  const a0 = Math.max(top, ac.y), a1 = Math.min(bot, ac.y + ac.height);
  if (a1 > a0) ctx.drawImage(IMG['arma' + k], 0, (a0 - ac.y) * 3, 1170, (a1 - a0) * 3, 0, a0, 390, a1 - a0);
  if (t >= T.typeIdea[0] && t < T.typeIdea[1]) {
    const n = MAN.typeSteps.length, i = Math.max(1, Math.min(n, Math.floor(prog(t, T.typeIdea[0], T.typeIdea[1]) * n) + 1));
    const tc = MAN.typeClip; ctx.drawImage(IMG['type' + i], tc.x, tc.y, tc.width, tc.height);
  }
  for (const [tt, r] of TAPS) {               // toque: halo que se abre
    const d = t - tt; if (d < -0.08 || d > 0.45) continue;
    const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
    const pre = clamp((d + 0.08) / 0.08), u = clamp(d / 0.45);
    ctx.save(); ctx.globalAlpha = d < 0 ? 0.5 * pre : 0.55 * (1 - u);
    ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.beginPath(); ctx.arc(cx, cy, d < 0 ? 16 : 16 + 26 * easeOut(u), 0, Math.PI * 2); ctx.fill(); ctx.restore();
  }
  ctx.restore();
  if (scroll > 1) ctx.drawImage(IMG.page, 0, 0, 1170, 67 * 3, 0, 47, 390, 67);     // barra superior fija (sticky)
  ctx.fillStyle = '#1D1D1F'; ctx.fillRect(0, 0, 390, 47);                       // barra de estado
  ctx.fillStyle = C.ink; ctx.font = `600 16px ${SANS}`; ctx.textBaseline = 'middle'; ctx.fillText('10:30', 36, 26);
  for (let i = 0; i < 4; i++) { const h = 4 + i * 2.4; ctx.fillRect(296 + i * 4.8, 31 - h, 3, h); }
  ctx.save(); ctx.lineCap = 'round'; ctx.strokeStyle = C.ink; ctx.lineWidth = 2;
  for (const r of [9.5, 6, 2.6]) { ctx.beginPath(); ctx.arc(325, 32, r, -Math.PI * 0.76, -Math.PI * 0.24); ctx.stroke(); }
  ctx.globalAlpha = 0.45; ctx.lineWidth = 1.1; ctx.beginPath(); rrPath(ctx, 337, 20, 24, 12, 3.5); ctx.stroke(); ctx.globalAlpha = 1;
  ctx.fillStyle = C.ink; ctx.beginPath(); rrPath(ctx, 339, 22, 17, 8, 2); ctx.fill(); ctx.restore();
  ctx.fillStyle = 'rgba(245,245,245,0.75)'; ctx.beginPath(); rrPath(ctx, 128, 832, 134, 5, 2.5); ctx.fill();
}
// clipShape: puntos (coordenadas de pantalla) para el contorno durante los morphs; si es null, rect redondeado normal
function drawPhone(t, p, clipShape = null, inner = null) {
  ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.scale(p.s, p.s);
  const body = (c) => rrPath(c, -PW / 2, -PHH / 2, PW, PHH, PR);
  if (!clipShape) {
    contactShadow(0, PHH / 2 + 30, PW * 0.62, 46, 0.9);
    slab(body, [7, 11], 5, '#050506', '#141416');
    ctx.beginPath(); body(ctx); ctx.fillStyle = '#060607'; ctx.fill();
    const g = ctx.createLinearGradient(-PW / 2, -PHH / 2, PW / 2, PHH / 2);
    g.addColorStop(0, '#d9d9dd'); g.addColorStop(0.25, '#5a5a60'); g.addColorStop(0.55, '#a7a7ae'); g.addColorStop(0.8, '#3a3a3f'); g.addColorStop(1, '#c5c5ca');
    ctx.lineWidth = 4; ctx.strokeStyle = g; ctx.stroke();
    ctx.fillStyle = '#3a3a3f';
    for (const [x, y, h] of [[-PW / 2 - 4, -300, 44], [-PW / 2 - 4, -220, 70], [-PW / 2 - 4, -130, 70], [PW / 2, -240, 110]]) { ctx.beginPath(); rrPath(ctx, x, y, 4, h, 2); ctx.fill(); }
  }
  ctx.save();
  if (clipShape) { ctx.restore(); ctx.restore(); ctx.save(); ctx.beginPath(); ctx.moveTo(clipShape[0][0], clipShape[0][1]); for (const q of clipShape) ctx.lineTo(q[0], q[1]); ctx.closePath(); ctx.fillStyle = '#060607'; ctx.fill(); ctx.clip(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.scale(p.s, p.s); }
  else { ctx.beginPath(); rrPath(ctx, -SCRW / 2, -SCRH / 2, SCRW, SCRH, SCR_R); ctx.clip(); }
  ctx.save(); ctx.translate(-SCRW / 2, -SCRH / 2); ctx.scale(PT, PT); screenContent(t, scrollTrack(t).v); ctx.restore();
  // isla dinamica y reflejo del cristal
  ctx.fillStyle = '#000'; ctx.beginPath(); rrPath(ctx, -62, -SCRH / 2 + 12, 124, 36, 18); ctx.fill();
  const sh = ctx.createLinearGradient(-SCRW / 2, -SCRH / 2, SCRW * 0.1, SCRH * 0.05);
  sh.addColorStop(0, 'rgba(255,255,255,0.09)'); sh.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = sh; ctx.fillRect(-SCRW / 2, -SCRH / 2, SCRW, SCRH);
  if (inner) inner();
  ctx.restore();
  if (!clipShape) ctx.restore();
}

// ---------- tarjetas isometricas (fichas del pedido) ----------
const ISO = 30 * Math.PI / 180;
const FICHAS = [
  { n: '01', w: 'SABOR', t: T.cardSabor, x: 250, y: 610, side: -1 },
  { n: '02', w: 'RELLENO', t: T.cardRelleno, x: 830, y: 815, side: 1 },
  { n: '03', w: 'TAMAÑO', t: T.cardTamano, x: 250, y: 1120, side: -1 },
  { n: '04', w: 'DISEÑO', t: T.cardDiseno, x: 830, y: 1330, side: 1 },
];
function ficha(f, t) {
  const fall = prog(t, f.t - 0.30, f.t);
  if (fall <= 0) return;
  const out = easeIn(prog(t, T.cardsOut[0] + FICHAS.indexOf(f) * 0.06, T.cardsOut[0] + FICHAS.indexOf(f) * 0.06 + 0.36));
  const land = t >= f.t ? spring((t - f.t) / 0.32, 14, 7) : 0;
  const h = (1 - easeIn(fall)) * 300;                     // altura sobre su sombra
  const squash = t >= f.t ? 1 - 0.07 * Math.exp(-(t - f.t) * 16) * Math.cos((t - f.t) * 40) : 1;
  const x = f.x + out * f.side * 520, y = f.y - h - out * 260;
  const cw = 390, chh = 126;
  const a = [Math.cos(ISO), f.side < 0 ? -Math.sin(ISO) : Math.sin(ISO)];
  const s = (1 + 0.12 * (1 - easeIn(fall))) * (1 - 0.6 * out);
  contactShadow(f.x + out * f.side * 520, f.y + chh * 0.55, 230 * (0.55 + 0.45 * easeIn(fall)), 34, (0.35 + 0.65 * easeIn(fall)) * (1 - out));
  ctx.save(); ctx.translate(x, y); ctx.transform(a[0] * s, a[1] * s, 0, s * squash, 0, 0);
  const shape = (c) => rrPath(c, -cw / 2, -chh / 2, cw, chh, 26);
  ctx.restore();
  const M = [a[0] * s, a[1] * s, 0, s * squash, x, y];
  const D = f.side < 0 ? [10, 14] : [-10, 14];
  ctx.save(); ctx.transform(...M);
  const Dl = [(D[0] / M[0]) * 0, D[1] / M[3]];          // grosor hacia abajo (en el plano local)
  slab(shape, [Dl[0], Dl[1]], 6, 'rgba(10,22,20,0.95)', 'rgba(60,120,112,0.55)');
  ctx.restore();
  snap(t);
  ctx.save(); ctx.transform(...M);
  glass(shape, { tint: 'rgba(143,214,203,0.10)', bounds: [-cw / 2, -chh / 2, cw, chh] });
  ctx.font = `600 26px ${SANS}`; ctx.fillStyle = C.mint; ctx.textBaseline = 'middle'; ctx.fillText(f.n, -cw / 2 + 30, 2);
  ctx.fillStyle = 'rgba(143,214,203,0.5)'; ctx.fillRect(-cw / 2 + 76, -22, 1.5, 44);
  word(f.w, -cw / 2 + 100, 22, { font: `600 64px ${SERIF}`, size: 64, track: 7, align: 'left', style: 'pop', stagger: 0.02 }, f.t - 0.05);
  ctx.restore();
}

// ---------- paneles de foto de cristal (con grosor y reflejo) ----------
function photoPanel(img, cx, cy, w, h, o = {}) {
  const r = o.r ?? 26, rot = o.rot || 0, skew = o.skew || 0, sxk = o.sx ?? 1;
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot); ctx.transform(sxk, skew, 0, 1, 0, 0);
  const shape = (c) => rrPath(c, -w / 2, -h / 2, w, h, r);
  slab(shape, o.D || [8, 14], 6, 'rgba(8,10,10,0.9)', 'rgba(143,214,203,0.30)');
  ctx.save(); ctx.beginPath(); shape(ctx); ctx.clip();
  if (img) drawCover(ctx, img, -w / 2, -h / 2, w, h);
  const sweep = o.sweep ?? 0.5;                              // reflejo que cruza el cristal
  const g = ctx.createLinearGradient(-w / 2 - w + sweep * 2.2 * w, -h / 2, -w / 2 + sweep * 2.2 * w, h / 2);
  g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,255,255,0.16)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(-w / 2, -h / 2, w, h);
  const e = ctx.createLinearGradient(0, -h / 2, 0, h / 2); e.addColorStop(0, 'rgba(255,255,255,0.10)'); e.addColorStop(0.2, 'rgba(255,255,255,0)');
  ctx.fillStyle = e; ctx.fillRect(-w / 2, -h / 2, w, h);
  ctx.restore();
  ctx.beginPath(); shape(ctx); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,255,255,0.38)'; ctx.stroke();
  ctx.restore();
}
// tarjeta de cristal con foto dentro (escena de cupcakes y galletas)
function glassCard(t, img, cx, cy, w, h, o = {}) {
  const pad = o.pad ?? 18;
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(o.rot || 0); ctx.scale(o.s ?? 1, o.s ?? 1);
  const shape = (c) => rrPath(c, -w / 2, -h / 2, w, h, 34);
  slab(shape, [8, 16], 6, 'rgba(8,12,12,0.92)', 'rgba(143,214,203,0.28)');
  snap(t);
  glass(shape, { tint: 'rgba(255,255,255,0.09)', marble: 0.07, bounds: [-w / 2, -h / 2, w, h] });
  const iw = w - pad * 2, ih = h - pad * 2;
  ctx.save(); ctx.beginPath(); rrPath(ctx, -iw / 2, -ih / 2, iw, ih, 22); ctx.clip();
  if (img) drawCover(ctx, img, -iw / 2, -ih / 2, iw, ih);
  const g = ctx.createLinearGradient(-iw, -ih / 2, iw * (o.sweep ?? 0.5) * 2, ih / 2);
  g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.6, 'rgba(255,255,255,0.13)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(-iw / 2, -ih / 2, iw, ih); ctx.restore();
  ctx.beginPath(); rrPath(ctx, -iw / 2, -ih / 2, iw, ih, 22); ctx.lineWidth = 1.2; ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.stroke();
  ctx.restore();
}

// ---------- escena 6-8: paneles en profundidad ----------
function dollyAt(t) { return easeInOut(prog(t, 5.95, 8.25)); }
const PANELS = [
  { img: 'p03', z: 2.1, x: 1060, y: 760, w: 250, h: 333, rot: 0.05 },
  { img: 'p01', z: 1.5, x: 1150, y: 1235, w: 300, h: 400, rot: -0.04 },
  { img: 'p07', z: 1.0, x: 1420, y: 930, w: 520, h: 516, rot: 0.03 },
];
function panelPos(pn, t) {
  const d = dollyAt(t);
  const travel = 1250 / pn.z;
  return { x: pn.x - d * travel, y: pn.y + Math.sin(t * 1.3 + pn.z) * 8 };
}

// ---------- escena 8-10.5: orbita ----------
const ORB = { cx: 540, cy: 1150, rx: 455, ry: 150 };
const ORBIT = [
  { img: 'p05', a0: 0.35, slot: 1 }, { img: 'p10', a0: 0.35 + Math.PI / 2, slot: 6 },
  { img: 'p09', a0: 0.35 + Math.PI, slot: 0 }, { img: 'p07', a0: 0.35 + Math.PI * 1.5, slot: 3 },
];
function orbitState(o, t) {
  const th = o.a0 + 0.62 * (t - 8.0);
  const enter = easeOut(prog(t, 7.75, 8.45));
  const rad = lerp(2.3, 1, enter);
  const x = ORB.cx + ORB.rx * rad * Math.cos(th), y = ORB.cy + ORB.ry * rad * Math.sin(th) - 120;
  const depth = Math.sin(th);
  const s = 0.78 + 0.24 * depth;
  return { th, x, y, depth, s };
}
function orbitPts(t) {             // empieza a la izquierda (pi), pasa por atras (sin<0) y luego por delante
  const p = []; for (let i = 0; i < N; i++) { const a = Math.PI + (2 * Math.PI * i) / (N - 1); p.push([ORB.cx + ORB.rx * Math.cos(a), ORB.cy + 30 + ORB.ry * Math.sin(a)]); } return p;
}
function slotRect(p, slot, scroll) {      // rect en pantalla de un hueco de la galeria dentro del telefono
  const g = MAN.gridItems[slot];
  const lx = -SCRW / 2 + g.x * PT, ly = -SCRH / 2 + (47 + g.y - scroll) * PT;
  return { x: p.x + lx * p.s + (g.w * PT * p.s) / 2, y: p.y + ly * p.s + (g.h * PT * p.s) / 2, w: g.w * PT * p.s, h: g.h * PT * p.s };
}

// ---------- escena 10.5-14: surtido ----------
const SURT = [
  { img: 'p11', t: T.card11, x: 540, y: 960, w: 560, h: 580, from: [0, 1100], rot: -0.03 },
  { img: 'p04b', t: T.card04, x: 540, y: 1420, w: 230, h: 290, from: [0, 800], rot: 0.02, back: true },
  { img: 'p06', t: T.card06, x: 300, y: 1335, w: 390, h: 410, from: [-800, 300], rot: -0.07 },
  { img: 'p08', t: T.card08, x: 780, y: 1355, w: 390, h: 410, from: [800, 300], rot: 0.06 },
];
function surtState(c, t, i) {
  const u = (t - (c.t - 0.30)) / 0.55;
  if (u <= 0) return null;
  const sp = spring(u, 9, 6.5);
  const out = easeIn(prog(t, T.surtidoOut[0] + i * 0.05, T.surtidoOut[0] + i * 0.05 + 0.38));
  return { x: c.x + c.from[0] * (1 - sp) + (c.x - 540) * 1.8 * out, y: c.y + c.from[1] * (1 - sp) + 900 * out, rot: c.rot * (1 + (1 - sp) * 4), s: 1 - 0.3 * out, sp };
}

// ---------- WhatsApp ----------
const BTN = { x: 540, y: 1415, w: 840, h: 168 };
function waIcon(x, y, r, col) {
  ctx.save(); ctx.translate(x, y); ctx.scale(r / 12, r / 12); ctx.translate(-12, -12);
  ctx.fillStyle = col;
  ctx.fill(new Path2D('M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2c-1.5 0-3-.4-4.3-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2c0 1.3.9 2.5 1 2.7.1.2 1.8 2.8 4.4 3.9 1.6.7 2.3.8 3.1.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.1-1.2l-.6-.3Z'));
  ctx.restore();
}
function btnState(t, p) {
  // de su lugar real en la pagina (boton de la seccion de pedido) a primer plano, y de regreso
  const g = MAN.waOrder, scroll = 3682;
  const lx = -SCRW / 2 + (g.x + g.w / 2) * PT, ly = -SCRH / 2 + (47 + g.y + g.h / 2 - scroll) * PT;
  const src = { x: p.x + lx * p.s, y: p.y + ly * p.s, w: g.w * PT * p.s, h: g.h * PT * p.s };
  const up = easeInOut(prog(t, T.btnLift[0], T.btnLift[1])) * (1 - easeInOut(prog(t, T.btnBack[0], T.btnBack[1])));
  const press = t > T.btnPress ? 1 - 0.05 * Math.exp(-(t - T.btnPress) * 9) * Math.cos((t - T.btnPress) * 22) : 1;
  return { up, x: lerp(src.x, BTN.x, up), y: lerp(src.y, BTN.y, up), w: lerp(src.w, BTN.w, up) * press, h: lerp(src.h, BTN.h, up) * press };
}

// ---------- la linea en cada momento ----------
function lineAt(t, ph) {
  const ring1 = ringPts(SW.cx, SW.cy, 291);
  if (t < T.swirlDraw[0]) return null;
  if (t < T.swirlToRing[0]) return { pts: SWIRL, a: 0, b: easeInOut(prog(t, ...T.swirlDraw)), w: 15, glow: 1 };
  if (t < T.ringToPhone[0]) return { pts: morph(SWIRL, ring1, prog(t, ...T.swirlToRing), t), a: 0, b: 1, w: lerp(15, 11, prog(t, ...T.swirlToRing)), glow: 1 };
  if (t < 5.95) {
    const po = phoneOutline(ph);
    if (t < T.ringToPhone[1]) return { pts: morph(ring1, po, prog(t, ...T.ringToPhone), t, 0.25, 22), a: 0, b: 1, w: 11, glow: 0.8 };
    return { pts: po, a: 0, b: 1, w: 8 + 3 * pulse(t), glow: 0.6 };
  }
  const rib = ribbonPts(t);
  if (t < 6.45) return { pts: morph(phoneOutline(ph), rib, prog(t, 5.95, 6.45), t, 0.35, 26), a: 0, b: 1, w: 10, glow: 0.6 };
  if (t < T.toOrbit[0]) return { pts: rib, a: 0, b: 1, w: 10, glow: 0.6 };
  const orb = orbitPts(t);
  if (t < T.toOrbit[1]) return { pts: morph(rib, orb, prog(t, ...T.toOrbit), t, 0.3, 24), a: 0, b: 1, w: 10, glow: 0.6 };
  if (t < T.toGallery[0]) return { pts: orb, a: 0, b: 1, w: 10, glow: 0.6, split: true };
  const po = phoneOutline(ph);
  if (t < T.toGallery[1]) return { pts: morph(orb, po, prog(t, ...T.toGallery), t, 0.3, 20), a: 0, b: 1, w: 9, glow: 0.6 };
  const c11 = cardOutline(SURT[0], t, 0), c06 = cardOutline(SURT[2], t, 2);
  if (t < 11.25) return { pts: po, a: 0, b: 1, w: 8, glow: 0.5 };
  if (t < T.card11 + 0.1) return { pts: morph(po, c11, prog(t, 11.25, T.card11 + 0.1), t, 0.3, 18), a: 0, b: 1, w: 9, glow: 0.6 };
  if (t < 12.05) return { pts: c11, a: 0, b: 1, w: 9 + 3 * pulse(t), glow: 0.6 };
  if (t < T.card06 + 0.1) return { pts: morph(c11, c06, prog(t, 12.05, T.card06 + 0.1), t, 0.3, 18), a: 0, b: 1, w: 9, glow: 0.6 };
  const ul = linePts(170, 910, 565, 10);
  if (t < 12.95) return { pts: c06, a: 0, b: 1, w: 9 + 3 * pulse(t), glow: 0.6 };
  if (t < 13.35) return { pts: morph(c06, ul, prog(t, 12.95, 13.35), t, 0.3, 18), a: 0, b: 1, w: 9, glow: 0.6 };
  const bs = btnState(t, ph);
  const bul = linePts(BTN.x - 300, BTN.x + 300, BTN.y + BTN.h / 2 + 44, 0);
  if (t < 13.85) return { pts: ul, a: 0, b: 1, w: 9 + 3 * pulse(t), glow: 0.6 };
  if (t < T.btnLift[1]) return { pts: morph(ul, linePts(bs.x - bs.w * 0.36, bs.x + bs.w * 0.36, bs.y + bs.h / 2 + 44 * bs.up, 0), prog(t, 13.85, T.btnLift[1]), t, 0.3, 18), a: 0, b: 1, w: 9, glow: 0.6 };
  if (t < T.btnBack[0]) return { pts: bul, a: 0, b: 1, w: 9 + 7 * pulse(t, T.pulses), glow: 0.6 + 0.8 * pulse(t, T.pulses) };
  if (t < T.phoneToRing[0]) return { pts: morph(bul, phoneOutline(ph), prog(t, T.btnBack[0], T.phoneToRing[0]), t, 0.3, 18), a: 0, b: 1, w: 9, glow: 0.6 };
  const ring2 = ringPts(540, 820, 233);
  if (t < T.phoneToRing[1]) return { pts: morph(phoneOutline(ph), ring2, prog(t, ...T.phoneToRing), t, 0.25, 16), a: 0, b: 1, w: 9, glow: 0.6 };
  const end = linePts(220, 860, 1000, 0);
  if (t < 18.95) return { pts: ring2, a: 0, b: 1, w: 9, glow: 0.5 + 0.2 * Math.sin(t * 2) };
  if (t < 19.08) return { pts: ring2, a: easeIn(prog(t, 18.95, 19.08)), b: 1, w: 9, glow: 0.8 };
  if (t < 19.5) return { pts: end, a: 0, b: easeOut(prog(t, 19.02, 19.5)), w: 10, glow: 1 };
  return { pts: end, a: 0, b: 1, w: 10 + 2 * pulse(t, [20.32]), glow: 0.7 };
}
function pulse(t, list = [3.5, 4.0, 4.5, 5.0, 5.5, 11.5, 12.0, 12.5, 13.0, 13.5]) {
  let v = 0; for (const p of list) { const d = t - p; if (d >= 0 && d < 0.6) v = Math.max(v, Math.exp(-d * 9)); } return v;
}
function ribbonPts(t) {
  const pp = PANELS.map((pn) => panelPos(pn, t));
  return curvePts([[-160, 1560], [pp[1].x - 120, pp[1].y + 160], [pp[2].x - 60, pp[2].y + 300], [pp[0].x, pp[0].y + 210], [pp[2].x + 330, pp[2].y - 80], [1260, 640]]);
}
function cardOutline(c, t, i) {
  const s = surtState(c, Math.max(t, c.t + 0.6), i) || { x: c.x, y: c.y, s: 1 };
  return rrectPts(c.x, c.y, c.w + 26, c.h + 26, 44);
}

// ---------- el cuadro ----------
let t_ = 0;
function frame(t) {
  t_ = t; snapT = -1;
  ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
  ctx.globalAlpha = 1; ctx.filter = 'none';
  const cam = camera(t);
  background(t, cam);
  ctx.save();
  ctx.translate(W / 2, H / 2); ctx.scale(cam.z, cam.z); ctx.rotate(cam.r); ctx.translate(-W / 2 + cam.x, -H / 2 + cam.y);
  const ph = phoneAt(t);
  const L = lineAt(t, ph);

  // --- 0-0.5: la linea cruza y estalla ---
  if (t < 1.1) {
    const s0 = SWIRL[0];
    const path = curvePts([[-260, 1780], [120, 1500], [260, 1180], s0]);
    const u = easeOut(prog(t, -0.32, T.streak[1]));
    const tail = easeIn(prog(t, 0.05, T.burst + 0.06));
    if (t < T.burst + 0.08) frosting(path, Math.max(0, tail * 1.02 - 0.02), u, 22, 1.4);
    const d = t - T.burst;
    if (d > 0 && d < 0.7) {
      const e = easeOut(clamp(d / 0.55));
      ctx.save(); ctx.strokeStyle = C.mint; ctx.lineWidth = 14 * (1 - e) + 0.5; ctx.beginPath(); ctx.arc(s0[0], s0[1], 30 + 420 * e, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
      seed = 99;
      for (let i = 0; i < 22; i++) {
        const a = (i / 22) * Math.PI * 2 + rnd() * 0.3, sp = 260 + rnd() * 420, r = 5 + rnd() * 8;
        const dd = sp * easeOut(clamp(d / 0.6)), rr = r * (1 - clamp(d / 0.65));
        if (rr <= 0.3) continue;
        const x = s0[0] + Math.cos(a) * dd, y = s0[1] + Math.sin(a) * dd + 140 * d * d;
        ctx.fillStyle = i % 5 === 0 ? C.orchid : C.mint; ctx.beginPath(); ctx.arc(x, y, rr, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(236,255,251,0.8)'; ctx.beginPath(); ctx.arc(x - rr * 0.3, y - rr * 0.3, rr * 0.3, 0, Math.PI * 2); ctx.fill();
      }
    }
  }

  // --- 2-3.5: el logo oficial dentro del aro ---
  if (t >= T.logoReveal[0] && t < T.ringToPhone[1] + 0.05) {
    const rv = easeInOut(prog(t, ...T.logoReveal));
    const fly = easeInOut(prog(t, ...T.logoToHeader));
    // destino: el logo de la barra superior de la pagina dentro del telefono
    const hx0 = ph.x + (-SCRW / 2 + (20 + 19) * PT) * ph.s, hy0 = ph.y + (-SCRH / 2 + (47 + 33.5) * PT) * ph.s;
    const R = lerp(300, 19 * PT * ph.s, fly), x = lerp(SW.cx, hx0, fly), y = lerp(SW.cy, hy0, fly);
    if (t < T.ringToPhone[0]) {
      contactShadow(SW.cx, SW.cy + 330, 260, 40, rv);
      ctx.save(); ctx.beginPath(); ctx.arc(x, y, R * rv, 0, Math.PI * 2); ctx.clip();
      ctx.drawImage(IMG.logo, x - R, y - R, 2 * R, 2 * R); ctx.restore();
    }
    logoFly = fly < 1 && t >= T.ringToPhone[0] ? { x, y, R } : null;
  } else logoFly = null;

  // --- 3-6.4: foto 02 de heroe detras, desenfocada ---
  if (t >= T.heroIn[0] && t < T.heroOut[1]) {
    const r = easeOut(prog(t, ...T.heroIn)) * (1 - easeInOut(prog(t, ...T.heroOut)));
    ctx.save(); ctx.beginPath(); ctx.arc(ph.x, ph.y, 1500 * r, 0, Math.PI * 2); ctx.clip();
    ctx.drawImage(heroC, -40, -60, W + 80, H + 120); ctx.restore();
  }

  // --- 6-8: paneles lejanos antes que el telefono ---
  const panelsOn = t > 5.9 && t < 8.6;
  const drawPanel = (pn) => {
    const pp = panelPos(pn, t);
    if (pp.x < -500) return;
    const isO7 = pn.img === 'p07';
    if (isO7 && t > 7.75) return;           // la 07 sigue en la orbita
    photoPanel(IMG[pn.img], pp.x, pp.y, pn.w, pn.h, { rot: pn.rot, skew: -0.05 / pn.z, D: [10 / pn.z, 16 / pn.z], sweep: dollyAt(t) * 1.4 - 0.2 });
    contactShadow(pp.x, pp.y + pn.h / 2 + 50 / pn.z, pn.w * 0.42, 22, 0.6);
  };
  if (panelsOn) drawPanel(PANELS[0]);

  // --- 8-10.5: orbita (parte de atras) ---
  const orbOn = t > 7.75 && t < T.toGallery[1];
  const orbitDraw = (front) => {
    for (const o of ORBIT) {
      const st = orbitState(o, t);
      if ((st.depth >= 0) !== front) continue;
      const img = IMG[o.img], asp = img.width / img.height;
      let w = 300 * st.s * Math.min(1, asp), h = 300 * st.s / Math.max(1, asp);
      let x = st.x, y = st.y, skew = -0.22 * Math.cos(st.th), sx = 0.82 + 0.18 * Math.abs(Math.sin(st.th)), r = 26;
      const g = easeInOut(prog(t, T.toGallery[0] + ORBIT.indexOf(o) * 0.04, T.toGallery[1]));
      if (g > 0) {
        const sr = slotRect(ph, o.slot, 905);
        x = lerp(x, sr.x, g); y = lerp(y, sr.y, g); w = lerp(w, sr.w, g); h = lerp(h, sr.h, g);
        skew *= 1 - g; sx = lerp(sx, 1, g); r = lerp(26, 18 * PT * ph.s, g);
        if (g >= 1) continue;
      }
      contactShadow(x, ORB.cy + 30 + ORB.ry * Math.sin(st.th) + 20, w * 0.45, 18, 0.7 * (1 - g));
      photoPanel(img, x, y, w, h, { skew, sx, r, D: [8 * st.s * (1 - g), 13 * st.s * (1 - g) + 0.01], sweep: (st.th / (Math.PI * 2)) % 1 });
    }
  };
  if (L && L.split && orbOn) frosting(L.pts, 0, 0.5, L.w, L.glow);
  if (orbOn) orbitDraw(false);

  // --- surtido: la 04 pequena va detras ---
  const surtOn = t > 11.0 && t < 14.4;

  // --- el telefono ---
  const phoneOn = t >= T.ringToPhone[0] && t < T.phoneToRing[1];
  if (phoneOn) {
    let clip = null;
    if (t < T.ringToPhone[1]) clip = morph(ringPts(SW.cx, SW.cy, 291), phoneOutline(ph, 0), prog(t, ...T.ringToPhone), t, 0.25, 22);
    else if (t >= T.phoneToRing[0]) clip = morph(phoneOutline(ph, 0), ringPts(540, 820, 226), prog(t, ...T.phoneToRing), t, 0.25, 16);
    drawPhone(t, ph, clip, () => {
      if (t >= T.logoIn[0]) {       // el logo vuelve a ocupar el aro
        const k = easeInOut(prog(t, ...T.logoIn)), R = 226 / ph.s;
        ctx.save(); ctx.beginPath(); ctx.arc(0, 0, R * k * 1.05, 0, Math.PI * 2); ctx.clip();
        ctx.drawImage(IMG.logo, -R, -R, 2 * R, 2 * R); ctx.restore();
      }
    });
    if (logoFly) { ctx.save(); ctx.beginPath(); ctx.arc(logoFly.x, logoFly.y, logoFly.R, 0, Math.PI * 2); ctx.clip(); ctx.drawImage(IMG.logo, logoFly.x - logoFly.R, logoFly.y - logoFly.R, 2 * logoFly.R, 2 * logoFly.R); ctx.restore(); }
  }
  // el logo final (despues del morph) y su salida al end card
  if (t >= T.phoneToRing[1] && t < T.endOut[1]) {
    const out = easeIn(prog(t, ...T.endOut));
    const R = 226 * (1 - out);
    if (R > 1) { contactShadow(540, 820 + 270, 220, 30, 1 - out); ctx.save(); ctx.beginPath(); ctx.arc(540, 820, R, 0, Math.PI * 2); ctx.clip(); ctx.drawImage(IMG.logo, 540 - R, 820 - R, 2 * R, 2 * R); ctx.restore(); }
  }

  if (panelsOn) { drawPanel(PANELS[1]); }
  if (orbOn) orbitDraw(true);

  // --- 3-6: fichas isometricas ---
  if (t > 3.0 && t < 6.5) for (const f of FICHAS) ficha(f, t);
  if (panelsOn) drawPanel(PANELS[2]);

  // --- 10.5-14: cupcakes y galletas ---
  if (surtOn) {
    SURT.forEach((c, i) => {
      const st = surtState(c, t, i); if (!st) return;
      const img = c.img === 'p04b' ? p04C : IMG[c.img];
      contactShadow(st.x, c.y + c.h / 2 + 34, c.w * 0.5, 30, clamp(st.sp));
      glassCard(t, img, st.x, st.y, c.w, c.h, { rot: st.rot, s: st.s, sweep: prog(t, c.t - 0.2, c.t + 1.4) });
    });
  }

  // --- 14-16: letrero y boton de WhatsApp ---
  if (t > 13.9 && t < 16.4) {
    const sg = spring(prog(t, 14.05, 14.7) * 1.6, 9, 6) * (1 - easeIn(prog(t, 15.8, 16.15)));
    if (sg > 0.01) {
      const sw = 640, shh = 100, sx = 540, sy = 430 - (1 - sg) * 60;
      ctx.save(); ctx.translate(sx, sy); ctx.scale(sg, sg);
      const shape = (c) => rrPath(c, -sw / 2, -shh / 2, sw, shh, 50);
      slab(shape, [0, 12], 5, 'rgba(10,10,12,0.9)', 'rgba(199,125,192,0.35)');
      snap(t); glass(shape, { tint: 'rgba(199,125,192,0.14)', bounds: [-sw / 2, -shh / 2, sw, shh] });
      ctx.font = `600 34px ${SANS}`; ctx.letterSpacing = '9px'; ctx.fillStyle = C.ink; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('ÚNICAMENTE POR PEDIDO', 5, 2); ctx.letterSpacing = '0px'; ctx.restore();
    }
    const b = btnState(t, ph);
    if (b.up > 0.002) {
      ctx.save(); ctx.translate(b.x, b.y);
      const shape = (c) => rrPath(c, -b.w / 2, -b.h / 2, b.w, b.h, b.h / 2);
      contactShadow(0, b.h / 2 + 30 * b.up, b.w * 0.45, 26 * b.up + 1, b.up);
      slab(shape, [0, 16 * b.up], 6, 'rgba(10,30,26,0.95)', 'rgba(143,214,203,0.55)');
      snap(t); glass(shape, { tint: 'rgba(143,214,203,0.86)', marble: 0.03, bounds: [-b.w / 2, -b.h / 2, b.w, b.h] });
      const k = b.w / BTN.w;
      ctx.scale(k, k);
      waIcon(-BTN.w / 2 + 92, 0, 40 * spring(prog(t, 14.05, 14.5) * 1.4, 11, 6), '#16302C');
      const o = { font: `600 54px ${SANS}`, size: 54, track: 5, align: 'left', style: 'swing', color: '#16302C' };
      let x = -BTN.w / 2 + 160;
      const ws = [['PIDE', wt('L6', 0)], ['POR', wt('L6', 1)], ['WHATSAPP', wt('L6', 2)]];
      for (const [w, tw] of ws) { const r = word(w, x, 19, o, tw, T.btnBack[0]); x += r.w + 22; }
      ctx.restore();
    }
  }

  // --- la linea (por delante de todo lo demas) ---
  if (L) { if (L.split && orbOn) frosting(L.pts, 0.5, 1, L.w, L.glow); else frosting(L.pts, L.a, L.b, L.w, L.glow); }

  // --- tipografia cinetica ---
  // 0.5-2: TU IDEA, / HECHA PASTEL.
  if (t > 0.3 && t < 2.4) {
    const o1 = { font: `600 118px ${SERIF}`, size: 118, track: 14, style: 'drop' };
    word('TU', 330, 1390, o1, wt('L1', 0), T.textOut1[0]);
    word('IDEA,', 650, 1390, { ...o1, color: C.mint }, wt('L1', 1), T.textOut1[0] + 0.05);
    const o2 = { font: `600 86px ${SERIF}`, size: 86, track: 12, style: 'rise' };
    word('HECHA', 540, 1510, o2, wt('L1', 2), T.textOut1[0] + 0.08);
    word('PASTEL.', 540, 1612, { ...o2, style: 'track' }, wt('L1', 3), T.textOut1[0] + 0.12);
  }
  // 6-8: CUÉNTANOS / TU DISEÑO
  if (t > 5.9 && t < 8.1) {
    word('CUÉNTANOS', 540, 450, { font: `600 104px ${SERIF}`, size: 104, track: 10, style: 'rise', shadow: true }, wt('L3', 1), 7.72);
    word('TU', 330, 572, { font: `500 italic 86px ${SERIF}`, size: 86, track: 4, style: 'drop', color: C.mint, shadow: true }, wt('L3', 2), 7.76);
    word('DISEÑO', 600, 572, { font: `600 86px ${SERIF}`, size: 86, track: 10, style: 'swing', shadow: true }, wt('L3', 3), 7.8);
  }
  // 8-10.5: IMAGINA / EN TU PÁGINA
  if (t > 7.95 && t < 10.9) {
    word('IMAGINA', 540, 430, { font: `600 108px ${SERIF}`, size: 108, track: 16, style: 'track', shadow: true }, wt('L4', 0), 10.42);
    word('EN TU', 352, 552, { font: `500 italic 82px ${SERIF}`, size: 82, track: 3, style: 'rise', color: C.mint, shadow: true }, wt('L4', 3), 10.46);
    word('PÁGINA', 702, 552, { font: `600 82px ${SERIF}`, size: 82, track: 10, style: 'pop', shadow: true }, wt('L4', 6), 10.5);
  }
  // 10.75-14: PASTELES · CUPCAKES / GALLETAS · POSTRES
  if (t > 10.5 && t < 14.3) {
    const o = { font: `600 74px ${SERIF}`, size: 74, track: 8, shadow: true };
    const pairRow = (w1, w2, y, s1, s2, t1, t2, tdot, dotCol, out) => {
      const g1 = glyphs(w1, o.font, o.track), g2 = glyphs(w2, o.font, o.track), gd = glyphs('·', o.font, 0), gap = 26;
      const tot = g1.total + gd.total + g2.total + 2 * gap, x = 540 - tot / 2;
      word(w1, x, y, { ...o, align: 'left', style: s1, color: s1 === 'swing' ? C.mint : C.ink }, t1, out);
      word('·', x + g1.total + gap, y, { ...o, align: 'left', style: 'pop', color: dotCol }, tdot, out + 0.02);
      word(w2, x + g1.total + gd.total + 2 * gap, y, { ...o, align: 'left', style: s2, color: s2 === 'rise' ? C.mint : C.ink }, t2, out + 0.04);
    };
    pairRow('PASTELES', 'CUPCAKES', 440, 'drop', 'rise', wt('L5', 0), wt('L5', 1), wt('L5', 1) - 0.1, C.mint, 13.62);
    pairRow('GALLETAS', 'POSTRES', 540, 'swing', 'track', wt('L5', 2), wt('L5', 4), wt('L5', 4) - 0.1, C.orchid, 13.68);
  }
  // 16.4-19: ADARA PASTELERÍA / COYOACÁN, CDMX
  if (t > 16.2 && t < 19.2) {
    const on = { font: `600 74px ${SERIF}`, size: 74, track: 12 };
    const ga = glyphs('ADARA', on.font, on.track), gp = glyphs('PASTELERÍA', on.font, on.track), xa = 540 - (ga.total + 34 + gp.total) / 2;
    word('ADARA', xa, 1240, { ...on, align: 'left', style: 'track' }, wt('L7', 0), T.endOut[0]);
    word('PASTELERÍA', xa + ga.total + 34, 1240, { ...on, align: 'left', style: 'rise' }, wt('L7', 1), T.endOut[0] + 0.04);
    word('COYOACÁN, CDMX', 540, 1350, { font: `500 38px ${SANS}`, size: 38, track: 12, style: 'pop', color: C.mint }, wt('L7', 2), T.endOut[0] + 0.08);
  }
  // 19-22: end card (oferta de Elevate Negocios)
  if (t > 18.95) {
    word('PRECIOS ACCESIBLES', 540, 610, { font: `600 36px ${SANS}`, size: 36, track: 12, style: 'track', color: C.mint }, 19.06);
    word('Tu página', 540, 790, { font: `600 112px ${SERIF}`, size: 112, track: 2, style: 'rise' }, wt('L8', 1));
    word('desde', 300, 950, { font: `500 italic 82px ${SERIF}`, size: 82, track: 2, style: 'rise', color: C.mute }, wt('L8', 2));
    word('$1,000', 570, 950, { font: `700 112px ${SERIF}`, size: 112, track: 3, style: 'pop', color: C.ink }, wt('L8', 3));
    word('pesos', 830, 950, { font: `500 italic 82px ${SERIF}`, size: 82, track: 2, style: 'rise', color: C.mute }, wt('L8', 4));
    word('Paquete de 3 videos promocionales:', 540, 1150, { font: `500 42px ${SANS}`, size: 42, track: 1, style: 'rise', color: C.ink }, 20.45);
    word('$1,500', 540, 1240, { font: `700 76px ${SERIF}`, size: 76, track: 3, style: 'pop', color: C.mint }, 20.62);
    word('ELEVATE NEGOCIOS · AGUASCALIENTES', 540, 1400, { font: `600 31px ${SANS}`, size: 31, track: 7, style: 'track', color: C.ink }, 20.78);
    word('Demo de cortesía de Elevate Negocios · pieza no oficial', 540, 1530, { font: `400 30px ${SANS}`, size: 30, track: 1, style: 'rise', color: '#A4A4AA', stagger: 0.006 }, 19.25);
  }
  ctx.restore();

  // grano de pelicula (fijo por cuadro)
  ctx.save(); ctx.globalAlpha = 0.035; ctx.translate((Math.floor(t * 60) * 37) % 256, (Math.floor(t * 60) * 71) % 256);
  ctx.fillStyle = noisePat; ctx.fillRect(-256, -256, W + 512, H + 512); ctx.restore();
  if (SAFE) {
    ctx.fillStyle = 'rgba(255,0,0,0.18)'; ctx.fillRect(0, 0, W, 250); ctx.fillRect(0, H - 340, W, 340);
  }
}
let logoFly = null;

window.renderFrame = (f) => {
  vctx.globalAlpha = 1; vctx.globalCompositeOperation = 'source-over';
  for (let k = 0; k < SUBS; k++) {
    const off = SUBS > 1 ? ((k + 0.5) / SUBS - 0.5) * 0.5 : 0;     // obturador de 180 grados
    frame(Math.max(0, (f + off) / TL.FPS));
    vctx.globalAlpha = 1 / (k + 1);
    vctx.drawImage(work, 0, 0);
  }
  vctx.globalAlpha = 1;
};
window.frameAt = (t) => { frame(t); vctx.globalAlpha = 1; vctx.drawImage(work, 0, 0); };
window.ready = true;
