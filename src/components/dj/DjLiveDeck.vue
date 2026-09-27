<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { NButton, NSelect, NSlider, useMessage } from 'naive-ui'
import LedRed from '@/components/LedRed.vue'
import LedPlay from '@/components/LedPlay.vue'
import DjSongPicker, { type DjSong } from '@/components/dj/DjSongPicker.vue'
import aivoxApiService from '@/services/aivoxApi'
import datanestApiService from '@/services/datanestApi'
import { fetchSongBuffer } from '@/utils/djAudio'
import { LiveBroadcast } from '@/utils/djLive'

const { t } = useI18n()
const message = useMessage()

const props = defineProps<{ brandSlug: string }>()
const emit = defineEmits<{ ended: [reason: string] }>()

const live = new LiveBroadcast()
const state = ref<'connecting' | 'on_air' | 'ending'>('connecting')
const onAirSince = ref(0)
const now = ref(Date.now())
let ticker: ReturnType<typeof setInterval> | null = null

function formatTime(seconds: number) {
  const s = Math.max(0, Math.floor(seconds))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

// ── Songs ───────────────────────────────────────────────────────────
interface CrateSong {
  song: DjSong
  buf: AudioBuffer | null
  loading: boolean
  /** Times it was started this session. */
  plays: number
}
/** The songs the DJ has lined up; any of them goes on air with its play button. */
const crate = ref<CrateSong[]>([])
const picked = ref<DjSong | null>(null)
const playingSlug = ref<string | null>(null)
const position = ref(0)

watch(picked, song => {
  if (!song) return
  picked.value = null
  if (crate.value.some(c => c.song.slugName === song.slugName)) return
  const item = reactive<CrateSong>({ song, buf: null, loading: true, plays: 0 })
  crate.value.push(item)
  // Loaded as soon as it is picked, so pressing play starts it at once.
  fetchSongBuffer(song.slugName)
    .then(buf => { item.buf = buf })
    .catch(() => {
      message.error(t('dj.song_error'))
      crate.value = crate.value.filter(c => c !== item)
    })
    .finally(() => { item.loading = false })
})

function toggleSong(item: CrateSong) {
  if (!item.buf) return
  if (playingSlug.value === item.song.slugName) {
    live.stopSong()
    playingSlug.value = null
    return
  }
  const slug = item.song.slugName
  live.playSong(item.buf, 0, () => {
    if (playingSlug.value === slug) playingSlug.value = null
  })
  playingSlug.value = slug
  position.value = 0
  item.plays++
}

function removeSong(item: CrateSong) {
  if (playingSlug.value === item.song.slugName) return
  crate.value = crate.value.filter(c => c !== item)
}

const playingItem = computed(() => crate.value.find(c => c.song.slugName === playingSlug.value) ?? null)
const songLabel = (s: DjSong) => [s.artist, s.title].filter(Boolean).join(' — ') || s.slugName

watch([playingItem, state], ([item, s]) => {
  if (s !== 'on_air' || !item) return
  live.sendNowPlaying({ songId: item.song.id, slugName: item.song.slugName, title: item.song.title, artist: item.song.artist })
})

// ── Main fader ──────────────────────────────────────────────────────
/** 0 is all song, 1 is all mic. */
const balance = ref(0.5)
watch(balance, x => live.setBalance(x), { immediate: true })

// ── Mic ─────────────────────────────────────────────────────────────
const micOpen = ref(false)
watch(micOpen, open => live.setMicOpen(open))
const micFx = reactive({ reverb: 0, echo: 0, radio: 0, distortion: 0 })
watch(micFx, amounts => live.setMicFx({ ...amounts }), { deep: true })
const fxSliders = [
  { key: 'reverb' as const, label: 'dj.reverb' },
  { key: 'echo' as const, label: 'dj.echo' },
  { key: 'radio' as const, label: 'dj.radio' },
  { key: 'distortion' as const, label: 'dj.distortion' },
]

// ── Effects ─────────────────────────────────────────────────────────
interface Effect {
  slug: string
  label: string
  buf: AudioBuffer | null
  loading: boolean
  playing: boolean
}
const effects = ref<Effect[]>([])
/** Effects come from the station's sound assets, as in the link editor. */
const effectOptions = ref<{ label: string; value: string }[]>([])
const effectsSearching = ref(false)
let effectSeq = 0

async function searchEffects(term = '') {
  const seq = ++effectSeq
  effectsSearching.value = true
  try {
    const res = await datanestApiService.getSoundAssets(1, 30, term.trim())
    if (seq !== effectSeq) return
    effectOptions.value = res.entries.map((e: any) => ({ label: e.title || e.slugName, value: e.slugName }))
  } catch {
    if (seq === effectSeq) effectOptions.value = []
  } finally {
    if (seq === effectSeq) effectsSearching.value = false
  }
}

function addEffect(slug: string | null) {
  if (!slug || effects.value.some(e => e.slug === slug)) return
  const label = effectOptions.value.find(o => o.value === slug)?.label ?? slug
  const item = reactive<Effect>({ slug, label, buf: null, loading: true, playing: false })
  effects.value.push(item)
  fetchSongBuffer(slug)
    .then(buf => { item.buf = buf })
    .catch(() => {
      message.error(t('dj.file_error'))
      effects.value = effects.value.filter(e => e !== item)
    })
    .finally(() => { item.loading = false })
}

function toggleEffect(item: Effect) {
  if (!item.buf) return
  if (item.playing) {
    live.stopEffect(item.slug)
    item.playing = false
    return
  }
  live.playEffect(item.slug, item.buf, () => { item.playing = false })
  item.playing = true
}

function removeEffect(item: Effect) {
  live.stopEffect(item.slug)
  effects.value = effects.value.filter(e => e !== item)
}

// ── Handing back ────────────────────────────────────────────────────
/** Only at a song boundary: the queue cannot pick up a song mid-way, so no song may be playing. */
function handBack() {
  if (playingSlug.value) return
  micOpen.value = false
  state.value = 'ending'
  live.end()
}

const onAirFor = computed(() => formatTime((now.value - onAirSince.value) / 1000))

onMounted(async () => {
  ticker = setInterval(() => {
    now.value = Date.now()
    if (playingSlug.value) position.value = live.songPosition()
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
        :disabled="state !== 'on_air' || !!playingSlug"
        :title="playingSlug ? t('dj.live_handback_hint') : ''"
        @click="handBack"
      >
        {{ t('dj.live_handback') }}
      </NButton>
    </div>

    <section class="dj-live-area dj-live-area--song">
      <h4 class="dj-live-area-title">{{ t('dj.live_songs') }}</h4>
      <DjSongPicker v-model="picked" label="♪" :placeholder="t('dj.live_add_song')" :brand-slug="brandSlug" />
      <p v-if="!crate.length" class="dj-live-empty">{{ t('dj.live_songs_empty') }}</p>
      <div class="dj-live-tags">
        <div
          v-for="item in crate"
          :key="item.song.slugName"
          class="dj-live-tag"
          :class="{ 'dj-live-tag--playing': playingSlug === item.song.slugName }"
        >
          <NButton
            size="tiny"
            circle
            :loading="item.loading"
            :disabled="!item.buf || state !== 'on_air'"
            :aria-label="playingSlug === item.song.slugName ? t('dj.preview_stop') : t('dj.preview')"
            @click="toggleSong(item)"
          >
            <LedPlay :active="playingSlug === item.song.slugName" />
          </NButton>
          <span class="dj-live-tag-label" :title="songLabel(item.song)">{{ songLabel(item.song) }}</span>
          <span v-if="playingSlug === item.song.slugName && item.buf" class="dj-live-tag-time">
            {{ formatTime(position) }} / {{ formatTime(item.buf.duration) }}
          </span>
          <span class="dj-live-tag-count" :title="t('dj.live_plays', { n: item.plays })">×{{ item.plays }}</span>
          <button
            class="dj-live-tag-remove"
            type="button"
            :disabled="playingSlug === item.song.slugName"
            :aria-label="t('dj.live_remove')"
            @click="removeSong(item)"
          >✕</button>
          <div
            v-if="playingSlug === item.song.slugName && item.buf"
            class="dj-live-tag-progress"
            :style="{ width: (position / item.buf.duration) * 100 + '%' }"
          />
        </div>
      </div>
    </section>

    <section class="dj-live-balance">
      <span class="dj-live-chip dj-live-chip--song">{{ t('dj.live_song') }}</span>
      <NSlider v-model:value="balance" :min="0" :max="1" :step="0.01" :tooltip="false" />
      <span class="dj-live-chip dj-live-chip--mic">{{ t('dj.live_mic') }}</span>
    </section>

    <section class="dj-live-area dj-live-area--mic">
      <h4 class="dj-live-area-title">{{ t('dj.live_mic') }}</h4>
      <div class="dj-live-mic-row">
        <NButton
          class="dj-live-mic"
          :type="micOpen ? 'error' : 'default'"
          :disabled="state !== 'on_air'"
          @click="micOpen = !micOpen"
        >
          <LedRed class="dj-live-mic-led" :active="micOpen" />
          {{ micOpen ? t('dj.live_mic_open') : t('dj.live_mic_closed') }}
        </NButton>
        <div class="dj-live-fx">
          <div v-for="fx in fxSliders" :key="fx.key" class="dj-live-fx-slider">
            <NSlider v-model:value="micFx[fx.key]" vertical :min="0" :max="1" :step="0.01" :tooltip="false" />
            <span>{{ t(fx.label) }}</span>
          </div>
        </div>
      </div>

      <NSelect
        class="dj-live-effect-select"
        :value="null"
        :options="effectOptions"
        :loading="effectsSearching"
        :placeholder="t('dj.pick_effect')"
        filterable
        remote
        clearable
        @focus="searchEffects()"
        @search="searchEffects"
        @update:value="addEffect"
      />
      <div class="dj-live-tags">
        <div v-for="item in effects" :key="item.slug" class="dj-live-tag dj-live-tag--effect" :class="{ 'dj-live-tag--playing': item.playing }">
          <NButton
            size="tiny"
            circle
            :loading="item.loading"
            :disabled="!item.buf || state !== 'on_air'"
            :aria-label="item.playing ? t('dj.preview_stop') : t('dj.preview')"
            @click="toggleEffect(item)"
          >
            <LedPlay :active="item.playing" />
          </NButton>
          <span class="dj-live-tag-label" :title="item.label">{{ item.label }}</span>
          <button class="dj-live-tag-remove" type="button" :aria-label="t('dj.live_remove')" @click="removeEffect(item)">✕</button>
        </div>
      </div>
    </section>

    <p class="dj-live-hint">{{ t('dj.live_hint') }}</p>
  </div>
</template>

<style scoped>
.dj-live {
  display: flex;
  flex-direction: column;
  gap: 16px;
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
.dj-live-area {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
  border: 1px solid var(--dj-border);
  border-radius: 8px;
  background: var(--dj-surface);
}
.dj-live-area--song {
  --dj-slot: var(--dj-a);
}
.dj-live-area--mic {
  --dj-slot: var(--dj-b);
}
.dj-live-area-title {
  margin: 0;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--dj-muted);
  text-transform: uppercase;
}
.dj-live-empty {
  margin: 0;
  font-size: 0.8rem;
  color: var(--dj-muted);
}
.dj-live-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.dj-live-tag {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  max-width: 100%;
  padding: 4px 8px 4px 4px;
  border: 1px solid var(--dj-border);
  border-radius: 999px;
  font-size: 0.8rem;
  overflow: hidden;
}
.dj-live-tag--playing {
  border-color: var(--dj-slot);
  background: color-mix(in srgb, var(--dj-slot) 18%, transparent);
}
.dj-live-tag-label {
  min-width: 0;
  max-width: 280px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.dj-live-tag-time {
  font-size: 0.72rem;
  font-variant-numeric: tabular-nums;
  color: var(--dj-muted);
}
.dj-live-tag-count {
  flex: none;
  padding: 0 6px;
  border-radius: 999px;
  font-size: 0.7rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  background: var(--dj-slot);
  color: #1a1a1a;
}
.dj-live-tag-remove {
  flex: none;
  border: none;
  background: none;
  padding: 0 2px;
  color: var(--dj-muted);
  cursor: pointer;
}
.dj-live-tag-remove:disabled {
  opacity: 0.3;
  cursor: default;
}
.dj-live-tag-progress {
  position: absolute;
  left: 0;
  bottom: 0;
  height: 2px;
  background: var(--dj-slot);
  transition: width 0.2s linear;
}
.dj-live-balance {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 16px;
  border-radius: 8px;
  border: 1px solid var(--dj-border);
}
.dj-live-chip {
  flex: none;
  padding: 3px 10px;
  border-radius: 6px;
  font-weight: 700;
  font-size: 0.75rem;
  text-transform: uppercase;
  color: #1a1a1a;
}
.dj-live-chip--song {
  background: var(--dj-a);
}
.dj-live-chip--mic {
  background: var(--dj-b);
}
.dj-live-mic-row {
  display: flex;
  align-items: center;
  gap: 24px;
  flex-wrap: wrap;
}
.dj-live-mic {
  font-weight: 700;
  letter-spacing: 0.06em;
}
.dj-live-mic-led {
  margin-right: 8px;
  vertical-align: -3px;
}
.dj-live-fx {
  display: flex;
  gap: 18px;
}
.dj-live-fx-slider {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  height: 110px;
  font-size: 0.7rem;
  color: var(--dj-muted);
}
.dj-live-fx-slider :deep(.n-slider) {
  flex: 1;
}
.dj-live-effect-select {
  max-width: 360px;
}
.dj-live-hint {
  margin: 0;
  font-size: 0.75rem;
  color: var(--dj-muted);
  text-align: center;
}
</style>
