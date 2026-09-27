import { getAudioContext } from '@/utils/djAudio'

/** The sources on the live mixer: the two song decks, the prepared link, and the microphone. */
export type LiveChannel = 'a' | 'c' | 'link'

export interface LiveNowPlaying {
  songId?: string | null
  slugName?: string | null
  title: string
  artist?: string | null
}

/** How much the music dips while the mic is open, when talkover is on. */
const TALKOVER_LEVEL = 0.3
/** Fader moves ramp over this long, so a jump on the slider does not click. */
const RAMP_SECONDS = 0.03
/** How often the recorder hands over audio; small enough that aivox never waits on the deck. */
const CHUNK_MS = 250
const BITRATE = 128_000

interface Deck {
  gain: GainNode
  source: AudioBufferSourceNode | null
  buffer: AudioBuffer | null
  /** Where in the buffer playback started, and the context time it started at. */
  offset: number
  startedAt: number
}

function pickMimeType(): string | undefined {
  return ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/mp4']
    .find(type => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type))
}

/**
 * The live mixer. Everything the DJ plays is summed into a program bus that is recorded and streamed to
 * aivox over a WebSocket, which airs it as it arrives. The DJ monitors the music locally; the mic goes
 * to air only, never to the speakers, so it cannot feed back.
 */
export class LiveBroadcast {
  private readonly ctx = getAudioContext()
  private readonly program = this.ctx.createGain()
  private readonly music = this.ctx.createGain()
  private readonly micGain = this.ctx.createGain()
  private readonly destination = this.ctx.createMediaStreamDestination()
  private readonly decks: Record<LiveChannel, Deck>
  private socket: WebSocket | null = null
  private recorder: MediaRecorder | null = null
  private micStream: MediaStream | null = null
  private micSource: MediaStreamAudioSourceNode | null = null
  private micOpen = false
  private micLevel = 1
  private talkover = true
  private endReason: string | null = null
  private lastMeta = ''

  constructor() {
    const deck = (): Deck => {
      const gain = this.ctx.createGain()
      gain.connect(this.music)
      return { gain, source: null, buffer: null, offset: 0, startedAt: 0 }
    }
    this.decks = { a: deck(), c: deck(), link: deck() }
    this.music.connect(this.program)
    this.music.connect(this.ctx.destination)
    this.micGain.gain.value = 0
    this.micGain.connect(this.program)
    this.program.connect(this.destination)
  }

  /**
   * Opens the mic and the socket, and starts streaming once aivox says the station is live.
   * `onEnded` gets aivox's reason, or `connection_lost` when the socket dropped without one.
   */
  async connect(url: string, onOnAir: () => void, onEnded: (reason: string) => void): Promise<void> {
    await this.ctx.resume()
    this.micStream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: true, autoGainControl: true },
    })
    this.micSource = this.ctx.createMediaStreamSource(this.micStream)
    this.micSource.connect(this.micGain)

    const socket = new WebSocket(url)
    socket.binaryType = 'arraybuffer'
    this.socket = socket
    socket.onmessage = event => {
      if (typeof event.data !== 'string') return
      let message: { type?: string; reason?: string }
      try {
        message = JSON.parse(event.data)
      } catch {
        return
      }
      if (message.type === 'on_air') {
        this.startRecorder()
        onOnAir()
      } else if (message.type === 'ended') {
        this.endReason = message.reason ?? 'ended'
      }
    }
    socket.onclose = event => {
      this.stopRecorder()
      onEnded(this.endReason ?? (event.reason || 'connection_lost'))
    }
  }

  private startRecorder() {
    const mimeType = pickMimeType()
    const recorder = new MediaRecorder(this.destination.stream, { mimeType, audioBitsPerSecond: BITRATE })
    recorder.ondataavailable = event => {
      if (event.data.size && this.socket?.readyState === WebSocket.OPEN) this.socket.send(event.data)
    }
    recorder.start(CHUNK_MS)
    this.recorder = recorder
  }

  private stopRecorder() {
    if (this.recorder && this.recorder.state !== 'inactive') this.recorder.stop()
    this.recorder = null
  }

  setGain(channel: LiveChannel, value: number) {
    this.decks[channel].gain.gain.setTargetAtTime(value, this.ctx.currentTime, RAMP_SECONDS)
  }

  play(channel: LiveChannel, buffer: AudioBuffer, from: number, onEnded: () => void) {
    this.stop(channel)
    const deck = this.decks[channel]
    const source = this.ctx.createBufferSource()
    source.buffer = buffer
    source.connect(deck.gain)
    source.onended = () => {
      if (deck.source !== source) return
      deck.offset = buffer.duration
      deck.source = null
      onEnded()
    }
    const offset = Math.min(Math.max(0, from), buffer.duration)
    source.start(0, offset)
    Object.assign(deck, { source, buffer, offset, startedAt: this.ctx.currentTime })
  }

  /** Stops the deck where it is, so play resumes from there. */
  stop(channel: LiveChannel) {
    const deck = this.decks[channel]
    if (!deck.source) return
    deck.offset = this.position(channel)
    const source = deck.source
    deck.source = null
    source.stop()
    source.disconnect()
  }

  isPlaying(channel: LiveChannel) {
    return !!this.decks[channel].source
  }

  position(channel: LiveChannel) {
    const deck = this.decks[channel]
    if (!deck.source || !deck.buffer) return deck.offset
    return Math.min(deck.buffer.duration, deck.offset + this.ctx.currentTime - deck.startedAt)
  }

  setMicLevel(value: number) {
    this.micLevel = value
    this.applyMic()
  }

  setMicOpen(open: boolean) {
    this.micOpen = open
    this.applyMic()
  }

  setTalkover(on: boolean) {
    this.talkover = on
    this.applyMic()
  }

  private applyMic() {
    const now = this.ctx.currentTime
    this.micGain.gain.setTargetAtTime(this.micOpen ? this.micLevel : 0, now, RAMP_SECONDS)
    this.music.gain.setTargetAtTime(this.micOpen && this.talkover ? TALKOVER_LEVEL : 1, now, 0.15)
  }

  /** Tells listeners what is playing; sent only when it changes. */
  sendNowPlaying(meta: LiveNowPlaying) {
    const text = JSON.stringify({ type: 'meta', ...meta })
    if (text === this.lastMeta || this.socket?.readyState !== WebSocket.OPEN) return
    this.lastMeta = text
    this.socket.send(text)
  }

  /** Hands the air back: aivox airs what it already has, then closes the socket. */
  end() {
    if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify({ type: 'end' }))
  }

  /** Tears everything down; the socket closing ends the live feed on aivox too. */
  dispose() {
    for (const channel of Object.keys(this.decks) as LiveChannel[]) this.stop(channel)
    this.stopRecorder()
    if (this.socket && this.socket.readyState <= WebSocket.OPEN) this.socket.close(1000, 'deck_closed')
    this.socket = null
    this.micStream?.getTracks().forEach(track => track.stop())
    this.micSource?.disconnect()
    this.music.disconnect()
    this.program.disconnect()
    this.micGain.disconnect()
  }
}
