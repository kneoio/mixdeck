<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import WaveSurfer from 'wavesurfer.js'
import TimelinePlugin from 'wavesurfer.js/plugins/timeline'
import { MAX_GAP_SECONDS, peaksOf } from '@/utils/djAudio'
import { pairedCurve, type EnvelopePoint, type MixWindow, type VoiceLane } from '@/utils/djMix'
import { NSlider } from 'naive-ui'
import { useDjColors } from '@/utils/djColors'
import DjVoiceTrack from '@/components/dj/DjVoiceTrack.vue'

const LANE_H = 96
const WAVE_H = 84

const props = defineProps<{
  a: AudioBuffer | null
  b: AudioBuffer | null
  /** The B lanes, top to bottom. Each has its own clip, curve and effects. */
  voices: VoiceLane[]
  aStart: number
  bStart: number
  total: number
  /** A volume curve per song, in that song's own seconds, edited by the DJ. */
  duckA: EnvelopePoint[]
  duckB: EnvelopePoint[]
  window: MixWindow
  playhead: number
  /** Id of the B lane the microphone is filling, if any. */
  recordingId: number | null
  titleA?: string
  titleB?: string
  /** Deck parameters shown beside each song, when the library knows them. */
  infoA?: { bpm?: number; key?: string } | null
  infoB?: { bpm?: number; key?: string } | null
  /** When on, the two curves are a crossfade: one song falls as the other rises. */
  linked?: boolean
}>()
const emit = defineEmits<{
  'update:voices': [voices: VoiceLane[]]
  'update:duckA': [duck: EnvelopePoint[]]
  'update:duckB': [duck: EnvelopePoint[]]
  'update:aStart': [seconds: number]
  'update:bStart': [seconds: number]
  'update:window': [range: MixWindow]
  'record-end': [blob: Blob, id: number]
  'record-error': [error: unknown]
  'scrub-start': []
  scrub: [seconds: number]
  'scrub-end': []
  'delete-voice': [id: number]
}>()
const { t } = useI18n()
const djColors = useDjColors()

type EffectKey = 'reverb' | 'echo' | 'radio' | 'distortion'
/** The effects on a B lane, in the order their sliders stand. */
const effectsOf = (v: VoiceLane) => [
  { key: 'reverb' as const, label: t('dj.reverb'), pct: Math.round(v.reverb * 100) },
  { key: 'echo' as const, label: t('dj.echo'), pct: Math.round(v.echo * 100) },
  { key: 'radio' as const, label: t('dj.radio'), pct: Math.round(v.radio * 100) },
  { key: 'distortion' as const, label: t('dj.distortion'), pct: Math.round(v.distortion * 100) },
]
function patchVoice(id: number, patch: Partial<VoiceLane>) {
  emit('update:voices', props.voices.map(v => (v.id === id ? { ...v, ...patch } : v)))
}
const setEffect = (id: number, key: EffectKey, pct: number) => patchVoice(id, { [key]: pct / 100 })

const viewportEl = ref<HTMLElement | null>(null)
const areaEl = ref<HTMLElement | null>(null)
const timelineEl = ref<HTMLElement | null>(null)
const rulerEl = ref<HTMLElement | null>(null)
const aEl = ref<HTMLElement | null>(null)
const bEl = ref<HTMLElement | null>(null)
const viewWidth = ref(0)

/**
 * Scale: at 100% the view holds BASE_VIEW_SECONDS of the timeline, so a junction fills the screen.
 * Below that more of the songs comes into view (down to 10%, room for two whole songs), and above
 * it the view closes in on the detail. The timeline scrolls whenever it is wider than the view.
 */
const BASE_VIEW_SECONDS = 80
const MIN_ZOOM = 0.1
const MAX_ZOOM = 8
const ZOOM_STEP = 1.5
const zoom = ref(1)
const pps = computed(() => (viewWidth.value > 0 ? (viewWidth.value / BASE_VIEW_SECONDS) * zoom.value : 0))
const areaWidth = computed(() => Math.max(1, props.total * pps.value))
async function zoomTo(next: number, anchorClientX?: number) {
  const vp = viewportEl.value
  const z = clamp(next, MIN_ZOOM, MAX_ZOOM)
  if (!vp || z === zoom.value) return
  // Keeps whatever sits under the pointer (or the middle of the view) where it is on screen.
  const focus = anchorClientX !== undefined ? anchorClientX - vp.getBoundingClientRect().left : vp.clientWidth / 2
  const fraction = (vp.scrollLeft + focus) / vp.scrollWidth
  zoom.value = z
  await nextTick()
  vp.scrollLeft = fraction * vp.scrollWidth - focus
}
function onWheel(e: WheelEvent) {
  void zoomTo(zoom.value * (e.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP), e.clientX)
}
// Whole songs are long, so once both are in, bring the junction into view.
watch([() => props.a, () => props.b], async ([a, b]) => {
  if (!a || !b) return
  await nextTick()
  if (viewportEl.value) viewportEl.value.scrollLeft = Math.max(0, (props.bStart - 25) * pps.value)
})

const px = (seconds: number) => `${seconds * pps.value}px`
const trackStyle = (start: number, duration: number) => ({ left: px(start), width: px(duration) })
const aStyle = computed(() => trackStyle(props.aStart, props.a?.duration ?? 0))
const bStyle = computed(() => trackStyle(props.bStart, props.b?.duration ?? 0))
const voiceStyle = (v: VoiceLane) =>
  props.recordingId === v.id ? { left: '0px', width: '100%' } : trackStyle(v.start, v.buf?.duration ?? 0)
const voiceDuration = (v: VoiceLane) => v.buf?.duration ?? 0

const yOf = (volume: number) => 4 + (1 - volume) * (LANE_H - 8)
const MIN_GAP = 0.05
const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi)

/**
 * Every clip owns its curve and each curve is in its clip's own seconds, so a curve travels with
 * its clip when it slides. `a` and `b` are the two songs; a number is the id of a B lane.
 */
type Lane = 'a' | 'b' | number
const voiceOf = (id: number) => props.voices.find(v => v.id === id)
const laneStart = (lane: Lane) => (lane === 'a' ? props.aStart : lane === 'b' ? props.bStart : voiceOf(lane)?.start ?? 0)
const laneDuration = (lane: Lane) =>
  lane === 'a' ? props.a?.duration ?? 0 : lane === 'b' ? props.b?.duration ?? 0 : voiceDuration(voiceOf(lane) ?? ({} as VoiceLane))
const laneCurve = (lane: Lane): EnvelopePoint[] =>
  lane === 'a' ? props.duckA : lane === 'b' ? props.duckB : voiceOf(lane)?.duck ?? []
function putCurve(lane: Lane, pts: EnvelopePoint[]) {
  if (typeof lane === 'number') return patchVoice(lane, { duck: pts })
  if (lane === 'a') emit('update:duckA', pts)
  else emit('update:duckB', pts)
  if (!props.linked) return
  const other: 'a' | 'b' = lane === 'a' ? 'b' : 'a'
  const carried = pairedCurve(
    pts, laneStart(lane), laneDuration(lane),
    laneCurve(other), laneStart(other), laneDuration(other),
  )
  if (other === 'a') emit('update:duckA', carried)
  else emit('update:duckB', carried)
}

function envelopeLine(lane: Lane): string {
  const s = laneStart(lane)
  return laneCurve(lane).map(p => `${(s + p.time) * pps.value},${yOf(p.volume)}`).join(' ')
}
const handlesOf = (lane: Lane) => laneCurve(lane).map((p, i) => ({ p, i }))

/**
 * Pointer events fire faster than the screen refreshes, so a drag coalesces into one
 * update per frame. The lane box is measured once on pointerdown: reading it per move
 * forces a layout on every event.
 */
const dragging = ref(false)

/** Keeps a drag alive once the pointer leaves the element, but never worth failing the drag over. */
function capture(e: PointerEvent) {
  try {
    ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
  } catch { /* pointer already gone; the drag still tracks through document events */ }
}

let handleDrag: { lane: Lane; i: number; rect: DOMRect; next: EnvelopePoint | null; raf: number } | null = null

function onHandleDown(e: PointerEvent, lane: Lane, i: number) {
  const svg = (e.currentTarget as SVGElement).ownerSVGElement
  if (!svg || pps.value <= 0) return
  handleDrag = { lane, i, rect: svg.getBoundingClientRect(), next: null, raf: 0 }
  dragging.value = true
  capture(e)
}
function onHandleMove(e: PointerEvent) {
  if (!handleDrag) return
  const { lane, i, rect } = handleDrag
  const pts = laneCurve(lane)
  // Held inside its own clip and between its neighbours, so it can never be dragged out of sight.
  const min = i > 0 ? pts[i - 1].time + MIN_GAP : 0
  const max = i < pts.length - 1 ? pts[i + 1].time - MIN_GAP : laneDuration(lane)
  const local = (e.clientX - rect.left) / pps.value - laneStart(lane)
  handleDrag.next = {
    time: clamp(local, Math.max(0, min), Math.max(Math.max(0, min), Math.min(max, laneDuration(lane)))),
    volume: clamp(1 - (e.clientY - rect.top - 4) / (LANE_H - 8), 0, 1),
  }
  if (!handleDrag.raf) handleDrag.raf = requestAnimationFrame(flushHandle)
}
function flushHandle() {
  if (!handleDrag) return
  handleDrag.raf = 0
  const { lane, i, next } = handleDrag
  if (!next) return
  handleDrag.next = null
  putCurve(lane, laneCurve(lane).map((p, j) => (j === i ? next : p)))
}
function onHandleUp() {
  if (!handleDrag) return
  if (handleDrag.raf) cancelAnimationFrame(handleDrag.raf)
  flushHandle()
  handleDrag = null
  dragging.value = false
}

/**
 * Press anywhere on a curve to drop a point there and shape it in the same gesture, the way
 * any automation lane behaves. Taking it on pointerdown rather than click also keeps it working
 * on the song lane that slides, where a plain click is swallowed by the pointer capture.
 */
function onLineDown(e: PointerEvent, lane: Lane) {
  const svg = (e.currentTarget as SVGElement).ownerSVGElement
  if (!svg || pps.value <= 0) return
  const rect = svg.getBoundingClientRect()
  const time = clamp((e.clientX - rect.left) / pps.value - laneStart(lane), 0, laneDuration(lane))
  const volume = clamp(1 - (e.clientY - rect.top - 4) / (LANE_H - 8), 0, 1)
  const pts = [...laneCurve(lane)]

  // Landing on top of a point means grabbing that one, not stacking another onto it.
  let i = pts.findIndex(p => Math.abs(p.time - time) < MIN_GAP)
  if (i < 0) {
    i = pts.findIndex(p => p.time > time)
    if (i < 0) i = pts.length
    pts.splice(i, 0, { time, volume })
    putCurve(lane, pts)
  }

  handleDrag = { lane, i, rect, next: null, raf: 0 }
  dragging.value = true
  capture(e)
}
/** The two end anchors stay, so a curve can never be emptied down to nothing to grab. */
function removePoint(lane: Lane, i: number) {
  const pts = laneCurve(lane)
  if (pts.length <= 2) return
  putCurve(lane, pts.filter((_, j) => j !== i))
}

let rulerWs: WaveSurfer | null = null
let aWs: WaveSurfer | null = null
let bWs: WaveSurfer | null = null
let observer: ResizeObserver | null = null

const laneOptions = {
  height: WAVE_H,
  cursorWidth: 0,
  interact: false,
  hideScrollbar: true,
  normalize: true,
  barWidth: 2,
  barGap: 1,
  barRadius: 1,
}

function show(ws: WaveSurfer | null, buf: AudioBuffer | null): Promise<void> | void {
  if (!ws) return
  if (!buf) return ws.empty()
  return ws.load('', [peaksOf(buf)], buf.duration)
}

function syncRuler() {
  void rulerWs?.load('', [new Float32Array([0, 0])], Math.max(1, props.total))
}

/** Labels are spaced to stay readable at any scale: the smallest step that leaves them ~70px apart. */
const RULER_STEPS = [5, 10, 15, 30, 60, 120, 300]
const rulerStep = computed(() => RULER_STEPS.find(step => step * pps.value >= 70) ?? 300)
const formatTick = (seconds: number) =>
  seconds < 60 ? `${Math.round(seconds)}s` : `${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, '0')}`
function buildRuler() {
  rulerWs?.destroy()
  const step = rulerStep.value
  rulerWs = WaveSurfer.create({
    container: rulerEl.value!,
    height: 1,
    waveColor: 'transparent',
    progressColor: 'transparent',
    cursorWidth: 0,
    interact: false,
    hideScrollbar: true,
    plugins: [TimelinePlugin.create({
      container: timelineEl.value!,
      timeInterval: step,
      primaryLabelInterval: step * 2,
      secondaryLabelInterval: step,
      formatTimeCallback: formatTick,
    })],
  })
  syncRuler()
}
watch(rulerStep, buildRuler)

onMounted(() => {
  observer = new ResizeObserver(([entry]) => { viewWidth.value = entry.contentRect.width })
  observer.observe(viewportEl.value!)
  viewWidth.value = viewportEl.value!.clientWidth

  buildRuler()
  aWs = WaveSurfer.create({ ...laneOptions, container: aEl.value!, waveColor: djColors.value.a, progressColor: djColors.value.a })
  bWs = WaveSurfer.create({ ...laneOptions, container: bEl.value!, waveColor: djColors.value.c, progressColor: djColors.value.c })

  void show(aWs, props.a)
  void show(bWs, props.b)
})

onBeforeUnmount(() => {
  observer?.disconnect()
  for (const ws of [rulerWs, aWs, bWs]) ws?.destroy()
})

watch(djColors, ({ a, c }) => {
  aWs?.setOptions({ waveColor: a, progressColor: a })
  bWs?.setOptions({ waveColor: c, progressColor: c })
})
watch(() => props.total, syncRuler)
watch(() => props.a, buf => show(aWs, buf))
watch(() => props.b, buf => show(bWs, buf))

/** Each B lane's waveform and microphone live in its own track component. */
const tracks = new Map<number, InstanceType<typeof DjVoiceTrack>>()
function setTrack(id: number, el: unknown) {
  if (el) tracks.set(id, el as InstanceType<typeof DjVoiceTrack>)
  else tracks.delete(id)
}
const startRec = (id: number) => tracks.get(id)?.startRec()
const stopRec = (id: number) => tracks.get(id)?.stopRec()
defineExpose({ startRec, stopRec })

// Dragging a B clip in time against both songs
let drag: { id: number; x: number; start: number; next: number | null; raf: number } | null = null
const clampStart = (v: VoiceLane, s: number) => clamp(s, 0, Math.max(0, props.total - voiceDuration(v)))

function onDragStart(e: PointerEvent, v: VoiceLane) {
  if (!v.buf || props.recordingId !== null || pps.value <= 0) return
  drag = { id: v.id, x: e.clientX, start: v.start, next: null, raf: 0 }
  dragging.value = true
  capture(e)
}
function onDragMove(e: PointerEvent, v: VoiceLane) {
  if (!drag || drag.id !== v.id) return
  drag.next = clampStart(v, drag.start + (e.clientX - drag.x) / pps.value)
  if (!drag.raf) drag.raf = requestAnimationFrame(flushDrag)
}
function flushDrag() {
  if (!drag) return
  drag.raf = 0
  if (drag.next === null) return
  patchVoice(drag.id, { start: drag.next })
  drag.next = null
}
function onDragEnd() {
  if (!drag) return
  if (drag.raf) cancelAnimationFrame(drag.raf)
  flushDrag()
  drag = null
  dragging.value = false
}
/**
 * Sliding C along the timeline to set how far it overlaps A, or how much room it leaves after A. Movement has to clear a few pixels
 * first, so pressing on the lane still adds a duck point instead of nudging the song.
 */
let songDrag: { which: 'a' | 'b'; x: number; grab: number; left: number; live: boolean; next: number | null; raf: number } | null = null

function onSongDown(e: PointerEvent, which: 'a' | 'b') {
  const area = areaEl.value
  if (!props.b || !props.a || !area || pps.value <= 0) return
  const left = area.getBoundingClientRect().left
  const start = which === 'a' ? props.aStart : props.bStart
  // `grab` is where on the song's leading edge the pointer took hold, so the edge stays under it.
  songDrag = { which, x: e.clientX, grab: e.clientX - (left + start * pps.value), left, live: false, next: null, raf: 0 }
  capture(e)
}
function onSongMove(e: PointerEvent) {
  if (!songDrag) return
  if (!songDrag.live) {
    if (Math.abs(e.clientX - songDrag.x) < 3) return
    songDrag.live = true
    dragging.value = true
  }
  const at = (e.clientX - songDrag.grab - songDrag.left) / pps.value
  songDrag.next = songDrag.which === 'a'
    // A can start anywhere up to where C ends; C can go up to a gap past the end of A.
    ? clamp(at, 0, props.bStart + (props.b?.duration ?? 0))
    : clamp(at, 0, props.aStart + (props.a?.duration ?? 0) + MAX_GAP_SECONDS)
  if (!songDrag.raf) songDrag.raf = requestAnimationFrame(flushSong)
}
function flushSong() {
  if (!songDrag) return
  songDrag.raf = 0
  if (songDrag.next === null) return
  if (songDrag.which === 'a') emit('update:aStart', songDrag.next)
  else emit('update:bStart', songDrag.next)
  songDrag.next = null
}
function onSongUp() {
  if (!songDrag) return
  if (songDrag.raf) cancelAnimationFrame(songDrag.raf)
  flushSong()
  songDrag = null
  dragging.value = false
}

// Scrubbing the playhead, on its own handle or by pressing anywhere on the ruler
let scrub: { rect: DOMRect; next: number | null; raf: number } | null = null

function seekFrom(clientX: number, rect: DOMRect) {
  return clamp((clientX - rect.left) / pps.value, props.window.start, props.window.end)
}
function onScrubDown(e: PointerEvent) {
  const area = areaEl.value
  if (!area || pps.value <= 0) return
  e.preventDefault()
  scrub = { rect: area.getBoundingClientRect(), next: null, raf: 0 }
  dragging.value = true
  emit('scrub-start')
  emit('scrub', seekFrom(e.clientX, scrub.rect))
  capture(e)
}
function onScrubMove(e: PointerEvent) {
  if (!scrub) return
  scrub.next = seekFrom(e.clientX, scrub.rect)
  if (!scrub.raf) scrub.raf = requestAnimationFrame(flushScrub)
}
function flushScrub() {
  if (!scrub) return
  scrub.raf = 0
  if (scrub.next === null) return
  emit('scrub', scrub.next)
  scrub.next = null
}
function onScrubUp() {
  if (!scrub) return
  if (scrub.raf) cancelAnimationFrame(scrub.raf)
  flushScrub()
  scrub = null
  dragging.value = false
  emit('scrub-end')
}

// The play / send range: the two grips on the ruler set which part of the timeline is heard and sent.
const MIN_RANGE = 1
let rangeDrag: { edge: 'start' | 'end'; left: number } | null = null
function onRangeDown(e: PointerEvent, edge: 'start' | 'end') {
  const area = areaEl.value
  if (!area || pps.value <= 0) return
  e.preventDefault()
  rangeDrag = { edge, left: area.getBoundingClientRect().left }
  dragging.value = true
  capture(e)
}
function onRangeMove(e: PointerEvent) {
  if (!rangeDrag) return
  const t = (e.clientX - rangeDrag.left) / pps.value
  const { start, end } = props.window
  emit('update:window', rangeDrag.edge === 'start'
    ? { start: clamp(t, 0, end - MIN_RANGE), end }
    : { start, end: clamp(t, start + MIN_RANGE, props.total) })
}
function onRangeUp() {
  rangeDrag = null
  dragging.value = false
}

function onKey(e: KeyboardEvent, v: VoiceLane) {
  if (!v.buf || props.recordingId !== null) return
  const step = e.shiftKey ? 1 : 0.1
  if (e.key === 'ArrowLeft') patchVoice(v.id, { start: clampStart(v, v.start - step) })
  else if (e.key === 'ArrowRight') patchVoice(v.id, { start: clampStart(v, v.start + step) })
  else return
  e.preventDefault()
}
</script>

<template>
  <div class="dj-editor" :class="{ 'dj-editor-dragging': dragging }">
    <div class="dj-gutter">
      <div class="dj-gutter-ruler">
        <div class="dj-zoom">
          <button type="button" :disabled="zoom <= MIN_ZOOM" :title="t('dj.zoom_out')" :aria-label="t('dj.zoom_out')" @click="zoomTo(zoom / ZOOM_STEP)">−</button>
          <span>{{ Math.round(zoom * 100) }}%</span>
          <button type="button" :disabled="zoom >= MAX_ZOOM" :title="t('dj.zoom_in')" :aria-label="t('dj.zoom_in')" @click="zoomTo(zoom * ZOOM_STEP)">+</button>
        </div>
      </div>
      <div class="dj-gutter-lane dj-tone-a">
        <b class="dj-letter-a">A</b><small>{{ t('dj.lane_tail') }}</small>
        <span v-if="infoA?.bpm" class="dj-param">{{ t('dj.bpm', { bpm: Math.round(infoA.bpm) }) }}</span>
        <span v-if="infoA?.key" class="dj-param">{{ infoA.key }}</span>
      </div>
      <div v-for="(v, n) in voices" :key="v.id" class="dj-gutter-lane dj-gutter-voice dj-tone-b">
        <b class="dj-letter-b">{{ voices.length > 1 ? `B${n + 1}` : 'B' }}</b><small>{{ t('dj.lane_voice') }}</small>
        <small v-if="v.source">{{ t(`dj.voice_source_${v.source}`) }}</small>
        <div class="dj-fx">
          <label v-for="fx in effectsOf(v)" :key="fx.key" class="dj-fx-col" :title="`${fx.label} ${fx.pct}%`">
            <NSlider
              class="dj-fx-slider" vertical :theme-overrides="{ handleSize: '12px' }" :value="fx.pct"
              :min="0" :max="100" :step="5" :tooltip="false" :aria-label="fx.label"
              @update:value="setEffect(v.id, fx.key, $event)"
            />
            <span class="dj-fx-name">{{ fx.label }}</span>
          </label>
        </div>
      </div>
      <div class="dj-gutter-lane dj-tone-c">
        <b class="dj-letter-c">C</b><small>{{ t('dj.lane_head') }}</small>
        <span v-if="infoB?.bpm" class="dj-param">{{ t('dj.bpm', { bpm: Math.round(infoB.bpm) }) }}</span>
        <span v-if="infoB?.key" class="dj-param">{{ infoB.key }}</span>
      </div>
    </div>

    <div ref="viewportEl" class="dj-viewport" @wheel.ctrl.prevent="onWheel">
    <div ref="areaEl" class="dj-area" :style="{ width: `${areaWidth + 10}px` }">
      <div class="dj-ruler">
        <div ref="timelineEl" />
        <div ref="rulerEl" class="dj-ruler-ws" />
      </div>

      <div class="dj-lane dj-tone-a">
        <div v-if="!a" class="dj-lane-empty">{{ t('dj.pick_a') }}</div>
        <div ref="aEl" class="dj-track" :style="aStyle" />
        <span v-if="a && titleA" class="dj-lane-title dj-lane-title-b" :style="{ left: px(aStart) }">{{ titleA }}</span>
        <svg
          v-if="a" class="dj-env dj-env-slidable" :width="areaWidth" :height="LANE_H"
          @pointerdown="onSongDown($event, 'a')" @pointermove="onSongMove" @pointerup="onSongUp" @pointercancel="onSongUp"
        >
          <polyline
            class="dj-env-hit" :points="envelopeLine('a')"
            @pointerdown.stop="onLineDown($event, 'a')" @pointermove="onHandleMove"
            @pointerup="onHandleUp" @pointercancel="onHandleUp"
          />
          <polyline :points="envelopeLine('a')" />
          <g
            v-for="{ p, i } in handlesOf('a')" :key="i" class="dj-handle-grip"
            @pointerdown.stop="onHandleDown($event, 'a', i)" @pointermove="onHandleMove" @pointerup="onHandleUp" @pointercancel="onHandleUp"
            @dblclick.stop="removePoint('a', i)"
          >
            <circle class="dj-handle-hit" :cx="(aStart + p.time) * pps" :cy="yOf(p.volume)" r="15" />
            <circle class="dj-handle" :cx="(aStart + p.time) * pps" :cy="yOf(p.volume)" r="7" />
          </g>
        </svg>
      </div>

      <div v-for="v in voices" :key="v.id" class="dj-lane dj-lane-voice dj-tone-b">
        <div v-if="!v.buf && recordingId !== v.id" class="dj-lane-empty">{{ t('dj.rec_hint') }}</div>
        <DjVoiceTrack
          :ref="(el: unknown) => setTrack(v.id, el)"
          class="dj-track dj-track-voice"
          :class="{ 'dj-track-drag': !!v.buf && recordingId === null, 'dj-track-recording': recordingId === v.id }"
          :style="voiceStyle(v)"
          :buf="v.buf"
          :color="djColors.b"
          :tabindex="v.buf && recordingId === null ? 0 : -1"
          @pointerdown="onDragStart($event, v)"
          @pointermove="onDragMove($event, v)"
          @pointerup="onDragEnd"
          @pointercancel="onDragEnd"
          @keydown="onKey($event, v)"
          @record-end="emit('record-end', $event, v.id)"
          @record-error="emit('record-error', $event)"
        />
        <template v-if="v.buf && recordingId !== v.id">
          <svg class="dj-env dj-env-voice" :width="areaWidth" :height="LANE_H">
            <polyline
              class="dj-env-hit" :points="envelopeLine(v.id)"
              @pointerdown.stop="onLineDown($event, v.id)" @pointermove="onHandleMove"
              @pointerup="onHandleUp" @pointercancel="onHandleUp"
            />
            <polyline :points="envelopeLine(v.id)" />
            <g
              v-for="{ p, i } in handlesOf(v.id)" :key="i" class="dj-handle-grip"
              @pointerdown.stop="onHandleDown($event, v.id, i)" @pointermove="onHandleMove" @pointerup="onHandleUp" @pointercancel="onHandleUp"
              @dblclick.stop="removePoint(v.id, i)"
            >
              <circle class="dj-handle-hit" :cx="(v.start + p.time) * pps" :cy="yOf(p.volume)" r="15" />
              <circle class="dj-handle" :cx="(v.start + p.time) * pps" :cy="yOf(p.volume)" r="7" />
            </g>
          </svg>
          <button
            type="button" class="dj-voice-x"
            :style="{ left: `calc(${voiceStyle(v).left} + ${voiceStyle(v).width})` }"
            :title="t('dj.delete_rec')" :aria-label="t('dj.delete_rec')"
            @click="emit('delete-voice', v.id)"
          >✕</button>
          <span
            v-if="v.source" class="dj-voice-badge" :class="`dj-voice-badge--${v.source}`"
            :style="{ left: voiceStyle(v).left }"
          >
            {{ t(`dj.voice_source_${v.source}`) }}
          </span>
        </template>
      </div>

      <div class="dj-lane dj-tone-c">
        <div v-if="!b" class="dj-lane-empty">{{ t('dj.pick_b') }}</div>
        <div ref="bEl" class="dj-track" :style="bStyle" />
        <span v-if="b && titleB" class="dj-lane-title dj-lane-title-b" :style="{ left: px(bStart) }">{{ titleB }}</span>
        <svg
          v-if="b" class="dj-env dj-env-slidable" :width="areaWidth" :height="LANE_H"
          @pointerdown="onSongDown($event, 'b')" @pointermove="onSongMove" @pointerup="onSongUp" @pointercancel="onSongUp"
        >
          <polyline
            class="dj-env-hit" :points="envelopeLine('b')"
            @pointerdown.stop="onLineDown($event, 'b')" @pointermove="onHandleMove"
            @pointerup="onHandleUp" @pointercancel="onHandleUp"
          />
          <polyline :points="envelopeLine('b')" />
          <g
            v-for="{ p, i } in handlesOf('b')" :key="i" class="dj-handle-grip"
            @pointerdown.stop="onHandleDown($event, 'b', i)" @pointermove="onHandleMove" @pointerup="onHandleUp" @pointercancel="onHandleUp"
            @dblclick.stop="removePoint('b', i)"
          >
            <circle class="dj-handle-hit" :cx="(bStart + p.time) * pps" :cy="yOf(p.volume)" r="15" />
            <circle class="dj-handle" :cx="(bStart + p.time) * pps" :cy="yOf(p.volume)" r="7" />
          </g>
        </svg>
      </div>

      <div class="dj-overlay">
        <template v-if="a && b">
          <div class="dj-dim" :style="{ left: 0, width: px(window.start) }" />
          <div class="dj-dim" :style="{ left: px(window.end), right: 0 }" />
          <div class="dj-window" :style="{ left: px(window.start), width: px(window.end - window.start) }">
            <span>{{ t('dj.window') }}</span>
          </div>
        </template>
        <div
          class="dj-scrub-strip"
          @pointerdown="onScrubDown" @pointermove="onScrubMove"
          @pointerup="onScrubUp" @pointercancel="onScrubUp"
        />
        <template v-if="a && b">
          <span
            class="dj-range-grip dj-range-grip--start" :style="{ left: px(window.start) }" :title="t('dj.range_start')"
            @pointerdown.stop="onRangeDown($event, 'start')" @pointermove="onRangeMove" @pointerup="onRangeUp" @pointercancel="onRangeUp"
          />
          <span
            class="dj-range-grip dj-range-grip--end" :style="{ left: px(window.end) }" :title="t('dj.range_end')"
            @pointerdown.stop="onRangeDown($event, 'end')" @pointermove="onRangeMove" @pointerup="onRangeUp" @pointercancel="onRangeUp"
          />
        </template>
        <div class="dj-playhead" :style="{ left: px(playhead) }">
          <span
            class="dj-playhead-grip"
            @pointerdown.stop="onScrubDown" @pointermove="onScrubMove"
            @pointerup="onScrubUp" @pointercancel="onScrubUp"
          />
        </div>
      </div>
    </div>
    </div>

  </div>
</template>

<style scoped>
.dj-editor {
  --lane-h: 96px;
  display: grid;
  grid-template-columns: 224px 1fr;
  border: 1px solid var(--dj-border);
  border-radius: 10px;
  background: var(--dj-surface);
  overflow: hidden;
}
.dj-gutter-ruler,
.dj-ruler {
  height: 26px;
}
.dj-gutter-lane {
  height: var(--lane-h);
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 0 10px;
  border-top: 1px solid var(--dj-border);
}
.dj-gutter-lane b {
  font-size: 0.9rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.dj-gutter-lane small {
  font-size: 0.65rem;
  opacity: 0.55;
  line-height: 1.2;
}
.dj-gutter-voice {
  position: relative;
  /* Keeps the caption clear of the slider block standing at the right of the cell. */
  padding-right: 158px;
}
/** The effect sliders stand upright in a row at the right of B's cell, each with its name under it. */
.dj-fx {
  position: absolute;
  top: 8px;
  right: 8px;
  bottom: 6px;
  display: flex;
  gap: 0;
}
.dj-fx-col {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  width: 34px;
  cursor: pointer;
}
.dj-fx-slider {
  flex: 1;
  min-height: 0;
}
.dj-fx-name {
  font-size: 0.56rem;
  letter-spacing: 0;
  white-space: nowrap;
  color: var(--dj-muted);
}
.dj-param {
  margin-top: 2px;
  font-size: 0.62rem;
  letter-spacing: 0.04em;
  color: var(--dj-muted);
}
.dj-tone-a {
  --tone: var(--dj-a);
}
.dj-tone-b {
  --tone: var(--dj-b);
}
.dj-tone-c {
  --tone: var(--dj-c);
}
.dj-letter-a {
  color: var(--dj-a);
}
.dj-letter-b {
  color: var(--dj-b);
}
.dj-letter-c {
  color: var(--dj-c);
}
/** A stripe down the gutter edge and a faint wash across the lane tie each row to its asset. */
.dj-gutter-lane {
  box-shadow: inset 3px 0 0 var(--tone);
}
.dj-lane {
  background: color-mix(in srgb, var(--tone) 4%, transparent);
}
.dj-viewport {
  min-width: 0;
  overflow-x: auto;
  overflow-y: hidden;
  /* Room for a handle sitting on the very first frame or the lowest volume to show in full. */
  padding: 0 0 8px 8px;
}
.dj-zoom {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
  padding: 0 10px;
  font-size: 0.7rem;
  color: var(--dj-muted);
}
.dj-zoom button {
  width: 22px;
  height: 20px;
  padding: 0;
  border: 1px solid var(--dj-border);
  border-radius: 4px;
  background: transparent;
  color: inherit;
  cursor: pointer;
}
.dj-zoom button:hover:not(:disabled) {
  color: var(--dj-text);
  border-color: var(--dj-accent);
}
.dj-zoom button:disabled {
  opacity: 0.35;
  cursor: default;
}
.dj-area {
  position: relative;
  min-width: 0;
  /* Leaves the handle on a song's last frame somewhere to sit without being clipped. */
  padding-right: 10px;
}
.dj-ruler {
  position: relative;
  overflow: hidden;
  font-size: 10px;
}
.dj-ruler-ws {
  position: absolute;
  inset: 0;
  opacity: 0;
  pointer-events: none;
}
.dj-lane {
  position: relative;
  height: var(--lane-h);
  border-top: 1px solid var(--dj-border);
  /* Visible, so the handles sitting on a song's first and last frame are not sliced in half. */
  overflow: visible;
}
.dj-track {
  position: absolute;
  top: 6px;
  height: 84px;
}
.dj-track:not(.dj-track-voice) {
  /* Display-only waveform (wavesurfer interact: false); let clicks reach the duck-curve editor above it. */
  pointer-events: none;
}
.dj-track-drag {
  cursor: grab;
  border-radius: 4px;
  background: color-mix(in srgb, var(--dj-b) 8%, transparent);
  outline: 1px solid color-mix(in srgb, var(--dj-b) 45%, transparent);
  touch-action: none;
}
.dj-track-drag:active {
  cursor: grabbing;
}
.dj-track-drag:focus-visible {
  outline: 2px solid var(--dj-accent);
}
.dj-track-recording {
  outline: 1px solid var(--dj-danger);
}
.dj-lane-empty {
  position: absolute;
  inset: 6px 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px dashed var(--dj-border);
  border-radius: 6px;
  font-size: 0.75rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  opacity: 0.5;
}
.dj-lane-title {
  position: absolute;
  top: 8px;
  left: 8px;
  max-width: 60%;
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 0.7rem;
  background: rgba(0, 0, 0, 0.55);
  color: #fff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  pointer-events: none;
}
.dj-lane-title {
  border-left: 3px solid var(--tone);
}
.dj-lane-title-b {
  margin-left: 8px;
  left: auto;
}
.dj-voice-badge {
  position: absolute;
  top: 8px;
  margin-left: 8px;
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  pointer-events: none;
}
.dj-voice-x {
  position: absolute;
  top: 8px;
  width: 20px;
  height: 20px;
  margin-left: -26px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: 50%;
  font-size: 0.7rem;
  line-height: 1;
  background: rgba(0, 0, 0, 0.6);
  color: #fff;
  cursor: pointer;
  pointer-events: auto;
  z-index: 2;
}
.dj-voice-x:hover,
.dj-voice-x:focus-visible {
  background: var(--dj-danger);
  outline: none;
}
.dj-voice-badge--rec {
  background: color-mix(in srgb, var(--dj-danger) 25%, black);
  color: #fff;
}
.dj-voice-badge--ai {
  background: color-mix(in srgb, var(--dj-accent) 30%, black);
  color: #fff;
}
.dj-voice-badge--file {
  background: color-mix(in srgb, var(--dj-fade) 30%, black);
  color: #fff;
}
.dj-env {
  position: absolute;
  inset: 0;
  overflow: visible;
  /* `none` here would take the children out of hit testing too, curve and handles included. */
  pointer-events: auto;
}
.dj-env polyline {
  fill: none;
  stroke: var(--dj-fade);
  stroke-width: 2;
  stroke-linejoin: round;
  filter: drop-shadow(0 0 3px var(--dj-fade));
  /* The drawn line must not shadow the fat hit stroke sitting underneath it. */
  pointer-events: none;
}
/** A fat invisible stroke over the curve, so the line itself is easy to hit. */
.dj-env polyline.dj-env-hit {
  stroke: transparent;
  stroke-width: 16;
  filter: none;
  pointer-events: stroke;
  cursor: copy;
}
.dj-env-slidable {
  cursor: grab;
}
/* A voice lane's clip sits under its curve, so only the line and its points may catch the pointer. */
.dj-env-voice {
  pointer-events: none;
}
.dj-editor-dragging .dj-env-slidable {
  cursor: grabbing;
}
/** An invisible grip wider than the dot, so the point is easy to catch over a busy waveform. */
.dj-handle-grip {
  pointer-events: all;
  touch-action: none;
  cursor: move;
}
.dj-handle-hit {
  fill: transparent;
  stroke: none;
}
.dj-handle {
  fill: var(--dj-surface);
  stroke: var(--dj-fade);
  stroke-width: 2;
  pointer-events: none;
}
.dj-handle-grip:hover .dj-handle {
  fill: var(--dj-fade);
}
/** The curve's glow is a large-area filter; repainting it every frame is wasted during a drag. */
.dj-editor-dragging .dj-env polyline {
  filter: none;
}
.dj-overlay {
  position: absolute;
  inset: 0;
  pointer-events: none;
}
.dj-dim {
  position: absolute;
  top: 26px;
  bottom: 0;
  background: rgba(0, 0, 0, 0.35);
}
.dj-window {
  position: absolute;
  top: 26px;
  bottom: 0;
  border: 1px solid var(--dj-accent);
  border-top: 0;
  border-bottom: 0;
  background: color-mix(in srgb, var(--dj-accent) 6%, transparent);
}
.dj-window span {
  position: absolute;
  top: 2px;
  left: 6px;
  font-size: 0.6rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--dj-accent);
}
/** The two ends of the play / send range, standing on the ruler. */
.dj-range-grip {
  position: absolute;
  top: 0;
  width: 14px;
  height: 26px;
  margin-left: -7px;
  pointer-events: all;
  touch-action: none;
  cursor: col-resize;
}
.dj-range-grip::after {
  content: '';
  position: absolute;
  top: 3px;
  bottom: 3px;
  left: 6px;
  width: 2px;
  border-radius: 1px;
  background: var(--dj-accent);
}
.dj-range-grip::before {
  content: '';
  position: absolute;
  top: 3px;
  width: 6px;
  height: 2px;
  background: var(--dj-accent);
}
.dj-range-grip--start::before {
  left: 8px;
}
.dj-range-grip--end::before {
  left: 0;
}
.dj-playhead {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 2px;
  margin-left: -1px;
  background: #fff;
  box-shadow: 0 0 6px #fff;
}
/** A flag at the top makes it clear the cursor can be taken hold of. */
.dj-playhead::before {
  content: '';
  position: absolute;
  top: 0;
  left: -5px;
  border-left: 6px solid transparent;
  border-right: 6px solid transparent;
  border-top: 8px solid #fff;
}
.dj-playhead-grip {
  position: absolute;
  top: 0;
  bottom: 0;
  left: -8px;
  width: 18px;
  pointer-events: all;
  touch-action: none;
  cursor: ew-resize;
}
/** Press anywhere on the ruler to move the cursor there. */
.dj-scrub-strip {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 26px;
  pointer-events: all;
  touch-action: none;
  cursor: ew-resize;
}
.dj-editor-dragging .dj-playhead {
  box-shadow: none;
}
.dj-warn {
  grid-column: 1 / -1;
  margin: 0;
  padding: 6px 12px;
  font-size: 0.75rem;
  color: var(--dj-danger);
  border-top: 1px solid var(--dj-border);
}
</style>
