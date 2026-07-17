<template>
  <svg
    class="gsap-loader"
    :style="{ '--gsap-loader-size': size + 'px' }"
    :viewBox="`0 0 ${VW} ${VH}`"
    preserveAspectRatio="xMidYMid meet"
  >
    <path class="gsap-loader__wave" :d="wavePath" />
    <circle ref="dotRef" class="gsap-loader__dot" r="3.4" :cx="0" :cy="BASELINE" />
  </svg>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import gsap from 'gsap'

withDefaults(defineProps<{ size?: number }>(), { size: 44 })

// Internal coordinate system (wider than tall — a wave reads better landscape).
const VW = 120
const VH = 48
const BASELINE = VH / 2

function randomBetween(min: number, max: number) {
  return min + Math.random() * (max - min)
}

// Randomize amplitude / wavelength / phase so the wave's shape differs slightly each mount.
const amplitude = randomBetween(9, 17)
const wavelength = VW / randomBetween(3, 5)
const phase = randomBetween(0, Math.PI * 2)
const duration = randomBetween(0.7, 1.1)

function waveY(x: number): number {
  return BASELINE + amplitude * Math.sin((2 * Math.PI * x) / wavelength + phase)
}

// Static sine curve across the visible width.
function buildWavePath(): string {
  const points: string[] = []
  for (let x = 0; x <= VW; x += 2) {
    points.push(`${x === 0 ? 'M' : 'L'}${x.toFixed(1)},${waveY(x).toFixed(2)}`)
  }
  return points.join(' ')
}

const wavePath = buildWavePath()

const dotRef = ref<SVGCircleElement | null>(null)
let tick: ((time: number) => void) | null = null

onMounted(() => {
  const dot = dotRef.value
  if (!dot) return
  // Drive the dot along the (static) wave with gsap's ticker: a triangle wave over `period` seconds
  // sweeps it left->right->left at constant speed. Direct setAttribute — no MotionPathPlugin/attr plugin.
  const period = duration
  tick = (time: number) => {
    const cycle = (time % period) / period          // 0..1
    const t = cycle < 0.5 ? cycle * 2 : 2 - cycle * 2 // triangle 0..1..0
    const x = t * VW
    dot.setAttribute('cx', x.toFixed(2))
    dot.setAttribute('cy', waveY(x).toFixed(2))
  }
  gsap.ticker.add(tick)
})

onBeforeUnmount(() => {
  if (tick) gsap.ticker.remove(tick)
  tick = null
})
</script>

<style scoped>
.gsap-loader {
  display: inline-block;
  width: calc(var(--gsap-loader-size) * 2.4);
  height: var(--gsap-loader-size);
  overflow: visible;
}
.gsap-loader__wave {
  fill: none;
  stroke: rgba(124, 58, 237, 0.45);
  stroke-width: 2;
  stroke-linecap: round;
}
.gsap-loader__dot {
  fill: #ff2d95;
  filter: drop-shadow(0 0 3px rgba(255, 45, 149, 0.75));
}
</style>
