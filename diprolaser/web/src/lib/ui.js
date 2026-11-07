import { reducedMotion, finePointer, state } from './state.js';

/* ---------- Tipografía cinética: parte los titulares en letras ---------- */
export function splitChars(el) {
  if (el.dataset.split) return el.querySelectorAll('.ch');
  // texto completo para lectores de pantalla (aria-label no vale en <p> sin rol)
  const sr = document.createElement('span'); sr.className = 'sr-only'; sr.textContent = el.textContent.replace(/\s+/g, ' ').trim();
  el.querySelectorAll('.line').forEach((line) => {
    const text = line.textContent;
    line.textContent = '';
    line.setAttribute('aria-hidden', 'true');
    for (const word of text.split(/(\s+)/)) {
      if (/^\s+$/.test(word)) { line.append(' '); continue; }
      const w = document.createElement('span');
      w.style.display = 'inline-block'; w.style.whiteSpace = 'nowrap';
      for (const c of word) {
        const s = document.createElement('span');
        s.className = 'ch'; s.textContent = c;
        w.append(s);
      }
      line.append(w);
    }
  });
  el.prepend(sr);
  el.dataset.split = '1';
  return el.querySelectorAll('.ch');
}

/* ---------- Revelados simples (IntersectionObserver) ---------- */
export function initReveals() {
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
  }, { rootMargin: '0px 0px -8% 0px' });
  document.querySelectorAll('[data-reveal]').forEach((el) => io.observe(el));
}

/* ---------- Vibración háptica ligera (Android; iOS no la soporta) ---------- */
export function haptic(ms = 8) {
  if (reducedMotion.matches) return;
  try { navigator.vibrate?.(ms); } catch { /* sin soporte */ }
}

/* ---------- Sonido opcional (apagado por default), sintetizado ---------- */
let actx;
export function tick(freq = 880, dur = 0.05, type = 'triangle', gain = 0.035) {
  if (!state.sound) return;
  try {
    actx ||= new (window.AudioContext || window.webkitAudioContext)();
    const o = actx.createOscillator(); const g = actx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, actx.currentTime);
    o.frequency.exponentialRampToValueAtTime(freq * 0.6, actx.currentTime + dur);
    g.gain.setValueAtTime(gain, actx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + dur);
    o.connect(g).connect(actx.destination); o.start(); o.stop(actx.currentTime + dur + 0.02);
  } catch { /* sin audio */ }
}
export function initSound() {
  const btn = document.querySelector('[data-sound]');
  if (!btn) return;
  btn.addEventListener('click', () => {
    state.sound = !state.sound;
    btn.setAttribute('aria-pressed', String(state.sound));
    btn.setAttribute('aria-label', `Sonido de la página: ${state.sound ? 'encendido' : 'apagado'}`);
    btn.style.color = state.sound ? 'var(--red-text)' : '';
    tick(660, .08);
  });
}

/* ---------- Gotas líquidas al tocar un chip de color ---------- */
export function splash(x, y, color) {
  if (reducedMotion.matches) return;
  const wrap = document.createElement('div');
  wrap.className = 'splash'; wrap.style.left = `${x}px`; wrap.style.top = `${y}px`; wrap.style.setProperty('--c', color);
  const n = 7; const drops = [];
  for (let i = 0; i < n; i++) { const d = document.createElement('i'); wrap.append(d); drops.push(d); }
  document.body.append(wrap);
  const t0 = performance.now();
  const ang = drops.map((_, i) => (i / n) * Math.PI * 2 + Math.random() * .6);
  const sp = drops.map(() => 26 + Math.random() * 26);
  const sz = drops.map(() => .5 + Math.random() * .7);
  (function frame(now) {
    const t = Math.min((now - t0) / 650, 1);
    const e = 1 - Math.pow(1 - t, 3);
    drops.forEach((d, i) => {
      const r = sp[i] * e; const g = 30 * t * t;
      d.style.transform = `translate(${Math.cos(ang[i]) * r}px, ${Math.sin(ang[i]) * r + g}px) scale(${sz[i] * (1 - t * .9)})`;
    });
    if (t < 1) requestAnimationFrame(frame); else wrap.remove();
  })(t0);
}

/* ---------- Grupos de radio accesibles (chips y muestras) ---------- */
export function radioGroup(root, onChange) {
  const items = () => [...root.querySelectorAll('[role="radio"]')];
  const select = (el, focus = false, silent = false) => {
    items().forEach((b) => { b.setAttribute('aria-checked', String(b === el)); b.tabIndex = b === el ? 0 : -1; });
    if (focus) el.focus();
    if (!silent) onChange?.(el.dataset.value, el);
  };
  root.addEventListener('click', (e) => {
    const b = e.target.closest('[role="radio"]');
    if (!b || !root.contains(b)) return;
    select(b);
    haptic(); tick(980, .04);
    if (b.classList.contains('swatch')) { const r = b.getBoundingClientRect(); splash(r.left + r.width / 2, r.top + r.height / 2, getComputedStyle(b).getPropertyValue('--c')); }
  });
  root.addEventListener('keydown', (e) => {
    const list = items(); const i = list.indexOf(document.activeElement);
    if (i < 0) return;
    let j = null;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') j = (i + 1) % list.length;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') j = (i - 1 + list.length) % list.length;
    if (e.key === 'Home') j = 0;
    if (e.key === 'End') j = list.length - 1;
    if (j !== null) { e.preventDefault(); select(list[j], true); }
  });
  const cur = items().find((b) => b.getAttribute('aria-checked') === 'true') || items()[0];
  if (cur) select(cur, false, true);
  return { select: (value, silent = true) => { const el = items().find((b) => b.dataset.value === value); if (el) select(el, false, silent); } };
}

/* ---------- Pestañas accesibles ---------- */
export function tabs(root, onChange) {
  const list = [...root.querySelectorAll('[role="tab"]')];
  const select = (el, focus) => {
    list.forEach((b) => { b.setAttribute('aria-selected', String(b === el)); b.tabIndex = b === el ? 0 : -1; });
    if (focus) el.focus();
    onChange?.(el);
  };
  root.addEventListener('click', (e) => { const b = e.target.closest('[role="tab"]'); if (b) { select(b); haptic(); tick(760, .04); } });
  root.addEventListener('keydown', (e) => {
    const i = list.indexOf(document.activeElement); if (i < 0) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); select(list[(i + 1) % list.length], true); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); select(list[(i - 1 + list.length) % list.length], true); }
  });
  list.forEach((b) => { b.tabIndex = b.getAttribute('aria-selected') === 'true' ? 0 : -1; });
}

/* ---------- Botones magnéticos, cursor de cristal, brillo del cristal ---------- */
export function initPointerFx() {
  if (!finePointer.matches) return initGyroGlass();
  const cursor = document.querySelector('.cursor');
  let x = -100, y = -100, cx = -100, cy = -100;
  addEventListener('pointermove', (e) => {
    x = e.clientX; y = e.clientY;
    cursor.classList.add('is-on');
    const hot = e.target.closest('a, button, [role="radio"], [role="tab"], label, input, [data-cfg-canvas], [data-ring-stage]');
    cursor.classList.toggle('is-hot', !!hot);
  }, { passive: true });
  document.addEventListener('pointerleave', () => cursor.classList.remove('is-on'));
  const loop = () => {
    const k = reducedMotion.matches ? 1 : 0.22;
    cx += (x - cx) * k; cy += (y - cy) * k;
    cursor.style.transform = `translate3d(${cx}px, ${cy}px, 0)`;
    requestAnimationFrame(loop);
  };
  loop();

  // reflejo especular del cristal bajo el puntero
  document.addEventListener('pointermove', (e) => {
    const g = e.target.closest('.glass');
    if (!g) return;
    const r = g.getBoundingClientRect();
    g.style.setProperty('--mx', `${((e.clientX - r.left) / r.width) * 100}%`);
    g.style.setProperty('--my', `${((e.clientY - r.top) / r.height) * 100}%`);
  }, { passive: true });

  if (reducedMotion.matches) return;
  document.querySelectorAll('[data-magnetic]').forEach((el) => {
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      const dx = (e.clientX - (r.left + r.width / 2)) / r.width;
      const dy = (e.clientY - (r.top + r.height / 2)) / r.height;
      el.style.transform = `translate(${dx * 12}px, ${dy * 10}px)`;
    });
    el.addEventListener('pointerleave', () => { el.style.transform = ''; });
  });
  document.querySelectorAll('[data-tilt]').forEach((el) => {
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      const dx = (e.clientX - r.left) / r.width - .5, dy = (e.clientY - r.top) / r.height - .5;
      el.style.transform = `perspective(900px) rotateX(${-dy * 6}deg) rotateY(${dx * 8}deg)`;
    });
    el.addEventListener('pointerleave', () => { el.style.transform = ''; });
  });
}

// En celular: el brillo del cristal sigue al giroscopio (Android) o al scroll.
function initGyroGlass() {
  const root = document.documentElement;
  let gx = 30, gy = 0;
  const apply = () => document.querySelectorAll('.glass').forEach((g) => { g.style.setProperty('--mx', `${gx}%`); g.style.setProperty('--my', `${gy}%`); });
  let raf = 0;
  const queue = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; apply(); }); };
  if ('DeviceOrientationEvent' in window && typeof DeviceOrientationEvent.requestPermission !== 'function') {
    addEventListener('deviceorientation', (e) => {
      if (e.gamma == null) return;
      gx = 50 + Math.max(-45, Math.min(45, e.gamma)) * 1.1;
      gy = Math.max(-20, Math.min(80, (e.beta ?? 45) - 30));
      queue();
    }, { passive: true });
  } else {
    addEventListener('scroll', () => { const p = (scrollY % 900) / 900; gx = 20 + p * 60; gy = p * 40; queue(); }, { passive: true });
  }
  root.dataset.gyro = '1';
}

/* ---------- Navegación: se encoge con el scroll, menú en celular ---------- */
export function initNav() {
  const nav = document.getElementById('nav');
  const onScroll = () => nav.classList.toggle('is-scrolled', scrollY > 40);
  addEventListener('scroll', onScroll, { passive: true }); onScroll();
  const btn = nav.querySelector('.nav__menu'); const menu = document.getElementById('menu');
  const close = () => { menu.hidden = true; btn.setAttribute('aria-expanded', 'false'); btn.setAttribute('aria-label', 'Abrir menú'); };
  btn.addEventListener('click', () => {
    const open = menu.hidden;
    menu.hidden = !open; btn.setAttribute('aria-expanded', String(open)); btn.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
    if (open) menu.querySelector('a')?.focus();
  });
  menu.addEventListener('click', (e) => { if (e.target.closest('a')) close(); });
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && !menu.hidden) { close(); btn.focus(); } });
}
