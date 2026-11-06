// Placa Águila de México: el nombre se graba en la franja con un láser rojo, letra por letra.
import { messages, setWa } from '../lib/whatsapp.js';
import { reducedMotion } from '../lib/state.js';
import { haptic, tick } from '../lib/ui.js';

const EXAMPLES = ['SALVADOR', 'GONZÁLEZ', 'EL FLACO', 'DAVID', 'RANGEL', 'DÁVILA'];
// Franja vacía medida en placa_aguila_sin_nombre.png (920×920): y 451–606
const STRIP = { cy: 528.5, top: 451, bottom: 606, maxW: 690 };

export async function initPlaca() {
  const canvas = document.querySelector('[data-placa-canvas]');
  const input = document.querySelector('[data-placa-input]');
  const ctx = canvas.getContext('2d');
  const plate = new Image();
  plate.decoding = 'async';
  plate.src = 'img/placa/sin-nombre-920.webp';
  await Promise.all([plate.decode().catch(() => {}), document.fonts.load('124px Tinos').catch(() => {})]);

  const rm = reducedMotion.matches;
  let text = '';            // lo que se está grabando
  let progress = 0;         // letras grabadas (con fracción)
  let heat = [];            // tiempo en que se grabó cada letra
  let mode = 'demo';        // 'demo' (ejemplos que rotan) o 'user'
  let demoIdx = 0, demoHold = 0, fade = 1;
  let sparks = [];
  let visible = false, raf = 0, last = performance.now();

  const layout = (str) => {
    let size = 124;
    ctx.font = `400 ${size}px Tinos, 'Times New Roman', serif`;
    const track = size * 0.05;
    const widths = [...str].map((c) => ctx.measureText(c).width);
    let total = widths.reduce((a, b) => a + b, 0) + track * Math.max(0, str.length - 1);
    if (total > STRIP.maxW) { const k = STRIP.maxW / total; size *= k; total *= k; widths.forEach((_, i) => { widths[i] *= k; }); }
    const tr = size * 0.05;
    let x = 460 - total / 2;
    const xs = widths.map((w) => { const x0 = x; x += w + tr; return x0; });
    return { size, xs, widths, baseline: STRIP.cy + size * 0.33 };
  };

  const setText = (str, keepPrefix = true) => {
    let common = 0;
    if (keepPrefix) { while (common < text.length && common < str.length && text[common] === str[common]) common++; }
    text = str;
    progress = Math.min(progress, common);
    heat.length = common;
  };

  function draw(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    ctx.clearRect(0, 0, 920, 920);
    ctx.drawImage(plate, 0, 0, 920, 920);

    // brillo metálico que recorre la placa
    const sx = 460 + Math.sin(now / 2600) * 300;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const g = ctx.createRadialGradient(sx, 260, 10, sx, 260, 420);
    g.addColorStop(0, 'rgba(255,240,210,.12)'); g.addColorStop(1, 'rgba(255,240,210,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(460, 460, 412, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    if (!text) return;
    const L = layout(text);
    const speed = rm ? 999 : 7.5; // letras por segundo
    if (progress < text.length) {
      const before = Math.floor(progress);
      progress = Math.min(text.length, progress + speed * dt);
      for (let i = before; i < Math.floor(progress); i++) { heat[i] = now; if (mode === 'user') tick(1400 + Math.random() * 400, .03, 'square', .012); }
    }
    const full = Math.floor(progress), frac = progress - full;
    const revealX = full < text.length ? L.xs[full] + L.widths[full] * frac : 9999;

    ctx.save();
    ctx.globalAlpha = fade;
    ctx.font = `400 ${L.size}px Tinos, 'Times New Roman', serif`;
    ctx.textBaseline = 'alphabetic';
    ctx.beginPath(); ctx.rect(0, STRIP.top + 2, revealX, STRIP.bottom - STRIP.top - 4); ctx.clip();
    for (let i = 0; i < text.length; i++) {
      const x = L.xs[i], y = L.baseline, c = text[i];
      if (x > revealX) break;
      // grabado: sombra interior, cuerpo crema y filo de luz
      ctx.fillStyle = 'rgba(0,0,0,.65)'; ctx.fillText(c, x + 2, y + 2.5);
      const h = heat[i] ? Math.max(0, 1 - (now - heat[i]) / 900) : 0;
      const body = ctx.createLinearGradient(0, y - L.size * .7, 0, y);
      body.addColorStop(0, `rgb(${238},${228 - h * 90},${206 - h * 150})`);
      body.addColorStop(1, `rgb(${196 + h * 50},${182 - h * 90},${150 - h * 120})`);
      ctx.fillStyle = body; ctx.fillText(c, x, y);
      if (h > 0) { ctx.save(); ctx.shadowColor = `rgba(255,90,60,${h})`; ctx.shadowBlur = 18 * h; ctx.fillStyle = `rgba(255,140,90,${h * .5})`; ctx.fillText(c, x, y); ctx.restore(); }
    }
    ctx.restore();

    // haz láser y chispas
    if (!rm && full < text.length && fade > .5) {
      const px = revealX, py = L.baseline - L.size * (0.25 + 0.3 * Math.abs(Math.sin(now / 60)));
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const beam = ctx.createLinearGradient(px, 0, px, py);
      beam.addColorStop(0, 'rgba(255,40,50,0)'); beam.addColorStop(1, 'rgba(255,60,70,.9)');
      ctx.strokeStyle = beam; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(px + 40, 40); ctx.lineTo(px, py); ctx.stroke();
      ctx.lineWidth = 10; ctx.strokeStyle = 'rgba(255,40,50,.15)'; ctx.stroke();
      const hot = ctx.createRadialGradient(px, py, 0, px, py, 46);
      hot.addColorStop(0, 'rgba(255,255,240,1)'); hot.addColorStop(.2, 'rgba(255,120,80,.8)'); hot.addColorStop(1, 'rgba(255,30,40,0)');
      ctx.fillStyle = hot; ctx.beginPath(); ctx.arc(px, py, 46, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      for (let k = 0; k < 4; k++) sparks.push({ x: px, y: py, vx: (Math.random() - .3) * 420, vy: -Math.random() * 380 - 60, life: 1 });
    }
    if (sparks.length) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
      sparks = sparks.filter((p) => (p.life -= dt * 2.2) > 0);
      for (const p of sparks) {
        p.vy += 900 * dt; p.x += p.vx * dt; p.y += p.vy * dt;
        ctx.strokeStyle = `rgba(255,${180 + p.life * 70},${90 + p.life * 120},${p.life})`; ctx.lineWidth = 2.2 * p.life;
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * .025, p.y - p.vy * .025); ctx.stroke();
      }
      ctx.restore();
    }

    // ejemplos que rotan solos mientras nadie escribe
    if (mode === 'demo' && progress >= text.length) {
      demoHold += dt;
      if (demoHold > 1.9) fade = Math.max(0, fade - dt * 2.5);
      if (fade === 0) { demoIdx = (demoIdx + 1) % EXAMPLES.length; setText(EXAMPLES[demoIdx], false); progress = 0; heat = []; demoHold = 0; fade = 1; }
    }
  }

  const loop = (now) => { draw(now); raf = visible ? requestAnimationFrame(loop) : 0; };
  const start = () => { if (!raf && visible) { last = performance.now(); raf = requestAnimationFrame(loop); } };
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; start(); }).observe(canvas);

  setText(EXAMPLES[0], false);
  draw(performance.now());

  input.addEventListener('input', () => {
    const clean = input.value.toLocaleUpperCase('es-MX').replace(/[^A-ZÁÉÍÓÚÜÑ .'-]/g, '').replace(/\s{2,}/g, ' ').slice(0, 14);
    if (clean !== input.value) input.value = clean;
    const name = clean.trim();
    if (name) {
      if (mode !== 'user') { mode = 'user'; setText('', false); fade = 1; }
      setText(name); haptic(4);
    } else {
      mode = 'demo'; demoHold = 0; fade = 1; setText(EXAMPLES[demoIdx], false); progress = 0;
    }
    setWa('placa', messages.placa(name));
    canvas.setAttribute('aria-label', name ? `Placa Águila de México con el nombre ${name} grabado` : 'Placa Águila de México con un nombre de ejemplo grabado');
    start();
  });
}
