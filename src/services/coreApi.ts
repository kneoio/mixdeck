import { ApiClient, type PagedResult } from './base'
import { appConfig } from '@/config/appConfig'

export interface SubscriptionProductEntry {
  id: string
  identifier: string
  localizedName: Record<string, string>
  localizedDescription: Record<string, string>
  stripePriceId?: string
  stripeProductId?: string
  active?: boolean
}

class CoreApiService extends ApiClient {
  constructor() {
    super(appConfig.coreServer)
  }

  async getSubscriptionProducts(page = 1, pageSize = 10): Promise<PagedResult<SubscriptionProductEntry>> {
    return this.getPagedDictionary<SubscriptionProductEntry>('/subscription-products', page, pageSize)
  }
}

export const coreApiService = new CoreApiService()
export default coreApiService
