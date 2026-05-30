<script setup lang="ts">
import { ref, computed, h, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { NDataTable, NTag, type DataTableColumns } from 'naive-ui'
import { useMessage } from 'naive-ui'
import datanestApiService from '@/services/datanestApi'
import PageHeader from '@/components/PageHeader.vue'
import { handleApiError } from '@/utils/notificationService'

const { t } = useI18n()
const message = useMessage()

const entries = ref<any[]>([])
const loading = ref(false)
const totalCount = ref(0)
const pageNum = ref(1)
const pageSize = ref(10)

const pageTitle = computed(() => `${t('menu.my_sounds')} / ${t('menu.sound_assets')}`)

const pagination = computed(() => ({
  page: pageNum.value,
  pageSize: pageSize.value,
  pageSizes: [10, 20, 50],
  showSizePicker: true,
  itemCount: totalCount.value,
}))

const columns = computed<DataTableColumns<any>>(() => [
  { title: t('playlistView.col_title'), key: 'title', minWidth: 200, render: (row) => row.title || '-' },
  { title: t('playlistView.col_artist'), key: 'artist', minWidth: 160, render: (row) => row.artist || '-' },
  {
    title: t('playlistView.col_type'), key: 'type', width: 180,
    render: (row) => row.type
      ? h(NTag, { size: 'small' }, { default: () => row.type })
      : '-'
  },
  { title: t('playlistView.col_description'), key: 'description', minWidth: 160, ellipsis: { tooltip: true } },
])

async function fetchData(page = pageNum.value, size = pageSize.value) {
  loading.value = true
  try {
    const result = await datanestApiService.getSoundAssets(page, size)
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

onMounted(() => fetchData(1))
</script>

<template>
  <div>
    <PageHeader :title="pageTitle" :subtitle="t('playlistView.subtitle')" :count="totalCount" />
    <NDataTable
      :columns="columns"
      :data="entries"
      :loading="loading"
      :row-key="(row: any) => row.id || row.slugName"
      :pagination="pagination"
      remote
      @update:page="(p) => { pageNum = p; fetchData(p) }"
      @update:page-size="(s) => { pageSize = s; fetchData(1, s) }"
    />
  </div>
</template>
