<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  NButton, NSpace, NForm, NFormItem, NInput, NSelect,
  NDynamicInput, useMessage
} from 'naive-ui'
import FormWrapper from '@/components/FormWrapper.vue'
import { useListenersStore } from '@/stores/listeners'
import { useRoute, useRouter } from 'vue-router'
import dictionaryApiService from '@/services/dictionaryApi'
import { handleApiError } from '@/utils/notificationService'

const { t } = useI18n()

const route = useRoute()
const router = useRouter()
const store = useListenersStore()
const message = useMessage()

const brandId = computed(() => route.params.id as string)
const isEditing = computed(() => !!route.params.listenerId && route.params.listenerId !== 'new')

const pageTitle = computed(() => {
  if (!isEditing.value) return t('listenerForm.create_title')
  const firstName = localizedNameArray.value.find(n => n.name?.trim())?.name
  return firstName || t('listenerForm.edit_title')
})

const loading = ref(false)

// Form fields
const userId = ref<number | string>('')
const labels = ref<string[]>([])

// Dynamic arrays
const localizedNameArray = ref<{ language: string; name: string }[]>([])
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

const labelOptions = ref<{ label: string; value: string }[]>([])

function createLocalizedName() { return { language: '', name: '' } }
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
  try {
    loading.value = true
    const id = isEditing.value ? (route.params.listenerId as string) : null
    await store.saveListener(id, {
      userId: userId.value ? Number(userId.value) : undefined,
      localizedName: buildRecord(localizedNameArray.value, 'name'),
      userData: buildUserData(),
      labels: labels.value,
    })
    message.success(t('listenerForm.saved'))
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

    // Load labels
    try {
      const lbls = await dictionaryApiService.getLabelsByCategory('listener')
      labelOptions.value = lbls.map(l => ({
        label: l.localizedName?.en || l.identifier || l.id,
        value: l.id
      }))
    } catch {}

    if (isEditing.value) {
      const data = await store.fetchListener(route.params.listenerId as string)
      userId.value = data.userId || ''
      labels.value = data.labels || []
      localizedNameArray.value = Object.entries(data.localizedName || {}).map(([language, name]) => ({ language, name }))
      userDataArray.value = Object.entries(data.userData || {}).map(([key, value]) => ({ key, value: value as string }))
    }
  } catch (error: any) {
    message.error(error?.message || t('listenerForm.load_failed'))
    if (isEditing.value) router.push(backRoute.value)
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <FormWrapper
    :title="pageTitle"
    :subtitle="isEditing ? t('listenerForm.edit_subtitle') : t('listenerForm.create_subtitle')"
    :loading="loading"
  >
    <template #actions>
      <NSpace>
        <NButton @click="router.push(backRoute)">{{ t('common.close') }}</NButton>
        <NButton type="primary" @click="handleSave">{{ t('common.save') }}</NButton>
      </NSpace>
    </template>

    <NForm label-placement="left" label-width="140" :disabled="loading">
      <NFormItem :label="t('listenerForm.localized_names')">
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

      <NFormItem :label="t('listenerForm.user_data')">
        <NDynamicInput v-model:value="userDataArray" :on-create="createUserData" style="width:100%">
          <template #default="{ value }">
            <NSpace align="center" style="width:100%" :wrap="false">
              <NInput v-model:value="value.key" :placeholder="t('listenerForm.field_name')" style="width:200px" />
              <NInput v-model:value="value.value" :placeholder="t('listenerForm.field_value')" style="flex:1" />
            </NSpace>
          </template>
        </NDynamicInput>
      </NFormItem>

      <NFormItem :label="t('listenerForm.labels')">
        <NSelect v-model:value="labels" :options="labelOptions"
          multiple filterable style="width:100%" />
      </NFormItem>
    </NForm>
  </FormWrapper>
</template>
