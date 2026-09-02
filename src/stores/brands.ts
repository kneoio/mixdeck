import { defineStore } from 'pinia'
import { ref } from 'vue'
import datanestApiService from '@/services/datanestApi'
import type { EntitlementAction } from '@/utils/entitlements'

export type BrandStatus = 'OFF_LINE' | 'ON_LINE' | 'QUEUE_SATURATED' | 'WARMING_UP' | 'IDLE' | 'SYSTEM_ERROR'
export type ManagedBy = 'ITSELF' | 'AI_AGENT' | 'MIX'
export type SubmissionPolicy = 'NOT_ALLOWED' | 'REVIEW_REQUIRED' | 'NO_RESTRICTIONS'
export type AiAgentMode = 'BASIC' | 'SCRIPT_FOLLOWING'

export interface Brand {
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
  aiAgentSlug?: string
  profileSlug?: string
  managedBy?: ManagedBy
  aiAgentMode?: AiAgentMode
  oneTimeStreamPolicy?: SubmissionPolicy
  submissionPolicy?: SubmissionPolicy
  messagingPolicy?: SubmissionPolicy
  aiOverriding?: { prompt?: string; talkativity?: number }
  scripts?: Array<{ slugName: string; userVariables?: Record<string, any> }>
  customScriptSlug?: string
  profileOverriding?: { name?: string; description?: string }
  titleFont?: string
  owner?: {
    name?: string
    email?: string
    exposeWhileSharing?: boolean
    actionDebugEnabled?: boolean
    coOwners?: Array<{ name?: string; email: string }>
  }
  ownerEmail?: string
  publicBrand?: number
  bitRate?: number
  mixplaUrl?: string
  mp3Url?: string
  streamingOptions?: { codecs?: string[] }
  genres?: string[]
  labels?: string[]
  logoFiles?: Array<{
    slugName: string
    fileOriginalName?: string
    mimeType?: string
    fileType?: string
    contentLength?: number
  }>
}

export const SUBMISSION_POLICY_OPTIONS: { label: string; value: SubmissionPolicy }[] = [
  { label: 'Not Allowed', value: 'NOT_ALLOWED' },
  { label: 'Review Required', value: 'REVIEW_REQUIRED' },
  { label: 'No Restrictions', value: 'NO_RESTRICTIONS' },
]

export const useBrandsStore = defineStore('brands', () => {
  const brands = ref<Brand[]>([])
  const actions = ref<EntitlementAction[]>([])
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
      const result = await datanestApiService.getDictionary<Brand>('/public/brands')
      brands.value = result.entries
      actions.value = result.actions
      totalCount.value = result.entries.length
      pageNum.value = 1
      pageSize.value = result.entries.length
      maxPage.value = 1
    } finally {
      loading.value = false
    }
  }

  async function fetchBrand(slug: string) {
    return datanestApiService.getDocument<Brand>('/public/brands', slug)
  }

  async function saveBrand(slug: string | null, data: Partial<Brand>) {
    const { author: _a, regDate: _r, lastModifier: _lm, lastModifiedDate: _lmd, status: _s, ...payload } = data as Brand
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
    actions,
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
