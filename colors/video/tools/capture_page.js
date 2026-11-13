// Captura la pagina real (site/) para la pantalla del telefono del video:
//   tall_<estado>.png  pagina completa a 2x sin encabezado ni barra fija
//   top.png / bar.png  encabezado y barra de WhatsApp con transparencia
//   rects.json         posiciones (px CSS, documento) de lo que el compositor necesita
// Uso: node colors/video/tools/capture_page.js
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '../..');
const OUT = path.join(ROOT, 'video/build/capture');
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'es-MX' });
  const p = await ctx.newPage();
  await p.goto('file://' + path.join(ROOT, 'site/index.html') + '?capture=1');
  await p.waitForFunction(() => document.documentElement.dataset.ready === '1');
  const settle = () => p.evaluate(async () => { document.querySelectorAll('img').forEach((i) => (i.loading = 'eager')); await document.fonts.ready; await Promise.all([...document.images].map((i) => i.decode().catch(() => 0))); });
  await settle();
  const rects = await p.evaluate(() => {
    const r = (s) => { const e = document.querySelector(s).getBoundingClientRect(); return { x: e.x, y: e.y + scrollY, w: e.width, h: e.height }; };
    const out = { top: r('.top'), bar: r('#bar'), barBtn: r('#bar-wa'), heroPhoto: r('#hero-photo'), catalogo: r('#catalogo'), chips: r('#chips'), grid: r('#grid'), eventos: r('#eventos'), pedido: r('#pedido') };
    document.querySelectorAll('.chip').forEach((c) => { const e = c.getBoundingClientRect(); out['chip_' + c.dataset.filter] = { x: e.x, y: e.y + scrollY, w: e.width, h: e.height }; });
    out.barBtn.vy = document.querySelector('#bar-wa').getBoundingClientRect().y;   // en el viewport (barra fija)
    out.docH = document.documentElement.scrollHeight;
    return out;
  });
  // encabezado y barra con fondo transparente
  await p.addStyleTag({ content: 'html.only-fixed,html.only-fixed body{background:transparent!important}html.only-fixed main,html.only-fixed footer{visibility:hidden}' });
  await p.evaluate(() => document.documentElement.classList.add('only-fixed'));
  await p.screenshot({ path: path.join(OUT, 'top.png'), omitBackground: true, clip: { x: 0, y: 0, width: 390, height: rects.top.h } });
  const barY = 844 - rects.bar.h;
  await p.screenshot({ path: path.join(OUT, 'bar.png'), omitBackground: true, clip: { x: 0, y: barY, width: 390, height: rects.bar.h } });
  rects.barTopInViewport = barY;
  await p.evaluate(() => document.documentElement.classList.remove('only-fixed'));
  await p.addStyleTag({ content: 'html.no-fixed .top{visibility:hidden}html.no-fixed .bar{display:none}' });
  await p.evaluate(() => document.documentElement.classList.add('no-fixed'));
  for (const st of ['todo', 'bouquets']) {
    await p.evaluate((f) => window.__setFilter(f), st);
    await settle(); await p.waitForTimeout(300);
    await p.screenshot({ path: path.join(OUT, `tall_${st}.png`), fullPage: true });
    console.log('estado', st);
  }
  fs.writeFileSync(path.join(OUT, 'rects.json'), JSON.stringify(rects, null, 1));
  console.log(JSON.stringify({ top: rects.top, bar: rects.bar, chips: rects.chips, docH: rects.docH, barBtn: rects.barBtn }));
  await b.close();
})();
