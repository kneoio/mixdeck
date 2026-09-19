import { ApiClient } from './base'
import { appConfig } from '@/config/appConfig'
import authService from './auth'

/**
 * DJ Mode backend. Single swap point: set MOCK_DJ_BACKEND = false once the jesoos
 * DJ endpoints ship. The live ON AIR endpoint already exists and is always real.
 */
const MOCK_DJ_BACKEND = true

export interface DjAirRequest {
  filename: string
  durationSeconds: number
  /** [A, B] */
  songIds: [string, string]
  title: string
  artist: string
}

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))

class DjApiService extends ApiClient {
  constructor() {
    super(appConfig.jesoosServer)
  }

  /** POST /dj/{brand}/session — take over the station. Resolves with the session start time (ms). */
  async startSession(brandSlug: string): Promise<{ startedAt: number }> {
    if (MOCK_DJ_BACKEND) {
      await sleep(400)
      return { startedAt: Date.now() }
    }
    await this.request<void>(`/dj/${encodeURIComponent(brandSlug)}/session`, { method: 'POST' })
    return { startedAt: Date.now() }
  }

  /** DELETE /dj/{brand}/session — hand the station back to the AI agenda. */
  async endSession(brandSlug: string): Promise<void> {
    if (MOCK_DJ_BACKEND) {
      await sleep(250)
      return
    }
    await this.request<void>(`/dj/${encodeURIComponent(brandSlug)}/session`, { method: 'DELETE' })
  }

  /** GET /info/{brand}/live — ON AIR state. `null` when the response shape is not recognised. */
  async getOnAir(brandSlug: string): Promise<boolean | null> {
    const res = await this.request<any>(`/info/${encodeURIComponent(brandSlug)}/live`)
    if (typeof res === 'boolean') return res
    return typeof res?.onAir === 'boolean' ? res.onAir : null
  }

  /** POST /chat/upload-temp?token= — multipart audio upload. Resolves with the stored filename. */
  async uploadTemp(blob: Blob, filename: string): Promise<string> {
    if (MOCK_DJ_BACKEND) {
      await sleep(600)
      return filename
    }
    const token = authService.getToken()
    if (!token) throw new Error('Unauthorized')
    const form = new FormData()
    form.append('file', blob, filename)
    const response = await fetch(`${this.baseUrl}/chat/upload-temp?token=${encodeURIComponent(token)}`, {
      method: 'POST',
      body: form,
    })
    if (!response.ok) throw new Error(`Upload failed (${response.status})`)
    const body = await response.json()
    return typeof body?.filename === 'string' ? body.filename : filename
  }

  /** POST /dj/{brand}/air — queue the uploaded segment as an ordinary song. */
  async sendToAir(brandSlug: string, body: DjAirRequest): Promise<void> {
    if (MOCK_DJ_BACKEND) {
      await sleep(500)
      console.info('[dj mock] air', brandSlug, body)
      return
    }
    await this.post<void>(`/dj/${encodeURIComponent(brandSlug)}/air`, body)
  }
}

export const djApiService = new DjApiService()
export default djApiService
