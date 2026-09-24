<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import BoxProgressBar from '@/components/BoxProgressBar.vue'
import { useBrandsStore } from '@/stores/brands'

/**
 * How far the song on air has played, and how much audio aivox already has queued behind the live edge.
 * An empty buffer on a running station is the first sign of a stalled stream.
 */
const props = defineProps<{ brandSlug: string }>()
const { t } = useI18n()
const brandsStore = useBrandsStore()

const now = ref(Date.now())
let timer: ReturnType<typeof setInterval> | null = null
onMounted(() => { timer = setInterval(() => { now.value = Date.now() }, 1000) })
onBeforeUnmount(() => { if (timer) clearInterval(timer) })

const state = computed(() => brandsStore.bufferStates[props.brandSlug] ?? null)

// Frames arrive every 5 s; audio goes live in real time, so advance locally between them.
const elapsed = computed(() => state.value ? Math.max(0, (now.value - state.value.receivedAt) / 1000) : 0)
const duration = computed(() => state.value?.buffer.durationSeconds ?? 0)
const played = computed(() => state.value ? Math.min(duration.value, state.value.buffer.committedSeconds + elapsed.value) : 0)
const ahead = computed(() => state.value ? Math.max(0, state.value.buffer.pendingSeconds - elapsed.value) : 0)

function fmt(seconds: number) {
  const s = Math.floor(seconds)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
</script>

<template>
  <div v-if="state && duration > 0" class="stream-buffer">
    <span class="stream-buffer-label">{{ t('dashboard.bufferPlayed', { played: fmt(played), total: fmt(duration) }) }}</span>
    <BoxProgressBar
      class="stream-buffer-bar"
      :progress="played / duration"
      :buffered="ahead / duration"
      :remaining-seconds="duration - played"
    />
    <span class="stream-buffer-label">{{ t('dashboard.bufferAhead', { ahead: fmt(ahead) }) }}</span>
  </div>
</template>

<style scoped>
.stream-buffer {
  margin-top: 10px;
  display: flex;
  align-items: center;
  gap: 10px;
}
.stream-buffer-bar {
  flex: 1;
  min-width: 0;
}
.stream-buffer-label {
  flex: none;
  font-size: 11px;
  opacity: 0.55;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}
</style>
