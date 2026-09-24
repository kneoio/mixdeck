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

/** How long the DJ still has to finish and send the current link. Assumed shape, not confirmed with the backend. */
export interface AivoxDeadline {
  /** Seconds until the queued "up next" song actually starts and can no longer be changed. */
  secondsUntilLocked: number
  /** Seconds the system reserves to render/upload the finished mix before air. */
  stitchBufferSeconds: number
}

export interface AivoxQueueResponse {
  brandId: string
  updatedAt: string
  fullQueue: AivoxQueueEntry[]
  /** Absent or `null` when nothing is queued yet, or the backend doesn't report a deadline. */
  deadline?: AivoxDeadline | null
}

export type AivoxDashboardStreamType = 'RADIO' | 'OTS'

/** The fragment currently going live: `committedSeconds` of it can no longer be cut, `pendingSeconds` of queued audio still can. */
export interface AivoxStreamBuffer {
  soundFragmentId: string
  title: string
  durationSeconds: number
  committedSeconds: number
  pendingSeconds: number
  /** Set when the fragment is a human DJ join: which one, and where its incoming song begins in it. */
  djJoinId: string | null
  djIncomingSongStartSeconds: number | null
}

export interface AivoxDashboardStreamEntry {
  brand: string
  type: AivoxDashboardStreamType
  status: string
  heartbeat: boolean
  error: string | null
  remainingMinutes: number
  buffer: AivoxStreamBuffer | null
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
}

export const aivoxApiService = new AivoxApiService()
export default aivoxApiService
