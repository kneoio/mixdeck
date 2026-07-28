<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { gsap } from 'gsap'
import { NForm, NFormItem, NInput, NInputNumber, NSelect, NSwitch, NRadioGroup, NRadioButton, NTabs, NTabPane, useMessage, type SelectOption } from 'naive-ui'
import MarkdownIt from 'markdown-it'
import GsapButton from '@/components/GsapButton.vue'
import FormWrapper from '@/components/FormWrapper.vue'
import { useBrandsStore } from '@/stores/brands'
import type { Script } from '@/stores/scripts'
import { useOtsDefinitionsStore } from '@/stores/otsDefinitions'
import datanestApiService from '@/services/datanestApi'
import { handleApiError } from '@/utils/notificationService'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const message = useMessage()
const brandsStore = useBrandsStore()
const otsDefinitionsStore = useOtsDefinitionsStore()

const isEditing = computed(() => !!route.params.otsId && route.params.otsId !== 'new')
const loading = ref(false)
const isMobile = ref(false)
const activeTab = ref('variables')
const isTabChangeFromValidation = ref(false)
const backRoute = '/one-time-streams'

type ValidationField = 'source'
const sourceFieldRef = ref<HTMLElement | null>(null)
const fieldErrors = ref<Record<ValidationField, string>>({ source: '' })

function updateIsMobile() {
  isMobile.value = window.innerWidth <= 768
}
const formLabelPlacement = computed(() => (isMobile.value ? 'top' : 'left'))

const formTitle = computed(() => (isEditing.value ? t('otsForm.edit_title') : t('otsForm.title')))
const formSubtitle = computed(() => (isEditing.value ? t('otsForm.edit_subtitle') : t('otsForm.create_subtitle')))

const formData = ref({
  name: '',
  scriptId: null as string | null,
  scope: 'default' as 'brand' | 'default',
  brandId: null as string | null,
  agentId: null as string | null,
})
const scriptDetail = ref<Script | null>(null)
const otsStatus = ref<string | null>(null)
const otsType = ref<string | null>(null)
const variables = reactive<Record<string, unknown>>({})
const varErrors = reactive<Record<string, string>>({})
const agentOptions = ref<SelectOption[]>([])
const loadingAgents = ref(false)

const brandOptions = computed(() =>
  brandsStore.brands.map((brand) => ({ label: brand.localizedName?.['en'] || brand.title || brand.slugName || '', value: brand.slugName! }))
)

const md = new MarkdownIt()
function renderScriptDescription(description: string) {
  return md.render(description)
}

async function loadScriptDetail() {
  if (!formData.value.scriptId) return
  scriptDetail.value = await datanestApiService.getScriptDetail(formData.value.scriptId)
}

/**
 * Prefill name/scriptId/requiredVariables/color from the datanest "new" doc endpoint (derived
 * server-side from the script), then fall back to getScriptDetail only for the description text,
 * which the template endpoint doesn't return.
 */
async function loadOtsTemplate(scriptId: string) {
  const template = await datanestApiService.getOtsDefinitionTemplate(scriptId)
  formData.value.name = template?.name ?? ''
  formData.value.scriptId = template?.scriptId ?? scriptId
  await loadScriptDetail()
  if (scriptDetail.value) {
    scriptDetail.value = {
      ...scriptDetail.value,
      name: template?.name ?? scriptDetail.value.name,
      color: template?.color ?? scriptDetail.value.color,
      requiredVariables: template?.requiredVariables ?? scriptDetail.value.requiredVariables,
    }
  }
}

function clearVarError(name: string) {
  if (varErrors[name]) delete varErrors[name]
}

function getFieldRef(field: ValidationField) {
  return field === 'source' ? sourceFieldRef.value : null
}

function getFieldLabel(field: ValidationField) {
  return field === 'source' ? t('overview.ots_scope_label') : ''
}

function clearFieldError(field: ValidationField) {
  if (!fieldErrors.value[field]) return
  fieldErrors.value[field] = ''
  const target = getFieldRef(field)
  if (target) {
    gsap.to(target, { borderLeftColor: 'rgba(255,77,79,0)', duration: 0.2, ease: 'power1.out' })
  }
}

function clearAllFieldErrors() {
  clearFieldError('source')
  Object.keys(varErrors).forEach((key) => delete varErrors[key])
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

async function loadAgents() {
  loadingAgents.value = true
  try {
    let endpoint = '/dictionary/agents'
    if (formData.value.scope === 'brand' && formData.value.brandId) {
      const brand = brandsStore.brands.find((b) => b.slugName === formData.value.brandId)
      endpoint = `/dictionary/agents?brand=${encodeURIComponent(brand?.slugName ?? '')}`
    }
    const result = await datanestApiService.getPagedDictionary<any>(endpoint, 1, 100)
    agentOptions.value = result.entries.map((a: any) => ({ label: a.name || a.id, value: a.id }))
  } finally {
    loadingAgents.value = false
  }
}

function onScopeChange() {
  formData.value.brandId = null
  formData.value.agentId = null
  agentOptions.value = []
  clearFieldError('source')
  if (formData.value.scope === 'default') loadAgents()
}

function onBrandChange() {
  formData.value.agentId = null
  agentOptions.value = []
  loadAgents()
}

function scopeValid(): boolean {
  return formData.value.scope === 'brand' ? !!formData.value.brandId : !!formData.value.agentId
}

function validateVariables(): boolean {
  const vars = scriptDetail.value?.requiredVariables ?? []
  Object.keys(varErrors).forEach((key) => delete varErrors[key])
  for (const v of vars) {
    if (!v.required) continue
    const val = variables[v.name]
    const empty = val === undefined || val === null || (typeof val === 'string' && val.trim() === '')
    if (empty) varErrors[v.name] = t('common.required_field', { field: v.description || v.name })
  }
  return Object.keys(varErrors).length === 0
}

async function validateBeforeSave(): Promise<boolean> {
  const invalidFields: ValidationField[] = []
  if (!scopeValid()) invalidFields.push('source')

  const allFields: ValidationField[] = ['source']
  for (const field of allFields) {
    if (!invalidFields.includes(field)) clearFieldError(field)
  }

  const variablesValid = validateVariables()
  if (!invalidFields.length && variablesValid) return true

  isTabChangeFromValidation.value = true
  activeTab.value = invalidFields.length ? 'properties' : 'variables'
  await nextTick()
  isTabChangeFromValidation.value = false
  await Promise.all(invalidFields.map((field) => showFieldError(field, t('overview.ots_agent_required'))))
  return false
}

async function handleSave() {
  const valid = await validateBeforeSave()
  if (!valid) return
  loading.value = true
  try {
    const payload = {
      name: formData.value.name || null,
      scriptId: formData.value.scriptId!,
      userVariables: { ...variables },
      brandId: formData.value.scope === 'brand' ? formData.value.brandId : null,
      agentId: formData.value.agentId || null,
    }
    if (isEditing.value) {
      await otsDefinitionsStore.updateOtsDefinition(route.params.otsId as string, payload)
    } else {
      await otsDefinitionsStore.createOtsDefinition(payload)
    }
    message.success(t('otsForm.saved'))
    router.push(backRoute)
  } catch (error: any) {
    handleApiError(error, message)
  } finally {
    loading.value = false
  }
}

function navigateBack() {
  router.push(backRoute)
}

watch(() => formData.value.brandId, (value) => { if (value) clearFieldError('source') })
watch(() => formData.value.agentId, (value) => { if (value) clearFieldError('source') })
watch(activeTab, () => {
  if (isTabChangeFromValidation.value) return
  clearAllFieldErrors()
})

onMounted(async () => {
  updateIsMobile()
  window.addEventListener('resize', updateIsMobile)
  loading.value = true
  try {
    if (isEditing.value) {
      const def = await otsDefinitionsStore.fetchOtsDefinition(route.params.otsId as string)
      formData.value.name = def.name ?? ''
      formData.value.scriptId = def.scriptId
      Object.assign(variables, def.userVariables || {})
      formData.value.scope = def.brandId ? 'brand' : 'default'
      formData.value.brandId = def.brandId
      formData.value.agentId = def.agentId
      otsStatus.value = def.status ?? null
      otsType.value = def.type ?? null
      await loadScriptDetail()
      await loadAgents()
    } else {
      const queryScriptId = route.query.scriptId
      if (typeof queryScriptId !== 'string') {
        router.push('/one-time-streams')
        return
      }
      formData.value.scriptId = queryScriptId
      await loadOtsTemplate(queryScriptId)
      await loadAgents()
    }
  } catch (error: any) {
    message.error(error?.message || t('otsForm.load_failed'))
    if (isEditing.value) navigateBack()
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <FormWrapper :title="formTitle" :subtitle="formSubtitle" :loading="loading">
    <template #actions>
      <div class="gsap-row">
        <GsapButton @click="navigateBack"><span>{{ t('common.close') }}</span></GsapButton>
        <GsapButton type="primary" :disabled="loading" @click="handleSave"><span>{{ t('common.save') }}</span></GsapButton>
      </div>
    </template>

    <NTabs v-model:value="activeTab">
      <NTabPane name="variables" :tab="t('otsForm.tab_variables')">
        <NForm :label-placement="formLabelPlacement" label-width="140" :disabled="loading">
          <template v-if="scriptDetail?.requiredVariables?.length">
            <NFormItem v-for="variable in scriptDetail.requiredVariables" :key="variable.name" :show-feedback="false">
              <template #label>
                <span>{{ variable.description }}<span v-if="variable.required" class="ots-variable__required">*</span></span>
              </template>
              <div class="field-stack">
                <div class="field-error-shell" :class="{ 'field-error-shell--active': !!varErrors[variable.name] }">
                  <NSwitch v-if="variable.type === 'boolean'" v-model:value="variables[variable.name]" />
                  <NInputNumber v-else-if="variable.type === 'number'" v-model:value="variables[variable.name]" style="width: 100%" @update:value="clearVarError(variable.name)" />
                  <NInput v-else v-model:value="variables[variable.name]" style="width: 100%" @update:value="clearVarError(variable.name)" />
                </div>
                <div class="field-error-label" :class="{ 'field-error-label--visible': !!varErrors[variable.name] }">
                  {{ varErrors[variable.name] || ' ' }}
                </div>
              </div>
            </NFormItem>
          </template>
          <p v-else class="ots-no-variables">{{ formData.scriptId ? t('overview.ots_no_variables') : t('overview.ots_pick_script_first') }}</p>
        </NForm>
      </NTabPane>

      <NTabPane name="properties" :tab="t('otsForm.tab_properties')">
        <NForm :label-placement="formLabelPlacement" label-width="140" :disabled="loading">
          <NFormItem :label="t('otsForm.name_label')" :show-feedback="false">
            <div class="field-stack">
              <div class="field-error-shell">
                <NInput v-model:value="formData.name" :placeholder="t('otsForm.name_label')" />
              </div>
              <div class="field-error-label"></div>
            </div>
          </NFormItem>
          <NFormItem v-if="isEditing" :label="t('otsForm.status_label')" :show-feedback="false">
            <div class="field-stack">
              <div class="field-error-shell">
                <span>{{ otsStatus }}</span>
              </div>
              <div class="field-error-label"></div>
            </div>
          </NFormItem>
          <NFormItem v-if="isEditing" :label="t('otsForm.type_label')" :show-feedback="false">
            <div class="field-stack">
              <div class="field-error-shell">
                <span>{{ otsType }}</span>
              </div>
              <div class="field-error-label"></div>
            </div>
          </NFormItem>

          <NFormItem :label="t('overview.ots_scope_label')" :show-feedback="false">
            <div class="field-stack">
              <div class="field-error-shell">
                <NRadioGroup v-model:value="formData.scope" @update:value="onScopeChange">
                  <NRadioButton value="brand">{{ t('overview.ots_scope_brand') }}</NRadioButton>
                  <NRadioButton value="default">{{ t('overview.ots_scope_default') }}</NRadioButton>
                </NRadioGroup>
              </div>
              <div class="field-error-label"></div>
            </div>
          </NFormItem>

          <NFormItem v-if="formData.scope === 'brand'" :label="t('overview.ots_pick_brand')" :show-feedback="false">
            <div class="field-stack">
              <div ref="sourceFieldRef" class="field-error-shell" :class="{ 'field-error-shell--active': !!fieldErrors.source }">
                <NSelect
                  v-model:value="formData.brandId"
                  :options="brandOptions"
                  :placeholder="t('overview.ots_pick_brand')"
                  filterable
                  style="width: 100%"
                  @update:value="onBrandChange"
                />
              </div>
              <div class="field-error-label" :class="{ 'field-error-label--visible': !!fieldErrors.source }">
                {{ fieldErrors.source || ' ' }}
              </div>
            </div>
          </NFormItem>

          <NFormItem v-if="formData.scope !== 'brand'" :label="t('overview.ots_pick_dj')" :show-feedback="false">
            <div class="field-stack">
              <div ref="sourceFieldRef" class="field-error-shell" :class="{ 'field-error-shell--active': !!fieldErrors.source }">
                <NSelect
                  v-model:value="formData.agentId"
                  :options="agentOptions"
                  :loading="loadingAgents"
                  :placeholder="t('overview.ots_pick_dj')"
                  filterable
                  style="width: 100%"
                />
              </div>
              <div class="field-error-label" :class="{ 'field-error-label--visible': !!fieldErrors.source }">
                {{ fieldErrors.source || ' ' }}
              </div>
            </div>
          </NFormItem>
        </NForm>
      </NTabPane>

      <NTabPane name="description" :tab="t('otsForm.tab_description')">
        <p v-if="scriptDetail?.description" class="script-description" v-html="renderScriptDescription(scriptDetail.description)" />
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
.ots-variable__required {
  color: #e74c3c;
  margin-left: 2px;
}
.ots-no-variables {
  opacity: 0.55;
  font-size: 13px;
  margin: 0 0 16px;
}
.script-description {
  font-size: 13px;
  color: #aaa;
  line-height: 1.6;
  margin: -8px 0 16px;
}
.script-description :deep(h1),
.script-description :deep(h2),
.script-description :deep(h3) {
  color: #ddd;
  margin: 8px 0 4px;
}
.script-description :deep(p) { margin: 4px 0; }
.script-description :deep(code) {
  background: #2a2a2a;
  padding: 1px 4px;
  border-radius: 3px;
  font-size: 12px;
}
.script-description :deep(ul),
.script-description :deep(ol) { padding-left: 20px; margin: 4px 0; }
:deep(.n-form-item) { margin-bottom: 20px; }
:deep(.n-form-item:last-child) { margin-bottom: 0; }
@media (max-width: 768px) {
  :deep(.n-form-item-label) { padding-left: 10px !important; }
  .field-stack { padding-right: 10px; }
}
</style>
