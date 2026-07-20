<template>
  <svg
      :width="size"
      :height="size"
      viewBox="0 0 100 100"
      class="core"
  >
    <defs>
      <radialGradient id="coreGradient">
        <stop offset="0%" stop-color="#ffffff"/>
        <stop offset="40%" stop-color="#00d4ff"/>
        <stop offset="100%" stop-color="#7c3aed"/>
      </radialGradient>

      <filter id="glow">
        <feGaussianBlur stdDeviation="2.5" result="blur"/>
        <feMerge>
          <feMergeNode in="blur"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>
    </defs>

    <g :transform="`rotate(${ring1} 50 50)`">
      <ellipse
          cx="50"
          cy="50"
          rx="28"
          ry="12"
          class="ring"
      />
    </g>

    <g :transform="`rotate(${ring2} 50 50)`">
      <ellipse
          cx="50"
          cy="50"
          rx="28"
          ry="12"
          class="ring"
          transform="rotate(60 50 50)"
      />
    </g>

    <g :transform="`rotate(${ring3} 50 50)`">
      <ellipse
          cx="50"
          cy="50"
          rx="28"
          ry="12"
          class="ring"
          transform="rotate(120 50 50)"
      />
    </g>

    <circle
        cx="50"
        cy="50"
        :r="coreRadius"
        fill="url(#coreGradient)"
        filter="url(#glow)"
    />
  </svg>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'

withDefaults(defineProps<{ size?: number }>(), {
  size: 56
})

const ring1 = ref(0)
const ring2 = ref(120)
const ring3 = ref(240)
const coreRadius = ref(10)

let raf = 0
let t = 0

function animate() {
  t += 0.03

  ring1.value += 0.35
  ring2.value -= 0.28
  ring3.value += 0.18

  coreRadius.value = 10 + Math.sin(t * 2.5) * 1.8

  raf = requestAnimationFrame(animate)
}

onMounted(animate)

onBeforeUnmount(() => cancelAnimationFrame(raf))
</script>

<style scoped>
.core {
  overflow: visible;
}

.ring {
  fill: none;
  stroke: rgba(0,212,255,.65);
  stroke-width: 2;
  filter: url(#glow);
}
</style>