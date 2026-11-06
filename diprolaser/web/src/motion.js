// Movimiento con scroll: Lenis + GSAP/ScrollTrigger. Se carga después de la primera pintura.
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { splitChars } from './lib/ui.js';
import { reducedMotion, finePointer } from './lib/state.js';

gsap.registerPlugin(ScrollTrigger);
export { gsap, ScrollTrigger };

export function initMotion({ aura } = {}) {
  const rm = reducedMotion.matches;
  let lenis = null;
  if (!rm && finePointer.matches) {
    lenis = new Lenis({ duration: 1.1, easing: (t) => 1 - Math.pow(1 - t, 4), smoothWheel: true });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
    document.querySelectorAll('a[href^="#"]').forEach((a) => a.addEventListener('click', (e) => {
      const id = a.getAttribute('href'); const el = id.length > 1 && document.querySelector(id);
      if (el) { e.preventDefault(); lenis.scrollTo(el, { offset: -76 }); history.replaceState(null, '', id); }
    }));
    window.__lenis = lenis;
  }

  // Titulares cinéticos: entran por letra con peso y ancho animados
  document.querySelectorAll('[data-kinetic]').forEach((el) => {
    if (el.classList.contains('hero__title')) return;
    const chars = splitChars(el);
    if (rm) return;
    gsap.set(chars, { opacity: 0, yPercent: 60, rotate: 4, '--wght': 300, '--wdth': 125 });
    ScrollTrigger.create({
      trigger: el, start: 'top 86%', once: true,
      onEnter: () => gsap.to(chars, { opacity: 1, yPercent: 0, rotate: 0, '--wght': 900, '--wdth': 72, duration: 1, ease: 'expo.out', stagger: 0.024 }),
    });
  });

  // Cómo trabajamos: la línea roja se "graba" con el scroll y prende cada paso
  const list = document.querySelector('[data-proc]');
  if (list) {
    const steps = [...list.children];
    ScrollTrigger.create({
      trigger: list, start: 'top 70%', end: 'bottom 55%', scrub: rm ? false : 0.6,
      onUpdate: (st) => {
        list.style.setProperty('--p', st.progress.toFixed(4));
        const n = Math.round(st.progress * steps.length + 0.35);
        steps.forEach((s, i) => s.classList.toggle('is-on', i < n));
      },
    });
    if (rm) { list.style.setProperty('--p', 1); steps.forEach((s) => s.classList.add('is-on')); }
  }

  // Secciones con parallax suave en sus encabezados
  if (!rm) {
    gsap.utils.toArray('.sec-head .lead').forEach((el) => {
      gsap.fromTo(el, { clipPath: 'inset(0 0 100% 0)' }, { clipPath: 'inset(0 0 0% 0)', ease: 'none', scrollTrigger: { trigger: el, start: 'top 92%', end: 'top 62%', scrub: 0.5 } });
    });
  }
  aura?.refresh();
  ScrollTrigger.refresh();
  return { lenis };
}
