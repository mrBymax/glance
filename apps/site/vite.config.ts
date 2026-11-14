import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));

export default defineConfig(({ isSsrBuild }) => ({
  // A relative base lets any static host serve the build from any folder. SITE_BASE sets an absolute base when a host needs one.
  // The server build for the prerender uses "/", and scripts/prerender.mjs makes its paths relative.
  base: process.env.SITE_BASE ?? (isSsrBuild ? '/' : './'),
  plugins: [react()],
  resolve: {
    alias: [
      // The theme loads Figtree from Google Fonts. This file loads the same font from the build, so the page makes no remote request.
      { find: /^@astryxdesign\/theme-neutral\/fonts\.css$/, replacement: fileURLToPath(new URL('./src/styles/fonts.css', import.meta.url)) },
    ],
    // The animation player lives in assets/animation at the repository root, outside this package.
    // Its import of "three" must resolve to the copy in this package.
    dedupe: ['three'],
  },
  server: {
    port: 18420,
    strictPort: true,
    fs: { allow: [repoRoot] },
  },
  preview: { port: 18421, strictPort: true },
  build: {
    target: 'es2022',
    assetsInlineLimit: 0,
  },
  test: { environment: 'jsdom', setupFiles: ['./src/test/setup.ts'], css: false },
}));
