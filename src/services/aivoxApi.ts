import { ApiClient } from './base'
import { appConfig } from '@/config/appConfig'

export type AivoxQueueType = 'played' | 'playing' | 'prioritized' | 'regular'

export interface AivoxQueueEntry {
  pos: number
  queueType: AivoxQueueType
  songId: string
  title: string
  artist: string
  priority: number
}

export interface AivoxQueueResponse {
  brandId: string
  updatedAt: string
  fullQueue: AivoxQueueEntry[]
}

export interface AivoxHeartbeatResult {
  alive: boolean
  /** Response status, or 0 if the request failed before a response (e.g. network). */
  status: number
}

class AivoxApiService extends ApiClient {
  constructor() {
    super(appConfig.aivoxServer)
  }

  async heartbeat(brandSlug: string): Promise<AivoxHeartbeatResult> {
    try {
      const response = await fetch(`${this.baseUrl}/info/heartbeat/${encodeURIComponent(brandSlug)}`, {
        headers: { 'X-Client-ID': 'mixpla-web' },
      })
      if (!response.ok) {
        return { alive: false, status: response.status }
      }
      const text = await response.text()
      return { alive: text.trim() === 'true', status: response.status }
    } catch {
      return { alive: false, status: 0 }
    }
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
