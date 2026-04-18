import { ApiClient } from './base'
import { appConfig } from '@/config/appConfig'

export interface AgendaSong {
  songId: string
  songTitle: string
  artist: string
  durationSeconds: number
}

export interface AgendaTimelineBlock {
  id: string
  sequenceNumber: number
  scheduledEmissionTime: number[]
  mixingStrategy: string
  hasIntro: boolean
  hasJingle: boolean
  durationSeconds: number
  status: string
  statusHistory?: Array<{ status: string; at: string }>
  songs: AgendaSong[]
}

export interface AgendaScene {
  id: string
  title: string
  firstEmissionTime: number[]
  lastEmissionTime: number[]
  durationSeconds: number
  totalSongs: number
  fitSeconds: number
  timeline: AgendaTimelineBlock[]
}

export interface Agenda {
  timezone: string
  country?: string
  totalScenes: number
  scenes: AgendaScene[]
}

class MetriqApiService extends ApiClient {
  constructor() {
    super(appConfig.metriqServer)
  }

  async aivoxHeartbeat(brandSlug: string): Promise<boolean> {
    const response = await fetch(`${this.baseUrl}/${encodeURIComponent(brandSlug)}/heartbeat`, {
      headers: { 'X-Client-ID': 'mixpla-web' },
    })
    if (!response.ok) return false
    const text = await response.text()
    return text.trim() === 'true'
  }

  async aivoxStart(brandSlug: string): Promise<void> {
    await this.request<any>(`/${encodeURIComponent(brandSlug)}/start`, { method: 'POST' })
  }

  async aivoxStop(brandSlug: string): Promise<void> {
    await this.request<any>(`/${encodeURIComponent(brandSlug)}/stop`, { method: 'DELETE' })
  }

  async getAgendas(brandSlug: string): Promise<Agenda | null> {
    const response = await this.request<any>(`/jesoos/info/${encodeURIComponent(brandSlug)}/agendas`)
    if (!response) return null
    // Response may be { brandSlug: agendaObj } or the agendaObj directly
    if (response.scenes != null) return response as Agenda
    const nested = response[brandSlug]
    return nested ?? (Object.values(response)[0] as Agenda) ?? null
  }
}

export const metriqApiService = new MetriqApiService()
export default metriqApiService
