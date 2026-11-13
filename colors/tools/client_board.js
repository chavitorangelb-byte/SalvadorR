// Imagen para el cliente (Colors Boutique): pantallas reales de la pagina dentro de un celular, en una lamina vertical.
// Uso: node colors/tools/client_board.js [salida.jpg]
//   1) Captura la pagina (colors/site/) a 390x844 y 3x en seis estados -> colors/video/build/cliente/*.png
//   2) Compone la lamina 1080x2160 a 2x -> colors/video/out/colors_pagina_para_cliente.jpg (2160x4320)
// Sin guias, tiempos ni notas internas: es lo que se le manda al cliente.
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.resolve(process.argv[2] || path.join(ROOT, 'video/out/colors_pagina_para_cliente.jpg'));
const SHOTS = path.join(ROOT, 'video/build/cliente');
const W = 1080, H = 2160;

const SCREENS = [
  { file: '01_portada', title: 'Portada', desc: 'Tu frase, tus flores y el botón de WhatsApp siempre a la mano.' },
  { file: '02_catalogo', title: 'Catálogo', desc: 'Tus arreglos con foto, nombre y botón para pedir.' },
  { file: '03_filtros', title: 'Filtros', desc: 'Bouquets, arreglos, orquídeas o cajas, en un toque.' },
  { file: '04_eventos', title: 'Eventos', desc: 'Centros de mesa, con botón para cotizar.' },
  { file: '05_pedido', title: 'Arma tu pedido', desc: 'Ocasión, tipo y fecha: llega escrito a tu WhatsApp.' },
  { file: '06_datos', title: 'Tus datos', desc: 'Horario y dirección, listos para llenarse.' },
];

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
function serve() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      let p = decodeURIComponent(req.url.split('?')[0]);
      if (p.endsWith('/')) p += 'index.html';
      const f = path.join(ROOT, p);
      if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      fs.createReadStream(f).pipe(res);
    });
    srv.listen(0, '127.0.0.1', () => resolve(srv));
  });
}

async function capture(browser, base) {
  fs.mkdirSync(SHOTS, { recursive: true });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, locale: 'es-MX', timezoneId: 'America/Mexico_City' });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  await page.goto(base + '/site/index.html?capture=1', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.documentElement.dataset.ready === '1' && document.fonts.status === 'loaded');
  await page.addStyleTag({ content: 'html{scroll-behavior:auto!important}' });
  await page.evaluate(() => document.querySelectorAll('img').forEach((i) => (i.loading = 'eager')));
  const settle = async (ms) => {
    await page.waitForFunction(() => [...document.images].every((i) => i.complete && i.naturalWidth > 0));
    await page.waitForTimeout(ms);
  };
  const shot = async (name) => { await settle(350); await page.screenshot({ path: path.join(SHOTS, name + '.png') }); console.log('pantalla', name); };
  const scrollTo = async (sel, offset) => {
    await page.evaluate(([s, o]) => { const el = document.querySelector(s); scrollTo(0, el.getBoundingClientRect().top + scrollY - o); }, [sel, offset]);
    await settle(500);
  };
  const TOP = 119;                                    // alto del encabezado fijo en modo captura

  await shot('01_portada');
  await scrollTo('#catalogo', TOP - 22);
  await shot('02_catalogo');
  await page.tap('.chip[data-filter="bouquets"]');
  await shot('03_filtros');
  await page.tap('.chip[data-filter="todo"]');
  await scrollTo('#eventos', TOP);
  await shot('04_eventos');
  await page.tap('label.opt:has(input[name="ocasion"][value="Cumpleaños"])');
  await page.tap('label.opt:has(input[name="tipo"][value="Bouquet"])');
  await page.fill('#o-fecha', 'Sábado por la tarde');
  await page.evaluate(() => document.activeElement && document.activeElement.blur());
  await scrollTo('#pedido', TOP - 22);
  await shot('05_pedido');
  await scrollTo('#nosotros', TOP - 22);
  await shot('06_datos');
  await ctx.close();
  if (errs.length) console.log('errores de la pagina:', JSON.stringify(errs, null, 1));
}

const ICONS = `
<svg width="17" height="11" viewBox="0 0 17 11" fill="#1E1226"><rect x="0" y="7" width="3" height="4" rx=".8"/><rect x="4.6" y="5" width="3" height="6" rx=".8"/><rect x="9.2" y="2.6" width="3" height="8.4" rx=".8"/><rect x="13.8" y="0" width="3" height="11" rx=".8"/></svg>
<svg width="15" height="11" viewBox="0 0 15 11" fill="#1E1226"><path d="M7.5 2.1c2.2 0 4.1.8 5.6 2.2l1.2-1.2C12.5 1.4 10.1.4 7.5.4S2.5 1.4.7 3.1l1.2 1.2c1.5-1.4 3.4-2.2 5.6-2.2zm0 3.3c1.3 0 2.4.5 3.3 1.2l1.2-1.2c-1.2-1.1-2.8-1.7-4.5-1.7S4.2 4.3 3 5.4l1.2 1.2c.9-.8 2-1.2 3.3-1.2zm0 3.3c.5 0 .9.2 1.2.5L7.5 10.5 6.3 9.2c.3-.3.7-.5 1.2-.5z"/></svg>
<svg width="26" height="12" viewBox="0 0 26 12"><rect x=".5" y=".5" width="22" height="11" rx="3.3" fill="none" stroke="#1E1226" stroke-opacity=".45"/><rect x="2" y="2" width="19" height="8" rx="2" fill="#1E1226"/><path d="M24 4.1v3.8c.8-.3 1.3-1 1.3-1.9S24.8 4.4 24 4.1z" fill="#1E1226" fill-opacity=".45"/></svg>`;

function phone(s) {
  return `<div class="phone"><div class="dev">
    <i class="key l1"></i><i class="key l2"></i><i class="key l3"></i><i class="key r1"></i>
    <div class="bezel"><div class="scr">
      <img class="ui" src="/video/build/cliente/${s.file}.png" alt="">
      <div class="status"><span class="time">9:41</span><span class="icons">${ICONS}</span></div>
      <div class="island"></div>
      <div class="home"></div>
      <div class="glare"></div>
    </div></div>
  </div></div>`;
}

function boardHtml() {
  const cells = SCREENS.map((s, i) => `<div class="cell">${phone(s)}
    <div class="label"><b>${String(i + 1).padStart(2, '0')}</b><strong>${s.title}</strong><span>${s.desc}</span></div></div>`).join('');
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><style>
@font-face{font-family:Playfair;src:url(/site/fonts/playfair-display-latin-500-normal.woff2);font-weight:500}
@font-face{font-family:Playfair;src:url(/site/fonts/playfair-display-latin-500-italic.woff2);font-weight:500;font-style:italic}
@font-face{font-family:Jost;src:url(/site/fonts/jost-latin-400-normal.woff2);font-weight:400}
@font-face{font-family:Jost;src:url(/site/fonts/jost-latin-500-normal.woff2);font-weight:500}
@font-face{font-family:Jost;src:url(/site/fonts/jost-latin-600-normal.woff2);font-weight:600}
:root{--bg:#1E1226;--ink:#F7F2FA;--soft:#D9C9E6;--mute:#A995BA;--lav:#B592D6;--rose:#F3B9D2;--stem:#8CC474}
*{box-sizing:border-box;margin:0}
html,body{width:${W}px;height:${H}px;background:var(--bg);overflow:hidden}
body{position:relative;font-family:Jost;color:var(--ink);padding:84px 54px 0}
.bg{position:absolute;inset:0;background:radial-gradient(1100px 820px at 22% -4%,rgba(181,146,214,.30) 0%,rgba(30,18,38,0) 70%),radial-gradient(900px 700px at 96% 38%,rgba(232,160,191,.13) 0%,rgba(30,18,38,0) 70%),radial-gradient(1000px 700px at 40% 104%,rgba(181,146,214,.18) 0%,rgba(30,18,38,0) 70%)}
header,.grid,footer{position:relative}
.over{font:600 21px/1.2 Jost;letter-spacing:.22em;text-transform:uppercase;color:var(--rose)}
h1{font:500 104px/1 Playfair;margin-top:22px;white-space:nowrap;letter-spacing:-.012em}
h1 em{font-style:italic;color:#D9BFF0;position:relative;display:inline-block}
h1 em svg{position:absolute;left:-6px;bottom:-16px;width:calc(100% + 12px);height:22px;overflow:visible}
.sub{font:400 26px/1.45 Jost;color:var(--soft);margin-top:38px;max-width:930px}
.grid{display:grid;grid-template-columns:repeat(3,300px);column-gap:36px;row-gap:50px;margin-top:56px}
.phone{width:300px;height:626.6px;position:relative}
.dev{position:absolute;left:0;top:0;width:417px;height:871px;transform:scale(.719424);transform-origin:0 0;border-radius:61px;padding:3px;
  background:linear-gradient(150deg,#f3e9fb 0%,#b592d6 14%,#5d3f7c 36%,#9a7bb8 56%,#3a2548 78%,#c7a6e0 100%);
  box-shadow:0 40px 80px rgba(8,3,12,.62),0 12px 26px rgba(8,3,12,.5)}
.key{position:absolute;width:5px;border-radius:2px;background:linear-gradient(90deg,#4a3460,#c7a6e0 55%,#6a4f86)}
.key.l1{left:-3px;top:150px;height:42px}.key.l2{left:-3px;top:222px;height:72px}.key.l3{left:-3px;top:308px;height:72px}.key.r1{right:-3px;top:252px;height:112px}
.bezel{position:relative;width:411px;height:865px;border-radius:58px;background:#0c0710;padding:10.5px}
.scr{position:relative;width:390px;height:844px;border-radius:47.33px;overflow:hidden;background:#F7F2FA;isolation:isolate}
.ui{display:block;width:390px;height:844px}
.status{position:absolute;left:0;top:0;width:390px;height:47px;color:#1E1226}
.time{position:absolute;left:14px;width:104px;top:17px;text-align:center;font:600 17px/1 Jost}
.icons{position:absolute;right:27px;top:18px;display:flex;gap:5px;align-items:center}
.island{position:absolute;left:132.5px;top:11px;width:125px;height:37px;border-radius:18.5px;background:#000}
.home{position:absolute;left:128px;bottom:8px;width:134px;height:5px;border-radius:3px;background:rgba(30,18,38,.85)}
.glare{position:absolute;inset:0;background:linear-gradient(118deg,rgba(255,255,255,.10) 0%,rgba(255,255,255,.02) 28%,rgba(255,255,255,0) 42%)}
.label{margin-top:24px;display:grid;grid-template-columns:auto 1fr;column-gap:10px;row-gap:6px;align-items:baseline}
.label b{font:500 italic 27px/1 Playfair;color:var(--rose)}
.label strong{font:600 23px/1.15 Jost}
.label span{grid-column:2;font:400 19px/1.4 Jost;color:var(--mute)}
footer{margin-top:58px;text-align:center}
.note{font:400 20px/1.4 Jost;color:var(--soft)}
.sig{margin-top:24px;font:600 22px/1 Jost;letter-spacing:.24em;text-transform:uppercase}
.legal{margin-top:12px;font:400 17px/1.4 Jost;color:var(--mute)}
</style></head><body><div class="bg"></div>
<header>
  <p class="over">Propuesta para Colors Boutique</p>
  <h1>Así se vería <em>tu página<svg viewBox="0 0 400 22" preserveAspectRatio="none" aria-hidden="true">
    <path d="M4 14 C 92 4, 214 20, 396 7" stroke="#8CC474" stroke-width="7" stroke-linecap="round" fill="none" vector-effect="non-scaling-stroke"/>
  </svg></em></h1>
  <p class="sub">Una sola página, pensada para el celular: tu catálogo con fotos, pedidos que llegan ya escritos a tu WhatsApp y un espacio para tus eventos.</p>
</header>
<div class="grid">${cells}</div>
<footer>
  <p class="note">Los precios, el horario y la dirección se llenan con tu información.</p>
  <p class="sig">Elevate Negocios</p>
  <p class="legal">Demo de cortesía de Elevate Negocios · pieza no oficial</p>
</footer>
</body></html>`;
}

(async () => {
  const srv = await serve();
  const base = 'http://127.0.0.1:' + srv.address().port;
  const browser = await chromium.launch();
  try {
    if (!process.env.SKIP_CAPTURE) await capture(browser, base);
    fs.mkdirSync(path.join(ROOT, 'video/build/cliente'), { recursive: true });
    fs.writeFileSync(path.join(ROOT, 'video/build/cliente/lamina.html'), boardHtml());
    const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    await page.goto(base + '/video/build/cliente/lamina.html', { waitUntil: 'networkidle' });
    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all([...document.images].map((i) => i.decode()));
      // el titulo, lo mas grande que quepa en una linea (ya con la fuente real cargada)
      const h = document.querySelector('h1');
      let s = 104; h.style.fontSize = s + 'px';
      while (h.scrollWidth > h.clientWidth && s > 60) { s -= 1; h.style.fontSize = s + 'px'; }
    });
    const m = await page.evaluate(() => ({
      title: getComputedStyle(document.querySelector('h1')).fontSize,
      footerBottom: Math.round(document.querySelector('footer').getBoundingClientRect().bottom),
      fonts: [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family),
    }));
    console.log('titulo', m.title, '· pie termina en', m.footerBottom, 'de', H, '· fuentes', [...new Set(m.fonts)].join(', '));
    if (m.footerBottom > H - 40) console.log('AVISO: el pie queda a menos de 40 px del borde');
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    await page.screenshot({ path: OUT, type: 'jpeg', quality: 92, clip: { x: 0, y: 0, width: W, height: H } });
    console.log('lamina', OUT);
  } finally {
    await browser.close();
    srv.close();
  }
})();
