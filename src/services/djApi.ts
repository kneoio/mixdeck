import { ApiClient } from './base'
import { appConfig } from '@/config/appConfig'
import authService from './auth'
import { decodeBlob, MAX_VOICE_SECONDS } from '@/utils/djAudio'

/**
 * DJ Mode backend. The session and air endpoints are live; chat and voice generation are still mocked
 * until jesoos ships them.
 */
const MOCK_DJ_BACKEND = true

export interface DjAirRequest {
  /** The rendered join, already mixed in the browser. */
  blob: Blob
  joinId: string
  /** The join this one cuts into; null for the first join of a session. */
  continuesJoinId: string | null
  durationSeconds: number
  /** Where second 0 of the incoming song sits in this file. */
  incomingSongStartSeconds: number
  /** Where in the outgoing song this file begins. */
  outgoingSongFromSeconds: number
  songAId: string
  songBId: string
}

export interface DjChatSong {
  id: string
  title: string
  artist: string
}

/** Deck state every chat/generate call carries so the AI knows what it is linking. */
export interface DjChatContext {
  songA: DjChatSong | null
  songB: DjChatSong | null
  maxVoiceSeconds: number
}

export interface DjChatTurn {
  role: 'user' | 'dj'
  text: string
}

export interface DjChatRequest {
  message: string
  history: DjChatTurn[]
  context: DjChatContext
}

export interface DjChatReply {
  reply: string
  /** The exact words the AI proposes to say, if it offered one. */
  script?: string
}

export interface DjGenerateVoiceRequest {
  script?: string
  instruction?: string
  style?: string
  context: DjChatContext
}

export interface DjGeneratedVoice {
  buffer: AudioBuffer
  script: string
  durationSeconds: number
}

/** A two-tone "beep" placeholder — obviously not a real voice — for mock-generated links. */
function mockVoiceBuffer(durationSeconds: number, sampleRate = 44100): AudioBuffer {
  const length = Math.max(1, Math.round(durationSeconds * sampleRate))
  const buf = new AudioBuffer({ length, numberOfChannels: 1, sampleRate })
  const data = new Float32Array(length)
  for (let i = 0; i < length; i++) {
    const t = i / sampleRate
    const tone = Math.sin(2 * Math.PI * 440 * t) * 0.5 + Math.sin(2 * Math.PI * 660 * t) * 0.3
    const env = Math.min(1, t / 0.05) * Math.min(1, (durationSeconds - t) / 0.05)
    data[i] = tone * env * 0.4
  }
  buf.copyToChannel(data, 0)
  return buf
}

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))

function scriptFor(instruction: string | undefined, context: DjChatContext): string {
  const a = context.songA?.title ?? 'that last one'
  const b = context.songB?.title ?? 'this next one'
  const i = (instruction ?? '').toLowerCase()
  if (i.includes('short')) return `${a} into ${b}.`
  if (i.includes('hype') || i.includes('energy')) return `That was ${a} — and we are NOT slowing down, because ${b} is next!`
  if (i.includes('smooth')) return `Nice and easy — that was ${a}, sliding into ${b}.`
  return `You were listening to ${a}. Up next, ${b}.`
}

function mockChatReply({ message, context }: DjChatRequest): DjChatReply {
  if (!context.songA || !context.songB) {
    return { reply: 'Pick both songs first and I can write the link.' }
  }
  return {
    reply: `Here's an idea for the link between ${context.songA.title} and ${context.songB.title}:`,
    script: scriptFor(message, context),
  }
}

function mockGeneratedVoice({ script, instruction, context }: DjGenerateVoiceRequest): DjGeneratedVoice {
  const text = script ?? scriptFor(instruction, context)
  const durationSeconds = Math.min(MAX_VOICE_SECONDS, Math.max(1.5, text.length / 15))
  return { buffer: mockVoiceBuffer(durationSeconds), script: text, durationSeconds }
}

class DjApiService extends ApiClient {
  constructor() {
    super(appConfig.jesoosServer)
  }

  private tokenParam(): string {
    const token = authService.getToken()
    if (!token) throw new Error('Unauthorized')
    return `token=${encodeURIComponent(token)}`
  }

  /** POST /dj/{brand}/session — take over the station. Resolves with the session start time (ms). */
  async startSession(brandSlug: string): Promise<{ startedAt: number }> {
    const response = await fetch(
      `${this.baseUrl}/dj/${encodeURIComponent(brandSlug)}/session?${this.tokenParam()}`, { method: 'POST' })
    if (!response.ok) throw new Error(`Session start failed (${response.status})`)
    const body = await response.json()
    return { startedAt: typeof body?.startedAt === 'number' ? body.startedAt : Date.now() }
  }

  /** DELETE /dj/{brand}/session — hand the station back to the AI agenda. */
  async endSession(brandSlug: string): Promise<void> {
    const response = await fetch(
      `${this.baseUrl}/dj/${encodeURIComponent(brandSlug)}/session?${this.tokenParam()}`, { method: 'DELETE' })
    if (!response.ok) throw new Error(`Session end failed (${response.status})`)
  }

  /** GET /info/{brand}/live — ON AIR state. `null` when the response shape is not recognised. */
  async getOnAir(brandSlug: string): Promise<boolean | null> {
    const res = await this.request<any>(`/info/${encodeURIComponent(brandSlug)}/live`)
    if (typeof res === 'boolean') return res
    return typeof res?.onAir === 'boolean' ? res.onAir : null
  }

  /** POST /dj/{brand}/air — upload the rendered join and queue it. aivox stitches it onto the previous one. */
  async sendToAir(brandSlug: string, body: DjAirRequest): Promise<void> {
    const form = new FormData()
    form.append('file', body.blob, `${body.joinId}.wav`)
    form.append('joinId', body.joinId)
    if (body.continuesJoinId) form.append('continuesJoinId', body.continuesJoinId)
    form.append('durationSeconds', String(body.durationSeconds))
    form.append('incomingSongStartSeconds', String(body.incomingSongStartSeconds))
    form.append('outgoingSongFromSeconds', String(body.outgoingSongFromSeconds))
    form.append('songAId', body.songAId)
    form.append('songBId', body.songBId)
    const response = await fetch(
      `${this.baseUrl}/dj/${encodeURIComponent(brandSlug)}/air?${this.tokenParam()}`, { method: 'POST', body: form })
    if (!response.ok) throw new Error(`Send failed (${response.status})`)
  }

  /**
   * POST /dj/{brand}/chat — talk to the station's AI DJ about the current A/B link.
   * Endpoint shape is proposed, not confirmed with the backend owner.
   */
  async chat(brandSlug: string, body: DjChatRequest): Promise<DjChatReply> {
    if (MOCK_DJ_BACKEND) {
      await sleep(500)
      return mockChatReply(body)
    }
    return this.post<DjChatReply>(`/dj/${encodeURIComponent(brandSlug)}/chat`, body)
  }

  /**
   * POST /dj/{brand}/generate-voice — synthesize spoken audio for a script/instruction.
   * Endpoint shape is proposed, not confirmed with the backend owner.
   */
  async generateVoice(brandSlug: string, body: DjGenerateVoiceRequest): Promise<DjGeneratedVoice> {
    if (MOCK_DJ_BACKEND) {
      await sleep(900)
      return mockGeneratedVoice(body)
    }
    const meta = await this.post<{ filename: string; durationSeconds: number; script: string }>(
      `/dj/${encodeURIComponent(brandSlug)}/generate-voice`, body,
    )
    const token = authService.getToken()
    if (!token) throw new Error('Unauthorized')
    // Assumed: generated audio is served back the same way /chat/upload-temp addresses an
    // upload. Not confirmed with the backend owner.
    const response = await fetch(
      `${this.baseUrl}/chat/download-temp/${encodeURIComponent(meta.filename)}?token=${encodeURIComponent(token)}`,
    )
    if (!response.ok) throw new Error(`Fetch failed (${response.status})`)
    const buffer = await decodeBlob(await response.blob())
    return { buffer, script: meta.script, durationSeconds: meta.durationSeconds }
  }
}

export const djApiService = new DjApiService()
export default djApiService
