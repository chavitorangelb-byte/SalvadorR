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

// locución (planeada): inicio de cada línea y palabra clave donde aterriza la tipografía
export const VO = {
  planned: true,
  lines: [
    { id: 'L1', t: 0.50, text: 'Más de veinte años de repostería artesanal.', words: { veinte: 0.86, anos: 1.16 } },
    { id: 'L2', t: 4.00, text: 'Cuatro punto ocho estrellas en Google.', words: { cuatro: 4.00, google: 5.35 } },
    { id: 'L3', t: 6.20, text: 'Imagínalos en tu propia página.' },
    { id: 'L4', t: 8.40, text: 'Elige el tamaño…', words: { tamano: 8.85 } },
    { id: 'L5', t: 10.20, text: '…y pide por WhatsApp.', words: { whatsapp: 10.75 } },
    { id: 'L6', t: 13.60, text: 'Patissier. Repostería fina.', words: { patissier: 13.60, reposteria: 14.55 } },
  ],
};
const W = (id, k) => VO.lines.find((l) => l.id === id).words[k];

export const T = {
  whip: [0.00, 0.50],          // la cinta cruza de lado a lado
  boxIn: [0.13, 0.80],         // la caja cae y asienta
  tie: [0.34, 1.50],           // la cinta rodea la caja y se anuda
  cinch: 1.42,                 // el moño aprieta
  t20: W('L1', 'veinte'), tAnos: W('L1', 'anos'),
  typeOut: 1.96,
  untie: [2.00, 3.00],         // el moño se suelta y su trazo se vuelve el marco del teléfono
  glass: [2.44, 2.96],         // el cristal crece dentro del marco (SDF moño -> rectángulo redondeado)
  intro: [2.55, 3.95],         // portada de la página
  cardScroll: [3.86, 4.50],
  card: [W('L2', 'cuatro'), 5.30], typed: [4.55, 5.90],
  galScroll: [6.00, 6.95], gal: [6.20, 7.60],
  orderScroll: [7.86, 8.72], order: [8.00, 9.00], sizes: [8.42, 9.30],
  pick: 9.42, ring: [9.50, 10.05],
  tapIn: 10.62, tap: 10.95, tapUp: 11.05, wave: [11.05, 11.85],
  pull: [12.00, 13.40], topScroll: [12.35, 13.70],
  fold: [14.00, 15.20], endCard: 16.00,
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
