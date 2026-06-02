<script setup lang="ts">
import { ref, watch, onBeforeUnmount } from 'vue'
import { NButton, NProgress, NIcon, useMessage, useLoadingBar } from 'naive-ui'
import { PlayOutline, PauseOutline, DownloadOutline } from '@vicons/ionicons5'
import LoaderProgress from '@/components/LoaderProgress.vue'
import datanestApiService from '@/services/datanestApi'
import { handleApiError } from '@/utils/notificationService'
import { useThemeStore } from '@/stores/theme'

const props = defineProps<{ url: string; filename: string }>()
const emit = defineEmits<{ (e: 'playing-change', value: boolean): void }>()
const themeStore = useThemeStore()

const message = useMessage()
const loadingBar = useLoadingBar()

const audioEl = ref<HTMLAudioElement | null>(null)
const audioSeekBarRef = ref<HTMLElement | null>(null)
const isPlaying = ref(false)
const isFetchingAudio = ref(false)
const playbackPercent = ref(0)
const audioCurrent = ref(0)
const audioDuration = ref(0)
let cachedBlobUrl = ''

let seekDocMove: ((e: MouseEvent) => void) | null = null
let seekDocUp: (() => void) | null = null

function detachSeekDocumentListeners() {
  if (seekDocMove) { document.removeEventListener('mousemove', seekDocMove); seekDocMove = null }
  if (seekDocUp) { document.removeEventListener('mouseup', seekDocUp); seekDocUp = null }
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

function syncPlaybackProgress() {
  const el = audioEl.value
  if (!el || !el.duration || !Number.isFinite(el.duration)) {
    playbackPercent.value = 0
    audioDuration.value = 0
    audioCurrent.value = el?.currentTime ?? 0
    return
  }
  audioDuration.value = el.duration
  audioCurrent.value = el.currentTime
  playbackPercent.value = Math.min(100, (el.currentTime / el.duration) * 100)
}

async function ensureAudioSrcLoaded(): Promise<boolean> {
  if (!props.url) return false
  if (!cachedBlobUrl) {
    isFetchingAudio.value = true
    try {
      cachedBlobUrl = await datanestApiService.fetchBlobUrl(props.url)
      if (audioEl.value) audioEl.value.src = cachedBlobUrl
    } catch (e: any) {
      handleApiError(e, message)
      return false
    } finally {
      isFetchingAudio.value = false
    }
  }
  const audio = audioEl.value
  if (!audio) return false
  if (Number.isFinite(audio.duration) && audio.duration > 0) return true
  try {
    await new Promise<void>((resolve, reject) => {
      const el = audio
      const timer = window.setTimeout(() => { cleanup(); reject(new Error('timeout')) }, 20000)
      function cleanup() {
        clearTimeout(timer)
        el.removeEventListener('loadedmetadata', onMeta)
        el.removeEventListener('error', onErr)
      }
      function onMeta() { cleanup(); resolve() }
      function onErr() { cleanup(); reject(new Error('audio')) }
      el.addEventListener('loadedmetadata', onMeta, { once: true })
      el.addEventListener('error', onErr, { once: true })
      el.load()
    })
  } catch {
    return false
  }
  return Number.isFinite(audio.duration) && audio.duration > 0
}

function applySeekClientX(clientX: number) {
  const bar = audioSeekBarRef.value
  const a = audioEl.value
  if (!bar || !a || !Number.isFinite(a.duration) || a.duration <= 0) return
  const rect = bar.getBoundingClientRect()
  if (rect.width <= 0) return
  const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
  a.currentTime = ratio * a.duration
  syncPlaybackProgress()
}

async function onSeekBarMouseDown(e: MouseEvent) {
  if (e.button !== 0) return
  e.preventDefault()
  let ended = false
  function onUp() { if (ended) return; ended = true; detachSeekDocumentListeners() }
  seekDocMove = (ev) => { if (!ended) applySeekClientX(ev.clientX) }
  seekDocUp = onUp
  document.addEventListener('mousemove', seekDocMove)
  document.addEventListener('mouseup', onUp, { once: true })
  const ok = await ensureAudioSrcLoaded()
  if (!ok) { onUp(); return }
  applySeekClientX(e.clientX)
}

async function togglePlay() {
  if (!props.url) return
  if (isPlaying.value) { audioEl.value?.pause(); return }
  const ok = await ensureAudioSrcLoaded()
  if (!ok) return
  try { await audioEl.value?.play() } catch (e: any) { handleApiError(e, message) }
}

function onAudioPlay() { isPlaying.value = true; emit('playing-change', true) }
function onAudioPause() { isPlaying.value = false; emit('playing-change', false) }
function onAudioEnded() {
  isPlaying.value = false
  emit('playing-change', false)
  playbackPercent.value = 0
  audioCurrent.value = 0
  if (audioEl.value?.duration) audioDuration.value = audioEl.value.duration
}

async function handleDownload() {
  loadingBar.start()
  try { await datanestApiService.downloadFile(props.url, props.filename); loadingBar.finish() }
  catch (e: any) { loadingBar.error(); handleApiError(e, message) }
}

function stop() {
  audioEl.value?.pause()
  isPlaying.value = false
  playbackPercent.value = 0
  audioCurrent.value = 0
}

function resetAudio() {
  stop()
  audioDuration.value = 0
  if (cachedBlobUrl) { URL.revokeObjectURL(cachedBlobUrl); cachedBlobUrl = '' }
  if (audioEl.value) audioEl.value.src = ''
}

watch(() => props.url, () => resetAudio())

onBeforeUnmount(() => {
  detachSeekDocumentListeners()
  resetAudio()
})

defineExpose({ stop, isPlaying })
</script>

<template>
  <div class="audio-mini-player">
    <div class="audio-mini-player__row">
      <div class="audio-mini-player__main">
        <div class="audio-mini-player__top-row">
          <div class="audio-mini-player__play-col">
            <NButton
              text
              quaternary
              :disabled="isFetchingAudio"
              class="audio-mini-player__play-icon-btn"
              :aria-label="isPlaying ? 'Pause' : 'Play'"
              @click="togglePlay"
            >
              <template #icon>
                <LoaderProgress v-if="isFetchingAudio" :size="22" />
                <NIcon v-else :size="22">
                  <PauseOutline v-if="isPlaying" />
                  <PlayOutline v-else />
                </NIcon>
              </template>
            </NButton>
          </div>
          <div class="audio-mini-player__bar-area">
            <div class="audio-mini-player__bar-wrap">
              <div class="audio-mini-player__bar-layer" aria-hidden="true">
                <NProgress
                  type="line"
                  :percentage="playbackPercent"
                  :show-indicator="false"
                  :height="2"
                  :border-radius="1"
                  :fill-border-radius="1"
                  color="#eff605"
                  :rail-color="themeStore.isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)'"
                />
              </div>
              <div
                ref="audioSeekBarRef"
                class="audio-mini-player__seek-hit"
                role="slider"
                tabindex="-1"
                aria-label="Seek audio"
                :aria-valuenow="Math.round(playbackPercent)"
                aria-valuemin="0"
                aria-valuemax="100"
                @mousedown="onSeekBarMouseDown"
              />
            </div>
          </div>
        </div>
        <div class="audio-mini-player__times">
          <span>{{ formatTime(audioCurrent) }}</span>
          <span class="audio-mini-player__sep">/</span>
          <span>{{ formatTime(audioDuration) }}</span>
        </div>
      </div>
      <NButton
        circle
        size="small"
        quaternary
        :title="filename"
        class="audio-mini-player__dl"
        @click="handleDownload"
      >
        <template #icon><NIcon><DownloadOutline /></NIcon></template>
      </NButton>
      <audio
        ref="audioEl"
        @play="onAudioPlay"
        @pause="onAudioPause"
        @ended="onAudioEnded"
        @timeupdate="syncPlaybackProgress"
        @loadedmetadata="syncPlaybackProgress"
      />
    </div>
  </div>
</template>

<style scoped>
.audio-mini-player { width: 100%; max-width: 420px; }
.audio-mini-player__row { display: flex; align-items: center; gap: 8px; width: 100%; flex-wrap: nowrap; }
.audio-mini-player__main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
.audio-mini-player__top-row { display: flex; align-items: center; gap: 8px; width: 100%; min-width: 0; }
.audio-mini-player__play-col { flex-shrink: 0; display: flex; align-items: center; }
.audio-mini-player__play-icon-btn { padding: 2px !important; min-width: auto !important; }
.audio-mini-player__play-icon-btn :deep(.n-icon) { color: inherit; }
.audio-mini-player__bar-area { flex: 1; min-width: 0; }
.audio-mini-player__bar-wrap { position: relative; width: 100%; min-height: 22px; display: flex; align-items: center; }
.audio-mini-player__bar-layer { position: absolute; left: 0; right: 0; top: 50%; transform: translateY(-50%); z-index: 0; pointer-events: none; }
.audio-mini-player__seek-hit { position: absolute; left: 0; right: 0; top: 50%; transform: translateY(-50%); height: 22px; z-index: 1; cursor: pointer; user-select: none; }
.audio-mini-player__times { display: flex; align-items: center; gap: 4px; font-size: 11px; line-height: 1.2; opacity: 0.55; font-variant-numeric: tabular-nums; }
.audio-mini-player__sep { opacity: 0.7; }
</style>
