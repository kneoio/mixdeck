<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { NCard, NSwitch } from 'naive-ui'
import type { CSSProperties } from 'vue'
import aivoxApiService from '@/services/aivoxApi'
import LedIndicator from '@/components/LedIndicator.vue'

const props = defineProps<{ brandSlug: string }>()

const alive = ref(false)
const loading = ref(false)

let pollTimer: ReturnType<typeof setInterval> | null = null

async function poll() {
  if (!props.brandSlug) return
  alive.value = await aivoxApiService.heartbeat(props.brandSlug)
}

async function handleSwitch(value: boolean) {
  loading.value = true
  try {
    const result = value
      ? await aivoxApiService.start(props.brandSlug)
      : await aivoxApiService.stop(props.brandSlug)
    alive.value = !['stopped', 'error'].includes(result.status)
  } finally {
    loading.value = false
  }
}

function railStyle({ focused, checked }: { focused: boolean; checked: boolean }) {
  const style: CSSProperties = {}
  if (checked) {
    style.background = '#18a058'
    if (focused) style.boxShadow = '0 0 0 2px #18a05840'
  } else {
    style.background = '#d03050'
    if (focused) style.boxShadow = '0 0 0 2px #d0305040'
  }
  return style
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
      <NSwitch
        :value="alive"
        :loading="loading"
        :rail-style="railStyle"
        @update:value="handleSwitch"
      >
        <template #checked>Live</template>
        <template #unchecked>Offline</template>
      </NSwitch>
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
.aivox-state {
  font-family: monospace;
  font-size: 0.72rem;
  opacity: 0.55;
}
</style>
