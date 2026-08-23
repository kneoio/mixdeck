<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import {
  NDataTable, NPopconfirm, NButton, NIcon, NSelect, useMessage, type DataTableColumns
} from 'naive-ui'
import { useBrandsStore } from '@/stores/brands'
import { useListenersStore } from '@/stores/listeners'
import { RefreshOutline } from '@vicons/ionicons5'
import datanestApiService from '@/services/datanestApi'
import PageHeader from '@/components/PageHeader.vue'
import ActionBar from '@/components/ActionBar.vue'
import GsapButton from '@/components/GsapButton.vue'
import GsapLoader from '@/components/GsapLoader.vue'
import { handleApiError } from '@/utils/notificationService'
import { useRoutePagination } from '@/composables/useRoutePagination'

const { t } = useI18n()

const route = useRoute()
const router = useRouter()
const brandsStore = useBrandsStore()
const listenersStore = useListenersStore()
const message = useMessage()
const deleting = ref(false)

const entries = ref<any[]>([])
const loading = ref(true)
const totalCount = ref(0)
const { pageNum, pageSize, setPage, setPageSize, syncToQuery } = useRoutePagination()
const maxPage = ref(1)
const selectedIds = ref<string[]>([])

const selectedBrand = computed(() => typeof route.query.brand === 'string' ? route.query.brand : '')
const slugName = computed(() => selectedBrand.value)
const brandOptions = computed(() => [
  { label: t('menu.filter_all_brands'), value: '', style: { fontWeight: 700 } },
  ...brandsStore.brands.map(b => ({
    label: b.localizedName?.['en'] || b.title || b.slugName || '',
    value: b.slugName as string,
  })),
])

function onBrandFilter(val: string | null) {
  const query = { ...route.query }
  if (val) query.brand = val
  else delete query.brand
  delete query.page
  pageNum.value = 1
  void router.replace({ query })
}

const newListenerPath = computed(() =>
  selectedBrand.value
    ? `/brands/${selectedBrand.value}/listeners/new`
    : '/listeners/new'
)
function editListenerPath(id: string) {
  return selectedBrand.value
    ? `/brands/${selectedBrand.value}/listeners/${id}`
    : `/listeners/${id}`
}

const pagination = computed(() => ({
  page: pageNum.value,
  pageSize: pageSize.value,
  pageSizes: [10, 20, 50],
  showSizePicker: true,
  itemCount: totalCount.value,
}))

const columns = computed<DataTableColumns<any>>(() => [
  { type: 'selection', multiple: true },
  {
    title: t('listenersView.col_name'), key: 'name', minWidth: 160,
    render: (row) => row.listener?.localizedName?.en || row.listener?.localizedName?.ru || '-'
  },
  {
    title: t('listenersView.col_user_data'), key: 'userData', minWidth: 200,
    render: (row) => {
      const ud = row.listener?.userData
      if (!ud || typeof ud !== 'object') return '-'
      const entries = Object.entries(ud).slice(0, 4).map(([k, v]) => `${k}: ${v}`)
      return entries.join(', ') || '-'
    }
  },
  {
    title: t('listenersView.col_registered'), key: 'regDate', width: 160,
    render: (row) => row.listener?.regDate || '-'
  },
])

async function fetchData(page = pageNum.value, size = pageSize.value) {
  loading.value = true
  try {
    const result = await datanestApiService.getBrandListeners(selectedBrand.value || null, page, size)
    entries.value = result.entries
    totalCount.value = result.count
    pageNum.value = result.pageNum
    pageSize.value = result.pageSize
    maxPage.value = result.maxPage
    syncToQuery()
  } catch (e: any) {
    handleApiError(e, message)
  } finally {
    loading.value = false
  }
}

async function handleDelete() {
  if (!selectedIds.value.length) return
  deleting.value = true
  try {
    await Promise.all(selectedIds.value.map(id => listenersStore.deleteListener(id)))
    message.success(t('listenersView.deleted', { count: selectedIds.value.length }))
    selectedIds.value = []
    await fetchData()
  } catch (e: any) {
    handleApiError(e, message)
  } finally {
    deleting.value = false
  }
}

// Fetch when slugName becomes available (brand loaded from store)
watch(selectedBrand, () => { void fetchData() }, { immediate: true })
</script>

<template>
  <div>
    <PageHeader :title="t('menu.listeners')" :subtitle="t('listenersView.subtitle')" :count="totalCount" />
    <ActionBar>
      <div class="listeners-action-row">
        <div class="gsap-row">
        <GsapButton type="primary" @click="router.push({ path: newListenerPath, query: { returnTo: route.fullPath } })">
          <span>{{ t('listenersView.new_listener') }}</span>
        </GsapButton>
        <NPopconfirm @positive-click="handleDelete">
          <template #trigger>
            <GsapButton type="error" :disabled="!selectedIds.length || deleting">
              <span>{{ t('listenersView.delete_btn', { count: selectedIds.length }) }}</span>
            </GsapButton>
          </template>
          {{ t('listenersView.delete_confirm', { count: selectedIds.length }) }}
        </NPopconfirm>
        <NButton quaternary circle size="small" style="opacity:0.5" @click="fetchData()">
          <template #icon><NIcon :component="RefreshOutline" /></template>
        </NButton>
        </div>
        <NSelect
          :value="selectedBrand"
          :options="brandOptions"
          filterable
          :placeholder="t('menu.my_brands')"
          style="width: 200px"
          @update:value="onBrandFilter"
        />
      </div>
    </ActionBar>
    <NDataTable
      :columns="columns"
      :data="entries"
      :loading="loading"
      :row-key="(row: any) => row.id || row.listener?.id"
      v-model:checked-row-keys="selectedIds"
      :pagination="pagination"
      remote
      :row-props="(row: any) => ({ style: 'cursor:pointer', onClick: (e: MouseEvent) => { if ((e.target as HTMLElement).closest('.n-data-table-td--selection')) return; router.push({ path: editListenerPath(row.id || row.listener?.id), query: { returnTo: route.fullPath } }) } })"
      @update:page="(p) => { setPage(p); fetchData(p) }"
      @update:page-size="(s) => { setPageSize(s); fetchData(1, s) }"
    >
      <template #loading><GsapLoader :size="32" /></template>
    </NDataTable>
  </div>
</template>

<style>
.listeners-action-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}
</style>
