import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { appConfig } from '@/config/appConfig'

const SESSION_TOKEN_KEY = 'mixdeck_ask_token'
const ANON_SESSION_KEY = 'mixdeck_ask_anon_id'

const RECONNECT_BASE_DELAY_MS = 1000
const RECONNECT_MAX_DELAY_MS = 30000
const RECONNECT_MULTIPLIER = 2

export type AskMessageType = 'USER' | 'BOT' | 'ERROR' | 'SYSTEM'

export interface AskChatMessage {
  id: string | number
  type: AskMessageType
  username: string
  content: string
  timestamp?: number
  connectionId?: string
}

function createAnonId(): string {
  const bytes = new Uint8Array(12)
  crypto.getRandomValues(bytes)
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function getOrCreateAnonId(): string {
  let anonId = localStorage.getItem(ANON_SESSION_KEY)
  if (!anonId) {
    anonId = createAnonId()
    localStorage.setItem(ANON_SESSION_KEY, anonId)
  }
  return anonId
}

function buildAskWsUrl(): string {
  const wsBase = appConfig.jesoosServer.replace(/^http/, 'ws')
  const token = localStorage.getItem(SESSION_TOKEN_KEY)
  if (token) {
    return `${wsBase}/ws/ask?token=${encodeURIComponent(token)}`
  }
  const anonId = getOrCreateAnonId()
  return `${wsBase}/ws/ask?anonId=${encodeURIComponent(anonId)}`
}

export const useAskChatStore = defineStore('askChat', () => {
  const messages = ref<AskChatMessage[]>([])
  const connected = ref(false)
  const processing = ref('')
  const username = ref('')
  const streamingMessageId = ref<string | number | null>(null)
  const currentStreamContent = ref('')
  const sessionToken = ref<string | null>(localStorage.getItem(SESSION_TOKEN_KEY))

  let ws: WebSocket | null = null
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null
  let reconnectDelay = RECONNECT_BASE_DELAY_MS
  let intentionalDisconnect = false

  const isBusy = computed(() => !!processing.value || streamingMessageId.value != null)

  function clearReconnectTimer() {
    if (reconnectTimer !== null) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
  }

  function teardownSocket() {
    if (!ws) return
    ws.onopen = null
    ws.onmessage = null
    ws.onerror = null
    ws.onclose = null
    ws.close()
    ws = null
  }

  function scheduleReconnect() {
    clearReconnectTimer()
    const delay = reconnectDelay
    reconnectDelay = Math.min(delay * RECONNECT_MULTIPLIER, RECONNECT_MAX_DELAY_MS)
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null
      if (!intentionalDisconnect) openSocket()
    }, delay)
  }

  function openSocket() {
    teardownSocket()
    intentionalDisconnect = false

    const socket = new WebSocket(buildAskWsUrl())
    ws = socket

    socket.onopen = () => {
      connected.value = true
      reconnectDelay = RECONNECT_BASE_DELAY_MS
      socket.send(JSON.stringify({ action: 'getHistory', limit: 50 }))
    }

    socket.onmessage = (event) => {
      handleIncoming(typeof event.data === 'string' ? event.data : '')
    }

    socket.onerror = () => {
      connected.value = false
    }

    socket.onclose = () => {
      connected.value = false
      if (ws === socket) ws = null
      if (!intentionalDisconnect) scheduleReconnect()
    }
  }

  function connect() {
    clearReconnectTimer()
    intentionalDisconnect = false
    openSocket()
  }

  function disconnect() {
    intentionalDisconnect = true
    clearReconnectTimer()
    teardownSocket()
    connected.value = false
  }

  function resetStreamState() {
    processing.value = ''
    streamingMessageId.value = null
    currentStreamContent.value = ''
  }

  function handleIncoming(raw: string) {
    let data: any
    try {
      data = JSON.parse(raw)
    } catch {
      return
    }

    if (data.type === 'PROCESSING') {
      processing.value = data.content || ''
      return
    }

    if (data.type === 'CHUNK') {
      processing.value = ''
      if (streamingMessageId.value == null) {
        const newMessage: AskChatMessage = {
          id: `streaming-${Date.now()}`,
          type: 'BOT',
          username: data.username || 'Mixpla Ask',
          content: data.content || '',
          timestamp: Date.now(),
        }
        messages.value.push(newMessage)
        streamingMessageId.value = newMessage.id
        currentStreamContent.value = data.content || ''
      } else {
        const streamingMsg = messages.value.find((m) => m.id === streamingMessageId.value)
        if (streamingMsg) {
          currentStreamContent.value += data.content || ''
          streamingMsg.content = currentStreamContent.value
        }
      }
      return
    }

    if (data.type === 'history') {
      resetStreamState()
      messages.value = (data.messages || []).map((m: any, i: number) => ({
        id: m.data?.id || i,
        type: (m.data?.type || 'BOT') as AskMessageType,
        username: m.data?.username || '',
        content: m.data?.content || '',
        timestamp: m.data?.timestamp,
        connectionId: m.data?.connectionId,
      }))
      return
    }

    if (data.type === 'message' && data.data) {
      processing.value = ''
      if (streamingMessageId.value != null && data.data.type === 'BOT') {
        const idx = messages.value.findIndex((m) => m.id === streamingMessageId.value)
        const finalized: AskChatMessage = {
          id: data.data.id || Date.now(),
          type: data.data.type,
          username: data.data.username || 'Mixpla Ask',
          content: data.data.content || '',
          timestamp: data.data.timestamp,
          connectionId: data.data.connectionId,
        }
        if (idx !== -1) messages.value[idx] = finalized
        else messages.value.push(finalized)
        streamingMessageId.value = null
        currentStreamContent.value = ''
      } else {
        messages.value.push({
          id: data.data.id || Date.now(),
          type: data.data.type,
          username: data.data.username || '',
          content: data.data.content || '',
          timestamp: data.data.timestamp,
          connectionId: data.data.connectionId,
        })
      }
      return
    }

    if (data.type === 'session_token') {
      if (data.token) {
        localStorage.setItem(SESSION_TOKEN_KEY, data.token)
        sessionToken.value = data.token
        if (data.userName) username.value = data.userName
      } else {
        localStorage.removeItem(SESSION_TOKEN_KEY)
        sessionToken.value = null
        username.value = ''
        // Reconnect anonymously so the next session uses anonId
        if (connected.value || ws) {
          intentionalDisconnect = true
          clearReconnectTimer()
          teardownSocket()
          connected.value = false
          intentionalDisconnect = false
          openSocket()
        }
      }
      return
    }

    if (data.type === 'ERROR') {
      resetStreamState()
      messages.value.push({
        id: Date.now(),
        type: 'ERROR',
        username: 'system',
        content: data.message || 'Error',
      })
      return
    }

    // COMMAND payloads are optional side effects; Ask has none Mixdeck must handle yet.
  }

  function send(content: string, displayName?: string) {
    const msg = content.trim()
    if (!msg || !ws || ws.readyState !== WebSocket.OPEN) return false
    if (isBusy.value) return false

    const payload: Record<string, string> = {
      action: 'sendMessage',
      content: msg,
    }
    if (!sessionToken.value && displayName) {
      payload.username = displayName
    }
    ws.send(JSON.stringify(payload))
    return true
  }

  function clearSession() {
    localStorage.removeItem(SESSION_TOKEN_KEY)
    sessionToken.value = null
    username.value = ''
  }

  return {
    messages,
    connected,
    processing,
    username,
    streamingMessageId,
    sessionToken,
    isBusy,
    connect,
    disconnect,
    send,
    clearSession,
  }
})
