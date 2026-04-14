<script setup lang="ts">
import { ref, computed, watch, h } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  NDataTable, NButton, NSpace, NPopconfirm, NInput, NTag,
  type DataTableColumns, useMessage
} from 'naive-ui'
import { useBrandsStore } from '@/stores/brands'
import datanestApiService from '@/services/datanestApi'
import PageHeader from '@/components/PageHeader.vue'
import ActionBar from '@/components/ActionBar.vue'

const route = useRoute()
const router = useRouter()
const brandsStore = useBrandsStore()
const message = useMessage()

const entries = ref<any[]>([])
const loading = ref(false)
const totalCount = ref(0)
const pageNum = ref(1)
const pageSize = ref(10)
const selectedIds = ref<string[]>([])
const searchTerm = ref('')

const brand = computed(() => brandsStore.brands.find(b => b.id === route.params.id))
const slugName = computed(() => brand.value?.slugName ?? '')
const brandName = computed(() =>
  brand.value?.localizedName?.['en'] || brand.value?.title || brand.value?.slugName || (route.params.id as string)
)

const pagination = computed(() => ({
  page: pageNum.value,
  pageSize: pageSize.value,
  pageSizes: [10, 20, 50],
  showSizePicker: true,
  itemCount: totalCount.value,
}))

const columns = computed<DataTableColumns<any>>(() => [
  { type: 'selection', multiple: true },
  { title: 'Title', key: 'title', minWidth: 200, render: (row) => row.title || '-' },
  { title: 'Artist', key: 'artist', minWidth: 160, render: (row) => row.artist || '-' },
  {
    title: 'Genres', key: 'genres', width: 180,
    render: (row) => {
      if (!row.genres?.length) return '-'
      return h(NSpace, { size: 4, wrap: true }, {
        default: () => row.genres.map((g: any) =>
          h(NTag, {
            size: 'small',
            style: g.color ? `background:${g.color};color:${g.fontColor || '#fff'}` : ''
          }, { default: () => g.identifier || g })
        )
      })
    }
  },
  {
    title: 'Labels', key: 'labels', width: 180,
    render: (row) => {
      if (!row.labels?.length) return '-'
      return h(NSpace, { size: 4, wrap: true }, {
        default: () => row.labels.map((l: any) =>
          h(NTag, {
            size: 'small',
            style: l.color ? `background:${l.color};color:${l.fontColor || '#fff'}` : ''
          }, { default: () => l.identifier || l })
        )
      })
    }
  },
  { title: 'Source', key: 'source', width: 110, render: (row) => row.source || '-' },
  { title: 'Played', key: 'playedByBrandCount', width: 80, render: (row) => row.playedByBrandCount ?? 0 },
  {
    title: 'Rating', key: 'rating', width: 140,
    render: (row) => {
      const val = (row.ratedByBrandCount ?? 100) - 100
      return h(NSpace, { size: 4, align: 'center' }, {
        default: () => [
          h(NButton, {
            size: 'tiny', tertiary: true,
            onClick: (e: MouseEvent) => { e.stopPropagation(); rateTrack(row, 'DISLIKE') }
          }, { default: () => '−' }),
          h('span', { style: 'font-size:13px;min-width:28px;text-align:center' },
            val > 0 ? `+${val}` : String(val)),
          h(NButton, {
            size: 'tiny', tertiary: true,
            onClick: (e: MouseEvent) => { e.stopPropagation(); rateTrack(row, 'LIKE') }
          }, { default: () => '+' }),
        ]
      })
    }
  },
  { title: 'Description', key: 'description', minWidth: 160, ellipsis: { tooltip: true } },
])

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
    message.error(e?.message || 'Failed to load playlist')
  } finally {
    loading.value = false
  }
}

async function handleBulkDelete() {
  try {
    loading.value = true
    await Promise.all(selectedIds.value.map(id => datanestApiService.deleteSoundFragment(id)))
    message.success(`Deleted ${selectedIds.value.length} track(s)`)
    selectedIds.value = []
    await fetchData()
  } catch (e: any) {
    message.error(e?.message || 'Failed to delete')
  } finally {
    loading.value = false
  }
}

async function rateTrack(row: any, action: 'LIKE' | 'DISLIKE') {
  try {
    await datanestApiService.rateSoundFragment(row.id, slugName.value, action)
    await fetchData()
  } catch (e: any) {
    message.error(e?.message || 'Rating failed')
  }
}

let searchTimer: ReturnType<typeof setTimeout> | null = null
function onSearchChange() {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => fetchData(1), 400)
}

watch(slugName, (val) => { if (val) fetchData(1) }, { immediate: true })
</script>

<template>
  <div>
    <PageHeader :title="brandName" subtitle="Playlist" :count="totalCount" />
    <ActionBar>
      <NSpace>
        <NButton type="primary" @click="router.push(`/brands/${route.params.id}/playlist/new`)">
          New Track
        </NButton>
        <NInput
          v-model:value="searchTerm"
          placeholder="Search..."
          clearable
          style="width: 220px"
          @update:value="onSearchChange"
        />
        <NPopconfirm @positive-click="handleBulkDelete" :disabled="selectedIds.length === 0">
          <template #trigger>
            <NButton type="error" :disabled="selectedIds.length === 0">
              Delete ({{ selectedIds.length }})
            </NButton>
          </template>
          Delete {{ selectedIds.length }} track(s)?
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
      :row-props="(row: any) => ({ style: 'cursor:pointer', onClick: () => router.push(`/brands/${route.params.id}/playlist/${row.id}`) })"
      @update:page="(p) => { pageNum = p; fetchData(p) }"
      @update:page-size="(s) => { pageSize = s; fetchData(1, s) }"
    />
  </div>
</template>
