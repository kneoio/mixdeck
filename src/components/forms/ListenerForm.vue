<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  NForm, NFormItem, NInput, NSelect,
  NDynamicInput, useMessage
} from 'naive-ui'
import GsapButton from '@/components/GsapButton.vue'
import FormWrapper from '@/components/FormWrapper.vue'
import { useListenersStore } from '@/stores/listeners'
import { useConstantsStore } from '@/stores/constants'
import { useRoute, useRouter } from 'vue-router'
import { useDictionaryStore } from '@/stores/dictionary'

const { t } = useI18n()
const dictionaryStore = useDictionaryStore()
const route = useRoute()
const router = useRouter()
const store = useListenersStore()
const constantsStore = useConstantsStore()
const message = useMessage()

const brandSlug = computed(() => route.params.slug as string)
const listenerId = computed(() => route.params.listenerId as string)
const isEditing = computed(() => !!listenerId.value && listenerId.value !== 'new')
const pageTitle = computed(() => isEditing.value ? t('listenerForm.edit_title') : t('listenerForm.create_title'))
const returnToRoute = computed(() => {
  const value = route.query.returnTo
  return typeof value === 'string' && value ? value : null
})
const backRoute = computed(() => returnToRoute.value ?? `/brands/${brandSlug.value}/listeners`)
const formLabelPlacement = computed(() => (isMobile.value ? 'top' : 'left'))

const loading = ref(false)
const saving = ref(false)
const isMobile = ref(false)

const localizedNames = ref<{ lang: string; name: string }[]>([{ lang: 'en', name: '' }])
const labels = ref<string[]>([])
const userDataArray = ref<{ key: string; value: string }[]>([])

type ValidationField = 'localizedNames'
const fieldErrors = ref<Record<ValidationField, string>>({ localizedNames: '' })

const labelOptions = ref<{ label: string; value: string }[]>([])

function createLocalizedName() { return { lang: 'en', name: '' } }

function buildLocalizedName(): Record<string, string> {
  const result: Record<string, string> = {}
  for (const item of localizedNames.value) {
    if (item.lang && item.name) result[item.lang] = item.name
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

function validate(): boolean {
  fieldErrors.value.localizedNames = ''
  const hasName = localizedNames.value.some(item => item.name.trim().length > 0)
  if (!hasName) {
    fieldErrors.value.localizedNames = t('common.required_field', { field: t('listenerForm.localized_names') })
    return false
  }
  return true
}

async function handleSave() {
  if (!validate()) return
  saving.value = true
  try {
    await store.saveListener(
      isEditing.value ? listenerId.value : null,
      {
        localizedName: buildLocalizedName(),
        labels: labels.value.length ? labels.value : undefined,
        userData: buildUserData(),
      },
      brandSlug.value || undefined,
    )
    message.success(t('listenerForm.saved'))
    router.push(backRoute.value)
  } catch (e: any) {
    message.error(e?.message || t('listenerForm.load_failed'))
  } finally {
    saving.value = false
  }
}

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
    try {
      await dictionaryStore.loadListenerLabels()
      labelOptions.value = dictionaryStore.listenerLabels.map(l => ({
        label: l.localizedName?.en || l.name || l.identifier,
        value: l.identifier,
      }))
    } catch {}

    if (isEditing.value) {
      const data = await store.fetchListener(listenerId.value)
      const ln = data.localizedName || {}
      localizedNames.value = Object.entries(ln).map(([lang, name]) => ({ lang, name: String(name ?? '') }))
      if (!localizedNames.value.length) localizedNames.value = [{ lang: 'en', name: '' }]
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
        <GsapButton @click="router.push(backRoute)">
          <span>{{ t('common.close') }}</span>
        </GsapButton>
        <GsapButton type="primary" :loading="saving" @click="handleSave">
          <span>{{ t('common.save') }}</span>
        </GsapButton>
      </div>
    </template>

    <NForm :label-placement="formLabelPlacement" label-width="140" :disabled="loading">

      <NFormItem :label="t('listenerForm.localized_names')">
        <div class="field-stack">
          <div
            class="field-error-shell"
            :class="{ 'field-error-shell--active': !!fieldErrors.localizedNames }"
          >
            <NDynamicInput v-model:value="localizedNames" :on-create="createLocalizedName" style="width:100%">
              <template #default="{ index }">
                <div class="localized-row">
                  <NSelect
                    v-model:value="localizedNames[index].lang"
                    :options="constantsStore.mostUsedLanguagesSimple"
                    filterable
                    style="width:140px"
                  />
                  <NInput v-model:value="localizedNames[index].name" class="localized-row__input" />
                </div>
              </template>
            </NDynamicInput>
          </div>
          <div class="field-error-label" :class="{ 'field-error-label--visible': !!fieldErrors.localizedNames }">
            {{ fieldErrors.localizedNames || ' ' }}
          </div>
        </div>
      </NFormItem>

      <NFormItem :label="t('listenerForm.labels')">
        <div class="field-stack">
          <div class="field-error-shell">
            <NSelect v-model:value="labels" :options="labelOptions" multiple filterable style="width:100%" />
          </div>
          <div class="field-error-label" />
        </div>
      </NFormItem>

      <hr class="section-divider" />
      <NFormItem :label="t('listenerForm.user_data')">
        <div class="userdata-list">
          <div v-for="item in userDataArray" :key="item.key" class="userdata-row">
            <span class="userdata-key">{{ item.key }}</span>
            <span class="userdata-val">{{ item.value }}</span>
          </div>
          <span v-if="!userDataArray.length" class="userdata-empty">—</span>
        </div>
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

.field-stack {
  width: 100%;
  display: block;
}

.field-error-shell {
  width: 100%;
  border-left: 2px solid transparent;
  padding-left: 8px;
  transition: border-left-color 0.2s ease;
}

.field-error-shell--active {
  border-left-color: rgba(255, 77, 79, 0.95);
}

.field-error-label {
  margin-top: 3px;
  min-height: 12px;
  padding-left: 10px;
  color: #ff4d4f;
  font-size: 11px;
  line-height: 1.3;
  visibility: hidden;
}

.field-error-label--visible {
  visibility: visible;
}

.localized-row {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: nowrap;
}

.localized-row__input {
  flex: 1;
  min-width: 0;
}

.userdata-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: 100%;
}

.userdata-row {
  display: flex;
  gap: 12px;
  font-size: 0.85rem;
}

.userdata-key {
  font-weight: 600;
  opacity: 0.7;
  min-width: 120px;
}

.userdata-val {
  opacity: 0.9;
}

.userdata-empty {
  opacity: 0.35;
  font-size: 0.85rem;
}

.section-divider {
  border: none;
  border-top: 1px solid rgba(255,255,255,0.08);
  margin: 16px 0 20px;
}
</style>
