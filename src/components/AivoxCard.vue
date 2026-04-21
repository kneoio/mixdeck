<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { NCard, NButton } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import aivoxApiService from '@/services/aivoxApi'
import LedIndicator from '@/components/LedIndicator.vue'

const props = defineProps<{ brandSlug: string; timezone?: string }>()
const emit = defineEmits<{ (e: 'update:alive', value: boolean): void }>()
const { t } = useI18n()

const alive = ref(false)
const loading = ref(false)
const localTime = ref('')

let pollTimer: ReturnType<typeof setInterval> | null = null
let timeTimer: ReturnType<typeof setInterval> | null = null

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
  if (val) startPolling()
})

watch(() => props.timezone, (val) => {
  stopTimeUpdate()
  if (val) startTimeUpdate()
})

onMounted(() => {
  if (props.brandSlug) startPolling()
  if (props.timezone) startTimeUpdate()
})

onUnmounted(() => {
  stopPolling()
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
        <span class="aivox-label">Aivox stream</span>
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
</style>
