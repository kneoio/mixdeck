<script setup lang="ts">
import { ref, watch, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { NCard, NSpin, NAlert, NCollapse, NCollapseItem, NTag, NEmpty } from 'naive-ui'
import jesoosApiService, { type Agenda, type AgendaScene } from '@/services/jesoosApi'

const { t } = useI18n()

const props = defineProps<{ brandSlug: string; alive?: boolean }>()

const loading = ref(false)
const error = ref<string | null>(null)
const agenda = ref<Agenda | null>(null)

function fmtTimeArr(arr: number[] | undefined | null): string {
  if (!arr || arr.length < 5) return '—'
  return `${String(arr[3]).padStart(2, '0')}:${String(arr[4]).padStart(2, '0')}`
}

function fmtDuration(sec: number): string {
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

function fmtDurSec(sec: number): string {
  const m = Math.floor(sec / 60), s = sec % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

function sceneEffectiveDuration(scene: AgendaScene): number {
  if (scene.durationSeconds > 0) return scene.durationSeconds
  return scene.timeline.reduce((a, b) => a + (b.durationSeconds ?? 0), 0)
}

function sceneEffectiveSongCount(scene: AgendaScene): number {
  if (scene.totalSongs > 0) return scene.totalSongs
  return scene.timeline.reduce((a, b) => a + (b.songs?.length ?? 0), 0)
}

const STATUS_PRIORITY = ['EMITTING', 'FAILED', 'SCHEDULED', 'PENDING', 'COMPLETED', 'SKIPPED']

function sceneStatus(scene: AgendaScene): string {
  const statuses = new Set(scene.timeline.map(b => b.status).filter(Boolean))
  return STATUS_PRIORITY.find(s => statuses.has(s)) ?? ''
}

function statusType(s: string): 'success' | 'warning' | 'error' | 'info' | 'default' {
  if (s === 'EMITTING') return 'success'
  if (s === 'FAILED') return 'error'
  if (s === 'SCHEDULED') return 'info'
  if (s === 'COMPLETED') return 'success'
  if (s === 'SKIPPED') return 'warning'
  return 'default'
}

async function fetchAgenda() {
  if (!props.brandSlug) return
  loading.value = true
  error.value = null
  try {
    agenda.value = await jesoosApiService.getAgendas(props.brandSlug)
  } catch (e: any) {
    const status = e?.message?.match(/status:\s*(\d+)/)?.[1]
    const isConnectionError = e?.message?.includes('Failed to fetch') ||
                               e?.message?.includes('ERR_CONNECTION_REFUSED') ||
                               e?.message?.includes('NetworkError')
    if (status === '404' || isConnectionError) {
      agenda.value = null
      error.value = null
    } else {
      error.value = e?.message ?? t('agenda.no_data')
      agenda.value = null
    }
  } finally {
    loading.value = false
  }
}

let refreshTimer: ReturnType<typeof setInterval> | null = null

function stopRefresh() {
  if (refreshTimer) { clearInterval(refreshTimer); refreshTimer = null }
}

watch(() => props.alive, (val) => {
  stopRefresh()
  if (val) {
    fetchAgenda()
    refreshTimer = setInterval(fetchAgenda, 60_000)
  }
})

watch(() => props.brandSlug, () => fetchAgenda(), { immediate: true })

onUnmounted(() => stopRefresh())
</script>

<template>
  <NCard :title="t('agenda.title')" class="agenda-card">
    <template #header-extra>
      <button class="refresh-btn" :disabled="loading" @click="fetchAgenda">{{ t('agenda.refresh') }}</button>
    </template>

    <NSpin :show="loading">
      <NAlert v-if="error" type="error" :title="error" style="margin-bottom: 16px" />

      <template v-if="!loading && !error && agenda">
        <div class="agenda-meta">
          <span v-if="agenda.timezone" class="meta-item">
            <span class="meta-label">{{ t('agenda.timezone') }}</span>
            <span class="meta-value">{{ agenda.timezone }}</span>
          </span>
          <span v-if="agenda.country" class="meta-item">
            <span class="meta-label">{{ t('agenda.country') }}</span>
            <span class="meta-value">{{ agenda.country }}</span>
          </span>
          <span class="meta-item">
            <span class="meta-label">{{ t('agenda.scenes') }}</span>
            <span class="meta-value">{{ agenda.totalScenes }}</span>
          </span>
          <span class="meta-item">
            <span class="meta-label">{{ t('agenda.duration') }}</span>
            <span class="meta-value">{{ fmtDuration(agenda.scenes.reduce((a, s) => a + sceneEffectiveDuration(s), 0)) }}</span>
          </span>
          <span class="meta-item">
            <span class="meta-label">{{ t('agenda.songs') }}</span>
            <span class="meta-value">{{ agenda.scenes.reduce((a, s) => a + sceneEffectiveSongCount(s), 0) }}</span>
          </span>
        </div>

        <NCollapse v-if="agenda.scenes.length" arrow-placement="right">
          <NCollapseItem
            v-for="(scene, idx) in agenda.scenes"
            :key="scene.id"
            :name="String(idx)"
          >
            <template #header>
              <div class="scene-header">
                <span class="scene-time">{{ fmtTimeArr(scene.firstEmissionTime) }} → {{ fmtTimeArr(scene.lastEmissionTime) }}</span>
                <NTag v-if="sceneStatus(scene)" :type="statusType(sceneStatus(scene))" size="small" :bordered="false">
                  {{ sceneStatus(scene).toLowerCase() }}
                </NTag>
                <span class="scene-title">{{ scene.title }}</span>
                <span v-if="sceneEffectiveDuration(scene) > 0" class="scene-dur">{{ fmtDuration(sceneEffectiveDuration(scene)) }}</span>
                <span class="scene-songs">{{ t('agenda.songs_count', { n: sceneEffectiveSongCount(scene) }) }}</span>
              </div>
            </template>

            <div v-if="!scene.timeline?.length" class="timeline-empty">{{ t('agenda.no_songs') }}</div>
            <template v-else>
              <div class="block-list">
                <div v-for="block in scene.timeline" :key="block.id" class="block-item">
                  <div class="block-row">
                    <span class="block-seq">#{{ block.sequenceNumber }}</span>
                    <span class="block-time">{{ fmtTimeArr(block.scheduledEmissionTime) }}</span>
                    <NTag size="small" :type="statusType(block.status)" :bordered="false">{{ (block.status ?? '').toLowerCase() }}</NTag>
                    <span class="block-dur">{{ fmtDurSec(block.durationSeconds) }}</span>
                    <span v-if="block.hasIntro" class="flag flag-intro">I</span>
                    <span v-if="block.hasJingle" class="flag flag-jingle">J</span>
                  </div>
                  <div v-for="song in block.songs" :key="song.songId" class="song-row">
                    <span class="song-title">{{ song.songTitle }}</span>
                    <span class="song-artist">{{ song.artist }}</span>
                    <span class="song-dur">{{ fmtDurSec(song.durationSeconds) }}</span>
                  </div>
                </div>
              </div>
            </template>
          </NCollapseItem>
        </NCollapse>

        <NEmpty v-else :description="t('agenda.no_scenes')" />
      </template>

      <NEmpty v-else-if="!loading && !error" :description="t('agenda.no_data')" />
    </NSpin>
  </NCard>
</template>

<style scoped>
.agenda-card {
  margin-top: 24px;
}

.refresh-btn {
  background: none;
  border: 1px solid rgba(128, 128, 128, 0.3);
  border-radius: 4px;
  padding: 2px 10px;
  cursor: pointer;
  font-size: 0.75rem;
  color: inherit;
  transition: border-color 0.15s, color 0.15s;
}
.refresh-btn:hover:not(:disabled) { border-color: #7C3AED; color: #7C3AED; }
.refresh-btn:disabled { opacity: 0.4; cursor: default; }

.agenda-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 24px;
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 1px solid rgba(128, 128, 128, 0.2);
}
.meta-item { display: flex; flex-direction: column; gap: 2px; }
.meta-label { font-size: 0.65rem; text-transform: uppercase; letter-spacing: 0.8px; opacity: 0.5; }
.meta-value { font-size: 0.9rem; font-weight: 600; }

.scene-header {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  padding: 2px 0;
}
.scene-time {
  font-family: monospace;
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.5px;
  white-space: nowrap;
  color: #7C3AED;
}
.scene-title {
  font-size: 0.85rem;
  font-weight: 500;
  flex: 1;
  min-width: 100px;
}
.scene-dur {
  font-size: 0.72rem;
  opacity: 0.5;
  font-family: monospace;
}
.scene-songs {
  font-size: 0.72rem;
  opacity: 0.6;
  white-space: nowrap;
}

.block-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px 0;
}
.block-item {
  border-left: 2px solid rgba(128, 128, 128, 0.25);
  padding-left: 12px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.block-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  padding: 2px 0;
}
.block-seq { font-family: monospace; font-size: 0.65rem; opacity: 0.5; min-width: 24px; }
.block-time { font-family: monospace; font-size: 0.7rem; font-weight: 600; color: #7C3AED; }
.block-dur { font-family: monospace; font-size: 0.65rem; opacity: 0.55; margin-left: auto; }

.flag {
  font-size: 0.6rem;
  font-weight: 700;
  width: 16px;
  height: 16px;
  border-radius: 3px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.flag-intro  { background: rgba(33, 150, 243, 0.15); color: #2196f3; }
.flag-jingle { background: rgba(245, 166, 35, 0.15);  color: #f5a623; }

.song-row {
  display: grid;
  grid-template-columns: 1fr max-content max-content;
  gap: 12px;
  align-items: center;
  padding: 3px 8px;
  border-radius: 4px;
  font-size: 0.8rem;
  background: rgba(128, 128, 128, 0.07);
}
.song-title  { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.song-artist { font-size: 0.7rem; opacity: 0.55; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.song-dur    { font-family: monospace; font-size: 0.65rem; opacity: 0.5; white-space: nowrap; }

.timeline-empty {
  padding: 12px 0;
  font-size: 0.8rem;
  opacity: 0.5;
}
</style>
