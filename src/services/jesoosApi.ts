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

/** Same chunk size the song upload uses. */
const DJ_JOIN_CHUNK_SIZE = 5 * 1024 * 1024

export interface DjJoinRender {
  blob: Blob
  format: 'opus' | 'wav'
}

/**
 * A transition the DJ rendered in the deck, in up to two renders. aivox stitches the full one onto the
 * join before it, or airs plan B (without A) when A has already played past the mix point.
 */
export interface DjJoin {
  /** A + link + C; null once A has already aired past the mix point. */
  full: DjJoinRender | null
  /** Link + C with A muted; null for the first join of a session. */
  planB: DjJoinRender | null
  joinId: string
  /** The join this one cuts into; null for the first join of a session. */
  continuesJoinId: string | null
  durationSeconds: number
  /** Where second 0 of the incoming song sits in the full render. */
  incomingSongStartSeconds: number
  /** Where in the outgoing song the full render begins. */
  outgoingSongFromSeconds: number
  /** Where in the full render the DJ's mix begins; before it the render is plain A. */
  mixPointSeconds: number
  /** Where second 0 of the incoming song sits in plan B. */
  planBIncomingSongStartSeconds: number
  /** Null when the link opens with the DJ's voice straight into C (no A). */
  songASlug: string | null
  /** Null when the link ends with the DJ's voice (no C); nothing continues from it. */
  songBSlug: string | null
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

  /**
   * The rendered join is a whole song plus the link, so it goes up in chunks like an uploaded song;
   * the metadata follows once the file is assembled.
   */
  async sendDjJoin(brandSlug: string, join: DjJoin, onProgress?: (percent: number) => void): Promise<void> {
    const brand = encodeURIComponent(brandSlug)
    const parts = [
      ...(join.full ? [{ part: 'main', render: join.full }] : []),
      ...(join.planB ? [{ part: 'planB', render: join.planB }] : []),
    ]
    const totalBytes = parts.reduce((sum, p) => sum + p.render.blob.size, 0) || 1
    let sentBytes = 0
    for (const { part, render } of parts) {
      const { blob, format } = render
      const totalChunks = Math.ceil(blob.size / DJ_JOIN_CHUNK_SIZE)
      for (let i = 0; i < totalChunks; i++) {
        const start = i * DJ_JOIN_CHUNK_SIZE
        const chunk = blob.slice(start, Math.min(start + DJ_JOIN_CHUNK_SIZE, blob.size))
        const body = new FormData()
        body.append('chunk', chunk, `${join.joinId}.${format}`)
        const params = new URLSearchParams({
          joinId: join.joinId,
          part,
          format,
          chunkIndex: String(i),
          totalChunks: String(totalChunks),
        })
        await this.request<void>(`/dj/${brand}/air/chunk?${params}`, { method: 'POST', body })
        sentBytes += chunk.size
        onProgress?.(Math.round((sentBytes / totalBytes) * 100))
      }
    }

    const form = new FormData()
    form.append('joinId', join.joinId)
    if (join.continuesJoinId) form.append('continuesJoinId', join.continuesJoinId)
    form.append('durationSeconds', String(join.durationSeconds))
    form.append('incomingSongStartSeconds', String(join.incomingSongStartSeconds))
    form.append('outgoingSongFromSeconds', String(join.outgoingSongFromSeconds))
    form.append('mixPointSeconds', String(join.mixPointSeconds))
    form.append('planBIncomingSongStartSeconds', String(join.planBIncomingSongStartSeconds))
    if (join.songASlug) form.append('songASlug', join.songASlug)
    if (join.songBSlug) form.append('songBSlug', join.songBSlug)
    await this.request<void>(`/dj/${brand}/air`, { method: 'POST', body: form })
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
