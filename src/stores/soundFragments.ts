import { defineStore } from 'pinia'
import { ref } from 'vue'
import datanestApiService from '@/services/datanestApi'

export type FragmentType =
  | 'SONG' | 'ADVERTISEMENT' | 'JINGLE' | 'NEWS' | 'WEATHER'
  | 'JINGLE_INTRO' | 'JINGLE_OUTRO' | 'BACKGROUND_LOOP'

export const FRAGMENT_TYPES: { label: string; value: FragmentType }[] = [
  { label: 'Song', value: 'SONG' },
  { label: 'Advertisement', value: 'ADVERTISEMENT' },
  { label: 'Jingle', value: 'JINGLE' },
  { label: 'Jingle Intro', value: 'JINGLE_INTRO' },
  { label: 'Jingle Outro', value: 'JINGLE_OUTRO' },
  { label: 'News', value: 'NEWS' },
  { label: 'Weather', value: 'WEATHER' },
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
}

export const useSoundFragmentsStore = defineStore('soundFragments', () => {
  const loading = ref(false)

  async function fetchFragment(id: string): Promise<SoundFragment> {
    const raw: any = await datanestApiService.getDocument<any>('/datanest/soundfragments', id)
    return (raw?.payload?.docData ?? raw?.docData ?? raw) as SoundFragment
  }

  async function saveFragment(id: string | null, data: Partial<SoundFragment>): Promise<SoundFragment> {
    const { id: _id, author: _a, regDate: _r, lastModifier: _lm, lastModifiedDate: _lmd, ...payload } = data as SoundFragment
    let raw: any
    if (id) {
      raw = await datanestApiService.updateDictionaryItem<any>('/datanest/soundfragments', id, payload)
    } else {
      raw = await datanestApiService.createDictionaryItem<any>('/datanest/soundfragments', payload)
    }
    return raw?.payload?.docData ?? raw?.docData ?? raw
  }

  async function deleteFragment(id: string) {
    return datanestApiService.deleteDictionaryItem('/datanest/soundfragments', id)
  }

  return { loading, fetchFragment, saveFragment, deleteFragment }
})
