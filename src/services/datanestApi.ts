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

  async getShared(page = 1, pageSize = 10): Promise<PagedResult<any>> {
    const params = new URLSearchParams()
    params.set('page', String(page))
    params.set('size', String(pageSize))
    const response = await this.request<any>(`/public/soundfragments/shared?${params}`)
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

  async getSharedFragment(id: string): Promise<any> {
    return this.getDocument<any>('/public/soundfragments', id)
  }

  async getScriptDetail(id: string): Promise<any> {
    return this.getDocument<any>('/public/scripts', id)
  }

  async getOtsDefinitions(
    page = 1,
    pageSize = 10,
    filter?: { brandId?: string; searchTerm?: string; activated?: boolean }
  ): Promise<PagedResult<any>> {
    return this.getPagedDictionary<any>('/ots-definitions', page, pageSize, filter)
  }

  async getOtsDefinition(id: string): Promise<any> {
    return this.getDocument<any>('/ots-definitions', id)
  }

  async createOtsDefinition(data: Record<string, any>): Promise<any> {
    return this.createDictionaryItem<any>('/ots-definitions', data)
  }

  async updateOtsDefinition(id: string, data: Record<string, any>): Promise<any> {
    return this.updateDictionaryItem<any>('/ots-definitions', id, data)
  }

  async deleteOtsDefinition(id: string): Promise<void> {
    return this.deleteDictionaryItem('/ots-definitions', id)
  }

  /** PATCH body matches backend `SharedSoundFragmentPatchDTO`: `addTargetBrandIds`, `removeTargetBrandIds`, `stayIncognito` (UUID strings). */
  async patchShared(slug: string, fragmentId: string, body: unknown): Promise<void> {
    await this.request<void>(
      `/shared-sound-fragments/shared/${encodeURIComponent(slug)}/${encodeURIComponent(fragmentId)}`,
      {
        method: 'PATCH',
        body: JSON.stringify(body ?? {}),
      }
    )
  }

  private collectDestinationBrandIdsFromSharedDoc(doc: unknown): string[] {
    if (!doc || typeof doc !== 'object') return []
    const d = doc as Record<string, unknown>
    const out = new Set<string>()
    const take = (arr: unknown) => {
      if (!Array.isArray(arr)) return
      for (const x of arr) {
        if (x != null && x !== '') out.add(String(x))
      }
    }
    take(d.addBrandIds)
    take(d.brandIds)
    take(d.sharedBrandIds)
    take(d.destinationBrandIds)
    take(d.representedInBrands)
    if (Array.isArray(d.shares)) {
      for (const s of d.shares as unknown[]) {
        if (!s || typeof s !== 'object') continue
        const o = s as Record<string, unknown>
        const id = o.brandId ?? o.sourceBrandId ?? o.destinationBrandId ?? o.id
        if (id != null && id !== '') out.add(String(id))
      }
    }
    const single = d.sourceBrandId ?? d.destinationBrandId
    if (single != null && single !== '') out.add(String(single))
    return [...out]
  }

  async unshare(slug: string, fragmentId: string, targetBrandIds: string[]): Promise<void> {
    await this.patchShared(slug, fragmentId, { removeTargetBrandIds: targetBrandIds })
  }

  async shareSoundFragmentWithLibrary(slug: string, fragmentId: string, brandId: string): Promise<void> {
    await this.shareSoundFragmentsWithBrands(slug, [fragmentId], [brandId])
  }

  /**
   * Brands open for submission (share dialog).
   * GET `/brands/discover?page=&size=` — same paged DTO as `/brands`.
   */
  async getBrandsForOpenContribution(page = 1, pageSize = 20): Promise<PagedResult<any>> {
    return this.getPagedDictionary('/brands/discover', page, pageSize)
  }

  /**
   * Add share targets (brand document UUIDs) via `SharedSoundFragmentPatchDTO.addTargetBrandIds`.
   * `slug` is the source station sharing the fragment - omit it for a fragment with no brand
   * association (e.g. the "unassigned to brands" page), which has no source station to slug;
   * this sends the NO_BRAND sentinel the backend expects
   * (must match SharedSoundFragmentService.NO_BRAND_SLUG in datanest).
   */
  async shareSoundFragmentsWithBrands(
    slug: string | null | undefined,
    fragmentIds: string[],
    brandIds: string[],
    options?: { stayIncognito?: boolean }
  ): Promise<void> {
    const ids = [...new Set(brandIds.filter(Boolean))]
    if (ids.length === 0) return
    const body = {
      addTargetBrandIds: ids,
      stayIncognito: options?.stayIncognito ?? false,
    }
    await Promise.all(
      fragmentIds.map(id => this.patchShared(slug || 'NO_BRAND', id, body))
    )
  }

  async getReceived(page = 1, pageSize = 10): Promise<PagedResult<any>> {
    const params = new URLSearchParams({ page: String(page), size: String(pageSize) })
    const response = await this.request<any>(`/shared-sound-fragments/received?${params}`)
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

  async getReceivedItem(id: string): Promise<any> {
    return this.getDocument<any>('/shared-sound-fragments/received', id)
  }

  async getSoundAssets(page = 1, pageSize = 10): Promise<PagedResult<any>> {
    const params = new URLSearchParams({ page: String(page), size: String(pageSize) })
    const response = await this.request<any>(`/public/soundfragments/sound-assets?${params}`)
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
    const response = await this.request<any>(`/public/soundfragments/unassigned-brands?${params}`)
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

  async patchSoundFragmentBoost(id: string, brandId: string, boost: number, type: 'brand' | 'shared' = 'brand'): Promise<void> {
    await this.request<void>(`/soundfragments/${id}/boost/${brandId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ boost, type }),
    })
  }

  /** Reject a received share — keeps it visible (tagged rejected) until explicitly deleted. */
  async rejectReceivedSoundFragment(id: string): Promise<void> {
    await this.request<void>(`/shared-sound-fragments/received/${id}/reject`, { method: 'PATCH' })
  }

  /** Permanently delete an already-rejected received share. Backend requires status = rejected. */
  async deleteReceivedSoundFragment(id: string): Promise<void> {
    await this.deleteDictionaryItem('/shared-sound-fragments/received', id)
  }

  /** Approve a received item for the current user (accept share, or approve a chat submission). */
  async acceptReceivedSoundFragment(id: string): Promise<void> {
    await this.request<void>(`/shared-sound-fragments/received/${id}/accept`, { method: 'PATCH' })
  }

  /** Revoke current user's access to a sound fragment (backend: DELETE …/:id/access). */
  async revokeSoundFragmentAccess(id: string): Promise<void> {
    await this.request<void>(`/soundfragments/${id}/access`, { method: 'DELETE' })
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
    const path = `${this.baseUrl}/soundfragments-bulk/status/${encodeURIComponent(batchId)}/stream`
    const token = authService.getToken()
    if (!token) return path
    const sep = path.includes('?') ? '&' : '?'
    return `${path}${sep}access_token=${encodeURIComponent(token)}`
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

  uploadBrandLogo(brandId: string, file: File): Promise<{ slugName: string }> {
    return new Promise((resolve, reject) => {
      const url = `${this.baseUrl}/brands/${encodeURIComponent(brandId)}/logo`
      const formData = new FormData()
      formData.append('file', file)
      const xhr = new XMLHttpRequest()
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try { resolve(JSON.parse(xhr.responseText)) } catch { resolve({ slugName: '' }) }
        } else {
          reject(new Error(`Logo upload failed (${xhr.status})`))
        }
      }
      xhr.onerror = () => reject(new Error('Network error during upload'))
      xhr.open('POST', url)
      const authHeaders = authService.getAuthHeader()
      for (const [key, value] of Object.entries(authHeaders)) xhr.setRequestHeader(key, value)
      xhr.send(formData)
    })
  }

  /** Fetch authenticated audio (or any binary) as a blob URL for `<audio src>`. Caller must `URL.revokeObjectURL` when done. */
  async fetchBlobUrl(url: string): Promise<string> {
    const authHeaders = authService.getAuthHeader()
    const response = await fetch(url, { headers: authHeaders })
    if (!response.ok) throw new Error(`Failed to load file (${response.status})`)
    const blob = await response.blob()
    return URL.createObjectURL(blob)
  }

  async getPublicArray<T>(endpoint: string): Promise<T[]> {
    return this.request<T[]>(endpoint)
  }

  /** Single-entity audio upload (chunked); final response is the complete DTO ({ status, url, metadata, … }). */
  uploadFragmentFile(fragmentId: string, file: File, onProgress: (percent: number) => void): Promise<any> {
    const batchId = crypto.randomUUID()
    return this.uploadFileChunked(file, batchId, undefined, fragmentId, onProgress)
  }

  /** Request OTP verification code for public song submission. */
  async requestSubmissionCode(email: string): Promise<void> {
    const res = await fetch(`${this.baseUrl}/public/songs/request-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(text || `Request failed (${res.status})`)
    }
  }

  /** Fetch publicly available brands/stations for submissions (no auth). */
  async getPublicBrands(): Promise<{ label: string; value: string }[]> {
    try {
      const res = await fetch(`${this.baseUrl}/public/stations`)
      if (!res.ok) {
        console.error(`getPublicBrands: /public/stations returned ${res.status}`, await res.text().catch(() => ''))
        return []
      }
      const data = await res.json()
      // /public/stations always returns a raw array (no {payload:{viewData:{entries}}} envelope).
      // Array.isArray must be checked BEFORE touching data?.entries: every array inherits a built-in
      // .entries() method, so `data?.entries` resolves to that function (not undefined) for a raw
      // array, silently short-circuiting the ?? chain before it ever reached the array fallback.
      const entries = Array.isArray(data)
        ? data
        : (data?.payload?.viewData?.entries ?? data?.viewData?.entries ?? data?.payload ?? [])
      if (!entries.length) {
        console.warn('getPublicBrands: no stations returned — check that at least one brand has submissionPolicy = NO_RESTRICTIONS', data)
      }
      return entries.map((b: any) => ({ label: b.title || b.name || b.slugName || b.slug || b.identifier, value: b.slugName || b.slug || b.identifier || b.id }))
    } catch (err) {
      console.error('getPublicBrands: request failed', err)
      return []
    }
  }

  /** SSE URL for polling a public submission's post-upload processing status (no auth needed). */
  getPublicSubmissionStatusStreamUrl(batchId: string): string {
    return `${this.baseUrl}/public/songs/status/${encodeURIComponent(batchId)}/stream`
  }

  /**
   * Chunked public song upload (no auth header — uses email+code OTP). Mirrors
   * uploadFileChunked's chunk-loop shape, but station/email/code are re-sent per chunk (the
   * backend re-validates them on every chunk) while descriptive metadata (artist/genre/etc.) is
   * only sent on the last chunk — that's the only one the backend ever reads it from.
   */
  async uploadPublicSongChunked(
    file: File,
    email: string,
    code: string,
    onProgress: (percent: number) => void,
    meta?: { stationSlug?: string; artistName?: string; genre?: string; country?: string; description?: string },
  ): Promise<any> {
    const batchId = crypto.randomUUID()
    const fileId = crypto.randomUUID().replace(/-/g, '')
    const totalChunks = Math.ceil(file.size / BULK_UPLOAD_CHUNK_SIZE)
    let lastResponse: any

    for (let i = 0; i < totalChunks; i++) {
      const start = i * BULK_UPLOAD_CHUNK_SIZE
      const blob = file.slice(start, Math.min(start + BULK_UPLOAD_CHUNK_SIZE, file.size))
      const form = new FormData()
      form.append('chunk', blob, file.name)

      const isFirstChunk = i === 0
      const isLastChunk = i === totalChunks - 1
      const params = new URLSearchParams({
        email,
        code,
        batchId,
        fileId,
        fileName: file.name,
        chunkIndex: String(i),
        totalChunks: String(totalChunks),
        // stationSlug is only resolved (and cached per batchId) once, on the first chunk — see
        // datanest's FileUploadService.resolveBrandSlugIfNeeded. No need to resend it after that.
        ...(isFirstChunk && meta?.stationSlug ? { stationSlug: meta.stationSlug } : {}),
        ...(isLastChunk && meta?.artistName ? { artistName: meta.artistName } : {}),
        ...(isLastChunk && meta?.genre ? { genre: meta.genre } : {}),
        ...(isLastChunk && meta?.country ? { country: meta.country } : {}),
        ...(isLastChunk && meta?.description ? { description: meta.description } : {}),
      })

      const res = await fetch(`${this.baseUrl}/public/songs/chunk?${params}`, {
        method: 'POST',
        body: form,
      })

      if (!res.ok) {
        let msg = `Chunk ${i + 1}/${totalChunks} failed (${res.status})`
        try {
          const text = (await res.text()).trim()
          if (text) {
            try { const b = JSON.parse(text); msg += `: ${b?.message || b?.error || text.slice(0, 120)}` }
            catch { msg += `: ${text.slice(0, 120)}` }
          }
        } catch { /* ignore */ }
        throw new Error(msg)
      }

      try { lastResponse = await res.json() } catch { lastResponse = null }
      onProgress(Math.round(((i + 1) / totalChunks) * 90))
    }

    // The last chunk's HTTP response only means "assembly started" (status "processing") — the
    // backend extracts metadata and creates the entity asynchronously afterward. Poll the same
    // SSE status stream the authenticated bulk-upload dialog uses so we report real completion
    // (or a real backend-side failure) instead of trusting that response as final.
    await this.waitForPublicSubmissionFinished(batchId, fileId, onProgress)
    return lastResponse
  }

  private waitForPublicSubmissionFinished(
    batchId: string,
    fileId: string,
    onProgress: (percent: number) => void,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const es = new EventSource(this.getPublicSubmissionStatusStreamUrl(batchId))
      es.addEventListener('error', () => {})
      es.onmessage = (event) => {
        const data = JSON.parse(event.data)
        const fd = data[fileId]
        if (!fd) return
        if (fd.status === 'finished') {
          onProgress(100)
          es.close()
          resolve()
        } else if (fd.status === 'error') {
          es.close()
          reject(new Error(fd.errorMessage || 'Processing failed after upload'))
        } else {
          onProgress(90)
        }
      }
      es.onerror = () => {
        es.close()
        reject(new Error('Lost connection while waiting for upload to finish processing'))
      }
    })
  }
}

export const datanestApiService = new DatanestApiService()
export default datanestApiService
