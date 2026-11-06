// Procesa el logo del visitante en su propio teléfono (no se sube a ningún lado):
// detecta fondo blanco, negro o transparente, lo quita con borde suave y sin halo,
// recorta, centra en un cuadrado y prepara una versión de hilos (≤6 colores) para el bordado.
const SIZE = 1024;

async function decode(file) {
  if (file.type === 'image/svg+xml' || /\.svg$/i.test(file.name)) {
    const url = URL.createObjectURL(file);
    try {
      const img = new Image(); img.src = url; await img.decode();
      const w = img.naturalWidth || 1024, h = img.naturalHeight || 1024; const k = 1400 / Math.max(w, h);
      const c = document.createElement('canvas'); c.width = Math.round(w * k); c.height = Math.round(h * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); return c;
    } finally { URL.revokeObjectURL(url); }
  }
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const k = Math.min(1, 1400 / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height); bmp.close?.();
  return c;
}

export async function processLogo(fileOrCanvas) {
  const src = fileOrCanvas instanceof HTMLCanvasElement ? fileOrCanvas : await decode(fileOrCanvas);
  const w = src.width, h = src.height;
  const x = src.getContext('2d', { willReadFrequently: true });
  const img = x.getImageData(0, 0, w, h); const p = img.data;

  // 1) fondo: mira el borde de la imagen
  let transparent = 0, n = 0; const border = [];
  const take = (i, j) => { const k = (j * w + i) * 4; n++; if (p[k + 3] < 24) transparent++; else border.push([p[k], p[k + 1], p[k + 2]]); };
  for (let i = 0; i < w; i += 2) { take(i, 0); take(i, h - 1); }
  for (let j = 0; j < h; j += 2) { take(0, j); take(w - 1, j); }
  let bg = null;
  if (transparent / n < .5 && border.length) {
    const med = [0, 1, 2].map((c) => border.map((b) => b[c]).sort((a, b) => a - b)[border.length >> 1]);
    const spread = border.filter((b) => Math.hypot(b[0] - med[0], b[1] - med[1], b[2] - med[2]) < 40).length / border.length;
    if (spread > .6) bg = med; // fondo parejo (blanco, negro o de un color)
  }
  if (bg) {
    for (let k = 0; k < p.length; k += 4) {
      const d = Math.hypot(p[k] - bg[0], p[k + 1] - bg[1], p[k + 2] - bg[2]);
      const a = Math.max(0, Math.min(1, (d - 22) / 46)) * (p[k + 3] / 255);
      if (a <= 0) { p[k + 3] = 0; continue; }
      // decontaminación: quita el color del fondo del borde semitransparente
      for (let c = 0; c < 3; c++) p[k + c] = Math.max(0, Math.min(255, (p[k + c] - bg[c] * (1 - a)) / a));
      p[k + 3] = a * 255;
    }
  }
  // 2) recorte al contenido
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (p[(j * w + i) * 4 + 3] > 20) { if (i < x0) x0 = i; if (i > x1) x1 = i; if (j < y0) y0 = j; if (j > y1) y1 = j; }
  if (x1 < 0) throw new Error('vacio');
  x.putImageData(img, 0, 0);
  const cw = x1 - x0 + 1, ch = y1 - y0 + 1;
  // 3) centrado en un cuadrado con margen
  const out = document.createElement('canvas'); out.width = out.height = SIZE;
  const o = out.getContext('2d', { willReadFrequently: true });
  const k = (SIZE * .9) / Math.max(cw, ch);
  o.imageSmoothingQuality = 'high';
  o.drawImage(src, x0, y0, cw, ch, (SIZE - cw * k) / 2, (SIZE - ch * k) / 2, cw * k, ch * k);
  // logos casi negros sobre gorra negra no se verían: se aclaran un poco para la vista previa
  const od = o.getImageData(0, 0, SIZE, SIZE); const q = od.data;
  let sumL = 0, cnt = 0;
  for (let i = 0; i < q.length; i += 16) if (q[i + 3] > 128) { sumL += .2126 * q[i] + .7152 * q[i + 1] + .0722 * q[i + 2]; cnt++; }
  const avgL = cnt ? sumL / cnt : 128;

  // 4) máscara blanca (para grabados) y versión de hilos (bordado) con ≤6 colores
  const mask = document.createElement('canvas'); mask.width = mask.height = SIZE;
  const mx = mask.getContext('2d'); const md = mx.createImageData(SIZE, SIZE);
  const thread = document.createElement('canvas'); thread.width = thread.height = SIZE;
  const tx = thread.getContext('2d'); const td = tx.createImageData(SIZE, SIZE);
  const pal = kmeans(q, 6);
  for (let i = 0; i < q.length; i += 4) {
    md.data[i] = md.data[i + 1] = md.data[i + 2] = 255; md.data[i + 3] = q[i + 3];
    if (q[i + 3] < 8) continue;
    let best = 0, bd = 1e9;
    for (let c = 0; c < pal.length; c++) { const d = (q[i] - pal[c][0]) ** 2 + (q[i + 1] - pal[c][1]) ** 2 + (q[i + 2] - pal[c][2]) ** 2; if (d < bd) { bd = d; best = c; } }
    let [r, g, b] = pal[best];
    if (avgL < 40) { r = r * .4 + 90; g = g * .4 + 90; b = b * .4 + 92; }
    td.data[i] = r; td.data[i + 1] = g; td.data[i + 2] = b; td.data[i + 3] = q[i + 3] > 110 ? 255 : 0;
  }
  mx.putImageData(md, 0, 0); tx.putImageData(td, 0, 0);
  return { canvas: out, mask, thread, dataURL: thumb(out), dark: avgL < 40, name: fileOrCanvas.name || 'Tu logo' };
}

function thumb(c) { const t = document.createElement('canvas'); t.width = t.height = 112; t.getContext('2d').drawImage(c, 0, 0, 112, 112); return t.toDataURL('image/png'); }

function kmeans(q, K) {
  const pts = [];
  for (let i = 0; i < q.length; i += 4 * 37) if (q[i + 3] > 128) pts.push([q[i], q[i + 1], q[i + 2]]);
  if (!pts.length) return [[255, 255, 255]];
  let cent = [pts[0]];
  while (cent.length < Math.min(K, pts.length)) { // k-means++ simplificado
    let far = pts[0], fd = -1;
    for (const p of pts) { const d = Math.min(...cent.map((c) => (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2 + (p[2] - c[2]) ** 2)); if (d > fd) { fd = d; far = p; } }
    if (fd < 300) break; cent.push(far);
  }
  for (let it = 0; it < 8; it++) {
    const acc = cent.map(() => [0, 0, 0, 0]);
    for (const p of pts) { let b = 0, bd = 1e9; cent.forEach((c, i) => { const d = (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2 + (p[2] - c[2]) ** 2; if (d < bd) { bd = d; b = i; } }); const a = acc[b]; a[0] += p[0]; a[1] += p[1]; a[2] += p[2]; a[3]++; }
    cent = acc.map((a, i) => (a[3] ? [a[0] / a[3], a[1] / a[3], a[2] / a[3]] : cent[i]));
  }
  return cent.map((c) => c.map(Math.round));
}

/** Logo de DIPROLASER (recortado por luminancia) como logo por default, sin resplandor. */
export async function defaultLogo() {
  const img = new Image(); img.src = 'img/brand/logo-960.webp'; await img.decode();
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
  const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0);
  const d = x.getImageData(0, 0, c.width, c.height); const p = d.data;
  for (let i = 0; i < p.length; i += 4) { const a = p[i + 3] / 255; p[i + 3] = Math.max(0, Math.min(1, (a - .45) / .22)) * 255; }
  x.putImageData(d, 0, 0);
  const r = await processLogo(c);
  r.name = 'DIPROLASER'; r.isDefault = true;
  return r;
}
