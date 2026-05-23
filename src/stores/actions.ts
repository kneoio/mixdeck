import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import datanestApiService from '@/services/datanestApi'

export interface ActionOption {
  id: string
  name: string | null
  localizedOptionName: Record<string, string>
}

export const useActionsStore = defineStore('actions', () => {
  const options = ref<ActionOption[]>([])
  const loading = ref(false)
  const loaded = ref(false)

  const selectOptions = computed(() =>
    options.value.map(o => ({
      label: o.localizedOptionName.en,
      value: o.id,
    }))
  )

  async function loadOptions() {
    if (loaded.value) return
    loading.value = true
    try {
      const result = await datanestApiService.getPublicArray<ActionOption>('/pub/actions/options')
      options.value = result
      loaded.value = true
    } finally {
      loading.value = false
    }
  }

  function findById(id: string): ActionOption | undefined {
    return options.value.find(o => o.id === id)
  }

  return { options, loading, loaded, selectOptions, loadOptions, findById }
})
