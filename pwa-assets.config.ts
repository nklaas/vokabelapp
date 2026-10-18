// Generates the PNG app icons from public/icon-source.svg (full-bleed square; iOS rounds the corners itself).
// Run with: npx pwa-assets-generator
import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

export default defineConfig({
  preset: {
    ...minimal2023Preset,
    transparent: { ...minimal2023Preset.transparent, padding: 0 },
    maskable: { ...minimal2023Preset.maskable, padding: 0 },
    apple: { ...minimal2023Preset.apple, padding: 0 },
  },
  images: ['public/icon-source.svg'],
})
