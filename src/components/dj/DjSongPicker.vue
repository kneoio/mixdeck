<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { NSelect } from 'naive-ui'
import datanestApiService from '@/services/datanestApi'

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
    }))
  } catch {
    if (seq === searchSeq) songs.value = []
  } finally {
    if (seq === searchSeq) searching.value = false
  }
}

const options = computed(() => {
  const list = props.modelValue && !songs.value.some(s => s.slugName === props.modelValue!.slugName)
    ? [props.modelValue, ...songs.value]
    : songs.value
  return list.map(s => ({
    label: [s.artist, s.title].filter(Boolean).join(' — ') || s.slugName,
    value: s.slugName,
    disabled: s.slugName === props.excludeSlug,
  }))
})

function onUpdate(slug: string | null) {
  emit('update:modelValue', songs.value.find(s => s.slugName === slug) ?? (props.modelValue?.slugName === slug ? props.modelValue : null))
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
      @search="search"
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
