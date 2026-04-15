import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import datanestApiService from '@/services/datanestApi'

export interface Label {
  id: string
  identifier: string
  author: string
  regDate: string
  lastModifier: string
  lastModifiedDate: string
  localizedName: {
    [languageCode: string]: string
  }
  color: string
  fontColor?: string
  hidden: boolean
  category: string
  parent?: string | null
}

export const useLabelsStore = defineStore('labels', () => {
  const labels = ref<Label[]>([])
  const loading = ref(false)
  const selectedLabelIds = ref<string[]>([])
  const totalCount = ref(0)
  const pageNum = ref(1)
  const pageSize = ref(10)
  const maxPage = ref(1)
  const filterCategory = ref<string | null>(null)
  const filterIdentifier = ref<string>('')

  const allLabels = ref<Label[]>([])

  const selectedLabels = computed(() => 
    labels.value.filter(label => selectedLabelIds.value.includes(label.identifier))
  )

  async function loadAllLabels() {
    try {
      const result = await datanestApiService.getPagedDictionary<Label>('/labels', 1, 10000)
      allLabels.value = result.entries
      return result.entries
    } catch (error) {
      console.error('Failed to load all labels:', error)
      throw error
    }
  }

  async function loadLabelsByCategory(category: string, page = pageNum.value, size = pageSize.value) {
    loading.value = true
    try {
      const result = await datanestApiService.getPagedDictionary<Label>(`/labels/only/category/${category}`, page, size, {
        search: filterIdentifier.value || undefined
      })
      labels.value = result.entries
      totalCount.value = result.count
      pageNum.value = result.pageNum
      pageSize.value = result.pageSize
      maxPage.value = result.maxPage
    } catch (error) {
      console.error(`Failed to load labels for category ${category}:`, error)
      throw error
    } finally {
      loading.value = false
    }
  }

  async function loadLabels(page = pageNum.value, size = pageSize.value) {
    loading.value = true
    try {
      const result = await datanestApiService.getPagedDictionary<Label>('/labels', page, size, {
        category: filterCategory.value || undefined,
        search: filterIdentifier.value || undefined
      })
      labels.value = result.entries
      totalCount.value = result.count
      pageNum.value = result.pageNum
      pageSize.value = result.pageSize
      maxPage.value = result.maxPage
    } catch (error) {
      console.error('Failed to load labels:', error)
      throw error
    } finally {
      loading.value = false
    }
  }

  async function fetchLabel(id: string) {
    try {
      return await datanestApiService.getDocument<Label>('/labels', id)
    } catch (error) {
      console.error('Failed to fetch label:', error)
      throw error
    }
  }

  async function createLabel(labelData: Partial<Label>) {
    try {
      const {
        id: _id,
        identifier: _identifier,
        author: _author,
        regDate: _regDate,
        lastModifier: _lastModifier,
        lastModifiedDate: _lastModifiedDate,
        ...payload
      } = labelData as Partial<Label>

      const newLabel = await datanestApiService.createDictionaryItem<Label>('/labels', payload)
      labels.value.push(newLabel)
      return newLabel
    } catch (error) {
      console.error('Failed to create label:', error)
      throw error
    }
  }

  async function updateLabel(id: string, labelData: Partial<Label>) {
    try {
      const {
        id: _id,
        identifier: _identifier,
        author: _author,
        regDate: _regDate,
        lastModifier: _lastModifier,
        lastModifiedDate: _lastModifiedDate,
        ...payload
      } = labelData as Partial<Label>

      const updatedLabel = await datanestApiService.updateDictionaryItem<Label>('/labels', id, payload)
      const index = labels.value.findIndex(label => label.id === id)
      if (index !== -1) {
        labels.value[index] = updatedLabel
      }
      return updatedLabel
    } catch (error) {
      console.error('Failed to update label:', error)
      throw error
    }
  }

  async function deleteLabel(identifier: string) {
    try {
      const label = labels.value.find(label => label.identifier === identifier)
      const idToDelete = label ? label.id : identifier

      await datanestApiService.deleteDictionaryItem('/labels', idToDelete)
      labels.value = labels.value.filter(label => label.identifier !== identifier)
    } catch (error) {
      console.error('Failed to delete label:', error)
      throw error
    }
  }

  function getLabelByIdentifier(identifier: string) {
    return labels.value.find(label => label.identifier === identifier)
  }

  function getLabelById(id: string) {
    return allLabels.value.find(label => label.id === id)
  }

  function resetFilters() {
    filterCategory.value = null
    filterIdentifier.value = ''
  }

  return {
    labels,
    allLabels,
    loading,
    selectedLabelIds,
    totalCount,
    pageNum,
    pageSize,
    maxPage,
    filterCategory,
    filterIdentifier,
    selectedLabels,
    
    loadLabels,
    loadAllLabels,
    loadLabelsByCategory,
    fetchLabel,
    createLabel,
    updateLabel,
    deleteLabel,
    getLabelByIdentifier,
    getLabelById,
    resetFilters
  }
})
