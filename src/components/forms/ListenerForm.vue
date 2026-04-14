<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import {
  NButton, NSpace, NForm, NFormItem, NInput, NSelect,
  NDynamicInput, useMessage
} from 'naive-ui'
import FormWrapper from '@/components/FormWrapper.vue'
import { useListenersStore } from '@/stores/listeners'
import { useBrandsStore } from '@/stores/brands'
import { useRoute, useRouter } from 'vue-router'
import dictionaryApiService from '@/services/dictionaryApi'

const route = useRoute()
const router = useRouter()
const store = useListenersStore()
const brandsStore = useBrandsStore()
const message = useMessage()

const brandId = computed(() => route.params.id as string)
const isEditing = computed(() => !!route.params.listenerId && route.params.listenerId !== 'new')
const loading = ref(false)

// Form fields
const email = ref('')
const slugName = ref('')
const userId = ref<number | string>('')
const listenerOf = ref<string[]>([])
const labels = ref<string[]>([])

// Dynamic arrays
const localizedNameArray = ref<{ language: string; name: string }[]>([])
const nickNameArray = ref<{ language: string; names: string[] }[]>([])
const userDataArray = ref<{ key: string; value: string }[]>([])

// Options
const langOptions = [
  { label: 'English', value: 'en' },
  { label: 'Russian', value: 'ru' },
  { label: 'German', value: 'de' },
  { label: 'French', value: 'fr' },
  { label: 'Spanish', value: 'es' },
  { label: 'Chinese', value: 'zh' },
]

const brandOptions = computed(() =>
  brandsStore.brands.map(b => ({
    label: b.localizedName?.['en'] || b.title || b.slugName || b.id,
    value: b.id,
  }))
)
const labelOptions = ref<{ label: string; value: string }[]>([])

function createLocalizedName() { return { language: '', name: '' } }
function createNickName() { return { language: '', names: [''] } }
function createUserData() { return { key: '', value: '' } }

function buildRecord<T>(arr: { language: string; name?: T; names?: T }[], field: 'name' | 'names'): Record<string, T> {
  const result: Record<string, T> = {}
  for (const item of arr) {
    if (item.language?.trim()) result[item.language] = (item as any)[field]
  }
  return result
}

function buildUserData(): Record<string, string> {
  const result: Record<string, string> = {}
  for (const item of userDataArray.value) {
    if (item.key?.trim()) result[item.key] = item.value || ''
  }
  return result
}

const backRoute = computed(() => `/brands/${brandId.value}/listeners`)

async function handleSave() {
  if (!email.value?.trim()) {
    message.error('Email is required')
    return
  }
  try {
    loading.value = true
    const id = isEditing.value ? (route.params.listenerId as string) : null
    await store.saveListener(id, {
      email: email.value,
      slugName: slugName.value || undefined,
      userId: userId.value ? Number(userId.value) : undefined,
      localizedName: buildRecord(localizedNameArray.value, 'name'),
      nickName: buildRecord(nickNameArray.value, 'names'),
      userData: buildUserData(),
      listenerOf: listenerOf.value,
      labels: labels.value,
    })
    message.success('Listener saved successfully')
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

    // Load labels
    try {
      const lbls = await dictionaryApiService.getLabelsByCategory('LISTENER')
      labelOptions.value = lbls.map(l => ({
        label: l.localizedName?.en || l.identifier || l.id,
        value: l.id
      }))
    } catch {}

    if (isEditing.value) {
      const data = await store.fetchListener(route.params.listenerId as string)
      email.value = data.email || ''
      slugName.value = data.slugName || ''
      userId.value = data.userId || ''
      listenerOf.value = data.listenerOf || []
      labels.value = data.labels || []
      localizedNameArray.value = Object.entries(data.localizedName || {}).map(([language, name]) => ({ language, name }))
      nickNameArray.value = Object.entries(data.nickName || {}).map(([language, names]) => ({ language, names: names as string[] }))
      userDataArray.value = Object.entries(data.userData || {}).map(([key, value]) => ({ key, value: value as string }))
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
    :title="isEditing ? 'Edit Listener' : 'Create Listener'"
    :subtitle="isEditing ? 'Update listener details' : 'Add a new listener'"
    :loading="loading"
  >
    <template #actions>
      <NSpace>
        <NButton @click="router.push(backRoute)">Close</NButton>
        <NButton type="primary" @click="handleSave">Save</NButton>
      </NSpace>
    </template>

    <NForm label-placement="left" label-width="140" :disabled="loading">
      <NFormItem label="Localized Names">
        <NDynamicInput v-model:value="localizedNameArray" :on-create="createLocalizedName" style="width:100%">
          <template #default="{ value }">
            <NSpace align="center" style="width:100%">
              <NSelect v-model:value="value.language" :options="langOptions"
                filterable style="width:130px" />
              <NInput v-model:value="value.name" style="flex:1" />
            </NSpace>
          </template>
        </NDynamicInput>
      </NFormItem>

      <NFormItem label="Nick Names">
        <NDynamicInput v-model:value="nickNameArray" :on-create="createNickName" style="width:100%">
          <template #default="{ value }">
            <NSpace align="center" style="width:100%" :wrap="false">
              <NSelect v-model:value="value.language" :options="langOptions"
                filterable style="width:130px; flex-shrink:0" />
              <NDynamicInput v-model:value="value.names" :on-create="() => ''" style="flex:1" />
            </NSpace>
          </template>
        </NDynamicInput>
      </NFormItem>

      <NFormItem label="User Data">
        <NDynamicInput v-model:value="userDataArray" :on-create="createUserData" style="width:100%">
          <template #default="{ value }">
            <NSpace align="center" style="width:100%">
              <NInput v-model:value="value.key" placeholder="Field name" style="width:200px" />
              <NInput v-model:value="value.value" placeholder="Field value" style="flex:1" />
            </NSpace>
          </template>
        </NDynamicInput>
      </NFormItem>

      <NFormItem label="Email">
        <NInput v-model:value="email" placeholder="listener@example.com" style="width:100%" />
      </NFormItem>

      <NFormItem label="Slug Name">
        <NInput v-model:value="slugName" style="width:100%" />
      </NFormItem>

      <NFormItem label="Listener Of">
        <NSelect v-model:value="listenerOf" :options="brandOptions"
          multiple filterable style="width:100%"
          placeholder="Select brands" />
      </NFormItem>

      <NFormItem label="Labels">
        <NSelect v-model:value="labels" :options="labelOptions"
          multiple filterable style="width:100%" />
      </NFormItem>
    </NForm>
  </FormWrapper>
</template>
