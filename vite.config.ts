import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// BASE_PATH is set to "/<repo-name>/" when building for GitHub Pages (step 4).
const base = process.env.BASE_PATH ?? '/'

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Vokabelapp',
        short_name: 'Vokabeln',
        description: 'Personal English and Spanish vocabulary trainer',
        display: 'standalone',
        start_url: base,
        scope: base,
        background_color: '#f7f7f8',
        theme_color: '#2f6fde',
        // Generated from public/icon-source.svg with `npx pwa-assets-generator`.
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
})
