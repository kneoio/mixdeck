<template>
  <div class="overview">
    <PageHeader :title="t('overview.title')" :count="brandsStore.brands.length" />

    <div class="overview-list">
      <h3 class="overview-section-title">{{ t('overview.radio_stream') }}</h3>
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
              @click="openBrandUrl(brand)"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h6v6"/><path d="M10 14L21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>
            </button>
          </div>
        </template>

        <AivoxCard
          v-if="brand.slugName"
          :brand-slug="brand.slugName"
          :timezone="brand.timeZone"
          :status="brand.status"
        />

        <!--
        <NCollapse v-if="brand.slugName" class="agenda-collapse">
          <NCollapseItem :title="t('agenda.title')" :name="brand.id">
            <AgendaCard :brand-slug="brand.slugName" :alive="isAlive(brand)" />
          </NCollapseItem>
        </NCollapse>
        -->
      </NCard>

      <p v-if="!brandsStore.brands.length" class="ots-empty">{{ t('overview.radio_none_running') }}</p>

      <h3 class="overview-section-title">{{ t('overview.one_time_stream') }}</h3>

      <NCard
        v-for="wizard in otsWizards"
        :key="wizard.id"
        class="ots-card"
      >
        <template #header>
          <div class="brand-head">
            <span class="brand-name">{{ wizard.name || t('overview.one_time_stream') }}</span>
            <span v-if="wizard.type" class="type-pill">{{ otsTypeLabel(wizard.type) }}</span>
            <StatusOrbitBadge v-if="wizard.status" class="brand-status" :class="{ 'brand-status--live': wizard.status === 'ON_LINE', 'brand-status--pill': wizard.status === 'OFF_LINE' || wizard.status === 'WARMING_UP' }" :live="wizard.status === 'STREAMING' || wizard.status === 'ON_LINE' || wizard.heartbeatAlive">{{ otsStatusLabel(wizard.status) }}</StatusOrbitBadge>
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
              v-if="wizard.link"
              class="copy-btn"
              title="Go to station"
              @click="openOtsPlayer(wizard)"
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
                <div v-else style="width: 180px; height: 180px; display: flex; align-items: center; justify-content: center;">
                  <GsapLoader :size="40" />
                </div>
              </div>
            </NPopover>
            <button
              class="copy-btn ots-remove-btn"
              :disabled="wizard.status !== 'OFF_LINE' && wizard.status !== 'DONE'"
              :title="t('overview.ots_remove_card')"
              @click="removeOtsWizard(wizard)"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        </template>

        <div class="ots-status-row">
          <GsapButton type="error" :disabled="wizard.stopping || wizard.status === 'OFF_LINE' || wizard.status === 'DONE'" @click="stopOtsWizard(wizard)">
            <span>{{ t('dashboard.broadcast_stop') }}</span>
          </GsapButton>
        </div>
        <AivoxQueue v-if="wizard.queue.length" :entries="wizard.queue" />
      </NCard>

      <Transition name="ots-fade" mode="out-in">
        <div v-if="!dashboardSnapshotReceived" key="loading" class="ots-loading">
          <GsapLoader />
        </div>
        <p v-else-if="!otsWizards.length" key="empty" class="ots-empty">{{ t('overview.ots_none_running') }}</p>
      </Transition>

    </div>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { NCard, NCollapse, NCollapseItem, NPopover } from 'naive-ui'
import QRCode from 'qrcode'
import { useBrandsStore, type Brand, type BrandStatus } from '@/stores/brands'
import { useOtsDefinitionsStore, type OtsDefinition } from '@/stores/otsDefinitions'
import aivoxApiService, { type AivoxDashboardStreamEntry, type AivoxQueueEntry } from '@/services/aivoxApi'
import { authService } from '@/services/auth'
import PageHeader from '@/components/PageHeader.vue'
import AivoxCard from '@/components/AivoxCard.vue'
import GsapButton from '@/components/GsapButton.vue'
import StatusOrbitBadge from '@/components/StatusOrbitBadge.vue'
import AgendaCard from '@/components/AgendaCard.vue'
import GsapLoader from '@/components/GsapLoader.vue'
import AivoxQueue from '@/components/AivoxQueue.vue'

const { t } = useI18n()
const router = useRouter()
const brandsStore = useBrandsStore()
const otsDefinitionsStore = useOtsDefinitionsStore()

const brandLabel = (brand: Brand) =>
  brand.localizedName?.['en'] || brand.title || brand.slugName || brand.id

function isAlive(brand: Brand): boolean {
  return brandsStore.streamingStates[brand.slugName ?? ''] ?? false
}

function ledState(brand: Brand): { active: boolean; color: string; label: string } {
  const slug = brand.slugName ?? ''
  const liveState = brandsStore.streamingStates[slug]
  const status = radioStatuses[slug] ?? brand.status
  const isOnline = liveState === true || (liveState === undefined && status === 'ON_LINE')
  const isWarmingUp = status === 'WARMING_UP'
  const isIdle = liveState === false
    ? status === 'IDLE'
    : (liveState === undefined && status === 'IDLE')
  if (isOnline) return { active: true, color: '#00FF3C', label: t('overview.online') }
  if (isWarmingUp) return { active: true, color: '#FFD600', label: t('overview.ots_status_warming_up') }
  if (isIdle) return { active: true, color: '#FFD600', label: t('overview.idle') }
  return { active: false, color: '#00FF3C', label: t('overview.offline') }
}

function goPlaylist(brand: Brand) {
  router.push(`/brands/${brand.slugName}/playlist`)
}

const copiedId = ref<string | null>(null)
function copyUrl(brand: Brand) {
  if (!brand.mixplaUrl) return
  navigator.clipboard.writeText(brand.mixplaUrl)
  copiedId.value = brand.id
  setTimeout(() => { copiedId.value = null }, 2000)
}

interface OtsStatusEntry {
  id: string
  scope: 'brand' | 'default'
  brandId: string | null
  link: string
  linkCopied: boolean
  qrDataUrl: string | null
  name?: string
  status?: string
  type?: string
  slugName?: string
  heartbeatAlive: boolean
  stopping: boolean
  queue: AivoxQueueEntry[]
}

const otsWizards = ref<OtsStatusEntry[]>([])
const dashboardSnapshotReceived = ref(false)
const radioStatuses = reactive<Record<string, BrandStatus>>({})

const OTS_PLAYER_THEMES = ['hitachi', 'akai', '']
function otsPlayerLink(slugName?: string | null): string {
  if (!slugName) return ''
  const base = `https://mixpla.online/${slugName}`
  const theme = OTS_PLAYER_THEMES[Math.floor(Math.random() * OTS_PLAYER_THEMES.length)]
  return theme ? `${base}?theme=${theme}` : base
}

function buildOtsWizard(def: OtsDefinition): OtsStatusEntry {
  return reactive({
    id: def.id,
    scope: def.brandId ? 'brand' : 'default',
    brandId: def.brandId,
    link: otsPlayerLink(def.slugName),
    linkCopied: false,
    qrDataUrl: null,
    name: def.name,
    status: def.status,
    type: def.type,
    slugName: def.slugName,
    heartbeatAlive: false,
    stopping: false,
    queue: [],
  })
}

const OTS_QUEUE_POLL_MS = 10000
let otsQueueTimer: ReturnType<typeof setInterval> | null = null

function isOtsLive(w: OtsStatusEntry): boolean {
  return w.status === 'ON_LINE' || w.status === 'STREAMING' || w.heartbeatAlive
}

/** Fetch one OTS stream's queue from aivox (same REST endpoint the radio cards poll). */
async function pollOtsQueue(w: OtsStatusEntry) {
  if (!w.slugName) return
  const slug = w.slugName
  try {
    const res = await aivoxApiService.queue(slug)
    if (w.slugName !== slug) return
    w.queue = Array.isArray(res.fullQueue) ? res.fullQueue : []
  } catch {
    if (w.slugName !== slug) return
    w.queue = []
  }
}

function pollOtsQueues() {
  for (const w of otsWizards.value) {
    if (isOtsLive(w)) pollOtsQueue(w)
    else if (w.queue.length) w.queue = []
  }
}

function startOtsQueuePolling() {
  if (otsQueueTimer) return
  otsQueueTimer = setInterval(pollOtsQueues, OTS_QUEUE_POLL_MS)
}

function stopOtsQueuePolling() {
  if (otsQueueTimer) { clearInterval(otsQueueTimer); otsQueueTimer = null }
}

/** Entry is present, meaning aivox reports this slug as currently in the pool. */
function applyDashboardEntry(entry: AivoxDashboardStreamEntry) {
  if (entry.type === 'RADIO') {
    brandsStore.setStreamingState(entry.brand, entry.heartbeat)
    if (entry.status) radioStatuses[entry.brand] = entry.status as BrandStatus
    if (entry.heartbeat) brandsStore.pulseHeartbeat(entry.brand)
    return
  }
  let wizard = otsWizards.value.find(w => w.slugName === entry.brand)
  if (!wizard) {
    const def = otsDefinitionsStore.otsDefinitions.find(d => d.slugName === entry.brand)
    if (!def) return
    wizard = buildOtsWizard(def)
    otsWizards.value.push(wizard)
  }
  const wasLive = isOtsLive(wizard)
  wizard.heartbeatAlive = entry.heartbeat
  if (entry.status) wizard.status = entry.status
  if (!wasLive && isOtsLive(wizard)) pollOtsQueue(wizard)
  else if (wasLive && !isOtsLive(wizard)) wizard.queue = []
}

function applyDashboardSnapshot(entries: AivoxDashboardStreamEntry[]) {
  const present = new Set(entries.map(e => e.brand))
  for (const brand of brandsStore.brands) {
    if (brand.slugName && !present.has(brand.slugName)) {
      brandsStore.setStreamingState(brand.slugName, false)
      delete radioStatuses[brand.slugName]
    }
  }
  for (let i = otsWizards.value.length - 1; i >= 0; i--) {
    const slug = otsWizards.value[i].slugName
    if (slug && !present.has(slug)) otsWizards.value.splice(i, 1)
  }
  entries.forEach(applyDashboardEntry)
}

const DASHBOARD_STALE_MS = 15000

let dashboardSocket: WebSocket | null = null
let dashboardReconnectTimer: ReturnType<typeof setTimeout> | null = null
let dashboardReconnectAttempts = 0
let dashboardWatchdogTimer: ReturnType<typeof setInterval> | null = null
let dashboardLastMessageAt = 0

function teardownDashboardSocket(socket: WebSocket | null) {
  if (!socket) return
  socket.onopen = null
  socket.onmessage = null
  socket.onerror = null
  socket.onclose = null
  socket.close()
}

function scheduleDashboardReconnect() {
  if (dashboardReconnectTimer) return
  dashboardReconnectAttempts++
  const delay = Math.min(1000 * 2 ** dashboardReconnectAttempts, 15000)
  dashboardReconnectTimer = setTimeout(() => {
    dashboardReconnectTimer = null
    connectDashboardSocket()
  }, delay)
}

function connectDashboardSocket() {
  teardownDashboardSocket(dashboardSocket)
  dashboardSocket = null
  if (dashboardReconnectTimer) { clearTimeout(dashboardReconnectTimer); dashboardReconnectTimer = null }
  const url = aivoxApiService.dashboardStreamUrl()
  if (!url) {
    scheduleDashboardReconnect()
    return
  }
  const socket = new WebSocket(url)
  dashboardSocket = socket
  const openedAt = Date.now()
  dashboardLastMessageAt = openedAt
  socket.onopen = () => { dashboardReconnectAttempts = 0; dashboardLastMessageAt = Date.now() }
  socket.onmessage = (event) => {
    dashboardLastMessageAt = Date.now()
    try {
      const entries = JSON.parse(event.data as string) as AivoxDashboardStreamEntry[]
      if (Array.isArray(entries)) applyDashboardSnapshot(entries)
      dashboardSnapshotReceived.value = true
    } catch { /* ignore malformed frame */ }
  }
  socket.onerror = () => { socket.close() }
  socket.onclose = () => {
    if (dashboardSocket !== socket) return
    dashboardSocket = null
    const likelyAuthRejection = Date.now() - openedAt < 1000
    if (likelyAuthRejection) {
      authService.refreshToken().finally(() => scheduleDashboardReconnect())
    } else {
      scheduleDashboardReconnect()
    }
  }
}

/** A backend restart doesn't always deliver a clean close/error frame to an open socket, so watch for silence and force a reconnect. */
function startDashboardWatchdog() {
  stopDashboardWatchdog()
  dashboardWatchdogTimer = setInterval(() => {
    if (dashboardSocket && Date.now() - dashboardLastMessageAt > DASHBOARD_STALE_MS) {
      connectDashboardSocket()
    }
  }, 5000)
}

function stopDashboardWatchdog() {
  if (dashboardWatchdogTimer) { clearInterval(dashboardWatchdogTimer); dashboardWatchdogTimer = null }
}

function stopDashboardSocket() {
  stopDashboardWatchdog()
  if (dashboardReconnectTimer) { clearTimeout(dashboardReconnectTimer); dashboardReconnectTimer = null }
  teardownDashboardSocket(dashboardSocket)
  dashboardSocket = null
}

async function stopOtsWizard(wizard: OtsStatusEntry) {
  if (wizard.stopping || !wizard.slugName || wizard.status === 'OFF_LINE' || wizard.status === 'DONE') return
  wizard.stopping = true
  try {
    await aivoxApiService.stop(wizard.slugName)
  } finally {
    wizard.stopping = false
  }
}

function openBrandUrl(brand: Brand) {
  if (!brand.mixplaUrl) return
  window.open(brand.mixplaUrl, '_blank', 'noopener,noreferrer')
}

function openOtsPlayer(wizard: OtsStatusEntry) {
  if (!wizard.link) return
  window.open(wizard.link, '_blank', 'noopener,noreferrer')
}

function removeOtsWizard(wizard: OtsStatusEntry) {
  if (wizard.status !== 'OFF_LINE' && wizard.status !== 'DONE') return
  const idx = otsWizards.value.indexOf(wizard)
  if (idx !== -1) otsWizards.value.splice(idx, 1)
}

function copyOtsLink(wizard: OtsStatusEntry) {
  if (!wizard.link) return
  navigator.clipboard.writeText(wizard.link)
  wizard.linkCopied = true
  setTimeout(() => { wizard.linkCopied = false }, 2000)
}

async function loadOtsQrCode(wizard: OtsStatusEntry) {
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
  if (status === 'OFF_LINE') return t('overview.ots_status_off_line')
  if (status === 'WARMING_UP') return t('overview.ots_status_warming_up')
  if (status === 'STREAMING') return t('overview.ots_status_streaming')
  if (status === 'DONE') return t('overview.ots_status_done')
  return status ?? ''
}

function otsTypeLabel(type?: string): string {
  if (type === 'ONE_SHOT') return t('overview.ots_type_one_shot')
  return type ?? ''
}

onMounted(async () => {
  connectDashboardSocket()
  startDashboardWatchdog()
  startOtsQueuePolling()
  await otsDefinitionsStore.loadOtsDefinitions(1, 50)
})

onBeforeUnmount(() => {
  stopDashboardSocket()
  stopOtsQueuePolling()
})
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
  font-size: 9px;
  opacity: 0.55;
  text-transform: uppercase;
  letter-spacing: 0.07em;
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
.brand-status--live :deep(.orbit-badge--live),
.brand-status--live.orbit-badge--live {
  padding: 0 4px;
}
.brand-status--pill {
  display: inline-block;
  opacity: 1;
  font-weight: 600;
  color: rgba(160, 160, 160, 0.9);
  border: 1px solid rgba(128, 128, 128, 0.5);
  border-radius: 3px;
  padding: 0px 4px;
}
@keyframes brand-status-glow {
  0%, 100% { box-shadow: 0 0 7px 2px rgba(0, 255, 60, 0.25); }
  50% { box-shadow: 0 0 10px 3px rgba(0, 255, 60, 0.45); }
}
.brand-url {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}
.brand-url-link {
  font-size: 0.78rem;
  opacity: 0.6;
  color: inherit;
  text-decoration: none;
  border-bottom: 1px dashed currentColor;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
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
.ots-remove-btn:disabled {
  opacity: 0.25;
  cursor: not-allowed;
}
.ots-remove-btn:disabled:hover {
  opacity: 0.25;
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
.ots-card :deep(.n-card__content) {
  padding-top: 8px;
}
.ots-status-card {
  margin-top: 0px;
}
.ots-status-row {
  display: flex;
  align-items: center;
  gap: 3px;
  flex-wrap: wrap;
}
.ots-empty {
  text-align: center;
  opacity: 0.5;
  font-size: 13px;
  padding: 20px 0;
}
.ots-loading {
  display: flex;
  justify-content: center;
  padding: 20px 0;
}
.ots-fade-enter-active,
.ots-fade-leave-active {
  transition: opacity 0.25s ease;
}
.ots-fade-enter-from,
.ots-fade-leave-to {
  opacity: 0;
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
.ots-step :deep(.n-form-item) {
  margin-bottom: 20px;
}
.ots-step :deep(.n-form-item:last-child) {
  margin-bottom: 0;
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
  padding-left: 10px;
  color: #ff4d4f;
  font-size: 11px;
  line-height: 1.3;
  display: none;
}
.field-error-label--visible {
  display: block;
}
.ots-variable__required {
  color: #e74c3c;
  margin-left: 2px;
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
