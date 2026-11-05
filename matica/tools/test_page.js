// Pruebas de la página de Matíca: datos contra el menú impreso, interacciones y textos.
// Lee lo que SE VE en pantalla (DOM), no los datos internos de la página.
// Uso: (cd matica/site && python3 -m http.server 8124) & node matica/tools/test_page.js
const { chromium } = require('playwright');

const BASE = process.env.BASE || 'http://127.0.0.1:8124/';

// Transcripción independiente de assets/menu_referencia.jpg (❄ frío, 🔥 caliente).
// Correcciones pedidas por Salvador: "Cholocate" -> "Chocolate".
const MENU = {
  cafe: [
    ['Espresso', { hot: 45 }], ['Americano', { cold: 50, hot: 45 }], ['Cappuchino', { cold: 65, hot: 60 }],
    ['Latte', { cold: 65, hot: 60 }], ['Mocha', { cold: 65, hot: 60 }], ['Flat White', { hot: 60 }],
    ['Cold brew', { cold: 80 }], ['Affogato', { cold: 70 }], ['Frappé', { base: 80 }],
  ],
  especiales: [
    ['Cold brew tonic de sabor', { base: 85 }], ['Malteada de café', { base: 85 }], ['Mexi-Latte', { base: 80 }],
    ['Limonada de coco', { base: 80 }], ['Limonada de café', { base: 80 }], ['Tisana mineral o tónica', { base: 85 }],
    ['Filtrados', { base: 75 }],
  ],
  otras: [['Chocolate', { cold: 65, hot: 60 }], ['Chai', { cold: 75, hot: 70 }], ['Tisana', { cold: 75, hot: 70 }], ['Matcha', { cold: 75, hot: 70 }]],
  waffles: [
    ['Huevo y aguacate', { base: 90 }, ['Vegetariano', 'Sin gluten']],
    ['Jamón serrano y matícas', { base: 95 }, ['Sin gluten']],
    ['Nevado con mermelada', { base: 75 }, ['Vegetariano', 'Sin gluten']],
  ],
  otros: [
    ['Matíca Sandwich', { base: 90 }], ['Matíca Arepa', { base: 90 }, ['Sin gluten']], ['Pan del día', { base: 40 }],
    ['Galleta New York', { base: 50 }], ['Pandebono', { base: 35 }, ['Sin gluten']],
  ],
};
const EXTRAS = [['Leche vegetal', 10], ['Jarabe de sabor', 10], ['Extra shot de espresso', 20]];
const DESCS = {
  'Cold brew tonic de sabor': 'Puede ser de piloncillo, maracuyá, o naranja lavanda',
  'Malteada de café': 'Helado + espresso doble',
  'Mexi-Latte': 'Jarabe de agave, cacao nibs y canela',
  'Limonada de coco': 'Puedes adicionar un shot de espresso +$20',
  'Filtrados': 'Métodos Chemex, V60, prensa francesa o Aeropress',
  'Huevo y aguacate': 'Cremoso de aguacate, arúgula, huevo estrellado o revuelto y un toque de chili flakes. Nuestro propio avocado toast',
  'Jamón serrano y matícas': 'Jamón serrano, cremoso de aguacate, arúgula, tomate cherry y zanahoria encurtida. Aderezado con spicy honey',
  'Nevado con mermelada': 'Espolvoreado con azúcar glass, bañado con mermelada de temporada',
  'Matíca Sandwich': 'Jamón de pavo, cremoso de aguacate, zanahorias en conserva y queso suave',
  'Matíca Arepa': 'Lo mismo del sándwich, pero en lugar de ir en pan va sobre una arepa de maíz',
  'Pandebono': 'Tradicional pan colombiano',
};
const REVIEWS = [
  'Una experiencia maravillosa! El lugar es bellísimo, muy fresco y con una atmósfera súper agradable. La atención es de 10.',
  'Café delicioso, de calidad. Te dan una experiencia distinta y riquísima. Los waffles son deliciosos y de sabores únicos.',
  'Me gusta mucho el lugar porque es muy cómodo para platicar, el ambiente es acogedor. Se puede escoger algo de comer muy fácil y cualquier cosa está rica.',
  'Está súper rico! Es una comidita súper súper sabrosa.',
  'Este lugar es una verdadera joya en Aguascalientes.',
];

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) { pass++; } else { fail++; console.log('  ✗', msg); } };
const money = (n) => '$' + n;

async function newPage(browser, when) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, locale: 'es-MX', timezoneId: 'America/Mexico_City' });
  const page = await ctx.newPage();
  page._errors = [];
  page.on('pageerror', (e) => page._errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') page._errors.push(m.text()); });
  await page.clock.setFixedTime(new Date(when));
  await page.goto(BASE + '?capture=1', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.documentElement.dataset.ready === '1');
  return page;
}
const settle = (page, ms = 700) => page.waitForTimeout(ms);
const txt = (page, sel) => page.$eval(sel, (e) => e.textContent.replace(/\s+/g, ' ').trim());

(async () => {
  const browser = await chromium.launch();
  const page = await newPage(browser, '2026-11-05T10:40:00-06:00'); // jueves, abierto

  console.log('1) Menú contra el menú impreso');
  for (const [tab, items] of Object.entries(MENU)) {
    await page.evaluate((k) => window.matica.setTab(k, { animate: false }), tab);
    const shown = await page.$$eval(`#panel-${tab} .item`, (els) => els.map((e) => ({
      id: e.dataset.item,
      name: e.querySelector('.item-name').textContent.trim(),
      desc: (e.querySelector('.item-desc') || { textContent: '' }).textContent.trim(),
      price: e.querySelector('[data-price-for]').textContent.trim(),
      temps: [...e.querySelectorAll('.temp button')].map((b) => b.dataset.temp),
      tag: (e.querySelector('.temp-tag') || { textContent: '' }).textContent.trim(),
      diet: [...e.querySelectorAll('.diet li')].map((l) => l.textContent.trim()),
    })));
    ok(shown.length === items.length, `${tab}: ${shown.length} productos, esperaba ${items.length}`);
    for (let i = 0; i < items.length; i++) {
      const [name, p, diet = []] = items[i];
      const s = shown[i] || {};
      ok(s.name === name, `${tab}[${i}] nombre "${s.name}" ≠ "${name}"`);
      if (DESCS[name]) ok(s.desc === DESCS[name], `${name}: descripción "${s.desc}"`);
      ok(JSON.stringify(s.diet) === JSON.stringify(diet), `${name}: íconos ${JSON.stringify(s.diet)} ≠ ${JSON.stringify(diet)}`);
      if (p.cold != null && p.hot != null) {
        ok(s.temps.join() === 'cold,hot', `${name}: selector Frío/Caliente`);
        ok(s.price === money(p.hot), `${name}: caliente por defecto ${s.price} ≠ ${money(p.hot)}`);
        await page.evaluate((id) => window.matica.setTemp(id, 'cold', { animate: false }), s.id);
        ok(await txt(page, `#item-${s.id} [data-price-for]`) === money(p.cold), `${name}: frío ≠ ${money(p.cold)}`);
        await page.evaluate((id) => window.matica.setTemp(id, 'hot', { animate: false }), s.id);
        ok(await txt(page, `#item-${s.id} [data-price-for]`) === money(p.hot), `${name}: regresa a caliente`);
      } else {
        const v = p.base ?? p.hot ?? p.cold;
        ok(s.price === money(v), `${name}: precio ${s.price} ≠ ${money(v)}`);
        ok(s.temps.length === 0, `${name}: no debe tener selector`);
        const want = p.hot != null ? 'Caliente' : p.cold != null ? 'Frío' : '';
        ok(s.tag === want, `${name}: etiqueta de temperatura "${s.tag}" ≠ "${want}"`);
      }
    }
  }
  const extras = await page.$$eval('#extras-list li', (els) => els.map((e) => e.textContent.replace(/\s+/g, ' ').trim()));
  ok(JSON.stringify(extras) === JSON.stringify(EXTRAS.map(([n, v]) => n + money(v))), `Adicionales: ${JSON.stringify(extras)}`);

  console.log('2) Pestañas');
  for (const k of Object.keys(MENU)) {
    await page.tap(`#tab-${k}`);
    await settle(page, 500);
    const vis = await page.$$eval('.panel', (ps) => ps.filter((p) => !p.hidden).map((p) => p.id));
    ok(vis.length === 1 && vis[0] === `panel-${k}`, `pestaña ${k}: paneles visibles ${vis}`);
    ok(await page.$eval(`#tab-${k}`, (t) => t.getAttribute('aria-selected')) === 'true', `pestaña ${k}: aria-selected`);
    const [ix, tx] = await page.evaluate((key) => {
      const ind = document.querySelector('#tab-ind').getBoundingClientRect(), t = document.querySelector('#tab-' + key).getBoundingClientRect();
      return [Math.round(ind.left), Math.round(t.left)];
    }, k);
    ok(Math.abs(ix - tx) <= 1, `indicador sobre ${k} (${ix} vs ${tx})`);
  }

  console.log('3) Selector con conteo (Latte Caliente $60 -> Frío $65)');
  await page.tap('#tab-cafe'); await settle(page, 400);
  await page.evaluate(() => { const el = document.querySelector('#item-latte'); scrollTo(0, el.getBoundingClientRect().top + scrollY - 300); });
  await settle(page, 200);
  await page.tap('#item-latte [data-temp="cold"]');
  await settle(page, 700);
  ok(await txt(page, '#item-latte [data-price-for]') === '$65', 'Latte frío $65');
  const photoOn = await page.$$eval('#item-latte [data-ph-temp]', (is) => is.filter((i) => !i.classList.contains('is-off')).map((i) => i.dataset.phTemp));
  ok(photoOn.join() === 'cold', `foto del latte frío visible (${photoOn})`);
  const thumb = await page.evaluate(() => {
    const g = document.querySelector('#item-latte .temp'), th = g.querySelector('.temp-thumb').getBoundingClientRect(), b = g.querySelector('[data-temp="cold"]').getBoundingClientRect();
    return Math.abs(th.left - b.left) + Math.abs(th.width - b.width);
  });
  ok(thumb < 1.5, `el pulgar del selector cubre "Frío" (desvío ${thumb.toFixed(2)} px)`);
  await page.tap('#item-latte [data-temp="hot"]'); await settle(page, 600);

  console.log('4) Pedido: $85 + $95 = $180');
  await page.evaluate(() => window.matica.clearCart());
  await page.tap('#tab-waffles'); await settle(page, 400);
  await page.tap('#item-jamon-serrano .item-open'); await settle(page, 700);
  ok(await page.$eval('#sheet-item', (s) => s.classList.contains('is-open')), 'ficha abierta al tocar la tarjeta');
  ok(await txt(page, '#si-name') === 'Jamón serrano y matícas', 'ficha: nombre');
  ok(await txt(page, '#si-total') === '$95', 'ficha: total $95');
  await page.tap('#si-add'); await settle(page, 800);
  ok(await page.$eval('#sheet-item', (s) => !s.classList.contains('is-open')), 'la ficha se cierra al agregar');
  await page.tap('#tab-especiales'); await settle(page, 400);
  await page.tap('#item-cold-brew-tonic [data-add]'); await settle(page, 700); // tiene sabores: abre ficha
  ok(await page.$eval('#sheet-item', (s) => s.classList.contains('is-open')), '+ en producto con opciones abre la ficha');
  ok(await page.$eval('[data-opt][aria-checked="true"]', (b) => b.textContent.trim()) === 'Piloncillo', 'sabor por defecto: Piloncillo');
  await page.tap('#si-add'); await settle(page, 900);
  ok(await txt(page, '#cb-total') === '$180', `barra: total ${await txt(page, '#cb-total')}`);
  ok(await txt(page, '#cb-n') === '2', 'barra: 2 artículos');
  ok(await txt(page, '#bag-n') === '2', 'bolsa del encabezado: 2');
  await page.tap('#cartbar'); await settle(page, 700);
  ok(await txt(page, '#sc-total') === '$180', 'hoja de pedido: total $180');
  ok(await page.$('#exit-pickup') && await page.$('#exit-rappi'), 'dos salidas: recoger y Rappi');
  ok((await txt(page, '#exit-pickup')).includes('Tu WhatsApp aquí'), 'marcador "Tu WhatsApp aquí"');
  ok(!(await page.$('#exit-rappi img')), 'Rappi sin logo (solo texto)');
  const msg = await page.evaluate(() => window.matica.buildMessage());
  ok(msg.includes('1 × Jamón serrano y matícas (Waffle de yuca) — $95') && msg.includes('1 × Cold brew tonic de sabor (Piloncillo) — $85') && msg.endsWith('Total: $180'), 'mensaje de WhatsApp:\n' + msg);

  console.log('5) Cantidades y quitar');
  await page.tap('.line:first-child [data-lq="1"]'); await settle(page, 300);
  ok(await txt(page, '#sc-total') === '$275', `2 × $95 + $85 = $275 (${await txt(page, '#sc-total')})`);
  await page.tap('.line:first-child [data-lq="-1"]'); await settle(page, 300);
  ok(await txt(page, '#sc-total') === '$180', 'regresa a $180');
  await page.tap('.line:first-child [data-lq="-1"]'); await settle(page, 300);
  ok(await txt(page, '#sc-total') === '$85', 'quitar el waffle: $85');
  await page.evaluate(() => window.matica.closeSheet({ instant: true }));

  console.log('6) Adicionales y temperatura en la ficha');
  await page.evaluate(() => window.matica.clearCart());
  await page.evaluate(() => window.matica.openItem('latte')); await settle(page, 600);
  await page.tap('#si-body [data-temp="cold"]'); await settle(page, 500);
  ok(await txt(page, '#si-total') === '$65', 'ficha latte frío $65');
  await page.click('#si-body [data-addon="leche-vegetal"] + .box'); await settle(page, 450);
  ok(await txt(page, '#si-total') === '$75', 'latte frío + leche vegetal = $75');
  await page.click('#si-body [data-addon="extra-shot"] + .box'); await settle(page, 450);
  ok(await txt(page, '#si-total') === '$95', '+ extra shot = $95');
  await page.tap('#si-qty [data-q="1"]'); await settle(page, 450);
  ok(await txt(page, '#si-total') === '$190', '× 2 = $190');
  await page.tap('#si-add'); await settle(page, 900);
  ok(await page.evaluate(() => window.matica.total) === 190, 'pedido: $190');
  const det = await page.evaluate(() => window.matica.buildMessage());
  ok(det.includes('2 × Latte (Frío · + Leche vegetal · + Extra shot de espresso) — $190'), 'detalle del latte en el mensaje:\n' + det);
  await page.evaluate(() => window.matica.addToCart({ id: 'cold-brew-tonic', opt: 'Maracuyá' }));
  await page.evaluate(() => window.matica.addToCart({ id: 'cold-brew-tonic', opt: 'Piloncillo' }));
  await page.evaluate(() => window.matica.addToCart({ id: 'cold-brew-tonic', opt: 'Piloncillo' }));
  const lines = await page.evaluate(() => window.matica.cart.map((l) => `${l.id}:${l.opt || ''}:${l.qty}`));
  ok(lines.includes('cold-brew-tonic:Maracuyá:1') && lines.includes('cold-brew-tonic:Piloncillo:2'), `sabores en líneas separadas ${lines}`);
  ok(await page.evaluate(() => window.matica.total) === 190 + 85 * 3, 'total con 3 cold brew tonic');
  await page.evaluate(() => window.matica.addToCart({ id: 'limonada-coco', addons: ['shot'] }));
  ok(await page.evaluate(() => window.matica.total) === 190 + 255 + 100, 'limonada de coco + shot = $100');

  console.log('7) Pedido vacío');
  await page.evaluate(() => { window.matica.clearCart(); window.matica.openCart(); }); await settle(page, 600);
  ok((await txt(page, '#sc-body')).includes('Tu pedido está vacío'), 'estado vacío');
  ok(await page.$eval('#cartbar', (b) => !b.classList.contains('is-on')), 'barra oculta sin productos');
  await page.evaluate(() => window.matica.closeSheet({ instant: true }));

  console.log('8) Textos: reseñas, horario, ortografía');
  const revs = await page.$$eval('.rev blockquote', (b) => b.map((x) => x.textContent.trim().replace(/^“|”$/g, '')));
  ok(JSON.stringify(revs) === JSON.stringify(REVIEWS), 'reseñas exactas');
  const sig = await page.$$eval('.rev figcaption', (b) => [...new Set(b.map((x) => x.textContent.trim()))]);
  ok(sig.join() === 'Reseña en Google', 'firma "Reseña en Google" sin nombres');
  ok((await page.$$('.rev img')).length === 0, 'reseñas sin fotos de personas');
  const hours = await page.$$eval('#hours-list .row', (r) => r.map((x) => [x.querySelector('dt').firstChild.textContent.trim(), x.querySelector('dd').textContent.trim()].join(' | ')));
  ok(JSON.stringify(hours) === JSON.stringify(['Lunes a viernes | 8:00 – 20:00', 'Sábado | 9:00 – 14:00']), `horario ${JSON.stringify(hours)}`);
  ok(await txt(page, '#hours-list .row.is-today dt .today') === 'Hoy', 'jueves: "Hoy" en lunes a viernes');
  ok(await txt(page, '#status') === 'Abierto ahora', 'jueves 10:40: abierto');
  const bodyText = await page.evaluate(() => document.body.innerText);
  ok(!/domingo/i.test(bodyText), 'no se menciona el domingo');
  ok(!/\bMatica\b/.test(bodyText), 'Matíca siempre con acento en el texto visible');
  ok(!/Cholocate|arrugula|arrúgala|Presa francesa/i.test(bodyText), 'sin las erratas del menú impreso');
  ok(bodyText.includes('Demo de cortesía de Elevate Negocios · pieza no oficial'), 'línea de demo en el pie');
  ok(!/\b\d{3}[ -]?\d{3}[ -]?\d{4}\b/.test(bodyText), 'sin números de teléfono');
  ok(!/4\.9|116/.test(bodyText), 'sin calificación ni número de reseñas');
  const imgs = await page.$$eval('img', (is) => [...new Set(is.map((i) => i.getAttribute('src')))]);
  ok(imgs.every((s) => /^img\/[\w-]+\.(webp|png)$/.test(s)), `imágenes solo locales: ${imgs}`);
  ok(page._errors.length === 0, 'consola sin errores: ' + page._errors.join(' | '));

  console.log('9) Horario en otros días');
  const sat = await newPage(browser, '2026-11-07T15:10:00-06:00');
  ok(await txt(sat, '#status') === 'Cerrado ahora', 'sábado 15:10: cerrado');
  ok((await txt(sat, '#hours-list .row.is-today dt')).startsWith('Sábado'), 'sábado marcado como hoy');
  const sun = await newPage(browser, '2026-11-08T11:00:00-06:00');
  ok(await txt(sun, '#status') === '', 'domingo: no se afirma nada');
  ok((await sun.$$('#hours-list .row.is-today')).length === 0, 'domingo: ninguna fila marcada');

  console.log(`\n${pass} pruebas bien, ${fail} fallas`);
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
