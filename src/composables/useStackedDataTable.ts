import { ref, onMounted, onUnmounted } from 'vue'

/** Below this width, table rows use a multi-line card layout instead of many narrow columns. */
export const STACKED_TABLE_MAX_WIDTH = 1100

/** Phone-sized layout tweaks (action bars, etc.). */
export const MOBILE_MAX_WIDTH = 640

function useMediaQuery(query: string) {
  const matches = ref(false)
  let mql: MediaQueryList | null = null
  const sync = () => { matches.value = mql?.matches ?? false }
  onMounted(() => {
    mql = window.matchMedia(query)
    matches.value = mql.matches
    mql.addEventListener('change', sync)
  })
  onUnmounted(() => {
    mql?.removeEventListener('change', sync)
    mql = null
  })
  return matches
}

export function useStackedDataTable() {
  const stackedRows = useMediaQuery(`(max-width: ${STACKED_TABLE_MAX_WIDTH}px)`)
  const isMobile = useMediaQuery(`(max-width: ${MOBILE_MAX_WIDTH}px)`)
  return { stackedRows, isMobile }
}
