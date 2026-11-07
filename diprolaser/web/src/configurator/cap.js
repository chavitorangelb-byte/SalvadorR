// Gorra estructurada A-frame de 5 paneles, construida en código a partir de las fotos de fábrica:
// frente de una sola pieza, 2 laterales y 2 traseros, costuras hundidas, botón, ojales bordados,
// abertura trasera con snapback, visera precurva con grosor y canto, banda interior y etiqueta hexagonal.
import * as THREE from 'three';

export const CAP = { Rx: .85, Rz: 1.03, H: .98, zA: -.12, dip: .2 };
// costuras (radianes desde el frente): frente/lateral, lateral/trasero, centro trasero
const S1 = 60 * Math.PI / 180, S2 = 126 * Math.PI / 180;
export const PANELS = {
  front: [-S1, S1],
  sideL: [S1, S2], sideR: [-S2, -S1],
  backL: [S2, Math.PI], backR: [-Math.PI, -S2],
};
const SEAMS = [-Math.PI, -S2, -S1, S1, S2, Math.PI];
function panelOf(th) {
  if (th >= -S1 && th <= S1) return [-S1, S1];
  if (th > S1 && th <= S2) return [S1, S2];
  if (th < -S1 && th >= -S2) return [-S2, -S1];
  if (th > S2) return [S2, Math.PI];
  return [-Math.PI, -S2];
}
const ARCH = { w: .40, t: .21 };
const lerp = (a, b, k) => a + (b - a) * k;
const v3 = () => new THREE.Vector3();

export function basePoint(th, out = v3()) {
  // superelipse: frente más plano (A-frame), atrás más redondo
  const e = lerp(1, .62, ((1 + Math.cos(th)) / 2) ** 2);
  const s = Math.sin(th), c = Math.cos(th);
  // la base del frente baja hacia los costados siguiendo la curva de la visera
  // baja más junto a las puntas de la visera y sube poco a poco hacia atrás
  const r = Math.min(1, Math.max(0, (c + .55) / .9));
  const dip = CAP.dip * s * s * r * r * (3 - 2 * r);
  return out.set(CAP.Rx * Math.sign(s) * Math.abs(s) ** e, -dip, CAP.Rz * Math.sign(c) * Math.abs(c) ** e);
}
const _B = v3(), _D = v3(), _P1 = v3(), _P2 = v3(), _A = v3();
function crownRaw(th, t, out) {
  basePoint(th, _B);
  const w = (1 + Math.cos(th)) / 2; // 1 = frente, 0 = atrás
  const Rd = Math.hypot(_B.x, _B.z - CAP.zA);
  // domo amplio: tangente vertical en la base y horizontal arriba (casi un cuarto de elipse, un poco más lleno al frente)
  // frente rígido (entretela): sube casi recto y voltea con hombro; costados y atrás redondos
  const wf = w ** 3;
  const h1 = CAP.H * lerp(.5, .84, wf), r2 = Rd * lerp(.7, .5, wf);
  _D.set(_B.x, 0, _B.z - CAP.zA).normalize();
  _A.set(0, CAP.H, CAP.zA);
  _P1.copy(_B).addScaledVector(_D, -lerp(.0, .06, w)); _P1.y += h1;
  _P2.copy(_A).addScaledVector(_D, r2);
  const u = 1 - t;
  return out.set(0, 0, 0)
    .addScaledVector(_B, u * u * u).addScaledVector(_P1, 3 * u * u * t)
    .addScaledVector(_P2, 3 * u * t * t).addScaledVector(_A, t * t * t);
}
function seamDistance(th, r) {
  let d = Infinity; for (const s of SEAMS) d = Math.min(d, Math.abs(th - s));
  return d * r;
}
const _o = v3(), _n = v3(), _a = v3(), _b = v3();
/** Punto de la copa con la costura hundida. */
export function crownPoint(th, t, out = v3()) {
  if (th > Math.PI) th -= Math.PI * 2; else if (th < -Math.PI) th += Math.PI * 2;
  crownRaw(th, t, out);
  const r = Math.hypot(out.x, out.z - CAP.zA);
  const d = seamDistance(th, r);
  const g = Math.exp(-((d / .013) ** 2)) * .009 * (1 - Math.max(0, (t - .86) / .14));
  // la tela se infla un poco entre costuras (el frente con entretela, menos)
  const [a0, a1] = panelOf(th); const u = (th - a0) / (a1 - a0);
  const front = a0 === PANELS.front[0];
  const fade = Math.max(0, Math.sin(Math.PI * Math.min(1, t / .14))) ** .5 * (1 - Math.max(0, (t - .8) / .2));
  const bulge = Math.max(0, Math.sin(Math.PI * Math.min(1, Math.max(0, u)))) ** .7 * (front ? .003 : .006) * (t < .14 ? fade : 1 - Math.max(0, (t - .8) / .2));
  const k = bulge - g;
  if (Math.abs(k) > 1e-6) { _o.set(out.x, 0, out.z - CAP.zA).normalize(); out.addScaledVector(_o, k * .85); out.y += k * .5 * t; }
  return out;
}
export function crownNormal(th, t, out = v3()) {
  if (t > .995) return out.set(0, 1, 0);
  const e = 1e-3;
  crownPoint(th + e, t, _a).sub(crownPoint(th - e, t, _b));
  const t0 = Math.max(0, t - e), t1 = Math.min(1, t + e);
  crownPoint(th, t1, _n).sub(crownPoint(th, t0, _o));
  return out.crossVectors(_a, _n).normalize();
}
function archStart(th) {
  const d = Math.PI - Math.abs(th);
  const a = Math.abs(d); return a < ARCH.w ? ARCH.t * Math.sqrt(Math.max(0, 1 - (a / ARCH.w) ** 2)) : 0;
}

/** Malla de un panel. Atributos: uv = (arco horizontal, distancia por el perfil) en unidades de mundo,
 *  aSt = (distancia a la costura, a lo largo de la costura, distancia al borde inferior, arco). */
/** Arco real sobre la tela, a altura t, desde el ángulo 0 (centro del frente) hasta th. */
const _q0 = v3(), _q1 = v3();
export function arcAt(th, t, steps = 28) {
  let L = 0; crownRaw(0, t, _q0);
  for (let k = 1; k <= steps; k++) { crownRaw(th * k / steps, t, _q1); L += _q1.distanceTo(_q0); _q0.copy(_q1); }
  return Math.sign(th) * L;
}
function panelGeometry([th0, th1], nu, nv) {
  const pos = [], nor = [], uv = [], st = [], idx = [];
  const P = v3(), N = v3(), prev = v3();
  for (let i = 0; i <= nu; i++) {
    const th = lerp(th0, th1, i / nu);
    const ts = archStart(th);
    let along = 0;
    for (let j = 0; j <= nv; j++) {
      const t = lerp(ts, 1, (j / nv) ** .92);
      crownPoint(th, t, P);
      if (j > 0) along += P.distanceTo(prev);
      prev.copy(P);
      crownNormal(th, t, N);
      // distancias reales sobre la tela: a cada costura del panel y desde el centro del frente
      const ax = arcAt(th, t);
      const sd = Math.min(Math.abs(ax - arcAt(th0, t)), Math.abs(arcAt(th1, t) - ax));
      pos.push(P.x, P.y, P.z); nor.push(N.x, N.y, N.z);
      uv.push(ax, along);
      st.push(sd, along, along, ax);
    }
  }
  const row = nv + 1;
  for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
    const a = i * row + j, b = (i + 1) * row + j;
    idx.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('aSt', new THREE.Float32BufferAttribute(st, 4));
  g.setIndex(idx);
  return g;
}

/* ---------------- Visera ---------------- */
// Visera precurva: costura interior siguiendo la base del frente, borde exterior en media elipse
// slope: caída hacia el frente por unidad de largo; curve: cuánto más cae hacia los costados (visera curva)
export const VIS = { thIn: 78 * Math.PI / 180, A: .85, B: 1.52, z0: .27, slope: .2, curve: .5, thick: .034 };
const _I = v3(), _O = v3();
export function visorPoint(s, t, out = v3()) {
  basePoint(s * VIS.thIn, _I).multiplyScalar(.99);
  const a = s * Math.PI / 2;
  _O.set(VIS.A * Math.sin(a), 0, VIS.z0 + VIS.B * Math.cos(a));
  out.copy(_I).lerp(_O, t);
  // la caída es proporcional a la distancia horizontal desde la costura: las puntas, que son cortas, no cuelgan
  const dh = t * Math.hypot(_O.x - _I.x, _O.z - _I.z); const xn = out.x / VIS.A;
  out.y = _I.y - dh * (VIS.slope + VIS.curve * xn * xn);
  return out;
}
function visorNormal(s, t, out = v3()) {
  const e = 1e-3;
  visorPoint(Math.min(1, s + e), t, _a).sub(visorPoint(Math.max(-1, s - e), t, _b));
  visorPoint(s, Math.min(1, t + e), _n).sub(visorPoint(s, Math.max(0, t - e), _o));
  return out.crossVectors(_n, _a).normalize();
}
function visorGeometry(nu = 72, nv = 26, bottom = false) {
  const pos = [], nor = [], uv = [], st = [], idx = [];
  const P = v3(), N = v3(), prev = v3();
  for (let i = 0; i <= nu; i++) {
    const s = lerp(-.96, .96, i / nu);
    for (let j = 0; j <= nv; j++) {
      const t = j / nv;
      visorPoint(s, t, P); visorNormal(s, t, N);
      const th = VIS.thick * lerp(1, .7, t);
      if (bottom) { P.addScaledVector(N, -th); N.negate(); }
      pos.push(P.x, P.y, P.z); nor.push(N.x, N.y, N.z);
      uv.push(s, t);
      st.push(0, 0, visorPoint(s, 1, _a).distanceTo(visorPoint(s, 0, _b)), 0);
    }
  }
  // arco a lo largo de s para cada t (pespuntes con separación uniforme)
  for (let j = 0; j <= nv; j++) {
    let L = 0;
    for (let i = 0; i <= nu; i++) {
      const k = i * (nv + 1) + j;
      P.fromArray(pos, k * 3);
      if (i > 0) L += P.distanceTo(prev);
      prev.copy(P);
      st[k * 4 + 1] = L;
    }
  }
  const row = nv + 1;
  for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
    const a = i * row + j, b = (i + 1) * row + j;
    if (bottom) idx.push(a, b, a + 1, b, b + 1, a + 1); else idx.push(a, a + 1, b, b, a + 1, b + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('aSt', new THREE.Float32BufferAttribute(st, 4));
  g.setIndex(idx);
  return g;
}
function visorEdgeGeometry(n = 120, seg = 6) {
  // canto redondeado: borde exterior y las dos puntas
  // contorno cerrado: punta izquierda (atrás -> frente), borde frontal, punta derecha (frente -> atrás)
  const path = [];
  for (let i = 0; i <= 12; i++) path.push([-.96, i / 12]);
  for (let i = 1; i <= n; i++) path.push([lerp(-.96, .96, i / n), 1]);
  for (let i = 11; i >= 0; i--) path.push([.96, i / 12]);
  const pos = [], nor = [], uv = [], idx = [];
  const P = v3(), N = v3(), T = v3(), Q = v3(), out = v3();
  path.forEach(([s, t], i) => {
    visorPoint(s, t, P); visorNormal(s, t, N);
    const k = Math.max(0, Math.min(path.length - 1, i)); const [s1, t1] = path[Math.min(path.length - 1, k + 1)], [s0, t0] = path[Math.max(0, k - 1)];
    visorPoint(s1, t1, Q).sub(visorPoint(s0, t0, out));
    T.copy(Q).normalize();
    out.crossVectors(T, N).normalize(); // hacia afuera de la visera
    const th = VIS.thick * .7;
    for (let k = 0; k <= seg; k++) {
      const a = Math.PI * k / seg; // de arriba a abajo
      const c = P.clone().addScaledVector(N, -th / 2);
      const p = c.clone().addScaledVector(N, Math.cos(a) * th / 2).addScaledVector(out, Math.sin(a) * th * .55);
      const nn = N.clone().multiplyScalar(Math.cos(a)).addScaledVector(out, Math.sin(a)).normalize();
      pos.push(p.x, p.y, p.z); nor.push(nn.x, nn.y, nn.z); uv.push(s, 1);
    }
  });
  const row = seg + 1;
  for (let i = 0; i < path.length - 1; i++) for (let k = 0; k < seg; k++) {
    const a = i * row + k, b = (i + 1) * row + k;
    idx.push(a, a + 1, b, b, a + 1, b + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('aSt', new THREE.Float32BufferAttribute(new Array(pos.length / 3 * 4).fill(0), 4));
  g.setIndex(idx);
  return g;
}

/* ---------------- Banda interior, botón, ojales, snapback ---------------- */
function sweatbandGeometry(n = 160) {
  const pos = [], nor = [], uv = [], idx = [];
  const P = v3();
  for (let i = 0; i <= n; i++) {
    const th = lerp(-Math.PI, Math.PI, i / n);
    const ts = archStart(th); if (ts > 0) { /* hueco del snapback */ }
    basePoint(th, P).multiplyScalar(.972);
    const nx = -P.x, nz = -(P.z - CAP.zA); const l = Math.hypot(nx, nz);
    for (const y of [-.004, .09]) { pos.push(P.x, P.y + y, P.z); nor.push(nx / l, 0, nz / l); uv.push(i / n, y); }
  }
  for (let i = 0; i < n; i++) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 2, a + 3, a + 1); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}
function snapbackGroup(mat) {
  const grp = new THREE.Group();
  const strap = (th0, th1, y, h, off) => {
    const pos = [], nor = [], idx = []; const P = v3(); const n = 24;
    for (let i = 0; i <= n; i++) {
      const th = lerp(th0, th1, i / n);
      crownRaw(th, .02, P); const o = v3().set(P.x, 0, P.z - CAP.zA).normalize();
      basePoint(th, P).addScaledVector(o, off);
      for (const yy of [y, y + h]) { pos.push(P.x, yy, P.z); nor.push(o.x, 0, o.z); }
    }
    for (let i = 0; i < n; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 2, a + 1, a + 3); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setIndex(idx);
    return new THREE.Mesh(g, mat);
  };
  grp.add(strap(Math.PI - .52, Math.PI + .08, .03, .055, .012));
  grp.add(strap(-Math.PI - .08, -Math.PI + .52, .03, .055, .004));
  const peg = new THREE.CylinderGeometry(.011, .011, .012, 12); peg.rotateX(Math.PI / 2);
  for (let k = 0; k < 6; k++) {
    const th = Math.PI - .42 + k * .075; const P = basePoint(th); const o = v3().set(P.x, 0, P.z - CAP.zA).normalize();
    const m = new THREE.Mesh(peg, mat); m.position.copy(P).addScaledVector(o, .02); m.position.y = .057; m.lookAt(m.position.clone().add(o)); grp.add(m);
  }
  return grp;
}
function eyelets(mat, holeMat) {
  const grp = new THREE.Group();
  const ring = new THREE.TorusGeometry(.024, .0075, 8, 28);
  const hole = new THREE.CircleGeometry(.018, 20);
  for (const th of [1.62, -1.62, 2.55, -2.55]) {
    const t = .64; const P = crownPoint(th, t); const N = crownNormal(th, t);
    const m = new THREE.Mesh(ring, mat); m.position.copy(P).addScaledVector(N, .002); m.lookAt(P.clone().add(N));
    const h = new THREE.Mesh(hole, holeMat); h.position.copy(P).addScaledVector(N, .001); h.lookAt(P.clone().add(N));
    grp.add(m, h);
  }
  return grp;
}

/* ---------------- Mallas que siguen la curva del frente (placa, parche) ---------------- */
// tabla: distancia por el perfil frontal -> t
const FRONT_TABLE = (() => { const arr = []; const P = v3(), Q = v3(); let L = 0; crownPoint(0, 0, Q); for (let i = 0; i <= 400; i++) { const t = i / 400; crownPoint(0, t, P); L += P.distanceTo(Q); Q.copy(P); arr.push([L, t]); } return arr; })();
// inversa del arco horizontal: para cada t, tabla de ángulo -> arco
const ARC_T = 120, ARC_TH = 90, ARC = (() => { const a = []; for (let i = 0; i <= ARC_T; i++) { const t = i / ARC_T; const row = []; for (let j = 0; j <= ARC_TH; j++) row.push(arcAt(j / ARC_TH * S1, t, 12)); a.push(row); } return a; })();
export function frontParam(ax, ay) {
  let t = 1; for (const [L, tt] of FRONT_TABLE) { if (L >= ay) { t = tt; break; } }
  const row = ARC[Math.min(ARC_T, Math.round(t * ARC_T))]; const a = Math.abs(ax);
  let j = 1; while (j < ARC_TH && row[j] < a) j++;
  const f = (a - row[j - 1]) / Math.max(1e-6, row[j] - row[j - 1]);
  const th = ((j - 1) + Math.min(1, f)) / ARC_TH * S1;
  return { th: Math.sign(ax) * th, t };
}
export function frontPoint(ax, ay, off = 0, outP = v3(), outN = v3()) {
  const { th, t } = frontParam(ax, ay);
  crownPoint(th, t, outP); crownNormal(th, t, outN);
  return outP.addScaledVector(outN, off);
}
/** Superficie conformada al frente: forma = 'disc' o 'rect' (rectángulo redondeado), con canto. */
export function conformGeometry(shape, cx, cy, w, h, off, depth, n = 48) {
  if (shape === 'disc') return conformDisc(cx, cy, w, off + depth);
  return conformGrid(shape, cx, cy, w, h, off, depth, n);
}
/** Disco perfecto (malla polar) que sigue la curva del frente. */
function conformDisc(cx, cy, d, off, rings = 18, segs = 96) {
  const pos = [], nor = [], uv = [], idx = [];
  const P = v3(), N = v3();
  frontPoint(cx, cy, off, P, N); pos.push(P.x, P.y, P.z); nor.push(N.x, N.y, N.z); uv.push(.5, .5);
  for (let i = 1; i <= rings; i++) {
    const r = i / rings * .5;
    for (let j = 0; j < segs; j++) {
      const a = j / segs * Math.PI * 2; const u = .5 + Math.cos(a) * r, v = .5 + Math.sin(a) * r;
      frontPoint(cx + (u - .5) * d, cy + (v - .5) * d, off, P, N);
      pos.push(P.x, P.y, P.z); nor.push(N.x, N.y, N.z); uv.push(u, v);
    }
  }
  for (let j = 0; j < segs; j++) idx.push(0, 1 + j, 1 + (j + 1) % segs);
  for (let i = 1; i < rings; i++) for (let j = 0; j < segs; j++) {
    const a = 1 + (i - 1) * segs + j, b = 1 + (i - 1) * segs + (j + 1) % segs, c = 1 + i * segs + j, e = 1 + i * segs + (j + 1) % segs;
    idx.push(a, c, b, b, c, e);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}
function conformGrid(shape, cx, cy, w, h, off, depth, n = 48) {
  const pos = [], nor = [], uv = [], idx = [];
  const P = v3(), N = v3();
  const inside = (u, v) => {
    if (shape === 'disc') return Math.hypot(u - .5, v - .5) <= .5;
    const r = .16; const x = Math.abs(u - .5) * w, y = Math.abs(v - .5) * h; const rx = w / 2 - r * Math.min(w, h), ry = h / 2 - r * Math.min(w, h);
    if (x <= rx || y <= ry) return x <= w / 2 && y <= h / 2;
    return Math.hypot(x - rx, y - ry) <= r * Math.min(w, h);
  };
  const map = new Map();
  for (let i = 0; i <= n; i++) for (let j = 0; j <= n; j++) {
    const u = i / n, v = j / n;
    frontPoint(cx + (u - .5) * w, cy + (v - .5) * h, off + depth, P, N);
    map.set(i * (n + 1) + j, pos.length / 3);
    pos.push(P.x, P.y, P.z); nor.push(N.x, N.y, N.z); uv.push(u, v);
  }
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const uc = (i + .5) / n, vc = (j + .5) / n;
    if (!inside(uc, vc)) continue;
    const a = i * (n + 1) + j, b = (i + 1) * (n + 1) + j;
    idx.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}
export function conformRim(shape, cx, cy, w, h, off, depth, n = 96) {
  // canto: une el borde de la pieza con la tela
  const pos = [], nor = [], idx = [];
  const P = v3(), N = v3(), Q = v3();
  for (let i = 0; i <= n; i++) {
    const a = i / n * Math.PI * 2;
    let u, v;
    if (shape === 'disc') { u = .5 + .5 * Math.cos(a); v = .5 + .5 * Math.sin(a); }
    else { const c = Math.cos(a), s = Math.sin(a); const k = 1 / Math.max(Math.abs(c) / .5, Math.abs(s) / .5); const kk = Math.pow(Math.abs(c) ** 5 + Math.abs(s) ** 5, -1 / 5) * .5; u = .5 + c * kk * .98; v = .5 + s * kk * .98; void k; }
    frontPoint(cx + (u - .5) * w, cy + (v - .5) * h, off + depth, P, N);
    frontPoint(cx + (u - .5) * w * 1.02, cy + (v - .5) * h * 1.02, off * .3, Q);
    pos.push(P.x, P.y, P.z, Q.x, Q.y, Q.z);
    const out = v3().subVectors(Q, P).normalize().add(N).normalize();
    nor.push(out.x, out.y, out.z, out.x, out.y, out.z);
  }
  for (let i = 0; i < n; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 2, a + 1, a + 3); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setIndex(idx);
  return g;
}

/* ---------------- Etiqueta hexagonal sobre la visera ---------------- */
export const LABEL = { s: -.38, t: .6, size: .42, rot: -.45 };
function labelGeometry(n = 24) {
  const pos = [], nor = [], uv = [], idx = [];
  const P = v3(), N = v3();
  // ancho de la visera en s y largo en t (aprox, en unidades de mundo) para mapear el cuadrado de la etiqueta
  const ws = visorPoint(1, LABEL.t).distanceTo(visorPoint(-1, LABEL.t)) / 2;
  const lt = visorPoint(LABEL.s, 1).distanceTo(visorPoint(LABEL.s, 0));
  const c = Math.cos(LABEL.rot), sn = Math.sin(LABEL.rot);
  for (let i = 0; i <= n; i++) for (let j = 0; j <= n; j++) {
    const lx = i / n - .5, ly = j / n - .5;
    const x = (lx * c - ly * sn) * LABEL.size, y = (lx * sn + ly * c) * LABEL.size;
    const s = LABEL.s + x / ws, t = LABEL.t - y / lt;
    visorPoint(s, t, P); visorNormal(s, t, N); P.addScaledVector(N, .0025);
    pos.push(P.x, P.y, P.z); nor.push(N.x, N.y, N.z); uv.push(i / n, j / n);
  }
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { const a = i * (n + 1) + j, b = (i + 1) * (n + 1) + j; idx.push(a, b, a + 1, b, b + 1, a + 1); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

/** Construye la gorra. mats: { crown, mesh, front, visorTop, visorBottom, edge, sweat, button, eyelet, hole, plastic, label } */
/** Ribete: tubo delgado que sigue una curva (borde inferior de la copa y arco del snapback). */
function bindingGeometry(points, radius = .011, radial = 10) {
  const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
  return new THREE.TubeGeometry(curve, points.length * 2, radius, radial, false);
}
export function baseBindingPoints() {
  const pts = []; const P = v3();
  for (let i = 0; i <= 160; i++) { const th = -Math.PI + i / 160 * Math.PI * 2; if (archStart(th) > 0) continue; crownPoint(th, .004, P); pts.push(P.clone().add(v3().set(P.x, 0, P.z - CAP.zA).normalize().multiplyScalar(.004))); }
  // dos tramos (el hueco del snapback queda abierto): se ordena desde un extremo del arco
  const k = pts.findIndex((p, i) => i > 0 && p.distanceTo(pts[i - 1]) > .2);
  return k > 0 ? [...pts.slice(k), ...pts.slice(0, k)] : pts;
}
export function archBindingPoints() {
  const pts = []; const P = v3();
  for (let i = 0; i <= 60; i++) { const th = Math.PI - ARCH.w + i / 60 * ARCH.w * 2; crownPoint(th, archStart(th) + .004, P); pts.push(P.clone()); }
  return pts;
}

/** Vivo (piping) en relieve sobre cada costura, de la base al botón. */
function seamWeltPoints(th) {
  const pts = []; const P = v3(), N = v3(); const t0 = Math.abs(Math.abs(th) - Math.PI) < 1e-6 ? ARCH.t + .01 : .012;
  for (let i = 0; i <= 70; i++) { const t = t0 + (.962 - t0) * i / 70; crownPoint(th, t, P); crownNormal(th, t, N); pts.push(P.clone().addScaledVector(N, .0035)); }
  return pts;
}

export function buildCap(mats) {
  const cap = new THREE.Group(); cap.name = 'cap';
  const parts = {};
  const mk = (name, geo, mat) => { const m = new THREE.Mesh(geo, mat); m.name = name; parts[name] = m; cap.add(m); return m; };
  mk('front', panelGeometry(PANELS.front, 84, 54), mats.front);
  for (const k of ['sideL', 'sideR', 'backL', 'backR']) mk(k, panelGeometry(PANELS[k], 46, 54), mats.crown);
  mk('visorTop', visorGeometry(80, 28, false), mats.visorTop);
  mk('visorBottom', visorGeometry(80, 28, true), mats.visorBottom);
  mk('visorEdge', visorEdgeGeometry(), mats.edge);
  mk('sweat', sweatbandGeometry(), mats.sweat);
  const btn = new THREE.SphereGeometry(.068, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2); btn.scale(1, .5, 1);
  const b = mk('button', btn, mats.button); b.position.set(0, CAP.H - .006, CAP.zA);
  parts.eyelets = eyelets(mats.eyelet, mats.hole); cap.add(parts.eyelets);
  parts.snap = snapbackGroup(mats.plastic); cap.add(parts.snap);
  mk('label', labelGeometry(), mats.label);
  for (const th of [-S1, S1, -S2, S2, Math.PI]) mk(`welt${Math.round(th * 100)}`, bindingGeometry(seamWeltPoints(th), .0095, 10), mats.crown);
  mk('bindArch', bindingGeometry(archBindingPoints(), .013), mats.crown);
  cap.position.y = -.5;
  cap.rotation.x = -.09; // pose de foto de producto: la parte de atrás un poco más baja
  return { cap, parts };
}
