import { defineStore } from 'pinia'
import { ref } from 'vue'
import datanestApiService from '@/services/datanestApi'

/** Mixdeck public listener — keyed by slugName (user login); no document UUID. */
export interface Listener {
  slugName?: string
  author?: string
  regDate?: string
  lastModifier?: string
  lastModifiedDate?: string
  localizedName: Record<string, string>
  email?: string
  nickName?: Record<string, string[]>
  userData?: Record<string, string>
  archived?: number
  labels?: string[]
}

export const useListenersStore = defineStore('listeners', () => {
  const loading = ref(false)

  async function fetchListener(slugName: string) {
    return datanestApiService.getDocument<Listener>('/public/listeners', slugName)
  }

  async function saveListener(slugName: string | null, data: Partial<Listener>, contextBrandSlug?: string) {
    const qs = contextBrandSlug ? `?contextBrandSlug=${encodeURIComponent(contextBrandSlug)}` : ''
    if (slugName) {
      return datanestApiService.post<Listener>(`/public/listeners/${encodeURIComponent(slugName)}${qs}`, data)
    }
    return datanestApiService.post<Listener>(`/public/listeners/new${qs}`, data)
  }

  async function deleteListener(slugName: string) {
    return datanestApiService.deleteDictionaryItem('/public/listeners', slugName)
  }

  return { loading, fetchListener, saveListener, deleteListener }
})
