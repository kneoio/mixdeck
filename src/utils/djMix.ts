import { getAudioContext, OVERLAP_SECONDS, WINDOW_SECONDS } from './djAudio'

export const DUCK_LEVEL = 0.22
const DUCK_ATTACK = 0.35
const DUCK_RELEASE = 0.7
const EDGE_FADE = 0.04
/** Seconds of music kept ahead of the voice inside the junction window. */
const WINDOW_PRE_ROLL = 6

export interface EnvelopePoint { time: number; volume: number }
export interface MixWindow { start: number; end: number }

/** Junction timeline: A's tail starts at 0, B's head at `bStart`, the voice at `voiceStart`. */
export interface LinkModel {
  a: AudioBuffer
  b: AudioBuffer
  voice: AudioBuffer | null
  bStart: number
  voiceStart: number
}

export const bStartFor = (aDuration: number) => Math.max(0, aDuration - OVERLAP_SECONDS)

/** Music volume envelope: dip under the voice, recover after it. Empty without a voice. */
export function duckEnvelope(voiceStart: number, voiceDuration: number): EnvelopePoint[] {
  const end = voiceStart + voiceDuration
  return [
    { time: Math.max(0, voiceStart - DUCK_ATTACK), volume: 1 },
    { time: voiceStart, volume: DUCK_LEVEL },
    { time: end, volume: DUCK_LEVEL },
    { time: end + DUCK_RELEASE, volume: 1 },
  ]
}

export function envelopeAt(points: EnvelopePoint[], t: number): number {
  if (!points.length) return 1
  if (t <= points[0].time) return points[0].volume
  for (let i = 1; i < points.length; i++) {
    const p = points[i]
    if (t <= p.time) {
      const q = points[i - 1]
      const span = p.time - q.time
      return span <= 0 ? p.volume : q.volume + (p.volume - q.volume) * ((t - q.time) / span)
    }
  }
  return points[points.length - 1].volume
}

/** The ~30s slice of the junction that is previewed and sent. */
export function junctionWindow(model: Pick<LinkModel, 'bStart' | 'voiceStart'> & { total: number; hasVoice: boolean }): MixWindow {
  const anchor = model.hasVoice ? model.voiceStart - WINDOW_PRE_ROLL : model.bStart - 10
  const start = Math.min(Math.max(0, anchor), Math.max(0, model.total - WINDOW_SECONDS))
  return { start, end: Math.min(model.total, start + WINDOW_SECONDS) }
}

/**
 * Wires the whole mix into `dest` for `win`, starting at context time `when`.
 * Used by both the live preview and the offline render, so what is auditioned is what is sent.
 */
export function scheduleMix(
  ctx: BaseAudioContext,
  dest: AudioNode,
  model: LinkModel,
  win: MixWindow,
  when: number,
): () => void {
  const length = win.end - win.start
  const master = ctx.createGain()
  master.gain.setValueAtTime(0, when)
  master.gain.linearRampToValueAtTime(1, when + Math.min(EDGE_FADE, length / 2))
  master.gain.setValueAtTime(1, when + Math.max(0, length - EDGE_FADE))
  master.gain.linearRampToValueAtTime(0, when + length)
  master.connect(dest)

  const envelope = model.voice ? duckEnvelope(model.voiceStart, model.voice.duration) : []
  const layers = [
    { buf: model.a, start: 0, duck: true },
    { buf: model.b, start: model.bStart, duck: true },
    ...(model.voice ? [{ buf: model.voice, start: model.voiceStart, duck: false }] : []),
  ]
  const sources: AudioBufferSourceNode[] = []
  const at = (t: number) => when + Math.max(0, t - win.start)

  for (const { buf, start, duck } of layers) {
    if (start + buf.duration <= win.start || start >= win.end) continue
    const playFrom = Math.max(win.start, start)
    const gain = ctx.createGain()
    const env = duck ? envelope : []
    gain.gain.setValueAtTime(envelopeAt(env, playFrom), at(playFrom))
    for (const p of env) {
      if (p.time > playFrom && p.time < win.end) gain.gain.linearRampToValueAtTime(p.volume, at(p.time))
    }
    const src = ctx.createBufferSource()
    src.buffer = buf
    src.connect(gain).connect(master)
    src.start(at(playFrom), playFrom - start)
    src.stop(when + length)
    sources.push(src)
  }

  return () => {
    for (const s of sources) {
      try { s.stop() } catch { /* not started or already stopped */ }
      s.disconnect()
    }
    master.disconnect()
  }
}

export async function renderLink(model: LinkModel, win: MixWindow): Promise<AudioBuffer> {
  const sampleRate = model.a.sampleRate
  const ctx = new OfflineAudioContext(2, Math.ceil((win.end - win.start) * sampleRate), sampleRate)
  scheduleMix(ctx, ctx.destination, model, win, 0)
  return ctx.startRendering()
}

/** 16-bit PCM WAV. */
export function encodeWav(buf: AudioBuffer): Blob {
  const channels = buf.numberOfChannels
  const bytes = 44 + buf.length * channels * 2
  const view = new DataView(new ArrayBuffer(bytes))
  const str = (off: number, s: string) => { for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i)) }
  str(0, 'RIFF'); view.setUint32(4, bytes - 8, true); str(8, 'WAVE')
  str(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true)
  view.setUint16(22, channels, true); view.setUint32(24, buf.sampleRate, true)
  view.setUint32(28, buf.sampleRate * channels * 2, true); view.setUint16(32, channels * 2, true); view.setUint16(34, 16, true)
  str(36, 'data'); view.setUint32(40, buf.length * channels * 2, true)
  const data = Array.from({ length: channels }, (_, ch) => buf.getChannelData(ch))
  let off = 44
  for (let i = 0; i < buf.length; i++) {
    for (let ch = 0; ch < channels; ch++) {
      const s = Math.max(-1, Math.min(1, data[ch][i]))
      view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true)
      off += 2
    }
  }
  return new Blob([view], { type: 'audio/wav' })
}

/** Plays only the junction window; `onTick` gets the position on the junction timeline. */
export class LinkPreview {
  private cancel: (() => void) | null = null
  private raf = 0

  play(model: LinkModel, win: MixWindow, onTick: (t: number) => void, onEnd: () => void) {
    this.stop()
    const ctx = getAudioContext()
    void ctx.resume()
    const when = ctx.currentTime + 0.08
    this.cancel = scheduleMix(ctx, ctx.destination, model, win, when)
    const end = when + (win.end - win.start)
    const tick = () => {
      if (ctx.currentTime >= end) {
        this.stop()
        onEnd()
        return
      }
      onTick(win.start + Math.max(0, ctx.currentTime - when))
      this.raf = requestAnimationFrame(tick)
    }
    this.raf = requestAnimationFrame(tick)
  }

  stop() {
    cancelAnimationFrame(this.raf)
    this.cancel?.()
    this.cancel = null
  }
}
