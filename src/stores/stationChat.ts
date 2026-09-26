import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { appConfig } from '@/config/appConfig'
import { authService } from '@/services/auth'

const RECONNECT_BASE_DELAY_MS = 1000
const RECONNECT_MAX_DELAY_MS = 30000
const RECONNECT_MULTIPLIER = 2

export type StationChatMessageType = 'USER' | 'BOT' | 'ERROR' | 'SYSTEM'

export interface StationChatMessage {
  id: string | number
  type: StationChatMessageType
  username: string
  content: string
  timestamp?: number
  connectionId?: string
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

/**
 * The station's own chat — the same one listeners use in the player — opened from the deck. The deck
 * is already signed in, so it passes its Keycloak token (`oidc`) instead of the player's email-code session.
 */
function buildWsUrl(): string | null {
  const token = authService.getToken()
  if (!token) return null
  const wsBase = appConfig.jesoosServer.replace(/^http/, 'ws')
  return `${wsBase}/ws/chat?oidc=${encodeURIComponent(token)}`
}

/** Talking to the station's AI DJ from the DJ panel. One station at a time. */
export const useStationChatStore = defineStore('stationChat', () => {
  const messages = ref<StationChatMessage[]>([])
  const connected = ref(false)
  const processing = ref('')
  const username = ref('')
  /** Listener role labels from jesoos session_token (e.g. artist, owner). */
  const userLabels = ref<string[]>([])
  /** True when the socket never opens because the OIDC token is missing/rejected. */
  const authError = ref(false)
  /** In-flight DJ bubble id while CHUNKs are appending; cleared on BOT finalize / ERROR. */
  const streamingMessageId = ref<string | number | null>(null)
  const currentStreamContent = ref('')
  /** True from send until BOT finalize or ERROR — keeps the composer locked across gaps. */
  const replyInFlight = ref(false)
  const brandSlug = ref<string | null>(null)

  let ws: WebSocket | null = null
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null
  let reconnectDelay = RECONNECT_BASE_DELAY_MS
  let intentionalDisconnect = false
  /** Tracks whether the current socket ever reached OPEN (auth upgrade succeeded). */
  let everOpened = false
  /** Bumped per open attempt so a stale one that awaited a token refresh doesn't open a second socket. */
  let openGeneration = 0

  const isBusy = computed(
    () => replyInFlight.value || !!processing.value || streamingMessageId.value != null,
  )
  /** The station DJ's name, as the chat signs its replies. */
  const djName = computed(() => [...messages.value].reverse().find(m => m.type === 'BOT' && m.username)?.username ?? '')

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
      if (!intentionalDisconnect) void openSocket()
    }, delay)
  }

  async function openSocket() {
    teardownSocket()
    intentionalDisconnect = false
    everOpened = false

    // The token rides in the URL, so it must be fresh before connecting (e.g. after the laptop slept).
    const generation = ++openGeneration
    await authService.ensureValidToken()
    if (generation !== openGeneration || intentionalDisconnect) return

    const url = buildWsUrl()
    if (!url) {
      connected.value = false
      authError.value = true
      messages.value.push({ id: Date.now(), type: 'ERROR', username: 'system', content: 'Authentication required' })
      return
    }

    authError.value = false
    const socket = new WebSocket(url)
    ws = socket

    socket.onopen = () => {
      everOpened = true
      connected.value = true
      authError.value = false
      reconnectDelay = RECONNECT_BASE_DELAY_MS
      socket.send(JSON.stringify({ action: 'getHistory', brandSlug: brandSlug.value, limit: 50 }))
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
      // 401 / bad token: the upgrade never succeeds — surface it, do not fall back to anonymous.
      if (!everOpened && !intentionalDisconnect) {
        authError.value = true
        messages.value.push({ id: Date.now(), type: 'ERROR', username: 'system', content: 'Authentication failed' })
        return
      }
      if (!intentionalDisconnect) scheduleReconnect()
    }
  }

  function connect(slug: string) {
    if (brandSlug.value !== slug) {
      messages.value = []
      endTurn()
    }
    brandSlug.value = slug
    clearReconnectTimer()
    intentionalDisconnect = false
    void openSocket()
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
      const newMessage: StationChatMessage = {
        id: `streaming-${Date.now()}`,
        type: 'BOT',
        username: chunkUsername || djName.value || 'DJ',
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

  /** Finalize the in-flight DJ bubble with canonical BOT text — never append on top of CHUNKs. */
  function finalizeBot(data: {
    id?: string
    username?: string
    content?: string
    timestamp?: number
    connectionId?: string
  }) {
    const canonical = data.content ?? ''
    const finalized: StationChatMessage = {
      id: data.id || Date.now(),
      type: 'BOT',
      username: data.username || djName.value || 'DJ',
      content: canonical,
      timestamp: data.timestamp,
      connectionId: data.connectionId,
    }

    if (streamingMessageId.value != null) {
      const idx = messages.value.findIndex((m) => m.id === streamingMessageId.value)
      if (idx !== -1) {
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

    // The player's upload / record buttons have no place in the deck.
    if (data.type === 'COMMAND') return

    if (data.type === 'PROCESSING') {
      processing.value = typeof data.content === 'string' ? data.content : ''
      return
    }

    if (data.type === 'CHUNK') {
      if (processing.value) processing.value = ''
      appendChunk(data.content || '', data.username)
      return
    }

    if (data.type === 'history') {
      endTurn()
      messages.value = (data.messages || []).map((m: any, i: number) => ({
        id: m.data?.id || i,
        type: (m.data?.type || 'BOT') as StationChatMessageType,
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

    // On the deck's connection session_token carries no token, only the name and role labels.
    if (data.type === 'session_token') {
      if (data.userName) username.value = data.userName
      userLabels.value = normalizeUserLabels(data.labels ?? data.userLabels)
      return
    }

    if (data.type === 'ERROR') {
      endTurn()
      messages.value.push({ id: Date.now(), type: 'ERROR', username: 'system', content: data.message || 'Error' })
    }
  }

  function send(content: string) {
    const msg = content.trim()
    if (!msg || !ws || ws.readyState !== WebSocket.OPEN) return false
    if (isBusy.value) return false

    ws.send(JSON.stringify({ action: 'sendMessage', brandSlug: brandSlug.value, content: msg }))
    replyInFlight.value = true
    return true
  }

  return {
    messages,
    connected,
    processing,
    username,
    userLabels,
    authError,
    streamingMessageId,
    replyInFlight,
    isBusy,
    djName,
    connect,
    disconnect,
    send,
  }
})
