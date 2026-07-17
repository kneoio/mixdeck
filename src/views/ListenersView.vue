<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import {
  NDataTable, NPopconfirm, NButton, NIcon, useMessage, type DataTableColumns
} from 'naive-ui'
import { useBrandsStore } from '@/stores/brands'
import { useListenersStore } from '@/stores/listeners'
import { RefreshOutline } from '@vicons/ionicons5'
import datanestApiService from '@/services/datanestApi'
import PageHeader from '@/components/PageHeader.vue'
import ActionBar from '@/components/ActionBar.vue'
import GsapButton from '@/components/GsapButton.vue'
import GsapSpin from '@/components/GsapSpin.vue'
import { handleApiError } from '@/utils/notificationService'

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
    await fetchData(1)
  } catch (e: any) {
    handleApiError(e, message)
  } finally {
    deleting.value = false
  }
}

// Fetch when slugName becomes available (brand loaded from store)
watch(slugName, (val) => { if (val) fetchData(1) }, { immediate: true })
</script>

<template>
  <div>
    <PageHeader :title="brandName" :subtitle="t('listenersView.subtitle')" :count="totalCount" />
    <ActionBar>
      <div class="gsap-row">
        <GsapButton type="primary" @click="router.push(`/brands/${route.params.id}/listeners/new`)">
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
    </ActionBar>
    <GsapSpin :show="loading">
      <NDataTable
        :columns="columns"
        :data="entries"
        :row-key="(row: any) => row.id || row.listener?.id"
        v-model:checked-row-keys="selectedIds"
        :pagination="pagination"
        remote
        :row-props="(row: any) => ({ style: 'cursor:pointer', onClick: (e: MouseEvent) => { if ((e.target as HTMLElement).closest('.n-data-table-td--selection')) return; router.push(`/brands/${route.params.id}/listeners/${row.id || row.listener?.id}`) } })"
        @update:page="(p) => { pageNum = p; fetchData(p) }"
        @update:page-size="(s) => { pageSize = s; fetchData(1, s) }"
      />
    </GsapSpin>
  </div>
</template>
