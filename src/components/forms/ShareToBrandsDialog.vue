<template>
  <n-modal
    v-model:show="showDialog"
    preset="dialog"
    :title="modalTitle"
    :style="{ width: isMobile ? '95vw' : '700px' }"
  >
    <n-space vertical>
      <p class="share-hint">{{ t('playlistView.share_dialog_hint') }}</p>
      <n-data-table
        :columns="columns"
        :data="entries"
        :loading="loading"
        :row-key="(row: any) => row.id"
        v-model:checked-row-keys="selectedBrandIds"
        :pagination="pagination"
        remote
        size="small"
        :bordered="false"
        @update:page="onPageChange"
        @update:page-size="onPageSizeChange"
      >
        <template #empty>
          <span v-if="!loading">{{ t('playlistView.share_dialog_empty') }}</span>
        </template>
      </n-data-table>
      <n-checkbox v-model:checked="stayIncognito" class="share-incognito">
        {{ t('playlistView.share_dialog_stay_incognito') }}
      </n-checkbox>
      <div style="margin-top: 12px; min-height: 40px" />
    </n-space>

    <template #action>
      <n-space>
        <n-button @click="handleCancel">{{ t('common.close') }}</n-button>
        <n-button
          type="primary"
          :loading="submitting"
          :disabled="fragmentIds.length === 0 || selectedBrandIds.length === 0"
          @click="handleSubmit"
        >
          {{ t('playlistView.share_dialog_submit') }}
        </n-button>
      </n-space>
    </template>
  </n-modal>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'
import { NModal, NButton, NSpace, NDataTable, NCheckbox, useMessage, type DataTableColumns } from 'naive-ui'
import datanestApiService from '@/services/datanestApi'
import { handleApiError } from '@/utils/notificationService'

const props = defineProps<{
  show: boolean
  fragmentIds: string[]
}>()

const emit = defineEmits<{
  'update:show': [show: boolean]
  shared: []
}>()

const { t } = useI18n()
const message = useMessage()

const isMobile = ref(false)
function updateIsMobile() {
  isMobile.value = window.innerWidth <= 768
}
onMounted(() => {
  updateIsMobile()
  window.addEventListener('resize', updateIsMobile)
})
onBeforeUnmount(() => window.removeEventListener('resize', updateIsMobile))

const showDialog = ref(props.show)
watch(
  () => props.show,
  (v) => {
    showDialog.value = v
    if (v && props.fragmentIds.length > 0) {
      selectedBrandIds.value = []
      stayIncognito.value = false
      pageNum.value = 1
      void fetchBrands(1)
    }
  }
)
watch(showDialog, (v) => emit('update:show', v))

const entries = ref<any[]>([])
const loading = ref(false)
const pageNum = ref(1)
const pageSize = ref(10)
const totalCount = ref(0)
const selectedBrandIds = ref<string[]>([])
const stayIncognito = ref(false)
const submitting = ref(false)

const modalTitle = computed(() =>
  props.fragmentIds.length > 1
    ? t('playlistView.share_dialog_title_bulk', { count: props.fragmentIds.length })
    : t('playlistView.share_dialog_title')
)

const pagination = computed(() => ({
  page: pageNum.value,
  pageSize: pageSize.value,
  pageSizes: [10, 20, 50],
  showSizePicker: true,
  itemCount: totalCount.value,
}))

function displayName(row: any) {
  return (
    row.localizedName?.en
    || Object.values(row.localizedName || {})[0]
    || row.slugName
    || '—'
  )
}

const columns = computed<DataTableColumns<any>>(() => [
  { type: 'selection', multiple: true },
  {
    title: t('playlistView.share_dialog_col_station'),
    key: 'name',
    ellipsis: { tooltip: true },
    render: (row) => displayName(row),
  },
  {
    title: t('playlistView.share_dialog_col_country'),
    key: 'country',
    width: 96,
    render: (row) => row.country || '—',
  },
])

async function fetchBrands(page = 1, size = pageSize.value) {
  loading.value = true
  try {
    const r = await datanestApiService.getBrandsForOpenContribution(page, size)
    entries.value = r.entries
    totalCount.value = r.count
    pageNum.value = r.pageNum
    pageSize.value = r.pageSize
  } catch (e: unknown) {
    handleApiError(e, message)
  } finally {
    loading.value = false
  }
}

function onPageChange(p: number) {
  pageNum.value = p
  void fetchBrands(p)
}

function onPageSizeChange(s: number) {
  pageSize.value = s
  void fetchBrands(1, s)
}

async function handleSubmit() {
  if (selectedBrandIds.value.length === 0) {
    message.warning(t('playlistView.share_dialog_select_brands'))
    return
  }
  if (props.fragmentIds.length === 0) return
  submitting.value = true
  try {
    await datanestApiService.shareSoundFragmentsWithBrands(
      props.fragmentIds,
      selectedBrandIds.value as string[],
      { stayIncognito: stayIncognito.value }
    )
    message.success(
      props.fragmentIds.length > 1
        ? t('playlistView.shared_bulk', { count: props.fragmentIds.length })
        : t('playlistView.shared')
    )
    showDialog.value = false
    emit('shared')
  } catch (e: unknown) {
    handleApiError(e, message)
  } finally {
    submitting.value = false
  }
}

function handleCancel() {
  showDialog.value = false
}
</script>

<style scoped>
.share-hint {
  margin: 0;
  font-size: 13px;
  opacity: 0.85;
  line-height: 1.45;
}
.share-incognito {
  margin-top: 4px;
}
</style>
