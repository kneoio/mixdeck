import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import authService from '@/services/auth'

export const useAuthStore = defineStore('auth', () => {
  const isAuthenticated = ref(false)
  const userProfile = ref<any>(null)
  const isLoading = ref(true)

  const userName = computed(() => userProfile.value?.username || '')
  const userEmail = computed(() => userProfile.value?.email || '')

  async function initializeAuth() {
    isLoading.value = true
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
    }
  }

  async function login() {
    try {
      await authService.login()
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
