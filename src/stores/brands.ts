import { defineStore } from 'pinia'
import { ref } from 'vue'
import datanestApiService from '@/services/datanestApi'

export type BrandStatus = 'OFF_LINE' | 'ON_LINE' | 'QUEUE_SATURATED' | 'WARMING_UP' | 'IDLE' | 'SYSTEM_ERROR'
export type ManagedBy = 'ITSELF' | 'AI_AGENT' | 'MIX'
export type SubmissionPolicy = 'NOT_ALLOWED' | 'REVIEW_REQUIRED' | 'NO_RESTRICTIONS'
export type AiAgentMode = 'BASIC' | 'SCRIPT_FOLLOWING'

export interface Brand {
  id?: string
  author: string
  regDate: string
  lastModifier: string
  lastModifiedDate: string
  status?: BrandStatus
  title?: string
  localizedName: Record<string, string>
  country?: string
  description?: string
  color?: string
  slugName?: string
  url?: string
  hlsUrl?: string
  timeZone?: string
  aiAgentId?: string
  profileId?: string
  managedBy?: ManagedBy
  aiAgentMode?: AiAgentMode
  oneTimeStreamPolicy?: SubmissionPolicy
  submissionPolicy?: SubmissionPolicy
  messagingPolicy?: SubmissionPolicy
  aiOverriding?: { prompt?: string; talkativity?: number }
  scriptId?: string
  scriptIds?: Array<{ scriptId: string; userVariables?: Record<string, any> }>
  customScriptId?: string
  profileOverriding?: { name?: string; description?: string }
  titleFont?: string
  owner?: { name?: string; email?: string; coOwners?: Array<{ name: string; email: string }> }
  publicBrand?: number
  bitRate?: number
  mixplaUrl?: string
  mp3Url?: string
  streamingOptions?: { codecs?: string[] }
  genres?: string[]
  labels?: string[]
}

export const SUBMISSION_POLICY_OPTIONS: { label: string; value: SubmissionPolicy }[] = [
  { label: 'Not Allowed', value: 'NOT_ALLOWED' },
  { label: 'Review Required', value: 'REVIEW_REQUIRED' },
  { label: 'No Restrictions', value: 'NO_RESTRICTIONS' },
]

export const useBrandsStore = defineStore('brands', () => {
  const brands = ref<Brand[]>([])
  const loading = ref(false)
  const totalCount = ref(0)
  const pageNum = ref(1)
  const pageSize = ref(10)
  const maxPage = ref(1)
  const streamingStates = ref<Record<string, boolean>>({})
  const heartbeatPulses = ref<Record<string, number>>({})

  async function loadBrands() {
    loading.value = true
    try {
      const entries = await datanestApiService.getDictionary<Brand>('/public/brands')
      brands.value = entries
      totalCount.value = entries.length
      pageNum.value = 1
      pageSize.value = entries.length
      maxPage.value = 1
    } finally {
      loading.value = false
    }
  }

  async function fetchBrand(slug: string) {
    return datanestApiService.getDocument<Brand>('/public/brands', slug)
  }

  async function saveBrand(slug: string | null, data: Partial<Brand>) {
    const { id: _id, author: _a, regDate: _r, lastModifier: _lm, lastModifiedDate: _lmd, status: _s, ...payload } = data as Brand
    if (slug) return datanestApiService.updateDictionaryItem<Brand>('/public/brands', slug, payload)
    return datanestApiService.createDictionaryItem<Brand>('/public/brands', payload)
  }

  async function deleteBrand(slug: string) {
    return datanestApiService.deleteDictionaryItem('/brands', slug)
  }

  async function closeBrand(slug: string) {
    return datanestApiService.post(`/public/brands/${encodeURIComponent(slug)}/close`, {})
  }

  function setStreamingState(slug: string, alive: boolean) {
    streamingStates.value[slug] = alive
  }

  function pulseHeartbeat(slug: string) {
    heartbeatPulses.value[slug] = (heartbeatPulses.value[slug] ?? 0) + 1
  }

  return {
    brands,
    loading,
    totalCount,
    pageNum,
    pageSize,
    maxPage,
    streamingStates,
    heartbeatPulses,
    loadBrands,
    fetchBrand,
    saveBrand,
    deleteBrand,
    closeBrand,
    setStreamingState,
    pulseHeartbeat
  }
})
