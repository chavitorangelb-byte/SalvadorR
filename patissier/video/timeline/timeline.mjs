// Línea de tiempo maestra del video de Patissier. La comparten la captura de la página y el compositor.
// 60 fps · 120 BPM (compás = 2.0 s = 120 cuadros) · 16 s de pieza + 2 s de end card.
// Los tiempos de la locución son los PLANEADOS del guion: cuando exista la toma real, se sustituye VO
// por los tiempos medidos y todo lo que cuelga de VO se mueve con la voz.
export const FPS = 60, DUR = 18, FRAMES = DUR * FPS;
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, k) => a + (b - a) * k;
export const prog = (t, [a, b]) => clamp((t - a) / (b - a));
export const smooth = (x) => { x = clamp(x); return x * x * (3 - 2 * x); };
export const easeOut = (x, p = 3) => 1 - Math.pow(1 - clamp(x), p);
export const easeIn = (x, p = 3) => Math.pow(clamp(x), p);
export const easeInOut = (x, p = 3) => { x = clamp(x); return x < 0.5 ? Math.pow(2 * x, p) / 2 : 1 - Math.pow(2 - 2 * x, p) / 2; };
// resorte críticamente subamortiguado: 0 -> 1 con rebote (zeta < 1)
export const spring = (x, freq = 2.2, zeta = 0.42) => { if (x <= 0) return 0; const w = freq * 2 * Math.PI, wd = w * Math.sqrt(1 - zeta * zeta);
  return 1 - Math.exp(-zeta * w * x) * (Math.cos(wd * x) + (zeta * w / wd) * Math.sin(wd * x)); };

// locución: toma de ElevenLabs (voz Hope, eleven v4) generada a mano por Salvador.
// take = [inicio, fin] en la toma; t = inicio en el VIDEO. Palabras: tiempos de video medidos
// con la envolvente, las sibilantes y los cierres de oclusivas de la toma (ver video/tools/vo_place.py).
export const VO = {
  planned: false, file: 'video/audio/vo/vo_hope_v4_48k.wav',
  lines: [
    { id: 'L1', take: [0.08, 2.85], t: 0.50, text: 'Más de veinte años de repostería artesanal.', words: { veinte: 1.12, anos: 1.44, reposteria: 1.97, artesanal: 2.62 } },
    { id: 'L2', take: [3.58, 5.56], t: 3.98, text: 'Cuatro punto ocho estrellas en Google.', words: { cuatro: 4.00, ocho: 4.62, estrellas: 4.93, google: 5.55 } },
    { id: 'L3', take: [6.11, 8.11], t: 6.24, text: 'Imagínalos en tu propia página.', words: { pagina: 7.70 } },
    { id: 'L4', take: [8.66, 9.75], t: 8.43, text: 'Elige el tamaño…', words: { tamano: 8.88 } },
    { id: 'L5', take: [10.09, 11.15], t: 10.18, text: '…y pide por WhatsApp.', words: { whatsapp: 10.89 } },
    { id: 'L6', take: [11.78, 14.27], t: 13.32, text: 'Patissier. Repostería fina.', words: { patissier: 13.34, reposteria: 14.60, fina: 15.34 } },
  ],
};
const W = (id, k) => VO.lines.find((l) => l.id === id).words[k];

export const T = {
  whip: [0.00, 0.50],          // la cinta cruza de lado a lado
  boxIn: [0.13, 0.80],         // la caja cae y asienta
  tie: [0.34, 1.50],           // la cinta rodea la caja y se anuda
  cinch: 1.50,                 // el moño aprieta
  t20: W('L1', 'veinte'), tAnos: W('L1', 'anos'),
  untie: [2.00, 3.00],         // el moño se suelta y su trazo se vuelve el marco del teléfono
  glass: [2.44, 2.96],         // el cristal crece dentro del marco (SDF moño -> rectángulo redondeado)
  intro: [2.45, 3.85],         // portada de la página
  cardScroll: [3.70, 4.30],
  card: [3.80, 5.70], typed: [4.62, 6.05],
  galScroll: [6.15, 7.05], gal: [6.30, 7.70], orbit: [6.00, 8.20],
  orderScroll: [7.80, 8.60], order: [7.95, 8.95], sizes: [8.45, 9.25],
  pick: 9.42, ring: [9.48, 10.05],
  tap: W('L5', 'whatsapp') + 0.03, tapUp: W('L5', 'whatsapp') + 0.13, wave: [W('L5', 'whatsapp') + 0.13, W('L5', 'whatsapp') + 0.93],
  pull: [11.80, 12.70], topScroll: [11.85, 12.65],
  fold: [12.70, 13.95],        // la interfaz se pliega hacia el moño y la caja regresa
  tPat: W('L6', 'patissier'), tFina: W('L6', 'reposteria'),
  exit: [15.62, 16.00],        // la caja sale por abajo y el medallón del logo aterriza en 16.00
  endCard: 16.00,
};
// qué parte del video necesita capturas de la página
export const SCREEN = [T.untie[0] + 0.25, T.fold[1] + 0.05];

// estado de la página en el instante t (lo que recibe window.pat.cap) + scroll
export function pageState(t) {
  const touch = (() => {
    const a = (t0, t1, key) => { if (t < t0 - 0.3 || t > t1 + 0.22) return null;
      const inn = easeOut(prog(t, [t0 - 0.3, t0 - 0.06])), down = smooth(prog(t, [t0 - 0.05, t0 + 0.03])), out = smooth(prog(t, [t1, t1 + 0.22]));
      return { key, a: inn * (1 - out), s: (1.35 - 0.35 * inn) * (1 - 0.2 * down) + 0.5 * out }; };
    return a(T.pick, T.pick + 0.09, 'size') || a(T.tap, T.tapUp, 'cta');
  })();
  return {
    intro: prog(t, T.intro), card: prog(t, T.card), typed: prog(t, T.typed),
    gal: prog(t, T.gal), order: prog(t, T.order), sizes: prog(t, T.sizes),
    size: t >= T.pick + 0.06 ? 'Mediano' : null, ring: prog(t, T.ring),
    press: smooth(prog(t, [T.tap - 0.05, T.tap + 0.03])) * (1 - smooth(prog(t, [T.tapUp, T.tapUp + 0.16]))),
    wave: prog(t, T.wave), touch,
  };
}
// scroll: tramos [t0,t1] hacia un destino con nombre (la captura mide el destino en la página real)
export const SCROLLS = [
  { t: T.cardScroll, to: 'card' }, { t: T.galScroll, to: 'gallery' }, { t: T.orderScroll, to: 'order' }, { t: T.topScroll, to: 'top' },
];
export const scrollEase = (x) => easeInOut(x, 2.6);
