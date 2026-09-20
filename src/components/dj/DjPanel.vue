<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { NButton, useMessage, useThemeVars } from 'naive-ui'
import LedIndicator from '@/components/LedIndicator.vue'
import AivoxQueue from '@/components/AivoxQueue.vue'
import DjLinkEditor from '@/components/dj/DjLinkEditor.vue'
import DjSongPicker, { type DjSong } from '@/components/dj/DjSongPicker.vue'
import djApiService from '@/services/djApi'
import aivoxApiService, { type AivoxQueueEntry } from '@/services/aivoxApi'
import {
  cropHead, cropTail, decodeBlob, fetchSongBuffer,
  DEFAULT_VOCAL_ENTRY, HEAD_SECONDS, MAX_VOICE_SECONDS, TAIL_SECONDS,
} from '@/utils/djAudio'
import {
  autoDuck, bStartFor, encodeWav, junctionWindow, LinkPreview, renderLink, type EnvelopePoint, type LinkModel,
} from '@/utils/djMix'

const { t } = useI18n()
const message = useMessage()
const themeVars = useThemeVars()

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
  /** The project's yellow (LedYellow, free-plan badge). */
  '--dj-fade': '#FFD600',
}))

// ── Session / ON AIR ────────────────────────────────────────────────
const sessionState = ref<'starting' | 'active' | 'error'>('starting')
const startedAt = ref(0)
const now = ref(Date.now())
const onAir = ref<boolean | null>(null)
const ending = ref(false)
let sessionEnded = false
let clockTimer: ReturnType<typeof setInterval> | null = null
let liveTimer: ReturnType<typeof setInterval> | null = null
let queueTimer: ReturnType<typeof setInterval> | null = null

const elapsed = computed(() => {
  const total = Math.max(0, Math.floor((now.value - startedAt.value) / 1000))
  const h = Math.floor(total / 3600)
  const mm = String(Math.floor((total % 3600) / 60)).padStart(2, '0')
  const ss = String(total % 60).padStart(2, '0')
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
})

async function startSession() {
  sessionState.value = 'starting'
  try {
    startedAt.value = (await djApiService.startSession(brandSlug.value)).startedAt
    sessionState.value = 'active'
  } catch {
    sessionState.value = 'error'
  }
}

async function pollLive() {
  try {
    onAir.value = await djApiService.getOnAir(brandSlug.value)
  } catch {
    onAir.value = null
  }
}

const queueEntries = ref<AivoxQueueEntry[]>([])
async function pollQueue() {
  try {
    const res = await aivoxApiService.queue(brandSlug.value)
    const all = Array.isArray(res.fullQueue) ? res.fullQueue : []
    queueEntries.value = all.filter(e => e.tech.queueType === 'prioritized' || e.tech.queueType === 'regular')
  } catch {
    queueEntries.value = []
  }
}

async function endSession() {
  if (ending.value) return
  ending.value = true
  stopPreview()
  try {
    if (!sessionEnded && sessionState.value === 'active') {
      sessionEnded = true
      await djApiService.endSession(brandSlug.value)
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
const aBuf = shallowRef<AudioBuffer | null>(null)
const bBuf = shallowRef<AudioBuffer | null>(null)
const loadingA = ref(false)
const loadingB = ref(false)

async function loadSong(song: DjSong | null, slot: 'a' | 'b') {
  const target = slot === 'a' ? aBuf : bBuf
  const loading = slot === 'a' ? loadingA : loadingB
  const current = () => (slot === 'a' ? songA : songB).value?.slugName
  target.value = null
  if (!song) return
  loading.value = true
  try {
    const full = await fetchSongBuffer(song.slugName)
    if (current() !== song.slugName) return
    target.value = slot === 'a' ? cropTail(full) : cropHead(full)
  } catch {
    if (current() === song.slugName) message.error(t('dj.song_error'))
  } finally {
    if (current() === song.slugName) loading.value = false
  }
}
watch(songA, s => loadSong(s, 'a'))
watch(songB, s => loadSong(s, 'b'))

// ── Junction timeline ───────────────────────────────────────────────
const voice = shallowRef<AudioBuffer | null>(null)
const voiceStart = ref(0)
const vocalEntry = ref(DEFAULT_VOCAL_ENTRY)
/** Music volume curve. Empty until the DJ adds points or presses Auto duck. */
const duck = ref<EnvelopePoint[]>([])

const bStart = computed(() => bStartFor(aBuf.value?.duration ?? TAIL_SECONDS))
const total = computed(() => bStart.value + (bBuf.value?.duration ?? HEAD_SECONDS))
const win = computed(() => junctionWindow({
  bStart: bStart.value, voiceStart: voiceStart.value, total: total.value, hasVoice: !!voice.value,
}))
const clampVoice = (s: number) => Math.min(Math.max(0, s), Math.max(0, total.value - (voice.value?.duration ?? 0)))

watch(bBuf, b => {
  vocalEntry.value = Math.min(DEFAULT_VOCAL_ENTRY, Math.max(0, (b?.duration ?? HEAD_SECONDS) - 1))
})
watch([aBuf, bBuf], () => { voiceStart.value = clampVoice(voiceStart.value) })

const model = computed<LinkModel | null>(() =>
  aBuf.value && bBuf.value
    ? { a: aBuf.value, b: bBuf.value, voice: voice.value, bStart: bStart.value, voiceStart: voiceStart.value, duck: duck.value }
    : null,
)

function applyAutoDuck() {
  if (voice.value) duck.value = autoDuck(voiceStart.value, voice.value.duration)
}
function resetCurve() {
  duck.value = []
}
function deleteRecording() {
  stopPreview()
  voice.value = null
  voiceStart.value = 0
}

// ── Recording ───────────────────────────────────────────────────────
const editor = ref<InstanceType<typeof DjLinkEditor> | null>(null)
const recording = ref(false)
const recSeconds = ref(0)
let recTimer: ReturnType<typeof setInterval> | null = null

function clearRecTimer() {
  if (recTimer) { clearInterval(recTimer); recTimer = null }
}

async function toggleRec() {
  if (recording.value) {
    editor.value?.stopRec()
    return
  }
  stopPreview()
  recording.value = true
  recSeconds.value = 0
  await nextTick()
  await editor.value?.startRec()
  if (!recording.value) return
  recTimer = setInterval(() => {
    recSeconds.value += 1
    if (recSeconds.value >= MAX_VOICE_SECONDS) editor.value?.stopRec()
  }, 1000)
}

async function onRecordEnd(blob: Blob) {
  clearRecTimer()
  recording.value = false
  try {
    const buf = await decodeBlob(blob)
    if (buf.duration < 0.3) return
    voice.value = buf
    // Land the voice so it finishes just before the vocal entry; the DJ can drag from there.
    voiceStart.value = clampVoice(bStart.value + vocalEntry.value - buf.duration - 0.3)
  } catch {
    message.error(t('dj.mic_error'))
  }
}

function onRecordError() {
  clearRecTimer()
  recording.value = false
  message.error(t('dj.mic_error'))
}

// ── Preview ─────────────────────────────────────────────────────────
const preview = new LinkPreview()
const previewing = ref(false)
const playhead = ref<number | null>(null)

function stopPreview() {
  preview.stop()
  previewing.value = false
  playhead.value = null
}

function togglePreview() {
  if (previewing.value) return stopPreview()
  if (!model.value) return
  previewing.value = true
  preview.play(model.value, win.value, tm => { playhead.value = tm }, stopPreview)
}
watch([voice, voiceStart, vocalEntry, duck, aBuf, bBuf], stopPreview)

// ── Send to air ─────────────────────────────────────────────────────
const sending = ref(false)

async function sendToAir() {
  const m = model.value
  const a = songA.value
  const b = songB.value
  if (!m || !m.voice || !a || !b || sending.value) return
  stopPreview()
  sending.value = true
  try {
    const rendered = await renderLink(m, win.value)
    const filename = `dj-link-${Date.now()}.wav`
    const stored = await djApiService.uploadTemp(encodeWav(rendered), filename)
    await djApiService.sendToAir(brandSlug.value, {
      filename: stored,
      durationSeconds: Math.round(rendered.duration * 100) / 100,
      songIds: [a.id, b.id],
      title: [a.title, b.title].filter(Boolean).join(' → '),
      artist: [...new Set([a.artist, b.artist].filter(Boolean))].join(' / '),
    })
    message.success(t('dj.sent'))
  } catch {
    message.error(t('dj.send_error'))
  } finally {
    sending.value = false
  }
}

const ready = computed(() => sessionState.value === 'active')
const canRecord = computed(() => ready.value && !!model.value && !sending.value)
const canPreview = computed(() => ready.value && !!model.value && !recording.value && !sending.value)
const canSend = computed(() => canPreview.value && !ending.value)

const songLabel = (s: DjSong | null) => (s ? [s.artist, s.title].filter(Boolean).join(' — ') : '')

onMounted(async () => {
  clockTimer = setInterval(() => { now.value = Date.now() }, 1000)
  void pollLive()
  void pollQueue()
  liveTimer = setInterval(pollLive, 5000)
  queueTimer = setInterval(pollQueue, 10000)
  await startSession()
})

onBeforeUnmount(() => {
  if (clockTimer) clearInterval(clockTimer)
  if (liveTimer) clearInterval(liveTimer)
  if (queueTimer) clearInterval(queueTimer)
  clearRecTimer()
  preview.stop()
  if (!sessionEnded && sessionState.value === 'active') {
    sessionEnded = true
    void djApiService.endSession(brandSlug.value).catch(() => {})
  }
})
</script>

<template>
  <div class="dj-panel" :style="themeStyle">
    <header class="dj-topbar">
      <div class="dj-onair" :class="{ 'dj-onair--live': onAir === true }">
        <LedIndicator :active="onAir === true" :pulse="onAir === true" :color="themeVars.successColor" :size="26" />
        <span>{{ onAir === null ? t('dj.on_air_unknown') : onAir ? t('dj.on_air') : t('dj.off_air') }}</span>
      </div>
      <div class="dj-timer">
        <small>{{ t('dj.session') }}</small>
        <span>{{ ready ? elapsed : '--:--' }}</span>
      </div>
      <NButton type="error" secondary :loading="ending" :disabled="sessionState === 'starting'" @click="endSession">
        {{ t('dj.end_session') }}
      </NButton>
    </header>

    <p v-if="sessionState === 'starting'" class="dj-banner">{{ t('dj.starting') }}</p>
    <p v-else-if="sessionState === 'error'" class="dj-banner dj-banner--error">
      {{ t('dj.session_error') }}
      <NButton size="small" @click="startSession">{{ t('dj.retry') }}</NButton>
    </p>

    <section class="dj-section">
      <h3 class="dj-section-title">{{ t('dj.songs') }}</h3>
      <div class="dj-pickers">
        <DjSongPicker v-model="songA" label="A" :placeholder="t('dj.pick_a')" :brand-slug="brandSlug" :exclude-slug="songB?.slugName" :loading="loadingA" />
        <DjSongPicker v-model="songB" label="B" :placeholder="t('dj.pick_b')" :brand-slug="brandSlug" :exclude-slug="songA?.slugName" :loading="loadingB" />
      </div>
    </section>

    <section class="dj-section">
      <h3 class="dj-section-title">{{ t('dj.link_editor') }}</h3>
      <DjLinkEditor
        ref="editor"
        v-model:voice-start="voiceStart"
        v-model:vocal-entry="vocalEntry"
        v-model:duck="duck"
        :a="aBuf"
        :b="bBuf"
        :voice="voice"
        :b-start="bStart"
        :total="total"
        :window="win"
        :playhead="playhead"
        :recording="recording"
        :title-a="songLabel(songA)"
        :title-b="songLabel(songB)"
        @record-end="onRecordEnd"
        @record-error="onRecordError"
      />
      <div class="dj-curve-tools">
        <NButton size="small" :disabled="!voice || recording" @click="applyAutoDuck">{{ t('dj.auto_duck') }}</NButton>
        <NButton size="small" :disabled="!duck.length" @click="resetCurve">{{ t('dj.reset_curve') }}</NButton>
        <span>{{ t('dj.fade_hint') }}</span>
      </div>
      <div class="dj-controls">
        <NButton :type="recording ? 'error' : 'default'" size="large" :disabled="!canRecord" @click="toggleRec">
          <span class="dj-rec-dot" :class="{ 'dj-rec-dot--on': recording }" />
          {{ recording ? `${t('dj.rec_stop')} ${recSeconds}s / ${MAX_VOICE_SECONDS}s` : t('dj.rec') }}
        </NButton>
        <NButton size="large" :disabled="!voice || recording || sending" @click="deleteRecording">
          {{ t('dj.delete_rec') }}
        </NButton>
        <NButton size="large" type="primary" secondary :disabled="!canPreview" @click="togglePreview">
          <span class="dj-preview-icon">{{ previewing ? '■' : '▶' }}</span>
          {{ previewing ? t('dj.preview_stop') : t('dj.preview') }}
        </NButton>
        <NButton type="primary" size="large" :loading="sending" :disabled="!canSend" @click="sendToAir">
          {{ t('dj.send') }}
        </NButton>
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
.dj-onair {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-right: auto;
  padding: 6px 18px;
  border-radius: 8px;
  border: 1px solid var(--dj-border);
  font-size: 1.5rem;
  font-weight: 800;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--dj-muted);
}
.dj-onair--live {
  border-color: var(--dj-live);
  color: var(--dj-live);
  box-shadow: 0 0 14px color-mix(in srgb, var(--dj-live) 30%, transparent);
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
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
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
.dj-rec-dot {
  width: 10px;
  height: 10px;
  margin-right: 8px;
  border-radius: 50%;
  background: var(--dj-danger);
}
.dj-rec-dot--on {
  animation: dj-rec-blink 1s infinite;
}
@keyframes dj-rec-blink {
  50% { opacity: 0.25; }
}
.dj-empty {
  margin: 0;
  font-size: 0.85rem;
  color: var(--dj-muted);
}
@media (max-width: 768px) {
  .dj-pickers {
    grid-template-columns: 1fr;
  }
  .dj-onair {
    font-size: 1.1rem;
  }
}
</style>
