// Compositor determinista frame(t) del video de Patissier. Three.js sobre WebGL2 por software.
// Un solo plano continuo: una cámara, un campo líquido y una cinta que es siempre la misma malla.
// 8 subcuadros por cuadro (obturador de 180°) acumulados en flotante = motion blur real + antialias.
// API: window.renderFrame(f) deja el cuadro f en el canvas.
import * as THREE from './vendor/three.module.js';
import { RoomEnvironment } from './vendor/RoomEnvironment.js';
import * as TL from '../timeline/timeline.mjs';
import { Ribbon, NP, resample, bowOnBox, phoneFrame } from './ribbon.mjs';

const { T, clamp, lerp, prog, smooth, easeOut, easeIn, easeInOut, spring } = TL;
const qs = new URLSearchParams(location.search);
const SCALE = Number(qs.get('scale') || 1), SUBS = Number(qs.get('subs') || 8);
const W = 1080, H = 1920, RW = Math.round(W * SCALE), RH = Math.round(H * SCALE);
const CAP = '../../build/capture/';
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const deg = Math.PI / 180;

// ---------- arranque ----------
const canvas = document.createElement('canvas'); canvas.width = RW; canvas.height = RH; document.body.appendChild(canvas);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true, alpha: false });
renderer.setPixelRatio(1); renderer.setSize(RW, RH, false); renderer.autoClear = false; renderer.toneMapping = THREE.NoToneMapping;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const man = await fetch(CAP + 'manifest.json').then((r) => r.json());
for (const [fam, file, weight] of [['Merienda', 'merienda-latin-800-normal.woff2', '800'], ['Merienda', 'merienda-latin-700-normal.woff2', '700'], ['DM Sans', 'dm-sans-latin-600-normal.woff2', '600']])
  document.fonts.add(await new FontFace(fam, `url(../../site/fonts/${file})`, { weight }).load());

const rtOpts = { type: THREE.HalfFloatType, colorSpace: THREE.LinearSRGBColorSpace };
const rtScene = new THREE.WebGLRenderTarget(RW, RH, { ...rtOpts, depthBuffer: true });
const rtBack = new THREE.WebGLRenderTarget(RW >> 1, RH >> 1, { ...rtOpts, depthBuffer: false });
const rtAcc = new THREE.WebGLRenderTarget(RW, RH, { ...rtOpts, depthBuffer: false });
const quadGeo = new THREE.PlaneGeometry(2, 2), orthoNDC = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
function fsPass(frag, uniforms, extra = {}) {
  const mat = new THREE.ShaderMaterial({ uniforms, depthTest: false, depthWrite: false, ...extra,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }', fragmentShader: frag });
  const mesh = new THREE.Mesh(quadGeo, mat); mesh.frustumCulled = false; const scene = new THREE.Scene(); scene.add(mesh);
  return { scene, mat };
}
const copyPass = fsPass('precision highp float; varying vec2 vUv; uniform sampler2D uSrc; void main(){ gl_FragColor = vec4(texture2D(uSrc, vUv).rgb, 1.0); }', { uSrc: { value: null } });
const accPass = fsPass('precision highp float; varying vec2 vUv; uniform sampler2D uSrc; uniform float uW; void main(){ gl_FragColor = vec4(texture2D(uSrc, vUv).rgb * uW, 1.0); }',
  { uSrc: { value: null }, uW: { value: 1 } }, { blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, transparent: true });
const finalPass = fsPass(/* glsl */`
precision highp float; varying vec2 vUv; uniform sampler2D uSrc; uniform float uFrame;
float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233)) + uFrame * 0.37) * 43758.5453); }
vec3 enc(vec3 c){ c = clamp(c, 0.0, 1.0); return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
void main(){
  vec3 c = texture2D(uSrc, vUv).rgb;
  c = c / (1.0 + 0.10 * max(c - 0.75, 0.0));                    // rodilla suave en los blancos
  vec2 q = vUv - 0.5; c *= 1.0 - 0.26 * smoothstep(0.35, 0.95, length(q * vec2(0.9, 1.0)));
  vec3 o = enc(c);
  o += (h(gl_FragCoord.xy) - 0.5) * 0.014;                       // grano fino y tramado
  gl_FragColor = vec4(o, 1.0);
}`, { uSrc: { value: rtAcc.texture }, uFrame: { value: 0 } });

// ---------- campo líquido (uno solo para toda la pieza) ----------
const NR = 6;
const field = fsPass(/* glsl */`
precision highp float; varying vec2 vUv;
uniform float uT, uAspect; uniform vec2 uShift; uniform vec4 uRip[${NR}];
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
float fbm(vec2 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 3; i++){ s += a * noise(p); p = p * 2.03 + 17.1; a *= 0.5; } return s; }
float height(vec2 p){
  vec2 q = p * 0.62 + uShift;
  vec2 w = vec2(fbm(q + vec2(0.0, uT * 0.045)), fbm(q + vec2(5.2, 1.3) - uT * 0.035));
  float hh = fbm(q + 2.1 * w + vec2(uT * 0.02, 0.0));
  for (int i = 0; i < ${NR}; i++){
    float age = uT - uRip[i].z; if (age < 0.0 || age > 4.0) continue;
    float r = length(p - uRip[i].xy), front = age * 1.25;
    hh += uRip[i].w * sin(26.0 * (r - front)) * exp(-pow((r - front) * 3.0, 2.0)) * exp(-age * 1.5);
  }
  return hh;
}
void main(){
  vec2 p = (vUv - 0.5) * vec2(uAspect, 1.0) * 2.0;
  float e = 0.03, h0 = height(p), hx = height(p + vec2(e, 0.0)), hy = height(p + vec2(0.0, e));
  vec3 n = normalize(vec3(-(hx - h0) / e * 0.30, -(hy - h0) / e * 0.30, 1.0));
  vec3 L = normalize(vec3(-0.55, 0.62, 0.56));
  float lamp = smoothstep(1.9, 0.0, length(p - vec2(-0.62, 1.05)));            // luz suave arriba a la izquierda
  vec3 c0 = vec3(0.0030, 0.0023, 0.0018), c1 = vec3(0.0110, 0.0070, 0.0050);   // #0B0907 -> #1B1410 (lineal)
  vec3 col = mix(c0, c1, lamp) * (0.55 + 1.5 * smoothstep(0.25, 0.85, h0));
  col *= 0.55 + 0.9 * max(dot(n, L), 0.0);
  float sp = pow(max(dot(reflect(-L, n), vec3(0.0, 0.0, 1.0)), 0.0), 16.0);
  col += vec3(0.050, 0.030, 0.021) * sp * (0.35 + 0.9 * lamp);
  gl_FragColor = vec4(col, 1.0);
}`, { uT: { value: 0 }, uAspect: { value: W / H }, uShift: { value: new THREE.Vector2() }, uRip: { value: Array.from({ length: NR }, () => new THREE.Vector4(0, 0, -99, 0)) } });

// ---------- escena 3D ----------
const scene = new THREE.Scene();
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(renderer), 0.04).texture;
const key = new THREE.DirectionalLight(0xfff1e2, 2.5); key.position.set(-5.2, 7.2, 6.0); key.castShadow = true;
key.shadow.mapSize.set(1536, 1536); key.shadow.radius = 5; key.shadow.bias = -0.0006; key.shadow.normalBias = 0.02;
Object.assign(key.shadow.camera, { left: -5, right: 5, top: 5, bottom: -5, near: 1, far: 30 }); scene.add(key); scene.add(key.target);
const FOV = 16, FPX = (H / 2) / Math.tan((FOV / 2) * deg);                   // focal en px de diseño
const camera = new THREE.PerspectiveCamera(FOV, W / H, 1, 200);

// caja blanca de pastel (isométrico real: guiñada 45°, elevación 35.26°)
const BOX = { bw: 3.4, bh: 1.55, bd: 3.4 };
function roundedBox(w, h, d, r, bev) {
  const s = new THREE.Shape(), x = w / 2 - bev, y = d / 2 - bev, rr = Math.max(r - bev, 0.01);
  s.moveTo(-x + rr, -y); s.lineTo(x - rr, -y); s.absarc(x - rr, -y + rr, rr, -Math.PI / 2, 0); s.lineTo(x, y - rr); s.absarc(x - rr, y - rr, rr, 0, Math.PI / 2);
  s.lineTo(-x + rr, y); s.absarc(-x + rr, y - rr, rr, Math.PI / 2, Math.PI); s.lineTo(-x, -y + rr); s.absarc(-x + rr, -y + rr, rr, Math.PI, Math.PI * 1.5);
  const g = new THREE.ExtrudeGeometry(s, { depth: h - 2 * bev, bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelSegments: 4, curveSegments: 8 });
  g.translate(0, 0, -(h - 2 * bev) / 2); g.rotateX(-Math.PI / 2); return g;
}
const boxRig = new THREE.Group(); scene.add(boxRig);                         // posición en el mundo
const boxIso = new THREE.Group(); boxIso.rotation.set(35.264 * deg, 45 * deg, 0, 'XYZ'); boxRig.add(boxIso);
const boxBody = new THREE.Group(); boxIso.add(boxBody);
const card = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.86, metalness: 0, envMapIntensity: 0.55 });
const LIDH = 0.46;
const base = new THREE.Mesh(roundedBox(BOX.bw - 0.07, BOX.bh - 0.02, BOX.bd - 0.07, 0.07, 0.025), card(0xE9E1D6)); base.position.y = -0.01;
const lid = new THREE.Mesh(roundedBox(BOX.bw, LIDH, BOX.bd, 0.09, 0.03), card(0xF6F1EA)); lid.position.y = BOX.bh / 2 - LIDH / 2;
for (const m of [base, lid]) { m.castShadow = true; m.receiveShadow = true; boxBody.add(m); }
// sombra de contacto en el piso (se abre y se aclara cuando la caja está en el aire)
const groundShadow = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), new THREE.ShaderMaterial({ transparent: true, depthWrite: false,
  uniforms: { uLift: { value: 0 } }, vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: /* glsl */`precision highp float; varying vec2 vUv; uniform float uLift;
    float box(vec2 p, vec2 b, float r){ vec2 d = abs(p) - b + r; return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0) - r; }
    void main(){ vec2 p = (vUv - 0.5) * 12.0 - vec2(0.18 + 0.5 * uLift, -0.42 - 0.9 * uLift);
      float d = box(p, vec2(1.7), 0.1), soft = 0.42 + 1.5 * uLift;
      float a = (1.0 - smoothstep(-soft * 0.55, soft, d)) * 0.80 / (1.0 + 1.3 * uLift);
      a += (1.0 - smoothstep(-0.05, 0.16, d)) * 0.35 * (1.0 - smoothstep(0.0, 0.35, uLift));
      gl_FragColor = vec4(0.0, 0.0, 0.0, clamp(a, 0.0, 0.95)); }` }));
groundShadow.rotation.x = -Math.PI / 2; groundShadow.position.y = -BOX.bh / 2 - 0.02; groundShadow.renderOrder = -5; boxIso.add(groundShadow);

// cinta
const ribbon = new Ribbon(); scene.add(ribbon.mesh);
const knotGeo = new THREE.SphereGeometry(1, 28, 18);
knotGeo.setAttribute('aTan', new THREE.BufferAttribute(new Float32Array(knotGeo.attributes.position.count * 3).map((_, i) => [0.7071, 0, 0.7071][i % 3]), 3));
const knot = new THREE.Mesh(knotGeo, ribbon.mat); knot.castShadow = true; knot.position.set(0, BOX.bh / 2 + 0.17, 0); knot.rotation.y = -45 * deg; boxBody.add(knot);
const bowCache = new Map();
const bowLocal = (loop, lift) => { const k = `${loop.toFixed(3)}_${lift.toFixed(3)}`; let v = bowCache.get(k);
  if (!v) { v = resample(bowOnBox(BOX, loop, lift)); if (bowCache.size > 600) bowCache.clear(); bowCache.set(k, v); } return v; };
const LR = bowLocal(1, 1).len;                                               // longitud de la cinta
// teléfono: la cinta, de canto, ES el marco. Pantalla 390x844 pt = 3.90 x 8.44 u.
const SW = 3.9, SH = 8.44, SR = 0.47, FR_HX = SW / 2 + 0.075, FR_HY = SH / 2 + 0.075, FR_R = SR + 0.075;
const frameLocal = resample(phoneFrame(FR_HX, FR_HY, FR_R));
const phone = new THREE.Group(); scene.add(phone);
const screenMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: true,
  uniforms: { uTex: { value: null }, uHalf: { value: new THREE.Vector2(SW / 2, SH / 2) }, uR: { value: SR }, uMorph: { value: 0 }, uGrow: { value: 0 },
    uBow: { value: new THREE.Vector2(0, 0) }, uTilt: { value: new THREE.Vector2() }, uBlur: { value: 0 }, uPx: { value: 0.005 } },
  vertexShader: 'varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: /* glsl */`
    precision highp float; varying vec2 vP; uniform sampler2D uTex; uniform vec2 uHalf, uBow, uTilt; uniform float uR, uMorph, uGrow, uBlur, uPx;
    float sdRect(vec2 p){ vec2 d = abs(p) - uHalf + uR; return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0) - uR; }
    float sdEll(vec2 p, vec2 ab){ float k = length(p / ab); return (k - 1.0) * min(ab.x, ab.y); }
    float smin(float a, float b, float k){ float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0); return mix(b, a, h) - k * h * (1.0 - h); }
    vec2 rot(vec2 p, float a){ float c = cos(a), s = sin(a); return vec2(c * p.x - s * p.y, s * p.x + c * p.y); }
    // silueta del moño: dos lazos y el nudo (campo de distancia analítico)
    float sdBow(vec2 p){ p -= uBow; float l = sdEll(rot(p - vec2(-0.95, 0.06), -0.16), vec2(0.98, 0.50)), r = sdEll(rot(p - vec2(0.95, 0.06), 0.16), vec2(0.98, 0.50));
      return smin(smin(l, r, 0.3), length(p) - 0.36, 0.3); }
    float shape(vec2 p){ return mix(sdBow(p), sdRect(p), uMorph) + (1.0 - uGrow) * 1.5; }
    void main(){
      float d = shape(vP), aa = uPx * 1.2;
      if (d > aa) discard;
      vec2 g = normalize(vec2(shape(vP + vec2(0.01, 0.0)) - d, shape(vP + vec2(0.0, 0.01)) - d) + 1e-6);
      float edge = smoothstep(0.11, 0.0, -d);                                   // 1 en el canto del cristal
      vec2 q = vP - g * edge * edge * 0.06;                                    // refracción: el canto dobla la imagen hacia adentro
      vec2 uv = vec2(q.x / (2.0 * uHalf.x) + 0.5, 0.5 - q.y / (2.0 * uHalf.y));
      vec3 col = vec3(0.0);
      if (uBlur > 0.0005) { for (int i = 0; i < 9; i++) { float k = (float(i) / 8.0 - 0.5); col += texture2D(uTex, clamp(uv + vec2(0.0, k * uBlur), 0.0, 1.0)).rgb; } col /= 9.0; }
      else col = texture2D(uTex, clamp(uv, 0.0, 1.0)).rgb;
      col *= 1.0 - 0.45 * smoothstep(0.10, 0.0, -d);                            // el contenido vive debajo del cristal
      // cristal: filo biselado iluminado desde arriba-izquierda y un reflejo ancho que se mueve con el giro
      float rim = smoothstep(0.045, 0.012, -d) * smoothstep(0.0, 0.012, -d + 0.004);
      float lit = pow(max(dot(g, normalize(vec2(-0.6, 0.8))), 0.0), 1.5), under = pow(max(dot(g, normalize(vec2(0.6, -0.8))), 0.0), 3.0);
      col += vec3(1.0, 0.93, 0.86) * rim * (0.05 + 0.55 * lit + 0.12 * under);
      float band = vP.x * 0.55 + vP.y * 0.32 + uTilt.x * 9.0 - 0.6;
      col += vec3(1.0, 0.95, 0.9) * 0.035 * exp(-band * band * 1.6) + vec3(1.0, 0.95, 0.9) * 0.02 * exp(-pow(band - 1.4, 2.0) * 9.0);
      gl_FragColor = vec4(col, 1.0 - smoothstep(-aa, aa, d));
    }` });
const screenMesh = new THREE.Mesh(new THREE.PlaneGeometry(SW + 0.4, SH + 0.4), screenMat); screenMesh.position.z = 0.13; phone.add(screenMesh);
const phoneShadow = new THREE.Mesh(new THREE.PlaneGeometry(SW + 6, SH + 6), new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { uA: { value: 0 }, uHalf: { value: new THREE.Vector2(FR_HX, FR_HY) } },
  vertexShader: 'varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: /* glsl */`precision highp float; varying vec2 vP; uniform float uA; uniform vec2 uHalf;
    void main(){ vec2 d = abs(vP) - uHalf + 0.6; float s = length(max(d, 0.0)) + min(max(d.x, d.y), 0.0) - 0.6;
      gl_FragColor = vec4(0.0, 0.0, 0.0, uA * (0.62 * (1.0 - smoothstep(-0.7, 1.5, s)) + 0.25 * (1.0 - smoothstep(-0.1, 0.3, s)))); }` }));
phoneShadow.position.set(0.42, -0.62, -1.3); phoneShadow.renderOrder = -4; phone.add(phoneShadow);

// ---------- capa 2D: tipografía cinética por glifo (px de diseño, y hacia abajo) ----------
const over = new THREE.Scene(), orthoPx = new THREE.OrthographicCamera(0, W, 0, -H, -10, 10);
const TY0 = 0, TYH = H;                                                    // franja de texto (dentro de la zona segura)
const tcan = document.createElement('canvas'); tcan.width = RW; tcan.height = Math.round(TYH * SCALE);
const tctx = tcan.getContext('2d'), ttex = new THREE.CanvasTexture(tcan); ttex.colorSpace = THREE.SRGBColorSpace; ttex.minFilter = THREE.LinearFilter; ttex.generateMipmaps = false;
const tmesh = new THREE.Mesh(new THREE.PlaneGeometry(W, TYH), new THREE.MeshBasicMaterial({ map: ttex, transparent: true, depthTest: false, depthWrite: false, premultipliedAlpha: true, toneMapped: false }));
ttex.premultiplyAlpha = true; tmesh.position.set(W / 2, -(TY0 + TYH / 2), 0); tmesh.frustumCulled = false; over.add(tmesh);
const CREAM = '#F4ECE2', ROSE = '#FFB5B0';
function glyphs(text, font, size, x, baseline) { tctx.font = `${font} ${size}px Merienda`; const out = []; let cx = x; const chars = [...text];
  chars.forEach((ch, i) => { const w = tctx.measureText(ch).width, adv = tctx.measureText(chars.slice(0, i + 1).join('')).width - tctx.measureText(chars.slice(0, i).join('')).width;
    out.push({ ch, x: cx + adv / 2, y: baseline, w, size, font }); cx += adv; }); out.width = cx - x; return out; }
const wOf = (text, font, size) => { tctx.font = `${font} ${size}px Merienda`; return tctx.measureText(text).width; };
const w20 = wOf('20', 800, 330), wAn = wOf('AÑOS', 800, 150), gap = 34, x0 = (W - (w20 + gap + wAn)) / 2;
const G20 = glyphs('20', 800, 330, x0, 640), GAN = glyphs('AÑOS', 800, 150, x0 + w20 + gap, 640);
let textOn = false;
function drawText(t, shiftPx) {
  const live = t > T.t20 - 0.22 && t < T.untie[1];
  if (!live) { if (textOn) { tmesh.visible = false; textOn = false; } return; }
  textOn = true; tmesh.visible = true;
  tctx.setTransform(1, 0, 0, 1, 0, 0); tctx.clearRect(0, 0, tcan.width, tcan.height); tctx.setTransform(SCALE, 0, 0, SCALE, 0, -TY0 * SCALE);
  tctx.textAlign = 'center'; tctx.textBaseline = 'alphabetic';
  const put = (g, dx, dy, sc, rot, a, color) => { if (a <= 0.002) return; tctx.save(); tctx.globalAlpha = Math.min(1, a); tctx.translate(g.x + dx, g.y + dy + shiftPx); tctx.rotate(rot);
    tctx.scale(sc, sc); tctx.font = `${g.font} ${g.size}px Merienda`; tctx.fillStyle = color; tctx.fillText(g.ch, 0, 0); tctx.restore(); };
  // "20": cada cifra cae desde la cámara y asienta con resorte (aterriza en "veinte")
  G20.forEach((g, i) => { const x = (t - (T.t20 - 0.15) - i * 0.034) / 0.15; if (x <= 0) return;
    const land = easeIn(clamp(x), 2), s = spring(Math.max(0, x - 1) * 0.15 + 1e-6, 3.2, 0.36);
    const sc = x < 1 ? lerp(2.7, 0.9, land) : 0.9 + 0.1 * s;
    put(g, 0, x < 1 ? lerp(-150, 0, land) - (g.size * 0.33) * (sc - 1) : 0, sc, x < 1 ? lerp(i ? 0.22 : -0.22, 0, land) : 0, clamp(x * 5), CREAM); });
  // "AÑOS": sube letra por letra desde abajo con giro (aterriza en "años")
  GAN.forEach((g, i) => { const x = (t - (T.tAnos - 0.2) - i * 0.03) / 0.2; if (x <= 0) return;
    const k = x < 1 ? easeOut(x, 3) : 1, s = x >= 1 ? spring((x - 1) * 0.2 + 1e-6, 3.4, 0.4) : 0;
    put(g, 0, lerp(120, -14, k) + 14 * s, 1, lerp(i % 2 ? 0.5 : -0.5, 0, k), clamp(x * 4), ROSE); });
  ttex.needsUpdate = true;
}

// ---------- texturas de la página ----------
const texCache = new Map(), capFrames = Object.keys(man.frames).map(Number).sort((a, b) => a - b);
const capFor = (f) => man.frames[clamp(f, capFrames[0], capFrames[capFrames.length - 1])];
async function pageTex(file) {
  if (!texCache.has(file)) { const bmp = await createImageBitmap(await (await fetch(CAP + file)).blob());
    const tx = new THREE.Texture(bmp); tx.colorSpace = THREE.SRGBColorSpace; tx.generateMipmaps = true; tx.minFilter = THREE.LinearMipmapLinearFilter; tx.anisotropy = 4; tx.needsUpdate = true; texCache.set(file, tx);
    if (texCache.size > 6) { const k = texCache.keys().next().value; texCache.get(k).dispose(); texCache.delete(k); } }
  return texCache.get(file);
}

// ---------- estado en el tiempo ----------
const ppuAt = (t) => lerp(150, 205, easeInOut(prog(t, [T.untie[0], T.untie[1] + 0.1]), 2.4));
// al soltarse el moño la cámara sube con la cinta: toda la primera escena cae fuera de cuadro
const sceneDrop = (t) => 17 * easeIn(prog(t, [T.untie[0] + 0.04, T.untie[0] + 0.66]), 2.3);
function boxState(t) {
  const fall = prog(t, [T.boxIn[0], T.boxIn[0] + 0.30]), y = 13 * (1 - easeIn(fall, 2.1));
  const tl = t - (T.boxIn[0] + 0.30);                                           // desde el contacto
  const squash = tl > 0 ? 0.11 * Math.exp(-tl * 9) * Math.cos(tl * 30) : 0, hop = tl > 0 ? 0.20 * Math.exp(-tl * 6.5) * Math.abs(Math.sin(tl * 15)) : 0;
  return { y: y + hop, squash, spin: (1 - easeOut(prog(t, [T.boxIn[0], T.boxIn[0] + 0.5]), 3)) * -0.9, landT: T.boxIn[0] + 0.30 };
}
function phoneState(t) {
  const x = (t - (T.untie[0] + 0.22)) / 1.0, s = spring(x, 1.15, 0.5);
  return { yaw: (1 - s) * 0.62 + 0.035 * Math.sin(t * 0.8), pitch: (1 - s) * -0.34 + 0.025 * Math.sin(t * 0.63 + 1), roll: (1 - s) * 0.10, z: (1 - s) * -1.2 };
}
const tmpM = new THREE.Matrix4(), tmpV = V(0, 0, 0), tmpN = new THREE.Matrix3();
function xform(src, mat, P, B) {                                               // muestreo local -> mundo
  tmpN.setFromMatrix4(mat);
  for (let i = 0; i < NP; i++) { const o = i * 3; tmpV.set(src.P[o], src.P[o + 1], src.P[o + 2]).applyMatrix4(mat); P[o] = tmpV.x; P[o + 1] = tmpV.y; P[o + 2] = tmpV.z;
    tmpV.set(src.B[o], src.B[o + 1], src.B[o + 2]).applyMatrix3(tmpN).normalize(); B[o] = tmpV.x; B[o + 1] = tmpV.y; B[o + 2] = tmpV.z; }
}
const A = () => ({ P: new Float32Array(NP * 3), B: new Float32Array(NP * 3) });
const bowW = A(), frmW = A(), cur = A();
// entrada: recta que cruza el cuadro, vuelta fuera de cuadro y bajada hasta la primera punta del moño
const LEAD_N = 260, lead = { P: new Float32Array(LEAD_N * 3), L: new Float32Array(LEAD_N), len: 0 };
const STRAIGHT = 44;
function buildLead(tipP, tipDir) {
  const a = V(-STRAIGHT + 7.5, 0.9, 3.0), s1 = V(7.5, -0.5, 3.0), s2 = V(6.2, 8.6, 3.4);
  const c1 = V(15.5, -1.1, 3.0), c2 = V(15.0, 9.5, 3.6), c3 = V(1.8, 8.0, 3.0), c4 = tipP.clone().addScaledVector(tipDir, -3.2);
  const nS = 110, nA = 70, nB = LEAD_N - nS - nA, p = V(0, 0, 0); let k = 0;
  const put = () => { lead.P[k * 3] = p.x; lead.P[k * 3 + 1] = p.y; lead.P[k * 3 + 2] = p.z; k++; };
  for (let i = 0; i < nS; i++) { p.copy(a).lerp(s1, i / nS); put(); }
  const bz = (p0, p1, p2, p3, n, endIncl) => { for (let i = 0; i < n; i++) { const t = i / (endIncl ? n - 1 : n), u = 1 - t;
    p.set(0, 0, 0).addScaledVector(p0, u * u * u).addScaledVector(p1, 3 * u * u * t).addScaledVector(p2, 3 * u * t * t).addScaledVector(p3, t * t * t); put(); } };
  bz(s1, c1, c2, s2, nA, false); bz(s2, c3, c4, tipP, nB, true);
  lead.L[0] = 0; for (let i = 1; i < LEAD_N; i++) lead.L[i] = lead.L[i - 1] + Math.hypot(lead.P[i * 3] - lead.P[i * 3 - 3], lead.P[i * 3 + 1] - lead.P[i * 3 - 2], lead.P[i * 3 + 2] - lead.P[i * 3 - 1]);
  lead.len = lead.L[LEAD_N - 1];
}
const HEAD0 = STRAIGHT - 7.5 - 4.2;                                           // la punta arranca justo fuera del borde izquierdo
function ribbonState(t) {
  const bs = boxState(t), drop = sceneDrop(t);
  // caja
  boxRig.position.set(0, -1.15 + bs.y - drop, 0); boxIso.rotation.y = 45 * deg + bs.spin;
  boxBody.scale.set(1 + bs.squash * 0.5, 1 - bs.squash, 1 + bs.squash * 0.5); boxBody.position.y = -bs.squash * BOX.bh / 2;
  groundShadow.position.y = -BOX.bh / 2 - 0.02 - bs.y * 0.82; groundShadow.material.uniforms.uLift.value = bs.y;
  boxRig.visible = drop < 16.5 && t > T.boxIn[0] - 0.02;
  boxRig.updateMatrixWorld(true);
  // moño (aprieta con resorte al terminar de anudarse)
  const cz = t - T.cinch, loop = cz < 0 ? 0.90 : 0.90 + 0.10 * spring(cz, 3.0, 0.32), lift = cz < 0 ? 0.80 : 0.80 + 0.20 * spring(cz, 2.6, 0.34);
  const bl = bowLocal(Math.round(loop * 250) / 250, Math.round(lift * 250) / 250);
  xform(bl, boxBody.matrixWorld, bowW.P, bowW.B);
  { const kin = cz < -0.25 ? 0 : spring(cz + 0.25, 3.2, 0.4), kout = 1 - easeIn(prog(t, [T.untie[0], T.untie[0] + 0.12]), 2), k = kin * kout;   // el nudo aprieta y se suelta
    knot.scale.set(0.27 * k + 1e-4, 0.15 * k + 1e-4, 0.20 * k + 1e-4); }
  // teléfono
  const ps = phoneState(t); phone.position.set(0, 0, ps.z); phone.rotation.set(ps.pitch, ps.yaw, ps.roll, 'YXZ'); phone.updateMatrixWorld(true);
  xform(frameLocal, phone.matrixWorld, frmW.P, frmW.B);
  const P = cur.P, B = cur.B;
  let wFn = 0.25, thFn = 0.021;
  if (t < T.untie[0]) {
    // la cinta es una serpiente de longitud LR que recorre: entrada + moño
    const tipDir = tmpV.set(bowW.P[9] - bowW.P[0], bowW.P[10] - bowW.P[1], bowW.P[11] - bowW.P[2]).normalize().clone();
    buildLead(V(bowW.P[0], bowW.P[1], bowW.P[2]), tipDir);
    const total = lead.len + LR, x = clamp((t - T.whip[0]) / (T.tie[1] - T.whip[0]));
    const head = HEAD0 + (total - HEAD0) * (1 - Math.pow(1 - x, 2.35));
    const amp = 1.25 * Math.exp(-t * 5.2) + 0.10;
    let j = 0;
    for (let i = 0; i < NP; i++) {
      const m = head - LR * (1 - i / (NP - 1)), o = i * 3;
      if (m >= lead.len) { const f = (m - lead.len) / LR * (NP - 1), i0 = Math.min(NP - 2, Math.floor(f)), k = f - i0, a = i0 * 3;
        for (let c = 0; c < 3; c++) { P[o + c] = lerp(bowW.P[a + c], bowW.P[a + 3 + c], k); B[o + c] = lerp(bowW.B[a + c], bowW.B[a + 3 + c], k); }
      } else {
        const mm = Math.max(m, 0); while (j < LEAD_N - 2 && lead.L[j + 1] < mm) j++;
        const k = lead.L[j + 1] > lead.L[j] ? (mm - lead.L[j]) / (lead.L[j + 1] - lead.L[j]) : 0, a = j * 3;
        for (let c = 0; c < 3; c++) P[o + c] = lerp(lead.P[a + c], lead.P[a + 3 + c], k);
        if (m < 0) P[o] += m;                                                 // lo que aún no entra sigue la recta hacia la izquierda
        const env = smooth(clamp((STRAIGHT + 6 - m) / 10)), ph = m * 0.62 - t * 34;
        P[o + 1] += amp * env * Math.sin(ph) * (0.55 + 0.45 * Math.sin(m * 0.17 + 1.0)); P[o + 2] += amp * env * 0.7 * Math.cos(ph * 0.83);
        const tw = m * 0.42 - t * 7.0, near = smooth(clamp((m - (lead.len - 9)) / 9));   // gira sobre su eje; al llegar toma la orientación de la punta
        B[o] = lerp(0.12, bowW.B[0], near); B[o + 1] = lerp(Math.cos(tw), bowW.B[1], near); B[o + 2] = lerp(Math.sin(tw), bowW.B[2], near);
      }
    }
  } else {
    // el moño se suelta: cada punto viaja a su lugar en el marco del teléfono (de las puntas hacia el centro)
    const any = t < T.untie[1] + 0.8;
    for (let i = 0; i < NP; i++) { const u = i / (NP - 1), o = i * 3;
      let q = 1, arc = 0;
      if (any) { const st = (1 - Math.abs(2 * u - 1)) * 0.30, x = (t - T.untie[0] - st) / 0.62; q = x <= 0 ? 0 : x < 1 ? easeInOut(x, 2.4) : 1; q += x > 0.55 ? 0.035 * Math.exp(-(x - 0.55) * 5.5) * Math.sin((x - 0.55) * 13) : 0; arc = Math.sin(Math.PI * clamp(q)); }
      for (let c = 0; c < 3; c++) { P[o + c] = lerp(bowW.P[o + c], frmW.P[o + c], q); B[o + c] = lerp(bowW.B[o + c], frmW.B[o + c], smooth(q)); }
      P[o + 2] += arc * 2.6; P[o] += arc * 1.1 * Math.sin(u * 9.0 + 1.0); }
    const k = easeInOut(prog(t, [T.untie[0] + 0.2, T.untie[1]]), 2);
    wFn = lerp(0.25, 0.19, k); thFn = lerp(0.021, 0.042, k);
  }
  const wEnd = (u) => wFn * (0.55 + 0.45 * smooth(clamp(Math.min(u, 1 - u) * 60)));   // puntas ligeramente afinadas
  ribbon.update(P, B, t < T.untie[1] ? wEnd : wFn, thFn, LR);
  return { bs, ps, drop };
}

let pageFrame = null;
function frameState(t) {
  const ppu = ppuAt(t);
  camera.position.set(0, 0, FPX / ppu); camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
  const st = ribbonState(t);
  key.target.position.copy(boxRig.position); key.position.copy(boxRig.position).add(V(-5.2, 7.2, 6.0)); key.castShadow = boxRig.visible;
  // cristal: crece desde la silueta del moño hasta el rectángulo redondeado (interpola campos de distancia)
  const g = prog(t, T.glass), u = screenMat.uniforms;
  u.uGrow.value = easeOut(clamp(g * 2.4), 2); u.uMorph.value = easeInOut(clamp((g - 0.12) / 0.88), 2.2); u.uBow.value.set(0, 0);
  u.uTilt.value.set(st.ps.yaw, st.ps.pitch); u.uPx.value = 1 / ppu; u.uTex.value = pageFrame ? pageFrame.tex : null;
  u.uBlur.value = pageFrame ? Math.min(0.06, Math.abs(pageFrame.v) / 60 / 844 * 0.5) : 0;
  screenMesh.visible = g > 0.001; phoneShadow.visible = g > 0.001; phoneShadow.material.uniforms.uA.value = smooth(g);
  drawText(t, st.drop * 150);
  return st;
}
// ondas del campo líquido: cada golpe visible deja una (centro en px de diseño, tiempo, amplitud)
const RIPPLES = [[540, 1000, T.whip[0] + 0.03, 0.050], [540, 1130, T.boxIn[0] + 0.30, 0.075], [540, 1060, T.cinch, 0.030], [540, 960, T.untie[1] - 0.08, 0.050]];
function fieldState(t) {
  const u = field.mat.uniforms; u.uT.value = t; u.uShift.value.set(0.02 * Math.sin(t * 0.21), sceneDrop(t) * 0.035);
  RIPPLES.forEach((r, i) => u.uRip.value[i].set((r[0] - W / 2) / (H / 2), (H / 2 - r[1]) / (H / 2), r[2], r[3]));
}

// ---------- render ----------
const halton = (i, b) => { let f = 1, r = 0; while (i > 0) { f /= b; r += f * (i % b); i = Math.floor(i / b); } return r; };
function jitter(k) { const jx = SUBS > 1 ? halton(k + 1, 2) - 0.5 : 0, jy = SUBS > 1 ? halton(k + 1, 3) - 0.5 : 0;
  camera.setViewOffset(RW, RH, jx, jy, RW, RH); const dx = jx * W / RW, dy = jy * H / RH;
  orthoPx.left = dx; orthoPx.right = W + dx; orthoPx.top = -dy; orthoPx.bottom = -H - dy; orthoPx.updateProjectionMatrix(); }
window.renderFrame = async (f) => {
  const t = f / TL.FPS, cf = capFor(f);
  pageFrame = cf ? { tex: await pageTex(cf.file), v: f < capFrames[0] ? 0 : cf.v } : null;
  fieldState(t); renderer.setRenderTarget(rtBack); renderer.render(field.scene, orthoNDC);
  renderer.setRenderTarget(rtAcc); renderer.setClearColor(0x000000, 1); renderer.clear(true, false, false);
  for (let k = 0; k < SUBS; k++) {
    frameState(SUBS === 1 ? t : t + (-0.5 + (k + 0.5) / SUBS) / 120); jitter(k);
    renderer.setRenderTarget(rtScene); renderer.clear(true, true, true);
    copyPass.mat.uniforms.uSrc.value = rtBack.texture; renderer.render(copyPass.scene, orthoNDC); renderer.clearDepth();
    renderer.render(scene, camera); renderer.render(over, orthoPx);
    accPass.mat.uniforms.uSrc.value = rtScene.texture; accPass.mat.uniforms.uW.value = 1 / SUBS;
    renderer.setRenderTarget(rtAcc); renderer.render(accPass.scene, orthoNDC);
  }
  finalPass.mat.uniforms.uFrame.value = f; renderer.setRenderTarget(null); renderer.render(finalPass.scene, orthoNDC);
  renderer.getContext().finish(); return true;
};
window.ready = true;
