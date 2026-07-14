import { useRegisterSW } from 'virtual:pwa-register/vue'

let singleton: ReturnType<typeof createServiceWorkerState> | null = null

function createServiceWorkerState() {
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

/** Registers the service worker once and shares the same reactive state across every caller. */
export function useServiceWorker() {
  if (!singleton) singleton = createServiceWorkerState()
  return singleton
}
