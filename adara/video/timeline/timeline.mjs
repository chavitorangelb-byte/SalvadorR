// Linea de tiempo maestra del video de Adara Pastelería (segundos de video).
// 22.0 s = 19 s de pieza + 3 s de end card. 60 fps, 1320 cuadros. 120 BPM (beat 0.5 s, compas 2.0 s).
// Las horas de cada palabra vienen de vo_words.json (toma real de ElevenLabs alineada con Whisper).

export const FPS = 60;
export const DUR = 22.0;
export const FRAMES = 1320;
export const BPM = 120;
export const BEAT = 0.5;
export const BAR = 2.0;

export const SCENES = [
  { id: 'golpe', t0: 0.00, t1: 0.50, name: 'Golpe: la línea cruza y estalla' },
  { id: 'remolino', t0: 0.50, t1: 2.00, name: 'Remolino + "TU IDEA, HECHA PASTEL."' },
  { id: 'logo', t0: 2.00, t1: 3.00, name: 'Morph al logo' },
  { id: 'fichas', t0: 3.00, t1: 6.00, name: 'Teléfono + fichas SABOR · RELLENO · TAMAÑO · DISEÑO' },
  { id: 'cuentanos', t0: 6.00, t1: 8.00, name: '"CUÉNTANOS TU DISEÑO" (01, 03, 07)' },
  { id: 'muro', t0: 8.00, t1: 10.50, name: 'Muro de diseños en órbita (05, 10, 09, 07) → galería' },
  { id: 'surtido', t0: 10.50, t1: 14.00, name: 'Cupcakes y galletas (11, 06, 08, 04)' },
  { id: 'whatsapp', t0: 14.00, t1: 16.00, name: 'Botón "PIDE POR WHATSAPP"' },
  { id: 'cierre', t0: 16.00, t1: 19.00, name: 'Pull-back al logo + "Adara Pastelería · Coyoacán, CDMX"' },
  { id: 'endcard', t0: 19.00, t1: 22.00, name: 'End card' },
];

// Todo lo que se mueve tiene hora. Los tiempos de palabra (W.*) se rellenan con la voz real.
export const T = {
  streak: [0.00, 0.44],
  burst: 0.47,
  swirlDraw: [0.52, 1.92],
  textOut1: [1.95, 2.30],
  swirlToRing: [2.00, 2.42],
  logoReveal: [2.25, 2.85],
  ringToPhone: [3.00, 3.46],
  logoToHeader: [3.00, 3.46],
  heroIn: [3.00, 3.40],
  scroll1: [3.02, 3.36],
  tap1: 3.41,          // Chocolate (palabra "sabor")
  scroll2: [3.70, 4.14],
  tap2: 4.21,          // Nutella ("relleno")
  scroll3: [4.45, 5.00],
  tap3: 5.07,          // Mediano ("tamaño")
  cardSabor: 3.41, cardRelleno: 4.21, cardTamano: 5.07, cardDiseno: 5.50,
  tapIdea: 5.42,
  typeIdea: [5.50, 6.05],
  cardsOut: [5.85, 6.30],
  phoneBack: [5.95, 6.55],
  ribbon: [6.00, 8.00],
  heroOut: [5.90, 6.40],
  toOrbit: [7.70, 8.20],
  phoneOrbit: [7.80, 8.40],
  orbit: [8.00, 10.50],
  toGallery: [9.93, 10.45],
  phoneAway: [10.45, 11.25],
  card11: 11.63, card06: 12.29, card08: 12.45, card04: 12.79,
  surtidoOut: [13.80, 14.20],
  phoneWA: [13.85, 14.40],
  btnLift: [14.05, 14.45],
  pulses: [14.50, 15.00, 15.50],
  btnPress: 15.00,
  btnBack: [15.85, 16.25],
  phoneShrink: [16.00, 16.60],
  phoneToRing: [16.50, 17.10],
  logoIn: [16.55, 17.15],
  respiro: [18.40, 19.00],
  endHit: 19.00,
  endOut: [18.82, 19.12],
  endLine: [19.00, 19.60],
};

export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, u) => a + (b - a) * u;
export const prog = (t, a, b) => clamp((t - a) / (b - a));
export const easeInOut = (u) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
export const easeOut = (u) => 1 - Math.pow(1 - u, 3);
export const easeOut5 = (u) => 1 - Math.pow(1 - u, 5);
export const easeIn = (u) => u * u * u;
export const easeOutBack = (u, k = 1.70158) => 1 + (k + 1) * Math.pow(u - 1, 3) + k * Math.pow(u - 1, 2);
// resorte: 0 -> 1 con rebote amortiguado; u en unidades de "duracion"
export const spring = (u, f = 10, d = 6) => (u <= 0 ? 0 : 1 - Math.exp(-d * u) * Math.cos(f * u));
export const smooth = (u) => u * u * (3 - 2 * u);
