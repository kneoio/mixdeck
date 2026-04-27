<script setup lang="ts">
import { ref, computed, onMounted, h, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  NButton, NSpace, NForm, NFormItem, NInput, NSelect, NSwitch,
  NTabs, NTabPane, NDynamicInput, NInputNumber,
  NColorPicker, NTag, useMessage
} from 'naive-ui'
import type { SelectOption } from 'naive-ui'
import FormWrapper from '@/components/FormWrapper.vue'
import { useBrandsStore, SUBMISSION_POLICY_OPTIONS, type SubmissionPolicy } from '@/stores/brands'
import { useScriptsStore } from '@/stores/scripts'
import { useConstantsStore } from '@/stores/constants'
import { useRoute, useRouter } from 'vue-router'
import datanestApiService from '@/services/datanestApi'
import { handleApiError } from '@/utils/notificationService'

const { t } = useI18n()

const route = useRoute()
const router = useRouter()
const store = useBrandsStore()
const scriptsStore = useScriptsStore()
const constantsStore = useConstantsStore()
const message = useMessage()

// true when at /brands/:id/settings
const isSettings = computed(() => route.name === 'brand-settings')
const isEditing = computed(() => isSettings.value)

const backRoute = computed(() =>
  isSettings.value ? `/brands/${route.params.id}/dashboard` : '/brands'
)

const formTitle = computed(() => {
  if (!isEditing.value) return t('brandForm.create_title')
  const firstName = localizedNames.value[0]?.name
  if (firstName) return firstName
  return t('brandForm.edit_title')
})

const loading = ref(false)
const activeTab = ref('properties')

const localizedNames = ref<{ lang: string; name: string }[]>([{ lang: 'en', name: '' }])

const formData = ref({
  country: null as string | null,
  description: '',
  timeZone: null as string | null,
  publicBrand: 0,
  bitRate: 128,
  aiAgentId: null as string | null,
  profileId: null as string | null,
  oneTimeStreamPolicy: 'NOT_ALLOWED' as SubmissionPolicy,
  submissionPolicy: 'NOT_ALLOWED' as SubmissionPolicy,
  messagingPolicy: 'NOT_ALLOWED' as SubmissionPolicy,
  aiOverriding: { prompt: '' },
  scriptId: null as string | null,
  profileOverriding: { name: '', description: '' },
  color: '#000000',
  titleFont: null as string | null,
  owner: { name: '', email: '' },
  labels: [] as string[],
})

const userVariables = ref<Record<string, any>>({})

type AgentLabel = {
  id: string
  name: string
  identifier?: string
  color?: string
  fontColor?: string
  category?: string
}

type AgentOption = SelectOption & {
  labels?: AgentLabel[]
}

type ScriptOption = SelectOption & {
  tags?: AgentLabel[]
}

const agentOptions = ref<AgentOption[]>([])
/** Raw agent rows from API (like scripts in scriptsStore) — used for description under DJ select. */
const agentsList = ref<Array<{ id: string; description?: string; labels?: AgentLabel[]; name?: string }>>([])
const profileOptions = ref<{ label: string; value: string }[]>([])
const scriptOptions = ref<ScriptOption[]>([])
const labelOptions = ref<{ label: string; value: string }[]>([])

const selectedScript = computed(() =>
  formData.value.scriptId
    ? scriptsStore.scripts.find(s => s.id === formData.value.scriptId)
    : null
)

const selectedAgent = computed(() =>
  formData.value.aiAgentId
    ? agentsList.value.find(a => a.id === formData.value.aiAgentId) ?? null
    : null
)

function createLocalizedName() {
  return { lang: 'en', name: '' }
}

function buildLocalizedName(): Record<string, string> {
  const result: Record<string, string> = {}
  for (const item of localizedNames.value) {
    if (item.lang && item.name) result[item.lang] = item.name
  }
  return result
}

function formatVariableName(name: string) {
  return name.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())
}

function renderAgentOptionLabel(option: SelectOption) {
  const typedOption = option as AgentOption
  const tags = typedOption.labels || []
  return h(
    NSpace,
    { align: 'center', size: 8, wrapItem: false },
    {
      default: () => [
        ...tags
          .filter(tag => Boolean(tag?.name || tag?.identifier))
          .map(tag =>
          h(
            NTag,
            {
              size: 'small',
              bordered: false,
              color: {
                color: tag.color || '#ececec',
                textColor: tag.fontColor || '#333333',
              },
            },
            { default: () => tag.name || tag.identifier }
          )
          ),
        h('span', String(option.label ?? option.value ?? '')),
      ],
    }
  )
}

function renderScriptOptionLabel(option: SelectOption) {
  const typedOption = option as ScriptOption
  const tags = typedOption.tags || []
  return h(
    NSpace,
    { align: 'center', size: 8, wrapItem: false },
    {
      default: () => [
        ...tags
          .filter(tag => Boolean(tag?.name || tag?.identifier))
          .map(tag =>
            h(
              NTag,
              {
                size: 'small',
                bordered: false,
                color: {
                  color: tag.color || '#ececec',
                  textColor: tag.fontColor || '#333333',
                },
              },
              { default: () => tag.name || tag.identifier }
            )
          ),
        h('span', String(option.label ?? option.value ?? '')),
      ],
    }
  )
}

async function handleSave() {
  try {
    loading.value = true
    const id = isEditing.value ? (route.params.id as string) : null
    await store.saveBrand(id, {
      ...formData.value,
      localizedName: buildLocalizedName(),
      country: formData.value.country || undefined,
      timeZone: formData.value.timeZone || undefined,
      aiAgentId: formData.value.aiAgentId || undefined,
      profileId: formData.value.profileId || undefined,
      aiOverriding: formData.value.aiOverriding.prompt ? formData.value.aiOverriding : undefined,
      scripts: formData.value.scriptId
        ? [{ scriptId: formData.value.scriptId, userVariables: userVariables.value }]
        : undefined,
      scriptId: formData.value.scriptId || undefined,
      titleFont: formData.value.titleFont || undefined,
      profileOverriding: (formData.value.profileOverriding.name || formData.value.profileOverriding.description)
        ? formData.value.profileOverriding
        : undefined,
      owner: (formData.value.owner.name || formData.value.owner.email) ? formData.value.owner : undefined,
    } as any)
    message.success(t('brandForm.saved'))
  } catch (error: any) {
    handleApiError(error, message)
  } finally {
    loading.value = false
  }
}

function applyBrandToForm(brand: any) {
  const ln = brand.localizedName || {}
  localizedNames.value = Object.entries(ln).map(([lang, name]) => ({ lang, name: String(name ?? '') }))
  if (!localizedNames.value.length) localizedNames.value = [{ lang: 'en', name: '' }]

  const firstScript = brand.scripts?.[0] ?? (brand.scriptId ? { scriptId: brand.scriptId } : null)
  formData.value = {
    country: brand.country || null,
    description: brand.description || '',
    timeZone: brand.timeZone || null,
    publicBrand: brand.publicBrand ?? 0,
    bitRate: brand.bitRate ?? 128,
    aiAgentId: brand.aiAgentId || null,
    profileId: brand.profileId || null,
    oneTimeStreamPolicy: brand.oneTimeStreamPolicy || 'NOT_ALLOWED',
    submissionPolicy: brand.submissionPolicy || 'NOT_ALLOWED',
    messagingPolicy: brand.messagingPolicy || 'NOT_ALLOWED',
    aiOverriding: { prompt: brand.aiOverriding?.prompt || '' },
    scriptId: firstScript?.scriptId || null,
    profileOverriding: {
      name: brand.profileOverriding?.name || '',
      description: brand.profileOverriding?.description || ''
    },
    color: brand.color || '#000000',
    titleFont: brand.titleFont || null,
    owner: { name: brand.owner?.name || '', email: brand.owner?.email || '' },
    labels: (brand as any).labels || [],
  }
  userVariables.value = firstScript?.userVariables ? { ...firstScript.userVariables } : {}
}

onMounted(async () => {
  try {
    loading.value = true
    const [agents, profiles, scripts, lbls] = await Promise.allSettled([
      datanestApiService.getPagedDictionary<any>('/dictionary/agents', 1, 100),
      datanestApiService.getPagedDictionary<any>('/profiles', 1, 100),
      scriptsStore.loadScripts(1, 200),
      datanestApiService.getPagedDictionary<any>('/labels/only/category/brand', 1, 200),
    ])
    if (agents.status === 'fulfilled') {
      const entries = agents.value.entries as any[]
      agentsList.value = entries.map((a: any) => {
        const top = typeof a.description === 'string' ? a.description.trim() : ''
        const nested = typeof a.docData?.description === 'string' ? a.docData.description.trim() : ''
        const description = top || nested
        return {
          id: a.id,
          name: a.name,
          labels: Array.isArray(a.labels) ? a.labels : [],
          ...(description ? { description } : {}),
        }
      })
      agentOptions.value = entries.map((a: any) => ({
        label: a.name || a.id,
        value: a.id,
        labels: Array.isArray(a.labels) ? a.labels : [],
      }))
    }
    if (profiles.status === 'fulfilled') {
      profileOptions.value = profiles.value.entries.map((p: any) => ({
        label: p.name || p.id, value: p.id
      }))
    }
    if (lbls.status === 'fulfilled') {
      labelOptions.value = lbls.value.entries.map((l: any) => ({
        label: l.identifier || l.title || l.id, value: l.id
      }))
    }
    scriptOptions.value = scriptsStore.scripts.map((s: any) => ({
      label: s.name || s.id,
      value: s.id,
      tags: Array.isArray(s.tags) ? s.tags : [],
    }))

    if (isEditing.value) {
      const brand = await store.fetchBrand(route.params.id as string)
      applyBrandToForm(brand)
    }
  } catch (error: any) {
    message.error(error?.message || t('brandForm.load_failed'))
    if (isEditing.value) router.push(backRoute.value)
  } finally {
    loading.value = false
  }
})

watch(
  () => route.params.id,
  async (newId, oldId) => {
    if (!isEditing.value || !newId || newId === oldId) return
    try {
      loading.value = true
      const brand = await store.fetchBrand(newId as string)
      applyBrandToForm(brand)
    } catch (error: any) {
      message.error(error?.message || t('brandForm.load_failed'))
      router.push(backRoute.value)
    } finally {
      loading.value = false
    }
  }
)
</script>

<template>
  <FormWrapper
    :title="formTitle"
    :subtitle="isEditing ? 'settings' : t('brandForm.create_subtitle')"
    :loading="loading"
  >
    <template #actions>
      <NButton type="primary" @click="handleSave">{{ t('common.save') }}</NButton>
    </template>

    <NTabs v-model:value="activeTab">
      <NTabPane name="properties" :tab="t('brandForm.tab_properties')">
        <NForm label-placement="left" label-width="140" :disabled="loading">
          <NFormItem :label="t('brandForm.localized_names')">
            <NDynamicInput v-model:value="localizedNames" :on-create="createLocalizedName" style="width:100%">
              <template #default="{ index }">
                <NSpace align="center" style="width:100%">
                  <NSelect v-model:value="localizedNames[index].lang"
                    :options="constantsStore.mostUsedLanguagesSimple" filterable style="width:140px" />
                  <NInput v-model:value="localizedNames[index].name" style="flex:1" />
                </NSpace>
              </template>
            </NDynamicInput>
          </NFormItem>

          <NFormItem :label="t('brandForm.country')">
            <NSelect v-model:value="formData.country" :options="constantsStore.countries"
              filterable clearable style="width: 250px" />
          </NFormItem>

          <NFormItem :label="t('brandForm.description')">
            <NInput v-model:value="formData.description" type="textarea"
              :autosize="{ minRows: 3, maxRows: 6 }" style="width: 100%" />
          </NFormItem>

          <NFormItem :label="t('brandForm.time_zone')">
            <NSelect v-model:value="formData.timeZone" :options="constantsStore.timezones"
              filterable clearable style="width: 280px" />
          </NFormItem>

          <NFormItem :label="t('brandForm.bit_rate')">
            <NSelect v-model:value="formData.bitRate" :options="constantsStore.bitRateOptions" style="width: 160px" />
          </NFormItem>

          <NFormItem :label="t('brandForm.public')">
            <NSwitch :value="formData.publicBrand === 1" @update:value="(v) => formData.publicBrand = v ? 1 : 0" />
          </NFormItem>
        </NForm>
      </NTabPane>

      <NTabPane name="dj" :tab="t('brandForm.tab_dj')">
        <NForm label-placement="left" label-width="160" :disabled="loading">
          <NFormItem :label="t('brandForm.ai_agent')">
            <NSelect v-model:value="formData.aiAgentId" :options="agentOptions"
              :render-label="renderAgentOptionLabel" style="width: 100%" />
          </NFormItem>

          <NFormItem v-if="selectedAgent?.description" :label="t('fragmentForm.description')">
            <span style="color: #888; font-size: 13px;">{{ selectedAgent.description }}</span>
          </NFormItem>

          <NFormItem :label="t('brandForm.ai_override')">
            <NInput v-model:value="formData.aiOverriding.prompt" type="textarea"
              :autosize="{ minRows: 3, maxRows: 6 }" style="width: 100%" />
          </NFormItem>
        </NForm>
      </NTabPane>

      <NTabPane name="script" :tab="t('brandForm.tab_script')">
        <NForm label-placement="left" label-width="140" :disabled="loading">
          <NFormItem :label="t('brandForm.script')">
            <NSelect v-model:value="formData.scriptId" :options="scriptOptions"
              :render-label="renderScriptOptionLabel" filterable style="width: 100%; max-width: 500px" />
          </NFormItem>

          <NFormItem v-if="selectedScript?.description" :label="t('fragmentForm.description')">
            <span style="color: #888; font-size: 13px;">{{ selectedScript.description }}</span>
          </NFormItem>

          <template v-if="selectedScript?.requiredVariables?.length">
            <NFormItem :label="t('brandForm.variables')">
              <div style="width: 100%; max-width: 500px">
                <div v-for="variable in selectedScript.requiredVariables" :key="variable.name"
                  style="margin-bottom: 12px">
                  <div style="margin-bottom: 4px; font-size: 13px">
                    <strong>{{ formatVariableName(variable.name) }}</strong>
                    <span v-if="variable.required" style="color: #e74c3c">*</span>
                    <span style="color: #888; font-size: 12px; margin-left: 8px">{{ variable.description }}</span>
                  </div>
                  <NSwitch v-if="variable.type === 'boolean'" v-model:value="userVariables[variable.name]" />
                  <NInputNumber v-else-if="variable.type === 'number'"
                    v-model:value="userVariables[variable.name]" style="width: 100%" />
                  <NInput v-else v-model:value="userVariables[variable.name]" style="width: 100%" />
                </div>
              </div>
            </NFormItem>
          </template>
        </NForm>
      </NTabPane>

      <NTabPane name="audience" :tab="t('brandForm.tab_audience')">
        <NForm label-placement="left" label-width="160" :disabled="loading">
          <NFormItem :label="t('brandForm.audience_type')">
            <NSelect v-model:value="formData.profileId" :options="profileOptions"
              filterable clearable style="width: 100%; max-width: 500px" />
          </NFormItem>

          <NFormItem v-if="formData.profileId" :label="t('brandForm.local_name')">
            <NInput v-model:value="formData.profileOverriding.name"
              :placeholder="t('brandForm.optional_override')" style="width: 100%; max-width: 500px" />
          </NFormItem>

          <NFormItem v-if="formData.profileId" :label="t('brandForm.additional_info')">
            <NInput v-model:value="formData.profileOverriding.description"
              type="textarea" :autosize="{ minRows: 3, maxRows: 5 }"
              :placeholder="t('brandForm.optional_override')" style="width: 100%; max-width: 500px" />
          </NFormItem>
        </NForm>
      </NTabPane>

      <NTabPane name="contribution" :tab="t('brandForm.tab_contribution')">
        <NForm label-placement="left" label-width="180" :disabled="loading">
          <NFormItem :label="t('brandForm.messaging')">
            <NSelect v-model:value="formData.messagingPolicy" :options="SUBMISSION_POLICY_OPTIONS" style="width: 220px" />
          </NFormItem>
          <NFormItem :label="t('brandForm.one_time_stream')">
            <NSelect v-model:value="formData.oneTimeStreamPolicy" :options="SUBMISSION_POLICY_OPTIONS" style="width: 220px" />
          </NFormItem>
          <NFormItem :label="t('brandForm.song_submission')">
            <NSelect v-model:value="formData.submissionPolicy" :options="SUBMISSION_POLICY_OPTIONS" style="width: 220px" />
          </NFormItem>
        </NForm>
      </NTabPane>

      <NTabPane name="playerUi" :tab="t('brandForm.tab_player_ui')">
        <NForm label-placement="left" label-width="120" :disabled="loading">
          <NFormItem v-if="localizedNames[0]?.name" :label="t('brandForm.preview')">
            <div :style="{
              fontFamily: formData.titleFont || undefined,
              fontSize: '34px',
              lineHeight: '1.1',
              color: formData.color,
              padding: '8px 0',
            }">
              {{ localizedNames[0].name }}
            </div>
          </NFormItem>

          <NFormItem :label="t('brandForm.title_font')">
            <NSelect v-model:value="formData.titleFont" :options="constantsStore.stationFontOptions"
              filterable clearable style="width: 280px" />
          </NFormItem>

          <NFormItem :label="t('brandForm.color')">
            <NColorPicker v-model:value="formData.color" style="width: 200px" />
          </NFormItem>
        </NForm>
      </NTabPane>

      <NTabPane name="owner" :tab="t('brandForm.tab_owner')">
        <NForm label-placement="left" label-width="120" :disabled="loading">
          <NFormItem :label="t('brandForm.owner_name')">
            <NInput v-model:value="formData.owner.name"
              :placeholder="t('brandForm.owner_name')" style="width: 100%; max-width: 400px" />
          </NFormItem>
          <NFormItem :label="t('brandForm.owner_email')">
            <NInput v-model:value="formData.owner.email"
              placeholder="owner@example.com" style="width: 100%; max-width: 400px" />
          </NFormItem>
        </NForm>
      </NTabPane>
    </NTabs>
  </FormWrapper>
</template>
