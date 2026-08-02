import { defineStore } from 'pinia'
import { ref } from 'vue'
import datanestApiService from '@/services/datanestApi'

/** Mixdeck public OTS definition — keyed by slugName; no document UUID. */
export interface OtsDefinition {
  slugName: string
  name?: string
  scriptSlug: string
  userVariables: Record<string, any>
  brandSlug: string | null
  agentSlug: string | null
  status?: string
  statusHistory?: unknown
  type?: string
  estimatedDurationMin?: number
  chatContext?: unknown
  color?: string
  requiredVariables?: unknown
  author?: string
  regDate?: string
  lastModifier?: string
  lastModifiedDate?: string
}

export const useOtsDefinitionsStore = defineStore('otsDefinitions', () => {
  const otsDefinitions = ref<OtsDefinition[]>([])
  const loading = ref(false)
  const totalCount = ref(0)
  const pageNum = ref(1)
  const pageSize = ref(10)
  const maxPage = ref(1)

  async function loadOtsDefinitions(
    page = pageNum.value,
    size = pageSize.value,
    filter?: { brandSlug?: string; searchTerm?: string; activated?: boolean }
  ) {
    loading.value = true
    try {
      const result = await datanestApiService.getOtsDefinitions(page, size, filter)
      otsDefinitions.value = result.entries
      totalCount.value = result.count
      pageNum.value = result.pageNum
      pageSize.value = result.pageSize
      maxPage.value = result.maxPage
    } finally {
      loading.value = false
    }
  }

  async function fetchOtsDefinition(slugName: string) {
    return datanestApiService.getOtsDefinition(slugName)
  }

  async function createOtsDefinition(
    data: Pick<OtsDefinition, 'name' | 'scriptSlug' | 'userVariables' | 'brandSlug' | 'agentSlug'>
  ) {
    return datanestApiService.createOtsDefinition(data)
  }

  async function updateOtsDefinition(slugName: string, data: Partial<OtsDefinition>) {
    const {
      author: _a,
      regDate: _r,
      lastModifier: _lm,
      lastModifiedDate: _lmd,
      slugName: _s,
      statusHistory: _sh,
      ...payload
    } = data as OtsDefinition
    return datanestApiService.updateOtsDefinition(slugName, payload)
  }

  async function deleteOtsDefinition(slugName: string) {
    return datanestApiService.deleteOtsDefinition(slugName)
  }

  return {
    otsDefinitions,
    loading,
    totalCount,
    pageNum,
    pageSize,
    maxPage,
    loadOtsDefinitions,
    fetchOtsDefinition,
    createOtsDefinition,
    updateOtsDefinition,
    deleteOtsDefinition,
  }
})
