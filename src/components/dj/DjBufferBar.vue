<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { NSlider } from 'naive-ui'
import { useBrandsStore } from '@/stores/brands'

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
const committed = computed(() => state.value ? Math.min(duration.value, state.value.buffer.committedSeconds + elapsed.value) : 0)
const pending = computed(() => state.value ? Math.max(0, state.value.buffer.pendingSeconds - elapsed.value) : 0)

function fmt(seconds: number) {
  const s = Math.floor(seconds)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
</script>

<template>
  <div v-if="state" class="dj-buffer">
    <div class="dj-buffer-head">
      <span class="dj-buffer-title">{{ state.buffer.title }}</span>
      <span class="dj-buffer-time">
        {{ t('dj.buffer_committed', { committed: fmt(committed), total: fmt(duration) }) }}
        · {{ t('dj.buffer_pending', { pending: fmt(pending) }) }}
      </span>
    </div>
    <NSlider :value="committed" :min="0" :max="duration || 1" :step="0.1" :tooltip="false" disabled />
  </div>
</template>

<style scoped>
.dj-buffer {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.dj-buffer-head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  font-size: 0.75rem;
  color: var(--dj-muted);
}
.dj-buffer-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dj-buffer-time {
  flex: none;
  font-variant-numeric: tabular-nums;
}
</style>
