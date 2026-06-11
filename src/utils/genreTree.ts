import type { GenreEntry } from '@/stores/dictionary'

export function getGenreLabel(genre: GenreEntry): string {
  const directName = (genre as { name?: string }).name
  return directName || genre.localizedName?.en || Object.values(genre.localizedName || {})[0] || genre.identifier || genre.id
}

export function toGenreTreeOptions(genres: GenreEntry[]): { label: string; key: string; children?: ReturnType<typeof toGenreTreeOptions> }[] {
  return genres.map(genre => ({
    label: getGenreLabel(genre),
    key: genre.id,
    children: Array.isArray(genre.children) && genre.children.length
      ? toGenreTreeOptions(genre.children)
      : undefined,
  }))
}

export function normalizeIdList(input: unknown): string[] {
  if (!Array.isArray(input)) return []
  return input
    .map((item: unknown) => {
      if (typeof item === 'string') return item
      if (item && typeof item === 'object') {
        const o = item as { id?: string; identifier?: string }
        return o.id || o.identifier || null
      }
      return null
    })
    .filter((v): v is string => Boolean(v))
}
