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

class JesoosApiService extends ApiClient {
  constructor() {
    super(appConfig.jesoosServer)
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
