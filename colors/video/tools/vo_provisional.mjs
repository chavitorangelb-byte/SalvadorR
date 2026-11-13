// Tiempos provisionales de la locucion (antes de tener la toma real): reparte cada frase por silabas
// a ritmo natural desde su inicio preferido. vo_assemble.py los reemplaza con la toma real.
import fs from 'fs';
import { SCRIPT } from '../timeline/timeline.mjs';
const syl = (w) => Math.max(1, (w.toLowerCase().match(/[aeiouáéíóúü]+/g) || []).length);
const out = SCRIPT.map((l) => {
  const ws = l.text.split(/\s+/); let t = l.at;
  const words = ws.map((w) => { const d = 0.075 + syl(w) * 0.135 + (/[.,]$/.test(w) ? 0.16 : 0); const o = { w, t0: +t.toFixed(3), t1: +(t + d - (/[.,]$/.test(w) ? 0.16 : 0)).toFixed(3) }; t += d; return o; });
  return { id: l.id, text: l.text, t0: l.at, t1: words[words.length - 1].t1, provisional: true, words };
});
fs.writeFileSync(new URL('../timeline/vo_words.json', import.meta.url), JSON.stringify(out, null, 1));
console.log(out.map((l) => `${l.id} ${l.t0.toFixed(2)}-${l.t1.toFixed(2)}`).join('  '));
