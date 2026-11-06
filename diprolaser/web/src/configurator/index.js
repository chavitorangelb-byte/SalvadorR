// Interfaz del configurador: modelo, colores por parte, logo, técnica, vistas, foto real, resumen y WhatsApp.
import { radioGroup, tabs, haptic, tick } from '../lib/ui.js';
import { state, emit, reducedMotion } from '../lib/state.js';
import { messages, setWa } from '../lib/whatsapp.js';
import { processLogo, defaultLogo } from './logo.js';

export const COLORS = {
  negro: ['Negro', '#141416'], rojo: ['Rojo DIPROLASER', '#c81e28'], camel: ['Camel', '#a3683f'], beige: ['Beige', '#cfbb9b'],
  gris: ['Gris', '#6b6e73'], marino: ['Azul marino', '#1c2742'], olivo: ['Verde olivo', '#4e5a2b'], blanco: ['Blanco', '#ecece6'],
};
const MODEL_NAMES = { tela: 'Tela', gamuza: 'Gamuza', micro: 'Microperforada', impermeable: 'Impermeable perforada', trucker: 'Trucker', bicolor: 'Bicolor' };
const TECH_NAMES = { bordado: 'Bordado', placa: 'Placa metálica', parche: 'Parche de piel', laser: 'Grabado láser', color: 'Impresión a todo color' };
// colores de cada modelo como en las fotos reales
const PRESETS = {
  tela: { crown: 'negro', visor: 'negro', under: 'rojo' }, gamuza: { crown: 'camel', visor: 'negro', under: 'negro' },
  micro: { crown: 'negro', visor: 'negro', under: 'rojo' }, impermeable: { crown: 'negro', visor: 'negro', under: 'rojo' },
  trucker: { crown: 'negro', visor: 'negro', under: 'rojo' }, bicolor: { crown: 'beige', visor: 'negro', under: 'negro' },
};
const PHOTOS = {
  tela: [['tela-negra', 'Gorra de tela negra con la etiqueta DIPROLASER en la visera']],
  gamuza: [['gamuza-camel-bicolor', 'Gorra de gamuza camel con visera negra y etiqueta DIPROLASER'], ['gamuza-roja-bicolor', 'Gorra de gamuza roja con visera negra']],
  micro: [['microperforada-negra', 'Gorra negra microperforada con etiqueta DIPROLASER en la visera']],
  impermeable: [['impermeable-perforada-negra', 'Gorra negra impermeable con perforaciones en los costados']],
  trucker: [['trucker-malla-negra', 'Gorra trucker negra con frente de gamuza y malla atrás']],
  bicolor: [['beige-bicolor', 'Gorra bicolor beige con visera negra']],
};
const TECH_PHOTOS = {
  bordado: ['dipro-caps-diseno-bordado', 'Gorra negra con un diseño bordado DIPRO CAPS', 'Así se ve un bordado real.'],
  placa: ['placa-aguila-frente', 'Gorra negra con placa metálica redonda grabada', 'Así se ve una placa real en la gorra.'],
};
const LABELS = { crown: 'Corona', visor: 'Visera', under: 'Abajo de la visera' };

export async function initConfigurator({ aura } = {}) {
  const root = document.getElementById('configurador');
  const stage = root.querySelector('[data-cfg-stage]');
  const host = root.querySelector('[data-cfg-canvas]');
  const poster = root.querySelector('[data-cfg-poster] img');
  const loading = root.querySelector('[data-cfg-loading]');
  const summary = root.querySelector('[data-summary]');
  const summaryText = root.querySelector('[data-summary-text]');
  const swatches = root.querySelector('[data-group="color"]');
  const waterBtn = root.querySelector('[data-water]');

  const cfg = { model: 'tela', part: 'crown', colors: { ...PRESETS.tela }, tech: 'bordado', touched: false };
  let scene = null, fallback = null;

  /* ---------- resumen + WhatsApp ---------- */
  const name = (k) => COLORS[k][0];
  const low = (k) => { const n = COLORS[k][0]; return n.charAt(0).toLowerCase() + n.slice(1); }; // DIPROLASER siempre en mayúsculas
  function sync() {
    const c = cfg.colors;
    summaryText.textContent = `${MODEL_NAMES[cfg.model]} · Corona ${low(c.crown)}, visera ${low(c.visor)}, abajo ${low(c.under)} · ${TECH_NAMES[cfg.tech]}${state.logo ? ' · Con tu logo' : ''}`;
    setWa('cfg', messages.cfg({ model: MODEL_NAMES[cfg.model], crown: name(c.crown), visor: name(c.visor), under: name(c.under), tech: TECH_NAMES[cfg.tech], hasLogo: !!state.logo }));
    host.setAttribute('aria-label', `Vista 3D de tu gorra: ${summaryText.textContent}`);
    fallback?.update(cfg);
  }

  /* ---------- colores por parte ---------- */
  function renderSwatches() {
    swatches.setAttribute('aria-label', `Color de ${LABELS[cfg.part].toLowerCase()}`);
    swatches.innerHTML = Object.entries(COLORS).map(([k, [n, hex]]) => `<button type="button" role="radio" class="swatch" data-value="${k}" aria-checked="${cfg.colors[cfg.part] === k}" aria-label="${n}" title="${n}" style="--c:${hex}"></button>`).join('');
    radioGroup(swatches, (v) => {
      cfg.colors[cfg.part] = v; cfg.touched = true;
      scene?.setColor(cfg.part, COLORS[v][1]);
      if (cfg.part === 'crown') aura?.setSectionColor(root, v === 'negro' ? '#d61f2c' : COLORS[v][1]);
      sync();
    });
  }
  tabs(root.querySelector('[data-part-tabs]'), (b) => {
    cfg.part = b.dataset.part; renderSwatches();
    if (cfg.part === 'visor') scene?.setView('visor');
    if (cfg.part === 'under') scene?.setView('under');
  });
  renderSwatches();

  /* ---------- modelo ---------- */
  radioGroup(root.querySelector('[data-group="model"]'), (v) => {
    cfg.model = v;
    if (!cfg.touched) cfg.colors = { ...PRESETS[v] };
    renderSwatches();
    waterBtn.hidden = v !== 'impermeable';
    const photo = PHOTOS[v][0][0];
    poster.src = `img/caps/${photo}-640.webp`; poster.srcset = `img/caps/${photo}-640.webp 640w, img/caps/${photo}-1200.webp 1200w`;
    poster.previousElementSibling?.setAttribute('srcset', `img/caps/${photo}-640.avif 640w, img/caps/${photo}-1200.avif 1200w`);
    const hexes = Object.fromEntries(Object.entries(cfg.colors).map(([k, c]) => [k, COLORS[c][1]]));
    scene?.setModel(v, hexes);
    if (cfg.colors.crown !== 'negro') aura?.setSectionColor(root, COLORS[cfg.colors.crown][1]); else aura?.setSectionColor(root, '#d61f2c');
    sync();
  });

  /* ---------- técnica ---------- */
  radioGroup(root.querySelector('[data-group="tech"]'), (v) => { cfg.tech = v; scene?.setTech(v); sync(); });

  /* ---------- logo ---------- */
  const input = root.querySelector('[data-logo-input]');
  const drop = root.querySelector('[data-drop]');
  const row = root.querySelector('[data-logo-row]');
  const dropTitle = root.querySelector('[data-drop-title]');
  let dipro = null;
  async function useFile(file) {
    if (!file || !/^image\//.test(file.type || 'image/')) return;
    dropTitle.textContent = 'Procesando tu logo…';
    try {
      const logo = await processLogo(file);
      state.logo = logo; emit('logo', logo);
      row.hidden = false; row.querySelector('[data-logo-thumb]').src = logo.dataURL;
      row.querySelector('[data-logo-name]').textContent = file.name || 'Tu logo';
      dropTitle.textContent = 'Cambiar logo';
      scene?.setLogo(logo); fallback?.setLogo(logo);
      haptic(14); tick(1200, .09);
    } catch (err) {
      console.warn(err);
      dropTitle.textContent = 'No pudimos leer esa imagen. Prueba con PNG o JPG.';
    }
    sync();
  }
  input.addEventListener('change', () => useFile(input.files[0]));
  for (const t of [drop, host]) {
    t.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('is-over'); });
    t.addEventListener('dragleave', () => drop.classList.remove('is-over'));
    t.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('is-over'); useFile(e.dataTransfer.files[0]); });
  }
  root.querySelector('[data-logo-remove]').addEventListener('click', () => {
    state.logo = null; emit('logo', null); row.hidden = true; input.value = ''; dropTitle.textContent = 'Sube tu logo';
    scene?.setLogo(dipro); fallback?.setLogo(dipro); sync();
  });

  /* ---------- vistas, agua, foto real ---------- */
  root.querySelectorAll('[data-view]').forEach((b) => b.addEventListener('click', () => { scene?.setView(b.dataset.view); fallback?.setView?.(b.dataset.view); haptic(); }));
  waterBtn.addEventListener('click', () => { scene?.water(); haptic(20); tick(520, .2, 'sine', .03); });
  const dlg = root.querySelector('[data-photo-dlg]');
  root.querySelector('[data-real-photo]').addEventListener('click', () => {
    const body = dlg.querySelector('[data-photo-body]');
    const list = PHOTOS[cfg.model].map(([f, alt]) => [f, alt, '']);
    if (TECH_PHOTOS[cfg.tech]) list.push(TECH_PHOTOS[cfg.tech]);
    dlg.querySelector('[data-photo-title]').textContent = `${MODEL_NAMES[cfg.model]} · foto real`;
    body.innerHTML = list.map(([f, alt, cap]) => `<figure><picture><source type="image/avif" srcset="img/caps/${f}-1200.avif"><img src="img/caps/${f}-1200.webp" alt="${alt}" width="1200" height="800" loading="lazy" decoding="async" style="height:auto"></picture>${cap ? `<figcaption>${cap}</figcaption>` : ''}</figure>`).join('');
    dlg.showModal();
  });
  dlg.querySelector('[data-photo-close]').addEventListener('click', () => dlg.close());
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });

  /* ---------- descargar mi diseño ---------- */
  root.querySelector('[data-download]').addEventListener('click', async () => {
    const shot = scene ? scene.snapshot(1080, 1080) : await fallback?.snapshot();
    if (!shot) return;
    const out = await composeDesign(shot, summaryText.textContent);
    out.toBlob(async (blob) => {
      const file = new File([blob], 'mi-gorra-diprolaser.png', { type: 'image/png' });
      if (matchMedia('(pointer: coarse)').matches && navigator.canShare?.({ files: [file] })) {
        try { await navigator.share({ files: [file], title: 'Mi gorra DIPROLASER' }); return; } catch { /* cancelado */ }
      }
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = file.name; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    }, 'image/png');
  });

  /* ---------- resumen fijo: el botón flotante de WhatsApp se aparta ---------- */
  new IntersectionObserver(([e]) => {
    document.body.classList.toggle('summary-on', e.isIntersecting);
    document.body.style.setProperty('--sum-h', `${summary.offsetHeight}px`);
  }, { rootMargin: '-35% 0px -20% 0px' }).observe(root);

  sync();

  /* ---------- 3D (o visor de fotos si no hay WebGL) ---------- */
  const forceFallback = new URLSearchParams(location.search).has('fallback');
  const hasGL = (() => { try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; } })();
  dipro = await defaultLogo().catch(() => null);
  if (hasGL && !forceFallback) {
    try {
      const { createScene } = await import('./scene.js');
      scene = await createScene(host, { reduced: reducedMotion.matches });
      const hexes = Object.fromEntries(Object.entries(cfg.colors).map(([k, c]) => [k, COLORS[c][1]]));
      await scene.setModel(cfg.model, hexes);
      scene.setTech(cfg.tech); scene.setLogo(state.logo || dipro);
      host.classList.add('is-ready'); loading.remove();
      window.__cfg = scene;
      return;
    } catch (err) { console.warn('3D no disponible', err); scene = null; }
  }
  const { createFallback } = await import('./fallback.js');
  fallback = createFallback(host, cfg, { logo: state.logo || dipro });
  host.classList.add('is-ready'); loading.remove();
  stage.classList.add('is-fallback');
  root.querySelector('[data-cfg-hint]').textContent = 'Arrastra para ver otro ángulo';
}

async function composeDesign(shot, text) {
  const W = 1080, H = 1350;
  const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
  x.fillStyle = '#050506'; x.fillRect(0, 0, W, H);
  const g = x.createRadialGradient(W / 2, 640, 40, W / 2, 640, 640); g.addColorStop(0, 'rgba(227,38,47,.55)'); g.addColorStop(1, 'rgba(227,38,47,0)'); x.fillStyle = g; x.fillRect(0, 0, W, H);
  x.drawImage(shot, 0, 170, W, W);
  try {
    const logo = new Image(); logo.src = 'img/brand/logo-480.webp'; await logo.decode();
    const lw = 300; x.drawImage(logo, (W - lw) / 2, 40, lw, lw * logo.height / logo.width);
  } catch { /* sin logo */ }
  await document.fonts.load('600 30px Inter').catch(() => {});
  x.fillStyle = '#f4f4f6'; x.textAlign = 'center'; x.font = '600 30px Inter, sans-serif';
  const words = text.split(' '); let line = '', y = 1230; const lines = [];
  for (const w of words) { const t = line ? `${line} ${w}` : w; if (x.measureText(t).width > W - 120) { lines.push(line); line = w; } else line = t; }
  lines.push(line);
  y -= (lines.length - 1) * 40; lines.forEach((l) => { x.fillText(l, W / 2, y); y += 40; });
  x.fillStyle = 'rgba(244,244,246,.6)'; x.font = '500 24px Inter, sans-serif';
  x.fillText('Vista previa · DIPROLASER · WhatsApp 449 212 8627', W / 2, 1310);
  return c;
}
