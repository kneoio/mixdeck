<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { NButton, NInput, NScrollbar, useMessage } from 'naive-ui'
import djApiService, { type DjChatContext, type DjChatTurn } from '@/services/djApi'

const props = defineProps<{
  brandSlug: string
  context: DjChatContext
}>()
const emit = defineEmits<{ 'voice-generated': [buffer: AudioBuffer, script: string] }>()

const { t } = useI18n()
const message = useMessage()

interface ChatMessage extends DjChatTurn {
  script?: string
  error?: boolean
}

const messages = ref<ChatMessage[]>([])
const input = ref('')
const sending = ref(false)
const generatingFor = ref<number | null>(null)

async function send() {
  const value = input.value.trim()
  if (!value || sending.value) return
  const history: DjChatTurn[] = messages.value.map(({ role, text }) => ({ role, text }))
  messages.value.push({ role: 'user', text: value })
  input.value = ''
  sending.value = true
  try {
    const res = await djApiService.chat(props.brandSlug, { message: value, history, context: props.context })
    messages.value.push({ role: 'dj', text: res.reply, script: res.script })
  } catch {
    messages.value.push({ role: 'dj', text: t('dj.chat_error'), error: true })
  } finally {
    sending.value = false
  }
}

async function useScript(index: number) {
  const script = messages.value[index]?.script
  if (!script || generatingFor.value !== null) return
  generatingFor.value = index
  try {
    const voice = await djApiService.generateVoice(props.brandSlug, { script, context: props.context })
    emit('voice-generated', voice.buffer, voice.script)
    message.success(t('dj.chat_used_script'))
  } catch {
    message.error(t('dj.generate_error'))
  } finally {
    generatingFor.value = null
  }
}
</script>

<template>
  <div class="dj-chat">
    <NScrollbar class="dj-chat-log">
      <p v-if="!messages.length" class="dj-chat-empty">{{ t('dj.chat_empty') }}</p>
      <div
        v-for="(m, i) in messages" :key="i" class="dj-chat-msg"
        :class="[`dj-chat-msg--${m.role}`, { 'dj-chat-msg--error': m.error }]"
      >
        <p class="dj-chat-text">{{ m.text }}</p>
        <div v-if="m.script" class="dj-chat-script">
          <small>{{ t('dj.chat_script_label') }}</small>
          <p>{{ m.script }}</p>
          <NButton size="small" type="primary" secondary :loading="generatingFor === i" :disabled="generatingFor !== null" @click="useScript(i)">
            {{ t('dj.chat_use_script') }}
          </NButton>
        </div>
      </div>
    </NScrollbar>
    <div class="dj-chat-input">
      <NInput
        v-model:value="input" :placeholder="t('dj.chat_placeholder')" :disabled="sending"
        @keydown.enter.prevent="send"
      />
      <NButton type="primary" :loading="sending" :disabled="!input.trim()" @click="send">
        {{ t('dj.chat_send') }}
      </NButton>
    </div>
  </div>
</template>

<style scoped>
.dj-chat {
  display: flex;
  flex-direction: column;
  height: 100%;
  gap: 12px;
}
.dj-chat-log {
  flex: 1;
  min-height: 0;
}
.dj-chat-empty {
  margin: 0;
  padding: 8px 4px;
  font-size: 0.85rem;
  color: var(--dj-muted);
}
.dj-chat-msg {
  margin: 0 4px 12px;
  padding: 8px 12px;
  border-radius: 8px;
  max-width: 90%;
  font-size: 0.85rem;
  line-height: 1.4;
}
.dj-chat-msg--user {
  margin-left: auto;
  background: color-mix(in srgb, var(--dj-accent) 16%, transparent);
}
.dj-chat-msg--dj {
  background: var(--dj-surface);
  border: 1px solid var(--dj-border);
}
.dj-chat-msg--error {
  border-color: var(--dj-danger);
  color: var(--dj-danger);
}
.dj-chat-text {
  margin: 0;
  white-space: pre-wrap;
}
.dj-chat-script {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px dashed var(--dj-border);
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.dj-chat-script small {
  font-size: 0.65rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--dj-muted);
}
.dj-chat-script p {
  margin: 0;
  font-style: italic;
}
.dj-chat-input {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}
</style>
