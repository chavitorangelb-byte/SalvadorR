// Sin WebGL (o celular muy lento): visor con las fotos reales del modelo. Nada se rompe:
// el resumen, la descarga y WhatsApp siguen funcionando.
const PHOTOS = {
  tela: ['tela-negra'], gamuza: ['gamuza-camel-bicolor', 'gamuza-roja-bicolor'], micro: ['microperforada-negra'],
  impermeable: ['impermeable-perforada-negra', 'placa-aguila-lado-bandera'], trucker: ['trucker-malla-negra'], bicolor: ['beige-bicolor', 'gamuza-camel-bicolor'],
};
export function createFallback(host, cfg, { logo } = {}) {
  host.querySelector('[data-cfg-poster]')?.remove();
  const wrap = document.createElement('div');
  wrap.style.cssText = 'position:absolute;inset:6%;display:grid;place-items:center;touch-action:pan-y';
  const img = document.createElement('img');
  img.style.cssText = 'max-width:100%;max-height:100%;object-fit:contain;filter:drop-shadow(0 24px 30px rgba(0,0,0,.7));transition:opacity .3s';
  img.alt = ''; img.width = 1200; img.height = 800; img.decoding = 'async';
  const chip = document.createElement('div');
  chip.className = 'glass'; chip.style.cssText = 'position:absolute;left:12px;bottom:12px;display:flex;gap:10px;align-items:center;padding:8px 12px 8px 8px;border-radius:16px;font-size:.82rem';
  const th = document.createElement('img'); th.width = th.height = 44; th.alt = 'Tu logo'; th.style.cssText = 'border-radius:10px;background:#1c1c22;object-fit:contain';
  const tt = document.createElement('span'); tt.textContent = 'Tu logo para la cotización';
  chip.append(th, tt);
  wrap.append(img); host.append(wrap, chip);
  let i = 0;
  const show = () => { const list = PHOTOS[cfg.model]; const f = list[i % list.length]; img.src = `img/caps/${f}-1200.webp`; };
  let sx = 0;
  wrap.addEventListener('pointerdown', (e) => { sx = e.clientX; });
  wrap.addEventListener('pointerup', (e) => { if (Math.abs(e.clientX - sx) > 30) { i += e.clientX < sx ? 1 : -1 + PHOTOS[cfg.model].length; show(); } });
  const setLogo = (l) => { chip.hidden = !l; if (l) th.src = l.dataURL; };
  setLogo(logo); show();
  return {
    update(c) { cfg = c; show(); },
    setLogo,
    async snapshot() { const c = document.createElement('canvas'); c.width = c.height = 1080; const x = c.getContext('2d'); await img.decode().catch(() => {}); const k = Math.min(1000 / img.naturalWidth, 1000 / img.naturalHeight); x.drawImage(img, (1080 - img.naturalWidth * k) / 2, (1080 - img.naturalHeight * k) / 2, img.naturalWidth * k, img.naturalHeight * k); return c; },
  };
}
