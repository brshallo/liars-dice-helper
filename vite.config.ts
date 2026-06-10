/// <reference types="vitest/config" />
import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import basicSsl from '@vitejs/plugin-basic-ssl'

// `npm run dev:https` (HTTPS=true) serves over self-signed HTTPS so the camera works
// on a phone over the LAN (getUserMedia needs a secure context; plain http LAN is blocked).
const useHttps = process.env.HTTPS === 'true'

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
    ...(useHttps ? [basicSsl()] : []),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      // dice-capture branch: the experiment entries (lab/bench/train) pull in big chunks
      // (OpenCV wasm ~10MB, TF.js ~880KB) + the model. The main app never loads them, so
      // keep them all out of the shipped app's service-worker precache — they're R&D.
      workbox: {
        globIgnores: [
          '**/engines-*.js',
          '**/twostage-*.js',
          '**/bench-*.js',
          '**/capture-lab-*.js',
          '**/realbench-*.js',
          '**/kbench-*.js',
          'bench.html',
          'capture-lab.html',
          'realbench.html',
          'kbench.html',
          'models/**',
        ],
      },
      manifest: {
        name: "Cheating Liar's Dice",
        short_name: "Cheating Dice",
        description: "Cheating Liar's Dice — track each player's dice and see the live probability that any bid is true.",
        theme_color: '#f4f1ea',
        background_color: '#f4f1ea',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
        ],
      },
    }),
  ],
  // Expose the dev server on the local network (0.0.0.0) so phones on the same
  // Wi-Fi can open it via the Mac's LAN IP — no tunnel, nothing leaves the network.
  server: {
    host: true,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
  },
})
