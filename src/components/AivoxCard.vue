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
import AivoxQueue from '@/components/AivoxQueue.vue'
import { useBrandsStore, type BrandStatus } from '@/stores/brands'
import { useUserSubscriptionStore } from '@/stores/userSubscription'

const props = defineProps<{ brandSlug: string; timezone?: string; status?: BrandStatus }>()
const { t } = useI18n()
const brandsStore = useBrandsStore()
const userSubscriptionStore = useUserSubscriptionStore()
const message = useMessage()

const alive = computed(() => brandsStore.streamingStates[props.brandSlug] ?? false)
const showFreeBadge = computed(() => !alive.value && userSubscriptionStore.isFreePlan)
const loading = ref(false)
const waiting = ref(false)
const hasError = ref(false)
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

/** Resolves once the WS-driven `alive` state matches `expected`, or on timeout. */
function waitForAlive(expected: boolean, timeoutMs = 120_000): Promise<boolean> {
  if (alive.value === expected) return Promise.resolve(expected)
  return new Promise((resolve) => {
    const stop = watch(alive, (val) => {
      if (val === expected) {
        stop()
        clearTimeout(timer)
        resolve(expected)
      }
    })
    const timer = setTimeout(() => { stop(); resolve(!expected) }, timeoutMs)
  })
}

async function handleStart() {
  if (loading.value || alive.value) return
  const slug = props.brandSlug
  if (!slug) return
  loading.value = true
  hasError.value = false
  try {
    await aivoxApiService.start(slug)
    waiting.value = true
    await waitForAlive(true)
    flashTurn = true
    waiting.value = false
  } catch (e) {
    flashTurn = true
    waiting.value = false
    hasError.value = true
    if (e instanceof ApiNotEnoughSongsError) {
      message.error(t('dashboard.not_enough_songs', { current: e.current, required: e.required }))
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
  hasError.value = false
  try {
    await aivoxApiService.stop(slug)
    waiting.value = true
    await waitForAlive(false)
    waiting.value = false
  } catch {
    waiting.value = false
    hasError.value = true
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

function flashGreenOnce() {
  if (flashTimer) clearTimeout(flashTimer)
  flashGreen.value = true
  flashTimer = setTimeout(() => { flashGreen.value = false }, 600)
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

watch(() => brandsStore.heartbeatPulses[props.brandSlug], (val, oldVal) => {
  if (val !== undefined && val !== oldVal) flashGreenOnce()
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
            <LedIndicator :active="hasError" :pulse="hasError" color="#CC0000" :size="18" />
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
    <AivoxQueue :entries="queueEntries" />
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
  font-weight: 400;
  letter-spacing: 0.05em;
  padding: 2px 7px;
  border-radius: 3px;
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
</style>
