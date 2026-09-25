import { AudioBufferSource, BufferTarget, canEncodeAudio, OggOutputFormat, Output, QUALITY_HIGH } from 'mediabunny'
import { getAudioContext, OVERLAP_SECONDS } from './djAudio'

const EDGE_FADE = 0.04

export interface EnvelopePoint { time: number; volume: number }
export interface MixWindow { start: number; end: number }

/**
 * One of the B lanes: a voice, a recording, a generated link or an effect clip, with its own
 * place on the timeline, its own volume curve (in the clip's own seconds) and its own effects.
 */
export interface VoiceLane {
  id: number
  buf: AudioBuffer | null
  source: 'rec' | 'ai' | 'file' | null
  /** Where the clip starts, in junction seconds. */
  start: number
  duck: EnvelopePoint[]
  /** Each 0 to 1. */
  reverb: number
  echo: number
  radio: number
  distortion: number
  muted: boolean
}

export const emptyLane = (id: number): VoiceLane => ({
  id, buf: null, source: null, start: 0, duck: [], reverb: 0, echo: 0, radio: 0, distortion: 0, muted: false,
})

/** A whole pre-mixed clip from the Automix server, played as its own layer alongside A, B and C. */
export interface AutomixLane {
  buf: AudioBuffer
  start: number
  muted: boolean
}

/** Junction timeline: A starts at `aStart`, C at `bStart`, and each B lane at its own `start`. */
export interface LinkModel {
  a: AudioBuffer
  b: AudioBuffer
  voices: VoiceLane[]
  aStart: number
  bStart: number
  /**
   * A volume curve per song, in that song's own seconds from its first sample. Keeping them
   * song-local means a curve travels with its song when B slides along the timeline, and the
   * two songs can be shaped against each other — one fading down while the other comes up.
   */
  duckA: EnvelopePoint[]
  duckB: EnvelopePoint[]
  /** The Automix server's rendered join, if the DJ has fetched one. */
  d?: AutomixLane | null
}

/** Length of the synthetic room, in seconds. */
const REVERB_SECONDS = 1.8
/** Wet level at full reverb; the room is quieter than the voice that feeds it. */
const REVERB_WET = 1.8
/** Gap between echo repeats, and how much of each repeat feeds the next. */
const ECHO_SECONDS = 0.34
const ECHO_FEEDBACK = 0.45
const ECHO_WET = 0.85
/**
 * A cheap speaker or a phone line: only the middle of the spectrum gets through, and it is pushed
 * hard enough to crunch. The values are deliberately extreme, since a subtle version was not
 * recognisable as a radio at all.
 */
const RADIO_LOW_HZ = 700
const RADIO_HIGH_HZ = 2500
const RADIO_DRIVE = 3.5
const RADIO_MAKEUP = 0.38
/** Past this amount the dry signal is gone entirely, so the effect is fully on before the slider ends. */
const RADIO_FULL_AT = 0.7
/** Input gain into the clipper at the two ends of the slider: barely touched, then slammed. */
const DISTORTION_DRIVE_MIN = 1
const DISTORTION_DRIVE_MAX = 14
/**
 * What the clipped signal is scaled by. Clipping pushes a voice to near full scale whatever went in,
 * so this pulls it back to roughly the level of the clean clip.
 */
const DISTORTION_MATCH = 0.22
const rooms = new WeakMap<BaseAudioContext, AudioBuffer>()

let clip: Float32Array | null = null
/** A hard-ish clipper: linear near zero, flattening fast, so a driven signal turns fuzzy. */
function clipCurve(): Float32Array {
  if (!clip) {
    const points = 2048
    clip = new Float32Array(points)
    const norm = Math.tanh(5)
    for (let i = 0; i < points; i++) clip[i] = Math.tanh((i / (points - 1) * 2 - 1) * 5) / norm
  }
  return clip
}

let crunch: Float32Array | null = null
/** A soft-clipping curve: the harder the signal hits it, the more it flattens. */
function crunchCurve(): Float32Array {
  if (!crunch) {
    const points = 2048
    crunch = new Float32Array(points)
    const norm = Math.tanh(RADIO_DRIVE)
    for (let i = 0; i < points; i++) crunch[i] = Math.tanh((i / (points - 1) * 2 - 1) * RADIO_DRIVE) / norm
  }
  return crunch
}

/** A room made of decaying noise, so no impulse-response file has to ship with the app. */
function roomFor(ctx: BaseAudioContext): AudioBuffer {
  let room = rooms.get(ctx)
  if (!room) {
    const length = Math.floor(ctx.sampleRate * REVERB_SECONDS)
    room = ctx.createBuffer(2, length, ctx.sampleRate)
    for (let ch = 0; ch < 2; ch++) {
      const data = room.getChannelData(ch)
      for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 3)
    }
    rooms.set(ctx, room)
  }
  return room
}

export const bStartFor = (aDuration: number) => Math.max(0, aDuration - OVERLAP_SECONDS)

/** A curve that keeps a layer silent for its whole length, for muting it without touching its own curve. */
export function silentCurve(duration: number): EnvelopePoint[] {
  const end = Math.max(0.01, duration)
  return [{ time: 0, volume: 0 }, { time: end, volume: 0 }]
}

/**
 * A curve that leaves the song alone: flat and open, with a handle at each end to grab. `mid`
 * adds a third handle part-way along, where the fade usually starts, so there is one to take hold of.
 */
export function flatCurve(duration: number, mid?: number): EnvelopePoint[] {
  const end = Math.max(0.01, duration)
  const points = [{ time: 0, volume: 1 }, { time: end, volume: 1 }]
  if (mid !== undefined && mid > 0.05 && mid < end - 0.05) points.splice(1, 0, { time: mid, volume: 1 })
  return points
}

/**
 * Takes control points in junction seconds and returns them local to the song starting at
 * `songStart`, trimmed to the song and anchored flat out to both of its ends.
 */
function localise(pts: EnvelopePoint[], songStart: number, songDuration: number): EnvelopePoint[] {
  const out = pts
    .map(p => ({ time: Math.min(Math.max(p.time - songStart, 0), songDuration), volume: p.volume }))
    // Points squeezed off either end collapse onto the same time; keep the last one written there.
    .filter((p, i, all) => i === all.length - 1 || all[i + 1].time - p.time > 1e-6)

  if (!out.length) return flatCurve(songDuration)
  if (out[0].time > 0) out.unshift({ time: 0, volume: out[0].volume })
  if (out[out.length - 1].time < songDuration) {
    out.push({ time: songDuration, volume: out[out.length - 1].volume })
  }
  return out
}

/**
 * Starting point for a manual curve: dip under the voice. `recover` (default on) brings the song
 * back up to full afterwards; off, it stays down for the rest of the song — the right shape for A,
 * which ends soon after the voice anyway, so climbing back up just to stop is pointless.
 */
export function autoDuck(
  voiceStart: number,
  voiceDuration: number,
  songStart: number,
  songDuration: number,
  recover = true,
): EnvelopePoint[] {
  const end = voiceStart + voiceDuration
  return localise([
    { time: voiceStart - 0.35, volume: 1 },
    { time: voiceStart, volume: 0.08 },
    ...(recover ? [{ time: end, volume: 0.08 }, { time: end + 0.7, volume: 1 }] : []),
  ], songStart, songDuration)
}

/**
 * Starting point when there is no voice to duck under: the two songs trade places across the
 * stretch where they play together, the outgoing one bowing out as the incoming one comes up.
 */
export function autoCrossfade(
  from: number,
  to: number,
  songStart: number,
  songDuration: number,
  rising: boolean,
): EnvelopePoint[] {
  if (to - from < 0.05) return flatCurve(songDuration)
  return localise([
    { time: from, volume: rising ? 0 : 1 },
    { time: to, volume: rising ? 1 : 0 },
  ], songStart, songDuration)
}

/**
 * What the other song's curve becomes when the two are linked and `edited` has just changed.
 * Linked means a crossfade: across the stretch where both songs play, the other song's volume is
 * the complement of the edited one's, so as one goes down the other comes up. Outside that
 * stretch each song keeps its own curve, so shaping the overlap never disturbs the rest.
 */
export function pairedCurve(
  edited: EnvelopePoint[],
  editedStart: number,
  editedDuration: number,
  other: EnvelopePoint[],
  otherStart: number,
  otherDuration: number,
): EnvelopePoint[] {
  const from = Math.max(editedStart, otherStart)
  const to = Math.min(editedStart + editedDuration, otherStart + otherDuration)
  if (to - from < 0.05) return other

  const editedJunction = edited.map(p => ({ time: editedStart + p.time, volume: p.volume }))
  const kept = other
    .map(p => ({ time: otherStart + p.time, volume: p.volume }))
    .filter(p => p.time < from - 1e-6 || p.time > to + 1e-6)
  const across = [
    { time: from, volume: 1 - envelopeAt(editedJunction, from) },
    ...editedJunction.filter(p => p.time > from + 1e-6 && p.time < to - 1e-6).map(p => ({ time: p.time, volume: 1 - p.volume })),
    { time: to, volume: 1 - envelopeAt(editedJunction, to) },
  ]
  const paired = [...kept, ...across]
    .sort((x, y) => x.time - y.time)
    .map(p => ({ time: Math.min(Math.max(p.time - otherStart, 0), otherDuration), volume: Math.min(Math.max(p.volume, 0), 1) }))
  // Whichever end the overlap did not reach still needs a handle, so the curve spans the song.
  if (paired[0].time > 1e-6) paired.unshift({ time: 0, volume: paired[0].volume })
  const last = paired[paired.length - 1]
  if (last.time < otherDuration - 1e-6) paired.push({ time: otherDuration, volume: last.volume })
  return paired
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

interface FxAmounts { reverb: number; echo: number; radio: number; distortion: number }

/** The parts of one clip's effect chain that a slider can reach while the mix is running. */
interface FxNodes {
  distDrive: GainNode
  distOut: GainNode
  distDry: GainNode
  radioDry: GainNode
  radioOut: GainNode
  reverbWet: GainNode
  echoWet: GainNode
}

function layersOf(model: LinkModel) {
  return [
    { key: 'a', buf: model.a, start: model.aStart, env: model.duckA, fx: null as FxAmounts | null },
    { key: 'c', buf: model.b, start: model.bStart, env: model.duckB, fx: null as FxAmounts | null },
    ...model.voices.flatMap(v => v.buf
      ? [{
          key: `v${v.id}`, buf: v.buf, start: v.start, env: v.duck,
          fx: { reverb: v.reverb, echo: v.echo, radio: v.radio, distortion: v.distortion } as FxAmounts | null,
        }]
      : []),
    ...(model.d
      ? [{
          key: 'd', buf: model.d.buf, start: model.d.start,
          env: model.d.muted ? silentCurve(model.d.buf.duration) : flatCurve(model.d.buf.duration),
          fx: null as FxAmounts | null,
        }]
      : []),
  ]
}

/**
 * The whole effect chain is always built, with each effect turned down to nothing rather than left
 * out, so an amount can be changed while the mix plays without rebuilding anything. Distortion
 * drives the raw signal, then radio squeezes it, and the room and the echo hear the result.
 */
function buildFx(ctx: BaseAudioContext, input: AudioNode, master: AudioNode, amounts: FxAmounts): FxNodes {
  // No oversampling on the clipper: it delays the driven path, which then partly cancels against the dry one.
  const distDrive = ctx.createGain()
  const clipper = ctx.createWaveShaper()
  clipper.curve = clipCurve()
  const distOut = ctx.createGain()
  const distDry = ctx.createGain()
  const distMerged = ctx.createGain()
  input.connect(distDry).connect(distMerged)
  input.connect(distDrive).connect(clipper).connect(distOut).connect(distMerged)

  const radioDry = ctx.createGain()
  const radioOut = ctx.createGain()
  const radioMerged = ctx.createGain()
  // Each edge is cut twice: a single pass is too gentle, and the crunch stage would boost what leaks.
  const band = (type: BiquadFilterType, hz: number) => {
    const f = ctx.createBiquadFilter()
    f.type = type
    f.frequency.value = hz
    f.Q.value = 0.9
    return f
  }
  const crunch = ctx.createWaveShaper()
  crunch.curve = crunchCurve()
  distMerged.connect(radioDry).connect(radioMerged)
  distMerged
    .connect(band('highpass', RADIO_LOW_HZ)).connect(band('highpass', RADIO_LOW_HZ))
    .connect(band('lowpass', RADIO_HIGH_HZ)).connect(band('lowpass', RADIO_HIGH_HZ))
    .connect(crunch)
    // The crunch makes harmonics above the band; this takes them back off.
    .connect(band('lowpass', RADIO_HIGH_HZ * 1.2))
    .connect(radioOut).connect(radioMerged)
  radioMerged.connect(master)

  // The room's tail keeps ringing after the clip ends.
  const room = ctx.createConvolver()
  room.buffer = roomFor(ctx)
  const reverbWet = ctx.createGain()
  radioMerged.connect(room).connect(reverbWet).connect(master)

  // A delay that feeds part of itself back, so each repeat is quieter than the last.
  const delay = ctx.createDelay(1)
  delay.delayTime.value = ECHO_SECONDS
  const feedback = ctx.createGain()
  feedback.gain.value = ECHO_FEEDBACK
  const echoWet = ctx.createGain()
  radioMerged.connect(delay)
  delay.connect(feedback).connect(delay)
  delay.connect(echoWet).connect(master)

  const nodes: FxNodes = { distDrive, distOut, distDry, radioDry, radioOut, reverbWet, echoWet }
  applyFx(ctx, nodes, amounts, true)
  return nodes
}

/** Sets the amounts on a built chain; a running mix glides to them so a slider drag does not click. */
function applyFx(ctx: BaseAudioContext, n: FxNodes, a: FxAmounts, immediate: boolean) {
  const set = (param: AudioParam, value: number) => {
    if (immediate) param.value = value
    else param.setTargetAtTime(value, ctx.currentTime, 0.03)
  }
  set(n.distDrive.gain, DISTORTION_DRIVE_MIN + a.distortion * (DISTORTION_DRIVE_MAX - DISTORTION_DRIVE_MIN))
  // Equal-power blend, so the level holds steady instead of dipping in the middle of the slider.
  set(n.distOut.gain, Math.sin(a.distortion * Math.PI / 2) * DISTORTION_MATCH)
  set(n.distDry.gain, Math.cos(a.distortion * Math.PI / 2))
  const radioWet = Math.min(1, a.radio / RADIO_FULL_AT)
  set(n.radioDry.gain, 1 - radioWet)
  set(n.radioOut.gain, radioWet * RADIO_MAKEUP)
  set(n.reverbWet.gain, a.reverb * REVERB_WET)
  set(n.echoWet.gain, a.echo * ECHO_WET)
}

export interface MixHandle {
  stop(): void
  /**
   * Applies curve and effect changes to the mix while it plays. Returns false when the layout
   * itself changed (a clip moved, a song was swapped, the window is different), which needs a rebuild.
   */
  update(model: LinkModel, win: MixWindow): boolean
}

/**
 * Wires the whole mix into `dest` for `win`, starting at context time `when`.
 * Used by both the live preview and the offline render, so what is auditioned is what is sent.
 *
 * `from` auditions the same `win` starting part-way through it, for scrubbing. It never changes
 * what the window contains, so a preview from the middle still matches what is sent to air.
 */
export function scheduleMix(
  ctx: BaseAudioContext,
  dest: AudioNode,
  model: LinkModel,
  win: MixWindow,
  when: number,
  from: number = win.start,
): MixHandle {
  const length = win.end - win.start
  const at = (t: number) => when + Math.max(0, t - from)

  // The window's own fade in and out, as a curve in absolute time so it can be joined mid-way.
  const fadeIn = Math.min(EDGE_FADE, length / 2)
  const edges: EnvelopePoint[] = [
    { time: win.start, volume: 0 },
    { time: win.start + fadeIn, volume: 1 },
    { time: Math.max(win.start + fadeIn, win.end - EDGE_FADE), volume: 1 },
    { time: win.end, volume: 0 },
  ]
  const master = ctx.createGain()
  master.gain.setValueAtTime(envelopeAt(edges, from), at(from))
  for (const p of edges) {
    if (p.time > from && p.time <= win.end) master.gain.linearRampToValueAtTime(p.volume, at(p.time))
  }
  master.connect(dest)

  /** Puts a clip's volume curve on its gain from timeline time `t0` on. The curve is in the clip's own seconds. */
  const shapeGain = (gain: GainNode, env: EnvelopePoint[], start: number, t0: number, ctxT0: number, fresh: boolean) => {
    if (!fresh) gain.gain.cancelScheduledValues(ctxT0)
    gain.gain.setValueAtTime(envelopeAt(env, t0 - start), ctxT0)
    for (const p of env) {
      const tm = start + p.time
      if (tm > t0 && tm < win.end) gain.gain.linearRampToValueAtTime(p.volume, at(tm))
    }
  }

  const built: { key: string; buf: AudioBuffer; start: number; gain: GainNode | null; fx: FxNodes | null }[] = []
  const sources: AudioBufferSourceNode[] = []

  for (const { key, buf, start, env, fx } of layersOf(model)) {
    if (start + buf.duration <= from || start >= win.end) {
      built.push({ key, buf, start, gain: null, fx: null })
      continue
    }
    const playFrom = Math.max(from, start)
    const gain = ctx.createGain()
    shapeGain(gain, env, start, playFrom, at(playFrom), true)
    const src = ctx.createBufferSource()
    src.buffer = buf
    src.connect(gain)
    const nodes = fx ? buildFx(ctx, gain, master, fx) : null
    if (!nodes) gain.connect(master)
    src.start(at(playFrom), playFrom - start)
    src.stop(when + (win.end - from))
    sources.push(src)
    built.push({ key, buf, start, gain, fx: nodes })
  }

  return {
    stop() {
      for (const s of sources) {
        try { s.stop() } catch { /* not started or already stopped */ }
        s.disconnect()
      }
      master.disconnect()
    },
    update(next, nextWin) {
      if (nextWin.start !== win.start || Math.abs(nextWin.end - win.end) > 1e-6) return false
      const layers = layersOf(next)
      const same = layers.length === built.length
        && layers.every((l, i) => l.key === built[i].key && l.buf === built[i].buf && l.start === built[i].start)
      if (!same) return false
      const t0 = from + Math.max(0, ctx.currentTime - when)
      layers.forEach((l, i) => {
        const b = built[i]
        if (b.gain) shapeGain(b.gain, l.env, b.start, t0, ctx.currentTime, false)
        if (b.fx && l.fx) applyFx(ctx, b.fx, l.fx, false)
      })
      return true
    },
  }
}

/**
 * Where the DJ's mix begins, in junction seconds: the first moment A is not playing on its own at full
 * volume, because C, a B clip or A's own curve comes in. Up to there the render is plain A, the same
 * audio as the join on air, which is what lets aivox stitch the two anywhere before it.
 */
export function mixPointOf(model: LinkModel): number {
  const starts = [model.bStart, ...model.voices.flatMap(v => (v.buf ? [v.start] : []))]
  const dip = model.duckA.findIndex(p => p.volume < 0.999)
  if (dip >= 0) starts.push(model.aStart + (dip === 0 ? 0 : model.duckA[dip - 1].time))
  return Math.max(model.aStart, Math.min(...starts))
}

/** The same link with A silent: plan B, what airs once A has already played out on air. */
export function withoutA(model: LinkModel): LinkModel {
  return { ...model, duckA: [{ time: 0, volume: 0 }, { time: Math.max(0.01, model.a.duration), volume: 0 }] }
}

/** Plan B's range: it starts where the first thing other than A does, so it does not open on silence. */
export function planBWindow(model: LinkModel, win: MixWindow): MixWindow {
  const first = Math.min(model.bStart, ...model.voices.flatMap(v => (v.buf ? [v.start] : [])))
  return { start: Math.min(Math.max(win.start, first), Math.max(win.start, win.end - 1)), end: win.end }
}

export async function renderLink(model: LinkModel, win: MixWindow): Promise<AudioBuffer> {
  const sampleRate = model.a.sampleRate
  const ctx = new OfflineAudioContext(2, Math.ceil((win.end - win.start) * sampleRate), sampleRate)
  scheduleMix(ctx, ctx.destination, model, win, 0)
  return ctx.startRendering()
}

/** Opus runs at 48 kHz; the encoder resamples the render to it. */
const OPUS_SAMPLE_RATE = 48000

export interface EncodedJoin { blob: Blob; format: 'opus' | 'wav' }

/**
 * A join is a whole song plus the link, so it goes up as Opus in Ogg, about a ninth of the WAV.
 * A browser that cannot encode Opus sends WAV instead; the server takes either.
 */
export async function encodeJoin(buf: AudioBuffer): Promise<EncodedJoin> {
  const opus = await canEncodeAudio('opus', { numberOfChannels: buf.numberOfChannels, sampleRate: OPUS_SAMPLE_RATE, quality: QUALITY_HIGH })
    .catch(() => false)
  if (!opus) return { blob: encodeWav(buf), format: 'wav' }
  const output = new Output({ format: new OggOutputFormat(), target: new BufferTarget() })
  const source = new AudioBufferSource({ codec: 'opus', quality: QUALITY_HIGH, transform: { sampleRate: OPUS_SAMPLE_RATE } })
  output.addAudioTrack(source)
  await output.start()
  await source.add(buf)
  await output.finalize()
  return { blob: new Blob([output.target.buffer!], { type: 'audio/ogg' }), format: 'opus' }
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

/** Plays the mix; `onTick` gets the position on the junction timeline. Edits are heard as they are made. */
export class LinkPreview {
  private handle: MixHandle | null = null
  private raf = 0
  private pending: ReturnType<typeof setTimeout> | null = null
  /** Where the running graph began, so the current position can be worked out at any moment. */
  private started = { when: 0, from: 0 }
  /** Kept so a seek can rebuild the graph without the caller passing everything again. */
  private current: { model: LinkModel; win: MixWindow; onTick: (t: number) => void; onEnd: () => void } | null = null

  get playing() {
    return !!this.handle
  }

  play(model: LinkModel, win: MixWindow, onTick: (t: number) => void, onEnd: () => void, from = win.start) {
    this.stop()
    this.current = { model, win, onTick, onEnd }
    this.run(from)
  }

  /**
   * Audition from `t` instead. A buffer source cannot be repositioned once started, so the
   * graph is torn down and rebuilt at the new offset.
   */
  seek(t: number) {
    const cur = this.current
    if (!cur) return
    this.silence()
    this.run(Math.min(Math.max(t, cur.win.start), cur.win.end))
  }

  /**
   * Feeds an edit to the running mix. Curve and effect changes are applied in place, with no gap.
   * A change to the layout (a clip moved, a song swapped) needs the graph rebuilt at the current
   * position, which is held back briefly so a drag does not rebuild on every step.
   */
  refresh(model: LinkModel, win: MixWindow) {
    const cur = this.current
    if (!cur || !this.handle) return
    cur.model = model
    cur.win = win
    if (this.handle.update(model, win)) return
    if (this.pending) clearTimeout(this.pending)
    this.pending = setTimeout(() => {
      this.pending = null
      if (this.handle) this.seek(this.position())
    }, 120)
  }

  private position() {
    return this.started.from + Math.max(0, getAudioContext().currentTime - this.started.when)
  }

  /** Silence the graph but stay armed, so a following `seek` can pick the audition back up. */
  suspend() {
    this.silence()
  }

  private silence() {
    cancelAnimationFrame(this.raf)
    if (this.pending) { clearTimeout(this.pending); this.pending = null }
    this.handle?.stop()
    this.handle = null
  }

  private run(from: number) {
    const cur = this.current
    if (!cur) return
    const ctx = getAudioContext()
    void ctx.resume()
    const when = ctx.currentTime + 0.08
    this.started = { when, from }
    this.handle = scheduleMix(ctx, ctx.destination, cur.model, cur.win, when, from)
    const tick = () => {
      // The window can change under a running mix, so its end is read fresh each frame.
      if (ctx.currentTime >= when + (cur.win.end - from)) {
        this.stop()
        cur.onEnd()
        return
      }
      cur.onTick(from + Math.max(0, ctx.currentTime - when))
      this.raf = requestAnimationFrame(tick)
    }
    this.raf = requestAnimationFrame(tick)
  }

  stop() {
    this.silence()
    this.current = null
  }
}
