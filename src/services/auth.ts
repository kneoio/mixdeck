import { appConfig } from '@/config/appConfig'

const ACCESS_TOKEN_KEY = 'mixdeck_access_token'
const REFRESH_TOKEN_KEY = 'mixdeck_refresh_token'
const EXPIRES_AT_KEY = 'mixdeck_token_expires_at'

/** Always hit remote Keycloak (dev and prod). */
const KEYCLOAK_REALM_BASE = `${appConfig.keycloak.url}/realms/${appConfig.keycloak.realm}`
const KEYCLOAK_TOKEN_URL = `${KEYCLOAK_REALM_BASE}/protocol/openid-connect/token`
const KEYCLOAK_LOGOUT_URL = `${KEYCLOAK_REALM_BASE}/protocol/openid-connect/logout`
const KEYCLOAK_CLIENT_ID = appConfig.keycloak.clientId

/** Refresh this many ms before access-token expiry. */
const REFRESH_SKEW_MS = 30_000
const MIN_REFRESH_DELAY_MS = 5_000
const MAX_OTP_FAILURES = 5

export type UserProfile = {
  username?: string
  email?: string
  firstName?: string
  lastName?: string
  emailVerified?: boolean
}

type TokenResponse = {
  access_token: string
  refresh_token: string
  expires_in: number
  refresh_expires_in: number
  token_type: string
}

type AuthState = {
  isAuthenticated: boolean
  token: string | null
  refreshToken: string | null
  userProfile: UserProfile | null
  expiresAt: number | null
}

export type AuthRequiredListener = (redirectUri?: string) => void

export class AuthRequestError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'AuthRequestError'
    this.status = status
  }
}

function readDevAccessToken(): string | null {
  if (!import.meta.env.DEV) return null
  const value = import.meta.env.VITE_DEV_ACCESS_TOKEN
  if (typeof value === 'string' && value.trim() !== '') {
    return value.trim()
  }
  return null
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const part = token.split('.')[1]
    if (!part) return null
    const base64 = part.replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
    const json = decodeURIComponent(
      atob(padded)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    )
    return JSON.parse(json) as Record<string, unknown>
  } catch {
    return null
  }
}

function profileFromAccessToken(token: string): UserProfile | null {
  const payload = decodeJwtPayload(token)
  if (!payload) return null
  return {
    username: String(payload.preferred_username || payload.email || ''),
    email: String(payload.email || ''),
    firstName: String(payload.given_name || ''),
    lastName: String(payload.family_name || ''),
    emailVerified: Boolean(payload.email_verified),
  }
}

class AuthService {
  private state: AuthState = {
    isAuthenticated: false,
    token: null,
    refreshToken: null,
    userProfile: null,
    expiresAt: null,
  }

  private initialized = false
  private initPromise: Promise<boolean> | null = null
  private refreshPromise: Promise<boolean> | null = null
  private refreshTimer: ReturnType<typeof setTimeout> | null = null
  private authRequiredListeners = new Set<AuthRequiredListener>()
  /** True when the session came from `VITE_DEV_ACCESS_TOKEN` (no Keycloak refresh). */
  private staticDevToken = false

  onAuthRequired(listener: AuthRequiredListener): () => void {
    this.authRequiredListeners.add(listener)
    return () => {
      this.authRequiredListeners.delete(listener)
    }
  }

  private notifyAuthRequired(redirectUri?: string) {
    for (const listener of this.authRequiredListeners) {
      listener(redirectUri)
    }
  }

  async init(): Promise<boolean> {
    if (this.initialized) {
      return this.state.isAuthenticated
    }
    if (this.initPromise) {
      return this.initPromise
    }

    this.initPromise = this.runInit().finally(() => {
      this.initPromise = null
    })
    return this.initPromise
  }

  private async runInit(): Promise<boolean> {
    const devToken = readDevAccessToken()
    if (devToken) {
      this.applyStaticDevToken(devToken)
      this.initialized = true
      return true
    }

    const access = localStorage.getItem(ACCESS_TOKEN_KEY)
    const refresh = localStorage.getItem(REFRESH_TOKEN_KEY)
    const expiresAtRaw = localStorage.getItem(EXPIRES_AT_KEY)
    const expiresAt = expiresAtRaw ? Number(expiresAtRaw) : 0

    if (!access || !refresh) {
      this.initialized = true
      return false
    }

    this.state.token = access
    this.state.refreshToken = refresh
    this.state.expiresAt = expiresAt || null
    this.state.userProfile = profileFromAccessToken(access)

    if (!expiresAt || Date.now() >= expiresAt - REFRESH_SKEW_MS) {
      const ok = await this.refreshToken()
      this.initialized = true
      return ok
    }

    this.state.isAuthenticated = true
    this.scheduleRefresh()
    this.initialized = true
    return true
  }

  /** Step 1 — ask datanest to email a 6-digit code. */
  async requestOtp(email: string): Promise<void> {
    const response = await fetch(`${appConfig.otpDatanestServer}/auth/otp/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })

    if (response.ok) return

    let message = 'Could not send the code'
    try {
      const data = await response.json()
      if (typeof data?.error === 'string') message = data.error
    } catch {
      // keep default
    }
    throw new AuthRequestError(message, response.status)
  }

  /** Step 2 — exchange email + otp for Keycloak tokens. */
  async verifyOtp(email: string, otp: string): Promise<void> {
    const body = new URLSearchParams({
      grant_type: 'password',
      client_id: KEYCLOAK_CLIENT_ID,
      username: email,
      otp,
      scope: 'openid email profile',
    })

    const response = await fetch(KEYCLOAK_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    })

    if (!response.ok) {
      throw new AuthRequestError('invalid_grant', response.status)
    }

    const data = (await response.json()) as TokenResponse
    this.applyTokens(data)
  }

  async refreshToken(): Promise<boolean> {
    if (this.refreshPromise) {
      return this.refreshPromise
    }
    this.refreshPromise = this.doRefresh().finally(() => {
      this.refreshPromise = null
    })
    return this.refreshPromise
  }

  private async doRefresh(): Promise<boolean> {
    if (this.staticDevToken) {
      return true
    }

    const refresh = this.state.refreshToken || localStorage.getItem(REFRESH_TOKEN_KEY)
    if (!refresh) {
      this.clearSession()
      return false
    }

    try {
      const body = new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: KEYCLOAK_CLIENT_ID,
        refresh_token: refresh,
      })

      const response = await fetch(KEYCLOAK_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      })

      if (!response.ok) {
        this.clearSession()
        return false
      }

      const data = (await response.json()) as TokenResponse
      this.applyTokens(data)
      return true
    } catch {
      this.clearSession()
      return false
    }
  }

  private applyStaticDevToken(token: string) {
    console.log('mixdeck in dev mode')
    this.staticDevToken = true
    this.state.token = token
    this.state.refreshToken = null
    this.state.expiresAt = null
    this.state.isAuthenticated = true
    this.state.userProfile = profileFromAccessToken(token)
  }

  private applyTokens(data: TokenResponse) {
    const expiresAt = Date.now() + data.expires_in * 1000
    this.state.token = data.access_token
    this.state.refreshToken = data.refresh_token
    this.state.expiresAt = expiresAt
    this.state.isAuthenticated = true
    this.state.userProfile = profileFromAccessToken(data.access_token)

    localStorage.setItem(ACCESS_TOKEN_KEY, data.access_token)
    localStorage.setItem(REFRESH_TOKEN_KEY, data.refresh_token)
    localStorage.setItem(EXPIRES_AT_KEY, String(expiresAt))

    this.scheduleRefresh()
  }

  private scheduleRefresh() {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer)
      this.refreshTimer = null
    }
    if (!this.state.expiresAt) return

    const delay = Math.max(this.state.expiresAt - Date.now() - REFRESH_SKEW_MS, MIN_REFRESH_DELAY_MS)
    this.refreshTimer = setTimeout(async () => {
      const ok = await this.refreshToken()
      if (!ok) {
        this.notifyAuthRequired()
      }
    }, delay)
  }

  private clearSession() {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer)
      this.refreshTimer = null
    }
    this.staticDevToken = false
    this.state.isAuthenticated = false
    this.state.token = null
    this.state.refreshToken = null
    this.state.userProfile = null
    this.state.expiresAt = null
    localStorage.removeItem(ACCESS_TOKEN_KEY)
    localStorage.removeItem(REFRESH_TOKEN_KEY)
    localStorage.removeItem(EXPIRES_AT_KEY)
  }

  /** Opens the in-app login modal (no Keycloak redirect). */
  async login(redirectUri?: string): Promise<void> {
    this.notifyAuthRequired(redirectUri)
  }

  async logout(): Promise<void> {
    const refresh = this.state.refreshToken || localStorage.getItem(REFRESH_TOKEN_KEY)
    if (refresh) {
      // Back-channel revoke — fire and forget; local logout must not wait on it.
      void fetch(KEYCLOAK_LOGOUT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: KEYCLOAK_CLIENT_ID,
          refresh_token: refresh,
        }),
      }).catch(() => {})
    }
    this.clearSession()
    this.notifyAuthRequired()
  }

  getToken(): string | null {
    return this.state.token
  }

  getUserProfile(): UserProfile | null {
    return this.state.userProfile
  }

  isAuthenticated(): boolean {
    return this.state.isAuthenticated
  }

  getAuthHeader(): { Authorization: string } | Record<string, never> {
    return this.state.token ? { Authorization: `Bearer ${this.state.token}` } : {}
  }

  get maxOtpFailures(): number {
    return MAX_OTP_FAILURES
  }
}

export const authService = new AuthService()
export default authService
