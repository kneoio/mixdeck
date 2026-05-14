<script setup lang="ts">
import { ref, computed, h, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import {
  NDataTable, NButton, NSpace, NPopconfirm, NTag,
  type DataTableColumns, useMessage
} from 'naive-ui'
import datanestApiService from '@/services/datanestApi'
import dictionaryApiService from '@/services/dictionaryApi'
import PageHeader from '@/components/PageHeader.vue'
import ActionBar from '@/components/ActionBar.vue'
import { handleApiError } from '@/utils/notificationService'

const { t } = useI18n()
const message = useMessage()
const router = useRouter()

const entries = ref<any[]>([])
const loading = ref(false)
const totalCount = ref(0)
const pageNum = ref(1)
const pageSize = ref(10)
const selectedIds = ref<string[]>([])

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

async function loadDictionaries() {
  const [genres, labels] = await Promise.allSettled([
    dictionaryApiService.getGenres(),
    dictionaryApiService.getLabelsByCategory('sound_fragment'),
  ])
  if (genres.status === 'fulfilled') {
    genreMap.value = new Map(genres.value.map(g => [g.id, {
      name: g.localizedName?.en || Object.values(g.localizedName || {})[0] || g.identifier || g.id,
      color: g.color,
      fontColor: g.fontColor,
    }]))
  }
  if (labels.status === 'fulfilled') {
    labelMap.value = new Map(labels.value.map(l => [l.id, {
      name: l.localizedName?.en || l.identifier || l.id,
      color: l.color,
      fontColor: l.fontColor,
    }]))
  }
}

function resolveGenre(g: any) {
  if (typeof g === 'string') return genreMap.value.get(g) ?? { name: g }
  return { name: g.identifier || g.id, color: g.color, fontColor: g.fontColor }
}

function resolveLabel(l: any) {
  if (typeof l === 'string') return labelMap.value.get(l) ?? { name: l }
  return { name: l.identifier || l.id, color: l.color, fontColor: l.fontColor }
}

const columns = computed<DataTableColumns<any>>(() => [
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
  { title: t('profile.sharer'), key: 'sharerUserName', minWidth: 160, render: (row) => row.sharerUserName || '-' },
])

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
  await loadDictionaries()
  await fetchData(1)
})
</script>

<template>
  <div>
    <PageHeader :title="pageTitle" :subtitle="t('playlistView.subtitle')" :count="totalCount" />
    <ActionBar>
      <NSpace>
        <NPopconfirm @positive-click="handleBulkDelete" :disabled="selectedIds.length === 0">
          <template #trigger>
            <NButton type="error" :disabled="selectedIds.length === 0">
              {{ t('playlistView.received_remove_btn', { count: selectedIds.length }) }}
            </NButton>
          </template>
          {{ t('playlistView.received_remove_confirm', { count: selectedIds.length }) }}
        </NPopconfirm>
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
        style: 'cursor:pointer',
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
