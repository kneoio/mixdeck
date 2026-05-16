import { defineStore } from 'pinia'
import { ref } from 'vue'
import datanestApiService from '@/services/datanestApi'

export type FragmentType =
  | 'SONG' | 'ADVERTISEMENT' | 'JINGLE'
  | 'JINGLE_INTRO' | 'JINGLE_OUTRO' | 'BACKGROUND_LOOP'

export const FRAGMENT_TYPES: { label: string; value: FragmentType }[] = [
  { label: 'Song', value: 'SONG' },
  { label: 'Advertisement', value: 'ADVERTISEMENT' },
  { label: 'Jingle', value: 'JINGLE' },
  { label: 'Jingle Intro', value: 'JINGLE_INTRO' },
  { label: 'Jingle Outro', value: 'JINGLE_OUTRO' },
  { label: 'Background Loop', value: 'BACKGROUND_LOOP' },
]

export interface UploadedFile {
  id: string
  name: string
  status: string
  url: string
  percentage: number
}

export interface SoundFragment {
  id: string
  author: string
  regDate: string
  lastModifier: string
  lastModifiedDate: string
  slugName: string
  type: FragmentType
  title?: string
  artist?: string
  genres: string[]
  labels?: string[]
  album?: string
  url?: string
  description: string
  representedInBrands: string[]
  source?: string
  length?: string | number
  expiresAt?: string
  uploadedFiles?: UploadedFile[]
  sharedWith?: Array<{
    targetBrand: string
    status?: number
    shared?: boolean
  }>
}

export const useSoundFragmentsStore = defineStore('soundFragments', () => {
  const loading = ref(false)

  async function fetchFragment(id: string): Promise<SoundFragment> {
    const raw: any = await datanestApiService.getDocument<any>('/soundfragments', id)
    return (raw?.payload?.docData ?? raw?.docData ?? raw) as SoundFragment
  }

  async function saveFragment(id: string | null, data: Partial<SoundFragment>): Promise<SoundFragment> {
    const { id: _id, author: _a, regDate: _r, lastModifier: _lm, lastModifiedDate: _lmd, ...payload } = data as SoundFragment
    let raw: any
    if (id) {
      raw = await datanestApiService.updateDictionaryItem<any>('/soundfragments', id, payload)
    } else {
      raw = await datanestApiService.createDictionaryItem<any>('/soundfragments', payload)
    }
    return raw?.payload?.docData ?? raw?.docData ?? raw
  }

  async function deleteFragment(id: string) {
    return datanestApiService.deleteDictionaryItem('/soundfragments', id)
  }

  async function fetchReceived(page = 1, pageSize = 10) {
    return datanestApiService.getReceived(page, pageSize)
  }

  return { loading, fetchFragment, saveFragment, deleteFragment, fetchReceived }
})
