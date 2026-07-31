<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick, h } from 'vue'
import { useI18n } from 'vue-i18n'
import { gsap } from 'gsap'
import {
  NSpace, NForm, NFormItem, NInput, NSelect, NTag,
  NTabs, NTabPane, NUpload, NProgress, useMessage,
  NCheckbox, NCheckboxGroup, NButton, NButtonGroup, NSlider, NInputNumber, NText, NDynamicInput,
} from 'naive-ui'
import type { SelectRenderTag } from 'naive-ui'
import GsapButton from '@/components/GsapButton.vue'
import type { UploadCustomRequestOptions } from 'naive-ui'
import FormWrapper from '@/components/FormWrapper.vue'
import AudioMiniPlayer from '@/components/AudioMiniPlayer.vue'
import { useSoundFragmentsStore, FRAGMENT_TYPE_VALUES } from '@/stores/soundFragments'
import { useBrandsStore } from '@/stores/brands'
import { useDictionaryStore } from '@/stores/dictionary'
import datanestApiService from '@/services/datanestApi'
import { useRoute, useRouter } from 'vue-router'
import { handleApiError } from '@/utils/notificationService'

const { t } = useI18n()

const assetTypeOptions = computed(() =>
  FRAGMENT_TYPE_VALUES.filter(v => v !== 'SONG').map(v => ({
    label: t(`fragmentForm.type_${v.toLowerCase()}`),
    value: v,
  }))
)
const route = useRoute()
const router = useRouter()
const store = useSoundFragmentsStore()
const brandsStore = useBrandsStore()
const message = useMessage()
const dictionaryStore = useDictionaryStore()

const isEditing = computed(() => !!route.params.fragmentId && route.params.fragmentId !== 'new')
const loading = ref(false)
const activeTab = ref('properties')
const isTabChangeFromValidation = ref(false)
const isMobile = ref(false)

const titleFieldRef = ref<HTMLElement | null>(null)
const artistFieldRef = ref<HTMLElement | null>(null)
const representedInBrandsFieldRef = ref<HTMLElement | null>(null)
const audioFileFieldRef = ref<HTMLElement | null>(null)

type ValidationField = 'title' | 'artist' | 'representedInBrands' | 'audioFile'

const fieldErrors = ref<Record<ValidationField, string>>({
  title: '',
  artist: '',
  representedInBrands: '',
  audioFile: '',
})

const regDate = ref('')
const lastModifiedDate = ref('')
const playHistory = ref<{ playedAt: string; djName: string; duration: number }[]>([])
const playHistoryStats = ref<{ total: number; djs: number; first: string; last: string } | null>(null)


const existingUrl = ref('')
const existingFileName = ref('')
const activeFileType = ref('unknown')
const existingFiles = ref<{ id: string; name: string; url: string; status?: string }[]>([])
const uploadProgress = ref(0)
const isUploading = ref(false)
const uploadedFileNames = ref<string[]>([])

const formData = ref({
  type: 'PRERECORDED_ADVERTISEMENT' as string,
  title: '',
  artist: '',
  description: '',
  labels: [] as string[],
  representedInBrands: [] as string[],
  expiresAt: '' as string | null,
  length: null as number | null,
  schedule: {
    enabled: false,
    tasks: [] as any[],
  },
})

const scheduleTasksArray = ref<any[]>([])

const timeMarks = {
  0: '00:00',
  360: '06:00',
  720: '12:00',
  1080: '18:00',
  1440: '24:00',
}

function formatMinutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`
}

function timeToMinutes(timeStr: string): number {
  const [hours, minutes] = timeStr.split(':').map(Number)
  return hours * 60 + minutes
}

function createScheduleTask() {
  return {
    startTime: 540,
    endTime: 600,
    interval: 60,
    weekdays: [] as string[],
  }
}

const isPrerecorded = computed(() =>
  formData.value.type === 'PRERECORDED_ADVERTISEMENT' || formData.value.type === 'PRERECORDED_PODCAST'
)

const labelOptions = computed(() =>
  dictionaryStore.soundFragmentLabels.map(l => ({
    label: l.localizedName?.en || l.name || l.identifier,
    value: l.identifier,
  }))
)

const brandOptions = computed(() =>
  brandsStore.brands.map(b => ({
    label: b.localizedName?.['en'] || b.title || b.slugName || '',
    value: b.slugName!,
  }))
)

function isKnownBrand(id: string) {
  return brandOptions.value.some(o => o.value === id)
}

const renderBrandTag: SelectRenderTag = ({ option, handleClose }) => {
  const id = String(option.value ?? '')
  const known = isKnownBrand(id)
  return h(NTag, {
    closable: known,
    onClose: known ? handleClose : undefined,
    class: known ? undefined : 'brand-tag--inaccessible',
  }, {
    default: () => option.label ?? option.value,
  })
}

function onBrandsUpdate(value: string[]) {
  const protectedIds = formData.value.representedInBrands.filter(id => !isKnownBrand(id))
  const nextKnown = value.filter(id => isKnownBrand(id))
  const next: string[] = []
  const seen = new Set<string>()
  for (const id of formData.value.representedInBrands) {
    if (protectedIds.includes(id) || nextKnown.includes(id)) {
      next.push(id)
      seen.add(id)
    }
  }
  for (const id of nextKnown) {
    if (!seen.has(id)) next.push(id)
  }
  formData.value.representedInBrands = next
}

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
  if (field === 'artist') return artistFieldRef.value
  if (field === 'representedInBrands') return representedInBrandsFieldRef.value
  return audioFileFieldRef.value
}

function getFieldLabel(field: ValidationField) {
  if (field === 'title') return t('fragmentForm.title')
  if (field === 'artist') return t('fragmentForm.artist')
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
  const allFields: ValidationField[] = ['title', 'artist', 'representedInBrands', 'audioFile']
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
  if (!formData.value.artist.trim()) invalidFields.push('artist')
  if (isPrerecorded.value) {
    const hasExisting = existingFiles.value.some(f => f.status !== 'removed')
    if (!hasExisting && !uploadedFileNames.value.length) invalidFields.push('audioFile')
  } else {
    if (!existingUrl.value && !uploadedFileNames.value.length) invalidFields.push('audioFile')
  }

  const allFields: ValidationField[] = ['title', 'artist', 'representedInBrands', 'audioFile']
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


function removeExistingFile(id: string) {
  const f = existingFiles.value.find(f => f.id === id)
  if (f) f.status = 'removed'
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
    if (isPrerecorded.value) payload.uploadedFiles = existingFiles.value.map(f => ({ id: f.id, status: f.status }))
    if (formData.value.type === 'PRERECORDED_ADVERTISEMENT') {
      payload.schedule = {
        enabled: formData.value.schedule.enabled,
        tasks: scheduleTasksArray.value.map(task => ({
          triggerType: 'PERIODIC',
          periodicTrigger: {
            startTime: formatMinutesToTime(task.startTime),
            endTime: formatMinutesToTime(task.endTime),
            interval: task.interval,
            weekdays: task.weekdays ?? [],
          },
        })),
      }
    }
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
})

onMounted(async () => {
  updateIsMobile()
  window.addEventListener('resize', updateIsMobile)
  try {
    loading.value = true
    await dictionaryStore.loadSoundFragmentLabels().catch(() => {})

    if (isEditing.value) {
      const frag = await store.fetchFragment(route.params.fragmentId as string)
      formData.value = {
        type: frag.type || 'PRERECORDED_ADVERTISEMENT',
        title: frag.title || '',
        artist: frag.artist || '',
        description: frag.description || '',
        labels: frag.labels || [],
        representedInBrands: frag.representedInBrands || [],
        expiresAt: frag.expiresAt || null,
        length: typeof frag.length === 'number'
          ? frag.length
          : (typeof frag.length === 'string' ? parseInt(frag.length) || null : null),
        schedule: {
          enabled: (frag as any).schedule?.enabled ?? false,
          tasks: (frag as any).schedule?.tasks ?? [],
        },
      }
      regDate.value = frag.regDate || ''
      lastModifiedDate.value = frag.lastModifiedDate || ''
      if ((frag as any).schedule?.tasks?.length > 0) {
        scheduleTasksArray.value = (frag as any).schedule.tasks
          .filter((task: any) => task.triggerType === 'PERIODIC' && task.periodicTrigger)
          .map((task: any) => ({
            startTime: timeToMinutes(task.periodicTrigger.startTime),
            endTime: timeToMinutes(task.periodicTrigger.endTime),
            interval: task.periodicTrigger.interval,
            weekdays: task.periodicTrigger.weekdays ?? [],
          }))
      }
      playHistory.value = (frag.playHistory || []).map((e: any) => ({
        playedAt: e.playedAt,
        djName: e.djName || '',
        duration: e.duration ?? 0,
      }))
if (isPrerecorded.value) {
        existingFiles.value = (frag.uploadedFiles || []).map((f: any) => ({
          id: f.id,
          name: f.name || f.id,
          url: f.url || '',
          status: f.status,
        }))
      } else {
        const opusFile = frag.uploadedFiles?.find((f: any) => f.type === 'opus')
        const f0 = opusFile || frag.uploadedFiles?.[0]
        activeFileType.value = f0?.type ?? 'unknown'
        const fileUrl = f0?.url || frag.url || ''
        existingUrl.value = fileUrl
        existingFileName.value = frag.uploadedFiles?.find((f: any) => f.type === 'original')?.name || f0?.name || fileUrl.split('/').pop()?.split('?')[0] || ''
      }
    }
  } catch (error: any) {
    message.error(error?.message || t('fragmentForm.load_failed'))
    if (isEditing.value) navigateBack()
  } finally {
    loading.value = false
  }
})

watch(() => formData.value.title, (value) => { if (value.trim()) clearFieldError('title') })
watch(() => formData.value.artist, (value) => { if (value.trim()) clearFieldError('artist') })
watch(() => formData.value.representedInBrands, (value) => { if (value.length) clearFieldError('representedInBrands') }, { deep: true })
watch(uploadedFileNames, (value) => { if (value.length || existingUrl.value) clearFieldError('audioFile') }, { deep: true })
watch(existingUrl, (value) => {
  if (value || uploadedFileNames.value.length) clearFieldError('audioFile')
})
watch(existingFiles, (value) => {
  if (value.some(f => f.status !== 'removed') || uploadedFileNames.value.length) clearFieldError('audioFile')
}, { deep: true })
watch(activeTab, (tab) => {
  if (isTabChangeFromValidation.value) return
  clearAllFieldErrors()
  if (tab === 'play-history' && playHistory.value.length && !playHistoryStats.value) {
    const h = playHistory.value
    playHistoryStats.value = {
      total: h.length,
      djs: new Set(h.map(e => e.djName)).size,
      first: new Date(h[0].playedAt).toLocaleDateString(),
      last: new Date(h[h.length - 1]!.playedAt).toLocaleDateString(),
    }
  }
})
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
                <NSelect v-model:value="formData.type" :options="assetTypeOptions" style="width: 200px" />
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

          <NFormItem :label="t('fragmentForm.artist')">
            <div class="field-stack">
              <div
                ref="artistFieldRef"
                class="field-error-shell"
                :class="{ 'field-error-shell--active': !!fieldErrors.artist }"
              >
                <NInput v-model:value="formData.artist" style="width: 100%" />
              </div>
              <div class="field-error-label" :class="{ 'field-error-label--visible': !!fieldErrors.artist }">
                {{ fieldErrors.artist || ' ' }}
              </div>
            </div>
          </NFormItem>

          <NFormItem :label="t('fragmentForm.assign_to')">
            <div class="field-stack">
              <div
                ref="representedInBrandsFieldRef"
                class="field-error-shell"
                :class="{ 'field-error-shell--active': !!fieldErrors.representedInBrands }"
              >
                <NSelect
                  :value="formData.representedInBrands"
                  :options="brandOptions"
                  :render-tag="renderBrandTag"
                  multiple
                  filterable
                  style="width: 100%"
                  @update:value="onBrandsUpdate"
                />
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
                  <template v-if="isPrerecorded">
                    <div
                      v-for="f in existingFiles.filter(f => f.status !== 'removed')"
                      :key="f.id"
                      class="prerecorded-file-row"
                    >
                      <div class="prerecorded-file-info">
                        <span class="prerecorded-file-name">{{ f.name }}</span>
                        <AudioMiniPlayer :url="f.url" :filename="f.name" />
                      </div>
                      <GsapButton @click.stop="removeExistingFile(f.id)"><span>×</span></GsapButton>
                    </div>
                    <NUpload
                      :max="10"
                      :custom-request="handleFileCapture"
                      accept=".mp3,.wav,.flac,.ogg,.m4a,.aac"
                      :disabled="isUploading"
                      multiple
                    >
                      <GsapButton :disabled="isUploading">
                        <span>{{ t('fragmentForm.choose_file') }}</span>
                      </GsapButton>
                    </NUpload>
                  </template>
                  <template v-else>
                    <AudioMiniPlayer v-if="existingUrl" :url="existingUrl" :filename="existingFileName" @playing-change="(v) => { if (v) console.log('[AudioPlayer] playing file type:', activeFileType) }" />
                    <NUpload :max="1" :custom-request="handleFileCapture" accept=".mp3,.wav,.flac,.ogg,.m4a,.aac" :disabled="isUploading">
                      <GsapButton :disabled="isUploading">
                        <span>{{ existingUrl ? t('fragmentForm.replace_file') : t('fragmentForm.choose_file') }}</span>
                      </GsapButton>
                    </NUpload>
                  </template>
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

      <NTabPane v-if="formData.type === 'PRERECORDED_ADVERTISEMENT'" name="schedule" :tab="t('fragmentForm.tab_scheduler')">
        <NForm :label-placement="formLabelPlacement" label-width="120" :disabled="loading">
          <NFormItem style="margin-bottom: 0;">
            <NCheckbox v-model:checked="formData.schedule.enabled">{{ t('fragmentForm.scheduler_enable') }}</NCheckbox>
          </NFormItem>
        </NForm>
        <NDynamicInput v-model:value="scheduleTasksArray" :on-create="createScheduleTask" style="width: 100%; margin-top: 20px;">
          <template #default="{ value, index }">
            <div class="sa-task-block">
              <NText class="sa-task-label">{{ t('fragmentForm.scheduler_task', { n: index + 1 }) }}</NText>

              <div class="sa-task-body">
                <!-- Interval row -->
                <div class="sa-task-row">
                  <span class="sa-field-label">{{ t('fragmentForm.scheduler_interval') }}</span>
                  <NSpace align="center" :size="8">
                    <NInputNumber v-model:value="value.interval" :min="1" :max="1440" style="width: 130px;" :disabled="loading" />
                    <NText v-if="value.interval > 0" depth="3" style="font-size: 12px;">
                      {{ t('fragmentForm.scheduler_plays', { n: Math.floor((value.endTime - value.startTime) / value.interval) }) }}
                    </NText>
                  </NSpace>
                </div>

                <!-- Time range row -->
                <div class="sa-task-row">
                  <span class="sa-field-label">{{ t('fragmentForm.scheduler_time_range') }}</span>
                  <div style="flex: 1; min-width: 0;">
                    <NSlider
                      :value="[value.startTime, value.endTime]"
                      range
                      :marks="timeMarks"
                      :step="15"
                      :min="0"
                      :max="1440"
                      class="sa-scheduler-slider"
                      :tooltip="false"
                      :disabled="loading"
                      @update:value="(v) => { value.startTime = (v as number[])[0]; value.endTime = (v as number[])[1] }"
                    />
                    <NSpace align="center" :size="16" style="margin-top: 16px;" wrap>
                      <NText depth="3" style="font-size: 12px; min-width: 110px;">
                        {{ formatMinutesToTime(value.startTime) }} — {{ formatMinutesToTime(value.endTime) }}
                      </NText>
                      <NSpace align="center" :size="4">
                        <NText depth="3" style="font-size: 11px;">{{ t('fragmentForm.scheduler_width') }}</NText>
                        <NButtonGroup size="small">
                          <NButton :disabled="loading" @click="() => { const s = value.startTime + 15; const e = value.endTime - 15; if (s < e) { value.startTime = s; value.endTime = e } }">−</NButton>
                          <NButton :disabled="loading" @click="() => { value.startTime = Math.max(0, value.startTime - 15); value.endTime = Math.min(1440, value.endTime + 15) }">+</NButton>
                        </NButtonGroup>
                      </NSpace>
                      <NSpace align="center" :size="4">
                        <NText depth="3" style="font-size: 11px;">{{ t('fragmentForm.scheduler_slide') }}</NText>
                        <NButtonGroup size="small">
                          <NButton :disabled="loading" @click="() => { const d = Math.min(value.startTime, 15); value.startTime -= d; value.endTime -= d }">−</NButton>
                          <NButton :disabled="loading" @click="() => { const d = Math.min(1440 - value.endTime, 15); value.startTime += d; value.endTime += d }">+</NButton>
                        </NButtonGroup>
                      </NSpace>
                    </NSpace>
                  </div>
                </div>

                <!-- Days row -->
                <div class="sa-task-row sa-task-row--top">
                  <span class="sa-field-label">{{ t('fragmentForm.scheduler_days') }}</span>
                  <NCheckboxGroup v-model:value="value.weekdays" :disabled="loading">
                    <NSpace vertical :size="6">
                      <NCheckbox value="MONDAY" :label="t('fragmentForm.scheduler_mon')" />
                      <NCheckbox value="TUESDAY" :label="t('fragmentForm.scheduler_tue')" />
                      <NCheckbox value="WEDNESDAY" :label="t('fragmentForm.scheduler_wed')" />
                      <NCheckbox value="THURSDAY" :label="t('fragmentForm.scheduler_thu')" />
                      <NCheckbox value="FRIDAY" :label="t('fragmentForm.scheduler_fri')" />
                      <NCheckbox value="SATURDAY" :label="t('fragmentForm.scheduler_sat')" />
                      <NCheckbox value="SUNDAY" :label="t('fragmentForm.scheduler_sun')" />
                    </NSpace>
                  </NCheckboxGroup>
                </div>
              </div>

              <div v-if="index < scheduleTasksArray.length - 1" class="sa-scheduler-divider" />
            </div>
          </template>
        </NDynamicInput>
      </NTabPane>

      <NTabPane v-if="isEditing && playHistory.length" name="play-history" tab="Play History">
        <div v-if="playHistoryStats" class="ph-stats">
          <div class="ph-stat">
            <span class="ph-stat__val">{{ playHistoryStats.total }}</span>
            <span class="ph-stat__lbl">Total plays</span>
          </div>
          <div class="ph-stat">
            <span class="ph-stat__val">{{ playHistoryStats.djs }}</span>
            <span class="ph-stat__lbl">DJs</span>
          </div>
          <div class="ph-stat">
            <span class="ph-stat__val">{{ playHistoryStats.first }}</span>
            <span class="ph-stat__lbl">First played</span>
          </div>
          <div class="ph-stat">
            <span class="ph-stat__val">{{ playHistoryStats.last }}</span>
            <span class="ph-stat__lbl">Last played</span>
          </div>
        </div>
        <div class="play-history-table-wrap">
          <table class="play-history-table">
            <thead>
              <tr>
                <th>Played At</th>
                <th>DJ</th>
                <th>Duration</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(entry, i) in playHistory" :key="i">
                <td>{{ new Date(entry.playedAt).toLocaleString() }}</td>
                <td>{{ entry.djName }}</td>
                <td>{{ entry.duration > 0 ? entry.duration + 's' : '—' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </NTabPane>

    </NTabs>
  </FormWrapper>
</template>

<style scoped>
.ph-stats { display: flex; gap: 24px; padding: 12px 0 16px; flex-wrap: wrap; }
.ph-stat { display: flex; flex-direction: column; gap: 2px; }
.ph-stat__val { font-size: 20px; font-weight: 600; line-height: 1.2; }
.ph-stat__lbl { font-size: 11px; opacity: 0.45; text-transform: uppercase; letter-spacing: 0.05em; }
.play-history-table-wrap { overflow-x: auto; }
.play-history-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.play-history-table th { text-align: left; padding: 6px 12px; opacity: 0.5; font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid rgba(255,255,255,0.08); }
.play-history-table td { padding: 6px 12px; border-bottom: 1px solid rgba(255,255,255,0.05); }
.play-history-table tbody tr:last-child td { border-bottom: none; }
.sa-task-block { width: 100%; }
.sa-task-label {
  display: block;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  opacity: 0.4;
  margin-bottom: 16px;
}
.sa-task-body { display: flex; flex-direction: column; gap: 20px; }
.sa-task-row {
  display: flex;
  align-items: center;
  gap: 16px;
}
.sa-task-row--top { align-items: flex-start; }
.sa-field-label {
  font-size: 13px;
  opacity: 0.55;
  min-width: 110px;
  flex-shrink: 0;
}
.sa-scheduler-slider { margin: 4px 12px 20px; }
.sa-scheduler-divider { height: 1px; background: rgba(255,255,255,0.07); margin: 24px 0; }
@media (max-width: 768px) {
  .sa-task-row { flex-direction: column; align-items: flex-start; gap: 8px; }
  .sa-field-label { min-width: unset; }
}
.field-stack { width: 100%; display: block; }
.prerecorded-file-row { display: flex; align-items: center; gap: 8px; }
.prerecorded-file-info { display: flex; flex-direction: column; gap: 4px; flex: 1; min-width: 0; }
.prerecorded-file-name { font-size: 11px; opacity: 0.55; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.field-error-shell { width: 100%; border-left: 2px solid transparent; padding-left: 8px; transition: border-left-color 0.2s ease; }
.field-error-shell--active { border-left-color: rgba(255, 77, 79, 0.95); }
.field-error-label { margin-top: 3px; min-height: 12px; padding-left: 10px; color: #ff4d4f; font-size: 11px; line-height: 1.3; visibility: hidden; }
.field-error-label--visible { visibility: visible; }
:deep(.n-form-item .n-form-item-feedback-wrapper) { min-height: 12px; line-height: 1.1; }
:deep(.n-form-item) { margin-bottom: 8px; }
:deep(.n-form-item:last-child) { margin-bottom: 0; }
.brand-tag--inaccessible {
  opacity: 0.45;
  pointer-events: none;
}
@media (max-width: 768px) {
  :deep(.n-form-item-label) { padding-left: 10px !important; }
  .field-stack { padding-right: 10px; }
}
</style>
