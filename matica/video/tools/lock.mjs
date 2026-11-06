// Amarra la línea de tiempo a la voz colocada y la valida.
// node matica/video/tools/lock.mjs  ->  matica/video/timeline/timeline.json (+ sfx_cues.json)
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { lock, FPS, DUR } from '../timeline/timeline.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');   // matica/video
const vo = JSON.parse(fs.readFileSync(path.join(ROOT, 'timeline/vo_words.json'), 'utf8'));
const TL = lock(vo);
const T = TL.T;
const f = (t) => Math.round(t * FPS);
const errs = [], warns = [];
const need = (cond, msg) => { if (!cond) errs.push(msg); };

// 1) tiempos dentro del video y tramos bien formados
for (const [k, v] of Object.entries(T)) {
  const xs = Array.isArray(v) ? v : [v];
  xs.forEach((x) => need(Number.isFinite(x) && x >= 0 && x <= DUR, `${k} fuera del video: ${xs}`));
  if (Array.isArray(v)) need(v[1] > v[0], `${k} tramo vacío o al revés: ${v}`);
}
// 2) escenas contiguas
TL.SCENES.forEach((s, i) => {
  need(s.t1 > s.t0 + 0.3, `escena ${s.id} demasiado corta (${(s.t1 - s.t0).toFixed(2)} s)`);
  if (i) need(Math.abs(TL.SCENES[i - 1].t1 - s.t0) < 1e-6, `hueco entre ${TL.SCENES[i - 1].id} y ${s.id}`);
});
// 3) orden de la historia (lo que se ve antes de tocarlo)
const order = [
  ['type[1]', T.type[1], 'enter', T.enter],
  ['pageIntro[1]', T.pageIntro[1], 'tapMenu', T.tapMenu - 0.15],
  ['scrollMenu[1]', T.scrollMenu[1], 'tapFrio', T.tapFrio - 0.30],
  ['countFrio[1]', T.countFrio[1], 'tapEspeciales', T.tapEspeciales],
  ['cardBack[1]', T.cardBack[1], 'tapWaffles', T.tapWaffles - 0.05],
  ['pushJamon[1]', T.pushJamon[1], 'pullJamon[0]', T.pullJamon[0]],
  ['sheetUp[1]', T.sheetUp[1], 'lift', T.lift],
  ['countCart[1]', T.countCart[1], 'tapCartbar', T.tapCartbar],
  ['cartSheetDown[1]', T.cartSheetDown[1], 'scrollVive[0]', T.scrollVive[0] + 0.05],
  ['scrollVive[1]', T.scrollVive[1], 'scrollReviews[0]', T.scrollReviews[0]],
  ['fanBack[1]', T.fanBack[1], 'scrollVisit[0]', T.scrollVisit[0] + 0.15],
  ['pushHours[1]', T.pushHours[1], 'phoneAway[0]', T.phoneAway[0]],
  ['phoneAway[1]', T.phoneAway[1], 'hit24', T.hit24],
];
order.forEach(([a, ta, b, tb]) => need(ta <= tb + 1e-6, `orden: ${a} (${ta.toFixed(2)}) debe ir antes de ${b} (${tb.toFixed(2)})`));
// 4) acciones de la página dentro de la pantalla encendida y en orden
let last = -1;
TL.PAGE_ACTIONS.forEach((a) => {
  const t0 = Array.isArray(a.t) ? a.t[0] : a.t;
  need(t0 >= TL.SCREEN[0] - 1e-6 && t0 <= TL.SCREEN[1], `acción ${a.type} ${a.sel || a.to || ''} fuera de pantalla (${t0})`);
  need(t0 >= last - 1e-6, `acción fuera de orden: ${a.type} ${a.sel || a.to || ''} @${t0}`);
  last = t0;
});
// 5) tipografía cinética: máx. 4 palabras en pantalla, sin encimarse, se alcanza a leer
const K = TL.KINETIC;
for (let t = 0; t < DUR; t += 1 / FPS) {
  const words = K.filter((g) => t >= g.in && t < g.out[1]).reduce((n, g) => n + g.lines.flat().length, 0);
  if (words > 4) { errs.push(`más de 4 palabras en pantalla en ${t.toFixed(2)} s`); break; }
}
K.forEach((g, i) => {
  const lastLand = Math.max(...g.lines.flat().map((w) => w.land));
  need(g.out[0] - lastLand >= 0.30, `${g.id}: la última palabra dura ${(g.out[0] - lastLand).toFixed(2)} s antes de salir`);
  if (i) need(K[i - 1].out[1] <= g.in + 1e-6, `${K[i - 1].id} y ${g.id} se enciman`);
});
// 6) voz: nada en el respiro ni encima del golpe de end card
vo.clips.forEach((c) => {
  need(!(c.t0 < T.breath + 0.4 && c.t1 > T.breath - 0.2), `la voz ${c.id} pisa el respiro de 23.00`);
  need(c.t1 <= DUR - 0.2, `la voz ${c.id} termina muy pegada al final`);
});
// 7) sonido
need(TL.SFX.length >= 70, `solo ${TL.SFX.length} cues de sonido (mínimo 70)`);
// avisos (no detienen)
if (T.tapMenu - T.pageIntro[1] < 0.45) warns.push(`la portada se ve completa solo ${(T.tapMenu - T.pageIntro[1]).toFixed(2)} s antes del tap a "Ver menú"`);

if (errs.length) { console.error('ERRORES:\n  ' + errs.join('\n  ')); process.exit(1); }
const out = { ...TL, frames: Object.fromEntries(Object.entries(T).map(([k, v]) => [k, Array.isArray(v) ? v.map(f) : f(v)])) };
fs.writeFileSync(path.join(ROOT, 'timeline/timeline.json'), JSON.stringify(out, null, 1));
fs.writeFileSync(path.join(ROOT, 'timeline/sfx_cues.json'), JSON.stringify(TL.SFX, null, 1));
console.log(`toma: ${vo.take}`);
TL.SCENES.forEach((s) => console.log(`  ${s.id.padEnd(8)} ${s.t0.toFixed(2).padStart(6)}–${s.t1.toFixed(2).padStart(5)} s  f${String(f(s.t0)).padStart(4, '0')}–f${String(f(s.t1)).padStart(4, '0')}  ${s.name}`));
console.log(`  enter ${T.enter} · tapMenu ${T.tapMenu} · tapFrio ${T.tapFrio} · tapWaffles ${T.tapWaffles} · Agregar ${T.tapAdd} · ${TL.SFX.length} cues de sonido`);
warns.forEach((w) => console.log('  aviso:', w));
console.log('OK -> video/timeline/timeline.json');
