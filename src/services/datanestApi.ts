import { ApiClient, type PagedResult } from './base'
import { appConfig } from '@/config/appConfig'
import authService from './auth'

/** Chunked bulk upload: chunk body size (per POST). */
export const BULK_UPLOAD_CHUNK_SIZE = 5 * 1024 * 1024
/** Files larger than this use POST …/chunk; smaller files use the single-request /files path. */
export const BULK_UPLOAD_CHUNKED_THRESHOLD = 20 * 1024 * 1024

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

  async getMyPlaylist(
    page = 1,
    pageSize = 10,
    filters: { searchTerm?: string; type?: string[] } = {}
  ): Promise<PagedResult<any>> {
    const params = new URLSearchParams()
    params.set('page', String(page))
    params.set('size', String(pageSize))
    const cleanFilters: Record<string, any> = {}
    if (filters.searchTerm) cleanFilters.searchTerm = filters.searchTerm
    if (filters.type?.length) cleanFilters.type = filters.type
    if (Object.keys(cleanFilters).length) params.set('filter', JSON.stringify(cleanFilters))
    const response = await this.request<any>(`/soundfragments?${params}`)
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

  async getContributed(page = 1, pageSize = 10): Promise<PagedResult<any>> {
    const params = new URLSearchParams({ page: String(page), size: String(pageSize) })
    const response = await this.request<any>(`/soundfragments/contributed?${params}`)
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

  async getPendingReview(page = 1, pageSize = 10): Promise<PagedResult<any>> {
    const params = new URLSearchParams({ page: String(page), size: String(pageSize) })
    const response = await this.request<any>(`/soundfragments/pending-review?${params}`)
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

  async getUnassignedBrands(page = 1, pageSize = 10): Promise<PagedResult<any>> {
    const params = new URLSearchParams({ page: String(page), size: String(pageSize) })
    const response = await this.request<any>(`/soundfragments/unassigned-brands?${params}`)
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
    onProgress: (percent: number) => void,
    signal?: AbortSignal
  ): Promise<void> {
    if (file.size <= BULK_UPLOAD_CHUNKED_THRESHOLD) {
      return this.bulkUploadFileSingle(file, fileId, batchId, brandSlug, onProgress, signal)
    }
    return this.bulkUploadFileChunked(file, fileId, batchId, brandSlug, onProgress, signal)
  }

  private bulkUploadFileSingle(
    file: File,
    fileId: string,
    batchId: string,
    brandSlug: string,
    onProgress: (percent: number) => void,
    signal?: AbortSignal
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
        else {
          let msg = `Upload failed (${xhr.status})`
          try {
            const body = JSON.parse(xhr.responseText)
            const detail = body?.message || body?.error || body?.detail
            if (detail) msg += `: ${detail}`
          } catch {
            if (xhr.responseText?.trim()) msg += `: ${xhr.responseText.trim().slice(0, 120)}`
          }
          reject(new Error(msg))
        }
      }
      xhr.onerror = () => reject(new Error('Network error during upload'))
      xhr.onabort = () => reject(new DOMException('Upload cancelled', 'AbortError'))

      signal?.addEventListener('abort', () => xhr.abort())

      xhr.open('POST', url)
      const authHeaders = authService.getAuthHeader()
      for (const [key, value] of Object.entries(authHeaders)) {
        xhr.setRequestHeader(key, value)
      }
      xhr.send(formData)
    })
  }

  /**
   * POST /soundfragments-bulk/chunk — shared by bulk (omit entityId, use SSE after) and
   * single-entity upload (set entityId; final JSON body is the complete DTO).
   */
  async uploadFileChunked(
    file: File,
    batchId: string,
    brandSlug: string | null | undefined,
    entityId: string | null | undefined,
    onProgress: (percent: number) => void,
    options?: { signal?: AbortSignal; fileId?: string }
  ): Promise<any> {
    const fileId = options?.fileId ?? crypto.randomUUID().replace(/-/g, '')
    const authHeaders = authService.getAuthHeader()
    const totalChunks = Math.ceil(file.size / BULK_UPLOAD_CHUNK_SIZE)
    let lastResponse: any

    for (let i = 0; i < totalChunks; i++) {
      if (options?.signal?.aborted) {
        throw new DOMException('Upload cancelled', 'AbortError')
      }
      const start = i * BULK_UPLOAD_CHUNK_SIZE
      const blob = file.slice(start, Math.min(start + BULK_UPLOAD_CHUNK_SIZE, file.size))
      const form = new FormData()
      form.append('chunk', blob, file.name)

      const params = new URLSearchParams({
        batchId,
        fileId,
        fileName: file.name,
        chunkIndex: String(i),
        totalChunks: String(totalChunks),
      })
      if (brandSlug) params.set('brandSlug', brandSlug)
      if (entityId) params.set('entityId', entityId)

      const res = await fetch(`${this.baseUrl}/soundfragments-bulk/chunk?${params}`, {
        method: 'POST',
        headers: authHeaders as HeadersInit,
        body: form,
        signal: options?.signal,
      })

      if (!res.ok) {
        let msg = `Chunk ${i + 1}/${totalChunks} failed (${res.status})`
        try {
          const text = (await res.text()).trim()
          if (text) {
            try {
              const body = JSON.parse(text)
              const detail = body?.message || body?.error || body?.detail
              msg += detail ? `: ${detail}` : `: ${text.slice(0, 120)}`
            } catch {
              msg += `: ${text.slice(0, 120)}`
            }
          }
        } catch {
          /* ignore */
        }
        throw new Error(msg)
      }

      try {
        lastResponse = await res.json()
      } catch {
        lastResponse = null
      }
      onProgress(Math.round(((i + 1) / totalChunks) * 100))
    }

    return lastResponse
  }

  private async bulkUploadFileChunked(
    file: File,
    fileId: string,
    batchId: string,
    brandSlug: string,
    onProgress: (percent: number) => void,
    signal?: AbortSignal
  ): Promise<void> {
    await this.uploadFileChunked(file, batchId, brandSlug || undefined, undefined, onProgress, {
      signal,
      fileId,
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

  /** Fetch authenticated audio (or any binary) as a blob URL for `<audio src>`. Caller must `URL.revokeObjectURL` when done. */
  async fetchBlobUrl(url: string): Promise<string> {
    const authHeaders = authService.getAuthHeader()
    const response = await fetch(url, { headers: authHeaders })
    if (!response.ok) throw new Error(`Failed to load file (${response.status})`)
    const blob = await response.blob()
    return URL.createObjectURL(blob)
  }

  /** Single-entity audio upload (chunked); final response is the complete DTO ({ status, url, metadata, … }). */
  uploadFragmentFile(fragmentId: string, file: File, onProgress: (percent: number) => void): Promise<any> {
    const batchId = crypto.randomUUID()
    return this.uploadFileChunked(file, batchId, undefined, fragmentId, onProgress)
  }
}

export const datanestApiService = new DatanestApiService()
export default datanestApiService
