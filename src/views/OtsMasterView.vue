<template>
  <n-config-provider :theme="darkTheme" :theme-overrides="themeOverrides">
    <div class="submission-page">
      <div class="side-label neon-motto">{{ t('otsMaster.title') }}</div>

      <header class="nav">
        <div class="logo" @click="router.push('/')">MIXPLA</div>
        <div class="side-label-mobile neon-motto">{{ t('otsMaster.title') }}</div>
      </header>

      <div class="page-center">
        <section class="submission-card">
          <div class="wizard-steps">
            <template v-for="n in stepCount" :key="n">
              <div v-if="n > 1" class="wizard-connector" :class="{ done: step > n - 1 }" />
              <div class="wizard-step" :class="{ active: step === n, done: step > n }">
                <div class="wizard-dot"><span class="arcade step-led">{{ n }}</span></div>
              </div>
            </template>
          </div>

          <transition name="slide" mode="out-in">
            <div v-if="panel === 'auth'" key="auth" class="wizard-body">
              <p class="step-intro">{{ t('otsMaster.intro') }}</p>

              <div class="field-row">
                <label class="field-label">{{ t('submission.email_placeholder') }}</label>
                <div class="field-error-shell" :class="{ 'field-error-shell--active': !!fieldErrors.email }">
                  <div class="inline-row">
                    <n-input
                      v-model:value="email"
                      :placeholder="t('submission.email_placeholder')"
                      :disabled="codeSent"
                      autofocus
                      @keydown.enter="sendCode"
                    />
                    <GsapButton type="primary" :disabled="loading || codeSent" @click="sendCode">
                      <span>{{ t('submission.send_code') }}</span>
                    </GsapButton>
                  </div>
                </div>
                <div class="field-error-label" :class="{ 'field-error-label--visible': !!fieldErrors.email }">{{ fieldErrors.email || ' ' }}</div>
                <div class="field-success-label" :class="{ 'field-success-label--visible': codeSent }">{{ codeSent ? t('submission.code_sent_message') : ' ' }}</div>
              </div>

              <div class="field-row">
                <label class="field-label">{{ t('submission.code_placeholder') }}</label>
                <div class="field-error-shell" :class="{ 'field-error-shell--active': !!fieldErrors.code }">
                  <div class="inline-row">
                    <n-input
                      v-model:value="code"
                      :placeholder="t('submission.code_placeholder')"
                      :disabled="!codeSent || codeLocked"
                      maxlength="6"
                      @keydown.enter="verifyAndNext"
                    />
                    <GsapButton type="primary" :disabled="loading || !codeSent || codeLocked" @click="verifyAndNext">
                      <span>{{ t('submission.verify') }}</span>
                    </GsapButton>
                  </div>
                </div>
                <div class="field-error-label" :class="{ 'field-error-label--visible': !!fieldErrors.code }">{{ fieldErrors.code || ' ' }}</div>
              </div>
              <div class="wizard-actions">
                <button class="back-btn" type="button" @click="router.push('/')">← {{ t('auth.back_home') }}</button>
                <span />
              </div>
            </div>

            <div v-else-if="panel === 'type'" key="type" class="wizard-body">
              <p class="step-intro">{{ t('otsMaster.type_body') }}</p>
              <n-skeleton v-if="typesLoading" height="72px" :sharp="false" :repeat="3" />
              <p v-else-if="!scripts.length" class="empty-hint">{{ t('otsMaster.no_types') }}</p>
              <div v-else class="type-list">
                <button
                  v-for="script in scripts"
                  :key="script.slugName"
                  type="button"
                  class="type-card"
                  :class="{ 'type-card--selected': selectedScriptSlug === script.slugName }"
                  @click="selectType(script.slugName)"
                >
                  <span class="type-card__name">{{ script.name }}</span>
                  <div
                    v-if="script.description"
                    class="type-card__description"
                    v-html="renderScriptDescription(script.description)"
                  />
                  <span v-if="script.tags?.length" class="type-card__tags">
                    <span
                      v-for="tag in script.tags"
                      :key="tag.identifier"
                      class="type-tag"
                      :style="{ color: tag.color || '#ececec', borderColor: tag.color || '#ececec' }"
                    >{{ tag.name || tag.identifier }}</span>
                  </span>
                </button>
              </div>
              <div class="field-error-label" :class="{ 'field-error-label--visible': !!fieldErrors.type }">{{ fieldErrors.type || ' ' }}</div>
              <div class="wizard-actions">
                <button class="back-btn" type="button" @click="router.push('/')">← {{ t('auth.back_home') }}</button>
                <GsapButton type="primary" :disabled="typesLoading" @click="goToParams">
                  <span>{{ t('otsMaster.next') }}</span>
                </GsapButton>
              </div>
            </div>

            <div v-else-if="panel === 'params'" key="params" class="wizard-body">
              <n-skeleton v-if="paramsLoading" height="40px" :sharp="false" :repeat="4" />
              <template v-else>
                <div class="field-row">
                  <label class="field-label">{{ t('otsForm.name_label') }}<span class="required">*</span></label>
                  <div class="field-error-shell" :class="{ 'field-error-shell--active': !!fieldErrors.name }">
                    <n-input
                      v-model:value="formData.name"
                      :placeholder="t('otsForm.name_label')"
                      @update:value="fieldErrors.name = ''"
                    />
                  </div>
                  <div class="field-error-label" :class="{ 'field-error-label--visible': !!fieldErrors.name }">{{ fieldErrors.name || ' ' }}</div>
                </div>

                <template v-if="requiredVariables.length || optionalVariables.length">
                  <div v-for="variable in requiredVariables" :key="variable.name" class="field-row">
                    <label class="field-label">
                      {{ variable.description || variable.name }}<span class="required">*</span>
                    </label>
                    <div class="field-error-shell" :class="{ 'field-error-shell--active': !!varErrors[variable.name] }">
                      <n-switch v-if="variable.type === 'boolean'" v-model:value="variables[variable.name]" />
                      <n-input-number
                        v-else-if="variable.type === 'number'"
                        v-model:value="variables[variable.name]"
                        style="width: 100%"
                        @update:value="clearVarError(variable.name)"
                      />
                      <n-input
                        v-else
                        v-model:value="variables[variable.name]"
                        style="width: 100%"
                        @update:value="clearVarError(variable.name)"
                      />
                    </div>
                    <div class="field-error-label" :class="{ 'field-error-label--visible': !!varErrors[variable.name] }">{{ varErrors[variable.name] || ' ' }}</div>
                  </div>
                  <n-collapse
                    v-if="optionalVariables.length"
                    v-model:expanded-names="optionalExpanded"
                    class="optional-vars"
                    display-directive="show"
                  >
                    <n-collapse-item name="optional">
                      <template #header>
                        <span class="optional-title">
                          {{ t('otsMaster.optional_fields') }}
                          <span class="optional-hint">({{ t('otsMaster.optional_hint') }})</span>
                        </span>
                      </template>
                      <div v-for="variable in optionalVariables" :key="variable.name" class="field-row">
                        <label class="field-label">{{ variable.description || variable.name }}</label>
                        <div class="field-error-shell">
                          <n-switch v-if="variable.type === 'boolean'" v-model:value="variables[variable.name]" />
                          <n-input-number
                            v-else-if="variable.type === 'number'"
                            v-model:value="variables[variable.name]"
                            style="width: 100%"
                          />
                          <n-input
                            v-else
                            v-model:value="variables[variable.name]"
                            style="width: 100%"
                          />
                        </div>
                      </div>
                    </n-collapse-item>
                  </n-collapse>
                </template>
                <p v-else class="empty-hint">{{ t('overview.ots_no_variables') }}</p>

                <div class="field-row">
                  <label class="field-label">{{ t('overview.ots_scope_label') }}</label>
                  <div class="field-error-shell">
                    <n-radio-group v-model:value="formData.scope" @update:value="onScopeChange">
                      <n-radio-button value="brand">{{ t('overview.ots_scope_brand') }}</n-radio-button>
                      <n-radio-button value="default">{{ t('overview.ots_scope_default') }}</n-radio-button>
                    </n-radio-group>
                  </div>
                </div>

                <div v-if="formData.scope === 'brand'" class="field-row">
                  <label class="field-label">{{ t('overview.ots_pick_brand') }}</label>
                  <div class="field-error-shell" :class="{ 'field-error-shell--active': !!fieldErrors.source }">
                    <n-select
                      v-model:value="formData.brandSlug"
                      :options="brandOptions"
                      :placeholder="t('overview.ots_pick_brand')"
                      filterable
                      @update:value="onBrandChange"
                    />
                  </div>
                  <div class="field-error-label" :class="{ 'field-error-label--visible': !!fieldErrors.source }">{{ fieldErrors.source || ' ' }}</div>
                </div>

                <div v-else class="field-row">
                  <label class="field-label">{{ t('overview.ots_pick_dj') }}</label>
                  <div class="field-error-shell" :class="{ 'field-error-shell--active': !!fieldErrors.source }">
                    <n-select
                      v-model:value="formData.agentSlug"
                      :options="agentOptions"
                      :loading="loadingAgents"
                      :placeholder="t('overview.ots_pick_dj')"
                      filterable
                    />
                  </div>
                  <div class="field-error-label" :class="{ 'field-error-label--visible': !!fieldErrors.source }">{{ fieldErrors.source || ' ' }}</div>
                </div>

                <div v-if="fieldErrors.api" class="error-row">
                  <p class="field-error">{{ fieldErrors.api }}</p>
                </div>

                <div class="wizard-actions">
                  <button class="back-btn" type="button" @click="step = 2">← {{ t('otsMaster.back') }}</button>
                  <GsapButton type="primary" :disabled="loading || paramsLoading" @click="goFromParams">
                    <span>{{ t('otsMaster.next') }}</span>
                  </GsapButton>
                </div>
              </template>
            </div>

            <div v-else-if="panel === 'scenes'" key="scenes" class="wizard-body">
              <p class="step-intro">{{ t('otsForm.tab_scenes') }}</p>
              <div v-if="orderedScenes.length" class="ots-scenes">
                <div
                  v-for="scene in orderedScenes"
                  :key="scene.id"
                  class="ots-scene-row"
                  :class="{ 'ots-scene-row--overridden': isSceneOverridden(scene) }"
                >
                  <div class="ots-scene-row__title">
                    <span>{{ scene.title || scene.id }}</span>
                    <span v-if="isSceneOverridden(scene)" class="ots-scene-row__badge">{{ t('otsForm.scene_duration_overridden') }}</span>
                  </div>
                  <template v-if="!isOneTimeScene(scene) && scene.id">
                    <div class="ots-scene-row__controls">
                      <n-slider
                        :value="sceneDurationValues[scene.id]"
                        :min="DURATION_SLIDER_MIN"
                        :max="DURATION_SLIDER_MAX"
                        :step="DURATION_SLIDER_STEP"
                        :disabled="loading"
                        style="flex: 1"
                        @update:value="(v: number | null) => { sceneDurationValues[scene.id!] = typeof v === 'number' ? v : sceneInheritedSeconds(scene) }"
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
              <p v-else class="empty-hint">{{ t('otsForm.scene_no_scenes') }}</p>
              <div v-if="fieldErrors.api" class="error-row">
                <p class="field-error">{{ fieldErrors.api }}</p>
              </div>
              <div class="wizard-actions">
                <button class="back-btn" type="button" @click="step = 3">← {{ t('otsMaster.back') }}</button>
                <GsapButton type="primary" :disabled="loading" @click="goToReview">
                  <span>{{ t('otsMaster.next') }}</span>
                </GsapButton>
              </div>
            </div>

            <div v-else-if="panel === 'review'" key="review" class="wizard-body">
              <p class="step-intro">{{ t('otsMaster.review_body') }}</p>
              <div class="summary-box">
                <div class="summary-row">
                  <n-ellipsis class="summary-label">{{ t('otsForm.type_label') }}</n-ellipsis>
                  <span class="summary-value">{{ selectedTypeName }}</span>
                </div>
                <div class="summary-row">
                  <n-ellipsis class="summary-label">{{ t('otsForm.name_label') }}</n-ellipsis>
                  <span class="summary-value">{{ formData.name }}</span>
                </div>
                <div v-for="variable in reviewVariables" :key="variable.name" class="summary-row">
                  <n-ellipsis class="summary-label">{{ reviewFieldLabel(variable.description || variable.name) }}</n-ellipsis>
                  <span class="summary-value">{{ formatVarValue(variable) }}</span>
                </div>
                <div class="summary-row">
                  <n-ellipsis class="summary-label">{{ t('overview.ots_scope_label') }}</n-ellipsis>
                  <span class="summary-value">{{ formData.scope === 'brand' ? t('overview.ots_scope_brand') : t('overview.ots_scope_default') }}</span>
                </div>
                <div class="summary-row">
                  <n-ellipsis class="summary-label">{{ formData.scope === 'brand' ? t('overview.ots_pick_brand') : t('overview.ots_pick_dj') }}</n-ellipsis>
                  <span class="summary-value">{{ sourceLabel }}</span>
                </div>
                <div v-for="scene in orderedScenes" :key="scene.id" class="summary-row">
                  <n-ellipsis class="summary-label">{{ scene.title || scene.id }}</n-ellipsis>
                  <span class="summary-value">{{ sceneReviewDuration(scene) }}</span>
                </div>
                <div v-if="orderedScenes.length" class="summary-row summary-row--total">
                  <n-ellipsis class="summary-label">{{ t('otsMaster.total_time') }}</n-ellipsis>
                  <span class="summary-value">{{ formatHoursMinutes(totalReviewSeconds) }}</span>
                </div>
              </div>
              <div v-if="fieldErrors.api" class="error-row">
                <p class="field-error">{{ fieldErrors.api }}</p>
              </div>
              <div class="wizard-actions">
                <button class="back-btn" type="button" @click="backFromReview">← {{ t('otsMaster.back') }}</button>
                <GsapButton type="primary" :disabled="loading" @click="createStream">
                  <span>{{ loading ? t('otsMaster.creating') : t('otsMaster.create') }}</span>
                </GsapButton>
              </div>
            </div>

            <div v-else-if="panel === 'success'" key="success" class="wizard-body">
              <div class="step step--success">
                <h2>{{ t('otsMaster.success_heading') }}</h2>
                <p class="play-hint">{{ t('otsMaster.play_hint') }}</p>
              </div>
              <div class="summary-box">
                <div class="summary-row">
                  <span class="summary-label">{{ t('otsForm.name_label') }}</span>
                  <span>{{ formData.name }}</span>
                </div>
                <div v-if="createdLink" class="summary-row summary-row--link">
                  <span class="summary-label">{{ t('otsListView.col_link') }}</span>
                  <div class="link-actions">
                    <a :href="createdLink" target="_blank" rel="noopener noreferrer" class="summary-link">{{ createdLink }}</a>
                    <button
                      type="button"
                      class="copy-btn"
                      :class="{ 'copy-btn--done': linkCopied }"
                      :title="t('otsMaster.copy_link')"
                      @click="copyLink"
                    >
                      <svg v-if="!linkCopied" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                      <svg v-else width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                      <span>{{ linkCopied ? t('otsMaster.copied') : t('otsMaster.copy_link') }}</span>
                    </button>
                    <button
                      type="button"
                      class="copy-btn"
                      :title="t('otsMaster.share')"
                      @click="shareLink"
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
                      <span>{{ t('otsMaster.share') }}</span>
                    </button>
                  </div>
                </div>
              </div>
              <div class="success-actions">
                <GsapButton v-if="createdLink" type="primary" @click="openStream">
                  <span>{{ t('otsMaster.open_stream') }}</span>
                </GsapButton>
                <GsapButton @click="createAnother">
                  <span>{{ t('otsMaster.create_another') }}</span>
                </GsapButton>
                <GsapButton @click="router.push('/')">
                  <span>{{ t('otsMaster.finish') }}</span>
                </GsapButton>
              </div>
            </div>
          </transition>
        </section>
      </div>

      <footer class="footer">
        <div class="copyright">© Mixpla</div>
      </footer>
    </div>
  </n-config-provider>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import {
  NConfigProvider,
  NInput,
  NInputNumber,
  NRadioButton,
  NRadioGroup,
  NSelect,
  NSkeleton,
  NSlider,
  NSwitch,
  NCollapse,
  NCollapseItem,
  NEllipsis,
  darkTheme,
  type GlobalThemeOverrides,
  type SelectOption,
} from 'naive-ui'
import MarkdownIt from 'markdown-it'
import GsapButton from '@/components/GsapButton.vue'
import authService, { AuthRequestError } from '@/services/auth'
import datanestApiService from '@/services/datanestApi'
import { useAuthStore } from '@/stores/auth'
import { useBrandsStore } from '@/stores/brands'
import { useOtsDefinitionsStore } from '@/stores/otsDefinitions'
import { useScriptsStore, type Script, type ScriptScene } from '@/stores/scripts'
import { useThemeStore } from '@/stores/theme'

const { t } = useI18n()
const router = useRouter()
const authStore = useAuthStore()
const brandsStore = useBrandsStore()
const scriptsStore = useScriptsStore()
const otsDefinitionsStore = useOtsDefinitionsStore()
const themeStore = useThemeStore()

const themeOverrides = computed<GlobalThemeOverrides>(() => ({
  common: {
    primaryColor: themeStore.accentPalette.base,
    primaryColorHover: themeStore.accentPalette.hover,
    primaryColorPressed: themeStore.accentPalette.pressed,
    primaryColorSuppl: themeStore.accentPalette.base,
  },
  Button: {
    textColorPrimary: '#ffffff',
    textColorHoverPrimary: '#ffffff',
    textColorPressedPrimary: '#ffffff',
    textColorFocusPrimary: '#ffffff',
  },
  Input: {
    heightMedium: '40px',
    fontSizeMedium: '15px',
  },
  InternalSelection: {
    heightMedium: '40px',
    fontSizeMedium: '15px',
  },
}))

const step = ref(1)
const email = ref('')
const code = ref('')
const codeSent = ref(false)
const codeLocked = ref(false)
const failCount = ref(0)
const loading = ref(false)
const typesLoading = ref(false)
const paramsLoading = ref(false)
const loadingAgents = ref(false)

const scripts = computed(() => scriptsStore.scripts)
const selectedScriptSlug = ref<string | null>(null)
const md = new MarkdownIt()

function renderScriptDescription(description: string) {
  return md.render(description)
}
const scriptDetail = ref<Script | null>(null)
const createdLink = ref('')
const linkCopied = ref(false)

const formData = ref({
  name: '',
  scriptSlug: null as string | null,
  scope: 'default' as 'brand' | 'default',
  brandSlug: null as string | null,
  agentSlug: null as string | null,
})
const variables = reactive<Record<string, any>>({})
const varErrors = reactive<Record<string, string>>({})
const agentOptions = ref<SelectOption[]>([])
const DURATION_SLIDER_MIN = 1
const DURATION_SLIDER_MAX = 7200
const DURATION_SLIDER_STEP = 1
const sceneDurationValues = reactive<Record<string, number>>({})

function isOneTimeScene(scene: ScriptScene): boolean {
  return scene.sceneType === 'ONE_TIME' || scene.oneTimeRun === true
}

const orderedScenes = computed(() => scriptDetail.value?.scenes ?? [])
const scriptVariables = computed(() => scriptDetail.value?.requiredVariables ?? [])
const requiredVariables = computed(() => scriptVariables.value.filter((v) => v.required))
const optionalVariables = computed(() => scriptVariables.value.filter((v) => !v.required))
const optionalExpanded = ref<string[]>([])
const hasDurationStep = computed(() => orderedScenes.value.some((scene) => scene.id && !isOneTimeScene(scene)))
const stepCount = computed(() => (hasDurationStep.value ? 6 : 5))
const panel = computed(() => {
  if (step.value <= 1) return 'auth'
  if (step.value === 2) return 'type'
  if (step.value === 3) return 'params'
  if (hasDurationStep.value) {
    if (step.value === 4) return 'scenes'
    if (step.value === 5) return 'review'
    return 'success'
  }
  if (step.value === 4) return 'review'
  return 'success'
})

const selectedTypeName = computed(() =>
  scripts.value.find((s) => s.slugName === selectedScriptSlug.value)?.name
  || scriptDetail.value?.name
  || selectedScriptSlug.value
  || ''
)
const sourceLabel = computed(() => {
  if (formData.value.scope === 'brand') {
    return brandOptions.value.find((o) => o.value === formData.value.brandSlug)?.label
      || formData.value.brandSlug
      || ''
  }
  return agentOptions.value.find((o) => o.value === formData.value.agentSlug)?.label
    || formData.value.agentSlug
    || ''
})
const reviewVariables = computed(() =>
  scriptVariables.value.filter((v) => v.required || hasVarValue(v))
)

function hasVarValue(variable: { name: string; type: string }): boolean {
  const val = variables[variable.name]
  if (variable.type === 'boolean') return true
  return val !== undefined && val !== null && String(val).trim() !== ''
}

function formatVarValue(variable: { name: string; type: string }): string {
  const val = variables[variable.name]
  if (variable.type === 'boolean') return val ? t('otsMaster.review_yes') : t('otsMaster.review_no')
  if (val === undefined || val === null || String(val).trim() === '') return t('otsMaster.review_empty')
  return String(val)
}

function reviewFieldLabel(text: string): string {
  const stripped = text.replace(/\s*\([^)]*\)/g, '').replace(/\s*\([^)]*$/g, '').trim()
  return stripped || text
}

function sceneReviewSeconds(scene: ScriptScene): number {
  if (!isOneTimeScene(scene) && scene.id) {
    return sceneDurationValues[scene.id] ?? sceneInheritedSeconds(scene)
  }
  return sceneInheritedSeconds(scene)
}

function sceneReviewDuration(scene: ScriptScene): string {
  return formatDurationLabel(sceneReviewSeconds(scene))
}

const totalReviewSeconds = computed(() =>
  orderedScenes.value.reduce((sum, scene) => sum + sceneReviewSeconds(scene), 0)
)

function formatHoursMinutes(seconds: number): string {
  const total = Math.max(0, Math.round(seconds))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

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

function initSceneDurationValues() {
  Object.keys(sceneDurationValues).forEach((key) => delete sceneDurationValues[key])
  for (const scene of orderedScenes.value) {
    if (!scene.id || isOneTimeScene(scene)) continue
    sceneDurationValues[scene.id] = clampDuration(sceneInheritedSeconds(scene))
  }
}

function resetSceneDuration(scene: ScriptScene) {
  if (!scene.id || isOneTimeScene(scene)) return
  sceneDurationValues[scene.id] = clampDuration(sceneInheritedSeconds(scene))
}

function buildSceneDurationsPayload(): Record<string, number> {
  const map: Record<string, number> = {}
  for (const scene of orderedScenes.value) {
    if (!scene.id || isOneTimeScene(scene)) continue
    const value = sceneDurationValues[scene.id]
    if (value == null || value <= 0) continue
    if (value === sceneInheritedSeconds(scene)) continue
    map[scene.id] = Math.round(value)
  }
  return map
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

type ValidationField = 'email' | 'code' | 'type' | 'source' | 'api' | 'name'
const fieldErrors = ref<Record<ValidationField, string>>({
  email: '',
  code: '',
  type: '',
  source: '',
  api: '',
  name: '',
})

const brandOptions = computed(() =>
  brandsStore.brands.map((brand) => ({
    label: brand.localizedName?.['en'] || brand.title || brand.slugName || '',
    value: brand.slugName!,
  })),
)

onMounted(async () => {
  if (authStore.isLoading) await authStore.initializeAuth()
  if (authStore.isAuthenticated) {
    step.value = 2
    await loadTypes()
  }
})

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

async function sendCode() {
  fieldErrors.value.email = ''
  const trimmed = email.value.trim()
  if (!isValidEmail(trimmed)) {
    fieldErrors.value.email = t('submission.error_email')
    return
  }
  loading.value = true
  try {
    email.value = trimmed
    await authService.requestOtp(trimmed)
    codeSent.value = true
    codeLocked.value = false
    failCount.value = 0
    code.value = ''
  } catch (e: any) {
    fieldErrors.value.email =
      e instanceof AuthRequestError ? t('auth.error_send_failed') : e?.message || t('auth.error_send_failed')
  } finally {
    loading.value = false
  }
}

async function verifyAndNext() {
  fieldErrors.value.code = ''
  if (codeLocked.value) return
  const otp = code.value.trim()
  if (!otp) {
    fieldErrors.value.code = t('submission.error_code')
    return
  }
  loading.value = true
  try {
    await authService.verifyOtp(email.value.trim(), otp)
    authStore.onLoginSuccess()
    step.value = 2
    await loadTypes()
  } catch {
    failCount.value += 1
    code.value = ''
    if (failCount.value >= authService.maxOtpFailures) {
      codeLocked.value = true
      fieldErrors.value.code = t('auth.error_code_exhausted')
    } else {
      fieldErrors.value.code = t('auth.error_code_invalid')
    }
  } finally {
    loading.value = false
  }
}

async function loadTypes() {
  typesLoading.value = true
  try {
    if (!brandsStore.brands.length) await brandsStore.loadBrands()
    await scriptsStore.loadScripts(1, 100, 'timingMode=RELATIVE_TO_STREAM_START')
  } finally {
    typesLoading.value = false
  }
}

function selectType(slug: string) {
  selectedScriptSlug.value = slug
  fieldErrors.value.type = ''
}

async function goToParams() {
  if (!selectedScriptSlug.value) {
    fieldErrors.value.type = t('otsMaster.type_required')
    return
  }
  step.value = 3
  await loadParams(selectedScriptSlug.value)
}

async function loadParams(scriptSlug: string) {
  paramsLoading.value = true
  fieldErrors.value.api = ''
  Object.keys(variables).forEach((key) => delete variables[key])
  Object.keys(varErrors).forEach((key) => delete varErrors[key])
  optionalExpanded.value = []
  try {
    const template = await datanestApiService.getOtsDefinitionTemplate(scriptSlug)
    formData.value.name = template?.name ?? ''
    formData.value.scriptSlug = template?.scriptSlug ?? scriptSlug
    formData.value.scope = 'default'
    formData.value.brandSlug = null
    formData.value.agentSlug = null
    const detail = await datanestApiService.getScriptDetail(scriptSlug)
    const detailVars = detail?.requiredVariables ?? []
    const templateVars = template?.requiredVariables ?? []
    const detailByName = Object.fromEntries(detailVars.map((v: any) => [v.name, v]))
    const requiredVariables = (templateVars.length ? templateVars : detailVars).map((v: any) => ({
      ...detailByName[v.name],
      ...v,
      required: detailByName[v.name]?.required === true || v.required === true,
    }))
    scriptDetail.value = {
      ...detail,
      name: template?.name ?? detail?.name,
      requiredVariables,
    }
    for (const variable of requiredVariables) {
      variables[variable.name] = variable.type === 'boolean' ? false : variable.type === 'number' ? null : ''
    }
    initSceneDurationValues()
    await loadAgents()
  } catch {
    fieldErrors.value.api = t('otsMaster.load_failed')
  } finally {
    paramsLoading.value = false
  }
}

async function loadAgents() {
  loadingAgents.value = true
  try {
    let endpoint = '/dictionary/agents'
    if (formData.value.scope === 'brand' && formData.value.brandSlug) {
      endpoint = `/dictionary/agents?brand=${encodeURIComponent(formData.value.brandSlug)}`
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

function onScopeChange() {
  formData.value.brandSlug = null
  formData.value.agentSlug = null
  agentOptions.value = []
  fieldErrors.value.source = ''
  if (formData.value.scope === 'default') void loadAgents()
}

function onBrandChange() {
  formData.value.agentSlug = null
  agentOptions.value = []
  fieldErrors.value.source = ''
  void loadAgents()
}

function clearVarError(name: string) {
  if (varErrors[name]) delete varErrors[name]
}

function validateParams(): boolean {
  fieldErrors.value.source = ''
  fieldErrors.value.api = ''
  fieldErrors.value.name = ''
  Object.keys(varErrors).forEach((key) => delete varErrors[key])
  let valid = true
  if (!formData.value.name?.trim()) {
    fieldErrors.value.name = t('common.required_field', { field: t('otsForm.name_label') })
    valid = false
  }
  const vars = scriptDetail.value?.requiredVariables ?? []
  for (const v of vars) {
    if (!v.required) continue
    const val = variables[v.name]
    const empty = val === undefined || val === null || (typeof val === 'string' && val.trim() === '')
    if (empty) {
      varErrors[v.name] = t('common.required_field', { field: v.description || v.name })
      valid = false
    }
  }
  const sourceOk = formData.value.scope === 'brand' ? !!formData.value.brandSlug : !!formData.value.agentSlug
  if (!sourceOk) {
    fieldErrors.value.source = t('overview.ots_agent_required')
    valid = false
  }
  return valid
}

function goFromParams() {
  if (!validateParams()) return
  if (hasDurationStep.value) {
    step.value = 4
    return
  }
  goToReview()
}

function goToReview() {
  fieldErrors.value.api = ''
  step.value = hasDurationStep.value ? 5 : 4
}

function backFromReview() {
  step.value = hasDurationStep.value ? 4 : 3
}

function unwrapDoc(res: any) {
  return res?.payload?.docData ?? res?.docData ?? res
}

async function createStream() {
  if (!validateParams()) {
    step.value = 3
    return
  }
  loading.value = true
  try {
    const res = await otsDefinitionsStore.createOtsDefinition({
      name: formData.value.name || undefined,
      scriptSlug: formData.value.scriptSlug!,
      userVariables: { ...variables },
      brandSlug: formData.value.scope === 'brand' ? formData.value.brandSlug : null,
      agentSlug: formData.value.agentSlug || null,
      sceneDurations: buildSceneDurationsPayload(),
    })
    const doc = unwrapDoc(res)
    const slug = doc?.slugName || ''
    createdLink.value = slug ? `https://mixpla.online/${slug}` : ''
    step.value = hasDurationStep.value ? 6 : 5
  } catch (e: any) {
    fieldErrors.value.api = e?.message || t('otsMaster.create_failed')
  } finally {
    loading.value = false
  }
}

function openStream() {
  if (createdLink.value) window.open(createdLink.value, '_blank', 'noopener,noreferrer')
}

function copyLink() {
  if (!createdLink.value) return
  navigator.clipboard.writeText(createdLink.value)
  linkCopied.value = true
  setTimeout(() => { linkCopied.value = false }, 2000)
}

async function shareLink() {
  if (!createdLink.value) return
  const title = formData.value.name || t('otsMaster.title')
  const text = t('otsMaster.share_text')
  const url = createdLink.value
  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ title, text, url })
      return
    } catch {
      /* cancelled or unsupported — fall through */
    }
  }
  window.open(`https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`, '_blank', 'noopener,noreferrer')
}

function createAnother() {
  selectedScriptSlug.value = null
  scriptDetail.value = null
  createdLink.value = ''
  linkCopied.value = false
  formData.value = { name: '', scriptSlug: null, scope: 'default', brandSlug: null, agentSlug: null }
  Object.keys(variables).forEach((key) => delete variables[key])
  Object.keys(sceneDurationValues).forEach((key) => delete sceneDurationValues[key])
  optionalExpanded.value = []
  fieldErrors.value = { email: '', code: '', type: '', source: '', api: '', name: '' }
  step.value = 2
}
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Press+Start+2P&display=swap');

@font-face {
  font-family: 'Digital Play Italic St';
  src: url('/src/assets/fonts/Digital Play Italic St.ttf') format('truetype');
  font-display: swap;
}

@font-face {
  font-family: 'Kaylon';
  src: url('/src/assets/fonts/kaylonbold.otf') format('opentype');
  font-weight: 700;
  font-style: normal;
  font-display: swap;
}

:global(body) {
  background: #050505;
}

.submission-page {
  min-height: 100vh;
  background: #050505;
  color: #ffffff;
  font-family: 'Inter', sans-serif;
  padding: 24px clamp(16px, 4vw, 64px);
  display: flex;
  flex-direction: column;
}

.page-center {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px 0;
}

.side-label {
  position: fixed;
  left: 16px;
  top: 50%;
  transform: translateY(-50%) rotate(-90deg);
  transform-origin: center center;
  font-size: 0.75rem;
  letter-spacing: 0.4em;
  text-transform: uppercase;
  white-space: nowrap;
  pointer-events: none;
}

.side-label-mobile {
  display: none;
}

@media (max-width: 768px) {
  .side-label {
    display: none;
  }
  .side-label-mobile {
    display: inline-block;
    margin-left: 12px;
    font-size: 0.7rem;
    letter-spacing: 0.25em;
    text-transform: uppercase;
    white-space: nowrap;
  }
}

.neon-motto {
  text-shadow: 0 0 5px #ffa500, 0 0 15px #ffa500, 0 0 20px #ffa500, 0 0 40px #ffa500, 0 0 60px #ff0000, 0 0 10px #ff8d00, 0 0 98px #ff0000;
  color: #fff6a9;
  animation: blink 12s infinite;
}

@keyframes blink {
  20%, 24%, 55% { color: #111; text-shadow: none; }
  0%, 19%, 21%, 23%, 25%, 54%, 100% {
    text-shadow: 0 0 5px #ffa500, 0 0 15px #ffa500, 0 0 20px #ffa500, 0 0 40px #ffa500, 0 0 60px #ff0000, 0 0 10px #ff8d00, 0 0 98px #ff0000;
    color: #fff6a9;
  }
}

.nav {
  display: flex;
  align-items: center;
  padding-bottom: 12px;
}

.logo {
  font-family: 'Kaylon', 'Inter', sans-serif;
  font-weight: 700;
  letter-spacing: 0.24em;
  font-size: clamp(1.1rem, 2vw, 1.6rem);
  color: #c0c0c0;
  cursor: pointer;
}

h2 {
  font-size: 1.4rem;
  margin: 0 0 8px;
}

.submission-card {
  width: 100%;
  max-width: 600px;
  background: #0f0f0f;
  border: 1px solid #1f1f1f;
  border-radius: 16px;
  padding: 32px 36px;
}

.wizard-steps {
  display: flex;
  align-items: center;
  gap: 0;
  margin-bottom: 28px;
}

.wizard-step {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.wizard-dot {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 1.5px solid #222;
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.arcade {
  font-family: 'Digital Play Italic St', monospace;
  font-size: 1rem;
  line-height: 1;
}

.step-led {
  color: #00FF3C;
  opacity: 0.22;
  text-shadow: none;
}

.wizard-step.active .step-led {
  opacity: 1;
  animation: led-pulse 1.15s step-end infinite;
}

.wizard-step.done .step-led {
  opacity: 1;
  text-shadow: 0 0 6px #00FF3C, 0 0 16px #00FF3C, 0 0 36px #00FF3C, 0 0 60px #00FF3C;
}

@keyframes led-pulse {
  0%, 58% {
    opacity: 1;
    text-shadow: 0 0 4px #00FF3C, 0 0 10px #00FF3C, 0 0 22px #00FF3C;
  }
  59%, 74% {
    opacity: 0.18;
    text-shadow: none;
  }
  75%, 100% {
    opacity: 1;
    text-shadow: 0 0 4px #00FF3C, 0 0 10px #00FF3C, 0 0 22px #00FF3C;
  }
}

.wizard-connector {
  flex: 1;
  height: 1px;
  background: #222;
  margin: 0 12px;
  transition: background 0.3s;
}

.wizard-connector.done {
  background: var(--vt-c-primary, #eff605);
}

.wizard-body {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.step-intro {
  font-size: 0.85rem;
  color: #ccc;
  line-height: 1.65;
  margin: 0 0 4px;
}

.field-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.field-label {
  font-size: 0.78rem;
  color: #bbb;
  display: block;
  padding-left: 10px;
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
  margin-top: 1px;
  min-height: 12px;
  padding-left: 10px;
  color: #ff4d4f;
  font-size: 10px;
  line-height: 1.3;
  visibility: hidden;
}

.field-error-label--visible {
  visibility: visible;
}

.field-success-label {
  margin-top: 1px;
  min-height: 12px;
  padding-left: 10px;
  color: #68ffba;
  font-size: 10px;
  line-height: 1.3;
  visibility: hidden;
}

.field-success-label--visible {
  visibility: visible;
}

.inline-row {
  display: flex;
  gap: 10px;
  align-items: center;
}

.inline-row :deep(.n-input) {
  flex: 1;
}

.required {
  color: #e74c3c;
  margin-left: 2px;
}

.empty-hint {
  opacity: 0.55;
  font-size: 13px;
  margin: 0;
}

.optional-vars {
  margin: 4px 0 8px;
}

.optional-vars :deep(.n-collapse-item__header) {
  color: #bbb;
  font-size: 0.82rem;
}

.optional-vars :deep(.n-collapse-item__header-main) {
  white-space: normal;
  line-height: 1.4;
}

.optional-title {
  font-weight: 500;
}

.optional-hint {
  font-weight: 400;
  font-size: 0.92em;
  color: #888;
}

.type-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.type-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
  width: 100%;
  text-align: left;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid #2a2a2a;
  border-radius: 8px;
  padding: 14px 16px;
  color: inherit;
  cursor: pointer;
  font: inherit;
}

.type-card:hover {
  border-color: #444;
}

.type-card--selected,
.type-card--selected:hover,
.type-card--selected:focus {
  border-color: #eff605;
  background: rgba(239, 246, 5, 0.06);
}

.type-card__name {
  font-size: 0.95rem;
  color: #ddd;
}

.type-card__description {
  font-size: 12px;
  color: #999;
  line-height: 1.5;
}

.type-card__description :deep(h1),
.type-card__description :deep(h2),
.type-card__description :deep(h3) {
  color: #ccc;
  font-size: 12px;
  font-weight: 600;
  margin: 0 0 4px;
}

.type-card__description :deep(p) {
  margin: 0 0 4px;
}

.type-card__description :deep(p:last-child),
.type-card__description :deep(ul:last-child),
.type-card__description :deep(ol:last-child) {
  margin-bottom: 0;
}

.type-card__description :deep(ul),
.type-card__description :deep(ol) {
  padding-left: 18px;
  margin: 0 0 4px;
}

.type-card__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.type-tag {
  display: inline-block;
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  border: 1px solid currentColor;
  border-radius: 3px;
  padding: 0px 4px;
}

.ots-scenes {
  display: flex;
  flex-direction: column;
  gap: 12px;
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

.wizard-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 4px;
}

.back-btn {
  background: none;
  border: none;
  cursor: pointer;
  color: #555;
  font-size: 0.82rem;
  padding: 0;
}

.back-btn:hover {
  color: #999;
}

.error-row {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.field-error {
  color: #ff6b6b;
  font-size: 0.85rem;
  margin: 0;
}

.step--success {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 16px;
  padding: 16px 0;
}

.step-body {
  color: #b0b0b0;
  margin: 0;
  font-size: 0.95rem;
}

.play-hint {
  margin: 0;
  max-width: 420px;
  font-size: 0.82rem;
  line-height: 1.5;
  color: #eff605;
  opacity: 0.85;
}

.summary-box {
  width: 100%;
  background: #0f0f0f;
  border: 1px solid #1f1f1f;
  border-radius: 8px;
  padding: 14px 18px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.summary-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  font-size: 0.85rem;
  color: #ddd;
}

.summary-label {
  color: #777;
  min-width: 0;
  max-width: 62%;
}

.summary-value {
  flex: 1;
  min-width: 72px;
  text-align: right;
  word-break: break-word;
}

.summary-row--total {
  margin-top: 4px;
  padding-top: 8px;
  border-top: 1px solid #2a2a2a;
}

.summary-row--total .summary-label,
.summary-row--total .summary-value {
  color: #ddd;
}

.summary-row--link {
  align-items: flex-start;
  flex-wrap: wrap;
}

.link-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  min-width: 0;
  flex: 1;
}

.summary-link {
  color: inherit;
  opacity: 0.7;
  word-break: break-all;
  text-align: right;
}

.copy-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: none;
  border: 1px solid rgba(128, 128, 128, 0.35);
  border-radius: 4px;
  padding: 4px 8px;
  cursor: pointer;
  color: inherit;
  opacity: 0.7;
  transition: opacity 0.2s, color 0.2s, border-color 0.2s;
  line-height: 1;
  flex-shrink: 0;
  font: inherit;
  font-size: 11px;
}

.copy-btn:hover {
  opacity: 1;
}

.copy-btn--done {
  color: #4caf50;
  border-color: rgba(76, 175, 80, 0.4);
  opacity: 1;
}

.success-actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  justify-content: center;
}

.footer {
  padding-top: 24px;
  margin-top: 24px;
}

.copyright {
  color: #444;
  font-size: 0.8rem;
}

.slide-enter-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}

.slide-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.slide-enter-from {
  opacity: 0;
  transform: translateX(24px);
}

.slide-leave-to {
  opacity: 0;
  transform: translateX(-24px);
}
</style>
