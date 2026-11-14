// Genera colors/video/BRIEF.md (tiempos exactos por fotograma) desde la linea de tiempo y la voz real.
import fs from 'fs';
import * as TL from '../timeline/timeline.mjs';
const vo = JSON.parse(fs.readFileSync(new URL('../timeline/vo_words.json', import.meta.url)));
const cues = JSON.parse(fs.readFileSync(new URL('../timeline/sfx_cues.json', import.meta.url)));
const rep = JSON.parse(fs.readFileSync(new URL('../audio/mix_report.json', import.meta.url)));
const f = (t) => 'f' + String(Math.round(t * 60)).padStart(4, '0');
const tt = (v) => Array.isArray(v) ? `${v.map((x) => x.toFixed(2)).join('–')} s (${v.map(f).join('–')})` : `${v.toFixed(2)} s (${f(v)})`;
let md = `# Colors Boutique · Brief del video por fotograma\n\n60 fps · ${TL.FRAMES} cuadros · ${TL.DUR} s (16 s de pieza + 2.5 s de end card) · ${TL.BPM} BPM (compás = 2.0 s).\nTodo sale de \`video/timeline/timeline.mjs\` y de la toma real de voz; este documento se genera desde ahí.\n\n## Escenas\n\n| Escena | Tiempo | Cuadros |\n|---|---|---|\n`;
for (const s of TL.SCENES) md += `| ${s.name} | ${s.t0.toFixed(2)}–${s.t1.toFixed(2)} s | ${f(s.t0)}–${f(s.t1)} |\n`;
md += `\n## Locución (ElevenLabs, voz Hope, 1 toma)\n\nNinguna frase se aceleró: las escenas se recorrieron para seguir a la voz. La frase 6 venía ${'~11 dB'} más baja en la toma y se niveló (+10 dB).\n\n| Frase | Entra | Palabras (aterrizaje) |\n|---|---|---|\n`;
for (const l of vo) md += `| ${l.text} | ${l.t0.toFixed(2)} s (${f(l.t0)}) | ${l.words.map((w) => `${w.w} ${f(w.t0)}`).join(' · ')} |\n`;
md += `\n## Momentos clave\n\n| Momento | Tiempo |\n|---|---|\n`;
const names = { slash: 'El tallo cruza la pantalla', cut: 'Corte en el primer beat', grow: 'El tallo sube', bloom: 'Abre la flor', toSun: 'Morph SDF flor → girasoles', toCircle: 'Morph → círculo de la marca', toPhone: 'Morph → marco del teléfono', irisPhone: 'Iris: aparece la página real', cardsOff: 'Salen las tarjetas', panelsIn: 'Entran paneles (parallax)', panelsOut: 'Salen paneles', scrollCat: 'Scroll al catálogo', chipsIn: 'Chips de cristal', ribbon: 'Cinta de pétalos', tapChip: 'Toque: filtro Bouquets', eventsIn: 'Muro de eventos', eventsOut: 'Salen eventos', waLift: 'Botón de WhatsApp sale de la barra', underline: 'El tallo subraya', waPulse: 'Pulsos con el kick', pull: 'Pull-back', irisBack: 'Iris de cierre', toLogo: 'El teléfono se cierra al círculo', endHit: 'Golpe grave', endIn: 'Entra el end card' };
for (const [k, n] of Object.entries(names)) md += `| ${n} | ${tt(TL.T[k])} |\n`;
for (const c of TL.CARDS) md += `| Tarjeta ${c.label} se estampa | ${tt(TL.voWord(vo, c.vo).t0)} |\n`;
md += `\n## Tipografía cinética (por glifo, stagger 26 ms)\n\n`;
for (const g of TL.KINETIC) { const o = TL.resolveOut(g.out, vo); md += `- ${g.lines.map((l) => l.map((w) => w.text).join(' ')).join(' / ')} · sale ${tt(o)}\n`; }
md += `\n## Sonido\n\n- ${cues.length} cues de efectos sintetizados en código.\n- Música original en código, ${TL.BPM} BPM.\n- Mezcla: master ${rep.master_LUFS} LUFS / ${rep.master_dBTP} dBTP · voz ${rep.voz_LUFS} LUFS · música ≥ ${rep.palabra_peor.dif} dB por debajo de cada palabra (peor: "${rep.palabra_peor.w}").\n`;
fs.writeFileSync(new URL('../BRIEF.md', import.meta.url), md);
console.log('BRIEF.md');
