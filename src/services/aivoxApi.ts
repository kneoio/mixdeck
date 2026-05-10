import { ApiClient } from './base'
import { appConfig } from '@/config/appConfig'

export type AivoxQueueType = 'played' | 'playing' | 'prioritized' | 'regular'

/** DJ-facing copy for one queue row (from `/info/queue`). */
export interface AivoxQueueDj {
  label: string
  title: string
  artist: string
}

/** Technical queue fields for one row. */
export interface AivoxQueueTech {
  pos: number
  queueType: AivoxQueueType
  priority: number
  songId: string
  slugName?: string
  mergingMethod?: string
  duration?: number
}

export interface AivoxQueueEntry {
  dj: AivoxQueueDj
  tech: AivoxQueueTech
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

export interface AivoxHeartbeatBatchRow {
  brand: string
  status?: string
  heartbeat?: boolean
}

export interface AivoxHeartbeatBatchResult {
  /** Live flag keyed by brand slug as returned by the API. */
  byBrand: Record<string, boolean>
  /** Response status, or 0 if the request failed before a response (e.g. network). */
  status: number
}

class AivoxApiService extends ApiClient {
  constructor() {
    super(appConfig.aivoxServer)
  }

  async heartbeatBatch(brandSlugs: string[]): Promise<AivoxHeartbeatBatchResult> {
    const unique = [...new Set(brandSlugs.filter(Boolean))]
    if (unique.length === 0) {
      return { byBrand: {}, status: 0 }
    }
    const path = unique.map(s => encodeURIComponent(s)).join(',')
    try {
      // No custom headers: avoids CORS preflight (OPTIONS) on cross-origin GET.
      const response = await fetch(`${this.baseUrl}/info/heartbeat/${path}`)
      const dead = (): AivoxHeartbeatBatchResult => ({
        byBrand: Object.fromEntries(unique.map(s => [s, false])),
        status: response.status,
      })
      if (!response.ok) {
        return dead()
      }
      const data = (await response.json()) as { brands?: AivoxHeartbeatBatchRow[] }
      const byBrand: Record<string, boolean> = Object.fromEntries(unique.map(s => [s, false]))
      for (const row of data.brands ?? []) {
        if (row?.brand == null) continue
        const alive = row.heartbeat ?? row.status === 'ON_LINE'
        byBrand[row.brand] = alive
      }
      return { byBrand, status: response.status }
    } catch {
      return {
        byBrand: Object.fromEntries(unique.map(s => [s, false])),
        status: 0,
      }
    }
  }

  async heartbeat(brandSlug: string): Promise<AivoxHeartbeatResult> {
    const { byBrand, status } = await this.heartbeatBatch([brandSlug])
    return { alive: byBrand[brandSlug] ?? false, status }
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
