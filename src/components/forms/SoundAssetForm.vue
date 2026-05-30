<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { gsap } from 'gsap'
import {
  NButton, NSpace, NForm, NFormItem, NInput, NSelect,
  NTabs, NTabPane, NUpload, NProgress, NIcon, useMessage, useLoadingBar,
} from 'naive-ui'
import GsapButton from '@/components/GsapButton.vue'
import { PlayOutline, PauseOutline, DownloadOutline } from '@vicons/ionicons5'
import type { UploadCustomRequestOptions } from 'naive-ui'
import FormWrapper from '@/components/FormWrapper.vue'
import LoaderProgress from '@/components/LoaderProgress.vue'
import { useSoundFragmentsStore, FRAGMENT_TYPES } from '@/stores/soundFragments'
import { useBrandsStore } from '@/stores/brands'
import dictionaryApiService from '@/services/dictionaryApi'
import type { LabelEntry } from '@/services/dictionaryApi'
import datanestApiService from '@/services/datanestApi'
import { appConfig } from '@/config/appConfig'
import { useRoute, useRouter } from 'vue-router'
import { handleApiError } from '@/utils/notificationService'

const ASSET_TYPES = FRAGMENT_TYPES.filter(t => t.value !== 'SONG')

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const store = useSoundFragmentsStore()
const brandsStore = useBrandsStore()
const message = useMessage()
const loadingBar = useLoadingBar()

const labelList = ref<LabelEntry[]>([])

const isEditing = computed(() => !!route.params.fragmentId && route.params.fragmentId !== 'new')
const loading = ref(false)
const activeTab = ref('properties')
const isTabChangeFromValidation = ref(false)
const isMobile = ref(false)

const titleFieldRef = ref<HTMLElement | null>(null)
const representedInBrandsFieldRef = ref<HTMLElement | null>(null)
const audioFileFieldRef = ref<HTMLElement | null>(null)

type ValidationField = 'title' | 'representedInBrands' | 'audioFile'

const fieldErrors = ref<Record<ValidationField, string>>({
  title: '',
  representedInBrands: '',
  audioFile: '',
})

const regDate = ref('')
const lastModifiedDate = ref('')


const existingUrl = ref('')
const existingFileName = ref('')
let cachedBlobUrl = ''
const audioEl = ref<HTMLAudioElement | null>(null)
const audioSeekBarRef = ref<HTMLElement | null>(null)
const isPlaying = ref(false)
const isFetchingAudio = ref(false)
const playbackPercent = ref(0)
const audioCurrent = ref(0)
const audioDuration = ref(0)
const uploadProgress = ref(0)
const isUploading = ref(false)
const uploadedFileNames = ref<string[]>([])

const formData = ref({
  type: 'ADVERTISEMENT' as string,
  title: '',
  description: '',
  labels: [] as string[],
  representedInBrands: [] as string[],
  expiresAt: '' as string | null,
  length: null as number | null,
})

const labelOptions = computed(() =>
  labelList.value.map(l => ({
    label: l.localizedName?.en || l.identifier || l.id,
    value: l.id,
  }))
)

const brandOptions = computed(() =>
  brandsStore.brands.map(b => ({
    label: b.localizedName?.['en'] || b.title || b.slugName || b.id,
    value: b.id,
  }))
)

const backRoute = '/sound-library/sound-assets'
const formLabelPlacement = computed(() => (isMobile.value ? 'top' : 'left'))

function updateIsMobile() {
  isMobile.value = window.innerWidth <= 768
}

const formTitle = computed(() => {
  const title = formData.value.title.trim()
  if (title) return title
  if (!isEditing.value) return ''
  return t('fragmentForm.edit_title')
})

const formSubtitle = computed(() =>
  isEditing.value ? t('fragmentForm.edit_subtitle') : t('fragmentForm.create_subtitle')
)

function getFieldRef(field: ValidationField) {
  if (field === 'title') return titleFieldRef.value
  if (field === 'representedInBrands') return representedInBrandsFieldRef.value
  return audioFileFieldRef.value
}

function getFieldLabel(field: ValidationField) {
  if (field === 'title') return t('fragmentForm.title')
  if (field === 'representedInBrands') return t('fragmentForm.assign_to')
  return t('fragmentForm.audio_file')
}

function clearFieldError(field: ValidationField) {
  if (!fieldErrors.value[field]) return
  fieldErrors.value[field] = ''
  const target = getFieldRef(field)
  if (target) {
    gsap.to(target, { borderLeftColor: 'rgba(255,77,79,0)', duration: 0.2, ease: 'power1.out' })
  }
}

function clearAllFieldErrors() {
  const allFields: ValidationField[] = ['title', 'representedInBrands', 'audioFile']
  for (const field of allFields) clearFieldError(field)
}

async function showFieldError(field: ValidationField, customMessage?: string) {
  fieldErrors.value[field] = customMessage ?? t('common.required_field', { field: getFieldLabel(field) })
  await nextTick()
  const target = getFieldRef(field)
  if (!target) return
  gsap.killTweensOf(target)
  gsap.fromTo(
    target,
    { borderLeftColor: 'rgba(255,77,79,0)' },
    { borderLeftColor: 'rgba(255,77,79,0.95)', duration: 0.24, repeat: 1, yoyo: true, ease: 'power1.out' }
  )
}

async function validateBeforeSave() {
  const invalidFields: ValidationField[] = []
  if (!formData.value.title.trim()) invalidFields.push('title')
  if (!existingUrl.value && !uploadedFileNames.value.length) invalidFields.push('audioFile')

  const allFields: ValidationField[] = ['title', 'representedInBrands', 'audioFile']
  for (const field of allFields) {
    if (!invalidFields.includes(field)) clearFieldError(field)
  }
  if (!invalidFields.length) return true

  isTabChangeFromValidation.value = true
  activeTab.value = 'properties'
  await nextTick()
  isTabChangeFromValidation.value = false
  await Promise.all(invalidFields.map(field => showFieldError(field)))
  return false
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

function syncPlaybackProgress() {
  const el = audioEl.value
  if (!el || !el.duration || !Number.isFinite(el.duration)) {
    playbackPercent.value = 0
    audioDuration.value = 0
    audioCurrent.value = el?.currentTime ?? 0
    return
  }
  audioDuration.value = el.duration
  audioCurrent.value = el.currentTime
  playbackPercent.value = Math.min(100, (el.currentTime / el.duration) * 100)
}

async function ensureAudioSrcLoaded(): Promise<boolean> {
  if (!existingUrl.value) return false
  if (!cachedBlobUrl) {
    isFetchingAudio.value = true
    try {
      cachedBlobUrl = await datanestApiService.fetchBlobUrl(existingUrl.value)
      if (audioEl.value) audioEl.value.src = cachedBlobUrl
    } catch (e: any) {
      handleApiError(e, message)
      return false
    } finally {
      isFetchingAudio.value = false
    }
  }
  const audio = audioEl.value
  if (!audio) return false
  if (Number.isFinite(audio.duration) && audio.duration > 0) return true
  try {
    await new Promise<void>((resolve, reject) => {
      const el = audio
      const timer = window.setTimeout(() => { cleanup(); reject(new Error('timeout')) }, 20000)
      function cleanup() {
        clearTimeout(timer)
        el.removeEventListener('loadedmetadata', onMeta)
        el.removeEventListener('error', onErr)
      }
      function onMeta() { cleanup(); resolve() }
      function onErr() { cleanup(); reject(new Error('audio')) }
      el.addEventListener('loadedmetadata', onMeta, { once: true })
      el.addEventListener('error', onErr, { once: true })
      el.load()
    })
  } catch {
    return false
  }
  return Number.isFinite(audio.duration) && audio.duration > 0
}

function applySeekClientX(clientX: number) {
  const bar = audioSeekBarRef.value
  const a = audioEl.value
  if (!bar || !a || !Number.isFinite(a.duration) || a.duration <= 0) return
  const rect = bar.getBoundingClientRect()
  if (rect.width <= 0) return
  const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
  a.currentTime = ratio * a.duration
  syncPlaybackProgress()
}

let seekDocMove: ((e: MouseEvent) => void) | null = null
let seekDocUp: (() => void) | null = null

function detachSeekDocumentListeners() {
  if (seekDocMove) { document.removeEventListener('mousemove', seekDocMove); seekDocMove = null }
  if (seekDocUp) { document.removeEventListener('mouseup', seekDocUp); seekDocUp = null }
}

async function onSeekBarMouseDown(e: MouseEvent) {
  if (e.button !== 0) return
  e.preventDefault()
  let ended = false
  function onUp() { if (ended) return; ended = true; detachSeekDocumentListeners() }
  seekDocMove = (ev) => { if (!ended) applySeekClientX(ev.clientX) }
  seekDocUp = onUp
  document.addEventListener('mousemove', seekDocMove)
  document.addEventListener('mouseup', onUp, { once: true })
  const ok = await ensureAudioSrcLoaded()
  if (!ok) { onUp(); return }
  applySeekClientX(e.clientX)
}

async function togglePlay() {
  if (!existingUrl.value) return
  if (isPlaying.value) { audioEl.value?.pause(); return }
  const ok = await ensureAudioSrcLoaded()
  if (!ok) return
  try { await audioEl.value?.play() } catch (e: any) { handleApiError(e, message) }
}

function onAudioPlay() { isPlaying.value = true }
function onAudioPause() { isPlaying.value = false }
function onAudioEnded() {
  isPlaying.value = false
  playbackPercent.value = 0
  audioCurrent.value = 0
  if (audioEl.value?.duration) audioDuration.value = audioEl.value.duration
}

async function handleDownload(url: string, filename: string) {
  loadingBar.start()
  try { await datanestApiService.downloadFile(url, filename); loadingBar.finish() }
  catch (e: any) { loadingBar.error(); handleApiError(e, message) }
}

async function handleFileCapture({ file, onFinish, onError }: UploadCustomRequestOptions) {
  const chosen = file.file
  if (!chosen) { onFinish?.(); return }
  isUploading.value = true
  uploadProgress.value = 0
  try {
    const fragmentId = (route.params.fragmentId as string) || 'temp'
    await datanestApiService.uploadFragmentFile(fragmentId, chosen, (p) => { uploadProgress.value = p })
    uploadedFileNames.value.push(chosen.name)
    onFinish?.()
  } catch (e: any) {
    handleApiError(e, message)
    onError?.()
  } finally {
    isUploading.value = false
  }
}

async function handleSave() {
  if (isUploading.value) { message.warning(t('fragmentForm.wait_upload')); return }
  const valid = await validateBeforeSave()
  if (!valid) return
  try {
    loading.value = true
    const id = isEditing.value ? (route.params.fragmentId as string) : null
    const payload: any = { ...formData.value }
    if (uploadedFileNames.value.length) payload.newlyUploaded = uploadedFileNames.value
    await store.saveFragment(id, payload)
    message.success(t('fragmentForm.saved'))
    router.push(backRoute)
  } catch (error: any) {
    handleApiError(error, message)
  } finally {
    loading.value = false
  }
}

function navigateBack() {
  router.push(backRoute)
}

onBeforeUnmount(() => {
  window.removeEventListener('resize', updateIsMobile)
  detachSeekDocumentListeners()
  audioEl.value?.pause()
  if (cachedBlobUrl) { URL.revokeObjectURL(cachedBlobUrl); cachedBlobUrl = '' }
})

onMounted(async () => {
  updateIsMobile()
  window.addEventListener('resize', updateIsMobile)
  try {
    loading.value = true
    const labels = await dictionaryApiService.getLabelsByCategory('sound_fragment').catch(() => [])
    labelList.value = labels

    if (isEditing.value) {
      const frag = await store.fetchFragment(route.params.fragmentId as string)
      formData.value = {
        type: frag.type || 'ADVERTISEMENT',
        title: frag.title || '',
        description: frag.description || '',
        labels: frag.labels || [],
        representedInBrands: frag.representedInBrands || [],
        expiresAt: frag.expiresAt || null,
        length: typeof frag.length === 'number'
          ? frag.length
          : (typeof frag.length === 'string' ? parseInt(frag.length) || null : null),
      }
      regDate.value = frag.regDate || ''
      lastModifiedDate.value = frag.lastModifiedDate || ''
const f0 = frag.uploadedFiles?.[0]
      const fileUrl = f0?.url || frag.url || ''
      existingUrl.value = fileUrl.startsWith('http') ? fileUrl : fileUrl ? `${appConfig.datanestServer}${fileUrl}` : ''
      existingFileName.value = f0?.name || fileUrl.split('/').pop()?.split('?')[0] || ''
    }
  } catch (error: any) {
    message.error(error?.message || t('fragmentForm.load_failed'))
    if (isEditing.value) navigateBack()
  } finally {
    loading.value = false
  }
})

watch(() => formData.value.title, (value) => { if (value.trim()) clearFieldError('title') })
watch(() => formData.value.representedInBrands, (value) => { if (value.length) clearFieldError('representedInBrands') }, { deep: true })
watch(uploadedFileNames, (value) => { if (value.length || existingUrl.value) clearFieldError('audioFile') }, { deep: true })
watch(existingUrl, (value) => {
  isPlaying.value = false
  playbackPercent.value = 0
  audioCurrent.value = 0
  audioDuration.value = 0
  if (cachedBlobUrl) { URL.revokeObjectURL(cachedBlobUrl); cachedBlobUrl = '' }
  if (audioEl.value) audioEl.value.src = ''
  if (value || uploadedFileNames.value.length) clearFieldError('audioFile')
})
watch(activeTab, () => { if (isTabChangeFromValidation.value) return; clearAllFieldErrors() })
</script>

<template>
  <FormWrapper :title="formTitle" :subtitle="formSubtitle" :loading="loading">
    <template #header-actions>
      <div v-if="regDate" style="display:flex;flex-direction:column;align-items:flex-end;gap:2px;font-size:12px;opacity:0.5;line-height:1.4;">
        <span>Created: {{ regDate }}</span>
        <span v-if="lastModifiedDate !== regDate">Modified: {{ lastModifiedDate }}</span>
      </div>
    </template>

    <template #actions>
      <div class="gsap-row">
        <GsapButton @click="navigateBack"><span>{{ t('common.close') }}</span></GsapButton>
        <GsapButton type="primary" @click="handleSave"><span>{{ t('common.save') }}</span></GsapButton>
      </div>
    </template>

    <NTabs v-model:value="activeTab">
      <NTabPane name="properties" :tab="t('fragmentForm.tab_properties')">
        <NForm :label-placement="formLabelPlacement" label-width="120" :disabled="loading || isUploading">

          <NFormItem :label="t('fragmentForm.type')">
            <div class="field-stack">
              <div class="field-error-shell">
                <NSelect v-model:value="formData.type" :options="ASSET_TYPES" style="width: 200px" />
              </div>
              <div class="field-error-label"></div>
            </div>
          </NFormItem>

          <NFormItem :label="t('fragmentForm.title')">
            <div class="field-stack">
              <div
                ref="titleFieldRef"
                class="field-error-shell"
                :class="{ 'field-error-shell--active': !!fieldErrors.title }"
              >
                <NInput v-model:value="formData.title" style="width: 100%" />
              </div>
              <div class="field-error-label" :class="{ 'field-error-label--visible': !!fieldErrors.title }">
                {{ fieldErrors.title || ' ' }}
              </div>
            </div>
          </NFormItem>

          <NFormItem :label="t('fragmentForm.labels')">
            <div class="field-stack">
              <div class="field-error-shell">
                <NSelect v-model:value="formData.labels" :options="labelOptions" multiple filterable style="width: 100%" />
              </div>
              <div class="field-error-label"></div>
            </div>
          </NFormItem>

          <NFormItem :label="t('fragmentForm.assign_to')">
            <div class="field-stack">
              <div
                ref="representedInBrandsFieldRef"
                class="field-error-shell"
                :class="{ 'field-error-shell--active': !!fieldErrors.representedInBrands }"
              >
                <NSelect v-model:value="formData.representedInBrands" :options="brandOptions" multiple filterable style="width: 100%" />
              </div>
              <div class="field-error-label" :class="{ 'field-error-label--visible': !!fieldErrors.representedInBrands }">
                {{ fieldErrors.representedInBrands || ' ' }}
              </div>
            </div>
          </NFormItem>

          <NFormItem :label="t('fragmentForm.audio_file')">
            <div class="field-stack">
              <div
                ref="audioFileFieldRef"
                class="field-error-shell"
                :class="{ 'field-error-shell--active': !!fieldErrors.audioFile }"
              >
                <NSpace vertical style="width: 100%">
                  <div v-if="existingUrl" class="audio-mini-player">
                    <div class="audio-mini-player__row">
                      <div class="audio-mini-player__main">
                        <div class="audio-mini-player__top-row">
                          <div class="audio-mini-player__play-col">
                            <NButton text quaternary :disabled="isFetchingAudio" class="audio-mini-player__play-icon-btn" @click="togglePlay">
                              <template #icon>
                                <LoaderProgress v-if="isFetchingAudio" :size="22" />
                                <NIcon v-else :size="22">
                                  <PauseOutline v-if="isPlaying" />
                                  <PlayOutline v-else />
                                </NIcon>
                              </template>
                            </NButton>
                          </div>
                          <div class="audio-mini-player__bar-area">
                            <div class="audio-mini-player__bar-wrap">
                              <div class="audio-mini-player__bar-layer" aria-hidden="true">
                                <NProgress type="line" :percentage="playbackPercent" :show-indicator="false" :height="2" :border-radius="1" :fill-border-radius="1" color="#eff605" rail-color="rgba(255,255,255,0.12)" />
                              </div>
                              <div ref="audioSeekBarRef" class="audio-mini-player__seek-hit" role="slider" tabindex="-1" @mousedown="onSeekBarMouseDown" />
                            </div>
                          </div>
                        </div>
                        <div class="audio-mini-player__times">
                          <span>{{ formatTime(audioCurrent) }}</span>
                          <span class="audio-mini-player__sep">/</span>
                          <span>{{ formatTime(audioDuration) }}</span>
                        </div>
                      </div>
                      <NButton circle size="small" quaternary :title="existingFileName" class="audio-mini-player__dl" @click="handleDownload(existingUrl, existingFileName)">
                        <template #icon><NIcon><DownloadOutline /></NIcon></template>
                      </NButton>
                      <audio ref="audioEl" @play="onAudioPlay" @pause="onAudioPause" @ended="onAudioEnded" @timeupdate="syncPlaybackProgress" @loadedmetadata="syncPlaybackProgress" />
                    </div>
                  </div>
                  <NUpload :max="1" :custom-request="handleFileCapture" accept=".mp3,.wav,.flac,.ogg,.m4a,.aac" :disabled="isUploading">
                    <GsapButton :disabled="isUploading">
                      <span>{{ existingUrl ? t('fragmentForm.replace_file') : t('fragmentForm.choose_file') }}</span>
                    </GsapButton>
                  </NUpload>
                  <NProgress v-if="isUploading" type="line" :percentage="uploadProgress" :show-indicator="false" :height="2" :border-radius="1" :fill-border-radius="1" color="#eff605" rail-color="rgba(255,255,255,0.12)" />
                </NSpace>
              </div>
              <div class="field-error-label" :class="{ 'field-error-label--visible': !!fieldErrors.audioFile }">
                {{ fieldErrors.audioFile || ' ' }}
              </div>
            </div>
          </NFormItem>

          <NFormItem v-if="formData.expiresAt" :label="t('fragmentForm.expires_at')">
            <div class="field-stack">
              <div class="field-error-shell">
                <NInput :value="formData.expiresAt" readonly style="width: 200px" />
              </div>
              <div class="field-error-label"></div>
            </div>
          </NFormItem>

        </NForm>
      </NTabPane>

      <NTabPane name="description" :tab="t('fragmentForm.tab_description')">
        <NForm :label-placement="formLabelPlacement" label-width="120" :disabled="loading || isUploading">
          <NFormItem :label="t('fragmentForm.description')">
            <div class="field-stack">
              <div class="field-error-shell">
                <NInput v-model:value="formData.description" type="textarea" :autosize="{ minRows: 8, maxRows: 20 }" style="width: 100%" />
              </div>
            </div>
          </NFormItem>
        </NForm>
      </NTabPane>

    </NTabs>
  </FormWrapper>
</template>

<style scoped>
.field-stack { width: 100%; display: block; }
.field-error-shell { width: 100%; border-left: 2px solid transparent; padding-left: 8px; transition: border-left-color 0.2s ease; }
.field-error-shell--active { border-left-color: rgba(255, 77, 79, 0.95); }
.field-error-label { margin-top: 3px; min-height: 12px; padding-left: 10px; color: #ff4d4f; font-size: 11px; line-height: 1.3; visibility: hidden; }
.field-error-label--visible { visibility: visible; }
:deep(.n-form-item .n-form-item-feedback-wrapper) { min-height: 12px; line-height: 1.1; }
:deep(.n-form-item) { margin-bottom: 8px; }
:deep(.n-form-item:last-child) { margin-bottom: 0; }
@media (max-width: 768px) {
  :deep(.n-form-item-label) { padding-left: 10px !important; }
  .field-stack { padding-right: 10px; }
}
.audio-mini-player { width: 100%; max-width: 420px; }
.audio-mini-player__row { display: flex; align-items: center; gap: 8px; width: 100%; flex-wrap: nowrap; }
.audio-mini-player__main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
.audio-mini-player__top-row { display: flex; align-items: center; gap: 8px; width: 100%; min-width: 0; }
.audio-mini-player__play-col { flex-shrink: 0; display: flex; align-items: center; }
.audio-mini-player__play-icon-btn { padding: 2px !important; min-width: auto !important; }
.audio-mini-player__play-icon-btn :deep(.n-icon) { color: inherit; }
.audio-mini-player__bar-area { flex: 1; min-width: 0; }
.audio-mini-player__bar-wrap { position: relative; width: 100%; min-height: 22px; display: flex; align-items: center; }
.audio-mini-player__bar-layer { position: absolute; left: 0; right: 0; top: 50%; transform: translateY(-50%); z-index: 0; pointer-events: none; }
.audio-mini-player__seek-hit { position: absolute; left: 0; right: 0; top: 50%; transform: translateY(-50%); height: 22px; z-index: 1; cursor: pointer; user-select: none; }
.audio-mini-player__times { display: flex; align-items: center; gap: 4px; font-size: 11px; line-height: 1.2; opacity: 0.55; font-variant-numeric: tabular-nums; }
.audio-mini-player__sep { opacity: 0.7; }
</style>
