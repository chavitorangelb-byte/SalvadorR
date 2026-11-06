// Exporta imágenes a AVIF + WebP en varios anchos (public/img). Uso: node tools/export.mjs [grupo]
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
const K = '../kit';
const out = (p) => { fs.mkdirSync(path.dirname(p), { recursive: true }); return p; };
async function variants(src, dst, widths, { q = 72, aq = 50, alpha = true, fit = 'width', also = [] } = {}) {
  const meta = await sharp(src).metadata();
  const res = [];
  for (const w of widths) {
    const ww = Math.min(w, meta.width);
    const img = sharp(src).resize({ width: ww, withoutEnlargement: true, kernel: 'lanczos3' });
    await img.clone().avif({ quality: aq, effort: 6, chromaSubsampling: '4:4:4' }).toFile(out(`${dst}-${w}.avif`));
    await img.clone().webp({ quality: q, alphaQuality: 90, effort: 6, smartSubsample: true }).toFile(out(`${dst}-${w}.webp`));
    for (const ext of also) if (ext === 'png') await img.clone().png({ compressionLevel: 9, palette: false }).toFile(out(`${dst}-${w}.png`));
    const m = await sharp(`${dst}-${w}.webp`).metadata();
    res.push({ w, width: m.width, height: m.height });
  }
  return res;
}
const manifest = fs.existsSync('src/data/images.json') ? JSON.parse(fs.readFileSync('src/data/images.json')) : {};
const group = process.argv[2] || 'all';
if (group === 'all' || group === 'brand') {
  manifest['brand/logo'] = await variants('build/img/logo-keyed.png', 'public/img/brand/logo', [480, 960], { also: ['png'] });
  await sharp('build/img/label.png').resize(1024).webp({ quality: 92, alphaQuality: 100 }).toFile(out('public/img/brand/label.webp'));
  // favicons: logo oficial reducido sobre negro (sin redibujar)
  const logo = await sharp('build/img/logo-keyed.png').toBuffer();
  for (const [s, name] of [[32, 'favicon-32.png'], [180, 'apple-touch-icon.png'], [192, 'icon-192.png'], [512, 'icon-512.png']]) {
    const pad = Math.round(s * (s <= 32 ? 0.02 : 0.1));
    const inner = await sharp(logo).resize({ width: s - pad * 2, height: s - pad * 2, fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).toBuffer();
    await sharp({ create: { width: s, height: s, channels: 4, background: '#050506' } }).composite([{ input: inner, gravity: 'center' }]).png().toFile(out(`public/${name}`));
  }
}
if (group === 'all' || group === 'placa') {
  manifest['placa/sin-nombre'] = await variants(`${K}/placas/placa_aguila_sin_nombre.png`, 'public/img/placa/sin-nombre', [600, 920]);
  manifest['placa/real-sinaloa'] = await variants(`${K}/placas/placa_real_SINALOA_foto.jpg`, 'public/img/placa/real-sinaloa', [670], { alpha: false });
  manifest['placa/real-juarez'] = await variants(`${K}/placas/placa_real_JUAREZ_en_gorra_foto.jpg`, 'public/img/placa/real-juarez', [927], { alpha: false });
}
if (group === 'all' || group === 'promo') {
  for (const f of fs.readdirSync('build/promo-x4')) {
    const n = f.replace('.png', '').replace(/_/g, '-');
    manifest[`promo/${n}`] = await variants(`build/promo-x4/${f}`, `public/img/promo/${n}`, [400, 800]);
  }
  for (const f of fs.readdirSync('build/masks').filter((f) => f.endsWith('.png'))) {
    const n = f.replace('.png', '').replace(/_/g, '-');
    await sharp(`build/masks/${f}`).resize({ width: 800, withoutEnlargement: true }).png({ compressionLevel: 9 }).toFile(out(`public/img/promo/${n}-mask.png`));
  }
  fs.copyFileSync('build/masks/meta.json', 'src/data/promo-meta.json');
}
if (group === 'all' || group === 'caps') {
  for (const f of fs.readdirSync('build/caps-x4')) {
    const n = f.replace('.png', '').replace(/_/g, '-');
    manifest[`caps/${n}`] = await variants(`build/caps-x4/${f}`, `public/img/caps/${n}`, [640, 1200]);
  }
}
fs.writeFileSync('src/data/images.json', JSON.stringify(manifest, null, 1));
console.log('ok', Object.keys(manifest).length);
