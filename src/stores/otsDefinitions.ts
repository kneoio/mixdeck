import { defineStore } from 'pinia'
import { ref } from 'vue'
import datanestApiService from '@/services/datanestApi'
import aivoxApiService from '@/services/aivoxApi'

export interface OtsDefinition {
  id: string
  author?: string
  regDate?: string
  lastModifier?: string
  lastModifiedDate?: string
  name?: string
  slugName?: string
  scriptId: string
  userVariables: Record<string, any>
  brandId: string | null
  agentId: string | null
  status?: string
  type?: string
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
    filter?: { brandId?: string; searchTerm?: string; activated?: boolean }
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

  async function fetchOtsDefinition(id: string) {
    return datanestApiService.getOtsDefinition(id)
  }

  async function createOtsDefinition(data: Pick<OtsDefinition, 'scriptId' | 'userVariables' | 'brandId' | 'agentId'>) {
    return datanestApiService.createOtsDefinition(data)
  }

  async function updateOtsDefinition(id: string, data: Partial<OtsDefinition>) {
    const { id: _id, author: _a, regDate: _r, lastModifier: _lm, lastModifiedDate: _lmd, name: _n, slugName: _s, ...payload } = data as OtsDefinition
    return datanestApiService.updateOtsDefinition(id, payload)
  }

  async function deleteOtsDefinition(id: string) {
    return aivoxApiService.deleteOtsDefinition(id)
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
