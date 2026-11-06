// Línea de tiempo maestra del video de Matíca (segundos de video). La comparten el arnés de
// captura de la página (Node) y el compositor (navegador). 60 fps, 1620 cuadros, 92 BPM.
//
// Nada va "a ojo": cada momento sale de una regla amarrada a la voz real (vo_words.json,
// alineada con Whisper y afinada con la energía del audio) o a la rejilla musical.
// Al cambiar la toma de voz basta con volver a correr video/tools/relock.sh.

export const FPS = 60;
export const DUR = 27.0;
export const FRAMES = 1620;
export const BPM = 92;
export const BEAT = 60 / BPM;             // 0.6522 s
export const BAR = BEAT * 4;              // 2.6087 s (compás)
export const SIXT = BEAT / 4;             // semicorchea 0.1630 s
export const QUERY = 'café de especialidad aguascalientes';

export const bar = (m) => m * BAR;
export const snap = (t, step = SIXT, mode = 'up') => {
  const k = t / step;
  const n = mode === 'up' ? Math.ceil(k - 1e-6) : mode === 'down' ? Math.floor(k + 1e-6) : Math.round(k);
  return +(n * step).toFixed(4);
};
const r3 = (x) => +x.toFixed(3);
const span = (a, d) => [r3(a), r3(a + d)];

const norm = (w) => w.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

// ---------------------------------------------------------------------------
// lock(vo): resuelve toda la línea de tiempo contra la toma de voz colocada
// ---------------------------------------------------------------------------
export function lock(vo) {
  const clip = (id) => { const c = vo.clips.find((x) => x.id === id); if (!c) throw new Error('falta la frase ' + id); return c; };
  const W = (id, key) => {
    const c = clip(id);
    let w;
    if (typeof key === 'number') w = c.words[key];
    else {
      const [txt, nth] = key.split('#');
      w = c.words.filter((x) => norm(x.w) === norm(txt))[(Number(nth) || 1) - 1];
    }
    if (!w) throw new Error(`falta la palabra "${key}" en ${id}`);
    return w;
  };
  const T = {};

  // ---------- GANCHO ----------
  T.hit0 = 0.0;                                     // golpe en f0
  T.dropFall = [0.0, 0.30];                         // la gota cae
  T.barIn = [0.22, 0.58];                           // barra de búsqueda de cristal (genérica)
  T.caret = [0.58, W('L1', 'café').t0];             // la gota late como cursor mientras dice "Alguien busca"
  const TYPED = [['café', 'café'], ['de', 'de'], ['especialidad', 'especialidad'], ['aguascalientes', 'Aguascalientes.']];
  const TYPING = typingSync(TYPED.map(([txt, spoken]) => ({ txt, w: W('L1', spoken) })));
  T.type = [TYPING[0].t, TYPING[TYPING.length - 1].t];
  T.enter = snap(Math.max(T.type[1] + 0.08, clip("L1").t1 - 0.12));
  T.barOut = span(T.enter + 0.04, 0.30);            // la barra se recoge en la gota

  // ---------- LLEGADA ----------
  T.dropOutline = span(T.enter + 0.06, 0.70);       // la gota se estira y dibuja el contorno del celular
  T.phoneIn = span(T.enter + 0.28, 0.48);           // el cristal 3D aparece sobre el contorno
  T.phoneSettle = span(T.enter + 0.45, 0.95);       // gira 12° y se asienta
  T.screenOn = r3(T.enter + 0.58);                  // enciende la pantalla
  T.pageIntro = span(T.screenOn, 0.85);             // carga la portada real (foto, logo, chips)
  T.heroPush = span(T.pageIntro[0] + 0.45, 0.65);   // acerca para leer "Café de especialidad" y los chips

  // ---------- MENÚ ----------
  T.tapMenu = Math.max(snap(W('L3', 0).t0 - 0.36, BAR / 4, 'round'), r3(T.pageIntro[1] + 0.25));
  T.dropCircleMenu = [r3(T.tapMenu - 0.46), r3(T.tapMenu - 0.04)];   // la gota rodea "Ver menú"
  T.scrollMenu = span(T.tapMenu + 0.10, 0.78);      // scroll con inercia al menú (pestaña Café)
  T.dropHopLatte = span(T.scrollMenu[1] + 0.02, 0.30);   // rebota a la tarjeta del Latte (deja brillo)
  // push-in y tipografía se relevan: el push entra cuando "TU MENÚ / COMPLETO," ya se leyó
  T.pushLatte = span(Math.max(W('L3', 'completo,').t0 + 0.40, T.dropHopLatte[1] + 0.02), 0.36);   // hasta leer el precio al tamaño real
  T.tapFrio = r3(Math.max(W('L3', 'precios,').t0 - 0.12, T.pushLatte[1] + 0.02));   // el conteo $60 -> $65 cae sobre "precios"
  T.dropCircleFrio = [r3(Math.max(T.dropHopLatte[1] + 0.05, T.tapFrio - 0.36)), r3(T.tapFrio - 0.03)];   // la gota va pegada al cristal: rodea mientras acerca
  T.countFrio = span(T.tapFrio + 0.02, 0.42);
  T.pullLatte = span(Math.min(T.countFrio[1] - 0.10, W('L3', 'en').t0 - 0.36), 0.28);
  T.dropHopEspeciales = span(T.pullLatte[1] - 0.05, 0.30);
  T.tapEspeciales = r3(T.dropHopEspeciales[1] + 0.02);
  T.panelEspeciales = span(T.tapEspeciales, 0.36);
  T.cardOut = span(T.panelEspeciales[1] + 0.06, 0.50);   // Cold brew tonic sale al espacio 3D
  T.cardFloat = span(T.cardOut[1], 0.48);
  T.cardBack = span(T.cardFloat[1], 0.42);          // regresa y cae al pedido
  T.cartIn = span(T.cardBack[1] - 0.02, 0.45);      // aparece la barra del pedido: 1 · $85
  T.tapWaffles = snap(W('L4', 0).t0 - 0.36, BAR / 4, 'round');
  T.dropHopWaffles = [r3(T.tapWaffles - 0.33), r3(T.tapWaffles - 0.02)];
  T.swipeTabs = span(T.dropHopWaffles[0] - 0.44, 0.40);   // swipe en las categorías: aparece "Waffles de yuca" (estaba fuera de la vista)

  // ---------- WAFFLES DE YUCA ----------
  T.panelWaffles = span(T.tapWaffles, 0.36);
  T.pushJamon = span(Math.max(W('L4', 'yuca').t0 + 0.36, T.panelWaffles[1] + 0.30), 0.35);   // "Jamón serrano y matícas $95", foto e ícono sin gluten
  T.dropHopJamon = [r3(T.pushJamon[0] - 0.40), r3(T.pushJamon[0] - 0.04)];   // la gota se pasa a la tarjeta antes del push-in (guía la mirada)
  T.dropUnderlineJamon = span(T.pushJamon[1] + 0.02, 0.30);
  T.tapJamon = r3(T.dropUnderlineJamon[1] + 0.02);
  T.pullJamon = span(T.tapJamon, 0.38);              // se aleja mientras sube la ficha
  T.sheetUp = span(T.tapJamon + 0.02, 0.46);
  T.dropCircleAdd = [r3(Math.min(T.sheetUp[0] + 0.24, bar(5) - 0.38)), r3(bar(5) - 0.02)];   // ~0.4 s alrededor de "Agregar"

  // ---------- PIDE ----------
  T.lift = bar(5);                                  // lift musical (13.04 s)
  T.pressAdd = span(T.lift, 0.12);                  // estado presionado real
  T.tapAdd = r3(T.pressAdd[1]);
  T.addLift3D = span(T.pressAdd[1], 0.52);          // se ve el presionado real y al soltar "Agregar" se levanta en 3D con pop
  T.sheetDown = span(T.tapAdd + 0.05, 0.50);
  T.countCart = span(T.tapAdd + 0.20, 0.62);        // $85 -> $180 contando, contador 1 -> 2
  T.dropHomeAdd = span(T.addLift3D[0] + 0.10, 0.40); // la gota deja "Agregar" y vuelve al canto del celular
  T.tapCartbar = r3(Math.max(T.countCart[1] + 0.20, W('L5', 'antes').t1 + 0.05));
  T.cartSheetUp = span(T.tapCartbar + 0.02, 0.50);  // aparecen las dos salidas
  T.pushExits = span(Math.max(W('L5', 'listo.').t0 + 0.35, T.cartSheetUp[1] + 0.10), 0.35);
  T.dropHopPickup = [r3(T.pushExits[0] - 0.40), r3(T.pushExits[0] - 0.04)];   // se pasa a "Pedir para recoger" antes del push-in
  T.dropGlintPickup = span(T.pushExits[1] + 0.04, 0.36);
  T.pullExits = span(T.dropGlintPickup[1] - 0.03, 0.28);
  T.cartSheetDown = span(T.pullExits[1] - 0.04, 0.45);
  T.dropHome = span(T.pullExits[1] - 0.06, 0.46);           // la gota regresa al canto del celular

  // ---------- ASÍ SE VIVE ----------
  T.scrollVive = span(Math.max(snap(T.cartSheetDown[1], BEAT, 'up'), r3(W('L6', 0).t0 - 0.46)), 0.78);
  T.iconDog = span(W('L6', 'Pet').t0 - 0.05, 0.62);         // ícono de línea: perrito
  T.iconLaptop = span(W('L6', 'working').t0 - 0.05, 0.62);  // ícono de línea: laptop
  T.scrollReviews = span(W('L6', 'reseñas').t0 - 0.58, 0.38);
  T.swipe13 = span(T.scrollReviews[1] + 0.02, 0.42);   // un solo swipe que pasa por 1, 2 y 3
  T.fanOut = span(T.swipe13[1] - 0.07, 0.40);       // tres tarjetas de cristal en abanico 3D
  // ---------- VISÍTANOS (se fija primero: el abanico regresa justo antes) ----------
  T.scrollVisit = span(Math.max(bar(8) + 0.13, T.fanOut[1] + 0.45), 0.58);
  T.fanBack = [r3(T.scrollVisit[0] - 0.18), r3(T.scrollVisit[0] + 0.14)];
  T.pushReview2 = [r3(T.fanOut[1] - 0.15), r3(T.fanBack[0] - 0.03)];   // "Los waffles son deliciosos y de sabores únicos" 
  T.pinDrop = span(T.scrollVisit[1] - 0.20, 0.80);
  T.pushHours = span(T.scrollVisit[1] + 0.05, 0.50);
  T.dropHopHours = [r3(T.pushHours[0] - 0.34), r3(T.pushHours[0] - 0.02)];  // salta a la tarjeta del horario antes del push-in
  T.dropCircleHours = span(T.pushHours[1] - 0.20, 0.55);
  T.holdHours = [r3(T.pushHours[1]), 22.8];

  // ---------- CIERRE ----------
  T.phoneAway = [22.8, 23.55];                      // el celular se aleja a un lado
  T.breath = 23.0;                                  // respiro musical
  T.dropFallCenter = [23.15, 23.95];                // la gota cae hacia el centro

  // ---------- END CARD ----------
  T.hit24 = 24.0;                                   // golpe grave
  T.logoIn = [24.0, 24.72];                         // logo oficial: leve giro 3D y sombra suave
  T.dropOnCup = [24.42, 24.80];                     // la gota cae sobre la taza del logo
  T.sparkle = [24.80, 25.20];                       // se deshace en un destello mínimo
  T.tagline = span(W('L7b', 'Así').t0 - 0.06, 0.55);  // "Así se vería tu página · Elevate Negocios"
  T.disclaimer = span(T.tagline[1] + 0.02, 0.40);   // línea obligatoria de demo
  T.end = DUR;

  // la página está en pantalla (se captura cuadro por cuadro) entre estos tiempos
  const SCREEN = [T.screenOn, T.phoneAway[1]];

  const SCENES = [
    { id: 'hook', t0: 0, t1: T.enter, name: 'Gancho: la gota escribe la búsqueda' },
    { id: 'llegada', t0: T.enter, t1: T.tapMenu, name: 'Llegada: el celular y su portada real' },
    { id: 'menu', t0: T.tapMenu, t1: T.tapWaffles, name: 'Menú: precios y Frío / Caliente' },
    { id: 'waffles', t0: T.tapWaffles, t1: T.lift, name: 'Waffles de yuca' },
    { id: 'pide', t0: T.lift, t1: T.scrollVive[0], name: 'Pide: agregar, $180 y dos salidas' },
    { id: 'vive', t0: T.scrollVive[0], t1: T.scrollVisit[0], name: 'Así se vive: pet, working y reseñas' },
    { id: 'visita', t0: T.scrollVisit[0], t1: T.phoneAway[0], name: 'Visítanos: pin y horario' },
    { id: 'cierre', t0: T.phoneAway[0], t1: T.hit24, name: 'Cierre: el celular se aparta, la gota cae' },
    { id: 'endcard', t0: T.hit24, t1: DUR, name: 'End card' },
  ];

  // ---------- Acciones de la página (las ejecuta el arnés de captura con window.matica) ----------
  const PAGE_ACTIONS_RAW = [
    { t: T.pageIntro[0], type: 'intro' },
    { t: T.tapMenu, type: 'tap', sel: '#cta-menu', noScroll: true },
    { t: T.scrollMenu, type: 'scroll', to: 'menu' },
    { t: T.tapFrio, type: 'tap', sel: '#item-latte [data-temp="cold"]' },
    { t: T.tapEspeciales, type: 'tap', sel: '#tab-especiales' },
    { t: T.cardOut[0], type: 'hide', sel: '#item-cold-brew-tonic', on: true },
    { t: T.cardBack[1], type: 'hide', sel: '#item-cold-brew-tonic', on: false },
    { t: T.cardBack[1], type: 'add', spec: { id: 'cold-brew-tonic', opt: 'Piloncillo' } },
    { t: T.swipeTabs, type: 'scrollX', sel: '#tabs', to: '#tab-waffles' },
    { t: T.tapWaffles, type: 'tap', sel: '#tab-waffles' },
    { t: T.tapJamon, type: 'tap', sel: '#item-jamon-serrano .item-open' },
    { t: T.pressAdd, type: 'press', sel: '#si-add' },
    { t: T.addLift3D[0], type: 'hide', sel: '#si-add', on: true },
    { t: T.tapAdd, type: 'tap', sel: '#si-add', quiet: true },
    { t: T.addLift3D[1], type: 'hide', sel: '#si-add', on: false },
    { t: T.tapCartbar, type: 'tap', sel: '#cartbar' },
    { t: T.cartSheetDown[0], type: 'closeSheet' },
    { t: T.scrollVive, type: 'scroll', to: 'vive' },
    { t: T.scrollReviews, type: 'scroll', to: 'reviews' },
    { t: T.swipe13[0], type: 'review', i: 2, dur: T.swipe13[1] - T.swipe13[0] },
    { t: T.fanOut[0], type: 'hide', sel: '#rev-track', on: true },
    { t: T.fanBack[1], type: 'hide', sel: '#rev-track', on: false },
    { t: T.scrollVisit, type: 'scroll', to: 'visit' },
    { t: T.pinDrop[0], type: 'dropPin' },
  ];
  const start = (a) => (Array.isArray(a.t) ? a.t[0] : a.t);
  const PAGE_ACTIONS = PAGE_ACTIONS_RAW.map((a, k) => ({ a, k })).sort((x, y) => start(x.a) - start(y.a) || x.k - y.k).map((x) => x.a);

  // rects que el compositor necesita (se miden en su instante)
  const PROBES = [
    { t: T.pageIntro[1], name: 'heroBlock', sel: '.hero-body' },   // ya terminada la animación de carga
    { t: T.dropCircleMenu[0], name: 'ctaMenu', sel: '#cta-menu' },
    { t: T.dropHopLatte[0], name: 'latteCard', sel: '#item-latte' },
    { t: T.dropCircleFrio[0], name: 'latteFrio', sel: '#item-latte [data-temp="cold"]' },
    { t: T.pushLatte[0], name: 'lattePrice', sel: '#item-latte [data-price-for]' },
    { t: T.dropHopEspeciales[0], name: 'tabEspeciales', sel: '#tab-especiales' },
    { t: T.cardOut[0], name: 'coldBrewCard', sel: '#item-cold-brew-tonic' },
    { t: T.dropHopWaffles[0], name: 'tabWaffles', sel: '#tab-waffles' },
    { t: T.pushJamon[0], name: 'jamonCard', sel: '#item-jamon-serrano' },
    { t: T.dropUnderlineJamon[0], name: 'jamonName', sel: '#item-jamon-serrano .item-name' },
    { t: T.dropCircleAdd[0], name: 'siAdd', sel: '#si-add' },
    { t: T.countCart[0], name: 'cartbar', sel: '#cartbar' },
    { t: T.pushExits[0], name: 'exits', sel: '#sc-body .exits' },
    { t: T.pushExits[0], name: 'scTotal', sel: '#sc-total' },
    { t: T.dropGlintPickup[0], name: 'exitPickup', sel: '#exit-pickup' },
    { t: T.iconDog[0], name: 'perks', sel: '.perks' },
    { t: T.fanOut[0], name: 'rev1', sel: '#rev-1' },
    { t: T.fanOut[0], name: 'rev2', sel: '#rev-2' },
    { t: T.fanOut[0], name: 'rev3', sel: '#rev-3' },
    { t: T.pushHours[0], name: 'hours', sel: '#hours' },
    { t: T.pinDrop[0], name: 'map', sel: '#map' },
  ];

  // ---------- Tipografía cinética (por glifo, stagger 26 ms; FUERA de la pantalla del celular) ----------
  // Cada palabra aterriza en el inicio de su palabra de la locución. Nunca más de 4 palabras en pantalla.
  // Relevo: si la voz va rápida, un grupo no entra hasta que salió el anterior, cada palabra
  // llega al menos 0.10 s después de la previa y la última se lee al menos 0.32 s.
  let prevOut = -1;
  const kin = (id, scene, side, words, outAt) => {
    let floor = prevOut + 0.20;
    const lines = words.map((ln) => ln.map(([text, c, k, off = 0]) => {
      const land = r3(Math.max(W(c, k).t0 + off, floor));
      floor = land + 0.10;
      return { text, vo: [c, k], spoken: W(c, k).w, land };
    }));
    const first = lines[0][0].land, last = lines.flat().reduce((a, w) => Math.max(a, w.land), 0);
    const g = { id, scene, side, lines, in: r3(first - 0.10), out: span(Math.max(outAt(last), last + 0.32), 0.18) };
    prevOut = g.out[1];
    return g;
  };
  const KINETIC = [
    kin('k-menu-a', 'menu', 'left', [[['TU', 'L3', 'Tu'], ['MENÚ', 'L3', 'menú']], [['COMPLETO,', 'L3', 'completo,']]],
      () => T.pushLatte[0] - 0.05),
    kin('k-menu-b', 'menu', 'left', [[['EN', 'L3', 'en'], ['SU', 'L3', 'su']], [['CELULAR', 'L3', 'celular.']]],
      () => T.cardOut[0] + 0.10),
    kin('k-waffles', 'waffles', 'right', [[['WAFFLES', 'L4', 'Waffles']], [['DE', 'L4', 'de'], ['YUCA', 'L4', 'yuca']]],
      () => T.pushJamon[0] - 0.05),
    kin('k-pide', 'pide', 'left', [[['PIDE', 'L5', 'pidan'], ['ANTES,', 'L5', 'antes']], [['RECOGE', 'L5', 'lleguen'], ['LISTO', 'L5', 'listo.']]],
      () => T.pushExits[0] - 0.05),
    kin('k-perro', 'vive', 'right', [[['TRAE', 'L6', 'Pet'], ['A', 'L6', 'Pet', 0.10]], [['TU', 'L6', 'friendly,'], ['PERRO.', 'L6', 'friendly,', 0.10]]],
      () => W('L6', 'working').t0 - 0.30),
    kin('k-laptop', 'vive', 'right', [[['TRAE', 'L6', 'working'], ['TU', 'L6', 'working', 0.14]], [['LAPTOP.', 'L6', 'friendly,#2']]],
      () => T.scrollReviews[0] + 0.08),
  ];

  // ---------- La gota (2D, ámbar cold brew #8A4B1C; conductor, no estrella) ----------
  const DROP = [
    { t: T.dropFall, act: 'cae desde arriba al centro (golpe en f0)' },
    { t: T.barIn, act: 'salpica y abre la barra de búsqueda de cristal' },
    { t: T.caret, act: 'late como cursor' },
    { t: T.type, act: 'escribe la búsqueda letra por letra' },
    { t: T.enter, act: 'Enter: se contrae' },
    { t: T.dropOutline, act: 'se estira y dibuja el contorno del celular' },
    { t: T.dropCircleMenu, act: 'rodea "Ver menú"' },
    { t: T.dropHopLatte, act: 'rebota a la tarjeta del Latte (brillo)' },
    { t: T.dropCircleFrio, act: 'rodea "Frío"' },
    { t: T.dropHopEspeciales, act: 'rebota a "Los especiales" (brillo)' },
    { t: T.dropHopWaffles, act: 'rebota a "Waffles de yuca" (brillo)' },
    { t: T.dropHopJamon, act: 'rebota a la tarjeta del waffle (brillo) antes del push-in' },
    { t: T.dropUnderlineJamon, act: 'subraya "Jamón serrano y matícas"' },
    { t: T.dropCircleAdd, act: 'rodea "Agregar"' },
    { t: T.dropHomeAdd, act: 'deja "Agregar" y vuelve al canto del celular' },
    { t: T.dropHopPickup, act: 'salta a "Pedir para recoger"' },
    { t: T.dropGlintPickup, act: 'rebota y deja un brillo sobre "Pedir para recoger"' },
    { t: T.dropHome, act: 'regresa al canto del celular' },
    { t: T.dropHopHours, act: 'salta a la tarjeta del horario' },
    { t: T.dropCircleHours, act: 'rodea el horario' },
    { t: T.dropFallCenter, act: 'cae hacia el centro' },
    { t: T.dropOnCup, act: 'cae sobre la taza del logo' },
    { t: T.sparkle, act: 'se deshace en un destello mínimo' },
  ];

  // ---------- Cámara / celular (9:16; el celular ocupa 60–75 % de la altura en interfaz) ----------
  // Transiciones: en el tramo t el estado va hacia lo indicado (lo no indicado se conserva).
  // x, y: centro del celular (0..1 del cuadro) · h: alto del celular / alto del cuadro ·
  // push: zoom a la pantalla con foco en una sonda (≈ 2.2 = texto al tamaño de un celular real) ·
  // view: acercamiento de cámara al abanico de reseñas · rotY/rotX en grados.
  const CAMERA = [
    { t: [T.phoneIn[0], T.phoneIn[0]], x: 0.50, y: 0.47, h: 0.64, push: 1, view: 1, rotY: 12, rotX: -5, note: 'entra girado 12°' },
    { t: T.phoneSettle, h: 0.66, rotY: 0, rotX: 0, spring: true, note: 'se asienta' },
    { t: T.heroPush, push: 1.2, focus: 'heroBlock', note: 'se leen "Café de especialidad" y los chips' },
    { t: [T.dropCircleMenu[0], r3(T.scrollMenu[0] + 0.25)], x: 0.70, h: 0.60, push: 1, rotY: -5, note: 'a la derecha: texto a la izquierda' },
    { t: T.pushLatte, push: 2.2, focus: 'latteCard', note: '"Latte $60" y Frío / Caliente al tamaño de un celular real' },
    { t: T.pullLatte, push: 1 },
    { t: T.cardOut, x: 0.71, rotY: -9, note: 'la tarjeta flota en profundidad' },
    { t: [T.cardBack[0], T.panelWaffles[1]], x: 0.30, rotY: 5, note: 'cruza a la izquierda: texto a la derecha' },
    { t: T.pushJamon, push: 2.2, focus: 'jamonCard', note: '"Jamón serrano y matícas $95" legible' },
    { t: T.pullJamon, push: 1 },
    { t: [r3(T.sheetUp[1] - 0.20), r3(T.lift + 0.15)], x: 0.70, rotY: -4, note: '"Agregar" se levanta' },
    { t: T.pushExits, push: 1.95, focus: 'exits', note: 'total $180 y las dos salidas legibles' },
    { t: T.pullExits, push: 1 },
    { t: [r3(T.cartSheetDown[0] + 0.10), r3(T.scrollVive[0] + 0.30)], x: 0.30, rotY: 5, note: 'íconos y texto a la derecha' },
    { t: [T.scrollReviews[0], T.fanOut[1]], x: 0.50, h: 0.62, rotY: 0, note: 'abanico de reseñas al frente' },
    { t: T.pushReview2, view: 1.55, note: 'se acerca a la reseña 2' },
    { t: [T.fanBack[0], T.scrollVisit[1]], view: 1, h: 0.68 },
    { t: T.pushHours, push: 1.95, focus: 'hours', note: 'horario legible' },
    { t: T.phoneAway, x: 0.18, y: 0.50, h: 0.50, push: 1, rotY: 20, note: 'se aparta a un lado' },
  ];

  // ---------- Música (original en código, 92 BPM, lo-fi cálido) ----------
  const MUSIC = {
    bpm: BPM,
    base: 'Rhodes cálido + percusión suave de madera',
    layers: [
      { t: T.tapMenu, add: 'shaker', scene: 'menu' },
      { t: T.tapWaffles, add: 'bajo', scene: 'waffles' },
      { t: T.lift, add: 'guitarra limpia', scene: 'pide', note: 'lift' },
      { t: T.scrollVive[0], add: 'pad cálido', scene: 'vive' },
    ],
    breath: T.breath,
    hit: T.hit24,
    duckUnderVo: '≥ 12 dB por debajo de cada palabra',
  };

  const sfx = buildSfx(T, TYPING);
  return { FPS, DUR, FRAMES, BPM, QUERY, T, SCREEN, SCENES, PAGE_ACTIONS, PROBES, KINETIC, TYPING, DROP, CAMERA, MUSIC, SFX: sfx,
    ENDCARD: { tagline: 'Así se vería tu página · Elevate Negocios', disclaimer: 'Demo de cortesía de Elevate Negocios · pieza no oficial' },
    VO: vo.clips };
}

// ---------------------------------------------------------------------------
// Tecleo sincronizado a la voz: cada palabra se escribe mientras se dice
// (con un poco de irregularidad humana, determinista)
// ---------------------------------------------------------------------------
export function typingSync(words, seed = 11) {
  let s = seed >>> 0;
  const rnd = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
  const out = [];
  let prev = -1;
  words.forEach(({ txt, w }, k) => {
    const t0 = Math.max(prev + 0.035, w.t0 - 0.03);
    // la última palabra termina de escribirse cuando la voz la cierra (la cola "-tes" es decaimiento)
    const t1 = Math.max(w.t1 - (k === words.length - 1 ? 0.20 : 0.04), t0 + txt.length * 0.048);
    if (k > 0) { out.push({ c: ' ', t: +(t0 - 0.02).toFixed(3) }); }
    const ws = [...txt].map(() => 0.8 + 0.4 * rnd());
    const tot = ws.reduce((a, b) => a + b, 0);
    let acc = 0;
    [...txt].forEach((c, i) => { acc += ws[i]; out.push({ c, t: +(t0 + (t1 - t0) * (acc - ws[i] * 0.5) / tot).toFixed(3) }); });
    prev = out[out.length - 1].t;
  });
  return out;
}

// ---------------------------------------------------------------------------
// Cues de sonido (uno por cada movimiento visible)
// ---------------------------------------------------------------------------
function buildSfx(T, TYPING) {
  const q = [];
  const add = (t, type, note = '') => q.push({ t: +(+t).toFixed(3), type, note });
  add(T.hit0, 'golpe', 'f0');
  add(T.dropFall[1], 'gota-plic', 'la gota toca');
  add(T.barIn[0] + 0.04, 'cristal-in', 'barra de búsqueda');
  TYPING.forEach((k) => add(k.t, k.c === ' ' ? 'tecla-espacio' : 'tecla', k.c));
  add(T.enter, 'enter');
  add(T.dropOutline[0], 'gota-estira');
  add(T.dropOutline[1] - 0.1, 'trazo-cierra');
  add(T.phoneIn[0], 'cristal-celular');
  add(T.phoneSettle[0], 'giro');
  add(T.phoneSettle[1] - 0.15, 'asienta');
  add(T.pageIntro[0], 'pantalla-on');
  add(T.pageIntro[0] + 0.32, 'ui-pop', 'logo');
  add(T.dropCircleMenu[0], 'gota-giro');
  add(T.tapMenu, 'tap', 'Ver menú');
  add(T.scrollMenu[0], 'scroll', 'al menú');
  add(T.dropHopLatte[1], 'gota-plic', 'Latte');
  add(T.dropCircleFrio[0], 'gota-giro');
  add(T.tapFrio, 'tap', 'Frío');
  add(T.tapFrio + 0.02, 'selector', 'desliza');
  for (let k = 1; k <= 5; k++) add(T.countFrio[0] + (T.countFrio[1] - T.countFrio[0]) * (1 - Math.pow(1 - k / 5, 1 / 3)), 'conteo', `$${60 + k}`);
  add(T.dropHopEspeciales[1], 'gota-plic', 'Los especiales');
  add(T.tapEspeciales, 'tap', 'Los especiales');
  add(T.tapEspeciales + 0.03, 'pestana');
  add(T.cardOut[0], 'tarjeta-sale');
  add(T.cardFloat[0] + 0.05, 'hielos', 'cold brew');
  add(T.cardFloat[0] + 0.30, 'hielos', 'cold brew');
  add(T.cardBack[1] - 0.05, 'tarjeta-entra');
  add(T.cartIn[0] + 0.08, 'pedido-in');
  add(T.cartIn[0] + 0.22, 'contador', '1');
  add(T.swipeTabs[0], 'swipe', 'categorías');
  add(T.dropHopWaffles[1], 'gota-plic', 'Waffles de yuca');
  add(T.dropHopJamon[1], 'gota-plic', 'tarjeta del waffle');
  add(T.tapWaffles, 'tap', 'Waffles de yuca');
  add(T.tapWaffles + 0.03, 'pestana');
  add(T.dropUnderlineJamon[0], 'gota-trazo', 'subraya');
  add(T.tapJamon, 'tap', 'ficha');
  add(T.sheetUp[0], 'hoja-sube');
  add(T.dropCircleAdd[0], 'gota-giro');
  add(T.pressAdd[0], 'press');
  add(T.tapAdd, 'pop', 'Agregar se levanta');
  add(T.sheetDown[0], 'hoja-baja');
  for (let k = 1; k <= 12; k++) add(T.countCart[0] + (T.countCart[1] - T.countCart[0]) * (1 - Math.pow(1 - k / 12, 1 / 3)), 'conteo', `total ${k}/12`);
  add(T.countCart[0] + 0.05, 'contador', '2');
  add(T.tapCartbar, 'tap', 'Ver pedido');
  add(T.cartSheetUp[0], 'hoja-sube');
  add(T.dropHomeAdd[1], 'gota-plic', 'canto');
  add(T.dropHopPickup[1], 'gota-plic', 'Pedir para recoger');
  add(T.dropGlintPickup[0], 'gota-brillo');
  add(T.cartSheetDown[0], 'hoja-baja');
  add(T.dropHome[1], 'gota-plic', 'canto');
  add(T.scrollVive[0], 'scroll', 'así se vive');
  add(T.iconDog[0], 'trazo', 'perrito');
  add(T.iconLaptop[0], 'trazo', 'laptop');
  add(T.scrollReviews[0], 'scroll', 'reseñas');
  add(T.swipe13[0], 'swipe', '1 a 3');
  add(T.swipe13[0] + 0.21, 'swipe-tick', 'pasa la 2');
  add(T.fanOut[0], 'abanico-sale');
  add(T.fanBack[0], 'abanico-regresa');
  add(T.scrollVisit[0], 'scroll', 'visítanos');
  add(T.pinDrop[0] + 0.30, 'pin');
  add(T.dropHopHours[1], 'gota-plic', 'horario');
  add(T.dropCircleHours[0], 'gota-giro');
  add(T.phoneAway[0], 'whoosh', 'se aparta');
  add(T.dropFallCenter[1] - 0.1, 'gota-cae');
  add(T.hit24, 'golpe-grave');
  add(T.logoIn[0] + 0.05, 'logo-in');
  add(T.dropOnCup[1], 'gota-plic', 'taza');
  add(T.sparkle[0] + 0.04, 'destello');
  return q.sort((a, b) => a.t - b.t);
}

// ---------- Utilidades deterministas (compartidas con el compositor) ----------
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, k) => a + (b - a) * k;
export const prog = (t, [a, b]) => clamp((t - a) / (b - a));
export const easeInOut = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
export const easeOut = (k) => 1 - Math.pow(1 - k, 3);
export const easeOutExpo = (k) => (k >= 1 ? 1 : 1 - Math.pow(2, -10 * k));
export function spring(k, zeta = 0.8, omega = 8.2) {
  if (k <= 0) return 0;
  if (k >= 1) return 1;
  const wd = omega * Math.sqrt(1 - zeta * zeta);
  const v = 1 - Math.exp(-zeta * omega * k) * (Math.cos(wd * k) + (zeta * omega / wd) * Math.sin(wd * k));
  const e = 1 - Math.exp(-zeta * omega) * (Math.cos(wd) + (zeta * omega / wd) * Math.sin(wd));
  return v / e;
}
// ---------- Cámara: estado en t a partir de las transiciones de CAMERA ----------
// Cada transición aporta (destino - destino anterior) * curva(t) en cada clave que trae, así dos
// transiciones que se enciman se suman sin saltos. El foco del push es pegajoso: el pull-back
// regresa desde el mismo punto que se acercó.
export const CAM_KEYS = ['x', 'y', 'h', 'push', 'view', 'rotY', 'rotX'];
export function cameraAt(CAMERA, t) {
  const first = CAMERA[0];
  const st = {}, last = {};
  for (const k of CAM_KEYS) { st[k] = first[k] ?? 0; last[k] = st[k]; }
  let focus = null, focusMax = 1, focusT = -1;
  for (let i = 1; i < CAMERA.length; i++) {
    const c = CAMERA[i];
    if (t < c.t[0]) {
      for (const k of CAM_KEYS) if (c[k] !== undefined) last[k] = c[k];
      continue;
    }
    const raw = c.t[1] > c.t[0] ? clamp((t - c.t[0]) / (c.t[1] - c.t[0])) : 1;
    const e = c.spring ? spring(raw, 0.72, 7.2) : easeInOut(raw);
    for (const k of CAM_KEYS) if (c[k] !== undefined) { st[k] += (c[k] - last[k]) * e; last[k] = c[k]; }
    if (c.focus) { focus = c.focus; focusMax = c.push; focusT = c.t[0]; }
  }
  // k del foco: 0 con push 1, 1 en el push máximo de esa transición
  const focusK = focus && focusMax > 1 ? clamp((st.push - 1) / (focusMax - 1)) : 0;
  return { ...st, focus, focusK, focusT, focusMax };
}
// scroll con inercia (arrastre, suelta, desacelera) y rebote opcional
export function scrollAt(t, [ta, tb], y0, y1, rubber = 0) {
  const k = prog(t, [ta, tb]);
  if (!rubber) return lerp(y0, y1, spring(k, 0.82, 8.6));
  const base = lerp(y0, y1, easeOutExpo(clamp(k / 0.62)));
  const bump = k < 0.45 ? 0 : rubber * Math.sin(Math.PI * clamp((k - 0.45) / 0.55)) * Math.exp(-2.2 * clamp((k - 0.45) / 0.55));
  return base + bump;
}
