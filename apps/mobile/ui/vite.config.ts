import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // A relative base lets the Android app load the build from each asset path.
  base: './',
  plugins: [react()],
  resolve: {
    // The theme loads its font from Google Fonts. This file loads the same font from the build, because the phone can be offline.
    alias: [{ find: /^@astryxdesign\/theme-neutral\/fonts\.css$/, replacement: fileURLToPath(new URL('./src/styles/fonts.css', import.meta.url)) }],
  },
  server: {
    // The phone reaches the dev server through the network address of this machine.
    host: true,
    port: 5173,
    strictPort: true,
    proxy: { '/api': { target: process.env.GLANCE_SERVER_ORIGIN ?? 'http://localhost:8080', changeOrigin: true } },
  },
  test: { environment: 'jsdom', setupFiles: ['./src/test/setup.ts'], css: false },
});
