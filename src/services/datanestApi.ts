import { ApiClient, type PagedResult } from './base'
import { appConfig } from '@/config/appConfig'
import authService from './auth'

class DatanestApiService extends ApiClient {
  constructor() {
    super(appConfig.datanestServer)
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
    const response = await this.request<any>(`/datanest/soundfragments/available-soundfragments?${params}`)
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
    await this.request<void>(`/soundfragments/${id}/rating?brand=${encodeURIComponent(brandSlug)}&action=${action}`, {
      method: 'PATCH',
    })
  }

  bulkUploadFile(
    file: File,
    fileId: string,
    batchId: string,
    brandSlug: string,
    onProgress: (percent: number) => void
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const url = `${this.baseUrl}/soundfragments-bulk/files?batchId=${encodeURIComponent(batchId)}&brandSlug=${encodeURIComponent(brandSlug)}&fileId=${encodeURIComponent(fileId)}`
      const formData = new FormData()
      formData.append('file', file)

      const xhr = new XMLHttpRequest()
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress(Math.round((e.loaded * 100) / e.total))
      }
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) resolve()
        else reject(new Error(`Upload failed (${xhr.status}): ${xhr.statusText}`))
      }
      xhr.onerror = () => reject(new Error('Network error during upload'))

      xhr.open('POST', url)
      const authHeaders = authService.getAuthHeader()
      for (const [key, value] of Object.entries(authHeaders)) {
        xhr.setRequestHeader(key, value)
      }
      xhr.send(formData)
    })
  }

  getBulkStatusStreamUrl(batchId: string): string {
    return `${this.baseUrl}/soundfragments-bulk/status/${encodeURIComponent(batchId)}/stream`
  }

  async downloadFile(url: string, fallbackFilename: string): Promise<void> {
    const authHeaders = authService.getAuthHeader()
    const response = await fetch(url, { headers: authHeaders })
    if (!response.ok) throw new Error(`Download failed (${response.status})`)
    const blob = await response.blob()

    let filename = fallbackFilename
    const disposition = response.headers.get('content-disposition')
    if (disposition) {
      const match = disposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/)
      if (match?.[1]) filename = match[1].replace(/['"]/g, '').trim()
    }

    const objectUrl = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = objectUrl
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(objectUrl)
  }

  uploadFragmentFile(
    fragmentId: string,
    file: File,
    onProgress: (percent: number) => void
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const uploadId = `upload-${Date.now()}`
      const url = `${this.baseUrl}/soundfragments/files/${encodeURIComponent(fragmentId)}?uploadId=${encodeURIComponent(uploadId)}`
      const formData = new FormData()
      formData.append('file', file)

      const xhr = new XMLHttpRequest()
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress(Math.round((e.loaded * 100) / e.total))
      }
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) resolve()
        else reject(new Error(`Upload failed (${xhr.status}): ${xhr.statusText}`))
      }
      xhr.onerror = () => reject(new Error('Network error during upload'))

      xhr.open('POST', url)
      const authHeaders = authService.getAuthHeader()
      for (const [key, value] of Object.entries(authHeaders)) {
        xhr.setRequestHeader(key, value)
      }
      xhr.send(formData)
    })
  }
}

export const datanestApiService = new DatanestApiService()
export default datanestApiService
