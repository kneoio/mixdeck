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

function normalizeUserLabels(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>()
  const out: string[] = []
  for (const item of raw) {
    if (typeof item !== 'string') continue
    const label = item.trim().toLowerCase()
    if (!label || seen.has(label)) continue
    seen.add(label)
    out.push(label)
  }
  return out
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
  /** Listener role labels from jesoos session_token (e.g. artist, owner). */
  const userLabels = ref<string[]>([])
  /** In-flight assistant bubble id while CHUNKs are appending; cleared on BOT finalize / ERROR. */
  const streamingMessageId = ref<string | number | null>(null)
  const currentStreamContent = ref('')
  /** True from sendMessage until BOT finalize or ERROR — keeps composer locked across gaps. */
  const replyInFlight = ref(false)
  const sessionToken = ref<string | null>(localStorage.getItem(SESSION_TOKEN_KEY))

  let ws: WebSocket | null = null
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null
  let reconnectDelay = RECONNECT_BASE_DELAY_MS
  let intentionalDisconnect = false

  const isBusy = computed(
    () => replyInFlight.value || !!processing.value || streamingMessageId.value != null,
  )

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

  function endTurn() {
    processing.value = ''
    streamingMessageId.value = null
    currentStreamContent.value = ''
    replyInFlight.value = false
  }

  function appendChunk(content: string, chunkUsername?: string) {
    const fragment = content || ''
    if (streamingMessageId.value == null) {
      const newMessage: AskChatMessage = {
        id: `streaming-${Date.now()}`,
        type: 'BOT',
        username: chunkUsername || 'Mixpla Ask',
        content: fragment,
        timestamp: Date.now(),
      }
      messages.value.push(newMessage)
      streamingMessageId.value = newMessage.id
      currentStreamContent.value = fragment
      return
    }

    const streamingMsg = messages.value.find((m) => m.id === streamingMessageId.value)
    if (!streamingMsg) return
    currentStreamContent.value += fragment
    streamingMsg.content = currentStreamContent.value
  }

  /** Finalize the in-flight assistant bubble with canonical BOT text — never append on top of CHUNKs. */
  function finalizeBot(data: {
    id?: string
    username?: string
    content?: string
    timestamp?: number
    connectionId?: string
  }) {
    const canonical = data.content ?? ''
    const finalized: AskChatMessage = {
      id: data.id || Date.now(),
      type: 'BOT',
      username: data.username || 'Mixpla Ask',
      content: canonical,
      timestamp: data.timestamp,
      connectionId: data.connectionId,
    }

    if (streamingMessageId.value != null) {
      const idx = messages.value.findIndex((m) => m.id === streamingMessageId.value)
      if (idx !== -1) {
        // Prefer server canonical text; keep streamed text only if BOT body is empty.
        if (canonical === '' && currentStreamContent.value) {
          finalized.content = currentStreamContent.value
        }
        messages.value[idx] = finalized
      } else {
        messages.value.push(finalized)
      }
    } else {
      messages.value.push(finalized)
    }

    endTurn()
  }

  function handleIncoming(raw: string) {
    let data: any
    try {
      data = JSON.parse(raw)
    } catch {
      return
    }

    // Non-empty = tool / typing status; empty content = clear status (turn still in flight).
    if (data.type === 'PROCESSING') {
      processing.value = typeof data.content === 'string' ? data.content : ''
      return
    }

    // Each CHUNK is a delta — append to the single in-flight assistant bubble.
    if (data.type === 'CHUNK') {
      if (processing.value) processing.value = ''
      appendChunk(data.content || '', data.username)
      return
    }

    if (data.type === 'history') {
      endTurn()
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
      if (data.data.type === 'BOT') {
        finalizeBot(data.data)
        return
      }

      // USER echo (and any other message wrappers)
      messages.value.push({
        id: data.data.id || Date.now(),
        type: data.data.type,
        username: data.data.username || '',
        content: data.data.content || '',
        timestamp: data.data.timestamp,
        connectionId: data.data.connectionId,
      })
      return
    }

    if (data.type === 'session_token') {
      if (data.token) {
        localStorage.setItem(SESSION_TOKEN_KEY, data.token)
        sessionToken.value = data.token
        if (data.userName) username.value = data.userName
        userLabels.value = normalizeUserLabels(data.labels ?? data.userLabels)
      } else {
        localStorage.removeItem(SESSION_TOKEN_KEY)
        sessionToken.value = null
        username.value = ''
        userLabels.value = []
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
      endTurn()
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
    replyInFlight.value = true
    return true
  }

  function clearSession() {
    localStorage.removeItem(SESSION_TOKEN_KEY)
    sessionToken.value = null
    username.value = ''
    userLabels.value = []
  }

  return {
    messages,
    connected,
    processing,
    username,
    userLabels,
    streamingMessageId,
    replyInFlight,
    sessionToken,
    isBusy,
    connect,
    disconnect,
    send,
    clearSession,
  }
})
