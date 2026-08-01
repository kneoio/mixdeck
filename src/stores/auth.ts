import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import authService from '@/services/auth'

export const useAuthStore = defineStore('auth', () => {
  const isAuthenticated = ref(false)
  const userProfile = ref<any>(null)
  const isLoading = ref(true)

  const userName = computed(() => userProfile.value?.username || '')
  const userEmail = computed(() => userProfile.value?.email || '')

  /** Shared across overlapping callers so a second call awaits the first run. */
  let inFlight: Promise<void> | null = null

  async function initializeAuth() {
    if (inFlight) return inFlight

    isLoading.value = true
    inFlight = (async () => {
      try {
        const authenticated = await authService.init()
        isAuthenticated.value = authenticated
        if (authenticated) {
          userProfile.value = authService.getUserProfile()
        }
      } catch (error) {
        console.error('Auth initialization failed:', error)
        isAuthenticated.value = false
      } finally {
        isLoading.value = false
        inFlight = null
      }
    })()

    return inFlight
  }

  async function login(redirectUri?: string) {
    try {
      await authService.login(redirectUri)
    } catch (error) {
      console.error('Login failed:', error)
    }
  }

  async function logout() {
    try {
      await authService.logout()
      isAuthenticated.value = false
      userProfile.value = null
    } catch (error) {
      console.error('Logout failed:', error)
    }
  }

  return {
    isAuthenticated,
    userProfile,
    isLoading,
    userName,
    userEmail,
    initializeAuth,
    login,
    logout
  }
})
