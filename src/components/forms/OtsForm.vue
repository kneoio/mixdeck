<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { gsap } from 'gsap'
import { NForm, NFormItem, NInput, NInputNumber, NSelect, NSwitch, NRadioGroup, NRadioButton, NSlider, NTabs, NTabPane, NColorPicker, useMessage, type SelectOption } from 'naive-ui'
import MarkdownIt from 'markdown-it'
import GsapButton from '@/components/GsapButton.vue'
import FormWrapper from '@/components/FormWrapper.vue'
import { useBrandsStore } from '@/stores/brands'
import type { Script, ScriptScene } from '@/stores/scripts'
import { useOtsDefinitionsStore } from '@/stores/otsDefinitions'
import datanestApiService from '@/services/datanestApi'
import { handleApiError } from '@/utils/notificationService'

const DURATION_SLIDER_MIN = 1
const DURATION_SLIDER_MAX = 7200
const DURATION_SLIDER_STEP = 1

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const message = useMessage()
const brandsStore = useBrandsStore()
const otsDefinitionsStore = useOtsDefinitionsStore()

const isEditing = computed(() => !!route.params.slugName && route.params.slugName !== 'new')
const loading = ref(false)
const isMobile = ref(false)
const activeTab = ref('variables')
const isTabChangeFromValidation = ref(false)
const returnToRoute = computed(() => {
  const value = route.query.returnTo
  return typeof value === 'string' && value ? value : null
})
const backRoute = computed(() => returnToRoute.value ?? '/one-time-streams')

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
  scriptSlug: null as string | null,
  scope: 'default' as 'brand' | 'default',
  brandSlug: null as string | null,
  agentSlug: null as string | null,
  color: '#000000',
  publicOts: 1,
})
const privatePremiumGlow = ref(false)
const scriptDetail = ref<Script | null>(null)
const otsStatus = ref<string | null>(null)
const otsType = ref<string | null>(null)
const variables = reactive<Record<string, any>>({})
const varErrors = reactive<Record<string, string>>({})
const agentOptions = ref<SelectOption[]>([])
const loadingAgents = ref(false)
/** Current duration values shown in the UI (loop scenes only). */
const sceneDurationValues = reactive<Record<string, number>>({})
/** Stored overrides loaded from the definition (loop scenes only). */
const storedSceneDurations = ref<Record<string, number>>({})

function isOneTimeScene(scene: ScriptScene): boolean {
  return scene.sceneType === 'ONE_TIME' || scene.oneTimeRun === true
}

const orderedScenes = computed(() => scriptDetail.value?.scenes ?? [])

function sceneInheritedSeconds(scene: ScriptScene): number {
  return scene.durationSeconds && scene.durationSeconds > 0 ? scene.durationSeconds : DURATION_SLIDER_MIN
}

function isSceneOverridden(scene: ScriptScene): boolean {
  if (isOneTimeScene(scene) || !scene.id) return false
  const current = sceneDurationValues[scene.id]
  if (current === undefined) return false
  return current !== sceneInheritedSeconds(scene)
}

function clampDuration(seconds: number): number {
  return Math.min(DURATION_SLIDER_MAX, Math.max(DURATION_SLIDER_MIN, Math.round(seconds)))
}

function initSceneDurationValues(overrides: Record<string, number> = {}) {
  Object.keys(sceneDurationValues).forEach((key) => delete sceneDurationValues[key])
  const nextStored: Record<string, number> = {}
  for (const scene of orderedScenes.value) {
    if (!scene.id || isOneTimeScene(scene)) continue
    const inherited = sceneInheritedSeconds(scene)
    const override = overrides[scene.id]
    if (override != null && override > 0) {
      sceneDurationValues[scene.id] = clampDuration(override)
      nextStored[scene.id] = override
    } else {
      sceneDurationValues[scene.id] = clampDuration(inherited)
    }
  }
  storedSceneDurations.value = nextStored
}

function resetSceneDuration(scene: ScriptScene) {
  if (!scene.id || isOneTimeScene(scene)) return
  sceneDurationValues[scene.id] = clampDuration(sceneInheritedSeconds(scene))
}

function buildSceneDurationsPayload(): Record<string, number> | undefined {
  const map: Record<string, number> = {}
  for (const scene of orderedScenes.value) {
    if (!scene.id || isOneTimeScene(scene)) continue
    const value = sceneDurationValues[scene.id]
    if (value == null || value <= 0) continue
    if (value === sceneInheritedSeconds(scene)) continue
    map[scene.id] = Math.round(value)
  }
  return Object.keys(map).length ? map : undefined
}

function formatDurationLabel(seconds: number): string {
  const total = Math.max(0, Math.round(seconds))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  if (h > 0) {
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

const brandOptions = computed(() =>
  brandsStore.brands.map((brand) => ({ label: brand.localizedName?.['en'] || brand.title || brand.slugName || '', value: brand.slugName! }))
)

const md = new MarkdownIt()
function renderScriptDescription(description: string) {
  return md.render(description)
}

async function loadScriptDetail() {
  if (!formData.value.scriptSlug) return
  scriptDetail.value = await datanestApiService.getScriptDetail(formData.value.scriptSlug)
  initSceneDurationValues(storedSceneDurations.value)
}

/**
 * Prefill name/scriptSlug/requiredVariables/color from the datanest "new" doc endpoint (derived
 * server-side from the script), then fall back to getScriptDetail only for the description text,
 * which the template endpoint doesn't return.
 */
async function loadOtsTemplate(scriptSlug: string) {
  const template = await datanestApiService.getOtsDefinitionTemplate(scriptSlug)
  formData.value.name = template?.name ?? ''
  formData.value.scriptSlug = template?.scriptSlug ?? scriptSlug
  formData.value.color = template?.color || '#000000'
  formData.value.publicOts = template?.publicOts ?? 1
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
    if (formData.value.scope === 'brand' && formData.value.brandSlug) {
      const brand = brandsStore.brands.find((b) => b.slugName === formData.value.brandSlug)
      endpoint = `/dictionary/agents?brand=${encodeURIComponent(brand?.slugName ?? '')}`
    }
    const result = await datanestApiService.getPagedDictionary<any>(endpoint, 1, 100)
    agentOptions.value = result.entries.map((a: any) => ({
      label: a.name || a.slugName,
      value: a.slugName,
    }))
  } finally {
    loadingAgents.value = false
  }
}

function handlePrivateToggle(v: boolean) {
  if (!v) { formData.value.publicOts = 1; return }
  privatePremiumGlow.value = true
  message.warning(t('otsForm.private_premium_only'))
  setTimeout(() => { privatePremiumGlow.value = false }, 1500)
}

function onScopeChange() {
  formData.value.brandSlug = null
  formData.value.agentSlug = null
  agentOptions.value = []
  clearFieldError('source')
  if (formData.value.scope === 'default') loadAgents()
}

function onBrandChange() {
  formData.value.agentSlug = null
  agentOptions.value = []
  loadAgents()
}

function scopeValid(): boolean {
  return formData.value.scope === 'brand' ? !!formData.value.brandSlug : !!formData.value.agentSlug
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
      name: formData.value.name || undefined,
      scriptSlug: formData.value.scriptSlug!,
      userVariables: { ...variables },
      brandSlug: formData.value.scope === 'brand' ? formData.value.brandSlug : null,
      agentSlug: formData.value.agentSlug || null,
      color: formData.value.color || undefined,
      publicOts: formData.value.publicOts,
      sceneDurations: buildSceneDurationsPayload() ?? {},
    }
    if (isEditing.value) {
      await otsDefinitionsStore.updateOtsDefinition(route.params.slugName as string, payload)
    } else {
      await otsDefinitionsStore.createOtsDefinition(payload)
    }
    message.success(t('otsForm.saved'))
    router.push(backRoute.value)
  } catch (error: any) {
    handleApiError(error, message)
  } finally {
    loading.value = false
  }
}

function navigateBack() {
  router.push(backRoute.value)
}

watch(() => formData.value.brandSlug, (value) => { if (value) clearFieldError('source') })
watch(() => formData.value.agentSlug, (value) => { if (value) clearFieldError('source') })
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
      const def = await otsDefinitionsStore.fetchOtsDefinition(route.params.slugName as string)
      formData.value.name = def.name ?? ''
      formData.value.scriptSlug = def.scriptSlug
      formData.value.color = def.color || '#000000'
      formData.value.publicOts = def.publicOts ?? 1
      Object.assign(variables, def.userVariables || {})
      formData.value.scope = def.brandSlug ? 'brand' : 'default'
      formData.value.brandSlug = def.brandSlug
      formData.value.agentSlug = def.agentSlug
      otsStatus.value = def.status ?? null
      otsType.value = def.type ?? null
      const loadedOverrides: Record<string, number> = {}
      if (def.sceneDurations && typeof def.sceneDurations === 'object') {
        for (const [sceneId, seconds] of Object.entries(def.sceneDurations as Record<string, number>)) {
          if (typeof seconds === 'number' && seconds > 0) loadedOverrides[sceneId] = seconds
        }
      }
      storedSceneDurations.value = loadedOverrides
      await loadScriptDetail()
      await loadAgents()
    } else {
      const queryScriptSlug = route.query.scriptSlug
      if (typeof queryScriptSlug !== 'string') {
        router.push(backRoute.value)
        return
      }
      formData.value.scriptSlug = queryScriptSlug
      await loadOtsTemplate(queryScriptSlug)
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
          <p v-else class="ots-no-variables">{{ formData.scriptSlug ? t('overview.ots_no_variables') : t('overview.ots_pick_script_first') }}</p>
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
          <NFormItem :label="t('otsForm.color')" :show-feedback="false">
            <div class="field-stack">
              <div class="field-error-shell">
                <div style="width: 200px;">
                  <NColorPicker v-model:value="formData.color" />
                </div>
              </div>
              <div class="field-error-label"></div>
            </div>
          </NFormItem>
          <NFormItem>
            <template #label>
              <span class="form-label-with-badge">
                {{ t('otsForm.private') }}
                <span class="premium-badge" :class="{ 'premium-badge--glow': privatePremiumGlow }">premium</span>
              </span>
            </template>
            <div class="field-stack">
              <div class="field-error-shell">
                <NSwitch :value="formData.publicOts === 0" @update:value="handlePrivateToggle" />
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
                  v-model:value="formData.brandSlug"
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
                  v-model:value="formData.agentSlug"
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

      <NTabPane name="scenes" :tab="t('otsForm.tab_scenes')">
        <div v-if="orderedScenes.length" class="ots-scenes">
          <div
            v-for="scene in orderedScenes"
            :key="scene.id"
            class="ots-scene-row"
            :class="{ 'ots-scene-row--overridden': isSceneOverridden(scene) }"
          >
            <div class="ots-scene-row__title">
              <span>{{ scene.title || scene.id }}</span>
              <span
                v-if="isSceneOverridden(scene)"
                class="ots-scene-row__badge"
              >{{ t('otsForm.scene_duration_overridden') }}</span>
            </div>

            <template v-if="!isOneTimeScene(scene) && scene.id">
              <div class="ots-scene-row__controls">
                <NSlider
                  :value="sceneDurationValues[scene.id]"
                  :min="DURATION_SLIDER_MIN"
                  :max="DURATION_SLIDER_MAX"
                  :step="DURATION_SLIDER_STEP"
                  :disabled="loading"
                  style="flex: 1"
                  @update:value="(v) => { sceneDurationValues[scene.id!] = typeof v === 'number' ? v : sceneInheritedSeconds(scene) }"
                />
                <span class="ots-scene-row__value">{{ formatDurationLabel(sceneDurationValues[scene.id] ?? sceneInheritedSeconds(scene)) }}</span>
                <button
                  v-if="isSceneOverridden(scene)"
                  type="button"
                  class="ots-scene-row__reset"
                  :disabled="loading"
                  @click="resetSceneDuration(scene)"
                >{{ t('otsForm.scene_duration_reset') }}</button>
              </div>
              <div class="ots-scene-row__inherited">
                {{ t('otsForm.scene_duration_inherited', { n: formatDurationLabel(sceneInheritedSeconds(scene)) }) }}
              </div>
            </template>
          </div>
        </div>
        <p v-else class="ots-no-variables">{{ t('otsForm.scene_no_scenes') }}</p>
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
.form-label-with-badge {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 3px;
}
.premium-badge {
  display: inline-block;
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.35);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 3px;
  padding: 0px 4px;
  transition: color 0.3s, border-color 0.3s, box-shadow 0.3s;
}
.premium-badge--glow {
  color: #f0a500;
  border-color: rgba(240, 165, 0, 0.5);
  box-shadow: 0 0 7px 2px rgba(240, 165, 0, 0.4);
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
.ots-scenes {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 8px;
}
.ots-scene-row {
  border: 1px solid #2a2a2a;
  border-radius: 8px;
  padding: 14px 16px;
  background: rgba(255, 255, 255, 0.03);
  border-left: 2px solid #2a2a2a;
}
.ots-scene-row--overridden {
  border-left-color: rgba(64, 158, 255, 0.85);
}
.ots-scene-row__title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #ddd;
  margin-bottom: 10px;
}
.ots-scene-row__badge {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #409eff;
  opacity: 0.9;
}
.ots-scene-row__controls {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
}
.ots-scene-row__value {
  min-width: 64px;
  text-align: right;
  font-size: 12px;
  color: #bbb;
  font-variant-numeric: tabular-nums;
}
.ots-scene-row__reset {
  appearance: none;
  background: none;
  border: none;
  padding: 0;
  margin: 0;
  font: inherit;
  font-size: 11px;
  color: #888;
  cursor: pointer;
  text-decoration: underline;
  text-underline-offset: 2px;
  white-space: nowrap;
}
.ots-scene-row__reset:hover:not(:disabled) {
  color: #bbb;
}
.ots-scene-row__reset:disabled {
  opacity: 0.5;
  cursor: default;
}
.ots-scene-row__inherited {
  margin-top: 6px;
  font-size: 11px;
  color: #888;
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
