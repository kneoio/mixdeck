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
  const subscriptionType = computed(() => subscription.value?.subscriptionType)
  const subscriptionStatus = computed(() => subscription.value?.subscriptionStatus)
  const streamDurationMinutes = computed(() => subscription.value?.streamDurationMinutes)
  const otsAllowed = computed(() => subscription.value?.otsAllowed ?? false)
  const maxSongs = computed(() => subscription.value?.maxSongs)
  const streamQualityKbps = computed(() => subscription.value?.streamQualityKbps)
  const supportLevel = computed(() => subscription.value?.supportLevel ?? 0)
  const customScriptAllowed = computed(() => subscription.value?.customScriptAllowed ?? false)
  const codecs = computed(() => subscription.value?.codecs ?? [])
  const djType = computed(() => subscription.value?.djType ?? [])
  const maxStations = computed(() => subscription.value?.maxStations)

  async function loadCurrentSubscription() {
    if (hasLoaded.value) return
    await refresh()
  }

  async function refresh() {
    loading.value = true
    error.value = null
    try {
      subscription.value = await nivaroApiService.getCurrentUserSubscription()
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
    subscriptionType,
    subscriptionStatus,
    streamDurationMinutes,
    otsAllowed,
    maxSongs,
    streamQualityKbps,
    supportLevel,
    customScriptAllowed,
    codecs,
    djType,
    maxStations,
    loadCurrentSubscription,
    refresh,
    reset,
  }
})
