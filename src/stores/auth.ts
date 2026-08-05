import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import authService from '@/services/auth'

export const useAuthStore = defineStore('auth', () => {
  const isAuthenticated = ref(false)
  const userProfile = ref<any>(null)
  const isLoading = ref(true)
  const showLoginModal = ref(false)
  const loginRedirectUri = ref<string | null>(null)

  const userName = computed(() => userProfile.value?.username || '')
  const userEmail = computed(() => userProfile.value?.email || '')

  /** Shared across overlapping callers so a second call awaits the first run. */
  let inFlight: Promise<void> | null = null
  let listening = false

  function ensureAuthRequiredListener() {
    if (listening) return
    listening = true
    authService.onAuthRequired((redirectUri) => {
      isAuthenticated.value = false
      userProfile.value = null
      openLogin(redirectUri)
    })
  }

  function openLogin(redirectUri?: string) {
    if (redirectUri) {
      try {
        const url = new URL(redirectUri, window.location.origin)
        loginRedirectUri.value = url.pathname + url.search + url.hash
      } catch {
        loginRedirectUri.value = redirectUri.startsWith('/') ? redirectUri : null
      }
    } else if (!loginRedirectUri.value) {
      loginRedirectUri.value = window.location.pathname + window.location.search + window.location.hash
    }
    showLoginModal.value = true
  }

  async function initializeAuth() {
    ensureAuthRequiredListener()
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
    ensureAuthRequiredListener()
    openLogin(redirectUri)
  }

  function onLoginSuccess() {
    isAuthenticated.value = true
    userProfile.value = authService.getUserProfile()
    showLoginModal.value = false
    const target = loginRedirectUri.value
    loginRedirectUri.value = null
    return target
  }

  async function logout() {
    try {
      ensureAuthRequiredListener()
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
    showLoginModal,
    loginRedirectUri,
    userName,
    userEmail,
    initializeAuth,
    login,
    onLoginSuccess,
    logout,
  }
})
