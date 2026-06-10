/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
// Installable PWA (offline static app) + vitest config for the pure engine in src/lib.
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
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
