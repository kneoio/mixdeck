import { ApiClient, type PagedResult } from './base'
import { appConfig } from '@/config/appConfig'
import type { SubscriptionProductEntry, UserSubscriptionDTO } from './coreApi'

class NivaroApiService extends ApiClient {
  constructor() {
    super(appConfig.nivaroServer)
  }

  async getSubscriptionProducts(page = 1, pageSize = 10): Promise<PagedResult<SubscriptionProductEntry>> {
    const res = await this.request<unknown>('/subscriptions/products')
    const entries: SubscriptionProductEntry[] = Array.isArray(res) ? res : []
    return { entries, count: entries.length, pageNum: page, maxPage: 1, pageSize }
  }

  async getCurrentUserSubscription(): Promise<UserSubscriptionDTO | null> {
    try {
      return await this.request<UserSubscriptionDTO>('/user-subscriptions/current')
    } catch (error) {
      if (error instanceof Error && error.message.includes('404')) {
        return null
      }
      throw error
    }
  }
}

export const nivaroApiService = new NivaroApiService()
export default nivaroApiService
