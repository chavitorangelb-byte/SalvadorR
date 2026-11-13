// Captura la pagina real (390x844 pt, 3x) para el celular del video.
//  page_top.png      pagina completa en su estado inicial
//  arma_<k>.png      seccion "Arma tu pedido" tras cada toque (k = 0..4)
//  manifest.json     posiciones (pt, coordenadas de pagina) de secciones y de cada elemento tocado
// Uso: node adara/video/capture/capture.js
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const serve = require('../../tools/serve.js');
const OUT = path.resolve(__dirname, '../build/capture');
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const port = 8400 + Math.floor(Math.random() * 300);
  const s = serve(port);
  const b = await chromium.launch({ args: ['--lang=es-MX'], env: { ...process.env, LANGUAGE: 'es_MX', LANG: 'es_MX.UTF-8' } });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, locale: 'es-MX' });
  const p = await ctx.newPage();
  await p.goto(`http://127.0.0.1:${port}/site/index.html?capture=1`);
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(600);
  const rect = (sel) => p.$eval(sel, (e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y + scrollY, w: r.width, h: r.height }; });
  const man = { dpr: 3, vw: 390, vh: 844 };
  man.pageH = await p.evaluate(() => document.documentElement.scrollHeight);
  for (const [k, sel] of Object.entries({ galeria: '#galeria', arma: '#arma', steps: '#arma .steps', send: '.send', pedido: '#pedido',
    hero: '.hero', topbar: '.top', waHero: '.ctas .wa-link', waOrder: '#pedido .wa-link', sendBtn: '#sendBtn', grid: '#grid' })) man[k] = await rect(sel);
  await p.screenshot({ path: path.join(OUT, 'page_top.png'), fullPage: true });

  // toques en "Arma tu pedido": sabor, relleno, tamano y la idea escrita
  const chipSel = (step, txt) => `[data-step="${step}"] .chip >> text="${txt}"`;
  const taps = [['tipo', 'Pastel'], ['sabor', 'Chocolate'], ['relleno', 'Nutella'], ['tamano', 'Mediano']];
  man.taps = [];
  const clip = { x: 0, y: man.arma.y - 12, width: 390, height: man.send.y + man.send.h + 40 - (man.arma.y - 12) };
  man.armaClip = clip;
  await p.click(chipSel('tipo', 'Pastel'));                     // el tipo ya viene elegido en todas las tomas
  const shot = async (n) => {
    await p.evaluate(() => window.scrollTo(0, 0));
    await p.waitForTimeout(250);
    await p.screenshot({ path: path.join(OUT, `arma_${n}.png`), clip, fullPage: true });
  };
  await shot(0);
  for (let i = 1; i < taps.length; i++) {
    const [st, txt] = taps[i];
    const loc = p.locator(chipSel(st, txt));
    const r = await loc.evaluate((e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y + scrollY, w: r.width, h: r.height }; });
    man.taps.push({ step: st, label: txt, ...r });
    await loc.click();
    await shot(i);
  }
  // la idea escrita
  const idea = 'Pastel con rosas para mamá';
  man.idea = { text: idea, ...(await rect('#idea')) };
  // la idea se escribe letra por letra: solo el cuadro de texto (estado intermedio de cada tecla)
  const ta = man.idea;
  const taClip = { x: ta.x - 4, y: ta.y - 4, width: ta.w + 8, height: ta.h + 8 };
  man.typeClip = taClip;
  man.typeSteps = [];
  await p.focus('#idea');
  for (let i = 1; i <= idea.length; i++) {
    await p.fill('#idea', idea.slice(0, i));
    await p.dispatchEvent('#idea', 'input');
    await p.evaluate(() => window.scrollTo(0, 0));
    await p.screenshot({ path: path.join(OUT, `type_${String(i).padStart(2, '0')}.png`), clip: taClip, fullPage: true });
    man.typeSteps.push(i);
  }
  await shot(4);
  man.gridItems = await p.$$eval('#grid button', (bs) => bs.map((e) => { const r = e.getBoundingClientRect(); return { src: e.querySelector('img').getAttribute('src'), x: r.x, y: r.y + scrollY, w: r.width, h: r.height }; }));
  for (const st of ['sabor', 'relleno', 'extra', 'tamano', 'diseno']) man['step_' + st] = await rect(`[data-step="${st}"]`);
  fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(man, null, 1));
  console.log(JSON.stringify(man));
  await b.close(); s.close();
})();
