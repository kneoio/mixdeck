<script setup lang="ts">
import { onMounted, computed, ref } from 'vue'
import { NDataTable, NButton, NSpace, NPopconfirm, NTag, type DataTableColumns } from 'naive-ui'
import { h } from 'vue'
import PageHeader from '@/components/PageHeader.vue'
import ActionBar from '@/components/ActionBar.vue'
import { useBrandsStore, type Brand } from '@/stores/brands'
import { useRouter } from 'vue-router'
import CopyJsonButton from '@/components/CopyJsonButton.vue'

const store = useBrandsStore()
const router = useRouter()
const selectedIds = ref<string[]>([])

const pagination = computed(() => ({
  page: store.pageNum, pageSize: store.pageSize,
  pageSizes: [10, 20, 50], showSizePicker: true, itemCount: store.totalCount,
}))

const statusType: Record<string, 'default' | 'success' | 'warning' | 'error' | 'info'> = {
  ON_LINE: 'success', OFF_LINE: 'default', WARMING_UP: 'warning',
  QUEUE_SATURATED: 'info', IDLE: 'default', SYSTEM_ERROR: 'error',
}

const columns: DataTableColumns<Brand> = [
  { type: 'selection', multiple: true },
  {
    title: 'Name', key: 'localizedName', minWidth: 150,
    render: (row) => row.localizedName?.['en'] || row.title || row.slugName || '-'
  },
  {
    title: 'Status', key: 'status', width: 130,
    render: (row) => row.status
      ? h(NTag, { size: 'small', type: statusType[row.status] || 'default' }, { default: () => row.status })
      : '-'
  },
  { title: 'Country', key: 'country', width: 90, render: (row) => row.country || '-' },
  { title: 'Managed By', key: 'managedBy', width: 120, render: (row) => (row as any).managedBy || '-' },
  { title: 'Slug', key: 'slugName', minWidth: 120, render: (row) => row.slugName || '-' },
  { title: 'Author', key: 'author', minWidth: 100 },
  { title: 'Last Modified', key: 'lastModifiedDate', width: 160, render: (row) => row.lastModifiedDate || '-' },
]

async function handleBulkDelete() {
  for (const id of selectedIds.value) await store.deleteBrand(id)
  selectedIds.value = []
  store.loadBrands()
}

onMounted(() => store.loadBrands())
</script>

<template>
  <div>
    <PageHeader title="Brands" subtitle="Manage radio stations / brands" :count="store.totalCount" />
    <ActionBar>
      <NSpace>
        <NButton type="primary" @click="router.push('/brands/new')">Add</NButton>
        <NPopconfirm @positive-click="handleBulkDelete" :disabled="selectedIds.length === 0">
          <template #trigger>
            <NButton type="error" :disabled="selectedIds.length === 0">Delete</NButton>
          </template>
          Delete {{ selectedIds.length }} brand(s)?
        </NPopconfirm>
        <CopyJsonButton :data="store.brands" />
      </NSpace>
    </ActionBar>
    <NDataTable
      :columns="columns"
      :data="store.brands"
      :loading="store.loading"
      :row-key="(row: Brand) => row.id"
      v-model:checked-row-keys="selectedIds"
      :pagination="pagination"
      remote
      @update:page="(p) => { store.pageNum = p; store.loadBrands() }"
      @update:page-size="(s) => { store.pageSize = s; store.loadBrands() }"
      :row-props="(row: Brand) => ({
        style: 'cursor:pointer',
        onClick: (e: MouseEvent) => {
          const t = e.target as HTMLElement
          if (t.closest('.n-data-table-td--selection') || t.closest('.n-checkbox')) return
          router.push(`/brands/${row.id}/dashboard`)
        }
      })"
    />
  </div>
</template>
