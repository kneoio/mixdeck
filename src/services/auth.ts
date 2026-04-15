import Keycloak from 'keycloak-js'
import { appConfig } from '@/config/appConfig'

function clearAuthCookies() {
  const cookies = document.cookie.split(';')
  for (let cookie of cookies) {
    const eqPos = cookie.indexOf('=')
    const name = eqPos > -1 ? cookie.substr(0, eqPos).trim() : cookie.trim()
    document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`
    const domain = window.location.hostname
    if (domain.includes('.')) {
      const parentDomain = domain.substring(domain.indexOf('.'))
      document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=${parentDomain}`
    }
  }
  localStorage.clear()
  sessionStorage.clear()
}

interface AuthState {
  isAuthenticated: boolean
  token: string | null
  userProfile: any
}

let globalKeycloakInstance: Keycloak | null = null
let globalInitialized = false
let globalAuthState: AuthState = {
  isAuthenticated: false,
  token: null,
  userProfile: null
}

class AuthService {
  private keycloak: Keycloak
  private state: AuthState

  constructor() {
    if (globalKeycloakInstance) {
      this.keycloak = globalKeycloakInstance
      this.state = globalAuthState
    } else {
      this.keycloak = new Keycloak({
        url: appConfig.keycloak.url,
        realm: appConfig.keycloak.realm,
        clientId: appConfig.keycloak.clientId
      })
      globalKeycloakInstance = this.keycloak
      this.state = globalAuthState
    }
  }

  async init(): Promise<boolean> {
    if (globalInitialized) {
      return this.state.isAuthenticated
    }

    const originalFetch = window.fetch
    let has502Error = false
    window.fetch = async (...args) => {
      try {
        const response = await originalFetch(...args)
        if (response.status === 502) has502Error = true
        return response
      } catch (error) {
        if (error instanceof Error && error.message.includes('502')) has502Error = true
        throw error
      }
    }

    try {
      const authenticated = await this.keycloak.init({
        onLoad: 'check-sso',
        silentCheckSsoRedirectUri: window.location.origin + '/silent-check-sso.html',
        checkLoginIframe: false,
        pkceMethod: 'S256',
        flow: 'standard'
      })

      if (has502Error) {
        clearAuthCookies()
        globalInitialized = false
        globalKeycloakInstance = null
        window.fetch = originalFetch
        setTimeout(() => window.location.reload(), 1000)
        return false
      }

      globalInitialized = true
      this.state.isAuthenticated = authenticated
      globalAuthState.isAuthenticated = authenticated

      if (authenticated) {
        this.state.token = this.keycloak.token || null
        this.state.userProfile = await this.keycloak.loadUserProfile()
        globalAuthState.token = this.state.token
        globalAuthState.userProfile = this.state.userProfile
      }

      this.keycloak.onTokenExpired = async () => {
        const refreshed = await this.refreshToken()
        if (!refreshed) this.login()
      }

      window.fetch = originalFetch
      return authenticated
    } catch (error) {
      window.fetch = originalFetch
      if (has502Error || (error instanceof Error && error.message.includes('502'))) {
        clearAuthCookies()
        globalInitialized = false
        globalKeycloakInstance = null
        setTimeout(() => window.location.reload(), 1000)
        return false
      }
      globalInitialized = false
      return false
    }
  }

  async login(): Promise<void> {
    try {
      if (!globalInitialized) {
        await this.init()
      }
      await this.keycloak.login({ redirectUri: window.location.origin })
    } catch (error) {
      console.error('Login failed:', error)
    }
  }

  async logout(): Promise<void> {
    try {
      await this.keycloak.logout({ redirectUri: window.location.origin })
    } catch (error) {
      console.error('Logout failed:', error)
    }
  }

  async refreshToken(): Promise<boolean> {
    try {
      const refreshed = await this.keycloak.updateToken(30)
      if (refreshed) {
        this.state.token = this.keycloak.token || null
        globalAuthState.token = this.state.token
        return true
      }
      return false
    } catch {
      this.state.isAuthenticated = false
      this.state.token = null
      this.state.userProfile = null
      globalAuthState.isAuthenticated = false
      globalAuthState.token = null
      globalAuthState.userProfile = null
      return false
    }
  }

  getToken(): string | null { return this.state.token }
  getUserProfile(): any { return this.state.userProfile }
  isAuthenticated(): boolean { return this.state.isAuthenticated }
  getAuthHeader(): { Authorization: string } | {} {
    return this.state.token ? { Authorization: `Bearer ${this.state.token}` } : {}
  }
}

export const authService = new AuthService()
export default authService
