import { useRegisterSW } from 'virtual:pwa-register/vue'

let singleton: ReturnType<typeof createServiceWorkerState> | null = null

const POLL_INTERVAL_MS = 60 * 60 * 1000
// Avoid redundant back-to-back checks when visibilitychange and focus both fire.
const MIN_CHECK_GAP_MS = 60 * 1000

function createServiceWorkerState() {
  const { needRefresh, updateServiceWorker } = useRegisterSW({
    onRegistered(r) {
      if (!r) return

      let lastCheck = Date.now()
      const check = () => {
        const now = Date.now()
        if (now - lastCheck < MIN_CHECK_GAP_MS) return
        lastCheck = now
        r.update()
      }

      // Baseline poll for tabs left open and in the background.
      setInterval(check, POLL_INTERVAL_MS)

      // Catch the common case: user returns to a tab left open across a deploy.
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') check()
      })
      window.addEventListener('focus', check)
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
