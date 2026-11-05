// Linea de tinta: cinta en espacio de pantalla con nucleo negro, contorno plata (como el logo),
// brillo humedo y borde ligeramente irregular. Se dibuja por longitud de arco [cola, cabeza].
import * as THREE from './vendor/three.module.js';

const VERT = /* glsl */`
attribute float aV; attribute float aU; attribute vec2 aT;
varying float vV; varying float vU; varying vec2 vT;
void main(){ vV = aV; vU = aU; vT = aT; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const FRAG = /* glsl */`
precision highp float;
varying float vV; varying float vU; varying vec2 vT;
uniform vec3 uCore; uniform vec3 uRim; uniform vec3 uHi; uniform vec2 uLight; uniform float uOpacity;
float h1(float n){ return fract(sin(n) * 43758.5453); }
float n1(float x){ float i = floor(x), f = fract(x); return mix(h1(i), h1(i + 1.0), f * f * (3.0 - 2.0 * f)); }
void main(){
  float a = abs(vV);
  float edge = 1.0 - 0.085 * (n1(vU * 0.09) - 0.5) * 2.0 - 0.035 * (n1(vU * 0.37 + 11.0) - 0.5);
  float aa = fwidth(vV) * 1.25;
  float alpha = 1.0 - smoothstep(edge - aa, edge + aa, a);
  float rim = smoothstep(0.60 * edge, 0.80 * edge, a);
  vec3 col = mix(uCore, uRim, rim * 0.9);
  float sheen = exp(-pow((vV + 0.30) / 0.20, 2.0));
  float facing = 0.35 + 0.65 * max(0.0, dot(normalize(vT + 1e-5), uLight));
  col += uHi * sheen * 0.55 * facing * (1.0 - rim);
  gl_FragColor = vec4(col, alpha * uOpacity);
}`;

const lin = (hex) => new THREE.Color(hex).convertSRGBToLinear();

export class InkStroke {
  constructor(max = 4096) {
    this.max = max;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(max * 2 * 3), 3));
    g.setAttribute('aV', new THREE.BufferAttribute(new Float32Array(max * 2), 1));
    g.setAttribute('aU', new THREE.BufferAttribute(new Float32Array(max * 2), 1));
    g.setAttribute('aT', new THREE.BufferAttribute(new Float32Array(max * 2 * 2), 2));
    const idx = new Uint32Array((max - 1) * 6);
    for (let i = 0; i < max - 1; i++) {
      const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
      idx.set([a, b, c, b, d, c], i * 6);
    }
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    g.setDrawRange(0, 0);
    this.mat = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide,
      uniforms: {
        uCore: { value: lin('#0b0b0b') }, uRim: { value: lin('#C9C9C9') }, uHi: { value: lin('#EDEAE6') },
        uLight: { value: new THREE.Vector2(0.6, -0.8).normalize() }, uOpacity: { value: 1 },
      },
    });
    this.mesh = new THREE.Mesh(g, this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 20;
  }

  // pts: [[x,y],...] en px del cuadro (y hacia abajo). Dibuja el tramo [s0, s1] de la longitud de arco.
  set(pts, s0, s1, halfW, { opacity = 1, headTaper = 22, tailTaper = 26, seed = 1 } = {}) {
    const g = this.mesh.geometry;
    if (!pts || pts.length < 2 || s1 - s0 < 0.5 || opacity <= 0.001) { g.setDrawRange(0, 0); this.mesh.visible = false; return; }
    this.mesh.visible = true;
    this.mat.uniforms.uOpacity.value = opacity;
    // longitudes acumuladas
    const cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    const L = cum[cum.length - 1];
    s0 = Math.max(0, s0); s1 = Math.min(L, s1);
    if (s1 - s0 < 0.5) { g.setDrawRange(0, 0); this.mesh.visible = false; return; }
    const step = 2.2;
    const n = Math.min(this.max, Math.max(2, Math.ceil((s1 - s0) / step) + 1));
    const P = g.attributes.position.array, V = g.attributes.aV.array, U = g.attributes.aU.array, TT = g.attributes.aT.array;
    let j = 1;
    const at = (s) => {
      while (j < cum.length - 1 && cum[j] < s) j++;
      while (j > 1 && cum[j - 1] > s) j--;
      const k = (s - cum[j - 1]) / Math.max(1e-6, cum[j] - cum[j - 1]);
      const a = pts[j - 1], b = pts[j];
      return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, b[0] - a[0], b[1] - a[1]];
    };
    for (let i = 0; i < n; i++) {
      const s = s0 + (s1 - s0) * (i / (n - 1));
      const [x, y, tx0, ty0] = at(s);
      const tl = Math.hypot(tx0, ty0) || 1;
      const tx = tx0 / tl, ty = ty0 / tl;
      const head = Math.min(1, (s1 - s) / headTaper), tail = Math.min(1, (s - s0) / tailTaper);
      const press = 0.9 + 0.1 * Math.sin(s * 0.021 + seed * 3.1) + 0.05 * Math.sin(s * 0.057 + seed);
      const w = halfW * (0.16 + 0.84 * Math.sqrt(head)) * (0.25 + 0.75 * Math.sqrt(tail)) * press;
      const nx = -ty, ny = tx;
      P.set([x + nx * w, -(y + ny * w), 0, x - nx * w, -(y - ny * w), 0], i * 6);
      V.set([1, -1], i * 2);
      U.set([s, s], i * 2);
      TT.set([tx, -ty, tx, -ty], i * 4);
    }
    g.attributes.position.needsUpdate = true; g.attributes.aV.needsUpdate = true;
    g.attributes.aU.needsUpdate = true; g.attributes.aT.needsUpdate = true;
    g.setDrawRange(0, (n - 1) * 6);
    return L;
  }
}

export const pathLength = (pts) => { let L = 0; for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); return L; };

// Curva suave por puntos de control (Catmull-Rom)
export function smoothPath(ctrl, perSeg = 16) {
  const out = [];
  for (let i = 0; i < ctrl.length - 1; i++) {
    const p0 = ctrl[Math.max(0, i - 1)], p1 = ctrl[i], p2 = ctrl[i + 1], p3 = ctrl[Math.min(ctrl.length - 1, i + 2)];
    for (let k = 0; k < perSeg; k++) {
      const t = k / perSeg, t2 = t * t, t3 = t2 * t;
      out.push([0, 1].map((d) => 0.5 * ((2 * p1[d]) + (-p0[d] + p2[d]) * t + (2 * p0[d] - 5 * p1[d] + 4 * p2[d] - p3[d]) * t2 + (-p0[d] + 3 * p1[d] - 3 * p2[d] + p3[d]) * t3)));
    }
  }
  out.push(ctrl[ctrl.length - 1]);
  return out;
}

// Circulo a mano alzada alrededor de un rect (px CSS o px de cuadro). 1.12 vueltas, leve espiral.
export function handCircle(cx, cy, rx, ry, { start = -1.95, turns = 1.12, n = 120, wobble = 0.035, seed = 2 } = {}) {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const k = i / n, a = start + k * turns * Math.PI * 2;
    const r = 1 + wobble * Math.sin(a * 2 + seed) + 0.05 * (k - 0.5);
    out.push([cx + Math.cos(a) * rx * r, cy + Math.sin(a) * ry * r * (1 - 0.04 * k)]);
  }
  return out;
}
