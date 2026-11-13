// Fotos sueltas de la interfaz para el cliente (Patissier): una imagen vertical por pantalla real de la pagina,
// dentro del mismo celular de la lamina, con una etiqueta corta y la leyenda de demo.
// Uso (desde patissier/): node tools/client_board.js  &&  node tools/client_photos.js
//   Lee las capturas reales de build/cliente/*.png y el estilo de build/cliente/lamina.html (los genera client_board.js).
//   Sale: video/out/fotos_interfaz/patissier_0N_<pantalla>.jpg  (1620x2880)
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SHOTS = path.join(ROOT, 'build/cliente');
const OUT = path.join(ROOT, 'video/out/fotos_interfaz');
const W = 1080, H = 1920, DPR = 1.5;

// mismas pantallas y textos que la lamina (cada etiqueta describe algo que la pagina de verdad hace)
const SCREENS = [
  { file: '01_portada', title: 'Portada', desc: 'Tu logo, tus 20 años y tus pasteles, con tu 4.8 en Google y una reseña real.' },
  { file: '02_galeria', title: 'Galería', desc: 'Tus pasteles, con tus propias fotos.' },
  { file: '03_pedido', title: 'Tu pedido', desc: 'Sabor y tamaño por personas; WhatsApp se abre con el pedido ya escrito.' },
  { file: '04_tambien', title: 'Para acompañar', desc: 'Minicakes, postres, servicio a domicilio, Instagram y llamada.' },
];

const MIME = { '.html': 'text/html; charset=utf-8', '.png': 'image/png', '.woff2': 'font/woff2' };
function serve() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
      if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      fs.createReadStream(f).pipe(res);
    });
    srv.listen(0, '127.0.0.1', () => resolve(srv));
  });
}

const board = fs.readFileSync(path.join(SHOTS, 'lamina.html'), 'utf8');
const CSS = board.match(/<style>([\s\S]*?)<\/style>/)[1];
const PHONE = (file) => board.match(/<div class="phone">[\s\S]*?<div class="glare"><\/div>\s*<\/div><\/div>\s*<\/div><\/div>/)[0]
  .replace(/\/build\/cliente\/[^"]+\.png/, `/build/cliente/${file}.png`)
  .replace('<div class="topfade"></div>', '<div class="topfade"></div><div class="botfade"></div>');

function photoHtml(s, i) {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><style>${CSS}
html,body{width:${W}px;height:${H}px}
body{padding:84px 64px 0;display:flex;flex-direction:column;align-items:center}
header{width:100%;text-align:center}
h2{font:800 66px/1.1 Merienda;margin-top:16px}
h2 b{color:var(--rojo);margin-right:14px}
.desc{font:400 28px/1.4 DMSans;color:var(--plata);margin:18px auto 0;max-width:860px;min-height:78.4px}
.topfade{height:78px;background:linear-gradient(180deg,rgba(14,10,8,1) 0%,rgba(14,10,8,.97) 62%,rgba(14,10,8,0) 100%)}
.botfade{position:absolute;left:0;bottom:0;width:390px;height:46px;background:linear-gradient(0deg,rgba(14,10,8,.92) 0%,rgba(14,10,8,.55) 55%,rgba(14,10,8,0) 100%)}
.phone{width:661px;height:1380px;margin-top:44px;position:relative}
.dev{transform:scale(1.58507)}
footer{margin-top:48px}
</style></head><body><div class="bg"></div><div class="noise"></div>
<header>
  <p class="over">Así se vería tu página · Patissier</p>
  <h2><b>${String(i + 1).padStart(2, '0')}</b>${s.title}</h2>
  <p class="desc">${s.desc}</p>
</header>
${PHONE(s.file)}
<footer><p class="legal">Demo de cortesía de Elevate Negocios · pieza no oficial</p></footer>
</body></html>`;
}

(async () => {
  const srv = await serve();
  const base = 'http://127.0.0.1:' + srv.address().port;
  const browser = await chromium.launch();
  fs.mkdirSync(OUT, { recursive: true });
  try {
    const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: DPR });
    const page = await ctx.newPage();
    for (const [i, s] of SCREENS.entries()) {
      const html = path.join(SHOTS, `foto_${s.file}.html`);
      fs.writeFileSync(html, photoHtml(s, i));
      await page.goto(base + '/build/cliente/' + path.basename(html), { waitUntil: 'networkidle' });
      await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map((im) => im.decode())); });
      const bottom = await page.evaluate(() => Math.round(document.querySelector('footer').getBoundingClientRect().bottom));
      const out = path.join(OUT, `patissier_${s.file}.jpg`);
      await page.screenshot({ path: out, type: 'jpeg', quality: 92 });
      console.log(out, '· pie termina en', bottom, 'de', H, bottom > H - 40 ? 'AVISO: muy cerca del borde' : '');
    }
  } finally {
    await browser.close();
    srv.close();
  }
})();
