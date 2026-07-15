import { fileURLToPath, URL } from 'node:url'
import { webcrypto } from 'node:crypto'
import { defineConfig } from 'vite'

if (!globalThis.crypto) (globalThis as any).crypto = webcrypto
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import { VitePWA } from 'vite-plugin-pwa'
import { readFileSync } from 'node:fs'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8'))

export default defineConfig({
  plugins: [
    vue(),
    vueDevTools(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      devOptions: {
        enabled: true,
        suppressWarnings: true,
      },
      workbox: {
        globPatterns: [],
        navigateFallback: null,
        cleanupOutdatedCaches: true,
        // After skip-waiting the new SW must claim this tab, otherwise
        // controllerchange never fires and the update click can't reload.
        clientsClaim: true,
        // Stamp the SW with the app version so its bytes change every release.
        // Without this the generated sw.js is byte-identical across deploys and
        // the browser never detects an update, so needRefresh never fires.
        additionalManifestEntries: [{ url: 'index.html', revision: pkg.version }],
      },
      manifest: {
        name: 'Mixdeck',
        short_name: 'Mixdeck',
        theme_color: '#7C3AED',
        background_color: '#0a0a0a',
        display: 'standalone',
        icons: [],
      },
    }),
  ],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    },
  },
  build: {
    manifest: true,
  },
  server: {
    port: 5175,
    strictPort: true,
    host: true,

  },
  preview: {
    port: 3043,
    strictPort: true,
    host: true,
  },
})
