<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { NCard, NButton } from 'naive-ui'
import aivoxApiService from '@/services/aivoxApi'
import LedIndicator from '@/components/LedIndicator.vue'

const props = defineProps<{ brandSlug: string }>()
const emit = defineEmits<{ (e: 'update:alive', value: boolean): void }>()

const alive = ref(false)
const loading = ref(false)

let pollTimer: ReturnType<typeof setInterval> | null = null

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
</style>
