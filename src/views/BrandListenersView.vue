<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  NDataTable, NButton, NSpace, NPopconfirm, type DataTableColumns
} from 'naive-ui'
import { useMessage } from 'naive-ui'
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
const maxPage = ref(1)
const selectedIds = ref<string[]>([])

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

const columns: DataTableColumns<any> = [
  { type: 'selection', multiple: true },
  {
    title: 'Name', key: 'name', minWidth: 160,
    render: (row) => row.listener?.localizedName?.en || row.listener?.localizedName?.ru || '-'
  },
  {
    title: 'Nickname', key: 'nickname', minWidth: 140,
    render: (row) => {
      const nn = row.listener?.nickName ?? row.listener?.nickname
      if (!nn) return '-'
      if (typeof nn === 'string') return nn
      const vals = Object.values(nn as Record<string, any>)
      const first = vals[0]
      return Array.isArray(first) ? first.join(', ') : String(first ?? '-')
    }
  },
  {
    title: 'Type', key: 'listenerType', width: 130,
    render: (row) => row.listenerType || row.listener?.listenerType || '-'
  },
  {
    title: 'User Data', key: 'userData', minWidth: 200,
    render: (row) => {
      const ud = row.listener?.userData
      if (!ud || typeof ud !== 'object') return '-'
      const entries = Object.entries(ud).slice(0, 4).map(([k, v]) => `${k}: ${v}`)
      return entries.join(', ') || '-'
    }
  },
  {
    title: 'Registered', key: 'regDate', width: 160,
    render: (row) => row.listener?.regDate || '-'
  },
]

async function fetchData(page = pageNum.value, size = pageSize.value) {
  if (!slugName.value) return
  loading.value = true
  try {
    const result = await datanestApiService.getBrandListeners(slugName.value, page, size)
    entries.value = result.entries
    totalCount.value = result.count
    pageNum.value = result.pageNum
    pageSize.value = result.pageSize
    maxPage.value = result.maxPage
  } catch (e: any) {
    message.error(e?.message || 'Failed to load listeners')
  } finally {
    loading.value = false
  }
}

async function handleBulkDelete() {
  try {
    loading.value = true
    await Promise.all(selectedIds.value.map(id => datanestApiService.deleteBrandListener(id)))
    message.success(`Deleted ${selectedIds.value.length} listener(s)`)
    selectedIds.value = []
    await fetchData()
  } catch (e: any) {
    message.error(e?.message || 'Failed to delete')
  } finally {
    loading.value = false
  }
}

// Fetch when slugName becomes available (brand loaded from store)
watch(slugName, (val) => { if (val) fetchData(1) }, { immediate: true })
</script>

<template>
  <div>
    <PageHeader :title="brandName" subtitle="Listeners" :count="totalCount" />
    <ActionBar>
      <NSpace>
        <NButton type="primary" @click="router.push(`/brands/${route.params.id}/listeners/new`)">
          New Listener
        </NButton>
        <NPopconfirm @positive-click="handleBulkDelete" :disabled="selectedIds.length === 0">
          <template #trigger>
            <NButton type="error" :disabled="selectedIds.length === 0">
              Delete ({{ selectedIds.length }})
            </NButton>
          </template>
          Delete {{ selectedIds.length }} listener(s)?
        </NPopconfirm>
      </NSpace>
    </ActionBar>
    <NDataTable
      :columns="columns"
      :data="entries"
      :loading="loading"
      :row-key="(row: any) => row.id || row.listener?.id"
      v-model:checked-row-keys="selectedIds"
      :pagination="pagination"
      remote
      :row-props="(row: any) => ({ style: 'cursor:pointer', onClick: () => router.push(`/brands/${route.params.id}/listeners/${row.id || row.listener?.id}`) })"
      @update:page="(p) => { pageNum = p; fetchData(p) }"
      @update:page-size="(s) => { pageSize = s; fetchData(1, s) }"
    />
  </div>
</template>
