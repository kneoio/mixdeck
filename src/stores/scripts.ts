import { defineStore } from 'pinia'
import { ref } from 'vue'
import datanestApiService from '@/services/datanestApi'

export interface Script {
  id: string
  author?: string
  regDate?: string
  lastModifier?: string
  lastModifiedDate?: string
  name: string
  description: string
  defaultProfileId?: string
  labels?: string[]
  tags?: Array<{
    id: string
    name: string
    identifier?: string
    color?: string
    fontColor?: string
    category?: string
  }>
  languageTag?: string
  timingMode?: string
  slugName?: string
  requiredVariables?: Array<{ name: string; type: string; description: string; required?: boolean }>
}

export const useScriptsStore = defineStore('scripts', () => {
  const scripts = ref<Script[]>([])
  const loading = ref(false)
  const totalCount = ref(0)
  const pageNum = ref(1)
  const pageSize = ref(10)

  async function loadScripts(page = pageNum.value, size = pageSize.value) {
    loading.value = true
    try {
      const result = await datanestApiService.getPagedDictionary<Script>('/dictionary/scripts', page, size)
      scripts.value = result.entries
      totalCount.value = result.count
      pageNum.value = result.pageNum
      pageSize.value = result.pageSize
    } finally {
      loading.value = false
    }
  }

  return { scripts, loading, totalCount, pageNum, pageSize, loadScripts }
})
