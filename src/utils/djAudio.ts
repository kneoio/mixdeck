import datanestApiService from '@/services/datanestApi'

/** Only the tail of A and the head of B are ever loaded into the editor. */
export const TAIL_SECONDS = 40
export const HEAD_SECONDS = 40
/** How far B's head starts before A's tail ends. */
export const OVERLAP_SECONDS = 4
export const MAX_VOICE_SECONDS = 20
/** How many voice / effect lanes (B1, B2 …) a link can carry. */
export const MAX_VOICE_LANES = 3
/** How far past the end of A the DJ may slide C, to open up room for the B lanes. */
export const MAX_GAP_SECONDS = 60
/** Default position of the vocal entry marker, seconds into B's head. */
export const DEFAULT_VOCAL_ENTRY = 12

let audioContext: AudioContext | null = null

export function getAudioContext(): AudioContext {
  if (!audioContext) {
    const Ctor = window.AudioContext ?? (window as any).webkitAudioContext
    audioContext = new Ctor()
  }
  return audioContext
}

/** Same source resolution as the Playlist player (audioPlayer.playFragment), decoded for editing. */
export async function fetchSongBuffer(slugName: string): Promise<AudioBuffer> {
  const frag: any = await datanestApiService.getDocument<any>('/public/soundfragments', slugName)
  const doc = frag?.payload?.docData ?? frag?.docData ?? frag
  const file = doc?.uploadedFiles?.find((f: any) => f.type === 'opus') ?? doc?.uploadedFiles?.[0]
  const url = file ? datanestApiService.soundFragmentFileUrl(slugName, file.id) : (doc?.url || '')
  if (!url) throw new Error('No audio file for this song')
  const data = await datanestApiService.fetchArrayBuffer(url)
  return getAudioContext().decodeAudioData(data)
}

export async function decodeBlob(blob: Blob): Promise<AudioBuffer> {
  return getAudioContext().decodeAudioData(await blob.arrayBuffer())
}

function slice(buf: AudioBuffer, fromSec: number, toSec: number): AudioBuffer {
  const sr = buf.sampleRate
  const from = Math.max(0, Math.floor(fromSec * sr))
  const to = Math.min(buf.length, Math.floor(toSec * sr))
  const out = new AudioBuffer({
    length: Math.max(1, to - from),
    numberOfChannels: buf.numberOfChannels,
    sampleRate: sr,
  })
  for (let ch = 0; ch < buf.numberOfChannels; ch++) {
    out.copyToChannel(buf.getChannelData(ch).subarray(from, to), ch)
  }
  return out
}

export const cropTail = (buf: AudioBuffer, seconds = TAIL_SECONDS) =>
  slice(buf, buf.duration - seconds, buf.duration)

export const cropHead = (buf: AudioBuffer, seconds = HEAD_SECONDS) =>
  slice(buf, 0, seconds)

/** ~100 peaks per second, enough to draw the lane without handing wavesurfer raw samples. */
export function peaksOf(buf: AudioBuffer): Float32Array {
  const buckets = Math.max(2, Math.ceil(buf.duration * 100))
  const size = Math.max(1, Math.floor(buf.length / buckets))
  const out = new Float32Array(buckets)
  for (let ch = 0; ch < buf.numberOfChannels; ch++) {
    const data = buf.getChannelData(ch)
    for (let i = 0; i < buckets; i++) {
      let peak = out[i]
      const end = Math.min(data.length, (i + 1) * size)
      for (let j = i * size; j < end; j++) {
        const v = Math.abs(data[j])
        if (v > peak) peak = v
      }
      out[i] = peak
    }
  }
  return out
}
