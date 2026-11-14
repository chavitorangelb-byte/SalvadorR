// Compositor determinista frame(t) del video de Colors Boutique.
// Three.js (WebGL2 por software). Un solo plano continuo: una camara, un campo liquido (SDF) y un tallo.
// 8 subcuadros por cuadro (obturador de 180 grados) acumulados en float.
// API: window.renderFrame(f) deja el cuadro en el canvas.
import * as THREE from '../../../video/compositor/vendor/three.module.js';
import * as TL from '../timeline/timeline.mjs';
import { InkStroke, smoothPath, pathLength } from './stroke.mjs';
import { layoutFor } from './layout.mjs';

const { T, clamp, lerp, prog, easeInOut, easeOut, easeIn, spring, smooth } = TL;
const qs = new URLSearchParams(location.search);
const FORMAT = qs.get('format') || '916';
const SCALE = Number(qs.get('scale') || 1);
const SUBS = Number(qs.get('subs') || 8);
const SAFE = qs.has('safe');
const LY = layoutFor(FORMAT);
const W = LY.W, H = LY.H;
const RW = Math.round(W * SCALE), RH = Math.round(H * SCALE);
const CAP = '../build/capture/', IMG = '../../site/img/', FONTS = '../../site/fonts/';
const deg = Math.PI / 180;
const WHITE = '#F7F2FA', ROSE = '#F3B9D2', LAV = '#B592D6', PLUM = '#1E1226';
const lin = (hex) => new THREE.Color(hex).convertSRGBToLinear();
const fetchJSON = (u) => fetch(u).then((r) => r.json());
async function bitmap(url) { return createImageBitmap(await (await fetch(url)).blob()); }
function texFrom(img, mips = true) {
  const t = new THREE.Texture(img);
  t.flipY = false; t.colorSpace = THREE.SRGBColorSpace; t.generateMipmaps = mips;
  t.minFilter = mips ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter; t.magFilter = THREE.LinearFilter;
  t.anisotropy = 4; t.needsUpdate = true; return t;
}

// ---------- arranque ----------
const canvas = document.createElement('canvas');
canvas.width = RW; canvas.height = RH; canvas.style.width = RW + 'px'; canvas.style.height = RH + 'px';
document.body.appendChild(canvas);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true, alpha: false });
renderer.setPixelRatio(1); renderer.setSize(RW, RH, false); renderer.autoClear = false; renderer.toneMapping = THREE.NoToneMapping;

const [vo, rects] = await Promise.all([fetchJSON('../timeline/vo_words.json'), fetchJSON(CAP + 'rects.json')]);
for (const f of [
  new FontFace('Jost', `url(${FONTS}jost-latin-500-normal.woff2)`, { weight: '500' }),
  new FontFace('Jost', `url(${FONTS}jost-latin-600-normal.woff2)`, { weight: '600' }),
  new FontFace('Playfair', `url(${FONTS}playfair-display-latin-500-italic.woff2)`, { weight: '500', style: 'italic' }),
  new FontFace('Playfair', `url(${FONTS}playfair-display-latin-600-normal.woff2)`, { weight: '600' }),
]) document.fonts.add(await f.load());
const vw = (ref) => TL.voWord(vo, ref);

const rtOpts = { type: THREE.HalfFloatType, colorSpace: THREE.LinearSRGBColorSpace, depthBuffer: true };
const rtScene = new THREE.WebGLRenderTarget(RW, RH, { ...rtOpts });
const rtAcc = new THREE.WebGLRenderTarget(RW, RH, { ...rtOpts, depthBuffer: false });
const rtQ1 = new THREE.WebGLRenderTarget(RW >> 2, RH >> 2, { ...rtOpts, depthBuffer: false });
const rtQ2 = new THREE.WebGLRenderTarget(RW >> 2, RH >> 2, { ...rtOpts, depthBuffer: false });
const quadGeo = new THREE.PlaneGeometry(2, 2);
const orthoNDC = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
function fsPass(frag, uniforms, transparent = false) {
  const m = new THREE.ShaderMaterial({ uniforms, depthTest: false, depthWrite: false, transparent,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }', fragmentShader: frag });
  const mesh = new THREE.Mesh(quadGeo, m); mesh.frustumCulled = false;
  const sc = new THREE.Scene(); sc.add(mesh);
  return { scene: sc, mat: m };
}
const RES = new THREE.Vector2(W, H), JIT = new THREE.Vector2();

// ---------- fondo: ciruela profunda con luces lavanda y rosa (sin azul) ----------
const backdrop = fsPass(/* glsl */`
precision highp float; varying vec2 vUv;
uniform float uT; uniform vec2 uPar; uniform float uAspect; uniform float uLift;
float g(vec2 p, vec2 c, vec2 r){ vec2 d = (p - c) / r; return exp(-dot(d, d)); }
void main(){
  vec2 q = vec2((vUv.x - 0.5) * uAspect, vUv.y - 0.5);
  vec3 plum = vec3(0.0130, 0.0060, 0.0194);                       // #1E1226 lineal
  vec3 lav = vec3(0.462, 0.287, 0.672), rose = vec3(0.807, 0.352, 0.521);
  vec3 col = plum * mix(0.62, 1.05, smoothstep(-0.5, 0.5, q.y));
  col += lav * 0.026 * g(q, vec2(-0.26 + 0.03 * sin(uT * 0.31), 0.30) + uPar * 0.55, vec2(0.42, 0.30));
  col += rose * 0.014 * g(q, vec2(0.30 + 0.03 * cos(uT * 0.23), -0.18) + uPar * 0.40, vec2(0.36, 0.40));
  col += lav * 0.013 * g(q, vec2(-0.10, -0.40 + 0.02 * sin(uT * 0.37)) + uPar * 0.75, vec2(0.50, 0.22));
  col += lav * 0.008 * g(q, vec2(0.16 + 0.02 * sin(uT * 0.19), 0.06) + uPar * 0.25, vec2(0.70, 0.55));
  col *= 1.0 + uLift * 0.6;
  float vig = smoothstep(1.2, 0.2, length(q * vec2(1.0, 0.85)));
  col *= mix(0.5, 1.0, vig);
  gl_FragColor = vec4(col, 1.0);
}`, { uT: { value: 0 }, uPar: { value: new THREE.Vector2() }, uAspect: { value: W / H }, uLift: { value: 0 } });

// ---------- escena 3D ----------
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(LY.fov, W / H, 0.5, 300);
const FPX = (H / 2) / Math.tan((LY.fov / 2) * deg);
function rrPath(target, w, h, r) {
  const x0 = -w / 2, y0 = -h / 2, x1 = w / 2, y1 = h / 2;
  target.moveTo(x0 + r, y0); target.lineTo(x1 - r, y0); target.absarc(x1 - r, y0 + r, r, -Math.PI / 2, 0, false);
  target.lineTo(x1, y1 - r); target.absarc(x1 - r, y1 - r, r, 0, Math.PI / 2, false);
  target.lineTo(x0 + r, y1); target.absarc(x0 + r, y1 - r, r, Math.PI / 2, Math.PI, false);
  target.lineTo(x0, y0 + r); target.absarc(x0 + r, y0 + r, r, Math.PI, Math.PI * 1.5, false);
  return target;
}
function matcapTex(stops, spot) {
  const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
  const g = x.createRadialGradient(92, 80, 4, 128, 128, 128);
  stops.forEach(([o, col]) => g.addColorStop(o, col));
  x.fillStyle = g; x.fillRect(0, 0, 256, 256);
  if (spot) { x.globalAlpha = spot.a; x.fillStyle = spot.c; x.beginPath(); x.ellipse(spot.x, spot.y, spot.rx, spot.ry, spot.rot, 0, Math.PI * 2); x.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
// cristal lavanda (cantos de tarjetas y marco del telefono): luz fija arriba-izquierda
const glassEdge = new THREE.MeshMatcapMaterial({ matcap: matcapTex(
  [[0, '#ffffff'], [0.12, '#efe2fa'], [0.36, '#b592d6'], [0.66, '#5d3f7c'], [0.88, '#2c1a3c'], [1, '#8d6bb0']],
  { x: 176, y: 190, rx: 34, ry: 9, rot: -0.6, c: '#f7f2fa', a: 0.45 }) });
const phoneGlass = new THREE.MeshMatcapMaterial({ matcap: matcapTex([[0, '#6b5480'], [0.18, '#2a1a36'], [0.6, '#140b1b'], [1, '#3a2548']]) });

// slab con cara frontal texturizada (UV = rect de la pieza, v hacia abajo)
function slab(w, h, r, depth, bevel, frontMat, sideMat) {
  const g = new THREE.ExtrudeGeometry(rrPath(new THREE.Shape(), w - 2 * bevel, h - 2 * bevel, Math.max(0.01, r - bevel)),
    { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 4, curveSegments: 20 });
  g.translate(0, 0, -(depth + bevel));
  const pos = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) + w / 2) / w, (h / 2 - pos.getY(i)) / h);
  uv.needsUpdate = true;
  return new THREE.Mesh(g, [frontMat, sideMat]);
}
// cara de cristal: imagen + reflejo que sigue a la camara + borde interior de 1 px
const faceMat = (tex, w, h, r) => new THREE.ShaderMaterial({
  uniforms: { uMap: { value: tex }, uSize: { value: new THREE.Vector2(w, h) }, uR: { value: r }, uDim: { value: 1 } },
  vertexShader: /* glsl */`varying vec2 vUv; varying vec3 vN; varying vec3 vV;
    void main(){ vUv = uv; vec4 wp = modelMatrix * vec4(position, 1.0); vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - wp.xyz); gl_Position = projectionMatrix * viewMatrix * wp; }`,
  fragmentShader: /* glsl */`precision highp float; varying vec2 vUv; varying vec3 vN; varying vec3 vV;
    uniform sampler2D uMap; uniform vec2 uSize; uniform float uR; uniform float uDim;
    float sdRR(vec2 p, vec2 b, float r){ vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
    void main(){
      vec3 N = normalize(vN);
      vec2 p = (vUv - 0.5) * uSize; float d = sdRR(p, uSize * 0.5, uR);
      float edge = smoothstep(-0.22, 0.0, d);
      vec2 dir = normalize(p + 1e-4);
      vec3 col = texture2D(uMap, vUv - dir * edge * edge * 0.012 / uSize).rgb;      // refraccion en el bisel
      vec3 R = reflect(-vV, N);
      float band = smoothstep(0.16, 0.0, abs(R.x * 0.78 + R.y * 0.62 - 0.10)) * 0.085;
      float spec = pow(max(dot(R, normalize(vec3(-0.45, 0.62, 0.64))), 0.0), 22.0) * 0.16;
      float rim = (1.0 - smoothstep(0.0, 0.035, abs(d + 0.035))) * 0.22 + pow(edge, 3.0) * 0.10;
      float tl = clamp(0.5 - 0.5 * dot(dir, normalize(vec2(0.6, -0.8))), 0.0, 1.0);        // luz arriba-izquierda
      col = col * uDim + vec3(0.93, 0.88, 1.0) * (band + spec + rim * (0.35 + 0.65 * tl));
      gl_FragColor = vec4(col, 1.0);
    }` });
const shadowMat = () => new THREE.ShaderMaterial({ transparent: true, depthWrite: false,
  uniforms: { uSoft: { value: 0.1 }, uOp: { value: 0 }, uAsp: { value: 1 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `precision highp float; varying vec2 vUv; uniform float uSoft; uniform float uOp; uniform float uAsp;
    float sdRR(vec2 p, vec2 b, float r){ vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
    void main(){ vec2 p = (vUv - 0.5) * vec2(uAsp, 1.0); float d = sdRR(p, vec2(uAsp * 0.5 - 0.2, 0.3), 0.06); float a = 1.0 - smoothstep(-uSoft, uSoft, d); gl_FragColor = vec4(0.012, 0.004, 0.02, a * a * uOp); }` });

// --- telefono: marco de cristal, pantalla con la pagina real ---
const SW = 3.9, SH = 8.44, SCR_R = 0.4733, BEZ = 0.135;
const BODY_W = SW + 2 * BEZ, BODY_H = SH + 2 * BEZ, BODY_R = SCR_R + BEZ, DEPTH = 0.42;
const phone = new THREE.Group(); scene.add(phone);
const body = slab(BODY_W, BODY_H, BODY_R, DEPTH, 0.03, phoneGlass, glassEdge);
phone.add(body);
const tall = { todo: await bitmap(CAP + 'tall_todo.png'), bouquets: await bitmap(CAP + 'tall_bouquets.png') };
const topImg = await bitmap(CAP + 'top.png'), barImg = await bitmap(CAP + 'bar.png');
const scrCanvas = document.createElement('canvas'); scrCanvas.width = 780; scrCanvas.height = 1688;
const scrTex = new THREE.CanvasTexture(scrCanvas); scrTex.flipY = false; scrTex.colorSpace = THREE.SRGBColorSpace;
scrTex.generateMipmaps = true; scrTex.minFilter = THREE.LinearMipmapLinearFilter; scrTex.anisotropy = 4;
let scrSig = '';
function drawScreen(scrollY, state, barOn, tap) {
  const sig = `${scrollY.toFixed(2)}|${state}|${barOn.toFixed(3)}|${tap ? tap.join(',') : ''}`;
  if (sig === scrSig) return; scrSig = sig;
  const x = scrCanvas.getContext('2d'); x.setTransform(1, 0, 0, 1, 0, 0);
  x.fillStyle = WHITE; x.fillRect(0, 0, 780, 1688);
  const img = tall[state], sy = clamp(scrollY * 2, 0, img.height - 1688);
  x.drawImage(img, 0, sy, 780, 1688, 0, 0, 780, 1688);
  if (tap) {                                         // toque sobre la pagina: onda suave
    const [tx, ty, age] = tap, k = clamp(age / 0.45);
    x.globalAlpha = 0.30 * (1 - k); x.fillStyle = '#3A2548';
    x.beginPath(); x.arc(tx * 2, (ty - scrollY) * 2, (16 + 46 * easeOut(k)) * 2, 0, 7); x.fill(); x.globalAlpha = 1;
  }
  x.drawImage(topImg, 0, 0);
  if (barOn > 0.001) { x.globalAlpha = barOn; x.drawImage(barImg, 0, rects.barTopInViewport * 2); x.globalAlpha = 1; }
  // barra de estado generica e isla
  x.setTransform(2, 0, 0, 2, 0, 0);
  x.fillStyle = PLUM; x.font = '600 16px "Jost"'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('9:41', 56, 30);
  for (let i = 0; i < 4; i++) { const h = 4.2 + i * 2.5; x.beginPath(); x.roundRect(291 + i * 4.9, 35.5 - h, 3.2, h, 1); x.fill(); }
  x.globalAlpha = 0.45; x.lineWidth = 1.1; x.strokeStyle = PLUM; x.beginPath(); x.roundRect(336, 24.5, 25, 12, 3.6); x.stroke();
  x.globalAlpha = 1; x.beginPath(); x.roundRect(338, 26.6, 17.5, 7.8, 2.1); x.fill();
  x.fillStyle = '#000'; x.beginPath(); x.roundRect(195 - 62.5, 11, 125, 37, 18.5); x.fill();
  x.fillStyle = 'rgba(30,18,38,.8)'; x.beginPath(); x.roundRect(128, 831, 134, 5, 2.5); x.fill();
  scrTex.needsUpdate = true;
}
const screenMat = new THREE.ShaderMaterial({ transparent: true,
  uniforms: { uPage: { value: scrTex }, uOn: { value: 1 } },
  vertexShader: /* glsl */`varying vec2 vUv; varying vec3 vN; varying vec3 vV;
    void main(){ vUv = uv; vec4 wp = modelMatrix * vec4(position, 1.0); vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - wp.xyz); gl_Position = projectionMatrix * viewMatrix * wp; }`,
  fragmentShader: /* glsl */`precision highp float; varying vec2 vUv; varying vec3 vN; varying vec3 vV; uniform sampler2D uPage; uniform float uOn;
    float sdRR(vec2 p, vec2 b, float r){ vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
    void main(){
      vec2 css = vec2(vUv.x * 390.0, (1.0 - vUv.y) * 844.0);
      float sd = sdRR(css - vec2(195.0, 422.0), vec2(195.0, 422.0), 47.33);
      float aa = fwidth(sd); float mask = 1.0 - smoothstep(-aa, aa, sd);
      float edge = smoothstep(-16.0, 0.0, sd); vec2 dir = normalize(css - vec2(195.0, 422.0) + 1e-3);
      vec3 col = texture2D(uPage, (css - dir * edge * edge * 6.0) / vec2(390.0, 844.0)).rgb * uOn;
      vec3 R = reflect(-vV, normalize(vN));
      float band = smoothstep(0.12, 0.0, abs(R.x * 0.82 + R.y * 0.57 - 0.18)) * 0.06 + pow(max(dot(R, normalize(vec3(-0.45, 0.62, 0.64))), 0.0), 18.0) * 0.08;
      col += vec3(0.93, 0.88, 1.0) * (band + pow(edge, 5.0) * 0.08);
      gl_FragColor = vec4(col, mask);
    }` });
const screen = new THREE.Mesh(new THREE.PlaneGeometry(SW, SH), screenMat);
screen.position.z = 0.003; screen.renderOrder = 2; phone.add(screen);

// --- fotos como paneles de cristal con grosor ---
const photo = {};
for (const n of ['logo', 'girasoles', 'bouquet-rosa', 'orquideas', 'caja-redonda', ...TL.PANELS, ...TL.EVENTS]) photo[n] = await bitmap(IMG + n + '.jpg');
function coverDraw(x, img, dx, dy, dw, dh) {
  const s = Math.max(dw / img.width, dh / img.height), sw = dw / s, sh = dh / s;
  x.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, dx, dy, dw, dh);
}
function panelTex(img, w, h, label) {
  const PX = 190, c = document.createElement('canvas'); c.width = Math.round(w * PX); c.height = Math.round(h * PX);
  const x = c.getContext('2d');
  coverDraw(x, img, 0, 0, c.width, c.height);
  if (label) {                                       // etiqueta de cristal: desenfoca la foto que tiene detras
    const lh = Math.round(c.height * 0.185), y = c.height - lh;
    x.save(); x.beginPath(); x.rect(0, y, c.width, lh); x.clip();
    x.filter = 'blur(26px) saturate(1.4)'; coverDraw(x, img, -40, -40, c.width + 80, c.height + 80); x.filter = 'none';
    x.fillStyle = 'rgba(30,18,38,.36)'; x.fillRect(0, y, c.width, lh);
    x.fillStyle = 'rgba(255,255,255,.55)'; x.fillRect(0, y, c.width, 2);
    x.restore();
    let fs = Math.round(lh * 0.36); x.font = `600 ${fs}px "Jost"`; x.letterSpacing = `${(fs * 0.14).toFixed(1)}px`;
    while (x.measureText(label).width > c.width * 0.84) { fs -= 2; x.font = `600 ${fs}px "Jost"`; x.letterSpacing = `${(fs * 0.14).toFixed(1)}px`; }
    x.fillStyle = WHITE; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(label, c.width / 2 + fs * 0.07, y + lh / 2 + 2);
  }
  const t = new THREE.CanvasTexture(c); t.flipY = false; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; return t;
}
function makePanel(img, w, h, label, depth = 0.14) {
  const r = 0.2;
  const mesh = slab(w, h, r, depth, 0.03, faceMat(panelTex(img, w, h, label), w, h, r), glassEdge);
  mesh.renderOrder = 5;
  const sh = new THREE.Mesh(new THREE.PlaneGeometry(w * 1.5, h * 1.5), shadowMat());
  sh.material.uniforms.uAsp.value = w / h; sh.renderOrder = 3;
  const g = new THREE.Group(); g.add(mesh); g.visible = false; sh.visible = false;
  return { g, mesh, sh, w, h };
}
const byAspect = (img, w) => [w, w * img.height / img.width];
const cards = TL.CARDS.map((c, i) => { const p = makePanel(photo[c.img], 3.1, 3.72, c.label); phone.add(p.g); phone.add(p.sh); return { ...p, def: c, land: vw(c.vo).t0, ...LY.cards[i] }; });
const panels = TL.PANELS.map((n, i) => { const [w, h] = byAspect(photo[n], LY.panels[i].w); const p = makePanel(photo[n], w, h, null); scene.add(p.g); return { ...p, ...LY.panels[i] }; });
const events = TL.EVENTS.map((n, i) => { const [w, h] = byAspect(photo[n], LY.events[i].w); const p = makePanel(photo[n], w, h, null); scene.add(p.g); return { ...p, ...LY.events[i] }; });

// ---------- capas 2D (px de diseno, y hacia abajo) ----------
const overA = new THREE.Scene(), overB = new THREE.Scene();
const orthoPx = new THREE.OrthographicCamera(0, W, 0, -H, -10, 10);
class TextLayer {
  constructor(sc, x, y, w, h) {
    this.x = x; this.y = y; this.w = w; this.h = h;
    this.canvas = document.createElement('canvas'); this.canvas.width = Math.ceil(w * SCALE); this.canvas.height = Math.ceil(h * SCALE);
    this.ctx = this.canvas.getContext('2d');
    this.tex = new THREE.CanvasTexture(this.canvas); this.tex.colorSpace = THREE.SRGBColorSpace; this.tex.minFilter = THREE.LinearFilter; this.tex.generateMipmaps = false;
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: this.tex, transparent: true, depthTest: false, depthWrite: false, toneMapped: false }));
    this.mesh.position.set(x + w / 2, -(y + h / 2), 0); this.mesh.renderOrder = 30; this.mesh.frustumCulled = false; this.mesh.visible = false;
    sc.add(this.mesh); this.sig = '';
  }
  begin(sig) {
    if (sig === this.sig) { this.mesh.visible = true; return null; }
    this.sig = sig; const c = this.ctx;
    c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, this.canvas.width, this.canvas.height);
    c.setTransform(SCALE, 0, 0, SCALE, -this.x * SCALE, -this.y * SCALE);
    return c;
  }
  end(v = true) { this.tex.needsUpdate = true; this.mesh.visible = v; }
  hide() { if (this.mesh.visible) this.mesh.visible = false; }
}
const scratch = document.createElement('canvas').getContext('2d');
const CAPS = (s) => `600 ${s.toFixed(2)}px "Jost"`, SCRIPT = (s) => `italic 500 ${s.toFixed(2)}px "Playfair"`;

// Tipografia cinetica por glifo (stagger 26 ms); cada palabra con su coreografia, aterriza en su palabra de la voz.
class Kinetic {
  constructor(def, col) {
    this.def = def; this.col = col; this.out = TL.resolveOut(def.out, vo);
    const size = col.size, lh = size * (col.lh || 1.12);
    this.glyphs = []; this.first = 1e9;
    const top = col.cy - (lh * def.lines.length) / 2;
    let maxW = 0;
    def.lines.forEach((line, li) => {
      const ws = line.map((w) => {
        const s = (w.style === 'script' ? size * 1.16 : size) * (w.small ? 0.42 : 1);
        const fnt = w.style === 'script' ? SCRIPT(s) : CAPS(s), track = w.style === 'script' ? 0 : s * (w.small ? 0.34 : 0.07);
        scratch.font = fnt; const chars = [...w.text]; const xs = [0];
        for (let i = 1; i <= chars.length; i++) xs.push(scratch.measureText(chars.slice(0, i).join('')).width + track * i);
        return { w, s, fnt, chars, xs, width: xs[xs.length - 1] - track };
      });
      const gap = size * 0.36, total = ws.reduce((a, b) => a + b.width, 0) + gap * (ws.length - 1);
      maxW = Math.max(maxW, total);
      let x = col.align === 'left' ? col.x : col.cx - total / 2;
      const base = top + lh * (li + 1) - size * 0.2;
      ws.forEach((m) => {
        const t0 = vw(m.w.vo).t0; this.first = Math.min(this.first, t0 - 0.24);
        m.chars.forEach((ch, k) => this.glyphs.push({ ch, x: x + m.xs[k], cx: x + (m.xs[k] + m.xs[k + 1]) / 2, y: base, s: m.s, fnt: m.fnt, fx: m.w.fx, script: m.w.style === 'script', t0: t0 - 0.2 + k * 0.026, wc: x + m.width / 2 }));
        x += m.width + gap;
      });
    });
    const pad = size * 1.3;
    const x0 = col.align === 'left' ? col.x : col.cx - maxW / 2;
    this.layer = new TextLayer(overB, Math.floor(x0 - pad), Math.floor(top - pad), Math.ceil(maxW + pad * 2), Math.ceil(lh * def.lines.length + pad * 2));
  }
  update(t) {
    const out = this.out;
    if (t < this.first || t > out[1] + 0.3) { this.layer.hide(); return; }
    const st = this.glyphs.map((g, i) => [clamp((t - g.t0) / 0.42), clamp((t - (out[0] + i * 0.012)) / 0.22)]);
    const c = this.layer.begin(st.map(([p, q]) => `${p.toFixed(3)}:${q.toFixed(3)}`).join('|'));
    if (!c) return;
    c.textBaseline = 'alphabetic'; c.shadowColor = 'rgba(14,6,20,.55)'; c.shadowBlur = 26; c.shadowOffsetY = 6;
    this.glyphs.forEach((g, i) => {
      const [p, q] = st[i];
      if (p <= 0 || q >= 1) return;
      const back = 1 + 2.1 * Math.pow(p - 1, 3) + 1.1 * Math.pow(p - 1, 2), e = easeOut(p), sp = spring(p, 0.5, 11);
      let dx = 0, dy = 0, rot = 0, sc = 1, skew = 0;
      if (g.fx === 'rise') { dy = (1 - back) * g.s * 0.7; rot = (1 - e) * -0.14; }
      else if (g.fx === 'drop') { dy = -(1 - sp) * g.s * 0.9; }
      else if (g.fx === 'slide') { dx = -(1 - e) * g.s * 0.8; skew = (1 - e) * -0.45; }
      else { sc = 0.35 + 0.65 * sp; rot = (1 - e) * 0.22; dy = (1 - e) * g.s * 0.18; }      // bloom: abre como petalo
      dy -= easeIn(q) * g.s * 0.5; sc *= 1 - 0.25 * easeIn(q);
      c.save();
      c.globalAlpha = clamp(p / 0.3) * (1 - q);
      c.translate(g.x + dx, g.y + dy); c.transform(1, 0, skew, 1, 0, 0); c.rotate(rot); c.scale(sc, sc);
      c.font = g.fnt; c.fillStyle = g.script ? ROSE : WHITE; c.fillText(g.ch, 0, 0);
      c.restore();
    });
    this.layer.end(true);
  }
}
const kin = TL.KINETIC.map((d) => new Kinetic(d, LY.kinetic[d.id]));

// ---------- cristal 2D que desenfoca lo que tiene detras (chips, boton, placas) ----------
const NG = 6;
const glass = fsPass(/* glsl */`
precision highp float; varying vec2 vUv;
uniform sampler2D uBlur; uniform vec2 uRes; uniform vec2 uJit;
uniform vec4 uRect[${NG}]; uniform float uRad[${NG}]; uniform float uOp[${NG}]; uniform vec4 uTint[${NG}];
float sdRR(vec2 p, vec2 b, float r){ vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main(){
  vec2 px = vec2(vUv.x, 1.0 - vUv.y) * uRes + uJit;
  vec3 b = texture2D(uBlur, vUv).rgb; float lum = dot(b, vec3(0.2126, 0.7152, 0.0722));
  b = max(vec3(0.0), mix(vec3(lum), b, 1.4));                                  // saturacion 140 %
  vec4 acc = vec4(0.0);
  for (int i = 0; i < ${NG}; i++) {
    if (uOp[i] <= 0.001) continue;
    vec2 p = px - uRect[i].xy; vec2 hb = uRect[i].zw * 0.5;
    float d = sdRR(p, hb, uRad[i]);
    float sh = (1.0 - smoothstep(0.0, 44.0, d - 6.0)) * 0.30 * step(0.0, d);       // sombra de contacto
    float inside = 1.0 - smoothstep(-1.0, 1.0, d);
    vec3 col = b * 1.10 + vec3(0.050, 0.036, 0.066);
    col = mix(col, uTint[i].rgb, uTint[i].a);
    float tl = clamp(0.5 - 0.5 * dot(normalize(p / hb + 1e-4), normalize(vec2(0.6, 0.8))), 0.0, 1.0);
    float border = 1.0 - smoothstep(0.0, 1.3, abs(d + 0.9));                   // borde de 1 px
    col = mix(col, vec3(0.93, 0.86, 1.0), border * (0.25 + 0.6 * tl));
    float bevel = smoothstep(-9.0, -1.0, d);                                    // grosor del canto
    col += vec3(0.80, 0.70, 0.95) * bevel * 0.20 * tl - vec3(0.02) * bevel * (1.0 - tl);
    col += vec3(0.9, 0.85, 1.0) * smoothstep(hb.y * 0.2, -hb.y, p.y) * 0.055;    // luz superior
    col += (hash(px) - 0.5) * 0.02 * 0.3;                                      // ruido 2 %
    float a = max(inside, sh) * uOp[i];
    vec3 c = mix(vec3(0.004, 0.001, 0.008), col, inside);
    acc = vec4(mix(acc.rgb, c, a), acc.a + a * (1.0 - acc.a));
  }
  if (acc.a <= 0.001) discard;
  gl_FragColor = acc;
}`, { uBlur: { value: rtQ2.texture }, uRes: { value: RES }, uJit: { value: JIT },
  uRect: { value: Array.from({ length: NG }, () => new THREE.Vector4()) }, uRad: { value: new Array(NG).fill(0) },
  uOp: { value: new Array(NG).fill(0) }, uTint: { value: Array.from({ length: NG }, () => new THREE.Vector4()) } }, true);
const G = Array.from({ length: NG }, () => ({ op: 0, layer: 'B' }));       // 0-2 chips, 3 boton WA, 4 placa end card
function setGlass(i, cx, cy, w, h, r, op, tint, layer = 'B') {
  glass.mat.uniforms.uRect.value[i].set(cx, cy, w, h); glass.mat.uniforms.uRad.value[i] = r;
  G[i].op = op; G[i].layer = layer;
  if (tint) glass.mat.uniforms.uTint.value[i].set(tint[0], tint[1], tint[2], tint[3]); else glass.mat.uniforms.uTint.value[i].set(0, 0, 0, 0);
}
function glassLayer(which) { let any = false; G.forEach((g, i) => { const v = g.layer === which ? g.op : 0; glass.mat.uniforms.uOp.value[i] = v; if (v > 0.001) any = true; }); return any; }

// ---------- campo liquido: flor <-> panel <-> circulo de la marca <-> marco del telefono (SDF) ----------
const liquid = fsPass(/* glsl */`
precision highp float; varying vec2 vUv;
uniform vec2 uRes; uniform vec2 uJit; uniform vec2 uC; uniform vec2 uB; uniform float uR;
uniform float uFl; uniform float uFR; uniform float uPet; uniform float uRot; uniform float uRim; uniform float uIris; uniform float uOn;
uniform sampler2D uTexA; uniform sampler2D uTexB; uniform sampler2D uBlur;
uniform vec3 uA; uniform vec3 uBm;      // (modo, aspecto, zoom): modo 0 = foto, 1 = flor, 2 = hueco
float sdRR(vec2 p, vec2 b, float r){ vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
float petal(float a, float n){ return pow(0.5 + 0.5 * cos(n * a), 0.62); }
float sdFlower(vec2 p){ float a = atan(p.y, p.x) + uRot; return (length(p) - uFR * (1.0 - 0.34 * uPet + 0.34 * uPet * petal(a, 7.0))) * 0.84; }
// flor de tres coronas: cada petalo con su pliegue, su vena y la sombra de la corona de arriba
vec3 corona(vec3 base, float r, float a, float R, float rot, vec3 cIn, vec3 cOut, out float din){
  float k = petal(a + rot, 7.0); din = r - R * (1.0 - 0.34 * uPet + 0.34 * uPet * k);
  vec3 c = mix(cIn, cOut, smoothstep(R * 0.30, R, r));
  c *= 0.70 + 0.30 * smoothstep(0.0, 0.55, k);                       // pliegue entre petalos
  c += vec3(0.10, 0.07, 0.09) * smoothstep(0.90, 1.0, k) * smoothstep(R * 0.3, R * 0.8, r);   // vena de luz
  c *= 1.0 - 0.22 * smoothstep(-0.10 * R, 0.0, din);                 // canto del petalo
  float inside = 1.0 - smoothstep(-0.008, 0.008, din);
  base *= 1.0 - 0.38 * (1.0 - smoothstep(0.0, 0.11, din)) * (1.0 - inside);   // sombra sobre la corona de abajo
  return mix(base, c, inside);
}
vec3 flowerCol(vec2 p){
  float r = length(p) / max(uFR, 1.0), a = atan(p.y, p.x) + uRot, d;
  vec3 pale = vec3(0.95, 0.62, 0.75), rose = vec3(0.807, 0.352, 0.521), deep = vec3(0.50, 0.10, 0.26), wine = vec3(0.30, 0.04, 0.14);
  vec3 col = corona(vec3(0.0), r, a, 1.0, 0.0, rose, pale, d);
  col = corona(col, r, a, 0.72, 0.449, deep, mix(rose, pale, 0.55), d);
  col = corona(col, r, a, 0.46, 0.2, wine, rose, d);
  float disc = 1.0 - smoothstep(-0.012, 0.012, r - 0.185);
  vec3 sun = mix(vec3(0.20, 0.07, 0.01), vec3(0.89, 0.47, 0.01), smoothstep(0.03, 0.18, r));
  sun *= 0.80 + 0.20 * sin(a * 13.0 + r * 150.0) * sin(a * 21.0 - r * 110.0);
  col *= 1.0 - 0.35 * (1.0 - smoothstep(0.185, 0.27, r));
  col = mix(col, sun, disc);
  float lit = clamp(-dot(normalize(p + 1e-4), normalize(vec2(0.6, 0.8))), -1.0, 1.0);      // luz fija arriba-izquierda
  col *= 1.0 + 0.16 * lit * smoothstep(0.15, 1.0, r);
  return col;
}
vec4 content(vec3 m, sampler2D tex, vec2 p){
  if (m.x > 1.5) return vec4(0.0);
  if (m.x > 0.5) return vec4(flowerCol(p), 1.0);
  vec2 uv = p / (2.0 * uB); float ab = uB.x / uB.y;
  if (m.y > ab) uv.x *= ab / m.y; else uv.y *= m.y / ab;
  return vec4(texture2D(tex, uv / m.z + 0.5).rgb, 1.0);
}
void main(){
  vec2 px = vec2(vUv.x, 1.0 - vUv.y) * uRes + uJit; vec2 p = px - uC;
  float d = mix(sdRR(p, uB, uR), sdFlower(p), uFl);
  if (d > 60.0 || uOn < 0.5) discard;
  float inside = 1.0 - smoothstep(-1.0, 1.0, d);
  float rl = length(p);
  float kB = 1.0 - smoothstep(uIris - 1.5, uIris + 1.5, rl);
  vec4 cA = content(uA, uTexA, p), cB = content(uBm, uTexB, p);
  vec4 c = mix(cA, cB, kB);
  float ring = exp(-pow((rl - uIris) / 5.0, 2.0)) * step(2.0, uIris) * (1.0 - step(0.999, kB * step(rl + 40.0, uIris)));
  c.rgb += vec3(0.95, 0.85, 1.0) * ring * 0.55 * c.a; c.a = max(c.a, ring * 0.8 * step(1.0, cA.a + cB.a));
  // canto de cristal: refracta el fondo, luz arriba-izquierda
  float rim = smoothstep(-uRim - 1.0, -uRim + 1.0, d) * step(0.01, uRim);
  vec2 n = normalize(vec2(dFdx(d), dFdy(d)) + 1e-5);
  float tl = clamp(0.5 - 0.5 * dot(n, normalize(vec2(0.6, 0.8))), 0.0, 1.0);
  vec3 bl = texture2D(uBlur, vUv + n * 0.012).rgb;
  vec3 rc = bl * 1.2 + vec3(0.30, 0.20, 0.42) * (0.25 + 0.75 * tl) + vec3(1.0, 0.95, 1.0) * pow(tl, 6.0) * 0.55;
  float mid = 1.0 - abs((d + uRim * 0.5) / max(uRim * 0.5, 0.5));
  rc += vec3(0.9, 0.8, 1.0) * 0.10 * mid;
  vec3 col = mix(c.rgb, rc, rim); float a = mix(c.a, 1.0, rim) * inside;
  col *= 1.0 - 0.28 * smoothstep(-uRim - 26.0, -uRim, d) * (1.0 - rim) * step(0.01, uRim);     // sombra interior del canto
  float sh = (1.0 - smoothstep(0.0, 56.0, d)) * 0.34 * step(0.0, d) * step(0.01, uRim + uFl);
  gl_FragColor = vec4(mix(vec3(0.004, 0.001, 0.008), col, inside), max(a, sh * (1.0 - inside)));
}`, { uRes: { value: RES }, uJit: { value: JIT }, uC: { value: new THREE.Vector2() }, uB: { value: new THREE.Vector2(1, 1) }, uR: { value: 1 },
  uFl: { value: 0 }, uFR: { value: 1 }, uPet: { value: 1 }, uRot: { value: 0 }, uRim: { value: 10 }, uIris: { value: 0 }, uOn: { value: 0 },
  uTexA: { value: null }, uTexB: { value: null }, uBlur: { value: rtQ2.texture }, uA: { value: new THREE.Vector3(1, 1, 1) }, uBm: { value: new THREE.Vector3(1, 1, 1) } }, true);
liquid.mat.extensions = { derivatives: true };
const sunTex = texFrom(photo.girasoles), logoTex = texFrom(photo.logo);
const SUN_AR = photo.girasoles.width / photo.girasoles.height;
const M_FLOWER = [1, 1, 1], M_SUN = [0, SUN_AR, 1], M_LOGO = [0, 1, 1.09], M_HOLE = [2, 1, 1];

// ---------- el tallo: una sola linea ----------
const stemColors = (s, core, rim, hi) => { s.mat.uniforms.uCore.value = lin(core); s.mat.uniforms.uRim.value = lin(rim); s.mat.uniforms.uHi.value = lin(hi); };
const strokes = {};
function stroke(id, core = '#6FA058', rim = '#3F6B33', hi = '#DDF2C4') {
  if (!strokes[id]) { const s = new InkStroke(); stemColors(s, core, rim, hi); s.mesh.renderOrder = 10; overA.add(s.mesh); strokes[id] = s; }
  return strokes[id];
}
const STEM = smoothPath(LY.stem.path, 22), STEM_L = pathLength(STEM);
const cumAt = (pts, idx) => pathLength(pts.slice(0, idx + 1));
const S_SLASH = cumAt(STEM, LY.stem.slashIdx * 22), S_ROOT = cumAt(STEM, LY.stem.rootIdx * 22);
const RIBBON = smoothPath(LY.ribbon, 22), RIBBON_L = pathLength(RIBBON);

// ---------- textos sueltos (chips, boton, end card) ----------
const chipLayers = TL.CHIPS.map((_, i) => { const c = LY.chips[i]; return new TextLayer(i === 1 ? overB : overA, c.cx - c.w / 2 - 20, c.cy - c.h / 2 - 20, c.w + 40, c.h + 40); });
const waLayer = new TextLayer(overB, 0, LY.wa.cy - 200, W, 400);
const endLayer = new TextLayer(overB, 0, 0, W, H);
const safeLayer = SAFE ? new TextLayer(overB, 0, 0, W, H) : null;
const WA_PATH = new Path2D('M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2zm0 1.67c2.2 0 4.26.86 5.82 2.42a8.23 8.23 0 0 1 2.41 5.83c0 4.54-3.7 8.23-8.24 8.23-1.48 0-2.93-.39-4.19-1.15l-.3-.17-3.12.82.83-3.04-.2-.32a8.19 8.19 0 0 1-1.26-4.38c.01-4.54 3.7-8.24 8.25-8.24zM8.53 7.33c-.16 0-.43.06-.66.31-.22.25-.87.86-.87 2.07 0 1.22.89 2.39 1 2.56.14.17 1.76 2.67 4.25 3.73.59.27 1.05.42 1.41.53.59.19 1.13.16 1.56.1.48-.07 1.46-.6 1.67-1.18.21-.58.21-1.07.15-1.18-.07-.1-.23-.16-.48-.27-.25-.14-1.47-.74-1.69-.82-.23-.08-.37-.12-.56.12-.16.25-.64.81-.78.97-.15.17-.29.19-.53.07-.26-.13-1.06-.39-2-1.23-.74-.66-1.23-1.47-1.38-1.72-.12-.24-.01-.39.11-.5.11-.11.27-.29.37-.44.13-.14.17-.25.25-.41.08-.17.04-.31-.02-.43-.06-.11-.56-1.35-.77-1.84-.2-.48-.4-.42-.56-.43-.14 0-.3-.01-.47-.01z');

// ---------- camara unica ----------
function camAt(t) {
  const K = LY.cam; let i = 0;
  while (i < K.length - 1 && K[i + 1][0] <= t) i++;
  const [t0, a] = K[i], [t1, b] = K[Math.min(i + 1, K.length - 1)];
  const k = t1 > t0 ? easeInOut(clamp((t - t0) / (t1 - t0))) : 0;
  const P = (x, y) => lerp(x, y, k);
  const dr = smooth(T.irisPhone[1], T.irisPhone[1] + 0.6, t) * (1 - smooth(T.pull[0] - 0.5, T.pull[0], t));     // deriva: solo cuando el liquido no es el telefono
  return { yaw: P(a.yaw, b.yaw) + 0.7 * dr * Math.sin(t * 0.9), pitch: P(a.pitch, b.pitch) + 0.5 * dr * Math.sin(t * 0.7 + 1.3), dist: P(a.dist, b.dist),
    look: [P(a.look[0], b.look[0]), P(a.look[1], b.look[1]), P(a.look[2], b.look[2])] };
}
const tmpV = new THREE.Vector3();
function applyCam(c) {
  const y = c.yaw * deg, p = c.pitch * deg;
  camera.position.set(c.look[0] + c.dist * Math.sin(y) * Math.cos(p), c.look[1] + c.dist * Math.sin(p), c.look[2] + c.dist * Math.cos(y) * Math.cos(p));
  camera.lookAt(c.look[0], c.look[1], c.look[2]); camera.updateMatrixWorld(true);
}
function project(x, y, z) { tmpV.set(x, y, z).project(camera); return [(tmpV.x * 0.5 + 0.5) * W, (-tmpV.y * 0.5 + 0.5) * H]; }
function phoneSilhouette() {          // contorno del telefono proyectado (camara de frente)
  const a = project(-BODY_W / 2, BODY_H / 2, 0), b = project(BODY_W / 2, -BODY_H / 2, 0);
  const hw = (b[0] - a[0]) / 2, hh = (b[1] - a[1]) / 2;
  return { c: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], b: [hw, hh], r: BODY_R * (2 * hw / BODY_W) };
}

// ---------- frame(t) ----------
const KICKS = Array.from({ length: 38 }, (_, i) => i * 0.5);
const kickPulse = (t, w = 0.22) => { const k = t - Math.floor(t / 0.5) * 0.5; return Math.exp(-k / w * 3.2); };
const LU = liquid.mat.uniforms;
function setLiquid(c, b, r, A, B, iris, rim) {
  LU.uC.value.set(c[0], c[1]); LU.uB.value.set(b[0], b[1]); LU.uR.value = Math.min(r, b[0], b[1]);
  LU.uA.value.set(...A); LU.uBm.value.set(...B); LU.uIris.value = iris; LU.uRim.value = rim; LU.uOn.value = 1;
  LU.uTexA.value = A === M_LOGO ? logoTex : sunTex; LU.uTexB.value = B === M_LOGO ? logoTex : sunTex;
}
const mix2 = (a, b, k) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k)];

function frameState(t) {
  const cam = camAt(t);
  applyCam(cam);
  backdrop.mat.uniforms.uT.value = t;
  backdrop.mat.uniforms.uPar.value.set(-cam.yaw / 300 - cam.look[0] * 0.012, cam.pitch / 300);
  backdrop.mat.uniforms.uLift.value = 0.35 * Math.exp(-Math.max(0, t) / 0.18) + 0.5 * Math.exp(-Math.abs(t - T.endHit) / 0.16) * (t >= T.endHit ? 1 : 0);

  // --- telefono y pagina ---
  const phoneOn = t >= T.toPhone[0] + 0.1 && t < T.irisBack[1] + 0.02;
  phone.visible = phoneOn;
  if (phoneOn) {
    const yCat = rects.catalogo.y - rects.top.h - 4, yEv = rects.eventos.y - rects.top.h + 30;
    let sy = 0;
    sy = lerp(sy, yCat, spring(prog(t, T.scrollCat), 0.82, 8.6));
    sy = lerp(sy, yEv, spring(prog(t, [T.eventsIn[0], T.eventsIn[0] + 0.7]), 0.82, 8.6));
    sy = lerp(sy, 0, easeInOut(prog(t, [T.pull[0], T.pull[0] + 0.6])));
    const state = t >= T.tapChip + 0.04 && t < T.eventsIn[0] + 0.4 ? 'bouquets' : 'todo';
    const cb = rects.chip_bouquets; const age = t - T.tapChip;
    const tap = age >= 0 && age < 0.45 ? [cb.x + cb.w / 2, cb.y + cb.h / 2, age] : null;
    const barOn = 1 - smooth(T.waLift[0], T.waLift[0] + 0.12, t) * (1 - smooth(T.waOut[0], T.waOut[1], t));
    drawScreen(sy, state, barOn, tap);
  }
  // --- tarjetas isometricas que se estampan en su palabra ---
  for (const c of cards) {
    const a = t - (c.land - 0.34), on = phoneOn && a >= 0 && t < T.cardsOff[1];
    c.g.visible = on; c.sh.visible = on;
    if (!on) continue;
    const fall = clamp(a / 0.34), k = easeIn(fall);                           // cae acelerando y pega en el kick
    const hit = t - c.land;
    const squash = hit >= 0 ? Math.exp(-hit * 9) * Math.cos(hit * 34) * 0.07 : 0;
    const off = easeIn(prog(t, [T.cardsOff[0] + c.i * 0.05, T.cardsOff[1]]));
    const z = lerp(7.5, c.z, k) + off * 14 + (hit > 0 ? Math.abs(Math.exp(-hit * 7) * Math.sin(hit * 20)) * 0.25 : 0);
    const float = hit > 0.3 ? Math.sin((t - c.land) * 2.2 + c.i * 2) * 0.05 : 0;
    c.g.position.set(c.x, c.y + float, z);
    c.g.rotation.set((1 - k) * 0.5 * (c.i % 2 ? 1 : -1), (1 - k) * -0.6, c.rz * deg + (1 - k) * 0.4);
    c.g.scale.set(1 + squash, 1 + squash, 1);
    const near = clamp(1 - (z - c.z) / 7);                                    // la sombra de contacto crece al acercarse
    c.sh.position.set(c.x + 0.30 + (z - c.z) * 0.16, c.y - 0.36 - (z - c.z) * 0.20, 0.02);
    c.sh.material.uniforms.uOp.value = 0.78 * near * near * (1 - off);
    c.sh.material.uniforms.uSoft.value = 0.07 + 0.3 * (1 - near);
  }
  // --- parallax: paneles a distintas profundidades ---
  panels.forEach((p, i) => {
    const on = t >= T.panelsIn[0] - 0.3 && t < T.panelsOut[1] + 0.3;
    p.g.visible = on; if (!on) return;
    const k = spring(prog(t, [T.panelsIn[0] - 0.25 + i * 0.16, T.panelsIn[1] + 0.25 + i * 0.16]), 0.7, 8);
    const out = easeIn(prog(t, [T.panelsOut[0] + i * 0.05, T.panelsOut[1] + 0.2]));
    p.g.position.set(p.x + (1 - k) * 9 + out * 6, p.y + Math.sin(t * 1.3 + i * 2.1) * 0.10, p.z + out * -6);
    p.g.rotation.set(0.02 * Math.sin(t + i), (p.ry + (1 - k) * -50 + out * 40) * deg, p.rz * deg);
  });
  // --- muro de eventos: tres paneles orbitan el telefono ---
  events.forEach((p, i) => {
    const on = t >= T.eventsIn[0] && t < T.eventsOut[1];
    p.g.visible = on; if (!on) return;
    const k = spring(prog(t, [T.eventsIn[0] + i * 0.10, T.eventsIn[1] + 0.25 + i * 0.10]), 0.68, 8.5);
    const out = easeIn(prog(t, [T.eventsOut[0] + i * 0.04, T.eventsOut[1]]));
    const s = k * (1 - out);
    const ang = (cam.yaw + p.a + (t - T.eventsIn[0] - 1) * 7) * deg;
    p.g.position.set(Math.sin(ang) * p.rad * s, p.y * s + Math.sin(t * 1.5 + i) * 0.08, Math.cos(ang) * p.rad * s);
    p.g.rotation.set(-cam.pitch * deg * 0.45, cam.yaw * deg + (p.a > 0 ? -1 : 1) * 0.30 * (p.rad > 5.3 ? 0.3 : 1), p.rz * deg);
    p.g.scale.setScalar(0.25 + 0.75 * s);
  });

  // --- campo liquido ---
  const F = LY.flower;
  LU.uOn.value = 0; LU.uFl.value = 0; LU.uPet.value = 1;
  if (t >= T.bloom[0] && t < T.toSun[0]) {                               // el tallo abre en flor
    const k = prog(t, T.bloom);
    setLiquid(F.c, [F.r, F.r], F.r, M_FLOWER, M_FLOWER, 0, 7 * easeOut(prog(t, T.bloom)));
    LU.uFl.value = 1; LU.uFR.value = F.r * (0.10 + 0.90 * spring(k, 0.55, 9)); LU.uPet.value = easeOut(clamp((k - 0.12) / 0.88));
    LU.uRot.value = -1.1 + 1.1 * easeOut(k) + (t - T.bloom[1]) * 0.06;
  } else if (t >= T.toSun[0] && t < T.toCircle[0]) {                     // flor -> panel de girasoles
    const k = easeInOut(prog(t, T.toSun));
    setLiquid(F.c, mix2([F.r, F.r], F.sun, k), lerp(F.r, 40, k), M_FLOWER, M_SUN, lerp(0, F.sun[0] * 1.3, easeInOut(prog(t, T.irisSun))), lerp(7, 12, k));
    LU.uFl.value = 1 - k; LU.uFR.value = F.r; LU.uRot.value = (t - T.bloom[1]) * 0.06 + k * 0.5;
  } else if (t >= T.toCircle[0] && t < T.toPhone[0]) {                   // panel -> circulo de la marca
    const k = spring(prog(t, T.toCircle), 0.8, 8);
    const b = mix2(F.sun, [F.logoR, F.logoR], k);
    setLiquid(mix2(F.c, F.logoC, k), b, lerp(40, F.logoR, k), M_SUN, M_LOGO, lerp(0, F.sun[0] * 1.3, easeInOut(prog(t, T.irisLogo))), 12);
  } else if (t >= T.toPhone[0] && t < T.rimOff[1]) {                     // circulo -> marco del telefono
    const s = phoneSilhouette(), k = easeInOut(prog(t, T.toPhone));
    setLiquid(mix2(F.logoC, s.c, k), mix2([F.logoR, F.logoR], s.b, k), lerp(F.logoR, s.r, k), M_LOGO, M_HOLE,
      lerp(0, Math.hypot(s.b[0], s.b[1]) + 30, easeInOut(prog(t, T.irisPhone))), 12 * (1 - easeInOut(prog(t, T.rimOff))));
  } else if (t >= T.irisBack[0] - 0.3) {                                 // el telefono se cierra al circulo
    const s = phoneSilhouette(), k = spring(prog(t, [T.irisBack[1] - 0.04, T.toLogo[1] + 0.3]), 0.78, 8);
    const e = spring(prog(t, T.endIn), 0.8, 8);
    const c1 = mix2(F.closeC, LY.end.logoC, e), r1 = lerp(F.closeR, LY.end.logoR, e);
    setLiquid(mix2(s.c, c1, k), mix2(s.b, [r1, r1], k), lerp(s.r, r1, k), M_HOLE, M_LOGO,
      lerp(0, Math.hypot(s.b[0], s.b[1]) + 30, easeInOut(prog(t, T.irisBack))), 12 * easeInOut(prog(t, [T.irisBack[0] - 0.3, T.irisBack[0]])));
  }

  // --- el tallo ---
  {
    const st = stroke('stem');
    let head = 0, tail = 0;
    if (t < T.cut) head = S_SLASH * easeOut(prog(t, T.slash));
    else head = lerp(S_SLASH, STEM_L, easeInOut(prog(t, T.grow)));
    tail = S_ROOT * easeInOut(prog(t, [T.cut - 0.02, T.cut + 0.22]));           // el corte: la cola alcanza la raiz
    const retract = easeInOut(prog(t, [T.toPhone[0] - 0.05, T.toPhone[0] + 0.5]));
    head = lerp(head, tail, retract);
    const w = LY.stem.w * (1 + 0.9 * Math.exp(-Math.abs(t - T.cut) / 0.07) * (t < T.cut + 0.3 ? 1 : 0));
    st.set(t < T.toPhone[0] + 0.5 ? STEM : null, tail, head, w, { seed: 2, headTaper: 30, tailTaper: 8 });
    LY.stem.leaves.forEach((lf, i) => {
      const s = stroke('leaf' + i, '#7FB069', '#3F6B33', '#E4F5CF');
      const pts = smoothPath(lf.path, 12), L = pathLength(pts);
      const k = spring(prog(t, [lf.t, lf.t + 0.5]), 0.6, 9) * (1 - easeIn(prog(t, [T.toPhone[0] - 0.1, T.toPhone[0] + 0.25])));
      s.set(k > 0.01 && t < T.toPhone[0] + 0.3 ? pts : null, 0, L * k, lf.w * (0.4 + 0.6 * k), { seed: 5 + i, headTaper: L * 0.55, tailTaper: L * 0.4 });
    });
  }
  {   // cinta de petalos entre los chips
    const s = stroke('ribbon', '#E8A0BF', '#B45F86', '#FFE3EE');
    const on = t >= T.ribbon[0] && t <= T.ribbon[1];
    const head = RIBBON_L * easeInOut(prog(t, [T.ribbon[0], T.ribbon[0] + 0.75])), tail = RIBBON_L * easeInOut(prog(t, [T.ribbon[1] - 0.75, T.ribbon[1]]));
    s.set(on ? RIBBON : null, tail, head, LY.ribbonW, { seed: 9, headTaper: 140, tailTaper: 160 });
  }
  {   // el tallo vuelve como subrayado del boton y pulsa con el kick
    const s = stroke('under', '#8CC474', '#4E8240', '#EAF8D8'); const u = LY.wa;
    const pts = smoothPath([[u.cx - u.w * 0.47, u.cy + u.h * 0.5 + 62], [u.cx - u.w * 0.1, u.cy + u.h * 0.5 + 74], [u.cx + u.w * 0.2, u.cy + u.h * 0.5 + 60], [u.cx + u.w * 0.47, u.cy + u.h * 0.5 + 68]], 20), L = pathLength(pts);
    const on = t >= T.underline[0] && t < T.waOut[1];
    const pulse = t > T.underline[1] - 0.25 ? kickPulse(t) : 0;
    s.set(on ? pts : null, L * easeIn(prog(t, T.waOut)), L * easeOut(prog(t, T.underline)), 13 * (1 + 0.5 * pulse), { seed: 4, headTaper: 46, tailTaper: 34 });
  }

  // --- chips de cristal sobre el telefono ---
  TL.CHIPS.forEach((label, i) => {
    const c = LY.chips[i];
    const k = spring(prog(t, [T.chipsIn[0] + i * 0.11, T.chipsIn[1] + 0.2 + i * 0.11]), 0.6, 10);
    const out = easeIn(prog(t, [T.chipsOut[0] + i * 0.04, T.chipsOut[1]]));
    const op = clamp(k * 3) * (1 - out);
    const tapK = i === 0 ? Math.exp(-Math.max(0, t - T.tapChip) * 7) * (t >= T.tapChip ? 1 : 0) : 0;
    const sc = (0.6 + 0.4 * k) * (1 + 0.10 * tapK) * (1 - 0.2 * out);
    const cy = c.cy + (1 - k) * 90 + Math.sin(t * 1.7 + i * 1.9) * 5 - out * 60;
    setGlass(i, c.cx, cy, c.w * sc, c.h * sc, c.h * sc / 2, op, i === 0 && t >= T.tapChip ? [0.30, 0.16, 0.46, 0.62 + 0.2 * tapK] : [0.035, 0.014, 0.055, 0.60], i === 1 ? 'B' : 'A');
    const L = chipLayers[i];
    if (op <= 0.001) { L.hide(); return; }
    L.mesh.position.set(c.cx, -cy, 0); L.mesh.scale.setScalar(sc); L.mesh.material.opacity = op;
    const cx = L.begin('chip');
    if (cx) { const fs = c.h * 0.36; cx.font = CAPS(fs); cx.letterSpacing = `${(fs * 0.12).toFixed(1)}px`; cx.fillStyle = WHITE; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillText(label, c.cx + fs * 0.06, c.cy + 2); L.end(true); }
  });

  // --- boton de cristal "PIDE POR WHATSAPP": sale de la barra de la pagina ---
  {
    const u = LY.wa, on = t >= T.waLift[0] && t < T.waOut[1];
    if (!on) { G[3].op = 0; waLayer.hide(); }
    else {
      const bb = rects.barBtn, toW = (x, y) => project((x - 195) * 0.01, (422 - y) * 0.01, 0.01);
      const a = toW(bb.x, bb.vy), b = toW(bb.x + bb.w, bb.vy + bb.h);
      const k = spring(prog(t, T.waLift), 0.62, 9), out = easeInOut(prog(t, T.waOut));
      const kk = k * (1 - out);
      const pulse = t > T.waLift[1] ? kickPulse(t, 0.2) : 0;
      const cx = lerp((a[0] + b[0]) / 2, u.cx, kk), cy = lerp((a[1] + b[1]) / 2, u.cy, kk);
      const w = lerp(b[0] - a[0], u.w, kk) * (1 + 0.035 * pulse), h = lerp(b[1] - a[1], u.h, kk) * (1 + 0.035 * pulse);
      setGlass(3, cx, cy, w, h, h / 2, 1, [0.014, 0.42, 0.09, 0.62], 'B');
      waLayer.mesh.position.set(cx, -cy, 0); waLayer.mesh.scale.setScalar(w / u.w);
      const c = waLayer.begin('wa');
      if (c) {
        const fs = u.h * 0.30; c.font = CAPS(fs); c.letterSpacing = `${(fs * 0.08).toFixed(1)}px`;
        const tw = c.measureText('PIDE POR WHATSAPP').width, ic = fs * 1.5, total = ic + fs * 0.5 + tw, x0 = W / 2 - total / 2;
        c.fillStyle = '#fff'; c.save(); c.translate(x0, u.cy - ic / 2); c.scale(ic / 24, ic / 24); c.fill(WA_PATH); c.restore();
        c.textBaseline = 'middle'; c.fillText('PIDE POR WHATSAPP', x0 + ic + fs * 0.5, u.cy + 3); waLayer.end(true);
      }
    }
  }

  kin.forEach((g) => g.update(t));
  updateEnd(t);
  if (safeLayer) { const c = safeLayer.begin('s'); if (c) { c.fillStyle = 'rgba(255,0,255,.2)'; c.fillRect(0, 0, W, LY.safe.top); c.fillRect(0, H - LY.safe.bottom, W, LY.safe.bottom); safeLayer.end(true); } }
}

// ---------- end card ----------
function updateEnd(t) {
  const E = LY.end, a = t - T.endIn[0];
  if (a < 0) { endLayer.hide(); G[4].op = 0; return; }
  const item = (d, dur = 0.5) => clamp((a - d) / dur);
  const kp = spring(item(0.34, 0.6), 0.62, 9);
  setGlass(4, W / 2, E.pillY, E.pillW * (0.8 + 0.2 * kp), E.pillH * (0.8 + 0.2 * kp), E.pillH / 2, clamp(item(0.34, 0.2)), null, 'B');
  const st = [item(0.06), item(0.12, 0.6), item(0.24), item(0.40), item(0.56), item(0.64)];
  const c = endLayer.begin(st.map((v) => v.toFixed(3)).join('|'));
  if (!c) return;
  c.textAlign = 'center'; c.textBaseline = 'alphabetic';
  const line = (txt, y, fnt, k, color = WHITE, ls = 0, dy = 26) => { if (k <= 0) return; c.save(); c.globalAlpha = clamp(k * 2.5); c.font = fnt; c.letterSpacing = `${ls}px`; c.fillStyle = color; c.fillText(txt, W / 2 + ls / 2, y + dy * (1 - easeOut(k))); c.restore(); };
  line(TL.ENDCARD.l1a, E.y1, `500 ${E.s1}px "Jost"`, st[0], '#E6D8F2');
  if (st[1] > 0) {                                      // el precio: por glifo, abre como la flor
    c.save(); c.font = `600 ${E.sPrice}px "Playfair"`; const chars = [...TL.ENDCARD.price]; const tw = c.measureText(TL.ENDCARD.price).width; let x = W / 2 - tw / 2;
    c.textAlign = 'left';
    chars.forEach((ch, i) => { const p = clamp((a - 0.12 - i * 0.03) / 0.45), sp = spring(p, 0.5, 11); const cw = c.measureText(ch).width;
      if (p > 0) { c.save(); c.globalAlpha = clamp(p * 3); c.translate(x + cw / 2, E.yPrice); c.scale(0.4 + 0.6 * sp, 0.4 + 0.6 * sp); c.fillStyle = WHITE; c.fillText(ch, -cw / 2, 0); c.restore(); } x += cw; });
    c.restore();
  }
  line(TL.ENDCARD.l1b, E.y2, `500 ${E.s1}px "Jost"`, st[2], '#E6D8F2');
  line(TL.ENDCARD.l2, E.pillY + E.s2 * 0.35, `500 ${E.s2}px "Jost"`, st[3], WHITE, 0, 0);
  line(TL.ENDCARD.sig.toUpperCase(), E.ySig, `600 ${E.sSig}px "Jost"`, st[4], ROSE, E.sSig * 0.2);
  line(TL.ENDCARD.disclaimer, E.yDisc, `500 ${E.sDisc}px "Jost"`, st[5], '#CDBBDD');
  endLayer.end(true);
}

// ---------- render ----------
const blurPass = fsPass(/* glsl */`
precision highp float; varying vec2 vUv; uniform sampler2D uSrc; uniform vec2 uDir;
void main(){ vec3 c = vec3(0.0); float w[7]; w[0]=0.1964; w[1]=0.1748; w[2]=0.1232; w[3]=0.0688; w[4]=0.0304; w[5]=0.0106; w[6]=0.0029;
  c += texture2D(uSrc, vUv).rgb * w[0];
  for (int i = 1; i < 7; i++){ c += texture2D(uSrc, vUv + uDir * float(i)).rgb * w[i]; c += texture2D(uSrc, vUv - uDir * float(i)).rgb * w[i]; }
  gl_FragColor = vec4(c, 1.0); }`, { uSrc: { value: null }, uDir: { value: new THREE.Vector2() } });
const copyPass = fsPass('precision highp float; varying vec2 vUv; uniform sampler2D uSrc; void main(){ gl_FragColor = vec4(texture2D(uSrc, vUv).rgb, 1.0); }', { uSrc: { value: null } });
const accPass = fsPass('precision highp float; varying vec2 vUv; uniform sampler2D uSrc; uniform float uW; void main(){ gl_FragColor = vec4(texture2D(uSrc, vUv).rgb * uW, 1.0); }', { uSrc: { value: null }, uW: { value: 1 } }, true);
accPass.mat.blending = THREE.AdditiveBlending;
const finalPass = fsPass(/* glsl */`
precision highp float; varying vec2 vUv; uniform sampler2D uSrc; uniform float uFrame;
float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233)) + uFrame * 0.618) * 43758.5453); }
vec3 toSRGB(vec3 c){ return mix(c * 12.92, 1.055 * pow(max(c, vec3(0.0)), vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
void main(){ vec3 c = toSRGB(texture2D(uSrc, vUv).rgb); c += (hash(gl_FragCoord.xy) - 0.5) / 255.0 * 2.2; gl_FragColor = vec4(c, 1.0); }`, { uSrc: { value: rtAcc.texture }, uFrame: { value: 0 } });

const halton = (i, b) => { let f = 1, r = 0; while (i > 0) { f /= b; r += f * (i % b); i = Math.floor(i / b); } return r; };
function jitter(k) {
  const jx = SUBS > 1 ? halton(k + 1, 2) - 0.5 : 0, jy = SUBS > 1 ? halton(k + 1, 3) - 0.5 : 0;
  camera.setViewOffset(RW, RH, jx, jy, RW, RH);
  const dx = jx * W / RW, dy = jy * H / RH;
  orthoPx.left = dx; orthoPx.right = W + dx; orthoPx.top = -dy; orthoPx.bottom = -H - dy; orthoPx.updateProjectionMatrix();
  JIT.set(dx, dy);
}
function renderSub() {
  renderer.setRenderTarget(rtScene); renderer.setClearColor(0x000000, 1); renderer.clear(true, true, true);
  renderer.render(backdrop.scene, orthoNDC); renderer.clearDepth();
  renderer.render(scene, camera);
  const needBlur = G.some((g) => g.op > 0.001) || LU.uOn.value > 0.5;
  if (needBlur) {          // desenfoque real de lo que hay detras (~34 px)
    copyPass.mat.uniforms.uSrc.value = rtScene.texture; renderer.setRenderTarget(rtQ1); renderer.render(copyPass.scene, orthoNDC);
    blurPass.mat.uniforms.uSrc.value = rtQ1.texture; blurPass.mat.uniforms.uDir.value.set(1.6 / rtQ1.width, 0);
    renderer.setRenderTarget(rtQ2); renderer.render(blurPass.scene, orthoNDC);
    blurPass.mat.uniforms.uSrc.value = rtQ2.texture; blurPass.mat.uniforms.uDir.value.set(0, 1.6 / rtQ1.height);
    renderer.setRenderTarget(rtQ1); renderer.render(blurPass.scene, orthoNDC);
    copyPass.mat.uniforms.uSrc.value = rtQ1.texture; renderer.setRenderTarget(rtQ2); renderer.render(copyPass.scene, orthoNDC);
    renderer.setRenderTarget(rtScene);
  }
  if (glassLayer('A')) renderer.render(glass.scene, orthoNDC);
  renderer.render(overA, orthoPx);
  if (LU.uOn.value > 0.5) renderer.render(liquid.scene, orthoNDC);
  if (glassLayer('B')) renderer.render(glass.scene, orthoNDC);
  renderer.render(overB, orthoPx);
}
window.renderFrame = async (f) => {
  renderer.setRenderTarget(rtAcc); renderer.setClearColor(0x000000, 1); renderer.clear(true, false, false);
  for (let k = 0; k < SUBS; k++) {
    const ts = SUBS === 1 ? f / 60 : f / 60 + (-0.5 + (k + 0.5) / SUBS) / 120;
    frameState(Math.max(0, ts));
    jitter(k);
    renderSub();
    accPass.mat.uniforms.uSrc.value = rtScene.texture; accPass.mat.uniforms.uW.value = 1 / SUBS;
    renderer.setRenderTarget(rtAcc); renderer.render(accPass.scene, orthoNDC);
  }
  finalPass.mat.uniforms.uFrame.value = f;
  renderer.setRenderTarget(null); renderer.render(finalPass.scene, orthoNDC);
  renderer.getContext().finish();
  return true;
};
window.compositorInfo = { W, H, RW, RH, FORMAT, SUBS, frames: TL.FRAMES };
window.ready = true;
