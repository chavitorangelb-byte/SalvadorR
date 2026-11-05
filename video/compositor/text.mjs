// Capas de texto 2D (canvas -> textura) para tipografia cinetica, frases escritas por la tinta,
// la barra de busqueda y la end card. Cada capa solo se re-sube cuando cambia.
import * as THREE from './vendor/three.module.js';
import { clamp, easeOut, easeIn } from '../timeline/timeline.mjs';

export const DISPLAY = '900 {s}px "Big Shoulders Display"';
export const TEXT = (w) => `${w} {s}px "Barlow"`;
const font = (tpl, s) => tpl.replace('{s}', s.toFixed(2));

const scratch = document.createElement('canvas').getContext('2d');
export function measure(text, tpl, size) {
  scratch.font = font(tpl, size);
  const chars = [...text];
  const xs = [0];
  for (let i = 1; i <= chars.length; i++) xs.push(scratch.measureText(chars.slice(0, i).join('')).width);
  return { width: xs[xs.length - 1], xs, chars };
}

export class TextLayer {
  constructor(scene, x, y, w, h, scale = 1) {
    this.x = x; this.y = y; this.w = w; this.h = h; this.scale = scale;
    this.canvas = document.createElement('canvas');
    this.canvas.width = Math.ceil(w * scale); this.canvas.height = Math.ceil(h * scale);
    this.ctx = this.canvas.getContext('2d');
    this.tex = new THREE.CanvasTexture(this.canvas);
    this.tex.colorSpace = THREE.SRGBColorSpace;
    this.tex.flipY = true;
    this.tex.minFilter = THREE.LinearFilter; this.tex.generateMipmaps = false;
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ map: this.tex, transparent: true, depthTest: false, depthWrite: false, toneMapped: false }));
    this.mesh.position.set(x + w / 2, -(y + h / 2), 0);
    this.mesh.renderOrder = 30;
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
    this.sig = '';
  }
  begin(sig) {
    if (sig === this.sig) return null;
    this.sig = sig;
    const c = this.ctx;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, this.canvas.width, this.canvas.height);
    c.setTransform(this.scale, 0, 0, this.scale, -this.x * this.scale, -this.y * this.scale);
    return c;
  }
  end(visible) { this.tex.needsUpdate = true; this.mesh.visible = visible; }
  hide() { if (this.mesh.visible) { this.mesh.visible = false; this.sig = ''; } }
}

const BONE = '#EDEAE6', SILVER = '#C9C9C9';

// Tipografia cinetica por glifo. Cada palabra aterriza en su palabra de la locucion.
export class KineticGroup {
  constructor(scene, def, col, vo, scale) {
    this.def = def; this.col = col;
    const ref = (pair) => { const line = vo.find((l) => l.id === pair[0]); return line.words[pair[1]].t0; };
    // tamano: el mas grande que cabe en la columna
    let widest = 0;
    for (const line of def.lines) widest = Math.max(widest, measure(line.map((w) => w.text).join(' '), DISPLAY, 100).width);
    this.size = Math.min(col.max, (col.w / widest) * 100 * 0.985);
    this.lh = this.size * 0.93;
    const blockH = this.lh * def.lines.length;
    const top = col.cy - blockH / 2;
    this.glyphs = []; this.words = [];
    def.lines.forEach((line, li) => {
      const text = line.map((w) => w.text).join(' ');
      const m = measure(text, DISPLAY, this.size);
      let ci = 0;
      line.forEach((w, wi) => {
        const t0 = ref(w.vo);
        const start = ci;
        [...w.text].forEach((ch, k) => {
          this.glyphs.push({ ch, x: col.x + m.xs[ci], y: top + this.lh * (li + 1) - this.size * 0.14, w: m.xs[ci + 1] - m.xs[ci], t0: t0 - 0.2 + k * 0.026, gi: this.glyphs.length });
          ci++;
        });
        this.words.push({ text: w.text, t0, x0: col.x + m.xs[start], x1: col.x + m.xs[ci], base: top + this.lh * (li + 1) - this.size * 0.14, underline: w.underline });
        ci++;   // espacio
      });
    });
    const pad = 40;
    this.layer = new TextLayer(scene, col.x - pad, top - this.size * 0.4, col.w + pad * 2, blockH + this.size * 0.9, scale);
  }
  update(t) {
    const out = this.def.out;
    const first = Math.min(...this.glyphs.map((g) => g.t0));
    if (t < first - 0.01 || t > out[1] + 0.3) { this.layer.hide(); return; }
    const states = this.glyphs.map((g, i) => {
      const p = clamp((t - g.t0) / 0.36);
      const q = clamp((t - (out[0] + (this.glyphs.length - 1 - i) * 0.014)) / 0.24);
      return [p, q];
    });
    const sig = states.map(([p, q]) => `${p.toFixed(3)}:${q.toFixed(3)}`).join('|');
    const c = this.layer.begin(sig);
    if (!c) return;
    c.font = font(DISPLAY, this.size);
    c.textBaseline = 'alphabetic';
    let any = false;
    this.glyphs.forEach((g, i) => {
      const [p, q] = states[i];
      if (p <= 0 || q >= 1) return;
      any = true;
      const back = 1 + 2.1 * Math.pow(p - 1, 3) + 1.1 * Math.pow(p - 1, 2);   // ease out back suave
      const dy = (1 - back) * this.size * 0.55 - easeIn(q) * this.size * 0.35;
      const rot = (1 - easeOut(p)) * -0.11;
      c.save();
      c.globalAlpha = clamp(p / 0.35) * (1 - q);
      c.translate(g.x, g.y + dy);
      c.rotate(rot);
      c.fillStyle = BONE;
      c.fillText(g.ch, 0, 0);
      c.restore();
    });
    this.layer.end(any);
  }
}

// Frases que escribe la tinta: cada glifo aparece cuando la cabeza de la linea pasa por el.
export class WrittenGroup {
  constructor(scene, def, col, vo, scale) {
    this.def = def;
    let widest = 0;
    for (const line of def.lines) widest = Math.max(widest, measure(line, DISPLAY, 100).width);
    this.size = Math.min(col.max, (col.w / widest) * 100);
    this.lh = this.size * col.gap;
    const line = vo.find((l) => l.id === def.vo);
    // la escritura de cada renglon sigue las palabras de la locucion
    const words = line.words;
    const split = def.lines[0].split(' ').length;
    const tA = [words[0].t0 - 0.04, words[split - 1].t1];
    const tB = [words[split].t0 - 0.04, words[words.length - 1].t1];
    this.lines = def.lines.map((text, li) => {
      const m = measure(text, DISPLAY, this.size);
      const base = col.y + this.lh * (li + 1);
      return { text, m, x: col.x, base, t: li === 0 ? tA : tB };
    });
    this.layer = new TextLayer(scene, col.x - 30, col.y - 10, col.w + 260, this.lh * def.lines.length + this.size * 0.6, scale);
  }
  head(t, li) {        // posicion x de la cabeza de tinta en el renglon li
    const L = this.lines[li];
    const k = clamp((t - L.t[0]) / (L.t[1] - L.t[0]));
    return { k, x: L.x + L.m.width * (0.5 - 0.5 * Math.cos(Math.PI * k)) + 8 * k, y: L.base + this.size * 0.11 };
  }
  update(t) {
    const [c0, c1] = this.def.clear;
    if (t < this.lines[0].t[0] - 0.02 || t > c1 + 0.05) { this.layer.hide(); return; }
    const fade = 1 - clamp((t - c0) / (c1 - c0));
    const parts = [];
    this.lines.forEach((L, li) => {
      const h = this.head(t, li);
      L.m.chars.forEach((ch, i) => {
        const gx = L.x + (L.m.xs[i] + L.m.xs[i + 1]) / 2;
        parts.push(clamp((h.x - gx) / 46 + 0.5));
      });
    });
    const sig = parts.map((p) => p.toFixed(3)).join('') + fade.toFixed(3);
    const c = this.layer.begin(sig);
    if (!c) return;
    c.font = font(DISPLAY, this.size);
    let n = 0;
    this.lines.forEach((L) => {
      L.m.chars.forEach((ch, i) => {
        const p = parts[n++];
        if (p <= 0) return;
        c.save();
        c.globalAlpha = Math.min(1, p * 1.6) * fade;
        const sc = 1.06 - 0.06 * easeOut(p);
        c.translate(L.x + L.m.xs[i], L.base);
        c.scale(sc, sc);
        c.fillStyle = BONE;
        c.fillText(ch, 0, 0);
        c.restore();
      });
    });
    this.layer.end(true);
  }
}

export { BONE, SILVER, font };
