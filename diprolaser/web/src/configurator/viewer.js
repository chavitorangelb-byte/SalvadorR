// Visor de la gorra con renders fotorrealistas (Blender/Cycles) por cuadros.
// Cada cuadro trae: luz difusa (l), brillo que no depende del color (s), imagen base (b) e ids/coordenadas del logo (i).
// El color de cada parte y el logo se calculan en la GPU: color = albedo * luz + brillo, con el mismo tono final del render.
const N = 24, TOP = 24, UNDER = 25, LMAX = 4, SMAX = 2, GRAY_REF = .5;
export const VIEWS = { front: 0, side: 6, back: 12, visor: TOP, under: UNDER, threeq: 21 };
const lin = (hex) => [1, 3, 5].map((i) => { const c = parseInt(hex.slice(i, i + 2), 16) / 255; return c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4; });
const loadImg = (src) => new Promise((res, rej) => { const i = new Image(); i.decoding = 'async'; i.crossOrigin = 'anonymous'; i.onload = () => res(i); i.onerror = rej; i.src = src; });
const TECH = { bordado: 0, placa: 1, parche: 2, laser: 3, color: 4 };

/* ---------- caché de cuadros compartida (hero y configurador usan las mismas imágenes) ---------- */
const cache = new Map();
function frame(model, i) {
  const k = `${model}/${i}`;
  if (!cache.has(k)) {
    const base = `img/cap3d/${model}/${i}`;
    cache.set(k, Promise.all(['l', 's', 'b'].map((t) => loadImg(`${base}-${t}.webp`)).concat(loadImg(`${base}-i.png`)))
      .then(([l, s, b, id]) => ({ l, s, b, id })));
  }
  return cache.get(k);
}
// capas aparte para placa y parche (render propio con la gorra como máscara): b = imagen, u = coordenadas del grabado
const OVERLAY = { placa: '_plate', parche: '_patch' };
function ovFrame(kind, i) {
  const k = `${kind}/${i}`;
  if (!cache.has(k)) cache.set(k, Promise.all([loadImg(`img/cap3d/${kind}/${i}-b.webp`), loadImg(`img/cap3d/${kind}/${i}-u.png`)]).then(([b, u]) => ({ b, u })));
  return cache.get(k);
}
function preloadOv(kind, first) {
  const order = [first]; for (let d = 1; d <= N / 2; d++) order.push((first + d) % N, (first - d + N) % N);
  order.push(TOP, UNDER);
  return order.reduce((p, i) => p.then(() => ovFrame(kind, i).catch(() => {})), Promise.resolve());
}
export function preloadModel(model, first = VIEWS.threeq) {
  const order = [first]; for (let d = 1; d <= N / 2; d++) order.push((first + d) % N, (first - d + N) % N);
  order.push(TOP, UNDER);
  return order.reduce((p, i) => p.then(() => frame(model, i).catch(() => {})), Promise.resolve());
}

const FRAG = `
precision highp float;
varying vec2 vUv;
uniform sampler2D tL, tS, tB, tI, tLogo, tOB, tOU; uniform float uOv;
uniform vec3 uC1, uC2, uC3, uOld1, uOld2, uOld3;
uniform float uSweep; uniform vec2 uOrigin; uniform float uLogoOn; uniform int uTech; uniform float uTime; uniform vec2 uLogoTexel;
vec3 toLin(vec3 c){ return mix(c / 12.92, pow((c + .055) / 1.055, vec3(2.4)), step(.04045, c)); }
vec3 toSrgb(vec3 c){ c = clamp(c, 0., 1.); return mix(c * 12.92, 1.055 * pow(c, vec3(1. / 2.4)) - .055, step(.0031308, c)); }
vec3 neutral(vec3 c){
  float start = .76, desat = .15; float x = min(c.r, min(c.g, c.b)); float off = x < .08 ? x - 6.25 * x * x : .04; c -= off;
  float peak = max(c.r, max(c.g, c.b)); if (peak < start) return c;
  float d = 1. - start; float np = 1. - d * d / (peak + d - start); c *= np / peak; float g = 1. - 1. / (desat * (peak - np) + 1.); return mix(c, vec3(np), g);
}
float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main(){
  vec4 b = texture2D(tB, vUv);
  vec4 id = texture2D(tI, vUv);
  float part = floor(id.r * 255. / 60. + .5);
  // sombra suave de la placa o el parche sobre la tela
  float halo = 0.;
  if (uOv > .5) {
    vec2 o = vec2(.0045, .0065);
    halo = (texture2D(tOB, vUv + vec2(-o.x, -o.y)).a + texture2D(tOB, vUv + vec2(o.x, -o.y)).a + texture2D(tOB, vUv + vec2(0., -o.y * 1.6)).a + texture2D(tOB, vUv).a) * .25;
  }
  vec4 ov = uOv > .5 ? texture2D(tOB, vUv) : vec4(0.);
  vec3 ovc = ov.rgb;
  if (ov.a > 0.) {
    vec4 ou = texture2D(tOU, vUv);
    vec2 lq = (vec2(ou.g, 1. - ou.b) - .5) / .72 + .5;
    float lm = (uLogoOn > .5 && ou.g > 0. && lq.x > 0. && lq.x < 1. && lq.y > 0. && lq.y < 1.) ? texture2D(tLogo, lq).a : 0.;
    float lum = dot(ovc, vec3(.2126, .7152, .0722));
    // placa: el láser deja el metal claro y mate; parche: la piel se quema más oscura
    ovc = uTech == 1 ? mix(ovc, vec3(.6, .61, .63) * (.72 + .5 * lum), lm * .95) : mix(ovc, ovc * vec3(.34, .3, .28), lm * .9);
  }
  if (part < .5 || part > 3.5) { vec3 bc = b.rgb * (1. - .3 * halo * (1. - ov.a)); gl_FragColor = vec4(bc * b.a * (1. - ov.a) + ovc * ov.a, max(b.a, ov.a)); return; }
  float L = pow(texture2D(tL, vUv).r, 2.) * ${LMAX.toFixed(1)};
  float S = pow(texture2D(tS, vUv).r, 2.) * ${SMAX.toFixed(1)};
  // barrido líquido del cambio de color, desde el punto tocado
  float n = (hash(floor(vUv * 90.)) - .5) * .05;
  float k = smoothstep(uSweep - .06, uSweep, distance(vUv, uOrigin) + n);
  vec3 c1 = mix(uC1, uOld1, k), c2 = mix(uC2, uOld2, k), c3 = mix(uC3, uOld3, k);
  vec3 alb = part < 1.5 ? c1 : part < 2.5 ? c2 : c3;
  float wave = (1. - smoothstep(0., .03, abs(distance(vUv, uOrigin) + n - uSweep))) * step(.001, uSweep) * (1. - step(1.4, uSweep));
  vec3 add = vec3(0.);
  // logo en el frente: G,B = coordenadas sobre la tela
  if (uLogoOn > .5 && part < 1.5 && id.g > 0.) {
    vec2 lu = vec2(id.g, 1. - id.b);
    if ((uTech == 1 || uTech == 2) && uOv > .5) {
      // la placa o el parche vienen en su propia capa
    } else if (uTech == 1 || uTech == 2) {
      // respaldo si la capa no cargó: placa redonda de metal oscuro o parche de piel, con el logo grabado o quemado
      vec2 q = (id.gb - .5);
      bool inP = uTech == 1 ? length(q) < .485 : (abs(q.x) < .46 && abs(q.y) < .34);
      if (inP) {
        vec2 lq = q / (uTech == 1 ? .7 : .72) + .5;
        float lm = (lq.x > 0. && lq.x < 1. && lq.y > 0. && lq.y < 1.) ? texture2D(tLogo, vec2(lq.x, 1. - lq.y)).a : 0.;
        vec3 mat = uTech == 1 ? vec3(.032, .034, .04) : vec3(.28, .135, .055);
        vec3 eng = uTech == 1 ? vec3(.30, .31, .33) : vec3(.035, .015, .006);
        alb = mix(mat, eng, lm);
        float rim = uTech == 1 ? smoothstep(.43, .485, length(q)) : 0.;
        add += vec3(.25) * rim * L * .5;
        S *= uTech == 1 ? 2.6 : .8;
      }
    } else {
      vec4 lc = texture2D(tLogo, lu); float la = lc.a;
      vec3 llin = toLin(lc.rgb);
      if (uTech == 0) {
        // bordado: hilo satinado con relieve
        float stripe = sin((lu.x * .55 + lu.y) * 900.) * .5 + .5;
        float edge = la - texture2D(tLogo, lu + uLogoTexel * 5.).a;
        llin *= .7 + .55 * stripe;
        add += vec3(.05) * stripe * la * L;
        alb = mix(alb, llin, la);
        alb *= 1. - .45 * clamp(-edge, 0., 1.);
      } else if (uTech == 3) {
        float lum = dot(alb, vec3(.2126, .7152, .0722));
        vec3 burn = lum < .03 ? alb + vec3(.05, .045, .04) : alb * vec3(.4, .33, .27);
        alb = mix(alb, burn, la * .92);
      } else {
        alb = mix(alb, llin, la);
      }
    }
  }
  vec3 col = alb * L + S + add;
  col += vec3(1., .25, .22) * wave * .5;
  vec3 outc = toSrgb(neutral(col)) * (1. - .3 * halo * (1. - ov.a));
  float a = id.a;
  gl_FragColor = vec4(outc * a * (1. - ov.a) + ovc * ov.a, max(a, ov.a));
}`;
const VERT = `attribute vec2 p; varying vec2 vUv; void main(){ vUv = vec2(p.x * .5 + .5, .5 - p.y * .5); gl_Position = vec4(p, 0., 1.); }`;

export function createViewer(host, { model = 'tela', colors, tech = 'bordado', logo = null, reduced = false } = {}) {
  const canvas = document.createElement('canvas');
  canvas.className = 'cap-viewer';
  canvas.setAttribute('aria-hidden', 'true');
  host.append(canvas);
  const st = { model, colors: { ...colors }, old: { ...colors }, tech, logo, idx: VIEWS.threeq, pos: VIEWS.threeq, sweep: 99, origin: [.5, .5] };
  let gl = canvas.getContext('webgl', { premultipliedAlpha: true, alpha: true, preserveDrawingBuffer: true, antialias: false });
  let prog, U = {}, texs = {};
  if (gl) {
    const sh = (t, src) => { const s = gl.createShader(t); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.warn(gl.getShaderInfoLog(s)); return null; } return s; };
    const vs = sh(gl.VERTEX_SHADER, VERT), fs = sh(gl.FRAGMENT_SHADER, FRAG);
    if (vs && fs) {
      prog = gl.createProgram(); gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) prog = null;
    }
    if (!prog) gl = null;
  }
  if (gl) {
    gl.useProgram(prog);
    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    ['tL', 'tS', 'tB', 'tI', 'tLogo', 'tOB', 'tOU', 'uOv', 'uC1', 'uC2', 'uC3', 'uOld1', 'uOld2', 'uOld3', 'uSweep', 'uOrigin', 'uLogoOn', 'uTech', 'uTime', 'uLogoTexel'].forEach((n) => { U[n] = gl.getUniformLocation(prog, n); });
    ['tL', 'tS', 'tB', 'tI', 'tLogo', 'tOB', 'tOU'].forEach((n, i) => {
      const t = gl.createTexture(); gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, t);
      const near = n === 'tI' || n === 'tOU';
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, near ? gl.NEAREST : gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, near ? gl.NEAREST : gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.uniform1i(U[n], i); texs[n] = t;
    });
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  }
  const ctx2d = gl ? null : canvas.getContext('2d', { willReadFrequently: true });
  // fundido entre cuadros cuando gira solo (al arrastrar el cambio es directo)
  const ghost = document.createElement('canvas'); ghost.className = 'cap-ghost'; ghost.setAttribute('aria-hidden', 'true');
  ghost.style.opacity = '0'; host.append(ghost);
  const gctx = ghost.getContext('2d');
  function fadeFrom() {
    if (!cur) return;
    if (ghost.width !== canvas.width) { ghost.width = canvas.width; ghost.height = canvas.height; }
    gctx.clearRect(0, 0, ghost.width, ghost.height); gctx.drawImage(canvas, 0, 0);
    ghost.style.transition = 'none'; ghost.style.opacity = '1'; void ghost.offsetWidth;
    ghost.style.transition = 'opacity 320ms ease-out'; ghost.style.opacity = '0';
  }

  let cur = null, curOv = null, drawPending = false;
  const upload = (unit, name, img) => { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, texs[name]); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img); };
  function setLogoTex() {
    if (!gl) return;
    const src = st.logo ? (st.tech === 'bordado' ? st.logo.thread : st.logo.canvas) : null;
    if (src) { upload(4, 'tLogo', src); gl.uniform2f(U.uLogoTexel, 1 / src.width, 1 / src.height); }
  }
  async function show(i) {
    const kind = OVERLAY[st.tech];
    const [f, ov] = await Promise.all([frame(st.model, i).catch(() => null), kind ? ovFrame(kind, i).catch(() => null) : null]);
    if (!f || i !== st.idx) return;
    if (gl && cur !== f) { upload(0, 'tL', f.l); upload(1, 'tS', f.s); upload(2, 'tB', f.b); upload(3, 'tI', f.id); }
    if (gl && ov && curOv !== ov) { upload(5, 'tOB', ov.b); upload(6, 'tOU', ov.u); }
    cur = f; curOv = ov;
    if (canvas.width !== f.b.width) { canvas.width = f.b.width; canvas.height = f.b.height; }
    draw();
    host.classList.add('is-ready');
  }
  function draw() {
    if (!cur) return;
    if (gl) {
      gl.viewport(0, 0, canvas.width, canvas.height);
      const C = (p) => lin(st.colors[p]); const O = (p) => lin(st.old[p]);
      gl.uniform3fv(U.uC1, C('crown')); gl.uniform3fv(U.uC2, C('visor')); gl.uniform3fv(U.uC3, C('under'));
      gl.uniform3fv(U.uOld1, O('crown')); gl.uniform3fv(U.uOld2, O('visor')); gl.uniform3fv(U.uOld3, O('under'));
      gl.uniform1f(U.uSweep, st.sweep); gl.uniform2f(U.uOrigin, st.origin[0], st.origin[1]);
      gl.uniform1f(U.uLogoOn, st.logo ? 1 : 0); gl.uniform1i(U.uTech, TECH[st.tech] ?? 0);
      gl.uniform1f(U.uOv, curOv && OVERLAY[st.tech] ? 1 : 0);
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); gl.drawArrays(gl.TRIANGLES, 0, 3);
    } else draw2d();
  }
  // mismo cálculo en 2D para celulares sin WebGL
  const dataCache = new WeakMap();
  const pixels = (img) => { if (!dataCache.has(img)) { const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0); dataCache.set(img, x.getImageData(0, 0, c.width, c.height).data); } return dataCache.get(img); };
  let logoData = null, logoFor = null;
  function draw2d() {
    const W = canvas.width, H = canvas.height; const out = ctx2d.createImageData(W, H); const o = out.data;
    const l = pixels(cur.l), s = pixels(cur.s), b = pixels(cur.b), d = pixels(cur.id);
    const C = [null, lin(st.colors.crown), lin(st.colors.visor), lin(st.colors.under)];
    const tm = (x) => { const v = x / (1 + x * .6); return v <= .0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - .055; };
    if (st.logo && logoFor !== st.logo) { const c = document.createElement('canvas'); c.width = c.height = 256; c.getContext('2d').drawImage(st.logo.canvas, 0, 0, 256, 256); logoData = c.getContext('2d').getImageData(0, 0, 256, 256).data; logoFor = st.logo; }
    for (let k = 0; k < o.length; k += 4) {
      const a = d[k + 3]; if (!a) continue;
      const part = Math.round(d[k] / 60);
      if (part < 1 || part > 3) { o[k] = b[k]; o[k + 1] = b[k + 1]; o[k + 2] = b[k + 2]; o[k + 3] = b[k + 3]; continue; }
      const L = (l[k] / 255) ** 2 * LMAX, S = (s[k] / 255) ** 2 * SMAX;
      let al = C[part];
      if (part === 1 && st.logo && d[k + 1] > 0 && logoData) {
        const li = (Math.floor((1 - d[k + 2] / 255) * 255) * 256 + Math.floor(d[k + 1] / 255 * 255)) * 4; const la = logoData[li + 3] / 255;
        if (la) al = al.map((c, j) => c * (1 - la) + lin('#' + [logoData[li], logoData[li + 1], logoData[li + 2]].map((v) => v.toString(16).padStart(2, '0')).join(''))[j] * la);
      }
      o[k] = tm(al[0] * L + S) * 255; o[k + 1] = tm(al[1] * L + S) * 255; o[k + 2] = tm(al[2] * L + S) * 255; o[k + 3] = a;
    }
    ctx2d.putImageData(out, 0, 0);
    if (curOv && OVERLAY[st.tech]) ctx2d.drawImage(curOv.b, 0, 0);
  }

  /* ---------- giro: arrastre con inercia y giro lento solo ---------- */
  let dragging = false, lastX = 0, vel = 0, lastInput = 0, auto = !reduced, raf = 0, mode = 'cfg';
  const goTo = (p, fade = false) => {
    st.pos = ((p % N) + N) % N; const i = Math.round(st.pos) % N;
    if (i !== st.idx) { if (fade) fadeFrom(); st.idx = i; show(i); }
  };
  canvas.addEventListener('pointerdown', (e) => { if (mode !== 'cfg') return; dragging = true; lastX = e.clientX; vel = 0; lastInput = performance.now(); canvas.setPointerCapture(e.pointerId); if (st.idx >= N) { st.pos = VIEWS.threeq; } });
  canvas.addEventListener('pointermove', (e) => { if (!dragging) return; const dx = e.clientX - lastX; lastX = e.clientX; vel = -dx / 26; goTo(st.pos + vel); lastInput = performance.now(); });
  const up = () => { dragging = false; lastInput = performance.now(); };
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
  let lastTap = 0;
  canvas.addEventListener('pointerup', (e) => { if (e.pointerType === 'mouse') return; const t = performance.now(); if (t - lastTap < 300) setView('front'); lastTap = t; });
  canvas.addEventListener('dblclick', () => setView('front'));
  // pellizco: acerca con la escala del lienzo
  let zoom = 1; const pts = new Map(); let pd0 = 0, z0 = 1;
  canvas.addEventListener('pointerdown', (e) => { pts.set(e.pointerId, e.clientX + e.clientY * 1e-4); if (pts.size === 2) { const [a, b] = [...pts.values()]; pd0 = Math.abs(a - b); z0 = zoom; } });
  canvas.addEventListener('pointermove', (e) => { if (!pts.has(e.pointerId)) return; pts.set(e.pointerId, e.clientX + e.clientY * 1e-4); if (pts.size === 2) { dragging = false; const [a, b] = [...pts.values()]; zoom = Math.min(1.8, Math.max(1, z0 * Math.abs(a - b) / Math.max(pd0, 1))); canvas.style.transform = `scale(${zoom})`; } });
  ['pointerup', 'pointercancel'].forEach((ev) => canvas.addEventListener(ev, (e) => pts.delete(e.pointerId)));

  let last = performance.now(), acc = 0;
  function loop(now) {
    raf = requestAnimationFrame(loop);
    const dt = Math.min(.1, (now - last) / 1000); last = now;
    if (!dragging && Math.abs(vel) > .01) { goTo(st.pos + vel); vel *= .9; }
    else if (!dragging && (mode === 'hero' || (auto && now - lastInput > 2600)) && st.idx < N && !reduced) {
      acc += dt * (mode === 'hero' ? 3 : 2.5); // cuadros por segundo del giro lento
      if (acc >= 1) { acc = 0; goTo(st.pos + 1, true); }
    }
    if (st.sweep < 1.5) { st.sweep += dt * 1.1; drawPending = true; }
    if (drawPending) { drawPending = false; draw(); }
    if (water.active) water.step(dt);
  }
  let visible = true;
  const vio = new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible && !raf) { last = performance.now(); raf = requestAnimationFrame(loop); } else if (!visible && raf) { cancelAnimationFrame(raf); raf = 0; } });
  vio.observe(host);

  /* ---------- "Échale agua": gotas en 2D sobre la silueta ---------- */
  const water = (() => {
    const c = document.createElement('canvas'); c.className = 'cap-water'; c.setAttribute('aria-hidden', 'true');
    host.append(c); const x = c.getContext('2d');
    let drops = [], until = 0, mask = null, mw = 0, mh = 0;
    const getMask = () => { const d = pixels(cur.id); mw = cur.id.width; mh = cur.id.height; mask = d; };
    const solid = (px, py) => { const i = (Math.floor(py) * mw + Math.floor(px)) * 4; return px >= 0 && py >= 0 && px < mw && py < mh && mask[i + 3] > 150 && mask[i] > 30; };
    return {
      active: false,
      start() { if (!cur) return; getMask(); c.width = mw; c.height = mh; until = performance.now() + 4200; this.active = true; },
      step(dt) {
        const now = performance.now();
        if (now < until) for (let k = 0; k < 3; k++) drops.push({ x: mw * (.2 + Math.random() * .6), y: -10, vy: 260 + Math.random() * 80, r: 3 + Math.random() * 5, on: false, life: 1 });
        x.clearRect(0, 0, mw, mh);
        drops = drops.filter((d) => d.y < mh + 20 && d.life > 0);
        for (const d of drops) {
          if (!d.on) { d.vy += 900 * dt; d.y += d.vy * dt; if (solid(d.x, d.y)) { d.on = true; d.vy = 20; } }
          else { d.vy = Math.min(d.vy + 120 * dt, 90); const ny = d.y + d.vy * dt; if (solid(d.x, ny)) d.y = ny; else if (solid(d.x + 2, ny)) { d.x += 2; d.y = ny; } else if (solid(d.x - 2, ny)) { d.x -= 2; d.y = ny; } else { d.on = false; d.y = ny; } d.life -= dt * .12; }
          const g = x.createRadialGradient(d.x - d.r * .35, d.y - d.r * .4, d.r * .1, d.x, d.y, d.r);
          g.addColorStop(0, 'rgba(255,255,255,.95)'); g.addColorStop(.25, 'rgba(190,210,230,.35)'); g.addColorStop(.85, 'rgba(20,28,38,.35)'); g.addColorStop(1, 'rgba(230,240,255,.55)');
          x.fillStyle = g; x.beginPath(); x.ellipse(d.x, d.y, d.r * (d.on ? 1.1 : .8), d.r * (d.on ? .95 : 1.25), 0, 0, 7); x.fill();
        }
        if (now > until && !drops.length) { this.active = false; x.clearRect(0, 0, mw, mh); }
      },
    };
  })();

  function setView(v) { const i = VIEWS[v]; if (i == null) return; st.idx = i; st.pos = i < N ? i : st.pos; lastInput = performance.now(); show(i); }

  preloadModel(st.model, st.idx);
  show(st.idx);
  return {
    setModel(m, colors) { st.model = m; if (colors) { st.old = { ...st.colors }; st.colors = { ...colors }; } cur = null; preloadModel(m, st.idx); show(st.idx); },
    setColor(part, hex, origin) { st.old = { ...st.colors }; st.colors[part] = hex; st.origin = origin || [.5, .45]; st.sweep = reduced ? 9 : 0; drawPending = true; },
    setTech(t) {
      st.tech = t; setLogoTex(); drawPending = true;
      if (OVERLAY[t]) { curOv = null; show(st.idx); preloadOv(OVERLAY[t], st.idx < N ? st.idx : VIEWS.threeq); }
    },
    setLogo(l) { st.logo = l; setLogoTex(); drawPending = true; },
    setView,
    water() { water.start(); },
    stopAuto() { auto = false; },
    attach(el, m) { mode = m; if (canvas.parentElement !== el) { vio.unobserve(host); host = el; el.append(canvas, ghost); vio.observe(el); } canvas.style.pointerEvents = m === 'hero' ? 'none' : ''; },
    snapshot() { draw(); const c = document.createElement('canvas'); c.width = c.height = 1080; const x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(canvas, 0, 0, 1080, 1080); return c; },
    perf() { return 0; },
    get state() { return st; },
    get gl() { return !!gl; },
  };
}
