// Capturas de revision de la pagina en vista de celular (390x844).
// Uso: node tools/shoot_review.js <outDir> [dpr]
const { chromium } = require('playwright');
const path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:8123/';
const OUT = process.argv[2];
const DPR = Number(process.argv[3] || 1);
const REF = path.resolve(__dirname, '../assets/demo_referencia_cliente_boceto.jpg');

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: DPR, isMobile: true, hasTouch: true,
    locale: 'es-MX', timezoneId: 'America/Mexico_City',
  });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  await page.goto(BASE + '?capture=1', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.documentElement.dataset.ready === '1' && document.fonts.status === 'loaded');
  await page.waitForTimeout(1500);
  const shot = async (name) => { await page.waitForTimeout(150); await page.screenshot({ path: path.join(OUT, name + '.png') }); console.log('shot', name); };
  const scrollTo = async (sel, offset = 0) => {
    await page.evaluate(([s, o]) => { const el = document.querySelector(s); const y = el.getBoundingClientRect().top + scrollY - o; scrollTo(0, y); }, [sel, offset]);
    await page.waitForTimeout(700);
  };

  await shot('01_portada');
  await scrollTo('#portafolio', 40);
  await shot('02_galeria');
  await page.tap('[data-filter="realismo"]');
  await page.waitForTimeout(900);
  await shot('03_filtro_realismo');
  await page.tap('[data-filter="color"]');
  await page.waitForTimeout(900);
  await shot('04_filtro_color');
  await page.tap('[data-filter="todo"]');
  await page.waitForTimeout(900);
  await scrollTo('#grid', 120);
  await shot('05_galeria_todo_scroll');
  await page.tap('[data-open="cristo"]');
  await page.waitForTimeout(600);
  await shot('06_visor');
  await page.tap('#lb-close');
  await page.waitForTimeout(300);

  await scrollTo('#cotiza', 70);
  await shot('07_cotiza_vacio');
  await page.tap('#q-submit');
  await page.waitForTimeout(900);
  await shot('08_cotiza_errores');
  await page.fill('#q-idea', 'Una rosa de los vientos con sombras, estilo realista');
  await page.tap('label.opt:has(input[name="style"][value="realismo"])');
  await page.tap('label.opt:has(input[name="zone"][value="antebrazo"])');
  await page.tap('label.opt:has(input[name="size"][value="mediano"])');
  await scrollTo('.q-step[data-field="size"]', 70);
  await page.setInputFiles('#q-photo', REF);
  await page.waitForTimeout(420);
  await page.screenshot({ path: path.join(OUT, '09_cotiza_subiendo_foto.png') }); console.log('shot 09');
  await page.waitForTimeout(1400);
  await page.fill('#q-name', 'Ana');
  await scrollTo('.q-step[data-field="photo"]', 70);
  await shot('10_cotiza_lleno');
  await page.tap('#q-submit');
  await page.waitForTimeout(800);
  await shot('11_cotiza_enviado');

  await scrollTo('#cuidados', 64);
  await shot('12_cuidados');
  await scrollTo('#visitanos', 64);
  await shot('13_visitanos');
  await page.evaluate(() => scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(500);
  await shot('14_pie');

  // Ingles
  await page.evaluate(() => scrollTo(0, 0));
  await page.waitForTimeout(400);
  await page.tap('.lang-btn[data-lang="en"]');
  await page.waitForTimeout(1200);
  await shot('15_en_portada');
  await scrollTo('#portafolio', 40);
  await shot('16_en_galeria');
  await scrollTo('.q-step[data-field="photo"]', 70);
  await shot('17_en_cotiza');
  await scrollTo('#cuidados', 64);
  await shot('18_en_cuidados');

  // Pagina completa en ES y EN para vista general
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({ path: path.join(OUT, '90_full_en.png'), fullPage: true });
  await page.tap('.lang-btn[data-lang="es"]');
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(OUT, '91_full_es.png'), fullPage: true });

  // Overflow horizontal y textos que se salen
  const issues = await page.evaluate(() => {
    const out = [];
    const W = document.documentElement.clientWidth;
    if (document.documentElement.scrollWidth > W) out.push('scrollWidth ' + document.documentElement.scrollWidth + ' > ' + W);
    document.querySelectorAll('h1,h2,h3,p,span,a,button,label,strong').forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width && (r.right > W + 0.5 || r.left < -0.5) && !el.closest('.filters-track') && !el.closest('dialog')) out.push(`${el.tagName}.${el.className} "${(el.textContent || '').trim().slice(0, 40)}" ${Math.round(r.left)}-${Math.round(r.right)}`);
    });
    return out.slice(0, 30);
  });
  console.log('ISSUES', JSON.stringify(issues, null, 1));
  for (const [w, h, tag] of [[768, 1024, 'tablet'], [1440, 900, 'desktop']]) {
    const c2 = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
    const p2 = await c2.newPage();
    await p2.goto(BASE + '?capture=1', { waitUntil: 'networkidle' });
    await p2.waitForFunction(() => document.documentElement.dataset.ready === '1' && document.fonts.status === 'loaded');
    await p2.waitForTimeout(1300);
    await p2.screenshot({ path: path.join(OUT, `95_${tag}_full.png`), fullPage: true });
    const ov = await p2.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    console.log(tag, 'overflow px', ov);
    await c2.close();
  }
  console.log('ERRORS', JSON.stringify(errs, null, 1));
  await browser.close();
})();
