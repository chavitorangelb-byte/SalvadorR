// Videos verticales: autoplay silenciado solo mientras se ven.
import { reducedMotion } from '../lib/state.js';

export function initVideos() {
  const vids = [...document.querySelectorAll('video[data-autoplay]')];
  if (reducedMotion.matches) { vids.forEach((v) => { v.controls = true; }); return; }
  const io = new IntersectionObserver((es) => {
    for (const e of es) {
      const v = e.target;
      if (e.isIntersecting && e.intersectionRatio > .55) {
        if (v.preload !== 'auto') { v.preload = 'auto'; }
        v.play().catch(() => { v.controls = true; });
      } else v.pause();
    }
  }, { threshold: [0, .55, 1] });
  vids.forEach((v) => {
    v.muted = true;
    io.observe(v);
    v.addEventListener('click', () => (v.paused ? v.play() : v.pause()));
  });
}
