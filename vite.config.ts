/// <reference types="vitest/config" />
import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
// Installable PWA (offline static app) + vitest config for the pure engine in src/lib.
// `dice-capture` branch only: capture-lab.html and bench.html are separate build
// entries for the isolated recognition experiment; the main app at / never imports them.
export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        'capture-lab': resolve(__dirname, 'capture-lab.html'),
        bench: resolve(__dirname, 'bench.html'),
        realbench: resolve(__dirname, 'realbench.html'),
        kbench: resolve(__dirname, 'kbench.html'),
      },
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      // dice-capture branch: the experiment entries (lab/bench) pull in the ~10MB
      // OpenCV wasm chunk. Keep those out of the shipped app's service-worker precache
      // so the PWA stays small — they're R&D, not part of the app.
      workbox: {
        globIgnores: ['**/engines-*.js', '**/bench-*.js', '**/capture-lab-*.js'],
      },
      manifest: {
        name: "Liar's Dice Helper",
        short_name: "Liar's Dice",
        description: "Live probability helper for Liar's Dice (no wilds).",
        theme_color: '#0e1419',
        background_color: '#0e1419',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
        ],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
  },
})
