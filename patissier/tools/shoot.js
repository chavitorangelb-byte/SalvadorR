// Capturas rápidas de la página en estado final (revisión interna).
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const out = process.argv[2] || path.join(__dirname, '../build/shots');
  require('fs').mkdirSync(out, { recursive: true });
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true })).newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  await p.goto('file://' + path.join(__dirname, '../site/index.html') + '?capture=1' + (process.argv[3] || ''));
  await p.waitForFunction(() => document.documentElement.dataset.ready === '1');
  await p.evaluate(() => window.pat.cap({ intro: 1, card: 1, typed: 1, gal: 1, order: 1, sizes: 1, ring: 1, size: 'Mediano' }));
  await p.screenshot({ path: out + '/full.png', fullPage: true });
  const h = await p.evaluate(() => document.documentElement.scrollHeight);
  console.log('alto', h, errs);
  await b.close();
})();
