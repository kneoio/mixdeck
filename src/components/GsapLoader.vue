<template>
  <svg
      class="gsap-loader"
      :style="{
      '--gsap-loader-size': size + 'px',
      '--dot-color': dotColor
    }"
      :viewBox="`0 0 ${VW} ${VH}`"
      preserveAspectRatio="xMidYMid meet"
  >
    <path ref="waveRef" class="gsap-loader__wave" :d="wavePath" />
    <circle
        ref="dotRef"
        class="gsap-loader__dot"
        r="3.4"
        :cx="0"
        :cy="BASELINE"
    />
  </svg>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import gsap from 'gsap'

withDefaults(defineProps<{ size?: number }>(), { size: 44 })

const VW = 120
const VH = 48
const BASELINE = VH / 2

function randomBetween(min: number, max: number) {
  return min + Math.random() * (max - min)
}

function randomColor() {
  const colors = [
    '#ff2d95',
    '#7c3aed',
    '#00d4ff',
    '#00e676',
    '#ffd600',
    '#ff6d00',
    '#ff1744'
  ]
  return colors[Math.floor(Math.random() * colors.length)]
}

const dotColor = randomColor()

const waveRef = ref<SVGPathElement | null>(null)
const dotRef = ref<SVGCircleElement | null>(null)

let amplitude = randomBetween(9, 17)
let wavelength = VW / randomBetween(3, 5)
let phase = randomBetween(0, Math.PI * 2)

function waveY(x: number): number {
  return BASELINE + amplitude * Math.sin((2 * Math.PI * x) / wavelength + phase)
}

function buildWavePath(): string {
  const points: string[] = []
  for (let x = 0; x <= VW; x += 1) {
    points.push(`${x === 0 ? 'M' : 'L'}${x},${waveY(x).toFixed(2)}`)
  }
  return points.join(' ')
}

const wavePath = ref(buildWavePath())

let tick: (() => void) | null = null
let elapsed = 0

const dotSpeed = randomBetween(1.1, 1.6) // slower
const morphSpeed = randomBetween(0.25, 0.45)

onMounted(() => {
  const dot = dotRef.value
  const wave = waveRef.value
  if (!dot || !wave) return

  tick = () => {
    elapsed += gsap.ticker.deltaRatio() / 60

    // Slowly morph the wave forever.
    phase += morphSpeed * 0.015
    amplitude += Math.sin(elapsed * 0.6) * 0.015
    wavelength += Math.cos(elapsed * 0.4) * 0.02

    amplitude = Math.max(8, Math.min(18, amplitude))
    wavelength = Math.max(25, Math.min(45, wavelength))

    const d = buildWavePath()
    wave.setAttribute('d', d)

    // Dot movement.
    const cycle = (elapsed % dotSpeed) / dotSpeed
    const t = cycle < 0.5 ? cycle * 2 : 2 - cycle * 2

    const x = t * VW
    const y = waveY(x)

    dot.setAttribute('cx', x.toFixed(2))
    dot.setAttribute('cy', y.toFixed(2))

    const scale = 0.9 + 0.25 * Math.cos((2 * Math.PI * x) / wavelength + phase)
    gsap.set(dot, { scale })
  }

  gsap.ticker.add(tick)
})

onBeforeUnmount(() => {
  if (tick) gsap.ticker.remove(tick)
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
  fill: var(--dot-color);
  filter: drop-shadow(0 0 4px color-mix(in srgb, var(--dot-color) 75%, white));
  transform-origin: center;
}
</style>