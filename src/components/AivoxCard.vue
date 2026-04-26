<script setup lang="ts">
import { computed, ref, watch, onMounted, onUnmounted } from 'vue'
import { NCard, NButton } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import aivoxApiService from '@/services/aivoxApi'
import type { AivoxQueueEntry } from '@/services/aivoxApi'
import LedIndicator from '@/components/LedIndicator.vue'

const props = defineProps<{ brandSlug: string; timezone?: string }>()
const emit = defineEmits<{ (e: 'update:alive', value: boolean): void }>()
const { t } = useI18n()

const alive = ref(false)
const loading = ref(false)
const localTime = ref('')
const queueEntries = ref<AivoxQueueEntry[]>([])

let pollTimer: ReturnType<typeof setInterval> | null = null
let timeTimer: ReturnType<typeof setInterval> | null = null
let queueTimer: ReturnType<typeof setInterval> | null = null

const sortedQueueEntries = computed(() =>
  [...queueEntries.value]
    .sort((a, b) => a.pos - b.pos)
)

async function poll() {
  if (!props.brandSlug) return
  const val = await aivoxApiService.heartbeat(props.brandSlug)
  if (val !== alive.value) emit('update:alive', val)
  alive.value = val
}

async function handleClick() {
  loading.value = true
  try {
    const result = alive.value
      ? await aivoxApiService.stop(props.brandSlug)
      : await aivoxApiService.start(props.brandSlug)
    const val = !['stopped', 'error'].includes(result.status)
    if (val !== alive.value) emit('update:alive', val)
    alive.value = val
  } finally {
    loading.value = false
  }
}

function startPolling() {
  poll()
  pollTimer = setInterval(poll, 5000)
}

function stopPolling() {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null }
}

async function pollQueue() {
  if (!props.brandSlug) return
  try {
    const response = await aivoxApiService.queue(props.brandSlug)
    queueEntries.value = Array.isArray(response.fullQueue) ? response.fullQueue : []
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
  if (item.queueType === 'playing') return t('dashboard.queue.nowPlaying')
  if (item.queueType === 'played') return t('dashboard.queue.played')
  if (item.queueType === 'prioritized') return t('dashboard.queue.upNext')
  return t('dashboard.queue.inQueue')
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
        :key="`${item.songId}-${item.pos}`"
        class="queue-item"
        :class="[
          `queue-item--${item.queueType}`,
          item.queueType === 'playing' ? 'queue-item--current' : ''
        ]"
      >
        <div class="queue-item-main">
          <span class="queue-pos">#{{ item.pos }}</span>
          <span class="queue-title">{{ item.title }}</span>
          <span class="queue-artist"> - {{ item.artist }}</span>
        </div>
        <div class="queue-meta">
          <span
            v-if="item.priority !== undefined && item.priority !== 9"
            class="queue-priority"
            :class="item.priority <= 8 ? 'queue-priority--arrow' : ''"
          >
            <template v-if="item.priority <= 8">
              <span class="priority-arrow" :class="item.priority === 7 ? 'priority-arrow--high' : 'priority-arrow--med'">▲</span>
            </template>
            <template v-else>
              {{ t('dashboard.queue.priority') }}: {{ item.priority }}
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
