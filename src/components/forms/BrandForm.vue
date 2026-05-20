<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, h, watch, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { gsap } from 'gsap'
import {
  NSpace, NForm, NFormItem, NInput, NSelect, NSwitch,
  NTabs, NTabPane, NDynamicInput, NInputNumber, NSlider,
  NColorPicker, NTag, NPopconfirm, NAnchor, NAnchorLink, useMessage
} from 'naive-ui'
import GsapButton from '@/components/GsapButton.vue'
import type { SelectOption } from 'naive-ui'
import FormWrapper from '@/components/FormWrapper.vue'
import { useBrandsStore, SUBMISSION_POLICY_OPTIONS, type SubmissionPolicy } from '@/stores/brands'
import { useScriptsStore } from '@/stores/scripts'
import { useConstantsStore } from '@/stores/constants'
import { useRoute, useRouter } from 'vue-router'
import datanestApiService from '@/services/datanestApi'
import dictionaryApiService from '@/services/dictionaryApi'
import { handleApiError } from '@/utils/notificationService'
import { isValidationError } from '@/utils/errorHandler'

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
const isTabChangeFromValidation = ref(false)
const saveAttempted = ref(false)
const isMobile = ref(false)
const localizedNamesFieldRef = ref<HTMLElement | null>(null)
const countryFieldRef = ref<HTMLElement | null>(null)
const timeZoneFieldRef = ref<HTMLElement | null>(null)
const aiAgentFieldRef = ref<HTMLElement | null>(null)
const scriptFieldRef = ref<HTMLElement | null>(null)
const genresFieldRef = ref<HTMLElement | null>(null)

type ValidationField = 'localizedNames' | 'country' | 'timeZone' | 'genres' | 'aiAgentId' | 'scriptId'

const fieldErrors = ref<Record<ValidationField, string>>({
  localizedNames: '',
  country: '',
  timeZone: '',
  genres: '',
  aiAgentId: '',
  scriptId: '',
})

const localizedNames = ref<{ lang: string; name: string }[]>([{ lang: 'en', name: '' }])

const formData = ref({
  country: null as string | null,
  description: '',
  timeZone: null as string | null,
  publicBrand: 0,
  bitRate: 128_000,
  aiAgentId: null as string | null,
  profileId: null as string | null,
  oneTimeStreamPolicy: 'NOT_ALLOWED' as SubmissionPolicy,
  submissionPolicy: 'NOT_ALLOWED' as SubmissionPolicy,
  aiOverriding: { prompt: '' },
  scriptId: null as string | null,
  profileOverriding: { name: '', description: '' },
  color: '#000000',
  titleFont: null as string | null,
  hlsUrl: '',
  mixplaUrl: '',
  owner: { name: '', email: '', exposeWhileSharing: false },
  genres: [] as string[],
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
const genreOptions = ref<{ label: string; value: string }[]>([])

const bitRateMarks = computed<Record<number, string>>(() => ({
  64_000: t('brandForm.stream_quality_good'),
  96_000: t('brandForm.stream_quality_great'),
  128_000: t('brandForm.stream_quality_best'),
}))

function snapBrandBitRate(bps: number): number {
  const allowed = [64_000, 96_000, 128_000]
  return allowed.reduce((best, cur) =>
    Math.abs(bps - cur) < Math.abs(bps - best) ? cur : best
  )
}

function formatBitRateTooltip(value: number) {
  return bitRateMarks.value[value] ?? `${value / 1000} kbps`
}

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

const genresRequiredMessage = computed(() =>
  t('common.required_field', { field: t('fragmentForm.genres') })
)

const formLabelPlacement = computed(() => (isMobile.value ? 'top' : 'left'))

function updateIsMobile() {
  if (typeof window === 'undefined') return
  isMobile.value = window.innerWidth <= 768
}

function createLocalizedName() {
  return { lang: 'en', name: '' }
}

function getFieldRef(field: ValidationField) {
  if (field === 'localizedNames') return localizedNamesFieldRef.value
  if (field === 'country') return countryFieldRef.value
  if (field === 'timeZone') return timeZoneFieldRef.value
  if (field === 'genres') return genresFieldRef.value
  if (field === 'aiAgentId') return aiAgentFieldRef.value
  return scriptFieldRef.value
}

function getFieldLabel(field: ValidationField) {
  if (field === 'localizedNames') return t('brandForm.localized_names')
  if (field === 'country') return t('brandForm.country')
  if (field === 'timeZone') return t('brandForm.time_zone')
  if (field === 'genres') return t('fragmentForm.genres')
  if (field === 'aiAgentId') return t('brandForm.ai_agent')
  return t('brandForm.script')
}

function getFieldTab(field: ValidationField) {
  if (field === 'localizedNames' || field === 'country' || field === 'timeZone' || field === 'genres') return 'properties'
  if (field === 'aiAgentId') return 'dj'
  return 'script'
}

function clearFieldError(field: ValidationField) {
  if (!fieldErrors.value[field]) return
  fieldErrors.value[field] = ''
  const target = getFieldRef(field)
  if (target) {
    gsap.to(target, {
      borderLeftColor: 'rgba(255,77,79,0)',
      duration: 0.2,
      ease: 'power1.out',
    })
  }
}

function clearAllFieldErrors() {
  const allFields: ValidationField[] = ['localizedNames', 'country', 'timeZone', 'genres', 'aiAgentId', 'scriptId']
  for (const field of allFields) {
    clearFieldError(field)
  }
}

async function showFieldError(field: ValidationField, customMessage?: string) {
  fieldErrors.value[field] = customMessage ?? t('common.required_field', { field: getFieldLabel(field) })
  await nextTick()
  const target = getFieldRef(field)
  if (!target) return
  gsap.killTweensOf(target)
  gsap.fromTo(
    target,
    { borderLeftColor: 'rgba(255,77,79,0)' },
    { borderLeftColor: 'rgba(255,77,79,0.95)', duration: 0.24, repeat: 1, yoyo: true, ease: 'power1.out' }
  )
}

async function handleServerValidation(error: any): Promise<boolean> {
  if (!isValidationError(error)) return false
  const fieldMap: Record<string, ValidationField> = {
    localizedName: 'localizedNames',
    localizedNames: 'localizedNames',
    country: 'country',
    timeZone: 'timeZone',
    genres: 'genres',
    aiAgentId: 'aiAgentId',
    scriptId: 'scriptId',
    scripts: 'scriptId',
  }
  const toShow: { field: ValidationField; msg: string }[] = []
  for (const [key, messages] of Object.entries(error.validationError.errors)) {
    const field = fieldMap[key]
    if (field) toShow.push({ field, msg: (messages as string[])[0] })
  }
  if (!toShow.length) return false
  isTabChangeFromValidation.value = true
  activeTab.value = getFieldTab(toShow[0].field)
  await nextTick()
  isTabChangeFromValidation.value = false
  await Promise.all(toShow.map(({ field, msg }) => showFieldError(field, msg)))
  return true
}

async function validateBeforeSave() {
  const invalidFields: ValidationField[] = []

  const hasName = localizedNames.value.some(item => item.name.trim().length > 0)
  if (!hasName) invalidFields.push('localizedNames')
  if (!formData.value.country) invalidFields.push('country')
  if (!formData.value.timeZone) invalidFields.push('timeZone')
  if (!Array.isArray(formData.value.genres) || formData.value.genres.length === 0) invalidFields.push('genres')
  if (!formData.value.aiAgentId) invalidFields.push('aiAgentId')
  if (!formData.value.scriptId) invalidFields.push('scriptId')

  const allFields: ValidationField[] = ['localizedNames', 'country', 'timeZone', 'genres', 'aiAgentId', 'scriptId']
  for (const field of allFields) {
    if (!invalidFields.includes(field)) clearFieldError(field)
  }

  if (!invalidFields.length) return true

  isTabChangeFromValidation.value = true
  activeTab.value = getFieldTab(invalidFields[0])
  await nextTick()
  isTabChangeFromValidation.value = false
  await Promise.all(invalidFields.map(field => showFieldError(field)))
  return false
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
  saveAttempted.value = true
  const valid = await validateBeforeSave()
  if (!valid) return
  try {
    loading.value = true
    const id = isEditing.value ? (route.params.id as string) : null
    const savedBrand = await store.saveBrand(id, {
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
    saveAttempted.value = false
    message.success(t('brandForm.saved'))
    if (!id) {
      const newId = (savedBrand as any)?.id
        ?? (savedBrand as any)?.docData?.id
        ?? (savedBrand as any)?.payload?.docData?.id
      if (newId) {
        await store.loadBrands(1, 10)
        await router.push(`/brands/${newId}/playlist`)
      }
    }
  } catch (error: any) {
    const handled = await handleServerValidation(error)
    if (!handled) handleApiError(error, message)
  } finally {
    loading.value = false
  }
}

async function handleCloseBrand() {
  if (!isEditing.value) return
  try {
    loading.value = true
    await store.closeBrand(route.params.id as string)
    message.success('Brand closed successfully')
    await store.loadBrands(1, 1)
    const nextBrand = store.brands[0]
    if (nextBrand?.id) {
      await router.push(`/brands/${nextBrand.id}/playlist`)
    } else {
      await router.push('/broadcaster-welcome')
    }
  } catch (error: any) {
    handleApiError(error, message)
  } finally {
    loading.value = false
  }
}

/** Server uses bps (e.g. 192000). Values below 1000 are treated as legacy kbps. */
function normalizeBitRateFromServer(raw: number | null | undefined): number {
  if (raw == null || Number.isNaN(raw)) return 128_000
  if (raw > 0 && raw < 1000) return Math.round(raw * 1000)
  return raw
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
    bitRate: snapBrandBitRate(normalizeBitRateFromServer(brand.bitRate)),
    aiAgentId: brand.aiAgentId || null,
    profileId: brand.profileId || null,
    oneTimeStreamPolicy: brand.oneTimeStreamPolicy || 'NOT_ALLOWED',
    submissionPolicy: brand.submissionPolicy || 'NOT_ALLOWED',
    aiOverriding: { prompt: brand.aiOverriding?.prompt || '' },
    scriptId: firstScript?.scriptId || null,
    profileOverriding: {
      name: brand.profileOverriding?.name || '',
      description: brand.profileOverriding?.description || ''
    },
    color: brand.color || '#000000',
    titleFont: brand.titleFont || null,
    hlsUrl: brand.hlsUrl || '',
    mixplaUrl: brand.mixplaUrl || '',
    owner: { name: brand.owner?.name || '', email: brand.owner?.email || '', exposeWhileSharing: brand.owner?.exposeWhileSharing ?? false },
    genres: (brand as any).genres || [],
    labels: (brand as any).labels || [],
  }
  userVariables.value = firstScript?.userVariables ? { ...firstScript.userVariables } : {}
}

onMounted(async () => {
  updateIsMobile()
  window.addEventListener('resize', updateIsMobile)
  try {
    loading.value = true
    const [agents, profiles, scripts, genres] = await Promise.allSettled([
      datanestApiService.getPagedDictionary<any>('/dictionary/agents', 1, 100),
      datanestApiService.getPagedDictionary<any>('/profiles', 1, 100),
      scriptsStore.loadScripts(1, 200),
      dictionaryApiService.getGenres(),
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
    if (genres.status === 'fulfilled') {
      genreOptions.value = genres.value.map((g: any) => ({
        label: g.localizedName?.en || g.name || g.identifier || g.id, value: g.id
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

onBeforeUnmount(() => {
  if (typeof window === 'undefined') return
  window.removeEventListener('resize', updateIsMobile)
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

watch(
  localizedNames,
  () => {
    const hasName = localizedNames.value.some(item => item.name.trim().length > 0)
    if (hasName) clearFieldError('localizedNames')
  },
  { deep: true }
)

watch(() => formData.value.country, (value) => {
  if (value) clearFieldError('country')
})

watch(() => formData.value.timeZone, (value) => {
  if (value) clearFieldError('timeZone')
})

watch(() => formData.value.genres, (value) => {
  if (Array.isArray(value) && value.length > 0) {
    clearFieldError('genres')
    saveAttempted.value = false
  } else if (saveAttempted.value) {
    fieldErrors.value.genres = genresRequiredMessage.value
  }
}, { deep: true })

watch(() => formData.value.aiAgentId, (value) => {
  if (value) clearFieldError('aiAgentId')
})

watch(() => formData.value.scriptId, (value) => {
  if (value) clearFieldError('scriptId')
})

watch(activeTab, () => {
  if (isTabChangeFromValidation.value) return
  clearAllFieldErrors()
})
</script>

<template>
  <FormWrapper
    :title="formTitle"
    :subtitle="isEditing ? 'settings' : t('brandForm.create_subtitle')"
    :loading="loading"
  >
    <template #actions>
      <div class="gsap-row">
        <GsapButton type="primary" :disabled="loading" @click="handleSave"><span>{{ t('common.save') }}</span></GsapButton>
      </div>
    </template>

    <NTabs v-model:value="activeTab">
      <NTabPane name="properties" :tab="t('brandForm.tab_properties')">
        <NForm :label-placement="formLabelPlacement" label-width="140" :disabled="loading">
          <NFormItem :label="t('brandForm.localized_names')">
            <div class="field-stack">
              <div
                ref="localizedNamesFieldRef"
                class="field-error-shell"
                :class="{ 'field-error-shell--active': !!fieldErrors.localizedNames }"
              >
                <NDynamicInput v-model:value="localizedNames" :on-create="createLocalizedName" style="width:100%">
                  <template #default="{ index }">
                    <div class="localized-row">
                      <NSelect v-model:value="localizedNames[index].lang"
                        :options="constantsStore.mostUsedLanguagesSimple" filterable style="width:140px" />
                      <NInput v-model:value="localizedNames[index].name" class="localized-row__input" />
                    </div>
                  </template>
                </NDynamicInput>
              </div>
              <div class="field-error-label" :class="{ 'field-error-label--visible': !!fieldErrors.localizedNames }">
                {{ fieldErrors.localizedNames || '\u00A0' }}
              </div>
            </div>
          </NFormItem>

          <NFormItem :label="t('brandForm.country')">
            <div class="field-stack">
              <div
                ref="countryFieldRef"
                class="field-error-shell"
                :class="{ 'field-error-shell--active': !!fieldErrors.country }"
              >
                <NSelect v-model:value="formData.country" :options="constantsStore.countries"
                  filterable clearable style="width: 250px" />
              </div>
              <div class="field-error-label" :class="{ 'field-error-label--visible': !!fieldErrors.country }">
                {{ fieldErrors.country || '\u00A0' }}
              </div>
            </div>
          </NFormItem>

          <NFormItem :label="t('brandForm.description')">
            <div class="field-stack">
              <div class="field-error-shell">
                <NInput v-model:value="formData.description" type="textarea"
                  :autosize="{ minRows: 3, maxRows: 6 }" style="width: 100%" />
              </div>
              <div class="field-error-label"></div>
            </div>
          </NFormItem>

          <NFormItem :label="t('brandForm.time_zone')">
            <div class="field-stack">
              <div
                ref="timeZoneFieldRef"
                class="field-error-shell"
                :class="{ 'field-error-shell--active': !!fieldErrors.timeZone }"
              >
                <NSelect v-model:value="formData.timeZone" :options="constantsStore.timezones"
                  filterable clearable style="width: 280px" />
              </div>
              <div class="field-error-label" :class="{ 'field-error-label--visible': !!fieldErrors.timeZone }">
                {{ fieldErrors.timeZone || '\u00A0' }}
              </div>
            </div>
          </NFormItem>

          <NFormItem :label="t('fragmentForm.genres')">
            <div class="field-stack">
              <div
                ref="genresFieldRef"
                class="field-error-shell"
                :class="{ 'field-error-shell--active': !!fieldErrors.genres }"
              >
                <NSelect
                  v-model:value="formData.genres"
                  :options="genreOptions"
                  filterable
                  multiple
                  clearable
                  style="width: 100%; max-width: 500px"
                />
              </div>
              <div class="field-error-label" :class="{ 'field-error-label--visible': !!fieldErrors.genres }">
                {{ fieldErrors.genres || '\u00A0' }}
              </div>
            </div>
          </NFormItem>

          <NFormItem :label="t('brandForm.bit_rate')">
            <div class="field-stack">
              <div class="field-error-shell">
                <NSlider
                  v-model:value="formData.bitRate"
                  :min="64_000"
                  :max="128_000"
                  :step="32_000"
                  :marks="bitRateMarks"
                  :format-tooltip="formatBitRateTooltip"
                  style="max-width: 360px"
                />
              </div>
              <div class="field-error-label"></div>
            </div>
          </NFormItem>

          <NFormItem :label="t('brandForm.public')">
            <div class="field-stack">
              <div class="field-error-shell">
                <NSwitch :value="formData.publicBrand === 1" @update:value="(v) => formData.publicBrand = v ? 1 : 0" />
              </div>
              <div class="field-error-label"></div>
            </div>
          </NFormItem>
        </NForm>
      </NTabPane>

      <NTabPane name="dj" :tab="t('brandForm.tab_dj')">
        <NForm :label-placement="formLabelPlacement" label-width="160" :disabled="loading">
          <NFormItem :label="t('brandForm.ai_agent')">
            <div class="field-stack">
              <div
                ref="aiAgentFieldRef"
                class="field-error-shell"
                :class="{ 'field-error-shell--active': !!fieldErrors.aiAgentId }"
              >
                <NSelect v-model:value="formData.aiAgentId" :options="agentOptions"
                  :render-label="renderAgentOptionLabel" style="width: 100%" />
              </div>
              <div class="field-error-label" :class="{ 'field-error-label--visible': !!fieldErrors.aiAgentId }">
                {{ fieldErrors.aiAgentId || '\u00A0' }}
              </div>
            </div>
          </NFormItem>

          <NFormItem v-if="selectedAgent?.description" :label="t('fragmentForm.description')">
            <div class="field-stack">
              <div class="field-error-shell">
                <span style="color: #888; font-size: 13px;">{{ selectedAgent.description }}</span>
              </div>
              <div class="field-error-label"></div>
            </div>
          </NFormItem>

        </NForm>
      </NTabPane>

      <NTabPane name="script" :tab="t('brandForm.tab_script')">
        <NForm :label-placement="formLabelPlacement" label-width="140" :disabled="loading">
          <NFormItem :label="t('brandForm.script')">
            <div class="field-stack">
              <div
                ref="scriptFieldRef"
                class="field-error-shell"
                :class="{ 'field-error-shell--active': !!fieldErrors.scriptId }"
              >
                <NSelect v-model:value="formData.scriptId" :options="scriptOptions"
                  :render-label="renderScriptOptionLabel" filterable style="width: 100%; max-width: 500px" />
              </div>
              <div class="field-error-label" :class="{ 'field-error-label--visible': !!fieldErrors.scriptId }">
                {{ fieldErrors.scriptId || '\u00A0' }}
              </div>
            </div>
          </NFormItem>

          <NFormItem v-if="selectedScript?.description" :label="t('fragmentForm.description')">
            <div class="field-stack">
              <div class="field-error-shell">
                <span style="color: #888; font-size: 13px;">{{ selectedScript.description }}</span>
              </div>
              <div class="field-error-label"></div>
            </div>
          </NFormItem>

          <template v-if="selectedScript?.requiredVariables?.length">
            <NFormItem :label="t('brandForm.variables')">
              <div class="field-stack">
                <div class="field-error-shell" style="max-width: 500px">
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
              </div>
              <div class="field-error-label"></div>
            </NFormItem>
          </template>
        </NForm>
      </NTabPane>

      <NTabPane name="audience" :tab="t('brandForm.tab_audience')">
        <NForm :label-placement="formLabelPlacement" label-width="160" :disabled="loading">
          <NFormItem :label="t('brandForm.audience_type')">
            <div class="field-stack">
              <div class="field-error-shell">
                <NSelect v-model:value="formData.profileId" :options="profileOptions"
                  filterable clearable style="width: 100%; max-width: 500px" />
              </div>
              <div class="field-error-label"></div>
            </div>
          </NFormItem>

          <NFormItem v-if="formData.profileId" :label="t('brandForm.local_name')">
            <div class="field-stack">
              <div class="field-error-shell">
                <NInput v-model:value="formData.profileOverriding.name"
                  :placeholder="t('brandForm.optional_override')" style="width: 100%; max-width: 500px" />
              </div>
              <div class="field-error-label"></div>
            </div>
          </NFormItem>

          <NFormItem v-if="formData.profileId" :label="t('brandForm.additional_info')">
            <div class="field-stack">
              <div class="field-error-shell">
                <NInput v-model:value="formData.profileOverriding.description"
                  type="textarea" :autosize="{ minRows: 3, maxRows: 5 }"
                  :placeholder="t('brandForm.optional_override')" style="width: 100%; max-width: 500px" />
              </div>
              <div class="field-error-label"></div>
            </div>
          </NFormItem>
        </NForm>
      </NTabPane>

      <NTabPane name="features" :tab="t('brandForm.tab_features')">
        <NForm :label-placement="formLabelPlacement" label-width="180" :disabled="loading">
          <NFormItem :label="t('brandForm.one_time_stream')">
            <div class="field-stack">
              <div class="field-error-shell">
                <NSelect v-model:value="formData.oneTimeStreamPolicy" :options="SUBMISSION_POLICY_OPTIONS" style="width: 220px" />
              </div>
              <div class="field-error-label"></div>
            </div>
          </NFormItem>
          <NFormItem :label="t('brandForm.accept_shared_sounds')">
            <div class="field-stack">
              <div class="field-error-shell">
                <NSelect v-model:value="formData.submissionPolicy" :options="SUBMISSION_POLICY_OPTIONS" style="width: 220px" />
              </div>
              <div class="field-error-label"></div>
            </div>
          </NFormItem>
        </NForm>
      </NTabPane>

      <NTabPane name="playerUi" :tab="t('brandForm.tab_player_ui')">
        <NForm :label-placement="formLabelPlacement" label-width="120" :disabled="loading">
          <NFormItem v-if="localizedNames[0]?.name" :label="t('brandForm.preview')">
            <div class="field-stack">
              <div class="field-error-shell">
                <div :style="{
                  fontFamily: formData.titleFont || undefined,
                  fontSize: '34px',
                  lineHeight: '1.1',
                  color: formData.color,
                  padding: '8px 0',
                }">
                  {{ localizedNames[0].name }}
                </div>
              </div>
              <div class="field-error-label"></div>
            </div>
          </NFormItem>

          <NFormItem :label="t('brandForm.title_font')">
            <div class="field-stack">
              <div class="field-error-shell">
                <NSelect v-model:value="formData.titleFont" :options="constantsStore.stationFontOptions"
                  filterable clearable style="width: 280px" />
              </div>
              <div class="field-error-label"></div>
            </div>
          </NFormItem>

          <NFormItem :label="t('brandForm.color')">
            <div class="field-stack">
              <div class="field-error-shell">
                <div style="width: 200px;">
                  <NColorPicker v-model:value="formData.color" />
                </div>
              </div>
              <div class="field-error-label"></div>
            </div>
          </NFormItem>

          <NFormItem :label="t('brandForm.hls_url')">
            <div class="field-stack">
              <div class="field-error-shell">
                <NInput v-model:value="formData.hlsUrl" style="width: 100%; max-width: 480px" />
              </div>
              <div class="field-error-label"></div>
            </div>
          </NFormItem>

          <NFormItem :label="t('brandForm.mixpla_url')">
            <div class="field-stack">
              <div class="field-error-shell">
                <NInput v-model:value="formData.mixplaUrl" style="width: 100%; max-width: 480px" />
              </div>
              <div class="field-error-label"></div>
            </div>
          </NFormItem>
        </NForm>
      </NTabPane>

      <NTabPane name="owner" :tab="t('brandForm.tab_owner')">
        <NForm :label-placement="formLabelPlacement" label-width="120" :disabled="loading">
          <NFormItem :label="t('brandForm.owner_name')">
            <div class="field-stack">
              <div class="field-error-shell">
                <NInput v-model:value="formData.owner.name"
                  :placeholder="t('brandForm.owner_name')" style="width: 100%; max-width: 400px" />
              </div>
              <div class="field-error-label"></div>
            </div>
          </NFormItem>
          <NFormItem :label="t('brandForm.owner_email')">
            <div class="field-stack">
              <div class="field-error-shell">
                <NInput v-model:value="formData.owner.email"
                  placeholder="owner@example.com" style="width: 100%; max-width: 400px" />
              </div>
              <div class="field-error-label"></div>
            </div>
          </NFormItem>
          <NFormItem :label="t('brandForm.expose_while_sharing')">
            <div class="field-stack">
              <div class="field-error-shell">
                <NSwitch v-model:value="formData.owner.exposeWhileSharing" />
              </div>
              <div class="field-error-label"></div>
            </div>
          </NFormItem>
        </NForm>

        <div
          v-if="isEditing"
          style="margin-top: 20px; padding-top: 16px; border-top: 1px solid rgba(255, 0, 0, 0.28); padding-left: 10px;"
        >
          <div style="font-weight: 600; color: #ff6b6b; margin-bottom: 6px;">Danger zone</div>
          <NAnchor style="margin-bottom: 12px;">
            <NAnchorLink
              title="Close this brand and remove it from your brands list."
            />
          </NAnchor>
          <NPopconfirm
            :disabled="loading"
            @positive-click="handleCloseBrand"
          >
            <template #trigger>
              <GsapButton type="error" :disabled="loading"><span>Close Brand</span></GsapButton>
            </template>
            Close this brand?
          </NPopconfirm>
        </div>
      </NTabPane>
    </NTabs>
  </FormWrapper>
</template>

<style scoped>
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

@media (max-width: 768px) {
  :deep(.n-form-item-label) {
    padding-left: 10px !important;
  }

  .field-stack {
    padding-right: 10px;
  }
}
</style>
