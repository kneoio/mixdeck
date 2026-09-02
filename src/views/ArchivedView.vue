<script setup lang="ts">
import { ref, computed, h, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter, useRoute } from 'vue-router'
import {
  NDataTable, NSpace, NPopconfirm, NTag, NButton, NIcon, NInput,
  type DataTableColumns, useMessage
} from 'naive-ui'
import { RefreshOutline } from '@vicons/ionicons5'
import datanestApiService from '@/services/datanestApi'
import { useDictionaryStore } from '@/stores/dictionary'
import PageHeader from '@/components/PageHeader.vue'
import ActionBar from '@/components/ActionBar.vue'
import GsapButton from '@/components/GsapButton.vue'
import GsapLoader from '@/components/GsapLoader.vue'
import ShareToBrandsDialog from '@/components/forms/ShareToBrandsDialog.vue'
import { handleApiError } from '@/utils/notificationService'
import { hasAction } from '@/utils/entitlements'
import { useStackedDataTable } from '@/composables/useStackedDataTable'
import { useRoutePagination } from '@/composables/useRoutePagination'
import { useSoundFragmentsStore } from '@/stores/soundFragments'

const { stackedRows, tableWrapRef } = useStackedDataTable()

const { t } = useI18n()
const message = useMessage()
const router = useRouter()
const route = useRoute()
const dictionaryStore = useDictionaryStore()
const soundFragmentsStore = useSoundFragmentsStore()

const entries = ref<any[]>([])
const loading = ref(true)
const totalCount = ref(0)
const { pageNum, pageSize, setPage, setPageSize, resetPage, syncToQuery } = useRoutePagination()
const selectedIds = ref<string[]>([])
const showShareDialog = ref(false)
const shareFragmentIds = ref<string[]>([])
const searchTerm = ref('')
const canCreate = computed(() => hasAction(soundFragmentsStore.actions, 'create'))
const canDelete = computed(() => hasAction(soundFragmentsStore.actions, 'delete'))

function openShareBulk() {
  if (selectedIds.value.length === 0) return
  shareFragmentIds.value = [...selectedIds.value]
  showShareDialog.value = true
}

function onShareDialogDone() {
  selectedIds.value = []
  void fetchData()
}

const genreMap = ref<Map<string, { name: string; color?: string; fontColor?: string }>>(new Map())
const labelMap = ref<Map<string, { name: string; color?: string; fontColor?: string }>>(new Map())

const pageTitle = computed(() => `${t('menu.my_sounds')} / ${t('menu.unassigned_brands')}`)

const pagination = computed(() => ({
  page: pageNum.value,
  pageSize: pageSize.value,
  pageSizes: [10, 20, 50],
  showSizePicker: true,
  itemCount: totalCount.value,
}))

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

const columns = computed<DataTableColumns<any>>(() => {
  if (stackedRows.value) {
    return [
      { type: 'selection', multiple: true },
      {
        key: 'stacked',
        title: '',
        render: (row) => {
          const row1 = h('div', { class: 'mob-r1' }, [
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
          return h('div', { class: 'mob-card' }, [row1, row2].filter(Boolean))
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
    const result = await soundFragmentsStore.loadUnassigned(page, size, searchTerm.value)
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
    await Promise.all(selectedIds.value.map(id => datanestApiService.revokeSoundFragmentAccess(id)))
    message.success(t('playlistView.deleted', { count: selectedIds.value.length }))
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
          <GsapButton type="primary" :disabled="!canCreate" @click="router.push({ path: '/sound-library/archived/new', query: { returnTo: route.fullPath } })">
            <span>{{ t('playlistView.new_track') }}</span>
          </GsapButton>
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
        :row-key="(row: any) => row.slugName"
        v-model:checked-row-keys="selectedIds"
        :pagination="pagination"
        remote
        :row-props="(row: any) => ({
          style: stackedRows ? 'cursor:pointer' : 'cursor:pointer',
          onClick: (e: MouseEvent) => {
            if ((e.target as HTMLElement).closest('.n-data-table-td--selection')) return
            router.push({ path: `/sound-library/archived/${row.slugName}`, query: { returnTo: route.fullPath } })
          }
        })"
        @update:page="(p) => { setPage(p); fetchData(p) }"
        @update:page-size="(s) => { setPageSize(s); fetchData(1, s) }"
      >
        <template #loading><GsapLoader :size="32" /></template>
      </NDataTable>
    </div>
    <ShareToBrandsDialog
      v-model:show="showShareDialog"
      :fragment-ids="shareFragmentIds"
      @shared="onShareDialogDone"
    />
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
