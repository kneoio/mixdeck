import { useRegisterSW } from 'virtual:pwa-register/vue'

export function useServiceWorker() {
  const { needRefresh, updateServiceWorker } = useRegisterSW({
    onRegistered(r) {
      // Poll for updates every 60 minutes
      if (r) {
        setInterval(() => r.update(), 60 * 60 * 1000)
      }
    },
  })

  function applyUpdate() {
    updateServiceWorker(true)
  }

  return { needRefresh, applyUpdate }
}
