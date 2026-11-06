// México en SVG con líneas de luz que salen de Aguascalientes hacia todo el país.
import mx from '../data/mexico.json';
import { reducedMotion } from '../lib/state.js';

export function initMapa() {
  const host = document.querySelector('[data-map]');
  const [ax, ay] = mx.ags;
  const arcs = mx.dest.map(([x, y], i) => {
    const mx2 = (ax + x) / 2, my2 = (ay + y) / 2;
    const dx = x - ax, dy = y - ay; const len = Math.hypot(dx, dy);
    const k = (i % 2 ? 1 : -1) * Math.min(90, len * .28);
    const cx = mx2 - dy / len * k, cy = my2 + dx / len * k;
    return { d: `M${ax} ${ay} Q${cx.toFixed(1)} ${cy.toFixed(1)} ${x} ${y}`, x, y, len, i };
  });
  host.innerHTML = `
  <svg viewBox="${mx.viewBox}" aria-hidden="true">
    <defs>
      <linearGradient id="mxfill" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1b1b21"/><stop offset="1" stop-color="#0b0b0e"/></linearGradient>
      <radialGradient id="agsglow"><stop offset="0" stop-color="#ff3b44" stop-opacity=".9"/><stop offset="1" stop-color="#ff3b44" stop-opacity="0"/></radialGradient>
      <filter id="blur6"><feGaussianBlur stdDeviation="6"/></filter>
    </defs>
    <path d="${mx.d}" fill="url(#mxfill)" stroke="rgba(255,90,97,.55)" stroke-width="1.6"/>
    <path d="${mx.d}" fill="none" stroke="rgba(227,38,47,.35)" stroke-width="8" filter="url(#blur6)"/>
    <g class="arcs">${arcs.map((a) => `
      <path d="${a.d}" fill="none" stroke="rgba(255,90,97,.16)" stroke-width="1.6"/>
      <path class="arc" d="${a.d}" fill="none" stroke="url(#arc)" stroke-width="4" stroke-linecap="round" pathLength="100" style="--d:${(a.i * .23).toFixed(2)}s"/>
      <circle class="end" cx="${a.x}" cy="${a.y}" r="4" style="--d:${(a.i * .23 + 1.6).toFixed(2)}s"/>`).join('')}
    </g>
    <circle cx="${ax}" cy="${ay}" r="60" fill="url(#agsglow)" class="ags-glow"/>
    <circle cx="${ax}" cy="${ay}" r="7" fill="#fff"/>
    <circle cx="${ax}" cy="${ay}" r="7" fill="none" stroke="#ff3b44" stroke-width="2" class="ags-ring"/>
    <text x="${ax + 16}" y="${ay - 14}" class="ags-label">Aguascalientes</text>
    <linearGradient id="arc" gradientUnits="userSpaceOnUse" x1="${ax}" y1="${ay}" x2="${ax + 300}" y2="${ay}"><stop offset="0" stop-color="#ff3b44"/><stop offset="1" stop-color="#ffd48a"/></linearGradient>
  </svg>`;
  const style = document.createElement('style');
  style.textContent = `
    .ags__map .arc { stroke-dasharray: 22 100; stroke-dashoffset: 122; filter: drop-shadow(0 0 6px rgba(255,80,80,.95)); }
    .ags__map.is-on .arc { animation: arcrun 3.2s var(--ease-io) var(--d) infinite; }
    .ags__map .end { fill: #ffd48a; opacity: 0; }
    .ags__map.is-on .end { animation: endpop 3.2s ease-out var(--d) infinite; }
    .ags__map .ags-ring { transform-box: fill-box; transform-origin: center; animation: ring 2.4s ease-out infinite; }
    .ags__map .ags-glow { animation: breathe 2.6s ease-in-out infinite; transform-box: fill-box; transform-origin: center; }
    .ags__map .ags-label { font: 700 22px var(--f-display); font-stretch: 80%; letter-spacing: .08em; text-transform: uppercase; fill: #fff; paint-order: stroke; stroke: #050506; stroke-width: 6px; }
    @keyframes arcrun { 0% { stroke-dashoffset: 122; } 62%, 100% { stroke-dashoffset: -2; } }
    @keyframes endpop { 0%, 8% { opacity: 0; r: 2; } 14% { opacity: 1; r: 5; } 40%, 100% { opacity: 0; r: 2; } }
    @keyframes ring { from { transform: scale(1); opacity: 1; } to { transform: scale(4); opacity: 0; } }
    @media (prefers-reduced-motion: reduce) { .ags__map .arc { stroke-dasharray: none; stroke-dashoffset: 0; opacity: .6; } .ags__map .end { opacity: 1; } }`;
  document.head.append(style);
  if (reducedMotion.matches) { host.classList.add('is-on'); return; }
  new IntersectionObserver(([e]) => host.classList.toggle('is-on', e.isIntersecting), { threshold: .2 }).observe(host);
}
