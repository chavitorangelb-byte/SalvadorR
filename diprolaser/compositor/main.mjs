// Motor de render de DIPROLASER. API: window.renderFrame(f) deja el cuadro f en el canvas.
// frame(t) es determinista: la coreografia (story.mjs) describe el instante t y aqui se dibuja.
// Cada cuadro = promedio de SUBS subcuadros (obturador de 180 grados) para el desenfoque de movimiento.
import { createGL, texFromSource, updateTex, createFBO, makePrograms, draw } from './gl.mjs';
import { buildStory } from './story.mjs';

const Q = new URLSearchParams(location.search);
const FORMAT = Q.get('format') || '916';
const SUBS = Number(Q.get('subs') || 8);
const SCALE = Number(Q.get('scale') || 1);
const SAFE = Q.get('safe') === '1';
const W = 1080, H = FORMAT === '11' ? 1080 : 1920;
const RW = Math.round(W * SCALE), RH = Math.round(H * SCALE);
const FPS = 60, SHUTTER = 0.5;

const canvas = document.getElementById('c');
canvas.width = RW; canvas.height = RH;
const gl = createGL(canvas);
const P = makePrograms(gl);

async function loadImg(src) {
  const im = new Image(); im.src = src; await im.decode(); return im;
}
async function loadFonts() {
  const F = [['Archivo Black', 'archivo-black-latin-400-normal.woff2', 400], ['Anton', 'anton-latin-400-normal.woff2', 400]];
  for (const w of [400, 500, 600, 700, 800, 900]) F.push(['Inter', `inter-latin-${w}-normal.woff2`, w]);
  for (const [fam, file, w] of F) {
    const ff = new FontFace(fam, `url(fonts/${file})`, { weight: String(w) });
    await ff.load(); document.fonts.add(ff);
  }
}

const PRODUCTS = ['termo_negro_1', 'termo_negro_2', 'termo_negro_3', 'vaso_azul_1', 'vaso_azul_2', 'vaso_verde_1', 'vaso_verde_2',
  'vaso_rosa_1', 'vaso_rosa_2', 'vaso_asa_crema', 'vaso_asa_blanco', 'anfora_negra_grabado_diprolaser', 'estuche_vip_grabado_diprolaser',
  'estuche_plumas_abierto', 'set_regalo_pluma_tarjetero_navaja_llavero', 'llavero_cinta_azul', 'llavero_cinta_roja', 'llavero_llanta',
  'llavero_casco_amarillo', 'llavero_casco_blanco_2', 'llavero_casco_luz_encendida'];

const A = { prod: {}, mask: {}, meta: null, labels: {}, logo: null, logoEng: null };
const white1 = (() => { const c = document.createElement('canvas'); c.width = c.height = 2; const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, 2, 2); return c; })();

// --- letreros para grabar (texto en blanco sobre transparente; el shader lo vuelve acero) ------
function makeLabel(l1, l2) {
  const c = document.createElement('canvas'); c.width = 1200; c.height = 560;
  const x = c.getContext('2d'); x.fillStyle = '#fff'; x.textAlign = 'center'; x.textBaseline = 'alphabetic';
  let fs = 210; x.font = `400 ${fs}px "Archivo Black"`;
  while (x.measureText(l1).width > 1100) { fs -= 6; x.font = `400 ${fs}px "Archivo Black"`; }
  x.fillText(l1, 600, 270);
  x.fillRect(330, 318, 540, 7);
  let f2 = 104; x.font = `800 ${f2}px Inter`; x.letterSpacing = '14px';
  while (x.measureText(l2).width > 1080) { f2 -= 4; x.font = `800 ${f2}px Inter`; }
  x.fillText(l2, 600, 452);
  return c;
}
function makeSeal() {
  const c = document.createElement('canvas'); c.width = c.height = 640;
  const x = c.getContext('2d'); x.strokeStyle = x.fillStyle = '#fff';
  x.lineWidth = 18; x.beginPath(); x.arc(320, 320, 290, 0, Math.PI * 2); x.stroke();
  x.lineWidth = 6; x.beginPath(); x.arc(320, 320, 250, 0, Math.PI * 2); x.stroke();
  x.textAlign = 'center';
  x.font = '400 150px "Archivo Black"'; x.fillText('TU', 320, 300);
  x.font = '400 112px "Archivo Black"'; x.fillText('LOGO', 320, 410);
  x.font = '800 54px Inter'; x.letterSpacing = '14px'; x.fillText('AQUÍ', 327, 482);
  for (const a of [-2.25, -0.89]) { x.beginPath(); x.arc(320 + 205 * Math.cos(a), 320 + 205 * Math.sin(a) + 60, 11, 0, 7); x.fill(); }
  return c;
}

let story = null;
const layerCanvases = [];
function getLayer(i) {
  if (!layerCanvases[i]) {
    const c = document.createElement('canvas'); c.width = RW; c.height = RH;
    layerCanvases[i] = { c, ctx: c.getContext('2d'), tex: null };
  }
  return layerCanvases[i];
}

let FB = null;
async function init() {
  await loadFonts();
  A.meta = await (await fetch('../assets/productos/meta.json')).json();
  await Promise.all(PRODUCTS.map(async (n) => {
    A.prod[n] = texFromSource(gl, await loadImg(`../assets/productos/${n}.png`));
    if (A.meta[n]) A.mask[n] = texFromSource(gl, await loadImg(`../assets/productos/${n}_mask.png`));
  }));
  A.logo = texFromSource(gl, await loadImg('../assets/logo/logo_diprolaser.png'));
  A.logoImg = await loadImg('../assets/logo/logo_diprolaser.png');
  A.logoEng = texFromSource(gl, await loadImg('../assets/logo/logo_grabado_blanco.png'));
  A.labels.logo = { tex: A.logoEng, aspect: A.logoEng.w / A.logoEng.h };
  const names = { clavo: ['FERRETERÍA', 'EL CLAVO'], ruiz: ['TALLER', 'HERMANOS RUIZ'], davila: ['CONSTRUCTORA', 'DÁVILA'],
    espiga: ['PANADERÍA', 'LA ESPIGA'], juarez: ['REFACCIONARIA', 'JUÁREZ'] };
  for (const [k, [a, b]] of Object.entries(names)) { const c = makeLabel(a, b); A.labels[k] = { tex: texFromSource(gl, c), aspect: c.width / c.height }; }
  const seal = makeSeal(); A.labels.seal = { tex: texFromSource(gl, seal), aspect: 1 };
  A.white = texFromSource(gl, white1, { mip: false });
  A.timeline = await (await fetch('../timeline/timeline.json')).json();
  A.words = (await (await fetch('../timeline/vo_words.json')).json()).words;
  story = buildStory({ W, H, FORMAT, A, SAFE });
  FB = {
    scene: createFBO(gl, RW, RH), out: createFBO(gl, RW, RH), acc: createFBO(gl, RW, RH),
    q1: createFBO(gl, Math.ceil(RW / 4), Math.ceil(RH / 4)), q2: createFBO(gl, Math.ceil(RW / 4), Math.ceil(RH / 4)),
  };
}

// --- dibujo de un instante ------------------------------------------------------------------
const S = SCALE;
const sr = (r) => [r[0] * S, r[1] * S, r[2] * S, r[3] * S];

function drawProduct(it, mode) {
  const tex = A.prod[it.key]; const meta = A.meta[it.key] || {};
  const rect = sr(it.rect);
  const flip = mode === 'refl';
  if (flip) { rect[1] = rect[1] + rect[3] + (it.reflGap || 0) * S; }
  const rc = it.recolor || {};
  const e = it.eng || {}; const pr = it.print || {};
  const eng = meta.engrave ? [meta.engrave.cx, meta.engrave.cy + (e.dy || 0), meta.engrave.hw, meta.engrave.h] : [0, 0, 1, 1];
  const lab = e.label ? A.labels[e.label] : null;
  const prLab = pr.on ? { tex: A.logo, aspect: A.logo.w / A.logo.h } : null;
  draw(gl, P.prod, rect, {
    uTexSize: [tex.w, tex.h], uOpacity: (it.opacity ?? 1), uBlur: (it.blur || 0) * (tex.h / Math.max(it.rect[3], 1)),
    uSharpen: it.rect[3] > tex.h * 1.05 ? 0.35 : 0.0,
    uHasMask: A.mask[it.key] && it.recolor ? 1 : 0, uLumMed: meta.lum_median || 0.5,
    uColA: rc.a || [1, 1, 1], uColB: rc.b || [1, 1, 1], uColAMode: rc.amode ?? 0, uColBMode: rc.bmode ?? 0,
    uSweep: (rc.sweep ?? -1e5) * S, uSweepDir: rc.dir || [0.7071, 0.7071],
    uEng: eng, uEngOn: lab && !flip ? 1 : 0, uEngPhase: e.phase || 0, uEngAng: e.ang || 1.7,
    uEngAspect: lab ? lab.aspect : 1, uEngAspect2: lab ? lab.aspect : 1, uEngReveal: e.reveal ?? 1, uEngWipe: e.wipe ?? 0,
    uEngWhich: 0, uEngRaster: e.raster ? 1 : 0, uEngKind: e.kind || 0,
    uPrintOn: pr.on && !flip ? 1 : 0, uPrintCMYK: pr.cmyk || [1, 1, 1, 1], uPrintAng: pr.ang || 1.5, uPrintAspect: prLab ? prLab.aspect : 1,
    uTint: it.tint || [1, 1, 1], uWarm: it.warm || 0, uRim: flip ? 0 : (it.rim || 0), uRimY: it.rimY || 0.5, uRimCol: it.rimCol || [0.89, 0.15, 0.18],
    uSpecX: it.specX ?? 0.35, uSpecI: flip ? 0 : (it.specI || 0),
    uFlip: flip ? 1 : 0, uReflFade: it.reflFade ?? 0.22, uSquash: 0,
  }, [RW, RH], { textures: { uTex: tex, uMask: A.mask[it.key] || A.white, uLabel: lab ? lab.tex : A.white, uLabel2: lab ? lab.tex : A.white, uPrint: prLab ? prLab.tex : A.white } });
}

function drawLayerCanvas(L, i) {
  const lc = getLayer(i);
  const x = lc.ctx;
  x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, RW, RH);
  x.setTransform(S, 0, 0, S, 0, 0);
  L.draw(x);
  if (!lc.tex) lc.tex = texFromSource(gl, lc.c, { mip: false }); else updateTex(gl, lc.tex, lc.c);
  draw(gl, P.layer, [0, 0, RW, RH], { uOpacity: L.opacity ?? 1 }, [RW, RH], { textures: { uTex: lc.tex } });
}

function drawLiquid(L) {
  const balls = new Float32Array(64);
  L.balls.slice(0, 16).forEach((b, i) => balls.set([b[0] * S, b[1] * S, b[2] * S, 1], i * 4));
  const box = L.rect ? sr(L.rect) : [0, 0, RW, RH];
  draw(gl, P.liquid, box, {
    uBalls: balls, uNB: { int: Math.min(16, L.balls.length) }, uK: (L.k || 60) * S,
    uShapeA: L.shapeA ? [L.shapeA.x * S, L.shapeA.y * S, L.shapeA.size * S, 0] : [0, 0, 1, 0], uShapeAKind: L.shapeA ? L.shapeA.kind : 0, uShapeAW: L.shapeA ? L.shapeA.w : 0,
    uShapeB: L.shapeB ? [L.shapeB.x * S, L.shapeB.y * S, L.shapeB.size * S, 0] : [0, 0, 1, 0], uShapeBKind: L.shapeB ? L.shapeB.kind : 0, uShapeBW: L.shapeB ? L.shapeB.w : 0,
    uOpacity: L.opacity ?? 1, uT: L.t || 0, uLight: L.light || [-0.4, -0.6, 0.7],
  }, [RW, RH]);
}

function renderSub(t) {
  const sc = story.at(t);
  // 1) escena
  gl.bindFramebuffer(gl.FRAMEBUFFER, FB.scene.fb); gl.viewport(0, 0, RW, RH);
  gl.disable(gl.BLEND);
  const bg = sc.bg;
  draw(gl, P.bg, [0, 0, RW, RH], {
    uGlow: [bg.glow[0] * S, bg.glow[1] * S], uGlowR: bg.glowR * S, uGlowI: bg.glowI, uGlowCol: bg.glowCol || [0.89, 0.15, 0.18],
    uGlow2: [(bg.glow2 || [0, 0])[0] * S, (bg.glow2 || [0, 0])[1] * S], uGlow2R: (bg.glow2R || 1) * S, uGlow2I: bg.glow2I || 0, uGlow2Col: bg.glow2Col || [0.85, 0.65, 0.3],
    uFloorY: (bg.floorY ?? 99999) * S, uFloorI: bg.floorI ?? 0, uT: t,
  }, [RW, RH]);
  gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  let li = 0;
  // capas de lienzo consecutivas se juntan en una sola subida de textura
  const merged = [];
  for (const L of sc.layers) {
    const prev = merged[merged.length - 1];
    if (L.type === 'canvas' && prev && prev.type === 'canvas') prev.list.push(L);
    else merged.push(L.type === 'canvas' ? { type: 'canvas', list: [L] } : L);
  }
  for (const L of merged) {
    if (L.type === 'canvas') drawLayerCanvas({ draw: (x) => { for (const q of L.list) { x.save(); x.globalAlpha = 1; q.draw(x); x.restore(); } } }, li++);
    else if (L.type === 'products') {
      const items = [...L.items].sort((a, b) => (b.z || 0) - (a.z || 0));
      for (const it of items) if (it.refl) drawProduct(it, 'refl');
      for (const it of items) if (it.shadow) {
        const r = it.rect; const w = r[2] * 0.95;
        draw(gl, P.ellipse, sr([r[0] + r[2] / 2 - w * 0.55, r[1] + r[3] - w * 0.05, w * 1.1, w * 0.16]), { uCol: [0, 0, 0, 0.75 * (it.opacity ?? 1) * it.shadow], uSoft: 0.9 }, [RW, RH]);
      }
      for (const it of items) drawProduct(it, 'main');
    } else if (L.type === 'liquid') drawLiquid(L);
  }
  // 2) desenfoque a 1/4 (cristal y bloom)
  gl.disable(gl.BLEND);
  const qw = FB.q1.w, qh = FB.q1.h;
  gl.bindFramebuffer(gl.FRAMEBUFFER, FB.q1.fb); gl.viewport(0, 0, qw, qh);
  draw(gl, P.blur, [0, 0, qw, qh], { uDir: [1, 0], uSigma: 4.5, uTexel: [1 / RW, 1 / RH] }, [qw, qh], { textures: { uTex: FB.scene.tex } });
  gl.bindFramebuffer(gl.FRAMEBUFFER, FB.q2.fb);
  draw(gl, P.blur, [0, 0, qw, qh], { uDir: [0, 1], uSigma: 8.5, uTexel: [1 / qw, 1 / qh] }, [qw, qh], { textures: { uTex: FB.q1.tex } });
  gl.bindFramebuffer(gl.FRAMEBUFFER, FB.q1.fb);
  draw(gl, P.blur, [0, 0, qw, qh], { uDir: [1, 0], uSigma: 8.5, uTexel: [1 / qw, 1 / qh] }, [qw, qh], { textures: { uTex: FB.q2.tex } });
  // 3) composicion: escena + bloom, cristales, texto
  gl.bindFramebuffer(gl.FRAMEBUFFER, FB.out.fb); gl.viewport(0, 0, RW, RH);
  draw(gl, P.copy, [0, 0, RW, RH], { uBloomI: sc.bloom ?? 0.35 }, [RW, RH], { textures: { uTex: FB.scene.tex, uBloom: FB.q1.tex } });
  gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  for (const g of sc.glass || []) {
    if ((g.opacity ?? 1) <= 0.001) continue;
    const m = 80;
    draw(gl, P.glass, sr([g.cx - g.w / 2 - m, g.cy - g.h / 2 - m, g.w + 2 * m, g.h + 2 * m]), {
      uHalf: [g.w / 2 * S, g.h / 2 * S], uRadius: (g.r ?? 28) * S, uOpacity: g.opacity ?? 1, uTintC: g.tint || [0.06, 0.03, 0.035], uTintA: g.tintA ?? 0.35,
      uSpec: (g.spec ?? -9999) * S, uShadow: g.shadow ?? 1, uBorder: g.border ?? 1,
    }, [RW, RH], { rot: g.rot || 0, textures: { uBlur: FB.q1.tex } });
  }
  if (sc.top && sc.top.length) drawLayerCanvas({ draw: (x) => { for (const L of sc.top) { x.save(); L.draw(x); x.restore(); } } }, li++);
  return sc;
}

let lastSc = null;
window.renderFrame = async (f) => {
  gl.bindFramebuffer(gl.FRAMEBUFFER, FB.acc.fb); gl.viewport(0, 0, RW, RH);
  gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
  for (let k = 0; k < SUBS; k++) {
    const t = (f + (SUBS === 1 ? 0 : ((k + 0.5) / SUBS - 0.5) * SHUTTER)) / FPS;
    lastSc = renderSub(Math.max(0, t));
    gl.bindFramebuffer(gl.FRAMEBUFFER, FB.acc.fb); gl.viewport(0, 0, RW, RH);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
    draw(gl, P.acc, [0, 0, RW, RH], { uW: 1 / SUBS }, [RW, RH], { textures: { uTex: FB.out.tex } });
  }
  const sc = story.at(f / FPS);
  gl.disable(gl.BLEND);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, RW, RH);
  draw(gl, P.out, [0, 0, RW, RH], { uFrame: f, uVig: 0.55, uGrain: 0.045, uFade: sc.fade ?? 1 }, [RW, RH], { textures: { uTex: FB.acc.tex } });
  gl.finish();
  return true;
};
window.compositorInfo = { W, H, RW, RH, FORMAT, SUBS }; window.__story = () => story; window.__A = A;
init().then(() => { window.ready = true; }).catch((e) => { console.error('init: ' + e.message + '\n' + e.stack); window.initError = String(e); });
