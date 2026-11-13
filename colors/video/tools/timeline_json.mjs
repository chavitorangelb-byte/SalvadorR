// Exporta la linea de tiempo (con las horas que dependen de la voz ya resueltas) a JSON para las herramientas de audio.
import fs from 'fs';
import * as TL from '../timeline/timeline.mjs';
const vo = JSON.parse(fs.readFileSync(new URL('../timeline/vo_words.json', import.meta.url)));
const words = TL.KINETIC.flatMap((g) => { const out = TL.resolveOut(g.out, vo); return g.lines.flat().map((w) => ({ group: g.id, text: w.text, t: TL.voWord(vo, w.vo).t0, out: out[0] })); });
const groups = TL.KINETIC.map((g) => ({ id: g.id, out: TL.resolveOut(g.out, vo) }));
const cards = TL.CARDS.map((c) => ({ id: c.id, land: TL.voWord(vo, c.vo).t0 }));
fs.writeFileSync(new URL('../timeline/timeline.json', import.meta.url), JSON.stringify({ FPS: TL.FPS, DUR: TL.DUR, BPM: TL.BPM, T: TL.T, SCENES: TL.SCENES, words, groups, cards, vo }, null, 1));
console.log('timeline.json', words.length, 'palabras cineticas');
