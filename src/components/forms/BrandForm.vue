<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, h, watch, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { gsap } from 'gsap'
import {
  NSpace, NForm, NFormItem, NInput, NSelect, NTreeSelect, NSwitch,
  NTabs, NTabPane, NDynamicInput, NInputNumber, NSlider, NTimePicker,
  NCheckbox, NRadioGroup, NRadio,
  NColorPicker, NTag, NPopconfirm, NAnchor, NAnchorLink, useMessage,
  NModal, NCard, NButton, NSkeleton,
} from 'naive-ui'
import MarkdownIt from 'markdown-it'
import { Cropper } from 'vue-advanced-cropper'
import 'vue-advanced-cropper/dist/style.css'
import GsapButton from '@/components/GsapButton.vue'
import InstructionEditor from '@/components/InstructionEditor.vue'
import TestStatusLeds from '@/components/TestStatusLeds.vue'
import type { SelectOption } from 'naive-ui'
import FormWrapper from '@/components/FormWrapper.vue'
import { useBrandsStore, SUBMISSION_POLICY_OPTIONS, type SubmissionPolicy } from '@/stores/brands'
import { useScriptsStore } from '@/stores/scripts'
import { useUserSubscriptionStore } from '@/stores/userSubscription'
import { useActionsStore } from '@/stores/actions'
import { useConstantsStore } from '@/stores/constants'
import { useRoute, useRouter } from 'vue-router'
import { useThemeStore } from '@/stores/theme'
import datanestApiService from '@/services/datanestApi'
import { appConfig } from '@/config/appConfig'
import { useDictionaryStore } from '@/stores/dictionary'
import type { GenreEntry, LabelEntry } from '@/stores/dictionary'
import jesoosApiService, { type DebugInstructionResponse } from '@/services/jesoosApi'
import { handleApiError } from '@/utils/notificationService'
import { normalizeIdList, toGenreTreeOptions } from '@/utils/genreTree'
import { isValidationError } from '@/utils/errorHandler'

const { t } = useI18n()

const route = useRoute()
const router = useRouter()
const store = useBrandsStore()
const scriptsStore = useScriptsStore()
const userSubscriptionStore = useUserSubscriptionStore()
const constantsStore = useConstantsStore()
const dictionaryStore = useDictionaryStore()
const message = useMessage()
const themeStore = useThemeStore()
const actionsStore = useActionsStore()

// true when at /brands/:id/settings
const isSettings = computed(() => route.name === 'brand-settings')
const isEditing = computed(() => isSettings.value)

const backRoute = computed(() =>
  isSettings.value ? '/mixdeck' : '/brands'
)

const formTitle = computed(() => {
  if (!isEditing.value) return t('brandForm.create_title')
  const firstName = localizedNames.value[0]?.name
  if (firstName) return firstName
  return t('brandForm.edit_title')
})

const loading = ref(false)
const brandId = ref<string | null>(null)
const brandSlug = ref<string | null>(null)
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
const coOwners = ref<{ name: string; email: string }[]>([])

const mp3Enabled = ref(false)

const logoSlugName = ref<string | null>(null)
const logoPreviewUrl = ref<string | null>(null)
const logoUploading = ref(false)
const showCropDialog = ref(false)
const cropSrc = ref<string | null>(null)
const cropperRef = ref<InstanceType<typeof Cropper> | null>(null)
const logoFileInput = ref<HTMLInputElement | null>(null)

const formData = ref({
  country: null as string | null,
  description: '',
  timeZone: null as string | null,
  publicBrand: 0,
  bitRate: 64_000,
  aiAgentId: null as string | null,
  profileId: null as string | null,
  oneTimeStreamPolicy: 'NOT_ALLOWED' as SubmissionPolicy,
  submissionPolicy: 'NOT_ALLOWED' as SubmissionPolicy,
  messagingPolicy: 'NOT_ALLOWED' as SubmissionPolicy,
  chatFeatureFlags: { CREATE_AD: false, STORE_PROMO: false },
  aiOverriding: { enabled: false, name: '', prompt: '' },
  scriptId: null as string | null,
  profileOverriding: { name: '', description: '' },
  color: '#000000',
  titleFont: null as string | null,
  hlsUrl: '',
  mp3Url: '',
  mixplaUrl: '',
  owner: { name: '', email: '', exposeWhileSharing: false, actionDebugEnabled: false },
  genres: [] as string[],
  labels: [] as string[],
})

const userVariables = ref<Record<string, any>>({})



type CustomActionDef = {
  title: string
  instruction: string
  contextVars: string[]
}

type Scene = {
  id: number
  name: string
  startTime: number | null
  actions: string[]
  customActionDefs: Record<string, CustomActionDef>
  allowJingles: boolean
  allowAds: boolean
  talkActivity: number
  stagePlaylist?: any
}

function timeStringToMs(t: string | null | undefined): number | null {
  if (!t) return null
  const [h, m, s] = t.split(':').map(Number)
  const d = new Date()
  d.setHours(h, m, s || 0, 0)
  return d.getTime()
}

function msToTimeString(ms: number | null | undefined): string | null {
  if (ms == null) return null
  const d = new Date(ms)
  return [d.getHours(), d.getMinutes(), d.getSeconds()]
    .map(n => String(n).padStart(2, '0'))
    .join(':')
}

const DEFAULT_CONTEXT_VARS = ['songTitle', 'songArtist', 'genre', 'country', 'stationBrand', 'djName', 'timeContext']

const DEFAULT_CONTEXT_VAR_SAMPLES: Record<string, string> = {
  songTitle: 'Bohemian Rhapsody',
  songArtist: 'Queen',
  genre: 'Rock',
  country: 'UK',
  stationBrand: 'Rock FM',
  djName: 'DJ Alex',
  timeContext: 'Tuesday morning',
}

function emptyDraft(): CustomActionDef {
  return { title: '', instruction: '', contextVars: [...DEFAULT_CONTEXT_VARS] }
}

const testLoading = ref<Record<number, boolean>>({})
const testResult = ref<Record<number, DebugInstructionResponse | null>>({})
const testError = ref<Record<number, string | null>>({})
const testFlash = ref<Record<number, boolean>>({})

function highlightSampleVars(text: string): string {
  let escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  for (const val of Object.values(DEFAULT_CONTEXT_VAR_SAMPLES)) {
    escaped = escaped.split(val).join(`<mark class="var-hl">${val}</mark>`)
  }
  return escaped
}

async function testInstruction(scene: Scene) {
  const slug = brandSlug.value
  if (!slug) { message.warning('Brand must be saved before testing.'); return }
  const draft = customActionDraft.value[scene.id]
  if (!draft?.instruction?.trim()) { message.warning('Write an instruction first.'); return }

  const contextVars: Record<string, string> = {}
  for (const v of (draft.contextVars ?? DEFAULT_CONTEXT_VARS)) {
    contextVars[v] = DEFAULT_CONTEXT_VAR_SAMPLES[v] ?? v
  }

  testLoading.value[scene.id] = true
  testError.value[scene.id] = null
  testResult.value[scene.id] = null
  testFlash.value[scene.id] = false

  try {
    testResult.value[scene.id] = await jesoosApiService.debugInstruction(slug, {
      instruction: draft.instruction,
      contextVars,
      language: 'en-US',
    })
    testFlash.value[scene.id] = true
  } catch (e: any) {
    testError.value[scene.id] = e?.message || 'Test failed'
  } finally {
    testLoading.value[scene.id] = false
  }
}

const scriptMode = ref<'predefined' | 'custom'>('predefined')
const customScriptTitle = ref('')

let _sceneId = 0
const scenes = ref<Scene[]>([])
const customActionFormVisible = ref<Record<number, boolean>>({})
const customActionDraft = ref<Record<number, CustomActionDef>>({})
const customActionEditingTitle = ref<Record<number, string | null>>({})
const sceneTitleEditing = ref<Record<number, boolean>>({})
const actionTitleEditing = ref<Record<number, boolean>>({})

function serializePlaylist(sp: any) {
  const sourcing = (sp?.sourcing ?? []).map((s: string) =>
    s === 'QUERY_LABELS' || s === 'QUERY_GENRES' ? 'QUERY' : s
  )
  const unique = [...new Set(sourcing)]
  return { ...sp, sourcing: unique.length === 1 ? unique[0] : unique }
}

function normalizePlaylist(sp: any) {
  const sourcing = Array.isArray(sp?.sourcing) ? sp.sourcing : [sp?.sourcing ?? 'RANDOM']
  return { sourcing, labels: sp?.labels ?? [], genres: sp?.genres ?? [] }
}

function resolveToUuid(values: string[], list: { id: string; identifier?: string; name?: string; localizedName?: Record<string, string> }[]): string[] {
  return values.map(v => {
    if (list.find(e => e.id === v)) return v
    const match = list.find(e =>
      e.name === v ||
      e.identifier === v ||
      (e.localizedName && Object.values(e.localizedName).includes(v))
    )
    return match?.id ?? v
  })
}

function normalizeScenePlaylistIds() {
  for (const scene of scenes.value) {
    const sp = scene.stagePlaylist
    if (sp.genres?.length) sp.genres = resolveToUuid(sp.genres, dictionaryStore.genres as any[])
    if (sp.labels?.length) sp.labels = resolveToUuid(sp.labels, dictionaryStore.soundFragmentLabels as any[])
  }
}

function toggleSourcing(scene: Scene, mode: string) {
  const arr: string[] = scene.stagePlaylist.sourcing
  if (mode === 'RANDOM') {
    scene.stagePlaylist.sourcing = arr.includes('RANDOM') ? ['QUERY_LABELS', 'QUERY_GENRES'] : ['RANDOM']
  } else {
    const without = arr.filter(s => s !== 'RANDOM' && s !== mode)
    if (arr.includes(mode)) {
      scene.stagePlaylist.sourcing = without.length ? without : ['RANDOM']
    } else {
      scene.stagePlaylist.sourcing = [...without, mode]
    }
  }
}

function sortScenes() {
  scenes.value.sort((a, b) => {
    if (a.startTime === null && b.startTime === null) return 0
    if (a.startTime === null) return 1
    if (b.startTime === null) return -1
    return a.startTime - b.startTime
  })
}

function addScene() {
  const id = ++_sceneId
  scenes.value.push({ id, name: '', startTime: null, actions: [], customActionDefs: {}, allowJingles: true, allowAds: false, talkActivity: 0.5, stagePlaylist: { sourcing: ['RANDOM'], labels: [], genres: [] } })
  customActionFormVisible.value[id] = false
  customActionDraft.value[id] = emptyDraft()
  customActionEditingTitle.value[id] = null
  sceneTitleEditing.value[id] = false
  actionTitleEditing.value[id] = false
}

function cloneScene(scene: Scene) {
  const id = ++_sceneId
  const cloned: Scene = JSON.parse(JSON.stringify(scene))
  cloned.id = id
  cloned.name = (cloned.name || '') + ' (copy)'
  if (cloned.startTime != null) cloned.startTime = cloned.startTime + 3_600_000
  const idx = scenes.value.findIndex(s => s.id === scene.id)
  scenes.value.splice(idx + 1, 0, cloned)
  sceneTitleEditing.value[id] = false
}

function removeScene(id: number) {
  scenes.value = scenes.value.filter(s => s.id !== id)
  delete customActionFormVisible.value[id]
  delete customActionDraft.value[id]
  delete customActionEditingTitle.value[id]
  delete sceneTitleEditing.value[id]
  delete actionTitleEditing.value[id]
}

function editCustomAction(scene: Scene, title: string) {
  const def = scene.customActionDefs[title]
  if (!def) return
  customActionDraft.value[scene.id] = { ...def }
  customActionEditingTitle.value[scene.id] = title
  customActionFormVisible.value[scene.id] = true
}

function submitCustomAction(scene: Scene) {
  const draft = customActionDraft.value[scene.id]
  const newTitle = draft.title.trim() || `Action ${Object.keys(scene.customActionDefs).length + 1}`
  const oldTitle = customActionEditingTitle.value[scene.id]
  if (oldTitle && oldTitle !== newTitle) {
    delete scene.customActionDefs[oldTitle]
    scene.actions = scene.actions.map(a => a === oldTitle ? newTitle : a)
  }
  scene.customActionDefs[newTitle] = { ...draft, title: newTitle, instruction: draft.instruction }
  if (!scene.actions.includes(newTitle)) scene.actions.push(newTitle)
  customActionDraft.value[scene.id] = emptyDraft()
  customActionEditingTitle.value[scene.id] = null
  customActionFormVisible.value[scene.id] = false
}

const instructionEditorRefs = ref<Record<string, any>>({})

function insertVar(sceneId: string | number, name: string) {
  instructionEditorRefs.value[String(sceneId)]?.insertText('{{' + name + '}}')
}
function wrapVar(name: string) {
  return '{{' + name + '}}'
}

function cancelCustomAction(scene: Scene) {
  customActionDraft.value[scene.id] = emptyDraft()
  customActionEditingTitle.value[scene.id] = null
  customActionFormVisible.value[scene.id] = false
  actionTitleEditing.value[scene.id] = false
}

function renderSceneActionTag(scene: Scene) {
  return ({ option, handleClose }: { option: SelectOption; handleClose: () => void }) => {
    const isCustom = Boolean(scene.customActionDefs[option.value as string])
    const dark = themeStore.isDark
    const tagColor = isCustom
      ? { color: dark ? 'rgba(56,189,237,0.10)' : 'rgba(56,189,237,0.08)', textColor: dark ? '#38BDE5' : '#0e7fa8', borderColor: 'rgba(56,189,237,0.40)' }
      : { color: dark ? 'rgba(255,45,149,0.12)' : 'rgba(255,45,149,0.08)', textColor: '#FF2D95', borderColor: 'rgba(255,45,149,0.45)' }
    return h(NTag, {
      size: 'medium',
      closable: true,
      onClose: handleClose,
      color: tagColor,
    }, {
      default: () => isCustom
        ? [
            h('span', { style: 'font-size:0.82rem;' }, String(option.label ?? '')),
            h('button', {
              style: `margin-left:7px;font-size:0.72rem;padding:1px 6px;border-radius:4px;border:1px solid ${themeStore.isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.25)'};background:transparent;color:${themeStore.isDark ? 'rgba(255,255,255,0.65)' : 'rgba(0,0,0,0.55)'};cursor:pointer;line-height:1.4;transition:opacity 0.15s;`,
              onMouseenter: (e: MouseEvent) => { (e.target as HTMLElement).style.opacity = '1' },
              onMouseleave: (e: MouseEvent) => { (e.target as HTMLElement).style.opacity = '0.7' },
              onClick: (e: MouseEvent) => { e.stopPropagation(); editCustomAction(scene, option.value as string) },
            }, t('brandForm.action_tag_edit')),
          ]
        : h('span', { style: 'font-size:0.82rem;' }, String(option.label ?? '')),
    })
  }
}

function renderActionGroupLabel(option: SelectOption) {
  if ((option as any).type === 'group') {
    return h('span', {
      style: 'font-size:0.62rem;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:var(--vt-c-primary);opacity:0.9;',
    }, String(option.label ?? ''))
  }
  return h('span', String(option.label ?? ''))
}

function sceneActionOptions(scene: Scene) {
  const customTitles = Object.keys(scene.customActionDefs)
  const groups: any[] = [
    {
      type: 'group',
      label: t('brandForm.action_group_predefined'),
      key: 'predefined',
      children: actionsStore.selectOptions,
    },
  ]
  if (customTitles.length) {
    groups.push({
      type: 'group',
      label: t('brandForm.action_group_custom'),
      key: 'custom',
      children: customTitles.map(title => ({ label: title, value: title })),
    })
  }
  return groups
}


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
  preferredLang?: { languageTag: string; weight: number }[]
}

type ScriptOption = SelectOption & {
  tags?: AgentLabel[]
}

function isFree(labels: AgentLabel[]) {
  return labels.some(l => {
    const id = (l.identifier ?? '').toLowerCase()
    const name = (l.name ?? '').toLowerCase()
    return id === 'free' || name === 'free'
  })
}

const agentOptions = ref<AgentOption[]>([])
/** Raw agent rows from API (like scripts in scriptsStore) — used for description under DJ select. */
const agentsList = ref<Array<{ id: string; description?: string; labels?: AgentLabel[]; name?: string }>>([])
const profileOptions = ref<{ label: string; value: string }[]>([])
const scriptOptions = ref<ScriptOption[]>([])
const genreTreeOptions = computed(() => toGenreTreeOptions(dictionaryStore.genres))
const fragmentLabelOptions = computed(() =>
  dictionaryStore.soundFragmentLabels.map(l => ({
    label: l.localizedName?.en || l.identifier || l.id,
    value: l.id,
  }))
)

const bitRateMarks = computed<Record<number, string>>(() => ({
  64_000: t('brandForm.stream_quality_good'),
  96_000: t('brandForm.stream_quality_great'),
  128_000: t('brandForm.stream_quality_best'),
}))

function snapBrandBitRate(_bps: number): number {
  return 64_000
}

const qualityMsgShown = ref(false)

function handleQualityChange() {
  formData.value.bitRate = 64_000
  if (qualityMsgShown.value) return
  qualityMsgShown.value = true
  message.warning(t('brandForm.stream_quality_only_good'), { onAfterLeave: () => { qualityMsgShown.value = false } })
}

const publicPremiumGlow = ref(false)
const customScriptGlow = ref(false)

function handleScriptModeChange(val: string) {
  if (val === 'custom' && !userSubscriptionStore.customScriptAllowed) {
    customScriptGlow.value = true
    message.warning(t('brandForm.custom_script_premium_only'))
    setTimeout(() => { customScriptGlow.value = false }, 1500)
    return
  }
  scriptMode.value = val as 'predefined' | 'custom'
  if (val === 'custom') actionsStore.loadOptions()
}

function handleChatWithDjToggle(v: boolean) {
  formData.value.messagingPolicy = v ? 'NO_RESTRICTIONS' : 'NOT_ALLOWED'
  if (!v) {
    formData.value.chatFeatureFlags.CREATE_AD = false
    formData.value.chatFeatureFlags.STORE_PROMO = false
  }
}

function handlePublicToggle(v: boolean) {
  if (!v) { formData.value.publicBrand = 0; return }
  publicPremiumGlow.value = true
  message.warning(t('brandForm.public_premium_only'))
  setTimeout(() => { publicPremiumGlow.value = false }, 1500)
}

function formatBitRateTooltip(value: number) {
  return bitRateMarks.value[value] ?? `${value / 1000} kbps`
}

const selectedScript = computed(() =>
  formData.value.scriptId
    ? scriptsStore.scripts.find(s => s.id === formData.value.scriptId)
    : null
)

const md = new MarkdownIt()
const renderedDescription = computed(() =>
  selectedScript.value?.description ? md.render(selectedScript.value.description) : ''
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

function createCoOwner() {
  return { name: '', email: '' }
}

async function loadLogoPreview(bId: string, slug: string) {
  try {
    const url = `${appConfig.datanestServer}/brands/files/${encodeURIComponent(bId)}/${encodeURIComponent(slug)}`
    logoPreviewUrl.value = await datanestApiService.fetchBlobUrl(url)
  } catch {}
}

function openLogoPicker() {
  logoFileInput.value?.click()
}

function onLogoFileSelected(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = (ev) => {
    cropSrc.value = ev.target?.result as string
    showCropDialog.value = true
  }
  reader.readAsDataURL(file)
  ;(e.target as HTMLInputElement).value = ''
}

async function cropAndUpload() {
  if (!cropperRef.value || !isEditing.value || !brandId.value) return
  logoUploading.value = true
  try {
    const { canvas } = cropperRef.value.getResult()
    if (!canvas) throw new Error('Crop failed')
    const blob = await new Promise<Blob>((res, rej) =>
      canvas.toBlob(b => b ? res(b) : rej(new Error('toBlob failed')), 'image/png')
    )
    const file = new File([blob], 'logo.png', { type: 'image/png' })
    const result = await datanestApiService.uploadBrandLogo(brandId.value!, file)
    logoSlugName.value = result.slugName
    await loadLogoPreview(brandId.value!, result.slugName)
    showCropDialog.value = false
  } catch (e: any) {
    message.error(e?.message || 'Logo upload failed')
  } finally {
    logoUploading.value = false
  }
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

function renderAgentOptionLabel(option: SelectOption) {
  const typedOption = option as AgentOption
  const tags = typedOption.labels || []
  const langs = typedOption.preferredLang || []
  return h(
    NSpace,
    { align: 'center', size: 6, wrapItem: false },
    {
      default: () => [
        ...langs.map(l =>
          h(NTag, {
            size: 'small',
            bordered: true,
            color: themeStore.isDark
              ? { color: 'transparent', textColor: 'rgba(255,255,255,0.5)', borderColor: 'rgba(255,255,255,0.2)' }
              : { color: 'transparent', textColor: 'rgba(0,0,0,0.55)', borderColor: 'rgba(0,0,0,0.2)' },
          }, { default: () => l.languageTag })
        ),
        ...tags
          .filter(tag => Boolean(tag?.name || tag?.identifier))
          .map(tag =>
          h(NTag, {
            size: 'small',
            bordered: false,
            color: { color: tag.color || '#ececec', textColor: tag.fontColor || '#333333' },
          }, { default: () => tag.name || tag.identifier })
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
    console.log('[BrandForm] save | scriptMode:', scriptMode.value, '| scriptId:', formData.value.scriptId, '| customScriptId will be:', scriptMode.value === 'custom' ? formData.value.scriptId || undefined : undefined)
    const savedBrand = await store.saveBrand(isEditing.value ? brandId.value : null, {
      ...formData.value,
      localizedName: buildLocalizedName(),
      country: formData.value.country || undefined,
      timeZone: formData.value.timeZone || undefined,
      aiAgentId: formData.value.aiAgentId || undefined,
      profileId: formData.value.profileId || undefined,
      aiOverriding: formData.value.aiOverriding.enabled ? { name: formData.value.aiOverriding.name, prompt: formData.value.aiOverriding.prompt } : undefined,
      scriptIds: scriptMode.value === 'predefined' && formData.value.scriptId
        ? [{ scriptId: formData.value.scriptId, userVariables: userVariables.value }]
        : undefined,
      customScriptId: scriptMode.value === 'custom' ? formData.value.scriptId || undefined : undefined,
      scriptMode: scriptMode.value.toUpperCase(),
      customScript: scriptMode.value === 'custom' ? {
        title: customScriptTitle.value || undefined,
        scenes: scenes.value.map(s => ({
          name: s.name,
          startTime: msToTimeString(s.startTime),
          stagePlaylist: serializePlaylist(s.stagePlaylist),
          actions: s.actions.map(a => {
            const def = s.customActionDefs[a]
            return def
              ? { type: 'custom', name: a, instruction: def.instruction }
              : { type: 'predefined', actionId: a }
          }),
          allowJingles: s.allowJingles,
          allowAds: s.allowAds,
          talkativity: s.talkActivity,
        }))
      } : undefined,
      streamingOptions: { codecs: mp3Enabled.value ? ['OPUS', 'MP3'] : ['OPUS'] },
      titleFont: formData.value.titleFont || undefined,
      profileOverriding: (formData.value.profileOverriding.name || formData.value.profileOverriding.description)
        ? formData.value.profileOverriding
        : undefined,
      owner: (formData.value.owner.name || formData.value.owner.email || coOwners.value.length)
        ? { ...formData.value.owner, coOwners: coOwners.value.filter(o => o.email).map(o => ({ email: o.email })) }
        : undefined,
    } as any)
    saveAttempted.value = false
    message.success(t('brandForm.saved'))
    if (!isEditing.value) {
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
    await store.loadBrands(1, 10)
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
const hlsCopied = ref(false)
const mp3Copied = ref(false)
const embedCopied = ref(false)


const COUNTRY_LANG: Record<string, string> = {
  US: 'en', GB: 'en', DE: 'de', FR: 'fr', ES: 'es', IT: 'it',
  PT: 'pt', BR: 'pt', RU: 'ru', UA: 'uk', LV: 'lv', GE: 'ka',
  KZ: 'kk', JP: 'ja', NO: 'no', KR: 'ko',
}

const embedLabel = computed(() => {
  const lang = COUNTRY_LANG[formData.value.country || ''] || 'en'
  const ln = localizedNames.value.find(l => l.lang === lang) ?? localizedNames.value[0]
  return ln?.name || brandSlug.value || ''
})

const embedSnippet = computed(() =>
  `<iframe src="https://widget.mixpla.io/embed.html?slug=${encodeURIComponent(brandSlug.value || '')}&label=${encodeURIComponent(embedLabel.value)}"\n        width="280" height="56" frameborder="0" scrolling="no"\n        style="border:0;border-radius:14px"></iframe>`
)

function copyEmbedSnippet() {
  navigator.clipboard.writeText(embedSnippet.value)
  embedCopied.value = true
  setTimeout(() => { embedCopied.value = false }, 2000)
}

function openMixplaPlayer() {
  window.open(formData.value.mixplaUrl, '_blank', 'noopener,noreferrer')
}

function copyHlsUrl() {
  navigator.clipboard.writeText(formData.value.hlsUrl)
  hlsCopied.value = true
  setTimeout(() => { hlsCopied.value = false }, 2000)
}

function copyMp3Url() {
  navigator.clipboard.writeText(formData.value.mp3Url)
  mp3Copied.value = true
  setTimeout(() => { mp3Copied.value = false }, 2000)
}

const scriptImportRef = ref<HTMLInputElement>()

function exportScript() {
  const payload = {
    title: customScriptTitle.value || undefined,
    scenes: scenes.value.map(s => ({
      name: s.name,
      startTime: msToTimeString(s.startTime),
      allowJingles: s.allowJingles,
      allowAds: s.allowAds,
      talkativity: s.talkActivity,
      stagePlaylist: s.stagePlaylist,
      actions: s.actions.map(a => {
        const def = s.customActionDefs[a]
        return def
          ? { type: 'custom', name: a, instruction: def.instruction }
          : { type: 'predefined', actionId: a }
      }),
    })),
  }
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${customScriptTitle.value || 'script'}.json`
  a.click()
  URL.revokeObjectURL(url)
}

function importScript() {
  scriptImportRef.value?.click()
}

function onScriptFileChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = (ev) => {
    try {
      let json: any
      try {
        json = JSON.parse(ev.target?.result as string)
      } catch {
        message.error('Invalid JSON file — could not parse.')
        return
      }
      if (!json || typeof json !== 'object' || !Array.isArray(json.scenes)) {
        message.error('Invalid script format — expected an object with a "scenes" array.')
        return
      }
      customScriptTitle.value = json.title ?? customScriptTitle.value
      scenes.value = []
      _sceneId = 0
      for (const s of json.scenes) {
        const id = ++_sceneId
        const customActionDefs: Record<string, CustomActionDef> = {}
        const actions: string[] = []
        for (const a of s.actions ?? []) {
          if (typeof a === 'string') { actions.push(a) }
          else if (a.type === 'predefined' && a.actionId) { actions.push(a.actionId) }
          else if (a.name) {
            actions.push(a.name)
            customActionDefs[a.name] = { title: a.name, instruction: a.instruction ?? '', contextVars: a.contextVars ?? [] }
          }
        }
        scenes.value.push({ id, name: s.name ?? '', startTime: timeStringToMs(s.startTime), actions, customActionDefs, allowJingles: s.allowJingles ?? true, allowAds: s.allowAds ?? false, talkActivity: s.talkativity ?? 0.5, stagePlaylist: normalizePlaylist(s.stagePlaylist) })
        customActionFormVisible.value[id] = false
        customActionDraft.value[id] = emptyDraft()
        customActionEditingTitle.value[id] = null
      }
      normalizeScenePlaylistIds()
    } catch {
      message.error('Failed to import script — unexpected error.')
    }
    if (scriptImportRef.value) scriptImportRef.value.value = ''
  }
  reader.readAsText(file)
}

function talkativityColor(v: number): string {
  const r = Math.round(56 + (255 - 56) * v)
  const g = Math.round(189 - 144 * v)
  const b = Math.round(237 - 237 * v)
  return `rgb(${r},${g},${b})`
}

function normalizeBitRateFromServer(raw: number | null | undefined): number {
  if (raw == null || Number.isNaN(raw)) return 128_000
  if (raw > 0 && raw < 1000) return Math.round(raw * 1000)
  return raw
}

function applyBrandToForm(brand: any) {
  brandId.value = brand.id ?? null
  brandSlug.value = brand.slugName ?? null
  const ln = brand.localizedName || {}
  localizedNames.value = Object.entries(ln).map(([lang, name]) => ({ lang, name: String(name ?? '') }))
  if (!localizedNames.value.length) localizedNames.value = [{ lang: 'en', name: '' }]

  const isCustomMode = brand.scriptMode?.toLowerCase() === 'custom'
  const firstScript = isCustomMode
    ? (brand.customScriptId ? { scriptId: brand.customScriptId } : null)
    : (brand.scriptIds?.[0] ?? (brand.scriptId ? { scriptId: brand.scriptId } : null))
  console.log('[BrandForm] load | scriptMode:', brand.scriptMode, '| scriptIds:', brand.scriptIds, '| customScriptId:', brand.customScriptId, '| resolved scriptId:', firstScript?.scriptId)
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
    messagingPolicy: isEditing.value ? (brand.messagingPolicy || 'NOT_ALLOWED') : 'NO_RESTRICTIONS',
    chatFeatureFlags: {
      CREATE_AD: isEditing.value ? (brand.chatFeatureFlags?.CREATE_AD ?? false) : true,
      STORE_PROMO: brand.chatFeatureFlags?.STORE_PROMO ?? false,
    },
    aiOverriding: { enabled: !!(brand.aiOverriding?.name || brand.aiOverriding?.prompt), name: brand.aiOverriding?.name || '', prompt: brand.aiOverriding?.prompt || '' },
    scriptId: firstScript?.scriptId || null,
    profileOverriding: {
      name: brand.profileOverriding?.name || '',
      description: brand.profileOverriding?.description || ''
    },
    color: brand.color || '#000000',
    titleFont: brand.titleFont || null,
    hlsUrl: brand.hlsUrl || '',
    mp3Url: (brand as any).mp3Url || '',
    mixplaUrl: brand.mixplaUrl || '',
    owner: { name: brand.owner?.name || '', email: brand.owner?.email || '', exposeWhileSharing: (brand.owner as any)?.exposeWhileSharing ?? false, actionDebugEnabled: (brand.owner as any)?.actionDebugEnabled ?? false },
    genres: normalizeIdList((brand as any).genres),
    labels: (brand as any).labels || [],
  }
  coOwners.value = Array.isArray((brand.owner as any)?.coOwners)
    ? (brand.owner as any).coOwners.map((o: any) => ({ name: o.name || '', email: o.email || '' }))
    : []
  userVariables.value = firstScript?.userVariables ? { ...firstScript.userVariables } : {}
  scriptMode.value = brand.scriptMode?.toLowerCase() === 'custom' ? 'custom' : 'predefined'
  customScriptTitle.value = brand.customScript?.title ?? ''
  scenes.value = []
  _sceneId = 0
  for (const s of brand.customScript?.scenes ?? []) {
    const id = ++_sceneId
    const customActionDefs: Record<string, CustomActionDef> = s.customActionDefs ?? {}
    const actions: string[] = []
    for (const a of s.actions ?? []) {
      if (typeof a === 'string') {
        actions.push(a)
      } else if (a && typeof a === 'object') {
        if (a.type === 'predefined' && a.actionId) {
          actions.push(a.actionId)
        } else if (a.name) {
          actions.push(a.name)
          if (!customActionDefs[a.name]) {
            customActionDefs[a.name] = { title: a.name, instruction: a.instruction ?? '', contextVars: a.contextVars ?? [] }
          }
        }
      }
    }
    for (const p of s.introPrompts ?? []) {
      const id = typeof p === 'string' ? p : p.promptId
      if (id) actions.push(id)
    }
    scenes.value.push({ id, name: s.name ?? s.title ?? '', startTime: timeStringToMs(s.startTime), actions, customActionDefs, allowJingles: s.allowJingles ?? true, allowAds: s.allowAds ?? false, talkActivity: s.talkativity ?? 0.5, stagePlaylist: normalizePlaylist(s.stagePlaylist) })
    customActionFormVisible.value[id] = false
    customActionDraft.value[id] = emptyDraft()
    customActionEditingTitle.value[id] = null
  }
  mp3Enabled.value = isEditing.value && (brand.streamingOptions?.codecs ?? []).includes('MP3')
  const logoSlug = (brand as any).logoFiles?.[0]?.slugName
  if (logoSlug) {
    logoSlugName.value = logoSlug
    loadLogoPreview(route.params.id as string, logoSlug)
  } else {
    logoSlugName.value = null
    logoPreviewUrl.value = null
  }
}

onMounted(async () => {
  updateIsMobile()
  window.addEventListener('resize', updateIsMobile)
  dictionaryStore.loadGenres()
  dictionaryStore.loadSoundFragmentLabels()
  try {
    loading.value = true
    if (isEditing.value) {
      const brand = await store.fetchBrand(route.params.id as string)
      applyBrandToForm(brand)
      normalizeScenePlaylistIds()
    } else {
      const template = await store.fetchBrand('new')
      applyBrandToForm(template)
      normalizeScenePlaylistIds()
    }
    loadAgents()
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
      normalizeScenePlaylistIds()
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

const agentsLoaded = ref(false)
const scriptsLoaded = ref(false)
const audienceLoaded = ref(false)

async function loadAgents() {
  if (agentsLoaded.value) return
  try {
    const result = await datanestApiService.getPagedDictionary<any>(`/dictionary/agents?brand=${encodeURIComponent(brandSlug.value ?? '')}`, 1, 100)
    const entries = result.entries as any[]
    agentsList.value = entries.map((a: any) => {
      const top = typeof a.description === 'string' ? a.description.trim() : ''
      const nested = typeof a.docData?.description === 'string' ? a.docData.description.trim() : ''
      const description = top || nested
      return { id: a.id, name: a.name, labels: Array.isArray(a.labels) ? a.labels : [], ...(description ? { description } : {}) }
    })
    agentOptions.value = entries.map((a: any) => {
      const labels: AgentLabel[] = Array.isArray(a.labels) ? a.labels : []
      return { label: a.name || a.id, value: a.id, labels, preferredLang: Array.isArray(a.preferredLang) ? a.preferredLang : [] }
    })
    agentsLoaded.value = true
  } catch (error: any) {
    message.error(error?.message || t('brandForm.load_failed'))
  }
}

watch(activeTab, async (tab) => {
  if (isTabChangeFromValidation.value) return
  clearAllFieldErrors()
  if (tab === 'dj') loadAgents()
  if (tab === 'script' && scriptMode.value === 'custom') {
    actionsStore.loadOptions()
  }
  if (tab === 'script' && !scriptsLoaded.value) {
    await scriptsStore.loadScripts(1, 200)
    scriptOptions.value = scriptsStore.scripts.map((s: any) => {
      const tags: AgentLabel[] = Array.isArray(s.tags) ? s.tags : []
      return { label: s.name || s.id, value: s.id, tags, disabled: !isFree(tags) }
    }).sort((a, b) => {
      if (isFree(a.tags ?? []) && !isFree(b.tags ?? [])) return -1
      if (!isFree(a.tags ?? []) && isFree(b.tags ?? [])) return 1
      return 0
    })
    scriptsLoaded.value = true
  }
  if (tab === 'audience' && !audienceLoaded.value) {
    try {
      const profiles = await datanestApiService.getPagedDictionary<any>('/dictionary/profiles', 1, 100)
      profileOptions.value = profiles.entries.map((p: any) => ({ label: p.name || p.id, value: p.id }))
    } catch (error: any) {
      message.error(error?.message || t('brandForm.load_failed'))
    }
    audienceLoaded.value = true
  }
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
        <GsapButton @click="router.push(backRoute)"><span>{{ t('common.close') }}</span></GsapButton>
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
                <NTreeSelect
                  v-model:value="formData.genres"
                  :options="genreTreeOptions"
                  multiple
                  checkable
                  clear-filter-after-select
                  filterable
                  style="width: 100%; max-width: 500px"
                />
              </div>
              <div class="field-error-label" :class="{ 'field-error-label--visible': !!fieldErrors.genres }">
                {{ fieldErrors.genres || '\u00A0' }}
              </div>
            </div>
          </NFormItem>


          <NFormItem>
            <template #label>
              <span class="form-label-with-badge">
                {{ t('brandForm.public') }}
                <span class="premium-badge" :class="{ 'premium-badge--glow': publicPremiumGlow }">premium</span>
              </span>
            </template>
            <div class="field-stack">
              <div class="field-error-shell">
                <NSwitch :value="formData.publicBrand === 1" @update:value="handlePublicToggle" />
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
                <NSkeleton v-if="!agentsLoaded" text style="width: 100%; height: 34px; border-radius: 3px;" />
                <NSelect v-else v-model:value="formData.aiAgentId" :options="agentOptions"
                  :render-label="renderAgentOptionLabel" style="width: 100%" />
              </div>
              <div class="field-error-label" :class="{ 'field-error-label--visible': !!fieldErrors.aiAgentId }">
                {{ fieldErrors.aiAgentId || '\u00A0' }}
              </div>
            </div>
          </NFormItem>

          <NDivider v-if="selectedAgent?.description" style="margin: 4px 0 12px 0" />
          <div v-if="selectedAgent?.description" style="padding: 0 0 8px 0">
            <span style="color: #888; font-size: 13px;">{{ selectedAgent.description }}</span>
          </div>

          <NFormItem :label="t('brandForm.ai_override')">
            <div class="field-stack">
              <div class="field-error-shell">
                <NSwitch v-model:value="formData.aiOverriding.enabled" />
              </div>
              <div class="field-error-label"></div>
            </div>
          </NFormItem>

          <NFormItem v-if="formData.aiOverriding.enabled" :label="t('brandForm.ai_override_name')">
            <div class="field-stack">
              <div class="field-error-shell">
                <NInput v-model:value="formData.aiOverriding.name"
                  :placeholder="t('brandForm.ai_override_name_placeholder')" style="width: 100%; max-width: 400px" />
              </div>
              <div class="field-error-label"></div>
            </div>
          </NFormItem>

        </NForm>
      </NTabPane>

      <NTabPane name="script" :tab="t('brandForm.tab_script')">
        <NRadioGroup :value="scriptMode" class="script-mode-radio" @update:value="handleScriptModeChange">
          <NRadio value="predefined">{{ t('brandForm.card_predefined_script') }}</NRadio>
          <NRadio value="custom">
            {{ t('brandForm.card_your_script') }}
            <span class="premium-badge" :class="{ 'premium-badge--glow': customScriptGlow }" style="margin-left: 6px;">pro</span>
          </NRadio>
        </NRadioGroup>

        <div class="script-cards">
          <div v-if="scriptMode === 'predefined'" :class="['player-card', { 'player-card--dark': themeStore.isDark }]">
            <div class="player-card__label">{{ t('brandForm.card_predefined_script') }}</div>
            <NForm :label-placement="formLabelPlacement" label-width="140" :disabled="loading" style="margin:0">
              <NFormItem :label="t('brandForm.script')" style="margin-bottom:8px">
                <div class="field-stack">
                  <div
                    ref="scriptFieldRef"
                    class="field-error-shell"
                    :class="{ 'field-error-shell--active': !!fieldErrors.scriptId }"
                  >
                    <NSkeleton v-if="!scriptsLoaded" text style="width: 100%; max-width: 440px; height: 34px; border-radius: 3px;" />
                    <NSelect v-else v-model:value="formData.scriptId" :options="scriptOptions"
                      :render-label="renderScriptOptionLabel" filterable style="width: 100%; max-width: 440px" />
                  </div>
                  <div class="field-error-label" :class="{ 'field-error-label--visible': !!fieldErrors.scriptId }">
                    {{ fieldErrors.scriptId || '\u00A0' }}
                  </div>
                </div>
              </NFormItem>

              <NFormItem v-if="selectedScript?.description" :label="t('fragmentForm.description')" style="margin-bottom:8px">
                <div class="script-description" v-html="renderedDescription" />
              </NFormItem>

              <template v-if="selectedScript?.requiredVariables?.length">
                <NFormItem :label="t('brandForm.variables')" style="margin-bottom:0">
                  <div class="field-stack">
                    <div class="field-error-shell" style="max-width: 440px">
                      <div v-for="variable in selectedScript.requiredVariables" :key="variable.name"
                        style="margin-bottom: 12px">
                        <div style="margin-bottom: 4px; font-size: 13px">
                          <span>{{ variable.description }}</span>
                          <span v-if="variable.required" style="color: #e74c3c">*</span>
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
          </div>

          <div v-if="scriptMode === 'custom'" :class="['player-card', { 'player-card--dark': themeStore.isDark }]">
            <div class="player-card__label">{{ t('brandForm.card_your_script') }}</div>
            <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
              <NInput v-model:value="customScriptTitle" :placeholder="t('brandForm.script_title_placeholder')" style="max-width: 180px" />
              <button class="script-io-btn" @click="exportScript">{{ t('brandForm.script_export') }}</button>
              <button class="script-io-btn" @click="importScript">{{ t('brandForm.script_import') }}</button>
              <input ref="scriptImportRef" type="file" accept=".json" style="display:none" @change="onScriptFileChange" />
            </div>

            <div v-for="scene in scenes" :key="scene.id" :class="['scene-card', { 'scene-card--dark': themeStore.isDark }]">
              <div class="scene-card__header">
                <NInput
                  v-if="sceneTitleEditing[scene.id]"
                  :value="scene.name"
                  @update:value="(v) => scene.name = v"
                  size="small"
                  class="scene-card__title-input"
                  :placeholder="`Scene ${scenes.indexOf(scene) + 1}`"
                  @blur="sceneTitleEditing[scene.id] = false"
                  @keydown.enter="sceneTitleEditing[scene.id] = false"
                  @keydown.escape="sceneTitleEditing[scene.id] = false"
                  autofocus
                />
                <span
                  v-else
                  class="scene-card__index"
                  title="Click to rename"
                  @click="sceneTitleEditing[scene.id] = true"
                >{{ scene.name || `Scene ${scenes.indexOf(scene) + 1}` }}</span>
                <button class="scene-card__clone" @click="cloneScene(scene)" title="Clone">⧉</button>
                <button class="scene-card__remove" @click="removeScene(scene.id)" title="Remove">×</button>
              </div>

              <div class="scene-card__row">
                <label class="scene-card__label">{{ t('brandForm.scene_start_time') }}</label>
                <NTimePicker v-model:value="scene.startTime" clearable style="width: 140px" />
              </div>

              <div class="scene-card__row">
                <label class="scene-card__label">{{ t('brandForm.scene_talk_activity') }}</label>
                <NSlider v-model:value="scene.talkActivity" :min="0" :max="1" :step="0.01" style="flex: 1" :theme-overrides="{ fillColor: talkativityColor(scene.talkActivity), fillColorHover: talkativityColor(scene.talkActivity) }" />
                <span class="scene-card__slider-val">{{ Math.round(scene.talkActivity * 100) }}%</span>
              </div>

              <div class="scene-card__row scene-card__row--top">
                <label class="scene-card__label">{{ t('brandForm.action_songs') }}</label>
                <div style="display:flex;flex-direction:column;gap:8px;flex:1">
                  <NCheckbox
                    :checked="scene.stagePlaylist.sourcing.includes('RANDOM')"
                    @update:checked="toggleSourcing(scene, 'RANDOM')"
                  >{{ t('brandForm.action_songs_random') }}</NCheckbox>
                  <div style="display:flex;flex-direction:column;gap:6px;">
                    <NCheckbox
                      :checked="scene.stagePlaylist.sourcing.includes('QUERY_LABELS')"
                      @update:checked="toggleSourcing(scene, 'QUERY_LABELS')"
                    >{{ t('brandForm.action_songs_by_labels') }}</NCheckbox>
                    <NSelect
                      v-if="scene.stagePlaylist.sourcing.includes('QUERY_LABELS')"
                      v-model:value="scene.stagePlaylist.labels"
                      :options="fragmentLabelOptions"
                      multiple
                      filterable
                      :placeholder="t('brandForm.action_songs_labels')"
                    />
                  </div>
                  <div style="display:flex;flex-direction:column;gap:6px;">
                    <NCheckbox
                      :checked="scene.stagePlaylist.sourcing.includes('QUERY_GENRES')"
                      @update:checked="toggleSourcing(scene, 'QUERY_GENRES')"
                    >{{ t('brandForm.action_songs_by_genre') }}</NCheckbox>
                    <NTreeSelect
                      v-if="scene.stagePlaylist.sourcing.includes('QUERY_GENRES')"
                      v-model:value="scene.stagePlaylist.genres"
                      :options="genreTreeOptions"
                      multiple
                      checkable
                      :placeholder="t('brandForm.action_songs_genre_placeholder')"
                    />
                  </div>
                </div>
              </div>

              <div class="scene-card__row">
                <label class="scene-card__label">{{ t('brandForm.scene_actions') }}</label>
                <NSelect
                  v-model:value="scene.actions"
                  :options="sceneActionOptions(scene)"
                  multiple
                  :render-tag="renderSceneActionTag(scene)"
                  :render-label="renderActionGroupLabel"
                  :placeholder="t('brandForm.scene_actions')"
                  style="flex: 1"
                />
                <button
                  class="scene-custom-action-btn"
                  :class="{ 'scene-custom-action-btn--active': customActionFormVisible[scene.id] }"
                  :title="t('brandForm.action_add_custom')"
                  @click="() => { if (!customActionFormVisible[scene.id]) { customActionDraft[scene.id] = emptyDraft(); customActionEditingTitle[scene.id] = null; } customActionFormVisible[scene.id] = !customActionFormVisible[scene.id] }"
                >+</button>
              </div>

              <div v-if="customActionFormVisible[scene.id]" :class="['custom-action-form', { 'custom-action-form--dark': themeStore.isDark }]">
                <div class="custom-action-form__heading">
                  <NInput
                    v-if="actionTitleEditing[scene.id]"
                    :value="customActionDraft[scene.id].title"
                    @update:value="(v) => customActionDraft[scene.id].title = v"
                    size="small"
                    class="action-title-input"
                    :placeholder="t('brandForm.action_title_placeholder')"
                    @blur="actionTitleEditing[scene.id] = false"
                    @keydown.enter="actionTitleEditing[scene.id] = false"
                    @keydown.escape="actionTitleEditing[scene.id] = false"
                    autofocus
                  />
                  <span
                    v-else
                    class="action-title-text"
                    title="Click to set title"
                    @click="actionTitleEditing[scene.id] = true"
                  >{{ customActionDraft[scene.id].title || t('brandForm.action_new_heading') }}</span>
                </div>

                <div style="display:flex;flex-direction:column;gap:4px;">
                  <div v-if="customActionDraft[scene.id].contextVars.length" class="custom-action-form__row">
                    <label class="scene-card__label">{{ t('brandForm.available_variables') }}</label>
                    <div class="context-vars-chips">
                      <span
                        v-for="(v, i) in customActionDraft[scene.id].contextVars"
                        :key="v"
                        class="context-var-chip"
                        @click="insertVar(scene.id, v)"
                      >{{ v }}{{ i < customActionDraft[scene.id].contextVars.length - 1 ? ',' : '' }}</span>
                    </div>
                  </div>
                  <div class="custom-action-form__row custom-action-form__row--top">
                    <label class="scene-card__label">{{ t('brandForm.action_instruction') }}</label>
                    <div style="flex: 1;">
                      <InstructionEditor
                        :ref="(el: any) => { if (el) instructionEditorRefs[scene.id] = el; else delete instructionEditorRefs[scene.id] }"
                        v-model="customActionDraft[scene.id].instruction"
                        :placeholder="t('brandForm.action_instruction_placeholder')"
                        :dark="themeStore.isDark"
                      />
                      <div class="instruction-test-row">
                        <button
                          class="instruction-test-btn"
                          :disabled="testLoading[scene.id]"
                          @click="testInstruction(scene)"
                        >Test</button>
                        <TestStatusLeds
                          :loading="testLoading[scene.id]"
                          :success="testFlash[scene.id]"
                          :error="!!testError[scene.id]"
                        />
                      </div>
                      <div v-if="testLoading[scene.id]" class="instruction-test-skeleton">
                        <div class="skel-line skel-line--80" />
                        <div class="skel-line skel-line--60" />
                        <div class="skel-line skel-line--90" />
                      </div>
                      <div v-if="testError[scene.id]" class="instruction-test-error">{{ testError[scene.id] }}</div>
                      <div v-if="testResult[scene.id]" class="instruction-test-result">
                        <div class="instruction-test-result__label">Rendered</div>
                        <div class="instruction-test-result__rendered" v-html="highlightSampleVars(testResult[scene.id]!.rendered)" />
                        <div class="instruction-test-result__label">Response</div>
                        <div class="instruction-test-result__llm">{{ testResult[scene.id]!.llmResponse }}</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div class="custom-action-form__footer">
                  <button class="scene-custom-submit" @click="submitCustomAction(scene)">{{ customActionEditingTitle[scene.id] ? t('common.update') : t('common.add') }}</button>
                  <button class="scene-custom-cancel" @click="cancelCustomAction(scene)">{{ t('common.close') }}</button>
                </div>
              </div>
            </div>

            <div class="script-scenes-empty">
              <button class="script-add-scene" :disabled="loading" @click="addScene">
                <span class="script-add-scene__icon">+</span>
                <span>{{ t('brandForm.card_add_scene') }}</span>
              </button>
              <button class="scene-sort-btn" :disabled="loading" @click="sortScenes" title="Sort by start time">↕ Sort</button>
            </div>
          </div>
        </div>
      </NTabPane>

      <!-- temporarily hidden -->
      <NTabPane name="audience" :tab="t('brandForm.tab_audience')">
        <NForm :label-placement="formLabelPlacement" label-width="160" :disabled="loading">
          <NFormItem :label="t('brandForm.audience_type')">
            <div class="field-stack">
              <div class="field-error-shell">
                <NSkeleton v-if="!audienceLoaded" text style="width: 100%; max-width: 500px; height: 34px; border-radius: 3px;" />
                <NSelect v-else v-model:value="formData.profileId" :options="profileOptions"
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
                <NSwitch
                  :value="formData.oneTimeStreamPolicy === 'NO_RESTRICTIONS'"
                  style="pointer-events: none"
                />
              </div>
              <div class="field-error-label"></div>
            </div>
          </NFormItem>
          <NFormItem :label="t('brandForm.accept_shared_sounds')">
            <div class="field-stack">
              <div class="field-error-shell">
                <NSwitch
                  :value="formData.submissionPolicy === 'NO_RESTRICTIONS'"
                  @update:value="(v) => formData.submissionPolicy = v ? 'NO_RESTRICTIONS' : 'NOT_ALLOWED'"
                />
              </div>
              <div class="field-error-label"></div>
            </div>
          </NFormItem>
          <NFormItem :label="t('brandForm.chat_with_dj')">
            <div class="field-stack" style="width: 100%">
              <div class="field-error-shell">
                <NSwitch
                  :value="formData.messagingPolicy === 'NO_RESTRICTIONS'"
                  @update:value="handleChatWithDjToggle"
                />
              </div>
              <div class="field-error-label"></div>
              <NCard size="small" :disabled="formData.messagingPolicy !== 'NO_RESTRICTIONS'" style="max-width: 200px; margin-top: 8px">
                <template #header>
                  <span style="font-size: 12px">{{ t('brandForm.chat_features') }}</span>
                </template>
                <div class="field-stack">
                  <div class="field-error-shell" style="display:flex;align-items:center;justify-content:flex-end;gap:10px">
                    <span style="font-size: 12px">{{ t('brandForm.chat_feature_create_ad') }}</span>
                    <NSwitch size="small" :disabled="formData.messagingPolicy !== 'NO_RESTRICTIONS'" v-model:value="formData.chatFeatureFlags.CREATE_AD" />
                  </div>
                  <div class="field-error-label"></div>
                </div>
                <div class="field-stack">
                  <div class="field-error-shell" style="display:flex;align-items:center;justify-content:flex-end;gap:10px">
                    <span style="font-size: 12px">{{ t('brandForm.chat_feature_store_promo') }}</span>
                    <NSwitch size="small" disabled v-model:value="formData.chatFeatureFlags.STORE_PROMO" />
                  </div>
                  <div class="field-error-label"></div>
                </div>
              </NCard>
            </div>
          </NFormItem>
        </NForm>
      </NTabPane>

      <NTabPane name="playerUi" :tab="t('brandForm.tab_player_ui')">
        <div style="display:flex;flex-direction:column;gap:16px;max-width:560px;">
          <div :class="['player-card', { 'player-card--dark': themeStore.isDark }]">
            <div class="player-card__label">{{ t('brandForm.card_native_player') }}</div>
            <div v-if="localizedNames[0]?.name" :style="{ fontFamily: formData.titleFont || undefined, fontSize: '1.5rem', color: formData.color, lineHeight: '1.2' }">
              {{ localizedNames[0].name }}
            </div>
            <NForm :label-placement="formLabelPlacement" label-width="120" :disabled="loading" style="margin:0">
              <NFormItem :label="t('brandForm.title_font')" style="margin-bottom:8px">
                <NSelect v-model:value="formData.titleFont" :options="constantsStore.stationFontOptions"
                  filterable clearable style="width: 240px" />
              </NFormItem>
              <NFormItem :label="t('brandForm.color')" style="margin-bottom:8px">
                <div style="width: 200px;">
                  <NColorPicker v-model:value="formData.color" />
                </div>
              </NFormItem>
              <NFormItem :label="t('brandForm.logo')" style="margin-bottom:0">
                <NSpace vertical :size="8">
                  <img
                    v-if="logoPreviewUrl"
                    :src="logoPreviewUrl"
                    alt="Brand logo"
                    style="width: 80px; height: 80px; object-fit: contain; border-radius: 6px; border: 1px solid rgba(128,128,128,0.3);"
                  />
                  <template v-if="isEditing">
                    <input
                      ref="logoFileInput"
                      type="file"
                      accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml"
                      style="display: none"
                      @change="onLogoFileSelected"
                    />
                    <GsapButton size="small" :disabled="logoUploading" @click="openLogoPicker">
                      <span>{{ logoSlugName ? t('brandForm.logo_replace') : t('brandForm.logo_upload') }}</span>
                    </GsapButton>
                  </template>
                  <span v-else style="font-size: 12px; opacity: 0.5;">{{ t('brandForm.logo_save_first') }}</span>
                </NSpace>
              </NFormItem>
            </NForm>
            <div v-if="formData.mixplaUrl" class="player-card__url">{{ formData.mixplaUrl }}</div>
            <div v-if="formData.mixplaUrl"><GsapButton type="primary" size="small" @click="openMixplaPlayer"><span>{{ t('brandForm.card_open') }}</span></GsapButton></div>
          </div>

          <div v-if="formData.hlsUrl" :class="['player-card', { 'player-card--dark': themeStore.isDark }]">
            <div class="player-card__label">{{ t('brandForm.card_stream_urls') }}</div>
            <div class="player-card__url">{{ formData.hlsUrl }}</div>
            <div><GsapButton size="small" @click="copyHlsUrl"><span>{{ hlsCopied ? t('brandForm.card_copied') : t('brandForm.card_copy') }}</span></GsapButton></div>
            <hr style="border:none;border-top:1px solid rgba(128,128,128,0.2);margin:4px 0;" />
            <div style="display:flex;align-items:center;gap:10px;">
              <span style="font-size:13px;">{{ t('brandForm.mp3_stream') }}</span>
              <NSwitch v-model:value="mp3Enabled" />
            </div>
            <div class="player-card__url" :style="!mp3Enabled ? 'opacity:0.35' : ''">{{ formData.mp3Url }}</div>
            <div><GsapButton size="small" :disabled="!formData.mp3Url || !mp3Enabled" @click="copyMp3Url"><span>{{ mp3Copied ? t('brandForm.card_copied') : t('brandForm.card_copy') }}</span></GsapButton></div>
          </div>

          <div v-if="brandSlug" :class="['player-card', { 'player-card--dark': themeStore.isDark }]">
            <div class="player-card__label">{{ t('brandForm.card_embed_player') }}</div>
            <pre style="font-size:11px;white-space:pre-wrap;word-break:break-all;margin:0 0 12px;opacity:0.8;">{{ embedSnippet }}</pre>
            <div><GsapButton size="small" @click="copyEmbedSnippet"><span>{{ embedCopied ? t('brandForm.card_copied') : t('brandForm.card_copy') }}</span></GsapButton></div>
          </div>
        </div>
      </NTabPane>

      <NTabPane name="owner" :tab="t('brandForm.tab_owner')">
        <NForm :label-placement="formLabelPlacement" label-width="160" :disabled="loading">
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
          <NFormItem :label="t('brandForm.co_owners')">
            <div class="field-stack">
              <div class="field-error-shell">
                <NDynamicInput v-model:value="coOwners" :on-create="createCoOwner" style="width:100%">
                  <template #default="{ index }">
                    <div class="co-owner-row">
                      <NInput v-model:value="coOwners[index].name"
                        :placeholder="t('brandForm.owner_name')" class="co-owner-row__name" disabled />
                      <NInput v-model:value="coOwners[index].email"
                        placeholder="email@example.com" class="co-owner-row__email" />
                    </div>
                  </template>
                </NDynamicInput>
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
          <NFormItem :label="t('brandForm.action_debug_enabled')">
            <div class="field-stack">
              <div class="field-error-shell">
                <NSwitch v-model:value="formData.owner.actionDebugEnabled" />
              </div>
              <div class="field-error-label"></div>
            </div>
          </NFormItem>
        </NForm>

        <div
          v-if="isEditing"
          style="margin-top: 20px; padding-top: 16px; border-top: 1px solid rgba(255, 0, 0, 0.28); padding-left: 10px;"
        >
          <div style="font-weight: 600; color: #ff6b6b; margin-bottom: 6px;">{{ t('brandForm.danger_zone') }}</div>
          <NAnchor style="margin-bottom: 12px;">
            <NAnchorLink
              :title="t('brandForm.close_brand_desc')"
            />
          </NAnchor>
          <NPopconfirm
            :disabled="loading"
            @positive-click="handleCloseBrand"
          >
            <template #trigger>
              <GsapButton type="error" :disabled="loading"><span>{{ t('brandForm.close_brand') }}</span></GsapButton>
            </template>
            {{ t('brandForm.close_brand_confirm') }}
          </NPopconfirm>
        </div>
      </NTabPane>
    </NTabs>
  </FormWrapper>

  <NModal v-model:show="showCropDialog" :mask-closable="false" style="width: 480px">
    <NCard title="Crop Logo" :bordered="false" size="huge" role="dialog" aria-modal="true">
      <template #header-extra>
        <NButton text @click="showCropDialog = false">✕</NButton>
      </template>

      <Cropper
        v-if="cropSrc"
        ref="cropperRef"
        :src="cropSrc"
        :stencil-props="{ aspectRatio: 1 }"
        style="max-height: 360px;"
      />

      <template #footer>
        <NSpace justify="end">
          <NButton @click="showCropDialog = false">Cancel</NButton>
          <NButton type="primary" :loading="logoUploading" @click="cropAndUpload">Crop & Upload</NButton>
        </NSpace>
      </template>
    </NCard>
  </NModal>
</template>

<style scoped>
.field-stack {
  width: 100%;
  display: block;
}

.script-description {
  font-size: 13px;
  color: #aaa;
  line-height: 1.6;
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

.player-card {
  background: #f5f5f5;
  border: 1px solid #e0e0e0;
  border-radius: 12px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.player-card__label {
  font-size: 0.72rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: #999;
}

.player-card__url {
  font-size: 0.82rem;
  color: #555;
  word-break: break-all;
}

.player-card__sub {
  font-size: 0.72rem;
  color: #888;
}

.player-card--dark {
  background: #0f0f0f;
  border-color: #1f1f1f;
}

.player-card--dark .player-card__label {
  color: #666;
}

.player-card--dark .player-card__url {
  color: #666;
}

.player-card--dark .player-card__sub {
  color: #555;
}

.script-mode-radio {
  display: flex;
  gap: 20px;
  margin-bottom: 16px;
}

.script-cards {
  display: flex;
  flex-direction: column;
  gap: 20px;
  max-width: 600px;
}

.scene-card {
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 16px 18px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  background: rgba(0, 0, 0, 0.02);
}

.scene-card--dark {
  border-color: #2a2a2a;
  background: rgba(255, 255, 255, 0.03);
}

.custom-action-form {
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 16px 18px;
  margin-top: 6px;
  display: flex;
  flex-direction: column;
  gap: 24px;
  background: rgba(124, 58, 237, 0.03);
}

.custom-action-form--dark {
  border-color: #2e2440;
  background: rgba(124, 58, 237, 0.06);
}

.custom-action-form__heading {
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--vt-c-primary);
}

.custom-action-form__row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.custom-action-form__row--top {
  align-items: flex-start;
}

.custom-action-form__footer {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

.context-vars-chips {
  display: flex;
  flex-wrap: wrap;
  column-gap: 5px;
  row-gap: 1px;
}

.context-var-chip {
  font-size: 0.72rem;
  cursor: pointer;
  color: rgba(0, 0, 0, 0.45);
  user-select: none;
  transition: opacity 0.15s;
}

.scene-card--dark .context-var-chip {
  color: rgba(255, 255, 255, 0.6);
}

.context-var-chip:hover {
  opacity: 0.65;
}

.scene-custom-cancel {
  flex-shrink: 0;
  padding: 0 12px;
  height: 28px;
  border-radius: 4px;
  border: 1px solid #ccc;
  background: transparent;
  color: #888;
  font-size: 0.78rem;
  cursor: pointer;
  transition: opacity 0.15s;
}

.scene-custom-cancel:hover {
  opacity: 0.7;
}

.scene-custom-action-btn {
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  border: 1.5px dashed rgba(255, 45, 149, 0.4);
  background: transparent;
  color: #FF2D95;
  font-size: 1.1rem;
  line-height: 1;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.scene-custom-action-btn:hover,
.scene-custom-action-btn--active {
  border-color: #FF2D95;
  background: rgba(255, 45, 149, 0.08);
}

.scene-custom-submit {
  flex-shrink: 0;
  padding: 0 12px;
  height: 28px;
  border-radius: 4px;
  border: none;
  background: var(--vt-c-primary);
  color: #fff;
  font-size: 0.78rem;
  font-weight: 500;
  cursor: pointer;
  transition: opacity 0.15s;
}

.scene-custom-submit:hover {
  opacity: 0.85;
}

.instruction-test-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 6px;
}

.instruction-test-btn {
  height: 26px;
  padding: 0 14px;
  border: 1px solid rgba(124, 58, 237, 0.5);
  border-radius: 3px;
  background: rgba(124, 58, 237, 0.12);
  color: #a78bfa;
  font-size: 0.78rem;
  font-weight: 600;
  cursor: pointer;
  letter-spacing: 0.04em;
  transition: background 0.15s, opacity 0.15s;
}
.instruction-test-btn:hover { background: rgba(124, 58, 237, 0.22); }
.instruction-test-btn:disabled { opacity: 0.5; cursor: not-allowed; }

.instruction-test-skeleton {
  margin-top: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.skel-line {
  height: 10px;
  border-radius: 4px;
  background: linear-gradient(90deg, rgba(0,0,0,0.06) 25%, rgba(0,0,0,0.11) 50%, rgba(0,0,0,0.06) 75%);
  background-size: 200% 100%;
  animation: skel-shimmer 1.4s infinite;
}

.scene-card--dark .skel-line {
  background: linear-gradient(90deg, rgba(255,255,255,0.06) 25%, rgba(255,255,255,0.13) 50%, rgba(255,255,255,0.06) 75%);
  background-size: 200% 100%;
}
.skel-line--80 { width: 80%; }
.skel-line--60 { width: 60%; }
.skel-line--90 { width: 90%; }

@keyframes skel-shimmer {
  0%   { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

.instruction-test-error {
  margin-top: 6px;
  font-size: 0.8rem;
  color: #FF2D95;
}

.instruction-test-result {
  margin-top: 10px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  border: 1px solid rgba(0,0,0,0.08);
  border-radius: 4px;
  padding: 10px 12px;
  background: rgba(0,0,0,0.025);
}

.scene-card--dark .instruction-test-result {
  border-color: rgba(255,255,255,0.08);
  background: rgba(255,255,255,0.025);
}

.instruction-test-result__label {
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  opacity: 0.45;
  margin-top: 6px;
}
.instruction-test-result__label:first-child { margin-top: 0; }

.instruction-test-result__rendered {
  font-size: 0.85rem;
  font-weight: 500;
  color: rgba(0,0,0,0.85);
  line-height: 1.5;
}

.scene-card--dark .instruction-test-result__rendered {
  color: rgba(255,255,255,0.95);
}

.instruction-test-result__llm {
  font-size: 0.82rem;
  color: rgba(0,0,0,0.75);
  white-space: pre-wrap;
  line-height: 1.6;
}

.scene-card--dark .instruction-test-result__llm {
  color: rgba(255,255,255,0.88);
}

.scene-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.scene-card__index {
  font-size: 0.78rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--vt-c-primary);
  cursor: pointer;
  border-bottom: 1px dashed transparent;
  transition: border-color 0.15s;
}

.scene-card__index:hover {
  border-bottom-color: rgba(124, 58, 237, 0.45);
}

.scene-card__title-input {
  max-width: 150px;
  font-size: 0.78rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.action-title-input {
  max-width: 150px;
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.action-title-text {
  cursor: pointer;
  border-bottom: 1px dashed transparent;
  transition: border-color 0.15s;
}

.action-title-text:hover {
  border-bottom-color: rgba(124, 58, 237, 0.5);
}

.scene-card__clone {
  background: transparent;
  border: none;
  color: #aaa;
  font-size: 1rem;
  line-height: 1;
  cursor: pointer;
  padding: 0 2px;
  transition: color 0.15s;
}

.scene-card__clone:hover {
  color: #fff;
}

.scene-card__remove {
  background: transparent;
  border: none;
  color: #aaa;
  font-size: 1.1rem;
  line-height: 1;
  cursor: pointer;
  padding: 0 2px;
  transition: color 0.15s;
}

.scene-card__remove:hover {
  color: #ff4d4f;
}

.scene-card__row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.scene-card__row--top {
  align-items: flex-start;
}


.scene-card__label {
  font-size: 0.8rem;
  color: #888;
  white-space: nowrap;
  min-width: 92px;
}

.scene-card--dark .scene-card__label {
  color: #666;
}

.scene-card__slider-val {
  font-size: 0.8rem;
  color: #888;
  min-width: 32px;
  text-align: right;
}

.script-scenes-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 16px 0 4px;
}

.scene-sort-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 6px;
  background: transparent;
  color: rgba(255, 255, 255, 0.5);
  font-size: 0.75rem;
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s;
}

.scene-sort-btn:hover {
  border-color: rgba(255, 255, 255, 0.45);
  color: rgba(255, 255, 255, 0.85);
}

.script-io-btn {
  display: inline-flex;
  align-items: center;
  padding: 4px 12px;
  border: 1px solid rgba(0, 0, 0, 0.25);
  border-radius: 6px;
  background: transparent;
  color: rgba(0, 0, 0, 0.55);
  font-size: 0.78rem;
  font-weight: 500;
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s;
}

.script-io-btn:hover {
  border-color: rgba(0, 0, 0, 0.45);
  color: rgba(0, 0, 0, 0.85);
}

.player-card--dark .script-io-btn {
  border-color: rgba(255, 255, 255, 0.35);
  color: rgba(255, 255, 255, 0.65);
}

.player-card--dark .script-io-btn:hover {
  border-color: rgba(255, 255, 255, 0.6);
  color: rgba(255, 255, 255, 0.9);
}

.script-add-scene {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  border: 2px dashed rgba(255, 45, 149, 0.45);
  border-radius: 8px;
  background: transparent;
  color: #FF2D95;
  font-size: 0.84rem;
  font-weight: 500;
  letter-spacing: 0.03em;
  cursor: pointer;
  transition: border-color 0.18s, background 0.18s, color 0.18s;
}

.script-add-scene:hover:not(:disabled) {
  border-color: #FF2D95;
  background: rgba(255, 45, 149, 0.08);
}

.script-add-scene:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.script-add-scene__icon {
  font-size: 1.2rem;
  line-height: 1;
  font-weight: 300;
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

.co-owner-row {
  display: flex;
  gap: 8px;
  width: 100%;
}

.co-owner-row__name {
  flex: 1;
  min-width: 0;
}

.co-owner-row__email {
  flex: 1.4;
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

<style>
.var-hl {
  background: rgba(245, 166, 35, 0.2);
  color: #f5a623;
  border-radius: 3px;
  padding: 0 3px;
  font-weight: 600;
}
</style>
