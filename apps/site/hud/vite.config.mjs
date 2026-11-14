// Builds the HUD of the site into public/hud. See README.md in this folder: it needs the files of apps/display-pow
// and packages/shared next to these ones, and its own install of the Display toolkit.
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  plugins: [react()],
  resolve: { alias: { '@glance/shared': fileURLToPath(new URL('./shared/index.ts', import.meta.url)) } },
  build: { outDir: process.env.HUD_OUT_DIR, emptyOutDir: true, assetsInlineLimit: 0 },
});
