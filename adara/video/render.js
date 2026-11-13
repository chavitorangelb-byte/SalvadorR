// Render del video de Adara: abre el compositor en Chromium, pide cada cuadro y manda los PNG a ffmpeg.
// node adara/video/render.js --from 0 --to 1319 --subs 8 --out adara/video/build/render/master_916.mov
// node adara/video/render.js --frames 0,30,120 --png /tmp/x --subs 1 --scale 0.5     (cuadros sueltos)
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const serve = require('../tools/serve.js');
const A = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const SUBS = Number(A('subs', 8)), SCALE = Number(A('scale', 1));
const FROM = Number(A('from', 0)), TO = Number(A('to', 1319));
const OUT = A('out', null), PNG = A('png', null), FRAMES = A('frames', null), FPS = Number(A('fps', 60));
const SAFE = process.argv.includes('--safe');
const PORT = 8600 + Math.floor(Math.random() * 300);
const RW = Math.round(1080 * SCALE), RH = Math.round(1920 * SCALE);

(async () => {
  const server = serve(PORT);
  const browser = await chromium.launch({ args: ['--disable-gpu-vsync'] });
  const page = await browser.newPage({ viewport: { width: RW, height: RH }, deviceScaleFactor: 1 });
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.text()); });
  await page.goto(`http://127.0.0.1:${PORT}/video/compositor/index.html?subs=${SUBS}&scale=${SCALE}${SAFE ? '&safe=1' : ''}`);
  try { await page.waitForFunction(() => window.ready === true, null, { timeout: 180000 }); }
  catch (e) { console.error('el compositor no arranco', errs); process.exit(1); }
  let ff = null;
  if (OUT) {
    fs.mkdirSync(path.dirname(path.resolve(OUT)), { recursive: true });
    const enc = OUT.endsWith('.mov')
      ? ['-c:v', 'prores_ks', '-profile:v', '3', '-pix_fmt', 'yuv422p10le', '-vendor', 'apl0']
      : ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p'];
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
    if (PNG) fs.writeFileSync(path.join(PNG, `f${String(f).padStart(4, '0')}.png`), buf);
    if (ff) { if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r)); }
    if (n % 60 === 0 || n === list.length - 1) {
      const el = (Date.now() - t0) / 1000;
      console.log(`cuadro ${f}  ${n + 1}/${list.length}  ${(el / (n + 1)).toFixed(2)} s/cuadro  ~${((el / (n + 1)) * (list.length - n - 1) / 60).toFixed(1)} min`);
    }
  }
  if (ff) { ff.stdin.end(); await new Promise((r) => ff.on('close', r)); }
  if (errs.length) console.log('avisos/errores del compositor:', [...new Set(errs)].slice(0, 12));
  await browser.close(); server.close();
})();
