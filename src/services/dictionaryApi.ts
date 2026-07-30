import { ApiClient } from './base'
import { appConfig } from '@/config/appConfig'

export interface GenreEntry {
  identifier: string
  name?: string
  localizedName?: Record<string, string>
  rank?: number
  color?: string
  fontColor?: string
  parentIdentifier?: string | null
  children?: GenreEntry[]
}

export interface LabelEntry {
  identifier: string
  name?: string
  localizedName?: Record<string, string>
  color?: string
  fontColor?: string
  category?: string
}

class DictionaryApiService extends ApiClient {
  constructor() {
    super(`${appConfig.datanestServer}`)
  }

  async getGenres(): Promise<GenreEntry[]> {
    const result = await this.getPagedDictionary<GenreEntry>('/dictionary/genres', 1, 1000)
    return result.entries
  }

  async getLabelsByCategory(category: string): Promise<LabelEntry[]> {
    const result = await this.getPagedDictionary<LabelEntry>(`/dictionary/labels/${category}`, 1, 500)
    return result.entries
  }
}

export const dictionaryApiService = new DictionaryApiService()
export default dictionaryApiService
