<script setup lang="ts">
import { computed, h, onBeforeUnmount, onMounted, reactive, ref, watch, type Ref, type VNodeChild } from 'vue'
import { useI18n } from 'vue-i18n'
import { NButton, NIcon, NInput, NSelect, NSlider, NSwitch, useMessage, type SelectOption } from 'naive-ui'
import { HeadsetOutline, Play, VolumeHighOutline, VolumeMuteOutline } from '@vicons/ionicons5'
import LedRed from '@/components/LedRed.vue'
import type { DjSong } from '@/components/dj/DjSongPicker.vue'
import aivoxApiService from '@/services/aivoxApi'
import datanestApiService from '@/services/datanestApi'
import { fetchSongBuffer } from '@/utils/djAudio'
import { LiveBroadcast } from '@/utils/djLive'
import type { FxAmounts } from '@/utils/djMix'

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

/** Clicks on a tag's own buttons must not open the field's dropdown or move its focus. */
const keepField = (e: Event) => { e.stopPropagation(); e.preventDefault() }

/**
 * A tag drawn like an entry of the station card's queue: the indicator (here the play button, the
 * equalizer while it plays), title · artist, then a small tag on the right. The one playing glows.
 */
function queueTag(opts: {
  playing: boolean
  loading: boolean
  canPlay: boolean
  title: string
  artist?: string
  right?: string
  rightTitle?: string
  canRemove: boolean
  onToggle: () => void
  onRemove: () => void
  progress?: number
}): VNodeChild {
  return h('div', { class: ['queue-item', { 'queue-item--playing': opts.playing }], onMousedown: keepField, onClick: keepField }, [
    h('button', {
      type: 'button',
      class: 'queue-indicator',
      disabled: !opts.canPlay,
      'aria-label': opts.playing ? t('dj.preview_stop') : t('dj.preview'),
      onMousedown: keepField,
      onClick: (e: Event) => { keepField(e); opts.onToggle() },
    }, opts.loading
      ? h('span', { class: 'queue-loading' })
      : opts.playing
        ? h('span', { class: 'queue-eq' }, [h('span', { class: 'bar' }), h('span', { class: 'bar' }), h('span', { class: 'bar' })])
        : h(NIcon, { component: Play, size: 12 })),
    h('span', { class: 'queue-info' }, [
      h('span', { class: 'queue-title' }, opts.title),
      ...(opts.artist ? [h('span', { class: 'queue-sep' }, '·'), h('span', { class: 'queue-artist' }, opts.artist)] : []),
    ]),
    ...(opts.right ? [h('span', { class: 'queue-type-tag', title: opts.rightTitle }, opts.right)] : []),
    h('button', {
      type: 'button',
      class: 'queue-remove',
      disabled: !opts.canRemove,
      'aria-label': t('dj.live_remove'),
      onMousedown: keepField,
      onClick: (e: Event) => { keepField(e); opts.onRemove() },
    }, '✕'),
    ...(opts.progress !== undefined ? [h('span', { class: 'queue-progress', style: { width: `${opts.progress * 100}%` } })] : []),
  ])
}

// ── Songs ───────────────────────────────────────────────────────────
interface CrateSong {
  song: DjSong
  buf: AudioBuffer | null
  loading: boolean
  /** Times it was started this session. */
  plays: number
}
/** The songs the DJ has lined up, kept in the field; any of them goes on air with its play button. */
const crate = ref<CrateSong[]>([])
const playingSlug = ref<string | null>(null)
const position = ref(0)

const songResults = ref<DjSong[]>([])
const songsSearching = ref(false)
let songSeq = 0
let songTimer: ReturnType<typeof setTimeout> | null = null

/** Same source as the Pre-mix pickers: the brand's available songs. */
async function searchSongs(term = '') {
  const seq = ++songSeq
  songsSearching.value = true
  try {
    const result = await datanestApiService.getBrandPlaylist(props.brandSlug, 1, 30, {
      searchTerm: term.trim() || undefined,
      type: ['SONG'],
    })
    if (seq !== songSeq) return
    songResults.value = result.entries.map((e: any) => ({
      slugName: e.slugName, id: e.id ?? e.slugName, title: e.title ?? '', artist: e.artist ?? '',
    }))
  } catch {
    if (seq === songSeq) songResults.value = []
  } finally {
    if (seq === songSeq) songsSearching.value = false
  }
}
function onSongSearch(term: string) {
  if (songTimer) clearTimeout(songTimer)
  songTimer = setTimeout(() => searchSongs(term), 400)
}

const songValue = computed(() => crate.value.map(c => c.song.slugName))
const songOptions = computed<SelectOption[]>(() => {
  const inField = crate.value.map(c => c.song)
  const more = songResults.value.filter(s => !songValue.value.includes(s.slugName))
  return [...inField, ...more].map(s => ({ label: [s.artist, s.title].filter(Boolean).join(' — ') || s.slugName, value: s.slugName }))
})

function onSongsChange(slugs: string[]) {
  for (const slug of slugs) {
    if (songValue.value.includes(slug)) continue
    const song = songResults.value.find(s => s.slugName === slug)
    if (song) addSong(song)
  }
  // The song on air cannot be taken out of the field.
  crate.value = crate.value.filter(c => slugs.includes(c.song.slugName) || c.song.slugName === playingSlug.value)
}

function addSong(song: DjSong) {
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
}

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

function renderSongTag({ option }: { option: SelectOption }) {
  const item = crate.value.find(c => c.song.slugName === option.value)
  if (!item) return String(option.label ?? '')
  const playing = playingSlug.value === item.song.slugName
  return queueTag({
    playing,
    loading: item.loading,
    canPlay: !!item.buf && state.value === 'on_air',
    title: item.song.title || item.song.slugName,
    artist: playing && item.buf
      ? `${item.song.artist ? item.song.artist + ' · ' : ''}${formatTime(position.value)} / ${formatTime(item.buf.duration)}`
      : item.song.artist,
    right: `×${item.plays}`,
    rightTitle: t('dj.live_plays', { n: item.plays }),
    canRemove: !playing,
    onToggle: () => toggleSong(item),
    onRemove: () => { crate.value = crate.value.filter(c => c !== item) },
    progress: playing && item.buf ? position.value / item.buf.duration : undefined,
  })
}

/** The song muted in the DJ's own output only, for listening to the station itself; the air is untouched. */
const songMonitorMuted = ref(false)
watch(songMonitorMuted, muted => live.setSongMonitorMuted(muted))

const playingItem = computed(() => crate.value.find(c => c.song.slugName === playingSlug.value) ?? null)
watch([playingItem, state], ([item, s]) => {
  if (s !== 'on_air' || !item) return
  live.sendNowPlaying({ songId: item.song.id, slugName: item.song.slugName, title: item.song.title, artist: item.song.artist })
})

// ── Main fader ──────────────────────────────────────────────────────
/** 0 is all song, 1 is all mic. */
const balance = ref(0.5)
/** Fine enough that the handle reads as a classic, continuous fader rather than a stepped one. */
const FADER_STEP = 0.001
/** How close counts as "at" a preset, for highlighting the matching chip. */
const LEVEL_MATCH_TOLERANCE = 0.02
watch(balance, x => live.setBalance(x), { immediate: true })

/**
 * Named presets kept in this browser only, seeded with `defaults` the first time. Anything unreadable
 * falls back to the defaults; blocked storage just means they last for this visit.
 */
function storedList<T extends { name: string }>(key: string, defaults: T[], valid: (item: T) => boolean) {
  let initial = defaults.map(d => JSON.parse(JSON.stringify(d)) as T)
  try {
    const parsed = JSON.parse(localStorage.getItem(key) ?? 'null')
    if (Array.isArray(parsed)) initial = parsed.filter(p => p && typeof p.name === 'string' && valid(p))
  } catch { /* storage blocked or corrupt */ }
  const list = ref(initial) as Ref<T[]>
  watch(list, value => {
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch { /* storage blocked */ }
  }, { deep: true })
  return list
}

/** Which named preset the DJ had picked last, so reopening the deck lands back where they left it. */
const LAST_FX_PRESET_KEY = 'mixdeck.dj.lastMicFxPreset'
const LAST_LEVEL_PRESET_KEY = 'mixdeck.dj.lastLevelPreset'
function rememberLastPreset(key: string, name: string) {
  try {
    localStorage.setItem(key, name)
  } catch { /* storage blocked */ }
}
function lastPresetName(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

// ── Level presets ───────────────────────────────────────────────────
interface LevelPreset {
  name: string
  /** Fader position, 0 all song to 1 all mic. */
  balance: number
}
const LEVEL_PRESETS_KEY = 'mixdeck.dj.balancePresets'
const DEFAULT_LEVEL_PRESETS: LevelPreset[] = [
  { name: 'Song', balance: 0 },
  { name: 'Talk over', balance: 0.7 },
  { name: 'Even', balance: 0.5 },
  { name: 'Voice', balance: 1 },
]
const levelPresets = storedList<LevelPreset>(LEVEL_PRESETS_KEY, DEFAULT_LEVEL_PRESETS, p => typeof p.balance === 'number')
const levelPresetName = ref('')

/**
 * How long a glide across the whole fader takes; shorter moves take proportionally less. The handle
 * moves smoothly, every frame, landing exactly on the preset's own value.
 */
const GLIDE_FULL_RANGE_MS = 2000
let glideFrame: number | null = null

function stopGlide() {
  if (glideFrame !== null) cancelAnimationFrame(glideFrame)
  glideFrame = null
}

function glideTo(target: number) {
  stopGlide()
  const from = balance.value
  const goal = Math.min(1, Math.max(0, target))
  const duration = Math.abs(goal - from) * GLIDE_FULL_RANGE_MS
  if (duration < 1) {
    balance.value = goal
    return
  }
  const startedAt = performance.now()
  const frame = (nowMs: number) => {
    const p = Math.min(1, (nowMs - startedAt) / duration)
    // Eases in and out, as a hand on a fader would.
    const eased = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2
    balance.value = from + (goal - from) * eased
    glideFrame = p < 1 ? requestAnimationFrame(frame) : null
  }
  glideFrame = requestAnimationFrame(frame)
}

/** The DJ's own hand always wins over a glide in progress. */
function onBalanceInput(value: number) {
  stopGlide()
  balance.value = value
}

const levelMatches = (p: LevelPreset) => Math.abs(p.balance - balance.value) < LEVEL_MATCH_TOLERANCE

/** Saving under a name that already exists moves that preset to the current position. */
function saveLevelPreset() {
  const name = levelPresetName.value.trim()
  if (!name) return
  const existing = levelPresets.value.find(p => p.name.toLowerCase() === name.toLowerCase())
  if (existing) existing.balance = balance.value
  else levelPresets.value.push({ name, balance: balance.value })
  levelPresetName.value = ''
}

function deleteLevelPreset(p: LevelPreset) {
  levelPresets.value = levelPresets.value.filter(x => x !== p)
}

function applyLevelPreset(p: LevelPreset) {
  glideTo(p.balance)
  rememberLastPreset(LAST_LEVEL_PRESET_KEY, p.name)
}

// ── Auto fader ──────────────────────────────────────────────────────
/**
 * With Auto on, the MIC button moves the fader too: on, it glides to one level preset, off, to another,
 * so handing the air between voice and song is a single press. Presets are referred to by name.
 */
interface AutoFader {
  enabled: boolean
  micOn: string | null
  micOff: string | null
}
const AUTO_FADER_KEY = 'mixdeck.dj.autoFader'
function loadAutoFader(): AutoFader {
  const fallback: AutoFader = { enabled: false, micOn: 'Talk over', micOff: 'Song' }
  try {
    const parsed = JSON.parse(localStorage.getItem(AUTO_FADER_KEY) ?? 'null')
    if (parsed && typeof parsed.enabled === 'boolean') return { ...fallback, ...parsed }
  } catch { /* storage blocked or corrupt */ }
  return fallback
}
const autoFader = reactive<AutoFader>(loadAutoFader())
watch(autoFader, value => {
  try {
    localStorage.setItem(AUTO_FADER_KEY, JSON.stringify(value))
  } catch { /* storage blocked */ }
}, { deep: true })

const levelPresetOptions = computed(() => levelPresets.value.map(p => ({
  label: `${p.name} · ${Math.round(p.balance * 100)}%`,
  value: p.name,
})))
const presetNamed = (name: string | null) => levelPresets.value.find(p => p.name === name) ?? null

// ── Mic ─────────────────────────────────────────────────────────────
const micOpen = ref(false)
watch(micOpen, open => live.setMicOpen(open))

/**
 * The preset Auto fader currently calls for, given the mic's own state — or null while Auto is off.
 * Watching this alone covers every way the fader can fall out of step with it: the mic being pressed,
 * Auto being switched on, and the DJ picking a different preset for the state the mic is already in.
 */
const autoFaderTarget = computed(() => (
  autoFader.enabled ? presetNamed(micOpen.value ? autoFader.micOn : autoFader.micOff) : null
))
watch(autoFaderTarget, preset => {
  if (preset) glideTo(preset.balance)
}, { immediate: true })
const micFx = reactive({ reverb: 0, echo: 0, radio: 0, distortion: 0 })
watch(micFx, amounts => live.setMicFx({ ...amounts }), { deep: true })
/**
 * The DJ hearing their own voice, effects included, whether or not the mic is on air — so effects can
 * be tried before going out. Headphones only: through speakers the mic picks itself up and howls.
 */
const hearMyself = ref(false)
watch(hearMyself, on => {
  live.setMicMonitor(on)
  if (on) message.warning(t('dj.live_hear_myself_hint'), { duration: 5000 })
})
/** 1 is the mic as it comes in; up to 1.5 to lift a quiet one. */
const micLevel = ref(1)
watch(micLevel, level => live.setMicLevel(level))

// ── Effect presets ──────────────────────────────────────────────────
interface FxPreset {
  name: string
  fx: FxAmounts
}
/** Kept in this browser only: a DJ's own sounds, not something the station needs to know. */
const PRESETS_KEY = 'mixdeck.dj.micFxPresets'
const DEFAULT_PRESETS: FxPreset[] = [
  { name: 'Clean', fx: { reverb: 0, echo: 0, radio: 0, distortion: 0 } },
  { name: 'Radio', fx: { reverb: 0, echo: 0, radio: 0.8, distortion: 0 } },
  { name: 'Hall', fx: { reverb: 0.5, echo: 0, radio: 0, distortion: 0 } },
  { name: 'Echo', fx: { reverb: 0.15, echo: 0.5, radio: 0, distortion: 0 } },
]

const presets = storedList<FxPreset>(PRESETS_KEY, DEFAULT_PRESETS, p => !!p.fx)

const presetName = ref('')
const FX_KEYS = ['reverb', 'echo', 'radio', 'distortion'] as const
const matches = (p: FxPreset) => FX_KEYS.every(k => Math.abs(p.fx[k] - micFx[k]) < 0.005)

function applyPreset(p: FxPreset) {
  Object.assign(micFx, p.fx)
  rememberLastPreset(LAST_FX_PRESET_KEY, p.name)
}

/** Saving under a name that already exists overwrites that preset. */
function savePreset() {
  const name = presetName.value.trim()
  if (!name) return
  const fx = { ...micFx }
  const existing = presets.value.find(p => p.name.toLowerCase() === name.toLowerCase())
  if (existing) existing.fx = fx
  else presets.value.push({ name, fx })
  presetName.value = ''
}

/**
 * Reopening the deck lands back where the DJ left it: the mic effect preset they last picked, and —
 * unless Auto fader is on and would set it anyway from the mic's own state — the level preset too.
 */
onMounted(() => {
  const fxName = lastPresetName(LAST_FX_PRESET_KEY)
  const fxPreset = fxName ? presets.value.find(p => p.name === fxName) : undefined
  if (fxPreset) Object.assign(micFx, fxPreset.fx)

  if (!autoFader.enabled) {
    const levelName = lastPresetName(LAST_LEVEL_PRESET_KEY)
    const levelPreset = levelName ? levelPresets.value.find(p => p.name === levelName) : undefined
    if (levelPreset) balance.value = levelPreset.balance
  }
})

function deletePreset(p: FxPreset) {
  presets.value = presets.value.filter(x => x !== p)
}
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
/** The effects the DJ has lined up, kept in the field; tapping one plays it. */
const effects = ref<Effect[]>([])
/** Effects come from the station's sound assets, as in the link editor. */
const effectResults = ref<{ label: string; value: string }[]>([])
const effectsSearching = ref(false)
let effectSeq = 0

async function searchEffects(term = '') {
  const seq = ++effectSeq
  effectsSearching.value = true
  try {
    const res = await datanestApiService.getSoundAssets(1, 30, term.trim())
    if (seq !== effectSeq) return
    effectResults.value = res.entries.map((e: any) => ({ label: e.title || e.slugName, value: e.slugName }))
  } catch {
    if (seq === effectSeq) effectResults.value = []
  } finally {
    if (seq === effectSeq) effectsSearching.value = false
  }
}

const effectValue = computed(() => effects.value.map(e => e.slug))
const effectOptions = computed<SelectOption[]>(() => [
  ...effects.value.map(e => ({ label: e.label, value: e.slug })),
  ...effectResults.value.filter(r => !effectValue.value.includes(r.value)),
])

function onEffectsChange(slugs: string[]) {
  for (const slug of slugs) {
    if (effectValue.value.includes(slug)) continue
    addEffect(slug, effectResults.value.find(r => r.value === slug)?.label ?? slug)
  }
  for (const item of effects.value.filter(e => !slugs.includes(e.slug))) live.stopEffect(item.slug)
  effects.value = effects.value.filter(e => slugs.includes(e.slug))
}

function addEffect(slug: string, label: string) {
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

function renderEffectTag({ option }: { option: SelectOption }) {
  const item = effects.value.find(e => e.slug === option.value)
  if (!item) return String(option.label ?? '')
  return queueTag({
    playing: item.playing,
    loading: item.loading,
    canPlay: !!item.buf && state.value === 'on_air',
    title: item.label,
    right: item.buf ? formatTime(item.buf.duration) : undefined,
    canRemove: true,
    onToggle: () => toggleEffect(item),
    onRemove: () => onEffectsChange(effectValue.value.filter(s => s !== item.slug)),
  })
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
  void searchSongs()
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
  if (songTimer) clearTimeout(songTimer)
  stopGlide()
  live.dispose()
})

/** So DjPanel can warn before ending the whole session out from under a song still going out to air. */
defineExpose({ broadcasting: computed(() => !!playingSlug.value) })
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

    <section class="dj-live-area">
      <div class="dj-live-area-head">
        <h4 class="dj-live-area-title">{{ t('dj.live_songs') }}</h4>
        <NButton
          size="small"
          :type="songMonitorMuted ? 'warning' : 'default'"
          :title="t('dj.live_song_mute_hint')"
          @click="songMonitorMuted = !songMonitorMuted"
        >
          <NIcon class="dj-live-mute-icon" :component="songMonitorMuted ? VolumeMuteOutline : VolumeHighOutline" size="16" />
          {{ songMonitorMuted ? t('dj.live_song_muted') : t('dj.live_song_mute') }}
        </NButton>
      </div>
      <NSelect
        class="dj-live-field"
        multiple
        filterable
        remote
        :value="songValue"
        :options="songOptions"
        :loading="songsSearching"
        :placeholder="t('dj.live_add_song')"
        :render-tag="renderSongTag"
        @search="onSongSearch"
        @update:value="onSongsChange"
      />
      <p v-if="!crate.length" class="dj-live-empty">{{ t('dj.live_songs_empty') }}</p>
    </section>

    <section class="dj-live-balance-area">
      <div class="dj-live-balance">
        <span class="dj-live-chip dj-live-chip--song">{{ t('dj.live_song') }}</span>
        <NSlider
          :value="balance"
          class="dj-live-balance-slider"
          :min="0"
          :max="1"
          :step="FADER_STEP"
          :tooltip="false"
          :theme-overrides="{ railHeight: '8px', fillColor: 'var(--dj-b)', fillColorHover: 'var(--dj-b)' }"
          @update:value="onBalanceInput"
        >
          <template #thumb>
            <div class="dj-live-balance-thumb">{{ Math.round(balance * 100) }}%</div>
          </template>
        </NSlider>
        <span class="dj-live-chip dj-live-chip--mic">{{ t('dj.live_mic') }}</span>
      </div>

      <div class="dj-live-presets dj-live-presets--levels">
        <span class="dj-live-presets-label">{{ t('dj.live_level_presets') }}</span>
        <span
          v-for="p in levelPresets"
          :key="p.name"
          class="dj-live-preset"
          :class="{ 'dj-live-preset--active': levelMatches(p) }"
        >
          <button type="button" class="dj-live-preset-apply" @click="applyLevelPreset(p)">
            {{ p.name }} <span class="dj-live-preset-value">{{ Math.round(p.balance * 100) }}%</span>
          </button>
          <button type="button" class="dj-live-preset-delete" :aria-label="t('dj.live_remove')" @click="deleteLevelPreset(p)">✕</button>
        </span>
        <NInput
          v-model:value="levelPresetName"
          class="dj-live-preset-name"
          size="small"
          :placeholder="t('dj.live_preset_name')"
          @keyup.enter="saveLevelPreset"
        />
        <NButton size="small" :disabled="!levelPresetName.trim()" @click="saveLevelPreset">
          {{ t('dj.live_preset_save_at', { pct: Math.round(balance * 100) }) }}
        </NButton>
      </div>

      <div class="dj-live-auto" :class="{ 'dj-live-auto--on': autoFader.enabled }">
        <label class="dj-live-auto-switch">
          <NSwitch v-model:value="autoFader.enabled" size="small" />
          {{ t('dj.live_auto_fader') }}
        </label>
        <span class="dj-live-auto-rule">
          {{ t('dj.live_auto_mic_on') }}
          <NSelect v-model:value="autoFader.micOn" class="dj-live-auto-select" size="small" :options="levelPresetOptions" :disabled="!autoFader.enabled" />
        </span>
        <span class="dj-live-auto-rule">
          {{ t('dj.live_auto_mic_off') }}
          <NSelect v-model:value="autoFader.micOff" class="dj-live-auto-select" size="small" :options="levelPresetOptions" :disabled="!autoFader.enabled" />
        </span>
      </div>
    </section>

    <section class="dj-live-area">
      <h4 class="dj-live-area-title">{{ t('dj.live_mic') }}</h4>
      <div class="dj-live-mic-row">
        <NButton
          class="dj-live-mic"
          size="large"
          :type="micOpen ? 'error' : 'default'"
          :disabled="state !== 'on_air'"
          @click="micOpen = !micOpen"
        >
          <LedRed class="dj-live-mic-led" :active="micOpen" />
          {{ micOpen ? t('dj.live_mic_open') : t('dj.live_mic_closed') }}
        </NButton>
        <NButton
          class="dj-live-hear"
          :type="hearMyself ? 'primary' : 'default'"
          :disabled="state === 'connecting'"
          :title="t('dj.live_hear_myself_hint')"
          @click="hearMyself = !hearMyself"
        >
          <NIcon class="dj-live-hear-icon" :component="HeadsetOutline" size="20" />
          {{ t('dj.live_hear_myself') }}
        </NButton>
        <div class="dj-live-fx">
          <div v-for="fx in fxSliders" :key="fx.key" class="dj-live-fx-slider">
            <NSlider v-model:value="micFx[fx.key]" vertical :min="0" :max="1" :step="0.01" :tooltip="false" />
            <span>{{ t(fx.label) }}</span>
          </div>
        </div>
        <div class="dj-live-vol">
          <span class="dj-live-vol-value">{{ Math.round(micLevel * 100) }}%</span>
          <NSlider
            v-model:value="micLevel"
            vertical
            :min="0"
            :max="1.5"
            :step="0.05"
            :tooltip="false"
            :theme-overrides="{ railHeight: '8px', fillColor: 'var(--dj-b)', fillColorHover: 'var(--dj-b)' }"
          />
          <span class="dj-live-vol-label">{{ t('dj.live_mic_volume') }}</span>
        </div>
      </div>

      <div class="dj-live-presets">
        <span class="dj-live-presets-label">{{ t('dj.live_presets') }}</span>
        <span
          v-for="p in presets"
          :key="p.name"
          class="dj-live-preset"
          :class="{ 'dj-live-preset--active': matches(p) }"
        >
          <button type="button" class="dj-live-preset-apply" @click="applyPreset(p)">{{ p.name }}</button>
          <button type="button" class="dj-live-preset-delete" :aria-label="t('dj.live_remove')" @click="deletePreset(p)">✕</button>
        </span>
        <NInput
          v-model:value="presetName"
          class="dj-live-preset-name"
          size="small"
          :placeholder="t('dj.live_preset_name')"
          @keyup.enter="savePreset"
        />
        <NButton size="small" :disabled="!presetName.trim()" @click="savePreset">{{ t('dj.live_preset_save') }}</NButton>
      </div>
      <NSelect
        class="dj-live-field"
        multiple
        filterable
        remote
        :value="effectValue"
        :options="effectOptions"
        :loading="effectsSearching"
        :placeholder="t('dj.pick_effect')"
        :render-tag="renderEffectTag"
        @focus="searchEffects()"
        @search="searchEffects"
        @update:value="onEffectsChange"
      />
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
.dj-live-area-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.dj-live-mute-icon {
  margin-right: 6px;
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
.dj-live-balance-area {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 0 16px 12px;
  border-radius: 8px;
  border: 1px solid var(--dj-border);
}
.dj-live-balance {
  display: flex;
  align-items: center;
  /* Half the handle's width, so at either end it stops beside the chip instead of over it. */
  gap: 36px;
  padding: 24px 0 14px;
}
.dj-live-presets--levels {
  justify-content: center;
}
.dj-live-auto {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 8px 18px;
  padding: 8px 12px;
  border-radius: 6px;
  border: 1px dashed var(--dj-border);
  font-size: 0.8rem;
}
.dj-live-auto--on {
  border-style: solid;
  border-color: var(--dj-b);
  background: color-mix(in srgb, var(--dj-b) 10%, transparent);
}
.dj-live-auto-switch {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  cursor: pointer;
}
.dj-live-auto-rule {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--dj-muted);
}
.dj-live-auto-select {
  width: 170px;
}
.dj-live-preset-value {
  margin-left: 4px;
  font-weight: 400;
  opacity: 0.6;
  font-variant-numeric: tabular-nums;
}
.dj-live-balance-slider {
  flex: 1;
}
/** The main fader's handle: big enough to find at a glance, with where it sits written on it. */
.dj-live-balance-thumb {
  width: 56px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 5px;
  background: #fff;
  color: #1a1a1a;
  /* Keeps the white handle visible on the light theme too. */
  border: 1px solid rgba(0, 0, 0, 0.15);
  font-size: 0.78rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.35);
  cursor: grab;
  user-select: none;
}
.dj-live-balance-thumb:active {
  cursor: grabbing;
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
/** The one control a DJ reaches for mid-sentence, so it is the biggest thing in the mic area. */
.dj-live-mic {
  min-width: 180px;
  height: 64px;
  font-size: 1.05rem;
  font-weight: 700;
  letter-spacing: 0.08em;
}
.dj-live-hear {
  height: 64px;
  font-weight: 600;
}
.dj-live-hear-icon {
  margin-right: 8px;
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
/** The mic's volume stands apart from the effects: its own panel, a thicker rail, its level on top. */
.dj-live-vol {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  height: 140px;
  padding: 8px 14px;
  border-radius: 8px;
  border: 1px solid color-mix(in srgb, var(--dj-b) 60%, transparent);
  background: color-mix(in srgb, var(--dj-b) 12%, transparent);
}
.dj-live-vol :deep(.n-slider) {
  flex: 1;
}
.dj-live-vol-value {
  min-width: 44px;
  padding: 2px 6px;
  border-radius: 4px;
  text-align: center;
  font-size: 0.75rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  background: var(--dj-b);
  color: #1a1a1a;
}
.dj-live-vol-label {
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
.dj-live-presets {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}
.dj-live-presets-label {
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  color: var(--dj-muted);
  margin-right: 4px;
}
.dj-live-preset {
  display: inline-flex;
  align-items: center;
  border-radius: 4px;
  border: 1px solid var(--dj-border);
  font-size: 0.78rem;
  overflow: hidden;
}
.dj-live-preset--active {
  border-color: var(--dj-b);
  background: color-mix(in srgb, var(--dj-b) 20%, transparent);
}
.dj-live-preset-apply,
.dj-live-preset-delete {
  border: none;
  background: none;
  color: inherit;
  cursor: pointer;
}
.dj-live-preset-apply {
  padding: 3px 4px 3px 9px;
  font-weight: 600;
}
.dj-live-preset-delete {
  padding: 3px 7px 3px 3px;
  opacity: 0.35;
}
.dj-live-preset-delete:hover {
  opacity: 0.9;
}
.dj-live-preset-name {
  width: 140px;
}
.dj-live-hint {
  margin: 0;
  font-size: 0.75rem;
  color: var(--dj-muted);
  text-align: center;
}

/*
 * The tags inside the fields, styled as the station card's queue (AivoxQueue). They are rendered by
 * the select, not by this template, so they are reached through :deep.
 */
.dj-live-field :deep(.n-base-selection-tags) {
  gap: 6px;
  padding-top: 6px;
  padding-bottom: 6px;
}
.dj-live-field :deep(.queue-item) {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  max-width: 100%;
  border-radius: 4px;
  padding: 5px 8px 5px 6px;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.07);
  overflow: hidden;
  cursor: default;
}
.dj-live-field :deep(.queue-indicator) {
  flex-shrink: 0;
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 50%;
  background: transparent;
  color: inherit;
  cursor: pointer;
}
.dj-live-field :deep(.queue-indicator:disabled) {
  opacity: 0.35;
  cursor: default;
}
.dj-live-field :deep(.queue-indicator:not(:disabled):hover) {
  border-color: #FFD600;
  color: #FFD600;
}
.dj-live-field :deep(.queue-loading) {
  width: 10px;
  height: 10px;
  border: 2px solid rgba(255, 255, 255, 0.2);
  border-top-color: #FFD600;
  border-radius: 50%;
  animation: queue-spin 0.8s linear infinite;
}
@keyframes queue-spin {
  to { transform: rotate(360deg); }
}
.dj-live-field :deep(.queue-eq) {
  display: flex;
  align-items: flex-end;
  gap: 2px;
  height: 13px;
}
.dj-live-field :deep(.queue-eq .bar) {
  width: 3px;
  background: #FFD600;
  border-radius: 1px;
  transform-origin: bottom;
  animation: eq-pulse 0.9s ease-in-out infinite alternate;
}
.dj-live-field :deep(.queue-eq .bar:nth-child(1)) { height: 7px; animation-delay: 0s; }
.dj-live-field :deep(.queue-eq .bar:nth-child(2)) { height: 13px; animation-delay: 0.18s; }
.dj-live-field :deep(.queue-eq .bar:nth-child(3)) { height: 5px; animation-delay: 0.09s; }
@keyframes eq-pulse {
  0%   { transform: scaleY(0.35); }
  100% { transform: scaleY(1); }
}
.dj-live-field :deep(.queue-info) {
  display: flex;
  align-items: baseline;
  gap: 5px;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
}
.dj-live-field :deep(.queue-title) {
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
}
.dj-live-field :deep(.queue-sep) {
  opacity: 0.25;
  flex-shrink: 0;
}
.dj-live-field :deep(.queue-artist) {
  font-size: 0.88em;
  opacity: 0.6;
  font-variant-numeric: tabular-nums;
}
.dj-live-field :deep(.queue-type-tag) {
  flex-shrink: 0;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.06em;
  font-variant-numeric: tabular-nums;
  padding: 2px 6px;
  border-radius: 3px;
  opacity: 0.6;
  border: 1px solid rgba(255, 255, 255, 0.12);
  white-space: nowrap;
}
.dj-live-field :deep(.queue-remove) {
  flex-shrink: 0;
  border: none;
  background: none;
  padding: 0 2px;
  color: inherit;
  opacity: 0.4;
  cursor: pointer;
}
.dj-live-field :deep(.queue-remove:hover:not(:disabled)) {
  opacity: 0.9;
}
.dj-live-field :deep(.queue-remove:disabled) {
  opacity: 0.12;
  cursor: default;
}
.dj-live-field :deep(.queue-progress) {
  position: absolute;
  left: 0;
  bottom: 0;
  height: 2px;
  background: #FFD600;
  transition: width 0.2s linear;
}
/* What is on air is the one tag that has to be found at a glance, so it glows, as in the queue. */
.dj-live-field :deep(.queue-item--playing) {
  border-color: rgba(255, 214, 0, 0.7);
  background: linear-gradient(90deg, rgba(255, 214, 0, 0.18), rgba(255, 214, 0, 0.05));
  box-shadow: 0 0 0 1px rgba(255, 214, 0, 0.3), 0 0 16px rgba(255, 214, 0, 0.2);
  animation: now-playing-glow 2.4s ease-in-out infinite;
}
.dj-live-field :deep(.queue-item--playing .queue-title) {
  color: #FFD600;
}
.dj-live-field :deep(.queue-item--playing .queue-artist) {
  opacity: 0.8;
}
.dj-live-field :deep(.queue-item--playing .queue-type-tag) {
  background: #FFD600;
  color: #1a1a1a;
  border-color: #FFD600;
  opacity: 1;
}
.dj-live-field :deep(.queue-item--playing .queue-indicator) {
  border-color: rgba(255, 214, 0, 0.7);
}
@keyframes now-playing-glow {
  0%, 100% { box-shadow: 0 0 0 1px rgba(255, 214, 0, 0.3), 0 0 10px rgba(255, 214, 0, 0.12); }
  50%      { box-shadow: 0 0 0 1px rgba(255, 214, 0, 0.5), 0 0 22px rgba(255, 214, 0, 0.3); }
}
@media (prefers-reduced-motion: reduce) {
  .dj-live-field :deep(.queue-item--playing),
  .dj-live-field :deep(.queue-eq .bar),
  .dj-live-field :deep(.queue-loading) {
    animation: none;
  }
}
</style>
