<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import gsap from 'gsap'
import { useThemeStore } from '@/stores/theme'

/**
 * The box progress bar of the Playlist player, read-only, for what is on air. Its colour tells how much
 * time is left: green while there is plenty, turning red from `warnSeconds` down to `criticalSeconds`.
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
const reducedMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

const railColor = computed(() => (themeStore.isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)'))

const clamp01 = (x: number) => Math.min(1, Math.max(0, x))

/**
 * What the boxes show. It follows the props, except when the next song goes on air: then, instead of
 * snapping back to empty, the boxes go out one by one, fast, from the end back to the start.
 */
const shown = reactive({ progress: props.progress, buffered: props.buffered })
/** A fall this large is a new song starting, not a correction. */
const RESET_DROP = 0.3
const DRAIN_SECONDS_PER_BOX = 0.025
const DRAIN_MAX_SECONDS = 1.2
let drain: gsap.core.Tween | null = null
/** How long the running drain lasts, so the colour can travel back to green over the same time. */
let drainSeconds = 0
watch(() => [props.progress, props.buffered] as const, ([p, b], [prev]) => {
  if (!reducedMotion && prev - p > RESET_DROP) {
    drain?.kill()
    const steps = Math.max(1, Math.ceil(clamp01(shown.progress) * boxCount.value))
    drainSeconds = Math.min(DRAIN_MAX_SECONDS, steps * DRAIN_SECONDS_PER_BOX)
    shown.buffered = 0
    drain = gsap.to(shown, {
      progress: clamp01(p),
      duration: drainSeconds,
      ease: `steps(${steps})`,
      onComplete: () => {
        drain = null
        drainSeconds = 0
        shown.progress = props.progress
        shown.buffered = props.buffered
      },
    })
    return
  }
  // A drain in flight picks up the latest values when it completes.
  if (drain) return
  shown.progress = p
  shown.buffered = b
})

const progressUnits = computed(() => clamp01(shown.progress) * boxCount.value)
const bufferedEndUnits = computed(() => clamp01(shown.progress + shown.buffered) * boxCount.value)
const filledCount = computed(() => Math.min(boxCount.value, Math.floor(progressUnits.value)))

const playedFill = (i: number) => clamp01(progressUnits.value - i)
const bufferedFill = (i: number) => clamp01(bufferedEndUnits.value - i)

const urgency = computed(() => {
  const span = Math.max(1, props.warnSeconds - props.criticalSeconds)
  return clamp01((props.warnSeconds - props.remainingSeconds) / span)
})
const color = computed(() => `hsl(${Math.round(GREEN_HUE * (1 - urgency.value))}, 100%, 50%)`)

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
  // While the boxes drain, the colour travels back to green alongside them.
  else gsap.to(el, { '--box-color': color.value, duration: drainSeconds || 0.8, ease: drainSeconds ? 'none' : 'power1.out', overwrite: 'auto' })
}

onMounted(() => {
  applyColor(true)
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
watch(boxCount, n => {
  boxEls.value = Array.from({ length: n }, () => null)
  void nextTick().then(syncArmedBorders)
})
watch(filledCount, () => { void nextTick().then(syncArmedBorders) })

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  drain?.kill()
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
      :aria-valuenow="Math.round(clamp01(shown.progress) * 100)"
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
