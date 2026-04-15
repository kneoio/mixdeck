<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import {
  NButton, NSpace, NForm, NFormItem, NInput, NSelect,
  NTabs, NTabPane, useMessage
} from 'naive-ui'
import FormWrapper from '@/components/FormWrapper.vue'
import { useSoundFragmentsStore, FRAGMENT_TYPES } from '@/stores/soundFragments'
import { useBrandsStore } from '@/stores/brands'
import dictionaryApiService from '@/services/dictionaryApi'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()
const store = useSoundFragmentsStore()
const brandsStore = useBrandsStore()
const message = useMessage()

const genreList = ref<{ id: string; localizedName: Record<string, string>; identifier: string }[]>([])
const labelList = ref<{ id: string; localizedName: Record<string, string>; identifier: string }[]>([])

const brandId = computed(() => route.params.id as string)
const isEditing = computed(() => !!route.params.fragmentId && route.params.fragmentId !== 'new')
const loading = ref(false)
const activeTab = ref('properties')

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

const backRoute = computed(() => `/brands/${brandId.value}/playlist`)

async function handleSave() {
  try {
    loading.value = true
    const id = isEditing.value ? (route.params.fragmentId as string) : null
    await store.saveFragment(id, formData.value as any)
    message.success('Sound fragment saved successfully')
    router.push(backRoute.value)
  } catch (error: any) {
    message.error(error?.message || 'Failed to save')
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
    }
  } catch (error: any) {
    message.error(error?.message || 'Failed to load')
    if (isEditing.value) router.push(backRoute.value)
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <FormWrapper
    :title="isEditing ? 'Edit Sound Fragment' : 'Create Sound Fragment'"
    :subtitle="isEditing ? 'Update sound fragment' : 'Add a new sound fragment'"
    :loading="loading"
  >
    <template #actions>
      <NSpace>
        <NButton @click="router.push(backRoute)">Close</NButton>
        <NButton type="primary" @click="handleSave">Save</NButton>
      </NSpace>
    </template>

    <NTabs v-model:value="activeTab">
      <NTabPane name="properties" tab="Main properties">
        <NForm label-placement="left" label-width="120" :disabled="loading">
          <NFormItem label="Type">
            <NSelect v-model:value="formData.type" :options="FRAGMENT_TYPES" style="width: 200px" />
          </NFormItem>

          <NFormItem label="Title">
            <NInput v-model:value="formData.title" style="width: 100%" />
          </NFormItem>

          <NFormItem label="Artist">
            <NInput v-model:value="formData.artist" style="width: 100%" />
          </NFormItem>

          <NFormItem label="Album">
            <NInput v-model:value="formData.album" style="width: 100%" />
          </NFormItem>

          <NFormItem label="Genres">
            <NSelect v-model:value="formData.genres" :options="genreOptions"
              multiple filterable style="width: 100%" />
          </NFormItem>

          <NFormItem label="Labels">
            <NSelect v-model:value="formData.labels" :options="labelOptions"
              multiple filterable style="width: 100%" />
          </NFormItem>

          <NFormItem label="Assign To">
            <NSelect v-model:value="formData.representedInBrands" :options="brandOptions"
              multiple filterable style="width: 100%" />
          </NFormItem>

          <NFormItem v-if="formData.expiresAt" label="Expires At">
            <NInput :value="formData.expiresAt" readonly style="width: 200px" />
          </NFormItem>

          <NFormItem v-if="formData.length != null" label="Length">
            <NInput
              :value="((formData.length as number) / 60).toFixed(2)"
              readonly style="width: 100px"
            />
          </NFormItem>
        </NForm>
      </NTabPane>

      <NTabPane name="description" tab="Description">
        <NForm label-placement="left" label-width="120" :disabled="loading">
          <NFormItem label="Description">
            <NInput v-model:value="formData.description" type="textarea"
              :autosize="{ minRows: 8, maxRows: 20 }" style="width: 100%" />
          </NFormItem>
        </NForm>
      </NTabPane>
    </NTabs>
  </FormWrapper>
</template>
