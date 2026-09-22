import { ApiClient } from './base'
import { appConfig } from '@/config/appConfig'

export interface AgendaSong {
  songId: string
  songTitle: string
  artist: string
  durationSeconds: number
  shared?: boolean
  sharerName?: string
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
  createdAt?: number[]
  totalScenes: number
  scenes: AgendaScene[]
}

export interface DebugInstructionRequest {
  instruction: string
  contextVars: Record<string, string>
  language: string
}

export interface DebugInstructionResponse {
  rendered: string
  llmResponse: string
  inputTokens: number
  outputTokens: number
}

/** A transition the DJ rendered in the deck. aivox stitches it onto the join before it. */
export interface DjJoin {
  blob: Blob
  joinId: string
  /** The join this one cuts into; null for the first join of a session. */
  continuesJoinId: string | null
  durationSeconds: number
  /** Where second 0 of the incoming song sits in this file. */
  incomingSongStartSeconds: number
  /** Where in the outgoing song this file begins. */
  outgoingSongFromSeconds: number
  songASlug: string
  songBSlug: string
}

class JesoosApiService extends ApiClient {
  constructor() {
    super(appConfig.jesoosServer)
  }

  /** Take the air: jesoos suspends the agenda until the session ends. */
  async startDjSession(brandSlug: string): Promise<{ startedAt: number }> {
    return this.request<{ startedAt: number }>(`/dj/${encodeURIComponent(brandSlug)}/session`, { method: 'POST' })
  }

  async endDjSession(brandSlug: string): Promise<void> {
    await this.request<void>(`/dj/${encodeURIComponent(brandSlug)}/session`, { method: 'DELETE' })
  }

  async sendDjJoin(brandSlug: string, join: DjJoin): Promise<void> {
    const form = new FormData()
    form.append('file', join.blob, `${join.joinId}.wav`)
    form.append('joinId', join.joinId)
    if (join.continuesJoinId) form.append('continuesJoinId', join.continuesJoinId)
    form.append('durationSeconds', String(join.durationSeconds))
    form.append('incomingSongStartSeconds', String(join.incomingSongStartSeconds))
    form.append('outgoingSongFromSeconds', String(join.outgoingSongFromSeconds))
    form.append('songASlug', join.songASlug)
    form.append('songBSlug', join.songBSlug)
    await this.request<void>(`/dj/${encodeURIComponent(brandSlug)}/air`, { method: 'POST', body: form })
  }

  async debugInstruction(brandSlug: string, body: DebugInstructionRequest): Promise<DebugInstructionResponse> {
    return this.post<DebugInstructionResponse>(`/debug/${encodeURIComponent(brandSlug)}/instruction`, body)
  }

  async getAgendas(brandSlug: string): Promise<Agenda | null> {
    const response = await this.request<any>(`/info/${encodeURIComponent(brandSlug)}/agendas`)
    if (!response) return null
    if (response.scenes != null) return response as Agenda
    const nested = response[brandSlug]
    return nested ?? (Object.values(response)[0] as Agenda) ?? null
  }
}

export const jesoosApiService = new JesoosApiService()
export default jesoosApiService
