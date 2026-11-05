// Capturas de revisión de la Fase 0 (390x844, celular) + hoja de contacto.
// Uso: node matica/tools/shoot_phase0.js [--dpr 3] [--only 01,05]
// Requiere la página servida: (cd matica/site && python3 -m http.server 8124)
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');
const BASE = process.env.BASE || 'http://127.0.0.1:8124/';
const OUT = path.join(ROOT, 'review', 'fase0');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const DPR = Number(arg('dpr', 3));
const ONLY = (arg('only', '') || '').split(',').filter(Boolean);
fs.mkdirSync(OUT, { recursive: true });

const SHOTS = [];
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: DPR, isMobile: true, hasTouch: true,
    locale: 'es-MX', timezoneId: 'America/Mexico_City',
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text()); });
  // jueves 5 nov 2026, 10:40 en Aguascalientes: día hábil y abierto
  await page.clock.setFixedTime(new Date('2026-11-05T10:40:00-06:00'));
  await page.goto(BASE + '?capture=1', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.documentElement.dataset.ready === '1');
  await page.evaluate(async () => {
    document.querySelectorAll('img[loading="lazy"]').forEach((i) => (i.loading = 'eager'));
    await document.fonts.ready;
    await Promise.all([...document.images].map((i) => (i.complete ? 0 : new Promise((r) => { i.onload = i.onerror = r; }))));
  });
  await page.waitForTimeout(400);
  const M = (fn, a) => page.evaluate(fn, a);
  const want = (f) => !ONLY.length || ONLY.some((o) => f.startsWith(o));
  const shot = async (file, label, opts = {}) => {
    if (!want(file)) return;
    await page.waitForTimeout(opts.wait || 650);
    await page.screenshot({ path: path.join(OUT, file + '.png'), fullPage: !!opts.full });
    SHOTS.push({ file: file + '.png', label });
    console.log('ok', file);
  };
  const to = async (sel, off = 0) => {
    await M(([s, o]) => { const el = document.querySelector(s); const h = document.querySelector('#hdr').offsetHeight; scrollTo(0, el.getBoundingClientRect().top + scrollY - h - o); }, [sel, off]);
    await page.waitForTimeout(250);
  };

  await shot('01_portada', 'Portada');
  await to('#destacados', -8);
  await shot('02_de_la_casa', 'De la casa');
  await to('#menu', -10);
  await shot('03_menu_cafe', 'Menú · Café (Latte caliente $60)');
  await to('#item-latte', 190);
  await page.tap('#item-latte [data-temp="cold"]');
  await shot('04_latte_frio', 'Latte: Frío $65 (foto cambia)', { wait: 900 });
  await page.tap('#tab-especiales');
  await shot('05_especiales', 'Los especiales', { wait: 900 });
  await page.tap('#tab-waffles');
  await shot('06_waffles', 'Waffles de yuca', { wait: 900 });
  await page.tap('#item-jamon-serrano .item-open');
  await shot('07_ficha_waffle', 'Ficha · Jamón serrano y matícas', { wait: 900 });
  await page.tap('#si-add');
  await page.waitForTimeout(700);
  await page.tap('#tab-especiales');
  await page.waitForTimeout(500);
  await page.tap('#item-cold-brew-tonic .item-open');
  await shot('08_ficha_cold_brew', 'Ficha · Cold brew tonic (sabor)', { wait: 900 });
  await page.tap('#si-add');
  await page.waitForTimeout(900);
  await shot('09_barra_pedido', 'Barra de pedido: 2 · $180');
  await page.tap('#cartbar');
  await shot('10_pedido', 'Pedido: $85 + $95 = $180, dos salidas', { wait: 900 });
  await page.tap('#exit-pickup');
  await shot('11_whatsapp', 'Pedir para recoger: mensaje (Tu WhatsApp aquí)', { wait: 700 });
  await M(() => window.matica.closeSheet());
  await page.waitForTimeout(600);
  await to('#pide', -10);
  await shot('12_pide', 'Pide');
  await to('#vive', -40);
  await shot('13_asi_se_vive', 'Así se vive Matíca');
  await to('#revs', 40);
  await shot('14_resenas', 'Reseñas');
  await M(() => window.matica.goReview(1, 0));
  await shot('15_resena_2', 'Reseña 2');
  await to('#visitanos', -6);
  await M(() => window.matica.dropPin());
  await shot('16_visitanos', 'Visítanos', { wait: 1200 });
  await to('.foot', 300);
  await shot('17_pie', 'Horario, enlaces y pie');
  await M(() => { window.matica.clearCart(); scrollTo(0, 0); });
  await page.waitForTimeout(300);
  await M(() => window.matica.openCart());
  await shot('18_pedido_vacio', 'Pedido vacío', { wait: 800 });
  await M(() => window.matica.closeSheet({ instant: true }));
  await to('#item-americano', 300);
  await M(() => window.matica.openItem('americano'));
  await page.waitForTimeout(700);
  await page.tap('#si-body [data-temp="cold"]');
  await page.click('#si-body [data-addon="leche-vegetal"] + .box');
  await shot('19_ficha_americano', 'Ficha sin foto: Americano frío + leche vegetal = $60', { wait: 900 });
  await M(() => window.matica.closeSheet({ instant: true }));
  if (want('99')) {
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(OUT, '99_pagina_completa.png'), fullPage: true });
    console.log('ok 99_pagina_completa');
  }
  if (errors.length) { console.log('ERRORES EN CONSOLA:'); errors.forEach((e) => console.log('  ', e)); }
  fs.writeFileSync(path.join(OUT, 'shots.json'), JSON.stringify(SHOTS, null, 2));
  await ctx.close();
  if (ONLY.length) { await browser.close(); return; }

  // Hoja de contacto (en HTML, con las mismas fuentes de la página)
  const pick = SHOTS.filter((s) => !/^(09|15|18)_/.test(s.file));
  const cells = pick.map((s, i) => `<figure><img src="${s.file}"><figcaption><b>${String(i + 1).padStart(2, '0')}</b>${s.label}</figcaption></figure>`).join('');
  const sheet = `<!doctype html><html><head><meta charset="utf-8"><style>
    @font-face{font-family:Poppins;src:url(../../site/fonts/poppins-latin-400-normal.woff2);font-weight:400}
    @font-face{font-family:Poppins;src:url(../../site/fonts/poppins-latin-600-normal.woff2);font-weight:600}
    @font-face{font-family:Poppins;src:url(../../site/fonts/poppins-latin-700-normal.woff2);font-weight:700}
    body{margin:0;background:#1A2226;color:#F4F1EA;font-family:Poppins;padding:56px 60px 64px;width:1800px;box-sizing:border-box}
    h1{font:700 40px/1.1 Poppins;letter-spacing:.12em;text-transform:uppercase;margin:0}
    p{margin:12px 0 40px;color:rgba(244,241,234,.72);font-size:19px;max-width:1500px;line-height:1.5}
    .g{display:grid;grid-template-columns:repeat(4,390px);gap:40px 46px}
    figure{margin:0}
    img{width:390px;height:844px;display:block;border-radius:34px;outline:1px solid rgba(124,172,137,.35);outline-offset:6px}
    figcaption{margin-top:18px;font-size:17px;font-weight:400;color:rgba(244,241,234,.8);line-height:1.4}
    figcaption b{color:#7CAC89;font-weight:700;margin-right:10px}
  </style></head><body><h1>Matíca · Fase 0</h1>
  <p>La página real en vista de celular (390 × 844). Menú y precios transcritos de su menú impreso; fotos, logo y textos tomados de su Instagram y Google. "Tu WhatsApp aquí" es el único marcador pendiente del dueño.</p>
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
