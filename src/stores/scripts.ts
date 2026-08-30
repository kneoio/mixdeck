import { defineStore } from 'pinia'
import { ref } from 'vue'
import datanestApiService from '@/services/datanestApi'

export interface ScriptScene {
  id: string
  title?: string
  durationSeconds?: number
  talkativity?: number
  seqNum?: number
  oneTimeRun?: boolean
  sceneType?: 'LOOP' | 'ONE_TIME' | string
}

export interface Script {
  author?: string
  regDate?: string
  lastModifier?: string
  lastModifiedDate?: string
  name: string
  description: string
  color?: string
  defaultProfileSlug?: string
  labels?: string[]
  tags?: Array<{
    identifier: string
    name: string
    color?: string
    fontColor?: string
    category?: string
  }>
  languageTag?: string
  timingMode?: string
  custom?: boolean
  slugName: string
  requiredVariables?: Array<{ name: string; type: string; description: string; required?: boolean }>
  scenes?: ScriptScene[]
}

export const useScriptsStore = defineStore('scripts', () => {
  const scripts = ref<Script[]>([])
  const loading = ref(false)
  const totalCount = ref(0)
  const pageNum = ref(1)
  const pageSize = ref(10)

  async function loadScripts(page = pageNum.value, size = pageSize.value, query?: string) {
    loading.value = true
    try {
      const endpoint = query ? `/dictionary/scripts?${query}` : '/dictionary/scripts'
      const result = await datanestApiService.getPagedDictionary<Script>(endpoint, page, size)
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
