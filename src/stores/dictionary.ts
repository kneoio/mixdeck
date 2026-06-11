import { defineStore } from 'pinia'
import { ref } from 'vue'
import dictionaryApiService, { type GenreEntry, type LabelEntry } from '@/services/dictionaryApi'

export type { GenreEntry, LabelEntry }

export const useDictionaryStore = defineStore('dictionary', () => {
  const genres = ref<GenreEntry[]>([])
  const soundFragmentLabels = ref<LabelEntry[]>([])
  const listenerLabels = ref<LabelEntry[]>([])

  const _loadedGenres = ref(false)
  const _loadedSoundFragmentLabels = ref(false)
  const _loadedListenerLabels = ref(false)

  async function loadGenres() {
    if (_loadedGenres.value) return
    genres.value = await dictionaryApiService.getGenres()
    _loadedGenres.value = true
  }

  async function loadSoundFragmentLabels() {
    if (_loadedSoundFragmentLabels.value) return
    soundFragmentLabels.value = await dictionaryApiService.getLabelsByCategory('sound_fragment')
    _loadedSoundFragmentLabels.value = true
  }

  async function loadListenerLabels() {
    if (_loadedListenerLabels.value) return
    listenerLabels.value = await dictionaryApiService.getLabelsByCategory('listener')
    _loadedListenerLabels.value = true
  }

  return {
    genres,
    soundFragmentLabels,
    listenerLabels,
    loadGenres,
    loadSoundFragmentLabels,
    loadListenerLabels,
  }
})
