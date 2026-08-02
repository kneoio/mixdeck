<script setup lang="ts">
import { ref, onBeforeUnmount } from 'vue'
import { NButton, NProgress, NIcon } from 'naive-ui'
import { PlayOutline, PauseOutline } from '@vicons/ionicons5'
import LoaderProgress from '@/components/LoaderProgress.vue'
import { useAudioPlayerStore } from '@/stores/audioPlayer'
import { useThemeStore } from '@/stores/theme'

const player = useAudioPlayerStore()
const themeStore = useThemeStore()

const seekBarRef = ref<HTMLElement | null>(null)
let seekDocMove: ((e: MouseEvent) => void) | null = null
let seekDocUp: (() => void) | null = null

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

onBeforeUnmount(() => detachSeekListeners())
</script>

<template>
  <Transition name="global-audio-bar">
    <div v-if="player.hasTrack" class="global-audio-bar">
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

      <div class="global-audio-bar__progress">
        <div class="global-audio-bar__bar-wrap">
          <div class="global-audio-bar__bar-layer" aria-hidden="true">
            <NProgress
              type="line"
              :percentage="player.playbackPercent"
              :show-indicator="false"
              :height="2"
              :border-radius="1"
              :fill-border-radius="1"
              color="#eff605"
              :rail-color="themeStore.isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)'"
            />
          </div>
          <div
            ref="seekBarRef"
            class="global-audio-bar__seek-hit"
            role="slider"
            tabindex="-1"
            aria-label="Seek audio"
            :aria-valuenow="Math.round(player.playbackPercent)"
            aria-valuemin="0"
            aria-valuemax="100"
            @mousedown="onSeekMouseDown"
          />
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.global-audio-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 4px 16px;
  min-height: 28px;
  background: var(--n-color, transparent);
  flex-shrink: 0;
  overflow: hidden;
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
}
.global-audio-bar__bar-wrap {
  position: relative;
  width: 100%;
  min-height: 18px;
  display: flex;
  align-items: center;
}
.global-audio-bar__bar-layer {
  position: absolute;
  left: 0;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
  z-index: 0;
  pointer-events: none;
}
.global-audio-bar__seek-hit {
  position: absolute;
  left: 0;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
  height: 18px;
  z-index: 1;
  cursor: pointer;
  user-select: none;
}

.play-icon--playing {
  color: #00FF3C;
  filter: drop-shadow(0 0 4px #00FF3C) drop-shadow(0 0 10px #00FF3C);
  display: inline-flex;
}

.global-audio-bar-enter-active,
.global-audio-bar-leave-active {
  transition:
    opacity 0.28s ease,
    transform 0.28s ease,
    max-height 0.28s ease,
    padding 0.28s ease;
  max-height: 40px;
}
.global-audio-bar-enter-from,
.global-audio-bar-leave-to {
  opacity: 0;
  transform: translateY(-6px);
  max-height: 0;
  padding-top: 0;
  padding-bottom: 0;
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
