<script setup lang="ts">
import { ref, computed, h, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter, useRoute } from 'vue-router'
import {
  NDataTable, NSpace, NPopconfirm, NTag, NButton, NIcon, NInput,
  type DataTableColumns, useMessage
} from 'naive-ui'
import { RefreshOutline, ArrowUpOutline, ArrowDownOutline } from '@vicons/ionicons5'
import LedIndicator from '@/components/LedIndicator.vue'
import datanestApiService from '@/services/datanestApi'
import { useDictionaryStore, type GenreEntry } from '@/stores/dictionary'
import PageHeader from '@/components/PageHeader.vue'
import ActionBar from '@/components/ActionBar.vue'
import GsapButton from '@/components/GsapButton.vue'
import GsapLoader from '@/components/GsapLoader.vue'
import { handleApiError } from '@/utils/notificationService'
import { useStackedDataTable } from '@/composables/useStackedDataTable'
import { useRoutePagination } from '@/composables/useRoutePagination'

const { stackedRows, tableWrapRef } = useStackedDataTable()

const { t } = useI18n()
const message = useMessage()
const router = useRouter()
const route = useRoute()
const dictionaryStore = useDictionaryStore()

const entries = ref<any[]>([])
const loading = ref(true)
const totalCount = ref(0)
const { pageNum, pageSize, setPage, setPageSize, resetPage, syncToQuery } = useRoutePagination()
const selectedIds = ref<string[]>([])
const boostingId = ref<string | null>(null)
const searchTerm = ref('')

async function changeBoost(row: any, delta: number, e: MouseEvent) {
  e.stopPropagation()
  const cur = row.boost ?? 0
  const next = Math.min(2, Math.max(-1, cur + delta))
  if (next === cur) return
  boostingId.value = row.id
  try {
    await datanestApiService.patchSoundFragmentBoost(row.slugName, row.targetBrandId, next, 'shared')
    row.boost = next
  } catch (err: any) {
    handleApiError(err, message)
  } finally {
    boostingId.value = null
  }
}


const genreMap = ref<Map<string, { name: string; color?: string; fontColor?: string }>>(new Map())
const labelMap = ref<Map<string, { name: string; color?: string; fontColor?: string }>>(new Map())

const pageTitle = computed(() => `${t('menu.my_sounds')} / ${t('menu.received')}`)

const pagination = computed(() => ({
  page: pageNum.value,
  pageSize: pageSize.value,
  pageSizes: [10, 20, 50],
  showSizePicker: true,
  itemCount: totalCount.value,
}))

function flattenGenres(genres: GenreEntry[]): GenreEntry[] {
  return genres.flatMap(g => [g, ...(g.children?.length ? flattenGenres(g.children) : [])])
}

async function loadDictionaries() {
  await Promise.all([
    dictionaryStore.loadGenres(),
    dictionaryStore.loadSoundFragmentLabels(),
  ])
  genreMap.value = new Map(flattenGenres(dictionaryStore.genres).map(g => [g.identifier, {
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

// One status enum for everything shown here (station shares and artist contributions are both
// created as a share — see datanest's SHARING_WORKFLOW.md / CONTRIBUTION_WORKFLOW.md):
// 506=PENDING, 500=ACCEPTED, 501=REJECTED.
function isRejectedRow(row: any): boolean {
  return row.status === 501
}

function statusTag(row: any) {
  if (row.status === 506) return { text: t('playlistView.status_pending'), type: 'warning' as const }
  if (isRejectedRow(row)) return { text: t('playlistView.status_rejected'), type: 'error' as const }
  return { text: t('playlistView.status_accepted'), type: 'success' as const }
}

function renderBoostControls(row: any) {
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
  return h('span', {
    style: 'display:flex;align-items:center;gap:3px',
    onMousedown: (e: MouseEvent) => e.stopPropagation(),
    onClick: (e: MouseEvent) => e.stopPropagation(),
  }, [upBtn, leds, downBtn])
}

const columns = computed<DataTableColumns<any>>(() => {
  if (stackedRows.value) {
    return [
      { type: 'selection', multiple: true },
      {
        key: 'mob',
        title: '',
        render: (row) => {
          const statusInfo = statusTag(row)
          const row1 = h('div', { class: 'mob-r1' }, [
            h('span', { class: 'mob-title' }, row.title || '-'),
            h('span', { class: 'mob-sep' }, '—'),
            h('span', { class: 'mob-artist' }, row.artist || '-'),
            h(NTag, { size: 'small', type: statusInfo.type }, { default: () => statusInfo.text }),
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

          const row3Items: any[] = []
          if (row.sharerUserName) {
            row3Items.push(h('span', { class: 'mob-meta-item' }, `${t('profile.sharer')}: ${row.sharerUserName}`))
          }
          row3Items.push(h('span', { class: 'mob-meta-item mob-meta-item--emphasis' }, ['Boost: ', renderBoostControls(row)]))
          const row3 = row3Items.length
            ? h('div', { class: 'mob-r3' }, row3Items)
            : null

          return h('div', { class: 'mob-card', style: isRejectedRow(row) ? 'opacity:0.45' : '' }, [row1, row2, row3].filter(Boolean))
        },
      },
    ]
  }

  return [
    { type: 'selection', multiple: true },
    { title: t('playlistView.col_title'), key: 'title', minWidth: 200, render: (row) => row.title || '-' },
    { title: t('playlistView.col_artist'), key: 'artist', minWidth: 160, render: (row) => row.artist || '-' },
    {
      title: t('playlistView.col_genres'), key: 'genres', width: 180,
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
      title: t('playlistView.col_labels'), key: 'labels', width: 180,
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
      title: t('playlistView.col_target'), key: 'targetBrandName', minWidth: 140,
      render: (row) => row.targetBrandName?.en || Object.values(row.targetBrandName || {})[0] || '-'
    },
    {
      title: t('playlistView.col_status'), key: 'status', width: 120,
      render: (row) => {
        const tag = statusTag(row)
        return h(NTag, { size: 'small', type: tag.type }, { default: () => tag.text })
      }
    },
    { title: t('profile.sharer'), key: 'sharerUserName', minWidth: 160, render: (row) => row.sharerUserName || '-' },
    {
      key: 'boost',
      width: 110,
      title: 'Boost',
      render: (row) => renderBoostControls(row),
    },
  ]
})

let searchTimer: ReturnType<typeof setTimeout> | null = null
function onSearchChange() {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    resetPage()
    void fetchData(1)
  }, 400)
}

async function fetchData(page = pageNum.value, size = pageSize.value) {
  loading.value = true
  try {
    const result = await datanestApiService.getReceived(page, size, searchTerm.value)
    entries.value = result.entries
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
    // Rejected rows are already dimmed in this list (see isRejectedRow) - clicking remove on one
    // of those permanently deletes it; on anything else it just rejects it (row stays, dims).
    await Promise.all(selectedIds.value.map(id => {
      const row = entries.value.find(e => e.id === id)
      return isRejectedRow(row)
        ? datanestApiService.deleteReceivedSoundFragment(id)
        : datanestApiService.rejectReceivedSoundFragment(id)
    }))
    message.success(t('playlistView.received_removed', { count: selectedIds.value.length }))
    selectedIds.value = []
    await fetchData()
  } catch (e: any) {
    handleApiError(e, message)
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  await loadDictionaries()
  await fetchData()
})
</script>

<template>
  <div>
    <PageHeader :title="pageTitle" :subtitle="t('playlistView.subtitle')" :count="totalCount" />
    <ActionBar>
      <div class="playlist-action-row">
        <NSpace>
          <NPopconfirm @positive-click="handleBulkDelete" :disabled="selectedIds.length === 0">
            <template #trigger>
              <GsapButton type="error" :disabled="selectedIds.length === 0">
                <span>{{ t('playlistView.received_remove_btn', { count: selectedIds.length }) }}</span>
              </GsapButton>
            </template>
            {{ t('playlistView.received_remove_confirm', { count: selectedIds.length }) }}
          </NPopconfirm>
          <NButton quaternary circle size="small" style="opacity:0.5" @click="fetchData()">
            <template #icon><NIcon :component="RefreshOutline" /></template>
          </NButton>
        </NSpace>
        <NInput
          v-model:value="searchTerm"
          :placeholder="t('playlistView.search')"
          clearable
          style="width: 220px"
          @update:value="onSearchChange"
        />
      </div>
    </ActionBar>
    <div ref="tableWrapRef" class="data-table-wrap">
      <NDataTable
        :class="{ 'n-data-table--stacked-rows': stackedRows }"
        :columns="columns"
        :data="entries"
        :loading="loading"
        :row-key="(row: any) => row.id || row.slugName"
        v-model:checked-row-keys="selectedIds"
        :pagination="pagination"
        remote
        :row-props="(row: any) => ({
          style: isRejectedRow(row) ? 'cursor:pointer;opacity:0.45' : 'cursor:pointer',
          onClick: (e: MouseEvent) => {
            if ((e.target as HTMLElement).closest('.n-data-table-td--selection')) return
            router.push({ path: `/sound-library/received/${row.id}`, query: { returnTo: route.fullPath } })
          }
        })"
        @update:page="(p) => { setPage(p); fetchData(p) }"
        @update:page-size="(s) => { setPageSize(s); fetchData(1, s) }"
      >
        <template #loading><GsapLoader :size="32" /></template>
      </NDataTable>
    </div>
  </div>
</template>

<style>
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
