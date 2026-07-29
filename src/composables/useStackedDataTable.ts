import { ref, watch, onUnmounted } from 'vue'

/**
 * Stack when the *table container* is at or below this width (not the window).
 * Playlist/Received need ~1200px for title+artist+genres+labels+rating+played+boost.
 */
export const STACKED_TABLE_MAX_WIDTH = 1200

/** Phone-sized layout tweaks (action bars, etc.). */
export const MOBILE_MAX_WIDTH = 640

function useMediaQuery(query: string) {
  const matches = ref(false)
  let mql: MediaQueryList | null = null
  const sync = () => { matches.value = mql?.matches ?? false }

  if (typeof window !== 'undefined') {
    mql = window.matchMedia(query)
    matches.value = mql.matches
    mql.addEventListener('change', sync)
    onUnmounted(() => {
      mql?.removeEventListener('change', sync)
      mql = null
    })
  }

  return matches
}

/**
 * Prefer binding `tableWrapRef` to a wrapper around the data table so stacking
 * follows the content column (sidebar takes space) as the window is resized.
 */
export function useStackedDataTable(threshold = STACKED_TABLE_MAX_WIDTH) {
  const stackedRows = ref(false)
  const tableWrapRef = ref<HTMLElement | null>(null)
  const isMobile = useMediaQuery(`(max-width: ${MOBILE_MAX_WIDTH}px)`)
  let observer: ResizeObserver | null = null

  function applyWidth(width: number) {
    stackedRows.value = width > 0 && width <= threshold
  }

  function observe(el: HTMLElement | null) {
    observer?.disconnect()
    observer = null
    if (!el || typeof ResizeObserver === 'undefined') {
      if (typeof window !== 'undefined') {
        applyWidth(window.innerWidth)
      }
      return
    }
    observer = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? el.clientWidth
      applyWidth(w)
    })
    observer.observe(el)
    applyWidth(el.clientWidth)
  }

  watch(tableWrapRef, (el) => observe(el), { flush: 'post', immediate: true })

  onUnmounted(() => {
    observer?.disconnect()
    observer = null
  })

  return { stackedRows, isMobile, tableWrapRef }
}
