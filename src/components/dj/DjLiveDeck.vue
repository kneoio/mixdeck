<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { NButton, NSlider, NSwitch } from 'naive-ui'
import LedRed from '@/components/LedRed.vue'
import LedPlay from '@/components/LedPlay.vue'
import type { DjSong } from '@/components/dj/DjSongPicker.vue'
import aivoxApiService from '@/services/aivoxApi'
import { LiveBroadcast, type LiveChannel } from '@/utils/djLive'

const { t } = useI18n()

const props = defineProps<{
  brandSlug: string
  a: AudioBuffer | null
  c: AudioBuffer | null
  songA: DjSong | null
  songC: DjSong | null
  /** Renders the link prepared in the editor; null when there is nothing to render. */
  renderLink: () => Promise<AudioBuffer | null>
  canRenderLink: boolean
}>()
const emit = defineEmits<{ ended: [reason: string] }>()

const live = new LiveBroadcast()
const state = ref<'connecting' | 'on_air' | 'ending'>('connecting')
const onAirSince = ref(0)
const now = ref(Date.now())
let ticker: ReturnType<typeof setInterval> | null = null

// ── Channels ────────────────────────────────────────────────────────
const faders = reactive<Record<LiveChannel, number>>({ a: 1, c: 1, link: 1 })
/** 0 is all A, 1 is all C; the middle plays both at equal power. */
const crossfader = ref(0.5)
const playing = reactive<Record<LiveChannel, boolean>>({ a: false, c: false, link: false })
const positions = reactive<Record<LiveChannel, number>>({ a: 0, c: 0, link: 0 })
const linkBuf = ref<AudioBuffer | null>(null)
const renderingLink = ref(false)

const buffers = computed<Record<LiveChannel, AudioBuffer | null>>(() => ({ a: props.a, c: props.c, link: linkBuf.value }))

function effectiveGain(channel: LiveChannel) {
  const x = crossfader.value
  if (channel === 'a') return faders.a * Math.cos((x * Math.PI) / 2)
  if (channel === 'c') return faders.c * Math.sin((x * Math.PI) / 2)
  return faders.link
}
watch([faders, crossfader], () => {
  for (const channel of ['a', 'c', 'link'] as LiveChannel[]) live.setGain(channel, effectiveGain(channel))
}, { immediate: true, deep: true })

function start(channel: LiveChannel, buf: AudioBuffer, from: number) {
  live.play(channel, buf, from, () => {
    playing[channel] = false
    positions[channel] = buf.duration
  })
  playing[channel] = true
}

function toggle(channel: LiveChannel) {
  const buf = buffers.value[channel]
  if (!buf) return
  if (playing[channel]) {
    live.stop(channel)
    playing[channel] = false
    positions[channel] = live.position(channel)
    return
  }
  // Played out to the end: start over rather than not at all.
  start(channel, buf, positions[channel] >= buf.duration - 0.05 ? 0 : positions[channel])
}

function seek(channel: LiveChannel, to: number) {
  positions[channel] = to
  const buf = buffers.value[channel]
  if (playing[channel] && buf) start(channel, buf, to)
}

// A new song on a deck starts from its top, stopped.
watch(() => props.a, () => { live.stop('a'); playing.a = false; positions.a = 0 })
watch(() => props.c, () => { live.stop('c'); playing.c = false; positions.c = 0 })

async function loadLink() {
  if (renderingLink.value) return
  renderingLink.value = true
  try {
    live.stop('link')
    playing.link = false
    positions.link = 0
    linkBuf.value = await props.renderLink()
  } finally {
    renderingLink.value = false
  }
}

// ── Mic ─────────────────────────────────────────────────────────────
const micOpen = ref(false)
const micLevel = ref(1)
const talkover = ref(true)
watch(micOpen, open => live.setMicOpen(open))
watch(micLevel, level => live.setMicLevel(level))
watch(talkover, on => live.setTalkover(on))

// ── Now playing ─────────────────────────────────────────────────────
/** Whichever song is loudest on air is what listeners are told is playing. */
const dominant = computed<DjSong | null>(() => {
  const a = playing.a ? effectiveGain('a') : 0
  const c = playing.c ? effectiveGain('c') : 0
  if (Math.max(a, c) < 0.05) return null
  return a >= c ? props.songA : props.songC
})
watch([dominant, state], ([song, s]) => {
  if (s !== 'on_air' || !song) return
  live.sendNowPlaying({ songId: song.id, slugName: song.slugName, title: song.title, artist: song.artist })
})

// ── Handing back ────────────────────────────────────────────────────
/** Only at a song boundary: the queue cannot pick up a song mid-way, so nothing may be playing. */
const anyPlaying = computed(() => playing.a || playing.c || playing.link)

function handBack() {
  if (anyPlaying.value) return
  micOpen.value = false
  state.value = 'ending'
  live.end()
}

const onAirFor = computed(() => {
  const total = Math.max(0, Math.floor((now.value - onAirSince.value) / 1000))
  return formatTime(total)
})

function formatTime(seconds: number) {
  const s = Math.max(0, Math.floor(seconds))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

onMounted(async () => {
  ticker = setInterval(() => {
    now.value = Date.now()
    for (const channel of ['a', 'c', 'link'] as LiveChannel[]) {
      if (playing[channel]) positions[channel] = live.position(channel)
    }
  }, 200)
  const url = aivoxApiService.liveInputUrl(props.brandSlug)
  if (!url) {
    emit('ended', 'no_token')
    return
  }
  try {
    await live.connect(url, () => {
      state.value = 'on_air'
      onAirSince.value = Date.now()
    }, reason => emit('ended', reason))
  } catch {
    emit('ended', 'mic_unavailable')
  }
})

onBeforeUnmount(() => {
  if (ticker) clearInterval(ticker)
  live.dispose()
})

const strips = computed(() => [
  { channel: 'a' as const, label: 'A', title: props.songA ? [props.songA.artist, props.songA.title].filter(Boolean).join(' — ') : t('dj.live_no_song') },
  { channel: 'link' as const, label: 'LINK', title: t('dj.live_link_hint') },
  { channel: 'c' as const, label: 'C', title: props.songC ? [props.songC.artist, props.songC.title].filter(Boolean).join(' — ') : t('dj.live_no_song') },
])
</script>

<template>
  <div class="dj-live">
    <div class="dj-live-status" :class="`dj-live-status--${state}`">
      <LedRed :active="state === 'on_air'" />
      <span v-if="state === 'connecting'">{{ t('dj.live_connecting') }}</span>
      <span v-else-if="state === 'on_air'">{{ t('dj.live_on_air', { time: onAirFor }) }}</span>
      <span v-else>{{ t('dj.live_ending') }}</span>
      <NButton
        class="dj-live-handback"
        size="small"
        :disabled="state !== 'on_air' || anyPlaying"
        :title="anyPlaying ? t('dj.live_handback_hint') : ''"
        @click="handBack"
      >
        {{ t('dj.live_handback') }}
      </NButton>
    </div>

    <div class="dj-live-strips">
      <div v-for="s in strips" :key="s.channel" class="dj-live-strip" :class="`dj-live-strip--${s.channel}`">
        <span class="dj-live-chip">{{ s.label }}</span>
        <span class="dj-live-title" :title="s.title">{{ s.title }}</span>
        <NSlider v-model:value="faders[s.channel]" class="dj-live-fader" vertical :min="0" :max="1" :step="0.01" :tooltip="false" />
        <NButton v-if="s.channel === 'link'" size="tiny" :loading="renderingLink" :disabled="!canRenderLink" @click="loadLink">
          {{ t('dj.live_load_link') }}
        </NButton>
        <NButton size="small" :disabled="!buffers[s.channel] || state !== 'on_air'" @click="toggle(s.channel)">
          <LedPlay class="dj-live-led" :active="playing[s.channel]" />
          {{ playing[s.channel] ? t('dj.preview_stop') : t('dj.preview') }}
        </NButton>
        <input
          class="dj-live-seek"
          type="range"
          min="0"
          :max="buffers[s.channel]?.duration ?? 0"
          step="0.1"
          :value="positions[s.channel]"
          :disabled="!buffers[s.channel]"
          :aria-label="t('dj.live_seek')"
          @change="seek(s.channel, Number(($event.target as HTMLInputElement).value))"
        >
        <span class="dj-live-time">
          {{ formatTime(positions[s.channel]) }} / {{ formatTime(buffers[s.channel]?.duration ?? 0) }}
        </span>
      </div>

      <div class="dj-live-strip dj-live-strip--mic">
        <span class="dj-live-chip">MIC</span>
        <span class="dj-live-title">{{ t('dj.live_mic') }}</span>
        <NSlider v-model:value="micLevel" class="dj-live-fader" vertical :min="0" :max="1.5" :step="0.01" :tooltip="false" />
        <NButton
          class="dj-live-mic"
          :class="{ 'dj-live-mic--open': micOpen }"
          :type="micOpen ? 'error' : 'default'"
          :disabled="state !== 'on_air'"
          @click="micOpen = !micOpen"
        >
          {{ micOpen ? t('dj.live_mic_open') : t('dj.live_mic_closed') }}
        </NButton>
        <label class="dj-live-talkover">
          <NSwitch v-model:value="talkover" size="small" />
          {{ t('dj.live_talkover') }}
        </label>
      </div>
    </div>

    <div class="dj-live-crossfader">
      <span class="dj-live-chip dj-live-chip--a">A</span>
      <NSlider v-model:value="crossfader" :min="0" :max="1" :step="0.01" :tooltip="false" />
      <span class="dj-live-chip dj-live-chip--c">C</span>
    </div>
    <p class="dj-live-hint">{{ t('dj.live_hint') }}</p>
  </div>
</template>

<style scoped>
.dj-live {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.dj-live-status {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 0.85rem;
  font-variant-numeric: tabular-nums;
  background: color-mix(in srgb, var(--dj-accent) 12%, transparent);
}
.dj-live-status--on_air {
  background: color-mix(in srgb, var(--dj-danger) 14%, transparent);
  font-weight: 600;
}
.dj-live-handback {
  margin-left: auto;
}
.dj-live-strips {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 12px;
}
.dj-live-strip {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 10px 8px;
  border: 1px solid var(--dj-border);
  border-radius: 8px;
  background: var(--dj-surface);
  min-width: 0;
}
.dj-live-strip--a { --dj-slot: var(--dj-a); }
.dj-live-strip--c { --dj-slot: var(--dj-c); }
.dj-live-strip--link { --dj-slot: var(--dj-b); }
.dj-live-strip--mic { --dj-slot: var(--dj-danger); }
.dj-live-chip {
  min-width: 28px;
  height: 22px;
  padding: 0 6px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 0.75rem;
  background: var(--dj-slot, var(--dj-border));
  color: #1a1a1a;
}
.dj-live-chip--a { --dj-slot: var(--dj-a); }
.dj-live-chip--c { --dj-slot: var(--dj-c); }
.dj-live-title {
  width: 100%;
  text-align: center;
  font-size: 0.75rem;
  color: var(--dj-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.dj-live-fader {
  height: 140px;
}
.dj-live-led {
  margin-right: 6px;
  vertical-align: -3px;
}
.dj-live-seek {
  width: 100%;
  accent-color: var(--dj-slot, var(--dj-accent));
}
.dj-live-time {
  font-size: 0.72rem;
  font-variant-numeric: tabular-nums;
  color: var(--dj-muted);
}
.dj-live-mic {
  font-weight: 700;
  letter-spacing: 0.06em;
}
.dj-live-talkover {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.72rem;
  color: var(--dj-muted);
}
.dj-live-crossfader {
  display: flex;
  align-items: center;
  gap: 12px;
  max-width: 420px;
  width: 100%;
  align-self: center;
}
.dj-live-hint {
  margin: 0;
  font-size: 0.75rem;
  color: var(--dj-muted);
  text-align: center;
}
</style>
