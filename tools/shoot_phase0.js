// Capturas de la Fase 0 a 2x (390x844) + hoja de contacto.
// Uso: node tools/shoot_phase0.js
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');
const BASE = process.env.BASE || 'http://127.0.0.1:8123/';
const OUT = path.join(ROOT, 'review', 'fase0');
const REF = path.join(ROOT, 'assets', 'demo_referencia_cliente_boceto.jpg');
fs.mkdirSync(OUT, { recursive: true });

const SHOTS = [];
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
    locale: 'es-MX', timezoneId: 'America/Mexico_City',
  });
  const page = await ctx.newPage();
  await page.goto(BASE + '?capture=1', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.documentElement.dataset.ready === '1');
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => document.querySelectorAll('img[loading="lazy"]').forEach((i) => (i.loading = 'eager')));
  await page.waitForTimeout(1600);
  const shot = async (file, label) => {
    await page.waitForTimeout(120);
    await page.screenshot({ path: path.join(OUT, file + '.png') });
    SHOTS.push({ file: file + '.png', label });
    console.log('ok', file);
  };
  const to = async (sel, off) => {
    await page.evaluate(([s, o]) => { const el = document.querySelector(s); scrollTo(0, el.getBoundingClientRect().top + scrollY - o); }, [sel, off]);
    await page.waitForTimeout(800);
  };

  await shot('01_portada', 'Portada');
  await to('#portafolio', 40);
  await shot('02_galeria', 'Galería · Todo');
  await page.tap('[data-filter="realismo"]'); await page.waitForTimeout(1000);
  await shot('03_realismo', 'Filtro · Realismo');
  await page.tap('[data-filter="color"]'); await page.waitForTimeout(1000);
  await shot('04_color', 'Filtro · Color');
  await page.tap('[data-filter="todo"]'); await page.waitForTimeout(1000);
  await page.tap('[data-open="cristo"]'); await page.waitForTimeout(700);
  await shot('05_visor', 'Visor de pieza');
  await page.tap('#lb-close'); await page.waitForTimeout(400);

  await to('#cotiza', 70);
  await page.tap('#q-submit'); await page.waitForTimeout(900);
  await to('#q-title', 76);
  await shot('06_errores', 'Cotiza · validación');
  await page.fill('#q-idea', 'Una rosa de los vientos con sombras, estilo realista');
  await page.tap('label.opt:has(input[name="style"][value="realismo"])');
  await page.tap('label.opt:has(input[name="zone"][value="antebrazo"])');
  await page.tap('label.opt:has(input[name="size"][value="mediano"])');
  await to('.q-step[data-field="size"]', 74);
  await page.setInputFiles('#q-photo', REF);
  await page.waitForTimeout(520);
  await shot('07_foto_cargando', 'Foto de referencia · cargando');
  await page.waitForTimeout(1500);
  await page.fill('#q-name', 'Ana');
  await page.evaluate(() => document.activeElement.blur());
  await to('.q-step[data-field="photo"]', 74);
  await shot('08_lleno', 'Cotiza · lista para enviar');
  await page.tap('#q-submit'); await page.waitForTimeout(700);
  await to('.q-preview', 74);
  await shot('09_enviado', 'Enviado a WhatsApp');
  await page.waitForTimeout(2200);

  await to('#cuidados', 64);
  await shot('10_cuidados', 'Cuidados');
  await to('#visitanos', 64);
  await shot('11_visitanos', 'Visítanos');

  await page.evaluate(() => scrollTo(0, 0)); await page.waitForTimeout(500);
  await page.tap('.lang-btn[data-lang="en"]'); await page.waitForTimeout(1400);
  await page.evaluate(() => window.siniestro.redrawInk()); await page.waitForTimeout(1400);
  await shot('12_en_portada', 'English · portada');
  await to('#portafolio', 40);
  await shot('13_en_galeria', 'English · galería');
  await to('.q-step[data-field="photo"]', 74);
  await shot('14_en_cotiza', 'English · cotiza');
  await to('#cuidados', 64);
  await shot('15_en_cuidados', 'English · cuidados');
  await page.tap('.lang-btn[data-lang="es"]'); await page.waitForTimeout(1200);
  await page.evaluate(() => scrollTo(0, 0)); await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT, '99_pagina_completa_es.png'), fullPage: true });
  await ctx.close();

  // Hoja de contacto (se arma en HTML con las mismas fuentes de la pagina)
  const pick = SHOTS.filter((s) => !/^1[345]_/.test(s.file));
  const cells = pick.map((s, i) => `<figure><img src="${s.file}"><figcaption><b>${String(i + 1).padStart(2, '0')}</b>${s.label}</figcaption></figure>`).join('');
  const sheet = `<!doctype html><html><head><meta charset="utf-8"><style>
    @font-face{font-family:BSD;src:url(../../site/fonts/big-shoulders-display-latin-900-normal.woff2)}
    @font-face{font-family:Barlow;src:url(../../site/fonts/barlow-latin-500-normal.woff2);font-weight:500}
    @font-face{font-family:Barlow;src:url(../../site/fonts/barlow-latin-700-normal.woff2);font-weight:700}
    body{margin:0;background:#0E0E0E;color:#EDEAE6;font-family:Barlow;padding:56px 60px 64px;width:1800px;box-sizing:border-box}
    h1{font:900 64px/1 BSD;text-transform:uppercase;margin:0}
    p{margin:10px 0 40px;color:#C9C9C9;font-size:20px}
    .g{display:grid;grid-template-columns:repeat(4,390px);gap:40px 46px}
    figure{margin:0}
    img{width:390px;height:844px;display:block;border-radius:34px;outline:1px solid rgba(201,201,201,.18);outline-offset:6px}
    figcaption{margin-top:18px;font-size:19px;font-weight:500;color:#C9C9C9}
    figcaption b{color:#A3201B;font:900 21px/1 BSD;margin-right:10px}
  </style></head><body><h1>Siniestro Tattoo Studio · Fase 0</h1>
  <p>Página real en vista de celular (390 × 844). Fotos reales del estudio; "Tu trabajo aquí", "Tus precios aquí" y "Tu horario aquí" son marcadores para confirmar con el dueño.</p>
  <div class="g">${cells}</div></body></html>`;
  fs.writeFileSync(path.join(OUT, 'hoja.html'), sheet);
  const c2 = await browser.newContext({ viewport: { width: 1800, height: 1000 }, deviceScaleFactor: 1.5 });
  const p2 = await c2.newPage();
  await p2.goto('file://' + path.join(OUT, 'hoja.html'));
  await p2.evaluate(() => document.fonts.ready);
  await p2.waitForTimeout(500);
  await p2.screenshot({ path: path.join(ROOT, 'review', 'fase0_hoja_de_contacto.jpg'), fullPage: true, type: 'jpeg', quality: 86 });
  console.log('hoja ok');
  await browser.close();
})();
