// Render: abre el compositor en Chromium (WebGL por software), pide cada cuadro y manda los PNG
// a ffmpeg. Determinista: el mismo cuadro siempre sale igual.
//
// node matica/video/render.mjs --scale 0.5 --subs 8 --fps 30 --out matica/review/fase4/prueba_estilo.mp4
// node matica/video/render.mjs --scale 0.5 --frames 20,60,100 --png <carpeta>      (cuadros sueltos)
import { createRequire } from 'module';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');   // matica/
const A = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const SUBS = Number(A('subs', 8)), SCALE = Number(A('scale', 0.5)), FPS = Number(A('fps', 30));
const OUT = A('out', null), PNG = A('png', null), FRAMES = A('frames', null);
const PORT = 8300 + Math.floor(Math.random() * 400);
const MIME = { '.html': 'text/html', '.mjs': 'text/javascript', '.js': 'text/javascript', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  fs.createReadStream(p).pipe(res);
}).listen(PORT, '127.0.0.1');

const RW = Math.round(1080 * SCALE), RH = Math.round(1920 * SCALE);
const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: RW, height: RH }, deviceScaleFactor: 1 });
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.text()); });
await page.goto(`http://127.0.0.1:${PORT}/video/compositor/index.html?subs=${SUBS}&scale=${SCALE}&fps=${FPS}`);
try { await page.waitForFunction(() => window.ready === true, null, { timeout: 180000 }); }
catch (e) { console.error('el compositor no arrancó', errs); process.exit(1); }
const info = await page.evaluate(() => window.compositorInfo);
let ff = null;
if (OUT) {
  fs.mkdirSync(path.dirname(path.resolve(OUT)), { recursive: true });
  ff = spawn('ffmpeg', ['-y', '-v', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-',
    '-vf', 'scale=out_color_matrix=bt709:out_range=tv', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', path.resolve(OUT)], { stdio: ['pipe', 'inherit', 'inherit'] });
}
if (PNG) fs.mkdirSync(PNG, { recursive: true });
const list = FRAMES ? FRAMES.split(',').map(Number) : Array.from({ length: info.frames }, (_, i) => i);
const t0 = Date.now();
for (let n = 0; n < list.length; n++) {
  const f = list[n];
  await page.evaluate((fr) => window.renderFrame(fr), f);
  const buf = await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: RW, height: RH } });
  if (PNG) fs.writeFileSync(path.join(PNG, `f${String(f).padStart(4, '0')}.png`), buf);
  if (ff && !ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
  if (n % 20 === 0 || n === list.length - 1) {
    const el = (Date.now() - t0) / 1000;
    console.log(`cuadro ${f} · ${n + 1}/${list.length} · ${(el / (n + 1)).toFixed(2)} s/cuadro`);
  }
}
if (ff) { ff.stdin.end(); await new Promise((r) => ff.on('close', r)); }
if (errs.length) console.log('avisos del compositor:', [...new Set(errs)].slice(0, 10));
await browser.close();
server.close();
