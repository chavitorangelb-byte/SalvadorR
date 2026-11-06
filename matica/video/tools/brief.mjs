// Genera el brief con tiempos exactos por fotograma a partir de la línea de tiempo amarrada.
// node matica/video/tools/brief.mjs  ->  matica/video/BRIEF.md
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');   // matica/video
const TL = JSON.parse(fs.readFileSync(path.join(ROOT, 'timeline/timeline.json'), 'utf8'));
const { T, FPS } = TL;
const fr = (t) => `f${String(Math.round(t * FPS)).padStart(4, '0')}`;
const tt = (t) => `${(+t).toFixed(2)} s`;
const rng = (v) => (Array.isArray(v) ? `${fr(v[0])}–${fr(v[1])}` : fr(v));
const rngT = (v) => (Array.isArray(v) ? `${(+v[0]).toFixed(2)}–${(+v[1]).toFixed(2)} s` : tt(v));
const start = (v) => (Array.isArray(v) ? v[0] : v);

const NAMES = {
  hit0: 'Golpe en f0 (pizarra oscura)', dropFall: 'Una gota de cold brew cae', barIn: 'Salpica y abre la barra de búsqueda de cristal (genérica, sin logo)',
  caret: 'La gota late como cursor ("Alguien busca…")', type: `La gota escribe "${TL.QUERY}" (cada palabra mientras se dice)`, enter: 'Enter (compás 2, tiempo 2)',
  barOut: 'La barra se recoge en la gota', dropOutline: 'La gota se estira y dibuja el contorno del celular', phoneIn: 'Aparece el cristal 3D (bisel, grosor, reflejo)',
  phoneSettle: 'El celular gira 12° y se asienta', screenOn: 'Enciende la pantalla', pageIntro: 'Carga la portada real: fachada, logo, "Café de especialidad", chips',
  heroPush: 'Push-in suave: se leen "Pet friendly" y "Working friendly"', dropCircleMenu: 'La gota rodea "Ver menú"', tapMenu: 'Tap en "Ver menú" (inicio del compás 3)',
  scrollMenu: 'Scroll con inercia al menú (pestaña Café)', dropHopLatte: 'La gota rebota a la tarjeta del Latte y deja un brillo', pushLatte: 'Push-in: "Latte $60" al tamaño de un celular real',
  dropCircleFrio: 'La gota rodea "Frío"', tapFrio: 'Tap en "Frío" (cae sobre "precios")', countFrio: 'El selector desliza y el precio cuenta $60 → $65',
  pullLatte: 'Pull-back', dropHopEspeciales: 'La gota rebota a "Los especiales"', tapEspeciales: 'Tap en "Los especiales"', panelEspeciales: 'Cambia el panel',
  cardOut: 'La tarjeta "Cold brew tonic de sabor $85" (con su foto) sale al espacio 3D', cardFloat: 'Flota en profundidad (sombra, parallax)', cardBack: 'Regresa a su lugar y cae al pedido',
  cartIn: 'Sube la barra del pedido: 1 · $85', dropHopWaffles: 'La gota rebota a "Waffles de yuca"', tapWaffles: 'Tap en "Waffles de yuca" (inicio del compás 5)', panelWaffles: 'Cambia el panel',
  pushJamon: 'Push-in a "Jamón serrano y matícas $95" con su foto e ícono sin gluten', dropUnderlineJamon: 'La gota subraya el nombre', pullJamon: 'Pull-back', tapJamon: 'Tap en la tarjeta: se abre la ficha',
  sheetUp: 'La ficha sube', dropCircleAdd: 'La gota rodea "Agregar"', lift: 'Lift musical (inicio del compás 6)', pressAdd: 'Estado presionado real de "Agregar"', tapAdd: 'Suelta: se agrega al pedido',
  addLift3D: '"Agregar" se levanta en 3D con pop', sheetDown: 'La ficha baja', countCart: 'El total cuenta $85 → $180, contador 1 → 2', tapCartbar: 'Tap en la barra del pedido',
  cartSheetUp: 'Sube el pedido: $95 + $85 = $180 y las dos salidas', pushExits: 'Push-in: total y "Pedir para recoger" / "A domicilio por Rappi"', dropGlintPickup: 'Brillo de la gota sobre "Pedir para recoger"',
  pullExits: 'Pull-back', cartSheetDown: 'El pedido baja', scrollVive: 'Scroll con inercia a "Así se vive Matíca"', iconDog: 'Ícono de línea: perrito (trazo blanco)',
  iconLaptop: 'Ícono de línea: laptop', scrollReviews: 'Scroll a las reseñas', swipe13: 'Swipe por las reseñas 1, 2 y 3', fanOut: 'Tres tarjetas de cristal salen en abanico 3D, legibles',
  pushReview2: 'Push-in a "Los waffles son deliciosos y de sabores únicos"', fanBack: 'Regresan', scrollVisit: 'Scroll a "Visítanos" (compás 9)', pinDrop: 'Cae el pin en Av. Las Américas 607-1',
  pushHours: 'Push-in al horario: "Lunes a viernes 8:00 – 20:00 · Sábado 9:00 – 14:00"', dropCircleHours: 'La gota rodea el horario', holdHours: 'Se sostiene legible',
  phoneAway: 'El celular se aleja a un lado', breath: 'Respiro musical', dropFallCenter: 'La gota cae hacia el centro', hit24: 'Golpe grave', logoIn: 'Entra el logo de Matíca (leve giro 3D, sombra suave)',
  dropOnCup: 'La gota cae sobre la taza del logo (el logo solo se mueve y escala)', sparkle: 'Se deshace en un destello mínimo', tagline: '"Así se vería tu página · Elevate Negocios"',
  disclaimer: '"Demo de cortesía de Elevate Negocios · pieza no oficial"', end: 'Fin',
};

const o = [];
const P = (...l) => o.push(...l);
P('# Matíca · Brief del video por fotograma', '');
P(`60 fps · ${TL.FRAMES} cuadros · 27.0 s (24 s de pieza + 3 s de end card) · ${TL.BPM} BPM: compás = 2.609 s (156.5 cuadros), tiempo = 0.652 s.`);
P(`Voz amarrada: **${TL.VO.length ? 'toma ' + JSON.parse(fs.readFileSync(path.join(ROOT, 'timeline/vo_words.json'), 'utf8')).take : '—'}**. Para cambiarla por la toma final de ElevenLabs: \`matica/video/tools/relock.sh <toma>\` (alinea, coloca, re-amarra y regenera este brief).`);
P('Todo sale de `video/timeline/timeline.mjs` (reglas) amarrado a `video/timeline/vo_words.json` (voz real); este documento se genera solo.', '');

P('## Escenas', '', '| Escena | Tiempo | Cuadros | Brief original |', '|---|---|---|---|');
const orig = { hook: '0.00–2.61', llegada: '2.61–5.22', menu: '5.22–10.44', waffles: '10.44–13.05', pide: '13.05–17.00', vive: '17.00–21.00', visita: '21.00–22.80', cierre: '22.80–24.00', endcard: '24.00–27.00' };
TL.SCENES.forEach((s) => P(`| ${s.name} | ${s.t0.toFixed(2)}–${s.t1.toFixed(2)} s | ${fr(s.t0)}–${fr(s.t1)} | ${orig[s.id]} |`));
const L1 = TL.VO.find((c) => c.id === 'L1');
P('', `Diferencia con el beat sheet: el gancho dura hasta el **Enter en ${T.enter.toFixed(2)} s** (compás ${Math.floor(Math.round(T.enter / (60 / TL.BPM)) / 4) + 1}, tiempo ${(Math.round(T.enter / (60 / TL.BPM)) % 4) + 1}) porque el tecleo va sincronizado con la voz y "Aguascalientes" termina en ${L1.t1.toFixed(2)} s. Lo demás cae donde lo pediste.`, '');

P('## Locución', '', '| Frase | Entra–sale | Palabras (cuadro donde empieza cada una) |', '|---|---|---|');
TL.VO.forEach((c) => P(`| ${c.text}${c.tempo !== 1 ? ` (×${c.tempo})` : ''} | ${c.t0.toFixed(2)}–${c.t1.toFixed(2)} s · ${fr(c.t0)}–${fr(c.t1)} | ${c.words.map((w) => `${w.w} ${fr(w.t0)}`).join(' · ')} |`));
const fast = TL.VO.filter((c) => c.tempo !== 1);
const L7a = TL.VO.find((c) => c.id === 'L7a'), L7b = TL.VO.find((c) => c.id === 'L7b');
P('', `${fast.length ? 'Se aceleraron: ' + fast.map((c) => `${c.id} ×${c.tempo}`).join(', ') + ' (sin cambio de tono).' : 'Ninguna frase se aceleró.'} "Matíca." entra en ${L7a.t0.toFixed(2)} s, después del golpe de 24.00; "Así se vería con Elévate." termina en ${L7b.t1.toFixed(2)} s.`, '');

P('## Escena por escena', '');
TL.SCENES.forEach((s) => {
  const keys = Object.keys(NAMES).filter((k) => T[k] !== undefined && start(T[k]) >= s.t0 - 1e-6 && start(T[k]) < s.t1 - 1e-6);
  P(`### ${s.name} · ${fr(s.t0)}–${fr(s.t1)}`, '', '| Cuadros | Tiempo | Qué pasa |', '|---|---|---|');
  keys.sort((a, b) => start(T[a]) - start(T[b])).forEach((k) => P(`| ${rng(T[k])} | ${rngT(T[k])} | ${NAMES[k]} |`));
  const kin = TL.KINETIC.filter((g) => g.scene === s.id);
  kin.forEach((g) => P(`| ${fr(g.in)}–${fr(g.out[1])} | ${g.in.toFixed(2)}–${g.out[1].toFixed(2)} s | Tipografía cinética (${g.side === 'left' ? 'izquierda' : 'derecha'}): **${g.lines.map((l) => l.map((w) => w.text).join(' ')).join(' / ')}** |`));
  P('');
});

P('## Tipografía cinética', '', 'Por glifo, stagger 26 ms, Poppins Bold en mayúsculas con tracking amplio, ≥ 42 px, siempre FUERA de la pantalla del celular y nunca más de 4 palabras a la vez (lo valida `lock.mjs`). Cada palabra aterriza en el inicio de su palabra de la locución.', '');
P('| Grupo | Lado | Palabra → aterriza en | Sale |', '|---|---|---|---|');
TL.KINETIC.forEach((g) => P(`| ${g.lines.map((l) => l.map((w) => w.text).join(' ')).join(' / ')} | ${g.side === 'left' ? 'izq.' : 'der.'} | ${g.lines.flat().map((w) => `${w.text} → "${w.spoken}" ${fr(w.land)}`).join(' · ')} | ${fr(g.out[0])}–${fr(g.out[1])} |`));
P('', 'Ajuste de copy: "TU MENÚ / COMPLETO, / EN SU CELULAR" y "TRAE A TU PERRO. / TRAE TU LAPTOP." tienen 6 y 7 palabras; para respetar el máximo de 4 en pantalla se parten en dos grupos que se relevan, cada uno sobre sus palabras.', '');

P('## La gota (2D, ámbar cold brew #8A4B1C, refracción y menisco)', '', '| Cuadros | Qué hace |', '|---|---|');
TL.DROP.forEach((d) => P(`| ${rng(d.t)} | ${d.act} |`));
P('');

P('## Cámara y celular (9:16)', '', '`x` = centro del celular en el ancho del cuadro · `altura` = alto del celular / alto del cuadro (60–75 % en interfaz) · `push` = zoom a la pantalla (≈ 2.2 = texto al tamaño de un celular real).', '');
P('| Cuadro | x | altura | push | giro Y | Nota |', '|---|---|---|---|---|---|');
TL.CAMERA.forEach((c) => P(`| ${fr(c.t)} | ${c.x.toFixed(2)} | ${Math.round(c.h * 100)} % | ${c.push.toFixed(2)} | ${c.rotY != null ? c.rotY + '°' : '—'} | ${c.note || ''} |`));
P('', 'Zonas seguras 9:16: nada importante en los 250 px superiores ni en los 340 px inferiores. Cuando el celular va a la derecha, el texto va a la izquierda y al revés.', '');

P('## Acciones de la página (captura real a 60 fps y 3×, reloj virtual)', '', '| Cuadros | Acción en la página |', '|---|---|');
const act = (a) => ({ intro: 'Animación de carga de la portada', tap: `Tap con onda en \`${a.sel}\``, scroll: `Scroll con inercia → ${a.to}`, hide: `${a.on ? 'Oculta' : 'Muestra'} \`${a.sel}\` (la pieza vive en 3D)`,
  add: `Se agrega al pedido: ${a.spec?.id} (${a.spec?.opt})`, press: `Presionado real \`${a.sel}\``, closeSheet: 'Cierra la hoja', review: `Reseñas: va a la ${a.i + 1}`, dropPin: 'Cae el pin del mapa' }[a.type]);
TL.PAGE_ACTIONS.forEach((a) => P(`| ${rng(a.t)} | ${act(a)} |`));
P('');

P('## Música (original en código)', '', `${TL.BPM} BPM, lo-fi cálido: ${TL.MUSIC.base}. Una capa nueva por sección:`, '');
TL.MUSIC.layers.forEach((l) => P(`- ${fr(l.t)} (${tt(l.t)}): + ${l.add}${l.note ? ` · **${l.note}**` : ''}`));
P(`- ${fr(TL.MUSIC.breath)} (${tt(TL.MUSIC.breath)}): respiro`, `- ${fr(TL.MUSIC.hit)} (${tt(TL.MUSIC.hit)}): golpe grave`, `- Mezcla: voz ≈ −16 LUFS, música ${TL.MUSIC.duckUnderVo}, master −14 LUFS / −1.25 dBTP.`, '');

const byType = {};
TL.SFX.forEach((c) => { (byType[c.type] = byType[c.type] || []).push(c); });
P(`## Sonido (${TL.SFX.length} cues, uno por cada movimiento visible)`, '', '| Tipo | Cues | Cuadros |', '|---|---|---|');
Object.entries(byType).sort((a, b) => a[1][0].t - b[1][0].t).forEach(([k, v]) => P(`| ${k} | ${v.length} | ${v.slice(0, 8).map((c) => fr(c.t)).join(' ')}${v.length > 8 ? ' …' : ''} |`));
P('', 'Lista completa con tiempos: `video/timeline/sfx_cues.json`.', '');

P('## Reglas que se validan solas (`video/tools/lock.mjs`)', '',
  '- Escenas contiguas, todo dentro de 0–27 s y en el orden de la historia (nada se toca antes de verse).',
  '- Las acciones de la página ocurren con la pantalla encendida.',
  '- Tipografía cinética: máximo 4 palabras en pantalla, grupos sin encimarse, la última palabra se lee ≥ 0.3 s.',
  '- La voz no pisa el respiro de 23.00 ni el final.',
  '- Al menos 70 cues de sonido.');
fs.writeFileSync(path.join(ROOT, 'BRIEF.md'), o.join('\n') + '\n');
console.log('BRIEF.md', o.length, 'líneas');
