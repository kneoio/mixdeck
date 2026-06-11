<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'
import { NSpace, NForm, NFormItem, NInput, NSelect, NTreeSelect, useMessage } from 'naive-ui'
import GsapButton from '@/components/GsapButton.vue'
import { useRoute, useRouter } from 'vue-router'
import FormWrapper from '@/components/FormWrapper.vue'
import { FRAGMENT_TYPE_VALUES } from '@/stores/soundFragments'
import { useDictionaryStore } from '@/stores/dictionary'
import datanestApiService from '@/services/datanestApi'
import { handleApiError } from '@/utils/notificationService'
import { normalizeIdList, toGenreTreeOptions } from '@/utils/genreTree'

const { t } = useI18n()
const dictionaryStore = useDictionaryStore()

const fragmentTypeOptions = computed(() =>
  FRAGMENT_TYPE_VALUES.map(v => ({
    label: t(`fragmentForm.type_${v.toLowerCase()}`),
    value: v,
  }))
)

const route = useRoute()
const router = useRouter()
const message = useMessage()

const loading = ref(false)
const isMobile = ref(false)

const formData = ref({
  type: 'SONG' as string,
  title: '',
  artist: '',
  album: '',
  sharerUserName: '',
  sharerUserEmail: '',
  genres: [] as string[],
  labels: [] as string[],
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
      type: fragment.value?.type || 'SONG',
      title: fragment.value?.title || '',
      artist: fragment.value?.artist || '',
      album: fragment.value?.album || '',
      sharerUserName: fragment.value?.sharerUserName || '',
      sharerUserEmail: fragment.value?.sharerUserEmail || '',
      genres: normalizeIdList(fragment.value?.genres),
      labels: normalizeIdList(fragment.value?.labels),
    }
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
        <GsapButton @click="handleClose"><span>{{ t('common.close') }}</span></GsapButton>
      </div>
    </template>

    <NForm :label-placement="formLabelPlacement" label-width="120" :disabled="loading" :show-require-mark="false">
      <NFormItem :label="t('fragmentForm.type')">
        <div class="field-stack">
          <div class="field-shell">
            <NSelect
              :value="formData.type"
              :options="fragmentTypeOptions"
              disabled
              style="width: 200px"
            />
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
