import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import datanestApiService from '@/services/datanestApi'

export type AudioPlayRequest = {
  id: string
  url: string
  title?: string
  artist?: string
  filename?: string
  tempo?: string
  key?: string
  addInfo?: Record<string, unknown> | null
}

function tempoBand(bpm: number): string {
  if (bpm < 70) return 'slow'
  if (bpm < 100) return 'mid-tempo'
  if (bpm < 130) return 'upbeat'
  return 'fast'
}

/** Same formatting as SoundFragmentForm Vibe tab. */
export function formatTempoFromAddInfo(addInfo: Record<string, unknown> | null | undefined): string {
  if (!addInfo || addInfo.bpm === undefined || addInfo.bpm === null) return ''
  const bpm = Number(addInfo.bpm)
  if (Number.isNaN(bpm)) return ''
  return `${tempoBand(bpm)} (${Math.round(bpm)} BPM)`
}

export function formatKeyFromAddInfo(addInfo: Record<string, unknown> | null | undefined): string {
  if (!addInfo) return ''
  const key = addInfo.key
  const scale = addInfo.scale
  const parts = [
    typeof key === 'string' && key.trim() ? key.trim() : '',
    typeof scale === 'string' && scale.trim() ? scale.trim() : '',
  ].filter(Boolean)
  return parts.length ? parts.join(' ') : ''
}

export const useAudioPlayerStore = defineStore('audioPlayer', () => {
  const trackId = ref<string | null>(null)
  const url = ref('')
  const title = ref('')
  const artist = ref('')
  const filename = ref('')
  const tempo = ref('')
  const key = ref('')
  const isPlaying = ref(false)
  const isLoading = ref(false)
  const loadingId = ref<string | null>(null)
  const playbackPercent = ref(0)
  const currentTime = ref(0)
  const duration = ref(0)

  const hasTrack = computed(() => !!trackId.value)
  const hasVibeMeta = computed(() => !!(tempo.value || key.value))

  let audio: HTMLAudioElement | null = null
  let playRequestId = 0
  const blobUrlCache = new Map<string, string>()

  function syncProgress() {
    if (!audio || !audio.duration || !Number.isFinite(audio.duration)) {
      playbackPercent.value = 0
      duration.value = 0
      currentTime.value = audio?.currentTime ?? 0
      return
    }
    duration.value = audio.duration
    currentTime.value = audio.currentTime
    playbackPercent.value = Math.min(100, (audio.currentTime / audio.duration) * 100)
  }

  function bindAudio(el: HTMLAudioElement) {
    el.ontimeupdate = () => syncProgress()
    el.onloadedmetadata = () => syncProgress()
    el.onplay = () => { isPlaying.value = true }
    el.onpause = () => { isPlaying.value = false }
    el.onended = () => {
      isPlaying.value = false
      playbackPercent.value = 0
      currentTime.value = 0
      if (el.duration) duration.value = el.duration
    }
  }

  async function resolveBlobUrl(cacheKey: string, rawUrl: string, reqId: number): Promise<string | null> {
    let blobUrl = blobUrlCache.get(cacheKey)
    if (!blobUrl) {
      blobUrl = await datanestApiService.fetchBlobUrl(rawUrl)
      if (reqId !== playRequestId) {
        URL.revokeObjectURL(blobUrl)
        return null
      }
      blobUrlCache.set(cacheKey, blobUrl)
    }
    return blobUrl
  }

  async function play(req: AudioPlayRequest) {
    if (trackId.value === req.id && audio) {
      if (isPlaying.value) {
        audio.pause()
        return
      }
      await audio.play()
      return
    }

    const reqId = ++playRequestId
    isLoading.value = true
    loadingId.value = req.id
    try {
      const blobUrl = await resolveBlobUrl(req.id, req.url, reqId)
      if (!blobUrl || reqId !== playRequestId) return

      if (audio) {
        audio.pause()
        audio.src = ''
      }
      const next = new Audio(blobUrl)
      audio = next
      bindAudio(next)
      trackId.value = req.id
      url.value = req.url
      title.value = req.title?.trim() || req.filename || 'Audio'
      artist.value = req.artist?.trim() || ''
      filename.value = req.filename || ''
      if (req.tempo !== undefined || req.key !== undefined) {
        tempo.value = req.tempo?.trim() || ''
        key.value = req.key?.trim() || ''
      } else {
        tempo.value = formatTempoFromAddInfo(req.addInfo)
        key.value = formatKeyFromAddInfo(req.addInfo)
      }
      playbackPercent.value = 0
      currentTime.value = 0
      duration.value = 0
      await next.play()
    } finally {
      if (reqId === playRequestId) {
        isLoading.value = false
        loadingId.value = null
      }
    }
  }

  /** Resolve fragment audio URL from API, then play. */
  async function playFragment(opts: { id: string; title?: string; artist?: string }) {
    if (trackId.value === opts.id && audio) {
      if (isPlaying.value) {
        audio.pause()
        return
      }
      await audio.play()
      return
    }

    const reqId = ++playRequestId
    isLoading.value = true
    loadingId.value = opts.id
    try {
      const frag: any = await datanestApiService.getDocument<any>('/public/soundfragments', opts.id)
      if (reqId !== playRequestId) return
      const doc = frag?.payload?.docData ?? frag?.docData ?? frag
      const opusFile = doc?.uploadedFiles?.find((f: any) => f.type === 'opus')
      const fileEntry = opusFile || doc?.uploadedFiles?.[0]
      const rawUrl = fileEntry?.url || doc?.url || ''
      if (!rawUrl) return
      const blobUrl = await resolveBlobUrl(opts.id, rawUrl, reqId)
      if (!blobUrl || reqId !== playRequestId) return

      if (audio) {
        audio.pause()
        audio.src = ''
      }
      const next = new Audio(blobUrl)
      audio = next
      bindAudio(next)
      trackId.value = opts.id
      url.value = rawUrl
      title.value = opts.title?.trim() || doc?.title || fileEntry?.name || 'Audio'
      artist.value = opts.artist?.trim() || doc?.artist || ''
      filename.value = fileEntry?.name || ''
      const addInfo = doc?.addInfo && typeof doc.addInfo === 'object' ? doc.addInfo as Record<string, unknown> : null
      tempo.value = formatTempoFromAddInfo(addInfo)
      key.value = formatKeyFromAddInfo(addInfo)
      playbackPercent.value = 0
      currentTime.value = 0
      duration.value = 0
      await next.play()
    } catch {
      /* silent — same as previous playlist behavior */
    } finally {
      if (reqId === playRequestId) {
        isLoading.value = false
        loadingId.value = null
      }
    }
  }

  function toggle() {
    if (!audio || !trackId.value) return
    if (isPlaying.value) audio.pause()
    else void audio.play()
  }

  function pause() {
    audio?.pause()
  }

  function seekRatio(ratio: number, resume = false) {
    if (!audio || !Number.isFinite(audio.duration) || audio.duration <= 0) return
    const r = Math.min(1, Math.max(0, ratio))
    audio.currentTime = r * audio.duration
    syncProgress()
    if (resume && audio.paused) void audio.play()
  }

  function stop() {
    playRequestId++
    if (audio) {
      audio.pause()
      audio.src = ''
      audio = null
    }
    trackId.value = null
    url.value = ''
    title.value = ''
    artist.value = ''
    filename.value = ''
    tempo.value = ''
    key.value = ''
    isPlaying.value = false
    isLoading.value = false
    loadingId.value = null
    playbackPercent.value = 0
    currentTime.value = 0
    duration.value = 0
  }

  function isTrackPlaying(id: string) {
    return isPlaying.value && trackId.value === id
  }

  function isTrackLoading(id: string) {
    return isLoading.value && loadingId.value === id
  }

  return {
    trackId,
    url,
    title,
    artist,
    filename,
    tempo,
    key,
    isPlaying,
    isLoading,
    loadingId,
    playbackPercent,
    currentTime,
    duration,
    hasTrack,
    hasVibeMeta,
    play,
    playFragment,
    toggle,
    pause,
    seekRatio,
    stop,
    isTrackPlaying,
    isTrackLoading,
  }
})
