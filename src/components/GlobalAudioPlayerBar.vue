<script setup lang="ts">
import { ref, computed, watch, nextTick, onBeforeUnmount } from 'vue'
import gsap from 'gsap'
import { NButton, NIcon } from 'naive-ui'
import { PlayOutline, PauseOutline } from '@vicons/ionicons5'
import LoaderProgress from '@/components/LoaderProgress.vue'
import { useAudioPlayerStore } from '@/stores/audioPlayer'
import { useThemeStore } from '@/stores/theme'

const BOX_SIZE = 6
const BOX_GAP = 2
const BOX_MIN = 24
const BOX_MAX = 48

const player = useAudioPlayerStore()
const themeStore = useThemeStore()

const shellRef = ref<HTMLElement | null>(null)
const mounted = ref(false)

const seekBarRef = ref<HTMLElement | null>(null)
const boxEls = ref<(HTMLElement | null)[]>([])
const boxCount = ref(BOX_MIN)
let resizeObserver: ResizeObserver | null = null
let lastFilled = -1

let seekDocMove: ((e: MouseEvent) => void) | null = null
let seekDocUp: (() => void) | null = null

const railColor = computed(() =>
  themeStore.isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)',
)

const progressUnits = computed(() => (player.playbackPercent / 100) * boxCount.value)
const filledCount = computed(() => Math.min(boxCount.value, Math.floor(progressUnits.value)))
const partialFill = computed(() => {
  if (filledCount.value >= boxCount.value) return 0
  return progressUnits.value - filledCount.value
})

function setBoxRef(el: unknown, i: number) {
  if (el instanceof HTMLElement) boxEls.value[i] = el
  else boxEls.value[i] = null
}

function updateBoxCount(width: number) {
  if (width <= 0) return
  const n = Math.floor((width + BOX_GAP) / (BOX_SIZE + BOX_GAP))
  boxCount.value = Math.min(BOX_MAX, Math.max(BOX_MIN, n))
}

function attachResizeObserver() {
  resizeObserver?.disconnect()
  const el = seekBarRef.value
  if (!el) return
  updateBoxCount(el.clientWidth)
  resizeObserver = new ResizeObserver((entries) => {
    const w = entries[0]?.contentRect.width ?? 0
    updateBoxCount(w)
  })
  resizeObserver.observe(el)
}

function pulseBox(index: number) {
  const el = boxEls.value[index]
  if (!el) return
  gsap.killTweensOf(el)
  gsap.fromTo(
    el,
    {
      filter: 'drop-shadow(0 0 0px #eff605)',
      scale: 1,
    },
    {
      filter: 'drop-shadow(0 0 5px #eff605) drop-shadow(0 0 10px #eff605)',
      scale: 1.35,
      duration: 0.14,
      yoyo: true,
      repeat: 1,
      ease: 'power2.out',
      clearProps: 'filter,transform',
    },
  )
}

function detachSeekListeners() {
  if (seekDocMove) { document.removeEventListener('mousemove', seekDocMove); seekDocMove = null }
  if (seekDocUp) { document.removeEventListener('mouseup', seekDocUp); seekDocUp = null }
}

function applySeekClientX(clientX: number) {
  const bar = seekBarRef.value
  if (!bar) return
  const rect = bar.getBoundingClientRect()
  if (rect.width <= 0) return
  player.seekRatio((clientX - rect.left) / rect.width)
}

function onSeekMouseDown(e: MouseEvent) {
  if (e.button !== 0) return
  e.preventDefault()
  let done = false
  function onUp() { if (done) return; done = true; detachSeekListeners() }
  seekDocMove = (ev) => { if (!done) applySeekClientX(ev.clientX) }
  seekDocUp = onUp
  document.addEventListener('mousemove', seekDocMove)
  document.addEventListener('mouseup', onUp, { once: true })
  applySeekClientX(e.clientX)
}

watch(
  () => player.hasTrack,
  async (show) => {
    if (show) {
      mounted.value = true
      lastFilled = -1
      await nextTick()
      const el = shellRef.value
      if (!el) return
      gsap.killTweensOf(el)
      gsap.fromTo(
        el,
        { height: 0, opacity: 0 },
        {
          height: 'auto',
          opacity: 1,
          duration: 0.38,
          ease: 'power2.out',
          overwrite: true,
          onComplete: () => attachResizeObserver(),
        },
      )
      attachResizeObserver()
      return
    }
    resizeObserver?.disconnect()
    resizeObserver = null
    const el = shellRef.value
    if (!el) {
      mounted.value = false
      return
    }
    gsap.killTweensOf(el)
    gsap.to(el, {
      height: 0,
      opacity: 0,
      duration: 0.3,
      ease: 'power2.in',
      overwrite: true,
      onComplete: () => { mounted.value = false },
    })
  },
)

watch(filledCount, (n, prev) => {
  if (!mounted.value || boxCount.value <= 0) return
  if (prev == null) {
    lastFilled = n
    return
  }
  if (n > lastFilled) {
    // Pulse each newly completed box (usually +1; seek can jump)
    const from = Math.max(0, lastFilled)
    const to = Math.min(n - 1, boxCount.value - 1)
    for (let i = from; i <= to; i++) pulseBox(i)
  }
  lastFilled = n
})

watch(boxCount, () => {
  boxEls.value = Array.from({ length: boxCount.value }, () => null)
  lastFilled = filledCount.value
})

onBeforeUnmount(() => {
  detachSeekListeners()
  resizeObserver?.disconnect()
  resizeObserver = null
  if (shellRef.value) gsap.killTweensOf(shellRef.value)
  boxEls.value.forEach((el) => { if (el) gsap.killTweensOf(el) })
})
</script>

<template>
  <div v-if="mounted" ref="shellRef" class="global-audio-bar-shell">
    <div class="global-audio-bar">
      <NButton
        text
        quaternary
        size="tiny"
        class="global-audio-bar__btn"
        :disabled="player.isLoading"
        :aria-label="player.isPlaying ? 'Pause' : 'Play'"
        @click="player.toggle()"
      >
        <template #icon>
          <LoaderProgress v-if="player.isLoading" :size="16" />
          <span
            v-else
            :class="player.isPlaying ? 'play-icon--playing' : ''"
          >
            <NIcon :size="16">
              <PauseOutline v-if="player.isPlaying" />
              <PlayOutline v-else />
            </NIcon>
          </span>
        </template>
      </NButton>

      <div class="global-audio-bar__meta">
        <span class="global-audio-bar__title">{{ player.title }}</span>
        <template v-if="player.artist">
          <span class="global-audio-bar__sep">—</span>
          <span class="global-audio-bar__artist">{{ player.artist }}</span>
        </template>
      </div>

      <div
        ref="seekBarRef"
        class="global-audio-bar__progress"
        role="slider"
        tabindex="-1"
        aria-label="Seek audio"
        :aria-valuenow="Math.round(player.playbackPercent)"
        aria-valuemin="0"
        aria-valuemax="100"
        @mousedown="onSeekMouseDown"
      >
        <span
          v-for="i in boxCount"
          :key="i"
          :ref="(el) => setBoxRef(el, i - 1)"
          class="global-audio-bar__box"
          :style="{ backgroundColor: railColor }"
        >
          <span
            class="global-audio-bar__box-fill"
            :style="{
              transform: `scaleX(${
                i - 1 < filledCount ? 1 : i - 1 === filledCount ? partialFill : 0
              })`,
            }"
          />
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.global-audio-bar-shell {
  overflow: hidden;
  flex-shrink: 0;
  height: 0;
  opacity: 0;
}
.global-audio-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 4px 16px;
  min-height: 28px;
  background: var(--n-color, transparent);
}
.global-audio-bar__btn {
  flex-shrink: 0;
  padding: 0 2px !important;
  min-width: auto !important;
  height: 22px !important;
}
.global-audio-bar__meta {
  display: flex;
  align-items: baseline;
  gap: 6px;
  min-width: 0;
  flex-shrink: 1;
  max-width: 42%;
  font-size: 12px;
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.global-audio-bar__title {
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
}
.global-audio-bar__sep {
  opacity: 0.45;
  flex-shrink: 0;
}
.global-audio-bar__artist {
  opacity: 0.65;
  overflow: hidden;
  text-overflow: ellipsis;
}
.global-audio-bar__progress {
  flex: 1;
  min-width: 80px;
  display: flex;
  align-items: center;
  gap: 2px;
  height: 18px;
  cursor: pointer;
  user-select: none;
}
.global-audio-bar__box {
  position: relative;
  flex: 0 0 6px;
  width: 6px;
  height: 6px;
  border-radius: 1px;
  overflow: hidden;
  transform-origin: center center;
}
.global-audio-bar__box-fill {
  position: absolute;
  inset: 0;
  background: #eff605;
  transform: scaleX(0);
  transform-origin: left center;
  will-change: transform;
}

.play-icon--playing {
  color: #00FF3C;
  filter: drop-shadow(0 0 4px #00FF3C) drop-shadow(0 0 10px #00FF3C);
  display: inline-flex;
}

@media (max-width: 600px) {
  .global-audio-bar {
    padding: 4px 8px;
    gap: 8px;
  }
  .global-audio-bar__meta {
    max-width: 36%;
  }
}
</style>
