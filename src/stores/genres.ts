import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import datanestApiService from '@/services/datanestApi'

export interface Genre {
  id: string
  identifier: string
  author: string
  regDate: string
  lastModifier: string
  lastModifiedDate: string | null
  localizedName: {
    [languageCode: string]: string
  }
  rank: number
  color?: string
  fontColor?: string
  parent?: string | null
  children?: Genre[]
}

export const useGenresStore = defineStore('genres', () => {
  const genres = ref<Genre[]>([])
  const loading = ref(false)
  const selectedGenreIds = ref<string[]>([])
  const totalCount = ref(0)
  const pageNum = ref(1)
  const pageSize = ref(10)
  const maxPage = ref(1)
  const filterIdentifier = ref('')

  const allGenres = ref<Genre[]>([])

  const selectedGenres = computed(() =>
    genres.value.filter(genre => selectedGenreIds.value.includes(genre.identifier))
  )

  async function loadAllGenres() {
    try {
      const result = await datanestApiService.getPagedDictionary<Genre>('/genres', 1, 10000)
      allGenres.value = result.entries
      return result.entries
    } catch (error) {
      console.error('Failed to load all genres:', error)
      throw error
    }
  }

  async function loadGenres(page = pageNum.value, size = pageSize.value) {
    loading.value = true
    try {
      const params: Record<string, string> = {}
      if (filterIdentifier.value) {
        params.search = filterIdentifier.value
      }
      const result = await datanestApiService.getPagedDictionary<Genre>('/genres', page, size, params)
      genres.value = result.entries
      totalCount.value = result.count
      pageNum.value = result.pageNum
      pageSize.value = result.pageSize
      maxPage.value = result.maxPage
    } catch (error) {
      console.error('Failed to load genres:', error)
      throw error
    } finally {
      loading.value = false
    }
  }

  async function fetchGenre(id: string) {
    try {
      return await datanestApiService.getDocument<Genre>('/genres', id)
    } catch (error) {
      console.error('Failed to fetch genre:', error)
      throw error
    }
  }

  async function createGenre(genreData: Partial<Genre>) {
    try {
      const {
        id: _id,
        identifier: _identifier,
        author: _author,
        regDate: _regDate,
        lastModifier: _lastModifier,
        lastModifiedDate: _lastModifiedDate,
        ...payload
      } = genreData as Partial<Genre>

      const newGenre = await datanestApiService.createDictionaryItem<Genre>('/genres', payload)
      genres.value.push(newGenre)
      return newGenre
    } catch (error) {
      console.error('Failed to create genre:', error)
      throw error
    }
  }

  async function updateGenre(id: string, genreData: Partial<Genre>) {
    try {
      const {
        id: _id,
        identifier: _identifier,
        author: _author,
        regDate: _regDate,
        lastModifier: _lastModifier,
        lastModifiedDate: _lastModifiedDate,
        ...payload
      } = genreData as Partial<Genre>

      const updatedGenre = await datanestApiService.updateDictionaryItem<Genre>('/genres', id, payload)
      const index = genres.value.findIndex(genre => genre.id === id)
      if (index !== -1) {
        genres.value[index] = updatedGenre
      }
      return updatedGenre
    } catch (error) {
      console.error('Failed to update genre:', error)
      throw error
    }
  }

  async function deleteGenre(identifier: string) {
    try {
      const genre = genres.value.find(genre => genre.identifier === identifier)
      const idToDelete = genre ? genre.id : identifier

      await datanestApiService.deleteDictionaryItem('/genres', idToDelete)
      genres.value = genres.value.filter(genre => genre.identifier !== identifier)
    } catch (error) {
      console.error('Failed to delete genre:', error)
      throw error
    }
  }

  function getGenreByIdentifier(identifier: string) {
    return genres.value.find(genre => genre.identifier === identifier)
  }

  function getGenreById(id: string) {
    return allGenres.value.find(genre => genre.id === id)
  }

  return {
    genres,
    allGenres,
    loading,
    selectedGenreIds,
    totalCount,
    pageNum,
    pageSize,
    maxPage,
    filterIdentifier,
    selectedGenres,

    loadGenres,
    loadAllGenres,
    fetchGenre,
    createGenre,
    updateGenre,
    deleteGenre,
    getGenreByIdentifier,
    getGenreById
  }
})
