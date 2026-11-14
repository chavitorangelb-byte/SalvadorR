// Linea de tiempo maestra del video de Colors Boutique (segundos de video). 60 fps, 1110 cuadros.
// 120 BPM: 1 beat = 0.5 s, compas = 2.0 s. 16 s de pieza + 2.5 s de end card (la ultima frase de la voz real dura 2.1 s).
// Las horas de la locucion vienen de vo_words.json (toma real colocada por vo_assemble.py).
export const FPS = 60, DUR = 18.5, FRAMES = 1110, BPM = 120, BEAT = 0.5, BAR = 2.0;

export const SCENES = [
  { id: 'golpe', t0: 0.0, t1: 0.5, name: 'Golpe: el tallo cruza' },
  { id: 'flor', t0: 0.5, t1: 1.75, name: 'El tallo florece' },
  { id: 'morph', t0: 1.75, t1: 2.9, name: 'Flor → girasoles → círculo de la marca → teléfono' },
  { id: 'telefono', t0: 2.9, t1: 5.8, name: 'Teléfono de cristal y tres tarjetas' },
  { id: 'calidad', t0: 5.8, t1: 8.4, name: 'Parallax: flores y follajes' },
  { id: 'pagina', t0: 8.4, t1: 11.05, name: 'Catálogo en su propia página' },
  { id: 'eventos', t0: 11.05, t1: 13.1, name: 'Centros de mesa para eventos' },
  { id: 'whatsapp', t0: 13.1, t1: 14.0, name: 'Pide por WhatsApp' },
  { id: 'cierre', t0: 14.0, t1: 16.0, name: 'Colors Boutique · Querétaro' },
  { id: 'endcard', t0: 16.0, t1: 18.5, name: 'End card' },
];

// Guion (una frase por linea). `at` = inicio preferido en video.
export const SCRIPT = [
  { id: 'L1', at: 0.45, text: 'Algo único para ese día especial.' },
  { id: 'L2', at: 3.25, text: 'Bouquets, orquídeas y cajas de flores.' },
  { id: 'L3', at: 6.02, text: 'Flores y follajes de alta calidad.' },
  { id: 'L4', at: 8.60, text: 'Imagina todo esto en tu propia página.' },
  { id: 'L5', at: 11.10, text: 'Y centros de mesa para tus eventos.' },
  { id: 'L6', at: 13.25, text: 'Pide por WhatsApp.' },
  { id: 'L7', at: 14.25, text: 'Colors Boutique. Querétaro.' },
  { id: 'L8', at: 16.10, text: 'Tu página, desde mil pesos.' },
];

// Momentos. Estan amarrados a la toma real de voz (vo_words.json): la voz no se acelera, las escenas la siguen.
export const T = {
  slash: [0.0, 0.30],            // el tallo cruza la pantalla
  cut: 0.5,                      // corte en el primer beat
  grow: [0.5, 1.2],              // sube al centro
  bloom: [1.0, 1.6],             // abre la flor
  toSun: [1.75, 2.1],             // flor -> panel de girasoles (SDF)
  irisSun: [1.77, 2.08],
  toCircle: [2.15, 2.5],        // panel -> circulo de la marca
  irisLogo: [2.15, 2.48],
  toPhone: [2.5, 2.85],          // circulo -> marco del telefono
  irisPhone: [2.55, 2.92],
  rimOff: [2.9, 3.25],
  camIso: 3.55,
  cardsOff: [5.55, 5.98],
  camPanels: [5.65, 6.3],
  panelsIn: [5.8, 6.3],
  panelsOut: [8.15, 8.65],
  camBack: [8.2, 8.95],
  scrollCat: [8.4, 9.1],
  chipsIn: [8.95, 9.4],
  tapChip: 10.0,
  ribbon: [9.3, 10.5],
  chipsOut: [10.8, 11.05],
  camEvents: [10.85, 11.45],
  eventsIn: [11.05, 11.55],
  eventsOut: [12.85, 13.25],
  camWa: [12.9, 13.4],
  waLift: [13.1, 13.5],
  waPulse: [13.5, 14.0],
  underline: [13.3, 13.7],
  waOut: [13.95, 14.2],
  pull: [14.0, 14.5],
  toLogo: [14.45, 14.85],
  irisBack: [14.25, 14.5],
  breath: 14.0,
  endHit: 16.0,
  endIn: [16.0, 16.5],
};

// Tipografia cinetica: cada palabra aterriza en su palabra de la locucion ([linea, indice]).
// fx: coreografia propia por palabra. style: 'caps' (Jost) o 'script' (Playfair italica).
export const KINETIC = [
  { id: 'k-algo', out: { beforeVo: ['L1', 2], lead: 0.16, dur: 0.2 }, lines: [
    [{ text: 'Algo', vo: ['L1', 0], fx: 'rise', style: 'script' }, { text: 'único', vo: ['L1', 1], fx: 'bloom', style: 'script' }] ] },
  { id: 'k-dia', out: [2.45, 2.62], lines: [
    [{ text: 'PARA', vo: ['L1', 2], fx: 'slide' }, { text: 'ESE', vo: ['L1', 3], fx: 'slide' }, { text: 'DÍA', vo: ['L1', 4], fx: 'drop' }],
    [{ text: 'especial', vo: ['L1', 5], fx: 'bloom', style: 'script' }] ] },
  { id: 'k-flores', out: { beforeVo: ['L3', 3], lead: 0.2, dur: 0.2 }, lines: [
    [{ text: 'FLORES', vo: ['L3', 0], fx: 'rise' }], [{ text: 'Y', vo: ['L3', 1], fx: 'drop' }, { text: 'FOLLAJES', vo: ['L3', 2], fx: 'slide' }] ] },
  { id: 'k-calidad', out: [8.38, 8.58], lines: [
    [{ text: 'DE', vo: ['L3', 3], fx: 'drop' }, { text: 'ALTA', vo: ['L3', 4], fx: 'rise' }], [{ text: 'calidad', vo: ['L3', 5], fx: 'bloom', style: 'script' }] ] },
  { id: 'k-pagina', out: [10.9, 11.1], lines: [
    [{ text: 'TU', vo: ['L4', 4], fx: 'drop' }, { text: 'PROPIA', vo: ['L4', 5], fx: 'slide' }], [{ text: 'página', vo: ['L4', 6], fx: 'bloom', style: 'script' }] ] },
  { id: 'k-centros', out: { beforeVo: ['L5', 4], lead: 0.18, dur: 0.2 }, lines: [
    [{ text: 'CENTROS', vo: ['L5', 1], fx: 'rise' }], [{ text: 'DE', vo: ['L5', 2], fx: 'drop' }, { text: 'MESA', vo: ['L5', 3], fx: 'slide' }] ] },
  { id: 'k-eventos', out: [13.0, 13.2], lines: [
    [{ text: 'PARA', vo: ['L5', 4], fx: 'drop' }, { text: 'TUS', vo: ['L5', 5], fx: 'rise' }], [{ text: 'eventos', vo: ['L5', 6], fx: 'bloom', style: 'script' }] ] },
  { id: 'k-marca', out: [15.72, 15.98], lines: [
    [{ text: 'Colors', vo: ['L7', 0], fx: 'rise', style: 'script' }, { text: 'Boutique', vo: ['L7', 1], fx: 'bloom', style: 'script' }],
    [{ text: 'QUERÉTARO', vo: ['L7', 2], fx: 'slide', small: true }] ] },
];

// Tarjetas que se estampan: aterrizan en su palabra
export const CARDS = [
  { id: 'bouquets', label: 'BOUQUETS', img: 'bouquet-rosa', vo: ['L2', 0] },
  { id: 'orquideas', label: 'ORQUÍDEAS', img: 'orquideas', vo: ['L2', 1] },
  { id: 'cajas', label: 'CAJAS DE FLORES', img: 'caja-redonda', vo: ['L2', 3] },
];
export const PANELS = ['jarron-verde', 'ramo-negro', 'tulipanes'];
export const EVENTS = ['centro-mesa', 'mesa-larga', 'centro-limones'];
export const CHIPS = ['BOUQUETS', 'ARREGLOS', 'CENTROS DE MESA'];

export const ENDCARD = {
  l1a: 'Precios accesibles desde', price: '$1,000', l1b: 'pesos por tu página',
  l2: 'Paquete de 3 videos promocionales: $1,500',
  sig: 'Elevate Negocios · Aguascalientes',
  disclaimer: 'Demo de cortesía de Elevate Negocios · pieza no oficial',
};

export const voWord = (vo, [line, i]) => { const l = vo.find((x) => x.id === line); return l.words[Math.min(i, l.words.length - 1)]; };
export function resolveOut(out, vo) {
  if (Array.isArray(out)) return out;
  const t = voWord(vo, out.beforeVo).t0 - out.lead;
  return [t, t + out.dur];
}
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, k) => a + (b - a) * k;
export const prog = (t, [a, b]) => clamp((t - a) / (b - a));
export const easeInOut = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
export const easeOut = (k) => 1 - Math.pow(1 - k, 3);
export const easeIn = (k) => k * k * k;
export const easeOutExpo = (k) => (k >= 1 ? 1 : 1 - Math.pow(2, -10 * k));
export const smooth = (a, b, x) => { const k = clamp((x - a) / (b - a)); return k * k * (3 - 2 * k); };
export function spring(k, zeta = 0.8, omega = 8.2) {
  if (k <= 0) return 0; if (k >= 1) return 1;
  const wd = omega * Math.sqrt(1 - zeta * zeta);
  const f = (u) => 1 - Math.exp(-zeta * omega * u) * (Math.cos(wd * u) + (zeta * omega / wd) * Math.sin(wd * u));
  return f(k) / f(1);
}
