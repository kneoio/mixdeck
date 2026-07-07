import { ApiClient, type PagedResult } from './base'
import { appConfig } from '@/config/appConfig'
import type { SubscriptionProductEntry, UserSubscriptionDTO } from './coreApi'

export interface ChangePlanResult {
  checkoutUrl?: string
  changed?: boolean
}

class NivaroApiService extends ApiClient {
  constructor() {
    super(appConfig.nivaroServer)
  }

  async getSubscriptionProducts(page = 1, pageSize = 10): Promise<PagedResult<SubscriptionProductEntry>> {
    const res = await this.request<unknown>('/subscriptions/products')
    const entries: SubscriptionProductEntry[] = Array.isArray(res) ? res : []
    return { entries, count: entries.length, pageNum: page, maxPage: 1, pageSize }
  }

  async getCurrentUserSubscription(sync = false): Promise<UserSubscriptionDTO | null> {
    try {
      return await this.request<UserSubscriptionDTO>(`/subscriptions/current${sync ? '?sync=true' : ''}`)
    } catch (error) {
      if (error instanceof Error && error.message.includes('404')) {
        return null
      }
      throw error
    }
  }

  // Free -> Pro returns a checkoutUrl to redirect to; paid -> paid switches directly (may throw
  // ApiPaymentActionRequiredError if Stripe needs 3-D Secure re-authentication).
  async changePlan(planIdentifier: string): Promise<ChangePlanResult> {
    return this.request<ChangePlanResult>('/subscriptions/current', {
      method: 'PATCH',
      body: JSON.stringify({ plan: planIdentifier }),
    })
  }

  async cancelSubscription(): Promise<void> {
    await this.request<void>('/subscriptions/current', { method: 'DELETE' })
  }
}

export const nivaroApiService = new NivaroApiService()
export default nivaroApiService
