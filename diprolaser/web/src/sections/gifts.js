// Regalos para tus clientes: caja que se abre con el scroll, tabs, carrusel 3D, recolor de vasos y cintas
// y el logo (del visitante, de DIPROLASER o un nombre de ejemplo) grabado a láser en plata.
import meta from '../data/promo-meta.json';
import { messages, setWa } from '../lib/whatsapp.js';
import { state, on, reducedMotion } from '../lib/state.js';
import { radioGroup, tabs, haptic, tick } from '../lib/ui.js';

const COLORS = {
  azul: ['Azul', '#1d46b4'], olivo: ['Verde olivo', '#59612a'], rosa: ['Rosa', '#e7b9cf'], negro: ['Negro', '#18181b'],
  blanco: ['Blanco', '#eeeeea'], crema: ['Crema', '#e6d8bf'], rojo: ['Rojo', '#c81e28'], camel: ['Camel', '#b8764e'],
};
const CUP_COLORS = ['azul', 'olivo', 'rosa', 'negro', 'blanco', 'rojo', 'crema'];
const KEY_COLORS = ['rojo', 'azul', 'negro', 'olivo', 'camel', 'rosa'];
// Placa metálica de los llaveros de cinta (coordenadas en la imagen x4)
const PLATES = { llavero_cinta_azul: [735, 70, 965, 310], llavero_cinta_roja: [335, 110, 560, 380] };

const P = (file, name, plural, base, opts = {}) => ({ file, name, plural, base, ...opts });
const TABS = {
  vasos: [
    P('vaso_azul_1', 'Vaso térmico con tapa', 'Vasos térmicos', 'azul', { colors: CUP_COLORS, engrave: 'cyl' }),
    P('vaso_verde_2', 'Vaso recto con tapa', 'Vasos rectos con tapa', 'olivo', { colors: CUP_COLORS, engrave: 'cyl' }),
    P('vaso_rosa_2', 'Vaso recto con tapa', 'Vasos rectos con tapa', 'rosa', { colors: CUP_COLORS, engrave: 'cyl' }),
    P('vaso_asa_blanco', 'Vaso con asa', 'Vasos con asa', 'blanco', { colors: CUP_COLORS, engrave: 'cyl' }),
    P('termo_negro_1', 'Termo con tapa', 'Termos', 'negro', { colors: CUP_COLORS, engrave: 'cyl' }),
    P('vaso_verde_1', 'Vaso recto', 'Vasos rectos', 'olivo', { colors: CUP_COLORS, engrave: 'cyl' }),
  ],
  llaveros: [
    P('llavero_cinta_roja', 'Llavero de cinta', 'Llaveros de cinta', 'rojo', { colors: KEY_COLORS, engrave: 'plate' }),
    P('llavero_cinta_azul', 'Llavero de cinta', 'Llaveros de cinta', 'azul', { colors: KEY_COLORS, engrave: 'plate' }),
    P('llavero_casco_luz_encendida', 'Llavero de casco con luz', 'Llaveros de casco con luz'),
    P('llavero_casco_amarillo', 'Llavero de casco', 'Llaveros de casco'),
    P('llavero_llanta', 'Llavero de llanta', 'Llaveros de llanta'),
    P('llavero_casco_blanco', 'Llavero de casco', 'Llaveros de casco'),
  ],
  sets: [
    P('set_regalo_pluma_tarjetero_navaja_llavero', 'Set de pluma, tarjetero, navaja y llavero', 'Sets de pluma, tarjetero, navaja y llavero'),
    P('estuche_plumas_abierto', 'Estuche de plumas', 'Estuches de plumas'),
  ],
  anforas: [
    P('anfora_negra_grabado_diprolaser', 'Ánfora grabada', 'Ánforas'),
    P('estuche_vip_grabado_diprolaser', 'Estuche grabado', 'Estuches grabados'),
  ],
};
const ALT = {
  anfora_negra_grabado_diprolaser: 'Ánfora negra con el logo de DIPROLASER grabado a láser',
  estuche_vip_grabado_diprolaser: 'Estuche negro con el logo de DIPROLASER grabado',
};
const slug = (f) => f.replace(/_/g, '-');
const src = (f, w = 800) => `img/promo/${slug(f)}-${w}.webp`;
const loadImg = (url) => new Promise((res, rej) => { const i = new Image(); i.decoding = 'async'; i.onload = () => res(i); i.onerror = rej; i.src = url; });

export async function initGifts({ aura } = {}) {
  const section = document.getElementById('regalos');
  const stage = section.querySelector('[data-ring-stage]');
  const nameEl = section.querySelector('[data-ring-name]');
  const colorsField = section.querySelector('[data-gift-colors-field]');
  const colorsEl = section.querySelector('[data-gift-colors]');
  const sampleEl = section.querySelector('[data-gift-sample]');
  const logoNote = section.querySelector('[data-gift-logo-note]');

  let tab = 'vasos', idx = 0, angle = 0, target = 0, color = null, sample = 'logo';
  let items = [];
  const cache = new Map(); // file -> { img, mask, data }

  /* ---------- marca a grabar: logo del visitante, de DIPROLASER o nombre de ejemplo ---------- */
  let dipro = null;
  async function brandMask() {
    if (sample === 'logo' && state.logo) return state.logo.mask;
    if (sample === 'logo') {
      if (!dipro) {
        const im = await loadImg('img/brand/logo-960.webp');
        const c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
        const x = c.getContext('2d'); x.drawImage(im, 0, 0);
        const d = x.getImageData(0, 0, c.width, c.height); const p = d.data;
        for (let i = 0; i < p.length; i += 4) { const a = p[i + 3] / 255; const k = Math.max(0, Math.min(1, (a - .42) / .25)); p[i] = p[i + 1] = p[i + 2] = 255; p[i + 3] = k * 255; }
        x.putImageData(d, 0, 0); dipro = c;
      }
      return dipro;
    }
    // nombre de ejemplo en dos líneas, grotesca condensada
    await document.fonts.load('900 100px Archivo').catch(() => {});
    const words = sample.split(' ');
    const mid = Math.ceil(words.length / 2);
    const lines = words.length > 1 ? [words.slice(0, mid).join(' '), words.slice(mid).join(' ')] : [sample];
    const c = document.createElement('canvas'); c.width = 900; c.height = 420;
    const x = c.getContext('2d'); x.fillStyle = '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle';
    lines.forEach((ln, i) => {
      let size = 170; x.font = `900 ${size}px Archivo`; x.fontStretch = 'condensed';
      const w = x.measureText(ln).width; if (w > 860) { size *= 860 / w; x.font = `900 ${size}px Archivo`; }
      x.fillText(ln, 450, lines.length === 1 ? 210 : 110 + i * 200);
    });
    x.fillRect(250, lines.length === 1 ? 330 : 395, 400, 6);
    return c;
  }

  /* ---------- recolor conservando luminancia y brillos ---------- */
  async function getBase(p) {
    if (cache.has(p.file)) return cache.get(p.file);
    const [img, mask] = await Promise.all([loadImg(src(p.file)), p.colors ? loadImg(`img/promo/${slug(p.file)}-mask.png`) : null]);
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0);
    const data = x.getImageData(0, 0, c.width, c.height);
    let m = null;
    if (mask) { x.clearRect(0, 0, c.width, c.height); x.drawImage(mask, 0, 0, c.width, c.height); m = x.getImageData(0, 0, c.width, c.height).data; }
    const entry = { img, data, m, w: c.width, h: c.height, scale: c.width / (meta[p.file]?.w || c.width) };
    cache.set(p.file, entry); return entry;
  }
  function recolor(e, p, hex) {
    const out = new ImageData(new Uint8ClampedArray(e.data.data), e.w, e.h);
    if (!e.m || !hex || hex === COLORS[p.base]?.[1]) return out;
    const t = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    const Lb = meta[p.file]?.lum || 120;
    const dark = Lb < 70; const gamma = dark ? .55 : 1;
    const d = out.data, m = e.m;
    for (let i = 0; i < d.length; i += 4) {
      const a = m[i] / 255; if (a < .01) continue;
      const L = .2126 * d[i] + .7152 * d[i + 1] + .0722 * d[i + 2];
      const r = Math.min(2.4, Math.pow((L + 6) / (Lb + 6), gamma));
      const hl = Math.max(0, (L - Lb * 1.35) / (255 - Lb * 1.35 + 1)) * (dark ? .55 : .8);
      for (let k = 0; k < 3; k++) {
        const v = t[k] * r * (1 - hl) + 255 * hl;
        d[i + k] = d[i + k] * (1 - a) + v * a;
      }
    }
    return out;
  }

  /* ---------- grabado láser en plata ---------- */
  function engrave(ctx, e, p, mark) {
    if (!p.engrave || !mark) return;
    const silver = (g) => { g.addColorStop(0, '#f4f6f8'); g.addColorStop(.5, '#b9bec6'); g.addColorStop(1, '#e3e6ea'); return g; };
    if (p.engrave === 'cyl') {
      const cy = meta[p.file]?.cyl; if (!cy) return;
      const s = e.scale; const cx = cy.cx * s, r = cy.r * s, y0 = cy.y0 * s, y1 = cy.y1 * s;
      const bodyH = y1 - y0; const span = .62;
      const wPx = r * span * 2; let h = wPx * (mark.height / mark.width);
      h = Math.min(h, bodyH * .36); const w = h * (mark.width / mark.height);
      const yTop = y0 + bodyH * .40 - h / 2;
      const tmp = document.createElement('canvas'); tmp.width = e.w; tmp.height = e.h;
      const t = tmp.getContext('2d');
      const halfW = Math.min(w, wPx) / 2; const thL = Math.asin(Math.min(1, halfW / r));
      for (let x = Math.floor(cx - halfW); x < cx + halfW; x++) {
        const u = (x - cx) / r; const a = Math.asin(Math.max(-1, Math.min(1, u)));
        const sx = (.5 + a / (2 * thL)) * mark.width;
        if (sx < 0 || sx >= mark.width) continue;
        const bend = (1 - Math.cos(a)) * h * .12;
        t.drawImage(mark, sx, 0, 1.2, mark.height, x, yTop + bend, 1.2, h);
      }
      t.globalCompositeOperation = 'source-in';
      t.fillStyle = silver(t.createLinearGradient(0, yTop, 0, yTop + h)); t.fillRect(0, 0, e.w, e.h);
      // sombreado de curvatura
      t.globalCompositeOperation = 'source-atop';
      const sh = t.createLinearGradient(cx - r, 0, cx + r, 0);
      sh.addColorStop(0, 'rgba(0,0,0,.6)'); sh.addColorStop(.35, 'rgba(0,0,0,0)'); sh.addColorStop(.55, 'rgba(255,255,255,.18)'); sh.addColorStop(1, 'rgba(0,0,0,.65)');
      t.fillStyle = sh; t.fillRect(0, 0, e.w, e.h);
      ctx.globalAlpha = .92; ctx.drawImage(tmp, 0, 0); ctx.globalAlpha = 1;
    } else if (p.engrave === 'plate') {
      const b = PLATES[p.file]; if (!b) return;
      const s = e.scale; const [x0, y0, x1, y1] = b.map((v) => v * s);
      const bw = (x1 - x0) * .78, bh = (y1 - y0) * .7;
      const k = Math.min(bw / mark.width, bh / mark.height);
      const w = mark.width * k, h = mark.height * k;
      const tmp = document.createElement('canvas'); tmp.width = e.w; tmp.height = e.h; const t = tmp.getContext('2d');
      t.drawImage(mark, (x0 + x1) / 2 - w / 2, (y0 + y1) / 2 - h / 2, w, h);
      t.globalCompositeOperation = 'source-in';
      t.fillStyle = silver(t.createLinearGradient(0, y0, 0, y1)); t.fillRect(0, 0, e.w, e.h);
      ctx.globalAlpha = .8; ctx.drawImage(tmp, 0, 0); ctx.globalAlpha = 1;
    }
  }

  let renderId = 0;
  async function renderActive() {
    const p = items[idx]?.p; if (!p) return;
    const id = ++renderId;
    const [e, mark] = await Promise.all([getBase(p), brandMask()]);
    if (id !== renderId) return;
    const hex = color ? COLORS[color][1] : null;
    const cv = items[idx].canvas || (items[idx].canvas = document.createElement('canvas'));
    cv.width = e.w; cv.height = e.h;
    const ctx = cv.getContext('2d');
    ctx.putImageData(recolor(e, p, hex), 0, 0);
    // conserva el alfa original del recorte
    ctx.globalCompositeOperation = 'destination-in'; ctx.drawImage(e.img, 0, 0); ctx.globalCompositeOperation = 'source-over';
    engrave(ctx, e, p, mark);
    cv.setAttribute('role', 'img');
    cv.setAttribute('aria-label', `${p.name}${hex ? ` color ${COLORS[color][0].toLowerCase()}` : ''} con ${sample === 'logo' ? (state.logo ? 'tu logo' : 'el logo de DIPROLASER') : `la marca ${sample}`} grabada`);
    const el = items[idx].el;
    if (!el.contains(cv)) { el.querySelector('img').hidden = true; el.append(cv); }
  }

  /* ---------- carrusel 3D ---------- */
  function build() {
    stage.textContent = '';
    items = TABS[tab].map((p, i) => {
      const el = document.createElement('div'); el.className = 'ring__item';
      const pic = document.createElement('picture');
      pic.innerHTML = `<source type="image/avif" srcset="img/promo/${slug(p.file)}-400.avif 400w, img/promo/${slug(p.file)}-800.avif 800w" sizes="(min-width: 960px) 22vw, 50vw">`;
      const img = document.createElement('img');
      img.src = src(p.file, 400); img.srcset = `${src(p.file, 400)} 400w, ${src(p.file, 800)} 800w`; img.sizes = '(min-width: 960px) 22vw, 50vw';
      img.alt = ALT[p.file] || p.name; img.loading = 'lazy'; img.decoding = 'async'; img.draggable = false;
      pic.append(img); el.append(pic);
      el.addEventListener('click', () => { if (i !== idx) go(i); });
      stage.append(el);
      return { el, p };
    });
    idx = 0; angle = target = 0;
    layout(); select(0, true);
  }
  function layout() {
    const n = items.length; const step = n > 3 ? 360 / n : 55;
    const R = Math.min(stage.clientWidth * .42, 330);
    items.forEach(({ el }, i) => {
      let a = (i * step - angle) % 360; if (a > 180) a -= 360; if (a < -180) a += 360;
      const rad = a * Math.PI / 180;
      const z = Math.cos(rad); const x = Math.sin(rad) * R;
      const sc = .55 + .45 * ((z + 1) / 2);
      el.style.transform = `translate(-50%, -50%) translate3d(${x}px, ${(1 - z) * -18}px, ${(z - 1) * 160}px) rotateY(${a * .35}deg) scale(${sc})`;
      el.style.opacity = String(Math.max(0, .15 + .85 * ((z + 1) / 2) ** 1.6));
      el.style.zIndex = String(Math.round(z * 100) + 100);
      el.style.filter = z < .9 ? `brightness(${.55 + .45 * z})` : '';
    });
  }
  let anim = 0;
  function animate() {
    cancelAnimationFrame(anim);
    const stepf = () => { angle += (target - angle) * (reducedMotion.matches ? 1 : .14); layout(); if (Math.abs(target - angle) > .05) anim = requestAnimationFrame(stepf); else { angle = target; layout(); } };
    stepf();
  }
  function go(i) {
    const n = items.length; const step = n > 3 ? 360 / n : 55;
    i = (i + n) % n;
    let d = i - idx; if (n > 3) { if (d > n / 2) d -= n; if (d < -n / 2) d += n; }
    target = target + d * step; idx = i;
    animate(); select(i); haptic(); tick(700, .05);
  }
  function select(i, first = false) {
    const p = items[i].p;
    nameEl.textContent = p.name;
    colorsField.hidden = !p.colors;
    if (p.colors) {
      colorsEl.innerHTML = p.colors.map((k) => `<button type="button" role="radio" class="swatch" data-value="${k}" aria-checked="${k === p.base}" aria-label="${COLORS[k][0]}" style="--c:${COLORS[k][1]}"></button>`).join('');
      color = p.base;
      rg = radioGroup(colorsEl, (v) => { color = v; renderActive(); updateWa(); aura?.setSectionColor(section, COLORS[v][1]); });
      aura?.setSectionColor(section, COLORS[p.base][1]);
    } else { color = null; aura?.setSectionColor(section, tab === 'anforas' ? '#d8b25c' : tab === 'sets' ? '#d8b25c' : '#e3262f'); }
    items.forEach(({ el }, k) => el.setAttribute('aria-hidden', String(k !== i)));
    updateWa();
    renderActive();
  }
  let rg;
  function updateWa() {
    const p = items[idx].p;
    setWa('gift', messages.gift({ product: p.plural, color: color && p.colors ? COLORS[color][0].toLowerCase() : '' }));
  }

  // arrastre con inercia
  let dragging = false, sx = 0, sa = 0, vx = 0, lx = 0, lt = 0;
  stage.addEventListener('pointerdown', (e) => { dragging = true; sx = lx = e.clientX; sa = angle; lt = performance.now(); vx = 0; stage.setPointerCapture(e.pointerId); cancelAnimationFrame(anim); });
  stage.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const now = performance.now(); vx = (e.clientX - lx) / Math.max(1, now - lt); lx = e.clientX; lt = now;
    angle = sa - (e.clientX - sx) * .35; target = angle; layout();
  });
  const end = () => {
    if (!dragging) return; dragging = false;
    const n = items.length; const step = n > 3 ? 360 / n : 55;
    const fling = angle - vx * 120;
    let i = Math.round(fling / step);
    if (n <= 3) i = Math.max(0, Math.min(n - 1, i));
    const ni = ((i % n) + n) % n;
    target = i * step; idx = ni; animate(); select(ni);
  };
  stage.addEventListener('pointerup', end); stage.addEventListener('pointercancel', end);
  section.querySelector('[data-ring-prev]').addEventListener('click', () => go(idx - 1));
  section.querySelector('[data-ring-next]').addEventListener('click', () => go(idx + 1));
  stage.tabIndex = 0; stage.setAttribute('aria-label', 'Carrusel de productos: usa las flechas para cambiar');
  stage.addEventListener('keydown', (e) => { if (e.key === 'ArrowRight') { e.preventDefault(); go(idx + 1); } if (e.key === 'ArrowLeft') { e.preventDefault(); go(idx - 1); } });
  addEventListener('resize', layout);

  tabs(section.querySelector('[data-gift-tabs]'), (b) => { tab = b.dataset.tab; build(); });
  radioGroup(sampleEl, (v) => { sample = v; renderActive(); });

  const syncLogo = () => {
    const btn = sampleEl.querySelector('[data-value="logo"]');
    btn.textContent = state.logo ? 'Tu logo' : 'DIPROLASER';
    logoNote.textContent = state.logo
      ? 'Tu logo ya está grabado en plata. También puedes probar con un nombre de ejemplo:'
      : 'Sube tu logo en el configurador y aparece aquí. Mientras, prueba con un nombre de ejemplo:';
    if (state.logo) { sample = 'logo'; sampleEl.querySelectorAll('[role="radio"]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.value === 'logo'))); }
    renderActive();
  };
  on('logo', syncLogo);
  build();
  if (state.logo) syncLogo();
  initGiftBox(section);
}

/* ---------- Caja de regalo que se abre con el scroll y suelta los productos con luz dorada ---------- */
async function initGiftBox(section) {
  const box = section.querySelector('[data-giftbox]');
  const holder = box.querySelector('[data-gift-items]');
  const picks = ['vaso_azul_1', 'termo_negro_2', 'llavero_cinta_roja', 'vaso_rosa_1', 'anfora_negra_grabado_diprolaser'];
  holder.innerHTML = picks.map((f) => `<img src="img/promo/${slug(f)}-400.webp" alt="" width="200" height="300" loading="lazy" decoding="async">`).join('');
  const imgs = [...holder.children];
  const spots = [[-150, -210, -14], [-62, -260, -6], [10, -300, 4], [84, -250, 9], [158, -200, 16]];
  const apply = (p) => {
    const lid = Math.min(1, p / .45);
    box.style.setProperty('--lid-y', `${-lid * 120}px`);
    box.style.setProperty('--lid-r', `${-lid * 64}deg`);
    box.style.setProperty('--glow', String(Math.min(1, Math.max(0, (p - .2) / .4))));
    imgs.forEach((im, i) => {
      const t = Math.min(1, Math.max(0, (p - .3 - i * .06) / .45));
      const e = 1 - Math.pow(1 - t, 3);
      const [x, y, r] = spots[i];
      const scale = innerWidth < 640 ? .72 : 1;
      im.style.opacity = String(e);
      im.style.transform = `translate(calc(-50% + ${x * e * scale}px), ${y * e * scale}px) rotate(${r * e}deg) scale(${.4 + .6 * e})`;
    });
  };
  if (reducedMotion.matches) { apply(1); return; }
  const { ScrollTrigger } = await import('../motion.js');
  ScrollTrigger.create({ trigger: box, start: 'top 85%', end: 'bottom 35%', scrub: .6, onUpdate: (st) => apply(st.progress) });
  apply(0);
}
