// Coreografia de DIPROLASER: story.at(t) describe el instante t (segundos). Determinista.
// Todos los tiempos salen de timeline/vo_words.json (voz real); ninguno esta escrito a ojo
// salvo los desfases cortos de anticipacion de cada movimiento.
import { text, letters, FONTS, waIcon, rrect, font, ink } from './type.mjs';

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const seg = (t, a, b) => clamp((t - a) / (b - a));
const sm = (x) => { x = clamp(x); return x * x * (3 - 2 * x); };
const eio = (x) => { x = clamp(x); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
const eo = (x) => 1 - Math.pow(1 - clamp(x), 3);
const eo5 = (x) => 1 - Math.pow(1 - clamp(x), 5);
const ei = (x) => Math.pow(clamp(x), 3);
const back = (x, c1 = 1.4) => { x = clamp(x); const c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
const env = (t, a0, a1, b0, b1) => sm(seg(t, a0, a1)) * (1 - sm(seg(t, b0, b1)));
const TAU = Math.PI * 2;

const COL = {
  negro: { c: [0.03, 0.03, 0.03], m: 2 }, azul: { c: [0.06, 0.17, 0.62], m: 1 }, verde: { c: [0.25, 0.27, 0.11], m: 1 },
  rosa: { c: [0.94, 0.70, 0.80], m: 1 }, crema: { c: [0.94, 0.90, 0.81], m: 3 }, rojo: { c: [0.89, 0.15, 0.18], m: 1 },
  cRojo: { c: [0.82, 0.10, 0.13], m: 1 }, cNegro: { c: [0.03, 0.03, 0.03], m: 2 }, cDorado: { c: [0.86, 0.68, 0.33], m: 1 },
};

export function buildStory({ W, H, FORMAT, A, SAFE }) {
  const SQ = FORMAT === '11';
  const words = A.words;
  const Wt = (txt, nth = 1, after = 0) => {
    let c = 0;
    for (const w of words) {
      const k = w.w.replace(/[.,]/g, '').toLowerCase();
      if (w.s >= after && k === txt.toLowerCase()) { c++; if (c === nth) return w.s; }
    }
    throw new Error('palabra ' + txt);
  };
  const SC = Object.fromEntries(A.timeline.scenes.map((s) => [s.id, s]));
  const cues = A.timeline.cues;
  const cueT = (kind, i) => cues.filter((c) => c.kind === kind)[i].t;

  // tiempos clave (voz)
  const T = {
    llegan: Wt('llegan'), y1: Wt('y', 1), quedan: Wt('quedan'),
    una: Wt('una'), vez: Wt('vez'), y2: Wt('y', 1, 4.5), otra1: Wt('otra', 1), y3: Wt('y', 1, 5.6), mas: Wt('más'),
    anio: Wt('año'), dales: Wt('dales'), gracias1: Wt('gracias'), algo: Wt('algo'), olvide: Wt('olvide'),
    logo: Wt('logo'), negocio: Wt('negocio'), suyo: Wt('suyo'),
    grabado: Wt('grabado'), laser: Wt('láser'), impreso: Wt('impreso'), todo: Wt('todo'), color: Wt('color'),
    porque: Wt('porque'), gracias2: Wt('gracias', 2), por2: Wt('por', 1, 20.5), estar: Wt('estar'),
    dipro: Wt('diprolaser'), promo: Wt('promocionales'),
    consiente: Wt('consiente'), a8: Wt('a', 1, 27), tus: Wt('tus'), clientes: Wt('clientes', 1, 27), este: Wt('este', 1, 27.5),
    escribe: Wt('escríbenos'), n449: Wt('449'), n212: Wt('212'), n8627: Wt('8627'),
  };
  const S1 = SC.S1, S2 = SC.S2, S3 = SC.S3, S4 = SC.S4, S5 = SC.S5, S6 = SC.S6, S7 = SC.S7, S8 = SC.S8;
  const ENG_T = cues.filter((c) => c.kind === 'engrave' && c.what.startsWith('Cambio')).map((c) => c.t);
  const COLOR_T = cues.filter((c) => c.kind === 'recolor').map((c) => c.t);
  const TAG_T = cues.filter((c) => c.kind === 'tag').map((c) => c.t);
  const CX = W / 2;

  // ---------------------------------------------------------------------------------------------
  // Layout por formato (9:16 principal; 1:1 reacomodado, no recortado)
  const L = SQ ? {
    heroX: 770, heroBase: 960, heroH: 560, pedW: 380,
    textX: 315, s1Y1: 400, s1Y2: 520, s1Size: 112, lleganY: 300,
    cardX: 290, cardY: [310, 440, 570], cardW: 440,
    ring: { cx: 700, base: 830, R: 380, zc: 520, tilt: 55 },
    box: { x: 690, y: 690, e: 200 }, graciasY: 150, graciasSize: 140,
    gifts: [{ k: 'anfora_negra_grabado_diprolaser', x: 720, b: 480, h: 250 }, { k: 'set_regalo_pluma_tarjetero_navaja_llavero', x: 930, b: 520, h: 150 }, { k: 'estuche_vip_grabado_diprolaser', x: 480, b: 520, h: 95 }],
    tag: { x: 250, y: 720 },
    vaso: { x: 700, base: 1000, h: 680 }, chip: { x: 290, y: 540 },
    s5: { rot: -1.38, termo: { x: 290, b: 840, h: 500 }, mug: { x: 800, b: 860, h: 470 }, head: { x: 290 }, laserTxt: [270, 150], colorTxt: [800, 925], colorTxt2: [800, 1005] },
    s6: { cx: 540, cy: 720, scale: 0.78, title: [130, 240], titleSize: [128, 96] },
    s7: { x: 540, y: 470, logoW: 620, promoY: 820 },
    s8: { logoY: 140, logoW: 300, promoY: 255, l1: 380, l2: 480, l3: 590, size: 88, pill: [540, 760, 760, 120], redes: 880, envios: 930, ringBase: 1180 },
    floorY: 960, glowY: 560,
  } : {
    heroX: 540, heroBase: 1395, heroH: 690, pedW: 460,
    textX: 540, s1Y1: 470, s1Y2: 610, s1Size: 170, lleganY: 520,
    cardX: 540, cardY: [330, 465, 600], cardW: 560,
    ring: { cx: 540, base: 1250, R: 460, zc: 560, tilt: 70 },
    box: { x: 540, y: 1170, e: 255 }, graciasY: 440, graciasSize: 168,
    gifts: [{ k: 'anfora_negra_grabado_diprolaser', x: 560, b: 900, h: 300 }, { k: 'set_regalo_pluma_tarjetero_navaja_llavero', x: 820, b: 880, h: 175 }, { k: 'estuche_vip_grabado_diprolaser', x: 285, b: 880, h: 105 }],
    tag: { x: 215, y: 1235 },
    vaso: { x: 540, base: 1420, h: 860 }, chip: { x: 540, y: 395 },
    s5: { rot: -0.17, termo: { x: 330, b: 900, h: 560 }, mug: { x: 760, b: 1560, h: 520 }, laserTxt: [790, 560], colorTxt: [300, 1215], colorTxt2: [300, 1330] },
    s6: { cx: 540, cy: 1180, scale: 1, title: [420, 560], titleSize: [150, 112] },
    s7: { x: 540, y: 880, logoW: 700, promoY: 1175 },
    s8: { logoY: 400, logoW: 420, promoY: 560, l1: 720, l2: 830, l3: 960, size: 100, pill: [540, 1160, 880, 140], redes: 1340, envios: 1410, ringBase: 1720 },
    floorY: 1330, glowY: 1000,
  };

  // ---------------------------------------------------------------------------------------------
  // Camara: siempre deriva; zoom por escena con eases largos
  const ZK = [[0, 1.07], [S1.t1, 1.0], [S2.t1, 0.985], [S3.t1, 1.0], [S4.t1, 1.015], [S5.t1, 1.0], [S6.t1 - 0.2, 1.045], [S7.t1, 1.0], [S8.t1, 1.0], [35.5, 0.93]];
  function cam(t) {
    let z = ZK[0][1];
    for (let i = 0; i < ZK.length - 1; i++) if (t >= ZK[i][0]) z = lerp(ZK[i][1], ZK[i + 1][1], eio(seg(t, ZK[i][0], ZK[i + 1][0])));
    z += 0.008 * Math.sin(t * 0.45);
    let ox = 14 * Math.sin(t * 0.23 + 0.5), oy = 10 * Math.sin(t * 0.19);
    // golpe del logo
    const imp = Math.exp(-Math.max(0, t - T.dipro) * 9) * (t > T.dipro ? 1 : 0);
    oy += imp * 6 * Math.sin((t - T.dipro) * 70);
    return { z, ox, oy, cx: CX, cy: H * 0.5 };
  }
  const camPt = (c, x, y, par = 1) => [c.cx + (x - c.cx) * lerp(1, c.z, par) + c.ox * par, c.cy + (y - c.cy) * lerp(1, c.z, par) + c.oy * par];
  const camCtx = (ctx, c, par = 1) => { const z = lerp(1, c.z, par); ctx.transform(z, 0, 0, z, c.cx - c.cx * z + c.ox * par, c.cy - c.cy * z + c.oy * par); };

  // producto en coordenadas de escenario -> rect en pantalla
  const tsize = (k) => [A.prod[k].w, A.prod[k].h];
  function item(c, key, x, base, h, extra = {}) {
    const [tw, th] = tsize(key);
    const w = h * tw / th * (extra.squash ?? 1);
    const [sx, sy] = camPt(c, x, base, extra.par ?? 1);
    const z = lerp(1, c.z, extra.par ?? 1);
    return { key, rect: [sx - w * z / 2, sy - h * z, w * z, h * z], z: extra.z ?? 0, ...extra };
  }
  // mapeo letrero (lx, ly) -> pantalla para un producto con grabado/impresion
  function labelPt(it, lx, ly, ang, aspect, phase = 0) {
    const m = A.meta[it.key].engrave; const [tw, th] = tsize(it.key);
    const thv = (lx - 0.5) * ang + phase; const u = Math.sin(thv);
    const lh = ang * m.hw / aspect;
    const px = m.cx + u * m.hw, py = m.cy + (ly - 0.5) * lh;
    return [it.rect[0] + px / tw * it.rect[2], it.rect[1] + py / th * it.rect[3], Math.cos(thv)];
  }
  const LBL = (k) => ({ logo: A.labels.logo.aspect, seal: 1 }[k] ?? A.labels.clavo.aspect);

  // ---------------------------------------------------------------------------------------------
  // Carrusel: anillo detras del heroe. Angulo = integral de una velocidad suave (tabla, determinista)
  const RING = ['termo_negro_2', 'vaso_azul_1', 'llavero_cinta_roja', 'vaso_verde_2', 'vaso_asa_crema', 'llavero_llanta', 'vaso_rosa_2', 'llavero_cinta_azul'];
  const RH_ = { termo_negro_2: 430, vaso_azul_1: 400, llavero_cinta_roja: 140, vaso_verde_2: 440, vaso_asa_crema: 450, llavero_llanta: 420, vaso_rosa_2: 440, llavero_cinta_azul: 135 };
  const SPK = [[0, 0], [S2.t0, 0.15], [S2.t0 + 0.6, 0.45], [S3.t0, 0.32], [S4.t0, 0.95], [S4.t1, 0.9], [S5.t0 + 0.5, 0.25], [S8.t0, 0.25], [35.5, 0.2]];
  const spd = (t) => { let v = 0; for (let i = 0; i < SPK.length - 1; i++) if (t >= SPK[i][0]) v = lerp(SPK[i][1], SPK[i + 1][1], sm(seg(t, SPK[i][0], SPK[i + 1][0]))); return v; };
  const ANG = new Float32Array(Math.ceil(36 * 240) + 2);
  for (let i = 1; i < ANG.length; i++) ANG[i] = ANG[i - 1] + spd((i - 0.5) / 240) / 240;
  const ringAng = (t) => { const f = clamp(t, 0, 36) * 240; const i = Math.floor(f); return lerp(ANG[i], ANG[i + 1], f - i); };
  // entradas: 2 al arrancar, 3 en los beats de "una vez / otra / otra mas", 3 mas durante S3 (fuera de foco)
  const ENTER_T = [S2.t0 + 0.05, S2.t0 + 0.2, T.vez, T.otra1, T.mas, S3.t0 + 0.6, S3.t0 + 1.2, S3.t0 + 1.8];
  const slotEnter = new Array(RING.length).fill(99);
  {
    const free = RING.map((_, i) => i);
    ENTER_T.forEach((te, j) => {
      const target = [2.4, -2.4, 1.05, -1.05, 0.75, 2.9, -2.9, 3.14][j];
      let best = free[0], bd = 1e9;
      for (const s of free) {
        let a = (ringAng(te) + s * TAU / RING.length) % TAU; if (a > Math.PI) a -= TAU;
        const d = Math.abs(a - target); if (d < bd) { bd = d; best = s; }
      }
      slotEnter[best] = te; free.splice(free.indexOf(best), 1);
    });
  }
  // visibilidad/estilo del anillo por tiempo
  function ringStyle(t) {
    const show = env(t, S2.t0 - 0.1, S2.t0 + 0.3, S5.t0 - 0.1, S5.t0 + 0.35) + env(t, S8.t0 + 0.3, S8.t0 + 1.4, 40, 41);
    const dim = t < S3.t0 ? 1 : t < S4.t0 ? lerp(1, 0.45, sm(seg(t, S3.t0, S3.t0 + 0.5))) + lerp(0, 0.55, sm(seg(t, S4.t0 - 0.3, S4.t0 + 0.2))) : t < S8.t0 ? 1 : 0.5;
    const blur = t < S3.t0 ? 1 : t < S4.t0 ? 2.6 : t < S5.t0 ? 1 : 6;
    const base = t < S8.t0 ? L.ring.base : L.s8.ringBase;
    return { show, dim, blur, base };
  }
  function ringItems(t, c, extra) {
    const st = ringStyle(t);
    if (st.show <= 0.001) return [];
    const out = [];
    const a0 = ringAng(t);
    RING.forEach((key, i) => {
      const te = slotEnter[i];
      if (t < te) return;
      const pop = back(seg(t, te, te + 0.42), 1.6);
      const a = a0 + i * TAU / RING.length;
      const r = L.ring;
      const x = r.cx + r.R * Math.sin(a);
      const zz = r.zc - r.R * Math.cos(a);           // profundidad (mayor = mas lejos)
      const s = 1500 / (1500 + zz);
      const yb = st.base + r.tilt * Math.cos(a) * 0.5;
      const front = Math.cos(a);
      const h = RH_[key] * s * pop;
      const sx = c.cx + (x - c.cx) * s;               // perspectiva alrededor del centro
      const it = item(c, key, sx, yb, h, { z: zz, opacity: st.show * clamp(seg(t, te, te + 0.12)) * lerp(0.55, 1, (front + 1) / 2) * st.dim,
        blur: (0.4 + Math.max(0, zz - 150) * 0.006) * st.blur, refl: t < S8.t0, shadow: 0.6, reflGap: 2, specI: 0.6, specX: 0.3 + 0.15 * Math.sin(a), ...extra });
      // grano de luz al entrar: golpe suave
      it.tint = [1 + 0.6 * Math.exp(-(t - te) * 7), 1 + 0.35 * Math.exp(-(t - te) * 7), 1 + 0.35 * Math.exp(-(t - te) * 7)];
      out.push(it);
    });
    return out;
  }

  // ---------------------------------------------------------------------------------------------
  // Secuencia de color (S4) y nombres
  const SEQ = ['negro', 'azul', 'verde', 'rosa', 'crema', 'rojo'];
  const RIB = [null, 'cRojo', 'cNegro', 'cDorado', 'cDorado', 'cDorado'];
  const SWEEP_D = 0.55;
  function colorState(t, isRibbon) {
    // indice actual y barrido en curso
    let k = 0; for (let i = 0; i < COLOR_T.length; i++) if (t >= COLOR_T[i] - 0.12) k = i + 1;
    const seq = isRibbon ? RIB : SEQ;
    const prev = k === 0 ? null : seq[k - 1];
    const next = seq[Math.min(k, seq.length - 1)];
    const t0 = k === 0 ? -99 : COLOR_T[k - 1] - 0.12;
    const p = seg(t, t0, t0 + SWEEP_D);
    const dir = [0.94, 0.342];
    const span = W * dir[0] + H * dir[1];
    const sweep = lerp(-260, span + 260, eio(p));
    const cA = prev ? COL[prev] : null, cB = COL[next] || null;
    return { a: cA ? cA.c : [1, 1, 1], amode: cA ? cA.m : 0, b: cB ? cB.c : [1, 1, 1], bmode: cB ? cB.m : 0, sweep: k === 0 ? -1e5 : sweep, dir };
  }
  function heroColor(t) {
    const s = colorState(t, false);
    if (s.amode === 0 && s.sweep === -1e5) return { a: COL.negro.c, amode: 2, b: COL.negro.c, bmode: 2, sweep: -1e5, dir: s.dir };
    if (COLOR_T.length && t < COLOR_T[0] + 1 && s.amode === 0) return { ...s, a: COL.negro.c, amode: 2 };
    return s;
  }
  const NAMES = ['clavo', 'ruiz', 'davila', 'espiga', 'seal'];
  function nameState(t) {
    let k = -1; for (let i = 0; i < ENG_T.length; i++) if (t >= ENG_T[i]) k = i;
    if (k < 0) return { label: 'logo', reveal: 1, wipe: 0, ang: 1.55, writing: false };
    const tk = ENG_T[k];
    const prev = k === 0 ? 'logo' : NAMES[k - 1];
    const angOf = (l) => (l === 'logo' ? 1.55 : l === 'seal' ? 1.3 : 2.0);
    if (t < tk + 0.12) return { label: prev, reveal: 1, wipe: eio(seg(t, tk, tk + 0.12)) * 1.02, ang: angOf(prev), writing: false, wipeP: seg(t, tk, tk + 0.12) };
    const p = seg(t, tk + 0.12, tk + 0.42);
    return { label: NAMES[k], reveal: p < 1 ? lerp(-0.02, 1.02, p) : 1, wipe: 0, ang: angOf(NAMES[k]), writing: p < 1, p };
  }

  // ---------------------------------------------------------------------------------------------
  // Campo liquido (UNA funcion para toda la pieza)
  function liquidAt(t) {
    const B = L.box;
    const balls = [];
    // S3: sube y forma la caja, luego el mono
    if (t > S3.t0 - 0.35 && t < S4.t0 + 0.6) {
      const rise = eo(seg(t, S3.t0 - 0.35, T.anio));
      for (let i = 0; i < 11; i++) {
        const a = i * 2.399 + t * (0.6 + hash(i) * 0.5);
        const r0 = (1 - rise) * (220 + 160 * hash(i + 3)) + 40;
        const x = B.x + Math.cos(a) * r0 * 0.8;
        const y = lerp(H + 160 + 220 * hash(i + 9), B.y, rise) + Math.sin(a) * r0 * 0.45;
        balls.push([x, y, (34 + 30 * hash(i + 5)) * lerp(0.8, 1.2, rise)]);
      }
      const lid = lidPose(t);
      const bowC = [lid.x + B.x, lid.y + B.y - B.e * 0.5 - 28];
      const hexW = sm(seg(t, S3.t0 + 0.05, T.anio + 0.05)) * (1 - sm(seg(t, T.anio + 0.06, T.anio + 0.42)));
      const bowW = sm(seg(t, T.anio + 0.06, T.anio + 0.42));
      // al terminar S3, el mono se derrite en gotas que caen
      const melt = seg(t, S4.t0 - 0.15, S4.t0 + 0.5);
      if (melt > 0) for (let i = 0; i < balls.length; i++) { balls[i][0] = bowC[0] + (hash(i) - 0.5) * 160; balls[i][1] = bowC[1] + ei(melt) * (500 + 300 * hash(i + 1)); balls[i][2] *= 0.55; }
      return {
        balls, k: 70, t,
        shapeA: hexW > 0 ? { kind: 1, x: B.x, y: B.y, size: B.e * 1.0, w: hexW } : null,
        shapeB: bowW > 0 && melt < 0.25 ? { kind: 2, x: bowC[0], y: bowC[1], size: B.e * 0.62, w: bowW * (1 - sm(seg(melt, 0, 0.25))) } : null,
        opacity: 1 - sm(seg(t, S4.t0 + 0.2, S4.t0 + 0.6)),
        rect: [0, 0, W, H],
      };
    }
    // S6 -> S7: gotas salen de los regalos y se juntan en la X
    if (t > S6.t1 - 0.45 && t < S7.t0 + 1.1) {
      const g = eio(seg(t, S6.t1 - 0.45, S7.t0 + 0.08));
      const X = L.s7;
      for (let i = 0; i < 14; i++) {
        const sx = L.s7.x + (hash(i + 21) - 0.5) * W * 0.7, sy = L.s7.y + (hash(i + 31) - 0.3) * H * 0.3;
        const a = i * 2.399 + t * 1.3;
        const rr = (1 - g) * 120 + 30;
        balls.push([lerp(sx, X.x, g) + Math.cos(a) * rr * (1 - g), lerp(sy, X.y, g) + Math.sin(a) * rr * (1 - g), 34 + 26 * hash(i + 7)]);
      }
      const xw = sm(seg(t, S6.t1 - 0.15, S7.t0 + 0.15));
      return { balls, k: 64, t, shapeA: xw > 0 ? { kind: 3, x: X.x, y: X.y, size: X.logoW * 0.5, w: xw } : null,
        opacity: (1 - sm(seg(t, T.dipro + 0.05, T.dipro + 0.45))) * sm(seg(t, S6.t1 - 0.45, S6.t1 - 0.25)), rect: [0, 0, W, H] };
    }
    return null;
  }

  // pose de la tapa de la caja (relativa al centro de la caja)
  function lidPose(t) {
    const p = eo(seg(t, T.dales, T.dales + 0.75));
    const B = L.box;
    return { x: -B.e * 0.62 * p, y: -B.e * 0.36 * p - Math.sin(p * Math.PI) * 40, rot: -0.32 * p, p };
  }

  // ---------------------------------------------------------------------------------------------
  // Caja isometrica (lienzo 2D, coordenadas de escenario)
  function isoPts(B) {
    const e = B.e;
    return { T: [0, -e], UR: [0.866 * e, -0.5 * e], LR: [0.866 * e, 0.5 * e], B: [0, e], LL: [-0.866 * e, 0.5 * e], UL: [-0.866 * e, -0.5 * e], C: [0, 0] };
  }
  function poly(ctx, pts) { ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.closePath(); }
  function faceXf(ctx, o, a, b) { ctx.transform(a[0] - o[0], a[1] - o[1], b[0] - o[0], b[1] - o[1], o[0], o[1]); } // (u,v) unitario -> cara
  function ribbon(ctx, alpha) {
    const g = ctx.createLinearGradient(0, 0, 1, 0); g.addColorStop(0, '#9E1219'); g.addColorStop(0.5, '#E3262F'); g.addColorStop(1, '#9E1219');
    ctx.globalAlpha = alpha; ctx.fillStyle = g; ctx.fillRect(0.44, 0, 0.12, 1);
  }
  function drawBoxFaces(ctx, B, alpha, which) {
    const P = isoPts(B);
    ctx.save(); ctx.translate(B.x, B.y);
    const faces = {
      left: { pts: [P.UL, P.C, P.B, P.LL], c0: '#17100F', c1: '#0B0707', o: P.UL, a: P.C, b: P.LL },
      right: { pts: [P.C, P.UR, P.LR, P.B], c0: '#0D0909', c1: '#050304', o: P.C, a: P.UR, b: P.B },
    };
    for (const k of which) {
      const f = faces[k];
      ctx.save(); ctx.globalAlpha = alpha;
      poly(ctx, f.pts);
      const g = ctx.createLinearGradient(0, -B.e * 0.5, 0, B.e); g.addColorStop(0, f.c0); g.addColorStop(1, f.c1);
      ctx.fillStyle = g; ctx.fill();
      ctx.clip();
      ctx.save(); faceXf(ctx, f.o, f.a, f.b);
      if (k === 'left') { ctx.save(); ctx.transform(0, 1, 1, 0, 0, 0); ribbon(ctx, alpha); ctx.restore(); }
      else { ctx.save(); ctx.transform(1, 0, 0, 1, 0, 0); ribbon(ctx, alpha); ctx.restore(); }
      ctx.restore();
      ctx.restore();
      ctx.save(); ctx.globalAlpha = alpha * 0.9; poly(ctx, f.pts); ctx.strokeStyle = 'rgba(227,38,47,0.35)'; ctx.lineWidth = 1.6; ctx.stroke(); ctx.restore();
    }
    ctx.restore();
  }
  function drawLid(ctx, B, t, alpha) {
    const P = isoPts(B); const lp = lidPose(t);
    ctx.save(); ctx.translate(B.x + lp.x, B.y + lp.y); ctx.rotate(lp.rot); ctx.globalAlpha = alpha;
    const th = B.e * 0.16;
    // bandas laterales de la tapa
    poly(ctx, [P.UL, P.C, [P.C[0], P.C[1] + th], [P.UL[0], P.UL[1] + th]]); ctx.fillStyle = '#120C0C'; ctx.fill();
    poly(ctx, [P.C, P.UR, [P.UR[0], P.UR[1] + th], [P.C[0], P.C[1] + th]]); ctx.fillStyle = '#080506'; ctx.fill();
    // cara superior
    poly(ctx, [P.T, P.UR, P.C, P.UL]);
    const g = ctx.createLinearGradient(0, -B.e, 0, 0); g.addColorStop(0, '#2A1E20'); g.addColorStop(1, '#140D0E');
    ctx.fillStyle = g; ctx.fill();
    ctx.save(); poly(ctx, [P.T, P.UR, P.C, P.UL]); ctx.clip();
    ctx.save(); faceXf(ctx, P.T, P.UR, P.UL); ribbon(ctx, alpha); ctx.transform(0, 1, 1, 0, 0, 0); ribbon(ctx, alpha); ctx.restore();
    ctx.restore();
    ctx.globalAlpha = alpha; poly(ctx, [P.T, P.UR, P.C, P.UL]); ctx.strokeStyle = 'rgba(255,120,120,0.28)'; ctx.lineWidth = 1.6; ctx.stroke();
    ctx.restore();
  }
  function drawBoxInterior(ctx, B, t, alpha) {
    const P = isoPts(B); const lp = lidPose(t);
    ctx.save(); ctx.translate(B.x, B.y); ctx.globalAlpha = alpha;
    // boca abierta (rombo) con paredes interiores
    poly(ctx, [P.T, P.UR, P.C, P.UL]);
    const g = ctx.createLinearGradient(0, -B.e, 0, 0); g.addColorStop(0, '#050303'); g.addColorStop(1, '#1A0F0A');
    ctx.fillStyle = g; ctx.fill();
    // luz calida que sale
    const L1 = lp.p;
    if (L1 > 0) {
      ctx.globalCompositeOperation = 'lighter';
      const rg = ctx.createRadialGradient(0, -B.e * 0.5, 4, 0, -B.e * 0.5, B.e * 1.4);
      rg.addColorStop(0, `rgba(255,214,140,${0.85 * L1})`); rg.addColorStop(0.35, `rgba(216,178,92,${0.35 * L1})`); rg.addColorStop(1, 'rgba(216,178,92,0)');
      ctx.fillStyle = rg; ctx.fillRect(-B.e * 2, -B.e * 3, B.e * 4, B.e * 3.6);
      // rayos
      for (let i = 0; i < 9; i++) {
        const a = -Math.PI / 2 + (i - 4) * 0.16 + 0.04 * Math.sin(t * 0.7 + i);
        const len = B.e * (2.2 + 0.6 * hash(i)) * L1;
        const wdt = 0.035 + 0.03 * hash(i + 4);
        ctx.beginPath(); ctx.moveTo(0, -B.e * 0.5);
        ctx.lineTo(Math.cos(a - wdt) * len, -B.e * 0.5 + Math.sin(a - wdt) * len); ctx.lineTo(Math.cos(a + wdt) * len, -B.e * 0.5 + Math.sin(a + wdt) * len); ctx.closePath();
        const lg = ctx.createLinearGradient(0, -B.e * 0.5, Math.cos(a) * len, -B.e * 0.5 + Math.sin(a) * len);
        lg.addColorStop(0, `rgba(255,220,150,${0.22 * L1 * (0.7 + 0.3 * Math.sin(t * 2 + i))})`); lg.addColorStop(1, 'rgba(255,220,150,0)');
        ctx.fillStyle = lg; ctx.fill();
      }
    }
    ctx.restore();
  }

  // ---------------------------------------------------------------------------------------------
  // piezas de dibujo reutilizables
  function pedestal(ctx, x, y, w, alpha) {
    ctx.save(); ctx.globalAlpha = alpha;
    const h = w * 0.16, body = w * 0.22;
    ctx.beginPath(); ctx.ellipse(x, y + body, w / 2, h / 2, 0, 0, Math.PI); ctx.lineTo(x - w / 2, y); ctx.ellipse(x, y, w / 2, h / 2, 0, Math.PI, 0, true); ctx.closePath();
    const g = ctx.createLinearGradient(x - w / 2, 0, x + w / 2, 0); g.addColorStop(0, 'rgba(30,18,20,0.95)'); g.addColorStop(0.45, 'rgba(58,34,38,0.9)'); g.addColorStop(1, 'rgba(12,8,9,0.95)');
    ctx.fillStyle = g; ctx.fill();
    ctx.beginPath(); ctx.ellipse(x, y, w / 2, h / 2, 0, 0, TAU);
    const g2 = ctx.createRadialGradient(x, y, 4, x, y, w / 2); g2.addColorStop(0, 'rgba(70,40,45,0.55)'); g2.addColorStop(1, 'rgba(20,10,12,0.85)');
    ctx.fillStyle = g2; ctx.fill();
    ctx.strokeStyle = 'rgba(255,90,96,0.55)'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.beginPath(); ctx.ellipse(x, y, w / 2 - 6, h / 2 - 2, 0, Math.PI * 1.05, Math.PI * 1.6); ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.restore();
  }
  function sparks(ctx, x, y, t, n, seed, dirX = 1) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < n; i++) {
      const born = Math.floor(t * 60) / 60 - (i % 14) / 60;
      const age = t - born; const id = Math.floor(born * 60) * 31 + i + seed;
      const life = 0.18 + 0.12 * hash(id);
      if (age > life || age < 0) continue;
      const a = -Math.PI / 2 + (hash(id + 1) - 0.5) * 2.4 + (dirX > 0 ? 0.5 : -0.5);
      const v = 260 + 320 * hash(id + 2);
      const px = x + Math.cos(a) * v * age, py = y + Math.sin(a) * v * age + 900 * age * age;
      const k = 1 - age / life;
      ctx.strokeStyle = `rgba(255,${180 + 60 * k | 0},${120 * k | 0},${k})`; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px - Math.cos(a) * 10 * k, py - Math.sin(a) * 10 * k - 6 * age); ctx.stroke();
    }
    ctx.restore();
  }
  function smoke(ctx, x, y, t, alpha) {
    ctx.save();
    for (let j = 0; j < 3; j++) {
      ctx.beginPath();
      for (let i = 0; i <= 30; i++) {
        const k = i / 30; const yy = y - k * 160;
        const xx = x + Math.sin(k * 6 + t * 3 + j * 2) * 14 * k + Math.sin(k * 13 - t * 5) * 5 * k + j * 3;
        i ? ctx.lineTo(xx, yy) : ctx.moveTo(xx, yy);
      }
      const g = ctx.createLinearGradient(0, y, 0, y - 160); g.addColorStop(0, `rgba(200,190,190,${0.22 * alpha})`); g.addColorStop(1, 'rgba(200,190,190,0)');
      ctx.strokeStyle = g; ctx.lineWidth = 2.5 + j * 2; ctx.stroke();
    }
    ctx.restore();
  }
  function laserBeam(ctx, x0, y0, x1, y1, alpha) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = alpha;
    ctx.strokeStyle = 'rgba(255,40,50,0.35)'; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,90,90,0.95)'; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    const rg = ctx.createRadialGradient(x1, y1, 0, x1, y1, 26); rg.addColorStop(0, 'rgba(255,255,255,1)'); rg.addColorStop(0.25, 'rgba(255,80,80,0.9)'); rg.addColorStop(1, 'rgba(255,30,40,0)');
    ctx.fillStyle = rg; ctx.fillRect(x1 - 26, y1 - 26, 52, 52);
    ctx.restore();
  }
  function laserHead(ctx, x, y, alpha, rot = 0) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.globalAlpha = alpha;
    rrect(ctx, -70, -34, 150, 68, 14);
    const g = ctx.createLinearGradient(0, -34, 0, 34); g.addColorStop(0, '#2B2427'); g.addColorStop(1, '#0E0A0B');
    ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,0.14)'; ctx.lineWidth = 1.2; ctx.stroke();
    rrect(ctx, -84, -12, 20, 24, 4); ctx.fillStyle = '#1A1416'; ctx.fill();
    ctx.beginPath(); ctx.arc(-84, 0, 6, 0, TAU); ctx.fillStyle = '#FF3B44'; ctx.shadowColor = '#FF3B44'; ctx.shadowBlur = 16; ctx.fill(); ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(227,38,47,0.9)'; ctx.fillRect(-40, -22, 70, 3);
    ctx.restore();
  }
  function printHead(ctx, x, y, alpha, chan) {
    ctx.save(); ctx.translate(x, y); ctx.globalAlpha = alpha;
    const cc = { c: '0,190,235', m: '235,0,140', y: '255,220,0', k: '30,30,30' }[chan] || '180,120,255';
    // luz UV (violeta) + tinta del canal
    ctx.globalCompositeOperation = 'lighter';
    const lg = ctx.createLinearGradient(0, 18, 0, 130); lg.addColorStop(0, 'rgba(150,90,255,0.55)'); lg.addColorStop(1, 'rgba(150,90,255,0)');
    ctx.fillStyle = lg; ctx.beginPath(); ctx.moveTo(-34, 18); ctx.lineTo(34, 18); ctx.lineTo(56, 130); ctx.lineTo(-56, 130); ctx.closePath(); ctx.fill();
    ctx.fillStyle = `rgba(${cc},0.85)`; ctx.fillRect(-30, 18, 60, 3);
    ctx.globalCompositeOperation = 'source-over';
    rrect(ctx, -52, -26, 104, 46, 10);
    const g = ctx.createLinearGradient(0, -26, 0, 20); g.addColorStop(0, '#E9E6E2'); g.addColorStop(1, '#9C9893');
    ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.stroke();
    ['0,190,235', '235,0,140', '255,220,0', '30,30,30'].forEach((c, i) => { ctx.fillStyle = `rgb(${c})`; ctx.fillRect(-36 + i * 20, -14, 12, 12); });
    ctx.restore();
  }
  function giftTag(ctx, x, y, w, h, flip, msg, alpha, swing) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(swing); ctx.globalAlpha = alpha;
    // hilo
    ctx.strokeStyle = 'rgba(216,178,92,0.85)'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(0, -46); ctx.lineTo(0, 0); ctx.stroke();
    const sx = Math.abs(Math.cos(flip * Math.PI));
    ctx.scale(Math.max(sx, 0.02), 1);
    rrect(ctx, -w / 2, 0, w, h, 10);
    const front = flip >= 0.5;
    const g = ctx.createLinearGradient(0, 0, 0, h);
    if (front) { g.addColorStop(0, '#F7F0E2'); g.addColorStop(1, '#E6DAC2'); } else { g.addColorStop(0, '#D8C7A6'); g.addColorStop(1, '#BFAA83'); }
    ctx.fillStyle = g; ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 6; ctx.fill(); ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    ctx.beginPath(); ctx.arc(0, 12, 4.5, 0, TAU); ctx.fillStyle = 'rgba(60,40,25,0.55)'; ctx.fill();
    if (front) text(ctx, msg, 0, h * 0.58, { f: FONTS.ui(Math.round(h * 0.34), 700), style: '#3A2618' });
    ctx.restore();
  }

  // ---------------------------------------------------------------------------------------------
  // story.at(t)
  function at(t) {
    const c = cam(t);
    const layers = [];
    const top = [];
    const glass = [];
    const prodsBack = [], prods = [];
    const breathe = 0.86 + 0.14 * Math.sin(t * TAU / 3.2);
    const sc = { bg: { glow: [CX, L.glowY], glowR: 520, glowI: 0.55 * breathe, floorY: L.floorY, floorI: 0, glow2: [CX, L.glowY], glow2R: 400, glow2I: 0 }, layers, top, glass, bloom: 0.35, fade: 1 };

    // ===== Heroe S1-S2: termo negro sobre pedestal =========================================
    const heroVis = 1 - sm(seg(t, S3.t0 - 0.05, S3.t0 + 0.55));
    const pullBack = eio(seg(t, S2.t0 - 0.2, S2.t0 + 0.9));
    if (heroVis > 0.001) {
      const hb = lerp(L.heroBase, L.heroBase + (SQ ? 10 : 30), pullBack) + (1 - heroVis) * 140;
      const hh = lerp(L.heroH, L.heroH * 0.88, pullBack) * lerp(1, 0.8, 1 - heroVis);
      const it = item(c, 'termo_negro_1', L.heroX, hb, hh, {
        z: -200, opacity: heroVis, refl: true, reflGap: 4, reflFade: 0.18, shadow: 0.7,
        eng: { label: 'logo', phase: 0.07 * Math.sin(t * 0.9), ang: 1.55 },
        rim: 1.0 * (1 - pullBack * 0.6), rimY: ((t * 0.42) % 1.3) - 0.15, specI: 1, specX: 0.32 + 0.09 * Math.sin(t * 0.9),
      });
      prods.push(it);
      sc.bg.floorY = hb; sc.bg.floorI = 0.8 * heroVis;
      layers.push({ type: 'canvas', draw: (ctx) => { camCtx(ctx, c); pedestal(ctx, L.heroX, hb + 4, L.pedW * lerp(1, 0.92, pullBack), heroVis); } });
    }

    // ===== Carrusel ===================================================================
    const ring = ringItems(t, c, {});
    // REFACCIONARIA JUAREZ ya grabado en un producto del anillo (S4)
    for (const it of ring) {
      if (it.key === 'vaso_verde_2' && t > S4.t0 - 0.5) it.eng = { label: 'juarez', phase: 0, ang: 2.0 };
      if (t > S4.t0 - 0.3 && t < S5.t0 + 0.5) {
        if (A.meta[it.key] && A.meta[it.key].kind === 'pintura' && !it.key.startsWith('termo')) it.recolor = colorState(t, false);
        if (it.key.startsWith('llavero_cinta')) it.recolor = colorState(t, true);
      }
    }
    prodsBack.push(...ring);

    // ===== S1: kinetic =================================================================
    if (t < S2.t0 + 0.6) {
      top.push({ type: 'canvas', draw: (ctx) => {
        // LLEGAN: entra deslizandose y sigue de largo
        const p = seg(t, T.llegan - 0.25, T.y1 + 0.15);
        if (p > 0 && p < 1) {
          const u = p < 0.5 ? 0.5 * eo(p * 2) : 0.5 + 0.5 * ei((p - 0.5) * 2);
          const x = lerp(W + 520, -520, u);
          text(ctx, 'LLEGAN', x, L.lleganY, { f: FONTS.head(SQ ? 120 : 150), style: 'silver', tracking: 6, alpha: 0.95 });
        }
        // Y SE QUEDAN: aterriza en dorado y no se mueve
        const q = seg(t, T.y1, T.quedan + 0.08);
        const out = sm(seg(t, S2.t0 - 0.05, S2.t0 + 0.4));
        if (q > 0 && out < 1) {
          const k = eo5(q);
          text(ctx, 'Y SE', L.textX, L.s1Y1 - (1 - k) * 40, { f: FONTS.head(SQ ? 70 : 84), style: '#F2EDE6', tracking: 10, alpha: k * (1 - out) });
          const k2 = eo5(seg(t, T.y1 + 0.12, T.quedan + 0.22));
          text(ctx, 'QUEDAN', L.textX, L.s1Y2 - (1 - k2) * 50 - out * 30, { f: FONTS.head(L.s1Size), style: 'gold', tracking: lerp(30, 4, k2), alpha: k2 * (1 - out), scale: lerp(1.06, 1, k2) });
        }
      } });
    }

    // ===== S2: tarjetas de cristal "UNA VEZ / Y OTRA / Y OTRA MAS" =======================
    if (t > S2.t0 && t < S3.t0 + 0.5) {
      const cards = [{ s: 'UNA VEZ', t: T.una, mode: 'drop' }, { s: 'Y OTRA', t: T.y2, mode: 'left' }, { s: 'Y OTRA MÁS', t: T.y3, mode: 'pop' }];
      const exit = eio(seg(t, S3.t0 - 0.35, S3.t0 + 0.2));
      const shown = cards.filter((k) => t >= k.t - 0.18);
      const n = shown.length;
      shown.forEach((k, i) => {
        const p = seg(t, k.t - 0.18, k.t + 0.32);
        const e = k.mode === 'pop' ? back(p, 2.2) : eo5(p);
        const slot = n - 1 - i;                  // 0 = la mas nueva (abajo, al frente)
        const targetY = L.cardY[2 - slot] ?? L.cardY[0];
        // las tarjetas viejas suben suavemente cuando llega una nueva
        let y = targetY;
        if (i < n - 1) { const pn = eo(seg(t, shown[n - 1].t - 0.18, shown[n - 1].t + 0.25)); y = lerp(L.cardY[2 - (slot - 1)] ?? targetY, targetY, pn); }
        let x = L.cardX, sc_ = lerp(1, 0.9, slot * 0.5), a = lerp(1, 0.72, slot * 0.5);
        if (k.mode === 'drop') y -= (1 - e) * 120;
        if (k.mode === 'left') x -= (1 - e) * 520;
        const s2 = k.mode === 'pop' ? lerp(0.6, 1, e) : 1;
        a *= clamp(p * 3) * (1 - exit);
        y -= exit * 160;
        const w = L.cardW * sc_ * s2, h = 112 * sc_ * s2;
        glass.push({ cx: x, cy: y, w, h, r: 26 * sc_, opacity: a, spec: lerp(-400, 400, seg(t, k.t, k.t + 1.4)), tintA: 0.4 });
        top.push({ type: 'canvas', draw: (ctx) => text(ctx, k.s, x, y, { f: FONTS.head(Math.round(62 * sc_ * s2)), style: i === n - 1 ? '#FFFFFF' : '#E9E3DC', tracking: 3, alpha: a }) });
      });
    }

    // ===== S3: liquido -> caja -> se abre -> regalos -> GRACIAS + etiqueta ==================
    const liq = liquidAt(t);
    const B = L.box;
    const boxOn = t > S3.t0 && t < S4.t0 + 0.6;
    const boxOut = sm(seg(t, S4.t0 - 0.2, S4.t0 + 0.35));
    const boxIn = sm(seg(t, T.anio - 0.12, T.anio + 0.25));
    const opened = t >= T.dales;
    if (boxOn) {
      sc.bg.glow = [B.x, B.y - B.e * 0.2]; sc.bg.glowI = lerp(sc.bg.glowI, 0.4, 0.5);
      sc.bg.glow2 = [B.x, B.y - B.e * 0.9]; sc.bg.glow2R = 520; sc.bg.glow2I = 0.55 * lidPose(t).p * (1 - boxOut);
      const by = B.y + boxOut * 260;
      const BB = { ...B, y: by };
      const alpha = boxIn * (1 - boxOut);
      if (opened) layers.push({ type: 'canvas', draw: (ctx) => { camCtx(ctx, c); drawBoxInterior(ctx, BB, t, alpha); drawLid(ctx, BB, t, alpha); } });
    }
    // liquido ajustado a camara (una vez)
    const liqC = liq && { ...liq, balls: liq.balls.map((b) => { const p = camPt(c, b[0], b[1]); return [p[0], p[1], b[2] * c.z]; }),
      shapeA: liq.shapeA && (() => { const p = camPt(c, liq.shapeA.x, liq.shapeA.y); return { ...liq.shapeA, x: p[0], y: p[1], size: liq.shapeA.size * c.z }; })(),
      shapeB: liq.shapeB && (() => { const p = camPt(c, liq.shapeB.x, liq.shapeB.y); return { ...liq.shapeB, x: p[0], y: p[1], size: liq.shapeB.size * c.z }; })() };
    const liqBehind = liqC && ((opened && t < S5.t0) || (t > S6.t0 && t < S7.t0 + 0.05));   // detras de los regalos   // con la caja abierta, el mono va sobre la tapa (detras de los regalos)
    layers.push({ type: 'products', items: prodsBack });
    if (liqBehind) layers.push({ type: 'liquid', ...liqC });
    // regalos que suben
    if (t > T.algo - 0.2 && t < S4.t0 + 0.8) {
      L.gifts.forEach((g, i) => {
        const p = eo(seg(t, T.algo - 0.15 + i * 0.12, T.algo + 0.75 + i * 0.12));
        const out = eio(seg(t, S4.t0 - 0.25 + i * 0.05, S4.t0 + 0.4 + i * 0.05));
        const bob = Math.sin(t * 1.6 + i * 2) * 6;
        const base = lerp(B.y - B.e * 0.2, g.b, p) + bob - out * 420;
        const x = lerp(B.x, g.x, p);
        prods.push(item(c, g.k, x, base, g.h * lerp(0.6, 1, p), { z: -260, opacity: clamp(p * 4) * (1 - out), warm: 0.35, specI: 0.4, shadow: 0 }));
      });
    }
    layers.push({ type: 'products', items: prods });
    if (boxOn) {
      const by = B.y + boxOut * 260;
      const BB = { ...B, y: by };
      const alpha = boxIn * (1 - boxOut);
      layers.push({ type: 'canvas', draw: (ctx) => { camCtx(ctx, c); drawBoxFaces(ctx, BB, alpha, ['left', 'right']); if (!opened) drawLid(ctx, BB, t, alpha); } });
    }
    if (liqC && !liqBehind) layers.push({ type: 'liquid', ...liqC });
    if (t > T.gracias1 - 0.3 && t < S4.t0 + 0.4) {
      const k = eo5(seg(t, T.gracias1 - 0.12, T.gracias1 + 0.65));
      const out = sm(seg(t, S4.t0 - 0.3, S4.t0 + 0.15));
      top.push({ type: 'canvas', draw: (ctx) => {
        text(ctx, 'GRACIAS', CX, L.graciasY - out * 60, { f: FONTS.head(L.graciasSize), style: 'gold', tracking: lerp(70, 4, k), alpha: clamp(k * 1.6) * (1 - out), glow: 'rgba(216,178,92,0.35)', glowR: 40 });
      } });
      // etiqueta de cristal que cuelga del mono
      const tp = seg(t, T.olvide - 0.1, T.olvide + 0.5);
      if (tp > 0) {
        const lp = lidPose(t);
        const [bx, by] = camPt(c, B.x + lp.x, B.y + lp.y - B.e * 0.5 + boxOut * 260);
        const swing = Math.sin((t - T.olvide) * 3.1) * 0.16 * Math.exp(-(t - T.olvide) * 0.9);
        const [tx, ty] = camPt(c, L.tag.x, L.tag.y + boxOut * 260);
        const tw = SQ ? 300 : 360, th = 112;
        const a = eo(tp) * (1 - out);
        glass.push({ cx: tx, cy: ty + (1 - eo(tp)) * -40, w: tw, h: th, r: 22, rot: swing, opacity: a, tintA: 0.45, spec: lerp(-300, 300, seg(t, T.olvide, T.olvide + 1.2)) });
        top.push({ type: 'canvas', draw: (ctx) => {
          ctx.save(); ctx.globalAlpha = a;
          ctx.strokeStyle = 'rgba(216,178,92,0.8)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(bx, by); ctx.quadraticCurveTo((bx + tx) / 2, Math.max(by, ty) - 20, tx, ty - th / 2 + (1 - eo(tp)) * -40); ctx.stroke();
          ctx.restore();
          ctx.save(); ctx.translate(tx, ty + (1 - eo(tp)) * -40); ctx.rotate(swing);
          text(ctx, 'GRACIAS POR', 0, -18, { f: FONTS.ui(SQ ? 26 : 30, 800), style: '#F4EEE6', tracking: 4, alpha: a });
          text(ctx, 'TU PREFERENCIA', 0, 22, { f: FONTS.ui(SQ ? 26 : 30, 800), style: 'gold', tracking: 4, alpha: a });
          ctx.restore();
        } });
      }
    }

    // ===== S4: heroe vaso que se personaliza ================================================
    const s4in = eo(seg(t, S4.t0 - 0.15, S4.t0 + 0.45));
    const s4out = eio(seg(t, S5.t0 - 0.45, S5.t0 + 0.02));
    if (s4in > 0 && s4out < 1) {
      const V = L.vaso;
      const base = lerp(V.base + 380, V.base, s4in) + s4out * 60;
      const ns = nameState(t);
      const it = item(c, 'vaso_rosa_1', V.x - s4out * 520, base, V.h * lerp(1, 0.8, s4out), {
        z: -220, opacity: s4in * (1 - s4out), refl: true, reflGap: 3, reflFade: 0.2, shadow: 0.8, specI: 1, specX: 0.3,
        recolor: heroColor(t), eng: { label: ns.label, reveal: ns.reveal, wipe: ns.wipe, ang: ns.ang, phase: 0.04 * Math.sin(t * 0.7) },
      });
      prods.push(it);
      sc.bg.floorY = camPt(c, 0, base)[1]; sc.bg.floorI = 0.85 * s4in * (1 - s4out);
      layers.push({ type: 'canvas', draw: (ctx) => { camCtx(ctx, c); pedestal(ctx, V.x - s4out * 240, base + 4, (SQ ? 360 : 420), s4in * (1 - s4out)); } });
      // laser que escribe el nombre nuevo
      if (ns.writing) {
        const ang = ns.ang, asp = LBL(ns.label);
        const ly = 0.5 + 0.42 * Math.sin(t * 95);
        const [px, py] = labelPt(it, clamp(ns.reveal), ly, ang, asp, 0.04 * Math.sin(t * 0.7));
        top.push({ type: 'canvas', draw: (ctx) => { laserBeam(ctx, px + 220, py - 640, px, py, 1); sparks(ctx, px, py, t, 10, 7, -1); } });
      }
      // chip de cristal TU LOGO -> TU NEGOCIO -> SU NOMBRE
      const chips = [{ s: 'TU LOGO', t: T.logo }, { s: 'TU NEGOCIO', t: T.negocio }, { s: 'SU NOMBRE', t: T.suyo }];
      const cIn = back(seg(t, T.logo - 0.3, T.logo + 0.05), 1.8);
      const cOut = eio(seg(t, S5.t0 - 0.35, S5.t0 + 0.05));
      if (cIn > 0) {
        let k = 0; chips.forEach((ch, i) => { if (t >= ch.t - 0.12) k = i; });
        const f = FONTS.ui(SQ ? 40 : 46, 800);
        const wNow = (s) => { const cv = getMeasure(); font(cv, f, 8); return ink(cv, s).w; };
        const prevW = k > 0 ? wNow(chips[k - 1].s) : wNow(chips[0].s);
        const pw = eio(seg(t, chips[k].t - 0.12, chips[k].t + 0.15));
        const w = lerp(prevW, wNow(chips[k].s), pw) + 96;
        const cx = L.chip.x, cy = L.chip.y - cOut * 40;
        const a = clamp(cIn) * (1 - cOut);
        glass.push({ cx, cy, w: w * cIn, h: 96 * cIn, r: 48 * cIn, opacity: a, tintA: 0.4, spec: lerp(-300, 300, seg(t, chips[k].t, chips[k].t + 1)) });
        top.push({ type: 'canvas', draw: (ctx) => {
          ctx.save(); rrect(ctx, cx - w / 2, cy - 48, w, 96, 48); ctx.clip();
          if (k > 0 && pw < 1) text(ctx, chips[k - 1].s, cx, cy - eio(pw) * 70, { f, tracking: 8, alpha: a * (1 - pw * 1.6) });
          text(ctx, chips[k].s, cx, cy + (k > 0 ? (1 - eio(pw)) * 70 : 0), { f, tracking: 8, alpha: a * (k > 0 ? clamp(pw * 1.6 - 0.3) : 1), style: k === 2 ? 'gold' : '#FFFFFF' });
          ctx.restore();
        } });
      }
    }

    // ===== S5: laser y a todo color (pantalla dividida con cristal diagonal) =================
    const s5in = eo(seg(t, S5.t0 - 0.1, S5.t0 + 0.35));
    const s5out = eio(seg(t, S6.t0 - 0.35, S6.t0 + 0.4));
    if (s5in > 0 && t < S6.t0 + 0.5) {
      const Z = L.s5;
      // termo con laser: arriba
      const tIn = eo(seg(t, S5.t0 - 0.02, S5.t0 + 0.45));
      const tx = lerp(Z.termo.x - 500, Z.termo.x, tIn), mx = lerp(Z.mug.x + 500, Z.mug.x, tIn);
      // transicion a S6: los dos productos viajan a su lugar en la composicion de regalo
      const S6P = s6Pos();
      const termoX = lerp(tx, S6P.termo.x, s5out), termoB = lerp(Z.termo.b, S6P.termo.b, s5out), termoH = lerp(Z.termo.h, S6P.termo.h, s5out);
      const mugX = lerp(mx, S6P.mug.x, s5out), mugB = lerp(Z.mug.b, S6P.mug.b, s5out), mugH = lerp(Z.mug.h, S6P.mug.h, s5out);
      const rasterP = seg(t, T.grabado, T.impreso + 0.45);
      const termo = item(c, 'termo_negro_1', termoX, termoB, termoH, { z: -150, opacity: tIn, specI: 0.8, specX: 0.3, warm: 0.3 * s5out, shadow: 0.6,
        eng: { label: 'logo', ang: 1.55, raster: true, reveal: t < T.grabado ? -0.01 : lerp(-0.01, 1.01, rasterP), phase: 0 } });
      const pf = (a, b) => seg(t, a, b);
      const C0 = T.impreso, CD = 0.27;
      const cmyk = [pf(C0, C0 + CD), pf(C0 + CD, C0 + 2 * CD), pf(C0 + 2 * CD, C0 + 3 * CD), pf(C0 + 3 * CD + 0.05, C0 + 4 * CD + 0.05)].map((v) => lerp(-0.01, 1.01, eio(v)));
      const mug = item(c, 'vaso_asa_crema', mugX, mugB, mugH, { z: -150, opacity: tIn, specI: 0.6, specX: 0.3, warm: 0.3 * s5out, shadow: 0.6,
        print: { on: true, ang: 1.45, cmyk } });
      prods.push(termo, mug);
      sc.bg.glow = [termoX, termoB - termoH * 0.5]; sc.bg.glowR = 420;
      sc.bg.glow2 = [mugX, mugB - mugH * 0.5]; sc.bg.glow2R = 380; sc.bg.glow2I = 0.25 * (1 - s5out); sc.bg.glow2Col = [0.45, 0.30, 0.85];
      const uiA = s5in * (1 - s5out);
      // cristal diagonal que divide
      const dx = lerp(W + 900, CX, eo(seg(t, S5.t0 - 0.2, S5.t0 + 0.3))) - s5out * 1600;
      glass.push({ cx: dx, cy: SQ ? 540 : 960, w: SQ ? 1500 : 1500, h: 24, r: 12, rot: Z.rot, opacity: uiA, tintA: 0.2, border: 1.4, spec: lerp(-700, 700, seg(t, S5.t0, S5.t0 + 2.5)), shadow: 0.6 });
      // laser: cabezal, haz, chispas, humo
      if (t > T.grabado - 0.3 && t < T.impreso + 0.7) {
        const lp = rasterP;
        const lx = 0.5 + 0.5 * Math.sin(t * 52);
        const [px, py] = labelPt(termo, lx, clamp(lp), 1.55, LBL('logo'), 0);
        const hx = termo.rect[0] + termo.rect[2] + (SQ ? 120 : 190), hy = py - (SQ ? 110 : 150);
        const on = env(t, T.grabado - 0.05, T.grabado + 0.05, T.impreso + 0.45, T.impreso + 0.55);
        const headA = env(t, T.grabado - 0.35, T.grabado - 0.1, S6.t0 - 0.3, S6.t0) ;
        layers.push({ type: 'canvas', draw: (ctx) => { laserHead(ctx, hx, hy, headA, Math.atan2(py - hy, px - hx) + Math.PI); } });
        top.push({ type: 'canvas', draw: (ctx) => {
          if (on > 0.01) {
            const ax = hx - 84 * Math.cos(Math.atan2(py - hy, px - hx) + Math.PI) * -1, ay = hy;
            laserBeam(ctx, hx + Math.cos(Math.atan2(py - hy, px - hx)) * 84, hy + Math.sin(Math.atan2(py - hy, px - hx)) * 84, px, py, on);
            sparks(ctx, px, py, t, 14, 3, 1);
            smoke(ctx, px + 6, py - 8, t, on);
          }
        } });
      }
      // impresion UV: cabezal que pasa C, M, Y, K
      if (t > T.impreso - 0.4 && t < S6.t0 + 0.2) {
        let ch = 'c', f = cmyk[0];
        if (cmyk[0] >= 1.0 && cmyk[1] < 1.01) { ch = 'm'; f = cmyk[1]; }
        if (cmyk[1] >= 1.0 && cmyk[2] < 1.01) { ch = 'y'; f = cmyk[2]; }
        if (cmyk[2] >= 1.0) { ch = 'k'; f = cmyk[3]; }
        const [px, py] = labelPt(mug, clamp(f), 0.0, 1.45, A.logo.w / A.logo.h, 0);
        const headA = env(t, T.impreso - 0.4, T.impreso - 0.15, S6.t0 - 0.35, S6.t0 - 0.05);
        layers.push({ type: 'canvas', draw: (ctx) => {
          // riel
          ctx.save(); ctx.globalAlpha = headA * 0.6; ctx.strokeStyle = 'rgba(220,220,225,0.5)'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(mug.rect[0] - 40, py - 46); ctx.lineTo(mug.rect[0] + mug.rect[2] * 0.66 + 40, py - 46); ctx.stroke(); ctx.restore();
          printHead(ctx, px, py - 46, headA, ch);
        } });
      }
      // tipografia
      top.push({ type: 'canvas', draw: (ctx) => {
        const kl = seg(t, T.laser - 0.25, T.laser + 0.35);
        if (kl > 0) letters(ctx, 'LÁSER', Z.laserTxt[0], Z.laserTxt[1], { f: FONTS.head(SQ ? 96 : 124), style: 'red', tracking: 6, alpha: uiA, glow: 'rgba(227,38,47,0.55)', glowR: 26 },
          (i, n) => { const q = eo5(seg(t, T.laser - 0.25 + i * 0.04, T.laser + 0.2 + i * 0.04)); return { dx: (1 - q) * 160, a: q }; });
        const kc = seg(t, T.todo - 0.3, T.color + 0.35);
        if (kc > 0) {
          const off = (1 - eo(seg(t, T.todo - 0.1, T.color + 0.25))) * 16;
          const lines = Z.colorTxt2 ? [['A TODO', Z.colorTxt], ['COLOR', Z.colorTxt2]] : [['A TODO COLOR', Z.colorTxt]];
          const sz = SQ ? 66 : 104;
          lines.forEach(([s, pos], li) => {
            const a = eo(seg(t, T.todo - 0.3 + li * 0.1, T.todo + 0.1 + li * 0.1)) * uiA;
            [['#00BEEB', -off, -off * 0.4], ['#EB008C', off, -off * 0.3], ['#FFDC00', 0, off * 0.7]].forEach(([col, ox, oy]) =>
              text(ctx, s, pos[0] + ox, pos[1] + oy, { f: FONTS.head(sz), style: col, tracking: 4, alpha: a, composite: 'lighter' }));
          });
        }
      } });
    }

    // ===== S6: composicion de regalo isometrica, etiquetas que giran =============================
    function s6Pos() {
      const Z = L.s6, k = Z.scale, cx = Z.cx, cy = Z.cy;
      const P = (dx, db, h) => ({ x: cx + dx * k, b: cy + db * k, h: h * k });
      return {
        anfora: P(-150, -120, 300), set: P(185, -100, 165), termo: P(-305, 30, 360), mug: P(305, 40, 350), vip: P(30, 105, 100), llanta: P(-60, 10, 0),
      };
    }
    const s6in = sm(seg(t, S6.t0 - 0.3, S6.t0 + 0.5));
    const s6out = eio(seg(t, S6.t1 - 0.55, S6.t1 + 0.15));
    if (s6in > 0 && s6out < 1) {
      const Q = s6Pos(), Z = L.s6, k = Z.scale;
      sc.bg.glow2 = [Z.cx, Z.cy - 300 * k]; sc.bg.glow2R = 620; sc.bg.glow2I = 0.62 * s6in * (1 - s6out); sc.bg.glow2Col = [0.85, 0.62, 0.30];
      sc.bg.glow = [Z.cx, Z.cy - 120 * k]; sc.bg.glowI *= 0.7;
      const fade = s6in * (1 - s6out);
      const recede = (b) => b - s6out * 40;
      // plataforma isometrica de cristal oscuro con filo dorado
      layers.splice(layers.findIndex((l) => l.type === 'products'), 0, { type: 'canvas', draw: (ctx) => {
        camCtx(ctx, c);
        ctx.save(); ctx.translate(Z.cx, Z.cy + 60 * k); ctx.globalAlpha = fade;
        const e = 470 * k, hh = 0.5;
        const top_ = [[0, -e * hh], [e, 0], [0, e * hh], [-e, 0]];
        poly(ctx, top_.map((p) => [p[0], p[1] + 34 * k]));
        ctx.fillStyle = '#0A0607'; ctx.fill();
        poly(ctx, top_);
        const g = ctx.createRadialGradient(0, -40 * k, 10, 0, 0, e); g.addColorStop(0, 'rgba(70,46,30,0.95)'); g.addColorStop(1, 'rgba(18,11,10,0.95)');
        ctx.fillStyle = g; ctx.fill();
        ctx.strokeStyle = 'rgba(216,178,92,0.55)'; ctx.lineWidth = 1.6; ctx.stroke();
        ctx.restore();
      } });
      const items6 = [
        ['anfora_negra_grabado_diprolaser', Q.anfora, { z: 60 }],
        ['set_regalo_pluma_tarjetero_navaja_llavero', Q.set, { z: 50 }],
        ['estuche_vip_grabado_diprolaser', Q.vip, { z: -40 }],
        ['llavero_casco_amarillo', { x: Z.cx - 140 * k, b: Z.cy + 150 * k, h: 120 * k }, { z: -60 }],
      ];
      items6.forEach(([key, p, ex], i) => {
        const e = eo(seg(t, S6.t0 - 0.2 + i * 0.1, S6.t0 + 0.45 + i * 0.1));
        prods.push(item(c, key, p.x, recede(p.b) + (1 - e) * 60, p.h * (1 - s6out * 0.15), { ...ex, opacity: e * (1 - s6out), warm: 0.4, specI: 0.4, shadow: 0.7, blur: s6out * 6 }));
      });
      if (t >= S6.t0 + 0.4) {
        // el termo y el vaso ya llegaron desde S5
        prods.push(item(c, 'termo_negro_1', Q.termo.x, recede(Q.termo.b), Q.termo.h * (1 - s6out * 0.15), { z: 10, opacity: 1 - s6out, warm: 0.35, specI: 0.6, shadow: 0.7, blur: s6out * 6, eng: { label: 'logo', ang: 1.55, phase: 0.05 * Math.sin(t * 0.6) } }));
        prods.push(item(c, 'vaso_asa_crema', Q.mug.x, recede(Q.mug.b), Q.mug.h * (1 - s6out * 0.15), { z: 10, opacity: 1 - s6out, warm: 0.35, specI: 0.5, shadow: 0.7, blur: s6out * 6, print: { on: true, ang: 1.45, cmyk: [1.01, 1.01, 1.01, 1.01] } }));
      }
      // etiquetas
      // cada etiqueta con su lugar: arriba del producto, o colgada del asa en el vaso
      const tagged = [[Q.termo, 'Gracias por estar', -10, -78], [Q.anfora, 'Gracias por tu confianza', 0, -70], [Q.mug, 'Feliz año', 118, 205], [Q.set, 'Para ti, Don Luis', 20, -70]];
      top.push({ type: 'canvas', draw: (ctx) => {
        camCtx(ctx, c);
        tagged.forEach(([p, msg, dx, dy], i) => {
          const tt = TAG_T[i];
          const a = eo(seg(t, S6.t0 + 0.1 + i * 0.1, S6.t0 + 0.5 + i * 0.1)) * (1 - s6out);
          const flip = eio(seg(t, tt - 0.05, tt + 0.45));
          const sw = Math.sin(t * 1.3 + i * 1.7) * 0.045;
          const th = 78 * k, tw = Math.max(250, (msg.length * 15.5 + 60)) * k;
          const topY = recede(p.b) - p.h;
          giftTag(ctx, p.x + dx * k, topY + dy * k, tw, th, flip, msg, a, sw);
        });
      } });
      // GRACIAS / POR ESTAR, palabra por palabra
      top.push({ type: 'canvas', draw: (ctx) => {
        const wf = (tt) => eo(seg(t, tt - 0.15, tt + 0.6));
        const out = 1 - s6out;
        const g = wf(T.gracias2);
        if (g > 0) text(ctx, 'GRACIAS', CX, Z.title[0] + (1 - g) * 26, { f: FONTS.head(Z.titleSize[0]), style: 'gold', tracking: 6, alpha: g * out, glow: 'rgba(216,178,92,0.3)', glowR: 36 });
        const f2 = FONTS.head(Z.titleSize[1]);
        const cv = getMeasure(); font(cv, f2, 6);
        const wPor = ink(cv, 'POR').w, wEs = ink(cv, 'ESTAR').w, gap = Z.titleSize[1] * 0.32;
        const total = wPor + gap + wEs; const x0 = CX - total / 2;
        const p = wf(T.por2), e = wf(T.estar);
        if (p > 0) text(ctx, 'POR', x0 + wPor / 2, Z.title[1] + (1 - p) * 26, { f: f2, style: 'gold', tracking: 6, alpha: p * out });
        if (e > 0) text(ctx, 'ESTAR', x0 + wPor + gap + wEs / 2, Z.title[1] + (1 - e) * 26, { f: f2, style: 'gold', tracking: 6, alpha: e * out });
      } });
    }

    // ===== S7: la X liquida y el logo oficial ===================================================
    const X = L.s7;
    const logoIn = seg(t, T.dipro - 0.02, T.dipro + 0.5);
    if (t > T.dipro - 0.1) {
      sc.bg.glow = [X.x, X.y]; sc.bg.glowI = lerp(sc.bg.glowI, 0.75 * breathe, sm(seg(t, S7.t0, T.dipro)));
      sc.bloom = 0.35 + 0.6 * Math.exp(-Math.max(0, t - T.dipro) * 4);
      // el logo sube y se hace chico en S8
      const up = eio(seg(t, S8.t0 - 0.2, S8.t0 + 0.45));
      const S8L = L.s8;
      const live = 1 + 0.035 * eio(seg(t, T.dipro, S8.t0)) * (1 - up);
      const lw = lerp(X.logoW, S8L.logoW, up) * live, lx = X.x, ly = lerp(X.y, S8L.logoY, up);
      const lh = lw * A.logoImg.height / A.logoImg.width;
      top.push({ type: 'canvas', draw: (ctx) => {
        const k = eo(logoIn);
        const s = lerp(0.9, 1, k);
        ctx.save(); ctx.globalAlpha = clamp(k * 1.4);
        drawLogoSweep(ctx, lx, ly, lw * s, lh * s, seg(t, T.dipro, T.dipro + 0.9));
        ctx.restore();
        // destello de impacto
        const fl = Math.exp(-Math.max(0, t - T.dipro) * 6) * (t > T.dipro ? 1 : 0);
        if (fl > 0.01) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; const rg = ctx.createRadialGradient(lx, ly, 0, lx, ly, lw * 0.8); rg.addColorStop(0, `rgba(255,220,220,${0.35 * fl})`); rg.addColorStop(1, 'rgba(255,60,60,0)'); ctx.fillStyle = rg; ctx.fillRect(lx - lw, ly - lw, lw * 2, lw * 2); ctx.restore(); }
        // PROMOCIONALES PERSONALIZADOS
        const pp = seg(t, T.promo - 0.2, T.promo + 0.7);
        if (pp > 0) {
          const py = lerp(X.promoY, S8L.promoY, up);
          const sz = lerp(SQ ? 30 : 34, SQ ? 22 : 26, up);
          text(ctx, 'PROMOCIONALES PERSONALIZADOS', CX, py, { f: FONTS.ui(Math.round(sz), 700), style: 'silver', tracking: lerp(16, SQ ? 6 : 8, eo(pp)) * lerp(1, 0.8, up), alpha: eo(pp) });
        }
      } });
    }

    // ===== S8: llamado a la accion ==============================================================
    if (t > S8.t0 - 0.2) {
      const Z = L.s8;
      sc.bg.glow = [CX, Z.l2]; sc.bg.glowR = 600;
      top.push({ type: 'canvas', draw: (ctx) => {
        const f1 = FONTS.head(Z.size);
        const wv = (tt) => eo5(seg(t, tt - 0.12, tt + 0.4));
        // linea 1: CONSIENTE A
        const cv = getMeasure(); font(cv, f1, 3);
        const lineW = (ws) => ws.reduce((s, w, i) => s + ink(cv, w).w + (i ? Z.size * 0.3 : 0), 0);
        const drawLine = (ws, ts, y, style) => {
          const tot = lineW(ws); let x = CX - tot / 2;
          ws.forEach((w, i) => {
            const ww = ink(cv, w).w; const k = wv(ts[i]);
            ctx.save(); ctx.beginPath(); ctx.rect(x - 20, y - Z.size, ww + 40, Z.size * 2); ctx.clip();
            if (k > 0) text(ctx, w, x + ww / 2, y + (1 - k) * Z.size * 0.9, { f: f1, tracking: 3, style, alpha: k });
            ctx.restore();
            x += ww + Z.size * 0.3;
          });
        };
        drawLine(['CONSIENTE', 'A'], [T.consiente, T.a8], Z.l1, '#FFFFFF');
        drawLine(['TUS', 'CLIENTES'], [T.tus, T.clientes], Z.l2, '#FFFFFF');
        const ea = eo5(seg(t, T.este - 0.12, T.este + 0.5));
        if (ea > 0) text(ctx, 'ESTE AÑO', CX, Z.l3, { f: FONTS.head(Math.round(Z.size * 1.12)), style: 'gold', tracking: lerp(40, 6, ea), alpha: ea, glow: 'rgba(216,178,92,0.35)', glowR: 34 });
      } });
      // pildora de cristal con WhatsApp y numero
      const [px, py, pw, ph] = Z.pill;
      const pin = back(seg(t, T.escribe - 0.2, T.escribe + 0.25), 1.5);
      if (pin > 0) {
        glass.push({ cx: px, cy: py, w: pw * lerp(0.3, 1, pin), h: ph, r: ph / 2, opacity: clamp(pin * 2), tintA: 0.42, spec: lerp(-500, 500, seg(t, T.escribe, T.escribe + 1.6)), border: 1.3 });
        top.push({ type: 'canvas', draw: (ctx) => {
          const fN = FONTS.head(SQ ? 60 : 70);
          const cv = getMeasure(); font(cv, fN, 4);
          const full = '449 212 8627';
          const b = ink(cv, full);
          const x0 = px - (b.r - b.l) / 2;               // centro por tinta
          const grp = [['449', T.n449], ['212', T.n212], ['8627', T.n8627]];
          let pre = '';
          const wpin = pw * lerp(0.3, 1, pin);
          ctx.save(); rrect(ctx, px - wpin / 2, py - ph / 2, wpin, ph, ph / 2); ctx.clip();
          waIcon(ctx, px - pw / 2 + ph * 0.55, py, ph * 0.3, '#FFFFFF', clamp(seg(t, T.escribe, T.escribe + 0.3)));
          grp.forEach(([g, tt], i) => {
            const before = ctx.measureText ? (() => { font(cv, fN, 4); return cv.measureText(pre).width; })() : 0;
            font(cv, fN, 4); const gw = cv.measureText(g).width;
            const k = eo5(seg(t, tt - 0.12, tt + 0.3));
            if (k > 0) {
              ctx.save(); font(ctx, fN, 4); ctx.textBaseline = 'alphabetic'; ctx.globalAlpha = k;
              ctx.fillStyle = '#FFFFFF';
              ctx.fillText(g, x0 + b.l + before, py + (b.a - b.d) / 2 + (1 - k) * 60);
              ctx.restore();
            }
            pre += g + ' ';
          });
          ctx.restore();
        } });
      }
      top.push({ type: 'canvas', draw: (ctx) => {
        const r = eo(seg(t, T.n8627 + 0.4, T.n8627 + 1.0));
        if (r > 0) text(ctx, 'Y en redes como DIPROLASER', CX, Z.redes + (1 - r) * 16, { f: FONTS.ui(SQ ? 32 : 40, 500), style: 'rgba(255,255,255,0.9)', alpha: r });
        const e = eo(seg(t, sc_voiceEnd + 0.05, sc_voiceEnd + 0.6));
        if (e > 0) text(ctx, 'ENVÍOS A TODO MÉXICO', CX, Z.envios + (1 - e) * 16, { f: FONTS.ui(SQ ? 26 : 32, 800), style: 'gold', tracking: 8, alpha: e });
      } });
    }

    // capas finales
    if (!layers.find((l) => l.items === prods)) layers.push({ type: 'products', items: prods });
    sc.fade = 1 - sm(seg(t, 35.1, 35.5));
    if (SAFE) top.push({ type: 'canvas', draw: (ctx) => {
      ctx.fillStyle = 'rgba(0,200,255,0.18)';
      if (!SQ) { ctx.fillRect(0, 0, W, 250); ctx.fillRect(0, H - 340, W, 340); }
      ctx.strokeStyle = 'rgba(0,200,255,0.6)'; ctx.strokeRect(0.5, 0.5, W - 1, H - 1);
    } });
    return sc;
  }

  const sc_voiceEnd = A.timeline.voice_end;
  // logo oficial con barrido de luz plateada (solo se mueve/escala/enmascara; no se redibuja)
  const logoCanvas = document.createElement('canvas');
  function drawLogoSweep(ctx, x, y, w, h, p) {
    const lw = Math.ceil(w), lh = Math.ceil(h);
    if (logoCanvas.width !== lw || logoCanvas.height !== lh) { logoCanvas.width = lw; logoCanvas.height = lh; }
    const g = logoCanvas.getContext('2d');
    g.globalCompositeOperation = 'source-over'; g.clearRect(0, 0, lw, lh);
    g.drawImage(A.logoImg, 0, 0, lw, lh);
    if (p > 0 && p < 1) {
      g.globalCompositeOperation = 'source-atop';
      const bx = lerp(-lw * 0.6, lw * 1.6, eio(p));
      const gr = g.createLinearGradient(bx - lw * 0.25, 0, bx + lw * 0.25, lh * 0.4);
      gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, 'rgba(235,238,245,0.85)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, lw, lh);
    }
    ctx.drawImage(logoCanvas, x - w / 2, y - h / 2, w, h);
  }
  let measureCtx = null;
  function getMeasure() { if (!measureCtx) measureCtx = document.createElement('canvas').getContext('2d'); return measureCtx; }

  return { at, T, L };
}
