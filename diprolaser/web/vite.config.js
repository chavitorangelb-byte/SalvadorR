import { defineConfig } from 'vite';

// PREVIEW=1 npm run build  -> agrega noindex (vista previa para el cliente, no se indexa en Google)
const preview = process.env.PREVIEW === '1';

export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2020',
    assetsInlineLimit: 2048,
    cssCodeSplit: true,
    modulePreload: { polyfill: false },
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/three')) return 'three';
          if (id.includes('node_modules/gsap') || id.includes('node_modules/lenis')) return 'motion';
        },
      },
    },
  },
  plugins: [
    {
      // el CSS (8 KB comprimido) va dentro del HTML: la primera pantalla no espera otra petición
      name: 'diprolaser-inline-css',
      enforce: 'post',
      transformIndexHtml: {
        order: 'post',
        handler(html, ctx) {
          if (!ctx.bundle) return html;
          for (const [file, chunk] of Object.entries(ctx.bundle)) {
            if (chunk.type !== 'asset' || !file.endsWith('.css') || !html.includes(file)) continue;
            const css = String(chunk.source).replaceAll('url(../', 'url(./');
            html = html.replace(new RegExp(`<link rel="stylesheet"[^>]*${file.replace(/[.]/g, '\\.')}"[^>]*>`), `<style>${css}</style>`);
          }
          return html;
        },
      },
    },
    {
      name: 'diprolaser-preview-flag',
      transformIndexHtml(html) {
        return preview
          ? html.replace('<meta name="robots" content="index, follow">', '<meta name="robots" content="noindex, nofollow">')
          : html;
      },
    },
  ],
});
