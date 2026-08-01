<template>
  <div class="dock">
    <div v-if="username || userLabels.length" class="dock-user">
      <span v-if="username" class="dock-user-name">{{ username }}</span>
      <div v-if="userLabels.length" class="dock-user-pills">
        <span
          v-for="label in userLabels"
          :key="label"
          class="dock-user-pill"
          :class="`dock-user-pill--${label}`"
        >{{ label }}</span>
      </div>
    </div>

    <div ref="messagesEl" class="dock-messages" role="log" aria-live="polite">
      <div v-if="messages.length === 0 && !processing" class="dock-empty">
        <p class="dock-welcome">{{ t('ask.empty_welcome') }}</p>
        <div class="dock-suggestions">
          <button
            v-for="(prompt, i) in suggestedPrompts"
            :key="i"
            type="button"
            class="dock-suggestion"
            :disabled="!connected || isBusy"
            @click="sendSuggested(prompt)"
          >
            {{ prompt }}
          </button>
        </div>
      </div>

      <div v-for="msg in messages" :key="msg.id" class="dock-msg" :class="msg.type">
        <span class="dock-msg-user">{{ msg.username }}</span>
        <div class="dock-msg-bubble" v-html="renderContent(msg)" />
      </div>

      <div v-if="processing" class="dock-msg PROCESSING">
        <span class="dock-msg-user">system</span>
        <div class="dock-msg-bubble">
          <span class="dock-dot" />
          {{ processing }}
        </div>
      </div>
    </div>

    <div class="dock-composer">
      <n-input
        ref="composerRef"
        v-model:value="draft"
        type="textarea"
        :placeholder="connected ? t('ask.placeholder') : t('ask.connecting')"
        :disabled="!connected"
        :autosize="{ minRows: 1, maxRows: 4 }"
        @keydown="onComposerKeydown"
      />
      <n-button type="primary" :disabled="!canSend" @click="sendDraft">
        {{ t('ask.send') }}
      </n-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'
import MarkdownIt from 'markdown-it'
import { NInput, NButton, type InputInst } from 'naive-ui'
import { useAskChatStore, type AskChatMessage } from '@/stores/askChat'

const { t } = useI18n()
const askStore = useAskChatStore()
const { messages, connected, processing, isBusy, username, userLabels } = storeToRefs(askStore)

const md = new MarkdownIt({ linkify: true, breaks: true })
const draft = ref('')
const messagesEl = ref<HTMLElement | null>(null)
const composerRef = ref<InputInst | null>(null)

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
watch(processing, () => scrollToBottom())
watch(() => askStore.streamingMessageId, () => scrollToBottom())

function focusComposer() {
  nextTick(() => composerRef.value?.focus())
}

/** Scroll to latest messages and focus the composer (e.g. when the drawer opens). */
function activate() {
  scrollToBottom()
  focusComposer()
}

defineExpose({ activate })

watch(connected, (ok) => {
  if (ok) focusComposer()
})

function sendDraft() {
  const text = draft.value.trim()
  if (!text) return
  if (askStore.send(text)) {
    draft.value = ''
    focusComposer()
  }
}

function sendSuggested(prompt: string) {
  if (askStore.send(prompt)) {
    draft.value = ''
    focusComposer()
  }
}

function onComposerKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    sendDraft()
  }
}

// The dock mounts inside an already-authenticated shell, so the store picks up
// the OIDC token straight away — no auth init to wait on here.
onMounted(() => {
  askStore.connect()
  activate()
})

onBeforeUnmount(() => {
  askStore.disconnect()
})
</script>

<style scoped>
.dock {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.dock-user {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
  padding-bottom: 10px;
  margin-bottom: 4px;
  border-bottom: 1px solid var(--n-divider-color, rgba(128, 128, 128, 0.2));
  flex-shrink: 0;
}

.dock-user-name {
  font-size: 0.8rem;
  opacity: 0.7;
}

.dock-user-pills {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 4px;
}

.dock-user-pill {
  display: inline-block;
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  color: rgba(128, 128, 128, 0.8);
  border: 1px solid rgba(128, 128, 128, 0.35);
  border-radius: 3px;
  padding: 0 4px;
  line-height: 1.4;
}

.dock-user-pill--developer {
  color: #ff6b6b;
  border-color: rgba(255, 107, 107, 0.5);
}

.dock-user-pill--owner {
  color: #f0a500;
  border-color: rgba(240, 165, 0, 0.5);
}

.dock-user-pill--artist {
  color: #22c55e;
  border-color: rgba(34, 197, 94, 0.5);
}

.dock-messages {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-bottom: 12px;
}

.dock-empty {
  margin: auto 0;
  text-align: center;
}

.dock-welcome {
  margin: 0 0 16px;
  font-size: 0.9rem;
  opacity: 0.75;
}

.dock-suggestions {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.dock-suggestion {
  border: 1px solid var(--n-divider-color, rgba(128, 128, 128, 0.3));
  background: transparent;
  color: inherit;
  border-radius: 8px;
  padding: 9px 12px;
  font-size: 0.82rem;
  text-align: left;
  cursor: pointer;
  transition: border-color 0.15s ease;
}

.dock-suggestion:hover:not(:disabled) {
  border-color: var(--n-color-target, #ff7a18);
}

.dock-suggestion:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.dock-msg {
  display: flex;
  flex-direction: column;
  gap: 3px;
  max-width: 92%;
}

.dock-msg.USER {
  align-self: flex-end;
  align-items: flex-end;
}

.dock-msg.BOT,
.dock-msg.ERROR,
.dock-msg.SYSTEM,
.dock-msg.PROCESSING {
  align-self: flex-start;
  align-items: flex-start;
}

.dock-msg-user {
  font-size: 0.65rem;
  opacity: 0.5;
  letter-spacing: 0.04em;
  text-transform: lowercase;
}

.dock-msg-bubble {
  font-size: 0.86rem;
  line-height: 1.45;
  padding: 8px 12px;
  border-radius: 12px;
  word-break: break-word;
  white-space: pre-wrap;
}

.dock-msg.USER .dock-msg-bubble {
  background: linear-gradient(120deg, #ff7a18, #af002d 70%);
  color: #fff;
  border-bottom-right-radius: 4px;
}

.dock-msg.BOT .dock-msg-bubble {
  background: rgba(128, 128, 128, 0.14);
  border-bottom-left-radius: 4px;
  white-space: normal;
}

.dock-msg.ERROR .dock-msg-bubble {
  background: rgba(255, 71, 87, 0.12);
  color: #ff6b6b;
  border-bottom-left-radius: 4px;
}

.dock-msg.PROCESSING .dock-msg-bubble {
  background: transparent;
  opacity: 0.55;
  font-size: 0.78rem;
  font-style: italic;
  padding: 2px 4px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.dock-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #ff7a18;
  animation: dock-blink 1.4s ease-in-out infinite;
  flex-shrink: 0;
}

.dock-msg-bubble :deep(p) {
  margin: 0 0 6px;
}

.dock-msg-bubble :deep(p:last-child) {
  margin-bottom: 0;
}

.dock-msg-bubble :deep(ul),
.dock-msg-bubble :deep(ol) {
  margin: 4px 0;
  padding-left: 18px;
}

.dock-msg-bubble :deep(code) {
  font-family: ui-monospace, monospace;
  font-size: 0.85em;
  background: rgba(0, 0, 0, 0.25);
  padding: 1px 4px;
  border-radius: 3px;
}

.dock-composer {
  display: flex;
  gap: 8px;
  align-items: flex-end;
  padding-top: 12px;
  border-top: 1px solid var(--n-divider-color, rgba(128, 128, 128, 0.2));
  flex-shrink: 0;
}

.dock-composer :deep(.n-input) {
  flex: 1;
}

@keyframes dock-blink {
  0%, 100% { opacity: 0.35; }
  50% { opacity: 1; }
}
</style>
