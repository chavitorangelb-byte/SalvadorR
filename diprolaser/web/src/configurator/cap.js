// Gorra estructurada A-frame de 5 paneles, construida en código a partir de las fotos de fábrica:
// frente de una sola pieza, 2 laterales y 2 traseros, costuras hundidas, botón, ojales bordados,
// abertura trasera con snapback, visera precurva con grosor y canto, banda interior y etiqueta hexagonal.
import * as THREE from 'three';

export const CAP = { Rx: .93, Rz: 1.04, H: 1.16, zA: -.24 };
// costuras (radianes desde el frente): frente/lateral, lateral/trasero, centro trasero
const S1 = 60 * Math.PI / 180, S2 = 126 * Math.PI / 180;
export const PANELS = {
  front: [-S1, S1],
  sideL: [S1, S2], sideR: [-S2, -S1],
  backL: [S2, Math.PI], backR: [-Math.PI, -S2],
};
const SEAMS = [-Math.PI, -S2, -S1, S1, S2, Math.PI];
const ARCH = { w: .40, t: .21 };
const lerp = (a, b, k) => a + (b - a) * k;
const v3 = () => new THREE.Vector3();

export function basePoint(th, out = v3()) {
  // superelipse: frente más plano (A-frame), atrás más redondo
  const e = lerp(1, .78, ((1 + Math.cos(th)) / 2) ** 1.5);
  const s = Math.sin(th), c = Math.cos(th);
  return out.set(CAP.Rx * Math.sign(s) * Math.abs(s) ** e, 0, CAP.Rz * Math.sign(c) * Math.abs(c) ** e);
}
const _B = v3(), _D = v3(), _P1 = v3(), _P2 = v3(), _A = v3();
function crownRaw(th, t, out) {
  basePoint(th, _B);
  const w = (1 + Math.cos(th)) / 2; // 1 = frente, 0 = atrás
  const h1 = lerp(.38, 1.0, w ** .95), r2 = lerp(.72, .5, w ** .8);
  _D.set(_B.x, 0, _B.z - CAP.zA).normalize();
  _A.set(0, CAP.H, CAP.zA);
  _P1.copy(_B).addScaledVector(_D, -lerp(.01, .09, w)); _P1.y += h1;
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
  crownRaw(th, t, out);
  const r = Math.hypot(out.x, out.z - CAP.zA);
  const d = seamDistance(th, r);
  const g = Math.exp(-((d / .013) ** 2)) * .009 * (1 - Math.max(0, (t - .86) / .14));
  if (g > 1e-5) { _o.set(out.x, 0, out.z - CAP.zA).normalize(); out.addScaledVector(_o, -g * .8); out.y -= g * .5 * t; }
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
  return d < ARCH.w ? ARCH.t * Math.sqrt(1 - (d / ARCH.w) ** 2) : 0;
}

/** Malla de un panel. Atributos: uv = (arco horizontal, distancia por el perfil) en unidades de mundo,
 *  aSt = (distancia a la costura, a lo largo de la costura, distancia al borde inferior, arco). */
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
      const r = Math.hypot(P.x, P.z - CAP.zA);
      const sd = Math.min(Math.abs(th - th0), Math.abs(th1 - th)) * r;
      pos.push(P.x, P.y, P.z); nor.push(N.x, N.y, N.z);
      uv.push(th * r, along);
      st.push(sd, along, along, th * r);
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
export const VIS = { thIn: 72 * Math.PI / 180, thOut: 80 * Math.PI / 180, Ox: 1.02, Oz: 1.84, drop: .2, curve: .3, thick: .03 };
const _I = v3(), _O = v3();
export function visorPoint(s, t, out = v3()) {
  basePoint(s * VIS.thIn, _I).multiplyScalar(.985);
  const a = s * VIS.thOut;
  _O.set(VIS.Ox * Math.sin(a), 0, VIS.Oz * Math.cos(a));
  out.copy(_I).lerp(_O, t);
  out.y = -VIS.drop * t - VIS.curve * out.x * out.x * t ** .85;
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
    const s = lerp(-1, 1, i / nu);
    for (let j = 0; j <= nv; j++) {
      const t = j / nv;
      visorPoint(s, t, P); visorNormal(s, t, N);
      const th = VIS.thick * lerp(1, .7, t);
      if (bottom) { P.addScaledVector(N, -th); N.negate(); }
      pos.push(P.x, P.y, P.z); nor.push(N.x, N.y, N.z);
      uv.push(s, t);
      st.push(0, 0, 0, 0);
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
  const path = [];
  for (let i = 0; i <= n; i++) path.push([lerp(-1, 1, i / n), 1]);
  const pos = [], nor = [], uv = [], idx = [];
  const P = v3(), N = v3(), T = v3(), Q = v3(), out = v3();
  path.forEach(([s, t], i) => {
    visorPoint(s, t, P); visorNormal(s, t, N);
    visorPoint(Math.min(1, s + .01), t, Q).sub(visorPoint(Math.max(-1, s - .01), t, out));
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
    for (const y of [-.004, .09]) { pos.push(P.x, y, P.z); nor.push(nx / l, 0, nz / l); uv.push(i / n, y); }
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
export function frontParam(ax, ay) {
  let t = 1; for (const [L, tt] of FRONT_TABLE) { if (L >= ay) { t = tt; break; } }
  const P = crownRaw(0, t, v3()); const r = Math.hypot(P.x, P.z - CAP.zA);
  return { th: ax / r, t };
}
export function frontPoint(ax, ay, off = 0, outP = v3(), outN = v3()) {
  const { th, t } = frontParam(ax, ay);
  crownPoint(th, t, outP); crownNormal(th, t, outN);
  return outP.addScaledVector(outN, off);
}
/** Superficie conformada al frente: forma = 'disc' o 'rect' (rectángulo redondeado), con canto. */
export function conformGeometry(shape, cx, cy, w, h, off, depth, n = 48) {
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
  cap.position.y = -.5;
  return { cap, parts };
}
