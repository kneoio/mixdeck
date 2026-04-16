<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { NCard, NButton, NSpace } from 'naive-ui'
import metriqApiService from '@/services/metriqApi'
import LedIndicator from '@/components/LedIndicator.vue'

const props = defineProps<{ brandSlug: string }>()

const alive = ref(false)
const starting = ref(false)
const stopping = ref(false)

let pollTimer: ReturnType<typeof setInterval> | null = null

async function poll() {
  if (!props.brandSlug) return
  alive.value = await metriqApiService.aivoxHeartbeat(props.brandSlug)
}

async function start() {
  starting.value = true
  try {
    await metriqApiService.aivoxStart(props.brandSlug)
    await poll()
  } finally {
    starting.value = false
  }
}

async function stop() {
  stopping.value = true
  try {
    await metriqApiService.aivoxStop(props.brandSlug)
    await poll()
  } finally {
    stopping.value = false
  }
}

function startPolling() {
  poll()
  pollTimer = setInterval(poll, 5000)
}

function stopPolling() {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null }
}

watch(() => props.brandSlug, (val) => {
  stopPolling()
  if (val) startPolling()
})

onMounted(() => { if (props.brandSlug) startPolling() })
onUnmounted(() => stopPolling())
</script>

<template>
  <NCard class="aivox-card">
    <div class="aivox-row">
      <div class="aivox-status">
        <LedIndicator :active="alive" :pulse="alive" color="#FFD600" :size="18" />
        <span class="aivox-label">Aivox stream</span>
        <span class="aivox-state">{{ alive ? 'live' : 'offline' }}</span>
      </div>
      <NSpace>
        <NButton size="small" type="primary" :loading="starting" :disabled="starting || stopping" @click="start">
          Start
        </NButton>
        <NButton size="small" type="error" :loading="stopping" :disabled="starting || stopping" @click="stop">
          Stop
        </NButton>
      </NSpace>
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
  justify-content: space-between;
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
.aivox-state {
  font-family: monospace;
  font-size: 0.72rem;
  opacity: 0.55;
}
</style>
