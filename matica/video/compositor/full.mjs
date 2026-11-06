// Compositor completo del video de Matíca: frame(t) determinista para las 9 escenas.
// Three.js (WebGL2 por software). N subcuadros por cuadro (obturador de 180°) acumulados en float,
// con jitter de Halton (antialias real). Todo sale de timeline.json (amarrado a la voz) y de la
// captura real de la página (build/capture: cuadros a 60 fps y 3x, sondas, rastros y texturas).
//
// Capas, de atrás hacia adelante:
//   fondo (pizarra #1A2226 -> verde bosque sutil) ·
//   3D: celular de cristal con la página real · piezas de la página con grosor (tarjeta cold brew,
//       "Agregar", abanico de reseñas) · logo oficial en el end card (solo se mueve y escala) ·
//   2D: barra de búsqueda de cristal genérica, trazos líquidos, tipografía cinética e íconos de línea,
//       textos del end card ·
//   la gota de cold brew (líquido con refracción, absorción ámbar, menisco y cáustica) encima de todo.
// API para el render: window.renderFrame(f) deja el cuadro f en el canvas.
import * as THREE from './vendor/three.module.js';
import { clamp, lerp, prog, easeInOut, easeOut, spring, cameraAt, BEAT } from '../timeline/timeline.mjs';

const qs = new URLSearchParams(location.search);
const SCALE = Number(qs.get('scale') || 0.5);
const SUBS = Number(qs.get('subs') || 8);
const FPS = Number(qs.get('fps') || 60);
const W = 1080, H = 1920;
const RW = Math.round(W * SCALE), RH = Math.round(H * SCALE);
const CAP = '../build/capture/';
const deg = Math.PI / 180;
const fetchJSON = (u) => fetch(u).then((r) => r.json());
const TL = await fetchJSON('../timeline/timeline.json');
const T = TL.T;
const man = await fetchJSON(CAP + 'manifest.json');
const MF = man.fps;
const smooth01 = (k) => k * k * (3 - 2 * k);
const sstep = (a, b, x) => smooth01(clamp((x - a) / (b - a)));
const bump = (t, t0, d) => { const k = (t - t0) / d; return k <= 0 || k >= 1 ? 0 : Math.sin(Math.PI * k); };

// ---------- utilidades ----------
async function bitmap(url) { const b = await (await fetch(url)).blob(); return createImageBitmap(b); }
function texFrom(img, { srgb = true, mips = true } = {}) {
  const t = new THREE.Texture(img);
  t.flipY = false;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.generateMipmaps = mips;
  t.minFilter = mips ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.anisotropy = 4;
  t.needsUpdate = true;
  return t;
}
function canvasTex(c, flip = true) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.minFilter = THREE.LinearFilter; t.generateMipmaps = false; t.flipY = flip;
  return t;
}
function rrPath(target, w, h, r) {
  const x0 = -w / 2, y0 = -h / 2, x1 = w / 2, y1 = h / 2;
  target.moveTo(x0 + r, y0); target.lineTo(x1 - r, y0); target.absarc(x1 - r, y0 + r, r, -Math.PI / 2, 0, false);
  target.lineTo(x1, y1 - r); target.absarc(x1 - r, y1 - r, r, 0, Math.PI / 2, false);
  target.lineTo(x0 + r, y1); target.absarc(x0 + r, y1 - r, r, Math.PI / 2, Math.PI, false);
  target.lineTo(x0, y0 + r); target.absarc(x0 + r, y0 + r, r, Math.PI, Math.PI * 1.5, false);
  return target;
}
function matcapTex(stops) {
  const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
  const g = x.createRadialGradient(100, 86, 4, 128, 128, 128);
  stops.forEach(([o, col]) => g.addColorStop(o, col));
  x.fillStyle = g; x.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const SDRR = 'float sdRR(vec2 p, vec2 b, float r){ vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }';
const HASH = 'float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }';

// ---------- arranque ----------
const canvas = document.createElement('canvas');
canvas.width = RW; canvas.height = RH; canvas.style.width = RW + 'px'; canvas.style.height = RH + 'px';
document.body.appendChild(canvas);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true, alpha: false });
renderer.setPixelRatio(1);
renderer.setSize(RW, RH, false);
renderer.autoClear = false;
renderer.toneMapping = THREE.NoToneMapping;
for (const [w, file] of [[500, 'poppins-latin-500-normal'], [600, 'poppins-latin-600-normal'], [700, 'poppins-latin-700-normal']]) {
  document.fonts.add(await new FontFace('Poppins', `url(../../site/fonts/${file}.woff2)`, { weight: String(w) }).load());
}

const rtOpts = { type: THREE.HalfFloatType, colorSpace: THREE.LinearSRGBColorSpace };
const rtScene = new THREE.WebGLRenderTarget(RW, RH, { ...rtOpts, depthBuffer: true });
const rtLiquid = new THREE.WebGLRenderTarget(RW, RH, { ...rtOpts, depthBuffer: false });
const rtAcc = new THREE.WebGLRenderTarget(RW, RH, { ...rtOpts, depthBuffer: false });
const rtSharp = new THREE.WebGLRenderTarget(RW >> 1, RH >> 1, { ...rtOpts, depthBuffer: false });
const rtB1 = new THREE.WebGLRenderTarget(RW >> 2, RH >> 2, { ...rtOpts, depthBuffer: false });
const rtB2 = new THREE.WebGLRenderTarget(RW >> 2, RH >> 2, { ...rtOpts, depthBuffer: false });
[rtSharp, rtB1, rtB2].forEach((r) => { r.texture.minFilter = THREE.LinearFilter; r.texture.magFilter = THREE.LinearFilter; });

const quadGeo = new THREE.PlaneGeometry(2, 2);
const orthoNDC = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
function fsPass(frag, uniforms, opts = {}) {
  const m = new THREE.ShaderMaterial({ uniforms, depthTest: false, depthWrite: false, ...opts,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }', fragmentShader: frag });
  const mesh = new THREE.Mesh(quadGeo, m); mesh.frustumCulled = false;
  const sc = new THREE.Scene(); sc.add(mesh);
  return { scene: sc, mat: m };
}
const draw = (pass, target) => { renderer.setRenderTarget(target); renderer.render(pass.scene, orthoNDC); };

// ---------- fondo: pizarra muy oscura #1A2226 con degradado sutil hacia verde bosque ----------
const backdrop = fsPass(/* glsl */`
precision highp float; varying vec2 vUv;
uniform float uT; uniform vec2 uPar; uniform float uAspect; uniform float uHit; uniform float uEnd;
float g(vec2 p, vec2 c, vec2 r){ vec2 d = (p - c) / r; return exp(-dot(d, d)); }
void main(){
  vec2 p = vUv; vec2 q = vec2((p.x - 0.5) * uAspect, p.y - 0.5);
  vec3 slate = vec3(0.0103, 0.0160, 0.0194);              // #1A2226
  vec3 deep = vec3(0.0058, 0.0090, 0.0108);
  vec3 forest = vec3(0.0137, 0.0742, 0.0273) * (0.30 + 0.10 * uEnd);   // #1F4D2E, bajito
  vec3 col = mix(forest, slate, smoothstep(0.0, 0.72, p.y));
  col = mix(col, deep, smoothstep(0.55, 1.0, p.y) * 0.65);
  vec3 sage = vec3(0.202, 0.413, 0.250);                  // #7CAC89
  col += sage * 0.018 * g(q, vec2(0.08, 0.02) + uPar * 0.30, vec2(0.70, 0.52));
  col += sage * 0.009 * g(q, vec2(-0.30 + 0.03 * sin(uT * 0.40), 0.30) + uPar * 0.50, vec2(0.34, 0.22));
  col += vec3(0.009, 0.011, 0.011) * g(q, vec2(0.30, -0.24 + 0.02 * sin(uT * 0.33)) + uPar * 0.60, vec2(0.30, 0.34));
  col += sage * 0.020 * uEnd * g(q, vec2(0.0, 0.10), vec2(0.55, 0.40));
  col += (sage * 0.030 + vec3(0.004)) * uHit * g(q, vec2(0.0, 0.03), vec2(0.62, 0.50));   // golpe
  float vig = smoothstep(1.2, 0.28, length(q * vec2(1.0, 0.86)));
  col *= mix(0.58, 1.0, vig);
  gl_FragColor = vec4(col, 1.0);
}`, { uT: { value: 0 }, uPar: { value: new THREE.Vector2() }, uAspect: { value: W / H }, uHit: { value: 0 }, uEnd: { value: 0 } });
const blurPass = fsPass(/* glsl */`
precision highp float; varying vec2 vUv; uniform sampler2D uSrc; uniform vec2 uDir;
void main(){ vec3 c = texture2D(uSrc, vUv).rgb * 0.1964; float w[7]; w[0]=0.1964; w[1]=0.1748; w[2]=0.1232; w[3]=0.0688; w[4]=0.0304; w[5]=0.0106; w[6]=0.0029;
  for (int i = 1; i < 7; i++){ c += texture2D(uSrc, vUv + uDir * float(i)).rgb * w[i]; c += texture2D(uSrc, vUv - uDir * float(i)).rgb * w[i]; }
  gl_FragColor = vec4(c, 1.0); }`, { uSrc: { value: null }, uDir: { value: new THREE.Vector2() } });
const copyPass = fsPass('precision highp float; varying vec2 vUv; uniform sampler2D uSrc; void main(){ gl_FragColor = vec4(texture2D(uSrc, vUv).rgb, 1.0); }', { uSrc: { value: null } });

// ---------- escena 3D ----------
const scene = new THREE.Scene();
const FOV = 26, ZC = 28;
const camera = new THREE.PerspectiveCamera(FOV, W / H, 0.1, 200);
camera.position.set(0, 0, ZC); camera.lookAt(0, 0, 0);
const FPX = (H / 2) / Math.tan((FOV / 2) * deg);
const PXU = FPX / ZC;                                   // px de diseño por unidad en z = 0

// Celular de cristal: pantalla 390x844 pt (1 unidad = 100 pt), bisel de cristal, canto pulido.
const SW = 3.9, SH = 8.44, SCR_R = 0.4733;
const BEZ = 0.17, BODY_W = SW + 2 * BEZ, BODY_H = SH + 2 * BEZ, BODY_R = SCR_R + BEZ;
const DEPTH = 0.40, CHAMF = 0.06;
const U0 = (0.64 * H) / BODY_H;                         // px por unidad con el celular al 64 % del alto
const phoneRoot = new THREE.Group(); scene.add(phoneRoot);
const phoneOff = new THREE.Group(); phoneRoot.add(phoneOff);

const glassMat = new THREE.ShaderMaterial({
  uniforms: { uSharp: { value: rtSharp.texture }, uBlur: { value: rtB2.texture }, uOp: { value: 0 }, uBand: { value: 0.1 },
    uHalfO: { value: new THREE.Vector2(BODY_W / 2, BODY_H / 2) }, uRO: { value: BODY_R },
    uHalfS: { value: new THREE.Vector2(SW / 2, SH / 2) }, uRS: { value: SCR_R } },
  transparent: true,
  vertexShader: /* glsl */`
    varying vec3 vN; varying vec3 vV; varying vec3 vLocal; varying vec3 vLN; varying vec4 vClip;
    void main(){ vLocal = position; vLN = normal; vec4 wp = modelMatrix * vec4(position, 1.0);
      vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - wp.xyz);
      vClip = projectionMatrix * viewMatrix * wp; gl_Position = vClip; }`,
  fragmentShader: /* glsl */`
    precision highp float;
    varying vec3 vN; varying vec3 vV; varying vec3 vLocal; varying vec3 vLN; varying vec4 vClip;
    uniform sampler2D uSharp; uniform sampler2D uBlur; uniform float uOp; uniform float uBand;
    uniform vec2 uHalfO; uniform float uRO; uniform vec2 uHalfS; uniform float uRS;
    ${SDRR} ${HASH}
    void main(){
      vec2 suv = (vClip.xy / vClip.w) * 0.5 + 0.5;
      vec3 N = normalize(vN), V = normalize(vV);
      float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0);
      vec2 off = N.xy * (0.010 + 0.055 * fres);
      vec3 blur = texture2D(uBlur, suv - off).rgb;
      float l = dot(blur, vec3(0.2126, 0.7152, 0.0722));
      blur = max(vec3(0.0), mix(vec3(l), blur, 1.4));                    // saturación 140 %
      vec3 sharp = texture2D(uSharp, suv).rgb;
      vec3 glass = blur * 1.20 + vec3(0.0115, 0.0135, 0.0145);           // cristal esmerilado, apenas frío
      glass += vec3(0.52, 0.60, 0.58) * fres * 0.30;                     // los cantos agarran luz
      vec3 R = reflect(-V, N);
      float band = smoothstep(0.12, 0.0, abs(dot(R.xy, normalize(vec2(0.82, 0.57))) - uBand)) * 0.085;
      float spec = pow(max(dot(R, normalize(vec3(-0.35, 0.55, 0.75))), 0.0), 34.0) * 0.32;
      glass += vec3(band + spec);
      float front = step(0.9, vLN.z);
      float dO = sdRR(vLocal.xy, uHalfO, uRO); float aO = max(fwidth(dO), 1e-5);
      float dI = sdRR(vLocal.xy, uHalfS, uRS);
      float lit = 0.55 + 0.45 * clamp(dot(normalize(vLocal.xy + 1e-4), normalize(vec2(-0.6, 0.8))), -1.0, 1.0);   // luz arriba-izq.
      glass += vec3(0.62) * lit * (1.0 - smoothstep(0.0, aO * 1.3, abs(dO + aO * 1.1))) * front;   // borde de 1 px
      glass += vec3(0.24) * lit * (1.0 - smoothstep(0.0, aO * 1.3, abs(dI - aO * 1.1))) * front;
      glass += vec3(0.05) * lit * smoothstep(-0.10, 0.0, dO) * front;                              // el canto se ilumina
      glass *= 1.0 + (hash(gl_FragCoord.xy) - 0.5) * 0.04;                // ruido 2 %
      gl_FragColor = vec4(glass, uOp);
    }`,
});
const bodyGeo = new THREE.ExtrudeGeometry(rrPath(new THREE.Shape(), BODY_W - 2 * CHAMF, BODY_H - 2 * CHAMF, BODY_R - CHAMF),
  { depth: DEPTH - 2 * CHAMF, bevelEnabled: true, bevelThickness: CHAMF, bevelSize: CHAMF, bevelSegments: 5, curveSegments: 40 });
bodyGeo.translate(0, 0, -(DEPTH - CHAMF));
const body = new THREE.Mesh(bodyGeo, glassMat);
body.renderOrder = 1;
phoneOff.add(body);
const phoneShadowMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false,
  uniforms: { uHalf: { value: new THREE.Vector2(BODY_W / 2, BODY_H / 2) }, uR: { value: BODY_R }, uOp: { value: 0 } },
  vertexShader: 'varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `precision highp float; varying vec2 vP; uniform vec2 uHalf; uniform float uR; uniform float uOp; ${SDRR}
    void main(){ float d = sdRR(vP, uHalf, uR); float a = 1.0 - smoothstep(-0.35, 1.25, d); gl_FragColor = vec4(0.0, 0.0, 0.0, a * a * uOp); }` });
const phoneShadow = new THREE.Mesh(new THREE.PlaneGeometry(BODY_W + 3.2, BODY_H + 3.2), phoneShadowMat);
phoneShadow.position.set(0.32, -0.55, -DEPTH - 0.9); phoneShadow.renderOrder = -1;
phoneOff.add(phoneShadow);

// barra de estado (texto oscuro: arriba siempre hay fondo claro, la portada o el encabezado crema) con isla dinámica, a 3x
function statusTex() {
  const c = document.createElement('canvas'); c.width = 1170; c.height = 180;
  const x = c.getContext('2d'); x.scale(3, 3);
  const ink = '#14201a';
  x.fillStyle = ink; x.font = '600 17px "Poppins"'; x.textBaseline = 'middle'; x.textAlign = 'center';
  x.fillText('10:40', 56, 31);
  for (let i = 0; i < 4; i++) { const h = 4.2 + i * 2.5; x.beginPath(); x.roundRect(289 + i * 4.9, 35.5 - h, 3.2, h, 1); x.fill(); }
  x.lineCap = 'round'; x.strokeStyle = ink;
  for (const r of [10.5, 6.8, 3.2]) { x.lineWidth = 2.2; x.beginPath(); x.arc(320, 36.5, r, -Math.PI * 0.76, -Math.PI * 0.24); x.stroke(); }
  x.globalAlpha = 0.4; x.lineWidth = 1.1; x.beginPath(); x.roundRect(335.5, 24.5, 25, 12, 3.6); x.stroke();
  x.beginPath(); x.roundRect(361.6, 28.4, 1.6, 4.4, 0.8); x.fill();
  x.globalAlpha = 1; x.beginPath(); x.roundRect(337.6, 26.6, 17.5, 7.8, 2.1); x.fill();
  x.fillStyle = '#000'; x.beginPath(); x.roundRect(195 - 62.5, 11, 125, 37, 18.5); x.fill();
  x.fillStyle = '#0c0f12'; x.beginPath(); x.arc(195 + 43, 29.5, 5.2, 0, Math.PI * 2); x.fill();
  const t = new THREE.CanvasTexture(c); t.flipY = false; t.colorSpace = THREE.SRGBColorSpace; return t;
}
const screenMat = new THREE.ShaderMaterial({
  transparent: true,
  uniforms: { uPage: { value: null }, uStatus: { value: statusTex() }, uOn: { value: 0 }, uOp: { value: 0 }, uBand: { value: 0.1 },
    uLight: { value: new THREE.Vector3(-0.35, 0.55, 0.75).normalize() },
    uGl: { value: new THREE.Vector4(0, 0, 1, 1) }, uGlK: { value: -1 }, uGlOp: { value: 0 }, uGlR: { value: 16 } },
  vertexShader: /* glsl */`
    varying vec2 vUv; varying vec3 vN; varying vec3 vV;
    void main(){ vUv = uv; vec4 wp = modelMatrix * vec4(position, 1.0); vN = normalize(mat3(modelMatrix) * normal);
      vV = normalize(cameraPosition - wp.xyz); gl_Position = projectionMatrix * viewMatrix * wp; }`,
  fragmentShader: /* glsl */`
    precision highp float;
    varying vec2 vUv; varying vec3 vN; varying vec3 vV;
    uniform sampler2D uPage; uniform sampler2D uStatus; uniform float uOn; uniform float uOp; uniform float uBand; uniform vec3 uLight;
    uniform vec4 uGl; uniform float uGlK; uniform float uGlOp; uniform float uGlR;
    ${SDRR}
    void main(){
      vec2 css = vec2(vUv.x * 390.0, (1.0 - vUv.y) * 844.0);
      float sd = sdRR(css - vec2(195.0, 422.0), vec2(195.0, 422.0), 47.33);
      float aa = fwidth(sd);
      float mask = 1.0 - smoothstep(-aa, aa, sd);
      float edge = smoothstep(-14.0, 0.0, sd);
      vec2 dir = normalize(css - vec2(195.0, 422.0) + 1e-3);
      vec2 c2 = css - dir * edge * edge * 5.0;                          // refracción en el canto curvo
      vec3 col = texture2D(uPage, c2 / vec2(390.0, 844.0)).rgb;
      // brillo que deja la gota: barrido diagonal dentro de la pieza que tocó
      if (uGlOp > 0.0) {
        vec2 q = css - (uGl.xy + uGl.zw * 0.5);
        float dg = sdRR(q, uGl.zw * 0.5, uGlR);
        float inG = 1.0 - smoothstep(-1.0, 1.0, dg);
        vec2 u = (css - uGl.xy) / max(uGl.zw, vec2(1.0));
        float band = exp(-pow((u.x * 0.80 + u.y * 0.45 - uGlK * 1.25) / 0.10, 2.0));
        col += vec3(1.0, 0.92, 0.80) * band * inG * 0.34 * uGlOp;
      }
      if (css.y < 60.0) { vec4 s = texture2D(uStatus, vec2(css.x / 390.0, css.y / 60.0)); col = mix(col, s.rgb, s.a); }
      float hi = sdRR(css - vec2(195.0, 836.0), vec2(67.0, 2.5), 2.5);
      col = mix(col, vec3(0.010, 0.014, 0.012), (1.0 - smoothstep(-0.7, 0.7, hi)) * 0.72);
      col = mix(vec3(0.0016, 0.0019, 0.0022), col, uOn);               // apagada: cristal negro
      vec3 R = reflect(-vV, normalize(vN));
      float band2 = smoothstep(0.10, 0.0, abs(dot(R.xy, normalize(vec2(0.82, 0.57))) - uBand)) * 0.040;
      col += vec3(band2 + pow(max(dot(R, uLight), 0.0), 22.0) * 0.045 + pow(edge, 5.0) * 0.05);
      gl_FragColor = vec4(col, mask * uOp);
    }`,
});
const screen = new THREE.Mesh(new THREE.PlaneGeometry(SW, SH), screenMat);
screen.position.z = 0.003; screen.renderOrder = 2;
phoneOff.add(screen);

// ---------- piezas de la página con grosor (misma textura capturada a 3x) ----------
const cssToLocal = (x, y) => new THREE.Vector3((x - 195) / 100, (422 - y) / 100, 0);
const paperSide = new THREE.MeshMatcapMaterial({ matcap: matcapTex([[0, '#ffffff'], [0.35, '#f3efe6'], [0.75, '#cfc8ba'], [1, '#efeadf']]) });
const greenSide = new THREE.MeshMatcapMaterial({ matcap: matcapTex([[0, '#4f8a60'], [0.35, '#2b5c3a'], [0.75, '#17371f'], [1, '#2e6040']]) });
const glassSide = new THREE.MeshMatcapMaterial({ matcap: matcapTex([[0, '#9fb3ad'], [0.35, '#44544f'], [0.75, '#1a2422'], [1, '#56665f']]) });
const frontMat = (tex) => new THREE.ShaderMaterial({ transparent: true,
  uniforms: { uTex: { value: tex }, uSweep: { value: -1 }, uOp: { value: 1 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: /* glsl */`precision highp float; varying vec2 vUv; uniform sampler2D uTex; uniform float uSweep; uniform float uOp;
    void main(){ vec3 c = texture2D(uTex, clamp(vUv, 0.0, 1.0)).rgb;
      float band = exp(-pow((vUv.x * 0.85 + vUv.y * 0.45 - uSweep) / 0.07, 2.0));
      c += vec3(1.0, 0.93, 0.82) * band * 0.30;
      gl_FragColor = vec4(c, uOp); }` });
const softShadowMat = (w, h, r) => new THREE.ShaderMaterial({ transparent: true, depthWrite: false,
  uniforms: { uHalf: { value: new THREE.Vector2(w / 2, h / 2) }, uR: { value: r }, uSoft: { value: 0.1 }, uOp: { value: 0 } },
  vertexShader: 'varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `precision highp float; varying vec2 vP; uniform vec2 uHalf; uniform float uR; uniform float uSoft; uniform float uOp; ${SDRR}
    void main(){ float d = sdRR(vP, uHalf, uR); float a = 1.0 - smoothstep(-uSoft, uSoft * 1.6, d); gl_FragColor = vec4(0.0, 0.0, 0.0, a * uOp); }` });
async function slab(name, { radius = 0.22, depth = 0.06, side = paperSide, order = 6 } = {}) {
  const info = man.tex[name], R = info.rect, S = info.shotRect;
  const w = R.w / 100, h = R.h / 100, rad = Math.min(radius, Math.min(w, h) / 2 - 1e-3);
  const geo = new THREE.ExtrudeGeometry(rrPath(new THREE.Shape(), w, h, rad), { depth, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 3, curveSegments: 24 });
  geo.translate(0, 0, -(depth + 0.012));
  // UV de la cara frontal: la foto cubre shotRect (tarjeta completa si se trajo a la vista)
  const full = Math.abs(S.w - R.w) < 1.5 && Math.abs(S.h - R.h) < 1.5;
  const ox = full ? 0 : S.x - R.x, oy = full ? 0 : S.y - R.y;
  const pos = geo.attributes.position, uv = geo.attributes.uv, nor = geo.attributes.normal;
  for (let i = 0; i < pos.count; i++) if (nor.getZ(i) > 0.9) {
    const cx = (pos.getX(i) + w / 2) * 100, cy = (h / 2 - pos.getY(i)) * 100;
    uv.setXY(i, (cx - ox) / S.w, (cy - oy) / S.h);
  }
  uv.needsUpdate = true;
  const front = frontMat(texFrom(await bitmap(CAP + info.file)));
  const mesh = new THREE.Mesh(geo, [front, side]);
  mesh.renderOrder = order; mesh.visible = false;
  const sh = new THREE.Mesh(new THREE.PlaneGeometry(w + 1.6, h + 1.6), softShadowMat(w, h, rad));
  sh.renderOrder = order - 2; sh.visible = false;
  phoneOff.add(sh); phoneOff.add(mesh);
  return { mesh, sh, front, w, h, rest: cssToLocal(R.x + R.w / 2, R.y + R.h / 2) };
}
const cardCB = await slab('coldBrewCard', { radius: 0.22 });
const addBtn = await slab('siAdd', { radius: 1.0, depth: 0.08, side: greenSide, order: 7 });
const revs = [];
for (let i = 1; i <= 3; i++) revs.push(await slab('rev' + i, { radius: 0.22, depth: 0.05, side: glassSide, order: 6 + i }));

// ---------- end card: logo oficial (solo se mueve, escala y gira un poco; nunca se redibuja) ----------
const LOGO = { cx: 540, cy: 790, d: 520 };              // ≤ 600 px de diámetro en 1080
const logoTex = texFrom(await bitmap('../../assets/logo_matica.png'));
const logoGroup = new THREE.Group(); scene.add(logoGroup);
const logoSize = LOGO.d / PXU;
const logoMat = new THREE.MeshBasicMaterial({ map: logoTex, transparent: true, depthWrite: false, toneMapped: false, opacity: 0 });
const logoGeo = new THREE.PlaneGeometry(logoSize, logoSize);
{ const uv = logoGeo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setY(i, 1 - uv.getY(i)); uv.needsUpdate = true; }   // textura sin flipY
const logo = new THREE.Mesh(logoGeo, logoMat);
logo.renderOrder = 20; logoGroup.add(logo);
const logoShadowMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { uOp: { value: 0 } },
  vertexShader: 'varying vec2 vP; void main(){ vP = uv * 2.0 - 1.0; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: 'precision highp float; varying vec2 vP; uniform float uOp; void main(){ float d = length(vP); float a = exp(-pow(max(d - 0.55, 0.0) / 0.20, 2.0)) * smoothstep(1.0, 0.6, d); gl_FragColor = vec4(0.0, 0.0, 0.0, a * uOp); }' });
const logoShadow = new THREE.Mesh(new THREE.PlaneGeometry(logoSize * 1.5, logoSize * 1.5), logoShadowMat);
logoShadow.position.set(0.10 * logoSize, -0.07 * logoSize, -0.6); logoShadow.renderOrder = 19;
logoGroup.add(logoShadow);
logoGroup.position.set((LOGO.cx - W / 2) / PXU, (H / 2 - LOGO.cy) / PXU, 0);
// punto de la taza donde cae la gota (superficie del café en el dibujo del logo, px de la imagen de 870)
const CUP_IMG = [440, 250];
const cupLocal = new THREE.Vector3((CUP_IMG[0] / 870 - 0.5) * logoSize, (0.5 - CUP_IMG[1] / 870) * logoSize, 0.01);

// ---------- capa 2D (px de diseño, y hacia abajo) ----------
const over = new THREE.Scene();
const orthoPx = new THREE.OrthographicCamera(0, W, 0, -H, -10, 10);
const placeRect = (mesh, x, y, w, h) => { mesh.position.set(x + w / 2, -(y + h / 2), 0); mesh.scale.set(w, h, 1); };
const unitPlane = new THREE.PlaneGeometry(1, 1);

// barra de búsqueda de cristal (genérica, sin logos): desenfoque del fondo, saturación 140 %, borde 1 px, ruido 2 %
const BAR = { cx: 540, cy: 900, w: 964, h: 124 };
BAR.x0 = BAR.cx - BAR.w / 2; BAR.y0 = BAR.cy - BAR.h / 2;
const barCan = document.createElement('canvas'); barCan.width = Math.round(BAR.w * SCALE); barCan.height = Math.round(BAR.h * SCALE);
const barCtx = barCan.getContext('2d');
const barTex = canvasTex(barCan, false);
const barMat = new THREE.ShaderMaterial({ transparent: true, depthTest: false, depthWrite: false,
  uniforms: { uBlur: { value: rtB2.texture }, uText: { value: barTex }, uRes: { value: new THREE.Vector2(RW, RH) }, uSize: { value: new THREE.Vector2(BAR.w, BAR.h) },
    uFull: { value: new THREE.Vector4(BAR.x0, BAR.y0, BAR.w, BAR.h) }, uOp: { value: 0 }, uTextOp: { value: 1 }, uFlash: { value: 0 } },
  vertexShader: 'varying vec2 vUv; varying vec2 vF; void main(){ vUv = uv; vec4 wp = modelMatrix * vec4(position, 1.0); vF = vec2(wp.x, -wp.y); gl_Position = projectionMatrix * viewMatrix * wp; }',
  fragmentShader: /* glsl */`precision highp float; varying vec2 vUv; varying vec2 vF;
    uniform sampler2D uBlur; uniform sampler2D uText; uniform vec2 uRes; uniform vec2 uSize; uniform vec4 uFull; uniform float uOp; uniform float uTextOp; uniform float uFlash;
    ${SDRR} ${HASH}
    void main(){
      vec2 p = (vUv - 0.5) * uSize;
      float d = sdRR(p, uSize * 0.5, uSize.y * 0.5);
      float aa = max(fwidth(d), 1e-3);
      float mask = 1.0 - smoothstep(-aa, aa, d);
      vec3 b = texture2D(uBlur, gl_FragCoord.xy / uRes).rgb;
      float l = dot(b, vec3(0.2126, 0.7152, 0.0722)); b = max(vec3(0.0), mix(vec3(l), b, 1.4));
      vec3 col = b * 1.30 + vec3(0.026, 0.032, 0.034);
      float up = p.y / (uSize.y * 0.5);
      col += vec3(0.035, 0.040, 0.040) * smoothstep(-0.2, 1.0, up);                 // luz de arriba
      float rim = 1.0 - smoothstep(0.0, aa * 1.4, abs(d + aa * 0.9));
      col += vec3(0.42, 0.46, 0.45) * rim * mix(0.45, 1.0, smoothstep(-1.0, 1.0, up)) * (1.0 + 1.4 * uFlash);
      col += vec3(0.020) * uFlash;
      col *= 1.0 + (hash(gl_FragCoord.xy) - 0.5) * 0.04;
      vec4 tx = texture2D(uText, (vF - uFull.xy) / uFull.zw);
      col = mix(col, tx.rgb, tx.a * uTextOp);
      gl_FragColor = vec4(col, mask * uOp);
    }` });
const barMesh = new THREE.Mesh(unitPlane, barMat); barMesh.renderOrder = 5; barMesh.visible = false; over.add(barMesh);
const QUERY = TL.QUERY;
const TYPED = TL.TYPING;                                 // [{c, t}] (incluye espacios)
barCtx.font = '500 44px Poppins';
const QFS = Math.min(44, Math.floor(44 * 748 / barCtx.measureText(QUERY).width));
const TEXT_X = BAR.x0 + 116;                             // después de la lupa
const prefW = (() => { barCtx.font = `500 ${QFS}px Poppins`; const out = [0]; let s = ''; for (const k of TYPED) { s += k.c; out.push(barCtx.measureText(s).width); } return out; })();
function caretX(t) {                                     // fin del texto escrito, suavizado por letra
  let x = TEXT_X;
  for (let i = 0; i < TYPED.length; i++) x += (prefW[i + 1] - prefW[i]) * sstep(TYPED[i].t - 0.005, TYPED[i].t + 0.045, t);
  return x;
}
let barDrawn = -1;
function drawBar(t) {
  const n = TYPED.filter((k) => k.t <= t).length;
  const key = TYPED.some((k) => t >= k.t && t < k.t + 0.05) ? 'a' + t.toFixed(4) : 'n' + n;
  if (key === barDrawn) return; barDrawn = key;
  barCtx.setTransform(1, 0, 0, 1, 0, 0); barCtx.clearRect(0, 0, barCan.width, barCan.height);
  barCtx.setTransform(SCALE, 0, 0, SCALE, -BAR.x0 * SCALE, -BAR.y0 * SCALE);
  // lupa genérica de línea
  barCtx.strokeStyle = 'rgba(244,241,234,0.72)'; barCtx.lineWidth = 4.2; barCtx.lineCap = 'round';
  barCtx.beginPath(); barCtx.arc(BAR.x0 + 64, BAR.cy - 4, 15, 0, Math.PI * 2); barCtx.stroke();
  barCtx.beginPath(); barCtx.moveTo(BAR.x0 + 75, BAR.cy + 7); barCtx.lineTo(BAR.x0 + 87, BAR.cy + 19); barCtx.stroke();
  barCtx.font = `500 ${QFS}px Poppins`; barCtx.textBaseline = 'alphabetic'; barCtx.fillStyle = '#F4F1EA';
  for (let i = 0; i < TYPED.length; i++) {
    const k = clamp((t - TYPED[i].t) / 0.05);
    if (k <= 0 || TYPED[i].c === ' ') continue;
    barCtx.globalAlpha = easeOut(k);
    barCtx.fillText(TYPED[i].c, TEXT_X + prefW[i], BAR.cy + QFS * 0.36 + (1 - easeOut(k)) * 4);
  }
  barCtx.globalAlpha = 1;
  barTex.needsUpdate = true;
}

// trazo líquido (contorno del celular, círculos, subrayado): cinta con perfil de grosor, brillo y borde
const lineMat = () => new THREE.ShaderMaterial({ transparent: true, depthTest: false, depthWrite: false,
  uniforms: { uOp: { value: 1 } },
  vertexShader: 'attribute float aSide; attribute float aAlong; varying float vS; varying float vA; void main(){ vS = aSide; vA = aAlong; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: /* glsl */`precision highp float; varying float vS; varying float vA; uniform float uOp;
    void main(){ float a = abs(vS); float aa = fwidth(vS) * 1.2;
      float alpha = 1.0 - smoothstep(1.0 - aa, 1.0, a);
      float h = sqrt(max(1.0 - a * a, 0.0));
      vec3 deep = vec3(0.105, 0.028, 0.0045), amber = vec3(0.250, 0.070, 0.012);
      vec3 c = mix(deep, amber, h * 0.85);
      c += vec3(0.95, 0.80, 0.62) * exp(-pow((vS + 0.38) / 0.16, 2.0)) * 0.55;    // brillo
      c += vec3(0.85, 0.42, 0.14) * exp(-pow((vS - 0.55) / 0.22, 2.0)) * 0.12;    // cáustica
      gl_FragColor = vec4(c, alpha * uOp); }` });
class Ribbon {
  constructor(maxPts) {
    this.max = maxPts;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(maxPts * 2 * 3), 3));
    g.setAttribute('aSide', new THREE.BufferAttribute(new Float32Array(maxPts * 2), 1));
    g.setAttribute('aAlong', new THREE.BufferAttribute(new Float32Array(maxPts * 2), 1));
    const idx = [];
    for (let i = 0; i < maxPts - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    g.setIndex(idx);
    this.mat = lineMat();
    this.mesh = new THREE.Mesh(g, this.mat); this.mesh.frustumCulled = false; this.mesh.visible = false; this.mesh.renderOrder = 8;
    over.add(this.mesh);
  }
  set(pts, halfW, op) {
    const g = this.mesh.geometry, P = g.attributes.position.array, Sd = g.attributes.aSide.array, Al = g.attributes.aAlong.array;
    const n = Math.min(this.max, pts.length);
    if (n < 2 || op <= 0.002) { this.mesh.visible = false; return; }
    const hw = halfW + 1 / SCALE;                         // 1 px de margen para el antialias
    for (let i = 0; i < n; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
      let tx = b[0] - a[0], ty = b[1] - a[1]; const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
      const nx = -ty, ny = tx, taper = Math.min(1, i / 3, (n - 1 - i) / 2 + 0.6);
      for (const s of [-1, 1]) {
        const k = (i * 2 + (s > 0 ? 1 : 0));
        P[k * 3] = pts[i][0] + nx * hw * s * taper; P[k * 3 + 1] = -(pts[i][1] + ny * hw * s * taper); P[k * 3 + 2] = 0;
        Sd[k] = s * (hw / halfW); Al[k] = i / (n - 1);
      }
    }
    g.setDrawRange(0, (n - 1) * 6);
    g.attributes.position.needsUpdate = true; g.attributes.aSide.needsUpdate = true; g.attributes.aAlong.needsUpdate = true;
    this.mat.uniforms.uOp.value = op; this.mesh.visible = true;
  }
}
const outlineTrail = new Ribbon(560);
const trails = [new Ribbon(160), new Ribbon(160)];

// destello mínimo (la gota se deshace en la taza)
const sparkMat = new THREE.ShaderMaterial({ transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending,
  uniforms: { uOp: { value: 0 }, uRot: { value: 0 } },
  vertexShader: 'varying vec2 vP; void main(){ vP = uv * 2.0 - 1.0; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: /* glsl */`precision highp float; varying vec2 vP; uniform float uOp; uniform float uRot;
    void main(){ float c = cos(uRot), s = sin(uRot); vec2 p = vec2(c * vP.x - s * vP.y, s * vP.x + c * vP.y);
      float core = exp(-dot(p, p) / 0.010);
      float st = exp(-abs(p.y) / 0.022) * exp(-abs(p.x) / 0.34) + exp(-abs(p.x) / 0.022) * exp(-abs(p.y) / 0.34);
      vec2 r = vec2(0.7071 * (p.x - p.y), 0.7071 * (p.x + p.y));
      float st2 = (exp(-abs(r.y) / 0.018) * exp(-abs(r.x) / 0.16) + exp(-abs(r.x) / 0.018) * exp(-abs(r.y) / 0.16)) * 0.45;
      float a = (core * 1.2 + st + st2) * uOp;
      gl_FragColor = vec4(vec3(1.0, 0.94, 0.84) * a, 1.0); }` });
const spark = new THREE.Mesh(unitPlane, sparkMat); spark.renderOrder = 30; spark.visible = false; over.add(spark);

// ---------- tipografía cinética: por glifo, stagger 26 ms, Poppins Bold en mayúsculas, tracking amplio ----------
// Siempre FUERA de la pantalla del celular (la caja se calcula con el celular real en ese instante).
const KF = { track: 0.06, maxSize: 96, minSize: 46, lead: 1.04 };
const measCtx = document.createElement('canvas').getContext('2d');
measCtx.font = '700 100px Poppins';
const ADV = {};
const adv100 = (ch) => (ADV[ch] ??= measCtx.measureText(ch).width);
const wordW = (w, fs) => [...w].reduce((s, ch) => s + adv100(ch) * fs / 100 + KF.track * fs, 0) - KF.track * fs;
const lineW = (ln, fs) => ln.reduce((s, w, i) => s + wordW(w.text, fs) + (i ? adv100(' ') * fs / 100 + KF.track * fs : 0), 0);
// íconos de línea (los mismos de la página: perrito y laptop, trazo 1.7 en caja de 24)
const ICONS = {
  dog: ['M7.2 8.2C6.4 6.4 4.8 5.6 3.6 6c-.8 1.9-.4 4.4 1.3 5.8', 'M16.8 8.2c.8-1.8 2.4-2.6 3.6-2.2.8 1.9.4 4.4-1.3 5.8',
    'M6.8 10.6c0-2.9 2.3-4.9 5.2-4.9s5.2 2 5.2 4.9v2.6c0 3.6-2.3 6.3-5.2 6.3s-5.2-2.7-5.2-6.3v-2.6Z', 'M10.6 15.3h2.8L12 16.7l-1.4-1.4Z', 'M12 16.7v1'],
  dogDots: [[9.9, 11.9], [14.1, 11.9]],
  laptop: ['M6.3 5.4h11.4a1.5 1.5 0 0 1 1.5 1.5v6.8a1.5 1.5 0 0 1-1.5 1.5H6.3a1.5 1.5 0 0 1-1.5-1.5V6.9a1.5 1.5 0 0 1 1.5-1.5Z',
    'M2.8 18.6h18.4l-1.6-3.4H4.4l-1.6 3.4Z', 'M10.4 16.9h3.2'],
};
const svgNS = 'http://www.w3.org/2000/svg';
const svgEl = document.createElementNS(svgNS, 'svg'); document.body.appendChild(svgEl);
const pathLen = (d) => { const p = document.createElementNS(svgNS, 'path'); p.setAttribute('d', d); svgEl.appendChild(p); const L = p.getTotalLength(); p.remove(); return L; };
const ICON_PATHS = Object.fromEntries(['dog', 'laptop'].map((k) => [k, ICONS[k].map((d) => ({ p: new Path2D(d), L: pathLen(d) }))]));
const ICON_SIZE = 132;

// pose del celular (se usa también para acomodar la tipografía fuera de la pantalla)
const FOCUS_Y = 0.46;
const VIEW_MAX = Math.max(...TL.CAMERA.map((c) => c.view || 1));
function setPhone(t) {
  const c = cameraAt(TL.CAMERA, t);
  const sway = 1 - 0.8 * c.focusK;
  const kS = spring(prog(t, T.phoneSettle), 0.72, 7.2);
  const rotY = c.rotY + 1.1 * Math.sin(t * 0.9 + 0.4) * sway;
  const rotX = c.rotX + 0.55 * Math.sin(t * 0.7 + 1.0) * sway;
  const rotZ = lerp(-2.5, 0, kS);
  const s0 = (c.h * H) / (BODY_H * PXU), s = s0 * c.push;
  let cx = c.x * W, cy = c.y * H;
  const R = c.focus ? man.rects[c.focus] : null;
  if (R && c.focusK > 0) {
    const fx = (R.x + R.w / 2 - 195) * 0.01 * PXU, fy = (R.y + R.h / 2 - 422) * 0.01 * PXU;   // px por unidad de escala
    if (c.focusMax < 1.5) { cx -= (s - s0) * fx; cy -= (s - s0) * fy; }                    // zoom suave sobre el punto
    else { cx = lerp(cx, 0.5 * W - s * fx, c.focusK); cy = lerp(cy, FOCUS_Y * H - s * fy, c.focusK); }   // el foco va al centro
  }
  phoneRoot.position.set((cx - W / 2) / PXU, (H / 2 - cy) / PXU, 0);
  phoneRoot.scale.setScalar(s);
  phoneRoot.rotation.set(rotX * deg, rotY * deg, rotZ * deg);
  phoneRoot.updateMatrixWorld(true);
  return c;
}
const v3 = new THREE.Vector3();
function toPx(obj, x, y, z) {
  v3.set(x, y, z).applyMatrix4(obj.matrixWorld).project(camera);
  return [(v3.x * 0.5 + 0.5) * W, (1 - (v3.y * 0.5 + 0.5)) * H];
}
const cssPx = (x, y) => toPx(phoneOff, (x - 195) / 100, (422 - y) / 100, 0.02);
function phoneBounds() {
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const z of [0, -DEPTH]) {
    const p = toPx(phoneOff, sx * BODY_W / 2, sy * BODY_H / 2, z);
    x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]);
  }
  return { x0, x1, y0, y1 };
}
const unitPx = () => { const a = toPx(phoneOff, 0, 0, 0.02), b = toPx(phoneOff, 1, 0, 0.02); return Math.hypot(b[0] - a[0], b[1] - a[1]); };

// acomodo de cada grupo de tipografía: lado contrario al celular, el tamaño más grande que cabe (≥ 46 px)
camera.position.set(0, 0, ZC); camera.updateMatrixWorld(true);
const GROUPS = TL.KINETIC.map((g) => {
  let b = { x0: 1e9, x1: -1e9 };
  for (const tt of [g.in, (g.in + g.out[0]) / 2, g.out[0] - 0.02]) {   // el celular puede moverse un poco mientras se lee
    setPhone(tt); const q = phoneBounds(); b = { x0: Math.min(b.x0, q.x0), x1: Math.max(b.x1, q.x1) };
  }
  const x0 = g.side === 'left' ? 64 : b.x1 + 44;
  const x1 = g.side === 'left' ? b.x0 - 44 : W - 72;
  const avail = x1 - x0;
  let lines = g.lines;
  const fit = (ls) => Math.min(KF.maxSize, Math.floor(100 * avail / Math.max(...ls.map((ln) => lineW(ln, 100)))));
  let fs = fit(lines);
  if (fs < 50) { const single = lines.flat().map((w) => [w]); const f2 = fit(single); if (f2 > fs) { lines = single; fs = f2; } }
  fs = Math.max(KF.minSize, fs);
  const icon = g.id === 'k-perro' ? { name: 'dog', t: T.iconDog } : g.id === 'k-laptop' ? { name: 'laptop', t: T.iconLaptop } : null;
  const lh = fs * KF.lead, iconH = icon ? ICON_SIZE + 30 : 0;
  const total = iconH + lines.length * lh;
  const top = Math.round(0.505 * H - total / 2);
  const words = lines.flat();
  const lastWord = words[words.length - 1];
  const glyphs = [];
  lines.forEach((ln, li) => {
    let x = x0;
    const y = top + iconH + li * lh + fs * 0.80;
    ln.forEach((w, wi) => {
      if (wi) x += adv100(' ') * fs / 100 + KF.track * fs;
      [...w.text].forEach((ch, i) => { glyphs.push({ ch, x, y, start: w.land - 0.10 + i * 0.026, accent: w === lastWord }); x += adv100(ch) * fs / 100 + KF.track * fs; });
    });
  });
  if (avail < 220) console.warn(`${g.id}: caja angosta (${avail.toFixed(0)} px)`);
  return { ...g, x0, top, w: Math.max(...lines.map((ln) => lineW(ln, fs))), h: total, fs, glyphs, icon };
});
const KBOX = { w: Math.ceil(Math.max(...GROUPS.map((g) => g.w)) + 40), h: Math.ceil(Math.max(...GROUPS.map((g) => g.h)) + 60) };
const kCan = document.createElement('canvas'); kCan.width = Math.round(KBOX.w * SCALE); kCan.height = Math.round(KBOX.h * SCALE);
const kCtx = kCan.getContext('2d');
const kTex = canvasTex(kCan);
const kMesh = new THREE.Mesh(unitPlane, new THREE.MeshBasicMaterial({ map: kTex, transparent: true, depthTest: false, depthWrite: false, toneMapped: false }));
kMesh.renderOrder = 10; kMesh.visible = false; over.add(kMesh);
function drawKinetic(t, push) {
  const g = GROUPS.find((x) => t >= x.in - 0.02 && t <= x.out[1] + 0.02);
  if (!g) { kMesh.visible = false; return; }
  const vis = 1 - sstep(1.08, 1.30, push);               // nunca encima de la pantalla acercada
  const ox = g.x0 - 20, oy = g.top - 30;
  placeRect(kMesh, ox, oy, KBOX.w, KBOX.h);
  kCtx.setTransform(1, 0, 0, 1, 0, 0); kCtx.clearRect(0, 0, kCan.width, kCan.height);
  kCtx.setTransform(SCALE, 0, 0, SCALE, -ox * SCALE, -oy * SCALE);
  const n = g.glyphs.length, st = 0.010, d = Math.max(0.08, (g.out[1] - g.out[0]) - (n - 1) * st);
  kCtx.font = `700 ${g.fs}px Poppins`; kCtx.textBaseline = 'alphabetic';
  g.glyphs.forEach((q, j) => {
    const k = easeOut(clamp((t - q.start) / 0.34));
    const ko = easeInOut(clamp((t - (g.out[0] + j * st)) / d));
    const a = k * (1 - ko) * vis;
    if (a <= 0.003) return;
    kCtx.globalAlpha = a; kCtx.fillStyle = q.accent ? '#7CAC89' : '#F4F1EA';
    kCtx.fillText(q.ch, q.x, q.y + (1 - k) * 30 - ko * 16);
  });
  if (g.icon) {                                          // el ícono se dibuja con un trazo continuo
    const k = clamp((t - g.icon.t[0]) / (g.icon.t[1] - g.icon.t[0]));
    const ko = easeInOut(clamp((t - g.out[0]) / (g.out[1] - g.out[0])));
    if (k > 0 && ko < 1) {
      const sc = ICON_SIZE / 24, ix = g.x0 - 2.5 * sc, iy = g.top;
      kCtx.save(); kCtx.translate(ix, iy - ko * 16); kCtx.scale(sc, sc);
      kCtx.globalAlpha = (1 - ko) * vis * clamp(k * 6); kCtx.strokeStyle = '#F4F1EA'; kCtx.lineWidth = 1.7; kCtx.lineCap = 'round'; kCtx.lineJoin = 'round';
      const P = ICON_PATHS[g.icon.name], Ltot = P.reduce((s, p) => s + p.L, 0);
      let rem = easeInOut(clamp(k / 0.86)) * Ltot;
      for (const p of P) { if (rem <= 0) break; const l = Math.min(p.L, rem); kCtx.setLineDash([l, p.L + 1]); kCtx.stroke(p.p); rem -= l; }
      kCtx.setLineDash([]);
      if (g.icon.name === 'dog') { const kd = easeOut(clamp((k - 0.84) / 0.16)); if (kd > 0) { kCtx.fillStyle = '#F4F1EA'; for (const [x, y] of ICONS.dogDots) { kCtx.beginPath(); kCtx.arc(x, y, 1.15 * kd, 0, Math.PI * 2); kCtx.fill(); } } }
      kCtx.restore();
    }
  }
  kCtx.globalAlpha = 1;
  kTex.needsUpdate = true; kMesh.visible = true;
}

// textos del end card (tagline y línea obligatoria de demo)
const ENDT = TL.ENDCARD;
measCtx.font = '600 50px Poppins';
const TAG_FS = Math.min(50, Math.floor(50 * 944 / measCtx.measureText(ENDT.tagline).width));
measCtx.font = '500 30px Poppins';
const DIS_FS = Math.min(30, Math.floor(30 * 944 / measCtx.measureText(ENDT.disclaimer).width));
const eCan = document.createElement('canvas'); eCan.width = Math.round(W * SCALE); eCan.height = Math.round(220 * SCALE);
const eCtx = eCan.getContext('2d');
const eTex = canvasTex(eCan);
const eMesh = new THREE.Mesh(unitPlane, new THREE.MeshBasicMaterial({ map: eTex, transparent: true, depthTest: false, depthWrite: false, toneMapped: false }));
eMesh.renderOrder = 12; eMesh.visible = false; over.add(eMesh);
const E_TOP = 1110;
placeRect(eMesh, 0, E_TOP, W, 220);
let eKey = '';
function drawEnd(t) {
  if (t < T.tagline[0] - 0.05) { eMesh.visible = false; return; }
  const kT = clamp((t - T.tagline[0]) / (T.tagline[1] - T.tagline[0] + 0.25)), kD = clamp((t - T.disclaimer[0]) / (T.disclaimer[1] - T.disclaimer[0]));
  const key = kT.toFixed(4) + '|' + kD.toFixed(4);
  eMesh.visible = true;
  if (key === eKey) return; eKey = key;
  eCtx.setTransform(1, 0, 0, 1, 0, 0); eCtx.clearRect(0, 0, eCan.width, eCan.height);
  eCtx.setTransform(SCALE, 0, 0, SCALE, 0, -E_TOP * SCALE);
  eCtx.textBaseline = 'alphabetic';
  // tagline: palabra por palabra (sube 14 px y aparece), "Elevate Negocios" en salvia
  eCtx.font = `600 ${TAG_FS}px Poppins`;
  const words = ENDT.tagline.split(' ');
  const total = eCtx.measureText(ENDT.tagline).width;
  let x = W / 2 - total / 2;
  const dot = words.indexOf('·');
  words.forEach((w, i) => {
    const k = easeOut(clamp((kT * 1.0 - i * 0.07) / 0.45));
    eCtx.globalAlpha = k; eCtx.fillStyle = dot >= 0 && i > dot ? '#7CAC89' : '#F4F1EA';
    eCtx.fillText(w, x, E_TOP + 62 + (1 - k) * 14);
    x += eCtx.measureText(w + ' ').width;
  });
  eCtx.font = `500 ${DIS_FS}px Poppins`; eCtx.textAlign = 'center';
  eCtx.globalAlpha = easeOut(kD) * 0.74; eCtx.fillStyle = '#F4F1EA';
  eCtx.fillText(ENDT.disclaimer, W / 2, E_TOP + 150 + (1 - easeOut(kD)) * 8);
  eCtx.textAlign = 'left'; eCtx.globalAlpha = 1;
  eTex.needsUpdate = true;
}

// ---------- la gota: líquido 2D (metabolas) con refracción, absorción ámbar, menisco y cáustica ----------
const liquid = fsPass(/* glsl */`
precision highp float; varying vec2 vUv;
uniform sampler2D uScene; uniform vec2 uRes; uniform vec4 uBall[3]; uniform vec3 uSq; uniform float uOn;
float field(vec2 p){
  float f = 0.0;
  for (int i = 0; i < 3; i++) {
    vec4 b = uBall[i]; if (b.w <= 0.0) continue;
    vec2 d = p - b.xy;
    if (i == 0) { float c = cos(uSq.x), s = sin(uSq.x); d = vec2(c * d.x + s * d.y, -s * d.x + c * d.y) / uSq.yz; }
    f += b.w * b.z * b.z / (dot(d, d) + 1e-3);
  }
  return f;
}
void main(){
  vec3 sc = texture2D(uScene, vUv).rgb;
  vec2 p = gl_FragCoord.xy;
  float f = field(p);
  if (uOn <= 0.0 || f < 0.12) { gl_FragColor = vec4(sc, 1.0); return; }
  vec2 g = vec2(field(p + vec2(1.0, 0.0)) - field(p - vec2(1.0, 0.0)), field(p + vec2(0.0, 1.0)) - field(p - vec2(0.0, 1.0))) * 0.5;
  float gl = max(length(g), 1e-4);
  float sd = (1.0 - f) / gl;                                     // px: > 0 afuera, < 0 adentro
  float R = max(uBall[0].z, 1.0);
  float inside = 1.0 - smoothstep(-0.75, 0.75, sd);
  float h = sqrt(clamp(-sd / (R * 0.85), 0.0, 1.0));             // altura del domo
  vec2 n2 = -(g / gl) * (1.0 - h);                               // normal en pantalla (hacia afuera)
  vec3 N = normalize(vec3(n2, h + 0.18));
  vec3 thru = texture2D(uScene, vUv + n2 * (R / uRes) * 0.65).rgb;   // refracción: el fondo se ve invertido y aumentado
  vec3 trans = pow(vec3(0.60, 0.27, 0.085), vec3(0.55 + 1.5 * h));   // cold brew: más grueso, más oscuro
  vec3 amber = vec3(0.250, 0.070, 0.012);
  vec3 col = thru * trans + amber * (0.16 + 0.10 * h);
  vec2 L2 = normalize(vec2(-0.55, 0.65));                        // luz de arriba a la izquierda
  float caus = smoothstep(0.30, 1.0, dot(normalize(-n2 + 1e-5), L2)) * smoothstep(0.05, 0.35, h) * (1.0 - h);
  col += vec3(0.95, 0.52, 0.18) * caus * 0.42;                   // cáustica del lado de la sombra
  vec3 Hh = normalize(normalize(vec3(-0.45, 0.6, 0.66)) + vec3(0.0, 0.0, 1.0));
  col += vec3(1.0, 0.96, 0.9) * pow(max(dot(N, Hh), 0.0), 70.0) * 1.35;   // brillo especular
  col += vec3(0.9, 0.75, 0.6) * pow(1.0 - h, 7.0) * 0.06;
  col *= mix(0.50, 1.0, smoothstep(0.0, 0.28, h));               // menisco: el borde se oscurece
  float fs = field(p - vec2(R * 0.16, -R * 0.30));                // sombra de contacto (abajo a la derecha)
  float sh = smoothstep(0.30, 1.0, fs) * (1.0 - inside) * 0.38;
  vec3 outc = sc * (1.0 - sh * uOn);
  gl_FragColor = vec4(mix(outc, col, inside * uOn), 1.0);
}`, { uScene: { value: rtScene.texture }, uRes: { value: new THREE.Vector2(RW, RH) },
  uBall: { value: [new THREE.Vector4(), new THREE.Vector4(), new THREE.Vector4()] }, uSq: { value: new THREE.Vector3(0, 1, 1) }, uOn: { value: 1 } });
const accPass = fsPass('precision highp float; varying vec2 vUv; uniform sampler2D uSrc; uniform float uW; void main(){ gl_FragColor = vec4(texture2D(uSrc, vUv).rgb * uW, 1.0); }',
  { uSrc: { value: rtLiquid.texture }, uW: { value: 1 } }, { transparent: true, blending: THREE.AdditiveBlending });
const finalPass = fsPass(/* glsl */`
precision highp float; varying vec2 vUv; uniform sampler2D uSrc; uniform float uFrame;
float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233)) + uFrame * 0.618) * 43758.5453); }
vec3 toSRGB(vec3 c){ return mix(c * 12.92, 1.055 * pow(max(c, vec3(0.0)), vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
void main(){ vec3 c = toSRGB(texture2D(uSrc, vUv).rgb); c += (hash(gl_FragCoord.xy) - 0.5) / 255.0 * 1.6; gl_FragColor = vec4(c, 1.0); }`,
  { uSrc: { value: rtAcc.texture }, uFrame: { value: 0 } });

// ---------- recorrido de la gota ----------
// Anclas (dónde está algo en px del cuadro en el instante actual):
//   F: punto fijo del cuadro · C: punto de la pantalla en px CSS (la gota va pegada al cristal) ·
//   RIM: sentada en el canto superior del celular · CARET: al final del texto escrito · CUP: la taza del logo.
const BALL = 25, HEAD = 18, HANG_Y = 330;
let RIM_X = 0.55;
const F = (x, y) => ({ k: 'F', x, y });
const C = (x, y) => ({ k: 'C', x, y });
const RIM = { k: 'RIM' }, CARET = { k: 'CARET' }, CUP = { k: 'CUP' };
const rectAt = (name, t) => {
  const tr = man.tracks[name];
  if (tr) { const r = tr[Math.round(t * MF)]; if (r) return r; }
  return man.rects[name];
};
function radiusAt(a) {
  if (a.k === 'F' || a.k === 'CARET' || a.k === 'CUP') return BALL;
  return BALL * Math.sqrt(unitPx() / U0);
}
function at(a, t, r) {
  if (a.k === 'F') return [a.x, a.y];
  if (a.k === 'C') return cssPx(a.x, a.y);
  if (a.k === 'CR') { const R = rectAt(a.rect, Math.min(t, a.tEnd)); return cssPx(R.x + R.w / 2 + a.dx, R.y + R.h / 2 + a.dy); }
  if (a.k === 'RIM') { const p = toPx(phoneOff, RIM_X, BODY_H / 2 + 0.01, 0.02); return [p[0], p[1] - r * 0.62]; }
  if (a.k === 'CARET') return [caretX(t) + 4 + BALL, BAR.cy];
  if (a.k === 'CUP') { const p = toPx(logo, cupLocal.x, cupLocal.y, cupLocal.z); return p; }
  return [0, 0];
}
// lazo alrededor de un rect (superelipse; más cuadrada si la pieza es ancha), en px CSS
function loopPt(R, th, pad) {
  const a = R.w / 2 + pad, b = R.h / 2 + pad * 0.85;
  const n = 2 + 2 * clamp((R.w / R.h - 1.6) / 3);
  const c = Math.cos(th), s = Math.sin(th);
  return [R.x + R.w / 2 + a * Math.sign(c) * Math.pow(Math.abs(c), 2 / n), R.y + R.h / 2 + b * Math.sign(s) * Math.pow(Math.abs(s), 2 / n)];
}
const TH0 = -2.2, TURN = Math.PI * 2 * 1.06;
const SEG = [];
const seg = (t, type, o) => SEG.push({ t, type, ...o });
const land = (rect, fx = 0.86, fy = 0.30) => { const R = man.rects[rect]; return C(R.x + R.w * fx, R.y + R.h * fy); };
const loopEnd = (rect, t, pad) => { const R = rectAt(rect, t); const [x, y] = loopPt(R, TH0 + TURN, pad); return { k: 'CR', rect, tEnd: t, dx: x - (R.x + R.w / 2), dy: y - (R.y + R.h / 2) }; };
seg(T.dropFall, 'fall', { from: F(540, -90), to: F(540, BAR.cy) });
seg([T.dropFall[1], T.caret[0]], 'slide', { to: CARET });
seg([T.caret[0], T.dropOutline[0]], 'caret', { to: CARET });
seg(T.dropOutline, 'outline', { to: RIM });
seg(T.dropCircleMenu, 'circle', { rect: 'ctaMenu', pad: 13, to: loopEnd('ctaMenu', T.dropCircleMenu[1], 13) });
seg(T.dropHopLatte, 'hop', { to: land('latteCard', 0.90, 0.16), glint: 'latteCard' });
seg(T.dropCircleFrio, 'circle', { rect: 'latteFrio', pad: 9, to: loopEnd('latteFrio', T.dropCircleFrio[1], 9) });
seg(T.dropHopEspeciales, 'hop', { to: land('tabEspeciales', 0.88, 0.10), glint: 'tabEspeciales' });
seg(T.dropHopWaffles, 'hop', { to: land('tabWaffles', 0.88, 0.10), glint: 'tabWaffles' });
// antes del push-in a la tarjeta del waffle, la gota se pasa a la tarjeta (guía la mirada, como con el Latte)
seg(T.dropHopJamon, 'hop', { to: land('jamonCard', 0.92, 0.14), glint: 'jamonCard' });
seg(T.dropUnderlineJamon, 'underline', { rect: 'jamonName' });
seg(T.dropCircleAdd, 'circle', { rect: 'siAdd', pad: 11, to: loopEnd('siAdd', T.dropCircleAdd[1], 11) });
seg(T.dropHomeAdd, 'hop', { to: RIM });
seg(T.dropHopPickup, 'hop', { to: land('exitPickup', 0.80, 0.18) });
seg(T.dropGlintPickup, 'hop', { to: land('exitPickup', 0.80, 0.18), glint: 'exitPickup' });   // rebote en su lugar con brillo
seg(T.dropHome, 'hop', { to: RIM });                   // de vuelta al canto
// antes del push-in al horario se pasa a la tarjeta del horario
seg(T.dropHopHours, 'hop', { to: land('hours', 0.93, 0.06) });
seg(T.dropCircleHours, 'circle', { rect: 'hours', pad: 12, to: loopEnd('hours', T.dropCircleHours[1], 12) });
seg(T.dropFallCenter, 'fly', { to: F(540, HANG_Y) });
seg([T.dropFallCenter[1], T.dropOnCup[0]], 'hang', { to: F(540, HANG_Y) });
seg(T.dropOnCup, 'fall', { to: CUP });
SEG.forEach((s, i) => { s.from = s.from || (i ? SEG[i - 1].to : F(540, -90)); s.i = i; });
// subrayado: termina al final del nombre
{ const s = SEG.find((x) => x.type === 'underline'); const R = man.rects[s.rect]; s.u0 = [R.x - 2, R.y + R.h - 1]; s.u1 = [R.x + R.w + 2, R.y + R.h - 1]; s.to = C(...s.u1); }
SEG.forEach((s, i) => { if (i + 1 < SEG.length && SEG[i + 1].type !== 'underline') SEG[i + 1].from = s.to; });
const SEG_SORTED = SEG.slice().sort((a, b) => a.t[0] - b.t[0]);
for (let i = 1; i < SEG_SORTED.length; i++) if (SEG_SORTED[i].t[0] < SEG_SORTED[i - 1].t[1] - 1e-6) console.warn('tramos de la gota encimados', SEG_SORTED[i - 1].type, SEG_SORTED[i].type);
// contorno del celular (espacio local), arranca arriba al centro y recorre en sentido horario visual
const OUTLINE = (() => {
  const shape = rrPath(new THREE.Path(), BODY_W + 0.02, BODY_H + 0.02, BODY_R + 0.01);
  const raw = shape.getSpacedPoints(520);
  let k0 = 0, best = Infinity;
  raw.forEach((p, i) => { const d = Math.abs(p.x) + Math.abs(p.y - (BODY_H / 2 + 0.01)); if (d < best) { best = d; k0 = i; } });
  return raw.slice(k0).concat(raw.slice(1, k0 + 1)).reverse();
})();
let OUT_I0 = 0, OUT_DIR = 1, OUT_STEPS = OUTLINE.length;
{
  // el trazo empieza en el punto del contorno más cercano a la gota y termina en el canto superior
  camera.position.set(0, 0, ZC); camera.updateMatrixWorld(true);
  setPhone(T.dropOutline[0]);
  const p0 = [caretX(T.dropOutline[0]) + 4 + BALL, BAR.cy];
  let best = Infinity;
  OUTLINE.forEach((p, i) => { const q = toPx(phoneOff, p.x, p.y, 0.02); const d = Math.hypot(q[0] - p0[0], q[1] - p0[1]); if (d < best) { best = d; OUT_I0 = i; } });
  const N = OUTLINE.length - 1;
  const rimI = Math.round(N * 0.0) ;                     // índice del canto superior (arranque del arreglo)
  const fwd = (rimI - OUT_I0 + N) % N, bwd = (OUT_I0 - rimI + N) % N;
  OUT_DIR = fwd <= bwd ? 1 : -1;
  RIM_X = 0.55 * OUT_DIR;
  OUT_STEPS = N + Math.min(fwd, bwd) + Math.round(N * 0.035);
}
const outIdx = (s) => { const N = OUTLINE.length - 1; return ((OUT_I0 + OUT_DIR * Math.round(s)) % N + N) % N; };

function segAt(t) {
  let cur = null;
  for (const s of SEG_SORTED) { if (t >= s.t[0]) cur = s; else break; }
  return cur;
}
function dropState(t) {
  const s = segAt(t);
  const out = { pos: [540, -200], r: BALL, vis: 1, rest: 0, sat: [], wob: 0 };
  if (!s) { out.pos = at(F(540, -90), t); return out; }
  const k = clamp((t - s.t[0]) / (s.t[1] - s.t[0]));
  if (t > s.t[1]) {                                       // en reposo donde terminó el tramo
    out.r = radiusAt(s.to); out.pos = at(s.to, t, out.r);
    out.rest = s.to.k === 'RIM' ? clamp((t - s.t[1]) / 0.10) : 0;
    if (s.type === 'fall' && s.to.k === 'CUP') {          // se deshace en la taza
      const m = clamp((t - s.t[1]) / 0.16);
      out.r *= 1 - easeOut(m) * 0.92; if (m >= 1) out.vis = 0;
    }
    return out;
  }
  const r0 = radiusAt(s.from), r1 = radiusAt(s.to);
  out.r = lerp(r0, r1, k);
  const A0 = at(s.from, t, r0), A1 = at(s.to, t, r1);
  switch (s.type) {
    case 'fall': {                                         // gravedad
      const e = k * k;
      out.pos = [lerp(A0[0], A1[0], e), lerp(A0[1], A1[1], e)];
      break;
    }
    case 'slide': {                                        // salpica: abre la barra y se corre al inicio del texto
      const e = easeInOut(k);
      out.pos = [lerp(A0[0], A1[0], e), A0[1] - 26 * Math.sin(Math.PI * k) * (1 - k)];
      const sp = clamp(k / 0.75);                          // dos gotitas que salen y regresan a la barra
      if (sp < 1) {
        const rr = BALL * 0.34 * (1 - sp);
        out.sat = [[A0[0] - 150 * easeOut(sp), A0[1] - 70 * Math.sin(Math.PI * sp), rr], [A0[0] + 132 * easeOut(sp), A0[1] - 58 * Math.sin(Math.PI * sp), rr * 0.8]];
      }
      break;
    }
    case 'caret': {                                        // late como cursor (al tiempo de la música) y se contrae con el Enter
      out.pos = A1;
      const ph = ((t - T.caret[0]) / BEAT) % 1;
      out.r *= 1 + 0.08 * Math.exp(-ph * 5) * (t < TYPED[0].t ? 1 : 0.35);
      out.r *= 1 - 0.24 * bump(t, T.enter - 0.02, 0.18);
      break;
    }
    case 'outline': {
      const e = easeInOut(k);
      const sN = e * OUT_STEPS;
      const head = OUTLINE[outIdx(sN)];
      out.r = lerp(BALL, HEAD, clamp(k / 0.12)) * (k > 0.88 ? lerp(1, r1 / HEAD, (k - 0.88) / 0.12) : 1);
      out.pos = toPx(phoneOff, head.x, head.y, 0.02);
      if (k < 0.06) { const a = at(s.from, t, BALL); const m = easeOut(k / 0.06); out.pos = [lerp(a[0], out.pos[0], m), lerp(a[1], out.pos[1], m)]; }
      if (k > 0.94) { const m = easeInOut((k - 0.94) / 0.06); out.pos = [lerp(out.pos[0], A1[0], m), lerp(out.pos[1], A1[1], m)]; }
      break;
    }
    case 'hop': case 'fly': {                              // salto balístico
      const e = s.type === 'fly' ? easeOut(k) : easeInOut(k);
      const dist = Math.hypot(A1[0] - A0[0], A1[1] - A0[1]);
      const arc = clamp(dist * 0.32, 50, 230) * (s.type === 'fly' ? 0.6 : 1);
      out.pos = [lerp(A0[0], A1[0], e), lerp(A0[1], A1[1], e) - arc * 4 * k * (1 - k)];
      break;
    }
    case 'hang': {                                         // gota colgando: se mece y tiembla antes de caer
      out.pos = [A1[0] + 3 * Math.sin((t - s.t[0]) * 7.0), A1[1] + 4 * Math.sin((t - s.t[0]) * 9.5) * (1 - k * 0.5)];
      out.wob = Math.sin((t - s.t[0]) * 16) * 0.07 * (1 - k * 0.6);
      break;
    }
    case 'circle': {
      const R = rectAt(s.rect, t), ka = 0.36;
      const p1 = cssPx(...loopPt(R, TH0, s.pad));
      if (k < ka) {
        const m = easeInOut(k / ka), dist = Math.hypot(p1[0] - A0[0], p1[1] - A0[1]);
        out.pos = [lerp(A0[0], p1[0], m), lerp(A0[1], p1[1], m) - clamp(dist * 0.3, 30, 180) * 4 * (k / ka) * (1 - k / ka)];
      } else out.pos = cssPx(...loopPt(R, TH0 + TURN * easeInOut((k - ka) / (1 - ka)), s.pad));
      out.r = radiusAt(C(0, 0)) * 0.86;
      break;
    }
    case 'underline': {
      const ka = 0.32;
      const p1 = cssPx(...s.u0);
      if (k < ka) {
        const m = easeInOut(k / ka), dist = Math.hypot(p1[0] - A0[0], p1[1] - A0[1]);
        out.pos = [lerp(A0[0], p1[0], m), lerp(A0[1], p1[1], m) - clamp(dist * 0.3, 30, 160) * 4 * (k / ka) * (1 - k / ka)];
      } else { const m = easeInOut((k - ka) / (1 - ka)); out.pos = cssPx(lerp(s.u0[0], s.u1[0], m), s.u0[1]); }
      out.r = radiusAt(C(0, 0)) * 0.80;
      break;
    }
    default: out.pos = A1;
  }
  return out;
}
// trazos que deja la gota (en px CSS de la pantalla: se acercan y se mueven con el celular)
function trailState(t, push) {
  const res = [];
  for (const s of SEG) {
    if (s.type !== 'circle' && s.type !== 'underline') continue;
    const ka = s.type === 'circle' ? 0.36 : 0.32;
    const tA = s.t[0] + ka * (s.t[1] - s.t[0]);
    if (t < tA || t > s.t[1] + 0.55) continue;
    const k = clamp((t - s.t[0]) / (s.t[1] - s.t[0]));
    const m = easeInOut(clamp((k - ka) / (1 - ka)));
    const op = 1 - sstep(s.t[1] + 0.12, s.t[1] + 0.55, t);
    const pts = [];
    if (s.type === 'circle') {
      const R = rectAt(s.rect, Math.min(t, s.t[1])), n = 90;
      for (let i = 0; i <= n; i++) { const th = TH0 + TURN * m * (i / n); pts.push(cssPx(...loopPt(R, th, s.pad))); }
    } else {
      const n = 30;
      for (let i = 0; i <= n; i++) pts.push(cssPx(lerp(s.u0[0], lerp(s.u0[0], s.u1[0], m), i / n), s.u0[1]));
    }
    const w = (s.type === 'underline' ? 5.0 : 4.2) * Math.sqrt(unitPx() / U0);
    res.push({ pts, w, op });
  }
  return res;
}
function glintState(t) {
  for (const s of SEG) {
    if (!s.glint) continue;
    const a = s.t[1] - 0.06, b = s.t[1] + 0.46;
    if (t >= a && t <= b) return { rect: man.rects[s.glint], k: (t - a) / (b - a) };
  }
  return null;
}

// ---------- estado en el tiempo ----------
const fanFrame = Math.round(T.fanOut[0] * MF);
const scrollAtF = (pf) => (man.frames[clamp(pf, man.f0, man.f1)] || man.frames[man.f0]).scrollY[0];
const FAN = [{ x: -2.25, y: 0.02, z: 1.40, ry: 24, rz: 5 }, { x: 0, y: 0.22, z: 2.30, ry: 0, rz: 0 }, { x: 2.25, y: 0.02, z: 1.40, ry: -24, rz: -5 }];
const hiddenAt = (pf, a, b) => pf >= Math.ceil(a * MF - 1e-9) && pf < Math.ceil(b * MF - 1e-9);
function posePieces(t, pf) {
  // tarjeta cold brew: sale al espacio 3D, flota (sombra y parallax) y regresa
  {
    const on = hiddenAt(pf, T.cardOut[0], T.cardBack[1]);
    const up = spring(prog(t, T.cardOut), 0.74, 7.0), down = spring(prog(t, T.cardBack), 0.86, 8.4);
    const k = up * (1 - down);
    const bob = t > T.cardOut[1] && t < T.cardBack[1] ? Math.sin((t - T.cardOut[1]) * 5.4) * (1 - prog(t, T.cardBack)) : 0;
    const P = cardCB.rest;
    cardCB.mesh.visible = on; cardCB.sh.visible = on;
    cardCB.mesh.position.set(P.x + lerp(0, -1.30, k), P.y + lerp(0, 0.66, k) + bob * 0.05, 0.004 + lerp(0, 2.05, k));
    cardCB.mesh.rotation.set(lerp(0, -9, k) * deg, (lerp(0, 25, k) + bob * 1.8) * deg, lerp(0, 3.2, k) * deg);
    const z = cardCB.mesh.position.z - 0.004;
    cardCB.sh.position.set(cardCB.mesh.position.x + z * 0.16, cardCB.mesh.position.y - z * 0.26, 0.0045);
    cardCB.sh.scale.setScalar(1 + z * 0.05);
    cardCB.sh.material.uniforms.uSoft.value = 0.03 + z * 0.16;
    cardCB.sh.material.uniforms.uOp.value = on ? clamp(z * 1.2, 0, 1) * lerp(0.42, 0.26, clamp(z / 2.05, 0, 1)) : 0;
    cardCB.front.uniforms.uSweep.value = lerp(-0.4, 1.6, easeInOut(prog(t, [T.cardOut[0] + 0.05, T.cardOut[0] + 0.45])));
  }
  // "Agregar": se ve el presionado real, al soltar se levanta en 3D con pop y regresa con la ficha que baja
  {
    const on = hiddenAt(pf, T.addLift3D[0], T.addLift3D[1]);
    addBtn.mesh.visible = on; addBtn.sh.visible = on;
    if (on) {
      const L0 = T.addLift3D[0], L1 = T.addLift3D[1];
      const R0 = man.tex.siAdd.rect, P0 = cssToLocal(R0.x + R0.w / 2, R0.y + R0.h / 2);   // donde estaba al soltar
      const CB = man.rects.cartbar, P1 = cssToLocal(CB.x + CB.w / 2, CB.y + CB.h / 2);    // barra del pedido
      const a = spring(prog(t, [L0, L0 + 0.30]), 0.42, 12);                               // pop
      const d = easeInOut(prog(t, [L0 + 0.20, L1 - 0.03]));                                // cae al pedido
      const lx = P0.x - 0.10 * a, ly = P0.y + 0.52 * a, lz = 0.62 * a;
      addBtn.mesh.position.set(lerp(lx, P1.x, d), lerp(ly, P1.y, d) + 0.35 * Math.sin(Math.PI * d), 0.004 + lz * (1 - d) + 0.25 * Math.sin(Math.PI * d));
      addBtn.mesh.scale.setScalar((1 + 0.10 * a) * lerp(1, 0.50, d));
      addBtn.mesh.rotation.set(lerp(-9 * a, 6, d) * deg, lerp(7 * a, -4, d) * deg, -1.5 * a * (1 - d) * deg);
      addBtn.front.uniforms.uOp.value = 1 - sstep(0.72, 1, d);
      const k = a * (1 - d);
      addBtn.sh.position.set(addBtn.mesh.position.x + 0.06 * k, addBtn.mesh.position.y - 0.20 * k, 0.0045);
      addBtn.sh.material.uniforms.uSoft.value = 0.04 + 0.16 * k;
      addBtn.sh.material.uniforms.uOp.value = clamp(k * 1.4) * 0.34;
      addBtn.front.uniforms.uSweep.value = lerp(-0.4, 1.6, easeInOut(prog(t, [L0 + 0.04, L0 + 0.40])));
    }
  }
  // reseñas: tres tarjetas de cristal en abanico 3D (salen del carrusel y regresan a la reseña 3)
  {
    const on = hiddenAt(pf, T.fanOut[0], T.fanBack[1]);
    const R3 = man.rects.rev3;
    const dy = scrollAtF(pf) - scrollAtF(fanFrame);
    revs.forEach((rv, i) => {
      rv.mesh.visible = on; rv.sh.visible = on;
      if (!on) return;
      const outK = spring(prog(t, [T.fanOut[0] + (i === 1 ? 0 : 0.03), T.fanOut[1] + (i === 1 ? 0 : 0.03)]), 0.80, 7.6);
      const backK = easeInOut(prog(t, T.fanBack));
      const k = outK * (1 - backK);
      const slot = cssToLocal(R3.x + R3.w / 2, R3.y + R3.h / 2 - dy);
      const zs = i === 2 ? 0.004 : 0.004 - 0.02 * (2 - i);
      const Fp = FAN[i];
      rv.mesh.position.set(lerp(slot.x, Fp.x, k), lerp(slot.y, Fp.y, k), lerp(zs, Fp.z, k));
      rv.mesh.rotation.set(0, Fp.ry * k * deg, Fp.rz * k * deg);
      rv.front.uniforms.uOp.value = i === 2 ? 1 : clamp(k * 3.2);
      rv.front.uniforms.uSweep.value = i === 1 ? lerp(-0.4, 1.6, easeInOut(prog(t, [T.pushReview2[0] + 0.05, T.pushReview2[0] + 0.55]))) : -1;
      rv.sh.position.set(rv.mesh.position.x + 0.16 * Fp.z * k, rv.mesh.position.y - 0.26 * Fp.z * k, 0.0045);
      rv.sh.material.uniforms.uSoft.value = 0.04 + 0.15 * Fp.z * k;
      rv.sh.material.uniforms.uOp.value = clamp(k * 1.3) * 0.30;
    });
  }
}
function setCamera(c) {
  // acercamiento de cámara (dolly) a la reseña 2 del abanico
  if (c.view > 1.0005 && revs[1].mesh.visible) {
    revs[1].mesh.updateMatrixWorld(true);
    const p = new THREE.Vector3().setFromMatrixPosition(revs[1].mesh.matrixWorld);
    const kv = clamp((c.view - 1) / (VIEW_MAX - 1));
    camera.position.set(p.x * kv, p.y * kv, p.z + (ZC - p.z) / c.view);
  } else camera.position.set(0, 0, ZC);
  camera.updateMatrixWorld(true);
}
let curPush = 1;
const prevPos = { t: null, p: null };
function frameState(t) {
  const pf = clamp(Math.round(t * MF), man.f0, man.f1);
  camera.position.set(0, 0, ZC); camera.updateMatrixWorld(true);
  const c = setPhone(t);
  curPush = c.push;
  posePieces(t, pf);
  setCamera(c);
  phoneOff.updateMatrixWorld(true);
  // celular: entra el cristal, enciende la pantalla, se desvanece antes del end card
  const fade = 1 - easeInOut(prog(t, [T.phoneAway[1] - 0.05, T.hit24 + 0.02]));
  const band = 0.10 + 0.22 * Math.sin(t * 0.55) + c.rotY * 0.012;
  glassMat.uniforms.uOp.value = easeInOut(prog(t, T.phoneIn)) * fade;
  phoneShadowMat.uniforms.uOp.value = 0.55 * easeInOut(prog(t, T.phoneIn)) * fade;
  glassMat.uniforms.uBand.value = band;
  screenMat.uniforms.uBand.value = band;
  screenMat.uniforms.uOp.value = easeInOut(prog(t, [T.phoneIn[0] + 0.08, T.phoneIn[1]])) * fade;
  screenMat.uniforms.uOn.value = easeOut(prog(t, [T.screenOn, T.screenOn + 0.22]));
  const vis = fade > 0.001 && t > T.phoneIn[0] - 0.05;
  body.visible = vis; screen.visible = vis; phoneShadow.visible = vis;   // antes de entrar ya tiene pose: la gota dibuja su contorno
  backdrop.mat.uniforms.uPar.value.set(-(c.x - 0.5) * 0.15 + c.rotY * 0.002, 0);
  // página en pantalla (en los scrolls hay 4 subcapturas por cuadro)
  const page = pageTex.get(pageKey(t));
  if (page) screenMat.uniforms.uPage.value = page;
  // brillo de la gota sobre la pieza que toca
  const G = glintState(t);
  if (G) { screenMat.uniforms.uGl.value.set(G.rect.x, G.rect.y, G.rect.w, G.rect.h); screenMat.uniforms.uGlK.value = G.k; screenMat.uniforms.uGlOp.value = Math.sin(Math.PI * clamp(G.k)); screenMat.uniforms.uGlR.value = Math.min(18, G.rect.h / 2); }
  else screenMat.uniforms.uGlOp.value = 0;
  // barra de búsqueda (gancho)
  {
    const open = prog(t, T.barIn), close = prog(t, T.barOut);
    const on = t >= T.barIn[0] && close < 1;
    barMesh.visible = on;
    if (on) {
      const w = BAR.w * clamp(spring(open, 0.62, 9.0), 0, 1.04) * (1 - easeInOut(close));
      const h = BAR.h * (0.30 + 0.70 * easeOut(clamp(open / 0.7))) * (1 - 0.6 * easeInOut(close));
      const ax = lerp(BAR.cx, caretX(t) + 4 + BALL, easeInOut(close));       // se recoge en la gota
      placeRect(barMesh, ax - w / 2, BAR.cy - h / 2, Math.max(w, 1), Math.max(h, 1));
      barMat.uniforms.uSize.value.set(Math.max(w, 1), Math.max(h, 1));
      barMat.uniforms.uOp.value = easeOut(clamp(open / 0.35)) * (1 - sstep(0.55, 1, close));
      barMat.uniforms.uTextOp.value = 1 - sstep(0, 0.45, close);
      barMat.uniforms.uFlash.value = bump(t, T.enter - 0.02, 0.24);
      drawBar(t);
    }
  }
  // end card: el logo entra con un giro leve; la gota cae en la taza y se deshace en un destello
  {
    const kIn = spring(prog(t, T.logoIn), 0.70, 7.5), op = easeOut(prog(t, [T.logoIn[0], T.logoIn[0] + 0.28]));
    const hit = bump(t, T.dropOnCup[1] - 0.01, 0.22);
    logoGroup.visible = t >= T.logoIn[0] - 0.01;
    logoGroup.scale.setScalar(lerp(0.88, 1, kIn) * (1 - 0.012 * hit));
    logoGroup.rotation.set((lerp(7, 0, kIn) + 0.5 * Math.sin(t * 0.8)) * deg, (lerp(-18, 0, kIn) + 1.2 * Math.sin(t * 0.6 + 0.3)) * deg, 0);
    logoMat.opacity = op;
    logoShadowMat.uniforms.uOp.value = 0.42 * op;
    logoGroup.updateMatrixWorld(true);
    backdrop.mat.uniforms.uEnd.value = easeInOut(prog(t, [T.hit24 - 0.2, T.hit24 + 0.8]));
  }
  // gota y trazos
  const D = dropState(t);
  let sx = 1, sy = 1, ang = 0;
  if (prevPos.t !== null && Math.abs(t - prevPos.t) > 1e-6 && prevPos.p) {
    const vx = (D.pos[0] - prevPos.p[0]) / (t - prevPos.t), vy = (D.pos[1] - prevPos.p[1]) / (t - prevPos.t);
    const st = Math.min(0.55, Math.hypot(vx, vy) / 5200);
    sx = 1 + st; sy = 1 / Math.sqrt(1 + st); ang = -Math.atan2(vy, vx);
  }
  prevPos.t = t; prevPos.p = D.pos;
  if (D.rest > 0) { sx = lerp(sx, 1.16, D.rest); sy = lerp(sy, 0.84, D.rest); ang = lerp(ang, 0, D.rest); }
  if (D.wob) { sx *= 1 + D.wob; sy *= 1 - D.wob; }
  const B = liquid.mat.uniforms.uBall.value;
  B[0].set(D.pos[0] * SCALE, (H - D.pos[1] + (D.rest ? -D.r * 0.10 * D.rest : 0)) * SCALE, D.r * SCALE, D.vis);
  B[1].set(0, 0, 0, 0); B[2].set(0, 0, 0, 0);
  D.sat.forEach((q, i) => { if (q[2] > 0.3) B[i + 1].set(q[0] * SCALE, (H - q[1]) * SCALE, q[2] * SCALE, 1); });
  liquid.mat.uniforms.uSq.value.set(ang, sx, sy);
  // contorno del celular: crece con la gota; se desvanece mientras aparece el cristal
  if (t >= T.dropOutline[0] && t < T.phoneIn[1] + 0.30) {
    const e = easeInOut(prog(t, T.dropOutline));
    const n = Math.max(2, Math.min(OUTLINE.length - 1, Math.floor(e * OUT_STEPS)));
    const pts = []; for (let s = 0; s <= n; s += 1) { const p = OUTLINE[outIdx(s)]; pts.push(toPx(phoneOff, p.x, p.y, 0.02)); }
    outlineTrail.set(pts, 4.4, 1 - smooth01(prog(t, [T.phoneIn[0] + 0.12, T.phoneIn[1] + 0.25])));
  } else outlineTrail.set([], 0, 0);
  const TR = trailState(t, c.push);
  trails.forEach((rb, i) => { const q = TR[i]; if (q) rb.set(q.pts, q.w, q.op); else rb.set([], 0, 0); });
  drawKinetic(t, c.push);
  {
    const ks = prog(t, T.sparkle);
    spark.visible = ks > 0 && ks < 1;
    if (spark.visible) {
      const p = at(CUP, t), sz = 150 * easeOut(clamp(ks / 0.3)) * (1 - 0.3 * ks);
      placeRect(spark, p[0] - sz / 2, p[1] - sz / 2, sz, sz);
      sparkMat.uniforms.uOp.value = easeOut(clamp(ks / 0.18)) * (1 - easeInOut(clamp((ks - 0.25) / 0.75)));
      sparkMat.uniforms.uRot.value = 0.35 * ks;
    }
  }
  drawEnd(t);
  backdrop.mat.uniforms.uHit.value = Math.exp(-t / 0.16) + 0.6 * (t >= T.hit24 ? Math.exp(-(t - T.hit24) / 0.22) : 0);
}

// ---------- texturas de la página por cuadro ----------
const pageTex = new Map();
function pageKey(ts) {
  const pf = clamp(Math.round(ts * MF), man.f0, man.f1);
  const fr = man.frames[pf];
  if (fr.files.length === 1) return fr.files[0];
  const u = (ts - pf / MF) * 2 * MF + 0.5;               // posición dentro del obturador de la captura
  return fr.files[clamp(Math.floor(u * fr.files.length), 0, fr.files.length - 1)];
}
async function preparePages(f) {
  const need = new Set();
  for (let k = 0; k < SUBS; k++) need.add(pageKey(f / FPS + (-0.5 + (k + 0.5) / SUBS) * (0.5 / FPS)));
  for (const key of need) if (!pageTex.has(key)) pageTex.set(key, texFrom(await bitmap(CAP + 'frames/' + key)));
  for (const [key, tex] of [...pageTex]) if (!need.has(key)) { tex.dispose(); pageTex.delete(key); }
}

const halton = (i, b) => { let f = 1, r = 0; while (i > 0) { f /= b; r += f * (i % b); i = Math.floor(i / b); } return r; };
function jitter(k) {
  const jx = SUBS > 1 ? halton(k + 1, 2) - 0.5 : 0, jy = SUBS > 1 ? halton(k + 1, 3) - 0.5 : 0;
  camera.setViewOffset(RW, RH, jx, jy, RW, RH);
  orthoPx.left = -jx / SCALE; orthoPx.right = W - jx / SCALE; orthoPx.top = jy / SCALE; orthoPx.bottom = -H + jy / SCALE;
  orthoPx.updateProjectionMatrix();
}
function renderSub() {
  renderer.setRenderTarget(rtScene);
  renderer.setClearColor(0x000000, 1); renderer.clear(true, true, true);
  copyPass.mat.uniforms.uSrc.value = rtSharp.texture;
  renderer.render(copyPass.scene, orthoNDC);
  renderer.clearDepth();
  renderer.render(scene, camera);
  renderer.render(over, orthoPx);
  draw(liquid, rtLiquid);
  renderer.setRenderTarget(rtAcc);
  renderer.render(accPass.scene, orthoNDC);
}

window.renderFrame = async (f) => {
  await preparePages(f);
  const tc = f / FPS;
  backdrop.mat.uniforms.uT.value = tc;
  frameState(tc);
  draw(backdrop, rtSharp);                                  // fondo nítido (mitad) y desenfocado (cuarto)
  blurPass.mat.uniforms.uSrc.value = rtSharp.texture; blurPass.mat.uniforms.uDir.value.set(2.2 / (RW >> 1), 0); draw(blurPass, rtB1);
  blurPass.mat.uniforms.uSrc.value = rtB1.texture; blurPass.mat.uniforms.uDir.value.set(0, 2.2 / (RH >> 2)); draw(blurPass, rtB2);
  renderer.setRenderTarget(rtAcc); renderer.setClearColor(0x000000, 1); renderer.clear(true, false, false);
  accPass.mat.uniforms.uW.value = 1 / SUBS;
  prevPos.t = null;
  frameState(tc - 0.25 / FPS - 0.004);                      // semilla de velocidad para la gota
  for (let k = 0; k < SUBS; k++) {
    const ts = tc + (-0.5 + (k + 0.5) / SUBS) * (0.5 / FPS);
    frameState(ts);
    jitter(k);
    renderSub();
  }
  finalPass.mat.uniforms.uFrame.value = f;
  renderer.setRenderTarget(null);
  renderer.render(finalPass.scene, orthoNDC);
  renderer.getContext().finish();
  return true;
};
window.compositorInfo = { W, H, RW, RH, SUBS, FPS, frames: Math.round(TL.DUR * FPS),
  groups: GROUPS.map((g) => ({ id: g.id, x0: Math.round(g.x0), w: Math.round(g.w), fs: g.fs, lines: g.glyphs.length })), qfs: QFS, tag: TAG_FS, dis: DIS_FS };
window.ready = true;
