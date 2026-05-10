<script setup lang="ts">
import { computed, ref, watch, onMounted, onUnmounted } from 'vue'
import { NCard, NButton } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import aivoxApiService from '@/services/aivoxApi'
import type { AivoxQueueEntry, AivoxQueueType } from '@/services/aivoxApi'
import LedIndicator from '@/components/LedIndicator.vue'
import { useBrandsStore } from '@/stores/brands'

const props = defineProps<{ brandSlug: string; timezone?: string }>()
const { t, te, locale } = useI18n()
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

function normalizeQueueRow(raw: unknown): AivoxQueueEntry | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const dj = r.dj as Record<string, unknown> | undefined
  const tech = r.tech as Record<string, unknown> | undefined
  if (dj && tech && typeof tech.pos === 'number' && typeof tech.songId === 'string') {
    return {
      dj: {
        label: String(dj.label ?? ''),
        title: String(dj.title ?? ''),
        artist: String(dj.artist ?? ''),
      },
      tech: {
        pos: tech.pos,
        queueType: (tech.queueType as AivoxQueueType) || 'regular',
        priority: typeof tech.priority === 'number' ? tech.priority : 9,
        songId: String(tech.songId),
        slugName: tech.slugName != null ? String(tech.slugName) : undefined,
        mergingMethod: tech.mergingMethod != null ? String(tech.mergingMethod) : undefined,
        duration: typeof tech.duration === 'number' ? tech.duration : undefined,
      },
    }
  }
  if (typeof r.pos === 'number' && typeof r.songId === 'string') {
    return {
      dj: {
        label: '',
        title: String(r.title ?? ''),
        artist: String(r.artist ?? ''),
      },
      tech: {
        pos: r.pos,
        queueType: (r.queueType as AivoxQueueType) || 'regular',
        priority: typeof r.priority === 'number' ? r.priority : 9,
        songId: String(r.songId),
        slugName: r.slugName != null ? String(r.slugName) : undefined,
        mergingMethod: r.mergingMethod != null ? String(r.mergingMethod) : undefined,
        duration: typeof r.duration === 'number' ? r.duration : undefined,
      },
    }
  }
  return null
}

async function fetchHeartbeatAlive(): Promise<boolean> {
  if (!props.brandSlug) return false
  const { alive } = await aivoxApiService.heartbeat(props.brandSlug)
  brandsStore.setStreamingState(props.brandSlug, alive)
  return alive
}

async function pollHeartbeatScheduled(): Promise<void> {
  if (heartbeatPollCancelled || !props.brandSlug) return
  const { alive, status } = await aivoxApiService.heartbeat(props.brandSlug)
  if (heartbeatPollCancelled || !props.brandSlug) return
  brandsStore.setStreamingState(props.brandSlug, alive)
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
  loading.value = true
  const targetAlive = !alive.value
  try {
    if (alive.value) await aivoxApiService.stop(props.brandSlug)
    else await aivoxApiService.start(props.brandSlug)

    const deadline = Date.now() + 20_000
    while (Date.now() < deadline && alive.value !== targetAlive) {
      await fetchHeartbeatAlive()
      if (alive.value === targetAlive) break
      await new Promise(r => setTimeout(r, 400))
    }
  } catch {
    await fetchHeartbeatAlive()
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
  try {
    const response = await aivoxApiService.queue(props.brandSlug)
    const raw = Array.isArray(response.fullQueue) ? response.fullQueue : []
    queueEntries.value = raw.map(normalizeQueueRow).filter((e): e is AivoxQueueEntry => e != null)
  } catch {
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
  const qt = item.tech.queueType
  if (qt === 'playing') return t('dashboard.queue.nowPlaying')
  if (qt === 'played') return t('dashboard.queue.played')
  if (qt === 'prioritized') return t('dashboard.queue.upNext')
  return t('dashboard.queue.inQueue')
}

function mergingMethodLabel(method: string | undefined): string {
  if (!method) return ''
  const key = `dashboard.queue.mixing.${method}`
  return te(key) ? t(key) : method
}

function updateLocalTime() {
  if (props.timezone) {
    try {
      const now = new Date()
      localTime.value = now.toLocaleTimeString(locale.value || undefined, {
        timeZone: props.timezone,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      })
    } catch (error) {
      console.error('Error formatting time:', error)
      localTime.value = t('dashboard.invalid_timezone')
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
        {{ alive ? t('dashboard.broadcast_stop') : t('dashboard.broadcast_start') }}
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
        :key="`${item.tech.songId}-${item.tech.pos}`"
        class="queue-item"
        :class="[
          `queue-item--${item.tech.queueType}`,
          item.tech.queueType === 'playing' ? 'queue-item--current' : ''
        ]"
      >
        <div class="queue-item-main">
          <span class="queue-pos">#{{ item.tech.pos }}</span>
          <span v-if="item.dj.label" class="queue-dj-label">{{ item.dj.label }}</span>
          <span class="queue-title">{{ item.dj.title }}</span>
          <span class="queue-artist"> - {{ item.dj.artist }}</span>
        </div>
        <div class="queue-meta">
          <span
            v-if="item.tech.mergingMethod"
            class="queue-mixing"
          >{{ mergingMethodLabel(item.tech.mergingMethod) }}</span>
          <span
            v-if="item.tech.priority !== undefined && item.tech.priority !== 9 && item.tech.queueType !== 'played'"
            class="queue-priority"
            :class="item.tech.priority <= 8 ? 'queue-priority--arrow' : ''"
          >
            <template v-if="item.tech.priority <= 8">
              <span class="priority-arrow" :class="item.tech.priority === 7 ? 'priority-arrow--high' : 'priority-arrow--med'">▲</span>
            </template>
            <template v-else>
              {{ t('dashboard.queue.priority') }}: {{ item.tech.priority }}
            </template>
          </span>
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
.queue-dj-label {
  font-size: 11px;
  font-weight: 600;
  opacity: 0.65;
  flex-shrink: 0;
}
.queue-mixing {
  font-size: 11px;
  font-weight: 600;
  opacity: 0.85;
  max-width: 180px;
  text-align: right;
}
.queue-title {
  font-weight: 600;
}
.queue-artist {
  opacity: 0.8;
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
.queue-priority {
  font-size: 12px;
  font-weight: 600;
  opacity: 0.85;
}
.priority-arrow {
  font-size: 14px;
  font-weight: 700;
  line-height: 1;
}
.priority-arrow--med {
  color: #18a058;
  opacity: 1;
}
.priority-arrow--high {
  color: #f0a020;
  opacity: 1;
  text-shadow: 0 0 6px rgba(240, 160, 32, 0.6);
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
</style>
