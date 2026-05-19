<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  NSpace, NForm, NFormItem, NInput, NSelect,
  NDynamicInput, useMessage
} from 'naive-ui'
import GsapButton from '@/components/GsapButton.vue'
import FormWrapper from '@/components/FormWrapper.vue'
import { useListenersStore } from '@/stores/listeners'
import { useRoute, useRouter } from 'vue-router'
import dictionaryApiService from '@/services/dictionaryApi'

const { t } = useI18n()

const route = useRoute()
const router = useRouter()
const store = useListenersStore()
const message = useMessage()

const brandId = computed(() => route.params.id as string)
const isEditing = computed(() => !!route.params.listenerId && route.params.listenerId !== 'new')

const pageTitle = computed(() =>
  isEditing.value ? t('listenerForm.edit_title') : t('listenerForm.create_title')
)

const loading = ref(false)
const isMobile = ref(false)

// Form fields
const userId = ref<number | string>('')
const labels = ref<string[]>([])

// Dynamic arrays
const userDataArray = ref<{ key: string; value: string }[]>([])

const labelOptions = ref<{ label: string; value: string }[]>([])

function createUserData() { return { key: '', value: '' } }

function buildUserData(): Record<string, string> {
  const result: Record<string, string> = {}
  for (const item of userDataArray.value) {
    if (item.key?.trim()) result[item.key] = item.value || ''
  }
  return result
}

const backRoute = computed(() => `/brands/${brandId.value}/listeners`)
const formLabelPlacement = computed(() => (isMobile.value ? 'top' : 'left'))

function updateIsMobile() {
  isMobile.value = window.innerWidth <= 768
}

onBeforeUnmount(() => {
  window.removeEventListener('resize', updateIsMobile)
})

onMounted(async () => {
  updateIsMobile()
  window.addEventListener('resize', updateIsMobile)
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
      <div class="gsap-row">
        <GsapButton @click="router.push(backRoute)"><span>{{ t('common.close') }}</span></GsapButton>
      </div>
    </template>

    <NForm :label-placement="formLabelPlacement" label-width="140" disabled>
      <NFormItem :label="t('listenerForm.user_data')">
        <NDynamicInput v-model:value="userDataArray" :on-create="createUserData" style="width:100%" disabled>
          <template #default="{ value }">
            <NSpace align="center" style="width:100%" :wrap="false">
              <NInput v-model:value="value.key" :placeholder="t('listenerForm.field_name')" style="width:200px" disabled />
              <NInput v-model:value="value.value" :placeholder="t('listenerForm.field_value')" style="flex:1" disabled />
            </NSpace>
          </template>
        </NDynamicInput>
      </NFormItem>

      <NFormItem :label="t('listenerForm.labels')">
        <NSelect v-model:value="labels" :options="labelOptions"
          multiple filterable style="width:100%" disabled />
      </NFormItem>
    </NForm>
  </FormWrapper>
</template>

<style scoped>
:deep(.n-form-item .n-form-item-feedback-wrapper) {
  min-height: 12px;
  line-height: 1.1;
}

:deep(.n-form-item) {
  margin-bottom: 8px;
}

:deep(.n-form-item:last-child) {
  margin-bottom: 0;
}
</style>
