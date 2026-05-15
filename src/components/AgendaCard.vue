<script setup lang="ts">
import { ref, watch, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { NCard, NSpin, NAlert, NTag, NEmpty, NButton, NIcon, NTooltip } from 'naive-ui'
import { CreateOutline as EditIcon, SwapHorizontalOutline as ReplaceIcon } from '@vicons/ionicons5'
import jesoosApiService, { type Agenda, type AgendaScene } from '@/services/jesoosApi'

const { t } = useI18n()

const props = defineProps<{ brandSlug: string; alive?: boolean }>()
const emit = defineEmits<{
  editSong: [songId: string, blockId: string]
  replaceSong: [songId: string, blockId: string]
}>()

const loading = ref(false)
const refreshing = ref(false)
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
  const isInitial = agenda.value === null
  if (isInitial) loading.value = true
  else refreshing.value = true
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
    refreshing.value = false
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
      <button class="refresh-btn" :disabled="loading || refreshing" @click="fetchAgenda">
        <span v-if="refreshing" class="refresh-spinner" />
        {{ t('agenda.refresh') }}
      </button>
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

        <div v-if="agenda.scenes.length" class="scenes-grid">
          <div v-for="scene in agenda.scenes" :key="scene.id" class="scene-tile">
            <div class="scene-tile-top">
              <div class="scene-tile-head">
                <span class="scene-time">{{ fmtTimeArr(scene.firstEmissionTime) }} → {{ fmtTimeArr(scene.lastEmissionTime) }}</span>
                <NTag v-if="sceneStatus(scene)" :type="statusType(sceneStatus(scene))" size="small" :bordered="false" class="scene-status-tag">
                  {{ sceneStatus(scene).toLowerCase() }}
                </NTag>
              </div>
              <div class="scene-tile-title">{{ scene.title }}</div>
              <div class="scene-tile-sub">
                <span v-if="sceneEffectiveDuration(scene) > 0" class="scene-dur">{{ fmtDuration(sceneEffectiveDuration(scene)) }}</span>
                <span class="scene-songs-count">{{ t('agenda.songs_count', { n: sceneEffectiveSongCount(scene) }) }}</span>
              </div>
            </div>

            <div class="tile-song-list">
              <template v-for="block in scene.timeline" :key="block.id">
                <div v-for="song in block.songs" :key="song.songId" class="tile-song-row">
                  <div class="tile-song-info">
                    <span class="tile-song-title">{{ song.songTitle }}</span>
                    <div class="tile-song-bottom">
                      <span class="tile-song-artist">{{ song.artist }}</span>
                      <span v-if="song.shared && song.sharerName" class="song-sharer-badge">
                        {{ song.sharerName }}
                      </span>
                    </div>
                  </div>
                  <div class="tile-song-actions">
                    <span class="tile-song-dur">{{ fmtDurSec(song.durationSeconds) }}</span>
                    <NTooltip trigger="hover" :delay="400">
                      <template #trigger>
                        <NButton size="tiny" quaternary circle @click="emit('editSong', song.songId, block.id)">
                          <template #icon><NIcon size="13"><EditIcon /></NIcon></template>
                        </NButton>
                      </template>
                      {{ t('agenda.edit_song') }}
                    </NTooltip>
                    <NTooltip trigger="hover" :delay="400">
                      <template #trigger>
                        <NButton size="tiny" quaternary circle @click="emit('replaceSong', song.songId, block.id)">
                          <template #icon><NIcon size="13"><ReplaceIcon /></NIcon></template>
                        </NButton>
                      </template>
                      {{ t('agenda.replace_song') }}
                    </NTooltip>
                  </div>
                </div>
              </template>
              <div v-if="!scene.timeline?.length" class="tile-empty">{{ t('agenda.no_songs') }}</div>
            </div>
          </div>
        </div>

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
  display: flex;
  align-items: center;
  gap: 6px;
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

.refresh-spinner {
  display: inline-block;
  width: 10px;
  height: 10px;
  border: 1.5px solid currentColor;
  border-top-color: transparent;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

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

/* Tile grid */
.scenes-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 14px;
}

.scene-tile {
  border: 1px solid rgba(128, 128, 128, 0.2);
  border-radius: 8px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.scene-tile-top {
  padding: 10px 12px 8px;
  border-bottom: 1px solid rgba(128, 128, 128, 0.15);
  background: rgba(124, 58, 237, 0.05);
}

.scene-tile-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.scene-time {
  font-family: monospace;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.4px;
  color: #7C3AED;
  white-space: nowrap;
}

.scene-status-tag {
  flex-shrink: 0;
}

.scene-tile-title {
  font-size: 0.82rem;
  font-weight: 600;
  line-height: 1.3;
  margin-bottom: 4px;
}

.scene-tile-sub {
  display: flex;
  gap: 10px;
  align-items: center;
}

.scene-dur,
.scene-songs-count {
  font-size: 0.68rem;
  opacity: 0.55;
  font-family: monospace;
}

/* Song list inside tile */
.tile-song-list {
  display: flex;
  flex-direction: column;
  flex: 1;
}

.tile-song-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border-bottom: 1px solid rgba(128, 128, 128, 0.08);
  min-width: 0;
}
.tile-song-row:last-child { border-bottom: none; }
.tile-song-row:hover { background: rgba(128, 128, 128, 0.05); }

.tile-song-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.tile-song-title {
  font-size: 0.78rem;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tile-song-bottom {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.tile-song-artist {
  font-size: 0.68rem;
  opacity: 0.5;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex-shrink: 1;
  min-width: 0;
}

.song-sharer-badge {
  flex-shrink: 0;
  font-size: 0.62rem;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: 3px;
  color: #7C3AED;
  background: rgba(124, 58, 237, 0.12);
  border: 1px solid rgba(124, 58, 237, 0.3);
  white-space: nowrap;
  max-width: 80px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tile-song-actions {
  display: flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
}

.tile-song-dur {
  font-family: monospace;
  font-size: 0.62rem;
  opacity: 0.45;
  white-space: nowrap;
  margin-right: 4px;
}

.tile-empty {
  padding: 12px;
  font-size: 0.78rem;
  opacity: 0.45;
  text-align: center;
}
</style>
