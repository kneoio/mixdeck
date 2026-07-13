<script setup lang="ts">
import { ref, computed, watch, h, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import {
  NDataTable, NSpace, NPopconfirm, NInput, NTag, NIcon, NButton, NProgress,
  type DataTableColumns, useMessage
} from 'naive-ui'
import { ShareSocialOutline, PlayOutline, PauseOutline, RefreshOutline, ArrowUpOutline, ArrowDownOutline } from '@vicons/ionicons5'
import LedIndicator from '@/components/LedIndicator.vue'
import datanestApiService from '@/services/datanestApi'
import { appConfig } from '@/config/appConfig'
import { useBrandsStore } from '@/stores/brands'
import { useDictionaryStore } from '@/stores/dictionary'
import PageHeader from '@/components/PageHeader.vue'
import ActionBar from '@/components/ActionBar.vue'
import GsapButton from '@/components/GsapButton.vue'
import BulkUploadDialog from '@/components/forms/BulkUploadDialog.vue'
import ShareToBrandsDialog from '@/components/forms/ShareToBrandsDialog.vue'
import { handleApiError } from '@/utils/notificationService'

const { t } = useI18n()

const route = useRoute()
const router = useRouter()
const brandsStore = useBrandsStore()
const message = useMessage()
const dictionaryStore = useDictionaryStore()

const entries = ref<any[]>([])
const loading = ref(false)
const totalCount = ref(0)
const pageNum = ref(1)
const pageSize = ref(10)
const selectedIds = ref<string[]>([])
const searchTerm = ref('')
const showBulkUpload = ref(false)
const showShareDialog = ref(false)
const shareFragmentIds = ref<string[]>([])
const brandDoc = ref<any | null>(null)

const playingId = ref<string | null>(null)
const loadingPlayId = ref<string | null>(null)
const playbackPercent = ref(0)
let currentAudio: HTMLAudioElement | null = null
const currentTrackId = ref<string | null>(null)
let playRequestId = 0
const blobUrlCache = new Map<string, string>()

const seekBarRef = ref<HTMLElement | null>(null)
let seekDocMove: ((e: MouseEvent) => void) | null = null
let seekDocUp: (() => void) | null = null

function detachSeekListeners() {
  if (seekDocMove) { document.removeEventListener('mousemove', seekDocMove); seekDocMove = null }
  if (seekDocUp)   { document.removeEventListener('mouseup',  seekDocUp);   seekDocUp = null }
}

function applySeekClientX(clientX: number) {
  const bar = seekBarRef.value
  const a = currentAudio
  if (!bar || !a || !Number.isFinite(a.duration) || a.duration <= 0) return
  const rect = bar.getBoundingClientRect()
  if (rect.width <= 0) return
  const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
  a.currentTime = ratio * a.duration
  playbackPercent.value = ratio * 100
}

function onSeekMouseDown(e: MouseEvent) {
  if (e.button !== 0) return
  e.preventDefault()
  let done = false
  function onUp() { if (done) return; done = true; detachSeekListeners() }
  seekDocMove = (ev) => { if (!done) applySeekClientX(ev.clientX) }
  seekDocUp   = onUp
  document.addEventListener('mousemove', seekDocMove)
  document.addEventListener('mouseup', onUp, { once: true })
  applySeekClientX(e.clientX)
}

function stopCurrentAudio() {
  if (currentAudio) { currentAudio.pause(); currentAudio.src = ''; currentAudio = null }
  currentTrackId.value = null
  playingId.value = null
  playbackPercent.value = 0
}

async function toggleRowPlay(row: any, e: MouseEvent) {
  e.stopPropagation()
  const id = row.id
  if (playingId.value === id) {
    currentAudio?.pause()
    playingId.value = null
    return
  }
  if (currentTrackId.value === id && currentAudio) {
    await currentAudio.play()
    playingId.value = id
    return
  }
  stopCurrentAudio()
  loadingPlayId.value = id
  const reqId = ++playRequestId
  try {
    const frag: any = await datanestApiService.getDocument<any>('/soundfragments', id)
    if (reqId !== playRequestId) return
    const doc = frag?.payload?.docData ?? frag?.docData ?? frag
    const opusFile = doc?.uploadedFiles?.find((f: any) => f.type === 'opus')
    const fileEntry = opusFile || doc?.uploadedFiles?.[0]
    console.log('[AudioPlayer] playing file type:', fileEntry?.type ?? 'unknown')
    const rawUrl = fileEntry?.url || doc?.url || ''
    if (!rawUrl) return
    let blobUrl = blobUrlCache.get(id)
    if (!blobUrl) {
      const url = rawUrl.startsWith('http') ? rawUrl : `${appConfig.datanestServer}${rawUrl}`
      blobUrl = await datanestApiService.fetchBlobUrl(url)
      if (reqId !== playRequestId) { URL.revokeObjectURL(blobUrl); return }
      blobUrlCache.set(id, blobUrl)
    }
    if (reqId !== playRequestId) return
    const audio = new Audio(blobUrl)
    currentAudio = audio
    currentTrackId.value = id
    audio.ontimeupdate = () => {
      if (audio.duration > 0) playbackPercent.value = (audio.currentTime / audio.duration) * 100
    }
    audio.onended = () => { playingId.value = null; playbackPercent.value = 0 }
    await audio.play()
    playingId.value = id
  } catch { /* silent */ } finally {
    if (reqId === playRequestId) loadingPlayId.value = null
  }
}

/** When true, narrow genres / labels / played / description so title & artist keep space. */
const narrowPlaylistTable = ref(false)
let playlistTableMql: MediaQueryList | null = null

function syncPlaylistTableNarrow() {
  narrowPlaylistTable.value = playlistTableMql?.matches ?? false
}

const isMobile = ref(false)
let mobileMql: MediaQueryList | null = null

function syncMobile() {
  isMobile.value = mobileMql?.matches ?? false
}

// Lookup maps for resolving IDs → display names
const genreMap = ref<Map<string, { name: string; color?: string; fontColor?: string }>>(new Map())
const labelMap = ref<Map<string, { name: string; color?: string; fontColor?: string }>>(new Map())

async function loadDictionaries() {
  await Promise.all([
    dictionaryStore.loadGenres(),
    dictionaryStore.loadSoundFragmentLabels(),
  ])
  genreMap.value = new Map(dictionaryStore.genres.map(g => [g.id, {
    name: g.localizedName?.en || Object.values(g.localizedName || {})[0] || g.identifier || g.id,
    color: g.color,
    fontColor: g.fontColor,
  }]))
  labelMap.value = new Map(dictionaryStore.soundFragmentLabels.map(l => [l.id, {
    name: l.localizedName?.en || l.identifier || l.id,
    color: l.color,
    fontColor: l.fontColor,
  }]))
}

function resolveGenre(g: any) {
  if (typeof g === 'string') return genreMap.value.get(g) ?? { name: g }
  return { name: g.identifier || g.id, color: g.color, fontColor: g.fontColor }
}

function resolveLabel(l: any) {
  if (typeof l === 'string') return labelMap.value.get(l) ?? { name: l }
  return { name: l.identifier || l.id, color: l.color, fontColor: l.fontColor }
}

const brand = computed(() => brandsStore.brands.find(b => b.id === route.params.id))
const effectiveBrand = computed(() => brand.value ?? brandDoc.value)
const slugName = computed(() => effectiveBrand.value?.slugName ?? '')
const brandName = computed(() =>
  effectiveBrand.value?.localizedName?.['en']
    || effectiveBrand.value?.title
    || effectiveBrand.value?.slugName
    || (route.params.id as string)
)

const pagination = computed(() => ({
  page: pageNum.value,
  pageSize: pageSize.value,
  pageSizes: [10, 20, 50],
  showSizePicker: true,
  itemCount: totalCount.value,
}))

const columns = computed<DataTableColumns<any>>(() => {
  if (isMobile.value) {
    return [
      { type: 'selection', multiple: true },
      {
        key: 'mob',
        title: '',
        render: (row) => {
          const isRowPlaying = playingId.value === row.id
          const isRowLoading = loadingPlayId.value === row.id
          const iconClass = isRowLoading ? 'play-icon--loading' : isRowPlaying ? 'play-icon--playing' : ''
          const playBtn = h(NButton, {
            text: true, disabled: isRowLoading, style: 'flex-shrink:0',
            onClick: (e: MouseEvent) => toggleRowPlay(row, e),
          }, { icon: () => h('span', { class: iconClass }, [h(NIcon, { size: 18 }, { default: () => isRowPlaying ? h(PauseOutline) : h(PlayOutline) })]) })

          const row1 = h('div', { class: 'mob-r1' }, [
            playBtn,
            h('span', { class: 'mob-title' }, row.title || '-'),
            h('span', { class: 'mob-sep' }, '—'),
            h('span', { class: 'mob-artist' }, row.artist || '-'),
          ])

          const genreTags = (row.genres || []).map((g: any) => {
            const r = resolveGenre(g)
            return h(NTag, { size: 'small', style: r.color ? `background:${r.color};color:${r.fontColor || '#fff'}` : '' }, { default: () => r.name })
          })
          const labelTags = (row.labels || []).map((l: any) => {
            const r = resolveLabel(l)
            return h(NTag, { size: 'small', style: r.color ? `background:${r.color};color:${r.fontColor || '#fff'}` : '' }, { default: () => r.name })
          })
          const row2 = (genreTags.length || labelTags.length)
            ? h('div', { class: 'mob-r2' }, [...genreTags, ...labelTags])
            : null

          const played = row.playedByBrandCount ?? 0
          const l = row.likes ?? 0
          const d = row.dislikes ?? 0
          const likesBadge = h('span', { class: ['stat-badge', l > 0 ? 'stat-badge--likes' : ''] }, `+${l}`)
          const dislikesBadge = h('span', { class: ['stat-badge', d > 0 ? 'stat-badge--dislikes' : ''] }, `-${d}`)
          const metaItems: any[] = [
            h('span', { class: 'mob-meta-item' }, `${t('playlistView.col_played')}: ${played}`),
            h('span', { class: 'mob-meta-item' }, [t('playlistView.col_rating') + ': ', dislikesBadge, ' ', likesBadge]),
          ]
          if (row.shared) metaItems.push(h('span', { class: 'mob-meta-item' }, [h(NIcon, { size: 14, color: 'var(--vt-c-primary)' }, { default: () => h(ShareSocialOutline) })]))
          if (row.description) metaItems.push(h('span', { class: 'mob-meta-item mob-desc' }, row.description))
          const row3 = h('div', { class: 'mob-r3' }, metaItems)

          return h('div', { class: 'mob-card' }, [row1, row2, row3].filter(Boolean))
        },
      },
    ]
  }

  const nw = narrowPlaylistTable.value
  const genreW = nw ? 100 : 180
  const labelW = nw ? 88 : 180
  const playedW = nw ? 56 : 80
  const descMin = nw ? 72 : 160
  const titleMin = nw ? 220 : 200
  const artistMin = nw ? 180 : 160
  const ratingW = nw ? 100 : 120
  const sharedW = nw ? 56 : 72

  return [
  { type: 'selection', multiple: true },
  {
    title: t('playlistView.col_title'),
    key: 'title',
    width: nw ? titleMin : undefined,
    minWidth: titleMin,
    ellipsis: { tooltip: true },
    render: (row) => row.title || '-',
  },
  {
    title: t('playlistView.col_artist'),
    key: 'artist',
    width: nw ? artistMin : undefined,
    minWidth: artistMin,
    ellipsis: { tooltip: true },
    render: (row) => row.artist || '-',
  },
  {
    key: 'play',
    width: 40,
    title: '',
    render: (row) => {
      const isRowPlaying = playingId.value === row.id
      const isRowLoading = loadingPlayId.value === row.id
      const iconClass = isRowLoading ? 'play-icon--loading' : isRowPlaying ? 'play-icon--playing' : ''
      return h(NButton, {
        text: true,
        disabled: isRowLoading,
        onClick: (e: MouseEvent) => toggleRowPlay(row, e),
      }, {
        icon: () => h('span', { class: iconClass }, [
          h(NIcon, { size: 18 }, { default: () => isRowPlaying ? h(PauseOutline) : h(PlayOutline) })
        ])
      })
    },
  },
  {
    title: t('playlistView.col_genres'), key: 'genres', width: genreW,
    render: (row) => {
      if (!row.genres?.length) return '-'
      return h(NSpace, { size: 4, wrap: true }, {
        default: () => row.genres.map((g: any) => {
          const r = resolveGenre(g)
          return h(NTag, {
            size: 'small',
            style: r.color ? `background:${r.color};color:${r.fontColor || '#fff'}` : ''
          }, { default: () => r.name })
        })
      })
    }
  },
  {
    title: t('playlistView.col_labels'), key: 'labels', width: labelW,
    render: (row) => {
      if (!row.labels?.length) return '-'
      return h(NSpace, { size: 4, wrap: true }, {
        default: () => row.labels.map((l: any) => {
          const r = resolveLabel(l)
          return h(NTag, {
            size: 'small',
            style: r.color ? `background:${r.color};color:${r.fontColor || '#fff'}` : ''
          }, { default: () => r.name })
        })
      })
    }
  },
  {
    title: t('playlistView.col_rating'), key: 'rating', width: ratingW,
    render: (row) => {
      const l = row.likes ?? 0
      const d = row.dislikes ?? 0
      return h('span', { style: 'display:flex;gap:4px;align-items:center' }, [
        h('span', { class: ['stat-badge', d > 0 ? 'stat-badge--dislikes' : ''] }, `-${d}`),
        h('span', { class: ['stat-badge', l > 0 ? 'stat-badge--likes' : ''] }, `+${l}`),
      ])
    }
  },
  {
    key: 'boost',
    width: 110,
    title: 'Boost',
    render: (row) => {
      if (row.shared) return null
      const boost = row.boost ?? 0
      const busy = boostingId.value === row.id
      const upBtn = h(NButton, {
        text: true, size: 'tiny',
        disabled: busy || boost >= 2,
        onClick: (e: MouseEvent) => changeBoost(row, 1, e),
      }, { icon: () => h(NIcon, { size: 16 }, { default: () => h(ArrowUpOutline) }) })
      const leds = h('span', { style: 'display:flex;flex-direction:row;align-items:center;gap:2px' }, [
        h(LedIndicator, { active: boost === 2, color: '#f59e0b', size: 12 }),
        h(LedIndicator, { active: boost === 1, color: '#22c55e', size: 12 }),
        h(LedIndicator, { active: boost === -1, color: '#ef4444', size: 12 }),
      ])
      const downBtn = h(NButton, {
        text: true, size: 'tiny',
        disabled: busy || boost <= -1,
        onClick: (e: MouseEvent) => changeBoost(row, -1, e),
      }, { icon: () => h(NIcon, { size: 16 }, { default: () => h(ArrowDownOutline) }) })
      return h('span', { style: 'display:flex;align-items:center;gap:3px', onMousedown: (e: MouseEvent) => e.stopPropagation(), onClick: (e: MouseEvent) => e.stopPropagation() }, [upBtn, leds, downBtn])
    },
  },
  {
    title: t('playlistView.col_shared'),
    key: 'shared',
    width: sharedW,
    align: 'center',
    render: (row) => row.shared
      ? h(NIcon, { size: 18, color: 'var(--vt-c-primary)' }, { default: () => h(ShareSocialOutline) })
      : null,
  },
  { title: t('playlistView.col_description'), key: 'description', width: nw ? 100 : undefined, minWidth: descMin, ellipsis: { tooltip: true } },
]
})

async function fetchData(page = pageNum.value, size = pageSize.value) {
  if (!slugName.value) return
  loading.value = true
  try {
    const result = await datanestApiService.getBrandPlaylist(
      slugName.value, page, size,
      searchTerm.value ? { searchTerm: searchTerm.value } : {}
    )
    entries.value = result.entries
    totalCount.value = result.count
    pageNum.value = result.pageNum
    pageSize.value = result.pageSize
  } catch (e: any) {
    handleApiError(e, message)
  } finally {
    loading.value = false
  }
}

async function ensureBrandLoaded() {
  if (brand.value) {
    brandDoc.value = null
    return
  }
  try {
    brandDoc.value = await brandsStore.fetchBrand(route.params.id as string)
  } catch {
    brandDoc.value = null
  }
}

async function handleBulkDelete() {
  try {
    loading.value = true
    await Promise.all(selectedIds.value.map(id => datanestApiService.deleteSoundFragment(id)))
    message.success(t('playlistView.deleted', { count: selectedIds.value.length }))
    selectedIds.value = []
    await fetchData()
  } catch (e: any) {
    handleApiError(e, message)
  } finally {
    loading.value = false
  }
}

function openShareBulk() {
  if (selectedIds.value.length === 0) return
  shareFragmentIds.value = [...selectedIds.value]
  showShareDialog.value = true
}

function onShareDialogDone() {
  selectedIds.value = []
  void fetchData()
}

const boostingId = ref<string | null>(null)

async function changeBoost(row: any, delta: number, e: MouseEvent) {
  e.stopPropagation()
  const cur = row.boost ?? 0
  const next = Math.min(2, Math.max(-1, cur + delta))
  if (next === cur) return
  boostingId.value = row.id
  try {
    await datanestApiService.patchSoundFragmentBoost(row.id, route.params.id as string, next, row.shared ? 'shared' : 'brand')
    row.boost = next
  } catch (err: any) {
    handleApiError(err, message)
  } finally {
    boostingId.value = null
  }
}

let searchTimer: ReturnType<typeof setTimeout> | null = null
function onSearchChange() {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => fetchData(1), 400)
}

onMounted(() => {
  playlistTableMql = window.matchMedia('(max-width: 1100px)')
  narrowPlaylistTable.value = playlistTableMql.matches
  playlistTableMql.addEventListener('change', syncPlaylistTableNarrow)
  mobileMql = window.matchMedia('(max-width: 640px)')
  isMobile.value = mobileMql.matches
  mobileMql.addEventListener('change', syncMobile)
  ensureBrandLoaded()
})

onUnmounted(() => {
  stopCurrentAudio()
  detachSeekListeners()
  blobUrlCache.forEach(url => URL.revokeObjectURL(url))
  blobUrlCache.clear()
  playlistTableMql?.removeEventListener('change', syncPlaylistTableNarrow)
  playlistTableMql = null
  mobileMql?.removeEventListener('change', syncMobile)
  mobileMql = null
})

watch(
  () => route.params.id,
  () => {
    brandDoc.value = null
    ensureBrandLoaded()
  },
  { immediate: true }
)

watch(slugName, (val) => { if (val) { loadDictionaries(); fetchData(1) } }, { immediate: true })
watch(showBulkUpload, (isOpen, wasOpen) => {
  if (wasOpen && !isOpen) fetchData(1)
})
</script>

<template>
  <div>
    <PageHeader :title="brandName" :subtitle="t('playlistView.subtitle')" :count="totalCount" />
    <ActionBar>
      <div class="playlist-action-row">
        <div class="gsap-row" style="padding-left:0;flex-wrap:wrap">
          <GsapButton type="primary" @click="router.push({ path: `/brands/${route.params.id}/playlist/new`, query: { returnTo: route.fullPath } })">
            <span>{{ t('playlistView.new_track') }}</span>
          </GsapButton>
          <GsapButton @click="showBulkUpload = true"><span>{{ t('playlistView.bulk_upload') }}</span></GsapButton>
          <GsapButton :disabled="selectedIds.length === 0" @click="openShareBulk">
            <span>{{ t('playlistView.share_btn', { count: selectedIds.length }) }}</span>
          </GsapButton>
          <NPopconfirm @positive-click="handleBulkDelete" :disabled="selectedIds.length === 0">
            <template #trigger>
              <GsapButton type="error" :disabled="selectedIds.length === 0">
                <span>{{ t('playlistView.delete_btn', { count: selectedIds.length }) }}</span>
              </GsapButton>
            </template>
            {{ t('playlistView.delete_confirm', { count: selectedIds.length }) }}
          </NPopconfirm>
          <NButton quaternary circle size="small" style="opacity:0.5" @click="fetchData()">
            <template #icon><NIcon :component="RefreshOutline" /></template>
          </NButton>
        </div>
        <NInput
          v-model:value="searchTerm"
          :placeholder="t('playlistView.search')"
          clearable
          style="width: 220px"
          @update:value="onSearchChange"
        />
      </div>
    </ActionBar>
    <BulkUploadDialog
      v-model:show="showBulkUpload"
      :slug-name="slugName"
    />
    <ShareToBrandsDialog
      v-model:show="showShareDialog"
      :fragment-ids="shareFragmentIds"
      :brand-slug="slugName"
      @shared="onShareDialogDone"
    />
    <div class="playlist-dl-bar-wrap">
      <div v-if="loadingPlayId" class="playlist-dl-bar" />
      <div v-else-if="playingId || currentTrackId" style="position:relative;">
        <NProgress
          type="line"
          :percentage="playbackPercent"
          :show-indicator="false"
          :height="2"
          :border-radius="1"
          :fill-border-radius="1"
          color="#eff605"
          rail-color="rgba(255,255,255,0.12)"
        />
        <div ref="seekBarRef" class="playlist-seek-hit" @mousedown="onSeekMouseDown" />
      </div>
    </div>
    <NDataTable
      :columns="columns"
      :data="entries"
      :loading="loading"
      :row-key="(row: any) => row.id || row.slugName"
      v-model:checked-row-keys="selectedIds"
      :pagination="pagination"
      remote
      :row-props="(row: any) => ({ style: 'cursor:pointer;height:48px', onClick: (e: MouseEvent) => { if ((e.target as HTMLElement).closest('.n-data-table-td--selection')) return; router.push({ path: `/brands/${route.params.id}/playlist/${row.id}`, query: { returnTo: route.fullPath } }) } })"
      @update:page="(p) => { pageNum = p; fetchData(p) }"
      @update:page-size="(s) => { pageSize = s; fetchData(1, s) }"
    />
  </div>
</template>

<style>
.play-icon--loading {
  color: #00FF3C;
  animation: play-pulse 0.8s ease-in-out infinite;
}
.play-icon--playing {
  color: #00FF3C;
  filter: drop-shadow(0 0 4px #00FF3C) drop-shadow(0 0 10px #00FF3C);
}
@keyframes play-pulse {
  0%, 60%, 100% { filter: drop-shadow(0 0 4px #00FF3C) drop-shadow(0 0 10px #00FF3C); opacity: 1; }
  35%           { filter: drop-shadow(0 0 1px #00FF3C); opacity: 0.2; }
}

.playlist-dl-bar-wrap {
  height: 2px;
  overflow: hidden;
}
.playlist-dl-bar {
  height: 100%;
  background: #eff605;
  box-shadow: 0 0 4px #eff605;
  animation: playlist-dl-slide 1.4s ease-in-out infinite;
}
@keyframes playlist-dl-slide {
  0%   { margin-left: -40%; width: 40%; }
  50%  { margin-left: 60%; width: 40%; }
  100% { margin-left: 110%; width: 40%; }
}
.playlist-seek-hit {
  position: absolute;
  inset: -6px 0;
  cursor: pointer;
}
.stat-badge {
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
}
.stat-badge--likes {
  opacity: 1;
  color: #ca8a04;
  border-color: rgba(202, 138, 4, 0.5);
  box-shadow: 0 0 7px 2px rgba(202, 138, 4, 0.25);
}
.stat-badge--dislikes {
  opacity: 1;
  color: #dc2626;
  border-color: rgba(220, 38, 38, 0.5);
  box-shadow: 0 0 7px 2px rgba(220, 38, 38, 0.25);
}
.mob-card { display: flex; flex-direction: column; gap: 4px; padding: 2px 0; }
.mob-r1 { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.mob-title { font-weight: 500; }
.mob-sep { opacity: 0.35; }
.mob-artist { opacity: 0.65; font-size: 0.9em; }
.mob-r2 { display: flex; flex-wrap: wrap; gap: 4px; padding-left: 2px; }
.mob-r3 { display: flex; flex-wrap: wrap; gap: 8px; font-size: 0.8em; opacity: 0.55; padding-left: 2px; }
.mob-meta-item { white-space: nowrap; display: flex; align-items: center; gap: 3px; }
.mob-desc { max-width: 240px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.playlist-action-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
}
@media (max-width: 600px) {
  .playlist-action-row {
    flex-wrap: wrap;
    gap: 8px;
  }
  .playlist-action-row .n-input {
    width: 100% !important;
  }
}
</style>
