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
      name: 'diprolaser-preview-flag',
      transformIndexHtml(html) {
        return preview
          ? html.replace('<meta name="robots" content="index, follow">', '<meta name="robots" content="noindex, nofollow">')
          : html;
      },
    },
  ],
});
