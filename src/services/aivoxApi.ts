import { ApiClient } from './base'
import { appConfig } from '@/config/appConfig'

class AivoxApiService extends ApiClient {
  constructor() {
    super(appConfig.aivoxServer)
  }

  async heartbeat(brandSlug: string): Promise<boolean> {
    const response = await fetch(`${this.baseUrl}/${encodeURIComponent(brandSlug)}/heartbeat`, {
      headers: { 'X-Client-ID': 'mixpla-web' },
    })
    if (!response.ok) return false
    const text = await response.text()
    return text.trim() === 'true'
  }

  async start(brandSlug: string): Promise<void> {
    await this.request<any>(`/${encodeURIComponent(brandSlug)}/start`, { method: 'POST' })
  }

  async stop(brandSlug: string): Promise<void> {
    await this.request<any>(`/${encodeURIComponent(brandSlug)}/stop`, { method: 'DELETE' })
  }
}

export const aivoxApiService = new AivoxApiService()
export default aivoxApiService
