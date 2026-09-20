<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import WaveSurfer from 'wavesurfer.js'
import RecordPlugin from 'wavesurfer.js/plugins/record'
import TimelinePlugin from 'wavesurfer.js/plugins/timeline'
import { peaksOf } from '@/utils/djAudio'
import { pairedCurve, type EnvelopePoint, type MixWindow } from '@/utils/djMix'
import { NSlider } from 'naive-ui'
import { useDjColors } from '@/utils/djColors'

const LANE_H = 96
const WAVE_H = 84

const props = defineProps<{
  a: AudioBuffer | null
  b: AudioBuffer | null
  voice: AudioBuffer | null
  bStart: number
  total: number
  voiceStart: number
  /** A volume curve per song, in that song's own seconds, edited by the DJ. */
  duckA: EnvelopePoint[]
  duckB: EnvelopePoint[]
  window: MixWindow
  playhead: number
  recording: boolean
  voiceSource: 'rec' | 'ai' | 'file' | null
  titleA?: string
  titleB?: string
  /** Deck parameters shown beside each song, when the library knows them. */
  infoA?: { bpm?: number; key?: string } | null
  infoB?: { bpm?: number; key?: string } | null
  /** Effects on the B clip, each 0 to 1. */
  reverb?: number
  echo?: number
  radio?: number
  distortion?: number
  /** When on, the two curves are a crossfade: one song falls as the other rises. */
  linked?: boolean
}>()
const emit = defineEmits<{
  'update:voiceStart': [seconds: number]
  'update:duckA': [duck: EnvelopePoint[]]
  'update:duckB': [duck: EnvelopePoint[]]
  'update:bStart': [seconds: number]
  'update:reverb': [amount: number]
  'update:echo': [amount: number]
  'update:radio': [amount: number]
  'update:distortion': [amount: number]
  'record-end': [blob: Blob]
  'record-error': [error: unknown]
  'scrub-start': []
  scrub: [seconds: number]
  'scrub-end': []
  'delete-voice': []
}>()
const { t } = useI18n()
const djColors = useDjColors()
/** The effects on B, in the order their sliders stand. */
const effects = computed(() => [
  { key: 'reverb' as const, label: t('dj.reverb'), pct: Math.round((props.reverb ?? 0) * 100) },
  { key: 'echo' as const, label: t('dj.echo'), pct: Math.round((props.echo ?? 0) * 100) },
  { key: 'radio' as const, label: t('dj.radio'), pct: Math.round((props.radio ?? 0) * 100) },
  { key: 'distortion' as const, label: t('dj.distortion'), pct: Math.round((props.distortion ?? 0) * 100) },
])
function setEffect(key: 'reverb' | 'echo' | 'radio' | 'distortion', pct: number) {
  if (key === 'reverb') emit('update:reverb', pct / 100)
  else if (key === 'echo') emit('update:echo', pct / 100)
  else if (key === 'radio') emit('update:radio', pct / 100)
  else emit('update:distortion', pct / 100)
}

const areaEl = ref<HTMLElement | null>(null)
const timelineEl = ref<HTMLElement | null>(null)
const rulerEl = ref<HTMLElement | null>(null)
const aEl = ref<HTMLElement | null>(null)
const voiceEl = ref<HTMLElement | null>(null)
const bEl = ref<HTMLElement | null>(null)
const areaWidth = ref(0)

const pps = computed(() => (props.total > 0 ? areaWidth.value / props.total : 0))
const px = (seconds: number) => `${seconds * pps.value}px`
const voiceDuration = computed(() => props.voice?.duration ?? 0)
const trackStyle = (start: number, duration: number) => ({ left: px(start), width: px(duration) })
const aStyle = computed(() => trackStyle(0, props.a?.duration ?? 0))
const bStyle = computed(() => trackStyle(props.bStart, props.b?.duration ?? 0))
const voiceStyle = computed(() =>
  props.recording ? { left: '0px', width: '100%' } : trackStyle(props.voiceStart, voiceDuration.value),
)

const yOf = (volume: number) => 4 + (1 - volume) * (LANE_H - 8)
const MIN_GAP = 0.05
const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi)

/**
 * Each song owns its curve and each curve is in its song's own seconds, so the two can be
 * shaped against each other and a curve travels with its song when B slides along.
 */
type Lane = 'a' | 'b'
const laneStart = (lane: Lane) => (lane === 'a' ? 0 : props.bStart)
const laneDuration = (lane: Lane) => (lane === 'a' ? props.a?.duration ?? 0 : props.b?.duration ?? 0)
const laneCurve = (lane: Lane) => (lane === 'a' ? props.duckA : props.duckB)
function putCurve(lane: Lane, pts: EnvelopePoint[]) {
  if (lane === 'a') emit('update:duckA', pts)
  else emit('update:duckB', pts)
  if (!props.linked) return
  const other: Lane = lane === 'a' ? 'b' : 'a'
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
const envLineA = computed(() => (props.a ? envelopeLine('a') : ''))
const envLineB = computed(() => (props.b ? envelopeLine('b') : ''))
const handlesA = computed(() => (props.a ? props.duckA.map((p, i) => ({ p, i })) : []))
const handlesB = computed(() => (props.b ? props.duckB.map((p, i) => ({ p, i })) : []))

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
  // Held inside its own song and between its neighbours, so it can never be dragged out of sight.
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
 * on B, where a plain click is swallowed by the pointer capture that slides the song.
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
let voiceWs: WaveSurfer | null = null
let bWs: WaveSurfer | null = null
let record: ReturnType<typeof RecordPlugin.create> | null = null
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


onMounted(() => {
  observer = new ResizeObserver(([entry]) => { areaWidth.value = entry.contentRect.width })
  observer.observe(areaEl.value!)
  areaWidth.value = areaEl.value!.clientWidth

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
        timeInterval: 5,
        primaryLabelInterval: 10,
        secondaryLabelInterval: 5,
        // Plain seconds all the way across; a junction is too short for m:ss to help.
        formatTimeCallback: (seconds: number) => `${Math.round(seconds)}`,
      })],
  })
  aWs = WaveSurfer.create({ ...laneOptions, container: aEl.value!, waveColor: djColors.value.a, progressColor: djColors.value.a })
  bWs = WaveSurfer.create({ ...laneOptions, container: bEl.value!, waveColor: djColors.value.c, progressColor: djColors.value.c })
  voiceWs = WaveSurfer.create({ ...laneOptions, container: voiceEl.value!, waveColor: djColors.value.b, progressColor: djColors.value.b })

  record = voiceWs.registerPlugin(RecordPlugin.create({
    scrollingWaveform: true,
    scrollingWaveformWindow: 8,
    renderRecordedAudio: false,
  }))
  record.on('record-end', blob => emit('record-end', blob))

  syncRuler()
  void show(aWs, props.a)
  void show(bWs, props.b)
  void show(voiceWs, props.voice)
})

onBeforeUnmount(() => {
  observer?.disconnect()
  for (const ws of [rulerWs, aWs, bWs, voiceWs]) ws?.destroy()
})

watch(djColors, ({ a, b, c }) => {
  aWs?.setOptions({ waveColor: a, progressColor: a })
  voiceWs?.setOptions({ waveColor: b, progressColor: b })
  bWs?.setOptions({ waveColor: c, progressColor: c })
})
watch(() => props.total, syncRuler)
watch(() => props.a, buf => show(aWs, buf))
watch(() => props.b, buf => show(bWs, buf))
watch(() => props.voice, buf => show(voiceWs, buf))

async function startRec() {
  if (!record) return
  try {
    await record.startRecording()
  } catch (e) {
    emit('record-error', e)
  }
}
function stopRec() {
  record?.stopRecording()
}
defineExpose({ startRec, stopRec })

// Dragging the voice in time against both songs
let drag: { x: number; start: number; next: number | null; raf: number } | null = null
const clampVoice = (s: number) => Math.min(Math.max(0, s), Math.max(0, props.total - voiceDuration.value))

function onDragStart(e: PointerEvent) {
  if (!props.voice || props.recording || pps.value <= 0) return
  drag = { x: e.clientX, start: props.voiceStart, next: null, raf: 0 }
  dragging.value = true
  capture(e)
}
function onDragMove(e: PointerEvent) {
  if (!drag) return
  drag.next = clampVoice(drag.start + (e.clientX - drag.x) / pps.value)
  if (!drag.raf) drag.raf = requestAnimationFrame(flushDrag)
}
function flushDrag() {
  if (!drag) return
  drag.raf = 0
  if (drag.next === null) return
  emit('update:voiceStart', drag.next)
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
 * Sliding B along the timeline to set how far it overlaps A. Movement has to clear a few pixels
 * first, so a double-click on the lane still adds a duck point instead of nudging the song.
 */
let songDrag: { x: number; start: number; live: boolean; next: number | null; raf: number } | null = null

function onSongDown(e: PointerEvent) {
  if (!props.b || !props.a || pps.value <= 0) return
  songDrag = { x: e.clientX, start: props.bStart, live: false, next: null, raf: 0 }
  capture(e)
}
function onSongMove(e: PointerEvent) {
  if (!songDrag) return
  const dx = e.clientX - songDrag.x
  if (!songDrag.live) {
    if (Math.abs(dx) < 3) return
    songDrag.live = true
    dragging.value = true
  }
  songDrag.next = clamp(songDrag.start + dx / pps.value, 0, props.a?.duration ?? props.total)
  if (!songDrag.raf) songDrag.raf = requestAnimationFrame(flushSong)
}
function flushSong() {
  if (!songDrag) return
  songDrag.raf = 0
  if (songDrag.next === null) return
  emit('update:bStart', songDrag.next)
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

function onKey(e: KeyboardEvent) {
  if (!props.voice || props.recording) return
  const step = e.shiftKey ? 1 : 0.1
  if (e.key === 'ArrowLeft') emit('update:voiceStart', clampVoice(props.voiceStart - step))
  else if (e.key === 'ArrowRight') emit('update:voiceStart', clampVoice(props.voiceStart + step))
  else return
  e.preventDefault()
}
</script>

<template>
  <div class="dj-editor" :class="{ 'dj-editor-dragging': dragging }">
    <div class="dj-gutter">
      <div class="dj-gutter-ruler" />
      <div class="dj-gutter-lane dj-tone-a">
        <b class="dj-letter-a">A</b><small>{{ t('dj.lane_tail') }}</small>
        <span v-if="infoA?.bpm" class="dj-param">{{ t('dj.bpm', { bpm: Math.round(infoA.bpm) }) }}</span>
        <span v-if="infoA?.key" class="dj-param">{{ infoA.key }}</span>
      </div>
      <div class="dj-gutter-lane dj-gutter-voice dj-tone-b">
        <b class="dj-letter-b">B</b><small>{{ t('dj.lane_voice') }}</small>
        <small v-if="voiceSource">{{ t(`dj.voice_source_${voiceSource}`) }}</small>
        <div class="dj-fx">
          <label v-for="fx in effects" :key="fx.key" class="dj-fx-col" :title="`${fx.label} ${fx.pct}%`">
            <NSlider
              class="dj-fx-slider" vertical :theme-overrides="{ handleSize: '12px' }" :value="fx.pct"
              :min="0" :max="100" :step="5" :tooltip="false" :aria-label="fx.label"
              @update:value="setEffect(fx.key, $event)"
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

    <div ref="areaEl" class="dj-area">
      <div class="dj-ruler">
        <div ref="timelineEl" />
        <div ref="rulerEl" class="dj-ruler-ws" />
      </div>

      <div class="dj-lane dj-tone-a">
        <div v-if="!a" class="dj-lane-empty">{{ t('dj.pick_a') }}</div>
        <div ref="aEl" class="dj-track" :style="aStyle" />
        <span v-if="a && titleA" class="dj-lane-title">{{ titleA }}</span>
        <svg v-if="a" class="dj-env" :width="areaWidth" :height="LANE_H">
          <polyline
            class="dj-env-hit" :points="envLineA"
            @pointerdown.stop="onLineDown($event, 'a')" @pointermove="onHandleMove"
            @pointerup="onHandleUp" @pointercancel="onHandleUp"
          />
          <polyline :points="envLineA" />
          <g
            v-for="{ p, i } in handlesA" :key="i" class="dj-handle-grip"
            @pointerdown.stop="onHandleDown($event, 'a', i)" @pointermove="onHandleMove" @pointerup="onHandleUp" @pointercancel="onHandleUp"
            @dblclick.stop="removePoint('a', i)"
          >
            <circle class="dj-handle-hit" :cx="p.time * pps" :cy="yOf(p.volume)" r="15" />
            <circle class="dj-handle" :cx="p.time * pps" :cy="yOf(p.volume)" r="7" />
          </g>
        </svg>
      </div>

      <div class="dj-lane dj-lane-voice dj-tone-b">
        <div v-if="!voice && !recording" class="dj-lane-empty">{{ t('dj.rec_hint') }}</div>
        <div
          ref="voiceEl"
          class="dj-track dj-track-voice"
          :class="{ 'dj-track-drag': !!voice && !recording, 'dj-track-recording': recording }"
          :style="voiceStyle"
          :tabindex="voice && !recording ? 0 : -1"
          @pointerdown="onDragStart"
          @pointermove="onDragMove"
          @pointerup="onDragEnd"
          @pointercancel="onDragEnd"
          @keydown="onKey"
        />
        <button
          v-if="voice && !recording" type="button" class="dj-voice-x"
          :style="{ left: `calc(${voiceStyle.left} + ${voiceStyle.width})` }"
          :title="t('dj.delete_rec')" :aria-label="t('dj.delete_rec')"
          @click="emit('delete-voice')"
        >✕</button>
        <span
          v-if="voice && voiceSource" class="dj-voice-badge" :class="`dj-voice-badge--${voiceSource}`"
          :style="{ left: voiceStyle.left }"
        >
          {{ t(`dj.voice_source_${voiceSource}`) }}
        </span>
      </div>

      <div class="dj-lane dj-tone-c">
        <div v-if="!b" class="dj-lane-empty">{{ t('dj.pick_b') }}</div>
        <div ref="bEl" class="dj-track" :style="bStyle" />
        <span v-if="b && titleB" class="dj-lane-title dj-lane-title-b" :style="{ left: px(bStart) }">{{ titleB }}</span>
        <svg
          v-if="b" class="dj-env dj-env-slidable" :width="areaWidth" :height="LANE_H"
          @pointerdown="onSongDown" @pointermove="onSongMove" @pointerup="onSongUp" @pointercancel="onSongUp"
        >
          <polyline
            class="dj-env-hit" :points="envLineB"
            @pointerdown.stop="onLineDown($event, 'b')" @pointermove="onHandleMove"
            @pointerup="onHandleUp" @pointercancel="onHandleUp"
          />
          <polyline :points="envLineB" />
          <g
            v-for="{ p, i } in handlesB" :key="i" class="dj-handle-grip"
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
</template>

<style scoped>
.dj-editor {
  --lane-h: 96px;
  display: grid;
  grid-template-columns: 200px 1fr;
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
  width: 38px;
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
