<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import gsap from 'gsap'
import { useThemeStore } from '@/stores/theme'

/**
 * The box progress bar of the Playlist player, read-only, for what is on air. Its colour tells how much
 * time is left: green while there is plenty, turning red from `warnSeconds` down to `criticalSeconds`,
 * and pulsing once it is critical.
 */
const props = withDefaults(defineProps<{
  /** 0 to 1 of the bar that has played. */
  progress: number
  /** 0 to 1 of the bar already buffered ahead of `progress`. */
  buffered?: number
  remainingSeconds: number
  warnSeconds?: number
  criticalSeconds?: number
}>(), { buffered: 0, warnSeconds: 90, criticalSeconds: 30 })

const BOX_SIZE = 6
const BOX_GAP = 2
const BOX_MIN = 24
const BOX_MAX = 64
/** Hue of the project's green (#00FF3C); red is 0. */
const GREEN_HUE = 134

const themeStore = useThemeStore()
const rootRef = ref<HTMLElement | null>(null)
const barRef = ref<HTMLElement | null>(null)
const boxEls = ref<(HTMLElement | null)[]>([])
const boxCount = ref(BOX_MIN)
let resizeObserver: ResizeObserver | null = null
let pulse: gsap.core.Tween | null = null
const reducedMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

const railColor = computed(() => (themeStore.isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)'))

const clamp01 = (x: number) => Math.min(1, Math.max(0, x))
const progressUnits = computed(() => clamp01(props.progress) * boxCount.value)
const bufferedEndUnits = computed(() => clamp01(props.progress + props.buffered) * boxCount.value)
const filledCount = computed(() => Math.min(boxCount.value, Math.floor(progressUnits.value)))

const playedFill = (i: number) => clamp01(progressUnits.value - i)
const bufferedFill = (i: number) => clamp01(bufferedEndUnits.value - i)

const urgency = computed(() => {
  const span = Math.max(1, props.warnSeconds - props.criticalSeconds)
  return clamp01((props.warnSeconds - props.remainingSeconds) / span)
})
const color = computed(() => `hsl(${Math.round(GREEN_HUE * (1 - urgency.value))}, 100%, 50%)`)
const critical = computed(() => props.remainingSeconds <= props.criticalSeconds)

function setBoxRef(el: unknown, i: number) {
  boxEls.value[i] = el instanceof HTMLElement ? el : null
}

/** The box filling now and the next one get a ring, as in the Playlist player. */
function syncArmedBorders() {
  for (let i = 0; i < boxCount.value; i++) {
    const ring = boxEls.value[i]?.querySelector('.box-progress__ring') as HTMLElement | null
    if (!ring) continue
    const armed = i >= filledCount.value && i <= filledCount.value + 1 && i < boxCount.value
    gsap.to(ring, { opacity: armed ? 1 : 0, duration: armed ? 0.35 : 0.14, ease: armed ? 'power2.out' : 'power1.in', overwrite: true })
  }
}

function applyColor(immediate: boolean) {
  const el = rootRef.value
  if (!el) return
  if (immediate || reducedMotion) gsap.set(el, { '--box-color': color.value })
  else gsap.to(el, { '--box-color': color.value, duration: 0.8, ease: 'power1.out', overwrite: 'auto' })
}

function applyPulse() {
  const el = rootRef.value
  pulse?.kill()
  pulse = null
  if (!el) return
  gsap.set(el, { clearProps: 'filter' })
  if (!critical.value || reducedMotion) return
  pulse = gsap.fromTo(el,
    { filter: 'drop-shadow(0 0 0px var(--box-color))' },
    { filter: 'drop-shadow(0 0 6px var(--box-color))', duration: 0.6, yoyo: true, repeat: -1, ease: 'sine.inOut' })
}

onMounted(() => {
  applyColor(true)
  applyPulse()
  const el = barRef.value
  if (!el) return
  const fit = (width: number) => {
    if (width > 0) boxCount.value = Math.min(BOX_MAX, Math.max(BOX_MIN, Math.floor((width + BOX_GAP) / (BOX_SIZE + BOX_GAP))))
  }
  fit(el.clientWidth)
  resizeObserver = new ResizeObserver(entries => fit(entries[0]?.contentRect.width ?? 0))
  resizeObserver.observe(el)
  void nextTick().then(syncArmedBorders)
})

watch(color, () => applyColor(false))
watch(critical, applyPulse)
watch(boxCount, n => {
  boxEls.value = Array.from({ length: n }, () => null)
  void nextTick().then(syncArmedBorders)
})
watch(filledCount, () => { void nextTick().then(syncArmedBorders) })

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  pulse?.kill()
  if (rootRef.value) gsap.killTweensOf(rootRef.value)
  boxEls.value.forEach(el => {
    const ring = el?.querySelector('.box-progress__ring')
    if (ring) gsap.killTweensOf(ring)
  })
})
</script>

<template>
  <div ref="rootRef" class="box-progress">
    <div
      ref="barRef"
      class="box-progress__bar"
      role="progressbar"
      :aria-valuenow="Math.round(clamp01(progress) * 100)"
      aria-valuemin="0"
      aria-valuemax="100"
    >
      <span
        v-for="i in boxCount"
        :key="i"
        :ref="el => setBoxRef(el, i - 1)"
        class="box-progress__box"
        :style="{ backgroundColor: railColor }"
      >
        <span class="box-progress__ring" aria-hidden="true" />
        <span class="box-progress__buffered" :style="{ transform: `scaleX(${bufferedFill(i - 1)})` }" />
        <span class="box-progress__fill" :style="{ transform: `scaleX(${playedFill(i - 1)})` }" />
      </span>
    </div>
  </div>
</template>

<style scoped>
.box-progress {
  --box-color: hsl(134, 100%, 50%);
}
.box-progress__bar {
  display: flex;
  align-items: center;
  gap: 2px;
  height: 14px;
  user-select: none;
}
.box-progress__box {
  position: relative;
  flex: 1 1 0;
  min-width: 3px;
  height: 6px;
  border-radius: 1px;
  overflow: hidden;
  box-sizing: border-box;
}
.box-progress__ring {
  position: absolute;
  inset: 0;
  border: 0.5px solid var(--box-color);
  border-radius: 1px;
  opacity: 0;
  pointer-events: none;
  box-sizing: border-box;
  z-index: 2;
}
.box-progress__buffered,
.box-progress__fill {
  position: absolute;
  inset: 0;
  background: var(--box-color);
  transform-origin: left center;
  pointer-events: none;
}
.box-progress__buffered {
  opacity: 0.28;
  z-index: 0;
}
.box-progress__fill {
  z-index: 1;
}
</style>
