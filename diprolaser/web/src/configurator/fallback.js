// Sin WebGL (o celular muy lento): giro con cuadros pre-renderizados de la misma gorra 3D.
// Cada cuadro trae el sombreado en gris neutro y una imagen de ids (corona, visera, abajo) con las
// coordenadas del logo, así se recolorea por parte y el logo sigue la curva del frente. Nada se rompe.
const N = 16, SIZE = 480;
const FRAME_OF = { front: 0, side: 4, back: 8, visor: 1, under: 15 };
const load = (src) => new Promise((res, rej) => { const i = new Image(); i.decoding = 'async'; i.onload = () => res(i); i.onerror = rej; i.src = src; });
const hexRgb = (h) => [1, 3, 5].map((k) => parseInt(h.slice(k, k + 2), 16));

export function createFallback(host, cfg, { logo, colors } = {}) {
  host.querySelector('[data-cfg-poster]')?.remove();
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = SIZE;
  canvas.style.cssText = 'position:absolute;inset:0;margin:auto;width:auto;height:100%;max-width:100%;aspect-ratio:1;touch-action:pan-y;cursor:grab';
  canvas.setAttribute('aria-hidden', 'true');
  host.append(canvas);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const work = document.createElement('canvas'); work.width = work.height = SIZE;
  const wctx = work.getContext('2d', { willReadFrequently: true });
  let frame = 0, model = cfg.model, logoData = null, current = logo;
  const cache = new Map(); // model -> [{shade, id}]
  const refs = new Map();

  async function getFrame(m, i) {
    if (!cache.has(m)) cache.set(m, []);
    const arr = cache.get(m);
    if (arr[i]) return arr[i];
    const [s, d] = await Promise.all([load(`img/fallback/${m}/${i}-s.webp`), load(`img/fallback/${m}/${i}-i.png`)]);
    wctx.clearRect(0, 0, SIZE, SIZE); wctx.drawImage(s, 0, 0); const shade = wctx.getImageData(0, 0, SIZE, SIZE);
    wctx.clearRect(0, 0, SIZE, SIZE); wctx.drawImage(d, 0, 0); const id = wctx.getImageData(0, 0, SIZE, SIZE);
    arr[i] = { shade, id };
    if (!refs.has(m)) { // brillo de referencia: mediana de la corona en este cuadro
      const v = []; for (let k = 0; k < id.data.length; k += 16) if (Math.round(id.data[k] / 60) === 1 && shade.data[k + 3] > 200) v.push(shade.data[k]);
      v.sort((a, b) => a - b); refs.set(m, (v[v.length >> 1] || 110) / 255);
    }
    return arr[i];
  }
  function prepLogo() {
    if (!current) { logoData = null; return; }
    const src = cfg.tech === 'bordado' ? current.thread : current.canvas;
    const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
    x.drawImage(src, 0, 0, 256, 256); logoData = x.getImageData(0, 0, 256, 256).data;
  }
  async function draw() {
    const m = model, i = frame;
    const f = await getFrame(m, i);
    if (m !== model || i !== frame) return;
    const ref = refs.get(m) || .45;
    const out = ctx.createImageData(SIZE, SIZE); const o = out.data, s = f.shade.data, d = f.id.data;
    const C = [null, hexRgb(colors[cfg.colors.crown][1]), hexRgb(colors[cfg.colors.visor][1]), hexRgb(colors[cfg.colors.under][1])];
    C[4] = C[1];
    const tech = cfg.tech;
    for (let k = 0; k < o.length; k += 4) {
      const a = s[k + 3]; if (a === 0) continue;
      const part = Math.round(d[k] / 60);
      if (part === 0) { o[k] = s[k]; o[k + 1] = s[k + 1]; o[k + 2] = s[k + 2]; o[k + 3] = a; continue; }
      const r = s[k] / 255 / ref; const base = C[part] || C[1];
      const hl = Math.max(0, r - 1) * 110;
      let R = base[0] * Math.min(r, 1.15) + hl, G = base[1] * Math.min(r, 1.15) + hl, B = base[2] * Math.min(r, 1.15) + hl;
      if (part === 4 && logoData) {
        const u = d[k + 1] / 255, v = d[k + 2] / 255;
        // en placa y parche el logo va más chico, dentro de la pieza (como en 3D)
        const sc = tech === 'placa' ? .7 : tech === 'parche' ? .72 : 1;
        const lu = (u - .5) / sc + .5, lv = (v - .5) / sc + .5;
        const inside = lu >= 0 && lu < 1 && lv >= 0 && lv < 1;
        const li = inside ? ((Math.min(255, Math.floor((1 - lv) * 256)) * 256) + Math.min(255, Math.floor(lu * 256))) * 4 : 0;
        const lm = inside ? logoData[li + 3] / 255 : 0;
        const sh = Math.min(1.25, Math.max(.55, r));
        if (tech === 'placa' || tech === 'parche') {
          const inDisc = tech === 'placa' ? Math.hypot(u - .5, v - .5) < .484 : (Math.abs(u - .5) < .48 && Math.abs(v - .5) < .36);
          if (inDisc) {
            const mc = tech === 'placa' ? [44, 45, 50] : [150, 100, 60];
            const ec = tech === 'placa' ? [152, 155, 162] : [40, 18, 6];
            R = (mc[0] + (ec[0] - mc[0]) * lm) * sh; G = (mc[1] + (ec[1] - mc[1]) * lm) * sh; B = (mc[2] + (ec[2] - mc[2]) * lm) * sh;
          }
        } else if (lm > 0) {
          let lr = logoData[li], lg = logoData[li + 1], lb = logoData[li + 2];
          if (tech === 'laser') { const L = (R + G + B) / 3; lr = L < 30 ? 70 : R * .42; lg = L < 30 ? 66 : G * .36; lb = L < 30 ? 62 : B * .30; }
          R = R * (1 - lm) + lr * sh * lm; G = G * (1 - lm) + lg * sh * lm; B = B * (1 - lm) + lb * sh * lm;
        }
      }
      o[k] = R; o[k + 1] = G; o[k + 2] = B; o[k + 3] = a;
    }
    ctx.putImageData(out, 0, 0);
  }
  // precarga los demás ángulos del modelo en segundo plano
  const preload = (m) => { for (let i = 1; i < N; i++) getFrame(m, i).catch(() => {}); };

  // arrastrar para girar (con inercia)
  let sx = 0, sf = 0, dragging = false, vel = 0, lx = 0, lt = 0, raf = 0;
  canvas.addEventListener('pointerdown', (e) => { dragging = true; sx = lx = e.clientX; sf = frame; lt = performance.now(); vel = 0; cancelAnimationFrame(raf); canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const now = performance.now(); vel = (e.clientX - lx) / Math.max(1, now - lt); lx = e.clientX; lt = now;
    const nf = ((sf - Math.round((e.clientX - sx) / 22)) % N + N) % N;
    if (nf !== frame) { frame = nf; draw(); }
  });
  const end = () => {
    if (!dragging) return; dragging = false;
    let v = -vel * 12; let acc = 0;
    const step = () => { acc += v; v *= .9; if (Math.abs(acc) >= 1) { frame = ((frame + Math.sign(acc)) % N + N) % N; acc -= Math.sign(acc); draw(); } if (Math.abs(v) > .05) raf = requestAnimationFrame(step); };
    step();
  };
  canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', end);

  prepLogo(); draw().then(() => preload(model));
  return {
    update(c) { cfg = c; if (c.model !== model) { model = c.model; draw().then(() => preload(model)); } else { prepLogo(); draw(); } },
    setLogo(l) { current = l; prepLogo(); draw(); },
    setView(v) { if (v in FRAME_OF) { frame = FRAME_OF[v]; draw(); } },
    async snapshot() { await draw(); const c = document.createElement('canvas'); c.width = c.height = 1080; const x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(canvas, 0, 0, 1080, 1080); return c; },
  };
}
