<template>
  <div class="ask-page">
    <header class="nav">
      <div class="logo" role="link" tabindex="0" @click="router.push('/')" @keydown.enter="router.push('/')">MIXPLA</div>
      <div class="nav-meta">
        <span class="status-dot" :class="connected ? 'online' : 'offline'" />
        <span class="status-label">{{ connected ? t('ask.connected') : t('ask.connecting') }}</span>
        <span v-if="username" class="user-label">{{ username }}</span>
      </div>
    </header>

    <section class="ask-shell">
      <div class="ask-header">
        <p class="eyebrow neon-motto">{{ t('ask.eyebrow') }}</p>
        <h1>{{ t('ask.title') }}</h1>
      </div>

      <div ref="messagesEl" class="ask-messages" role="log" aria-live="polite">
        <div v-if="messages.length === 0 && !processing" class="ask-empty">
          <p class="empty-welcome">{{ t('ask.empty_welcome') }}</p>
          <div class="suggestions">
            <button
              v-for="(prompt, i) in suggestedPrompts"
              :key="i"
              type="button"
              class="suggestion"
              :disabled="!connected || isBusy"
              @click="sendSuggested(prompt)"
            >
              {{ prompt }}
            </button>
          </div>
        </div>

        <div
          v-for="msg in messages"
          :key="msg.id"
          class="ask-msg"
          :class="msg.type"
        >
          <span class="ask-msg-user">{{ msg.username }}</span>
          <div class="ask-msg-bubble" v-html="renderContent(msg)" />
        </div>

        <div v-if="processing" class="ask-msg PROCESSING">
          <span class="ask-msg-user">system</span>
          <div class="ask-msg-bubble">
            <span class="processing-dot" />
            {{ processing }}
          </div>
        </div>
      </div>

      <div class="ask-composer">
        <n-input
          v-model:value="draft"
          type="textarea"
          :placeholder="connected ? t('ask.placeholder') : t('ask.connecting')"
          :disabled="!connected || isBusy"
          :autosize="{ minRows: 1, maxRows: 5 }"
          @keydown="onComposerKeydown"
        />
        <GsapButton type="primary" size="large" :disabled="!canSend" @click="sendDraft">
          <span>{{ t('ask.send') }}</span>
        </GsapButton>
      </div>
    </section>

    <footer class="footer">
      <div class="copyright">© Mixpla</div>
      <a class="back-link" href="#" @click.prevent="router.push('/')">{{ t('ask.back_home') }}</a>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'
import MarkdownIt from 'markdown-it'
import { NInput, useMessage } from 'naive-ui'
import GsapButton from '@/components/GsapButton.vue'
import { useAskChatStore, type AskChatMessage } from '@/stores/askChat'

const { t } = useI18n()
const router = useRouter()
const askStore = useAskChatStore()
const { messages, connected, processing, username, isBusy } = storeToRefs(askStore)
const messageApi = useMessage()

const md = new MarkdownIt({ linkify: true, breaks: true })
const draft = ref('')
const messagesEl = ref<HTMLElement | null>(null)

const suggestedPrompts = computed(() => [
  t('ask.suggestion_1'),
  t('ask.suggestion_2'),
  t('ask.suggestion_3'),
])

const canSend = computed(() => connected.value && !isBusy.value && !!draft.value.trim())

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function renderContent(msg: AskChatMessage): string {
  if (msg.type === 'ERROR' || msg.type === 'SYSTEM' || msg.type === 'USER') {
    return escapeHtml(msg.content)
  }
  return md.render(msg.content || '')
}

function scrollToBottom() {
  nextTick(() => {
    const el = messagesEl.value
    if (el) el.scrollTop = el.scrollHeight
  })
}

watch(messages, () => scrollToBottom(), { deep: true })
watch(processing, (val) => {
  if (val) scrollToBottom()
})

watch(
  () => messages.value.filter((m) => m.type === 'ERROR').length,
  (count, prev) => {
    if (count > (prev ?? 0)) {
      const last = [...messages.value].reverse().find((m) => m.type === 'ERROR')
      if (last) messageApi.error(last.content)
    }
  },
)

function sendDraft() {
  const text = draft.value.trim()
  if (!text) return
  if (askStore.send(text)) draft.value = ''
}

function sendSuggested(prompt: string) {
  if (askStore.send(prompt)) draft.value = ''
}

function onComposerKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    sendDraft()
  }
}

onMounted(() => {
  askStore.connect()
})

onBeforeUnmount(() => {
  askStore.disconnect()
})
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

@font-face {
  font-family: 'Kaylon';
  src: url('/src/assets/fonts/kaylonbold.otf') format('opentype');
  font-weight: 700;
  font-style: normal;
  font-display: swap;
}

:global(body) {
  background: #050505;
}

.ask-page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: #050505;
  color: #f5f5f5;
  font-family: 'Inter', sans-serif;
  padding: 24px clamp(16px, 4vw, 64px) 16px;
}

.nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding-bottom: 16px;
}

.logo {
  font-family: 'Kaylon', 'Inter', sans-serif;
  font-weight: 700;
  letter-spacing: 0.24em;
  font-size: clamp(1.1rem, 2vw, 1.6rem);
  color: #c0c0c0;
  cursor: pointer;
}

.nav-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #888;
  font-size: 0.8rem;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #555;
}

.status-dot.online {
  background: #68ffba;
  box-shadow: 0 0 8px rgba(104, 255, 186, 0.5);
}

.status-dot.offline {
  background: #ff6b6b;
}

.user-label {
  color: #b0b0b0;
  padding-left: 8px;
  border-left: 1px solid #2a2a2a;
}

.ask-shell {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  max-width: 820px;
  width: 100%;
  margin: 0 auto;
  border: 1px solid #1f1f1f;
  border-radius: 12px;
  background: linear-gradient(180deg, #0f0f0f 0%, #0a0a0a 100%);
  overflow: hidden;
}

.ask-header {
  padding: 20px 20px 12px;
  border-bottom: 1px solid #1a1a1a;
}

.eyebrow {
  letter-spacing: 0.4em;
  text-transform: uppercase;
  color: #888;
  font-size: 0.75rem;
  margin: 0 0 8px;
}

.neon-motto {
  text-shadow: 0 0 5px #ffa500, 0 0 15px #ffa500, 0 0 20px #ffa500;
  color: #fff6a9;
}

.ask-header h1 {
  margin: 0;
  font-size: clamp(1.25rem, 2.5vw, 1.75rem);
  font-weight: 600;
}

.ask-messages {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-height: 280px;
  max-height: calc(100vh - 280px);
}

.ask-empty {
  margin: auto 0;
  text-align: center;
  padding: 24px 8px;
}

.empty-welcome {
  color: #b0b0b0;
  margin: 0 0 20px;
  font-size: 0.95rem;
}

.suggestions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: center;
}

.suggestion {
  background: #141414;
  border: 1px solid #2a2a2a;
  color: #ddd;
  border-radius: 8px;
  padding: 10px 14px;
  font-size: 0.85rem;
  cursor: pointer;
  transition: border-color 0.15s ease, background 0.15s ease;
}

.suggestion:hover:not(:disabled) {
  border-color: #ff7a18;
  background: #1a1210;
}

.suggestion:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.ask-msg {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-width: min(85%, 560px);
}

.ask-msg.USER {
  align-self: flex-end;
  align-items: flex-end;
}

.ask-msg.BOT,
.ask-msg.ERROR,
.ask-msg.SYSTEM,
.ask-msg.PROCESSING {
  align-self: flex-start;
  align-items: flex-start;
}

.ask-msg-user {
  font-size: 0.7rem;
  color: #666;
  letter-spacing: 0.04em;
  text-transform: lowercase;
}

.ask-msg-bubble {
  font-size: 0.92rem;
  line-height: 1.45;
  padding: 10px 14px;
  border-radius: 14px;
  word-break: break-word;
  white-space: pre-wrap;
}

.ask-msg.USER .ask-msg-bubble {
  background: linear-gradient(120deg, #ff7a18, #af002d 70%);
  color: #fff;
  border-bottom-right-radius: 4px;
  white-space: pre-wrap;
}

.ask-msg.BOT .ask-msg-bubble {
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.88);
  border-bottom-left-radius: 4px;
  white-space: normal;
}

.ask-msg.ERROR .ask-msg-bubble {
  background: rgba(255, 71, 87, 0.12);
  color: #ff6b6b;
  border-bottom-left-radius: 4px;
}

.ask-msg.PROCESSING .ask-msg-bubble {
  background: transparent;
  color: rgba(255, 255, 255, 0.4);
  font-size: 0.8rem;
  font-style: italic;
  padding: 4px 6px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.processing-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #ff7a18;
  opacity: 0.7;
  animation: blink 1.4s ease-in-out infinite;
  flex-shrink: 0;
}

.ask-msg-bubble :deep(p) {
  margin: 0 0 6px;
}

.ask-msg-bubble :deep(p:last-child) {
  margin-bottom: 0;
}

.ask-msg-bubble :deep(ul),
.ask-msg-bubble :deep(ol) {
  margin: 4px 0;
  padding-left: 18px;
}

.ask-msg-bubble :deep(code) {
  font-family: ui-monospace, monospace;
  font-size: 0.85em;
  background: rgba(0, 0, 0, 0.35);
  padding: 1px 4px;
  border-radius: 3px;
}

.ask-msg-bubble :deep(a) {
  color: #58d6ff;
}

.ask-composer {
  display: flex;
  gap: 10px;
  align-items: flex-end;
  padding: 14px 16px calc(14px + env(safe-area-inset-bottom));
  border-top: 1px solid #1a1a1a;
  background: #0c0c0c;
}

.ask-composer :deep(.n-input) {
  flex: 1;
}

.footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  padding-top: 20px;
  margin-top: 16px;
  border-top: 1px solid #1a1a1a;
  color: #444;
  font-size: 0.8rem;
}

.back-link {
  color: #888;
  text-decoration: none;
}

.back-link:hover {
  color: #ccc;
}

@keyframes blink {
  0%, 100% { opacity: 0.35; }
  50% { opacity: 1; }
}

@media (max-width: 640px) {
  .ask-page {
    padding: 16px 12px 12px;
  }

  .ask-messages {
    max-height: calc(100vh - 260px);
    padding: 14px;
  }

  .ask-msg {
    max-width: 92%;
  }

  .ask-composer {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
