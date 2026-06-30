// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  // Canonical site URL — used for absolute links and SEO.
  site: 'https://ongki.pro',
  // Collapse whitespace in the emitted HTML (default true, kept explicit).
  compressHTML: true,
  build: {
    // Inline small stylesheets to cut requests.
    inlineStylesheets: 'auto',
  },
  vite: {
    plugins: [/** @type {any} */ (tailwindcss())],
    build: {
      minify: 'esbuild',
      cssMinify: true,
    },
    esbuild: {
      // Strip console/debugger from the shipped bundle.
      drop: ['console', 'debugger'],
      legalComments: 'none',
    },
  },
});
