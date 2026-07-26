<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { gsap } from 'gsap'
import {
  NSpace, NForm, NFormItem, NInput, NSelect, NTreeSelect, NDynamicTags,
  NTabs, NTabPane, NUpload, NProgress, NTag, NButton, NPopover, NPopselect, NTree, NScrollbar, NEmpty, NCollapse, NCollapseItem, NIcon, useMessage,
} from 'naive-ui'
import { CheckmarkCircle } from '@vicons/ionicons5'
import GsapButton from '@/components/GsapButton.vue'
import type { UploadCustomRequestOptions } from 'naive-ui'
import FormWrapper from '@/components/FormWrapper.vue'
import AudioMiniPlayer from '@/components/AudioMiniPlayer.vue'
import LedIndicator from '@/components/LedIndicator.vue'
import { useSoundFragmentsStore, FRAGMENT_TYPE_VALUES } from '@/stores/soundFragments'
import { useBrandsStore } from '@/stores/brands'
import { useDictionaryStore } from '@/stores/dictionary'
import type { Label } from '@/stores/labels'
import datanestApiService from '@/services/datanestApi'
import { useRoute, useRouter } from 'vue-router'
import { handleApiError } from '@/utils/notificationService'
import { normalizeIdList, toGenreTreeOptions } from '@/utils/genreTree'

const { t } = useI18n()

const fragmentTypeOptions = computed(() =>
  FRAGMENT_TYPE_VALUES.map(v => ({
    label: t(`fragmentForm.type_${v.toLowerCase()}`),
    value: v,
  }))
)

const route = useRoute()
const router = useRouter()
const store = useSoundFragmentsStore()
const brandsStore = useBrandsStore()
const dictionaryStore = useDictionaryStore()
const message = useMessage()


const brandId = computed(() => route.params.id as string)
const isEditing = computed(() => !!route.params.fragmentId && route.params.fragmentId !== 'new')
const loading = ref(false)
const activeTab = ref('properties')
const isTabChangeFromValidation = ref(false)
const isMobile = ref(false)

const titleFieldRef = ref<HTMLElement | null>(null)
const artistFieldRef = ref<HTMLElement | null>(null)
const genresFieldRef = ref<HTMLElement | null>(null)
const audioFileFieldRef = ref<HTMLElement | null>(null)
const streamUrlFieldRef = ref<HTMLElement | null>(null)

type ValidationField = 'title' | 'artist' | 'genres' | 'audioFile' | 'streamUrl'

const fieldErrors = ref<Record<ValidationField, string>>({
  title: '',
  artist: '',
  genres: '',
  audioFile: '',
  streamUrl: '',
})

const regDate = ref('')
const lastModifiedDate = ref('')
const likes = ref(0)
const dislikes = ref(0)
const rawAddInfo = ref<Record<string, any> | null>(null)

const MOOD_THRESHOLD = 0.5
const DANCEABLE_THRESHOLD = 0.6
// Only fully-consumed scalars are dropped from the raw table; moods/top_genres/ai_generated_metadata_check
// carry extra internal signal (scores, caveats) beyond what the vibe row surfaces, so they stay visible raw.
const ADD_INFO_VIBE_KEYS = ['bpm', 'key', 'scale', 'danceability']

function tempoBand(bpm: number): string {
  if (bpm < 70) return 'slow'
  if (bpm < 100) return 'mid-tempo'
  if (bpm < 130) return 'upbeat'
  return 'fast'
}

function dominantMoods(raw: unknown): string {
  if (!raw || typeof raw !== 'object') return ''
  const present = Object.entries(raw as Record<string, unknown>)
    .map(([name, score]) => ({ name, score: Number(score) }))
    .filter(m => !Number.isNaN(m.score) && m.score >= MOOD_THRESHOLD)
  present.sort((a, b) => b.score - a.score)
  return present.map(m => m.name).join('/')
}

function genreName(entry: any): string {
  const g = entry?.genre
  if (typeof g !== 'string') return ''
  const sep = g.lastIndexOf('---')
  return (sep >= 0 ? g.slice(sep + 3) : g).trim()
}

function formatPercent(score: number): string {
  return `${(score * 100).toFixed(1)}%`
}

const GENRE_COLORS = ['#7C3AED', '#2563eb', '#0d9488', '#ca8a04', '#db2777', '#65a30d', '#c2410c', '#4f46e5']

/** All detected genres (not just the top one/two used for the vibe phrase), sorted strongest first. */
function allGenres(raw: unknown): { name: string; percent: string; width: number; color: string }[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map(entry => ({ name: genreName(entry), score: Number(entry?.score) }))
    .filter(g => g.name && !Number.isNaN(g.score))
    .sort((a, b) => b.score - a.score)
    .map((g, i) => ({
      name: g.name,
      percent: formatPercent(g.score),
      width: g.score * 100,
      color: GENRE_COLORS[i % GENRE_COLORS.length],
    }))
}

/** Mirrors com.semantyca.jesoos.service.live.scripting.AddInfoInterpreter's DJ-relevant vibe fields. */
const tempoBpm = computed(() => {
  const bpm = Number(rawAddInfo.value?.bpm)
  if (rawAddInfo.value?.bpm === undefined || rawAddInfo.value?.bpm === null || Number.isNaN(bpm)) return null
  return bpm
})

const tempoInfo = computed(() => {
  const bpm = tempoBpm.value
  if (bpm === null) return ''
  return `${tempoBand(bpm)} (${Math.round(bpm)} BPM)`
})

const keyInfo = computed(() => {
  const key = rawAddInfo.value?.key
  const scale = rawAddInfo.value?.scale
  const parts = [
    typeof key === 'string' && key.trim() ? key.trim() : '',
    typeof scale === 'string' && scale.trim() ? scale.trim() : '',
  ].filter(Boolean)
  return parts.length ? parts.join(' ') : ''
})

const moodInfo = computed(() => dominantMoods(rawAddInfo.value?.moods))

const genreRows = computed(() => allGenres(rawAddInfo.value?.top_genres))

// A segment's width comes from its score, so narrow genres clip their label. Only those get a
// tooltip - measured after render rather than guessed, since it depends on the rendered font.
const genreBarRef = ref<HTMLElement | null>(null)
const clippedGenres = ref(new Set<string>())

function updateGenreClipping() {
  const el = genreBarRef.value
  if (!el) return
  const clipped = new Set<string>()
  el.querySelectorAll<HTMLElement>('.add-info-genre-bar__label').forEach(label => {
    const name = label.dataset.genre
    if (name && label.scrollWidth > label.clientWidth) clipped.add(name)
  })
  clippedGenres.value = clipped
}

const isDanceable = computed(() => {
  const d = Number(rawAddInfo.value?.danceability)
  return !Number.isNaN(d) && d >= DANCEABLE_THRESHOLD
})
const hasDanceabilityData = computed(() => rawAddInfo.value?.danceability !== undefined && rawAddInfo.value?.danceability !== null)

const isAiGenerated = computed(() => rawAddInfo.value?.ai_generated_metadata_check?.suspected_ai_generated === true)
const hasAiCheckData = computed(() => !!rawAddInfo.value?.ai_generated_metadata_check)

const hasVibeInfo = computed(() =>
  !!(tempoInfo.value || keyInfo.value || moodInfo.value || genreRows.value.length || hasDanceabilityData.value || hasAiCheckData.value)
)

const rawAddInfoRows = computed(() => {
  const info = rawAddInfo.value
  if (!info) return []
  return Object.keys(info)
    .filter(key => !ADD_INFO_VIBE_KEYS.includes(key))
    .map(key => ({ label: key, value: typeof info[key] === 'object' ? JSON.stringify(info[key]) : String(info[key]) }))
})

interface SharedWithEntry {
  targetBrand: string
  status?: number
  shared?: boolean
}
const sharedWith = ref<SharedWithEntry[]>([])

const activeSharedWith = computed(() =>
  sharedWith.value.filter(e => e.targetBrand)
)

// 506=PENDING, 500=ACCEPTED, 501=REJECTED (same enum as ReceivedView). Rejected is shown muted/
// neutral here rather than as an alarming red tag - the sharer just needs to know it wasn't taken
// up, not feel like something went wrong.
function sharedWithStatusInfo(entry: SharedWithEntry) {
  if (entry.status === 506) return { text: t('playlistView.status_pending'), type: 'warning' as const }
  if (entry.status === 501) return { text: t('fragmentForm.sharing_status_not_accepted'), type: 'default' as const }
  return { text: t('playlistView.status_accepted'), type: 'success' as const }
}

function normalizeSharedWith(raw: unknown): SharedWithEntry[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((e: any) => ({
      targetBrand: String(e?.targetBrand ?? '').trim(),
      status: typeof e?.status === 'number' ? e.status : undefined,
      shared: typeof e?.shared === 'boolean' ? e.shared : undefined,
    }))
    .filter(e => e.targetBrand)
}

// File upload state
const existingUrl = ref('')
const existingFileName = ref('')
const isOpusPreview = ref(false)
const isPlayerPlaying = ref(false)
const uploadProgress = ref(0)
const isUploading = ref(false)
const uploadedFileNames = ref<string[]>([])  // newly uploaded during this session

const formData = ref({
  type: 'SONG' as string,
  title: '',
  artist: '',
  album: '',
  description: '',
  genres: [] as string[],
  labels: [] as string[],
  representedInBrands: brandId.value ? [brandId.value] : [] as string[],
  expiresAt: '' as string | null,
  length: null as number | null,
  source: 'USER_UPLOAD' as string,
  streamUrl: '' as string,
})

const sourceOptions = computed(() => [
  { label: t('fragmentForm.source_user_upload'), value: 'USER_UPLOAD' },
  { label: t('fragmentForm.source_stream'), value: 'STREAM' },
])

const genreTreeOptions = computed(() => toGenreTreeOptions(dictionaryStore.genres))
const genreSearchQuery = ref('')

function findGenreLabel(nodes: { label: string; key: string; children?: any[] }[], id: string): string | undefined {
  for (const node of nodes) {
    if (node.key === id) return node.label
    if (node.children) {
      const found = findGenreLabel(node.children, id)
      if (found) return found
    }
  }
  return undefined
}

function genreLabelById(id: string) {
  return findGenreLabel(genreTreeOptions.value, id) || id
}

function removeGenre(id: string) {
  formData.value.genres = formData.value.genres.filter(x => x !== id)
}

const LABEL_CATEGORY = 'sound_fragment'
const labelCatalog = ref<Map<string, Label>>(new Map())

// Free-text tags the user is adding this session — resolved into real personal labels
// server-side as part of the SoundFragment save call, not created eagerly.
const customTags = ref<string[]>([])

const existingLabelChips = computed(() =>
  formData.value.labels
    .map(id => labelCatalog.value.get(id))
    .filter((l): l is Label => !!l)
)

function labelDisplayText(l: Label) {
  const name = l.localizedName?.en || l.identifier
  return l.owner === null ? `🔒 ${name}` : name
}

const labelDisplayTags = computed(() => [
  ...existingLabelChips.value.map(labelDisplayText),
  ...customTags.value,
])

const availableLabelOptions = computed(() =>
  Array.from(labelCatalog.value.values())
    .filter(l => !formData.value.labels.includes(l.id))
    .map(l => ({ label: labelDisplayText(l), value: l.id }))
)

const labelSearchQuery = ref('')
const labelPickerShow = ref(false)

const filteredAvailableLabelOptions = computed(() => {
  const q = labelSearchQuery.value.trim().toLowerCase()
  if (!q) return availableLabelOptions.value
  return availableLabelOptions.value.filter(o => o.label.toLowerCase().includes(q))
})

function addExistingLabel(id: string | null) {
  if (id && !formData.value.labels.includes(id)) {
    formData.value.labels.push(id)
  }
  labelSearchQuery.value = ''
  labelPickerShow.value = false
}

async function loadLabelCatalog() {
  const result = await datanestApiService.getPagedDictionary<Label>(`/labels/only/category/${LABEL_CATEGORY}`, 1, 500)
  labelCatalog.value = new Map(result.entries.map(l => [l.id, l]))
}

function removeExistingLabel(id: string) {
  formData.value.labels = formData.value.labels.filter(x => x !== id)
}

function findExistingLabelByDisplayTag(tag: string) {
  return existingLabelChips.value.find(l => labelDisplayText(l) === tag)
}

function handleNewLabelInput(tags: string[]) {
  const trimmed = tags[0]?.trim()
  if (trimmed) customTags.value.push(trimmed)
}

function handleLabelTagsChange(newTags: string[]) {
  const previous = labelDisplayTags.value
  const removed = previous.filter(tag => !newTags.includes(tag))
  const added = newTags.filter(tag => !previous.includes(tag))

  for (const tag of removed) {
    const existing = findExistingLabelByDisplayTag(tag)
    if (existing) {
      if (existing.owner !== null) removeExistingLabel(existing.id)
      continue
    }
    customTags.value = customTags.value.filter(t => t !== tag)
  }

  for (const tag of added) {
    const trimmed = tag.trim()
    if (trimmed) customTags.value.push(trimmed)
  }
}

const brandOptions = computed(() =>
  brandsStore.brands.map(b => ({
    label: b.localizedName?.['en'] || b.title || b.slugName || b.id,
    value: b.id,
  }))
)

const availableBrandOptions = computed(() =>
  brandOptions.value.filter(o => !formData.value.representedInBrands.includes(o.value))
)

function brandLabelById(id: string) {
  return brandOptions.value.find(o => o.value === id)?.label || id
}

function removeBrand(id: string) {
  formData.value.representedInBrands = formData.value.representedInBrands.filter(x => x !== id)
}

function addBrand(id: string | null) {
  if (id && !formData.value.representedInBrands.includes(id)) {
    formData.value.representedInBrands.push(id)
  }
}

const returnToRoute = computed(() => {
  const value = route.query.returnTo
  return typeof value === 'string' && value ? value : null
})
const isSharedRoute = computed(() => route.path.startsWith('/shared'))
const backRoute = computed(() => returnToRoute.value ?? (isSharedRoute.value ? '/shared' : (brandId.value ? `/brands/${brandId.value}/playlist` : '/sound-library/archived')))
const formLabelPlacement = computed(() => (isMobile.value ? 'top' : 'left'))

function updateIsMobile() {
  isMobile.value = window.innerWidth <= 768
}

function handleResize() {
  updateIsMobile()
  updateGenreClipping()
}

const formTitle = computed(() => {
  const title = formData.value.title.trim()
  const artist = formData.value.artist.trim()
  if (title || artist) {
    return [title, artist].filter(Boolean).join(' - ')
  }
  if (!isEditing.value) return ''
  return t('fragmentForm.edit_title')
})

const formSubtitle = computed(() =>
  isEditing.value ? t('fragmentForm.edit_subtitle') : t('fragmentForm.create_subtitle')
)

function getFieldRef(field: ValidationField) {
  if (field === 'title') return titleFieldRef.value
  if (field === 'artist') return artistFieldRef.value
  if (field === 'genres') return genresFieldRef.value
  if (field === 'streamUrl') return streamUrlFieldRef.value
  return audioFileFieldRef.value
}

function getFieldLabel(field: ValidationField) {
  if (field === 'title') return t('fragmentForm.title')
  if (field === 'artist') return t('fragmentForm.artist')
  if (field === 'genres') return t('fragmentForm.genres')
  if (field === 'streamUrl') return t('fragmentForm.stream_url')
  return t('fragmentForm.audio_file')
}

function clearFieldError(field: ValidationField) {
  if (!fieldErrors.value[field]) return
  fieldErrors.value[field] = ''
  const target = getFieldRef(field)
  if (target) {
    gsap.to(target, {
      borderLeftColor: 'rgba(255,77,79,0)',
      duration: 0.2,
      ease: 'power1.out',
    })
  }
}

function clearAllFieldErrors() {
  const allFields: ValidationField[] = ['title', 'artist', 'genres', 'audioFile', 'streamUrl']
  for (const field of allFields) {
    clearFieldError(field)
  }
}

async function showFieldError(field: ValidationField, customMessage?: string) {
  fieldErrors.value[field] = customMessage ?? t('common.required_field', { field: getFieldLabel(field) })
  await nextTick()
  const target = getFieldRef(field)
  if (!target) return
  gsap.killTweensOf(target)
  gsap.fromTo(
    target,
    { borderLeftColor: 'rgba(255,77,79,0)' },
    { borderLeftColor: 'rgba(255,77,79,0.95)', duration: 0.24, repeat: 1, yoyo: true, ease: 'power1.out' }
  )
}

async function validateBeforeSave() {
  const invalidFields: ValidationField[] = []
  const isStream = formData.value.source === 'STREAM'

  if (!formData.value.title.trim()) invalidFields.push('title')
  if (!formData.value.artist.trim()) invalidFields.push('artist')
  if (!Array.isArray(formData.value.genres) || !formData.value.genres.length) invalidFields.push('genres')
  if (isStream) {
    if (!formData.value.streamUrl.trim()) invalidFields.push('streamUrl')
  } else {
    if (!existingUrl.value && !uploadedFileNames.value.length) invalidFields.push('audioFile')
  }

  const allFields: ValidationField[] = ['title', 'artist', 'genres', 'audioFile', 'streamUrl']
  for (const field of allFields) {
    if (!invalidFields.includes(field)) clearFieldError(field)
  }

  if (!invalidFields.length) return true

  isTabChangeFromValidation.value = true
  activeTab.value = 'properties'
  await nextTick()
  isTabChangeFromValidation.value = false
  await Promise.all(invalidFields.map(field => showFieldError(field)))
  return false
}


async function handleFileCapture({ file, onFinish, onError }: UploadCustomRequestOptions) {
  const chosen = file.file
  if (!chosen) { onFinish?.(); return }

  isUploading.value = true
  uploadProgress.value = 1

  try {
    // Use existing ID or "temp" — server links temp uploads on save via newlyUploaded
    const fragmentId = (route.params.fragmentId as string) || 'temp'
    const res = await datanestApiService.uploadFragmentFile(fragmentId, chosen, (p) => { uploadProgress.value = p })

    uploadedFileNames.value.push(chosen.name)

    // Apply metadata returned by server (title, artist, album, length, genres)
    const meta = res?.metadata ?? res?.payload?.metadata
    if (meta) {
      if (meta.title && !formData.value.title) formData.value.title = meta.title
      if (meta.artist && !formData.value.artist) formData.value.artist = meta.artist
      if (meta.album && !formData.value.album) formData.value.album = meta.album
      if (meta.length && formData.value.length == null) formData.value.length = meta.length
    }

    onFinish?.()
  } catch (e: any) {
    handleApiError(e, message)
    onError?.()
  } finally {
    isUploading.value = false
  }
}

async function handleSave() {
  if (isUploading.value) {
    message.warning(t('fragmentForm.wait_upload'))
    return
  }
  const valid = await validateBeforeSave()
  if (!valid) return
  try {
    loading.value = true
    const id = isEditing.value ? (route.params.fragmentId as string) : null
    const payload: any = { ...formData.value, customTags: customTags.value }
    if (uploadedFileNames.value.length) payload.newlyUploaded = uploadedFileNames.value
    const saved = await store.saveFragment(id, payload)
    formData.value.labels = saved.labels || []
    customTags.value = []
    message.success(t('fragmentForm.saved'))
    router.push(backRoute.value)
  } catch (error: any) {
    handleApiError(error, message)
  } finally {
    loading.value = false
  }
}

function navigateBack() {
  router.push(backRoute.value)
}

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
})

onMounted(async () => {
  updateIsMobile()
  window.addEventListener('resize', handleResize)
  try {
    loading.value = true

    await Promise.all([
      dictionaryStore.loadGenres(),
      loadLabelCatalog(),
    ])

    if (isEditing.value) {
      const frag = (isSharedRoute.value || route.path.startsWith('/sound-library/archived'))
        ? await datanestApiService.getSharedFragment(route.params.fragmentId as string)
        : await store.fetchFragment(route.params.fragmentId as string)
      formData.value = {
        type: frag.type || 'SONG',
        title: frag.title || '',
        artist: frag.artist || '',
        album: frag.album || '',
        description: frag.description || '',
        genres: normalizeIdList(frag.genres),
        labels: frag.labels || [],
        representedInBrands: frag.representedInBrands || [],
        expiresAt: frag.expiresAt || null,
        length: typeof frag.length === 'number'
          ? frag.length
          : (typeof frag.length === 'string' ? parseInt(frag.length) || null : null),
        source: frag.source || 'USER_UPLOAD',
        streamUrl: frag.streamUrl || '',
      }
      regDate.value = frag.regDate || ''
      lastModifiedDate.value = frag.lastModifiedDate || ''
      likes.value = frag.likes ?? 0
      dislikes.value = frag.dislikes ?? 0
      sharedWith.value = normalizeSharedWith(frag.sharedWith)
      rawAddInfo.value = frag.addInfo && typeof frag.addInfo === 'object' ? frag.addInfo : null
      const opusFile = frag.uploadedFiles?.find((f: any) => f.type === 'opus')
      isOpusPreview.value = !!opusFile
      const f0 = opusFile || frag.uploadedFiles?.[0]
      const fileUrl = f0?.url || frag.url || ''
      existingUrl.value = fileUrl
      existingFileName.value = frag.uploadedFiles?.find((f: any) => f.type === 'original')?.name || f0?.name || fileUrl.split('/').pop()?.split('?')[0] || ''
    }
  } catch (error: any) {
    message.error(error?.message || t('fragmentForm.load_failed'))
    if (isEditing.value) navigateBack()
  } finally {
    loading.value = false
  }
})

watch(() => formData.value.title, (value) => {
  if (value.trim()) clearFieldError('title')
})

watch(() => formData.value.artist, (value) => {
  if (value.trim()) clearFieldError('artist')
})

watch(() => formData.value.genres, (value) => {
  if (Array.isArray(value) && value.length) clearFieldError('genres')
}, { deep: true })

watch(uploadedFileNames, (value) => {
  if (value.length || existingUrl.value) clearFieldError('audioFile')
}, { deep: true })

watch(existingUrl, (value) => {
  if (value || uploadedFileNames.value.length) clearFieldError('audioFile')
})

watch(() => formData.value.streamUrl, (value) => {
  if (value.trim()) clearFieldError('streamUrl')
})

watch(() => formData.value.source, () => {
  clearFieldError('audioFile')
  clearFieldError('streamUrl')
})

watch(activeTab, () => {
  if (isTabChangeFromValidation.value) return
  clearAllFieldErrors()
})

// The bar only exists once its tab is rendered, so measure after that switch (and after data loads).
watch([activeTab, genreRows], async () => {
  if (activeTab.value !== 'addInfo') return
  await nextTick()
  updateGenreClipping()
})
</script>

<template>
  <FormWrapper
    :title="formTitle"
    :subtitle="formSubtitle"
    :loading="loading"
  >
    <template v-if="isEditing" #title-after>
      <span class="opus-badge" :class="{ 'opus-badge--dislikes': dislikes > 0 }" style="margin-left:10px">-{{ dislikes }}</span>
      <span class="opus-badge" :class="{ 'opus-badge--likes': likes > 0 }" style="margin-left:4px">+{{ likes }}</span>
    </template>
    <template #header-actions>
      <div v-if="regDate" style="display:flex;flex-direction:column;align-items:flex-end;gap:2px;font-size:12px;opacity:0.5;line-height:1.4;">
        <span>Created: {{ regDate }}</span>
        <span v-if="lastModifiedDate !== regDate">Modified: {{ lastModifiedDate }}</span>
      </div>
    </template>

    <template #actions>
      <div class="gsap-row">
        <GsapButton @click="navigateBack"><span>{{ t('common.close') }}</span></GsapButton>
        <GsapButton type="primary" @click="handleSave"><span>{{ t('common.save') }}</span></GsapButton>
      </div>
    </template>

    <NTabs v-model:value="activeTab">
      <NTabPane name="properties" :tab="t('fragmentForm.tab_properties')">
        <NForm :label-placement="formLabelPlacement" label-width="120" :disabled="loading || isUploading">

          <NFormItem :label="t('fragmentForm.type')">
            <div class="field-stack">
              <div class="field-error-shell">
                <NSelect v-model:value="formData.type" :options="fragmentTypeOptions" style="width: 200px" disabled />
              </div>
              <div class="field-error-label"></div>
            </div>
          </NFormItem>


          <NFormItem :label="t('fragmentForm.title')">
            <div class="field-stack">
              <div
                ref="titleFieldRef"
                class="field-error-shell"
                :class="{ 'field-error-shell--active': !!fieldErrors.title }"
              >
                <NInput v-model:value="formData.title" style="width: 100%" />
              </div>
              <div class="field-error-label" :class="{ 'field-error-label--visible': !!fieldErrors.title }">
                {{ fieldErrors.title || '\u00A0' }}
              </div>
            </div>
          </NFormItem>

          <NFormItem :label="t('fragmentForm.artist')">
            <div class="field-stack">
              <div
                ref="artistFieldRef"
                class="field-error-shell"
                :class="{ 'field-error-shell--active': !!fieldErrors.artist }"
              >
                <NInput v-model:value="formData.artist" style="width: 100%" />
              </div>
              <div class="field-error-label" :class="{ 'field-error-label--visible': !!fieldErrors.artist }">
                {{ fieldErrors.artist || '\u00A0' }}
              </div>
            </div>
          </NFormItem>

          <NFormItem :label="t('fragmentForm.album')">
            <div class="field-stack">
              <div class="field-error-shell">
                <NInput v-model:value="formData.album" style="width: 100%" />
              </div>
              <div class="field-error-label"></div>
            </div>
          </NFormItem>

          <NFormItem :label="t('fragmentForm.genres')">
            <div class="field-stack">
              <div
                ref="genresFieldRef"
                class="field-error-shell"
                :class="{ 'field-error-shell--active': !!fieldErrors.genres }"
              >
                <NSpace size="small" align="center" style="width: 100%">
                  <NTag v-for="id in formData.genres" :key="id" closable @close="removeGenre(id)">
                    {{ genreLabelById(id) }}
                  </NTag>
                  <NPopover trigger="click" placement="bottom-start" style="padding: 8px; width: 240px">
                    <template #trigger>
                      <NButton dashed size="small">+</NButton>
                    </template>
                    <NInput v-model:value="genreSearchQuery" placeholder="Search genres" size="small"
                      clearable style="margin-bottom: 8px" />
                    <NScrollbar style="max-height: 240px">
                      <NTree
                        :data="genreTreeOptions"
                        checkable
                        :checked-keys="formData.genres"
                        :pattern="genreSearchQuery"
                        :show-irrelevant-nodes="false"
                        key-field="key"
                        label-field="label"
                        style="min-width: 220px"
                        @update:checked-keys="formData.genres = $event"
                      />
                    </NScrollbar>
                  </NPopover>
                </NSpace>
              </div>
              <div class="field-error-label" :class="{ 'field-error-label--visible': !!fieldErrors.genres }">
                {{ fieldErrors.genres || ' ' }}
              </div>
            </div>
          </NFormItem>

          <NFormItem :label="t('fragmentForm.labels')">
            <div class="field-stack">
              <div class="field-error-shell">
                <NSpace size="small" align="center" style="width: 100%" wrap>
                  <NTag v-for="(tag, i) in labelDisplayTags" :key="i" :closable="!tag.startsWith('🔒 ')"
                    @close="handleLabelTagsChange(labelDisplayTags.filter((_, idx) => idx !== i))">
                    {{ tag }}
                  </NTag>
                  <NPopover trigger="click" placement="bottom-start" style="padding: 8px; width: 220px"
                    :show="labelPickerShow" @update:show="labelPickerShow = $event">
                    <template #trigger>
                      <NButton dashed size="small">+</NButton>
                    </template>
                    <NInput v-model:value="labelSearchQuery" placeholder="Search labels" size="small"
                      clearable style="margin-bottom: 8px" />
                    <NScrollbar style="max-height: 240px">
                      <div v-for="option in filteredAvailableLabelOptions" :key="option.value"
                        class="label-option-item" @click="addExistingLabel(option.value)">
                        {{ option.label }}
                      </div>
                      <NEmpty v-if="!filteredAvailableLabelOptions.length" size="small" style="padding: 8px 0" />
                    </NScrollbar>
                  </NPopover>
                  <NDynamicTags :value="[]" @update:value="handleNewLabelInput">
                    <template #trigger="{ activate, disabled }">
                      <NButton dashed size="small" :disabled="disabled" @click="activate">New Label</NButton>
                    </template>
                  </NDynamicTags>
                </NSpace>
              </div>
              <div class="field-error-label"></div>
            </div>
          </NFormItem>

          <NFormItem :label="t('fragmentForm.assign_to')">
            <div class="field-stack">
              <div class="field-error-shell">
                <NSpace size="small" align="center" style="width: 100%">
                  <NTag v-for="id in formData.representedInBrands" :key="id" closable @close="removeBrand(id)">
                    {{ brandLabelById(id) }}
                  </NTag>
                  <NPopselect :options="availableBrandOptions" trigger="click" filterable
                    @update:value="addBrand">
                    <NButton dashed size="small">+</NButton>
                  </NPopselect>
                </NSpace>
              </div>
              <div class="field-error-label"></div>
            </div>
          </NFormItem>

          <NFormItem v-if="formData.source === 'STREAM'" :label="t('fragmentForm.stream_url')">
            <div class="field-stack">
              <div
                ref="streamUrlFieldRef"
                class="field-error-shell"
                :class="{ 'field-error-shell--active': !!fieldErrors.streamUrl }"
              >
                <NInput v-model:value="formData.streamUrl" placeholder="https://..." style="width: 100%" />
              </div>
              <div class="field-error-label" :class="{ 'field-error-label--visible': !!fieldErrors.streamUrl }">
                {{ fieldErrors.streamUrl || '\u00A0' }}
              </div>
            </div>
          </NFormItem>

          <NFormItem v-else>
            <template #label>
              <span class="form-label-with-badge">
                {{ t('fragmentForm.audio_file') }}
                <span v-if="isOpusPreview" class="opus-badge" :class="{ 'opus-badge--playing': isPlayerPlaying }">opus</span>
              </span>
            </template>
            <div class="field-stack">
              <div
                ref="audioFileFieldRef"
                class="field-error-shell"
                :class="{ 'field-error-shell--active': !!fieldErrors.audioFile }"
              >
                <NSpace vertical style="width: 100%">
                  <AudioMiniPlayer v-if="existingUrl" :url="existingUrl" :filename="existingFileName" @playing-change="isPlayerPlaying = $event" />
                  <NUpload
                    :max="1"
                    :custom-request="handleFileCapture"
                    accept=".mp3,.wav,.flac,.ogg,.m4a,.aac"
                    :disabled="isUploading"
                  >
                    <GsapButton :disabled="isUploading">
                      <span>{{ existingUrl ? t('fragmentForm.replace_file') : t('fragmentForm.choose_file') }}</span>
                    </GsapButton>
                  </NUpload>
                  <NProgress
                    v-if="isUploading"
                    type="line"
                    :percentage="uploadProgress"
                    :show-indicator="false"
                    :height="2"
                    :border-radius="1"
                    :fill-border-radius="1"
                    color="#eff605"
                    rail-color="rgba(255,255,255,0.12)"
                  />
                </NSpace>
              </div>
              <div class="field-error-label" :class="{ 'field-error-label--visible': !!fieldErrors.audioFile }">
                {{ fieldErrors.audioFile || '\u00A0' }}
              </div>
            </div>
          </NFormItem>

          <NFormItem v-if="formData.expiresAt" :label="t('fragmentForm.expires_at')">
            <div class="field-stack">
              <div class="field-error-shell">
                <NInput :value="formData.expiresAt" readonly style="width: 200px" />
              </div>
              <div class="field-error-label"></div>
            </div>
          </NFormItem>

        </NForm>
      </NTabPane>

      <NTabPane name="description" :tab="t('fragmentForm.tab_description')">
        <NForm :label-placement="formLabelPlacement" label-width="120" :disabled="loading || isUploading">
          <NFormItem :label="t('fragmentForm.description')">
            <div class="field-stack">
              <div class="field-error-shell">
                <NInput v-model:value="formData.description" type="textarea"
                  :autosize="{ minRows: 8, maxRows: 20 }" style="width: 100%" />
              </div>
            </div>
          </NFormItem>
        </NForm>
      </NTabPane>

      <NTabPane v-if="isEditing" name="addInfo" :tab="t('fragmentForm.tab_add_info')">
        <NEmpty v-if="!hasVibeInfo && !rawAddInfoRows.length" :description="t('fragmentForm.add_info_empty')" />
        <template v-else>
          <table class="add-info-table">
            <tbody>
              <tr v-if="tempoInfo">
                <td class="add-info-table__label">Tempo</td>
                <td class="add-info-table__tempo">
                  <LedIndicator active pulse :bpm="tempoBpm ?? undefined" :size="18" color="#22c55e" />
                  {{ tempoInfo }}
                </td>
              </tr>
              <tr v-if="keyInfo">
                <td class="add-info-table__label">Key</td>
                <td>{{ keyInfo }}</td>
              </tr>
              <tr v-if="moodInfo">
                <td class="add-info-table__label">Mood</td>
                <td>{{ moodInfo }}</td>
              </tr>
              <tr v-if="hasDanceabilityData">
                <td class="add-info-table__label">Danceability</td>
                <td>
                  <NIcon v-if="isDanceable" :component="CheckmarkCircle" color="#16a34a" size="18" />
                  <span v-else class="add-info-negative">{{ t('fragmentForm.add_info_not_danceable') }}</span>
                </td>
              </tr>
              <tr v-if="genreRows.length">
                <td class="add-info-table__label">Genre</td>
                <td>
                  <div ref="genreBarRef" class="add-info-genre-bar">
                    <div
                      v-for="g in genreRows"
                      :key="g.name"
                      class="add-info-genre-bar__segment"
                      :style="{ width: `${g.width}%`, borderBottomColor: g.color }"
                    >
                      <span
                        class="add-info-genre-bar__label"
                        :data-genre="g.name"
                        :title="clippedGenres.has(g.name) ? `${g.name} ${g.percent}` : undefined"
                      >{{ g.name }} {{ g.percent }}</span>
                    </div>
                  </div>
                </td>
              </tr>
              <tr v-if="hasAiCheckData">
                <td class="add-info-table__label">AI check</td>
                <td>
                  <NIcon v-if="isAiGenerated" :component="CheckmarkCircle" color="#16a34a" size="18" />
                  <span v-else class="add-info-negative">{{ t('fragmentForm.add_info_ai_not_detected') }}</span>
                  <div class="add-info-ai-hint">{{ t('fragmentForm.add_info_ai_guess') }}</div>
                </td>
              </tr>
            </tbody>
          </table>
          <NCollapse v-if="rawAddInfoRows.length" style="margin-top: 16px;">
            <NCollapseItem :title="t('fragmentForm.add_info_raw')" name="raw">
              <table class="add-info-table">
                <tbody>
                  <tr v-for="row in rawAddInfoRows" :key="row.label">
                    <td class="add-info-table__label">{{ row.label }}</td>
                    <td>{{ row.value }}</td>
                  </tr>
                </tbody>
              </table>
            </NCollapseItem>
          </NCollapse>
        </template>
      </NTabPane>

      <NTabPane name="sharing" :tab="t('fragmentForm.tab_sharing')">
        <div v-if="activeSharedWith.length" class="sharing-list">
          <div v-for="(entry, idx) in activeSharedWith" :key="`${entry.targetBrand}-${idx}`" class="sharing-row">
            <span class="sharing-row__label">{{ t('fragmentForm.sharing_shared_with') }}</span>
            <span class="sharing-row__value">{{ entry.targetBrand }}</span>
            <NTag size="small" :type="sharedWithStatusInfo(entry).type">{{ sharedWithStatusInfo(entry).text }}</NTag>
          </div>
        </div>
        <div v-else class="sharing-empty">
          {{ t('fragmentForm.sharing_empty') }}
        </div>
      </NTabPane>
    </NTabs>
  </FormWrapper>
</template>

<style scoped>
.field-stack {
  width: 100%;
  display: block;
}

.form-label-with-badge {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 3px;
}

.opus-badge {
  display: inline-block;
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  color: currentColor;
  border: 1px solid currentColor;
  border-radius: 3px;
  padding: 0px 4px;
  opacity: 0.35;
  transition: color 0.3s, border-color 0.3s, box-shadow 0.3s, opacity 0.3s;
}

.opus-badge--playing {
  opacity: 1;
  color: #eff605;
  border-color: rgba(239, 246, 5, 0.5);
  box-shadow: 0 0 7px 2px rgba(239, 246, 5, 0.4);
}

.opus-badge--likes {
  opacity: 1;
  color: #ca8a04;
  border-color: rgba(202, 138, 4, 0.5);
  box-shadow: 0 0 7px 2px rgba(202, 138, 4, 0.25);
}

.opus-badge--dislikes {
  opacity: 1;
  color: #dc2626;
  border-color: rgba(220, 38, 38, 0.5);
  box-shadow: 0 0 7px 2px rgba(220, 38, 38, 0.25);
}

.field-error-shell {
  width: 100%;
  border-left: 2px solid transparent;
  padding-left: 8px;
  transition: border-left-color 0.2s ease;
}

.label-option-item {
  padding: 4px 8px;
  border-radius: 4px;
  cursor: pointer;
}

.label-option-item:hover {
  background: rgba(128, 128, 128, 0.15);
}

.field-error-shell--active {
  border-left-color: rgba(255, 77, 79, 0.95);
}

.field-error-label {
  margin-top: 3px;
  min-height: 12px;
  padding-left: 10px;
  color: #ff4d4f;
  font-size: 11px;
  line-height: 1.3;
  visibility: hidden;
}

.field-error-label--visible {
  visibility: visible;
}

:deep(.n-form-item .n-form-item-feedback-wrapper) {
  min-height: 12px;
  line-height: 1.1;
}

:deep(.n-form-item) {
  margin-bottom: 8px;
}

:deep(.n-form-item:last-child) {
  margin-bottom: 0;
}

@media (max-width: 768px) {
  :deep(.n-form-item-label) {
    padding-left: 10px !important;
  }

  .field-stack {
    padding-right: 10px;
  }
}

.sharing-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 4px 0;
}

.sharing-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.03);
}

.sharing-row__label {
  font-size: 13px;
  opacity: 0.55;
}

.sharing-row__value {
  font-size: 14px;
  font-weight: 600;
}

.sharing-empty {
  padding: 24px 0;
  text-align: center;
  opacity: 0.45;
  font-size: 14px;
}

.add-info-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.add-info-table td {
  padding: 6px 12px 6px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  word-break: break-word;
}

.add-info-table__label {
  opacity: 0.55;
  white-space: nowrap;
  width: 1%;
}

.add-info-table__tempo {
  display: flex;
  align-items: center;
  gap: 8px;
}

.add-info-genre-bar {
  display: flex;
  width: 100%;
}

.add-info-genre-bar__segment {
  display: flex;
  align-items: center;
  padding: 0 6px 4px 0;
  min-width: 0;
  overflow: hidden;
  border-bottom: 3px solid transparent;
}

.add-info-genre-bar__label {
  font-size: 11px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.add-info-ai-hint {
  font-size: 11px;
  opacity: 0.5;
  margin-top: 2px;
}

.add-info-negative {
  opacity: 0.55;
}
</style>
