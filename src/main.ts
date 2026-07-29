import './assets/main.css'
import './assets/data-table-stacked.css'

// Reload once on chunk load failures caused by a stale deployment
window.addEventListener('vite:preloadError', () => {
  const key = '__mixdeck_chunk_reload__'
  if (!sessionStorage.getItem(key)) {
    sessionStorage.setItem(key, '1')
    window.location.reload()
  }
})

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import naive from 'naive-ui'

import App from './App.vue'
import router from './router'
import i18n from './i18n'

const app = createApp(App)

app.use(createPinia())
app.use(router)
app.use(naive)
app.use(i18n)

app.mount('#app')
