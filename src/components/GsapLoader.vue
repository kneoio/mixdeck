<template>
  <svg
      :width="size"
      :height="size"
      viewBox="0 0 100 100"
      class="core"
  >
    <defs>
      <radialGradient id="coreGradient">
        <stop offset="0%" stop-color="#ffffff" />
        <stop offset="30%" stop-color="#00d4ff" />
        <stop offset="70%" stop-color="#7c3aed" />
        <stop offset="100%" stop-color="#ff2d95" />
      </radialGradient>

      <filter id="glow">
        <feGaussianBlur stdDeviation="3.5" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>

    <g :transform="`rotate(${ring1} 50 50)`">
      <ellipse
          cx="50"
          cy="50"
          rx="34"
          ry="15"
          class="ring cyan"
      />
    </g>

    <g :transform="`rotate(${ring2} 50 50)`">
      <ellipse
          cx="50"
          cy="50"
          rx="34"
          ry="15"
          class="ring purple"
          transform="rotate(60 50 50)"
      />
    </g>

    <g :transform="`rotate(${ring3} 50 50)`">
      <ellipse
          cx="50"
          cy="50"
          rx="34"
          ry="15"
          class="ring pink"
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

    <circle
        cx="50"
        cy="50"
        :r="coreRadius + glow"
        class="halo"
    />
  </svg>
</template>

<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from 'vue'

withDefaults(
    defineProps<{
      size?: number
    }>(),
    {
      size: 72
    }
)

const ring1 = ref(0)
const ring2 = ref(120)
const ring3 = ref(240)

const coreRadius = ref(12)
const glow = ref(6)

let raf = 0
let t = Math.random() * 100

function animate() {
  t += 0.05

  ring1.value += 0.9
  ring2.value -= 0.7
  ring3.value += 0.45

  coreRadius.value = 12 + Math.sin(t * 4) * 2.4
  glow.value = 6 + Math.sin(t * 4 + 0.8) * 1.6

  raf = requestAnimationFrame(animate)
}

onMounted(() => {
  animate()
})

onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
})
</script>

<style scoped>
.core {
  overflow: visible;
}

.ring {
  fill: none;
  stroke-width: 2.5;
  filter: url(#glow);
}

.cyan {
  stroke: rgba(0, 212, 255, .8);
}

.purple {
  stroke: rgba(124, 58, 237, .75);
}

.pink {
  stroke: rgba(255, 45, 149, .8);
}

.halo {
  fill: none;
  stroke: rgba(255,255,255,.18);
  stroke-width: 2;
}
</style>