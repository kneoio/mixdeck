<template>
  <svg
      class="mixpla-ribbon"
      :style="{ '--size': size + 'px' }"
      viewBox="0 0 160 48"
      preserveAspectRatio="xMidYMid meet"
  >
    <path ref="ribbonRef" class="ribbon" />
    <circle ref="dotRef" class="dot" r="3.8" />
  </svg>
</template>

<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from 'vue'
import gsap from 'gsap'

withDefaults(defineProps<{ size?: number }>(), {
  size: 44
})

const WIDTH = 160
const HEIGHT = 48
const MID = HEIGHT / 2

const ribbonRef = ref<SVGPathElement>()
const dotRef = ref<SVGCircleElement>()

let tick: (() => void) | null = null
let t = 0

function y(x: number) {
  return (
      MID +
      Math.sin(x * 0.055 + t * 1.6) * 8 +
      Math.sin(x * 0.017 - t * 1.2) * 4 +
      Math.cos(x * 0.09 + t * 0.8) * 2
  )
}

function buildPath() {
  let d = ''

  for (let x = 0; x <= WIDTH; x += 2) {
    d += `${x === 0 ? 'M' : 'L'}${x},${y(x).toFixed(2)} `
  }

  return d
}

onMounted(() => {
  const ribbon = ribbonRef.value!
  const dot = dotRef.value!

  tick = () => {
    t += 0.018

    ribbon.setAttribute('d', buildPath())

    const p = ((Math.sin(t * 0.7) + 1) / 2) * WIDTH
    const py = y(p)

    dot.setAttribute('cx', p.toFixed(2))
    dot.setAttribute('cy', py.toFixed(2))

    gsap.set(dot, {
      scale: 0.9 + Math.sin(t * 5) * 0.12
    })

    const hue = (t * 35) % 360
    ribbon.style.stroke = `hsl(${hue},85%,65%)`
    dot.style.fill = `hsl(${(hue + 30) % 360},95%,70%)`
    dot.style.filter = `drop-shadow(0 0 6px hsl(${(hue + 30) % 360},95%,70%))`
  }

  gsap.ticker.add(tick)
})

onBeforeUnmount(() => {
  if (tick) gsap.ticker.remove(tick)
})
</script>

<style scoped>
.mixpla-ribbon {
  width: calc(var(--size) * 3);
  height: var(--size);
  overflow: visible;
}

.ribbon {
  fill: none;
  stroke-width: 3;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.dot {
  transform-origin: center;
}
</style>