import './styles/main.css';
import { initWhatsApp } from './lib/whatsapp.js';
import { initNav, initReveals, initPointerFx, initSound, splitChars } from './lib/ui.js';
import { initAura } from './gl/aura.js';
import { reducedMotion } from './lib/state.js';

document.documentElement.classList.add('js');
document.querySelectorAll('[data-year]').forEach((el) => { el.textContent = new Date().getFullYear(); });

initWhatsApp();
initNav();
initSound();
initReveals();
initPointerFx();

/* ---- Hero: titular por letra (CSS, sin esperar librerías) + X líquida que se vuelve el logo ---- */
const heroTitle = document.querySelector('.hero__title');
const chars = splitChars(heroTitle);
chars.forEach((c, i) => c.style.setProperty('--i', i));
heroTitle.classList.add('is-kinetic');

const mobileFirst = matchMedia('(max-width: 759px), (pointer: coarse)').matches;
const aura = new URLSearchParams(location.search).has('noaura') ? null : initAura({ delay: mobileFirst ? 2500 : 0 }); // ?noaura: sin fondo WebGL (pruebas)
window.__aura = aura;
const heroLogo = document.querySelector('[data-hero-logo]');
if (aura && !reducedMotion.matches && !mobileFirst) {
  heroLogo.classList.add('is-pending');
  const s = aura.state.hero;
  const t0 = performance.now();
  const ease = (x) => 1 - Math.pow(1 - x, 3);
  (function intro(now) {
    const t = (now - t0) / 1000;
    s.alpha = Math.min(1, t / 0.35);                       // aparecen las gotas
    s.form = ease(Math.min(1, Math.max(0, (t - 0.15) / 1.25))); // se juntan en la X
    if (t > 1.25) heroLogo.classList.replace('is-pending', 'is-on'); // entra el logo oficial
    if (t > 1.35) s.alpha = Math.max(0, 1 - (t - 1.35) / 0.7);     // el líquido se desvanece bajo el logo
    if (t < 2.2) requestAnimationFrame(intro); else { s.alpha = 0; setTimeout(() => aura.hiRes(), 1500); }
  })(t0);
} else {
  heroLogo.classList.add('is-on');
  aura?.hiRes();
}

/* ---- Parallax de la gorra del hero (puntero, giroscopio en Android, scroll) ---- */
const cap = document.querySelector('[data-hero-cap]');
if (!reducedMotion.matches && mobileFirst) {
  cap.classList.add('is-floating'); // en celular el flotado va por CSS: nada corre en cada cuadro
} else if (!reducedMotion.matches) {
  let tx = 0, ty = 0, x = 0, y = 0, sy = 0;
  addEventListener('pointermove', (e) => { tx = (e.clientX / innerWidth - .5) * 2; ty = (e.clientY / innerHeight - .5) * 2; }, { passive: true });
  addEventListener('scroll', () => { sy = Math.min(scrollY, innerHeight); }, { passive: true });
  const t0 = performance.now();
  (function loop(now) {
    // con la gorra 3D la foto ya no se ve: el ciclo se detiene
    if (cap.parentElement.classList.contains('has-3d')) return;
    x += (tx - x) * .06; y += (ty - y) * .06;
    const f = Math.sin((now - t0) / 1600) * 6;
    if (sy < innerHeight) cap.style.transform = `translateX(-50%) translate3d(${x * 10}px, ${f + y * 6 - sy * .12}px, 0) perspective(900px) rotateY(${x * 9 + Math.sin((now - t0) / 3000) * 5}deg) rotateX(${-y * 4}deg)`;
    requestAnimationFrame(loop);
  })(t0);
}

/* ---- Carga diferida: movimiento con scroll, luego cada sección al acercarse ---- */
const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 600));
let motion;
const loadMotion = () => (motion ||= import('./motion.js').then((m) => m.initMotion({ aura })));
addEventListener('load', () => idle(loadMotion, { timeout: 1800 }));
['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach((ev) => addEventListener(ev, loadMotion, { once: true, passive: true }));

const lazy = [
  ['#placa', () => import('./sections/placa.js').then((m) => m.initPlaca())],
  ['#regalos', () => import('./sections/gifts.js').then((m) => m.initGifts({ aura }))],
  ['#tecnicas', () => import('./sections/tecnicas.js').then((m) => m.initTecnicas())],
  ['#videos', () => import('./sections/videos.js').then((m) => m.initVideos())],
  ['#aguascalientes', () => import('./sections/mapa.js').then((m) => m.initMapa())],
];
const lio = new IntersectionObserver((entries) => {
  for (const e of entries) {
    if (!e.isIntersecting) continue;
    lio.unobserve(e.target);
    const item = lazy.find(([sel]) => document.querySelector(sel) === e.target);
    item?.[1]().catch((err) => console.error(err));
  }
}, { rootMargin: '150% 0px 150% 0px' });
lazy.forEach(([sel]) => { const el = document.querySelector(sel); if (el) lio.observe(el); });

// El configurador (Three.js) llega con el primer gesto o cuando su sección ya está cerca,
// nunca durante la carga inicial: la primera pantalla se pinta sin 3D.
let cfgLoading = null;
const loadCfg = () => (cfgLoading ||= import('./configurator/index.js').then((m) => m.initConfigurator({ aura })).catch((e) => console.error(e)));
['wheel', 'pointerdown', 'touchstart', 'keydown'].forEach((ev) => addEventListener(ev, () => setTimeout(loadCfg, 120), { once: true, passive: true }));
// solo un movimiento real del mouse (Chrome manda pointermove sintéticos cuando cambia el layout)
let pm0 = null;
const onMove = (e) => {
  if (!pm0) { pm0 = [e.clientX, e.clientY]; return; }
  if (Math.hypot(e.clientX - pm0[0], e.clientY - pm0[1]) > 6) { removeEventListener('pointermove', onMove); setTimeout(loadCfg, 120); }
};
addEventListener('pointermove', onMove, { passive: true });
new IntersectionObserver(([e]) => { if (e.isIntersecting) loadCfg(); }, { rootMargin: '0px' }).observe(document.getElementById('configurador'));
