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

/** One event from spectra's mix-job SSE stream, relayed by aivox unchanged. */
export interface AivoxMixProgress {
  id: string
  name: string
  status: 'PROCESSING' | 'DONE' | 'ERROR'
  errorMessage: string | null
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

/** The last human DJ join while it has not played out: a reopened deck carries on from its incoming song. */
export interface AivoxDjJoinOnAir {
  joinId: string
  incomingSongId: string
  incomingSongSlug: string
  incomingSongTitle: string
  incomingSongArtist: string
}

export interface AivoxDashboardStreamEntry {
  brand: string
  type: AivoxDashboardStreamType
  status: string
  heartbeat: boolean
  error: string | null
  remainingMinutes: number
  buffer: AivoxStreamBuffer | null
  lastDjJoin: AivoxDjJoinOnAir | null
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

  /** Starts a crossfade render between two songs (by slug) through spectra and returns its job id. */
  async startMixJob(slugA: string, slugC: string, seconds = 30, keylock = true): Promise<{ job_id: string }> {
    return this.request<{ job_id: string }>('/mix', {
      method: 'POST',
      headers: { 'X-Client-ID': 'mixpla-web' },
      body: JSON.stringify({ slugA, slugC, seconds, keylock }),
    })
  }

  /**
   * Follows a mix job's SSE progress stream, calling `onProgress` for each event, and resolves
   * with the last one (`DONE` or `ERROR`) once the stream ends. Bypasses `request()`, whose
   * JSON-only response handling doesn't fit a streamed body.
   */
  async mixEvents(jobId: string, onProgress: (progress: AivoxMixProgress) => void): Promise<AivoxMixProgress> {
    const response = await fetch(`${this.baseUrl}/mix/${encodeURIComponent(jobId)}/events`, {
      headers: { 'X-Client-ID': 'mixpla-web', ...authService.getAuthHeader() },
    })
    if (!response.ok || !response.body) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let last: AivoxMixProgress | null = null
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      let boundary: number
      while ((boundary = buffer.indexOf('\n\n')) >= 0) {
        const rawEvent = buffer.slice(0, boundary)
        buffer = buffer.slice(boundary + 2)
        const data = rawEvent.split('\n').filter(line => line.startsWith('data:')).map(line => line.slice(5).trim()).join('')
        if (!data) continue
        last = JSON.parse(data) as AivoxMixProgress
        onProgress(last)
      }
    }
    if (!last) throw new Error('Mix events stream ended with no progress')
    return last
  }

  /** Fetches a finished mix job's rendered wav and the plan spectra sent back in `X-Mix-Plan`. */
  async getMixResult(jobId: string): Promise<{ blob: Blob; plan: string | null }> {
    const response = await fetch(`${this.baseUrl}/mix/${encodeURIComponent(jobId)}/result`, {
      headers: { 'X-Client-ID': 'mixpla-web', ...authService.getAuthHeader() },
    })
    if (!response.ok) {
      const detail = await response.json().catch(() => null)
      throw new Error(detail?.detail || `HTTP error! status: ${response.status}`)
    }
    return { blob: await response.blob(), plan: response.headers.get('X-Mix-Plan') }
  }
}

export const aivoxApiService = new AivoxApiService()
export default aivoxApiService
