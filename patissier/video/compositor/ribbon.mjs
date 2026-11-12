// La cinta de satén: una sola tira con grosor real (sección elíptica) que sigue una curva 3D.
// Las formas (latigazo, moño sobre la caja, marco del teléfono) son muestreos de la misma longitud,
// así la cinta pasa de una a otra sin cortes: es siempre la misma malla.
import * as THREE from './vendor/three.module.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
export const NP = 520;        // anillos a lo largo
const MR = 10;                // vértices por anillo

// ---- utilidades de curvas ----
function bez(p0, p1, p2, p3, n, out, bh0, bh1) {
  for (let i = 0; i < n; i++) { const t = i / n, a = 1 - t;
    out.push({ p: V(0, 0, 0).addScaledVector(p0, a * a * a).addScaledVector(p1, 3 * a * a * t).addScaledVector(p2, 3 * a * t * t).addScaledVector(p3, t * t * t),
      b: bh0.clone().lerp(bh1, t) }); }
}
function line(p0, p1, n, out, b) { for (let i = 0; i < n; i++) out.push({ p: p0.clone().lerp(p1, i / n), b: b.clone() }); }
// remuestreo uniforme por longitud de arco -> { P: Float32Array, B: Float32Array, len }
export function resample(pts, n = NP) {
  const L = [0];
  for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + pts[i].p.distanceTo(pts[i - 1].p));
  const len = L[L.length - 1], P = new Float32Array(n * 3), B = new Float32Array(n * 3);
  let j = 0; const tp = V(0, 0, 0), tb = V(0, 0, 0);
  for (let i = 0; i < n; i++) { const s = len * i / (n - 1);
    while (j < L.length - 2 && L[j + 1] < s) j++;
    const k = L[j + 1] > L[j] ? (s - L[j]) / (L[j + 1] - L[j]) : 0;
    tp.copy(pts[j].p).lerp(pts[j + 1].p, k); tb.copy(pts[j].b).lerp(pts[j + 1].b, k).normalize();
    P.set([tp.x, tp.y, tp.z], i * 3); B.set([tb.x, tb.y, tb.z], i * 3); }
  return { P, B, len, n };
}

// ---- moño sobre la caja (coordenadas locales de la caja; y arriba, tapa en y = h) ----
// Topología real de una sola cinta: punta 1 -> nudo -> rodea la caja -> lazo izq -> nudo -> lazo der -> nudo -> punta 2
export function bowOnBox({ bw, bh, bd }, loop = 1, lift = 1) {
  const a = bw / 2 + 0.035, h = bh / 2 + 0.03, hb = -bh / 2 - 0.03, pts = [];
  const c = V(0, h + 0.10, 0), Z = V(0, 0, 1), U = V(0, 1, 0);
  // con la caja en isométrico, D apunta a la derecha del cuadro y E hacia la cámara
  const D = V(1, 0, 1).normalize(), E = V(-1, 0, 1).normalize();
  const at = (d, e, y) => V(0, 0, 0).addScaledVector(D, d).addScaledVector(E, e).add(V(0, y, 0));
  const t1 = at(-0.80, 1.62, h + 0.03), t2 = at(0.92, 1.42, h + 0.03);
  const b1 = at(0.92, 0.42, 0).normalize(), b2 = at(0.86, -0.50, 0).normalize();      // ancho de cada punta
  // punta 1 -> nudo
  bez(t1.clone().add(V(0, 0.20 * lift, 0)), t1.clone().add(at(0.10, -0.42, -0.04)), c.clone().add(at(-0.42, 0.62, 0.30 * lift)), c, 30, pts, b1, D);
  // nudo -> por la tapa a la izquierda -> baja -> por debajo -> sube por la derecha -> vuelve al nudo
  line(c, V(-a + 0.12, h, 0), 16, pts, Z);
  bez(V(-a + 0.12, h, 0), V(-a, h, 0), V(-a, h, 0), V(-a, h - 0.12, 0), 6, pts, Z, Z);
  line(V(-a, h - 0.12, 0), V(-a, hb + 0.12, 0), 16, pts, Z);
  bez(V(-a, hb + 0.12, 0), V(-a, hb, 0), V(-a, hb, 0), V(-a + 0.12, hb, 0), 6, pts, Z, Z);
  line(V(-a + 0.12, hb, 0), V(a - 0.12, hb, 0), 30, pts, Z);
  bez(V(a - 0.12, hb, 0), V(a, hb, 0), V(a, hb, 0), V(a, hb + 0.12, 0), 6, pts, Z, Z);
  line(V(a, hb + 0.12, 0), V(a, h - 0.12, 0), 16, pts, Z);
  bez(V(a, h - 0.12, 0), V(a, h, 0), V(a, h, 0), V(a - 0.12, h, 0), 6, pts, Z, Z);
  line(V(a - 0.12, h, 0), c, 16, pts, Z);
  // lazos: dos gotas llenas, levantadas, una a cada lado del nudo; la cara de la cinta mira hacia arriba
  const L = 1.55 * loop, Hh = 1.0 * loop * lift;
  const lobe = (sg, y0, y1) => bez(c.clone().add(V(0, y0, 0)), c.clone().add(at(sg * L * 1.62, 0.34, -0.10)), c.clone().add(at(sg * L * 0.98, -0.30, Hh * 1.72)), c.clone().add(V(0, y1, 0)), 52, pts, E, E);
  lobe(-1, 0, 0.05); lobe(1, 0.05, 0.10);
  // nudo -> punta 2
  bez(c.clone().add(V(0, 0.10, 0)), c.clone().add(at(0.46, 0.60, 0.30 * lift)), t2.clone().add(at(-0.12, -0.42, -0.04)), t2.clone().add(V(0, 0.20 * lift, 0)), 30, pts, D, b2);
  pts.push({ p: t2.clone().add(V(0, 0.20 * lift, 0)), b: b2.clone() });
  return pts;
}
export const BOW_KNOT = (dims) => V(0, dims.bh / 2 + 0.16, 0);

// ---- marco del teléfono: rectángulo redondeado en el plano xy, cinta de canto (ancho en z) ----
export function phoneFrame(hx, hy, r) {
  const pts = [], Z = V(0, 0, 1), seg = (x0, y0, x1, y1, n) => line(V(x0, y0, 0), V(x1, y1, 0), n, pts, Z);
  const arc = (cx, cy, a0, n) => { for (let i = 0; i < n; i++) { const a = a0 - (Math.PI / 2) * i / n; pts.push({ p: V(cx + r * Math.cos(a), cy + r * Math.sin(a), 0), b: Z.clone() }); } };
  // empieza abajo al centro, sube por la izquierda (sentido horario)
  seg(0, -hy, -hx + r, -hy, 12); arc(-hx + r, -hy + r, -Math.PI / 2, 12);
  seg(-hx, -hy + r, -hx, hy - r, 40); arc(-hx + r, hy - r, Math.PI, 12);
  seg(-hx + r, hy, hx - r, hy, 22); arc(hx - r, hy - r, Math.PI / 2, 12);
  seg(hx, hy - r, hx, -hy + r, 40); arc(hx - r, -hy + r, 0, 12);
  seg(hx - r, -hy, 0, -hy, 12); pts.push({ p: V(0, -hy, 0), b: Z.clone() });
  return pts;
}

// ---- malla ----
export class Ribbon {
  constructor() {
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(NP * MR * 3); this.nor = new Float32Array(NP * MR * 3); this.tan = new Float32Array(NP * MR * 3);
    const uv = new Float32Array(NP * MR * 2), idx = [];
    for (let i = 0; i < NP; i++) for (let j = 0; j < MR; j++) { uv[(i * MR + j) * 2] = i / (NP - 1); uv[(i * MR + j) * 2 + 1] = j / MR; }
    for (let i = 0; i < NP - 1; i++) for (let j = 0; j < MR; j++) { const a = i * MR + j, b = i * MR + (j + 1) % MR, c = a + MR, d = b + MR; idx.push(a, c, b, b, c, d); }
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(this.nor, 3));
    g.setAttribute('aTan', new THREE.BufferAttribute(this.tan, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setIndex(idx);
    this.mat = new THREE.ShaderMaterial({ side: THREE.DoubleSide,
      uniforms: { uL: { value: V(-0.52, 0.72, 0.46).normalize() }, uLen: { value: 22 }, uDim: { value: 1 } },
      vertexShader: /* glsl */`
        attribute vec3 aTan; varying vec3 vN, vT, vW; varying vec2 vUv;
        void main(){ vN = normal; vT = aTan; vUv = uv; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: /* glsl */`
        precision highp float; varying vec3 vN, vT, vW; varying vec2 vUv;
        uniform vec3 uL; uniform float uLen, uDim;
        float h1(float x){ return fract(sin(x * 127.1) * 43758.5453); }
        void main(){
          vec3 N = normalize(vN), T = normalize(vT), Vd = normalize(cameraPosition - vW);
          if (dot(N, Vd) < 0.0) N = -N;
          vec3 Bn = normalize(cross(N, T));
          float across = cos(vUv.y * 6.2831853);                 // -1..1 a lo ancho (bordes en +-1)
          // satén café: base profunda, brillo anisótropo a lo largo del hilo, velo rosado al ras
          vec3 base = vec3(0.088, 0.047, 0.030);
          float nl = dot(N, uL), diff = clamp(nl * 0.6 + 0.4, 0.0, 1.0);
          vec3 H = normalize(uL + Vd);
          float tH = dot(T, H), bH = dot(Bn, H);
          float warp = pow(sqrt(max(1.0 - tH * tH, 0.0)), 46.0);  // hilos a lo largo
          float weft = pow(sqrt(max(1.0 - bH * bH, 0.0)), 14.0);  // hilos a lo ancho (más suave)
          float nh = max(dot(N, H), 0.0);
          float weave = 0.86 + 0.14 * sin(across * 150.0) * sin(vUv.x * uLen * 60.0);
          float thread = 0.93 + 0.07 * h1(floor(across * 70.0));
          vec3 col = base * (0.30 + 1.05 * diff * diff) * thread;
          col += vec3(1.0, 0.80, 0.66) * (0.50 * warp * pow(nh, 2.0) + 0.14 * weft * nh) * weave * smoothstep(-0.1, 0.4, nl);
          float fr = pow(1.0 - max(dot(N, Vd), 0.0), 3.0);
          col += vec3(0.60, 0.34, 0.28) * fr * 0.16;
          // reflejo de la ventana (arriba a la izquierda) y del piso
          vec3 R = reflect(-Vd, N);
          col += vec3(0.95, 0.86, 0.76) * 0.20 * smoothstep(0.55, 0.95, dot(R, normalize(vec3(-0.45, 0.8, 0.4))));
          
          // dobladillo: borde enrollado con su propia luz
          float hem = smoothstep(0.90, 0.975, abs(across));
          col = mix(col, col * 0.62 + vec3(0.20, 0.14, 0.10) * diff, hem * 0.7);
          gl_FragColor = vec4(col * uDim, 1.0);
        }` });
    this.mesh = new THREE.Mesh(g, this.mat); this.mesh.frustumCulled = false; this.mesh.castShadow = true;
    this._t = V(0, 0, 0); this._n = V(0, 0, 0); this._b = V(0, 0, 0); this._p = V(0, 0, 0); this._q = V(0, 0, 0);
  }
  // P, Bh: Float32Array(NP*3) con el centro y la dirección de ancho deseada; w(i), th(i): medio ancho y medio grosor
  update(P, Bh, w, th, lenWorld) {
    const { pos, nor, tan, _t: T, _n: N, _b: B, _p: A, _q: Q } = this;
    for (let i = 0; i < NP; i++) {
      const i0 = Math.max(0, i - 1) * 3, i1 = Math.min(NP - 1, i + 1) * 3, o = i * 3;
      T.set(P[i1] - P[i0], P[i1 + 1] - P[i0 + 1], P[i1 + 2] - P[i0 + 2]);
      if (T.lengthSq() < 1e-12) T.set(1, 0, 0); T.normalize();
      B.set(Bh[o], Bh[o + 1], Bh[o + 2]);
      N.crossVectors(T, B); if (N.lengthSq() < 1e-8) N.set(0, 1, 0); N.normalize();
      B.crossVectors(N, T).normalize();
      const wi = typeof w === 'function' ? w(i / (NP - 1)) : w, ti = typeof th === 'function' ? th(i / (NP - 1)) : th;
      for (let j = 0; j < MR; j++) {
        const a = (j / MR) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a), k = (i * MR + j) * 3;
        // sección: elipse muy achatada (cinta con grosor y bordes enrollados)
        pos[k] = P[o] + B.x * wi * ca + N.x * ti * sa; pos[k + 1] = P[o + 1] + B.y * wi * ca + N.y * ti * sa; pos[k + 2] = P[o + 2] + B.z * wi * ca + N.z * ti * sa;
        const nx = ca / wi, ny = sa / ti, il = 1 / Math.hypot(nx, ny);
        nor[k] = (B.x * nx + N.x * ny) * il; nor[k + 1] = (B.y * nx + N.y * ny) * il; nor[k + 2] = (B.z * nx + N.z * ny) * il;
        tan[k] = T.x; tan[k + 1] = T.y; tan[k + 2] = T.z;
      }
    }
    const g = this.mesh.geometry; g.attributes.position.needsUpdate = true; g.attributes.normal.needsUpdate = true; g.attributes.aTan.needsUpdate = true;
    this.mat.uniforms.uLen.value = lenWorld;
  }
}
