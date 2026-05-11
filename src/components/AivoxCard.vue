<script setup lang="ts">
import { computed, ref, watch, onMounted, onUnmounted } from 'vue'
import { NCard, NButton } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import aivoxApiService from '@/services/aivoxApi'
import type { AivoxQueueEntry } from '@/services/aivoxApi'
import LedIndicator from '@/components/LedIndicator.vue'
import { useBrandsStore } from '@/stores/brands'

const props = defineProps<{ brandSlug: string; timezone?: string }>()
const { t } = useI18n()
const brandsStore = useBrandsStore()

const alive = computed(() => brandsStore.streamingStates[props.brandSlug] ?? false)
const loading = ref(false)
const localTime = ref('')
const queueEntries = ref<AivoxQueueEntry[]>([])

const HEARTBEAT_POLL_BASE_MS = 5000
const HEARTBEAT_POLL_MAX_MS = 180_000

let pollTimer: ReturnType<typeof setTimeout> | null = null
let pollIntervalMs = HEARTBEAT_POLL_BASE_MS
let heartbeatPollCancelled = false
let timeTimer: ReturnType<typeof setInterval> | null = null
let queueTimer: ReturnType<typeof setInterval> | null = null

const sortedQueueEntries = computed(() =>
  [...queueEntries.value].sort((a, b) => a.tech.pos - b.tech.pos)
)

async function fetchHeartbeatAlive(): Promise<boolean> {
  if (!props.brandSlug) return false
  const slug = props.brandSlug
  const { alive } = await aivoxApiService.heartbeat(slug)
  if (props.brandSlug !== slug) return alive
  brandsStore.setStreamingState(slug, alive)
  return alive
}

async function pollHeartbeatScheduled(): Promise<void> {
  if (heartbeatPollCancelled || !props.brandSlug) return
  const slug = props.brandSlug
  const { alive, status } = await aivoxApiService.heartbeat(slug)
  if (heartbeatPollCancelled || props.brandSlug !== slug) return
  brandsStore.setStreamingState(slug, alive)
  if (status === 401) {
    pollIntervalMs = Math.min(pollIntervalMs * 2, HEARTBEAT_POLL_MAX_MS)
  } else {
    pollIntervalMs = HEARTBEAT_POLL_BASE_MS
  }
  scheduleHeartbeatPoll()
}

function scheduleHeartbeatPoll() {
  if (pollTimer) {
    clearTimeout(pollTimer)
    pollTimer = null
  }
  if (heartbeatPollCancelled || !props.brandSlug) return
  pollTimer = setTimeout(() => void pollHeartbeatScheduled(), pollIntervalMs)
}

async function handleClick() {
  if (loading.value) return
  const slug = props.brandSlug
  if (!slug) return
  loading.value = true
  const targetAlive = !alive.value
  try {
    if (alive.value) await aivoxApiService.stop(slug)
    else await aivoxApiService.start(slug)

    const deadline = Date.now() + 20_000
    while (
      Date.now() < deadline
      && props.brandSlug === slug
      && alive.value !== targetAlive
    ) {
      await fetchHeartbeatAlive()
      if (alive.value === targetAlive) break
      await new Promise(r => setTimeout(r, 400))
    }
  } catch {
    if (props.brandSlug === slug) await fetchHeartbeatAlive()
  } finally {
    loading.value = false
  }
}

function startPolling() {
  heartbeatPollCancelled = false
  pollIntervalMs = HEARTBEAT_POLL_BASE_MS
  void pollHeartbeatScheduled()
}

function stopPolling() {
  heartbeatPollCancelled = true
  if (pollTimer) {
    clearTimeout(pollTimer)
    pollTimer = null
  }
}

async function pollQueue() {
  if (!props.brandSlug) return
  const slug = props.brandSlug
  try {
    const response = await aivoxApiService.queue(slug)
    if (props.brandSlug !== slug) return
    queueEntries.value = Array.isArray(response.fullQueue) ? response.fullQueue : []
  } catch {
    if (props.brandSlug !== slug) return
    queueEntries.value = []
  }
}

function startQueuePolling() {
  pollQueue()
  queueTimer = setInterval(pollQueue, 10000)
}

function stopQueuePolling() {
  if (queueTimer) { clearInterval(queueTimer); queueTimer = null }
}

function queueTypeLabel(item: AivoxQueueEntry): string {
  if (item.tech.queueType === 'playing') return t('dashboard.queue.nowPlaying')
  if (item.tech.queueType === 'played') return t('dashboard.queue.played')
  if (item.tech.queueType === 'prioritized') return t('dashboard.queue.upNext')
  return t('dashboard.queue.inQueue')
}

function mergingMethodLabel(item: AivoxQueueEntry): string {
  const key = `dashboard.queue.mixing.${item.tech.mergingMethod}`
  return t(key)
}

function hasDjInvolvement(item: AivoxQueueEntry): boolean {
  return (item.tech.mergingMethod ?? '').includes('INTRO')
}

/** Background (and border when not the current track) from queue priority; 9 = normal (no tint). */
function queuePriorityStyle(item: AivoxQueueEntry): Record<string, string> | undefined {
  if (item.tech.queueType === 'played') return undefined
  const p = item.tech.priority
  if (p === undefined || p === 9) return undefined
  const hue = (p * 47) % 360
  const bg = `hsla(${hue}, 46%, 46%, 0.2)`
  const border = `hsla(${hue}, 52%, 58%, 0.48)`
  if (item.tech.queueType === 'playing') {
    return { background: bg }
  }
  return { background: bg, borderColor: border }
}

function updateLocalTime() {
  if (props.timezone) {
    try {
      const now = new Date()
      localTime.value = now.toLocaleTimeString('en-US', {
        timeZone: props.timezone,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      })
    } catch (error) {
      console.error('Error formatting time:', error)
      localTime.value = 'Invalid timezone'
    }
  }
}

function startTimeUpdate() {
  updateLocalTime()
  timeTimer = setInterval(updateLocalTime, 1000)
}

function stopTimeUpdate() {
  if (timeTimer) { clearInterval(timeTimer); timeTimer = null }
}

watch(() => props.brandSlug, (val) => {
  stopPolling()
  stopQueuePolling()
  if (val) startPolling()
  if (val) startQueuePolling()
})

watch(() => props.timezone, (val) => {
  stopTimeUpdate()
  if (val) startTimeUpdate()
})

onMounted(() => {
  if (props.brandSlug) startPolling()
  if (props.brandSlug) startQueuePolling()
  if (props.timezone) startTimeUpdate()
})

onUnmounted(() => {
  stopPolling()
  stopQueuePolling()
  stopTimeUpdate()
})
</script>

<template>
  <NCard class="aivox-card">
    <div class="aivox-row">
      <NButton
        :type="alive ? 'error' : 'primary'"
        :loading="loading"
        :disabled="loading"
        @click="handleClick"
      >
        {{ alive ? 'Stop' : 'Start' }}
      </NButton>
      <div class="aivox-status">
        <LedIndicator :active="alive" :pulse="alive" color="#FFD600" :size="18" />
        <span class="aivox-label">{{ t('dashboard.onAir') }}</span>
      </div>
      <div v-if="timezone" class="time-info">
        <div class="time-display">
          <span class="label">{{ t('dashboard.stationTime') }}:</span>
          <span class="time">{{ localTime }}</span>
        </div>
        <div class="timezone-display">
          <span class="label">{{ t('dashboard.timezone') }}:</span>
          <span class="timezone">{{ timezone }}</span>
        </div>
      </div>
    </div>
    <div class="queue-wrap">
      <div
        v-for="item in sortedQueueEntries"
        :key="`${item.tech.slugName}-${item.tech.pos}`"
        class="queue-item"
        :class="[
          `queue-item--${item.tech.queueType}`,
          item.tech.queueType === 'playing' ? 'queue-item--current' : '',
          hasDjInvolvement(item) ? 'queue-item--dj' : 'queue-item--no-dj'
        ]"
        :style="queuePriorityStyle(item)"
      >
        <div class="queue-item-main">
          <span class="queue-pos">#{{ item.tech.pos }}</span>
          <span class="queue-title">{{ item.dj.title }}</span>
          <span class="queue-artist"> - {{ item.dj.artist }}</span>
        </div>
        <div class="queue-meta">
          <span class="queue-mixing">{{ mergingMethodLabel(item) }}</span>
          <span class="queue-type">{{ queueTypeLabel(item) }}</span>
        </div>
      </div>
    </div>
  </NCard>
</template>

<style scoped>
.aivox-card {
  margin-top: 24px;
}
.aivox-row {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}
.aivox-status {
  display: flex;
  align-items: center;
  gap: 10px;
}
.aivox-label {
  font-size: 0.85rem;
  font-weight: 500;
}
.time-info {
  display: flex;
  gap: 1.5rem;
  margin-left: auto;
  flex-wrap: wrap;
}
.time-display,
.timezone-display {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.label {
  font-size: 0.85rem;
  font-weight: 500;
  opacity: 0.7;
}
.time {
  font-size: 1.1rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.timezone {
  font-weight: 500;
}
.queue-wrap {
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.queue-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  border-radius: 0;
  padding: 8px 10px;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.08);
}
.queue-item-main {
  min-width: 0;
  display: flex;
  align-items: baseline;
  gap: 6px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.queue-pos {
  font-weight: 700;
  opacity: 0.8;
}
.queue-title {
  font-weight: 600;
}
.queue-artist {
  opacity: 0.8;
}
.queue-mixing {
  font-size: 11px;
  font-weight: 500;
  opacity: 0.6;
  font-style: italic;
}
.queue-type {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.02em;
  text-transform: uppercase;
}
.queue-meta {
  display: flex;
  align-items: center;
  gap: 10px;
}
.queue-item--playing {
  border-color: rgba(255, 214, 0, 0.4);
  background: rgba(255, 214, 0, 0.1);
}
.queue-item--playing.queue-item--current {
  box-shadow: 0 0 0 1px rgba(255, 214, 0, 0.35);
}
.queue-item--played {
  border-color: rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.015);
  opacity: 0.6;
}
.queue-item--prioritized {
  border-color: rgba(24, 160, 88, 0.35);
  background: rgba(24, 160, 88, 0.08);
}
.queue-item--regular {
  border-color: rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.03);
}
.queue-item--dj:not(.queue-item--played) {
  border-color: rgba(33, 150, 243, 0.45);
  background: rgba(33, 150, 243, 0.11);
}
.queue-item--no-dj:not(.queue-item--played) {
  border-color: rgba(24, 160, 88, 0.35);
  background: rgba(24, 160, 88, 0.08);
}
</style>
