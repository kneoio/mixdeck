<script setup lang="ts">
import { ref, computed, h, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import {
  NDataTable, NSpace, NPopconfirm, NTag, NButton, NIcon,
  type DataTableColumns, useMessage
} from 'naive-ui'
import { RefreshOutline, ArrowUpOutline, ArrowDownOutline } from '@vicons/ionicons5'
import LedIndicator from '@/components/LedIndicator.vue'
import datanestApiService from '@/services/datanestApi'
import { useDictionaryStore, type GenreEntry } from '@/stores/dictionary'
import PageHeader from '@/components/PageHeader.vue'
import ActionBar from '@/components/ActionBar.vue'
import GsapButton from '@/components/GsapButton.vue'
import { handleApiError } from '@/utils/notificationService'

const { t } = useI18n()
const message = useMessage()
const router = useRouter()
const dictionaryStore = useDictionaryStore()

const entries = ref<any[]>([])
const loading = ref(false)
const totalCount = ref(0)
const pageNum = ref(1)
const pageSize = ref(10)
const selectedIds = ref<string[]>([])
const boostingId = ref<string | null>(null)

async function changeBoost(row: any, delta: number, e: MouseEvent) {
  e.stopPropagation()
  const cur = row.boost ?? 0
  const next = Math.min(2, Math.max(-1, cur + delta))
  if (next === cur) return
  boostingId.value = row.id
  try {
    await datanestApiService.patchSoundFragmentBoost(row.id, row.id, next, 'shared')
    row.boost = next
  } catch (err: any) {
    handleApiError(err, message)
  } finally {
    boostingId.value = null
  }
}

const isMobile = ref(false)
let mobileMql: MediaQueryList | null = null
function syncMobile() { isMobile.value = mobileMql?.matches ?? false }

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
  genreMap.value = new Map(flattenGenres(dictionaryStore.genres).map(g => [g.id, {
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

const columns = computed<DataTableColumns<any>>(() => {
  if (isMobile.value) {
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

          const row3 = row.sharerUserName
            ? h('div', { class: 'mob-r3' }, [h('span', { class: 'mob-meta-item' }, `${t('profile.sharer')}: ${row.sharerUserName}`)])
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
      render: (row) => {
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
  ]
})

async function fetchData(page = pageNum.value, size = pageSize.value) {
  loading.value = true
  try {
    const result = await datanestApiService.getReceived(page, size)
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

async function handleBulkDelete() {
  try {
    loading.value = true
    await Promise.all(selectedIds.value.map(id => datanestApiService.rejectReceivedSoundFragment(id)))
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
  mobileMql = window.matchMedia('(max-width: 640px)')
  isMobile.value = mobileMql.matches
  mobileMql.addEventListener('change', syncMobile)
  await loadDictionaries()
  await fetchData(1)
})

onUnmounted(() => {
  mobileMql?.removeEventListener('change', syncMobile)
  mobileMql = null
})
</script>

<template>
  <div>
    <PageHeader :title="pageTitle" :subtitle="t('playlistView.subtitle')" :count="totalCount" />
    <ActionBar>
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
    </ActionBar>
    <NDataTable
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
          router.push(`/sound-library/received/${row.id}`)
        }
      })"
      @update:page="(p) => { pageNum = p; fetchData(p) }"
      @update:page-size="(s) => { pageSize = s; fetchData(1, s) }"
    />
  </div>
</template>
