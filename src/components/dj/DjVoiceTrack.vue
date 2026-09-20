<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import WaveSurfer from 'wavesurfer.js'
import RecordPlugin from 'wavesurfer.js/plugins/record'
import { peaksOf } from '@/utils/djAudio'

/** The waveform of one B lane, and the microphone that can fill it. Sized and placed by its parent. */
const props = defineProps<{ buf: AudioBuffer | null; color: string }>()
const emit = defineEmits<{
  'record-end': [blob: Blob]
  'record-error': [error: unknown]
}>()

const el = ref<HTMLElement | null>(null)
let ws: WaveSurfer | null = null
let record: ReturnType<typeof RecordPlugin.create> | null = null

function show(buf: AudioBuffer | null) {
  if (!ws) return
  if (!buf) return ws.empty()
  return ws.load('', [peaksOf(buf)], buf.duration)
}

onMounted(() => {
  ws = WaveSurfer.create({
    container: el.value!,
    height: 84,
    cursorWidth: 0,
    interact: false,
    hideScrollbar: true,
    normalize: true,
    barWidth: 2,
    barGap: 1,
    barRadius: 1,
    waveColor: props.color,
    progressColor: props.color,
  })
  record = ws.registerPlugin(RecordPlugin.create({
    scrollingWaveform: true,
    scrollingWaveformWindow: 8,
    renderRecordedAudio: false,
  }))
  record.on('record-end', blob => emit('record-end', blob))
  void show(props.buf)
})

onBeforeUnmount(() => ws?.destroy())

watch(() => props.buf, buf => show(buf))
watch(() => props.color, c => ws?.setOptions({ waveColor: c, progressColor: c }))

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
</script>

<template>
  <div ref="el" />
</template>
