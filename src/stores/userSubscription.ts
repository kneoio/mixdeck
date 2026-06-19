import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import nivaroApiService from '@/services/nivaroApi'
import type { UserSubscriptionDTO } from '@/services/coreApi'

export const useUserSubscriptionStore = defineStore('userSubscription', () => {
  const subscription = ref<UserSubscriptionDTO | null>(null)
  const loading = ref(false)
  const error = ref<Error | null>(null)
  const hasLoaded = ref(false)

  const hasActiveSubscription = computed(() => subscription.value?.active === true)
  const isFreePlan = computed(() => !hasActiveSubscription.value)
  const streamDurationMinutes = computed(() => subscription.value?.streamDurationMinutes)
  const maxStations = computed(() => subscription.value?.maxStations)

  async function loadCurrentSubscription() {
    if (hasLoaded.value) return
    loading.value = true
    error.value = null
    try {
      subscription.value = await nivaroApiService.getCurrentUserSubscription()
      console.log('[userSubscription] loaded:', subscription.value)
      hasLoaded.value = true
    } catch (err) {
      error.value = err instanceof Error ? err : new Error(String(err))
      console.error('Failed to load current user subscription:', err)
    } finally {
      loading.value = false
    }
  }

  function reset() {
    subscription.value = null
    loading.value = false
    error.value = null
    hasLoaded.value = false
  }

  return {
    subscription,
    loading,
    error,
    hasLoaded,
    hasActiveSubscription,
    isFreePlan,
    streamDurationMinutes,
    maxStations,
    loadCurrentSubscription,
    reset,
  }
})
