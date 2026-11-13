// Captura de la página completa a 390 px (3x) para revisión.
const { chromium } = require('playwright'); const http = require('http'); const fs = require('fs'); const path = require('path');
const ROOT = path.resolve(__dirname, '..'); const OUT = process.argv[2];
const MIME = { '.html': 'text/html; charset=utf-8', '.webp': 'image/webp', '.woff2': 'font/woff2', '.jpg': 'image/jpeg', '.png': 'image/png' };
const srv = http.createServer((q, r) => { let p = decodeURIComponent(q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html'; const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f)) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); });
srv.listen(0, async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true });
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', (e) => errs.push(e.message)); pg.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  await pg.goto(`http://127.0.0.1:${srv.address().port}/site/index.html?capture=1`, { waitUntil: 'networkidle' });
  await pg.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 400) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 60)); } scrollTo(0, 0); await document.fonts.ready; });
  await pg.waitForTimeout(600);
  await pg.screenshot({ path: OUT, fullPage: true });
  const ow = await pg.evaluate(() => document.documentElement.scrollWidth); console.log('ancho', ow, 'errores', errs); await b.close(); srv.close();
});
