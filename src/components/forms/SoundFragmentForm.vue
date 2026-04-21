<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  NButton, NSpace, NForm, NFormItem, NInput, NSelect,
  NTabs, NTabPane, NUpload, NProgress, useMessage, useLoadingBar
} from 'naive-ui'
import type { UploadCustomRequestOptions } from 'naive-ui'
import FormWrapper from '@/components/FormWrapper.vue'
import { useSoundFragmentsStore, FRAGMENT_TYPES } from '@/stores/soundFragments'
import { useBrandsStore } from '@/stores/brands'
import dictionaryApiService from '@/services/dictionaryApi'
import datanestApiService from '@/services/datanestApi'
import { appConfig } from '@/config/appConfig'
import { useRoute, useRouter } from 'vue-router'
import { handleApiError } from '@/utils/notificationService'

const { t } = useI18n()

const route = useRoute()
const router = useRouter()
const store = useSoundFragmentsStore()
const brandsStore = useBrandsStore()
const message = useMessage()
const loadingBar = useLoadingBar()

const genreList = ref<{ id: string; localizedName: Record<string, string>; identifier: string }[]>([])
const labelList = ref<{ id: string; localizedName: Record<string, string>; identifier: string }[]>([])

const brandId = computed(() => route.params.id as string)
const isEditing = computed(() => !!route.params.fragmentId && route.params.fragmentId !== 'new')
const loading = ref(false)
const activeTab = ref('properties')

// File upload state
const existingUrl = ref('')
const existingFileName = ref('')
const uploadProgress = ref(0)
const isUploading = ref(false)
const uploadedFileNames = ref<string[]>([])  // newly uploaded during this session

const formData = ref({
  type: 'SONG' as string,
  title: '',
  artist: '',
  album: '',
  description: '',
  genres: [] as string[],
  labels: [] as string[],
  representedInBrands: [brandId.value] as string[],
  expiresAt: '' as string | null,
  length: null as number | null,
})

const genreOptions = computed(() =>
  genreList.value.map(g => ({
    label: g.localizedName?.en || Object.values(g.localizedName || {})[0] || g.identifier || g.id,
    value: g.id
  }))
)

const labelOptions = computed(() =>
  labelList.value.map(l => ({
    label: l.localizedName?.en || l.identifier || l.id,
    value: l.id
  }))
)

const brandOptions = computed(() =>
  brandsStore.brands.map(b => ({
    label: b.localizedName?.['en'] || b.title || b.slugName || b.id,
    value: b.id,
  }))
)


const backRoute = computed(() => `/brands/${brandId.value}/playlist`)

const formTitle = computed(() => {
  if (!isEditing.value) return t('fragmentForm.create_title')
  if (formData.value.title && formData.value.artist) {
    return `${formData.value.title} - ${formData.value.artist}`
  }
  return t('fragmentForm.edit_title')
})

async function handleDownload(url: string, filename: string) {
  loadingBar.start()
  try {
    await datanestApiService.downloadFile(url, filename)
    loadingBar.finish()
  } catch (e: any) {
    loadingBar.error()
    handleApiError(e, message)
  }
}

async function handleFileCapture({ file, onFinish, onError }: UploadCustomRequestOptions) {
  const chosen = file.file
  if (!chosen) { onFinish?.(); return }

  isUploading.value = true
  uploadProgress.value = 0

  try {
    // Use existing ID or "temp" — server links temp uploads on save via newlyUploaded
    const fragmentId = (route.params.fragmentId as string) || 'temp'
    const res = await datanestApiService.uploadFragmentFile(fragmentId, chosen, (p) => { uploadProgress.value = p })

    uploadedFileNames.value.push(chosen.name)

    // Apply metadata returned by server (title, artist, album, length, genres)
    const meta = res?.metadata ?? res?.payload?.metadata
    if (meta) {
      if (meta.title && !formData.value.title) formData.value.title = meta.title
      if (meta.artist && !formData.value.artist) formData.value.artist = meta.artist
      if (meta.album && !formData.value.album) formData.value.album = meta.album
      if (meta.length && formData.value.length == null) formData.value.length = meta.length
    }

    onFinish?.()
  } catch (e: any) {
    handleApiError(e, message)
    onError?.()
  } finally {
    isUploading.value = false
  }
}

async function handleSave() {
  if (isUploading.value) {
    message.warning(t('fragmentForm.wait_upload'))
    return
  }
  try {
    loading.value = true
    const id = isEditing.value ? (route.params.fragmentId as string) : null
    const payload: any = { ...formData.value }
    if (uploadedFileNames.value.length) payload.newlyUploaded = uploadedFileNames.value
    await store.saveFragment(id, payload)
    message.success(t('fragmentForm.saved'))
    router.push(backRoute.value)
  } catch (error: any) {
    handleApiError(error, message)
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  try {
    loading.value = true

    const [genres, labels] = await Promise.allSettled([
      dictionaryApiService.getGenres(),
      dictionaryApiService.getLabelsByCategory('sound_fragment'),
    ])
    if (genres.status === 'fulfilled') genreList.value = genres.value
    if (labels.status === 'fulfilled') labelList.value = labels.value

    if (isEditing.value) {
      const frag = await store.fetchFragment(route.params.fragmentId as string)
      formData.value = {
        type: frag.type || 'SONG',
        title: frag.title || '',
        artist: frag.artist || '',
        album: frag.album || '',
        description: frag.description || '',
        genres: frag.genres || [],
        labels: frag.labels || [],
        representedInBrands: frag.representedInBrands || [],
        expiresAt: frag.expiresAt || null,
        length: typeof frag.length === 'number'
          ? frag.length
          : (typeof frag.length === 'string' ? parseInt(frag.length) || null : null),
      }
      const f0 = frag.uploadedFiles?.[0]
      const fileUrl = f0?.url || frag.url || ''
      existingUrl.value = fileUrl.startsWith('http')
        ? fileUrl
        : fileUrl ? `${appConfig.datanestServer}${fileUrl}` : ''
      existingFileName.value = f0?.name || fileUrl.split('/').pop()?.split('?')[0] || ''
    }
  } catch (error: any) {
    message.error(error?.message || t('fragmentForm.load_failed'))
    if (isEditing.value) router.push(backRoute.value)
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <FormWrapper
    :title="formTitle"
    :subtitle="isEditing ? t('fragmentForm.edit_subtitle') : t('fragmentForm.create_subtitle')"
    :loading="loading"
  >
    <template #actions>
      <NSpace>
        <NButton @click="router.push(backRoute)">{{ t('common.close') }}</NButton>
        <NButton type="primary" @click="handleSave">{{ t('common.save') }}</NButton>
      </NSpace>
    </template>

    <NTabs v-model:value="activeTab">
      <NTabPane name="properties" :tab="t('fragmentForm.tab_properties')">
        <NForm label-placement="left" label-width="120" :disabled="loading || isUploading">

          <NFormItem :label="t('fragmentForm.type')">
            <NSpace align="center">
              <NSelect v-model:value="formData.type" :options="FRAGMENT_TYPES" style="width: 200px" />
              <template v-if="formData.length != null">
                <span style="opacity: 0.45; font-size: 13px;">{{ t('fragmentForm.length') }}</span>
                <NInput
                  :value="((formData.length as number) / 60).toFixed(2)"
                  readonly style="width: 90px"
                />
              </template>
            </NSpace>
          </NFormItem>

          <NFormItem :label="t('fragmentForm.title')">
            <NInput v-model:value="formData.title" style="width: 100%" />
          </NFormItem>

          <NFormItem :label="t('fragmentForm.artist')">
            <NInput v-model:value="formData.artist" style="width: 100%" />
          </NFormItem>

          <NFormItem :label="t('fragmentForm.album')">
            <NInput v-model:value="formData.album" style="width: 100%" />
          </NFormItem>

          <NFormItem :label="t('fragmentForm.genres')">
            <NSelect v-model:value="formData.genres" :options="genreOptions"
              multiple filterable style="width: 100%" />
          </NFormItem>

          <NFormItem :label="t('fragmentForm.labels')">
            <NSelect v-model:value="formData.labels" :options="labelOptions"
              multiple filterable style="width: 100%" />
          </NFormItem>

          <NFormItem :label="t('fragmentForm.assign_to')">
            <NSelect v-model:value="formData.representedInBrands" :options="brandOptions"
              multiple filterable style="width: 100%" />
          </NFormItem>

          <NFormItem :label="t('fragmentForm.audio_file')">
            <NSpace vertical style="width: 100%">
              <a
                v-if="existingUrl"
                href="#"
                style="font-size: 13px;"
                @click.prevent="handleDownload(existingUrl, existingFileName)"
              >{{ existingFileName }}</a>
              <NUpload
                :max="1"
                :custom-request="handleFileCapture"
                accept=".mp3,.wav,.flac,.ogg,.m4a,.aac"
                :disabled="isUploading"
              >
                <NButton :disabled="isUploading">
                  {{ existingUrl ? t('fragmentForm.replace_file') : t('fragmentForm.choose_file') }}
                </NButton>
              </NUpload>
              <NProgress
                v-if="isUploading"
                type="line"
                :percentage="uploadProgress"
                :show-indicator="true"
              />
            </NSpace>
          </NFormItem>

          <NFormItem v-if="formData.expiresAt" :label="t('fragmentForm.expires_at')">
            <NInput :value="formData.expiresAt" readonly style="width: 200px" />
          </NFormItem>

        </NForm>
      </NTabPane>

      <NTabPane name="description" :tab="t('fragmentForm.tab_description')">
        <NForm label-placement="left" label-width="120" :disabled="loading || isUploading">
          <NFormItem :label="t('fragmentForm.description')">
            <NInput v-model:value="formData.description" type="textarea"
              :autosize="{ minRows: 8, maxRows: 20 }" style="width: 100%" />
          </NFormItem>
        </NForm>
      </NTabPane>
    </NTabs>
  </FormWrapper>
</template>
