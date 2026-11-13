// Capturas de revision de la pagina (interno). node colors/tools/shoot_page.js <dir>
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const out = process.argv[2];
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  await p.goto('file://' + path.resolve(__dirname, '../site/index.html') + '?capture=1');
  await p.waitForFunction(() => document.documentElement.dataset.ready === '1');
  await p.evaluate(async () => { document.querySelectorAll('img').forEach((i) => (i.loading = 'eager')); await document.fonts.ready; await Promise.all([...document.images].map((i) => i.decode().catch(() => 0))); });
  const H = await p.evaluate(() => document.documentElement.scrollHeight);
  console.log('alto', H, 'overflowX', await p.evaluate(() => document.documentElement.scrollWidth));
  let i = 0;
  for (let y = 0; y < H; y += 780) { await p.evaluate((v) => scrollTo(0, v), y); await p.waitForTimeout(150); await p.screenshot({ path: path.join(out, `p${String(i++).padStart(2, '0')}.png`) }); }
  await p.tap('#o-submit'); console.log('wa:', decodeURIComponent(await p.evaluate(() => window.__lastWa)));
  console.log('errores', errs);
  await b.close();
})();
