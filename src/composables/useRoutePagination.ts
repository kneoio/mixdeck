import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

function parsePositiveInt(raw: unknown, fallback: number): number {
  if (typeof raw !== 'string') return fallback
  const n = parseInt(raw, 10)
  return Number.isFinite(n) && n >= 1 ? n : fallback
}

/** Persist list page/pageSize in the route query so returnTo / remount keeps the same page. */
export function useRoutePagination(defaults: { page?: number; pageSize?: number } = {}) {
  const defaultPage = defaults.page ?? 1
  const defaultPageSize = defaults.pageSize ?? 10
  const route = useRoute()
  const router = useRouter()

  const pageNum = ref(parsePositiveInt(route.query.page, defaultPage))
  const pageSize = ref(parsePositiveInt(route.query.pageSize, defaultPageSize))

  function syncToQuery() {
    const nextPage = pageNum.value <= 1 ? undefined : String(pageNum.value)
    const nextSize = pageSize.value === defaultPageSize ? undefined : String(pageSize.value)
    const curPage = typeof route.query.page === 'string' ? route.query.page : undefined
    const curSize = typeof route.query.pageSize === 'string' ? route.query.pageSize : undefined
    if (curPage === nextPage && curSize === nextSize) return

    const query = { ...route.query }
    if (nextPage) query.page = nextPage
    else delete query.page
    if (nextSize) query.pageSize = nextSize
    else delete query.pageSize
    void router.replace({ query })
  }

  function setPage(page: number) {
    pageNum.value = page
    syncToQuery()
  }

  function setPageSize(size: number) {
    pageSize.value = size
    pageNum.value = 1
    syncToQuery()
  }

  /** Reset to first page (e.g. search/sort change) and sync URL. */
  function resetPage() {
    pageNum.value = 1
    syncToQuery()
  }

  return { pageNum, pageSize, setPage, setPageSize, resetPage, syncToQuery }
}
