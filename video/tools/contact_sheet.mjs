// Hoja de contactos de 12 cuadros clave del master final.
// node video/tools/contact_sheet.mjs <master.mov> <formato 9x16|1x1> <salida.jpg>
import { createRequire } from 'module';
import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const [SRC, FMT, OUT] = process.argv.slice(2);
const KEYS = [
  [0.95, 'Gancho: la tinta escribe la búsqueda'], [2.75, 'La tinta dibuja el celular'], [5.00, 'Subraya "23 años"'],
  [6.95, 'Las tarjetas salen en 3D'], [9.05, 'Filtro "Color" y la tinta rodea Cotiza'], [10.60, 'Cotiza: se escribe la idea'],
  [12.35, 'Foto de referencia subiendo'], [13.10, 'WhatsApp se levanta en 3D'], [14.60, 'Morph a inglés'],
  [18.30, 'Cuidados (push-in)'], [21.30, 'La tinta escribe el cierre'], [25.90, 'End card'],
];
const tmp = path.join(ROOT, 'video/build/sheet_' + FMT);
fs.mkdirSync(tmp, { recursive: true });
KEYS.forEach(([t], i) => execFileSync('ffmpeg', ['-v', 'error', '-y', '-ss', String(t), '-i', SRC, '-frames:v', '1', '-q:v', '2', path.join(tmp, `k${i}.jpg`)]));
const vertical = FMT === '9x16';
const cw = vertical ? 300 : 360, ch = vertical ? 533 : 360;
const cells = KEYS.map(([t, label], i) => `<figure><img src="k${i}.jpg" style="width:${cw}px;height:${ch}px"><figcaption><b>${String(i + 1).padStart(2, '0')}</b>${label}<span>${t.toFixed(2)} s · f${String(Math.round(t * 60)).padStart(4, '0')}</span></figcaption></figure>`).join('');
const html = `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:BSD;src:url(${ROOT}/site/fonts/big-shoulders-display-latin-900-normal.woff2)}
@font-face{font-family:Barlow;src:url(${ROOT}/site/fonts/barlow-latin-500-normal.woff2);font-weight:500}
body{margin:0;background:#0E0E0E;color:#EDEAE6;font-family:Barlow;padding:48px 52px 56px;width:${6 * cw + 5 * 28 + 104}px;box-sizing:border-box}
h1{font:900 56px/1 BSD;text-transform:uppercase;margin:0}p{margin:10px 0 34px;color:#C9C9C9;font-size:19px}
.g{display:grid;grid-template-columns:repeat(6,${cw}px);gap:34px 28px}figure{margin:0}
img{display:block;object-fit:cover;outline:1px solid rgba(201,201,201,.2)}
figcaption{margin-top:12px;font-size:16px;color:#C9C9C9;display:flex;flex-direction:column;gap:3px}
figcaption b{color:#A3201B;font:900 19px/1 BSD;margin-bottom:2px}figcaption span{color:#6E6E6E;font-size:14px}
</style></head><body><h1>Siniestro Tattoo · video ${FMT.replace('x', ':')}</h1>
<p>12 cuadros clave del master final (60 fps, 8 subcuadros por cuadro). La interfaz es la página real capturada.</p>
<div class="g">${cells}</div></body></html>`;
fs.writeFileSync(path.join(tmp, 'sheet.html'), html);
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 6 * cw + 5 * 28 + 104, height: 800 }, deviceScaleFactor: 1.5 });
await p.goto('file://' + path.join(tmp, 'sheet.html'));
await p.evaluate(() => document.fonts.ready);
await p.screenshot({ path: OUT, fullPage: true, type: 'jpeg', quality: 86 });
await b.close();
console.log('hoja', OUT);
