// Previews de la página para mandarle al cliente: capturas REALES de la interfaz (390x844 a 3x) montadas en un
// celular sobre el fondo de la marca, en 4:5 (1080x1350 a 2x = 2160x2700, nítidas en WhatsApp "HD" e Instagram).
// Cada imagen lleva un título corto y la línea "Demo de cortesía de Elevate Negocios · pieza no oficial".
// Uso: matica/tools/serve.sh && node matica/tools/previews_cliente.js
// Salida: matica/review/para_cliente/*.jpg (las capturas crudas quedan en matica/video/build/previews/)
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');
const BASE = process.env.BASE || 'http://127.0.0.1:8124/';
const RAW = path.join(ROOT, 'video', 'build', 'previews');
const OUT = path.join(ROOT, 'review', 'para_cliente');
fs.mkdirSync(RAW, { recursive: true });
fs.mkdirSync(OUT, { recursive: true });

// (archivo, título, subtítulo) — solo lo que la página hace de verdad, sin datos inventados
const SCREENS = [
  ['01_portada', 'Tu portada', 'Fachada, logo y lo esencial a un toque: pet friendly, working friendly, menú y cómo llegar.'],
  ['02_menu', 'Tu menú completo', 'Con precios, por categoría y Frío / Caliente donde aplica.'],
  ['03_producto', 'Cada producto, con foto', 'Detalle, ingredientes y botón para agregarlo al pedido.'],
  ['04_pedido', 'Pedidos para recoger', 'Tu cliente arma su pedido y elige: pedir para recoger por WhatsApp o a domicilio por Rappi.'],
  ['05_whatsapp', 'El pedido llega escrito', 'Así te llegaría por WhatsApp, con productos, cantidades y total.'],
  ['06_asi_se_vive', 'Así se vive Matíca', 'Pet friendly, working friendly y eventos, con fotos del lugar.'],
  ['07_resenas', 'Tus reseñas de Google', 'Lo que dicen tus clientes, a la vista de quien te busca.'],
  ['08_visitanos', 'Cómo llegar y horario', 'Mapa, dirección y si está abierto en ese momento.'],
];

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true,
    locale: 'es-MX', timezoneId: 'America/Mexico_City',
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  // jueves 5 nov 2026, 10:40 en Aguascalientes: día hábil y abierto (como en el video)
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
  const shot = async (file, wait = 700) => { await page.waitForTimeout(wait); await page.screenshot({ path: path.join(RAW, file + '.png') }); console.log('captura', file); };
  const to = async (sel, off = 0) => {
    await M(([s, o]) => { const el = document.querySelector(s); const h = document.querySelector('#hdr').offsetHeight; scrollTo(0, el.getBoundingClientRect().top + scrollY - h - o); }, [sel, off]);
    await page.waitForTimeout(300);
  };

  await shot('01_portada');
  await to('#menu', -10);
  await shot('02_menu');
  await page.tap('#tab-waffles');
  await page.waitForTimeout(800);
  await page.tap('#item-jamon-serrano .item-open');
  await shot('03_producto', 1000);
  await page.tap('#si-add');
  await page.waitForTimeout(800);
  await page.tap('#tab-especiales');
  await page.waitForTimeout(600);
  await page.tap('#item-cold-brew-tonic .item-open');
  await page.waitForTimeout(900);
  await page.tap('#si-add');
  await page.waitForTimeout(1000);
  await page.tap('#cartbar');
  await shot('04_pedido', 1000);
  await page.tap('#exit-pickup');
  await shot('05_whatsapp', 900);
  await M(() => window.matica.closeSheet());
  await page.waitForTimeout(700);
  await to('#vive', -40);
  await shot('06_asi_se_vive');
  await to('#revs', 40);
  await M(() => window.matica.goReview(1, 0));
  await shot('07_resenas');
  await to('#visitanos', -6);
  await M(() => window.matica.dropPin());
  await shot('08_visitanos', 1400);
  await ctx.close();

  // ---------- montaje: celular con barra de estado e isla, sobre el fondo de la marca ----------
  const font = (w) => `@font-face{font-family:Poppins;src:url(${path.join(ROOT, 'site/fonts', `poppins-latin-${w}-normal.woff2`)});font-weight:${w}}`;
  const S = 400 / 390;                                  // escala de la pantalla (px de la imagen por px CSS)
  const statusSVG = `<svg viewBox="0 0 390 60" width="${390 * S}" height="${60 * S}" style="position:absolute;left:0;top:0">
    <text x="56" y="36" text-anchor="middle" font-family="Poppins" font-weight="600" font-size="17" fill="#14201a">10:40</text>
    ${[0, 1, 2, 3].map((i) => { const h = 4.2 + i * 2.5; return `<rect x="${289 + i * 4.9}" y="${35.5 - h}" width="3.2" height="${h}" rx="1" fill="#14201a"/>`; }).join('')}
    ${[10.5, 6.8, 3.2].map((r) => `<path d="M ${320 + r * Math.cos(-Math.PI * 0.76)} ${36.5 + r * Math.sin(-Math.PI * 0.76)} A ${r} ${r} 0 0 1 ${320 + r * Math.cos(-Math.PI * 0.24)} ${36.5 + r * Math.sin(-Math.PI * 0.24)}" stroke="#14201a" stroke-width="2.2" fill="none" stroke-linecap="round"/>`).join('')}
    <rect x="335.5" y="24.5" width="25" height="12" rx="3.6" fill="none" stroke="#14201a" stroke-opacity=".4" stroke-width="1.1"/>
    <rect x="361.6" y="28.4" width="1.6" height="4.4" rx=".8" fill="#14201a" fill-opacity=".4"/>
    <rect x="337.6" y="26.6" width="17.5" height="7.8" rx="2.1" fill="#14201a"/>
    <rect x="${195 - 62.5}" y="11" width="125" height="37" rx="18.5" fill="#000"/>
    <circle cx="${195 + 43}" cy="29.5" r="5.2" fill="#0c0f12"/></svg>`;
  const phone = (file, cls = '') => `<div class="phone ${cls}"><div class="scr"><img src="file://${path.join(RAW, file + '.png')}">${statusSVG}<i class="home"></i></div></div>`;
  const css = `${font(500)}${font(600)}${font(700)}
    *{box-sizing:border-box}html,body{margin:0}
    body{width:1080px;height:1350px;overflow:hidden;font-family:Poppins;color:#F4F1EA;
      background:radial-gradient(120% 70% at 50% 108%,#24563a 0%,rgba(31,77,46,.55) 34%,rgba(26,34,38,0) 70%),radial-gradient(90% 60% at 30% 10%,rgba(124,172,137,.10),rgba(0,0,0,0) 60%),#1A2226}
    .top{position:absolute;left:0;right:0;top:78px;text-align:center;padding:0 70px}
    .kick{font-weight:600;font-size:21px;letter-spacing:.24em;text-transform:uppercase;color:#7CAC89}
    h1{margin:14px 0 0;font-weight:700;font-size:56px;line-height:1.05;letter-spacing:.06em;text-transform:uppercase}
    p{margin:16px auto 0;max-width:820px;font-weight:500;font-size:25px;line-height:1.42;color:rgba(244,241,234,.78)}
    .phone{position:absolute;left:50%;top:300px;width:${390 * S + 28}px;height:${844 * S + 28}px;margin-left:-${(390 * S + 28) / 2}px;padding:14px;border-radius:${47.33 * S + 14}px;
      background:linear-gradient(145deg,#3a4744 0%,#10171a 38%,#0b1012 62%,#33403d 100%);
      box-shadow:0 0 0 1.5px rgba(255,255,255,.16) inset,0 50px 90px -20px rgba(0,0,0,.65),0 18px 40px -16px rgba(0,0,0,.5)}
    .scr{position:relative;width:${390 * S}px;height:${844 * S}px;border-radius:${47.33 * S}px;overflow:hidden;background:#F4F1EA}
    .scr img{display:block;width:100%;height:100%}
    .home{position:absolute;left:50%;bottom:${5 * S}px;width:${134 * S}px;height:${5 * S}px;margin-left:-${67 * S}px;border-radius:9px;background:rgba(10,14,12,.72)}
    .foot{position:absolute;left:0;right:0;bottom:36px;text-align:center;font-weight:500;font-size:19px;letter-spacing:.02em;color:rgba(244,241,234,.55)}
    .trio .phone{top:372px}
    .trio .l{transform:translateX(-262px) translateY(40px) rotate(-7deg) scale(.76);opacity:.96}
    .trio .r{transform:translateX(262px) translateY(40px) rotate(7deg) scale(.76);opacity:.96}`;
  const pageHTML = (body) => `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body>${body}
    <div class="foot">Demo de cortesía de Elevate Negocios · pieza no oficial</div></body></html>`;
  const comp = await browser.newContext({ viewport: { width: 1080, height: 1350 }, deviceScaleFactor: 2 });
  const p2 = await comp.newPage();
  const render = async (name, html) => {
    const f = path.join(RAW, name + '.html');
    fs.writeFileSync(f, html);
    await p2.goto('file://' + f);
    await p2.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map((i) => i.decode().catch(() => {}))); });
    await p2.screenshot({ path: path.join(OUT, name + '.jpg'), type: 'jpeg', quality: 90 });
    console.log('preview', name);
  };
  await render('00_asi_se_veria', pageHTML(`<div class="trio"><div class="top"><div class="kick">Matíca · Café de especialidad</div>
    <h1>Así se vería<br>tu página</h1><p>Hecha con tu menú, tus fotos y tus reseñas reales.</p></div>
    ${phone('01_portada', 'l')}${phone('04_pedido', 'r')}${phone('02_menu')}</div>`));
  for (const [file, title, sub] of SCREENS) {
    await render(file, pageHTML(`<div class="top"><div class="kick">Matíca · así se vería tu página</div><h1>${title}</h1><p>${sub}</p></div>${phone(file)}`));
  }
  await browser.close();
  if (errors.length) console.log('errores de la página:', errors);
})();
