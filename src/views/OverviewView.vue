<template>
  <div class="overview">
    <PageHeader :title="t('overview.title')" :count="brandsStore.brands.length" />

    <div class="overview-list">
      <h3 v-if="brandsStore.brands.length" class="overview-section-title">{{ t('overview.radio_stream') }}</h3>
      <NCard
        v-for="brand in brandsStore.brands"
        :key="brand.id"
        class="brand-card"
        :style="brand.color ? { '--brand-color': brand.color } : undefined"
      >
        <template #header>
          <div class="brand-head">
            <span class="brand-name" @click="goPlaylist(brand)">{{ brandLabel(brand) }}</span>
            <span class="brand-status">{{ ledState(brand).label }}</span>
          </div>
        </template>

        <template v-if="brand.mixplaUrl" #header-extra>
          <div class="brand-url">
            <a :href="brand.mixplaUrl" target="_blank" rel="noopener noreferrer" class="brand-url-link">{{ brand.mixplaUrl }}</a>
            <button
              class="copy-btn"
              :class="{ 'copy-btn--done': copiedId === brand.id }"
              :title="t('dashboard.copy_url')"
              @click="copyUrl(brand)"
            >
              <svg v-if="copiedId !== brand.id" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              <svg v-else width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            </button>
            <button
              class="copy-btn"
              title="Go to station"
              @click="router.push({ name: 'brand-settings', params: { id: brand.id } })"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h6v6"/><path d="M10 14L21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>
            </button>
          </div>
        </template>

        <AivoxCard v-if="brand.slugName" :brand-slug="brand.slugName" :timezone="brand.timeZone" :status="brand.status" />

        <!--
        <NCollapse v-if="brand.slugName" class="agenda-collapse">
          <NCollapseItem :title="t('agenda.title')" :name="brand.id">
            <AgendaCard :brand-slug="brand.slugName" :alive="isAlive(brand)" />
          </NCollapseItem>
        </NCollapse>
        -->
      </NCard>

      <h3 class="overview-section-title">{{ t('overview.one_time_stream') }}</h3>

      <NCard
        v-for="wizard in otsWizards"
        :key="wizard.id"
        class="ots-card"
        :style="wizard.scriptDetail?.color ? { '--brand-color': wizard.scriptDetail.color } : undefined"
      >
        <template #header>
          <div class="brand-head">
            <span class="brand-name">{{ wizard.name || t('overview.one_time_stream') }}</span>
            <span v-if="wizard.type" class="type-pill">{{ wizard.type }}</span>
            <StatusOrbitBadge v-if="wizard.status" class="brand-status" :class="{ 'brand-status--live': wizard.status === 'ON_LINE' }" :live="wizard.status === 'STREAMING' || wizard.status === 'ON_LINE' || wizard.heartbeatAlive">{{ otsStatusLabel(wizard.status) }}</StatusOrbitBadge>
            <span v-if="wizard.remainingMinutes > 0" class="remaining-pill" :class="{ 'remaining-pill--warning': wizard.remainingMinutes < 10 }">{{ wizard.remainingMinutes }}m</span>
          </div>
        </template>
        <template #header-extra>
          <div class="brand-url">
            <a v-if="wizard.link" :href="wizard.link" target="_blank" rel="noopener noreferrer" class="brand-url-link">{{ wizard.link }}</a>
            <button
              v-if="wizard.link"
              class="copy-btn"
              :class="{ 'copy-btn--done': wizard.linkCopied }"
              :title="t('dashboard.copy_url')"
              @click="copyOtsLink(wizard)"
            >
              <svg v-if="!wizard.linkCopied" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              <svg v-else width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            </button>
            <button
              v-if="wizard.scope === 'brand' && wizard.brandId"
              class="copy-btn"
              title="Go to station"
              @click="router.push({ name: 'brand-settings', params: { id: wizard.brandId } })"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h6v6"/><path d="M10 14L21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>
            </button>
            <NPopover v-if="wizard.link && wizard.status === 'ON_LINE'" trigger="click" placement="bottom-end" @update:show="(show: boolean) => show && loadOtsQrCode(wizard)">
              <template #trigger>
                <button class="copy-btn" :title="t('overview.ots_qr_code')">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><path d="M14 14h3v3h-3z"/><path d="M20 14v3"/><path d="M17 20h4"/></svg>
                </button>
              </template>
              <div class="ots-qr-popover">
                <img v-if="wizard.qrDataUrl" :src="wizard.qrDataUrl" :alt="wizard.link" width="180" height="180" />
                <NSpin v-else :show="true" style="width: 180px; height: 180px; display: flex; align-items: center; justify-content: center;" />
              </div>
            </NPopover>
            <NPopconfirm v-if="wizard.createdId" @positive-click="() => deleteOtsWizard(wizard)">
              <template #trigger>
                <button class="copy-btn" :title="t('common.close')">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                </button>
              </template>
              {{ t('overview.ots_delete_confirm') }}
            </NPopconfirm>
            <button v-else class="copy-btn" :title="t('common.close')" @click="closeOtsWizard(wizard.id)">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </button>
          </div>
        </template>

        <NCard :bordered="true" size="small" class="ots-step-card">
          <div class="ots-step ots-step--split">
            <div class="ots-step__select">
              <NSelect
                v-model:value="wizard.scriptId"
                :options="scriptOptions"
                :render-label="renderScriptOptionLabel"
                :loading="scriptsStore.loading"
                :placeholder="t('overview.ots_pick_script')"
                filterable
                @update:value="() => onOtsScriptChange(wizard)"
              />
            </div>
            <div class="ots-step__desc script-description" v-html="wizard.scriptDetail?.description ? renderScriptDescription(wizard.scriptDetail.description) : ''" />
          </div>
        </NCard>

        <NCard :bordered="true" size="small" class="ots-step-card">
          <div class="ots-step">
            <NSpin :show="wizard.loadingScriptDetail">
              <template v-if="wizard.scriptDetail?.requiredVariables?.length">
                <div class="ots-variable-grid">
                <div v-for="variable in wizard.scriptDetail.requiredVariables" :key="variable.name" class="ots-variable">
                  <div class="ots-variable__label">
                    <span>{{ variable.description }}</span>
                    <span v-if="variable.required" class="ots-variable__required">*</span>
                  </div>
                  <NSwitch v-if="variable.type === 'boolean'" v-model:value="wizard.variables[variable.name]" />
                  <NInputNumber v-else-if="variable.type === 'number'" v-model:value="wizard.variables[variable.name]" style="width: 100%" />
                  <NInput v-else v-model:value="wizard.variables[variable.name]" style="width: 100%" />
                </div>
                </div>
              </template>
              <p v-else-if="!wizard.loadingScriptDetail" class="ots-no-variables">{{ wizard.scriptId ? t('overview.ots_no_variables') : t('overview.ots_pick_script_first') }}</p>
            </NSpin>
          </div>
        </NCard>

        <NCard :bordered="true" size="small" class="ots-step-card">
          <div class="ots-step">
            <NRadioGroup v-model:value="wizard.scope" @update:value="onOtsScopeChange(wizard)">
              <NRadioButton value="brand">{{ t('overview.ots_scope_brand') }}</NRadioButton>
              <NRadioButton value="default">{{ t('overview.ots_scope_default') }}</NRadioButton>
            </NRadioGroup>

            <div v-if="wizard.scope === 'brand'" class="ots-variable-grid" style="margin-top: 10px;">
              <div>
                <NSelect
                  v-model:value="wizard.brandId"
                  :options="brandOptions"
                  :placeholder="t('overview.ots_pick_brand')"
                  filterable
                  @update:value="() => onOtsBrandChange(wizard)"
                />
              </div>
            </div>

            <div v-if="wizard.scope !== 'brand'" class="ots-variable-grid" :style="{ marginTop: '10px' }">
              <div>
                <NSelect
                  v-model:value="wizard.agentId"
                  :options="wizard.agentOptions"
                  :loading="wizard.loadingAgents"
                  :placeholder="t('overview.ots_pick_dj')"
                  filterable
                />
              </div>
            </div>
          </div>
        </NCard>

        <p v-if="wizard.error" class="ots-error">{{ wizard.error }}</p>

        <div class="ots-nav">
          <GsapButton
            type="primary"
            :disabled="!wizard.scriptId || !otsScopeValid(wizard) || wizard.submitting || wizard.updating || wizard.status === 'STREAMING' || wizard.status === 'DONE' || wizard.status === 'ON_LINE'"
            @click="wizard.createdId ? updateOtsStream(wizard) : createOtsStream(wizard)"
          >
            <span>{{ otsSubmitLabel(wizard) }}</span>
          </GsapButton>
        </div>
      </NCard>

      <button class="ots-add-strip" type="button" :title="t('overview.one_time_stream')" @click="openOtsWizard">
        <span class="ots-add-strip__plus">+</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, h, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { NCard, NCollapse, NCollapseItem, NSelect, NSwitch, NInputNumber, NInput, NTag, NSpace, NSpin, NRadioGroup, NRadioButton, NPopconfirm, NPopover, useMessage, type SelectOption } from 'naive-ui'
import MarkdownIt from 'markdown-it'
import QRCode from 'qrcode'
import { useBrandsStore, type Brand } from '@/stores/brands'
import { useScriptsStore, type Script } from '@/stores/scripts'
import { useOtsDefinitionsStore, type OtsDefinition } from '@/stores/otsDefinitions'
import datanestApiService from '@/services/datanestApi'
import aivoxApiService from '@/services/aivoxApi'
import PageHeader from '@/components/PageHeader.vue'
import AivoxCard from '@/components/AivoxCard.vue'
import GsapButton from '@/components/GsapButton.vue'
import StatusOrbitBadge from '@/components/StatusOrbitBadge.vue'
import AgendaCard from '@/components/AgendaCard.vue'

const { t } = useI18n()
const router = useRouter()
const message = useMessage()
const brandsStore = useBrandsStore()
const scriptsStore = useScriptsStore()
const otsDefinitionsStore = useOtsDefinitionsStore()

const brandLabel = (brand: Brand) =>
  brand.localizedName?.['en'] || brand.title || brand.slugName || brand.id

const md = new MarkdownIt()
function renderScriptDescription(description: string) {
  return md.render(description)
}

function isAlive(brand: Brand): boolean {
  return brandsStore.streamingStates[brand.slugName ?? ''] ?? false
}

function ledState(brand: Brand): { active: boolean; color: string; label: string } {
  const slug = brand.slugName ?? ''
  const liveState = brandsStore.streamingStates[slug]
  const isOnline = liveState === true || (liveState === undefined && brand.status === 'ON_LINE')
  const isIdle = liveState === false
    ? brand.status === 'IDLE'
    : (liveState === undefined && brand.status === 'IDLE')
  if (isOnline) return { active: true, color: '#00FF3C', label: t('overview.online') }
  if (isIdle) return { active: true, color: '#FFD600', label: t('overview.idle') }
  return { active: false, color: '#00FF3C', label: t('overview.offline') }
}

function goPlaylist(brand: Brand) {
  router.push(`/brands/${brand.id}/playlist`)
}

const copiedId = ref<string | null>(null)
function copyUrl(brand: Brand) {
  if (!brand.mixplaUrl) return
  navigator.clipboard.writeText(brand.mixplaUrl)
  copiedId.value = brand.id
  setTimeout(() => { copiedId.value = null }, 2000)
}

async function deleteOtsWizard(wizard: OtsWizard) {
  if (!wizard.createdId) return
  try {
    await otsDefinitionsStore.deleteOtsDefinition(wizard.createdId)
    closeOtsWizard(wizard.id)
  } catch {
    message.error(t('overview.ots_delete_failed'))
  }
}

onMounted(async () => {
  await otsDefinitionsStore.loadOtsDefinitions(1, 50)
  otsDefinitionsStore.otsDefinitions.forEach((def) => hydrateOtsWizard(def))
})

onBeforeUnmount(() => {
  otsHeartbeatTimers.forEach((timer) => clearInterval(timer))
  otsHeartbeatTimers.clear()
})

interface OtsWizard {
  id: string
  scriptId: string | null
  scriptDetail: Script | null
  loadingScriptDetail: boolean
  variables: Record<string, unknown>
  scope: 'brand' | 'default'
  brandId: string | null
  agentId: string | null
  agentOptions: SelectOption[]
  loadingAgents: boolean
  submitting: boolean
  error: string | null
  link: string
  linkCopied: boolean
  qrDataUrl: string | null
  createdId: string | null
  updating: boolean
  updated: boolean
  name?: string
  status?: string
  type?: string
  slugName?: string
  heartbeatAlive: boolean
  remainingMinutes: number
}

const otsWizards = ref<OtsWizard[]>([])

const scriptOptions = computed(() =>
  scriptsStore.scripts.map((script) => ({ label: script.name, value: script.id, tags: script.tags || [] }))
)

const brandOptions = computed(() =>
  brandsStore.brands.map((brand) => ({ label: brandLabel(brand), value: brand.id }))
)

function otsScopeValid(wizard: OtsWizard): boolean {
  return wizard.scope === 'brand' ? !!wizard.brandId : !!wizard.agentId
}

function otsSubmitLabel(wizard: OtsWizard): string {
  if (wizard.submitting) return t('overview.ots_creating')
  if (wizard.updating) return t('overview.ots_updating')
  if (wizard.updated) return t('overview.ots_updated')
  if (wizard.createdId) return t('overview.ots_update')
  return t('overview.ots_create')
}

function renderScriptOptionLabel(option: SelectOption) {
  const tags = (option as unknown as { tags?: Array<{ name?: string; identifier?: string; color?: string; fontColor?: string }> }).tags || []
  return h(
    NSpace,
    { align: 'center', size: 8, wrapItem: false },
    {
      default: () => [
        ...tags
          .filter((tag) => Boolean(tag?.name || tag?.identifier))
          .map((tag) =>
            h(
              NTag,
              { size: 'small', bordered: false, color: { color: tag.color || '#ececec', textColor: tag.fontColor || '#333333' } },
              { default: () => tag.name || tag.identifier }
            )
          ),
        h('span', String(option.label ?? option.value ?? '')),
      ],
    }
  )
}

function openOtsWizard() {
  const wizard: OtsWizard = reactive({
    id: crypto.randomUUID(),
    scriptId: null,
    scriptDetail: null,
    loadingScriptDetail: false,
    variables: reactive({}),
    scope: 'default',
    brandId: null,
    agentId: null,
    agentOptions: [],
    loadingAgents: false,
    submitting: false,
    error: null,
    link: '',
    linkCopied: false,
    qrDataUrl: null,
    createdId: null,
    updating: false,
    updated: false,
    slugName: undefined,
    heartbeatAlive: false,
    remainingMinutes: -2,
  })
  otsWizards.value.push(wizard)
  if (!scriptsStore.scripts.length) {
    scriptsStore.loadScripts(1, scriptsStore.pageSize, 'timingMode=RELATIVE_TO_STREAM_START')
  }
  loadOtsAgents(wizard)
}

function hydrateOtsWizard(def: OtsDefinition) {
  const wizard: OtsWizard = reactive({
    id: def.id,
    scriptId: def.scriptId,
    scriptDetail: null,
    loadingScriptDetail: false,
    variables: reactive({ ...def.userVariables }),
    scope: def.brandId ? 'brand' : 'default',
    brandId: def.brandId,
    agentId: def.agentId,
    agentOptions: [],
    loadingAgents: false,
    submitting: false,
    error: null,
    link: def.slugName ? `https://mixpla.online/${def.slugName}` : '',
    linkCopied: false,
    qrDataUrl: null,
    createdId: def.id,
    updating: false,
    updated: false,
    name: def.name,
    status: def.status,
    type: def.type,
    slugName: def.slugName,
    heartbeatAlive: false,
    remainingMinutes: -2,
  })
  otsWizards.value.push(wizard)
  if (!scriptsStore.scripts.length) {
    scriptsStore.loadScripts(1, scriptsStore.pageSize, 'timingMode=RELATIVE_TO_STREAM_START')
  }
  loadOtsScriptDetail(wizard)
  if (wizard.scope !== 'brand') loadOtsAgents(wizard)
  startOtsHeartbeat(wizard)
}

const otsHeartbeatTimers = new Map<string, ReturnType<typeof setInterval>>()

async function pollOtsHeartbeat(wizard: OtsWizard) {
  if (!wizard.slugName) return
  try {
    const { alive, entityStatus, remainingMinutes } = await aivoxApiService.heartbeat(wizard.slugName)
    wizard.heartbeatAlive = alive
    wizard.remainingMinutes = remainingMinutes
    if (entityStatus) wizard.status = entityStatus
    if (wizard.status === 'DONE') stopOtsHeartbeat(wizard.id)
  } catch {
    wizard.heartbeatAlive = false
  }
}

function startOtsHeartbeat(wizard: OtsWizard) {
  stopOtsHeartbeat(wizard.id)
  if (!wizard.slugName || wizard.status === 'DONE') return
  pollOtsHeartbeat(wizard)
  otsHeartbeatTimers.set(wizard.id, setInterval(() => pollOtsHeartbeat(wizard), 7000))
}

function stopOtsHeartbeat(id: string) {
  const timer = otsHeartbeatTimers.get(id)
  if (timer) {
    clearInterval(timer)
    otsHeartbeatTimers.delete(id)
  }
}

async function loadOtsScriptDetail(wizard: OtsWizard) {
  if (!wizard.scriptId) return
  wizard.loadingScriptDetail = true
  try {
    wizard.scriptDetail = await datanestApiService.getScriptDetail(wizard.scriptId)
  } finally {
    wizard.loadingScriptDetail = false
  }
}

async function onOtsScriptChange(wizard: OtsWizard) {
  wizard.scriptDetail = null
  Object.keys(wizard.variables).forEach((key) => delete wizard.variables[key])
  if (!wizard.scriptId) return
  await loadOtsScriptDetail(wizard)
}

function closeOtsWizard(id: string) {
  stopOtsHeartbeat(id)
  otsWizards.value = otsWizards.value.filter((wizard) => wizard.id !== id)
}

async function loadOtsAgents(wizard: OtsWizard) {
  wizard.loadingAgents = true
  try {
    let endpoint = '/dictionary/agents'
    if (wizard.scope === 'brand' && wizard.brandId) {
      const brand = brandsStore.brands.find((b) => b.id === wizard.brandId)
      endpoint = `/dictionary/agents?brand=${encodeURIComponent(brand?.slugName ?? '')}`
    }
    const result = await datanestApiService.getPagedDictionary<any>(endpoint, 1, 100)
    wizard.agentOptions = result.entries.map((a: any) => ({ label: a.name || a.id, value: a.id }))
  } finally {
    wizard.loadingAgents = false
  }
}

function onOtsScopeChange(wizard: OtsWizard) {
  wizard.brandId = null
  wizard.agentId = null
  wizard.agentOptions = []
  wizard.error = null
  if (wizard.scope === 'default') {
    loadOtsAgents(wizard)
  }
}

function onOtsBrandChange(wizard: OtsWizard) {
  wizard.agentId = null
  wizard.agentOptions = []
}

async function createOtsStream(wizard: OtsWizard) {
  if (!wizard.scriptId || !otsScopeValid(wizard)) {
    wizard.error = t('overview.ots_agent_required')
    return
  }
  wizard.error = null
  wizard.submitting = true
  try {
    const created = await otsDefinitionsStore.createOtsDefinition({
      scriptId: wizard.scriptId,
      userVariables: { ...wizard.variables },
      brandId: wizard.scope === 'brand' ? wizard.brandId : null,
      agentId: wizard.agentId || null,
    })
    wizard.createdId = created.id
    wizard.link = `https://mixpla.online/${created.slugName}`
    wizard.qrDataUrl = null
    wizard.name = created.name
    wizard.status = created.status
    wizard.type = created.type
    wizard.slugName = created.slugName
    startOtsHeartbeat(wizard)
  } catch (err) {
    wizard.error = err instanceof Error ? err.message : t('overview.ots_create_failed')
  } finally {
    wizard.submitting = false
  }
}

async function updateOtsStream(wizard: OtsWizard) {
  if (!wizard.createdId) return
  if (!otsScopeValid(wizard)) {
    wizard.error = t('overview.ots_agent_required')
    return
  }
  wizard.error = null
  wizard.updating = true
  wizard.updated = false
  try {
    const updated = await otsDefinitionsStore.updateOtsDefinition(wizard.createdId, {
      scriptId: wizard.scriptId!,
      userVariables: { ...wizard.variables },
      brandId: wizard.scope === 'brand' ? wizard.brandId : null,
      agentId: wizard.agentId || null,
    })
    wizard.link = `https://mixpla.online/${updated.slugName}`
    wizard.qrDataUrl = null
    wizard.name = updated.name
    wizard.status = updated.status
    wizard.type = updated.type
    wizard.slugName = updated.slugName
    startOtsHeartbeat(wizard)
    wizard.updated = true
    setTimeout(() => { wizard.updated = false }, 2000)
  } catch (err) {
    wizard.error = err instanceof Error ? err.message : t('overview.ots_create_failed')
  } finally {
    wizard.updating = false
  }
}

function copyOtsLink(wizard: OtsWizard) {
  if (!wizard.link) return
  navigator.clipboard.writeText(wizard.link)
  wizard.linkCopied = true
  setTimeout(() => { wizard.linkCopied = false }, 2000)
}

async function loadOtsQrCode(wizard: OtsWizard) {
  if (!wizard.link || wizard.qrDataUrl) return
  const link = wizard.link
  try {
    const dataUrl = await QRCode.toDataURL(link, { width: 180, margin: 1 })
    if (wizard.link === link) wizard.qrDataUrl = dataUrl
  } catch {
    /* leave qrDataUrl null; popover keeps showing the spinner */
  }
}

function otsStatusLabel(status?: string): string {
  if (status === 'ON_LINE') return t('overview.ots_live')
  return status ?? ''
}
</script>

<style scoped>
.overview {
  width: 100%;
}
.overview-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.overview-section-title {
  margin: 8px 0 0;
  font-size: 0.85rem;
  font-weight: 600;
  opacity: 0.6;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.brand-head {
  display: flex;
  align-items: center;
  gap: 10px;
}
.brand-name {
  font-weight: 600;
  cursor: pointer;
}
.brand-name:hover {
  color: var(--vt-c-primary);
}
.brand-status {
  font-size: 0.75rem;
  opacity: 0.55;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.brand-status--live {
  opacity: 1;
  font-weight: 600;
  color: rgba(0, 255, 60, 0.95);
  border: 1px solid rgba(0, 255, 60, 0.5);
  border-radius: 3px;
  box-shadow: 0 0 7px 2px rgba(0, 255, 60, 0.3);
  animation: brand-status-glow 1.6s ease-in-out infinite;
}
@keyframes brand-status-glow {
  0%, 100% { box-shadow: 0 0 7px 2px rgba(0, 255, 60, 0.25); }
  50% { box-shadow: 0 0 10px 3px rgba(0, 255, 60, 0.45); }
}
.brand-url {
  display: flex;
  align-items: center;
  gap: 6px;
}
.brand-url-link {
  font-size: 0.78rem;
  opacity: 0.6;
  color: inherit;
  text-decoration: none;
  border-bottom: 1px dashed currentColor;
  white-space: nowrap;
  max-width: 280px;
  overflow: hidden;
  text-overflow: ellipsis;
}
.brand-url-link:hover {
  opacity: 1;
}
.copy-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: 1px solid rgba(128, 128, 128, 0.3);
  border-radius: 4px;
  padding: 2px 5px;
  cursor: pointer;
  color: inherit;
  opacity: 0.5;
  transition: opacity 0.2s, color 0.2s, border-color 0.2s;
  line-height: 1;
  flex-shrink: 0;
}
.copy-btn:hover {
  opacity: 1;
}
.copy-btn--done {
  color: #4caf50;
  border-color: rgba(76, 175, 80, 0.4);
  opacity: 1;
}
@media (max-width: 768px) {
  .brand-url-link {
    display: none;
  }
  .brand-name {
    word-break: keep-all;
    white-space: nowrap;
  }
}
.agenda-collapse {
  margin-top: 12px;
}
.brand-card :deep(.n-card__content) {
  padding-top: 8px;
}
.brand-card {
  border-color: var(--brand-color);
}
.ots-add-strip {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 48px;
  border: 2px dashed rgba(124, 58, 237, 0.45);
  border-radius: 8px;
  background: transparent;
  color: inherit;
  opacity: 0.6;
  cursor: pointer;
  transition: opacity 0.2s, border-color 0.2s, background 0.2s;
}
.ots-add-strip:hover {
  opacity: 1;
  border-color: var(--vt-c-primary);
  background: rgba(124, 58, 237, 0.06);
}
.ots-add-strip__plus {
  font-size: 20px;
  line-height: 1;
  font-weight: 300;
}
.ots-card {
  border-color: var(--brand-color, rgba(128, 128, 128, 0.35));
}
.type-pill {
  display: inline-block;
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  color: rgba(124, 58, 237, 0.9);
  border: 1px solid rgba(124, 58, 237, 0.5);
  border-radius: 3px;
  padding: 0px 4px;
}
.remaining-pill {
  display: inline-block;
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  color: rgba(24, 160, 88, 0.9);
  border: 1px solid rgba(24, 160, 88, 0.5);
  border-radius: 3px;
  padding: 0px 4px;
  box-shadow: 0 0 7px 2px rgba(24, 160, 88, 0.25);
}
.remaining-pill--warning {
  color: #FFA000;
  border-color: rgba(255, 160, 0, 0.5);
  box-shadow: 0 0 7px 2px rgba(255, 160, 0, 0.4);
}
.ots-qr-popover {
  display: flex;
  align-items: center;
  justify-content: center;
}
.ots-qr-popover img {
  display: block;
  border-radius: 4px;
}
.ots-scope-line {
  font-size: 13px;
}
.ots-vars-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 2px;
}
.ots-vars-table td {
  border: none;
  padding: 1px 8px 1px 0;
  font-size: 13px;
  line-height: 1.3;
}
.ots-vars-table__key {
  color: #888;
  white-space: nowrap;
}
.ots-vars-table__value {
  width: 100%;
}
.ots-step-card {
  margin-bottom: 12px;
}
.ots-step-card :deep(.n-card__content) {
  padding: 14px;
}
.ots-step {
  min-height: 60px;
}
.ots-step--split {
  display: flex;
  gap: 16px;
}
.ots-step__select {
  flex: 1;
  min-width: 0;
}
.ots-step__desc {
  flex: 1;
  min-width: 0;
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
.ots-variable-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0 16px;
}
.ots-variable {
  margin-bottom: 12px;
}
.ots-variable__label {
  margin-bottom: 4px;
  font-size: 13px;
}
.ots-variable__required {
  color: #e74c3c;
}
.ots-variable__desc {
  color: #888;
  font-size: 12px;
  margin-left: 8px;
}
.ots-no-variables {
  opacity: 0.55;
  font-size: 13px;
}
.ots-error {
  margin-top: 10px;
  color: #e74c3c;
  font-size: 13px;
}
.ots-nav {
  display: flex;
  align-items: center;
  gap: 3px;
  margin-top: 16px;
}
</style>
