<script setup lang="ts">
import { computed, h, onMounted, ref } from 'vue'
import { NSelect, NSpace, NTag } from 'naive-ui'
import datanestApiService from '@/services/datanestApi'

/** A genre or label as the playlist endpoint returns it: enough to render its own tag. */
export interface DjTag {
  identifier: string
  color?: string
  fontColor?: string
}

export interface DjSong {
  /** Fragment slug — what the Playlist view uses to load audio. */
  slugName: string
  /** Fragment id — what the backend keeps history and ratings against. */
  id: string
  title: string
  artist: string
  /** Deck parameters, when the library knows them. */
  bpm?: number
  key?: string
  scale?: string
  /** Metadata hints the upload carried, e.g. an AI tool's signature in a file comment. */
  aiGenerated?: boolean
  genres?: DjTag[]
  labels?: DjTag[]
}

const props = defineProps<{
  brandSlug: string
  label: string
  placeholder: string
  modelValue: DjSong | null
  /** Slug of the song already chosen in the other slot. */
  excludeSlug?: string | null
  loading?: boolean
  disabled?: boolean
}>()
const emit = defineEmits<{ 'update:modelValue': [song: DjSong | null] }>()

const songs = ref<DjSong[]>([])
const searching = ref(false)
let searchSeq = 0

/** Same source as the Playlist view: the brand's available sound fragments (songs only). */
async function search(term = '') {
  const seq = ++searchSeq
  searching.value = true
  try {
    const result = await datanestApiService.getBrandPlaylist(props.brandSlug, 1, 30, {
      searchTerm: term.trim() || undefined,
      type: ['SONG'],
    })
    if (seq !== searchSeq) return
    songs.value = result.entries.map((e: any) => ({
      slugName: e.slugName,
      id: e.id ?? e.slugName,
      title: e.title ?? '',
      artist: e.artist ?? '',
      bpm: e.bpm ?? undefined,
      key: e.key ?? undefined,
      genres: e.genres ?? [],
      labels: e.labels ?? [],
    }))
  } catch {
    if (seq === searchSeq) songs.value = []
  } finally {
    if (seq === searchSeq) searching.value = false
  }
}

/** Same debounce as the Playlist view's own search box, so typing doesn't fire a call per keystroke. */
let searchTimer: ReturnType<typeof setTimeout> | null = null
function onSearch(term: string) {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => search(term), 400)
}

const options = computed(() => {
  const list = props.modelValue && !songs.value.some(s => s.slugName === props.modelValue!.slugName)
    ? [props.modelValue, ...songs.value]
    : songs.value
  return list.map(s => ({
    label: [s.artist, s.title].filter(Boolean).join(' — ') || s.slugName,
    value: s.slugName,
    disabled: s.slugName === props.excludeSlug,
    genres: s.genres ?? [],
    labels: s.labels ?? [],
  }))
})

function tag(t: DjTag) {
  return h(NTag, { size: 'small', style: t.color ? `background:${t.color};color:${t.fontColor || '#fff'}` : '' }, { default: () => t.identifier })
}

/**
 * Title/artist with the song's genres and labels as small colour chips, kept on one line with the
 * name. Naive UI calls this render function itself, outside our template, so scoped CSS classes
 * never reach these nodes — the layout has to be inline styles instead.
 */
function renderOption(option: { label: string; genres: DjTag[]; labels: DjTag[] }, selected: boolean) {
  const tags = [...option.genres, ...option.labels]
  if (!tags.length) return option.label
  return h('div', {
    style: 'display:flex;align-items:center;gap:8px;min-width:0;overflow:hidden',
  }, [
    h('span', { style: 'overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0;' + (selected ? '' : 'flex:1') }, option.label),
    h(NSpace, { size: 4, wrap: false, style: 'flex:none' }, { default: () => tags.map(tag) }),
  ])
}

/** The deck parameters (bpm, key, scale, AI flag) only come from the fragment's own detail, not the search list. */
let enrichSeq = 0
async function enrich(slug: string) {
  const seq = ++enrichSeq
  try {
    const doc = await datanestApiService.getSharedFragment(slug)
    if (seq !== enrichSeq || props.modelValue?.slugName !== slug) return
    const info = doc?.addInfo
    if (!info) return
    emit('update:modelValue', {
      ...props.modelValue,
      bpm: info.bpm ?? props.modelValue.bpm,
      key: info.key ?? props.modelValue.key,
      scale: info.scale ?? props.modelValue.scale,
      aiGenerated: info.ai_generated_metadata_check?.suspected_ai_generated ?? props.modelValue.aiGenerated,
    })
  } catch { /* deck params are a nice-to-have; the pick itself still works without them */ }
}

function onUpdate(slug: string | null) {
  const song = songs.value.find(s => s.slugName === slug) ?? (props.modelValue?.slugName === slug ? props.modelValue : null)
  emit('update:modelValue', song)
  if (song) void enrich(song.slugName)
}

onMounted(() => search())
</script>

<template>
  <div class="dj-picker">
    <span class="dj-picker-slot">{{ label }}</span>
    <NSelect
      :value="modelValue?.slugName ?? null"
      :options="options"
      :loading="searching || loading"
      :disabled="disabled"
      filterable
      remote
      clearable
      :placeholder="placeholder"
      :render-label="renderOption"
      @search="onSearch"
      @update:value="onUpdate"
    />
  </div>
</template>

<style scoped>
.dj-picker {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}
.dj-picker-slot {
  flex: none;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 0.85rem;
  background: var(--dj-slot, var(--dj-accent));
  color: #1a1a1a;
}
.dj-picker :deep(.n-select) {
  flex: 1;
  min-width: 0;
}
</style>
