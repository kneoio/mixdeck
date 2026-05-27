<template>
  <n-modal v-model:show="showDialog" preset="dialog" :title="modalTitle" :style="{ width: isMobile ? '95vw' : '700px' }">
    <n-space vertical>
      <n-upload
        ref="uploadRef"
        :multiple="true"
        :max="20"
        :show-file-list="false"
        v-model:file-list="fileList"
        :accept="'.mp3,.wav,.flac,.ogg,.m4a,.aac'"
        :custom-request="handleFileUpload"
        :disabled="uploadCompleted"
      >
        <GsapButton :disabled="uploadCompleted"><span>Choose Files</span></GsapButton>
      </n-upload>

      <n-data-table
        :columns="columns"
        :data="tableData"
        :bordered="false"
        :pagination="false"
        size="small"
      >
        <template #empty></template>
      </n-data-table>

      <div style="margin-top: 12px; min-height: 40px;">
        <NAlert
          v-if="inlineAlert"
          :type="inlineAlert.type"
          :show-icon="true"
        >
          {{ inlineAlert.text }}
        </NAlert>
      </div>
    </n-space>

    <template #action>
      <div class="gsap-row">
        <GsapButton v-if="!uploadCompleted" @click="handleCancel"><span>Cancel</span></GsapButton>
        <GsapButton v-if="uploadCompleted" @click="handleCancel"><span>Close</span></GsapButton>
        <GsapButton
          v-if="!uploadCompleted"
          type="primary"
          :disabled="fileList.length === 0 || isUploading || (totalFiles > 0 && !uploadCompleted)"
          @click="handleUpload"
        >
          <span>Upload</span>
        </GsapButton>
      </div>
    </template>
  </n-modal>
</template>

<style scoped>
@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}
.status-blink {
  animation: blink 1.5s ease-in-out infinite;
}
</style>

<script setup lang="ts">
import { ref, computed, watch, h, onMounted, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'
import { NModal, NUpload, NSpace, NProgress, NDataTable, NText, NAlert } from 'naive-ui'
import GsapButton from '@/components/GsapButton.vue'
import type { UploadCustomRequestOptions } from 'naive-ui'
import LedGreen from '@/components/LedGreen.vue'
import LedYellow from '@/components/LedYellow.vue'
import LoaderProgress from '@/components/LoaderProgress.vue'
import datanestApiService, { BULK_UPLOAD_CHUNKED_THRESHOLD } from '@/services/datanestApi'

const props = defineProps<{
  show: boolean
  slugName: string
}>()

const emit = defineEmits<{
  'update:show': [show: boolean]
  'upload-complete': []
}>()

const { t } = useI18n()
const isMobile = ref(false)
const inlineAlert = ref<{ type: 'success' | 'warning' | 'error'; text: string } | null>(null)

function updateIsMobile() { isMobile.value = window.innerWidth <= 768 }
onMounted(() => { updateIsMobile(); window.addEventListener('resize', updateIsMobile) })
onBeforeUnmount(() => window.removeEventListener('resize', updateIsMobile))

const MAX_CONCURRENT = 1

const uploadRef = ref()
const showDialog = ref(props.show)
const fileList = ref<any[]>([])
const fileStatuses = ref<Record<string, any>>({})
const activeUploads = ref(0)
let runningUploads = 0
const uploadQueue: Array<() => Promise<void>> = []
const isUploading = computed(() => activeUploads.value > 0)
const totalFiles = ref(0)
const eventSource = ref<EventSource | null>(null)
const batchId = ref('')
const uploadCompleted = ref(false)
const abortController = ref<AbortController | null>(null)

watch(() => props.show, (v) => {
  showDialog.value = v
  if (!v) {
    if (uploadCompleted.value) emit('upload-complete')
    fileList.value = []
    fileStatuses.value = {}
    uploadQueue.length = 0
    runningUploads = 0
    activeUploads.value = 0
    uploadCompleted.value = false
    totalFiles.value = 0
    batchId.value = ''
    abortController.value = null
    inlineAlert.value = null
    if (eventSource.value) {
      eventSource.value.close()
      eventSource.value = null
    }
  }
})

watch(showDialog, (v) => emit('update:show', v))

watch(fileList, (n, o) => {
  if (uploadCompleted.value && n.length > o.length) {
    fileStatuses.value = {}
    uploadCompleted.value = false
  }
})

const modalTitle = computed(() => {
  const uploading = fileList.value.filter(f => f.status === 'uploading').length
  return uploading > 0
    ? t('bulkUpload.title_uploading', { n: uploading })
    : t('bulkUpload.title')
})

const tableData = computed(() =>
  fileList.value.map(f => ({
    id: (f as { serverBulkId?: string }).serverBulkId ?? f.id,
    name: f.name,
    status: f.status,
    percentage: f.percentage
  }))
)

const columns = computed(() => {
  const mobile = isMobile.value
  return [
    {
      title: t('bulkUpload.col_file'),
      key: 'name',
      ellipsis: { tooltip: true },
      ...(mobile ? {} : { width: 320 }),
    },
    {
      title: t('bulkUpload.col_upload'),
      key: 'upload',
      width: mobile ? 80 : 120,
      render(row: any) {
        const st = fileStatuses.value[row.id]
        const hasProcessing = !!st
        const isProcessing = hasProcessing && st.status !== 'finished' && st.status !== 'error'

        if (mobile) {
          return h('div', { style: 'display:flex;flex-direction:column;gap:4px;' }, [
            h(NProgress, {
              type: 'line',
              percentage: row.percentage || 0,
              showIndicator: false,
              height: 2,
              borderRadius: 1,
              fillBorderRadius: 1,
              color: '#eff605',
              railColor: 'rgba(255,255,255,0.12)'
            }),
            h('div', { style: 'display:flex;gap:4px;' }, [
              h(LedGreen, { active: row.status === 'finished' }),
              h(LedYellow, { active: hasProcessing }),
            ])
          ])
        }

        return h(
          'div',
          { style: 'display:flex;align-items:center;gap:6px;' },
          [
            h(NProgress, {
              type: 'line',
              percentage: row.percentage || 0,
              showIndicator: false,
              height: 2,
              borderRadius: 1,
              fillBorderRadius: 1,
              color: '#eff605',
              railColor: 'rgba(255,255,255,0.12)'
            }),
            h(LedIndicator, { active: row.status === 'finished', color: '#00FF3C' }),
            h(LedIndicator, { active: hasProcessing, pulse: isProcessing, color: '#FFC400' }),
          ]
        )
      }
    },
    ...(!mobile ? [{
      title: t('bulkUpload.col_status'),
      key: 'serverStatus',
      render(row: any) {
        const st = fileStatuses.value[row.id]
        if (!st) return null
        if (st.classification === 'error')
          return h(NText, { type: 'error', style: 'font-size:12px;' }, { default: () => st.errorMessage || t('bulkUpload.status_error') })
        if (st.classification === 'warning')
          return h(NText, { type: 'warning', style: 'font-size:12px;' }, { default: () => t('bulkUpload.status_warning') })
        if (st.classification === 'ok')
          return h(NText, { type: 'success', style: 'font-size:12px;' }, { default: () => t('bulkUpload.status_done') })
        const statusKey = `bulkUpload.status_${st.status}`
        return h(NText, { style: 'font-size:12px;opacity:0.5;' }, { default: () => t(statusKey, st.status) })
      }
    }] : [])
  ]
})

function classifyStatus(fd: any): 'error' | 'warning' | 'ok' | 'pending' {
  if (fd.status === 'error') return 'error'
  if (fd.status === 'finished') {
    const meta = fd.metadata
    if (!meta || (typeof meta === 'object' && Object.keys(meta).length === 0)) return 'warning'
    return 'ok'
  }
  return 'pending'
}

function startSSE() {
  if (eventSource.value) return

  const es = new EventSource(datanestApiService.getBulkStatusStreamUrl(batchId.value))
  es.addEventListener('error', () => {}) // prevent unhandled rejection noise in Firefox
  eventSource.value = es

  es.onmessage = (event) => {
    const data = JSON.parse(event.data)
    const next = { ...fileStatuses.value }
    for (const [id, fd] of Object.entries(data) as [string, any][]) {
      const classification = classifyStatus(fd)
      const prev = next[id]
      if (!prev || prev.status !== fd.status || prev.classification !== classification) {
        next[id] = {
          fileId: id,
          fileName: fd.fileName,
          status: fd.status,
          errorMessage: fd.errorMessage,
          metadata: fd.metadata ?? null,
          classification,
        }
      }
    }
    fileStatuses.value = next

    const done = Object.values(next).filter((f: any) => f.status === 'finished' || f.status === 'error').length
    if (done === totalFiles.value && totalFiles.value > 0) {
      eventSource.value?.close()
      eventSource.value = null
      const errors = Object.values(next).filter((f: any) => f.classification === 'error').length
      const warnings = Object.values(next).filter((f: any) => f.classification === 'warning').length
      const ok = Object.values(next).filter((f: any) => f.classification === 'ok').length
      if (errors > 0 && warnings > 0)
        inlineAlert.value = { type: 'warning', text: t('bulkUpload.summary_mixed', { ok, warnings, errors }) }
      else if (errors > 0)
        inlineAlert.value = { type: 'error', text: t('bulkUpload.summary_errors', { ok, errors }) }
      else if (warnings > 0)
        inlineAlert.value = { type: 'warning', text: t('bulkUpload.summary_warnings', { ok, warnings }) }
      else
        inlineAlert.value = { type: 'success', text: t('bulkUpload.summary_success', { ok }) }
      uploadCompleted.value = true
    }
  }

  es.onerror = () => {
    if (!eventSource.value || uploadCompleted.value) return
    eventSource.value.close()
    eventSource.value = null
    setTimeout(() => {
      if (!uploadCompleted.value && batchId.value) startSSE()
    }, 2000)
  }
}

function processQueue() {
  while (runningUploads < MAX_CONCURRENT && uploadQueue.length > 0) {
    const task = uploadQueue.shift()!
    runningUploads++
    task().finally(() => {
      runningUploads--
      processQueue()
    })
  }
}

async function handleFileUpload({ file, onProgress, onFinish, onError }: UploadCustomRequestOptions) {
  if (!file.file) {
    onError?.()
    return
  }

  if (file.file.size > BULK_UPLOAD_CHUNKED_THRESHOLD) {
    (file as { serverBulkId?: string }).serverBulkId = crypto.randomUUID().replace(/-/g, '')
  }

  if (activeUploads.value === 0) {
    batchId.value = `batch-${Date.now()}`
    totalFiles.value = 0
    fileStatuses.value = {}
    abortController.value = new AbortController()
    startSSE()
  }
  activeUploads.value++
  totalFiles.value++

  uploadQueue.push(async () => {
    if (abortController.value?.signal.aborted) {
      activeUploads.value--
      onError?.()
      return
    }
    try {
      const apiFileId = (file as { serverBulkId?: string }).serverBulkId ?? file.id
      await datanestApiService.bulkUploadFile(
        file.file!,
        apiFileId,
        batchId.value,
        props.slugName,
        (percent) => onProgress?.({ percent }),
        abortController.value?.signal
      )
      onFinish?.()
    } catch (err: any) {
      if (err?.name !== 'AbortError') inlineAlert.value = { type: 'error', text: err.message || `Upload failed: ${file.name}` }
      onError?.()
    } finally {
      activeUploads.value--
    }
  })

  processQueue()
}

function handleUpload() {
  if (fileList.value.length === 0) inlineAlert.value = { type: 'warning', text: t('bulkUpload.alert_no_files') }
}

function handleCancel() {
  abortController.value?.abort()
  abortController.value = null
  uploadQueue.length = 0
  runningUploads = 0
  activeUploads.value = 0
  batchId.value = ''
  if (eventSource.value) {
    eventSource.value.close()
    eventSource.value = null
  }
  showDialog.value = false
}
</script>
