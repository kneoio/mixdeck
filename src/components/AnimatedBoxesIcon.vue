<template>
  <div
    ref="rootRef"
    class="animated-boxes"
    :style="{ width: `${size}px`, height: `${size}px` }"
  >
    <span v-for="i in 9" :key="i" class="animated-boxes__box" :style="{ background: color }" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import gsap from 'gsap'

withDefaults(
  defineProps<{
    size?: number
    color?: string
  }>(),
  {
    size: 20,
    color: '#FF2D95',
  }
)

const rootRef = ref<HTMLElement | null>(null)
let ctx: gsap.Context | null = null

onMounted(() => {
  const root = rootRef.value
  if (!root) return

  ctx = gsap.context(() => {
    const boxes = root.querySelectorAll<HTMLElement>('.animated-boxes__box')
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduceMotion) return

    gsap.set(boxes, { scale: 0.55, opacity: 0.45, transformOrigin: 'center' })
    gsap.to(boxes, {
      scale: 1,
      opacity: 1,
      duration: 1,
      ease: 'power1.inOut',
      yoyo: true,
      repeat: 1,
      stagger: { each: 0.18, from: 'random' },
    })
  }, root)
})

onUnmounted(() => {
  ctx?.revert()
  ctx = null
})
</script>

<style scoped>
.animated-boxes {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  grid-template-rows: repeat(3, 1fr);
  gap: 12%;
  padding: 6%;
  box-sizing: border-box;
}

.animated-boxes__box {
  border-radius: 1.5px;
  will-change: transform, opacity;
}
</style>
