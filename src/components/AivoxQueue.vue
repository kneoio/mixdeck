<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { NIcon } from 'naive-ui'
import { CopyOutline, Play } from '@vicons/ionicons5'
import type { AivoxQueueEntry } from '@/services/aivoxApi'

const props = defineProps<{ entries: AivoxQueueEntry[] }>()
const { t, te } = useI18n()

const sortedQueueEntries = computed(() =>
  [...props.entries].sort((a, b) => a.tech.pos - b.tech.pos)
)

const copiedKey = ref<string | null>(null)

function itemKey(item: AivoxQueueEntry): string {
  return `${item.tech.slugName}-${item.tech.pos}`
}

function copySongInfo(item: AivoxQueueEntry) {
  navigator.clipboard.writeText(`${item.songInfo.title} - ${item.songInfo.artist}`)
  copiedKey.value = itemKey(item)
  setTimeout(() => { copiedKey.value = null }, 1500)
}

function queueTypeLabel(item: AivoxQueueEntry): string {
  if (item.tech.queueType === 'playing') return t('dashboard.queue.nowPlaying')
  if (item.tech.queueType === 'played') return t('dashboard.queue.played')
  if (item.tech.queueType === 'prioritized') return t('dashboard.queue.upNext')
  return t('dashboard.queue.inQueue')
}

function mergingMethodLabel(item: AivoxQueueEntry): string {
  const method = String(item.tech.mergingMethod ?? 'NOT_MIXED').trim() || 'NOT_MIXED'
  const key = `dashboard.queue.mixing.${method}`
  if (te(key)) return t(key)
  return method.replace(/_/g, ' ').toLowerCase()
}
</script>

<template>
  <div class="queue-wrap">
    <template v-for="(item, i) in sortedQueueEntries" :key="`${item.tech.slugName}-${item.tech.pos}`">
      <span v-if="i > 0" class="queue-connector">›</span>
      <div
        class="queue-item"
        :class="[`queue-item--${item.tech.queueType}`]"
      >
        <div class="queue-indicator">
          <span v-if="item.tech.queueType === 'playing'" class="queue-eq">
            <span class="bar" /><span class="bar" /><span class="bar" />
          </span>
          <span v-else class="queue-num">{{ item.tech.pos }}</span>
        </div>
        <div class="queue-info">
          <span class="queue-title">{{ item.songInfo.title }}</span>
          <span class="queue-sep">·</span>
          <span class="queue-artist">{{ item.songInfo.artist }}</span>
          <button
            type="button"
            class="queue-copy-btn"
            :title="t('dashboard.queue.copy')"
            @click="copySongInfo(item)"
          >
            <NIcon :component="CopyOutline" size="12" />
            <span v-if="copiedKey === itemKey(item)" class="queue-copy-tooltip">{{ t('dashboard.queue.copied') }}</span>
          </button>
        </div>
        <div class="queue-right">
          <span class="queue-mixing">{{ mergingMethodLabel(item) }}</span>
          <span
            class="queue-type-tag"
            :class="`queue-type-tag--${item.tech.queueType}`"
            :title="queueTypeLabel(item)"
          >
            <NIcon
              v-if="item.tech.queueType === 'playing'"
              class="queue-type-icon"
              :component="Play"
              size="12"
            />
            <span class="queue-type-label">{{ queueTypeLabel(item) }}</span>
          </span>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.queue-wrap {
  margin-top: 10px;
  display: flex;
  flex-direction: row;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}
.queue-connector {
  font-size: 16px;
  opacity: 0.25;
  flex-shrink: 0;
  line-height: 1;
  user-select: none;
}
.queue-item {
  display: flex;
  align-items: center;
  gap: 10px;
  border-radius: 4px;
  padding: 7px 10px;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.07);
  flex-shrink: 0;
}
.queue-indicator {
  flex-shrink: 0;
  width: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.queue-num {
  font-size: 11px;
  font-weight: 600;
  opacity: 0.35;
  font-variant-numeric: tabular-nums;
}
.queue-eq {
  display: flex;
  align-items: flex-end;
  gap: 2px;
  height: 13px;
}
.queue-eq .bar {
  width: 3px;
  background: rgba(255, 214, 0, 0.9);
  border-radius: 1px;
  transform-origin: bottom;
  animation: eq-pulse 0.9s ease-in-out infinite alternate;
}
.queue-eq .bar:nth-child(1) { height: 7px; animation-delay: 0s; }
.queue-eq .bar:nth-child(2) { height: 13px; animation-delay: 0.18s; }
.queue-eq .bar:nth-child(3) { height: 5px; animation-delay: 0.09s; }
@keyframes eq-pulse {
  0%   { transform: scaleY(0.35); }
  100% { transform: scaleY(1); }
}
.queue-info {
  display: flex;
  align-items: baseline;
  gap: 5px;
  white-space: nowrap;
}
.queue-title {
  font-weight: 600;
}
.queue-sep {
  opacity: 0.25;
  flex-shrink: 0;
}
.queue-artist {
  font-size: 0.88em;
  opacity: 0.6;
}
.queue-copy-btn {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  padding: 0;
  border: none;
  background: transparent;
  color: inherit;
  opacity: 0.4;
  cursor: pointer;
  border-radius: 3px;
  flex-shrink: 0;
}
.queue-copy-btn:hover {
  opacity: 0.9;
  background: rgba(255, 255, 255, 0.08);
}
.queue-copy-tooltip {
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  margin-bottom: 4px;
  font-size: 10px;
  white-space: nowrap;
  background: rgba(0, 0, 0, 0.8);
  color: #fff;
  padding: 2px 6px;
  border-radius: 3px;
  pointer-events: none;
}
.queue-right {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 8px;
}
.queue-mixing {
  font-size: 10px;
  opacity: 0.45;
  font-style: italic;
  white-space: nowrap;
}
.queue-type-tag {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  padding: 2px 6px;
  border-radius: 3px;
  white-space: nowrap;
}
.queue-type-tag--playing {
  background: rgba(255, 214, 0, 0.15);
  color: #FFD600;
  border: 1px solid rgba(255, 214, 0, 0.35);
}
.queue-type-tag--prioritized {
  background: rgba(24, 160, 88, 0.1);
  color: rgba(24, 160, 88, 0.9);
  border: 1px solid rgba(24, 160, 88, 0.3);
}
.queue-type-tag--played {
  background: transparent;
  opacity: 0.4;
  border: 1px solid rgba(255,255,255,0.12);
}
.queue-type-tag--regular {
  background: transparent;
  opacity: 0.5;
  border: 1px solid rgba(255,255,255,0.12);
}
.queue-item--playing {
  border-color: rgba(255, 214, 0, 0.25);
  background: rgba(255, 214, 0, 0.06);
  box-shadow: 0 0 0 1px rgba(255, 214, 0, 0.15);
}
.queue-item--played {
  opacity: 0.5;
}
.queue-item--prioritized {
  border-color: rgba(24, 160, 88, 0.2);
  background: rgba(24, 160, 88, 0.04);
}
.queue-item--regular {
  border-color: rgba(255, 255, 255, 0.08);
}
.queue-type-icon {
  display: none;
}
.queue-type-label {
  display: inline;
}
@media (max-width: 768px) {
  .queue-wrap {
    flex-direction: column;
    align-items: stretch;
    gap: 4px;
  }
  .queue-connector {
    display: none;
  }
  .queue-item {
    width: 100%;
    box-sizing: border-box;
    flex-shrink: 1;
    overflow: hidden;
    gap: 6px;
    padding: 5px 8px;
  }
  .queue-info {
    flex: 1;
    min-width: 0;
    overflow: hidden;
  }
  .queue-title {
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .queue-artist {
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: none;
    flex: 1;
    min-width: 0;
  }
  .queue-copy-btn {
    display: none;
  }
  .queue-mixing {
    display: none;
  }
  .queue-type-tag {
    padding: 2px 4px;
  }
  .queue-type-tag--playing {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    padding: 0;
  }
  .queue-type-tag--playing .queue-type-icon {
    display: inline-flex;
  }
  .queue-type-tag--playing .queue-type-label {
    display: none;
  }
  .queue-type-tag--playing :deep(svg) {
    display: block;
  }
}
</style>
