import authService from './auth'
import { ApiValidationError, ApiNotEnoughSongsError, ApiPaymentActionRequiredError, ApiEntitlementLimitError, isEntitlementLimitCode, type ValidationError } from '@/utils/errorHandler'
import { parseActions } from '@/utils/entitlements'
import { LOCALE_KEY } from '@/i18n'

function getAcceptLanguage(): string {
  return localStorage.getItem(LOCALE_KEY) || 'en'
}

export interface PagedResult<T> {
  entries: T[]
  count: number
  pageNum: number
  maxPage: number
  pageSize: number
  actions?: string[]
}

export class ApiClient {
  constructor(protected readonly baseUrl: string) {}

  protected async request<T>(endpoint: string, options: RequestInit = {}, retried = false): Promise<T> {
    const authHeaders = authService.getAuthHeader()
    const url = `${this.baseUrl}${endpoint}`

    if (import.meta.env.DEV) {
      console.debug('[api]', options.method || 'GET', url)
    }

    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Accept-Language': getAcceptLanguage(),
        ...authHeaders,
        ...options.headers,
      },
    })

    if (!response.ok) {
      if (response.status === 401) {
        if (!retried) {
          const refreshed = await authService.refreshToken()
          if (refreshed) {
            return this.request<T>(endpoint, options, true)
          }
        }
        void authService.login(window.location.href)
        throw new Error('Unauthorized')
      }

      let errorMessage = `HTTP error! status: ${response.status}`
      try {
        const data = await response.json()
        
        if (data && data.type && data.errors && typeof data.errors === 'object') {
          throw new ApiValidationError(data as ValidationError, response.status)
        }

        if (response.status === 422 && (data as any).error === 'not_enough_songs') {
          throw new ApiNotEnoughSongsError((data as any).current, (data as any).required)
        }

        if (response.status === 402 && (data as any).requiresAction) {
          throw new ApiPaymentActionRequiredError((data as any).clientSecret)
        }

        if (response.status === 403 && isEntitlementLimitCode((data as any).code)) {
          throw new ApiEntitlementLimitError(
            (data as any).title || 'Limit reached',
            (data as any).detail || (data as any).title || 'Limit reached',
            (data as any).upgradeHint,
            (data as any).upgradeTo,
            (data as any).code,
          )
        }

        if (typeof (data as any).error === 'string') {
          errorMessage = (data as any).error
        } else if (data && typeof (data as any).message === 'string') {
          errorMessage = (data as any).message
        }
      } catch (error) {
        if (error instanceof ApiValidationError || error instanceof ApiNotEnoughSongsError || error instanceof ApiPaymentActionRequiredError || error instanceof ApiEntitlementLimitError) {
          throw error
        }
      }
      throw new Error(errorMessage)
    }

    if (response.status === 204) return undefined as T
    return response.json()
  }

  async getDictionary<T>(endpoint: string): Promise<{ entries: T[]; actions: string[] }> {
    const response = await this.request<any>(endpoint)
    const viewData = response?.payload?.viewData ?? response?.viewData
    return {
      entries: viewData?.entries ?? [],
      actions: parseActions(response),
    }
  }

  async getPagedDictionary<T>(
    endpoint: string,
    pageNum: number,
    pageSize: number,
    filters?: Record<string, any>
  ): Promise<PagedResult<T>> {
    const params = new URLSearchParams()
    params.set('page', String(pageNum))
    params.set('size', String(pageSize))


    if (filters && Object.keys(filters).length > 0) {
      const cleanFilters: Record<string, any> = {}
      for (const [key, value] of Object.entries(filters)) {
        if (value !== undefined && value !== null && value !== '') {
          cleanFilters[key] = value
        }
      }
      if (Object.keys(cleanFilters).length > 0) {
        params.set('filter', JSON.stringify(cleanFilters))
      }
    }

    const separator = endpoint.includes('?') ? '&' : '?'
    const response = await this.request<any>(`${endpoint}${separator}${params.toString()}`)
    const viewData = response?.payload?.viewData ?? response?.viewData
    if (!viewData) throw new Error('Unexpected paged response format')
    return {
      entries: viewData.entries ?? [],
      count: viewData.count ?? 0,
      pageNum: viewData.pageNum ?? pageNum,
      maxPage: viewData.maxPage ?? 1,
      pageSize: viewData.pageSize ?? pageSize,
    }
  }

  async getDocument<T>(endpoint: string, id: string | number): Promise<T> {
    const response = await this.request<any>(`${endpoint}/${id}`)
    return response?.payload?.docData ?? response?.docData ?? response
  }

  async createDictionaryItem<T>(endpoint: string, item: Partial<T>): Promise<T> {
    return this.request<T>(`${endpoint}/new`, {
      method: 'POST',
      body: JSON.stringify(item),
    })
  }

  async updateDictionaryItem<T>(endpoint: string, id: number | string, item: Partial<T>): Promise<T> {
    return this.request<T>(`${endpoint}/${id}`, {
      method: 'POST',
      body: JSON.stringify({ ...item, id }),
    })
  }

  async deleteDictionaryItem(endpoint: string, id: number | string): Promise<void> {
    await this.request<void>(`${endpoint}/${id}`, { method: 'DELETE' })
  }

  async post<T>(endpoint: string, body: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(body),
    })
  }
}
