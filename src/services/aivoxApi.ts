import { ApiClient } from './base'
import { appConfig } from '@/config/appConfig'
import { authService } from './auth'

export type AivoxQueueType = 'played' | 'playing' | 'prioritized' | 'regular'

export interface AivoxQueueEntry {
  songInfo: {
    labels: string[]
    title: string
    artist: string
  }
  tech: {
    pos: number
    queueType: AivoxQueueType
    priority: number
    songId: string | null
    slugName: string
    mergingMethod: string
    duration: number | null
  }
}

export interface AivoxQueueResponse {
  brandId: string
  updatedAt: string
  fullQueue: AivoxQueueEntry[]
}

export type AivoxDashboardStreamType = 'RADIO' | 'OTS'

export interface AivoxDashboardStreamEntry {
  brand: string
  type: AivoxDashboardStreamType
  status: string
  heartbeat: boolean
  error: string | null
  remainingMinutes: number
}

class AivoxApiService extends ApiClient {
  constructor() {
    super(appConfig.aivoxServer)
  }

  dashboardStreamUrl(): string | null {
    const token = authService.getToken()
    if (!token) return null
    const wsBase = this.baseUrl.replace(/^http/, 'ws')
    return `${wsBase}/info/dashboard/stream?token=${encodeURIComponent(token)}`
  }

  async start(brandSlug: string): Promise<{ status: string }> {
    return this.request<{ status: string }>(`/command/start?brand=${encodeURIComponent(brandSlug)}`, { method: 'POST', headers: { 'X-Client-ID': 'mixpla-web' } })
  }

  async stop(brandSlug: string): Promise<{ status: string }> {
    return this.request<{ status: string }>(`/command/stop?brand=${encodeURIComponent(brandSlug)}`, { method: 'DELETE', headers: { 'X-Client-ID': 'mixpla-web' } })
  }

  async queue(brandSlug: string): Promise<AivoxQueueResponse> {
    return this.request<AivoxQueueResponse>(`/info/queue/${encodeURIComponent(brandSlug)}`, {
      headers: { 'X-Client-ID': 'mixpla-web' },
    })
  }

  /**
   * Soft-deletes an OTS definition and tears down its live stream in aivox.
   * Gated by validateAccess via X-Client-ID (no bearer/session token).
   * 200 -> resolved; 404 (OTS not found) -> treated as already-gone and resolved;
   * 400 (Invalid id) / 500 -> throws with the server error message.
   */
  async deleteOtsDefinition(id: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/ots-definitions/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: { 'X-Client-ID': 'mixpla-web' },
    })
    if (response.status === 404) return
    if (!response.ok) {
      let message = `HTTP error! status: ${response.status}`
      try {
        const data = await response.json()
        if (data && typeof (data as any).error === 'string') message = (data as any).error
      } catch { /* ignore */ }
      throw new Error(message)
    }
  }
}

export const aivoxApiService = new AivoxApiService()
export default aivoxApiService
