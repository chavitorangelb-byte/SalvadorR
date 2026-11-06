// Imagen para el cliente: pantallas reales de la pagina dentro de un celular, en una sola lamina vertical.
// Uso: node tools/client_board.js [salida.jpg]
//   1) Captura la pagina (site/) a 390x844 y 3x en seis estados -> video/build/cliente/*.png
//   2) Compone la lamina 1080x2160 a 2x -> video/out/siniestro_pagina_para_cliente.jpg (2160x4320)
// Sin guias, tiempos ni notas internas: es lo que se le manda al cliente.
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.resolve(process.argv[2] || path.join(ROOT, 'video/out/siniestro_pagina_para_cliente.jpg'));
const SHOTS = path.join(ROOT, 'video/build/cliente');
const REF = path.join(ROOT, 'assets/demo_referencia_cliente_boceto.jpg');
const W = 1080, H = 2160;

const SCREENS = [
  { file: '01_portada', title: 'Portada', desc: 'Tus 23 años, la dirección y el botón para cotizar.' },
  { file: '02_trabajo', title: 'Tu trabajo, por estilo', desc: 'Realismo, black & grey, color y religioso.' },
  { file: '03_cotiza', title: 'Cotiza con su idea', desc: 'Idea, estilo, zona y tamaño, directo a tu WhatsApp.' },
  { file: '04_cuidados', title: 'Cuidados', desc: 'Lo básico para que sane bien.', home: 'dark' },
  { file: '05_visitanos', title: 'Visítanos', desc: 'Calle Rayón 262: cómo llegar y llamada en un toque.' },
  { file: '06_ingles', title: 'También en inglés', desc: 'Un toque y toda la página cambia de idioma.' },
];

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.json': 'application/json',
  '.woff2': 'font/woff2', '.otf': 'font/otf',
};
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
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true,
    locale: 'es-MX', timezoneId: 'America/Mexico_City',
  });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  await page.goto(base + '/site/index.html?capture=1', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.documentElement.dataset.ready === '1' && document.fonts.status === 'loaded');
  await page.waitForTimeout(1500);
  // espera a que las fotos visibles esten cargadas y decodificadas
  const settle = async (ms) => {
    await page.waitForFunction(() => [...document.images].every((i) => {
      const r = i.getBoundingClientRect();
      return r.bottom <= 0 || r.top >= innerHeight || r.width === 0 || (i.complete && i.naturalWidth > 0);
    }));
    await page.waitForTimeout(ms);
  };
  const shot = async (name) => { await settle(300); await page.screenshot({ path: path.join(SHOTS, name + '.png') }); console.log('pantalla', name); };
  const scrollTo = async (sel, offset) => {
    await page.evaluate(([s, o]) => { const el = document.querySelector(s); scrollTo(0, el.getBoundingClientRect().top + scrollY - o); }, [sel, offset]);
    await settle(800);
  };

  await shot('01_portada');
  await scrollTo('#portafolio', 40);
  await shot('02_trabajo');

  // la idea coincide con la foto de referencia (boceto de rosa de los vientos hecho en codigo)
  await page.fill('#q-idea', 'Una rosa de los vientos con sombras, estilo realista');
  await page.tap('label.opt:has(input[name="style"][value="realismo"])');
  await page.tap('label.opt:has(input[name="zone"][value="antebrazo"])');
  await page.tap('label.opt:has(input[name="size"][value="mediano"])');
  const ref = path.join(SHOTS, 'rosa_de_los_vientos.jpg');   // nombre de archivo como el de un cliente
  fs.copyFileSync(REF, ref);
  await page.setInputFiles('#q-photo', ref);
  await page.waitForTimeout(2200);
  await scrollTo('.q-step[data-field="photo"]', 110);   // el paso 05 entero, debajo del encabezado fijo
  await shot('03_cotiza');

  await scrollTo('#cuidados', 8);                      // titulo y los tres pasos completos
  await shot('04_cuidados');
  await scrollTo('#visitanos', 64);
  await shot('05_visitanos');

  await page.evaluate(() => scrollTo(0, 0));
  await settle(400);
  await page.tap('.lang-btn[data-lang="en"]');
  await page.waitForTimeout(1200);
  await shot('06_ingles');
  await ctx.close();
  if (errs.length) console.log('errores de la pagina:', JSON.stringify(errs, null, 1));
}

const ICONS = `
<svg width="17" height="11" viewBox="0 0 17 11" fill="#fff"><rect x="0" y="7" width="3" height="4" rx=".8"/><rect x="4.6" y="5" width="3" height="6" rx=".8"/><rect x="9.2" y="2.6" width="3" height="8.4" rx=".8"/><rect x="13.8" y="0" width="3" height="11" rx=".8"/></svg>
<svg width="15" height="11" viewBox="0 0 15 11" fill="#fff"><path d="M7.5 2.1c2.2 0 4.1.8 5.6 2.2l1.2-1.2C12.5 1.4 10.1.4 7.5.4S2.5 1.4.7 3.1l1.2 1.2c1.5-1.4 3.4-2.2 5.6-2.2zm0 3.3c1.3 0 2.4.5 3.3 1.2l1.2-1.2c-1.2-1.1-2.8-1.7-4.5-1.7S4.2 4.3 3 5.4l1.2 1.2c.9-.8 2-1.2 3.3-1.2zm0 3.3c.5 0 .9.2 1.2.5L7.5 10.5 6.3 9.2c.3-.3.7-.5 1.2-.5z"/></svg>
<svg width="26" height="12" viewBox="0 0 26 12"><rect x=".5" y=".5" width="22" height="11" rx="3.3" fill="none" stroke="#fff" stroke-opacity=".45"/><rect x="2" y="2" width="19" height="8" rx="2" fill="#fff"/><path d="M24 4.1v3.8c.8-.3 1.3-1 1.3-1.9S24.8 4.4 24 4.1z" fill="#fff" fill-opacity=".45"/></svg>`;

function phone(s) {
  return `<div class="phone"><div class="dev">
    <i class="key l1"></i><i class="key l2"></i><i class="key l3"></i><i class="key r1"></i>
    <div class="bezel"><div class="scr">
      <img class="ui" src="/video/build/cliente/${s.file}.png" alt="">
      <div class="status"><span class="time">11:55</span><span class="icons">${ICONS}</span></div>
      <div class="island"></div>
      <div class="home ${s.home || ''}"></div>
      <div class="glare"></div>
    </div></div>
  </div></div>`;
}

function boardHtml() {
  const cells = SCREENS.map((s, i) => `<div class="cell">${phone(s)}
    <div class="label"><b>${String(i + 1).padStart(2, '0')}</b><strong>${s.title}</strong><span>${s.desc}</span></div></div>`).join('');
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><style>
@font-face{font-family:BSD;src:url(/site/fonts/big-shoulders-display-latin-900-normal.woff2);font-weight:900}
@font-face{font-family:Barlow;src:url(/site/fonts/barlow-latin-400-normal.woff2);font-weight:400}
@font-face{font-family:Barlow;src:url(/site/fonts/barlow-latin-600-normal.woff2);font-weight:600}
@font-face{font-family:Barlow;src:url(/site/fonts/barlow-latin-700-normal.woff2);font-weight:700}
@font-face{font-family:InterSB;src:url(/video/compositor/vendor/Inter-SemiBold.otf)}
:root{--bg:#161616;--hueso:#EDEAE6;--plata:#C9C9C9;--gris:#9C9C9C;--rojo:#A3201B}
*{box-sizing:border-box;margin:0}
html,body{width:${W}px;height:${H}px;background:var(--bg);overflow:hidden}
body{position:relative;font-family:Barlow;color:var(--hueso);padding:84px 54px 0}
.bg{position:absolute;inset:0;background:radial-gradient(1100px 820px at 50% -4%,#262626 0%,rgba(22,22,22,0) 72%),radial-gradient(1000px 700px at 50% 104%,#1f1f1f 0%,rgba(22,22,22,0) 70%)}
.noise{position:absolute;inset:0;opacity:.045;background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='260' height='260'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 1 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>")}
header,.grid,footer{position:relative}
.over{font:600 21px/1.2 Barlow;letter-spacing:.2em;text-transform:uppercase;color:var(--plata)}
h1{font:900 110px/.95 BSD;text-transform:uppercase;margin-top:20px;white-space:nowrap;letter-spacing:.004em}
h1 .ink{position:relative;display:inline-block}
h1 .ink svg{position:absolute;left:-8px;bottom:-15px;width:calc(100% + 16px);height:28px;overflow:visible}
.sub{font:400 25px/1.45 Barlow;color:var(--plata);margin-top:34px;max-width:940px}
.grid{display:grid;grid-template-columns:repeat(3,300px);column-gap:36px;row-gap:54px;margin-top:58px}
.phone{width:300px;height:626.6px;position:relative}
.dev{position:absolute;left:0;top:0;width:417px;height:871px;transform:scale(.719424);transform-origin:0 0;border-radius:61px;padding:3px;
  background:linear-gradient(150deg,#e6e6e6 0%,#8f8f8f 13%,#3a3a3a 33%,#767676 55%,#2b2b2b 77%,#a3a3a3 100%);
  box-shadow:0 40px 80px rgba(0,0,0,.62),0 12px 26px rgba(0,0,0,.5)}
.key{position:absolute;width:5px;border-radius:2px;background:linear-gradient(90deg,#3d3d3d,#a9a9a9 55%,#555)}
.key.l1{left:-3px;top:150px;height:42px}.key.l2{left:-3px;top:222px;height:72px}.key.l3{left:-3px;top:308px;height:72px}.key.r1{right:-3px;top:252px;height:112px}
.bezel{position:relative;width:411px;height:865px;border-radius:58px;background:#050505;padding:10.5px}
.scr{position:relative;width:390px;height:844px;border-radius:47.33px;overflow:hidden;background:#111;isolation:isolate}
.ui{display:block;width:390px;height:844px}
.status{position:absolute;left:0;top:0;width:390px;height:47px;color:#fff}
.time{position:absolute;left:14px;width:104px;top:17px;text-align:center;font:17px/1 InterSB;letter-spacing:-.01em}
.icons{position:absolute;right:27px;top:18px;display:flex;gap:5px;align-items:center}
.island{position:absolute;left:132.5px;top:11px;width:125px;height:37px;border-radius:18.5px;background:#000}
.home{position:absolute;left:128px;bottom:8px;width:134px;height:5px;border-radius:3px;background:rgba(255,255,255,.88)}
.home.dark{background:rgba(0,0,0,.82)}
.glare{position:absolute;inset:0;background:linear-gradient(118deg,rgba(255,255,255,.085) 0%,rgba(255,255,255,.02) 28%,rgba(255,255,255,0) 42%)}
.label{margin-top:24px;display:grid;grid-template-columns:auto 1fr;column-gap:10px;row-gap:5px;align-items:baseline}
.label b{font:900 27px/1 BSD;color:var(--rojo)}
.label strong{font:600 23px/1.15 Barlow}
.label span{grid-column:2;font:400 19px/1.4 Barlow;color:var(--gris)}
footer{margin-top:60px;text-align:center}
.note{font:400 19px/1.4 Barlow;color:var(--gris)}
.sig{margin-top:22px;font:700 22px/1 Barlow;letter-spacing:.22em;text-transform:uppercase}
.legal{margin-top:12px;font:400 17px/1.4 Barlow;color:#8A8A8A}
</style></head><body><div class="bg"></div><div class="noise"></div>
<header>
  <p class="over">Propuesta para Siniestro Tattoo Studio</p>
  <h1>Así se vería <span class="ink">tu página<svg viewBox="0 0 400 28" preserveAspectRatio="none" aria-hidden="true">
    <path d="M4 17 C 92 8, 214 22, 396 9" stroke="#C9C9C9" stroke-width="11" stroke-linecap="round" fill="none" opacity=".92" vector-effect="non-scaling-stroke"/>
    <path d="M4 17 C 92 8, 214 22, 396 9" stroke="#0b0b0b" stroke-width="6.5" stroke-linecap="round" fill="none" vector-effect="non-scaling-stroke"/>
    <path d="M70 13 C 160 9.5, 250 15, 372 10" stroke="#fff" stroke-opacity=".35" stroke-width="1.6" stroke-linecap="round" fill="none" vector-effect="non-scaling-stroke"/>
  </svg></span></h1>
  <p class="sub">Una sola página, pensada para el celular: tu trabajo por estilo, cotizaciones directo a tu WhatsApp, cuidados y cómo llegar. En español y en inglés.</p>
</header>
<div class="grid">${cells}</div>
<footer>
  <p class="note">Los espacios de horario y precios se llenan con tu información.</p>
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
      let s = 110; h.style.fontSize = s + 'px';
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
