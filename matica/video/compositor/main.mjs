// Compositor determinista frame(t) del video de Matíca · por ahora, la prueba de estilo (fase 4).
// Three.js (WebGL2 por software). N subcuadros por cuadro (obturador de 180°) acumulados en float.
// Capas: fondo (pizarra -> verde bosque) · celular de cristal 3D con la página real en pantalla ·
// tarjeta 3D (la misma pieza de interfaz con grosor y sombra) · tipografía cinética 2D ·
// la gota de cold brew (2D, líquido con refracción, menisco y cáustica) y sus trazos.
// API para el render: window.renderFrame(f) deja el cuadro en el canvas.
import * as THREE from './vendor/three.module.js';
import { STYLE } from '../timeline/style_test.mjs';
import { clamp, lerp, prog, easeInOut, easeOut, spring } from '../timeline/timeline.mjs';

const qs = new URLSearchParams(location.search);
const SCALE = Number(qs.get('scale') || 0.5);
const SUBS = Number(qs.get('subs') || 8);
const FPS = Number(qs.get('fps') || STYLE.FPS);
const W = 1080, H = 1920;
const RW = Math.round(W * SCALE), RH = Math.round(H * SCALE);
const CAP = '../build/style/';
const S = STYLE.T;
const deg = Math.PI / 180;

// ---------- utilidades ----------
const fetchJSON = (u) => fetch(u).then((r) => r.json());
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

const man = await fetchJSON(CAP + 'manifest.json');
for (const [w, file] of [[600, 'poppins-latin-600-normal'], [700, 'poppins-latin-700-normal']]) {
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
uniform float uT; uniform vec2 uPar; uniform float uAspect;
float g(vec2 p, vec2 c, vec2 r){ vec2 d = (p - c) / r; return exp(-dot(d, d)); }
void main(){
  vec2 p = vUv; vec2 q = vec2((p.x - 0.5) * uAspect, p.y - 0.5);
  vec3 slate = vec3(0.0103, 0.0160, 0.0194);              // #1A2226
  vec3 deep = vec3(0.0058, 0.0090, 0.0108);
  vec3 forest = vec3(0.0137, 0.0742, 0.0273) * 0.30;      // #1F4D2E, bajito
  vec3 col = mix(forest, slate, smoothstep(0.0, 0.72, p.y));
  col = mix(col, deep, smoothstep(0.55, 1.0, p.y) * 0.65);
  vec3 sage = vec3(0.202, 0.413, 0.250);                  // #7CAC89
  col += sage * 0.018 * g(q, vec2(0.08, 0.02) + uPar * 0.30, vec2(0.70, 0.52));
  col += sage * 0.009 * g(q, vec2(-0.30 + 0.03 * sin(uT * 0.40), 0.30) + uPar * 0.50, vec2(0.34, 0.22));
  col += vec3(0.009, 0.011, 0.011) * g(q, vec2(0.30, -0.24 + 0.02 * sin(uT * 0.33)) + uPar * 0.60, vec2(0.30, 0.34));
  float vig = smoothstep(1.2, 0.28, length(q * vec2(1.0, 0.86)));
  col *= mix(0.58, 1.0, vig);
  gl_FragColor = vec4(col, 1.0);
}`, { uT: { value: 0 }, uPar: { value: new THREE.Vector2() }, uAspect: { value: W / H } });
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
const phoneRoot = new THREE.Group(); scene.add(phoneRoot);
const phoneOff = new THREE.Group(); phoneRoot.add(phoneOff);

const glassMat = new THREE.ShaderMaterial({
  uniforms: { uSharp: { value: rtSharp.texture }, uBlur: { value: rtB2.texture }, uOp: { value: 0 }, uBand: { value: 0.1 },
    uHalfO: { value: new THREE.Vector2(BODY_W / 2, BODY_H / 2) }, uRO: { value: BODY_R },
    uHalfS: { value: new THREE.Vector2(SW / 2, SH / 2) }, uRS: { value: SCR_R } },
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
      gl_FragColor = vec4(mix(sharp, glass, uOp), 1.0);
    }`,
});
const bodyGeo = new THREE.ExtrudeGeometry(rrPath(new THREE.Shape(), BODY_W - 2 * CHAMF, BODY_H - 2 * CHAMF, BODY_R - CHAMF),
  { depth: DEPTH - 2 * CHAMF, bevelEnabled: true, bevelThickness: CHAMF, bevelSize: CHAMF, bevelSegments: 5, curveSegments: 40 });
bodyGeo.translate(0, 0, -(DEPTH - CHAMF));
const body = new THREE.Mesh(bodyGeo, glassMat);
phoneOff.add(body);
const phoneShadowMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false,
  uniforms: { uHalf: { value: new THREE.Vector2(BODY_W / 2, BODY_H / 2) }, uR: { value: BODY_R }, uOp: { value: 0 } },
  vertexShader: 'varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `precision highp float; varying vec2 vP; uniform vec2 uHalf; uniform float uR; uniform float uOp; ${SDRR}
    void main(){ float d = sdRR(vP, uHalf, uR); float a = 1.0 - smoothstep(-0.35, 1.25, d); gl_FragColor = vec4(0.0, 0.0, 0.0, a * a * uOp); }` });
const phoneShadow = new THREE.Mesh(new THREE.PlaneGeometry(BODY_W + 3.2, BODY_H + 3.2), phoneShadowMat);
phoneShadow.position.set(0.32, -0.55, -DEPTH - 0.9); phoneShadow.renderOrder = -1;
phoneOff.add(phoneShadow);

// barra de estado (texto oscuro: la página es clara) con isla dinámica, a 3x
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
    uLight: { value: new THREE.Vector3(-0.35, 0.55, 0.75).normalize() } },
  vertexShader: /* glsl */`
    varying vec2 vUv; varying vec3 vN; varying vec3 vV;
    void main(){ vUv = uv; vec4 wp = modelMatrix * vec4(position, 1.0); vN = normalize(mat3(modelMatrix) * normal);
      vV = normalize(cameraPosition - wp.xyz); gl_Position = projectionMatrix * viewMatrix * wp; }`,
  fragmentShader: /* glsl */`
    precision highp float;
    varying vec2 vUv; varying vec3 vN; varying vec3 vV;
    uniform sampler2D uPage; uniform sampler2D uStatus; uniform float uOn; uniform float uOp; uniform float uBand; uniform vec3 uLight;
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
      if (css.y < 60.0) { vec4 s = texture2D(uStatus, vec2(css.x / 390.0, css.y / 60.0)); col = mix(col, s.rgb, s.a); }
      float hi = sdRR(css - vec2(195.0, 836.0), vec2(67.0, 2.5), 2.5);
      col = mix(col, vec3(0.010, 0.014, 0.012), (1.0 - smoothstep(-0.7, 0.7, hi)) * 0.72);
      col = mix(vec3(0.0016, 0.0019, 0.0022), col, uOn);               // apagada: cristal negro
      vec3 R = reflect(-vV, normalize(vN));
      float band = smoothstep(0.10, 0.0, abs(dot(R.xy, normalize(vec2(0.82, 0.57))) - uBand)) * 0.040;
      col += vec3(band + pow(max(dot(R, uLight), 0.0), 22.0) * 0.045 + pow(edge, 5.0) * 0.05);
      gl_FragColor = vec4(col, mask * uOp);
    }`,
});
const screen = new THREE.Mesh(new THREE.PlaneGeometry(SW, SH), screenMat);
screen.position.z = 0.003; screen.renderOrder = 2;
phoneOff.add(screen);

// ---------- tarjeta 3D: la misma pieza de la página, ahora con grosor y sombra ----------
const CR = man.cardRect;                                   // px CSS de la pantalla al despegar
const CW = CR.w / 100, CH = CR.h / 100, CRAD = 0.22;
const cardRest = new THREE.Vector3((CR.x + CR.w / 2 - 195) / 100, (422 - (CR.y + CR.h / 2)) / 100, 0.004);
const cardImg = await bitmap(CAP + 'card.png');
const cardFront = new THREE.ShaderMaterial({ transparent: true,
  uniforms: { uTex: { value: texFrom(cardImg) }, uSweep: { value: -1 }, uOp: { value: 1 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: /* glsl */`precision highp float; varying vec2 vUv; uniform sampler2D uTex; uniform float uSweep; uniform float uOp;
    void main(){ vec3 c = texture2D(uTex, vUv).rgb;
      float band = exp(-pow((vUv.x * 0.85 + vUv.y * 0.45 - uSweep) / 0.07, 2.0));
      c += vec3(1.0, 0.93, 0.82) * band * 0.30;
      gl_FragColor = vec4(c, uOp); }` });
const cardSide = new THREE.MeshMatcapMaterial({ matcap: matcapTex([[0, '#ffffff'], [0.35, '#f3efe6'], [0.75, '#cfc8ba'], [1, '#efeadf']]) });
const cardGeo = new THREE.ExtrudeGeometry(rrPath(new THREE.Shape(), CW, CH, CRAD), { depth: 0.06, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 3, curveSegments: 24 });
cardGeo.translate(0, 0, -0.072);
{ // UV de la cara frontal = rect de la pieza (textura con y hacia abajo)
  const pos = cardGeo.attributes.position, uv = cardGeo.attributes.uv, nor = cardGeo.attributes.normal;
  for (let i = 0; i < pos.count; i++) if (nor.getZ(i) > 0.9) uv.setXY(i, (pos.getX(i) + CW / 2) / CW, (CH / 2 - pos.getY(i)) / CH);
  uv.needsUpdate = true;
}
const card = new THREE.Mesh(cardGeo, [cardFront, cardSide]);
card.renderOrder = 6; card.visible = false;
phoneOff.add(card);
const shadowMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false,
  uniforms: { uHalf: { value: new THREE.Vector2(CW / 2, CH / 2) }, uR: { value: CRAD }, uSoft: { value: 0.1 }, uOp: { value: 0 } },
  vertexShader: 'varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `precision highp float; varying vec2 vP; uniform vec2 uHalf; uniform float uR; uniform float uSoft; uniform float uOp; ${SDRR}
    void main(){ float d = sdRR(vP, uHalf, uR); float a = 1.0 - smoothstep(-uSoft, uSoft * 1.6, d); gl_FragColor = vec4(0.0, 0.0, 0.0, a * uOp); }` });
const shadow = new THREE.Mesh(new THREE.PlaneGeometry(CW + 1.6, CH + 1.6), shadowMat);
shadow.renderOrder = 4; shadow.visible = false;
phoneOff.add(shadow);

// ---------- capa 2D (px de diseño, y hacia abajo) ----------
const over = new THREE.Scene();
const orthoPx = new THREE.OrthographicCamera(0, W, 0, -H, -10, 10);
// trazo líquido (contorno del celular, subrayado): cinta con perfil de grosor, brillo y borde
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
    this.mesh = new THREE.Mesh(g, this.mat); this.mesh.frustumCulled = false; this.mesh.visible = false;
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
const outlineTrail = new Ribbon(420);
const underTrail = new Ribbon(80);

// tipografía cinética: por glifo, stagger 26 ms (Poppins Bold, mayúsculas, tracking amplio)
const TX = { x: 64, y: 1080, w: 560, h: 330 };          // caja de texto en px de diseño (fuera del celular)
const KF = { size: 76, track: 0.05, lines: [1222, 1310] };
const tCan = document.createElement('canvas');
tCan.width = Math.round(TX.w * SCALE); tCan.height = Math.round(TX.h * SCALE);
const tCtx = tCan.getContext('2d');
const tTex = new THREE.CanvasTexture(tCan); tTex.colorSpace = THREE.SRGBColorSpace; tTex.minFilter = THREE.LinearFilter; tTex.generateMipmaps = false;
const tMesh = new THREE.Mesh(new THREE.PlaneGeometry(TX.w, TX.h), new THREE.MeshBasicMaterial({ map: tTex, transparent: true, depthTest: false, depthWrite: false, toneMapped: false }));
tMesh.position.set(TX.x + TX.w / 2, -(TX.y + TX.h / 2), 0); tMesh.renderOrder = 10;
over.add(tMesh);
const ADV = {};
tCtx.font = `700 ${KF.size}px Poppins`;
for (const wd of STYLE.KINETIC) for (const ch of wd.text) ADV[ch] = tCtx.measureText(ch).width;
const glyphW = (ch) => ADV[ch] + KF.size * KF.track;
const wordWidth = (w) => [...w].reduce((s, ch) => s + glyphW(ch), 0) - KF.size * KF.track;
function drawKinetic(t) {
  tCtx.setTransform(1, 0, 0, 1, 0, 0); tCtx.clearRect(0, 0, tCan.width, tCan.height);
  tCtx.setTransform(SCALE, 0, 0, SCALE, -TX.x * SCALE, -TX.y * SCALE);
  tCtx.font = `700 ${KF.size}px Poppins`; tCtx.textBaseline = 'alphabetic'; tCtx.fillStyle = '#F4F1EA';
  const out = prog(t, S.textOut);
  STYLE.KINETIC.forEach((wd, li) => {
    let x = TX.x;
    [...wd.text].forEach((ch, i) => {
      const k = easeOut(clamp((t - (wd.land - 0.10 + i * 0.026)) / 0.34));
      const ko = easeInOut(clamp((t - (S.textOut[0] + i * 0.012)) / (S.textOut[1] - S.textOut[0])));
      const a = k * (1 - ko);
      if (a > 0.003) { tCtx.globalAlpha = a; tCtx.fillText(ch, x, KF.lines[li] + (1 - k) * 30 - ko * 16); }
      x += glyphW(ch);
    });
  });
  tCtx.globalAlpha = 1;
  tTex.needsUpdate = true;
  tMesh.visible = out < 1 && t > STYLE.KINETIC[0].land - 0.2;
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
  // refracción: el fondo se ve invertido y aumentado dentro de la gota
  vec3 thru = texture2D(uScene, vUv + n2 * (R / uRes) * 0.65).rgb;
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

// ---------- geometría de la gota: contorno del celular en su espacio local ----------
const OUTLINE = (() => {
  const shape = rrPath(new THREE.Path(), BODY_W + 0.02, BODY_H + 0.02, BODY_R + 0.01);
  const raw = shape.getSpacedPoints(400);                 // arranca abajo a la izquierda (moveTo)
  // rotar el arranque al centro de arriba y recorrer en sentido horario visual
  let k0 = 0, best = Infinity;
  raw.forEach((p, i) => { const d = Math.abs(p.x) + Math.abs(p.y - (BODY_H / 2 + 0.01)); if (d < best) { best = d; k0 = i; } });
  const seq = raw.slice(k0).concat(raw.slice(1, k0 + 1));
  return seq.reverse();
})();
const v3 = new THREE.Vector3();
function toPx(obj, x, y, z) {
  v3.set(x, y, z).applyMatrix4(obj.matrixWorld).project(camera);
  return [(v3.x * 0.5 + 0.5) * W, (1 - (v3.y * 0.5 + 0.5)) * H];
}

// ---------- estado en el tiempo ----------
function phonePose(t) {
  const kS = spring(prog(t, S.settle), 0.72, 7.2);
  const kA = easeInOut(prog(t, S.camShift)), kB = easeInOut(prog(t, S.camBack));
  const k = kA * (1 - kB);
  return {
    x: lerp(0.5, 0.67, k), y: 0.47, h: lerp(lerp(0.62, 0.66, kS), 0.60, k),
    rotY: lerp(12, 0, kS) + lerp(0, -7, k) + 1.1 * Math.sin(t * 0.9 + 0.4),
    rotX: lerp(-5, 0, kS) + 0.55 * Math.sin(t * 0.7 + 1.0),
    rotZ: lerp(-2.5, 0, kS),
  };
}
function cardPose(t) {
  const up = spring(prog(t, S.lift), 0.74, 7.0);
  const down = spring(prog(t, S.back), 0.86, 8.4);
  const k = up * (1 - down);
  const bob = t > S.lift[1] && t < S.back[1] ? Math.sin((t - S.lift[1]) * 5.4) * (1 - prog(t, S.back)) : 0;
  return {
    k,
    pos: new THREE.Vector3(cardRest.x + lerp(0, -1.30, k), cardRest.y + lerp(0, 0.66, k) + bob * 0.05, cardRest.z + lerp(0, 2.05, k)),
    rot: new THREE.Euler(lerp(0, -9, k) * deg, (lerp(0, 25, k) + bob * 1.8) * deg, lerp(0, 3.2, k) * deg),
  };
}
const ballR = 25, headR0 = 18;
function dropState(t) {
  // regresa: [x, y] px de diseño de la gota, radio, si se ve, y los trazos
  const pRest = () => { const p = toPx(phoneOff, 0, BODY_H / 2 + 0.01, 0.02); return [p[0], p[1] - ballR * 0.62]; };
  const cardPt = () => { card.updateMatrixWorld(true); return toPx(card, CW / 2 - 0.34, CH / 2 - 0.30, 0.0); };
  const U0 = [TX.x + 2, KF.lines[1] + 26], U1 = [TX.x + wordWidth('DE YUCA') + 2, KF.lines[1] + 26];
  let pos, r = ballR, vis = 1;
  const pO = easeInOut(prog(t, S.outline));
  if (t < S.outline[0]) pos = pRest();
  else if (t < S.outline[1]) {
    const i = Math.min(OUTLINE.length - 1, Math.floor(pO * (OUTLINE.length - 1)));
    const p = OUTLINE[i]; pos = toPx(phoneOff, p.x, p.y, 0.02); r = headR0;
  } else if (t < S.hop[0]) pos = pRest();
  else if (t < S.slide[0]) {
    const k = prog(t, S.hop), e = easeInOut(k);
    const a = pRest(), b = cardPt();
    pos = t < S.hop[1] ? [lerp(a[0], b[0], e), lerp(a[1], b[1], e) - 150 * 4 * k * (1 - k)] : b;
  } else if (t < S.underline[0]) {
    const k = prog(t, S.slide), e = easeInOut(k);
    const a = cardPt();
    pos = [lerp(a[0], U0[0], e), lerp(a[1], U0[1], e) - 70 * 4 * k * (1 - k)];
  } else {
    const e = easeInOut(prog(t, S.underline));
    pos = [lerp(U0[0], U1[0], e), U0[1]];
  }
  // al final se encoge dentro del trazo
  const fade = prog(t, S.textOut);
  r *= 1 - fade * 0.85; if (fade >= 1) vis = 0;
  // contorno: crece con la gota; se desvanece mientras aparece el cristal
  let outlinePts = null, outlineOp = 0;
  if (t >= S.outline[0]) {
    const n = Math.max(2, Math.floor(pO * (OUTLINE.length - 1)));
    outlinePts = OUTLINE.slice(0, n + 1).map((p) => toPx(phoneOff, p.x, p.y, 0.02));
    outlineOp = 1 - smoothstep01(prog(t, [S.phoneIn[0] + 0.12, S.phoneIn[1] + 0.25]));
  }
  let underPts = null, underOp = 0;
  if (t >= S.underline[0]) {
    const e = easeInOut(prog(t, S.underline));
    const n = 40, xEnd = lerp(U0[0], U1[0], e);
    underPts = Array.from({ length: n }, (_, i) => [lerp(U0[0], xEnd, i / (n - 1)), U0[1]]);
    underOp = 1 - prog(t, S.textOut);
  }
  // reposo: antes de empezar, entre el contorno y el rebote, y montada en la tarjeta
  const rest = Math.max(1 - prog(t, [S.outline[0] - 0.04, S.outline[0] + 0.06]) * (t < S.outline[1] ? 1 : 0),
    t > S.outline[1] && t < S.hop[0] ? prog(t, [S.outline[1], S.outline[1] + 0.18]) * (1 - prog(t, [S.hop[0] - 0.04, S.hop[0] + 0.04])) : 0,
    t >= S.hop[1] && t < S.slide[0] ? prog(t, [S.hop[1], S.hop[1] + 0.06]) : 0,
    t >= S.underline[1] ? prog(t, [S.underline[1], S.underline[1] + 0.12]) : 0);
  return { pos, r, vis, outlinePts, outlineOp, underPts, underOp, rest };
}
const smoothstep01 = (k) => k * k * (3 - 2 * k);

const prevPos = { t: null, p: null };
function frameState(t) {
  // celular
  const P = phonePose(t);
  const sc = (P.h * H) / (BODY_H * PXU);
  phoneRoot.position.set((P.x * W - W / 2) / PXU, (H / 2 - P.y * H) / PXU, 0);
  phoneRoot.scale.setScalar(sc);
  phoneRoot.rotation.set(P.rotX * deg, P.rotY * deg, P.rotZ * deg);
  phoneRoot.updateMatrixWorld(true);
  const band = 0.10 + 0.22 * Math.sin(t * 0.55) + P.rotY * 0.012;
  glassMat.uniforms.uOp.value = easeInOut(prog(t, S.phoneIn));
  phoneShadowMat.uniforms.uOp.value = 0.55 * easeInOut(prog(t, S.phoneIn));
  glassMat.uniforms.uBand.value = band;
  screenMat.uniforms.uBand.value = band;
  screenMat.uniforms.uOp.value = easeInOut(prog(t, [S.phoneIn[0] + 0.08, S.phoneIn[1]]));
  screenMat.uniforms.uOn.value = easeOut(prog(t, [S.screenOn, S.screenOn + 0.22]));
  backdrop.mat.uniforms.uT.value = t;
  backdrop.mat.uniforms.uPar.value.set(-(P.x - 0.5) * 0.15 + P.rotY * 0.002, 0);
  // tarjeta (se ve en 3D exactamente mientras la página la tiene oculta)
  const pf = Math.round(t * man.fps);
  const hidden = pf >= Math.ceil(S.lift[0] * man.fps - 1e-9) && pf < Math.ceil(S.back[1] * man.fps - 1e-9);
  const C = cardPose(t);
  card.visible = hidden; shadow.visible = hidden;
  card.position.copy(C.pos); card.rotation.copy(C.rot);
  const z = C.pos.z - cardRest.z;
  shadow.position.set(C.pos.x + z * 0.16, C.pos.y - z * 0.26, 0.0045);
  shadow.scale.setScalar(1 + z * 0.05);
  shadowMat.uniforms.uSoft.value = 0.03 + z * 0.16;
  shadowMat.uniforms.uOp.value = hidden ? clamp(z * 1.2, 0, 1) * lerp(0.42, 0.26, clamp(z / 2.05, 0, 1)) : 0;
  cardFront.uniforms.uSweep.value = lerp(-0.4, 1.6, easeInOut(prog(t, S.glint)));
  // página en pantalla
  const page = pageTex.get(clamp(pf, 0, man.frames.length - 1));
  if (page) screenMat.uniforms.uPage.value = page;
  // gota y trazos
  const D = dropState(t);
  let sx = 1, sy = 1, ang = 0;
  if (prevPos.t !== null && Math.abs(t - prevPos.t) > 1e-6 && prevPos.p) {
    const vx = (D.pos[0] - prevPos.p[0]) / (t - prevPos.t), vy = (D.pos[1] - prevPos.p[1]) / (t - prevPos.t);
    const sp = Math.hypot(vx, vy);
    const st = Math.min(0.55, sp / 5200);
    sx = 1 + st; sy = 1 / Math.sqrt(1 + st); ang = -Math.atan2(vy, vx);
  }
  prevPos.t = t; prevPos.p = D.pos;
  const B = liquid.mat.uniforms.uBall.value;
  B[0].set(D.pos[0] * SCALE, (H - D.pos[1]) * SCALE, D.r * SCALE, D.vis);
  B[1].set(0, 0, 0, 0); B[2].set(0, 0, 0, 0);
  const resting = D.rest || 0;
  if (resting > 0) {                     // gota sésil: más ancha que alta, apoyada en su base
    sx = lerp(sx, 1.16, resting); sy = lerp(sy, 0.84, resting); ang = lerp(ang, 0, resting);
    B[0].y -= ballR * SCALE * 0.10 * resting;
  }
  liquid.mat.uniforms.uSq.value.set(ang, sx, sy);
  outlineTrail.set(D.outlinePts || [], 4.4, D.outlineOp);
  underTrail.set(D.underPts || [], 5.4, D.underOp);
  drawKinetic(t);
}

// ---------- texturas de la página por cuadro ----------
const pageTex = new Map();
async function preparePages(f) {
  const need = new Set();
  for (let k = 0; k < SUBS; k++) {
    const t = f / FPS + (-0.5 + (k + 0.5) / SUBS) * (0.5 / FPS);
    need.add(clamp(Math.round(t * man.fps), 0, man.frames.length - 1));
  }
  for (const i of need) if (!pageTex.has(i)) pageTex.set(i, texFrom(await bitmap(CAP + 'frames/' + man.frames[i].file)));
  for (const [i, tex] of [...pageTex]) if (!need.has(i)) { tex.dispose(); pageTex.delete(i); }
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
window.compositorInfo = { W, H, RW, RH, SUBS, FPS, frames: Math.round(STYLE.DUR * FPS) };
window.ready = true;
