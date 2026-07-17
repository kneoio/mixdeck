<template>
  <div class="gsap-loader" :style="{ '--gsap-loader-size': size + 'px' }">
    <div class="gsap-loader__box">
      <span ref="dotRef" class="gsap-loader__dot" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import gsap from 'gsap'

withDefaults(defineProps<{ size?: number }>(), { size: 44 })

const dotRef = ref<HTMLElement | null>(null)
let orbit: gsap.core.Timeline | null = null

onMounted(() => {
  const dot = dotRef.value
  if (!dot) return
  gsap.set(dot, { left: '0%', top: '0%', xPercent: -50, yPercent: -50 })
  orbit = gsap.timeline({ repeat: -1 })
    .to(dot, { left: '100%', duration: 0.22, ease: 'none' })
    .to(dot, { top: '100%', duration: 0.22, ease: 'none' })
    .to(dot, { left: '0%', duration: 0.22, ease: 'none' })
    .to(dot, { top: '0%', duration: 0.22, ease: 'none' })
})

onBeforeUnmount(() => {
  orbit?.kill()
  orbit = null
})
</script>

<style scoped>
.gsap-loader {
  position: relative;
  display: inline-block;
  width: var(--gsap-loader-size);
  height: var(--gsap-loader-size);
}
.gsap-loader__box {
  position: absolute;
  inset: calc(var(--gsap-loader-size) * 0.18);
  transform: rotate(45deg);
  border-radius: 3px;
  background: rgba(124, 58, 237, 0.08);
  border: 1px solid rgba(124, 58, 237, 0.35);
}
.gsap-loader__dot {
  position: absolute;
  width: calc(var(--gsap-loader-size) * 0.136);
  height: calc(var(--gsap-loader-size) * 0.136);
  border-radius: 50%;
  background: #ff2d95;
  box-shadow:
    0 0 3px 1px #ff2d95,
    0 0 6px 2px rgba(255, 45, 149, 0.6);
  pointer-events: none;
}
</style>
