<script setup lang="ts">
import { ref, computed, watch, h, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import {
  NDataTable, NSpace, NPopconfirm, NInput, NSelect, NTag, NIcon, NButton,
  type DataTableColumns, type DataTableSortState, useMessage
} from 'naive-ui'
import { ShareSocialOutline, PlayOutline, PauseOutline, RefreshOutline } from '@vicons/ionicons5'
import datanestApiService from '@/services/datanestApi'
import { useBrandsStore } from '@/stores/brands'
import { useDictionaryStore } from '@/stores/dictionary'
import { useAudioPlayerStore } from '@/stores/audioPlayer'
import PageHeader from '@/components/PageHeader.vue'
import ActionBar from '@/components/ActionBar.vue'
import GsapButton from '@/components/GsapButton.vue'
import GsapLoader from '@/components/GsapLoader.vue'
import BulkUploadDialog from '@/components/forms/BulkUploadDialog.vue'
import ShareToBrandsDialog from '@/components/forms/ShareToBrandsDialog.vue'
import { handleApiError } from '@/utils/notificationService'
import { isActionEnabled, entitlementNotice, revealEntitlementNotice, type EntitlementAction } from '@/utils/entitlements'
import { useStackedDataTable } from '@/composables/useStackedDataTable'
import { useRoutePagination } from '@/composables/useRoutePagination'

const { t } = useI18n()

const route = useRoute()
const router = useRouter()
const brandsStore = useBrandsStore()
const message = useMessage()
const dictionaryStore = useDictionaryStore()
const audioPlayer = useAudioPlayerStore()

const entries = ref<any[]>([])
const loading = ref(true)
const totalCount = ref(0)
const { pageNum, pageSize, setPage, setPageSize, resetPage, syncToQuery } = useRoutePagination()
const selectedIds = ref<string[]>([])
const searchTerm = ref('')
type PlaylistSortBy = 'PLAYED' | 'RATE'
const VALID_SORT_BY: PlaylistSortBy[] = ['PLAYED', 'RATE']
const COLUMN_SORT_MAP: Record<string, PlaylistSortBy> = {
  playedCount: 'PLAYED',
  rating: 'RATE',
}

function parseSortFromQuery() {
  const by = typeof route.query.sortBy === 'string' ? route.query.sortBy : null
  const sortByVal = by && VALID_SORT_BY.includes(by as PlaylistSortBy) ? (by as PlaylistSortBy) : null
  const descRaw = route.query.sortDesc
  const sortDescVal = descRaw === 'false' ? false : true
  return { sortBy: sortByVal, sortDesc: sortDescVal }
}

const initialSort = parseSortFromQuery()
const sortBy = ref<PlaylistSortBy | null>(initialSort.sortBy)
const sortDesc = ref(initialSort.sortDesc)

function syncSortToQuery() {
  const query = { ...route.query }
  if (sortBy.value) {
    query.sortBy = sortBy.value
    query.sortDesc = String(sortDesc.value)
  } else {
    delete query.sortBy
    delete query.sortDesc
  }
  void router.replace({ query })
}
const showBulkUpload = ref(false)
const showShareDialog = ref(false)
const shareFragmentIds = ref<string[]>([])

async function toggleRowPlay(row: any, e: MouseEvent) {
  e.stopPropagation()
  await audioPlayer.playFragment({
    id: row.slugName,
    title: row.title,
    artist: row.artist,
  })
}

/** When true, use multi-line row cards instead of squeezed columns (see STACKED_TABLE_MAX_WIDTH). */
const { stackedRows, tableWrapRef } = useStackedDataTable()

// Lookup maps for resolving IDs → display names
const genreMap = ref<Map<string, { name: string; color?: string; fontColor?: string }>>(new Map())
const labelMap = ref<Map<string, { name: string; color?: string; fontColor?: string }>>(new Map())

async function loadDictionaries() {
  await Promise.all([
    dictionaryStore.loadGenres(),
    dictionaryStore.loadSoundFragmentLabels(),
  ])
  genreMap.value = new Map(dictionaryStore.genres.map(g => [g.identifier, {
    name: g.localizedName?.en || Object.values(g.localizedName || {})[0] || g.identifier,
    color: g.color,
    fontColor: g.fontColor,
  }]))
  labelMap.value = new Map(dictionaryStore.soundFragmentLabels.map(l => [l.identifier, {
    name: l.localizedName?.en || l.name || l.identifier,
    color: l.color,
    fontColor: l.fontColor,
  }]))
}

function resolveGenre(g: any) {
  if (typeof g === 'string') return genreMap.value.get(g) ?? { name: g }
  return { name: g.identifier, color: g.color, fontColor: g.fontColor }
}

function resolveLabel(l: any) {
  if (typeof l === 'string') return labelMap.value.get(l) ?? { name: l }
  return { name: l.identifier, color: l.color, fontColor: l.fontColor }
}

const UNASSIGNED_VALUE = '__unassigned__'
const unassignedOnly = computed(() => route.query.unassigned === 'true')
const selectedBrand = computed(() => {
  if (unassignedOnly.value) return ''
  return typeof route.query.brand === 'string' ? route.query.brand : ''
})
const slugName = computed(() => selectedBrand.value)
const brandFilterValue = computed(() => unassignedOnly.value ? UNASSIGNED_VALUE : selectedBrand.value)
const actions = ref<EntitlementAction[]>([])
const canCreate = computed(() => isActionEnabled(actions.value, 'create'))
const canDelete = computed(() => isActionEnabled(actions.value, 'delete'))
const createNotice = computed(() => entitlementNotice(actions.value, 'create'))
const showCreateNotice = ref(false)
const createNoticeEl = ref<HTMLElement | null>(null)

async function onAddTrack() {
  if (canCreate.value) {
    router.push({ path: newTrackPath.value, query: { returnTo: route.fullPath } })
    return
  }
  showCreateNotice.value = true
  await nextTick()
  revealEntitlementNotice(createNoticeEl.value)
}
const brandOptions = computed(() => [
  { label: t('menu.filter_all_brands'), value: '', style: { fontWeight: 700 } },
  { label: t('menu.unassigned_brands'), value: UNASSIGNED_VALUE },
  ...brandsStore.brands.map(b => ({
    label: b.localizedName?.['en'] || b.title || b.slugName || '',
    value: b.slugName as string,
  })),
])

function onBrandFilter(val: string | null) {
  const query = { ...route.query }
  delete query.page
  pageNum.value = 1
  if (val === UNASSIGNED_VALUE) {
    query.unassigned = 'true'
    delete query.brand
  } else if (val) {
    query.brand = val
    delete query.unassigned
  } else {
    delete query.brand
    delete query.unassigned
  }
  void router.replace({ query })
}

const newTrackPath = computed(() =>
  selectedBrand.value
    ? `/brands/${selectedBrand.value}/playlist/new`
    : '/sound-library/archived/new'
)
function editTrackPath(id: string) {
  return selectedBrand.value
    ? `/brands/${selectedBrand.value}/playlist/${id}`
    : `/sound-library/archived/${id}`
}

function playedLabel(row: any): string {
  const total = row.playedCount ?? 0
  if (!selectedBrand.value) return String(total)
  return `${total} / ${row.playedByBrand ?? 0}`
}

const pagination = computed(() => ({
  page: pageNum.value,
  pageSize: pageSize.value,
  pageSizes: [10, 20, 50],
  showSizePicker: true,
  itemCount: totalCount.value,
}))

const columns = computed<DataTableColumns<any>>(() => {
  // Track player state so row play icons re-render
  void audioPlayer.isPlaying
  void audioPlayer.trackId
  void audioPlayer.loadingId
  void selectedBrand.value

  if (stackedRows.value) {
    return [
      { type: 'selection', multiple: true },
      {
        key: 'mob',
        title: '',
        render: (row) => {
          const isRowPlaying = audioPlayer.isTrackPlaying(row.slugName)
          const isRowLoading = audioPlayer.isTrackLoading(row.slugName)
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

          const played = playedLabel(row)
          const l = row.likes ?? 0
          const d = row.dislikes ?? 0
          const likesBadge = h('span', { class: ['stat-badge', l > 0 ? 'stat-badge--likes' : ''] }, `+${l}`)
          const dislikesBadge = h('span', { class: ['stat-badge', d > 0 ? 'stat-badge--dislikes' : ''] }, `-${d}`)
          const metaItems: any[] = [
            h('span', { class: 'mob-meta-item mob-meta-item--emphasis' }, `${t('playlistView.col_played')}: ${played}`),
            h('span', { class: 'mob-meta-item mob-meta-item--emphasis' }, [t('playlistView.col_rating') + ': ', dislikesBadge, ' ', likesBadge]),
          ]
          if (row.shared) metaItems.push(h('span', { class: 'mob-meta-item' }, [h(NIcon, { size: 14, color: 'var(--vt-c-primary)' }, { default: () => h(ShareSocialOutline) })]))
          if (row.description) metaItems.push(h('span', { class: 'mob-meta-item mob-desc' }, row.description))
          const row3 = h('div', { class: 'mob-r3' }, metaItems)

          return h('div', { class: 'mob-card' }, [row1, row2, row3].filter(Boolean))
        },
      },
    ]
  }

  return [
  { type: 'selection', multiple: true },
  {
    title: t('playlistView.col_title'),
    key: 'title',
    minWidth: 160,
    ellipsis: { tooltip: true },
    render: (row) => row.title || '-',
  },
  {
    title: t('playlistView.col_artist'),
    key: 'artist',
    minWidth: 120,
    ellipsis: { tooltip: true },
    render: (row) => row.artist || '-',
  },
  {
    key: 'play',
    width: 40,
    title: '',
    render: (row) => {
      const isRowPlaying = audioPlayer.isTrackPlaying(row.slugName)
      const isRowLoading = audioPlayer.isTrackLoading(row.slugName)
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
    title: t('playlistView.col_genres'), key: 'genres', width: 140,
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
    title: t('playlistView.col_labels'), key: 'labels', width: 120,
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
    title: t('playlistView.col_rating'), key: 'rating', width: 100,
    sorter: true,
    sortOrder: sortBy.value === 'RATE' ? (sortDesc.value ? 'descend' : 'ascend') : false,
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
    title: t('playlistView.col_played'), key: 'playedCount', width: 96,
    sorter: true,
    sortOrder: sortBy.value === 'PLAYED' ? (sortDesc.value ? 'descend' : 'ascend') : false,
    render: (row) => playedLabel(row),
  },
  {
    title: '',
    key: 'shared',
    width: 56,
    align: 'center',
    render: (row) => row.shared
      ? h(NIcon, { size: 18, color: 'var(--vt-c-primary)' }, { default: () => h(ShareSocialOutline) })
      : null,
  },
]
})

function buildPlaylistFilters() {
  const filters: {
    searchTerm?: string
    sortBy?: PlaylistSortBy
    sortDesc?: boolean
    unassigned?: boolean
  } = {}
  if (searchTerm.value) filters.searchTerm = searchTerm.value
  if (sortBy.value) {
    filters.sortBy = sortBy.value
    filters.sortDesc = sortDesc.value
  }
  if (unassignedOnly.value) filters.unassigned = true
  return filters
}

function handleSorterChange(sorter: DataTableSortState | DataTableSortState[] | null) {
  const state = Array.isArray(sorter) ? sorter[0] : sorter
  const mapped = state?.columnKey != null ? COLUMN_SORT_MAP[String(state.columnKey)] : undefined
  if (!state?.order || !mapped) {
    sortBy.value = null
    sortDesc.value = true
  } else {
    sortBy.value = mapped
    sortDesc.value = state.order === 'descend'
  }
  syncSortToQuery()
  resetPage()
  void fetchData(1)
}

async function fetchData(page = pageNum.value, size = pageSize.value) {
  loading.value = true
  try {
    const result = await datanestApiService.getBrandPlaylist(
      unassignedOnly.value ? null : selectedBrand.value || null, page, size,
      buildPlaylistFilters()
    )
    entries.value = result.entries
    actions.value = result.actions ?? []
    totalCount.value = result.count
    pageNum.value = result.pageNum
    pageSize.value = result.pageSize
    syncToQuery()
  } catch (e: any) {
    handleApiError(e, message)
  } finally {
    loading.value = false
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

let searchTimer: ReturnType<typeof setTimeout> | null = null
function onSearchChange() {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    resetPage()
    void fetchData(1)
  }, 400)
}

watch([selectedBrand, unassignedOnly], () => {
  loadDictionaries()
  void fetchData()
}, { immediate: true })
watch(showBulkUpload, (isOpen, wasOpen) => {
  if (wasOpen && !isOpen) fetchData()
})
</script>

<template>
  <div>
    <PageHeader :title="t('menu.playlist')" :subtitle="t('playlistView.subtitle')" :count="totalCount" />
    <ActionBar>
      <div class="playlist-action-row">
        <div class="gsap-row" style="padding-left:0;flex-wrap:wrap">
          <GsapButton type="primary" :look-disabled="!canCreate" @click="onAddTrack">
            <span>{{ t('playlistView.new_track') }}</span>
          </GsapButton>
          <GsapButton :disabled="!selectedBrand" @click="showBulkUpload = true"><span>{{ t('playlistView.bulk_upload') }}</span></GsapButton>
          <GsapButton :disabled="selectedIds.length === 0" @click="openShareBulk">
            <span>{{ t('playlistView.share_btn', { count: selectedIds.length }) }}</span>
          </GsapButton>
          <NPopconfirm @positive-click="handleBulkDelete" :disabled="!canDelete || selectedIds.length === 0">
            <template #trigger>
              <GsapButton type="error" :disabled="!canDelete || selectedIds.length === 0">
                <span>{{ t('playlistView.delete_btn', { count: selectedIds.length }) }}</span>
              </GsapButton>
            </template>
            {{ t('playlistView.delete_confirm', { count: selectedIds.length }) }}
          </NPopconfirm>
          <NButton quaternary circle size="small" style="opacity:0.5" @click="fetchData()">
            <template #icon><NIcon :component="RefreshOutline" /></template>
          </NButton>
          <span v-show="showCreateNotice && createNotice" ref="createNoticeEl" class="entitlement-notice">{{ createNotice }}</span>
        </div>
        <div class="playlist-filters">
          <NSelect
            :value="brandFilterValue"
            :options="brandOptions"
            filterable
            :placeholder="t('menu.my_brands')"
            style="width: 200px"
            @update:value="onBrandFilter"
          />
          <NInput
            v-model:value="searchTerm"
            :placeholder="t('playlistView.search')"
            clearable
            style="width: 220px"
            @update:value="onSearchChange"
          />
        </div>
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
    <div ref="tableWrapRef" class="data-table-wrap">
      <NDataTable
        :class="{ 'n-data-table--stacked-rows': stackedRows }"
        :columns="columns"
        :data="entries"
        :loading="loading"
        :row-key="(row: any) => row.slugName"
        v-model:checked-row-keys="selectedIds"
        :pagination="pagination"
        remote
        :row-props="(row: any) => ({
          style: stackedRows ? 'cursor:pointer' : 'cursor:pointer;height:48px',
          onClick: (e: MouseEvent) => { if ((e.target as HTMLElement).closest('.n-data-table-td--selection')) return; router.push({ path: editTrackPath(row.slugName), query: { returnTo: route.fullPath } }) }
        })"
        @update:page="(p) => { setPage(p); fetchData(p) }"
        @update:page-size="(s) => { setPageSize(s); fetchData(1, s) }"
        @update:sorter="handleSorterChange"
      >
        <template #loading><GsapLoader :size="32" /></template>
      </NDataTable>
    </div>
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
.data-table-wrap .n-data-table-sorter {
  color: var(--n-th-icon-color);
  opacity: 0.55;
  transition: color 0.15s ease, opacity 0.15s ease, transform 0.15s ease;
}
.data-table-wrap .n-data-table-sorter.n-data-table-sorter--asc,
.data-table-wrap .n-data-table-sorter.n-data-table-sorter--desc {
  color: var(--vt-c-primary);
  opacity: 1;
  transform: scale(1.35);
}
.data-table-wrap .n-data-table-th--sorting .n-data-table-th__title {
  color: var(--vt-c-primary);
}

.playlist-filters {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
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
  .playlist-action-row .n-input,
  .playlist-action-row .n-select {
    width: 100% !important;
  }
}
</style>
