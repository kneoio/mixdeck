<template>
  <n-modal v-model:show="showDialog" preset="dialog" :title="modalTitle" style="width: 700px;">
    <n-space vertical>
      <n-upload
        ref="uploadRef"
        :multiple="true"
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
    </n-space>

    <template #action>
      <n-space>
        <n-button v-if="!uploadCompleted" @click="handleCancel" :disabled="isUploading">Cancel</n-button>
        <n-button v-if="uploadCompleted" @click="handleCancel">Close</n-button>
        <n-button
          v-if="!uploadCompleted"
          type="primary"
          @click="handleUpload"
          :disabled="fileList.length === 0 || isUploading"
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
import { ref, computed, watch, h } from 'vue'
import { NModal, NUpload, NButton, NSpace, NProgress, NDataTable, NText, useMessage } from 'naive-ui'
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

const message = useMessage()
const uploadRef = ref()
const showDialog = ref(props.show)
const fileList = ref<any[]>([])
const fileStatuses = ref<Record<string, any>>({})
const activeUploads = ref(0)
const isUploading = computed(() => activeUploads.value > 0)
const totalFiles = ref(0)
const eventSource = ref<EventSource | null>(null)
const batchId = ref('')
const uploadCompleted = ref(false)

watch(() => props.show, (v) => {
  showDialog.value = v
  if (!v) {
    if (uploadCompleted.value) emit('upload-complete')
    fileList.value = []
    fileStatuses.value = {}
    activeUploads.value = 0
    uploadCompleted.value = false
    totalFiles.value = 0
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

const columns = [
  {
    title: 'File',
    key: 'name',
    ellipsis: { tooltip: true },
    width: 260
  },
  {
    title: 'Upload',
    key: 'upload',
    width: 120,
    render(row: any) {
      const st = fileStatuses.value[row.id]
      const hasProcessing = !!st
      const isProcessing = hasProcessing && st.status !== 'finished' && st.status !== 'error'

      return h(
        'div',
        { style: 'display:flex;align-items:center;gap:6px;' },
        [
          h(NProgress, {
            type: 'line',
            percentage: row.percentage || 0,
            showIndicator: true,
            borderRadius: 2,
            railBorderRadius: 2
          }),
          h(LedIndicator, { active: row.status === 'finished' }),
          h(YellowLed, { active: hasProcessing, pulse: isProcessing })
        ]
      )
    }
  },
  {
    title: 'Status',
    key: 'serverStatus',
    render(row: any) {
      const st = fileStatuses.value[row.id]
      if (!st) return null
      if (st.status === 'error') {
        return h(NText, { type: 'error', style: 'font-size:12px;' }, { default: () => st.errorMessage || 'Error' })
      }
      if (st.status === 'finished') {
        return h(NText, { type: 'success', style: 'font-size:12px;' }, { default: () => 'Done' })
      }
      return h(NText, { style: 'font-size:12px;opacity:0.5;' }, { default: () => st.status })
    }
  }
]

function startSSE() {
  if (eventSource.value) return

  const es = new EventSource(datanestApiService.getBulkStatusStreamUrl(batchId.value))
  eventSource.value = es

  es.onmessage = (event) => {
    const data = JSON.parse(event.data)
    const next = { ...fileStatuses.value }
    for (const [id, fd] of Object.entries(data) as [string, any][]) {
      next[id] = {
        fileId: id,
        fileName: fd.fileName,
        status: fd.status,
        errorMessage: fd.errorMessage
      }
    }
    fileStatuses.value = next

    const done = Object.values(next).filter((f: any) => f.status === 'finished' || f.status === 'error').length
    if (done === totalFiles.value && totalFiles.value > 0) {
      eventSource.value?.close()
      eventSource.value = null
      const errors = Object.values(next).filter((f: any) => f.status === 'error').length
      const ok = Object.values(next).filter((f: any) => f.status === 'finished').length
      if (errors > 0) message.warning(`Processing completed: ${ok} succeeded, ${errors} failed`)
      else message.success(`All ${ok} files processed successfully`)
      uploadCompleted.value = true
    }
  }

  es.onerror = () => {
    if (eventSource.value) {
      eventSource.value.close()
      eventSource.value = null
      if (!uploadCompleted.value) message.error('Lost connection to server — processing status unknown')
    }
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
    startSSE()  // subscribe before any upload so we never miss server events
  }
  activeUploads.value++

  try {
    await datanestApiService.bulkUploadFile(
      file.file,
      file.id,
      batchId.value,
      props.slugName,
      (percent) => onProgress?.({ percent })
    )
    onFinish?.()
  } catch (err: any) {
    message.error(err.message || `Upload failed: ${file.name}`)
    onError?.()
  } finally {
    activeUploads.value--
  }
}

function handleUpload() {
  if (fileList.value.length === 0) message.warning('Please select files to upload')
}

function handleCancel() {
  if (eventSource.value) {
    eventSource.value.close()
    eventSource.value = null
  }
  showDialog.value = false
}
</script>
