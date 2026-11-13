// Compositor de Babkery: frame(t) determinista.
// Capas: campo SDF compartido (masa/luz en R,G; cristal en B; marco en A) → shader de material
// → capas 2D (tipografía, partículas, contenido de la página) → acumulación de N subcuadros (motion blur).
import {
  W, H, T, clamp, smooth, easeIO, easeOutExpo, lerp, ribbon, thickness, camera, toScreen,
  BRAID, braidStrand, braidPhase, S_SHAPE, sArm, DISK, FRAME, AVATAR_END,
  Field, mixSDF, sdSeg, sdCircle, sdRoundRect, smin,
} from './field.mjs';
import { C, cream, makeTimes, glyphRow, drawPage, drawClosing, frameRect, avatar, camMatrix, PG } from './page.mjs';

const Q = new URLSearchParams(location.search);
const SCALE = Number(Q.get('scale') || 1), SUBS = Number(Q.get('subs') || 8), FPS = Number(Q.get('fps') || 60);
const RW = Math.round(W * SCALE), RH = Math.round(H * SCALE);            // capas de diseño (1080×1920)
const FMT = Q.get('format') || '916';
const OW = RW, OH = Math.round((FMT === '11' ? 1080 : 1920) * SCALE);      // cuadro de salida
// 1:1: el mismo cuadro de diseño se reacomoda completo en el cuadrado (sin recorte)
const LAY = FMT === '11' ? { s: 0.62, ox: 540 - 540 * 0.62, oy: 540 - 960 * 0.62 } : { s: 1, ox: 0, oy: 0 };
globalThis.FMT11 = FMT === '11';
const SHUTTER = 0.5 / FPS;                                    // obturador de 180°


// ---------------------------------------------------------------- recursos
const TL = await (await fetch('../timeline/timeline.json')).json();
const WT = makeTimes(TL);

const fonts = [
  ['Fraunces', 'fraunces-latin-600-normal.woff2', { weight: '600' }],
  ['Fraunces', 'fraunces-latin-400-normal.woff2', { weight: '400' }],
  ['Fraunces', 'fraunces-latin-400-italic.woff2', { weight: '400', style: 'italic' }],
  ['Inter', 'inter-latin-500-normal.woff2', { weight: '500' }],
  ['Inter', 'inter-latin-600-normal.woff2', { weight: '600' }],
  ['Inter', 'inter-latin-700-normal.woff2', { weight: '700' }],
  ['Inter', 'inter-latin-400-normal.woff2', { weight: '400' }],
];
for (const [fam, file, d] of fonts) { const ff = new FontFace(fam, `url(./fonts/${file})`, d); await ff.load(); document.fonts.add(ff); }
const img = async (p) => { const i = new Image(); i.src = p; await i.decode(); return i; };
const IM = {
  logo: await img('../../assets/02_avatar_logo_crema.jpg'),
  hero: await img('../../assets/04_croissant_natural.jpg'),
  c1: await img('../../assets/09_croissant_relleno.jpg'),
  c2: await img('../../assets/03_baby_babkas.jpg'),
  c3: await img('../../assets/10_pan_de_caja_multisemillas.jpg'),
  g1: await img('../../assets/05_rosca_de_babka.jpg'),
  g2: await img('../../assets/07_rol_canela_y_nuez.jpg'),
  g3: await img('../../assets/11_barra_rustica_natural.jpg'),
  g4: await img('../../assets/08_chocolatine.jpg'),
};

// ---------------------------------------------------------------- WebGL
const cv = document.createElement('canvas'); cv.width = OW; cv.height = OH; document.body.appendChild(cv);
const gl = cv.getContext('webgl2', { preserveDrawingBuffer: true, antialias: false, premultipliedAlpha: false });
const floatRT = !!gl.getExtension('EXT_color_buffer_float');
gl.getExtension('OES_texture_float_linear');
const VS = `#version 300 es
in vec2 a; void main(){ gl_Position = vec4(a,0.,1.); }`;
const FS_SCENE = `#version 300 es
precision highp float;
uniform sampler2D uSdf, uFree, uPage, uLogo;
uniform float uScale, uRH, uS, uOx, uOy, uLight, uDough, uDoughOn, uStripe, uGlass, uFlash, uStreak, uSweepX, uSweepA, uSweepW;
uniform float uRefY, uRefA, uOver, uBraidK, uBraidX0, uBraidPh, uReveal, uBevel, uWeight, uPageA, uClip, uGSheen;
uniform vec3 uAv;
out vec4 o;
const vec3 BG=vec3(26.,15.,10.)/255., CHOC=vec3(58.,34.,24.)/255., CREAM=vec3(247.,232.,176.)/255.,
  TERRA=vec3(181.,104.,63.)/255., CARA=vec3(227.,162.,59.)/255., CORE=vec3(255.,243.,201.)/255.;
const vec2 DIM = vec2(1080.,1920.);
vec4 S(vec2 p){ return texture(uSdf, p/DIM); }
float prof(float d){ float x=clamp(-d/uBevel,0.,1.); return sqrt(1.-(1.-x)*(1.-x)); }
void main(){
  vec2 p = (vec2(gl_FragCoord.x, uRH - gl_FragCoord.y)/uScale - vec2(uOx, uOy))/uS;
  vec4 s = S(p);
  // lienzo de chocolate con luz cálida baja
  vec2 q = (p-vec2(540.,1000.))/vec2(820.,1250.);
  vec3 col = BG*mix(1.40,0.55,smoothstep(0.,1.1,length(q)));
  float dU = min(s.r,s.g), dp = max(dU,0.);
  float sweep = uSweepA*exp(-pow((p.x-uSweepX)/uSweepW,2.));
  // línea de luz: núcleo crema, halo caramelo, luz ancha terracota (gradiente anisotrópico por la racha)
  vec3 glow = CARA*0.85*exp(-dp/11.) + TERRA*0.36*exp(-dp/58.) + CARA*0.085*exp(-dp/230.);
  col += glow*uLight*(1.+1.6*sweep);
  col += (CORE*0.55*exp(-abs(p.y-960.)/3.2) + CARA*0.32*exp(-abs(p.y-960.)/20.))*exp(-abs(p.x-540.)/620.)*uStreak;
  col += CARA*0.24*uFlash*exp(-length((p-vec2(540.,960.))/vec2(950.,520.)));
  // rastro de reflejo sobre el lienzo (espejo bajo la forma)
  float dy = p.y-uRefY;
  vec4 sr = S(vec2(p.x, uRefY-dy));
  float dr = max(min(sr.r,sr.g),0.);
  col += step(0.,dy)*CARA*0.20*exp(-dr/14.)*exp(-dy/85.)*uRefA;
  // masa: relieve desde el SDF, cruce de la trenza por encima/debajo, capas laminadas
  float hR = prof(s.r), hG = prof(s.g);
  float ov = uOver*cos(uBraidK*(p.x-uBraidX0)+uBraidPh);
  float topR = step(hG*(1.+0.7*max(-ov,0.)), hR*(1.+0.7*max(ov,0.)));
  float dTop = mix(s.g, s.r, topR), h = mix(hG, hR, topR);
  float under = mix(hR, hG, topR);
  float Hh = h*uBevel*0.9;
  vec2 g = vec2(dFdx(Hh), -dFdy(Hh))*uScale*uS;
  vec3 N = normalize(vec3(-g, 1.));
  vec3 Lg = normalize(vec3(-0.55,-0.65,0.75));
  float dif = max(dot(N,Lg),0.);
  float spec = pow(max(dot(reflect(-Lg,N), vec3(0.,0.,1.)),0.), 34.);
  vec3 base = mix(TERRA*0.80, CARA*0.98, smoothstep(0.05,1.,h));
  float depth = -dTop;
  float seam = smoothstep(0.36,0.5, abs(fract(depth/15.)-0.5))*smoothstep(5.,10.,depth);
  base = mix(base, CHOC*1.15, seam*uStripe*0.85);
  base *= 1. - 0.35*uOver*smoothstep(0.,0.6,under)*(1.-smoothstep(0.,14.,depth));   // sombra del cruce
  vec3 dough = base*(0.28+0.95*dif) + CREAM*spec*(0.30+2.4*sweep) + CREAM*0.22*sweep*h;
  vec3 inner = mix(CORE*1.0, dough, uDough);
  float cov = smoothstep(0.75,-0.75,dU)*uDoughOn;
  float dsh = min(S(p-vec2(10.,16.)).r, S(p-vec2(10.,16.)).g);
  col *= 1. - 0.55*uDough*uDoughOn*(1.-smoothstep(-4.,26.,dsh))*(1.-cov);
  col = mix(col, inner, cov);
  // cristal: sombra, cuerpo ahumado cálido, logo en el avatar, contenido de la página, bordes
  float dB = s.b;
  float dBs = S(p-vec2(14.,28.)).b;
  col *= 1. - 0.50*uGlass*(1.-smoothstep(-12.,56.,dBs))*step(0.,dB);
  float inB = smoothstep(0.8,-0.8,dB)*uGlass;
  vec3 glass = mix(col, CHOC*0.92, 0.58) + CREAM*0.035*smoothstep(1200.,200.,p.y);
  glass += CREAM*0.030*exp(-pow((p.x+0.45*p.y-uGSheen)/120.,2.));          // reflejo que viaja por el cristal
  glass += CREAM*0.05*exp(min(dB,0.)/22.)*smoothstep(1100.,300.,p.y);       // luz interior del borde
  col = mix(col, glass, inB);
  vec2 lq = (p-uAv.xy)/uAv.z; float lr = length(lq);
  float lm = smoothstep(uReveal+0.6/uAv.z, uReveal-0.6/uAv.z, lr)*step(0.001,uReveal);
  float inA0 = smoothstep(0.8,-0.8,s.a);
  lm *= mix(1., inA0, uClip);
  col = mix(col, texture(uLogo, vec2(0.492,0.515)+lq*0.40).rgb, lm);
  vec4 pg = texture(uPage, p/DIM);
  float inA = inA0*uPageA;
  col = col*(1.-pg.a*inA) + pg.rgb*inA;
  vec2 gb = vec2(dFdx(dB), -dFdy(dB));
  float lit = clamp(dot(normalize(gb+1e-6), normalize(vec2(-0.6,-0.8))),0.,1.);
  float band = smoothstep(-12.,0.,dB)*smoothstep(0.6,-0.6,dB);
  col += uGlass*(CREAM*0.16*exp(-abs(dB+0.5)/0.7) + CREAM*0.22*band*lit*lit);
  float ar = abs(lr-1.)*uAv.z;
  col += CREAM*0.32*exp(-ar/1.1)*smoothstep(0.9,1.,uReveal)*mix(1., inA0, uClip)*clamp(dot(normalize(lq+1e-6),normalize(vec2(-0.6,-0.8))),0.25,1.);
  vec4 fr = texture(uFree, p/DIM);
  col = col*(1.-fr.a) + fr.rgb;
  o = vec4(col*uWeight, uWeight);
}`;
const FS_OUT = `#version 300 es
precision highp float;
uniform sampler2D uAcc; uniform float uFrame; uniform vec2 uRes;
out vec4 o;
float hash(vec2 p){ p = fract(p*vec2(443.897,441.423)); p += dot(p, p.yx+19.19); return fract((p.x+p.y)*p.x); }
void main(){
  vec2 uv = gl_FragCoord.xy/uRes;
  vec3 c = texture(uAcc, uv).rgb;
  float n = hash(gl_FragCoord.xy + uFrame*17.31) - 0.5;
  c += n*0.016;                                   // grano fino (~2 %), también hace de dither
  o = vec4(clamp(c,0.,1.),1.);
}`;
function prog(fs) {
  const p = gl.createProgram();
  for (const [type, src] of [[gl.VERTEX_SHADER, VS], [gl.FRAGMENT_SHADER, fs]]) {
    const sh = gl.createShader(type); gl.shaderSource(sh, src); gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh));
    gl.attachShader(p, sh);
  }
  gl.bindAttribLocation(p, 0, 'a'); gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  return p;
}
const PS = prog(FS_SCENE), PO = prog(FS_OUT);
const vb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vb);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
function tex(filter = gl.LINEAR) {
  const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return t;
}
const tSdf = tex(), tFree = tex(), tPage = tex(), tLogo = tex(), tAcc = tex(gl.NEAREST);
gl.bindTexture(gl.TEXTURE_2D, tLogo); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, IM.logo);
gl.bindTexture(gl.TEXTURE_2D, tAcc);
gl.texImage2D(gl.TEXTURE_2D, 0, floatRT ? gl.RGBA16F : gl.RGBA8, OW, OH, 0, gl.RGBA, floatRT ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE, null);
const fbo = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tAcc, 0);
const U = (p) => new Proxy({}, { get: (_, k) => gl.getUniformLocation(p, k) });
const us = U(PS), uo = U(PO);

// ---------------------------------------------------------------- campo
const FIELD = new Field(Math.min(SCALE, Number(Q.get('fs') || 0.5)));
const FAR = new Float32Array(FIELD.w * FIELD.h).fill(1e4);
const cache = {};
const sTop = () => (cache.sTop ||= FIELD.strokes([sArm(true)], S_SHAPE.T));
const sBot = () => (cache.sBot ||= FIELD.strokes([sArm(false)], S_SHAPE.T));
const diskSDF = () => (cache.disk ||= FIELD.analytic((x, y) => sdCircle(x, y, DISK)));

function ribbonScreen(t) { const c = camera(t); return { c, pts: ribbon(t).map((p) => toScreen(c, p)) }; }

function avatarAt(t) {
  const k = easeIO(clamp((t - 3.02) / 0.40));
  return { cx: lerp(DISK.cx, AVATAR_END.cx, k), cy: lerp(DISK.cy, AVATAR_END.cy, k), r: lerp(DISK.r, AVATAR_END.r, k) };
}
function frameMorph(t) { return easeIO(clamp((t - T.frame0) / (T.frame1 - T.frame0))); }

function buildSDF(t) {
  let R = FAR, G = FAR, B = FAR, A = FAR;
  if (t < 0.80) {
    const { c } = ribbonScreen(t);
    const ext = t < 0 ? 0 : 740 * easeOutExpo(t / T.burst);
    const [ax, ay] = toScreen(c, [-ext, 0]), [bx, by] = toScreen(c, [ext, 0]);
    const hw = thickness(t) * c.z / 2;
    R = G = t < 0 ? FAR : FIELD.analytic((x, y) => sdSeg(x, y, ax, ay, bx, by) - hw);
  } else if (t < 3.02) {
    let stack = null;
    if (t < T.braid1) { const { c, pts } = ribbonScreen(t); stack = FIELD.strokes([pts], thickness(t) * c.z); }
    if (t < T.braid0) { R = G = stack; }
    else {
      const kb = easeIO(clamp((t - T.braid0) / (T.braid1 - T.braid0)));
      const ks = easeIO(clamp((t - T.s0) / (T.s1 - T.s0)));
      const kd = easeIO(clamp((t - T.disk0) / (T.disk1 - T.disk0)));
      let a = null, b = null;
      if (ks < 1) { a = FIELD.strokes([braidStrand(1, t)], BRAID.T); b = FIELD.strokes([braidStrand(-1, t)], BRAID.T); }
      if (stack) { a = mixSDF(stack, a, kb); b = mixSDF(stack, b, kb); }
      if (ks > 0) { a = ks < 1 ? mixSDF(a, sTop(), ks) : sTop(); b = ks < 1 ? mixSDF(b, sBot(), ks) : sBot(); }
      if (kd > 0) { a = mixSDF(a, diskSDF(), kd); b = mixSDF(b, diskSDF(), kd); }
      R = a; G = b;
    }
  }
  if (t >= T.disk0) {
    const av = avatar(t), w = FIELD.w, fs = FIELD.s;
    if (t < 3.6) {
      const kf = frameMorph(t);
      const RR = { cx: DISK.cx, cy: DISK.cy, hw: lerp(DISK.r, FRAME.hw, kf), hh: lerp(DISK.r, FRAME.hh, Math.pow(kf, 0.8)), r: lerp(DISK.r, FRAME.r, Math.pow(kf, 0.6)) };
      A = FIELD.analytic((x, y) => sdRoundRect(x, y, RR));   // el círculo crece como rectángulo redondeado: un solo campo
      const u = smooth(3.40, 3.6, t);                          // el avatar se funde en el marco y luego queda dentro
      B = new Float32Array(A.length);
      for (let j = 0; j < FIELD.h; j++) for (let i = 0; i < w; i++) {
        const k = j * w + i; B[k] = lerp(smin(A[k], sdCircle((i + 0.5) / fs, (j + 0.5) / fs, av), 50), A[k], u);
      }
    } else if (t < 14.93) {
      const RR = frameRect(t);
      A = FIELD.analytic((x, y) => sdRoundRect(x, y, RR)); B = A;
    } else {
      B = FIELD.analytic((x, y) => sdCircle(x, y, { cx: av.cx, cy: av.cy, r: Math.max(av.r * av.reveal, 0.5) }));
    }
  }
  const n = FIELD.w * FIELD.h, px = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) { px[i * 4] = R[i]; px[i * 4 + 1] = G[i]; px[i * 4 + 2] = B[i]; px[i * 4 + 3] = A[i]; }
  return px;
}

// ---------------------------------------------------------------- uniformes por tiempo
function sweepAt(t) {               // reflejo que recorre las capas tras cada pliegue, la trenza y la S
  const list = [];
  for (const T1 of T.folds) list.push([T1 + 0.02, 0.26, 'stack']);
  list.push([0.24, 0.50, 'line'], [2.28, 0.32, 'braid'], [2.66, 0.28, 's']);
  for (const [t0, d, kind] of list) {
    const k = (t - t0) / d;
    if (k < 0 || k > 1) continue;
    let x0, x1;
    if (kind === 'line') { x0 = -80; x1 = 1160; }
    else if (kind === 'stack') { const { pts } = ribbonScreen(t); let a = 1e9, b = -1e9; for (const [x] of pts) { a = Math.min(a, x); b = Math.max(b, x); } x0 = b + 40; x1 = a - 40; }
    else { x0 = 860; x1 = 220; }
    return { x: lerp(x0, x1, easeIO(k)), a: Math.sin(Math.PI * k) * (kind === 'line' ? 0.9 : 1.0), w: kind === 'line' ? 110 : 70 };
  }
  return { x: -1e4, a: 0, w: 70 };
}
function gSheen(t) {                // reflejo del cristal del marco: viaja en cada desplazamiento de la página
  for (const [a, d] of [[3.2, 0.9], [5.78, 0.6], [7.86, 0.6], [9.45, 0.8], [11.92, 0.6], [14.0, 0.7]]) {
    const k = (t - a) / d; if (k >= 0 && k <= 1) return lerp(-300, 2300, easeIO(k));
  }
  return -9999;
}
function uniforms(t) {
  const c = camera(t);
  const light = (t < 0.9 ? 1 : lerp(1, 0.16, smooth(0.9, 1.9, t))) * (1 - smooth(2.6, 2.95, t));
  const kb = easeIO(clamp((t - T.braid0) / (T.braid1 - T.braid0)));
  const ks = easeIO(clamp((t - T.s0) / (T.s1 - T.s0)));
  const stackBottom = H / 2 - (0 - c.cy) * c.z + thickness(t) * c.z / 2;
  const refY = t < T.braid0 ? stackBottom + 6 : lerp(lerp(stackBottom + 6, BRAID.cy + BRAID.A + BRAID.T / 2 + 6, kb), S_SHAPE.cy + 2 * S_SHAPE.R + 10, ks);
  const bevel = t < T.braid0 ? Math.max(2, thickness(t) * c.z * 0.5) : lerp(lerp(thickness(t) * c.z * 0.5, BRAID.T * 0.5, kb), S_SHAPE.T * 0.5, ks);
  const av = avatar(t);
  const sw = sweepAt(t);
  const glassW = smooth(2.84, 3.0, t) * (1 - smooth(14.70, 14.92, t)) + (t >= 14.95 ? smooth(14.98, 15.12, t) : 0);
  return {
    uLight: light, uDough: smooth(0.85, 1.35, t), uDoughOn: t < 3.02 ? 1 : 0,
    uStripe: smooth(2.02, 2.35, t), uGlass: glassW,
    uFlash: t >= 0 ? Math.exp(-t / 0.12) : 0,
    uStreak: t >= 0 ? (0.95 * Math.exp(-t / 0.26) + 0.16 * (1 - smooth(0.7, 1.0, t))) * smooth(0, 0.02, t) : 0,
    uSweepX: sw.x, uSweepA: sw.a, uSweepW: sw.w,
    uRefY: refY, uRefA: 1 - smooth(2.7, 3.0, t),
    uOver: smooth(2.05, 2.3, t) * (1 - smooth(2.55, 2.8, t)),
    uBraidK: (2 * Math.PI) / BRAID.lambda, uBraidX0: BRAID.cx - 0.25 * BRAID.lambda, uBraidPh: braidPhase(t),
    uReveal: av.reveal, uBevel: bevel,
    uAv: [av.cx, av.cy, av.r], uPageA: t >= 3.0 ? 1 - smooth(14.70, 14.90, t) : 0,
    uClip: t >= 3.42 && t < 14.9 ? 1 : 0, uGSheen: gSheen(t),
  };
}

// ---------------------------------------------------------------- capas 2D
const free = new OffscreenCanvas(RW, RH), fx = free.getContext('2d');
const page = new OffscreenCanvas(RW, RH), px2 = page.getContext('2d');
let seed = 7; const rnd = () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let x = Math.imul(seed ^ (seed >>> 15), 1 | seed); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
const FLOUR = Array.from({ length: 26 }, () => ({ x: 60 + rnd() * 960, y: 300 + rnd() * 1350, p: 0.4 + rnd() * 0.9, r: 1.1 + rnd() * 2.0, a: 0.10 + rnd() * 0.20, ph: rnd() * 6.28 }));

function drawFree(t) {
  const ctx = fx;
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, RW, RH); ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
  ctx.textBaseline = 'alphabetic';
  // punto de luz previo al golpe
  if (t < 0.12) {
    const k = clamp(1 - t / 0.12), r = 16 * (0.6 + 0.4 * k);
    const g = ctx.createRadialGradient(540, 960, 0, 540, 960, r * 3);
    g.addColorStop(0, `rgba(255,243,201,${0.95 * k})`); g.addColorStop(0.3, `rgba(255,243,201,${0.55 * k})`); g.addColorStop(1, 'rgba(227,162,59,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(540, 960, r * 3, 0, 7); ctx.fill();
  }
  // núcleo nítido de la línea mientras todavía es luz
  const coreA = t < 0 ? 0 : 1 - smooth(0.95, 1.4, t);
  if (coreA > 0) {
    const { c, pts } = ribbonScreen(t);
    if (pts.length > 1) {
      ctx.globalAlpha = coreA; ctx.strokeStyle = '#FFF3C9'; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.lineWidth = Math.max(1.6, thickness(t) * c.z * 0.42);
      ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (const p of pts) ctx.lineTo(p[0], p[1]); ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }
  // harina: pocas partículas con paralaje; brillan cerca de la luz
  const c = camera(t), lit = 1 - smooth(1.2, 2.2, t), page = smooth(3.0, 3.4, t);
  for (const [i, f] of FLOUR.entries()) {
    const par = 1 + (c.z - 1) * 0.16 * f.p;
    const x = 540 + (f.x - 540) * par + 7 * t * f.p + 5 * Math.sin(0.9 * t + f.ph);
    const y = 960 + (f.y - 960) * par - 10 * t * f.p + 4 * Math.sin(0.7 * t + i * 1.7);
    const glint = 1 + 2.4 * lit * Math.exp(-Math.abs(y - 960) / 150) * smooth(0.0, 0.2, t);
    const a = Math.min(0.7, f.a * glint) * (1 - 0.55 * page) * smooth(-0.05, 0.25, t);
    const r = f.r * (0.8 + 0.4 * f.p);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r * 2.2);
    g.addColorStop(0, `rgba(247,232,176,${a})`); g.addColorStop(1, 'rgba(247,232,176,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 2.2, 0, 7); ctx.fill();
  }
  // tipografía cinética: cada palabra aterriza sobre su palabra hablada
  glyphRow(ctx, t, 'CAPA', '600 176px Fraunces', 176, 540, 690, WT.capa, 1.74, 14, C.cream);
  glyphRow(ctx, t, 'POR CAPA', 'italic 400 76px Fraunces', 76, 540, 790, WT.por, 1.80, 9, C.cream);
  // la harina brillante vuela a las estrellas de la calificación
  if (t > 5.9 && t < 6.7) {
    const M = camMatrix(t);
    for (let i = 0; i < 5; i++) {
      const f = FLOUR[(i * 5 + 2) % FLOUR.length], ta = 6.05 + i * 0.12, k = clamp((t - (ta - 0.30)) / 0.30);
      if (k <= 0 || t > ta + 0.05) continue;
      const sx = f.x + 7 * t * f.p, sy = f.y - 10 * t * f.p;
      const tx = M.a * (540 + (i - 2) * 124) + M.tx, ty = M.a * (PG.rating.stars + 30) + M.ty;
      const e = k * k * (3 - 2 * k), x = lerp(sx, tx, e), y = lerp(sy, ty, e) - 90 * Math.sin(Math.PI * e);
      const g = ctx.createRadialGradient(x, y, 0, x, y, 14);
      g.addColorStop(0, 'rgba(255,243,201,0.95)'); g.addColorStop(1, 'rgba(255,243,201,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 14, 0, 7); ctx.fill();
    }
  }
  // "TU PÁGINA": cada palabra sobre su palabra hablada, en el espacio que deja el alejamiento
  glyphRow(ctx, t, 'TU PÁGINA', '600 112px Fraunces', 112, 540, 412, 0, 11.85, 6, C.cream, { land: (i) => (i < 2 ? WT.tu + i * 0.028 : WT.pagina + (i - 2) * 0.028) });
  drawClosing(ctx, t, WT);
}

// ---------------------------------------------------------------- render
function upload(texture, src) {
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
}
function setU(u) {
  for (const [k, v] of Object.entries(u)) {
    if (Array.isArray(v)) gl.uniform3fv(us[k], v); else gl.uniform1f(us[k], v);
  }
}
function subframe(t, weight) {
  const sdf = buildSDF(t);
  gl.bindTexture(gl.TEXTURE_2D, tSdf);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, FIELD.w, FIELD.h, 0, gl.RGBA, gl.FLOAT, sdf);
  drawFree(t); upload(tFree, free);
  drawPage(px2, t, IM, WT, SCALE); upload(tPage, page);
  gl.useProgram(PS);
  [tSdf, tFree, tPage, tLogo].forEach((tx, i) => { gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, tx); });
  gl.uniform1i(us.uSdf, 0); gl.uniform1i(us.uFree, 1); gl.uniform1i(us.uPage, 2); gl.uniform1i(us.uLogo, 3);
  gl.uniform1f(us.uScale, SCALE); gl.uniform1f(us.uRH, OH); gl.uniform1f(us.uS, LAY.s); gl.uniform1f(us.uOx, LAY.ox); gl.uniform1f(us.uOy, LAY.oy); gl.uniform1f(us.uWeight, weight);
  setU(uniforms(t));
  gl.drawArrays(gl.TRIANGLES, 0, 3);
}
window.renderFrame = (f) => {
  const t = f / FPS;
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo); gl.viewport(0, 0, OW, OH);
  gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
  gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
  for (let k = 0; k < SUBS; k++) subframe(t + ((k + 0.5) / SUBS - 0.5) * SHUTTER, 1 / SUBS);
  gl.disable(gl.BLEND);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, OW, OH);
  gl.useProgram(PO); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tAcc);
  gl.uniform1i(uo.uAcc, 0); gl.uniform1f(uo.uFrame, f); gl.uniform2f(uo.uRes, OW, OH);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  gl.finish();
  return true;
};
window.info = { floatRT, RW, RH, SUBS, FPS };
window.ready = true;
