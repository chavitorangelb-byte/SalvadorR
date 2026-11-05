// Genera el brief con tiempos exactos por fotograma a partir de la linea de tiempo real.
// node video/tools/brief.mjs  ->  video/BRIEF.md
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as TL from '../timeline/timeline.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const vo = JSON.parse(fs.readFileSync(path.join(ROOT, 'video/timeline/vo_words.json'), 'utf8'));
const sfx = JSON.parse(fs.readFileSync(path.join(ROOT, 'video/timeline/sfx_cues.json'), 'utf8'));
const mix = JSON.parse(fs.readFileSync(path.join(ROOT, 'video/audio/mix_report.json'), 'utf8'));
const f = (t) => `f${String(Math.round(t * TL.FPS)).padStart(4, '0')}`;
const r = (a) => (Array.isArray(a) ? `${a[0].toFixed(2)}–${a[1].toFixed(2)} s (${f(a[0])}–${f(a[1])})` : `${a.toFixed(2)} s (${f(a)})`);
const T = TL.T;

const out = [];
out.push('# Siniestro Tattoo Studio · Brief del video por fotograma', '');
out.push(`60 fps · ${TL.FRAMES} cuadros · 27.0 s (24 s de pieza + 3 s de end card) · 96 BPM (compás = 2.5 s).`);
out.push('Todo sale de `video/timeline/timeline.mjs`; este documento se genera desde ahí.', '');
out.push('## Escenas', '', '| Escena | Tiempo | Cuadros |', '|---|---|---|');
for (const s of TL.SCENES) out.push(`| ${s.name} | ${s.t0.toFixed(2)}–${s.t1.toFixed(2)} s | ${f(s.t0)}–${f(s.t1)} |`);
out.push('', '## Locución (ElevenLabs vía vidIQ, voz Eric, 1 toma)', '');
out.push('La línea de tiempo se ajustó a la toma real: el ritmo natural no cabía en los tiempos originales (la línea 2 dura ~4 s y la última terminaba en 27.8 s). Con la voz de Eric ninguna frase necesitó aceleración; la última se adelantó 0.3 s.', '');
out.push('| Frase | Entra | Palabras (aterrizaje) |', '|---|---|---|');
for (const l of vo) out.push(`| ${l.text} | ${r(l.t0)} | ${l.words.map((w) => `${w.w} ${f(w.t0)}`).join(' · ')} |`);
out.push('', '## Momentos clave', '', '| Momento | Tiempo |', '|---|---|');
const names = {
  hit0: 'Golpe en f0', type: 'Tinta escribe la búsqueda (tecleo sincronizado)', enter: 'Enter', inkOutline: 'Tinta dibuja el contorno del celular',
  phoneSettle: 'Celular gira 12° y se asienta', screenOn: 'Carga la portada real', pushTitle: 'Push-in a "23 años"', inkUnderline: 'Tinta subraya "23 años"',
  scrollGallery: 'Scroll con inercia a la galería', cardsOut: 'León, Cristo y Quetzalcóatl salen en 3D', cardsBack: 'Regresan a su lugar',
  tapRealismo: 'Tap "Realismo"', tapColor: 'Tap "Color"', inkCircleCta: 'Tinta rodea "Cotiza con tu idea"', tapCta: 'Tap "Cotiza con tu idea"',
  typeIdea: 'Se escribe la idea (teclado)', tapStyle: 'Estilo', tapZone: 'Zona', tapSize: 'Tamaño', photoProgress: 'Sube la foto de referencia',
  tapSubmit: 'Enviar por WhatsApp', waLift: 'Botón de WhatsApp se levanta en 3D', scrollTop: 'Scroll a la portada (rebote)', tapEN: 'Tap EN',
  morphEN: 'Morph SDF letra por letra ES→EN', orbit: 'Cámara gira alrededor del celular', morphES: 'Regresa a ES', scrollCare: 'Cuidados',
  pushCare: 'Push-in a los 3 pasos', scrollVisit: 'Visítanos', inkCirclePin: 'Tinta rodea el pin', pullBack: 'Pull-back', write1: 'Tinta escribe "23 AÑOS DE OFICIO."',
  write2: 'Tinta escribe "AHORA, SU PÁGINA."', breath: 'Respiro musical', hit24: 'Golpe grave', plateIn: 'Entra el logo oficial', sweep: 'Barrido de luz plata',
  signature: 'La tinta firma', tagline: '"Así se vería tu página · Elevate Negocios"', disclaimer: '"Demo de cortesía de Elevate Negocios · pieza no oficial"',
};
for (const [k, n] of Object.entries(names)) out.push(`| ${n} | ${r(T[k])} |`);
out.push('', '## Tipografía cinética (fuera de la pantalla del celular, por glifo, stagger 26 ms)', '');
for (const g of TL.KINETIC) out.push(`- ${g.lines.map((l) => l.map((w) => w.text).join(' ')).join(' / ')} · sale ${r(TL.resolveOut(g.out, vo))}`);
out.push('', '## Sonido', '');
out.push(`- ${sfx.length} cues de efectos sintetizados (tecleo, taps, scroll con fricción, filtros, subida de archivo, pop, tinta como aguja, etc.).`);
out.push(`- Mezcla: master ${mix.master_LUFS} LUFS / ${mix.master_dBTP} dBTP · voz ${mix.voz_LUFS} LUFS · música ≥ ${mix.palabra_peor.dif} dB por debajo de cada palabra (peor: "${mix.palabra_peor.w}").`);
fs.writeFileSync(path.join(ROOT, 'video/BRIEF.md'), out.join('\n') + '\n');
console.log('BRIEF.md', out.length, 'lineas');
