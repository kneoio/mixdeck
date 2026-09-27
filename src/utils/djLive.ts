import { getAudioContext } from '@/utils/djAudio'
import { applyFx, buildFx, type FxAmounts, type FxNodes } from '@/utils/djMix'

export interface LiveNowPlaying {
  songId?: string | null
  slugName?: string | null
  title: string
  artist?: string | null
}

/** Fader moves ramp over this long, so a jump on the slider does not click. */
const RAMP_SECONDS = 0.03
/** How often the recorder hands over audio; small enough that aivox never waits on the deck. */
const CHUNK_MS = 250
const BITRATE = 128_000

function pickMimeType(): string | undefined {
  return ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/mp4']
    .find(type => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type))
}

/**
 * The live mixer: one song at a time on one side of the main fader, the DJ's voice and effect clips on
 * the other. Everything is summed into a program bus that is recorded and streamed to aivox over a
 * WebSocket, which airs it as it arrives. The DJ hears the song and the effects locally; the mic goes to
 * air only, never to the speakers, so it cannot feed back.
 */
export class LiveBroadcast {
  private readonly ctx = getAudioContext()
  private readonly program = this.ctx.createGain()
  private readonly songSide = this.ctx.createGain()
  private readonly voiceSide = this.ctx.createGain()
  private readonly sfxSide = this.ctx.createGain()
  private readonly micGate = this.ctx.createGain()
  private readonly destination = this.ctx.createMediaStreamDestination()
  private readonly micFx: FxNodes
  private song: { source: AudioBufferSourceNode; buffer: AudioBuffer; offset: number; startedAt: number } | null = null
  private readonly effects = new Map<string, AudioBufferSourceNode>()
  private socket: WebSocket | null = null
  private recorder: MediaRecorder | null = null
  private micStream: MediaStream | null = null
  private micSource: MediaStreamAudioSourceNode | null = null
  private micOpen = false
  private micLevel = 1
  private endReason: string | null = null
  private lastMeta = ''

  constructor() {
    this.songSide.connect(this.program)
    this.songSide.connect(this.ctx.destination)
    this.sfxSide.connect(this.program)
    this.sfxSide.connect(this.ctx.destination)
    this.voiceSide.connect(this.program)
    this.micGate.gain.value = 0
    this.micFx = buildFx(this.ctx, this.micGate, this.voiceSide, { reverb: 0, echo: 0, radio: 0, distortion: 0 })
    this.program.connect(this.destination)
    this.setBalance(0.5)
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
    this.micSource.connect(this.micGate)

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
    const recorder = new MediaRecorder(this.destination.stream, { mimeType: pickMimeType(), audioBitsPerSecond: BITRATE })
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

  /** The main fader: 0 is all song, 1 is all voice and effects, the middle holds both at equal power. */
  setBalance(x: number) {
    const now = this.ctx.currentTime
    const song = Math.cos((x * Math.PI) / 2)
    const voice = Math.sin((x * Math.PI) / 2)
    this.songSide.gain.setTargetAtTime(song, now, RAMP_SECONDS)
    this.voiceSide.gain.setTargetAtTime(voice, now, RAMP_SECONDS)
    this.sfxSide.gain.setTargetAtTime(voice, now, RAMP_SECONDS)
  }

  /** Starts a song, replacing whatever song was playing. */
  playSong(buffer: AudioBuffer, from: number, onEnded: () => void) {
    this.stopSong()
    const source = this.ctx.createBufferSource()
    source.buffer = buffer
    source.connect(this.songSide)
    source.onended = () => {
      if (this.song?.source !== source) return
      this.song = null
      onEnded()
    }
    const offset = Math.min(Math.max(0, from), buffer.duration)
    source.start(0, offset)
    this.song = { source, buffer, offset, startedAt: this.ctx.currentTime }
  }

  stopSong() {
    if (!this.song) return
    const { source } = this.song
    this.song = null
    source.stop()
    source.disconnect()
  }

  songPosition() {
    if (!this.song) return 0
    return Math.min(this.song.buffer.duration, this.song.offset + this.ctx.currentTime - this.song.startedAt)
  }

  /** Plays an effect clip once; pressing it again while it plays stops it. */
  playEffect(key: string, buffer: AudioBuffer, onEnded: () => void) {
    this.stopEffect(key)
    const source = this.ctx.createBufferSource()
    source.buffer = buffer
    source.connect(this.sfxSide)
    source.onended = () => {
      if (this.effects.get(key) !== source) return
      this.effects.delete(key)
      onEnded()
    }
    source.start()
    this.effects.set(key, source)
  }

  stopEffect(key: string) {
    const source = this.effects.get(key)
    if (!source) return
    this.effects.delete(key)
    source.stop()
    source.disconnect()
  }

  setMicOpen(open: boolean) {
    this.micOpen = open
    this.applyMic()
  }

  /** The mic's own volume, 1 as it comes in; above 1 boosts a quiet mic. */
  setMicLevel(level: number) {
    this.micLevel = level
    this.applyMic()
  }

  private applyMic() {
    this.micGate.gain.setTargetAtTime(this.micOpen ? this.micLevel : 0, this.ctx.currentTime, RAMP_SECONDS)
  }

  /** The same four effects as a B lane in the link editor, on the live voice. */
  setMicFx(amounts: FxAmounts) {
    applyFx(this.ctx, this.micFx, amounts, false)
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
    this.stopSong()
    for (const key of [...this.effects.keys()]) this.stopEffect(key)
    this.stopRecorder()
    if (this.socket && this.socket.readyState <= WebSocket.OPEN) this.socket.close(1000, 'deck_closed')
    this.socket = null
    this.micStream?.getTracks().forEach(track => track.stop())
    this.micSource?.disconnect()
    for (const node of [this.songSide, this.sfxSide, this.voiceSide, this.micGate, this.program]) node.disconnect()
  }
}
