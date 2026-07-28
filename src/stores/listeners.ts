import { defineStore } from 'pinia'
import { ref } from 'vue'
import datanestApiService from '@/services/datanestApi'

export interface Listener {
  id: string
  author?: string
  regDate?: string
  lastModifier?: string
  lastModifiedDate?: string
  localizedName: Record<string, string>
  userId?: number
  email?: string
  slugName?: string
  nickName?: Record<string, string[]>
  userData?: Record<string, string>
  archived?: number
  listenerOf?: string[]
  labels?: string[]
}

export const useListenersStore = defineStore('listeners', () => {
  const loading = ref(false)

  async function fetchListener(id: string) {
    return datanestApiService.getDocument<Listener>('/listeners', id)
  }

  async function saveListener(id: string | null, data: Partial<Listener>, contextBrandSlug?: string) {
    const qs = contextBrandSlug ? `?contextBrandSlug=${encodeURIComponent(contextBrandSlug)}` : ''
    if (id) {
      return datanestApiService.post<Listener>(`/listeners/${encodeURIComponent(id)}${qs}`, data)
    }
    return datanestApiService.post<Listener>(`/listeners/new${qs}`, data)
  }

  async function deleteListener(id: string) {
    return datanestApiService.deleteDictionaryItem('/listeners', id)
  }

  return { loading, fetchListener, saveListener, deleteListener }
})
