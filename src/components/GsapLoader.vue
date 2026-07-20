<template>
  <canvas
      ref="canvas"
      class="mixpla-loader"
      :width="width"
      :height="height"
      :style="{ width: size * 3 + 'px', height: size + 'px' }"
  />
</template>

<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from 'vue'

const props = withDefaults(defineProps<{
  size?: number
}>(), {
  size: 44
})

const width = 180
const height = 60
const canvas = ref<HTMLCanvasElement>()

const particles: Particle[] = []

let ctx: CanvasRenderingContext2D
let raf = 0
let time = Math.random() * 1000

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  t: number
  size: number
  hue: number
}

function rand(min: number, max: number) {
  return min + Math.random() * (max - min)
}

function ribbonY(x: number, t: number) {
  return (
      height / 2 +
      Math.sin(x * 0.035 + t * 1.2) * 10 +
      Math.sin(x * 0.012 - t * 0.7) * 6
  )
}

function init() {
  particles.length = 0

  for (let i = 0; i < 90; i++) {
    const x = (i / 89) * width

    particles.push({
      x,
      y: ribbonY(x, 0) + rand(-5, 5),
      vx: 0,
      vy: 0,
      t: Math.random() * Math.PI * 2,
      size: rand(1.5, 3.8),
      hue: rand(260, 340)
    })
  }
}

function draw() {
  time += 0.03

  ctx.clearRect(0, 0, width, height)
  ctx.globalCompositeOperation = 'lighter'

  const pulse = (time * 140) % (width + 30) - 15

  for (const p of particles) {
    const targetY = ribbonY(p.x, time)

    p.vy += (targetY - p.y) * 0.05
    p.vy *= 0.88

    p.y += p.vy
    p.x += Math.sin(time * 2 + p.t) * 0.12

    const d = Math.abs(p.x - pulse)

    let r = p.size
    let alpha = 0.25

    if (d < 20) {
      r += (20 - d) * 0.14
      alpha = 1
    }

    const hue =
        (p.hue +
            Math.sin(time * 4 + p.t) * 25 +
            Math.sin(p.x * 0.05 + time * 2) * 15) % 360

    ctx.beginPath()
    ctx.fillStyle = `hsla(${hue},100%,70%,${alpha})`
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2)
    ctx.fill()
  }

  const pulseHue = (time * 220) % 360

  ctx.beginPath()
  ctx.fillStyle = `hsl(${pulseHue},100%,75%)`
  ctx.shadowBlur = 24
  ctx.shadowColor = `hsl(${pulseHue},100%,70%)`
  ctx.arc(pulse, ribbonY(pulse, time), 5, 0, Math.PI * 2)
  ctx.fill()

  ctx.shadowBlur = 0

  raf = requestAnimationFrame(draw)
}

onMounted(() => {
  ctx = canvas.value!.getContext('2d')!
  init()
  draw()
})

onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
})
</script>

<style scoped>
.mixpla-loader {
  display: block;
}
</style>