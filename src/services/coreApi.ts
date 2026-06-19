import { ApiClient, type PagedResult } from './base'
import { appConfig } from '@/config/appConfig'

export interface SubscriptionProductEntry {
  id: string
  identifier: string
  name: string
  description: string
  stripePriceId?: string
  stripeProductId?: string
  active?: boolean
  subscribed?: boolean
  subscriptionStatus?: string
}

export interface UserSubscriptionDTO {
  user?: { login?: string }
  stripeCustomerId?: string
  subscriptionType?: string
  subscriptionStatus?: string
  trialEnd?: string
  currentPeriodStart?: string
  currentPeriodEnd?: string
  cancelAt?: string
  canceledAt?: string
  active: boolean
  streamDurationMinutes?: number
  otsAllowed: boolean
  maxSongs?: number
  streamQualityKbps?: number
  djTypeId?: string
  supportLevel: number
  customScriptAllowed: boolean
  maxStations?: number
  priceEur?: number
  codecs?: string[]
}

class CoreApiService extends ApiClient {
  constructor() {
    super(appConfig.datanestServer)
  }

  async getSubscriptionProducts(page = 1, pageSize = 10): Promise<PagedResult<SubscriptionProductEntry>> {
    const res = await this.request<unknown>('/subscriptions/products')
    const entries: SubscriptionProductEntry[] = Array.isArray(res) ? res : []
    return { entries, count: entries.length, pageNum: page, maxPage: 1, pageSize }
  }
}

export const coreApiService = new CoreApiService()
export default coreApiService
