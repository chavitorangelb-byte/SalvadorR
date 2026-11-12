// Imagen para el cliente: las secciones de la página tal como se ven en la demo, dentro de un celular.
// node tools/client_board.mjs  ->  build/board/*.png  (luego tools/client_board.py arma la lámina)
import { createRequire } from 'module';
import http from 'http'; import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
const { chromium } = createRequire(import.meta.url)('playwright');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html': 'text/html', '.mjs': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.otf': 'font/otf' };
const srv = http.createServer((q, r) => { const p = path.join(ROOT, decodeURIComponent(q.url.split('?')[0]));
  if (!fs.existsSync(p)) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r); }).listen(8391, '127.0.0.1');
const out = path.join(ROOT, 'build/board'); fs.mkdirSync(out, { recursive: true });
const b = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const pg = await b.newPage({ viewport: { width: 1080, height: 1920 } });
await pg.goto('http://127.0.0.1:8391/compositor/index.html?format=916&subs=8&scale=1');
await pg.waitForFunction(() => window.ready === true, null, { timeout: 120000 });
for (let k = 0; k < 5; k++) { await pg.evaluate((i) => window.renderStill(i), k); await pg.screenshot({ path: path.join(out, `sec${k}.png`) }); }
await pg.evaluate(() => window.renderFrame(826)); await pg.screenshot({ path: path.join(out, 'phone.png') });
await b.close(); srv.close(); console.log('capturas en', out);
