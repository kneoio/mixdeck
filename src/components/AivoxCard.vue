<script setup lang="ts">
import { computed, ref, watch, onMounted, onUnmounted } from 'vue'
import { NCard, useMessage } from 'naive-ui'
import GsapButton from '@/components/GsapButton.vue'
import { useI18n } from 'vue-i18n'
import aivoxApiService from '@/services/aivoxApi'
import type { AivoxQueueEntry } from '@/services/aivoxApi'
import { ApiNotEnoughSongsError } from '@/utils/errorHandler'
import LedYellow from '@/components/LedYellow.vue'
import LedGreen from '@/components/LedGreen.vue'
import LedIndicator from '@/components/LedIndicator.vue'
import LoaderProgress from '@/components/LoaderProgress.vue'
import { useBrandsStore } from '@/stores/brands'
import { useUserSubscriptionStore } from '@/stores/userSubscription'

const props = defineProps<{ brandSlug: string; timezone?: string }>()
const { t, te } = useI18n()
const brandsStore = useBrandsStore()
const userSubscriptionStore = useUserSubscriptionStore()
const message = useMessage()

const alive = computed(() => brandsStore.streamingStates[props.brandSlug] ?? false)
const showFreeBadge = computed(() => !alive.value && userSubscriptionStore.isFreePlan)
const loading = ref(false)
const waiting = ref(false)
const flash = ref(false)
const flashGreen = ref(false)
let flashTurn = true
const localTime = ref('')
const queueEntries = ref<AivoxQueueEntry[]>([])

let flashTimer: ReturnType<typeof setTimeout> | null = null
let timeTimer: ReturnType<typeof setInterval> | null = null
let queueTimer: ReturnType<typeof setInterval> | null = null

function triggerFlash() {
  if (flashTimer) clearTimeout(flashTimer)
  flashTurn = !flashTurn
  if (flashTurn) {
    flash.value = true
    flashGreen.value = false
    flashTimer = setTimeout(() => { flash.value = false }, 600)
  } else {
    flashGreen.value = true
    flash.value = false
    flashTimer = setTimeout(() => { flashGreen.value = false }, 600)
  }
}

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

async function handleStart() {
  if (loading.value || alive.value) return
  const slug = props.brandSlug
  if (!slug) return
  loading.value = true
  try {
    await aivoxApiService.start(slug)
    waiting.value = true
    const isAlive = await aivoxApiService.heartbeatStream(slug, true)
    flashTurn = true
    waiting.value = false
    if (props.brandSlug === slug) brandsStore.setStreamingState(slug, isAlive)
  } catch (e) {
    flashTurn = true
    waiting.value = false
    if (e instanceof ApiNotEnoughSongsError) {
      message.error(t('dashboard.not_enough_songs', { current: e.current, required: e.required }))
    } else if (props.brandSlug === slug) {
      await fetchHeartbeatAlive()
    }
  } finally {
    loading.value = false
  }
}

async function handleStop() {
  if (loading.value || !alive.value) return
  const slug = props.brandSlug
  if (!slug) return
  loading.value = true
  try {
    await aivoxApiService.stop(slug)
    waiting.value = true
    const isAlive = await aivoxApiService.heartbeatStream(slug, false)
    waiting.value = false
    if (props.brandSlug === slug) brandsStore.setStreamingState(slug, isAlive)
  } catch {
    waiting.value = false
    if (props.brandSlug === slug) await fetchHeartbeatAlive()
  } finally {
    loading.value = false
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
  const method = String(item.tech.mergingMethod ?? 'NOT_MIXED').trim() || 'NOT_MIXED'
  const key = `dashboard.queue.mixing.${method}`
  if (te(key)) return t(key)
  return method.replace(/_/g, ' ').toLowerCase()
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
    const candidates = props.timezone === 'UTC' ? ['UTC', 'Etc/UTC'] : [props.timezone]
    for (const tz of candidates) {
      try {
        localTime.value = new Date().toLocaleTimeString('en-US', {
          timeZone: tz,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false
        })
        return
      } catch { /* try next */ }
    }
    localTime.value = t('dashboard.invalid_timezone')
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
  stopQueuePolling()
  if (val && alive.value) startQueuePolling()
})

watch(alive, (val) => {
  if (val) {
    startQueuePolling()
  } else {
    stopQueuePolling()
    queueEntries.value = []
  }
})

// Flash on every heartbeat response for this brand (real per-request feedback)
watch(() => brandsStore.heartbeatTicks[props.brandSlug], () => {
  if (alive.value) triggerFlash()
})

watch(() => props.timezone, (val) => {
  stopTimeUpdate()
  if (val) startTimeUpdate()
})

onMounted(() => {
  if (props.brandSlug && alive.value) startQueuePolling()
  if (props.timezone) startTimeUpdate()
})

onUnmounted(() => {
  stopQueuePolling()
  stopTimeUpdate()
  if (flashTimer) clearTimeout(flashTimer)
})
</script>

<template>
  <NCard class="aivox-card">
    <div class="aivox-row">
      <GsapButton
        type="primary"
        :disabled="loading || alive"
        @click="handleStart"
      >
        <span>Start</span>
      </GsapButton>
      <GsapButton
        type="error"
        :disabled="loading || !alive"
        @click="handleStop"
      >
        <span>Stop</span>
      </GsapButton>
      <div class="aivox-status">
        <div class="aivox-led-wrap">
          <div class="aivox-leds">
            <LedYellow :active="flash || waiting" />
            <LedIndicator :active="waiting" :pulse="waiting" color="#CC0000" :size="18" />
            <LedGreen :active="flashGreen" />
          </div>
          <span class="aivox-label">{{ t('dashboard.onAir') }}</span>
        </div>
        <span class="free-badge" :class="{ 'free-badge--hidden': !showFreeBadge }">{{ t('dashboard.free_streaming_limit') }}</span>
      </div>
      <div v-if="timezone" class="time-right">
        <span class="label tz-caption">{{ t('dashboard.stationTime') }}:</span>
        <span class="time">{{ localTime }}</span>
        <span class="tz-sep tz-caption">·</span>
        <span class="label tz-caption">{{ t('dashboard.timezone') }}:</span>
        <span class="timezone">{{ timezone }}</span>
      </div>
    </div>
    <div class="queue-wrap">
      <template v-for="(item, i) in sortedQueueEntries" :key="`${item.tech.slugName}-${item.tech.pos}`">
        <span v-if="i > 0" class="queue-connector">›</span>
        <div
          class="queue-item"
          :class="[`queue-item--${item.tech.queueType}`]"
        >
          <div class="queue-indicator">
            <span v-if="item.tech.queueType === 'playing'" class="queue-eq">
              <span class="bar" /><span class="bar" /><span class="bar" />
            </span>
            <span v-else class="queue-num">{{ item.tech.pos }}</span>
          </div>
          <div class="queue-info">
            <span class="queue-title">{{ item.dj.title }}</span>
            <span class="queue-sep">·</span>
            <span class="queue-artist">{{ item.dj.artist }}</span>
          </div>
          <div class="queue-right">
            <span class="queue-mixing">{{ mergingMethodLabel(item) }}</span>
            <span class="queue-type-tag" :class="`queue-type-tag--${item.tech.queueType}`">{{ queueTypeLabel(item) }}</span>
          </div>
        </div>
      </template>
    </div>
  </NCard>
</template>

<style scoped>
.aivox-card {
  margin-top: 0px;
}
.aivox-row {
  display: flex;
  align-items: center;
  gap: 3px;
  flex-wrap: wrap;
}
@media (max-width: 768px) {
  .aivox-row .time-right {
    flex-basis: 100%;
    margin-left: 0;
    margin-top: 8px;
  }
  .time {
    font-size: 1rem !important;
  }
  .timezone {
    font-size: 0.85rem;
  }
  .tz-caption {
    display: none;
  }
}
.aivox-status {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-left: 20px;
}
.free-badge {
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  padding: 2px 7px;
  border-radius: 10px;
  background: rgba(255, 214, 0, 0.15);
  border: 1px solid rgba(255, 214, 0, 0.5);
  color: #FFD600;
  white-space: nowrap;
  margin-left: 8px;
  opacity: 1;
  transition: opacity 2s ease;
}
.free-badge--hidden {
  opacity: 0;
}
.time-right {
  display: flex;
  align-items: baseline;
  gap: 6px;
  margin-left: auto;
  white-space: nowrap;
}
.aivox-led-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
}
.aivox-leds {
  display: flex;
  flex-direction: row;
  gap: 4px;
}
.aivox-label {
  font-size: 0.7rem;
  font-weight: 500;
  opacity: 0.7;
}
.label {
  font-size: 0.85rem;
  font-weight: 500;
  opacity: 0.7;
}
.time {
  font-size: 2rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.04em;
}
.tz-sep {
  opacity: 0.3;
}
.timezone {
  font-weight: 500;
}
.queue-wrap {
  margin-top: 10px;
  display: flex;
  flex-direction: row;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}
.queue-connector {
  font-size: 16px;
  opacity: 0.25;
  flex-shrink: 0;
  line-height: 1;
  user-select: none;
}
.queue-item {
  display: flex;
  align-items: center;
  gap: 10px;
  border-radius: 4px;
  padding: 7px 10px;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.07);
  flex-shrink: 0;
}
.queue-indicator {
  flex-shrink: 0;
  width: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.queue-num {
  font-size: 11px;
  font-weight: 600;
  opacity: 0.35;
  font-variant-numeric: tabular-nums;
}
.queue-eq {
  display: flex;
  align-items: flex-end;
  gap: 2px;
  height: 13px;
}
.queue-eq .bar {
  width: 3px;
  background: rgba(255, 214, 0, 0.9);
  border-radius: 1px;
  transform-origin: bottom;
  animation: eq-pulse 0.9s ease-in-out infinite alternate;
}
.queue-eq .bar:nth-child(1) { height: 7px; animation-delay: 0s; }
.queue-eq .bar:nth-child(2) { height: 13px; animation-delay: 0.18s; }
.queue-eq .bar:nth-child(3) { height: 5px; animation-delay: 0.09s; }
@keyframes eq-pulse {
  0%   { transform: scaleY(0.35); }
  100% { transform: scaleY(1); }
}
.queue-info {
  display: flex;
  align-items: baseline;
  gap: 5px;
  white-space: nowrap;
}
.queue-title {
  font-weight: 600;
}
.queue-sep {
  opacity: 0.25;
  flex-shrink: 0;
}
.queue-artist {
  font-size: 0.88em;
  opacity: 0.6;
}
.queue-right {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 8px;
}
.queue-mixing {
  font-size: 10px;
  opacity: 0.45;
  font-style: italic;
  white-space: nowrap;
}
.queue-type-tag {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  padding: 2px 6px;
  border-radius: 3px;
  white-space: nowrap;
}
.queue-type-tag--playing {
  background: rgba(255, 214, 0, 0.15);
  color: #FFD600;
  border: 1px solid rgba(255, 214, 0, 0.35);
}
.queue-type-tag--prioritized {
  background: rgba(24, 160, 88, 0.1);
  color: rgba(24, 160, 88, 0.9);
  border: 1px solid rgba(24, 160, 88, 0.3);
}
.queue-type-tag--played {
  background: transparent;
  opacity: 0.4;
  border: 1px solid rgba(255,255,255,0.12);
}
.queue-type-tag--regular {
  background: transparent;
  opacity: 0.5;
  border: 1px solid rgba(255,255,255,0.12);
}
.queue-item--playing {
  border-color: rgba(255, 214, 0, 0.25);
  background: rgba(255, 214, 0, 0.06);
  box-shadow: 0 0 0 1px rgba(255, 214, 0, 0.15);
}
.queue-item--played {
  opacity: 0.5;
}
.queue-item--prioritized {
  border-color: rgba(24, 160, 88, 0.2);
  background: rgba(24, 160, 88, 0.04);
}
.queue-item--regular {
  border-color: rgba(255, 255, 255, 0.08);
}
@media (max-width: 768px) {
  .queue-wrap {
    flex-direction: column;
    align-items: stretch;
  }
  .queue-connector {
    display: none;
  }
  .queue-item {
    width: 100%;
    box-sizing: border-box;
    flex-shrink: 1;
    overflow: hidden;
  }
  .queue-info {
    flex: 1;
    min-width: 0;
    overflow: hidden;
  }
  .queue-title {
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .queue-artist {
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 120px;
  }
  .queue-mixing {
    display: none;
  }
}
</style>
