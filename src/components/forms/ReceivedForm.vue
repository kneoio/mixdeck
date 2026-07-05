<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'
import { NForm, NFormItem, NInput, NPopconfirm, NSelect, NTabs, NTabPane, NTag, NTreeSelect, useMessage } from 'naive-ui'
import GsapButton from '@/components/GsapButton.vue'
import AudioMiniPlayer from '@/components/AudioMiniPlayer.vue'
import { useRoute, useRouter } from 'vue-router'
import FormWrapper from '@/components/FormWrapper.vue'
import { useDictionaryStore } from '@/stores/dictionary'
import datanestApiService from '@/services/datanestApi'
import { handleApiError } from '@/utils/notificationService'
import { normalizeIdList, toGenreTreeOptions } from '@/utils/genreTree'
import { appConfig } from '@/config/appConfig'

const { t } = useI18n()
const dictionaryStore = useDictionaryStore()

const route = useRoute()
const router = useRouter()
const message = useMessage()

const loading = ref(false)
const isMobile = ref(false)
const actionBusy = ref(false)
const activeTab = ref('properties')

const formData = ref({
  title: '',
  artist: '',
  album: '',
  status: null as number | null,
  sharerUserName: '',
  sharerUserEmail: '',
  genres: [] as string[],
  labels: [] as string[],
})

const previewUrl = ref('')
const previewFileName = ref('')

// One status enum for everything shown here (station shares and artist contributions are both
// created as a share — see datanest's SHARING_WORKFLOW.md / CONTRIBUTION_WORKFLOW.md):
// 506=PENDING, 500=ACCEPTED, 501=REJECTED.
const statusInfo = computed(() => {
  const status = formData.value.status
  if (status === 506) return { text: t('playlistView.status_pending'), type: 'warning' as const }
  if (status === 501) return { text: t('playlistView.status_rejected'), type: 'error' as const }
  return { text: t('playlistView.status_accepted'), type: 'success' as const }
})

const fragmentId = computed(() => String(route.params.fragmentId ?? ''))
const formLabelPlacement = computed(() => (isMobile.value ? 'top' : 'left'))
const formTitle = computed(() => t('menu.songs'))
const formSubtitle = computed(() => {
  const parts = [formData.value.title.trim(), formData.value.artist.trim()].filter(Boolean)
  return parts.join(' - ')
})

function handleClose() {
  router.push('/sound-library/received')
}

async function handleApprove() {
  actionBusy.value = true
  try {
    await datanestApiService.acceptReceivedSoundFragment(fragmentId.value)
    message.success(t('playlistView.approved'))
    handleClose()
  } catch (error: unknown) {
    handleApiError(error, message)
  } finally {
    actionBusy.value = false
  }
}

const isRejected = computed(() => formData.value.status === 501)
const isAccepted = computed(() => formData.value.status === 500)

async function handleReject() {
  actionBusy.value = true
  try {
    await datanestApiService.rejectReceivedSoundFragment(fragmentId.value)
    message.success(t('playlistView.rejected'))
    handleClose()
  } catch (error: unknown) {
    handleApiError(error, message)
  } finally {
    actionBusy.value = false
  }
}

function updateIsMobile() {
  isMobile.value = window.innerWidth <= 768
}

const genreTreeOptions = computed(() => toGenreTreeOptions(dictionaryStore.genres))

const labelOptions = computed(() =>
  dictionaryStore.soundFragmentLabels.map(label => ({
    label: label.localizedName?.en || label.identifier || label.id,
    value: label.id,
  }))
)

async function loadData() {
  try {
    loading.value = true

    const [, , fragment] = await Promise.allSettled([
      dictionaryStore.loadGenres(),
      dictionaryStore.loadSoundFragmentLabels(),
      datanestApiService.getReceivedItem(fragmentId.value),
    ])

    if (fragment.status !== 'fulfilled') throw fragment.reason

    formData.value = {
      title: fragment.value?.title || '',
      artist: fragment.value?.artist || '',
      album: fragment.value?.album || '',
      status: fragment.value?.status ?? null,
      sharerUserName: fragment.value?.sharerUserName || '',
      sharerUserEmail: fragment.value?.sharerUserEmail || '',
      genres: normalizeIdList(fragment.value?.genres),
      labels: normalizeIdList(fragment.value?.labels),
    }

    const files = fragment.value?.uploadedFiles as any[] | undefined
    const opusFile = files?.find(f => f?.type === 'opus')
    const f0 = opusFile || files?.[0]
    const fileUrl = f0?.url || ''
    previewUrl.value = fileUrl.startsWith('http') ? fileUrl : fileUrl ? `${appConfig.datanestServer}${fileUrl}` : ''
    previewFileName.value = f0?.name || fileUrl.split('/').pop()?.split('?')[0] || ''
  } catch (error: unknown) {
    handleApiError(error, message)
    handleClose()
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  updateIsMobile()
  window.addEventListener('resize', updateIsMobile)
  void loadData()
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', updateIsMobile)
})
</script>

<template>
  <FormWrapper
    :title="formTitle"
    :subtitle="formSubtitle"
    :loading="loading"
  >
    <template #actions>
      <div class="gsap-row">
        <NPopconfirm @positive-click="handleApprove">
          <template #trigger>
            <GsapButton type="success" :disabled="actionBusy || loading || isAccepted"><span>{{ t('playlistView.approve_btn') }}</span></GsapButton>
          </template>
          {{ t('playlistView.approve_confirm') }}
        </NPopconfirm>
        <NPopconfirm @positive-click="handleReject">
          <template #trigger>
            <GsapButton type="warning" :disabled="actionBusy || loading || isRejected"><span>{{ t('playlistView.reject_btn') }}</span></GsapButton>
          </template>
          {{ t('playlistView.reject_confirm') }}
        </NPopconfirm>
        <GsapButton @click="handleClose"><span>{{ t('common.close') }}</span></GsapButton>
      </div>
    </template>

    <NTabs v-model:value="activeTab">
      <NTabPane name="properties" :tab="t('fragmentForm.tab_properties')">
        <NForm :label-placement="formLabelPlacement" label-width="120" :disabled="loading">
          <NFormItem v-if="previewUrl" :label="t('fragmentForm.preview')">
            <div class="field-stack">
              <div class="field-shell">
                <AudioMiniPlayer :url="previewUrl" :filename="previewFileName" />
              </div>
            </div>
          </NFormItem>

          <NFormItem :label="t('fragmentForm.title')">
            <div class="field-stack">
              <div class="field-shell">
                <NInput :value="formData.title" readonly style="width: 100%" />
              </div>
            </div>
          </NFormItem>

          <NFormItem :label="t('fragmentForm.artist')">
            <div class="field-stack">
              <div class="field-shell">
                <NInput :value="formData.artist" readonly style="width: 100%" />
              </div>
            </div>
          </NFormItem>

          <NFormItem :label="t('fragmentForm.album')">
            <div class="field-stack">
              <div class="field-shell">
                <NInput :value="formData.album" readonly style="width: 100%" />
              </div>
            </div>
          </NFormItem>

          <NFormItem :label="t('playlistView.col_status')">
            <div class="field-stack">
              <div class="field-shell">
                <NTag size="small" :type="statusInfo.type">{{ statusInfo.text }}</NTag>
              </div>
            </div>
          </NFormItem>

          <NFormItem :label="t('profile.sharer')">
            <div class="field-stack">
              <div class="field-shell">
                <NInput :value="formData.sharerUserName" readonly style="width: 100%" />
              </div>
            </div>
          </NFormItem>

          <NFormItem :label="t('profile.email')">
            <div class="field-stack">
              <div class="field-shell">
                <NInput :value="formData.sharerUserEmail" readonly style="width: 100%" />
              </div>
            </div>
          </NFormItem>

          <NFormItem :label="t('fragmentForm.genres')">
            <div class="field-stack">
              <div class="field-shell">
                <NTreeSelect
                  :value="formData.genres"
                  :options="genreTreeOptions"
                  multiple
                  checkable
                  disabled
                  clear-filter-after-select
                  filterable
                  style="width: 100%"
                />
              </div>
            </div>
          </NFormItem>

          <NFormItem :label="t('fragmentForm.labels')">
            <div class="field-stack">
              <div class="field-shell">
                <NSelect
                  :value="formData.labels"
                  :options="labelOptions"
                  multiple
                  disabled
                  filterable
                  style="width: 100%"
                />
              </div>
            </div>
          </NFormItem>
        </NForm>
      </NTabPane>
    </NTabs>
  </FormWrapper>
</template>

<style scoped>
.field-stack {
  width: 100%;
  display: block;
}

.field-shell {
  width: 100%;
  padding-left: 8px;
}

@media (max-width: 768px) {
  :deep(.n-form-item-label) {
    padding-left: 10px !important;
  }

  .field-stack {
    padding-right: 10px;
  }
}
</style>
