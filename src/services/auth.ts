import { appConfig } from '@/config/appConfig'

const ACCESS_TOKEN_KEY = 'mixdeck_access_token'
const REFRESH_TOKEN_KEY = 'mixdeck_refresh_token'
const EXPIRES_AT_KEY = 'mixdeck_token_expires_at'

/** Prod: same-origin proxy on mixpla.io. Dev: remote Keycloak (no local proxy). */
const KEYCLOAK_REALM_BASE = import.meta.env.PROD
  ? `/auth/realms/${appConfig.keycloak.realm}`
  : `${appConfig.keycloak.url}/realms/${appConfig.keycloak.realm}`
const KEYCLOAK_TOKEN_URL = `${KEYCLOAK_REALM_BASE}/protocol/openid-connect/token`
const KEYCLOAK_LOGOUT_URL = `${KEYCLOAK_REALM_BASE}/protocol/openid-connect/logout`
/** OTP direct-access grant — not the OIDC `mixpla_web` client in env. */
const KEYCLOAK_CLIENT_ID = 'mixdeck_otp'

/** Refresh this many ms before access-token expiry. */
const REFRESH_SKEW_MS = 30_000
const MIN_REFRESH_DELAY_MS = 5_000
const MAX_OTP_FAILURES = 5
/** Serializes refreshes across tabs so only one of them talks to Keycloak at a time. */
const REFRESH_LOCK_NAME = 'mixdeck-auth-refresh'
/** In-call retries when Keycloak is unreachable or answers 5xx (e.g. mid-deploy). */
const REFRESH_RETRY_DELAYS_MS = [1_000, 3_000]
/** After those retries fail, try again this often while the session is kept. */
const TRANSIENT_RETRY_MS = 15_000

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
export type SessionChangeListener = (authenticated: boolean) => void

/**
 * `invalid` — Keycloak rejected the refresh token, the session is over.
 * `transient` — network error or 5xx; the stored session is kept and retried.
 */
export type RefreshResult = 'ok' | 'invalid' | 'transient'

type StoredTokens = {
  access: string
  refresh: string
  expiresAt: number
}

function readStoredTokens(): StoredTokens | null {
  const access = localStorage.getItem(ACCESS_TOKEN_KEY)
  const refresh = localStorage.getItem(REFRESH_TOKEN_KEY)
  if (!access || !refresh) return null
  return { access, refresh, expiresAt: Number(localStorage.getItem(EXPIRES_AT_KEY)) || 0 }
}

function withRefreshLock<T>(task: () => Promise<T>): Promise<T> {
  if (typeof navigator !== 'undefined' && navigator.locks?.request) {
    return navigator.locks.request(REFRESH_LOCK_NAME, task)
  }
  return task()
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

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
  private refreshPromise: Promise<RefreshResult> | null = null
  private refreshTimer: ReturnType<typeof setTimeout> | null = null
  private authRequiredListeners = new Set<AuthRequiredListener>()
  private sessionChangeListeners = new Set<SessionChangeListener>()
  /** True when the session came from `VITE_DEV_ACCESS_TOKEN` (no Keycloak refresh). */
  private staticDevToken = false

  constructor() {
    if (typeof window === 'undefined') return
    window.addEventListener('storage', (event) => this.onStorage(event))
    window.addEventListener('online', () => {
      if (this.state.refreshToken && this.isNearExpiry()) void this.refresh()
    })
  }

  onAuthRequired(listener: AuthRequiredListener): () => void {
    this.authRequiredListeners.add(listener)
    return () => {
      this.authRequiredListeners.delete(listener)
    }
  }

  /** Fires when the session ends or starts without this tab asking for it (rejected refresh, another tab). */
  onSessionChange(listener: SessionChangeListener): () => void {
    this.sessionChangeListeners.add(listener)
    return () => {
      this.sessionChangeListeners.delete(listener)
    }
  }

  private notifyAuthRequired(redirectUri?: string) {
    for (const listener of this.authRequiredListeners) {
      listener(redirectUri)
    }
  }

  private notifySessionChange(authenticated: boolean) {
    for (const listener of this.sessionChangeListeners) {
      listener(authenticated)
    }
  }

  /** Keeps tabs in step: another tab refreshed, logged in, or logged out. */
  private onStorage(event: StorageEvent) {
    if (this.staticDevToken || event.storageArea !== localStorage) return
    if (event.key !== null && event.key !== ACCESS_TOKEN_KEY && event.key !== REFRESH_TOKEN_KEY && event.key !== EXPIRES_AT_KEY) {
      return
    }

    const stored = readStoredTokens()
    if (stored) {
      if (
        stored.access === this.state.token &&
        stored.refresh === this.state.refreshToken &&
        stored.expiresAt === this.state.expiresAt
      ) {
        return
      }
      const wasAuthenticated = this.state.isAuthenticated
      this.adoptTokens(stored)
      if (!wasAuthenticated && this.initialized) this.notifySessionChange(true)
    } else if (this.state.token) {
      this.resetState()
      if (this.initialized) this.notifySessionChange(false)
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

    const stored = readStoredTokens()
    if (!stored) {
      this.initialized = true
      return false
    }

    this.adoptTokens(stored)

    if (this.isNearExpiry()) {
      const result = await this.refresh()
      this.initialized = true
      // A transient failure keeps the stored session: requests refresh again once Keycloak answers.
      return result !== 'invalid'
    }

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

  refresh(): Promise<RefreshResult> {
    if (!this.refreshPromise) {
      this.refreshPromise = this.doRefresh().finally(() => {
        this.refreshPromise = null
      })
    }
    return this.refreshPromise
  }

  /** Refreshes only when the access token is missing its expiry or about to lapse. */
  async ensureValidToken(): Promise<boolean> {
    if (this.staticDevToken) return true
    if (!this.state.token) return false
    if (!this.isNearExpiry()) return true
    return (await this.refresh()) !== 'invalid'
  }

  /** Resolves once no refresh is in flight, so a reload can't drop freshly rotated tokens. */
  async whenIdle(): Promise<void> {
    if (this.refreshPromise) await this.refreshPromise
  }

  /** `fetch` with the bearer token; refreshes and retries once on 401. */
  async authorizedFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
    await this.ensureValidToken()
    const send = () => {
      const headers = new Headers(init.headers)
      if (this.state.token) headers.set('Authorization', `Bearer ${this.state.token}`)
      return fetch(input, { ...init, headers })
    }

    const response = await send()
    if (response.status !== 401 || this.staticDevToken) return response
    if ((await this.refresh()) !== 'ok') return response
    return send()
  }

  private isNearExpiry(): boolean {
    return !this.state.expiresAt || Date.now() >= this.state.expiresAt - REFRESH_SKEW_MS
  }

  private async doRefresh(): Promise<RefreshResult> {
    if (this.staticDevToken) {
      return 'ok'
    }

    const wasAuthenticated = this.state.isAuthenticated
    const result = await withRefreshLock(() => this.refreshUnderLock())

    if (result === 'invalid') {
      if (wasAuthenticated && this.initialized) this.notifySessionChange(false)
    } else if (result === 'transient' && this.state.refreshToken) {
      this.scheduleRefreshIn(TRANSIENT_RETRY_MS)
    }
    return result
  }

  private async refreshUnderLock(): Promise<RefreshResult> {
    // Another tab may have refreshed while this one waited for the lock — use its tokens.
    const stored = readStoredTokens()
    if (stored && stored.access !== this.state.token && Date.now() < stored.expiresAt - REFRESH_SKEW_MS) {
      this.adoptTokens(stored)
      return 'ok'
    }

    const refresh = stored?.refresh ?? this.state.refreshToken
    if (!refresh) {
      this.clearSession()
      return 'invalid'
    }

    for (let attempt = 0; ; attempt++) {
      const result = await this.requestRefresh(refresh)
      if (result === 'invalid') {
        // A login in another tab may have landed meanwhile — keep that one instead of wiping it.
        const latest = readStoredTokens()
        if (latest && latest.refresh !== refresh) {
          this.adoptTokens(latest)
          return 'ok'
        }
        this.clearSession()
        return result
      }
      if (result === 'ok' || attempt >= REFRESH_RETRY_DELAYS_MS.length) return result
      await sleep(REFRESH_RETRY_DELAYS_MS[attempt])
    }
  }

  private async requestRefresh(refreshToken: string): Promise<RefreshResult> {
    let response: Response
    try {
      response = await fetch(KEYCLOAK_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          client_id: KEYCLOAK_CLIENT_ID,
          refresh_token: refreshToken,
        }),
      })
    } catch {
      return 'transient'
    }

    if (response.ok) {
      try {
        this.applyTokens((await response.json()) as TokenResponse)
        return 'ok'
      } catch {
        return 'transient'
      }
    }

    // Keycloak answers a dead refresh token with 400 invalid_grant (401 = client rejected).
    // Anything else — a proxy 5xx mid-deploy, rate limiting — says nothing about the session.
    return response.status === 400 || response.status === 401 ? 'invalid' : 'transient'
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
    const tokens: StoredTokens = {
      access: data.access_token,
      refresh: data.refresh_token,
      expiresAt: Date.now() + data.expires_in * 1000,
    }
    localStorage.setItem(ACCESS_TOKEN_KEY, tokens.access)
    localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refresh)
    localStorage.setItem(EXPIRES_AT_KEY, String(tokens.expiresAt))
    this.adoptTokens(tokens)
  }

  private adoptTokens(tokens: StoredTokens) {
    this.state.token = tokens.access
    this.state.refreshToken = tokens.refresh
    this.state.expiresAt = tokens.expiresAt || null
    this.state.isAuthenticated = true
    this.state.userProfile = profileFromAccessToken(tokens.access)
    this.scheduleRefresh()
  }

  private scheduleRefresh() {
    if (!this.state.expiresAt) {
      this.clearRefreshTimer()
      return
    }
    this.scheduleRefreshIn(Math.max(this.state.expiresAt - Date.now() - REFRESH_SKEW_MS, MIN_REFRESH_DELAY_MS))
  }

  private scheduleRefreshIn(delay: number) {
    this.clearRefreshTimer()
    this.refreshTimer = setTimeout(() => {
      this.refreshTimer = null
      void this.refresh()
    }, delay)
  }

  private clearRefreshTimer() {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer)
      this.refreshTimer = null
    }
  }

  private resetState() {
    this.clearRefreshTimer()
    this.staticDevToken = false
    this.state.isAuthenticated = false
    this.state.token = null
    this.state.refreshToken = null
    this.state.userProfile = null
    this.state.expiresAt = null
  }

  private clearSession() {
    this.resetState()
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
