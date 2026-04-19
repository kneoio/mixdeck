import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

export default defineConfig({
  plugins: [
    vue(),
    vueDevTools(),
  ],
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
    proxy: {
      '/datanest': { target: 'http://localhost:38799', rewrite: (path) => path.replace(/^\/datanest/, '') },
      '/metriq': { target: 'http://localhost:38790', rewrite: (path) => path.replace(/^\/metriq/, '') },
    },
  },
  preview: {
    port: 3043,
    strictPort: true,
    host: true,
  },
})
