// Fondo vivo en WebGL (sin Three.js): negro profundo, luz roja que respira, resplandor con el color
// de cada sección y un "actor" líquido (SDF + metaballs) que forma la X del hero y se transforma
// en gota, X, gorra y vaso entre secciones. Corre a media resolución y se pausa si no se ve.
import { reducedMotion, isMobile } from '../lib/state.js';

const VERT = `attribute vec2 p; void main(){ gl_Position = vec4(p, 0., 1.); }`;
const FRAG = `
precision highp float;
uniform vec2 uRes; uniform float uTime; uniform float uScale;
uniform vec3 uCol; uniform float uAura;
uniform vec2 uLight; uniform float uLightR; uniform float uLightAmt;
uniform vec2 uC; uniform float uS; uniform float uShape; uniform float uForm; uniform float uAlpha;
float smin(float a, float b, float k){ float h = clamp(.5 + .5 * (b - a) / k, 0., 1.); return mix(b, a, h) - k * h * (1. - h); }
float sdSeg(vec2 p, vec2 a, vec2 b, float r){ vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0., 1.); return length(pa - ba * h) - r; }
float sdBox(vec2 p, vec2 b){ vec2 d = abs(p) - b; return length(max(d, 0.)) + min(max(d.x, d.y), 0.); }
float sdX(vec2 p){
  // dos barras gruesas con puntas biseladas, proporción de la X del logo
  float a = sdSeg(p, vec2(-.86, .66), vec2(.86, -.66), .15);
  float b = sdSeg(p, vec2(.86, .66), vec2(-.86, -.66), .15);
  return min(a, b);
}
float sdDrop(vec2 p){ p.y += .14; float c = length(p) - .44; float t = sdSeg(p, vec2(0., .1), vec2(0., .86), .015); return smin(c, t, .5); }
float sdCap(vec2 p){
  p.y += .05;
  float dome = length(vec2(p.x * .92, max(p.y, 0.))) - .56; dome = max(dome, -p.y);
  float visor = sdSeg(p, vec2(.2, -.02), vec2(1.02, -.16), .05);
  float button = length(p - vec2(-.04, .57)) - .06;
  return smin(min(dome, button), visor, .1);
}
float sdVaso(vec2 p){ float t = clamp((p.y + .62) / 1.24, 0., 1.); float w = mix(.30, .42, t); return sdBox(vec2(p.x * (.42 / w), p.y), vec2(.42, .62)) - .05; }
float shapeSDF(vec2 p, float s){
  float d = mix(sdDrop(p), sdX(p), clamp(s, 0., 1.));
  d = mix(d, sdCap(p), clamp(s - 1., 0., 1.));
  d = mix(d, sdVaso(p), clamp(s - 2., 0., 1.));
  return d;
}
float liquid(vec2 p){
  float d = 1e3;
  for (int i = 0; i < 6; i++){
    float fi = float(i);
    vec2 c = vec2(sin(uTime * .61 + fi * 2.1), cos(uTime * .47 + fi * 1.7)) * (.95 + .35 * sin(fi * 1.3)) * (1. - uForm);
    float r = (.17 + .05 * sin(uTime * 1.3 + fi)) * (1. - uForm * .75);
    d = smin(d, length(p - c) - r, .38);
  }
  float s = mix(1.2, shapeSDF(p, uShape), uForm);
  // ondulación viva en la superficie
  s += .012 * sin(p.x * 9. + uTime * 2.1) * sin(p.y * 7. - uTime * 1.7);
  return smin(d, s, .26);
}
float hexGrid(vec2 p){
  p /= 46.; vec2 r = vec2(1., 1.7320508); vec2 h = r * .5;
  vec2 a = mod(p, r) - h; vec2 b = mod(p - h, r) - h; vec2 g = dot(a, a) < dot(b, b) ? a : b;
  float e = .5 - max(abs(g.x), dot(abs(g), normalize(vec2(1., 1.7320508))));
  return smoothstep(.035, 0., e);
}
void main(){
  vec2 frag = gl_FragCoord.xy / uScale; frag.y = uRes.y - frag.y;
  vec2 uv = frag / uRes;
  vec3 col = vec3(.0196, .0196, .0235);
  // resplandor de sección (color de los productos), dos manchas que respiran
  float t = uTime * .12;
  vec2 a1 = vec2(.25 + .1 * sin(t * 1.7), .3 + .08 * cos(t * 1.3));
  vec2 a2 = vec2(.8 + .08 * cos(t * 1.1), .75 + .1 * sin(t * 1.9));
  float asp = uRes.x / uRes.y;
  float g1 = exp(-3.2 * dot((uv - a1) * vec2(asp, 1.), (uv - a1) * vec2(asp, 1.)));
  float g2 = exp(-2.6 * dot((uv - a2) * vec2(asp, 1.), (uv - a2) * vec2(asp, 1.)));
  col += uCol * (g1 * .15 + g2 * .10) * uAura;
  col += vec3(.89, .15, .18) * g2 * .025;
  // luz roja que respira
  float breathe = .82 + .18 * sin(uTime * 1.5);
  float dl = length(frag - uLight) / uLightR;
  float light = exp(-dl * dl * 1.6) * uLightAmt * breathe;
  col += vec3(.95, .13, .17) * light * .42 + vec3(1., .45, .4) * light * light * .08;
  // rejilla hexagonal tenue, solo donde hay luz (como en sus videos)
  col += vec3(.9, .2, .22) * hexGrid(frag) * (light * .16 + (g1 + g2) * uAura * .025);
  // viñeta
  col *= 1. - .55 * pow(length((uv - .5) * vec2(1., .9)), 2.2);
  // actor líquido
  if (uAlpha > .001){
    vec2 p = (frag - uC) / uS;
    if (dot(p, p) < 9.){
      float e = 1.5 / uS;
      float d = liquid(p);
      float dx = liquid(p + vec2(e, 0.)) - d, dy = liquid(p + vec2(0., e)) - d;
      vec3 n = normalize(vec3(-dx / e, dy / e, .9 + 2.5 * clamp(-d * 6., 0., 1.)));
      vec3 L = normalize(vec3(-.5, .65, .8));
      float diff = clamp(dot(n, L), 0., 1.);
      float spec = pow(clamp(dot(reflect(-L, n), vec3(0., 0., 1.)), 0., 1.), 42.);
      float fres = pow(1. - n.z, 2.);
      vec3 liq = mix(vec3(.32, .02, .04), vec3(.96, .14, .18), diff) + vec3(1., .82, .8) * spec * 1.1 + vec3(1., .3, .32) * fres * .6;
      float aa = 1.2 / uS;
      float m = smoothstep(aa, -aa, d) * uAlpha;
      float glow = exp(-max(d, 0.) * 7.) * .35 * uAlpha;
      col += vec3(.9, .1, .15) * glow;
      col = mix(col, liq, m);
    }
  }
  gl_FragColor = vec4(col, 1.);
}`;

const hex = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; };
export const AURA = {
  hero: hex('#e3262f'), cfg: hex('#d61f2c'), gold: hex('#d8b25c'), blue: hex('#1d46b4'),
  olive: hex('#59612a'), pink: hex('#e7b9cf'), camel: hex('#b8764e'), red: hex('#e3262f'),
};
// gota → X → gorra → vaso, uno por frontera entre secciones
const BOUNDARY_SHAPES = [0, 1, 2, 3, 0, 1, 2, 1];

export function initAura() {
  const canvas = document.getElementById('aura');
  const gl = canvas.getContext('webgl', { antialias: false, alpha: false, depth: false, stencil: false, powerPreference: 'low-power', preserveDrawingBuffer: false });
  if (!gl) return null;
  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.warn(gl.getShaderInfoLog(s)); return null; } return s; };
  const vs = sh(gl.VERTEX_SHADER, VERT), fs = sh(gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) return null;
  const prog = gl.createProgram(); gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
  gl.useProgram(prog);
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const U = {}; ['uRes', 'uTime', 'uScale', 'uCol', 'uAura', 'uLight', 'uLightR', 'uLightAmt', 'uC', 'uS', 'uShape', 'uForm', 'uAlpha'].forEach((n) => { U[n] = gl.getUniformLocation(prog, n); });
  canvas.style.background = 'none';

  const s = {
    col: [...AURA.hero], colTarget: [...AURA.hero], aura: 1,
    light: [0, 0], lightR: 400, lightAmt: 1,
    c: [0, 0], size: 100, shape: 1, form: 0, alpha: 0,
    hero: { active: true, form: 0, alpha: 0, rect: null },
    override: null,
  };
  let W = 0, H = 0, scale = 0.5;
  const resize = () => {
    W = innerWidth; H = innerHeight;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    scale = (isMobile() ? 0.42 : 0.5) * dpr;
    canvas.width = Math.round(W * scale); canvas.height = Math.round(H * scale);
    gl.viewport(0, 0, canvas.width, canvas.height);
  };
  resize(); addEventListener('resize', resize);

  // secciones y fronteras
  const sections = [...document.querySelectorAll('main > section[data-aura]')];
  const colorOf = (sec) => sec.__auraColor || AURA[sec.dataset.aura] || AURA.red;
  const heroLogo = document.querySelector('[data-hero-logo]');

  function updateScroll() {
    const mid = H * 0.5;
    // color: sección al centro, mezclada con la siguiente según su avance
    let cur = sections[0], next = null, k = 0;
    for (let i = 0; i < sections.length; i++) {
      const r = sections[i].getBoundingClientRect();
      if (r.top <= mid && r.bottom > mid) { cur = sections[i]; next = sections[i + 1]; k = next ? Math.max(0, (mid - (r.bottom - H * 0.35)) / (H * 0.35)) : 0; break; }
    }
    const a = colorOf(cur), b = next ? colorOf(next) : a;
    k = Math.min(1, Math.max(0, k)); k = k * k * (3 - 2 * k);
    for (let i = 0; i < 3; i++) s.colTarget[i] = a[i] + (b[i] - a[i]) * k;

    // hero: luz detrás de la gorra, X líquida sobre el logo
    const hr = sections[0].getBoundingClientRect();
    s.hero.active = hr.bottom > H * 0.3;
    if (heroLogo) {
      const lr = heroLogo.getBoundingClientRect();
      s.hero.rect = lr;
      s.light = [lr.left + lr.width / 2, lr.top + lr.height * 1.25];
      s.lightR = Math.max(lr.width * 1.5, 260);
    }
    s.lightAmt = Math.max(0, Math.min(1, hr.bottom / H)) * 0.9 + 0.1;
    if (!s.hero.active) { s.light = [W * 0.5, H * 0.38]; s.lightR = Math.max(W, H) * 0.5; s.lightAmt = 0.16; }

    // fronteras entre secciones: el líquido aparece en la más cercana al centro
    let best = null, bestD = Infinity, bi = 0;
    for (let i = 0; i < sections.length - 1; i++) {
      const y = sections[i].getBoundingClientRect().bottom;
      const d = Math.abs(y - mid);
      if (d < bestD) { bestD = d; best = y; bi = i; }
    }
    s.boundary = { y: best, d: bestD, i: bi };
  }

  let t0 = performance.now(), last = 0, raf = 0, running = true;
  const fpsCap = isMobile() ? 30 : 60;
  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (now - last < 1000 / fpsCap - 2) return;
    last = now;
    const time = reducedMotion.matches ? 8 : (now - t0) / 1000;
    for (let i = 0; i < 3; i++) s.col[i] += (s.colTarget[i] - s.col[i]) * 0.06;

    // actor: hero o frontera
    let c, size, shape, form, alpha;
    if (s.hero.active && s.hero.rect) {
      const r = s.hero.rect;
      c = [r.left + r.width * 0.5, r.top + r.height * 0.5];
      size = r.width * 0.5; shape = 1; form = s.hero.form; alpha = s.hero.alpha;
    } else if (s.boundary) {
      const near = Math.max(0, 1 - s.boundary.d / (H * 0.34));
      c = [W * 0.5, s.boundary.y];
      size = Math.min(W, H) * (isMobile() ? 0.085 : 0.06);
      const sIdx = s.boundary.i;
      shape = BOUNDARY_SHAPES[sIdx % BOUNDARY_SHAPES.length];
      form = Math.min(1, near * 1.6);
      alpha = near * near * (3 - 2 * near) * 0.95;
    }
    if (s.override) ({ c, size, shape, form, alpha } = { c, size, shape, form, alpha, ...s.override });
    s.shape += ((shape ?? 1) - s.shape) * 0.08; s.form = form ?? 0; s.alpha = alpha ?? 0;

    gl.uniform2f(U.uRes, W, H); gl.uniform1f(U.uTime, time); gl.uniform1f(U.uScale, scale);
    gl.uniform3fv(U.uCol, s.col); gl.uniform1f(U.uAura, s.aura);
    gl.uniform2f(U.uLight, s.light[0], s.light[1]); gl.uniform1f(U.uLightR, s.lightR); gl.uniform1f(U.uLightAmt, s.lightAmt);
    gl.uniform2f(U.uC, c?.[0] ?? -999, c?.[1] ?? -999); gl.uniform1f(U.uS, Math.max(size || 1, 1));
    gl.uniform1f(U.uShape, s.shape); gl.uniform1f(U.uForm, s.form); gl.uniform1f(U.uAlpha, s.alpha);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (reducedMotion.matches) { cancelAnimationFrame(raf); raf = 0; }
  }
  const start = () => { if (!raf && running) raf = requestAnimationFrame(frame); };
  addEventListener('scroll', () => { updateScroll(); if (reducedMotion.matches) start(); }, { passive: true });
  addEventListener('resize', updateScroll);
  document.addEventListener('visibilitychange', () => { running = !document.hidden; if (running) start(); else { cancelAnimationFrame(raf); raf = 0; } });
  updateScroll(); start();

  return {
    state: s,
    setSectionColor(sec, rgbHex) { sec.__auraColor = hex(rgbHex); updateScroll(); },
    refresh: updateScroll,
    kick: start,
  };
}
