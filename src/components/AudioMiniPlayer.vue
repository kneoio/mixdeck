<script setup lang="ts">
import { computed, watch } from 'vue'
import { NButton, NIcon, useMessage, useLoadingBar } from 'naive-ui'
import { PlayOutline, PauseOutline, DownloadOutline } from '@vicons/ionicons5'
import LoaderProgress from '@/components/LoaderProgress.vue'
import datanestApiService from '@/services/datanestApi'
import { handleApiError } from '@/utils/notificationService'
import { useAudioPlayerStore } from '@/stores/audioPlayer'

const props = defineProps<{
  url: string
  filename: string
  title?: string
  artist?: string
  trackId?: string
  tempo?: string
  musicalKey?: string
  aiSuspected?: boolean | null
}>()
const emit = defineEmits<{ (e: 'playing-change', value: boolean): void }>()

const player = useAudioPlayerStore()
const message = useMessage()
const loadingBar = useLoadingBar()

const id = computed(() => props.trackId || props.url)
const isActive = computed(() => player.trackId === id.value)
const isPlaying = computed(() => isActive.value && player.isPlaying)
const isFetchingAudio = computed(() => player.isTrackLoading(id.value))

watch(isPlaying, (v) => emit('playing-change', v), { immediate: true })

async function togglePlay() {
  if (!props.url) return
  try {
    await player.play({
      id: id.value,
      url: props.url,
      title: props.title,
      artist: props.artist,
      filename: props.filename,
      tempo: props.tempo,
      key: props.musicalKey,
      aiSuspected: props.aiSuspected,
    })
  } catch (e: any) {
    handleApiError(e, message)
  }
}

async function handleDownload() {
  loadingBar.start()
  try {
    await datanestApiService.downloadFile(props.url, props.filename)
    loadingBar.finish()
  } catch (e: any) {
    loadingBar.error()
    handleApiError(e, message)
  }
}

function stop() {
  if (isActive.value) player.stop()
}

defineExpose({ stop, isPlaying })
</script>

<template>
  <div class="audio-mini-player">
    <div class="audio-mini-player__row">
      <NButton
        text
        quaternary
        :disabled="isFetchingAudio"
        class="audio-mini-player__play-icon-btn"
        :aria-label="isPlaying ? 'Pause' : 'Play'"
        @click="togglePlay"
      >
        <template #icon>
          <span
            :class="isFetchingAudio ? 'play-icon--loading' : isPlaying ? 'play-icon--playing' : ''"
          >
            <LoaderProgress v-if="isFetchingAudio" :size="22" />
            <NIcon v-else :size="22">
              <PauseOutline v-if="isPlaying" />
              <PlayOutline v-else />
            </NIcon>
          </span>
        </template>
      </NButton>
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
    </div>
  </div>
</template>

<style scoped>
.audio-mini-player { width: auto; }
.audio-mini-player__row { display: flex; align-items: center; gap: 8px; flex-wrap: nowrap; }
.audio-mini-player__play-icon-btn { padding: 2px !important; min-width: auto !important; }
.audio-mini-player__play-icon-btn :deep(.n-icon) { color: inherit; }
.play-icon--loading {
  color: #00FF3C;
  animation: play-pulse 0.8s ease-in-out infinite;
  display: inline-flex;
}
.play-icon--playing {
  color: #00FF3C;
  filter: drop-shadow(0 0 4px #00FF3C) drop-shadow(0 0 10px #00FF3C);
  display: inline-flex;
}
@keyframes play-pulse {
  0%, 60%, 100% { filter: drop-shadow(0 0 4px #00FF3C) drop-shadow(0 0 10px #00FF3C); opacity: 1; }
  35%           { filter: drop-shadow(0 0 1px #00FF3C); opacity: 0.2; }
}
</style>
