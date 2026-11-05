// Linea de tiempo maestra del video (segundos de video). La comparten el arnes de
// captura de la pagina (Node) y el compositor (navegador). 60 fps, 1620 cuadros.
// Las horas de la locucion vienen de vo_words.json (toma real, alineada con Whisper).

export const FPS = 60;
export const DUR = 27.0;
export const FRAMES = 1620;
export const BPM = 96;
export const BEAT = 60 / BPM;          // 0.625 s
export const BAR = BEAT * 4;           // 2.5 s

export const QUERY = 'siniestro tattoo aguascalientes';
export const IDEA_TEXT = 'León realista';

// ---------- Escenas ----------
export const SCENES = [
  { id: 'hook', t0: 0.00, t1: 2.55, name: 'Gancho: búsqueda' },
  { id: 'llegada', t0: 2.55, t1: 5.85, name: 'Llegada: portada real' },
  { id: 'portafolio', t0: 5.85, t1: 9.30, name: 'Portafolio por estilo' },
  { id: 'cotiza', t0: 9.30, t1: 13.45, name: 'Cotización a WhatsApp' },
  { id: 'ingles', t0: 13.45, t1: 16.95, name: 'También en inglés' },
  { id: 'cuidados', t0: 16.95, t1: 20.10, name: 'Cuidados y ubicación' },
  { id: 'cierre', t0: 20.10, t1: 23.95, name: 'Cierre' },
  { id: 'endcard', t0: 23.95, t1: 27.00, name: 'End card' },
];

// ---------- Momentos (todo lo que se mueve tiene hora) ----------
export const T = {
  hit0: 0.00,
  barIn: [0.00, 0.34],
  inkIntoBar: [0.10, 0.32],
  type: [0.30, 1.90],
  enter: 2.02,
  barOut: [2.12, 2.52],
  inkOutline: [2.20, 3.02],
  phoneIn: [2.58, 3.20],
  phoneSettle: [2.86, 3.72],
  screenOn: 2.95,
  pushTitle: [3.55, 4.40],
  inkUnderline: [4.52, 5.22],
  pullHero: [5.30, 5.86],
  scrollGallery: [5.86, 6.48],
  cardsOut: [6.46, 7.04],
  cardsBack: [7.28, 7.70],
  tapRealismo: 7.80,
  tapColor: 8.47,
  inkCircleCta: [8.92, 9.26],
  tapCta: 9.30,
  scrollForm: [9.36, 9.95],
  tapIdea: 9.98,
  kbUp: [10.00, 10.24],
  typeIdea: [10.27, 10.85],
  kbDown: [10.90, 11.12],
  scrollChips: [11.00, 11.26],
  tapStyle: 11.30,
  tapZone: 11.52,
  tapSize: 11.74,
  scrollPhoto: [11.80, 12.04],
  tapPhoto: 12.08,
  photoProgress: [12.13, 12.63],
  scrollSubmit: [12.48, 12.74],
  inkCircleSubmit: [12.46, 12.76],
  tapSubmit: 12.78,
  waLift: [12.90, 13.20],
  waBack: [13.26, 13.48],
  scrollTop: [13.47, 13.94],
  inkCircleLang: [13.66, 13.97],
  tapEN: 14.00,
  morphEN: [14.03, 14.90],
  orbit: [13.90, 16.60],
  tapES: 16.30,
  morphES: [16.33, 16.86],
  scrollCare: [16.95, 17.72],
  pushCare: [17.76, 18.50],
  scrollVisit: [18.58, 19.22],
  inkCirclePin: [19.26, 19.96],
  pullBack: [20.10, 20.96],
  write1: [20.10, 21.42],
  clear1: [21.48, 21.80],
  write2: [21.86, 23.36],
  breath: 23.00,
  outroFade: [23.50, 23.96],
  hit24: 24.00,
  plateIn: [23.96, 24.62],
  sweep: [24.42, 25.42],
  signature: [24.62, 25.36],
  tagline: [25.46, 25.96],
  disclaimer: [25.82, 26.24],
};

// La pagina esta en pantalla entre estos tiempos (se captura cuadro por cuadro)
export const SCREEN = [2.95, 23.96];

// ---------- Acciones de la pagina (las ejecuta el arnes de captura) ----------
// scroll.to: clave de posicion medida en el DOM al momento de ejecutar.
export const PAGE_ACTIONS = [
  { t: T.inkUnderline, type: 'ink' },
  { t: T.scrollGallery, type: 'scroll', to: 'gallery' },
  { t: T.cardsOut[0], type: 'hideWorks', ids: ['cristo', 'leon', 'quetzalcoatl'] },
  { t: T.cardsBack[1], type: 'hideWorks', ids: [] },
  { t: T.tapRealismo, type: 'tap', sel: '[data-filter="realismo"]' },
  { t: T.tapColor, type: 'tap', sel: '[data-filter="color"]' },
  { t: T.tapCta, type: 'tap', sel: '#work-cta' },
  { t: T.scrollForm, type: 'scroll', to: 'formTop' },
  { t: T.tapIdea, type: 'tap', sel: '#q-idea' },
  { t: T.typeIdea, type: 'type', text: IDEA_TEXT },
  { t: T.kbDown[0], type: 'blur' },
  { t: T.scrollChips, type: 'scroll', to: 'chips' },
  { t: T.tapStyle, type: 'tap', sel: 'label.opt:has(input[name="style"][value="realismo"]) .chip' },
  { t: T.tapZone, type: 'tap', sel: 'label.opt:has(input[name="zone"][value="antebrazo"]) .chip' },
  { t: T.tapSize, type: 'tap', sel: 'label.opt:has(input[name="size"][value="mediano"]) .chip' },
  { t: T.scrollPhoto, type: 'scroll', to: 'photo' },
  { t: T.tapPhoto, type: 'tapPhoto', sel: '#drop-btn' },
  { t: T.scrollSubmit, type: 'scroll', to: 'submit' },
  { t: T.tapSubmit, type: 'tap', sel: '#q-submit' },
  { t: T.waLift[0], type: 'hideSubmit', on: true },
  { t: T.waBack[1], type: 'hideSubmit', on: false },
  { t: T.scrollTop, type: 'scroll', to: 'top', rubber: -64 },
  { t: T.tapEN, type: 'tap', sel: '.lang-btn[data-lang="en"]', morph: 'en' },
  { t: T.tapES, type: 'tap', sel: '.lang-btn[data-lang="es"]', morph: 'es' },
  { t: T.scrollCare, type: 'scroll', to: 'care' },
  { t: T.scrollVisit, type: 'scroll', to: 'visit' },
];

// Rects que el compositor necesita, medidos en su instante (coordenadas de documento y viewport)
export const PROBES = [
  { t: T.inkUnderline[0], name: 'heroInk', sel: '#ink' },
  { t: T.inkUnderline[0], name: 'heroTitle', sel: '.ht-l1' },
  { t: T.pushTitle[0], name: 'heroTitleBlock', sel: '#hero-title' },
  { t: T.inkCircleCta[0], name: 'workCta', sel: '#work-cta' },
  { t: T.inkCircleSubmit[0], name: 'submit', sel: '#q-submit' },
  { t: T.inkCircleLang[0], name: 'lang', sel: '.lang' },
  { t: T.inkCircleLang[0], name: 'langEn', sel: '.lang-btn[data-lang="en"]' },
  { t: T.pushCare[0], name: 'careSteps', sel: '.care-steps' },
  { t: T.inkCirclePin[0], name: 'pin', sel: '.pin' },
  { t: T.inkCirclePin[0], name: 'map', sel: '.map' },
];

// ---------- Tipografia cinetica (aterriza en palabras de la locucion) ----------
// word: indice [linea, palabra] dentro de vo_words.json
export const KINETIC = [
  { id: 'k-trabajo', scene: 'portafolio', out: [9.04, 9.30], lines: [
    [{ text: 'TU', vo: ['L3', 0] }, { text: 'TRABAJO,', vo: ['L3', 1] }],
    [{ text: 'POR', vo: ['L3', 3] }, { text: 'ESTILO', vo: ['L3', 4], underline: [8.18, 8.52] }],
  ] },
  { id: 'k-cotiza', scene: 'cotiza', out: [11.06, 11.26], lines: [
    [{ text: 'COTIZACIONES', vo: ['L4', 0] }],
  ] },
  { id: 'k-whatsapp', scene: 'cotiza', out: [13.28, 13.46], lines: [
    [{ text: 'DIRECTO', vo: ['L4', 4] }, { text: 'A', vo: ['L4', 5] }],
    [{ text: 'TU', vo: ['L4', 6] }, { text: 'WHATSAPP', vo: ['L4', 7], underline: [12.10, 12.46] }],
  ] },
  { id: 'k-ingles', scene: 'ingles', out: [16.18, 16.44], lines: [
    [{ text: 'TAMBIÉN', vo: ['L5', 0] }],
    [{ text: 'EN', vo: ['L5', 1] }, { text: 'INGLÉS', vo: ['L5', 2], underline: [14.34, 14.66] }],
  ] },
];

// Frases que escribe la linea de tinta en el cierre
export const WRITTEN = [
  { id: 'w1', t: T.write1, clear: T.clear1, lines: ['23 AÑOS', 'DE OFICIO.'], vo: 'L6a' },
  { id: 'w2', t: T.write2, clear: [23.50, 23.90], lines: ['AHORA,', 'SU PÁGINA.'], vo: 'L6b' },
];

export const ENDCARD = {
  tagline: 'Así se vería tu página · Elevate Negocios',
  disclaimer: 'Demo de cortesía de Elevate Negocios · pieza no oficial',
};

// ---------- Utilidades deterministas ----------
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, k) => a + (b - a) * k;
export const prog = (t, [a, b]) => clamp((t - a) / (b - a));
export const easeInOut = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
export const easeOut = (k) => 1 - Math.pow(1 - k, 3);
export const easeIn = (k) => k * k * k;
export const easeOutExpo = (k) => (k >= 1 ? 1 : 1 - Math.pow(2, -10 * k));
export const smooth = (a, b, x) => { const k = clamp((x - a) / (b - a)); return k * k * (3 - 2 * k); };

// Respuesta de resorte subamortiguado (arranca en reposo, rebota poco y asienta)
export function spring(k, zeta = 0.8, omega = 8.2) {
  if (k <= 0) return 0;
  if (k >= 1) return 1;
  const wd = omega * Math.sqrt(1 - zeta * zeta);
  const u = k;
  const v = 1 - Math.exp(-zeta * omega * u) * (Math.cos(wd * u) + (zeta * omega / wd) * Math.sin(wd * u));
  // corrige para que termine exactamente en 1
  const e = 1 - Math.exp(-zeta * omega) * (Math.cos(wd) + (zeta * omega / wd) * Math.sin(wd));
  return v / e;
}

// Scroll con inercia: arrastre corto, suelta, desacelera; con rebote opcional al pasarse del borde
export function scrollAt(t, [ta, tb], y0, y1, rubber = 0) {
  const k = prog(t, [ta, tb]);
  if (!rubber) return lerp(y0, y1, spring(k, 0.82, 8.6));
  // al llegar al tope se pasa `rubber` px (negativo = arriba del borde) y regresa
  const base = lerp(y0, y1, easeOutExpo(clamp(k / 0.62)));
  const bump = k < 0.45 ? 0 : rubber * Math.sin(Math.PI * clamp((k - 0.45) / 0.55)) * Math.exp(-2.2 * clamp((k - 0.45) / 0.55));
  return base + bump;
}

// Tiempos del tecleo de la busqueda (determinista, con irregularidad humana)
export function typingTimes(text, [t0, t1], seed = 7) {
  let s = seed >>> 0;
  const rnd = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
  const w = [...text].map((c, i) => (c === ' ' ? 1.5 : 1) * (0.82 + 0.36 * rnd()) * (i === 0 ? 0.6 : 1));
  const total = w.reduce((a, b) => a + b, 0);
  let acc = 0;
  return [...text].map((c, i) => { acc += w[i]; return { c, t: t0 + (t1 - t0) * (acc - w[i] * 0.5) / total }; });
}
