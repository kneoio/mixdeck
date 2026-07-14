<template>
  <span class="orbit-badge" :class="{ 'orbit-badge--live': live }">
    <span class="orbit-badge__text"><slot /></span>
    <span v-if="live" ref="dotRef" class="orbit-badge__dot" />
  </span>
</template>

<script setup lang="ts">
import { ref, watch, onBeforeUnmount, nextTick } from 'vue'
import gsap from 'gsap'

const props = defineProps<{ live: boolean }>()

const dotRef = ref<HTMLElement | null>(null)
let orbit: gsap.core.Timeline | null = null

function stopOrbit() {
  orbit?.kill()
  orbit = null
}

function startOrbit() {
  stopOrbit()
  const dot = dotRef.value
  if (!dot) return
  gsap.set(dot, { left: '0%', top: '0%', xPercent: -50, yPercent: -50 })
  orbit = gsap.timeline({ repeat: -1 })
    .to(dot, { left: '100%', duration: 0.55, ease: 'none' })
    .to(dot, { top: '100%', duration: 0.35, ease: 'none' })
    .to(dot, { left: '0%', duration: 0.55, ease: 'none' })
    .to(dot, { top: '0%', duration: 0.35, ease: 'none' })
}

watch(
  () => props.live,
  async (live) => {
    if (live) {
      await nextTick()
      startOrbit()
    } else {
      stopOrbit()
    }
  },
  { immediate: true }
)

onBeforeUnmount(stopOrbit)
</script>

<style scoped>
.orbit-badge {
  position: relative;
  display: inline-block;
}
.orbit-badge--live {
  padding: 2px 6px;
}
.orbit-badge__text {
  position: relative;
  z-index: 1;
}
.orbit-badge__dot {
  position: absolute;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: #00ff3c;
  box-shadow:
    0 0 2px 0.5px #00ff3c,
    0 0 4px 1px rgba(0, 255, 60, 0.5);
  pointer-events: none;
  animation: orbit-glow-pulse 1s ease-in-out infinite;
}

@keyframes orbit-glow-pulse {
  0%, 100% {
    box-shadow:
      0 0 2px 0.5px #00ff3c,
      0 0 4px 1px rgba(0, 255, 60, 0.5);
  }
  50% {
    box-shadow:
      0 0 3px 1px #00ff3c,
      0 0 6px 2px rgba(0, 255, 60, 0.6);
  }
}
</style>
