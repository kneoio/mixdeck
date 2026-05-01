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
        <n-button :disabled="uploadCompleted">Choose Files</n-button>
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

      <NAlert
        v-if="inlineAlert"
        :type="inlineAlert.type"
        :show-icon="true"
        style="margin-top: 12px;"
      >
        {{ inlineAlert.text }}
      </NAlert>
    </n-space>

    <template #action>
      <n-space>
        <n-button v-if="!uploadCompleted" @click="handleCancel">Cancel</n-button>
        <n-button v-if="uploadCompleted" @click="handleCancel">Close</n-button>
        <n-button
          v-if="!uploadCompleted"
          type="primary"
          @click="handleUpload"
          :disabled="fileList.length === 0 || isUploading || (totalFiles > 0 && !uploadCompleted)"
          :loading="isUploading"
        >
          Upload
        </n-button>
      </n-space>
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
import { NModal, NUpload, NButton, NSpace, NProgress, NDataTable, NText, NAlert } from 'naive-ui'
import type { UploadCustomRequestOptions } from 'naive-ui'
import LedIndicator from '@/components/LedIndicator.vue'
import YellowLed from '@/components/YellowLed.vue'
import datanestApiService from '@/services/datanestApi'

const props = defineProps<{
  show: boolean
  slugName: string
}>()

const emit = defineEmits<{
  'update:show': [show: boolean]
  'upload-complete': []
}>()

const isMobile = ref(false)
const inlineAlert = ref<{ type: 'success' | 'warning' | 'error'; text: string } | null>(null)

function updateIsMobile() { isMobile.value = window.innerWidth <= 768 }
onMounted(() => { updateIsMobile(); window.addEventListener('resize', updateIsMobile) })
onBeforeUnmount(() => window.removeEventListener('resize', updateIsMobile))

const MAX_CONCURRENT = 3

const uploadRef = ref()
const showDialog = ref(props.show)
const fileList = ref<any[]>([])
const fileStatuses = ref<Record<string, any>>({})
const activeUploads = ref(0)
const runningUploads = ref(0)
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
    activeUploads.value = 0
    runningUploads.value = 0
    uploadQueue.length = 0
    uploadCompleted.value = false
    totalFiles.value = 0
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
    ? `Bulk Upload Sound Fragments (${uploading} uploading)`
    : 'Bulk Upload Sound Fragments'
})

const tableData = computed(() =>
  fileList.value.map(f => ({
    id: f.id,
    name: f.name,
    status: f.status,
    percentage: f.percentage
  }))
)

const columns = computed(() => {
  const mobile = isMobile.value
  return [
    {
      title: 'File',
      key: 'name',
      ellipsis: { tooltip: true },
      ...(mobile ? {} : { width: 320 }),
    },
    {
      title: 'Upload',
      key: 'upload',
      width: mobile ? 80 : 120,
      render(row: any) {
        const st = fileStatuses.value[row.id]
        const hasProcessing = !!st
        const isProcessing = hasProcessing && st.status !== 'finished' && st.status !== 'error'

        if (mobile) {
          return h('div', { style: 'display:flex;flex-direction:column;gap:4px;' }, [
            h(NProgress, { type: 'line', percentage: row.percentage || 0, showIndicator: false, borderRadius: 2, railBorderRadius: 2 }),
            h('div', { style: 'display:flex;gap:4px;' }, [
              h(LedIndicator, { active: row.status === 'finished' }),
              h(YellowLed, { active: hasProcessing, pulse: isProcessing })
            ])
          ])
        }

        return h(
          'div',
          { style: 'display:flex;align-items:center;gap:6px;' },
          [
            h(NProgress, { type: 'line', percentage: row.percentage || 0, showIndicator: true, borderRadius: 2, railBorderRadius: 2 }),
            h(LedIndicator, { active: row.status === 'finished' }),
            h(YellowLed, { active: hasProcessing, pulse: isProcessing })
          ]
        )
      }
    },
    ...(!mobile ? [{
      title: 'Status',
      key: 'serverStatus',
      render(row: any) {
        const st = fileStatuses.value[row.id]
        if (!st) return null
        if (st.classification === 'error')
          return h(NText, { type: 'error', style: 'font-size:12px;' }, { default: () => st.errorMessage || 'Error' })
        if (st.classification === 'warning')
          return h(NText, { type: 'warning', style: 'font-size:12px;' }, { default: () => 'Saved, no metadata — title/artist from filename.' })
        if (st.classification === 'ok')
          return h(NText, { type: 'success', style: 'font-size:12px;' }, { default: () => 'Done' })
        return h(NText, { style: 'font-size:12px;opacity:0.5;' }, { default: () => st.status })
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
        inlineAlert.value = { type: 'warning', text: `Done: ${ok} ok, ${warnings} without metadata, ${errors} failed` }
      else if (errors > 0)
        inlineAlert.value = { type: 'error', text: `Processing completed: ${ok} succeeded, ${errors} failed` }
      else if (warnings > 0)
        inlineAlert.value = { type: 'warning', text: `Done: ${ok} ok, ${warnings} saved without metadata` }
      else
        inlineAlert.value = { type: 'success', text: `All ${ok} files processed successfully` }
      uploadCompleted.value = true
    }
  }

  es.onerror = () => {
    if (!eventSource.value || uploadCompleted.value) return
    eventSource.value.close()
    eventSource.value = null
    // Reconnect after 2s — handles Cloudflare 504 gateway timeouts on long uploads
    setTimeout(() => {
      if (!uploadCompleted.value && batchId.value) startSSE()
    }, 2000)
  }
}

function processQueue() {
  while (runningUploads.value < MAX_CONCURRENT && uploadQueue.length > 0) {
    const task = uploadQueue.shift()!
    runningUploads.value++
    task().finally(() => {
      runningUploads.value--
      processQueue()
    })
  }
}

async function handleFileUpload({ file, onProgress, onFinish, onError }: UploadCustomRequestOptions) {
  if (!file.file) {
    onError?.()
    return
  }

  if (activeUploads.value === 0) {
    batchId.value = `batch-${Date.now()}`
    totalFiles.value = fileList.value.length
    fileStatuses.value = {}
    abortController.value = new AbortController()
    startSSE()
  }
  activeUploads.value++

  uploadQueue.push(async () => {
    if (abortController.value?.signal.aborted) {
      activeUploads.value--
      return
    }
    try {
      await datanestApiService.bulkUploadFile(
        file.file!,
        file.id,
        batchId.value,
        props.slugName,
        (percent) => onProgress?.({ percent }),
        abortController.value?.signal
      )
      onFinish?.()
    } catch (err: any) {
      // per-file errors are already visible in the Status column
      onError?.()
    } finally {
      activeUploads.value--
    }
  })

  processQueue()
}

function handleUpload() {
  if (fileList.value.length === 0) inlineAlert.value = { type: 'warning', text: 'Please select files to upload' }
}

function handleCancel() {
  abortController.value?.abort()
  abortController.value = null
  uploadQueue.length = 0
  activeUploads.value = 0
  runningUploads.value = 0
  if (eventSource.value) {
    eventSource.value.close()
    eventSource.value = null
  }
  showDialog.value = false
}
</script>
