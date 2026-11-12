// Compositor de Chato Cafecito: frame(t) determinista. Un solo plano, un solo campo líquido, una sola cámara.
// 8 subcuadros por cuadro (motion blur). Todo es código: vaso, capas, página, mapa y teléfono.
import { makeLiquid } from './liquid.mjs';

const Q = new URLSearchParams(location.search);
const FMT = Q.get('format') || '916';
const SUBS = Number(Q.get('subs') || 8);
const SC = Number(Q.get('scale') || 1);
const TL = await (await fetch('../timeline/timeline.json')).json();
const F = TL.F;
const W = 1080, H = FMT === '11' ? 1080 : 1920;
const V = FMT === '11';

// ---------- layout por formato (re-layout real, no recorte) ----------
const L = V ? {
  T0: 50, P: 1040, cup: { cx: 540, top: 300, bot: 900, rT: 205, rB: 154, tilt: 0.16 },
  cup2: { cx: 540, top: 150, bot: 690, rT: 188, rB: 142, tilt: 0.16 },
  enBase: 250, enSize: 130, capsBase: 560, capsSize: 290, nameBase: 900, nameSize: 118,
  phone: { w: 360, h: 780, cy: 540 }, lift: 1.75,
  title: 104, titleBase: 105, sub: 38, subBase: 160, body: 40, name: 54,
  hdrTitleBase: 120, hdrSubBase: 180, photoY: 215, photoH: 700,
  panY: 195, panH: 240, panGap: 20,
  menuY: 150, row: 60, menuHead: 84,
  horY: 150, horRow: 165, day: 44, hours: 40, martes: 86,
  mapY: 150, mapH: 480, addr1: 720, addr2: 782, addrSize: 50, pills: 820,
} : {
  T0: 250, P: 1300, cup: { cx: 540, top: 590, bot: 1340, rT: 255, rB: 190, tilt: 0.16 },
  cup2: { cx: 540, top: 430, bot: 1110, rT: 232, rB: 174, tilt: 0.16 },
  enBase: 530, enSize: 150, capsBase: 860, capsSize: 330, nameBase: 1370, nameSize: 138,
  phone: { w: 480, h: 1040, cy: 915 }, lift: 1.55,
  title: 150, titleBase: 150, sub: 44, subBase: 218, body: 42, name: 62,
  hdrTitleBase: 175, hdrSubBase: 250, photoY: 310, photoH: 705,
  panY: 275, panH: 290, panGap: 26,
  menuY: 240, row: 76, menuHead: 104,
  horY: 220, horRow: 200, day: 50, hours: 44, martes: 104,
  mapY: 220, mapH: 560, addr1: 880, addr2: 950, addrSize: 56, pills: 1000,
};
const CREAM = '#F1EBDD', CARBON = '#21211D', OCRE = '#B0883A', BG = '#12110E';
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
const LAYERS = ['#3A2418', '#6B8540', '#EBE1CC', '#5B3620', '#6F7A69', '#3A2418'];   // espresso, matcha, leche, coldbrew, salvia
const COLS = new Float32Array(LAYERS.flatMap(hex));

// ---------- utilidades ----------
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, k) => a + (b - a) * k;
const seg = (f, a, b) => clamp((f - a) / (b - a));
const eio = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
const eo = (k) => 1 - Math.pow(1 - k, 3);
const ei = (k) => k * k * k;
const eob = (k) => { const c = 1.70158; return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); };
const kick = (f, f0, tau) => (f < f0 ? 0 : Math.exp(-(f - f0) / tau));
const rnd = (i, j = 0) => { const x = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return x - Math.floor(x); };
const shade = (h, m) => { const [r, g, b] = hex(h).map((v) => Math.round(clamp(v * m) * 255)); return `rgb(${r},${g},${b})`; };
const rgba = (h, a) => { const [r, g, b] = hex(h).map((v) => Math.round(v * 255)); return `rgba(${r},${g},${b},${a})`; };

// ---------- lienzos ----------
const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const out = mk(W * SC, H * SC); document.body.appendChild(out); const octx = out.getContext('2d');
const cv = mk(W * SC, H * SC); const ctx = cv.getContext('2d');
const glc = mk(W * SC, H * SC); const liquid = makeLiquid(glc);
const bl = mk(W * SC, H * SC); const bctx = bl.getContext('2d');
const noise = mk(128, 128); { const n = noise.getContext('2d'); const d = n.createImageData(128, 128);
  for (let i = 0; i < 128 * 128; i++) { const v = rnd(i, 7) > 0.5 ? 255 : 0; d.data.set([v, v, v, 10], i * 4); } n.putImageData(d, 0, 0); }
const noisePat = ctx.createPattern(noise, 'repeat');
const grain = [0, 1, 2].map((s) => { const c = mk(512, 512); const n = c.getContext('2d'); const d = n.createImageData(512, 512);
  for (let i = 0; i < 512 * 512; i++) { const v = Math.floor(rnd(i, s + 31) * 255); d.data.set([v, v, v, 255], i * 4); } n.putImageData(d, 0, 0); return c; });

// ---------- fuentes e imágenes ----------
const ff = async (fam, url, desc) => { const f = new FontFace(fam, `url(${url})`, desc); await f.load(); document.fonts.add(f); };
await Promise.all([ff('Anton', 'vendor/Anton.woff2', {}), ff('Inter', 'vendor/Inter-SemiBold.otf', { weight: '600' }), ff('Inter', 'vendor/Inter-Bold.otf', { weight: '700' })]);
const img = (u) => new Promise((r, j) => { const i = new Image(); i.onload = () => r(i); i.onerror = j; i.src = u; });
const [FACH, LOGO] = await Promise.all([img('img/fachada.jpg'), img('img/logo.png')]);
const ANTON = (s) => `${s}px Anton`, SEMI = (s) => `600 ${s}px Inter`, BOLD = (s) => `700 ${s}px Inter`;

// ---------- texto ----------
const advCache = new Map();
function adv(c, str, font) {
  const key = font + '|' + str; let a = advCache.get(key);
  if (!a) { c.font = font; a = [0]; for (let i = 1; i <= str.length; i++) a.push(c.measureText(str.slice(0, i)).width); advCache.set(key, a); }
  return a;
}
// subida enmascarada por glifo (sin fundidos): kf(i) -> 0..1
function rise(c, str, font, x, base, size, kf, color, align = 'left') {
  const xs = adv(c, str, font), w = xs[str.length];
  const x0 = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
  c.font = font; c.fillStyle = color; c.textBaseline = 'alphabetic';
  for (let i = 0; i < str.length; i++) {
    const k = typeof kf === 'function' ? kf(i) : kf; if (k <= 0 || str[i] === ' ') continue;
    if (k >= 1) { c.fillText(str[i], x0 + xs[i], base); continue; }
    c.save(); c.beginPath(); c.rect(x0 + xs[i] - 6, base - size * 1.1, xs[i + 1] - xs[i] + 12, size * 1.36); c.clip();
    c.fillText(str[i], x0 + xs[i], base + (1 - eo(k)) * size * 1.2); c.restore();
  }
  return w;
}
const stag = (f, f0, st = 2, dur = 18) => (i) => seg(f, f0 + i * st, f0 + i * st + dur);
function line(c, str, font, x, base, size, k, color, align = 'left') {      // renglón completo que sube tras su máscara
  if (k <= 0) return; c.font = font; c.fillStyle = color; c.textAlign = align; c.textBaseline = 'alphabetic';
  if (k < 1) { c.save(); c.beginPath(); c.rect(x - 1200, base - size * 1.1, 2400, size * 1.4); c.clip(); c.fillText(str, x, base + (1 - eo(k)) * size * 1.25); c.restore(); }
  else c.fillText(str, x, base);
  c.textAlign = 'left';
}
function pill(c, x, y, w, h, color) { c.fillStyle = color; c.beginPath(); c.roundRect(x, y, w, h, h / 2); c.fill(); }

// ---------- estado: todo lo animado sale de aquí ----------
const IP = [0, 1, 2, 3].map((k) => L.T0 + (k + 1) * L.P - 50).concat([L.T0 + 5 * L.P + 400]);
const SCROLLS = [F.scroll1, F.scroll2, F.scroll3, F.scroll4];
function state(f) {
  const k1 = eio(seg(f, F.morph[0], F.morph[1]));
  const k2 = eio(seg(f, F.cup[0], F.cup[1]));
  const hero = f < 500;
  const k = hero ? k1 : 1 - k2;
  const cup = { ...(hero ? L.cup : L.cup2) };
  if (hero) {
    const fall = clamp((F.land - f) / 9); const dy = -1500 * fall * fall;
    const sq = f < F.land ? 0 : 0.07 * Math.exp(-(f - F.land) / 5) * Math.cos((f - F.land) * 0.55);
    const hgt = cup.bot - cup.top; cup.top = cup.bot - hgt * (1 - sq) + dy; cup.bot += dy; cup.rT *= 1 + sq * 0.6; cup.rB *= 1 + sq * 0.6;
  } else {
    const sq = 0.035 * kick(f, F.cup[1] - 4, 6) * Math.cos((f - F.cup[1] + 4) * 0.5);
    const hgt = cup.bot - cup.top; cup.top = cup.bot - hgt * (1 - sq);
  }
  const ph = eio(seg(f, F.phone[0], F.phone[1]));
  const col = { cx: 540, cy: H / 2, hw: 500, hh: H / 2 + 300, r: 40 };
  const pr = { cx: 540, cy: L.phone.cy, hw: L.phone.w / 2, hh: L.phone.h / 2, r: 44 };
  const rect = {}; for (const n in col) rect[n] = lerp(col[n], pr[n], ph);
  const sp = L.phone.w / 1000;
  let s = lerp(1, sp, ph), Ox = lerp(40, pr.cx - pr.hw, ph), Oy = lerp(0, pr.cy - pr.hh, ph);
  let S = 0; for (const sc of SCROLLS) S += L.P * eio(seg(f, sc[0], sc[1]));
  S = lerp(S, L.T0 - 150, eio(seg(f, F.scrollTop[0], F.scrollTop[1])));
  s = lerp(s, 1, k2); Ox = lerp(Ox, 40, k2); Oy = lerp(Oy, 0, k2); S = lerp(S, 0, k2);
  // interfaces entre capas (coordenadas de contenido)
  const c0 = hero ? L.cup : L.cup2;
  const IC = hero ? [lerp(c0.top, c0.bot, 0.54), c0.bot + 100, c0.bot + 200, c0.bot + 300, c0.bot + 400]
    : [lerp(c0.top, c0.bot, 0.42), lerp(c0.top, c0.bot, 0.70), c0.bot + 200, c0.bot + 300, c0.bot + 400];
  const kk = hero ? k1 : 1 - k2;
  const I = IC.map((v, i) => lerp(v, IP[i], kk));
  let surf, front, surfAmp, amp, soft;
  if (hero) {
    const sE = lerp(c0.top, c0.bot, 0.17);
    surf = f < F.espresso[0] ? lerp(c0.bot + 30, IC[0], eo(seg(f, F.matcha[0], F.matcha[1]))) : lerp(IC[0], sE, eio(seg(f, F.espresso[0], F.espresso[1])));
    surf = lerp(surf + (cup.bot - c0.bot), -700, k1);
    if (f < F.espresso[0] + 2) I[0] = Math.min(I[0], surf - 46);
    front = lerp(c0.bot + 400, IP[0] - 12, k1);
    let prev = IP[0] - 12;
    SCROLLS.forEach((sc, i) => { const nx = IP[i + 1] - (i < 3 ? 12 : 0); front += (nx - prev) * eio(seg(f, sc[0] - 4, sc[0] + 36)); prev = nx; });
    surfAmp = 3 + 20 * kick(f, F.matcha[0], 20) + 16 * kick(f, F.espresso[0], 18);
    amp = [0, 1, 2, 3, 4].map((i) => 8 + (i === 0 ? 20 * kick(f, F.espresso[0], 22) : 0) + (SCROLLS[i] ? 22 * kick(f, SCROLLS[i][0], 26) : 0));
    soft = [0, 1, 2, 3, 4].map((i) => (i === 0 ? 10 + 26 * kick(f, F.espresso[0], 26) : 12));
  } else {
    surf = lerp(-700, lerp(c0.top, c0.bot, 0.15), k2); front = 1e5;
    surfAmp = 3 + 18 * kick(f, F.cup[1] - 10, 16);
    amp = [0, 1, 2, 3, 4].map(() => 8 + 20 * kick(f, F.cup[1] - 10, 20));
    soft = [12, 12, 12, 12, 12];
  }
  // cámara ortográfica: giro a isométrico real (30°) y regreso
  const isoK = eob(seg(f, F.iso[0], F.iso[1])) * (1 - eio(seg(f, F.isoBack[0], F.isoBack[1])));
  const th = (45 * Math.PI / 180) * isoK, phi = (35.264 * Math.PI / 180) * isoK;
  const z = 1 / Math.cos(phi);
  const M = { a: z * Math.cos(th), b: z * Math.sin(th) * Math.sin(phi), d: z * Math.cos(phi), px: 540, py: L.phone.cy, th, phi, z, isoK };
  const phv = ph * (1 - k2);
  return { f, k, k1, k2, hero, cup, rect, s, Ox, Oy, S, I: new Float32Array(I), surf, front, surfAmp, frontAmp: 20,
    amp: new Float32Array(amp), soft: new Float32Array(soft), cols: COLS, M, wall: lerp(12, 4, phv), glass: 1, ph, phv };
}
const stageTf = (c, M, ox = 0, oy = 0) => c.setTransform(SC * M.a, SC * M.b, 0, SC * M.d, SC * (M.px - M.a * M.px + ox), SC * (M.py - M.b * M.px - M.d * M.py + oy));
const contentTf = (c, st) => { const M = st.M;
  c.setTransform(SC * M.a * st.s, SC * M.b * st.s, 0, SC * M.d * st.s,
    SC * (M.a * (st.Ox - M.px) + M.px), SC * (M.b * (st.Ox - M.px) + M.d * (st.Oy - st.s * st.S - M.py) + M.py)); };

// ---------- fondo ----------
function background(c, st) {
  c.setTransform(SC, 0, 0, SC, 0, 0); c.fillStyle = BG; c.fillRect(0, 0, W, H);
  let g = c.createRadialGradient(W * 0.3, H * 0.22, 0, W * 0.3, H * 0.22, H * 0.75);
  g.addColorStop(0, 'rgba(241,235,221,0.075)'); g.addColorStop(1, 'rgba(241,235,221,0)'); c.fillStyle = g; c.fillRect(0, 0, W, H);
}
function ellGrad(c, x, y, rx, ry, col0, col1) {
  c.save(); c.translate(x, y); c.scale(1, ry / rx); const g = c.createRadialGradient(0, 0, 0, 0, 0, rx);
  g.addColorStop(0, col0); g.addColorStop(1, col1); c.fillStyle = g; c.beginPath(); c.arc(0, 0, rx, 0, 7); c.fill(); c.restore();
}
function cupFloor(c, st) {
  const f = st.f, q = 1 - st.k; if (q <= 0.02) return;
  c.setTransform(SC, 0, 0, SC, 0, 0);
  const base = (st.hero ? L.cup : L.cup2).bot, cx = 540, rB = st.cup.rB;
  ellGrad(c, cx, base + 10, 560 * q, 150 * q, 'rgba(241,235,221,0.10)', 'rgba(241,235,221,0)');       // mesa
  const near = st.hero ? clamp(1 - (base - st.cup.bot) / 900) : 1;
  ellGrad(c, cx + 26, base + 16, rB * (1.9 - 0.55 * near) * q, 52 * q, `rgba(0,0,0,${0.85 * near})`, 'rgba(0,0,0,0)');   // sombra de contacto
  if (st.hero && f >= F.ring && f < F.ring + 44) {                                                          // anillo de contacto
    const r = (f - F.ring) / 44; c.strokeStyle = CREAM; c.lineWidth = 7 * (1 - r) * (1 - r);
    c.beginPath(); c.ellipse(cx, base + 6, rB + 20 + 380 * eo(r), (rB + 20 + 380 * eo(r)) * 0.22, 0, 0, 7); c.stroke();
  }
}

// ---------- tipografía cinética detrás del vaso ----------
function kinetic(c, st) {
  const f = st.f; if (f > F.typeOut[1] + 30) return;
  c.setTransform(SC, 0, 0, SC, 0, 0);
  const pulse = 1 + 0.07 * Math.exp(-Math.pow((f - F.typePulse - 3) / 5, 2));
  const out = seg(f, F.typeOut[0], F.typeOut[1]);
  const word = (str, size, base, f0, drop) => {
    const font = ANTON(size), xs = adv(c, str, font), w = xs[str.length], x0 = 540 - w / 2;
    c.font = font; c.fillStyle = CREAM;
    for (let i = 0; i < str.length; i++) {
      const k = seg(f, f0 + i * 2, f0 + i * 2 + 16); if (k <= 0) continue;
      const gx = x0 + (xs[i] + xs[i + 1]) / 2, ko = eio(clamp(out * 1.25 - i * 0.04));
      const tx = lerp(gx, 540 + (gx - 540) * 0.22, ko), ty = base + (1 - eob(k)) * size * 0.9 + drop * ei(ko);
      c.save(); c.beginPath(); c.rect(0, 0, W, base + size * 0.2 + drop); c.clip();
      c.translate(tx, ty); c.scale(pulse * lerp(1, 0.8, ko), pulse * lerp(1, 0.8, ko)); c.textAlign = 'center'; c.fillText(str[i], 0, 0); c.restore();
    }
    c.textAlign = 'left';
  };
  word('EN', L.enSize, L.enBase, F.typeIn, 330);
  word('CAPAS', L.capsSize, L.capsBase, F.typeIn + 5, 60);
}

// ---------- vaso 2D con elipses (minis, vaso que gira) ----------
function drawCup(c, o) {
  const { x, base, h, rT, rB, tilt } = o, top = base - h, rAt = (y) => lerp(rT, rB, (y - top) / h), yaw = o.yaw || 0;
  ellGrad(c, x + rB * 0.25, base + rB * tilt * 0.6, rB * 1.7, rB * 0.5, 'rgba(0,0,0,0.5)', 'rgba(0,0,0,0)');
  const band = (y0, y1, r0, r1) => { c.beginPath(); c.moveTo(x - r0, y0); c.ellipse(x, y0, r0, r0 * tilt, 0, Math.PI, 0, true);
    c.lineTo(x + r1, y1); c.ellipse(x, y1, r1, r1 * tilt, 0, 0, Math.PI, false); c.closePath(); };
  band(top, base, rT, rB); c.fillStyle = 'rgba(255,255,255,0.07)'; c.fill();
  c.beginPath(); c.ellipse(x, top, rT, rT * tilt, 0, 0, 7); c.fillStyle = 'rgba(255,255,255,0.05)'; c.fill();
  // capas, de abajo hacia arriba
  const liq = h * 0.86 * (o.fill ?? 1); let y1 = base - 4, used = 0; const tot = h * 0.86;
  const ls = [...o.layers].reverse();
  for (let i = 0; i < ls.length; i++) {
    const hh = Math.min(ls[i].h * tot, liq - used); if (hh <= 0.5) break;
    const y0 = y1 - hh, g = c.createLinearGradient(x - rT, 0, x + rT, 0), col = ls[i].c;
    g.addColorStop(0, shade(col, 0.5)); g.addColorStop(0.28, shade(col, 0.98)); g.addColorStop(0.62, shade(col, 1.1)); g.addColorStop(1, shade(col, 0.55));
    band(y0, y1, rAt(y0), rAt(y1)); c.fillStyle = g; c.fill();
    used += hh; y1 = y0;
    if (used >= liq - 0.5 || i === ls.length - 1) { c.beginPath(); c.ellipse(x, y0, rAt(y0) - 2, (rAt(y0) - 2) * tilt, 0, 0, 7); c.fillStyle = shade(col, 1.28); c.fill(); }
  }
  for (const ic of o.ice || []) {                       // hielos que giran con el vaso
    const yy = y1 + ic.y * h, r = rAt(yy) * ic.r, a = ic.a + yaw;
    c.save(); c.translate(x + r * Math.sin(a), yy + r * tilt * Math.cos(a)); c.rotate(a * 0.6 + ic.a);
    c.fillStyle = 'rgba(255,255,255,0.26)'; c.strokeStyle = 'rgba(255,255,255,0.55)'; c.lineWidth = 1.5;
    c.beginPath(); c.roundRect(-ic.s / 2, -ic.s / 2, ic.s, ic.s, ic.s * 0.22); c.fill(); c.stroke(); c.restore();
  }
  band(top, base, rT, rB); c.strokeStyle = 'rgba(241,235,221,0.6)'; c.lineWidth = Math.max(1.5, h * 0.011); c.stroke();
  c.beginPath(); c.ellipse(x, top, rT, rT * tilt, 0, 0, 7); c.stroke();
  c.beginPath(); c.moveTo(x - rT * 0.74, top + h * 0.12); c.lineTo(x - rT * 0.60, top + h * 0.12); c.lineTo(x - rB * 0.66, base - h * 0.12); c.lineTo(x - rB * 0.80, base - h * 0.12); c.closePath();
  c.fillStyle = 'rgba(255,255,255,0.20)'; c.fill();
  if (o.lid) {                                           // tapa
    const ly = top - (o.lidLift || 0), R = rT * 1.07, sk = h * 0.07;
    c.beginPath(); c.moveTo(x - R, ly); c.ellipse(x, ly, R, R * tilt, 0, Math.PI, 0, true); c.lineTo(x + R, ly + sk); c.ellipse(x, ly + sk, R, R * tilt, 0, 0, Math.PI, false); c.closePath();
    c.fillStyle = 'rgba(255,255,255,0.16)'; c.fill(); c.strokeStyle = 'rgba(241,235,221,0.6)'; c.stroke();
    c.beginPath(); c.ellipse(x, ly, R, R * tilt, 0, 0, 7); c.fillStyle = 'rgba(255,255,255,0.13)'; c.fill(); c.stroke();
    const a = yaw + 0.6; c.beginPath(); c.ellipse(x + R * 0.5 * Math.sin(a), ly + R * 0.5 * tilt * Math.cos(a), R * 0.16, R * 0.16 * tilt, 0, 0, 7); c.fillStyle = 'rgba(18,17,14,0.55)'; c.fill();
  }
}

// ---------- extras 2D del vaso principal: aro, tapa e hielos ----------
function heroExtras(c, st) {
  const q = 1 - st.k; if (q < 0.02) return;
  const f = st.f, cup = st.cup, k = st.k;
  c.setTransform(SC, 0, 0, SC, 0, 0);
  const top = lerp(cup.top, st.rect.cy - st.rect.hh, k), R = lerp(cup.rT, st.rect.hw, k), tilt = cup.tilt * q;
  if (st.hero && f >= F.matcha[0]) {                     // hielos flotando en la superficie
    const bob = (i) => 5 * Math.sin(f * 0.11 + i * 2) + 26 * kick(f, F.espresso[0], 14) * Math.sin((f - F.espresso[0]) * 0.4 + i);
    [[-74, 54, 0.3], [58, 46, -0.5]].forEach(([dx, s, r], i) => { c.save(); c.translate(540 + dx * (1 + k * 3), st.surf + 22 + bob(i)); c.rotate(r + 0.1 * Math.sin(f * 0.07 + i));
      c.fillStyle = 'rgba(255,255,255,0.20)'; c.strokeStyle = 'rgba(255,255,255,0.6)'; c.lineWidth = 2; c.beginPath(); c.roundRect(-s / 2, -s / 2, s, s, 11); c.fill(); c.stroke();
      c.beginPath(); c.moveTo(-s * 0.3, -s * 0.3); c.lineTo(s * 0.1, -s * 0.3); c.strokeStyle = 'rgba(255,255,255,0.85)'; c.stroke(); c.restore(); });
  }
  const lidDrop = st.hero ? clamp((F.lid - f) / 7) : 0, ly = top - 4 - 700 * lidDrop * lidDrop - (st.hero ? 6 * kick(f, F.lid, 4) * Math.cos((f - F.lid) * 0.8) : 0);
  const RL = R + 15, sk = 30 * q + 2;
  c.beginPath(); c.ellipse(540, top, R - 6, (R - 6) * tilt, 0, 0, 7); c.strokeStyle = 'rgba(241,235,221,0.35)'; c.lineWidth = 2; c.stroke();
  c.beginPath(); c.moveTo(540 - RL, ly); c.ellipse(540, ly, RL, RL * tilt, 0, Math.PI, 0, true); c.lineTo(540 + RL, ly + sk); c.ellipse(540, ly + sk, RL, RL * tilt, 0, 0, Math.PI, false); c.closePath();
  const g = c.createLinearGradient(540 - RL, 0, 540 + RL, 0); g.addColorStop(0, 'rgba(255,255,255,0.10)'); g.addColorStop(0.3, 'rgba(255,255,255,0.30)'); g.addColorStop(0.55, 'rgba(255,255,255,0.14)'); g.addColorStop(1, 'rgba(255,255,255,0.08)');
  c.fillStyle = g; c.fill(); c.strokeStyle = 'rgba(241,235,221,0.7)'; c.lineWidth = 2; c.stroke();
  c.beginPath(); c.ellipse(540, ly, RL, RL * tilt, 0, 0, 7); c.fillStyle = 'rgba(255,255,255,0.13)'; c.fill(); c.stroke();
  c.beginPath(); c.ellipse(540 + RL * 0.34, ly + RL * tilt * 0.3, RL * 0.15, RL * 0.15 * tilt, 0, 0, 7); c.fillStyle = 'rgba(18,17,14,0.6)'; c.fill();
}

// ---------- paneles de cristal: desenfocan de verdad lo que tienen detrás ----------
function snapshot(st) {
  bctx.setTransform(1, 0, 0, 1, 0, 0); bctx.filter = 'none'; bctx.drawImage(cv, -W * SC * 0.04, -H * SC * 0.04, W * SC * 1.08, H * SC * 1.08);
  bctx.filter = `blur(${Math.max(6, 32 * SC * st.s)}px) saturate(140%)`; bctx.drawImage(cv, 0, 0); bctx.filter = 'none';
}
function glass(c, x, y, w, h, r, tint) {
  c.save(); c.beginPath(); c.roundRect(x, y, w, h, r); c.clip();
  const tr = c.getTransform(); c.setTransform(1, 0, 0, 1, 0, 0); c.drawImage(bl, 0, 0); c.setTransform(tr);
  c.fillStyle = tint; c.fillRect(x, y, w, h);
  const g = c.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, 'rgba(255,255,255,0.13)'); g.addColorStop(0.4, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(x, y, w, h);
  c.fillStyle = noisePat; c.globalAlpha = 0.5; c.fillRect(x, y, w, h); c.globalAlpha = 1; c.restore();
  c.beginPath(); c.roundRect(x + 0.6, y + 0.6, w - 1.2, h - 1.2, r); c.lineWidth = 1.2;
  const b = c.createLinearGradient(x, y, x + w * 0.4, y + h); b.addColorStop(0, 'rgba(255,255,255,0.62)'); b.addColorStop(0.5, 'rgba(255,255,255,0.14)'); b.addColorStop(1, 'rgba(255,255,255,0.32)');
  c.strokeStyle = b; c.stroke();
}
const DARK = 'rgba(18,17,14,0.34)', LIGHT = 'rgba(255,252,244,0.34)';

// ---------- secciones de la página (coordenadas de contenido, ancho 1000) ----------
const Y = (k) => L.T0 + k * L.P;
const slide = (f, f0) => (1 - eob(seg(f, f0, f0 + 26))) * 760;       // los paneles entran desde abajo, sin fundido

function secHeader(c, f) {
  const y = Y(0);
  let fs = L.title * 0.92; const str = 'CHATO CAFECITO'; while (adv(c, str, ANTON(fs))[str.length] > 930) fs -= 2;
  rise(c, str, ANTON(fs), 30, y + L.hdrTitleBase, fs, stag(f, F.headerIn, 1.6, 18), CREAM);
  line(c, 'Centro · Aguascalientes', SEMI(L.sub), 32, y + L.hdrSubBase, L.sub, seg(f, F.headerIn + 16, F.headerIn + 32), rgba(CREAM, 0.86));
  const k = eo(seg(f, F.photoIn, F.photoIn + 24)); if (k <= 0) return;
  const px = 30, py = y + L.photoY, pw = 940, phh = L.photoH;
  c.save(); c.beginPath(); c.roundRect(px, py, pw, phh * k, 34); c.clip();
  const sc = Math.max(pw / FACH.width, phh / FACH.height) * lerp(1.08, 1, k);
  c.drawImage(FACH, px + (pw - FACH.width * sc) / 2, py + (phh - FACH.height * sc) / 2, FACH.width * sc, FACH.height * sc);
  const g = c.createLinearGradient(0, py + phh * 0.6, 0, py + phh); g.addColorStop(0, 'rgba(18,17,14,0)'); g.addColorStop(1, 'rgba(18,17,14,0.45)'); c.fillStyle = g; c.fillRect(px, py, pw, phh);
  c.restore();
  c.beginPath(); c.roundRect(px + 0.6, py + 0.6, pw - 1.2, phh * k - 1.2, 34); c.lineWidth = 1.5; c.strokeStyle = 'rgba(255,255,255,0.4)'; c.stroke();
}
const CHATOS = [
  { n: 'Mat-Chata', layers: [{ c: '#7C9A4B', h: 0.55 }, { c: '#EFE6D2', h: 0.45 }] },
  { n: 'Coco Matchato', layers: [{ c: '#A9C07A', h: 0.26 }, { c: '#D9E2DC', h: 0.74 }] },
  { n: 'Naranjatto', layers: [{ c: '#3A2418', h: 0.5 }, { c: '#E08A2C', h: 0.5 }] },
];
function secChatos(c, f) {
  const y = Y(1);
  rise(c, 'LOS CHATOS', ANTON(L.title), 30, y + L.titleBase, L.title, stag(f, F.chatosTitle, 2, 18), CREAM);
  line(c, 'Recomendación de la casa', SEMI(L.sub), 32, y + L.subBase, L.sub, seg(f, F.chatosTitle + 14, F.chatosTitle + 30), rgba(CREAM, 0.9));
  CHATOS.forEach((d, i) => {
    if (f < F.panels[i]) return;
    const py = y + L.panY + i * (L.panH + L.panGap) + slide(f, F.panels[i]), ph = L.panH;
    glass(c, 30, py, 940, ph, 36, DARK);
    const ch = ph - 74, rT = ch * 0.33;
    drawCup(c, { x: 150, base: py + ph - 30, h: ch, rT, rB: rT * 0.74, tilt: 0.2, layers: d.layers, fill: eo(seg(f, F.minis[i], F.minis[i] + 34)), lid: true,
      ice: i === 2 ? [{ a: 0.4, r: 0.4, y: 0.16, s: ch * 0.13 }, { a: 2.6, r: 0.45, y: 0.3, s: ch * 0.11 }] : [] });
    c.font = BOLD(L.name); c.fillStyle = CREAM; c.fillText(d.n, 290, py + ph * 0.44);
    pill(c, 290, py + ph * 0.60, 360, 16, rgba(CREAM, 0.30)); pill(c, 290, py + ph * 0.60 + 34, 250, 16, rgba(CREAM, 0.22));
    pill(c, 970 - 30 - 104, py + ph * 0.44 - L.name * 0.72, 104, 44, rgba(CREAM, 0.26));
  });
}
const HOT = ['Espresso', 'Americano', 'Cortadito', 'Flat white', 'Capuchino', 'Latte', 'Caramel machato', 'Chai latte', 'Matcha latte'];
const COLD = ['Americano /', 'Aerocano', 'Espresso /', 'CB tonic', 'Coldbrew', 'Latte', 'Caramel machato', 'Chai latte', 'Matcha latte', 'Soda Berry Nais', 'Frappe'];
const CONT = new Set([1, 3]);          // segundo renglón de un mismo producto: sin forma de precio propia
function secMenu(c, f) {
  const y = Y(2);
  rise(c, 'MENÚ', ANTON(L.title), 30, y + L.titleBase, L.title, stag(f, F.menuTitle, 2, 18), CARBON);
  const tk = eio(seg(f, F.turn[0], F.turn[1])) * (1 - eio(seg(f, F.turnBack[0], F.turnBack[1])));
  const ch = V ? 128 : 196, cin = eob(seg(f, F.menuTitle + 4, F.menuTitle + 26));
  if (f > F.menuTitle + 4) drawCup(c, { x: 820, base: y + (V ? 134 : 214) + (1 - cin) * -500, h: ch * lerp(1, 1.12, tk), rT: ch * 0.36, rB: ch * 0.27, tilt: lerp(0.16, 0.5, tk), yaw: tk * Math.PI / 2,
    layers: [{ c: '#7C9A4B', h: 0.42 }, { c: '#EFE6D2', h: 0.58 }], lid: true, lidLift: 58 * tk,
    ice: [{ a: 0.2, r: 0.5, y: 0.14, s: ch * 0.15 }, { a: 2.4, r: 0.5, y: 0.2, s: ch * 0.13 }, { a: 4.3, r: 0.45, y: 0.36, s: ch * 0.12 }] });
  [['BARRA CALIENTE', HOT], ['BARRA FRÍA', COLD]].forEach(([t, items], ci) => {
    if (f < F.cols[ci]) return;
    const x = 20 + ci * 490, w = 470, py = y + L.menuY + slide(f, F.cols[ci]), hh = L.menuHead + 11 * L.row + 24;
    glass(c, x, py, w, hh, 34, LIGHT);
    c.font = ANTON(V ? 52 : 60); c.fillStyle = CARBON; c.fillText(t, x + 26, py + L.menuHead * 0.72);
    c.fillStyle = rgba(CARBON, 0.5); c.fillRect(x + 26, py + L.menuHead - 4, w - 52, 2);
    items.forEach((it, i) => {
      const k = seg(f, F.rows + ci * 6 + i * 2, F.rows + ci * 6 + i * 2 + 14), by = py + L.menuHead + (i + 1) * L.row - L.row * 0.28;
      line(c, it, SEMI(L.body), x + 26, by, L.body, k, CARBON);
      if (k > 0 && !(ci === 1 && (i === 0 || i === 2))) pill(c, x + w - 26 - 70 * eo(k), by - 26, 70 * eo(k), 28, rgba(CARBON, 0.24));
    });
  });
}
const DAYS = [['Lun · Mié · Jue · Vie', '8:30 a 14:00 y 16:00 a 20:00'], ['Sábado', '9:00 a 14:00 y 16:00 a 20:00'], ['Domingo', '9:00 a 16:00']];
function secHorario(c, f) {
  const y = Y(3);
  rise(c, 'HORARIO', ANTON(L.title), 30, y + L.titleBase, L.title, stag(f, F.horTitle, 2, 18), CREAM);
  if (f >= F.horPanel) {
    const py = y + L.horY + slide(f, F.horPanel), hh = 3 * L.horRow + 24;
    glass(c, 30, py, 940, hh, 36, DARK);
    DAYS.forEach(([d, h], i) => {
      const k = seg(f, F.horRows[i], F.horRows[i] + 16), ry = py + 12 + i * L.horRow;
      line(c, d, BOLD(L.day), 66, ry + L.horRow * 0.42, L.day, k, CREAM);
      line(c, h, SEMI(L.hours), 66, ry + L.horRow * 0.78, L.hours, seg(f, F.horRows[i] + 5, F.horRows[i] + 21), rgba(CREAM, 0.88));
      if (i < 2 && k > 0) { c.fillStyle = rgba(CREAM, 0.22); c.fillRect(66, ry + L.horRow - 1, 808 * eo(k), 2); }
    });
  }
  // "Martes descansamos": las letras llegan, se recuestan 8° y se asientan
  const str = 'Martes descansamos', font = ANTON(L.martes), xs = adv(c, str, font), base = y + L.horY + 3 * L.horRow + 24 + L.martes * 1.25;
  c.font = font; c.fillStyle = OCRE;
  for (let i = 0; i < str.length; i++) {
    const k = seg(f, F.martes + i * 1.5, F.martes + i * 1.5 + 22); if (k <= 0 || str[i] === ' ') continue;
    const gx = 34 + xs[i], rot = 0.14 * Math.sin(Math.PI * clamp(k * 1.15)) * (1 - k * 0.2);
    c.save(); c.beginPath(); c.rect(gx - 30, base - L.martes * 1.15, xs[i + 1] - xs[i] + 80, L.martes * 1.45); c.clip();
    c.translate(gx + (1 - eo(k)) * 46, base + (1 - eo(clamp(k * 1.6))) * L.martes * 1.2); c.rotate(rot); c.fillText(str[i], 0, 0); c.restore();
  }
}
function secUbic(c, f) {
  const y = Y(4);
  rise(c, 'UBICACIÓN', ANTON(L.title), 30, y + L.titleBase, L.title, stag(f, F.ubiTitle, 2, 18), CREAM);
  if (f >= F.map) {
    const py = y + L.mapY + slide(f, F.map), hh = L.mapH;
    glass(c, 30, py, 940, hh, 36, 'rgba(18,17,14,0.62)');
    c.save(); c.beginPath(); c.roundRect(30, py, 940, hh, 36); c.clip();
    // plano isométrico real (30°): manzanas extruidas, sin nombres de calles ni de negocios
    const u = V ? 86 : 100, gap = u * 0.24, ox = 500, oy = py + hh * 0.5 - 3 * (u + gap) * 0.5 - 20;
    const P = (a, b, h = 0) => [ox + 0.866 * (a - b), oy + 0.5 * (a + b) - h];
    const poly = (pts, col) => { c.beginPath(); pts.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]))); c.closePath(); c.fillStyle = col; c.fill(); };
    const N = 7, cells = [];
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) cells.push([i, j]);
    cells.sort((a, b) => a[0] + a[1] - b[0] - b[1]);
    const av = 3;                                         // la avenida: una calle más ancha
    const pos = (i) => (i - N / 2) * (u + gap) + (i >= av ? gap * 1.2 : 0) + 3 * (u + gap) * 0.5;
    poly([P(pos(av) - gap * 1.7, pos(0) - 40), P(pos(av) - gap * 0.5, pos(0) - 40), P(pos(av) - gap * 0.5, pos(N)), P(pos(av) - gap * 1.7, pos(N))], 'rgba(241,235,221,0.10)');
    for (const [i, j] of cells) {
      const a0 = pos(i), b0 = pos(j), a1 = a0 + u, b1 = b0 + u, here = i === 2 && j === 3;
      const hgt = (here ? 30 : 10 + 30 * rnd(i, j)) * eob(seg(f, F.map + 6 + (i + j) * 1.6, F.map + 26 + (i + j) * 1.6));
      poly([P(a0, b1), P(a1, b1), P(a1, b1, hgt), P(a0, b1, hgt)], here ? '#8A6A2C' : '#3A4037');
      poly([P(a1, b0), P(a1, b1), P(a1, b1, hgt), P(a1, b0, hgt)], here ? '#6B5222' : '#272B25');
      poly([P(a0, b0, hgt), P(a1, b0, hgt), P(a1, b1, hgt), P(a0, b1, hgt)], here ? OCRE : '#56604F');
    }
    // pin con rebote y sombra de contacto que crece
    const pk = seg(f, F.pin[0], F.pin[0] + 12), bounce = f < F.pin[0] ? 1 : pk < 1 ? 1 - ei(pk) : 0.16 * Math.exp(-(f - F.pin[0] - 12) / 6) * Math.abs(Math.cos((f - F.pin[0] - 12) * 0.42));
    if (f >= F.pin[0]) {
      const [gx, gy] = P(pos(2) + u / 2, pos(3) + u / 2, 30), py2 = gy - bounce * 620, r = V ? 34 : 40;
      ellGrad(c, gx + 8, gy + 4, r * (1.3 - 0.6 * clamp(bounce)), r * 0.42 * (1.3 - 0.6 * clamp(bounce)), `rgba(0,0,0,${0.7 * (1 - clamp(bounce) * 0.7)})`, 'rgba(0,0,0,0)');
      c.beginPath(); c.moveTo(gx, py2); c.bezierCurveTo(gx - r * 0.5, py2 - r * 1.1, gx - r, py2 - r * 1.5, gx - r, py2 - r * 2.2);
      c.arc(gx, py2 - r * 2.2, r, Math.PI, 0); c.bezierCurveTo(gx + r, py2 - r * 1.5, gx + r * 0.5, py2 - r * 1.1, gx, py2); c.closePath();
      const g = c.createLinearGradient(gx - r, 0, gx + r, 0); g.addColorStop(0, '#F1EBDD'); g.addColorStop(0.5, '#E7DDC6'); g.addColorStop(1, '#A99F8A'); c.fillStyle = g; c.fill();
      c.beginPath(); c.arc(gx, py2 - r * 2.2, r * 0.42, 0, 7); c.fillStyle = CARBON; c.fill();
    }
    c.restore();
  }
  line(c, 'Gral. Álvaro Obregón 344', BOLD(L.addrSize), 34, y + L.addr1, L.addrSize, seg(f, F.addr[0], F.addr[0] + 18), CREAM);
  line(c, 'Centro, Aguascalientes', SEMI(L.body + 2), 34, y + L.addr2, L.body + 2, seg(f, F.addr[1], F.addr[1] + 18), rgba(CREAM, 0.9));
  const pk = eo(seg(f, F.addr[1] + 8, F.addr[1] + 26));                    // teléfono y WhatsApp sin confirmar: formas neutras
  if (pk > 0) { pill(c, 34, y + L.pills, 300 * pk, 60, rgba(CREAM, 0.24)); pill(c, 354, y + L.pills, 220 * pk, 60, rgba(CREAM, 0.16)); }
}
const SECS = [secHeader, secChatos, secMenu, secHorario, secUbic];

function page(c, st) {
  const f = st.f; if (f < F.headerIn - 2 || f > F.wipe[1]) return;
  stageTf(c, st.M); c.save();
  const r = st.rect, wipe = eio(seg(f, F.wipe[0], F.wipe[1]));
  const top = r.cy - r.hh, hgt = 2 * r.hh, cut = hgt * wipe;
  c.beginPath(); c.roundRect(r.cx - r.hw, top + cut, 2 * r.hw, hgt - cut, Math.min(r.r, (hgt - cut) / 2)); c.clip();
  contentTf(c, st);
  const v0 = st.S - 200, v1 = st.S + (2 * r.hh) / st.s + 200;
  SECS.forEach((fn, k) => { if (Y(k) + L.P > v0 && Y(k) - 100 < v1) fn(c, f); });
  c.restore();
}

// ---------- teléfono (cuerpo con grosor) ----------
function depthVec(M, t) { return [M.z * t * Math.sin(M.th), -M.z * t * Math.cos(M.th) * Math.sin(M.phi)]; }
function phoneBody(c, st) {
  const bz = 15 * st.phv; if (bz < 0.3) return;
  const r = st.rect, M = st.M, thk = 40 * M.isoK * st.phv;
  // sombra de contacto que crece con el giro
  c.setTransform(SC, 0, 0, SC, 0, 0);
  const bx = M.px + M.a * (r.cx - M.px), by = M.py + M.b * (r.cx - M.px) + M.d * (r.cy + r.hh - M.py);
  ellGrad(c, bx, by + 14, 620 * st.phv, 190 * st.phv, 'rgba(241,235,221,0.10)', 'rgba(241,235,221,0)');
  ellGrad(c, bx + 60 * M.isoK, by + 16, r.hw * (1.3 + 0.9 * M.isoK), 30 + 46 * M.isoK, `rgba(0,0,0,${0.8 * st.phv})`, 'rgba(0,0,0,0)');
  const N = Math.max(1, Math.round(thk));
  for (let i = N; i >= 0; i--) {
    const [dx, dy] = depthVec(M, thk * i / N); stageTf(c, M, dx, dy);
    c.beginPath(); c.roundRect(r.cx - r.hw - bz, r.cy - r.hh - bz, 2 * (r.hw + bz), 2 * (r.hh + bz), r.r + bz);
    c.fillStyle = i === 0 ? '#090908' : shade('#3A3833', lerp(1.0, 0.45, i / N)); c.fill();
    if (i === 0) { c.strokeStyle = 'rgba(241,235,221,0.42)'; c.lineWidth = 1.6; c.stroke(); }
  }
}
function phoneUI(c, st) {
  if (st.phv < 0.02) return;
  const f = st.f, r = st.rect, M = st.M, ps = L.phone.w / 480;
  stageTf(c, M);
  const ik = eo(seg(st.phv, 0.5, 1));                    // isla
  c.fillStyle = '#050505'; c.beginPath(); c.roundRect(r.cx - 58 * ps * ik, r.cy - r.hh + 14 * ps, 116 * ps * ik, 30 * ps * ik, 15 * ps); c.fill();
  if (f < F.bar || f > F.wipe[0] + 20) return;
  const back = 1 - eio(seg(f, F.isoBack[0], F.isoBack[0] + 18));
  const bh = 100 * ps, bw = 2 * r.hw - 28 * ps, bx = r.cx - r.hw + 14 * ps, by = r.cy + r.hh - 14 * ps - bh + (1 - eo(seg(f, F.bar, F.bar + 18)) + eio(seg(f, F.wipe[0], F.wipe[0] + 20))) * 160 * ps;
  c.save(); c.beginPath(); c.roundRect(r.cx - r.hw, r.cy - r.hh, 2 * r.hw, 2 * r.hh, r.r); c.clip();
  glass(c, bx, by, bw, bh, 30 * ps, 'rgba(18,17,14,0.5)'); c.restore();
  const el = (x, y, w, h, lk, pulseF, liftD, upY, draw) => {
    const press = Math.exp(-Math.pow((f - pulseF) / 5, 2)), scl = lerp(1, L.lift, lk) * (1 - 0.07 * press);
    const [dx, dy] = depthVec(M, -liftD * lk);
    if (lk > 0.02) { stageTf(c, M); c.fillStyle = `rgba(0,0,0,${0.5 * lk})`; c.beginPath(); c.roundRect(x + 6, y + 8, w, h, h / 2); c.fill(); }
    stageTf(c, M, dx, dy); c.translate(x + w / 2, y + h / 2 - upY * lk); c.scale(scl, scl);
    draw(w, h);
    if (f > pulseF && f < pulseF + 30) { const rr = (f - pulseF) / 30, g = 70 * eo(rr) / scl;           // onda de contacto
      c.beginPath(); c.roundRect(-w / 2 - g, -h / 2 - g, w + 2 * g, h + 2 * g, h / 2 + g); c.lineWidth = 6 * (1 - rr) * (1 - rr) / scl * ps * 2; c.strokeStyle = CREAM; c.stroke(); }
  };
  const lb = eo(seg(f, F.btnLift[0], F.btnLift[1])) * back, lc = eo(seg(f, F.chipLift[0], F.chipLift[1])) * back;
  const w1 = bw * 0.56 - 18 * ps, h1 = 72 * ps, w2 = bw * 0.44 - 18 * ps, h2 = 60 * ps;
  el(bx + bw - 12 * ps - w2, by + (bh - h2) / 2, w2, h2, lc, F.chipPulse, 150 * ps, 210 * ps, (w, h) => {
    c.beginPath(); c.roundRect(-w / 2, -h / 2, w, h, h / 2); c.fillStyle = 'rgba(33,33,29,0.92)'; c.fill(); c.lineWidth = 1.5; c.strokeStyle = rgba(CREAM, 0.7); c.stroke();
    c.font = SEMI(21 * ps); c.fillStyle = CREAM; c.textAlign = 'center'; c.fillText('@chato_cafecito', 0, 7.5 * ps); c.textAlign = 'left'; });
  el(bx + 12 * ps, by + (bh - h1) / 2, w1, h1, lb, F.btnPulse, 110 * ps, 40 * ps, (w, h) => {
    const g = c.createLinearGradient(0, -h / 2, 0, h / 2); g.addColorStop(0, '#C79C47'); g.addColorStop(1, '#A47C30');
    c.beginPath(); c.roundRect(-w / 2, -h / 2, w, h, h / 2); c.fillStyle = g; c.fill(); c.lineWidth = 1.2; c.strokeStyle = 'rgba(255,255,255,0.5)'; c.stroke();
    c.font = BOLD(29 * ps); c.fillStyle = CARBON; c.textAlign = 'center'; c.fillText('Cómo llegar', 0, 10.5 * ps); c.textAlign = 'left'; });
}

// ---------- cierre: el nombre se escribe ----------
function finalName(c, st) {
  const f = st.f; if (f < F.name[0]) return;
  c.setTransform(SC, 0, 0, SC, 0, 0);
  const str = 'CHATO CAFECITO', font = ANTON(L.nameSize), xs = adv(c, str, font), w = xs[str.length], x0 = 540 - w / 2, n = str.length;
  c.font = font; c.fillStyle = CREAM;
  for (let i = 0; i < n; i++) {
    const a = F.name[0] + (F.name[1] - F.name[0] - 10) * i / n, k = eo(seg(f, a, a + 10)); if (k <= 0 || str[i] === ' ') continue;
    c.save(); c.beginPath(); c.rect(x0 + xs[i] - 3, L.nameBase - L.nameSize * 1.1, (xs[i + 1] - xs[i] + 6) * k, L.nameSize * 1.4); c.clip();
    c.fillText(str[i], x0 + xs[i], L.nameBase); c.restore();
  }
  const uk = eo(seg(f, F.name[0] + 6, F.name[1])); c.fillStyle = OCRE; c.fillRect(x0, L.nameBase + 26, w * uk, 6);
}
function endCard(c, f) {
  c.setTransform(SC, 0, 0, SC, 0, 0); c.fillStyle = BG; c.fillRect(0, 0, W, H);
  const g = c.createRadialGradient(W / 2, H * 0.42, 0, W / 2, H * 0.42, H * 0.6); g.addColorStop(0, 'rgba(241,235,221,0.07)'); g.addColorStop(1, 'rgba(241,235,221,0)'); c.fillStyle = g; c.fillRect(0, 0, W, H);
  const k = eo(seg(f, F.cut, F.cut + 12)), cy = V ? 330 : 700, sz = (V ? 280 : 340) * lerp(0.9, 1, k);
  c.drawImage(LOGO, 540 - sz / 2, cy - sz / 2, sz, sz);
  const y0 = cy + (V ? 230 : 290);
  line(c, 'Demo de cortesía de', SEMI(42), 540, y0, 42, seg(f, F.cut + 2, F.cut + 14), rgba(CREAM, 0.85), 'center');
  line(c, 'ELEVATE NEGOCIOS', ANTON(V ? 96 : 104), 540, y0 + (V ? 118 : 130), 104, seg(f, F.cut + 4, F.cut + 16), CREAM, 'center');
  line(c, 'pieza no oficial', SEMI(42), 540, y0 + (V ? 196 : 214), 42, seg(f, F.cut + 6, F.cut + 18), OCRE, 'center');
}

// ---------- un subcuadro ----------
function draw(t) {
  const f = t * 60;
  if (f >= F.cut) { endCard(ctx, f); return; }
  const st = state(f);
  background(ctx, st);
  cupFloor(ctx, st);
  kinetic(ctx, st);
  phoneBody(ctx, st);
  liquid(cv, st, SC, t);
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(glc, 0, 0);
  heroExtras(ctx, st);
  if (f >= F.panels[0] - 1 && f <= F.wipe[1]) snapshot(st);
  page(ctx, st);
  phoneUI(ctx, st);
  finalName(ctx, st);
}
const SHUTTER = 0.55;
window.renderFrame = (fr) => {
  for (let i = 0; i < SUBS; i++) {
    draw((fr + ((i + 0.5) / SUBS - 0.5) * SHUTTER + 0.5 * SHUTTER) / 60);
    octx.globalAlpha = 1 / (i + 1); octx.setTransform(1, 0, 0, 1, 0, 0); octx.globalCompositeOperation = 'source-over'; octx.drawImage(cv, 0, 0);
  }
  octx.globalAlpha = 1;
  // viñeta y grano (2 %), deterministas por cuadro
  const g = octx.createRadialGradient(W * SC / 2, H * SC / 2, H * SC * 0.35, W * SC / 2, H * SC / 2, H * SC * 0.8);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.34)'); octx.fillStyle = g; octx.fillRect(0, 0, W * SC, H * SC);
  octx.globalCompositeOperation = 'overlay'; octx.globalAlpha = 0.07;
  const gp = octx.createPattern(grain[fr % 3], 'repeat'); octx.save(); octx.translate(-Math.floor(rnd(fr, 3) * 400), -Math.floor(rnd(fr, 5) * 400)); octx.fillStyle = gp; octx.fillRect(0, 0, W * SC + 512, H * SC + 512); octx.restore();
  octx.globalCompositeOperation = 'source-over'; octx.globalAlpha = 1;
};
window.ready = true;
