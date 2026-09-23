<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { NButton, NCheckbox, NDrawer, NDrawerContent, NIcon, NProgress, NSelect, useMessage, useThemeVars } from 'naive-ui'
import { ChatbubblesOutline } from '@vicons/ionicons5'
import AivoxQueue from '@/components/AivoxQueue.vue'
import LedRed from '@/components/LedRed.vue'
import GsapButton from '@/components/GsapButton.vue'
import DjLinkEditor from '@/components/dj/DjLinkEditor.vue'
import DjSongPicker, { type DjSong } from '@/components/dj/DjSongPicker.vue'
import DjChat from '@/components/dj/DjChat.vue'
import DjBufferBar from '@/components/dj/DjBufferBar.vue'
import { useDjColors } from '@/utils/djColors'
import { useBrandsStore } from '@/stores/brands'
import { type DjChatContext } from '@/services/djApi'
import datanestApiService from '@/services/datanestApi'
import aivoxApiService, { type AivoxQueueEntry } from '@/services/aivoxApi'
import jesoosApiService from '@/services/jesoosApi'
import {
  decodeBlob, fetchSongBuffer,
  HEAD_SECONDS, MAX_VOICE_LANES, MAX_VOICE_SECONDS, TAIL_SECONDS,
} from '@/utils/djAudio'
import {
  autoCrossfade, autoDuck, bStartFor, emptyLane, encodeWav, flatCurve, LinkPreview, pairedCurve, renderLink, type EnvelopePoint, type LinkModel, type MixWindow, type VoiceLane,
} from '@/utils/djMix'

const { t } = useI18n()
const message = useMessage()
const themeVars = useThemeVars()
const djColors = useDjColors()

const props = defineProps<{ brandSlug: string }>()
const emit = defineEmits<{ close: [] }>()
const brandSlug = computed(() => props.brandSlug)

/** Follow the app theme (light/dark and the chosen accent) through Naive UI's theme variables. */
const themeStyle = computed(() => ({
  '--dj-text': themeVars.value.textColor1,
  '--dj-muted': themeVars.value.textColor3,
  '--dj-border': themeVars.value.borderColor,
  '--dj-surface': themeVars.value.actionColor,
  '--dj-accent': themeVars.value.primaryColor,
  '--dj-accent-hover': themeVars.value.primaryColorHover,
  '--dj-live': themeVars.value.successColor,
  '--dj-danger': themeVars.value.errorColor,
  '--dj-warn': themeVars.value.warningColor,
  /** The project's yellow (LedYellow, free-plan badge). */
  '--dj-fade': '#FFD600',
  '--dj-a': djColors.value.a,
  '--dj-b': djColors.value.b,
  '--dj-c': djColors.value.c,
}))

// ── Session / ON AIR ────────────────────────────────────────────────
const sessionState = ref<'starting' | 'active' | 'error'>('starting')
const startedAt = ref(0)
const now = ref(Date.now())
const ending = ref(false)
let sessionEnded = false
let clockTimer: ReturnType<typeof setInterval> | null = null
let queueTimer: ReturnType<typeof setInterval> | null = null
let keepAliveTimer: ReturnType<typeof setInterval> | null = null
/** Well inside the server's session TTL, so a working deck never lapses. */
const KEEP_ALIVE_MS = 60_000

const elapsed = computed(() => {
  const total = Math.max(0, Math.floor((now.value - startedAt.value) / 1000))
  const h = Math.floor(total / 3600)
  const mm = String(Math.floor((total % 3600) / 60)).padStart(2, '0')
  const ss = String(total % 60).padStart(2, '0')
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
})

/** jesoos drops a session this long after it last heard from the deck. */
const SESSION_TTL_MS = 15 * 60_000
/** How much warning the DJ gets before that happens. */
const SESSION_WARNING_MS = 5 * 60_000
/** When jesoos last confirmed the session; each keep-alive that lands pushes it forward. */
const lastAliveAt = ref(0)

async function startSession() {
  sessionState.value = 'starting'
  try {
    startedAt.value = (await jesoosApiService.startDjSession(brandSlug.value)).startedAt
    lastAliveAt.value = Date.now()
    sessionState.value = 'active'
  } catch {
    sessionState.value = 'error'
  }
}

/** Seconds until jesoos hands the air back, once the keep-alive has stopped landing. */
const sessionExpiresIn = computed(() => {
  if (sessionState.value !== 'active' || !lastAliveAt.value) return null
  const left = Math.round((lastAliveAt.value + SESSION_TTL_MS - now.value) / 1000)
  return left > SESSION_WARNING_MS / 1000 ? null : Math.max(0, left)
})

const queueEntries = ref<AivoxQueueEntry[]>([])
/** Wall-clock time the queued song locks in, and how much of that the system needs for itself. */
const deadlineAt = ref<number | null>(null)
const stitchBuffer = ref(0)
async function pollQueue() {
  try {
    const res = await aivoxApiService.queue(brandSlug.value)
    const all = Array.isArray(res.fullQueue) ? res.fullQueue : []
    queueEntries.value = all.filter(e => e.tech.queueType === 'prioritized' || e.tech.queueType === 'regular')
    if (res.deadline) {
      deadlineAt.value = Date.now() + res.deadline.secondsUntilLocked * 1000
      stitchBuffer.value = res.deadline.stitchBufferSeconds
    } else {
      deadlineAt.value = null
    }
  } catch {
    queueEntries.value = []
    deadlineAt.value = null
  }
}

/** Visual scale only (the backend reports a remaining time, not a fixed total). */
const DEADLINE_VISUAL_MAX_SECONDS = 90

const deadlineSeconds = computed(() => {
  if (deadlineAt.value === null) return null
  return Math.max(0, Math.round((deadlineAt.value - now.value) / 1000) - stitchBuffer.value)
})
const deadlineUrgency = computed(() => {
  if (deadlineSeconds.value === null) return 'ok'
  if (deadlineSeconds.value <= 10) return 'critical'
  if (deadlineSeconds.value <= 30) return 'warn'
  return 'ok'
})
const deadlinePct = computed(() =>
  deadlineSeconds.value === null ? 0 : Math.min(100, (deadlineSeconds.value / DEADLINE_VISUAL_MAX_SECONDS) * 100),
)
function formatCountdown(seconds: number) {
  const mm = Math.floor(seconds / 60)
  const ss = String(seconds % 60).padStart(2, '0')
  return `${mm}:${ss}`
}

async function endSession() {
  if (ending.value) return
  ending.value = true
  stopPreview()
  try {
    if (!sessionEnded && sessionState.value === 'active') {
      sessionEnded = true
      await jesoosApiService.endDjSession(brandSlug.value)
    }
  } catch {
    message.error(t('dj.end_error'))
  } finally {
    ending.value = false
  }
  emit('close')
}

// ── Songs ───────────────────────────────────────────────────────────
const songA = ref<DjSong | null>(null)
const songB = ref<DjSong | null>(null)
/** Locked once a link is sent to air: the next A is always the song that just went out. */
const aLocked = ref(false)
const aBuf = shallowRef<AudioBuffer | null>(null)
const bBuf = shallowRef<AudioBuffer | null>(null)
const loadingA = ref(false)
const loadingB = ref(false)

/** C's decoded audio, handed to A after a send so the next link starts without refetching it. */
let carriedBuffer: AudioBuffer | null = null

async function loadSong(song: DjSong | null, slot: 'a' | 'b') {
  const target = slot === 'a' ? aBuf : bBuf
  const loading = slot === 'a' ? loadingA : loadingB
  const current = () => (slot === 'a' ? songA : songB).value?.slugName
  target.value = null
  if (!song) return
  if (slot === 'a' && carriedBuffer) {
    target.value = carriedBuffer
    carriedBuffer = null
    return
  }
  loading.value = true
  try {
    const full = await fetchSongBuffer(song.slugName)
    if (current() !== song.slugName) return
    // The whole song is loaded so it can all be seen; the play / send range decides what is heard.
    target.value = full
  } catch {
    if (current() === song.slugName) message.error(t('dj.song_error'))
  } finally {
    if (current() === song.slugName) loading.value = false
  }
}
watch(songA, s => loadSong(s, 'a'))
watch(songB, s => loadSong(s, 'b'))

// ── Junction timeline ───────────────────────────────────────────────
/**
 * The B lanes: voices, recordings, generated links and effect clips. Each carries its own place on
 * the timeline, volume curve and effects. Replaced rather than mutated, so the array can stay shallow.
 */
const voices = shallowRef<VoiceLane[]>([emptyLane(1)])
let nextLaneId = 2
const filledVoices = computed(() => voices.value.filter(v => v.buf))
/** Where the earliest clip starts, or null while every lane is empty. */
const voiceStart = computed<number | null>(() =>
  filledVoices.value.length ? Math.min(...filledVoices.value.map(v => v.start)) : null,
)
const voiceEnd = computed(() => Math.max(0, ...filledVoices.value.map(v => v.start + (v.buf?.duration ?? 0))))
function patchLane(id: number, patch: Partial<VoiceLane>) {
  voices.value = voices.value.map(v => (v.id === id ? { ...v, ...patch } : v))
}
function addLane() {
  if (voices.value.length >= MAX_VOICE_LANES) return
  voices.value = [...voices.value, emptyLane(nextLaneId++)]
}
function removeLane(id: number) {
  if (recordingId.value === id) return
  stopPreview()
  // The last lane is only ever emptied, so there is always somewhere to record.
  voices.value = voices.value.length > 1 ? voices.value.filter(v => v.id !== id) : [emptyLane(nextLaneId++)]
}
/**
 * A volume curve per song, in that song's own seconds. Each is seeded flat and open the moment
 * its song loads, so there are always handles on the lane to take hold of.
 */
const duckA = ref<EnvelopePoint[]>([])
const duckB = ref<EnvelopePoint[]>([])
/** Optional: while on, the two curves are one, as they used to be. Off by default. */
const linkCurves = ref(false)

/** Where B comes in. Seeded from the default overlap, then the DJ can slide B in time. */
const bStart = ref(bStartFor(TAIL_SECONDS))
/** Where A starts. Zero until the DJ slides A along the timeline. */
const aStart = ref(0)
const aEnd = computed(() => aStart.value + (aBuf.value?.duration ?? TAIL_SECONDS))
watch(aBuf, buf => {
  aStart.value = 0
  bStart.value = bStartFor(buf?.duration ?? TAIL_SECONDS)
})
const total = computed(() => Math.max(aEnd.value, bStart.value + (bBuf.value?.duration ?? HEAD_SECONDS)))
/** B lanes whose clip is longer than the timeline has room for; the part past the end is not played or sent. */
const overhang = computed(() =>
  voices.value.flatMap((v, n) =>
    v.buf && v.start + v.buf.duration > total.value + 0.05 ? [voices.value.length > 1 ? `B${n + 1}` : 'B'] : []),
)
/**
 * What Play and Send cover. Until the DJ drags the range on the ruler it follows the junction: from
 * a little before C comes in (or the first B clip) to a little after A ends and the last clip ends.
 * The first join of a session has nothing on air to continue from, so it carries A whole.
 */
const manualRange = ref<MixWindow | null>(null)
const win = computed<MixWindow>(() => {
  const end = total.value
  const manual = manualRange.value
  if (manual) {
    const start = Math.min(Math.max(0, manual.start), Math.max(0, end - 1))
    return { start, end: Math.min(end, Math.max(manual.end, start + 1)) }
  }
  const first = Math.min(bStart.value, voiceStart.value ?? bStart.value)
  const last = Math.max(aEnd.value + 15, voiceEnd.value + 8)
  const start = lastJoinId.value === null ? aStart.value : Math.max(0, first - 10)
  return { start, end: Math.min(end, last) }
})
// A new pair of songs is a new junction, so the range starts out following it again.
watch([aBuf, bBuf], () => { manualRange.value = null })

/** The join currently on air, which the next one is stitched onto. */
const lastJoinId = ref<string | null>(null)
const lastJoinIncomingStart = ref(0)
/** Seconds aivox needs to render the stitch; a cut closer than this to the live edge is refused. */
const STITCH_MARGIN_SECONDS = 8

const brandsStore = useBrandsStore()
/** How far into the join on air aivox has already published; that part can no longer be cut. */
const committedSeconds = computed(() => {
  const state = brandsStore.bufferStates[brandSlug.value]
  if (!state) return null
  return state.buffer.committedSeconds + Math.max(0, (now.value - state.receivedAt) / 1000)
})
/** Where this link cuts into the join on air, in that file's seconds. */
const cutInPreviousJoin = computed(() =>
  lastJoinIncomingStart.value + Math.max(0, win.value.start - aStart.value))
const secondsUntilLock = computed(() => {
  const committed = committedSeconds.value
  if (lastJoinId.value === null || committed === null) return null
  return cutInPreviousJoin.value - committed - STITCH_MARGIN_SECONDS
})
const tooLate = computed(() => secondsUntilLock.value !== null && secondsUntilLock.value <= 0)
const clampStart = (duration: number, s: number) => Math.min(Math.max(0, s), Math.max(0, total.value - duration))

/** The stretch where both songs play together, in junction seconds. */
const overlap = () => ({
  from: Math.max(aStart.value, bStart.value),
  to: Math.min(aEnd.value, bStart.value + (bBuf.value?.duration ?? 0)),
})
/**
 * Pairs B's curve with A's over the overlap. `prev` is passed when a song has just slid: the
 * points C was given for the old overlap belong to that overlap, not to C, so they are dropped
 * rather than kept, or every step of a slide would leave a few more behind.
 */
function syncLinked(prev?: { aStart: number; bStart: number }) {
  const a = aBuf.value
  const b = bBuf.value
  if (!linkCurves.value || !a || !b) return
  const own = prev === undefined
    ? duckB.value
    : duckB.value.filter(p => p.time > prev.aStart + a.duration - prev.bStart + 1e-6)
  duckB.value = pairedCurve(duckA.value, aStart.value, a.duration, own, bStart.value, b.duration)
}
/** A falls and B rises across the overlap; whatever A does before it is left as it was. */
function applyCrossfade() {
  const a = aBuf.value
  if (!a || !bBuf.value) return
  const { from, to } = overlap()
  if (to - from < 0.05) return
  // A's curve is in A's own seconds, so the overlap is taken relative to where A starts.
  const fromA = from - aStart.value
  const toA = to - aStart.value
  const before = duckA.value.filter(p => p.time < fromA - 1e-6)
  duckA.value = [
    ...before,
    { time: fromA, volume: 1 },
    { time: toA, volume: 0 },
    ...(toA < a.duration - 1e-6 ? [{ time: a.duration, volume: 0 }] : []),
  ]
  syncLinked()
}
// Linking two untouched curves would leave B silent through the overlap, so start from a crossfade.
watch(linkCurves, on => {
  if (!on || !aBuf.value || !bBuf.value) return
  const { from } = overlap()
  const untouched = !duckA.value.some(p => p.volume < 0.999 && p.time >= from - aStart.value - 1e-6)
  if (untouched) applyCrossfade()
  else syncLinked()
})
// Sliding either song moves the overlap, so C is paired with A again over its new position.
watch(bStart, (_now, prev) => syncLinked({ aStart: aStart.value, bStart: prev }))
watch(aStart, (_now, prev) => syncLinked({ aStart: prev, bStart: bStart.value }))
/** Seconds in from its edge that a song's default fade handle sits: 5 s before A ends, 5 s after C begins. */
const FADE_HANDLE_SECONDS = 5
function defaultCurveA() {
  const length = aBuf.value?.duration ?? 0
  return flatCurve(length, length - FADE_HANDLE_SECONDS)
}
function defaultCurveC() {
  return flatCurve(bBuf.value?.duration ?? 0, FADE_HANDLE_SECONDS)
}
watch(aBuf, () => { duckA.value = defaultCurveA() })
watch(bBuf, () => { duckB.value = defaultCurveC() })
watch([aBuf, bBuf, aStart, bStart], () => {
  voices.value = voices.value.map(v => (v.buf ? { ...v, start: clampStart(v.buf.duration, v.start) } : v))
})

const model = computed<LinkModel | null>(() =>
  aBuf.value && bBuf.value
    ? {
        a: aBuf.value, b: bBuf.value, voices: voices.value,
        aStart: aStart.value, bStart: bStart.value,
        duckA: duckA.value, duckB: duckB.value,
      }
    : null,
)

function applyAutoDuck() {
  // Linked, the curves are a crossfade, so "auto" means the crossfade rather than a duck.
  if (linkCurves.value) return applyCrossfade()
  const a = aBuf.value
  const b = bBuf.value
  if (!a || !b) return
  if (voiceStart.value !== null) {
    // Ducks across the whole voiced stretch, from the first clip's start to the last one's end.
    const length = voiceEnd.value - voiceStart.value
    // A ends soon after the voice anyway, so it dips and stays down rather than climbing back up just to stop.
    duckA.value = autoDuck(voiceStart.value, length, aStart.value, a.duration, false)
    duckB.value = autoDuck(voiceStart.value, length, bStart.value, b.duration)
    return
  }
  // Nothing to duck under, so blend the songs across the stretch where they play together.
  const { from, to } = overlap()
  duckA.value = autoCrossfade(from, to, aStart.value, a.duration, false)
  duckB.value = autoCrossfade(from, to, bStart.value, b.duration, true)
}
function resetCurve() {
  duckA.value = defaultCurveA()
  duckB.value = defaultCurveC()
}
function onDeleteVoice(id: number) {
  if (sending.value) return
  stopPreview()
  patchLane(id, { buf: null, source: null, start: 0, duck: [] })
}

// ── Recording ───────────────────────────────────────────────────────
const editor = ref<InstanceType<typeof DjLinkEditor> | null>(null)
/** Id of the B lane the microphone is filling. */
const recordingId = ref<number | null>(null)
const recording = computed(() => recordingId.value !== null)
const recSeconds = ref(0)
let recTimer: ReturnType<typeof setInterval> | null = null

function clearRecTimer() {
  if (recTimer) { clearInterval(recTimer); recTimer = null }
}

async function toggleRec(id: number) {
  if (recordingId.value !== null) {
    if (recordingId.value === id) editor.value?.stopRec(id)
    return
  }
  stopPreview()
  recordingId.value = id
  recSeconds.value = 0
  await nextTick()
  await editor.value?.startRec(id)
  if (recordingId.value !== id) return
  recTimer = setInterval(() => {
    recSeconds.value += 1
    if (recSeconds.value >= MAX_VOICE_SECONDS) editor.value?.stopRec(id)
  }, 1000)
}

function setVoice(id: number, buf: AudioBuffer, source: 'rec' | 'ai' | 'file') {
  // Land the clip so it finishes as C comes in; the DJ can drag from there. A new clip starts with a flat curve.
  patchLane(id, { buf, source, start: clampStart(buf.duration, bStart.value - buf.duration), duck: flatCurve(buf.duration) })
}

/** The voice slot also takes a ready-made sound asset, not just a live recording. */
const fileEl = ref<HTMLInputElement | null>(null)
let fileLane = 0
function pickFile(id: number) {
  fileLane = id
  fileEl.value?.click()
}
async function onPickFile(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  stopPreview()
  try {
    setVoice(fileLane, await decodeBlob(file), 'file')
  } catch {
    message.error(t('dj.file_error'))
  }
}

/** Effects come from the station's sound assets (the Sound Assets page), loaded like any fragment. */
const effectOptions = ref<{ label: string; value: string }[]>([])
const effectsLoading = ref(false)
let effectSeq = 0

async function searchEffects(term = '') {
  const seq = ++effectSeq
  effectsLoading.value = true
  try {
    const res = await datanestApiService.getSoundAssets(1, 30, term.trim())
    if (seq !== effectSeq) return
    effectOptions.value = res.entries.map((e: any) => ({ label: e.title || e.slugName, value: e.slugName }))
  } catch {
    if (seq === effectSeq) effectOptions.value = []
  } finally {
    if (seq === effectSeq) effectsLoading.value = false
  }
}

async function onPickEffect(slug: string | null, id: number) {
  if (!slug) return
  stopPreview()
  effectsLoading.value = true
  try {
    setVoice(id, await fetchSongBuffer(slug), 'file')
  } catch {
    message.error(t('dj.file_error'))
  } finally {
    effectsLoading.value = false
  }
}

// ── Chat ────────────────────────────────────────────────────────────
const chatOpen = ref(false)
const chatContext = computed<DjChatContext>(() => ({
  songA: songA.value ? { id: songA.value.id, title: songA.value.title, artist: songA.value.artist } : null,
  songB: songB.value ? { id: songB.value.id, title: songB.value.title, artist: songB.value.artist } : null,
  maxVoiceSeconds: MAX_VOICE_SECONDS,
}))
function onVoiceGenerated(buf: AudioBuffer, _script: string) {
  void _script
  stopPreview()
  // A generated link goes to the first empty B lane, or replaces B1 when they are all taken.
  setVoice((voices.value.find(v => !v.buf) ?? voices.value[0]).id, buf, 'ai')
}

async function onRecordEnd(blob: Blob, id: number) {
  clearRecTimer()
  recordingId.value = null
  try {
    const buf = await decodeBlob(blob)
    if (buf.duration < 0.3) return
    setVoice(id, buf, 'rec')
  } catch {
    message.error(t('dj.mic_error'))
  }
}

function onRecordError() {
  clearRecTimer()
  recordingId.value = null
  message.error(t('dj.mic_error'))
}

// ── Preview ─────────────────────────────────────────────────────────
const preview = new LinkPreview()
const previewing = ref(false)
/** The edit cursor. Always on screen, so the DJ can place it before pressing play. */
const playhead = ref(0)
const clampHead = (t: number) => Math.min(Math.max(t, win.value.start), win.value.end)
/** How long before the join the cursor parks by default, so Play starts right at the link, not at the range's edge. */
const PLAY_LEAD_SECONDS = 3
const joinCue = () => clampHead(bStart.value - PLAY_LEAD_SECONDS)
/** Once the DJ has placed the cursor themselves, Play resumes from there instead of jumping back to the join. */
const cursorPlaced = ref(false)

function stopPreview() {
  preview.stop()
  previewing.value = false
}

function togglePreview() {
  if (previewing.value) return stopPreview()
  if (!model.value) return
  // Parked at the end, play again from the join rather than not at all.
  const from = !cursorPlaced.value || playhead.value >= win.value.end - 0.05 ? joinCue() : playhead.value
  playhead.value = from
  previewing.value = true
  preview.play(model.value, win.value, tm => { playhead.value = tm }, stopPreview, from)
}

/** Scrubbing: the cursor follows the pointer, and audio re-joins only once the drag ends. */
function onScrubStart() {
  cursorPlaced.value = true
  if (previewing.value) preview.suspend()
}
function onScrub(t: number) {
  playhead.value = clampHead(t)
}
function onScrubEnd() {
  if (previewing.value) preview.seek(playhead.value)
}

// Edits are heard as they are made; only losing the model (a song removed) ends the audition.
watch([voices, duckA, duckB, aBuf, bBuf, aStart, bStart, win], () => {
  if (!previewing.value) return
  if (model.value) preview.refresh(model.value, win.value)
  else stopPreview()
})
// A new pair of songs is a new join; park the cursor there again until the DJ moves it themselves.
watch([aBuf, bBuf], () => {
  cursorPlaced.value = false
  playhead.value = joinCue()
})

// ── Send to air ─────────────────────────────────────────────────────
const sending = ref(false)
/** Percent of the rendered join uploaded so far; the file is large enough to be worth watching. */
const uploadProgress = ref(0)

async function sendToAir() {
  const m = model.value
  const a = songA.value
  const b = songB.value
  if (!m || !filledVoices.value.length || !a || !b || sending.value) return
  if (tooLate.value) {
    message.error(t('dj.too_late'))
    return
  }
  stopPreview()
  sending.value = true
  try {
    const rendered = await renderLink(m, win.value)
    const joinId = crypto.randomUUID()
    uploadProgress.value = 1
    await jesoosApiService.sendDjJoin(brandSlug.value, {
      blob: encodeWav(rendered),
      joinId,
      continuesJoinId: lastJoinId.value,
      durationSeconds: Math.round(rendered.duration * 100) / 100,
      incomingSongStartSeconds: Math.max(0, bStart.value - win.value.start),
      outgoingSongFromSeconds: Math.max(0, win.value.start - aStart.value),
      songASlug: a.slugName,
      songBSlug: b.slugName,
    }, percent => { uploadProgress.value = percent })
    message.success(t('dj.sent'))
    lastJoinId.value = joinId
    lastJoinIncomingStart.value = Math.max(0, bStart.value - win.value.start)
    // The station will play a → b next, so the next link continues from b, with its audio already decoded.
    carriedBuffer = bBuf.value
    songA.value = b
    songB.value = null
    aLocked.value = true
    voices.value = [emptyLane(nextLaneId++)]
  } catch {
    message.error(t('dj.send_error'))
    // The cut can no longer be made, so A has to be picked again from whatever is on air.
    lastJoinId.value = null
    aLocked.value = false
  } finally {
    sending.value = false
    uploadProgress.value = 0
  }
}

const ready = computed(() => sessionState.value === 'active')
// Recording needs a live session, not songs: a voice can be captured first and placed later.
const canRecord = computed(() => ready.value && !sending.value)
const canPreview = computed(() => ready.value && !!model.value && !recording.value && !sending.value)
const canSend = computed(() => canPreview.value && !ending.value && !tooLate.value)

const songLabel = (s: DjSong | null) => (s ? [s.artist, s.title].filter(Boolean).join(' — ') : '')

onMounted(async () => {
  clockTimer = setInterval(() => { now.value = Date.now() }, 1000)
  void pollQueue()
  queueTimer = setInterval(pollQueue, 10000)
  await startSession()
  // The session lapses on the server without this, so a closed laptop hands the air back.
  keepAliveTimer = setInterval(() => {
    if (sessionState.value !== 'active') return
    jesoosApiService.startDjSession(brandSlug.value)
        .then(() => { lastAliveAt.value = Date.now() })
        .catch(() => { /* the banner counts down; the next tick may still land */ })
  }, KEEP_ALIVE_MS)
})

onBeforeUnmount(() => {
  if (clockTimer) clearInterval(clockTimer)
  if (queueTimer) clearInterval(queueTimer)
  if (keepAliveTimer) clearInterval(keepAliveTimer)
  clearRecTimer()
  preview.stop()
  if (!sessionEnded && sessionState.value === 'active') {
    sessionEnded = true
    void jesoosApiService.endDjSession(brandSlug.value).catch(() => {})
  }
})
</script>

<template>
  <div class="dj-panel" :style="themeStyle">
    <header class="dj-topbar">
      <div class="dj-timer">
        <small>{{ t('dj.session') }}</small>
        <span>{{ ready ? elapsed : '--:--' }}</span>
      </div>
      <GsapButton @click="chatOpen = true">
        <NIcon :component="ChatbubblesOutline" />
        <span>{{ t('dj.chat_open') }}</span>
      </GsapButton>
      <GsapButton type="error" :loading="ending" :disabled="sessionState === 'starting'" @click="endSession">
        <span>{{ t('dj.end_session') }}</span>
      </GsapButton>
    </header>

    <NDrawer v-model:show="chatOpen" placement="right" :width="360">
      <NDrawerContent :title="t('dj.chat_title')" closable>
        <DjChat :brand-slug="brandSlug" :context="chatContext" @voice-generated="onVoiceGenerated" />
      </NDrawerContent>
    </NDrawer>

    <p v-if="sessionState === 'starting'" class="dj-banner">{{ t('dj.starting') }}</p>
    <p v-else-if="sessionState === 'error'" class="dj-banner dj-banner--error">
      {{ t('dj.session_error') }}
      <NButton size="small" @click="startSession">{{ t('dj.retry') }}</NButton>
    </p>

    <div v-if="deadlineSeconds !== null" class="dj-deadline" :class="`dj-deadline--${deadlineUrgency}`">
      <div class="dj-deadline-bar"><div class="dj-deadline-fill" :style="{ width: deadlinePct + '%' }" /></div>
      <span class="dj-deadline-text">
        {{ deadlineSeconds > 0 ? t('dj.deadline_label', { time: formatCountdown(deadlineSeconds) }) : t('dj.deadline_locked') }}
      </span>
    </div>

    <DjBufferBar :brand-slug="brandSlug" />

    <p v-if="tooLate" class="dj-banner dj-banner--error">{{ t('dj.too_late') }}</p>

    <p v-if="sessionExpiresIn !== null" class="dj-banner dj-banner--error">
      {{ sessionExpiresIn > 0
        ? t('dj.session_expiring', { time: formatCountdown(sessionExpiresIn) })
        : t('dj.session_expired') }}
    </p>

    <section class="dj-section">
      <h3 class="dj-section-title">{{ t('dj.songs') }}</h3>
      <div class="dj-pickers">
        <DjSongPicker v-model="songA" class="dj-asset-field dj-asset-field--a" label="A" :placeholder="t('dj.pick_a')" :brand-slug="brandSlug" :exclude-slug="songB?.slugName" :loading="loadingA" :disabled="aLocked && !tooLate" />
        <div v-for="(v, n) in voices" :key="v.id" class="dj-asset-row">
          <span class="dj-asset-slot">{{ voices.length > 1 ? `B${n + 1}` : 'B' }}</span>
          <NButton size="small" :disabled="!canRecord || (recording && recordingId !== v.id)" @click="toggleRec(v.id)">
            <LedRed class="dj-rec-led" :active="recordingId === v.id" />
            {{ recordingId === v.id ? `${t('dj.rec_stop')} ${recSeconds}s / ${MAX_VOICE_SECONDS}s` : t('dj.rec') }}
          </NButton>
          <NButton size="small" :disabled="recording || sending" @click="pickFile(v.id)">
            {{ t('dj.add_effect') }}
          </NButton>
          <NSelect
            class="dj-effect-select"
            size="small"
            :value="null"
            :options="effectOptions"
            :loading="effectsLoading"
            :disabled="recording || sending"
            :placeholder="t('dj.pick_effect')"
            filterable
            remote
            clearable
            @focus="searchEffects()"
            @search="searchEffects"
            @update:value="onPickEffect($event, v.id)"
          />
          <NButton v-if="voices.length > 1" size="small" quaternary :disabled="recordingId === v.id" :title="t('dj.remove_lane')" :aria-label="t('dj.remove_lane')" @click="removeLane(v.id)">✕</NButton>
        </div>
        <NButton v-if="voices.length < MAX_VOICE_LANES" class="dj-add-lane" size="small" dashed :disabled="recording || sending" @click="addLane">
          {{ t('dj.add_lane') }}
        </NButton>
        <input ref="fileEl" class="dj-file-input" type="file" accept="audio/*" @change="onPickFile">
        <DjSongPicker v-model="songB" class="dj-asset-field dj-asset-field--c" label="C" :placeholder="t('dj.pick_b')" :brand-slug="brandSlug" :exclude-slug="songA?.slugName" :loading="loadingB" />
      </div>
    </section>

    <section class="dj-section">
      <h3 class="dj-section-title">{{ t('dj.link_editor') }}</h3>
      <DjLinkEditor
        ref="editor"
        v-model:voices="voices"
        v-model:duck-a="duckA"
        v-model:duck-b="duckB"
        v-model:a-start="aStart"
        v-model:b-start="bStart"
        :a="aBuf"
        :b="bBuf"
        :total="total"
        :window="win"
        :playhead="playhead"
        :recording-id="recordingId"
        :title-a="songLabel(songA)"
        :title-b="songLabel(songB)"
        :info-a="songA"
        :info-b="songB"
        :linked="linkCurves"
        @record-end="onRecordEnd"
        @record-error="onRecordError"
        @update:window="manualRange = $event"
        @scrub-start="onScrubStart"
        @scrub="onScrub"
        @scrub-end="onScrubEnd"
        @delete-voice="onDeleteVoice"
      />
      <p v-if="overhang.length" class="dj-overhang">{{ t('dj.overhang', { lanes: overhang.join(', ') }) }}</p>
      <div class="dj-curve-tools">
        <NButton size="small" :disabled="!aBuf || !bBuf || recording" @click="applyAutoDuck">{{ t('dj.auto_duck') }}</NButton>
        <NCheckbox v-model:checked="linkCurves" size="small">{{ t('dj.link_curves') }}</NCheckbox>
        <NButton size="small" :disabled="!aBuf && !bBuf" @click="resetCurve">{{ t('dj.reset_curve') }}</NButton>
        <NButton size="small" :disabled="!manualRange" @click="manualRange = null">{{ t('dj.auto_range') }}</NButton>
        <span>{{ t('dj.fade_hint') }}</span>
      </div>
      <div class="dj-controls">
        <NButton size="large" type="primary" secondary :disabled="!canPreview" @click="togglePreview">
          <span class="dj-preview-icon" :class="{ 'dj-preview-icon--stop': previewing }">{{ previewing ? '■' : '▶' }}</span>
          {{ previewing ? t('dj.preview_stop') : t('dj.preview') }}
        </NButton>
        <div class="dj-send">
          <NButton type="primary" size="large" :loading="sending" :disabled="!canSend" @click="sendToAir">
            {{ t('dj.send') }}
          </NButton>
          <NProgress
            v-if="sending"
            type="line"
            :percentage="uploadProgress"
            :show-indicator="false"
            :height="2"
            :border-radius="1"
            :fill-border-radius="1"
            color="#eff605"
            rail-color="rgba(255,255,255,0.12)"
          />
        </div>
      </div>
    </section>

    <section class="dj-section">
      <h3 class="dj-section-title">{{ t('dj.coming_up') }}</h3>
      <AivoxQueue v-if="queueEntries.length" :entries="queueEntries" />
      <p v-else class="dj-empty">{{ t('dj.queue_empty') }}</p>
    </section>
  </div>
</template>

<style scoped>
.dj-panel {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--dj-border);
  color: var(--dj-text);
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.dj-topbar {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 24px;
  flex-wrap: wrap;
}
.dj-timer {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  line-height: 1.1;
}
.dj-timer small {
  font-size: 0.65rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--dj-muted);
}
.dj-timer span {
  font-size: 1.6rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.dj-banner {
  margin: 0;
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 0.85rem;
  background: color-mix(in srgb, var(--dj-accent) 12%, transparent);
  display: flex;
  align-items: center;
  gap: 12px;
}
.dj-banner--error {
  background: color-mix(in srgb, var(--dj-danger) 12%, transparent);
}
.dj-deadline {
  display: flex;
  align-items: center;
  gap: 12px;
}
.dj-send {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.dj-deadline-bar {
  flex: 1;
  height: 4px;
  border-radius: 2px;
  background: var(--dj-border);
  overflow: hidden;
}
.dj-deadline-fill {
  height: 100%;
  border-radius: 2px;
  background: var(--dj-live);
  transition: width 1s linear;
}
.dj-deadline--warn .dj-deadline-fill {
  background: var(--dj-warn);
}
.dj-deadline--critical .dj-deadline-fill {
  background: var(--dj-danger);
}
.dj-deadline-text {
  flex: none;
  font-size: 0.75rem;
  font-variant-numeric: tabular-nums;
  color: var(--dj-muted);
}
.dj-deadline--warn .dj-deadline-text {
  color: var(--dj-warn);
}
.dj-deadline--critical .dj-deadline-text {
  color: var(--dj-danger);
  font-weight: 700;
}
.dj-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.dj-section-title {
  margin: 0;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--dj-muted);
  text-transform: uppercase;
}
.dj-pickers {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.dj-asset-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  min-width: 0;
}
.dj-overhang {
  margin: 0;
  font-size: 0.8rem;
  color: var(--dj-warn);
}
.dj-add-lane {
  align-self: flex-start;
}
/** Each asset keeps its own colour on the chip beside its field. */
.dj-asset-field--a {
  --dj-slot: var(--dj-a);
}
.dj-asset-field--c {
  --dj-slot: var(--dj-c);
}
/** The song fields take half the width; a full-width select was far more than a title needs. */
.dj-asset-field {
  width: 50%;
}
/** Matches the slot chip on the song pickers above and below it. */
.dj-asset-slot {
  flex: none;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 0.85rem;
  background: var(--dj-b);
  color: #1a1a1a;
}
.dj-effect-select {
  width: 180px;
}
.dj-file-input {
  display: none;
}
.dj-curve-tools {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  font-size: 0.75rem;
  color: var(--dj-muted);
}
.dj-controls {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}
.dj-preview-icon {
  margin-right: 8px;
  font-size: 0.8em;
}
/** While playing the button stops the audio, so its square reads as a red stop mark, a little larger. */
.dj-preview-icon--stop {
  color: var(--dj-danger);
  font-size: 1.05em;
}
.dj-rec-led {
  margin-right: 6px;
  vertical-align: -3px;
}
.dj-empty {
  margin: 0;
  font-size: 0.85rem;
  color: var(--dj-muted);
}
@media (max-width: 768px) {
  .dj-asset-field {
    width: 100%;
  }
}
</style>
