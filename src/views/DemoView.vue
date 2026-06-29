<template>
  <n-config-provider :theme="darkTheme" :theme-overrides="themeOverrides">
    <div class="submission-page">
      <div class="side-label neon-motto">DEMO</div>

      <header class="nav">
        <div class="logo" @click="router.push('/')" style="cursor:pointer">MIXPLA</div>
      </header>

      <div class="page-center">
        <section class="submission-card">
          <p class="step-intro">Listen to our demo tracks below.</p>

          <div class="tracks-list">
            <div v-for="(track, i) in tracks" :key="track.src" class="track-row">
              <div class="track-title">{{ track.title }}</div>
              <div class="audio-mini-player">
                <div class="audio-mini-player__row">
                  <div class="audio-mini-player__main">
                    <div class="audio-mini-player__top-row">
                      <div class="audio-mini-player__play-col">
                        <NButton
                          text
                          quaternary
                          class="audio-mini-player__play-icon-btn"
                          :aria-label="states[i].playing ? 'Pause' : 'Play'"
                          @click="togglePlay(i)"
                        >
                          <template #icon>
                            <NIcon :size="22">
                              <PauseOutline v-if="states[i].playing" />
                              <PlayOutline v-else />
                            </NIcon>
                          </template>
                        </NButton>
                      </div>
                      <div class="audio-mini-player__bar-area">
                        <div class="audio-mini-player__bar-wrap">
                          <div class="audio-mini-player__bar-layer" aria-hidden="true">
                            <NProgress
                              type="line"
                              :percentage="states[i].progress"
                              :show-indicator="false"
                              :height="2"
                              :border-radius="1"
                              :fill-border-radius="1"
                              color="#eff605"
                              rail-color="rgba(255,255,255,0.12)"
                            />
                          </div>
                          <div
                            class="audio-mini-player__seek-hit"
                            role="slider"
                            tabindex="-1"
                            :aria-valuenow="Math.round(states[i].progress)"
                            aria-valuemin="0"
                            aria-valuemax="100"
                            @mousedown="(e) => onSeekMouseDown(e, i)"
                          />
                        </div>
                      </div>
                    </div>
                    <div class="audio-mini-player__times">
                      <span>{{ formatTime(states[i].currentTime) }}</span>
                      <span class="audio-mini-player__sep">/</span>
                      <span>{{ formatTime(states[i].duration) }}</span>
                    </div>
                  </div>
                </div>
              </div>
              <audio
                :ref="(el) => setAudioRef(el, i)"
                :src="track.src"
                @timeupdate="(e) => onTimeUpdate(e, i)"
                @loadedmetadata="(e) => onMeta(e, i)"
                @play="states[i].playing = true"
                @pause="states[i].playing = false"
                @ended="onEnded(i)"
              />
            </div>
          </div>
        </section>
      </div>

      <footer class="footer">
        <div class="copyright">© Mixpla</div>
      </footer>
    </div>
  </n-config-provider>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { NConfigProvider, NButton, NIcon, NProgress, darkTheme, type GlobalThemeOverrides } from 'naive-ui'
import { PlayOutline, PauseOutline } from '@vicons/ionicons5'
import manchine1 from '../assets/audio/ENG-DJ_Manchine_1.mp3'
import clentara1 from '../assets/audio/ENG-DJ_Clentara_1_with_AD.mp3'
import synapso1 from '../assets/audio/ES-DJ-Synapso_1.mp3'
import elio from '../assets/audio/FR-DJ-Elio.mp3'
import fumo1 from '../assets/audio/PT-DJ-Fumo_1.mp3'
import cornholio from '../assets/audio/ENG-DJ_Cornholio_1.mp3'
import lexclo0 from '../assets/audio/ENG-DJ_Lexclo.mp3'
import lexclo1 from '../assets/audio/ENG-DJ_Lexclo_1.mp3'
import manchine2 from '../assets/audio/ENG-DJ_Manchine_2_with_AD.mp3'
import manchine3 from '../assets/audio/ENG-DJ_Manchine_3.mp3'
import synapso2 from '../assets/audio/ES-DJ-Synapso_2.mp3'
import elio2 from '../assets/audio/FR-DJ-Elio_2.mp3'
import fumo2 from '../assets/audio/PT-DJ-Fumo_2_with_greeting.mp3'
import aricardo from '../assets/audio/PT-DJ-Aricardo_1.mp3'
import kaia from '../assets/audio/NO-dj-Kaia.wav'
import kuon from '../assets/audio/ja-JP-DJ_Kuon.mp3'
import akee from '../assets/audio/Kazakh-DJ_Akee.mp3'
import bogdan from '../assets/audio/UKR-DJ_Bogdan_1.mp3'
import crossfade from '../assets/audio/Automatic_crossfade.mp3'
import weatherBlock from '../assets/audio/ENG_weather_block.mp3'
import jingle1 from '../assets/audio/Jingle_1.mp3'

const router = useRouter()

const themeOverrides: GlobalThemeOverrides = {
  common: {
    primaryColor: '#7C3AED',
    primaryColorHover: '#9d5bf4',
    primaryColorPressed: '#6d31d4',
    primaryColorSuppl: '#7C3AED',
  },
}

const tracks = [
  { title: 'DJ Manchine (ENG)', src: manchine1 },
  { title: 'DJ Clentara — with AD (ENG)', src: clentara1 },
  { title: 'DJ Synapso (ES)', src: synapso1 },
  { title: 'DJ Elio (FR)', src: elio },
  { title: 'DJ Fumo (PT)', src: fumo1 },
  { title: 'DJ Cornholio (ENG)', src: cornholio },
  { title: 'DJ Lexclo (ENG)', src: lexclo0 },
  { title: 'DJ Lexclo (ENG)', src: lexclo1 },
  { title: 'DJ Manchine — with AD (ENG)', src: manchine2 },
  { title: 'DJ Manchine (ENG)', src: manchine3 },
  { title: 'DJ Synapso (ES)', src: synapso2 },
  { title: 'DJ Elio (FR)', src: elio2 },
  { title: 'DJ Fumo — with Greeting (PT)', src: fumo2 },
  { title: 'DJ Aricardo (PT)', src: aricardo },
  { title: 'DJ Kaia (NO)', src: kaia },
  { title: 'DJ Kuon (JA)', src: kuon },
  { title: 'DJ Akee (KZ)', src: akee },
  { title: 'DJ Bogdan (UKR)', src: bogdan },
  { title: 'Automatic Crossfade', src: crossfade },
  { title: 'Weather Block (ENG)', src: weatherBlock },
  { title: 'Jingle 1', src: jingle1 },
]

const states = reactive(tracks.map(() => ({
  playing: false,
  progress: 0,
  currentTime: 0,
  duration: 0,
})))

const audioEls: (HTMLAudioElement | null)[] = tracks.map(() => null)

function setAudioRef(el: any, i: number) {
  audioEls[i] = el as HTMLAudioElement | null
}

function togglePlay(i: number) {
  const audio = audioEls[i]
  if (!audio) return
  if (states[i].playing) {
    audio.pause()
  } else {
    audioEls.forEach((a, j) => { if (j !== i && a) a.pause() })
    audio.play()
  }
}

function onTimeUpdate(e: Event, i: number) {
  const audio = e.target as HTMLAudioElement
  if (!audio.duration) return
  states[i].currentTime = audio.currentTime
  states[i].progress = (audio.currentTime / audio.duration) * 100
}

function onMeta(e: Event, i: number) {
  states[i].duration = (e.target as HTMLAudioElement).duration
}

function onEnded(i: number) {
  states[i].playing = false
  states[i].progress = 0
  states[i].currentTime = 0
}

function onSeekMouseDown(e: MouseEvent, i: number) {
  if (e.button !== 0) return
  e.preventDefault()
  const audio = audioEls[i]
  if (!audio) return
  const bar = e.currentTarget as HTMLElement
  function doSeek(ev: MouseEvent) {
    if (!audio!.duration) return
    const rect = bar.getBoundingClientRect()
    const ratio = Math.min(1, Math.max(0, (ev.clientX - rect.left) / rect.width))
    audio!.currentTime = ratio * audio!.duration
  }
  doSeek(e)
  function onMove(ev: MouseEvent) { doSeek(ev) }
  function onUp() {
    document.removeEventListener('mousemove', onMove)
    document.removeEventListener('mouseup', onUp)
  }
  document.addEventListener('mousemove', onMove)
  document.addEventListener('mouseup', onUp)
}

function formatTime(s: number): string {
  if (!Number.isFinite(s) || s < 0) return '0:00'
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
}
</script>

<style scoped>
@font-face {
  font-family: 'Kaylon';
  src: url('/src/assets/fonts/kaylonbold.otf') format('opentype');
  font-weight: 700;
  font-style: normal;
  font-display: swap;
}

:global(body) { background: #050505; }

.submission-page {
  min-height: 100vh;
  background: #050505;
  color: #f5f5f5;
  font-family: 'Inter', sans-serif;
  padding: 24px clamp(16px, 4vw, 64px);
  display: flex;
  flex-direction: column;
}

.page-center {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px 0;
}

.side-label {
  position: fixed;
  left: 16px;
  top: 50%;
  transform: translateY(-50%) rotate(-90deg);
  transform-origin: center center;
  font-size: 0.75rem;
  letter-spacing: 0.4em;
  text-transform: uppercase;
  white-space: nowrap;
  pointer-events: none;
}

.neon-motto {
  text-shadow: 0 0 5px #ffa500, 0 0 15px #ffa500, 0 0 20px #ffa500, 0 0 40px #ffa500, 0 0 60px #ff0000, 0 0 10px #ff8d00, 0 0 98px #ff0000;
  color: #fff6a9;
  animation: blink 12s infinite;
}

@keyframes blink {
  20%, 24%, 55% { color: #111; text-shadow: none; }
  0%, 19%, 21%, 23%, 25%, 54%, 100% {
    text-shadow: 0 0 5px #ffa500, 0 0 15px #ffa500, 0 0 20px #ffa500, 0 0 40px #ffa500, 0 0 60px #ff0000, 0 0 10px #ff8d00, 0 0 98px #ff0000;
    color: #fff6a9;
  }
}

.nav {
  display: flex;
  align-items: center;
  padding-bottom: 12px;
}

.logo {
  font-family: 'Kaylon', 'Inter', sans-serif;
  font-weight: 700;
  letter-spacing: 0.24em;
  font-size: clamp(1.1rem, 2vw, 1.6rem);
  color: #c0c0c0;
}

.submission-card {
  width: 100%;
  max-width: 600px;
  background: #0f0f0f;
  border: 1px solid #1f1f1f;
  border-radius: 16px;
  padding: 32px 36px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.step-intro {
  font-size: 0.85rem;
  color: #777;
  line-height: 1.65;
  margin: 0;
}

.tracks-list {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.track-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.track-title {
  font-size: 0.88rem;
  color: #b0b0b0;
  font-weight: 500;
}

/* AudioMiniPlayer styles (copied from AudioMiniPlayer.vue) */
.audio-mini-player { width: 100%; }
.audio-mini-player__row { display: flex; align-items: center; gap: 8px; width: 100%; flex-wrap: nowrap; }
.audio-mini-player__main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
.audio-mini-player__top-row { display: flex; align-items: center; gap: 8px; width: 100%; min-width: 0; }
.audio-mini-player__play-col { flex-shrink: 0; display: flex; align-items: center; }
.audio-mini-player__play-icon-btn { padding: 2px !important; min-width: auto !important; }
.audio-mini-player__play-icon-btn :deep(.n-icon) { color: inherit; }
.audio-mini-player__bar-area { flex: 1; min-width: 0; }
.audio-mini-player__bar-wrap { position: relative; width: 100%; min-height: 22px; display: flex; align-items: center; }
.audio-mini-player__bar-layer { position: absolute; left: 0; right: 0; top: 50%; transform: translateY(-50%); z-index: 0; pointer-events: none; }
.audio-mini-player__seek-hit { position: absolute; left: 0; right: 0; top: 50%; transform: translateY(-50%); height: 22px; z-index: 1; cursor: pointer; user-select: none; }
.audio-mini-player__times { display: flex; align-items: center; gap: 4px; font-size: 11px; line-height: 1.2; opacity: 0.55; font-variant-numeric: tabular-nums; }
.audio-mini-player__sep { opacity: 0.7; }

.footer {
  padding-top: 40px;
  margin-top: 48px;
  border-top: 1px solid #1a1a1a;
}

.copyright {
  color: #444;
  font-size: 0.8rem;
}
</style>
