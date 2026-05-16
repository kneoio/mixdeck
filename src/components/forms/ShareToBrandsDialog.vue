<template>
  <n-modal
    v-model:show="showDialog"
    preset="dialog"
    :title="modalTitle"
    :style="{ width: isMobile ? '95vw' : '480px' }"
  >
    <n-space vertical :size="16">
      <p class="share-hint">{{ t('playlistView.share_dialog_hint') }}</p>

      <n-spin :show="loading" :size="'small'">
        <div class="brand-list">
          <template v-if="!loading && entries.length === 0">
            <span class="brand-empty">{{ t('playlistView.share_dialog_empty') }}</span>
          </template>
          <n-checkbox-group v-else v-model:value="selectedBrandIds">
            <div v-for="brand in entries" :key="brand.id" class="brand-row">
              <n-checkbox :value="brand.id">
                <span class="brand-name">{{ displayName(brand) }}</span>
              </n-checkbox>
              <span v-if="brand.country" class="brand-country">{{ brand.country }}</span>
            </div>
          </n-checkbox-group>
        </div>
        <n-pagination
          v-if="totalCount > pageSize"
          v-model:page="pageNum"
          :page-count="Math.ceil(totalCount / pageSize)"
          simple
          class="share-pagination"
          @update:page="onPageChange"
        />
      </n-spin>

      <n-checkbox v-model:checked="stayIncognito" class="share-incognito">
        {{ t('playlistView.share_dialog_stay_incognito') }}
      </n-checkbox>
    </n-space>

    <template #action>
      <n-space>
        <n-button @click="handleCancel">{{ t('common.close') }}</n-button>
        <n-button
          type="primary"
          :disabled="fragmentIds.length === 0 || selectedBrandIds.length === 0"
          @click="handleSubmit"
        >
          <template v-if="submitting" #icon>
            <LoaderProgress />
          </template>
          {{ t('playlistView.share_dialog_submit') }}
        </n-button>
      </n-space>
    </template>
  </n-modal>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'
import { NModal, NButton, NSpace, NCheckbox, NCheckboxGroup, NSpin, NPagination, useMessage } from 'naive-ui'
import datanestApiService from '@/services/datanestApi'
import { handleApiError } from '@/utils/notificationService'
import LoaderProgress from '@/components/LoaderProgress.vue'

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
const pageSize = ref(20)
const totalCount = ref(0)
const selectedBrandIds = ref<string[]>([])
const stayIncognito = ref(false)
const submitting = ref(false)

const modalTitle = computed(() =>
  props.fragmentIds.length > 1
    ? t('playlistView.share_dialog_title_bulk', { count: props.fragmentIds.length })
    : t('playlistView.share_dialog_title')
)

function displayName(row: any) {
  return (
    row.localizedName?.en
    || Object.values(row.localizedName || {})[0]
    || row.slugName
    || '—'
  )
}

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
  opacity: 0.7;
  line-height: 1.45;
}

.brand-list {
  min-height: 48px;
}

.brand-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 0;
  border-bottom: 1px solid rgba(128, 128, 128, 0.1);
}

.brand-row:last-child {
  border-bottom: none;
}

.brand-name {
  font-size: 14px;
}

.brand-country {
  font-size: 12px;
  opacity: 0.5;
  margin-left: 8px;
  flex-shrink: 0;
}

.brand-empty {
  font-size: 13px;
  opacity: 0.5;
}

.share-pagination {
  margin-top: 12px;
  justify-content: center;
}

.share-incognito {
  margin-top: 4px;
}
</style>
