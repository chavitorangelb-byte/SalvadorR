// Render del video de Babkery: abre el compositor en Chromium (WebGL por software), pide cada cuadro
// y manda los PNG a ffmpeg. Determinista: el mismo cuadro siempre sale igual.
//
// node video/render.mjs --format 916 --from 0 --to 1619 --subs 8 --scale 1 --out video/build/render/master_916.mov
// node video/render.mjs --format 916 --frames 120,300,420 --png video/build/stills   (cuadros sueltos)
import { createRequire } from 'module';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const A = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const FORMAT = A('format', '916');
const SUBS = Number(A('subs', 8));
const SCALE = Number(A('scale', 1));
const FROM = Number(A('from', 0)), TO = Number(A('to', 1109));
const OUT = A('out', null), PNG = A('png', null);
const FRAMES = A('frames', null);
const FPS = Number(A('fps', 60));

const PORT = 8125 + Math.floor(Math.random() * 400);

const MIME = { '.html': 'text/html', '.mjs': 'text/javascript', '.js': 'text/javascript', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  fs.createReadStream(p).pipe(res);
}).listen(PORT, '127.0.0.1');

const W = FORMAT === '11' ? 1080 : 1080, H = FORMAT === '11' ? 1080 : 1920;
const RW = Math.round(W * SCALE), RH = Math.round(H * SCALE);

(async () => {
  const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: RW, height: RH }, deviceScaleFactor: 1 });
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.text()); });
  const url = `http://127.0.0.1:${PORT}/video/compositor/index.html?format=${FORMAT}&subs=${SUBS}&scale=${SCALE}&fps=${FPS}`;
  await page.goto(url);
  try { await page.waitForFunction(() => window.ready === true, null, { timeout: 180000 }); }
  catch (e) { console.error('el compositor no arranco', errs); process.exit(1); }

  let ff = null;
  if (OUT) {
    fs.mkdirSync(path.dirname(path.resolve(OUT)), { recursive: true });
    const enc = OUT.endsWith('.mov')
      ? ['-c:v', 'prores_ks', '-profile:v', '3', '-pix_fmt', 'yuv422p10le', '-vendor', 'apl0']
      : ['-c:v', 'libx264', '-preset', 'medium', '-crf', '16', '-pix_fmt', 'yuv420p'];
    ff = spawn('ffmpeg', ['-y', '-v', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-',
      '-vf', 'scale=out_color_matrix=bt709:out_range=tv', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709',
      ...enc, path.resolve(OUT)], { stdio: ['pipe', 'inherit', 'inherit'] });
  }
  if (PNG) fs.mkdirSync(PNG, { recursive: true });
  const list = FRAMES ? FRAMES.split(',').map(Number) : Array.from({ length: TO - FROM + 1 }, (_, i) => FROM + i);
  const t0 = Date.now();
  for (let n = 0; n < list.length; n++) {
    const f = list[n];
    await page.evaluate((fr) => window.renderFrame(fr), f);
    const buf = await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: RW, height: RH } });
    if (PNG) fs.writeFileSync(path.join(PNG, `${FORMAT}_f${String(f).padStart(4, '0')}.png`), buf);
    if (ff) { if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r)); }
    if (n % 30 === 0 || n === list.length - 1) {
      const el = (Date.now() - t0) / 1000;
      console.log(`cuadro ${f}  ${n + 1}/${list.length}  ${(el / (n + 1)).toFixed(2)} s/cuadro  ~${((el / (n + 1)) * (list.length - n - 1) / 60).toFixed(1)} min restantes`);
    }
  }
  if (ff) { ff.stdin.end(); await new Promise((r) => ff.on('close', r)); }
  if (errs.length) console.log('avisos/errores del compositor:', [...new Set(errs)].slice(0, 12));
  await browser.close();
  server.close();
})();
