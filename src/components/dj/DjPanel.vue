<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { NButton, NDrawer, NDrawerContent, NModal, useMessage, useThemeVars } from 'naive-ui'
import GsapButton from '@/components/GsapButton.vue'
import DjLiveDeck from '@/components/dj/DjLiveDeck.vue'
import DjStationChat from '@/components/dj/DjStationChat.vue'
import { useDjColors } from '@/utils/djColors'
import { useStationChatStore } from '@/stores/stationChat'
import jesoosApiService from '@/services/jesoosApi'

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
  '--dj-d': djColors.value.d,
}))

// ── Session / ON AIR ────────────────────────────────────────────────
const sessionState = ref<'starting' | 'active' | 'error'>('starting')
const startedAt = ref(0)
const now = ref(Date.now())
const ending = ref(false)
let sessionEnded = false
let clockTimer: ReturnType<typeof setInterval> | null = null
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

function formatCountdown(seconds: number) {
  const mm = Math.floor(seconds / 60)
  const ss = String(seconds % 60).padStart(2, '0')
  return `${mm}:${ss}`
}

/**
 * Ending the session while the live deck still has a song going out to air would cut it off for
 * listeners instead of handing it back cleanly, so it goes through this guard.
 */
const liveDeck = ref<InstanceType<typeof DjLiveDeck> | null>(null)
const pendingLeaveLive = ref(false)
const leaveLiveModalShow = computed({
  get: () => pendingLeaveLive.value,
  set: (v: boolean) => { if (!v) pendingLeaveLive.value = false },
})
const leaveLiveBody = computed(() => t('dj.live_leave_while_broadcasting_body_end'))
const leaveLiveConfirmText = computed(() => t('dj.live_leave_while_broadcasting_confirm_end'))

function requestEndSession() {
  if (liveDeck.value?.broadcasting) {
    pendingLeaveLive.value = true
    return
  }
  void endSession()
}

function confirmLeaveLive() {
  pendingLeaveLive.value = false
  void endSession()
}

async function endSession() {
  pendingLeaveLive.value = false
  if (ending.value) return
  ending.value = true
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

// ── Chat ────────────────────────────────────────────────────────────
const chatOpen = ref(false)
const stationChat = useStationChatStore()
const stationChatRef = ref<{ activate: () => void } | null>(null)

// ── Live ────────────────────────────────────────────────────────────
/** The deck only ever runs Live: it streams its own mix to air, and the queue waits until the DJ hands the air back. */
function onLiveEnded(reason: string) {
  if (reason === 'dj_ended') message.success(t('dj.live_back'))
  else message.warning(t('dj.live_ended', { reason }), { duration: 8000 })
  emit('close')
}

const sessionActive = computed(() => sessionState.value === 'active')

onMounted(async () => {
  clockTimer = setInterval(() => { now.value = Date.now() }, 1000)
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
  if (keepAliveTimer) clearInterval(keepAliveTimer)
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
        <span>{{ sessionActive ? elapsed : '--:--' }}</span>
      </div>
      <div class="dj-topbar-buttons">
        <GsapButton @click="chatOpen = true">
          <span>{{ t('dj.chat_open') }}</span>
        </GsapButton>
        <GsapButton type="error" :loading="ending" :disabled="sessionState === 'starting'" @click="requestEndSession">
          <span>{{ t('dj.end_session') }}</span>
        </GsapButton>
      </div>
    </header>

    <!-- The station's own AI DJ, the one its listeners talk to; the deck joins as the signed-in owner. -->
    <NDrawer v-model:show="chatOpen" class="dj-chat-drawer" placement="right" :width="440" @after-enter="stationChatRef?.activate()">
      <NDrawerContent
        closable
        :native-scrollbar="false"
        :body-style="{ overflow: 'hidden', display: 'flex', flexDirection: 'column', flex: '1 1 auto', height: '100%' }"
        :body-content-style="{ flex: '1 1 auto', minHeight: 0, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxSizing: 'border-box' }"
      >
        <template #header>
          <div class="dj-chat-header">
            <span class="dj-chat-title">
              {{ stationChat.djName ? t('dj.chat_title_named', { name: stationChat.djName }) : t('dj.chat_title') }}
            </span>
            <div v-if="stationChat.username || stationChat.userLabels.length" class="dj-chat-meta">
              <span v-if="stationChat.username" class="dj-chat-user">{{ stationChat.username }}</span>
              <span
                v-for="label in stationChat.userLabels"
                :key="label"
                class="dj-chat-pill"
                :class="`dj-chat-pill--${label}`"
              >{{ label }}</span>
            </div>
          </div>
        </template>
        <DjStationChat ref="stationChatRef" :brand-slug="brandSlug" />
      </NDrawerContent>
    </NDrawer>

    <p v-if="sessionState === 'starting'" class="dj-banner">{{ t('dj.starting') }}</p>
    <p v-else-if="sessionState === 'error'" class="dj-banner dj-banner--error">
      {{ t('dj.session_error') }}
      <NButton size="small" @click="startSession">{{ t('dj.retry') }}</NButton>
    </p>

    <p v-if="sessionExpiresIn !== null" class="dj-banner dj-banner--error">
      {{ sessionExpiresIn > 0
        ? t('dj.session_expiring', { time: formatCountdown(sessionExpiresIn) })
        : t('dj.session_expired') }}
    </p>

    <section v-if="sessionActive" class="dj-section">
      <h3 class="dj-section-title">{{ t('dj.live_mixer') }}</h3>
      <DjLiveDeck ref="liveDeck" :brand-slug="brandSlug" @ended="onLiveEnded" />
    </section>

    <NModal
      v-model:show="leaveLiveModalShow"
      preset="dialog"
      type="warning"
      :title="t('dj.live_leave_while_broadcasting_title')"
      :content="leaveLiveBody"
      :positive-text="leaveLiveConfirmText"
      :negative-text="t('dj.live_leave_while_broadcasting_cancel')"
      @positive-click="confirmLeaveLive"
      @negative-click="pendingLeaveLive = false"
    />
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

.dj-topbar-buttons {
  display: flex;
  align-items: center;
  gap: 3px;
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

@media (max-width: 768px) {
  .dj-asset-field {
    width: 100%;
  }

}

.dj-chat-header {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px 10px;
  min-width: 0;
  padding-right: 8px;
}

.dj-chat-title {
  font-size: 0.85rem;
  font-weight: 600;
  line-height: 1.3;
  white-space: nowrap;
}

.dj-chat-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px 6px;
  min-width: 0;
}

.dj-chat-user {
  font-size: 0.72rem;
  font-weight: 500;
  opacity: 0.65;
}

.dj-chat-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  color: rgba(128, 128, 128, 0.85);
  border: 1px solid rgba(128, 128, 128, 0.35);
  border-radius: 3px;
  padding: 2px 4px 1px;
  line-height: 1;
}

.dj-chat-pill--developer {
  color: #ff6b6b;
  border-color: rgba(255, 107, 107, 0.5);
}

.dj-chat-pill--owner {
  color: #f0a500;
  border-color: rgba(240, 165, 0, 0.5);
}

.dj-chat-pill--artist {
  color: #22c55e;
  border-color: rgba(34, 197, 94, 0.5);
}
</style>

<style>
/* The chat drawer teleports to body, so its inner layout needs unscoped selectors. */
.dj-chat-drawer .n-drawer-content {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.dj-chat-drawer .n-drawer-body {
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden !important;
  display: flex;
  flex-direction: column;
}

.dj-chat-drawer .n-drawer-body-content-wrapper {
  flex: 1 1 auto;
  min-height: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.dj-chat-drawer .n-drawer-header__main {
  flex: 1 1 auto;
  min-width: 0;
}
</style>
