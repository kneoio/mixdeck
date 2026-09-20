<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useThemeVars } from 'naive-ui'
import WaveSurfer from 'wavesurfer.js'
import RecordPlugin from 'wavesurfer.js/plugins/record'
import RegionsPlugin, { type Region } from 'wavesurfer.js/plugins/regions'
import TimelinePlugin from 'wavesurfer.js/plugins/timeline'
import { peaksOf } from '@/utils/djAudio'
import { envelopeAt, type EnvelopePoint, type MixWindow } from '@/utils/djMix'

const LANE_H = 96
const WAVE_H = 84
const VOCAL_MARKER_SECONDS = 0.25

const props = defineProps<{
  a: AudioBuffer | null
  b: AudioBuffer | null
  voice: AudioBuffer | null
  bStart: number
  total: number
  voiceStart: number
  /** Vocal entry, seconds into B's head. */
  vocalEntry: number
  /** Music volume curve (absolute timeline seconds), edited by the DJ. */
  duck: EnvelopePoint[]
  window: MixWindow
  playhead: number | null
  recording: boolean
  titleA?: string
  titleB?: string
}>()
const emit = defineEmits<{
  'update:voiceStart': [seconds: number]
  'update:vocalEntry': [seconds: number]
  'update:duck': [duck: EnvelopePoint[]]
  'record-end': [blob: Blob]
  'record-error': [error: unknown]
}>()
const { t } = useI18n()
const themeVars = useThemeVars()

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
const vocalGlobal = computed(() => props.bStart + props.vocalEntry)
const overrun = computed(() => (props.voice ? props.voiceStart + voiceDuration.value - vocalGlobal.value : 0))

const trackStyle = (start: number, duration: number) => ({ left: px(start), width: px(duration) })
const aStyle = computed(() => trackStyle(0, props.a?.duration ?? 0))
const bStyle = computed(() => trackStyle(props.bStart, props.b?.duration ?? 0))
const voiceStyle = computed(() =>
  props.recording ? { left: '0px', width: '100%' } : trackStyle(props.voiceStart, voiceDuration.value),
)

/** The ducking curve, drawn over the music it applies to. */
function envelopeLine(start: number, end: number): string {
  const times = [start, ...props.duck.map(p => p.time).filter(tm => tm > start && tm < end), end]
  return times
    .map(tm => `${tm * pps.value},${yOf(envelopeAt(props.duck, tm))}`)
    .join(' ')
}
const envLineA = computed(() => (props.a ? envelopeLine(0, props.a.duration) : ''))
const envLineB = computed(() => (props.b ? envelopeLine(props.bStart, props.bStart + props.b.duration) : ''))

const yOf = (volume: number) => 4 + (1 - volume) * (LANE_H - 8)
const MIN_GAP = 0.05
const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi)

const fadeLine = computed(() => envelopeLine(0, props.total))

let handleDrag: { i: number; svg: SVGSVGElement } | null = null
function onHandleDown(e: PointerEvent, i: number) {
  const svg = (e.currentTarget as SVGElement).ownerSVGElement
  if (!svg || pps.value <= 0) return
  handleDrag = { i, svg }
  ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
}
function onHandleMove(e: PointerEvent) {
  if (!handleDrag) return
  const { i, svg } = handleDrag
  const rect = svg.getBoundingClientRect()
  const pts = props.duck
  const time = clamp(
    (e.clientX - rect.left) / pps.value,
    i > 0 ? pts[i - 1].time + MIN_GAP : 0,
    i < pts.length - 1 ? pts[i + 1].time - MIN_GAP : props.total,
  )
  const volume = clamp(1 - (e.clientY - rect.top - 4) / (LANE_H - 8), 0, 1)
  emit('update:duck', pts.map((p, j) => (j === i ? { time, volume } : p)))
}
function onHandleUp() { handleDrag = null }

/** Double-click the fade row to add a point; the first one also anchors both ends of the timeline. */
function addPoint(e: MouseEvent) {
  const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect()
  const time = clamp((e.clientX - rect.left) / pps.value, 0, props.total)
  const volume = clamp(1 - (e.clientY - rect.top - 4) / (LANE_H - 8), 0, 1)
  const pts = props.duck.length ? [...props.duck] : [{ time: 0, volume: 1 }, { time: props.total, volume: 1 }]
  if (pts.some(p => Math.abs(p.time - time) < MIN_GAP)) return
  pts.push({ time, volume })
  pts.sort((x, y) => x.time - y.time)
  emit('update:duck', pts)
}
function removePoint(i: number) {
  emit('update:duck', props.duck.filter((_, j) => j !== i))
}

let rulerWs: WaveSurfer | null = null
let aWs: WaveSurfer | null = null
let voiceWs: WaveSurfer | null = null
let bWs: WaveSurfer | null = null
let regions: ReturnType<typeof RegionsPlugin.create> | null = null
let record: ReturnType<typeof RecordPlugin.create> | null = null
let vocalRegion: Region | null = null
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

async function syncB() {
  if (!bWs || !regions) return
  regions.clearRegions()
  vocalRegion = null
  await show(bWs, props.b)
  if (!props.b) return
  const start = Math.min(props.vocalEntry, Math.max(0, props.b.duration - VOCAL_MARKER_SECONDS))
  vocalRegion = regions.addRegion({
    start,
    end: start + VOCAL_MARKER_SECONDS,
    drag: true,
    resize: false,
    color: themeVars.value.primaryColorHover,
  })
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
    plugins: [TimelinePlugin.create({ container: timelineEl.value!, timeInterval: 5, primaryLabelInterval: 10, secondaryLabelInterval: 5 })],
  })
  aWs = WaveSurfer.create({ ...laneOptions, container: aEl.value!, waveColor: themeVars.value.primaryColor, progressColor: themeVars.value.primaryColor })
  regions = RegionsPlugin.create()
  bWs = WaveSurfer.create({ ...laneOptions, container: bEl.value!, waveColor: themeVars.value.primaryColor, progressColor: themeVars.value.primaryColor, plugins: [regions] })
  voiceWs = WaveSurfer.create({ ...laneOptions, container: voiceEl.value!, waveColor: themeVars.value.successColor, progressColor: themeVars.value.successColor })

  record = voiceWs.registerPlugin(RecordPlugin.create({
    scrollingWaveform: true,
    scrollingWaveformWindow: 8,
    renderRecordedAudio: false,
  }))
  record.on('record-end', blob => emit('record-end', blob))

  regions.on('region-updated', region => {
    if (region === vocalRegion) emit('update:vocalEntry', region.start)
  })

  syncRuler()
  void show(aWs, props.a)
  void syncB()
  void show(voiceWs, props.voice)
})

onBeforeUnmount(() => {
  observer?.disconnect()
  for (const ws of [rulerWs, aWs, bWs, voiceWs]) ws?.destroy()
})

watch(() => [themeVars.value.primaryColor, themeVars.value.successColor], ([accent, live]) => {
  for (const ws of [aWs, bWs]) ws?.setOptions({ waveColor: accent, progressColor: accent })
  voiceWs?.setOptions({ waveColor: live, progressColor: live })
})
watch(() => props.total, syncRuler)
watch(() => props.a, buf => show(aWs, buf))
watch(() => props.b, syncB)
watch(() => props.voice, buf => show(voiceWs, buf))
watch(() => props.vocalEntry, start => {
  if (vocalRegion && Math.abs(vocalRegion.start - start) > 0.01) {
    vocalRegion.setOptions({ start, end: start + VOCAL_MARKER_SECONDS })
  }
})

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
let drag: { x: number; start: number } | null = null
const clampVoice = (s: number) => Math.min(Math.max(0, s), Math.max(0, props.total - voiceDuration.value))

function onDragStart(e: PointerEvent) {
  if (!props.voice || props.recording || pps.value <= 0) return
  drag = { x: e.clientX, start: props.voiceStart }
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
}
function onDragMove(e: PointerEvent) {
  if (!drag) return
  emit('update:voiceStart', clampVoice(drag.start + (e.clientX - drag.x) / pps.value))
}
function onDragEnd() { drag = null }
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
  <div class="dj-editor">
    <div class="dj-gutter">
      <div class="dj-gutter-ruler" />
      <div class="dj-gutter-lane"><b>A</b><small>{{ t('dj.lane_tail') }}</small></div>
      <div class="dj-gutter-lane dj-gutter-voice"><b>{{ t('dj.lane_voice') }}</b><small>{{ t('dj.lane_drag') }}</small></div>
      <div class="dj-gutter-lane"><b>B</b><small>{{ t('dj.lane_head') }}</small></div>
      <div class="dj-gutter-lane dj-gutter-fade"><b>{{ t('dj.lane_fade') }}</b><small>{{ t('dj.lane_fade_hint') }}</small></div>
    </div>

    <div ref="areaEl" class="dj-area">
      <div class="dj-ruler">
        <div ref="timelineEl" />
        <div ref="rulerEl" class="dj-ruler-ws" />
      </div>

      <div class="dj-lane">
        <div v-if="!a" class="dj-lane-empty">{{ t('dj.pick_a') }}</div>
        <div ref="aEl" class="dj-track" :style="aStyle" />
        <span v-if="a && titleA" class="dj-lane-title">{{ titleA }}</span>
        <svg v-if="a" class="dj-env" :width="areaWidth" :height="LANE_H"><polyline :points="envLineA" /></svg>
      </div>

      <div class="dj-lane dj-lane-voice">
        <div v-if="!voice && !recording" class="dj-lane-empty">{{ t('dj.rec_hint') }}</div>
        <div
          ref="voiceEl"
          class="dj-track dj-track-voice"
          :class="{ 'dj-track-drag': !!voice && !recording, 'dj-track-overrun': overrun > 0, 'dj-track-recording': recording }"
          :style="voiceStyle"
          :tabindex="voice && !recording ? 0 : -1"
          @pointerdown="onDragStart"
          @pointermove="onDragMove"
          @pointerup="onDragEnd"
          @pointercancel="onDragEnd"
          @keydown="onKey"
        />
      </div>

      <div class="dj-lane">
        <div v-if="!b" class="dj-lane-empty">{{ t('dj.pick_b') }}</div>
        <div ref="bEl" class="dj-track" :style="bStyle" />
        <span v-if="b && titleB" class="dj-lane-title dj-lane-title-b" :style="{ left: px(bStart) }">{{ titleB }}</span>
        <svg v-if="b" class="dj-env" :width="areaWidth" :height="LANE_H"><polyline :points="envLineB" /></svg>
      </div>

      <div class="dj-lane dj-lane-fade">
        <svg class="dj-fade" :width="areaWidth" :height="LANE_H" @dblclick="addPoint">
          <line class="dj-fade-base" x1="0" :x2="areaWidth" :y1="yOf(1)" :y2="yOf(1)" />
          <polyline :points="fadeLine" />
          <circle
            v-for="(p, i) in duck" :key="i" class="dj-handle" :cx="p.time * pps" :cy="yOf(p.volume)" r="7"
            @pointerdown="onHandleDown($event, i)" @pointermove="onHandleMove" @pointerup="onHandleUp" @pointercancel="onHandleUp"
            @dblclick.stop="removePoint(i)"
          />
        </svg>
      </div>

      <div class="dj-overlay">
        <template v-if="a && b">
          <div class="dj-dim" :style="{ left: 0, width: px(window.start) }" />
          <div class="dj-dim" :style="{ left: px(window.end), right: 0 }" />
          <div class="dj-window" :style="{ left: px(window.start), width: px(window.end - window.start) }">
            <span>{{ t('dj.window') }}</span>
          </div>
          <div class="dj-vocal-guide" :style="{ left: px(vocalGlobal) }"><span>{{ t('dj.vocal_in') }}</span></div>
        </template>
        <div v-if="playhead !== null" class="dj-playhead" :style="{ left: px(playhead) }" />
      </div>
    </div>

    <p v-if="overrun > 0.05" class="dj-warn">{{ t('dj.overrun', { seconds: overrun.toFixed(1) }) }}</p>
  </div>
</template>

<style scoped>
.dj-editor {
  --lane-h: 96px;
  display: grid;
  grid-template-columns: 84px 1fr;
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
.dj-gutter-voice b {
  color: var(--dj-live);
}
.dj-area {
  position: relative;
  min-width: 0;
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
  overflow: hidden;
}
.dj-track {
  position: absolute;
  top: 6px;
  height: 84px;
}
.dj-track-drag {
  cursor: grab;
  border-radius: 4px;
  background: color-mix(in srgb, var(--dj-live) 8%, transparent);
  outline: 1px solid color-mix(in srgb, var(--dj-live) 45%, transparent);
  touch-action: none;
}
.dj-track-drag:active {
  cursor: grabbing;
}
.dj-track-drag:focus-visible {
  outline: 2px solid var(--dj-accent);
}
.dj-track-overrun {
  outline-color: var(--dj-danger);
  background: color-mix(in srgb, var(--dj-danger) 10%, transparent);
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
.dj-lane-title-b {
  margin-left: 8px;
  left: auto;
}
.dj-env {
  position: absolute;
  inset: 0;
  pointer-events: none;
}
.dj-env polyline {
  fill: none;
  stroke: var(--dj-fade);
  stroke-width: 2;
  stroke-linejoin: round;
  filter: drop-shadow(0 0 3px var(--dj-fade));
}
.dj-lane-fade {
  overflow: visible;
}
.dj-fade {
  display: block;
  cursor: crosshair;
}
.dj-fade polyline {
  fill: none;
  stroke: var(--dj-fade);
  stroke-width: 2;
  stroke-linejoin: round;
}
.dj-fade-base {
  stroke: var(--dj-border);
  stroke-dasharray: 4 4;
}
.dj-gutter-fade b {
  color: var(--dj-fade);
}
.dj-handle {
  fill: var(--dj-surface);
  stroke: var(--dj-fade);
  stroke-width: 2;
  pointer-events: all;
  touch-action: none;
  cursor: move;
}
.dj-handle:hover {
  fill: var(--dj-fade);
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
.dj-vocal-guide {
  position: absolute;
  top: 26px;
  bottom: 0;
  border-left: 2px dashed var(--dj-accent-hover);
}
.dj-vocal-guide span {
  position: absolute;
  top: 2px;
  left: 4px;
  font-size: 0.6rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--dj-accent-hover);
  white-space: nowrap;
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
.dj-warn {
  grid-column: 1 / -1;
  margin: 0;
  padding: 6px 12px;
  font-size: 0.75rem;
  color: var(--dj-danger);
  border-top: 1px solid var(--dj-border);
}
</style>
