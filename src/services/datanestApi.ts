import { ApiClient, type PagedResult } from './base'
import { appConfig } from '@/config/appConfig'

class DatanestApiService extends ApiClient {
  constructor() {
    super(`${appConfig.datanestServer}/datanest`)
  }

  async getBrandListeners(brandSlug: string, page = 1, pageSize = 10): Promise<PagedResult<any>> {
    const response = await this.request<any>(
      `/listeners/available-listeners?brand=${encodeURIComponent(brandSlug)}&page=${page}&size=${pageSize}`
    )
    const viewData = response?.payload?.viewData ?? response?.viewData
    if (!viewData) throw new Error('Unexpected response format')
    return {
      entries: viewData.entries ?? [],
      count: viewData.count ?? 0,
      pageNum: viewData.pageNum ?? page,
      maxPage: viewData.maxPage ?? 1,
      pageSize: viewData.pageSize ?? pageSize,
    }
  }

  async deleteBrandListener(id: string): Promise<void> {
    await this.request<void>(`/listeners/${id}`, { method: 'DELETE' })
  }

  async getBrandPlaylist(
    brandSlug: string,
    page = 1,
    pageSize = 10,
    filters: { searchTerm?: string; genre?: string[]; labels?: string[]; type?: string[]; source?: string[] } = {}
  ): Promise<PagedResult<any>> {
    const params = new URLSearchParams()
    params.set('brand', brandSlug)
    params.set('page', String(page))
    params.set('size', String(pageSize))
    const cleanFilters: Record<string, any> = {}
    if (filters.searchTerm) cleanFilters.searchTerm = filters.searchTerm
    if (filters.genre?.length) cleanFilters.genre = filters.genre
    if (filters.labels?.length) cleanFilters.labels = filters.labels
    if (filters.type?.length) cleanFilters.type = filters.type
    if (filters.source?.length) cleanFilters.source = filters.source
    if (Object.keys(cleanFilters).length) params.set('filter', JSON.stringify(cleanFilters))
    const response = await this.request<any>(`/soundfragments/available-soundfragments?${params}`)
    const viewData = response?.payload?.viewData ?? response?.viewData
    if (!viewData) throw new Error('Unexpected response format')
    return {
      entries: viewData.entries ?? [],
      count: viewData.count ?? 0,
      pageNum: viewData.pageNum ?? page,
      maxPage: viewData.maxPage ?? 1,
      pageSize: viewData.pageSize ?? pageSize,
    }
  }

  async deleteSoundFragment(id: string): Promise<void> {
    await this.request<void>(`/soundfragments/${id}`, { method: 'DELETE' })
  }

  async rateSoundFragment(id: string, brandSlug: string, action: 'LIKE' | 'DISLIKE'): Promise<void> {
    await this.request<void>(`/soundfragments/${id}/rate?brand=${encodeURIComponent(brandSlug)}&action=${action}`, {
      method: 'POST',
    })
  }
}

export const datanestApiService = new DatanestApiService()
export default datanestApiService
