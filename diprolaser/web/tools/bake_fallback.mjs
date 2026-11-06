// Hornea el visor sin WebGL: por modelo, 16 ángulos con sombreado (gris neutro) e ids/UV del logo.
// Uso: (con vite preview corriendo) node tools/bake_fallback.mjs [url]
import { createRequire } from 'node:module';
import fs from 'node:fs';
import sharp from 'sharp';
const { chromium } = createRequire(import.meta.url)('playwright');
const url = process.argv[2] || 'http://localhost:4173/';
const MODELS = ['tela', 'gamuza', 'micro', 'impermeable', 'trucker', 'bicolor'];
const N = 16;
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
await p.goto(url);
await p.evaluate(() => document.getElementById('configurador').scrollIntoView());
await p.waitForFunction(() => window.__cfg, null, { timeout: 90000 });
await p.evaluate(() => window.__cfg.stopAuto());
for (const m of MODELS) {
  if (m !== 'tela') { await p.click(`[data-group="model"] [data-value="${m}"]`); await p.waitForTimeout(2600); }
  const dir = `public/img/fallback/${m}`; fs.mkdirSync(dir, { recursive: true });
  for (let i = 0; i < N; i++) {
    const yaw = -i / N * Math.PI * 2;
    const { shade, id } = await p.evaluate((y) => window.__cfg.bake(y, .14, 480), yaw);
    const sb = Buffer.from(shade.split(',')[1], 'base64'), ib = Buffer.from(id.split(',')[1], 'base64');
    await sharp(sb).webp({ quality: 74, alphaQuality: 80 }).toFile(`${dir}/${i}-s.webp`);
    await sharp(ib).png({ compressionLevel: 9, palette: false }).toFile(`${dir}/${i}-i.png`);
  }
  console.log('ok', m);
}
await b.close();
