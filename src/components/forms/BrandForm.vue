<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, h, watch, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { gsap } from 'gsap'
import {
  NSpace, NForm, NFormItem, NInput, NSelect, NTreeSelect, NSwitch,
  NTabs, NTabPane, NDynamicInput, NInputNumber, NSlider, NTimePicker,
  NCheckbox, NRadioGroup, NRadio,
  NColorPicker, NTag, NPopconfirm, NAnchor, NAnchorLink, useMessage
} from 'naive-ui'
import GsapButton from '@/components/GsapButton.vue'
import InstructionEditor from '@/components/InstructionEditor.vue'
import type { SelectOption } from 'naive-ui'
import FormWrapper from '@/components/FormWrapper.vue'
import { useBrandsStore, SUBMISSION_POLICY_OPTIONS, type SubmissionPolicy } from '@/stores/brands'
import { useScriptsStore } from '@/stores/scripts'
import { useActionsStore } from '@/stores/actions'
import { useConstantsStore } from '@/stores/constants'
import { useRoute, useRouter } from 'vue-router'
import { useThemeStore } from '@/stores/theme'
import datanestApiService from '@/services/datanestApi'
import dictionaryApiService, { type GenreEntry, type LabelEntry } from '@/services/dictionaryApi'
import { handleApiError } from '@/utils/notificationService'
import { normalizeIdList, toGenreTreeOptions } from '@/utils/genreTree'
import { isValidationError } from '@/utils/errorHandler'

const { t } = useI18n()

const route = useRoute()
const router = useRouter()
const store = useBrandsStore()
const scriptsStore = useScriptsStore()
const constantsStore = useConstantsStore()
const message = useMessage()
const themeStore = useThemeStore()
const actionsStore = useActionsStore()

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
const brandId = ref<string | null>(null)
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

function emptyDraft(): CustomActionDef {
  return { title: '', instruction: '', contextVars: [...DEFAULT_CONTEXT_VARS] }
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

function addScene() {
  const id = ++_sceneId
  scenes.value.push({ id, name: '', startTime: null, actions: [], customActionDefs: {}, allowJingles: true, allowAds: false, talkActivity: 0.5, stagePlaylist: { sourcing: ['RANDOM'], labels: [], genres: [] } })
  customActionFormVisible.value[id] = false
  customActionDraft.value[id] = emptyDraft()
  customActionEditingTitle.value[id] = null
  sceneTitleEditing.value[id] = false
  actionTitleEditing.value[id] = false
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

function copyVar(name: string) {
  navigator.clipboard.writeText('{{' + name + '}}')
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
  return ({ option, handleClose }: { option: { label: string; value: string }; handleClose: () => void }) => {
    const isCustom = Boolean(scene.customActionDefs[option.value])
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
            h('span', { style: 'font-size:0.82rem;' }, option.label),
            h('button', {
              style: 'margin-left:7px;font-size:0.72rem;padding:1px 6px;border-radius:4px;border:1px solid rgba(255,255,255,0.35);background:transparent;color:rgba(255,255,255,0.65);cursor:pointer;line-height:1.4;transition:opacity 0.15s;',
              onMouseenter: (e: MouseEvent) => { (e.target as HTMLElement).style.opacity = '1' },
              onMouseleave: (e: MouseEvent) => { (e.target as HTMLElement).style.opacity = '0.7' },
              onClick: (e: MouseEvent) => { e.stopPropagation(); editCustomAction(scene, option.value) },
            }, t('brandForm.action_tag_edit')),
          ]
        : h('span', { style: 'font-size:0.82rem;' }, option.label),
    })
  }
}

function renderActionGroupLabel(option: SelectOption) {
  if ((option as any).type === 'group') {
    return h('span', {
      style: 'font-size:0.62rem;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#7C3AED;opacity:0.9;',
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

const agentOptions = ref<AgentOption[]>([])
/** Raw agent rows from API (like scripts in scriptsStore) — used for description under DJ select. */
const agentsList = ref<Array<{ id: string; description?: string; labels?: AgentLabel[]; name?: string }>>([])
const profileOptions = ref<{ label: string; value: string }[]>([])
const scriptOptions = ref<ScriptOption[]>([])
const genreList = ref<GenreEntry[]>([])
const genreTreeOptions = computed(() => toGenreTreeOptions(genreList.value))
const fragmentLabelList = ref<LabelEntry[]>([])
const fragmentLabelOptions = computed(() =>
  fragmentLabelList.value.map(l => ({
    label: l.localizedName?.en || l.identifier || l.id,
    value: l.id,
  }))
)

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
            color: { color: 'transparent', textColor: 'rgba(255,255,255,0.5)', borderColor: 'rgba(255,255,255,0.2)' },
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
    const savedBrand = await store.saveBrand(isEditing.value ? brandId.value : null, {
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
      titleFont: formData.value.titleFont || undefined,
      profileOverriding: (formData.value.profileOverriding.name || formData.value.profileOverriding.description)
        ? formData.value.profileOverriding
        : undefined,
      owner: (formData.value.owner.name || formData.value.owner.email) ? formData.value.owner : undefined,
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
const hlsCopied = ref(false)

function openMixplaPlayer() {
  window.open(formData.value.mixplaUrl, '_blank', 'noopener,noreferrer')
}

function copyHlsUrl() {
  navigator.clipboard.writeText(formData.value.hlsUrl)
  hlsCopied.value = true
  setTimeout(() => { hlsCopied.value = false }, 2000)
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
      const json = JSON.parse(ev.target?.result as string)
      const data = json.scenes ? json : json
      customScriptTitle.value = data.title ?? customScriptTitle.value
      scenes.value = []
      _sceneId = 0
      for (const s of data.scenes ?? []) {
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
    } catch {
      message.error('Invalid script JSON')
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
    genres: normalizeIdList((brand as any).genres),
    labels: (brand as any).labels || [],
  }
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
}

onMounted(async () => {
  updateIsMobile()
  window.addEventListener('resize', updateIsMobile)
  try {
    loading.value = true
    actionsStore.loadOptions()
    const [agents, profiles, scripts, genres, fragmentLabels] = await Promise.allSettled([
      datanestApiService.getPagedDictionary<any>('/dictionary/agents', 1, 100),
      datanestApiService.getPagedDictionary<any>('/profiles', 1, 100),
      scriptsStore.loadScripts(1, 200),
      dictionaryApiService.getGenres(),
      dictionaryApiService.getLabelsByCategory('sound_fragment'),
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
        preferredLang: Array.isArray(a.preferredLang) ? a.preferredLang : [],
      }))
    }
    if (profiles.status === 'fulfilled') {
      profileOptions.value = profiles.value.entries.map((p: any) => ({
        label: p.name || p.id, value: p.id
      }))
    }
    if (genres.status === 'fulfilled') genreList.value = genres.value
    if (fragmentLabels.status === 'fulfilled') fragmentLabelList.value = fragmentLabels.value
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
        <NRadioGroup v-model:value="scriptMode" class="script-mode-radio">
          <NRadio value="predefined">{{ t('brandForm.card_predefined_script') }}</NRadio>
          <NRadio value="custom">{{ t('brandForm.card_your_script') }}</NRadio>
        </NRadioGroup>

        <div class="script-cards">
          <div v-if="scriptMode === 'predefined'" :class="['player-card', { 'player-card--dark': themeStore.isDark }]">
            <div class="player-card__label">{{ t('brandForm.card_predefined_script') }}</div>
            <div class="player-card__sub">{{ t('brandForm.card_predefined_script_sub') }}</div>
            <NForm :label-placement="formLabelPlacement" label-width="140" :disabled="loading" style="margin:0">
              <NFormItem :label="t('brandForm.script')" style="margin-bottom:8px">
                <div class="field-stack">
                  <div
                    ref="scriptFieldRef"
                    class="field-error-shell"
                    :class="{ 'field-error-shell--active': !!fieldErrors.scriptId }"
                  >
                    <NSelect v-model:value="formData.scriptId" :options="scriptOptions"
                      :render-label="renderScriptOptionLabel" filterable style="width: 100%; max-width: 440px" />
                  </div>
                  <div class="field-error-label" :class="{ 'field-error-label--visible': !!fieldErrors.scriptId }">
                    {{ fieldErrors.scriptId || '\u00A0' }}
                  </div>
                </div>
              </NFormItem>

              <NFormItem v-if="selectedScript?.description" :label="t('fragmentForm.description')" style="margin-bottom:8px">
                <div class="field-stack">
                  <div class="field-error-shell">
                    <span style="color: #888; font-size: 13px;">{{ selectedScript.description }}</span>
                  </div>
                  <div class="field-error-label"></div>
                </div>
              </NFormItem>

              <template v-if="selectedScript?.requiredVariables?.length">
                <NFormItem :label="t('brandForm.variables')" style="margin-bottom:0">
                  <div class="field-stack">
                    <div class="field-error-shell" style="max-width: 440px">
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
          </div>

          <div v-if="scriptMode === 'custom'" :class="['player-card', { 'player-card--dark': themeStore.isDark }]">
            <div class="player-card__label">{{ t('brandForm.card_your_script') }}</div>
            <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
              <NInput v-model:value="customScriptTitle" :placeholder="t('brandForm.script_title_placeholder')" style="max-width: 180px" />
              <button class="script-io-btn" @click="exportScript">{{ t('brandForm.script_export') }}</button>
              <button class="script-io-btn" @click="importScript">{{ t('brandForm.script_import') }}</button>
              <input ref="scriptImportRef" type="file" accept=".json" style="display:none" @change="onScriptFileChange" />
            </div>
            <div class="player-card__sub">{{ t('brandForm.card_your_script_sub') }}</div>

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
                <button class="scene-card__remove" @click="removeScene(scene.id)" title="Remove">×</button>
              </div>

              <div class="scene-card__row">
                <label class="scene-card__label">{{ t('brandForm.scene_start_time') }}</label>
                <NTimePicker v-model:value="scene.startTime" use-12-hours clearable style="width: 160px" />
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
                        @click="copyVar(v)"
                      >{{ v }}{{ i < customActionDraft[scene.id].contextVars.length - 1 ? ',' : '' }}</span>
                    </div>
                  </div>
                  <div class="custom-action-form__row custom-action-form__row--top">
                    <label class="scene-card__label">{{ t('brandForm.action_instruction') }}</label>
                    <div style="flex: 1;">
                      <InstructionEditor
                        v-model="customActionDraft[scene.id].instruction"
                        :placeholder="t('brandForm.action_instruction_placeholder')"
                        :dark="themeStore.isDark"
                      />
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
            </div>
          </div>
        </div>
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
              <NFormItem :label="t('brandForm.color')" style="margin-bottom:0">
                <div style="width: 200px;">
                  <NColorPicker v-model:value="formData.color" />
                </div>
              </NFormItem>
            </NForm>
            <div v-if="formData.mixplaUrl" class="player-card__url">{{ formData.mixplaUrl }}</div>
            <div v-if="formData.mixplaUrl"><GsapButton type="primary" size="small" @click="openMixplaPlayer"><span>{{ t('brandForm.card_open') }}</span></GsapButton></div>
          </div>

          <div v-if="formData.hlsUrl" :class="['player-card', { 'player-card--dark': themeStore.isDark }]">
            <div class="player-card__label">{{ t('brandForm.card_hls_stream') }}</div>
            <div class="player-card__url">{{ formData.hlsUrl }}</div>
            <div class="player-card__sub">VLC · foobar2000 · any HLS player</div>
            <div><GsapButton size="small" @click="copyHlsUrl"><span>{{ hlsCopied ? t('brandForm.card_copied') : t('brandForm.card_copy') }}</span></GsapButton></div>
          </div>
        </div>
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
  color: #7C3AED;
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
  color: rgba(255, 255, 255, 0.6);
  user-select: none;
  transition: opacity 0.15s;
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
  background: #7C3AED;
  color: #fff;
  font-size: 0.78rem;
  font-weight: 500;
  cursor: pointer;
  transition: opacity 0.15s;
}

.scene-custom-submit:hover {
  opacity: 0.85;
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
  color: #7C3AED;
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
  padding: 16px 0 4px;
}

.script-io-btn {
  display: inline-flex;
  align-items: center;
  padding: 4px 12px;
  border: 1px solid rgba(255, 255, 255, 0.35);
  border-radius: 6px;
  background: transparent;
  color: rgba(255, 255, 255, 0.65);
  font-size: 0.78rem;
  font-weight: 500;
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s;
}

.script-io-btn:hover {
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
