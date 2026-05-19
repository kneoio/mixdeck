<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'
import { NSpace, NForm, NFormItem, NInput, NSelect, NTreeSelect, useMessage } from 'naive-ui'
import GsapButton from '@/components/GsapButton.vue'
import { useRoute, useRouter } from 'vue-router'
import FormWrapper from '@/components/FormWrapper.vue'
import { FRAGMENT_TYPES } from '@/stores/soundFragments'
import dictionaryApiService from '@/services/dictionaryApi'
import type { GenreEntry, LabelEntry } from '@/services/dictionaryApi'
import datanestApiService from '@/services/datanestApi'
import { handleApiError } from '@/utils/notificationService'

const { t } = useI18n()

const route = useRoute()
const router = useRouter()
const message = useMessage()

const loading = ref(false)
const isMobile = ref(false)
const genreList = ref<GenreEntry[]>([])
const labelList = ref<LabelEntry[]>([])

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

function normalizeIdList(input: unknown): string[] {
  if (!Array.isArray(input)) return []
  return input
    .map((item: any) => {
      if (typeof item === 'string') return item
      if (item && typeof item === 'object') return item.id || item.identifier || null
      return null
    })
    .filter((value): value is string => Boolean(value))
}

function getGenreLabel(genre: GenreEntry): string {
  const directName = (genre as any).name
  return directName || genre.localizedName?.en || Object.values(genre.localizedName || {})[0] || genre.identifier || genre.id
}

function toGenreTreeOptions(genres: GenreEntry[]): any[] {
  return genres.map(genre => ({
    label: getGenreLabel(genre),
    key: genre.id,
    children: Array.isArray(genre.children) && genre.children.length
      ? toGenreTreeOptions(genre.children)
      : undefined,
  }))
}

const genreTreeOptions = computed(() => toGenreTreeOptions(genreList.value))

const labelOptions = computed(() =>
  labelList.value.map(label => ({
    label: label.localizedName?.en || label.identifier || label.id,
    value: label.id,
  }))
)

async function loadData() {
  try {
    loading.value = true

    const [genres, labels, fragment] = await Promise.allSettled([
      dictionaryApiService.getGenres(),
      dictionaryApiService.getLabelsByCategory('sound_fragment'),
      datanestApiService.getReceivedItem(fragmentId.value),
    ])

    if (genres.status === 'fulfilled') genreList.value = genres.value
    if (labels.status === 'fulfilled') labelList.value = labels.value
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
      <NSpace>
        <GsapButton @click="handleClose"><span>{{ t('common.close') }}</span></GsapButton>
      </NSpace>
    </template>

    <NForm :label-placement="formLabelPlacement" label-width="120" :disabled="loading">
      <NFormItem :label="t('fragmentForm.type')">
        <div class="field-stack">
          <div class="field-shell">
            <NSelect
              :value="formData.type"
              :options="FRAGMENT_TYPES"
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
