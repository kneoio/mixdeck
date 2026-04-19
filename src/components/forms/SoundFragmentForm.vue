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
const pendingFile = ref<File | null>(null)
const existingUrl = ref('')
const uploadProgress = ref(0)
const isUploading = ref(false)

const formData = ref({
  type: 'SONG' as string,
  title: '',
  artist: '',
  album: '',
  description: '',
  genres: [] as string[],
  labels: [] as string[],
  representedInBrands: [] as string[],
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

const existingFileName = computed(() => {
  if (!existingUrl.value) return ''
  return existingUrl.value.split('/').pop()?.split('?')[0] || existingUrl.value
})

const backRoute = computed(() => `/brands/${brandId.value}/playlist`)

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

// Capture file without uploading yet — upload happens after save
function handleFileCapture({ file, onFinish }: UploadCustomRequestOptions) {
  if (file.file) pendingFile.value = file.file
  onFinish?.()
}

async function handleSave() {
  try {
    loading.value = true
    const id = isEditing.value ? (route.params.fragmentId as string) : null
    const saved = await store.saveFragment(id, formData.value as any)
    const fragmentId: string = saved?.id || id || ''

    if (pendingFile.value) {
      if (!fragmentId) throw new Error('Fragment ID missing — cannot upload file')
      isUploading.value = true
      uploadProgress.value = 0
      await datanestApiService.uploadFragmentFile(
        fragmentId,
        pendingFile.value,
        (p) => { uploadProgress.value = p }
      )
    }

    message.success(t('fragmentForm.saved'))
    router.push(backRoute.value)
  } catch (error: any) {
    handleApiError(error, message)
  } finally {
    loading.value = false
    isUploading.value = false
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
      const fileUrl = frag.uploadedFiles?.[0]?.url || frag.url || ''
      existingUrl.value = fileUrl.startsWith('http')
        ? fileUrl
        : fileUrl ? `${appConfig.datanestServer}${fileUrl}` : ''
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
    :title="isEditing ? t('fragmentForm.edit_title') : t('fragmentForm.create_title')"
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
