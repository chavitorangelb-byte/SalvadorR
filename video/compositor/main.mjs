// Compositor deterministico frame(t) para el video de Siniestro Tattoo Studio.
// Three.js (WebGL2 por software). 8 subcuadros por cuadro (obturador de 180 grados) acumulados en float.
// API para el render: window.renderFrame(f) -> deja el cuadro en el canvas.
import * as THREE from './vendor/three.module.js';
import { RoomEnvironment } from './vendor/RoomEnvironment.js';
import * as TL from '../timeline/timeline.mjs';
import { layoutFor } from './layout.mjs';
import { InkStroke, smoothPath, handCircle, pathLength } from './ink.mjs';
import { TextLayer, KineticGroup, WrittenGroup, measure, DISPLAY, TEXT, BONE, SILVER, font } from './text.mjs';

const { T, clamp, lerp, prog, easeInOut, easeOut, easeIn, spring, smooth } = TL;
const qs = new URLSearchParams(location.search);
const FORMAT = qs.get('format') || '916';
const SCALE = Number(qs.get('scale') || 1);
const SUBS = Number(qs.get('subs') || 8);
const SAFE = qs.has('safe');
const LY = layoutFor(FORMAT);
const W = LY.W, H = LY.H;
const RW = Math.round(W * SCALE), RH = Math.round(H * SCALE);
const CAP = '../build/capture/';

// ---------- utilidades ----------
const lin = (hex) => new THREE.Color(hex).convertSRGBToLinear();
const deg = Math.PI / 180;
const fetchJSON = (u) => fetch(u).then((r) => r.json());
async function bitmap(url) { const b = await (await fetch(url)).blob(); return createImageBitmap(b); }
function texFrom(img, { srgb = true, mips = true } = {}) {
  const t = new THREE.Texture(img);
  t.flipY = false;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.generateMipmaps = mips;
  t.minFilter = mips ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.anisotropy = 2;
  t.needsUpdate = true;
  return t;
}
function roundRectShape(w, h, r, cutTR = 0, cutBL = 0) {
  const s = new THREE.Shape();
  const x0 = -w / 2, y0 = -h / 2, x1 = w / 2, y1 = h / 2;
  if (cutTR || cutBL) {        // corte diagonal tomado del logo (esquinas sup. der. e inf. izq.)
    s.moveTo(x0, y1); s.lineTo(x1 - cutTR, y1); s.lineTo(x1, y1 - cutTR); s.lineTo(x1, y0);
    s.lineTo(x0 + cutBL, y0); s.lineTo(x0, y0 + cutBL); s.lineTo(x0, y1);
    return s;
  }
  s.moveTo(x0 + r, y0); s.lineTo(x1 - r, y0); s.quadraticCurveTo(x1, y0, x1, y0 + r);
  s.lineTo(x1, y1 - r); s.quadraticCurveTo(x1, y1, x1 - r, y1); s.lineTo(x0 + r, y1);
  s.quadraticCurveTo(x0, y1, x0, y1 - r); s.lineTo(x0, y0 + r); s.quadraticCurveTo(x0, y0, x0 + r, y0);
  return s;
}
function slab(shape, depth, bevel, frontMat, sideMat, w, h) {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel * 0.8, bevelSegments: 4, curveSegments: 24 });
  g.translate(0, 0, -(depth + bevel));          // la cara frontal queda en z = 0
  // UV de la cara frontal = rect de la pieza (textura con y hacia abajo)
  const pos = g.attributes.position, uv = g.attributes.uv, nor = g.attributes.normal;
  for (let i = 0; i < pos.count; i++) {
    if (nor.getZ(i) > 0.9) uv.setXY(i, (pos.getX(i) + w / 2) / w, (h / 2 - pos.getY(i)) / h);
  }
  uv.needsUpdate = true;
  return new THREE.Mesh(g, [frontMat, sideMat]);
}

// ---------- arranque ----------
const canvas = document.createElement('canvas');
canvas.width = RW; canvas.height = RH;
canvas.style.width = RW + 'px'; canvas.style.height = RH + 'px';
document.body.appendChild(canvas);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true, alpha: false });
renderer.setPixelRatio(1);
renderer.setSize(RW, RH, false);
renderer.autoClear = false;
renderer.toneMapping = THREE.NoToneMapping;

const [vo, man] = await Promise.all([fetchJSON('../timeline/vo_words.json'), fetchJSON(CAP + 'manifest.json')]);
const fontsToLoad = [
  new FontFace('Big Shoulders Display', 'url(../../site/fonts/big-shoulders-display-latin-900-normal.woff2)', { weight: '900' }),
  new FontFace('Barlow', 'url(../../site/fonts/barlow-latin-500-normal.woff2)', { weight: '500' }),
  new FontFace('Barlow', 'url(../../site/fonts/barlow-latin-600-normal.woff2)', { weight: '600' }),
  new FontFace('Barlow', 'url(../../site/fonts/barlow-latin-700-normal.woff2)', { weight: '700' }),
];
for (const f of fontsToLoad) document.fonts.add(await f.load());

// render targets (lineal, media precision); escena con MSAA 4x
const rtOpts = { type: THREE.HalfFloatType, colorSpace: THREE.LinearSRGBColorSpace, depthBuffer: true };
const rtScene = new THREE.WebGLRenderTarget(RW, RH, { ...rtOpts });
const rtBack = new THREE.WebGLRenderTarget(RW >> 2, RH >> 2, { ...rtOpts, depthBuffer: false });
const rtAcc = new THREE.WebGLRenderTarget(RW, RH, { ...rtOpts, depthBuffer: false });
const rtQ1 = new THREE.WebGLRenderTarget(RW >> 2, RH >> 2, { ...rtOpts, depthBuffer: false });
const rtQ2 = new THREE.WebGLRenderTarget(RW >> 2, RH >> 2, { ...rtOpts, depthBuffer: false });

const quadGeo = new THREE.PlaneGeometry(2, 2);
const orthoNDC = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
function fsPass(frag, uniforms) {
  const m = new THREE.ShaderMaterial({ uniforms, depthTest: false, depthWrite: false,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }', fragmentShader: frag });
  const mesh = new THREE.Mesh(quadGeo, m); mesh.frustumCulled = false;
  const sc = new THREE.Scene(); sc.add(mesh);
  return { scene: sc, mat: m, mesh };
}

// ---------- fondo ----------
const backdrop = fsPass(/* glsl */`
precision highp float; varying vec2 vUv;
uniform float uT; uniform vec2 uPar; uniform float uOn; uniform float uAspect;
float g(vec2 p, vec2 c, vec2 r){ vec2 d = (p - c) / r; return exp(-dot(d, d)); }
void main(){
  vec2 p = vUv; vec2 q = vec2((p.x - 0.5) * uAspect, p.y - 0.5);
  vec3 base = mix(vec3(0.0042), vec3(0.0078), smoothstep(0.0, 1.0, p.y));
  float glow = g(q, vec2(0.04, 0.03) + uPar * 0.25, vec2(0.95, 0.75));
  base += vec3(0.0055) * glow;
  float b = 0.0;
  b += 0.016 * g(q, vec2(-0.30 + 0.03 * sin(uT * 0.23), 0.28) + uPar * 0.55, vec2(0.36, 0.22));
  b += 0.012 * g(q, vec2(0.34 + 0.02 * cos(uT * 0.19), -0.10) + uPar * 0.40, vec2(0.30, 0.42));
  b += 0.010 * g(q, vec2(-0.18, -0.36 + 0.02 * sin(uT * 0.31)) + uPar * 0.70, vec2(0.42, 0.20));
  b += 0.008 * g(q, vec2(0.22 + 0.02 * sin(uT * 0.17), 0.42) + uPar * 0.30, vec2(0.25, 0.18));
  vec3 col = base + vec3(b);
  float vig = smoothstep(1.15, 0.25, length(q * vec2(1.0, 0.9)));
  col *= mix(0.55, 1.0, vig);
  gl_FragColor = vec4(col * uOn, 1.0);
}`, { uT: { value: 0 }, uPar: { value: new THREE.Vector2() }, uOn: { value: 1 }, uAspect: { value: W / H } });

// ---------- escena 3D ----------
const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.035).texture;
const key = new THREE.DirectionalLight(0xffffff, 1.4); key.position.set(-3, 5, 6); scene.add(key);
const fill = new THREE.DirectionalLight(0xffffff, 0.35); fill.position.set(4, -2, 3); scene.add(fill);
const ZC = 30;
const camera = new THREE.PerspectiveCamera(LY.fov, W / H, 0.1, 200);
camera.position.set(0, 0, ZC); camera.lookAt(0, 0, 0);
const FPX = (H / 2) / Math.tan((LY.fov / 2) * deg);        // focal en px de diseno

// celular: pantalla 390x844 px CSS = 3.90 x 8.44 unidades
const SW = 3.9, SH = 8.44, BEZ = 0.2;
const phoneRoot = new THREE.Group(); scene.add(phoneRoot);
const phoneOff = new THREE.Group(); phoneRoot.add(phoneOff);
// matcap procedural de metal oscuro: una sola lectura de textura, reflejo que sigue a la camara
function matcapTex(base, hi) {
  const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
  const g = x.createRadialGradient(100, 86, 6, 128, 128, 128);
  g.addColorStop(0, hi); g.addColorStop(0.18, '#8a8a8a'); g.addColorStop(0.45, base); g.addColorStop(0.82, '#0e0e0e'); g.addColorStop(1, '#6E6E6E');
  x.fillStyle = g; x.fillRect(0, 0, 256, 256);
  x.globalAlpha = 0.5; x.fillStyle = '#C9C9C9'; x.beginPath(); x.ellipse(180, 190, 30, 12, -0.6, 0, Math.PI * 2); x.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const glassMat = new THREE.MeshBasicMaterial({ color: 0x060606 });
const frameMat = new THREE.MeshMatcapMaterial({ matcap: matcapTex('#2a2a2a', '#EDEAE6'), color: 0xffffff });
const bodyShape = roundRectShape(SW + 2 * BEZ - 0.09, SH + 2 * BEZ - 0.09, 0.58);
const body = new THREE.Mesh(new THREE.ExtrudeGeometry(bodyShape, { depth: 0.30, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.045, bevelSegments: 5, curveSegments: 28 }), [glassMat, frameMat]);
body.geometry.translate(0, 0, -0.35);
phoneOff.add(body);
const BODY_W = SW + 2 * BEZ, BODY_H = SH + 2 * BEZ, BODY_R = 0.625;

// barra de estado y teclado (generados en canvas a 3x)
function statusCanvas() {
  const c = document.createElement('canvas'); c.width = 1170; c.height = 141;
  const x = c.getContext('2d'); x.scale(3, 3);
  x.fillStyle = BONE; x.font = '600 16px "Barlow"'; x.textBaseline = 'middle'; x.fillText('11:55', 32, 25);
  // senal, wifi y bateria genericos
  for (let i = 0; i < 4; i++) { x.globalAlpha = i < 3 ? 1 : 0.35; x.fillRect(300 + i * 5.5, 30 - (4 + i * 2.6), 3.6, 4 + i * 2.6); }
  x.globalAlpha = 1; x.lineWidth = 2; x.strokeStyle = BONE;
  x.beginPath(); x.arc(334, 31, 9, -Math.PI * 0.75, -Math.PI * 0.25); x.stroke();
  x.beginPath(); x.arc(334, 31, 4.5, -Math.PI * 0.75, -Math.PI * 0.25); x.stroke();
  x.lineWidth = 1.4; x.globalAlpha = 0.6; x.strokeRect(347, 19.5, 22, 11); x.globalAlpha = 1; x.fillRect(349, 21.5, 15, 7); x.fillRect(370, 23, 1.6, 4);
  // camara frontal (perforacion generica)
  x.fillStyle = '#000'; x.beginPath(); x.arc(195, 21, 5.6, 0, Math.PI * 2); x.fill();
  const t = new THREE.CanvasTexture(c); t.flipY = false; t.colorSpace = THREE.SRGBColorSpace; return t;
}
const KB_ROWS = ['qwertyuiop', 'asdfghjklñ', 'zxcvbnm'];
const kbCanvas = document.createElement('canvas'); kbCanvas.width = 1170; kbCanvas.height = 975;
const kbTex = new THREE.CanvasTexture(kbCanvas); kbTex.flipY = false; kbTex.colorSpace = THREE.SRGBColorSpace;
let kbSig = null;
function drawKeyboard(pressed) {
  if (pressed === kbSig) return; kbSig = pressed;
  const x = kbCanvas.getContext('2d'); x.setTransform(3, 0, 0, 3, 0, 0);
  x.fillStyle = '#222222'; x.fillRect(0, 0, 390, 325);
  const keyW = 33, gap = 6, rowY = [10, 64, 118, 172];
  const keyRect = (cx, y, w) => ({ x: cx - w / 2, y, w, h: 44 });
  const keys = [];
  KB_ROWS.forEach((row, ri) => {
    const n = row.length, total = n * keyW + (n - 1) * gap, x0 = (390 - total) / 2;
    [...row].forEach((ch, i) => keys.push({ ch, ...keyRect(x0 + i * (keyW + gap) + keyW / 2, rowY[ri], keyW) }));
  });
  keys.push({ ch: '⇧', x: 3, y: rowY[2], w: 44, h: 44, fn: 1 }, { ch: '⌫', x: 343, y: rowY[2], w: 44, h: 44, fn: 1 });
  keys.push({ ch: '123', x: 3, y: rowY[3], w: 88, h: 44, fn: 1 }, { ch: 'espacio', x: 97, y: rowY[3], w: 196, h: 44 }, { ch: 'intro', x: 299, y: rowY[3], w: 88, h: 44, fn: 1 });
  for (const k of keys) {
    const on = pressed && (k.ch === pressed || (pressed === ' ' && k.ch === 'espacio'));
    x.fillStyle = on ? '#6E6E6E' : k.fn ? '#2E2E2E' : '#3A3A3A';
    x.beginPath(); x.roundRect(k.x, k.y, k.w, k.h, 6); x.fill();
    x.fillStyle = BONE; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.font = k.ch.length > 1 ? '500 15px "Barlow"' : '500 22px "Barlow"';
    x.fillText(k.ch, k.x + k.w / 2, k.y + k.h / 2 + 1);
  }
  if (pressed && pressed !== ' ') {        // burbuja de la tecla presionada
    const k = keys.find((q) => q.ch === pressed);
    if (k) {
      x.fillStyle = '#6E6E6E'; x.beginPath(); x.roundRect(k.x - 8, k.y - 56, k.w + 16, 58, 10); x.fill();
      x.fillStyle = BONE; x.font = '500 30px "Barlow"'; x.fillText(pressed, k.x + k.w / 2, k.y - 26);
    }
  }
  x.fillStyle = BONE; x.globalAlpha = 0.85; x.beginPath(); x.roundRect(128, 312, 134, 5, 2.5); x.fill(); x.globalAlpha = 1;
  kbTex.needsUpdate = true;
}
drawKeyboard('');

const screenMat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: true,
  uniforms: {
    uPage: { value: null }, uStatus: { value: statusCanvas() }, uKb: { value: kbTex }, uKbY: { value: 0 },
    uTaps: { value: [new THREE.Vector4(), new THREE.Vector4(), new THREE.Vector4(), new THREE.Vector4()] },
    uOn: { value: 0 }, uOp: { value: 1 }, uLightDir: { value: new THREE.Vector3(-0.35, 0.55, 0.75).normalize() },
  },
  vertexShader: /* glsl */`
    varying vec2 vUv; varying vec3 vN; varying vec3 vV;
    void main(){ vUv = uv; vec4 wp = modelMatrix * vec4(position, 1.0); vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - wp.xyz); gl_Position = projectionMatrix * viewMatrix * wp; }`,
  fragmentShader: /* glsl */`
    precision highp float;
    varying vec2 vUv; varying vec3 vN; varying vec3 vV;
    uniform sampler2D uPage; uniform sampler2D uStatus; uniform sampler2D uKb; uniform float uKbY;
    uniform vec4 uTaps[4]; uniform float uOn; uniform float uOp; uniform vec3 uLightDir;
    float sdRR(vec2 p, vec2 b, float r){ vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
    void main(){
      vec2 css = vec2(vUv.x * 390.0, (1.0 - vUv.y) * 844.0);
      float sd = sdRR(css - vec2(195.0, 422.0), vec2(195.0, 422.0), 44.0);
      float aa = fwidth(sd);
      float mask = 1.0 - smoothstep(-aa, aa, sd);
      // refraccion en el borde curvo del cristal
      float edge = smoothstep(-16.0, 0.0, sd);
      vec2 dir = normalize(css - vec2(195.0, 422.0) + 1e-3);
      vec2 c2 = css - dir * edge * edge * 6.0;
      vec3 col = texture2D(uPage, c2 / vec2(390.0, 844.0)).rgb;
      // teclado generico
      float kbTop = 844.0 - 325.0 * uKbY;
      if (uKbY > 0.001 && css.y > kbTop) { vec4 k = texture2D(uKb, vec2(css.x / 390.0, (css.y - kbTop) / 325.0)); col = mix(col, k.rgb, k.a); }
      // barra de estado e indicador de inicio
      if (css.y < 47.0) { vec4 s = texture2D(uStatus, vec2(css.x / 390.0, css.y / 47.0)); col = mix(col, s.rgb, s.a); }
      float hi = sdRR(css - vec2(195.0, 836.0), vec2(67.0, 2.5), 2.5);
      col = mix(col, vec3(0.80), (1.0 - smoothstep(-0.7, 0.7, hi)) * 0.8 * step(uKbY, 0.001));
      // toques: onda suave
      for (int i = 0; i < 4; i++) {
        vec4 tp = uTaps[i];
        if (tp.w <= 0.0) continue;
        float d = length(css - tp.xy);
        float age = tp.z;
        float disc = (1.0 - smoothstep(16.0, 20.0, d)) * clamp(1.0 - age / 0.32, 0.0, 1.0) * 0.30;
        float rr = 18.0 + age * 62.0;
        float ring = (1.0 - smoothstep(1.2, 3.0, abs(d - rr))) * clamp(1.0 - age / 0.42, 0.0, 1.0) * 0.30;
        col = mix(col, vec3(0.85), clamp((disc + ring) * tp.w, 0.0, 1.0));
      }
      col *= uOn;
      // reflejo del cristal: banda suave que se mueve con la camara
      vec3 R = reflect(-vV, normalize(vN));
      float band = smoothstep(0.10, 0.0, abs(R.x * 0.82 + R.y * 0.57 - 0.18)) * 0.050 + pow(max(dot(R, uLightDir), 0.0), 18.0) * 0.06;
      float rim = pow(edge, 5.0) * 0.07;
      col += vec3(band + rim);
      gl_FragColor = vec4(col, mask * uOp);
    }`,
});
const screen = new THREE.Mesh(new THREE.PlaneGeometry(SW, SH), screenMat);
screen.position.z = 0.002; screen.renderOrder = 2;
phoneOff.add(screen);

// tarjetas 3D y boton de WhatsApp: la misma pieza de interfaz, ahora con grosor y sombra
const darkSide = new THREE.MeshMatcapMaterial({ matcap: matcapTex('#1a1a1a', '#8a8a8a'), color: 0xffffff });
const shadowMat = (op) => new THREE.ShaderMaterial({ transparent: true, depthWrite: false,
  uniforms: { uSoft: { value: 0.1 }, uOp: { value: op }, uAsp: { value: 1 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `precision highp float; varying vec2 vUv; uniform float uSoft; uniform float uOp; uniform float uAsp;
    float sdB(vec2 p, vec2 b){ vec2 d = abs(p) - b; return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0); }
    void main(){ vec2 p = (vUv - 0.5) * vec2(uAsp, 1.0); float d = sdB(p, vec2(uAsp * 0.5 - 0.18, 0.32)); float a = 1.0 - smoothstep(-uSoft, uSoft, d); gl_FragColor = vec4(0.0, 0.0, 0.0, a * uOp); }` });
const pieces = {};
async function makePiece(id, cut, depth) {
  const tx = man.tex[id];
  const img = await bitmap(CAP + tx.file);
  const w = tx.rect.w * 0.01, h = tx.rect.h * 0.01;
  const front = new THREE.MeshBasicMaterial({ map: texFrom(img), toneMapped: false });
  const mesh = slab(roundRectShape(w, h, 0, cut[0] * 0.01, cut[1] * 0.01), depth, 0.008, front, darkSide, w, h);
  mesh.renderOrder = 5;
  const sh = new THREE.Mesh(new THREE.PlaneGeometry(w * 1.25, h * 1.25), shadowMat(0));
  sh.material.uniforms.uAsp.value = (w * 1.25) / (h * 1.25);
  sh.renderOrder = 3;
  const g = new THREE.Group(); g.add(mesh); g.visible = false;
  phoneOff.add(g); phoneOff.add(sh); sh.visible = false;
  pieces[id] = { g, mesh, sh, w, h, rect: tx.rect, scrollY: tx.scrollY };
}
await makePiece('card_cristo', [16, 0], 0.05);
await makePiece('card_leon', [16, 0], 0.05);
await makePiece('card_quetzalcoatl', [16, 0], 0.05);
await makePiece('wa_button', [12, 12], 0.12);

// end card: placa de cristal oscuro con el logo oficial (solo se mueve; la luz va encima)
const logoImg = await bitmap('../../site/img/logo-siniestro.png');
const LOGO_AR = logoImg.height / logoImg.width;
const endGroup = new THREE.Group(); scene.add(endGroup); endGroup.visible = false;
const LOGO_WW = LY.end.logoW * ZC / FPX, LOGO_WH = LOGO_WW * LOGO_AR;
const plateMat = new THREE.MeshPhysicalMaterial({ color: 0x121212, metalness: 0.25, roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.08, envMapIntensity: 0.9, transparent: true });
const plateSide = new THREE.MeshPhysicalMaterial({ color: 0x2a2a2a, metalness: 0.9, roughness: 0.3, transparent: true });
const plate = new THREE.Mesh(new THREE.ExtrudeGeometry(roundRectShape(LOGO_WW + 0.9, LOGO_WH + 0.8, 0, 0.32, 0.32), { depth: 0.14, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.025, bevelSegments: 3 }), [plateMat, plateSide]);
plate.geometry.translate(0, 0, -0.17);
endGroup.add(plate);
const logoMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false,
  uniforms: { uLogo: { value: texFrom(logoImg) }, uSweep: { value: -1 }, uOp: { value: 1 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `precision highp float; varying vec2 vUv; uniform sampler2D uLogo; uniform float uSweep; uniform float uOp;
    void main(){ vec4 c = texture2D(uLogo, vec2(vUv.x, 1.0 - vUv.y));
      float l = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
      float band = exp(-pow((vUv.x * 0.9 + vUv.y * 0.35 - uSweep) / 0.07, 2.0));
      vec3 light = vec3(0.92, 0.91, 0.89) * band * smoothstep(0.15, 0.6, l) * 0.85;
      gl_FragColor = vec4(c.rgb + light, c.a * uOp); }` });
const logo = new THREE.Mesh(new THREE.PlaneGeometry(LOGO_WW, LOGO_WH), logoMat);
logo.position.z = 0.004; logo.renderOrder = 8; endGroup.add(logo);

// ---------- capa 2D (ortografica en px de diseno, y hacia abajo) ----------
const over = new THREE.Scene();
const orthoPx = new THREE.OrthographicCamera(0, W, 0, -H, -10, 10);
// barra de busqueda de cristal (desenfoca lo que hay detras: 28-40 px)
const glassBar = fsPass(/* glsl */`
precision highp float; varying vec2 vUv;
uniform sampler2D uBlur; uniform vec2 uRes; uniform vec4 uRect; uniform float uOp; uniform float uR;
float sdRR(vec2 p, vec2 b, float r){ vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main(){
  vec2 px = vec2(vUv.x, 1.0 - vUv.y) * uRes;
  float d = sdRR(px - uRect.xy, uRect.zw * 0.5, uR);
  float aa = 1.2;
  float inside = 1.0 - smoothstep(-aa, aa, d);
  if (inside <= 0.0) discard;
  vec3 b = texture2D(uBlur, vUv).rgb;
  float lum = dot(b, vec3(0.2126, 0.7152, 0.0722));
  b = max(vec3(0.0), mix(vec3(lum), b, 1.4));                   // saturacion 140 %
  vec3 col = b * 1.15 + vec3(0.030);                            // vidrio oscuro con tinte hueso
  float border = 1.0 - smoothstep(0.0, 1.2, abs(d + 0.6));     // borde de 1 px
  col = mix(col, vec3(0.56), border * 0.55);
  float top = smoothstep(uRect.y - uRect.w * 0.5 + 18.0, uRect.y - uRect.w * 0.5, px.y) * 0.035;
  col += vec3(top);
  col += (hash(px) - 0.5) * 0.02 * 0.25;                        // ruido 2 %
  gl_FragColor = vec4(col, inside * uOp);
}`, { uBlur: { value: rtQ2.texture }, uRes: { value: new THREE.Vector2(W, H) }, uRect: { value: new THREE.Vector4() }, uOp: { value: 0 }, uR: { value: 64 } });
glassBar.mat.transparent = true;
const blurPass = fsPass(/* glsl */`
precision highp float; varying vec2 vUv; uniform sampler2D uSrc; uniform vec2 uDir;
void main(){ vec3 c = vec3(0.0); float w[7]; w[0]=0.1964; w[1]=0.1748; w[2]=0.1232; w[3]=0.0688; w[4]=0.0304; w[5]=0.0106; w[6]=0.0029;
  c += texture2D(uSrc, vUv).rgb * w[0];
  for (int i = 1; i < 7; i++){ c += texture2D(uSrc, vUv + uDir * float(i)).rgb * w[i]; c += texture2D(uSrc, vUv - uDir * float(i)).rgb * w[i]; }
  gl_FragColor = vec4(c, 1.0); }`, { uSrc: { value: null }, uDir: { value: new THREE.Vector2() } });
const copyPass = fsPass('precision highp float; varying vec2 vUv; uniform sampler2D uSrc; void main(){ gl_FragColor = vec4(texture2D(uSrc, vUv).rgb, 1.0); }', { uSrc: { value: null } });
const accPass = fsPass('precision highp float; varying vec2 vUv; uniform sampler2D uSrc; uniform float uW; void main(){ gl_FragColor = vec4(texture2D(uSrc, vUv).rgb * uW, 1.0); }', { uSrc: { value: null }, uW: { value: 1 } });
accPass.mat.blending = THREE.AdditiveBlending; accPass.mat.transparent = true;
const finalPass = fsPass(/* glsl */`
precision highp float; varying vec2 vUv; uniform sampler2D uSrc; uniform float uFrame;
float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233)) + uFrame * 0.618) * 43758.5453); }
vec3 toSRGB(vec3 c){ return mix(c * 12.92, 1.055 * pow(max(c, vec3(0.0)), vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
void main(){ vec3 c = toSRGB(texture2D(uSrc, vUv).rgb); c += (hash(gl_FragCoord.xy) - 0.5) / 255.0 * 1.6; gl_FragColor = vec4(c, 1.0); }`, { uSrc: { value: rtAcc.texture }, uFrame: { value: 0 } });

// tinta
const inks = {};
const ink = (id) => { if (!inks[id]) { inks[id] = new InkStroke(); over.add(inks[id].mesh); } return inks[id]; };

// textos
const kin = Object.fromEntries(TL.KINETIC.map((d) => [d.id, new KineticGroup(over, d, LY.kinetic[d.id], vo, SCALE)]));
const writtenCol = (i) => ({ ...LY.written, y: LY.written.y });
const written = TL.WRITTEN.map((d, i) => new WrittenGroup(over, d, writtenCol(i), vo, SCALE));
const SB = LY.search;
const searchLayer = new TextLayer(over, SB.cx - SB.w / 2, SB.cy - SB.h / 2, SB.w, SB.h, SCALE);
const typed = TL.typingTimes(TL.QUERY, T.type);
const endTag = new TextLayer(over, 0, LY.end.taglineY - 60, W, 110, SCALE);
const endDisc = new TextLayer(over, 0, LY.end.disclaimerY - 40, W, 80, SCALE);
const safeLayer = SAFE ? new TextLayer(over, 0, 0, W, H, SCALE) : null;

// ---------- estado de la pagina en el tiempo ----------
const frames = man.frames;
const fKeys = Object.keys(frames).map(Number).sort((a, b) => a - b);
const pageAt = (t, k) => {
  const f = clamp(Math.round(t * 60), fKeys[0], fKeys[fKeys.length - 1]);
  const fr = frames[f];
  const j = Math.min(fr.files.length - 1, Math.floor(k * fr.files.length / SUBS));
  return { file: fr.files[j], scrollY: fr.scrollY[Math.min(j, fr.scrollY.length - 1)], fr };
};
const texCache = new Map();
async function loadPage(file) {
  if (texCache.has(file)) return texCache.get(file);
  const p = bitmap(CAP + file).then((img) => texFrom(img));
  texCache.set(file, p);
  return p;
}
function evict(keep) {
  for (const [k, v] of texCache) if (!keep.has(k)) { v.then((t) => { t.dispose(); if (t.image && t.image.close) t.image.close(); }); texCache.delete(k); }
}

// rect de una sonda en coordenadas de viewport al tiempo t (si es del flujo del documento, sigue el scroll)
const probe = (name) => man.rects[name];
function rectAt(name, scrollY) {
  const r = probe(name);
  if (!r) return null;
  const fixed = name === 'lang' || name === 'langEn';
  return { x: r.x, y: fixed ? r.y : r.docY - scrollY, w: r.w, h: r.h };
}

// ---------- encuadre del celular ----------
const keysPh = LY.phone;
function resolveAnchor(a, scrollY) {
  if (Array.isArray(a)) return a;
  const r = probe(a);
  return [r.x + r.w / 2, r.docY - r.scrollY + r.h / 2];
}
function phonePose(t, scrollY) {
  let i = 0;
  while (i < keysPh.length - 1 && keysPh[i + 1][0] <= t) i++;
  const [t0, a] = keysPh[i];
  const [t1, b] = keysPh[Math.min(i + 1, keysPh.length - 1)];
  let k = t1 > t0 ? clamp((t - t0) / (t1 - t0)) : 1;
  if (t <= keysPh[0][0]) k = 0;
  const e = b.ease === 'spring' ? spring(k, 0.62, 9.5) : b.ease === 'sine' ? 0.5 - 0.5 * Math.cos(Math.PI * k) : easeInOut(k);
  const A = resolveAnchor(a.anchor, scrollY), B = resolveAnchor(b.anchor, scrollY);
  const P = (x, y) => lerp(x, y, e);
  return {
    anchor: [P(A[0], B[0]), P(A[1], B[1])], pos: [P(a.pos[0], b.pos[0]), P(a.pos[1], b.pos[1])],
    s: P(a.s, b.s), yaw: P(a.yaw, b.yaw), pitch: P(a.pitch, b.pitch), roll: P(a.roll, b.roll),
    op: P(a.op ?? 1, b.op ?? 1),
  };
}
// deriva lenta (vida) y parallax de camara
const drift = (t) => ({ yaw: 0.6 * Math.sin(t * 0.9), pitch: 0.45 * Math.sin(t * 0.7 + 1.3), x: 2.5 * Math.sin(t * 0.55) });
const tmpV = new THREE.Vector3();
function applyPhone(ph) {
  const d = 0.01 * FPX / ph.s;              // distancia al ancla para lograr la escala pedida
  const zw = ZC - d;
  const xw = (ph.pos[0] - W / 2) * d / FPX, yw = -(ph.pos[1] - H / 2) * d / FPX;
  phoneRoot.position.set(xw, yw, zw);
  phoneRoot.rotation.set(ph.pitch * deg, ph.yaw * deg, ph.roll * deg, 'YXZ');
  phoneOff.position.set(-(ph.anchor[0] - 195) * 0.01, (ph.anchor[1] - 422) * 0.01, 0);
  phoneRoot.updateMatrixWorld(true);
}
function toScreen(local) {   // punto local del celular -> px del cuadro
  tmpV.set(local[0], local[1], local[2] || 0).applyMatrix4(phoneOff.matrixWorld).project(camera);
  return [(tmpV.x * 0.5 + 0.5) * W, (-tmpV.y * 0.5 + 0.5) * H];
}
const cssToScreen = (x, y, z = 0) => toScreen([(x - 195) * 0.01, (422 - y) * 0.01, z]);
function setPhoneOpacity(op) {
  for (const m of [glassMat, frameMat]) { m.transparent = op < 0.999; m.opacity = op; }
}

// contorno del cuerpo proyectado (para que la tinta lo dibuje)
function outlinePath() {
  // empieza arriba al centro y recorre en sentido horario
  const pts = [[0, BODY_H / 2]], w = BODY_W / 2, h = BODY_H / 2, r = BODY_R, n = 22;
  for (let i = 0; i <= n; i++) { const a = Math.PI / 2 - (i / n) * Math.PI / 2; pts.push([w - r + Math.cos(a) * r, h - r + Math.sin(a) * r]); }
  for (let i = 0; i <= n; i++) { const a = 0 - (i / n) * Math.PI / 2; pts.push([w - r + Math.cos(a) * r, -h + r + Math.sin(a) * r]); }
  for (let i = 0; i <= n; i++) { const a = -Math.PI / 2 - (i / n) * Math.PI / 2; pts.push([-w + r + Math.cos(a) * r, -h + r + Math.sin(a) * r]); }
  for (let i = 0; i <= n; i++) { const a = Math.PI - (i / n) * Math.PI / 2; pts.push([-w + r + Math.cos(a) * r, h - r + Math.sin(a) * r]); }
  pts.push([0, h]);
  // a coordenadas locales del grupo desplazado (la pantalla centrada en 0,0)
  return pts.map((p) => toScreen([p[0], p[1], 0.012]));
}

// ---------- frame(t) ----------
const vis = (t, [a, b], fin = 0.12, fout = 0.12) => clamp((t - a) / fin) * (1 - clamp((t - b) / fout));
let curPage = null;

async function prepare(f) {
  const need = new Set();
  for (let k = 0; k < SUBS; k++) {
    const ts = f / 60 + (-0.5 + (k + 0.5) / SUBS) / 120;
    need.add(pageAt(ts, k).file);
  }
  const nextF = f + 1;
  for (let k = 0; k < SUBS; k += 4) need.add(pageAt(nextF / 60, k).file);
  await Promise.all([...need].map(loadPage));
  evict(need);
  return need;
}

const loaded = new Map();
function frameState(t, k) {
  const pg = pageAt(t, k);
  const scrollY = pg.scrollY;
  // --- celular ---
  const show = t >= T.phoneIn[0] && t < T.outroFade[1] + 0.02;
  phoneRoot.visible = show;
  {
    const ph = phonePose(t, scrollY);
    const dr = drift(t);
    ph.yaw += dr.yaw; ph.pitch += dr.pitch; ph.pos = [ph.pos[0] + dr.x, ph.pos[1]];
    applyPhone(ph);
    setPhoneOpacity(clamp(ph.op));
    screenMat.uniforms.uOn.value = smooth(T.screenOn, T.screenOn + 0.22, t) * clamp(ph.op);
    screenMat.uniforms.uOp.value = clamp(ph.op);
    backdrop.mat.uniforms.uPar.value.set((ph.yaw / 40) * 0.08, (ph.pitch / 40) * 0.06);
  }
  // --- pantalla ---
  const tex = loaded.get(pg.file);
  if (tex && screenMat.uniforms.uPage.value !== tex) screenMat.uniforms.uPage.value = tex;
  // teclado
  const kbIn = smooth(T.kbUp[0], T.kbUp[1], t), kbOut = smooth(T.kbDown[0], T.kbDown[1], t);
  const kb = easeOut(kbIn) * (1 - easeIn(kbOut));
  screenMat.uniforms.uKbY.value = kb;
  if (kb > 0) {
    const keyNow = (man.keys || []).find((q) => t >= q.t - 0.045 && t < q.t + 0.07);
    drawKeyboard(keyNow ? keyNow.c.toLowerCase().replace('ó', 'o') : '');
  }
  // toques (incluye el dedo que arrastra en los scrolls)
  const taps = screenMat.uniforms.uTaps.value;
  taps.forEach((v) => v.set(0, 0, 0, 0));
  let ti = 0;
  for (const tp of man.taps) {
    const age = t - (tp.t - 0.02);
    if (age >= 0 && age < 0.55 && ti < 4) taps[ti++].set(tp.x, tp.y, age, 1);
  }
  for (const sc of man.scrolls) {
    const [a, b] = sc.t, dur = b - a, age = t - a;
    if (age >= 0 && age < dur * 0.3 && ti < 4) {
      const dirY = sc.y1 > sc.y0 ? -1 : 1;
      const k2 = age / (dur * 0.3);
      taps[ti++].set(250, 600 + dirY * -160 + dirY * 300 * easeOut(k2), 0.05, 0.75 * (1 - k2));
    }
  }
  // --- tarjetas 3D ---
  const cardsT = [T.cardsOut[0], T.cardsBack[1]];
  const cardPlan = {
    card_cristo: { z: 1.65, dx: 0.35, dy: 0.55, rx: -9, ry: 13, rz: -2, delay: 0.00 },
    card_leon: { z: 2.45, dx: 0.55, dy: -0.35, rx: 6, ry: 18, rz: 4, delay: 0.06 },
    card_quetzalcoatl: { z: 2.05, dx: 0.95, dy: -0.75, rx: 4, ry: -12, rz: -5, delay: 0.11 },
  };
  for (const [id, pl] of Object.entries(cardPlan)) {
    const P = pieces[id];
    const on = t >= cardsT[0] && t < cardsT[1];
    P.g.visible = on; P.sh.visible = on;
    if (!on) continue;
    const up = easeOut(clamp((t - T.cardsOut[0] - pl.delay) / (T.cardsOut[1] - T.cardsOut[0])));
    const down = easeInOut(clamp((t - T.cardsBack[0] - pl.delay * 0.5) / (T.cardsBack[1] - T.cardsBack[0] - pl.delay * 0.5)));
    const lift = up * (1 - down);
    const bob = Math.sin((t - T.cardsOut[0]) * 5.2 + pl.delay * 20) * 0.05 * lift;
    const r = P.rect, y = r.docY - scrollY;
    const cx = (r.x + r.w / 2 - 195) * 0.01, cy = (422 - (y + r.h / 2)) * 0.01;
    P.g.position.set(cx + pl.dx * lift, cy + pl.dy * lift + bob, 0.004 + pl.z * lift);
    P.g.rotation.set(pl.rx * deg * lift, pl.ry * deg * lift, pl.rz * deg * lift);
    P.g.scale.setScalar(1 + 0.03 * Math.sin(Math.PI * lift));
    P.sh.position.set(cx + pl.dx * lift * 0.55 + 0.12 * lift, cy + pl.dy * lift * 0.55 - 0.22 * lift, 0.003);
    P.sh.material.uniforms.uOp.value = 0.62 * Math.min(1, lift * 2.5) * (1 - 0.35 * lift);
    P.sh.material.uniforms.uSoft.value = 0.04 + 0.32 * lift;
  }
  // --- boton de WhatsApp 3D ---
  {
    const P = pieces.wa_button;
    const on = t >= T.waLift[0] && t < T.waBack[1];
    P.g.visible = on; P.sh.visible = on;
    if (on) {
      const up = clamp((t - T.waLift[0]) / (T.waLift[1] - T.waLift[0]));
      const down = easeInOut(clamp((t - T.waBack[0]) / (T.waBack[1] - T.waBack[0])));
      const pop = spring(up, 0.45, 13) * (1 - down);
      const r = P.rect, y = r.docY - scrollY;
      const cx = (r.x + r.w / 2 - 195) * 0.01, cy = (422 - (y + r.h / 2)) * 0.01;
      P.g.position.set(cx, cy + 0.25 * pop, 0.006 + 1.45 * pop);
      P.g.rotation.set(-11 * deg * pop, 6 * deg * pop, 0);
      P.g.scale.setScalar(1 + 0.10 * pop);
      P.sh.position.set(cx + 0.10 * pop, cy - 0.30 * pop, 0.003);
      P.sh.material.uniforms.uOp.value = 0.65 * Math.min(1, pop * 2);
      P.sh.material.uniforms.uSoft.value = 0.05 + 0.3 * pop;
    }
  }
  // --- end card ---
  const endOn = t >= T.plateIn[0];
  endGroup.visible = endOn;
  if (endOn) {
    const k = clamp((t - T.plateIn[0]) / (T.plateIn[1] - T.plateIn[0]));
    const e = spring(k, 0.7, 9);
    const d = ZC;                                     // placa en z = 0
    const yw = -(LY.end.plateCy - H / 2) * d / FPX;
    endGroup.position.set(0, yw - 0.6 * (1 - e), -9 * (1 - e));
    endGroup.rotation.set((22 * (1 - e) + 1.2 * Math.sin(t * 0.8)) * deg, (-6 * (1 - e) + 2.2 * Math.sin(t * 0.6)) * deg, 0);
    const op = clamp(k * 2.2);
    plateMat.opacity = op; plateSide.opacity = op; logoMat.uniforms.uOp.value = op;
    logoMat.uniforms.uSweep.value = lerp(-0.35, 1.6, easeInOut(prog(t, T.sweep)));
  }
  // --- fondo ---
  backdrop.mat.uniforms.uT.value = t;
  backdrop.mat.uniforms.uOn.value = smooth(0, 0.22, t);
  updateInk(t, scrollY);
  updateText(t);
  updateSearch(t);
}

// ---------- tinta por escena ----------
function caretX(t) {
  const n = typed.filter((q) => q.t <= t).length;
  const m = measure(TL.QUERY.slice(0, n), TEXT(500), SB.font);
  return SB.cx - SB.w / 2 + SB.textX + m.width;
}
function updateInk(t, scrollY) {
  const sbL = SB.cx - SB.w / 2, base = SB.cy + SB.font * 0.62;
  // 1) entra a la barra, corre bajo el texto mientras se teclea, sale y dibuja el contorno del celular
  {
    const st = ink('main');
    if (t < T.barIn[0] || t > T.inkOutline[1] + 0.45) st.set(null);
    else {
      const x0 = sbL + SB.textX - 6;
      const entry = smoothPath([[-60, base + 120], [sbL + 40, base + 30], [x0, base]], 14);
      const typingEnd = sbL + SB.textX + measure(TL.QUERY, TEXT(500), SB.font).width + 8;
      const lineA = [[x0, base], [typingEnd, base + 2]];
      const ol = outlinePath();
      const startOl = ol[0];
      const bridge = smoothPath([[typingEnd, base + 2], [typingEnd + 40, base + 60], [startOl[0] + 160, startOl[1] - 120], startOl], 14);
      const path = entry.concat(lineA, bridge, ol);
      const Lent = pathLength(entry), LA = pathLength(lineA), LB = pathLength(bridge), Lol = pathLength(ol);
      let head;
      if (t < T.inkIntoBar[1]) head = Lent * easeOut(prog(t, T.inkIntoBar));
      else if (t < T.barOut[0]) head = Lent + Math.min(LA, Math.max(0, caretX(t) - x0 + 2));
      else if (t < T.inkOutline[0] + 0.18) head = Lent + LA + LB * easeInOut(prog(t, [T.barOut[0], T.inkOutline[0] + 0.18]));
      else head = Lent + LA + LB + Lol * easeInOut(prog(t, [T.inkOutline[0] + 0.18, T.inkOutline[1]]));
      const olStart = Lent + LA + LB;
      let tail;
      if (t < T.inkOutline[0] + 0.18) tail = Math.max(0, head - 380);                         // escribe: cola corta detras
      else if (t < T.inkOutline[1]) tail = Math.min(head, Math.max(olStart, head - 3200));                                        // el contorno queda completo
      else tail = lerp(olStart, head, easeIn(clamp((t - T.inkOutline[1]) / 0.42)));          // se retira cuando aparece el celular
      st.set(path, tail, head, 7.2, { seed: 1 });
    }
  }
  // 2) subraya "23 anos" sobre la pantalla (el subrayado rojo de la pagina aparece detras)
  {
    const st = ink('under23');
    const r = rectAt('heroInk', scrollY);
    if (!r || t < T.inkUnderline[0] - 0.05 || t > T.inkUnderline[1] + 0.3) st.set(null);
    else {
      const p = easeInOut(prog(t, T.inkUnderline));
      const y = r.y + r.h * 0.55;
      const pts = []; for (let i = 0; i <= 40; i++) { const k = i / 40; pts.push(cssToScreen(r.x + 6 + (r.w - 6) * k, y + Math.sin(k * 3.1) * 1.2 - k * 1.5, 0.01)); }
      const L = pathLength(pts);
      const head = L * p + (t > T.inkUnderline[1] ? 0 : 0);
      const tail = Math.max(0, head - L * 0.22) + L * easeIn(clamp((t - T.inkUnderline[1]) / 0.25)) * 0.8;
      st.set(pts, Math.min(tail, head), head, 4.6, { seed: 3 });
    }
  }
  // 3) circulos a mano alrededor de lo que se va a tocar
  const circles = [
    ['cCta', 'workCta', T.inkCircleCta, T.tapCta + 0.02],
    ['cSubmit', 'submit', T.inkCircleSubmit, T.tapSubmit + 0.02],
    ['cLang', 'langEn', T.inkCircleLang, T.tapEN + 0.02],
    ['cPin', 'pin', T.inkCirclePin, T.pullBack[0] - 0.02],
  ];
  for (const [id, name, [a, b], release] of circles) {
    const st = ink(id);
    if (t < a || t > release + 0.3) { st.set(null); continue; }
    const r = rectAt(name, scrollY);
    const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
    const rx = r.w / 2 + (name === 'pin' ? 30 : 16), ry = r.h / 2 + (name === 'pin' ? 22 : 13);
    const loop = handCircle(cx, cy, rx, ry, { seed: id.length }).map((p) => cssToScreen(p[0], p[1], 0.012));
    const L = pathLength(loop);
    const head = L * easeInOut(prog(t, [a, b]));
    const tail = L * easeIn(clamp((t - release) / 0.26));
    st.set(loop, tail, head, 4.4, { seed: id.length });
  }
  // 4) subraya palabras clave de la tipografia cinetica
  for (const g of Object.values(kin)) {
    for (const w of g.words) {
      if (!w.underline) continue;
      const st = ink('u-' + w.text);
      const [a, b] = w.underline;
      const out = g.out;
      if (t < a || t > out[1]) { st.set(null); continue; }
      const y = w.base + g.size * 0.16;
      const pts = smoothPath([[w.x0 - 6, y + 4], [(w.x0 + w.x1) / 2, y + 7], [w.x1 + 10, y + 2]], 18);
      const L = pathLength(pts);
      st.set(pts, L * easeIn(clamp((t - out[0]) / (out[1] - out[0]))), L * easeOut(prog(t, [a, b])), 5.6, { seed: w.text.length });
    }
  }
  // 5) cierre: la tinta escribe cada renglon (deja la linea bajo el texto)
  written.forEach((g, gi) => {
    g.lines.forEach((L, li) => {
      const st = ink(`w${gi}${li}`);
      const [c0, c1] = g.def.clear;
      if (t < L.t[0] - 0.02 || t > c1) { st.set(null); return; }
      const h = g.head(t, li);
      const y = L.base + g.size * 0.13;
      const pts = smoothPath([[L.x - 14, y + 6], [L.x + L.m.width * 0.5, y + 10], [L.x + L.m.width + 18, y + 4]], 24);
      const Lp = pathLength(pts);
      const head = Lp * clamp((h.x - L.x + 14) / (L.m.width + 32));
      const tail = Lp * easeIn(clamp((t - c0) / (c1 - c0)));
      st.set(pts, tail, Math.max(tail, head), 6.4, { seed: 7 + gi * 2 + li });
    });
  });
  // 6) end card: la tinta firma bajo el logo
  {
    const st = ink('firma');
    if (t < T.signature[0]) st.set(null);
    else {
      const cy = LY.end.plateCy + (LY.end.logoW * LOGO_AR) / 2 + 74;
      const x0 = W / 2 - LY.end.logoW * 0.36, x1 = W / 2 + LY.end.logoW * 0.40;
      const pts = smoothPath([[x0, cy + 6], [x0 + 120, cy - 8], [W / 2 - 40, cy + 6], [W / 2 + 140, cy - 4], [x1 - 40, cy + 2], [x1, cy - 22], [x1 - 22, cy - 30], [x1 - 34, cy - 8]], 20);
      const L = pathLength(pts);
      st.set(pts, 0, L * easeInOut(prog(t, T.signature)), 5.2, { seed: 11 });
    }
  }
}

function updateText(t) {
  for (const g of Object.values(kin)) g.update(t);
  written.forEach((g) => g.update(t));
  // end card
  const kt = clamp((t - T.tagline[0]) / (T.tagline[1] - T.tagline[0]));
  if (kt > 0) {
    const sig = kt.toFixed(3);
    const c = endTag.begin(sig);
    if (c) {
      c.font = font(TEXT(600), LY.end.taglineSize); c.textAlign = 'center'; c.textBaseline = 'middle';
      c.globalAlpha = easeOut(kt); c.fillStyle = BONE;
      c.fillText(TL.ENDCARD.tagline, W / 2, LY.end.taglineY + 14 * (1 - easeOut(kt)));
      endTag.end(true);
    }
  } else endTag.hide();
  const kd = clamp((t - T.disclaimer[0]) / (T.disclaimer[1] - T.disclaimer[0]));
  if (kd > 0) {
    const c = endDisc.begin(kd.toFixed(3));
    if (c) {
      c.font = font(TEXT(500), LY.end.disclaimerSize); c.textAlign = 'center'; c.textBaseline = 'middle';
      c.globalAlpha = easeOut(kd) * 0.95; c.fillStyle = SILVER;
      c.fillText(TL.ENDCARD.disclaimer, W / 2, LY.end.disclaimerY);
      endDisc.end(true);
    }
  } else endDisc.hide();
  if (safeLayer) {
    const c = safeLayer.begin('safe');
    if (c) { c.fillStyle = 'rgba(255,0,255,0.18)'; c.fillRect(0, 0, W, LY.safe.top); c.fillRect(0, H - LY.safe.bottom, W, LY.safe.bottom); safeLayer.end(true); }
  }
}

function updateSearch(t) {
  const inK = easeOut(prog(t, T.barIn));
  const outK = easeInOut(prog(t, T.barOut));
  const op = inK * (1 - outK);
  const press = t >= T.enter && t < T.enter + 0.14 ? 1 - Math.abs((t - T.enter) / 0.07 - 1) : 0;
  const sc = (0.94 + 0.06 * inK) * (1 - 0.012 * press);
  const dy = -150 * outK;
  glassBar.mat.uniforms.uOp.value = op;
  glassBar.mat.uniforms.uRect.value.set(SB.cx, SB.cy + dy, SB.w * sc, SB.h * sc);
  glassBar.mat.uniforms.uR.value = (SB.h * sc) / 2;
  if (op <= 0.001) { searchLayer.hide(); return; }
  searchLayer.mesh.position.y = -(SB.cy + dy);
  searchLayer.mesh.scale.setScalar(sc);
  const n = typed.filter((q) => q.t <= t).length;
  const sig = `${n}|${op.toFixed(3)}|${press.toFixed(2)}`;
  const c = searchLayer.begin(sig);
  if (!c) return;
  const x0 = SB.cx - SB.w / 2, y = SB.cy;
  c.globalAlpha = op;
  // lupa generica
  c.strokeStyle = SILVER; c.lineWidth = 3.4; c.lineCap = 'round';
  c.beginPath(); c.arc(x0 + 82, y - 4, 15, 0, Math.PI * 2); c.stroke();
  c.beginPath(); c.moveTo(x0 + 93, y + 7); c.lineTo(x0 + 105, y + 19); c.stroke();
  c.font = font(TEXT(500), SB.font); c.textBaseline = 'middle';
  if (n === 0) { c.fillStyle = 'rgba(201,201,201,0.55)'; c.fillText('Buscar', x0 + SB.textX, y + 2); }
  else { c.fillStyle = BONE; c.fillText(TL.QUERY.slice(0, n), x0 + SB.textX, y + 2); }
  // boton de enviar (flecha) que se presiona en el Enter
  const bx = x0 + SB.w - 66;
  c.fillStyle = press > 0 ? '#6E6E6E' : 'rgba(237,234,230,0.10)';
  c.beginPath(); c.arc(bx, y, 34, 0, Math.PI * 2); c.fill();
  c.strokeStyle = BONE; c.lineWidth = 3.4;
  c.beginPath(); c.moveTo(bx - 13, y); c.lineTo(bx + 12, y); c.moveTo(bx + 2, y - 11); c.lineTo(bx + 13, y); c.lineTo(bx + 2, y + 11); c.stroke();
  searchLayer.end(true);
}

// ---------- render ----------
// antialias temporal: cada subcuadro se desplaza una fraccion de pixel (Halton 2,3)
const halton = (i, b) => { let f = 1, r = 0; while (i > 0) { f /= b; r += f * (i % b); i = Math.floor(i / b); } return r; };
function jitter(k) {
  const jx = SUBS > 1 ? halton(k + 1, 2) - 0.5 : 0, jy = SUBS > 1 ? halton(k + 1, 3) - 0.5 : 0;
  camera.setViewOffset(RW, RH, jx, jy, RW, RH);
  const dx = jx * W / RW, dy = jy * H / RH;
  orthoPx.left = dx; orthoPx.right = W + dx; orthoPx.top = -dy; orthoPx.bottom = -H - dy; orthoPx.updateProjectionMatrix();
}
function renderSub() {
  renderer.setRenderTarget(rtScene);
  renderer.setClearColor(0x000000, 1);
  renderer.clear(true, true, true);
  copyPass.mat.uniforms.uSrc.value = rtBack.texture;
  renderer.render(copyPass.scene, orthoNDC);
  renderer.clearDepth();
  renderer.render(scene, camera);
  // vidrio de la barra: desenfoca lo que hay detras
  if (glassBar.mat.uniforms.uOp.value > 0.001) {
    copyPass.mat.uniforms.uSrc.value = rtScene.texture;
    renderer.setRenderTarget(rtQ1); renderer.render(copyPass.scene, orthoNDC);
    blurPass.mat.uniforms.uSrc.value = rtQ1.texture; blurPass.mat.uniforms.uDir.value.set(1.6 / rtQ1.width, 0);
    renderer.setRenderTarget(rtQ2); renderer.render(blurPass.scene, orthoNDC);
    blurPass.mat.uniforms.uSrc.value = rtQ2.texture; blurPass.mat.uniforms.uDir.value.set(0, 1.6 / rtQ1.height);
    renderer.setRenderTarget(rtQ1); renderer.render(blurPass.scene, orthoNDC);
    copyPass.mat.uniforms.uSrc.value = rtQ1.texture;
    renderer.setRenderTarget(rtQ2); renderer.render(copyPass.scene, orthoNDC);
    renderer.setRenderTarget(rtScene);
    renderer.render(glassBar.scene, orthoNDC);
  }
  renderer.setRenderTarget(rtScene);
  renderer.render(over, orthoPx);
}

window.renderFrame = async (f) => {
  const need = await prepare(f);
  for (const file of need) loaded.set(file, await texCache.get(file));
  for (const k of [...loaded.keys()]) if (!need.has(k)) loaded.delete(k);
  frameState(f / 60, 0);
  renderer.setRenderTarget(rtBack); renderer.render(backdrop.scene, orthoNDC);
  renderer.setRenderTarget(rtAcc); renderer.setClearColor(0x000000, 1); renderer.clear(true, false, false);
  for (let k = 0; k < SUBS; k++) {
    const ts = SUBS === 1 ? f / 60 : f / 60 + (-0.5 + (k + 0.5) / SUBS) / 120;
    frameState(ts, k);
    jitter(k);
    renderSub();
    accPass.mat.uniforms.uSrc.value = rtScene.texture;
    accPass.mat.uniforms.uW.value = 1 / SUBS;
    renderer.setRenderTarget(rtAcc);
    renderer.render(accPass.scene, orthoNDC);
  }
  finalPass.mat.uniforms.uFrame.value = f;
  renderer.setRenderTarget(null);
  renderer.render(finalPass.scene, orthoNDC);
  const gl = renderer.getContext(); gl.finish();
  return true;
};
window.compositorInfo = { W, H, RW, RH, FORMAT, SUBS, frames: TL.FRAMES };
window.__profile = async (f) => {
  await prepare(f);
  const need = await prepare(f); for (const file of need) loaded.set(file, await texCache.get(file));
  const gl = renderer.getContext();
  const px = new Uint8Array(4), pxf = new Uint16Array(4);
  const sync = () => { const rt = renderer.getRenderTarget(); try { if (rt) renderer.readRenderTargetPixels(rt, 0, 0, 1, 1, rt.texture.type === THREE.UnsignedByteType ? px : pxf); else gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); } catch (e) { gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); } };
  const tm = (fn) => { sync(); const t0 = performance.now(); fn(); sync(); return Math.round(performance.now() - t0); };
  frameState(f / 60, 0);
  const out = {};
  out.state = tm(() => frameState(f / 60, 0));
  renderer.setRenderTarget(rtScene); renderer.clear(true, true, true);
  out.backdrop = tm(() => renderer.render(backdrop.scene, orthoNDC));
  renderer.clearDepth();
  out.scene = tm(() => renderer.render(scene, camera));
  out.scene2 = tm(() => renderer.render(scene, camera));
  out.over = tm(() => renderer.render(over, orthoPx));
  accPass.mat.uniforms.uSrc.value = rtScene.texture;
  out.acc = tm(() => { renderer.setRenderTarget(rtAcc); renderer.render(accPass.scene, orthoNDC); });
  phoneRoot.visible = false; renderer.setRenderTarget(rtScene);
  out.sceneNoPhone = tm(() => renderer.render(scene, camera));
  phoneRoot.visible = true; screen.visible = false;
  out.sceneNoScreen = tm(() => renderer.render(scene, camera));
  screen.visible = true; body.visible = false;
  out.sceneNoBody = tm(() => renderer.render(scene, camera));
  body.visible = true;
  out.final = tm(() => { renderer.setRenderTarget(null); renderer.render(finalPass.scene, orthoNDC); });
  return out;
};
window.__dbg = () => Object.entries(inks).map(([k, v]) => {
  const g = v.mesh.geometry, P = g.attributes.position.array;
  return { k, vis: v.mesh.visible, count: g.drawRange.count, p0: [P[0], P[1], P[3], P[4]].map((x) => Math.round(x)), op: v.mat.uniforms.uOpacity.value, parent: !!v.mesh.parent };
});
window.ready = true;
