<template>
  <n-config-provider :theme="darkTheme">
    <div class="welcome-page">
      <header class="nav">
        <div class="logo">MIXPLA</div>
      </header>

      <section class="hero" id="platform">
        <div class="hero-text">
          <div class="hero-ctas">
            <div class="cta-item">
              <n-button type="primary" size="large" class="cta-button neon-orange" :style="neonPulseStyles[0]" @click="goToMixpla">{{ t('welcome.cta_mixplay') }}</n-button>
              <span class="cta-hint">{{ t('welcome.cta_mixplay_hint') }}</span>
            </div>
            <div class="cta-item">
              <n-button size="large" class="cta-button neon-cyan" :style="neonPulseStyles[1]" @click="goToBrands">{{ t('welcome.cta_portal') }}</n-button>
              <span class="cta-hint">{{ t('welcome.cta_portal_hint') }}</span>
            </div>
            <div class="cta-item">
              <n-button size="large" class="cta-button neon-magenta" :style="neonPulseStyles[2]" @click="router.push('/submission')">{{ t('welcome.cta_submit') }}</n-button>
              <span class="cta-hint">{{ t('welcome.cta_submit_hint') }}</span>
            </div>
            <div class="cta-item">
              <n-button size="large" class="cta-button neon-lime" :style="neonPulseStyles[3]" @click="router.push('/ots')">{{ t('welcome.cta_ots') }}</n-button>
              <span class="cta-hint">{{ t('welcome.cta_ots_hint') }}</span>
            </div>
            <div class="cta-item">
              <n-button size="large" class="cta-button neon-violet" :style="neonPulseStyles[4]" @click="router.push('/help')">{{ t('welcome.cta_help') }}</n-button>
              <span class="cta-hint">{{ t('welcome.cta_help_hint') }}</span>
            </div>
          </div>
        </div>
        <div class="hero-city-wrap">
          <img class="hero-city" src="/city.png" alt="" />
          <svg
            ref="cityFxRef"
            class="city-fx"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <rect
              v-for="(win, i) in cityWindows"
              :key="'w' + i"
              class="city-fx__window"
              :x="win.x"
              :y="win.y"
              :width="win.w"
              :height="win.h"
              :fill="win.color"
            />
            <circle
              v-for="(glow, i) in distantGlows"
              :key="'d' + i"
              class="city-fx__distant"
              :cx="glow.x"
              :cy="glow.y"
              :r="glow.r"
              :fill="glow.color"
            />
            <g
              v-for="(light, i) in headlights"
              :key="'h' + i"
              class="city-fx__headlight"
              :data-x0="light.x0"
              :data-y0="light.y0"
              :data-x1="light.x1"
              :data-y1="light.y1"
              :data-tone="light.tone"
            >
              <circle class="city-fx__headlight-halo" r="1.05" />
              <circle class="city-fx__headlight-core" r="0.34" />
            </g>
          </svg>
        </div>
        <div class="hero-motto neon-motto">
          <span>{{ t('welcome.motto_line1') }}</span>
          <span>{{ t('welcome.motto_line2') }}</span>
        </div>
      </section>

      <footer class="footer">
        <div class="logo">MIXPLA</div>
        <div class="status">{{ t('welcome.footer_status') }}</div>
        <div class="copyright">© Mixpla</div>
        <a class="affiliation" href="https://semantyca.com" target="_blank" rel="noopener noreferrer">By Semantyca</a>
      </footer>
    </div>
  </n-config-provider>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { NButton, NConfigProvider, darkTheme } from 'naive-ui'
import gsap from 'gsap'

const { t } = useI18n()
const router = useRouter()

const cityFxRef = ref<SVGSVGElement | null>(null)
let cityFxCtx: gsap.Context | null = null

/** Image-space % coords (viewBox 0–100). Vanishing point ~ center of the street canyon. */
const CITY_VP = { x: 50, y: 49.8 }

const cityWindows = [
  { x: 6.2, y: 16.5, w: 0.72, h: 1.25, color: '#d9ecff' },
  { x: 9.4, y: 24.8, w: 0.64, h: 1.1, color: '#cfe4ff' },
  { x: 4.8, y: 33.2, w: 0.7, h: 1.18, color: '#fff4e0' },
  { x: 12.6, y: 19.4, w: 0.58, h: 1.02, color: '#d7e8ff' },
  { x: 8.1, y: 42.6, w: 0.6, h: 1.05, color: '#c8dcff' },
  { x: 15.8, y: 28.5, w: 0.52, h: 0.92, color: '#e4d7ff' },
  { x: 19.4, y: 36.2, w: 0.46, h: 0.82, color: '#d9ecff' },
  { x: 11.5, y: 49.8, w: 0.5, h: 0.88, color: '#fff1d6' },
  { x: 23.2, y: 31.4, w: 0.42, h: 0.74, color: '#cfe4ff' },
  { x: 27.6, y: 39.8, w: 0.36, h: 0.64, color: '#d7e8ff' },
  { x: 91.8, y: 17.2, w: 0.72, h: 1.25, color: '#d9ecff' },
  { x: 88.2, y: 26.4, w: 0.64, h: 1.1, color: '#fff4e0' },
  { x: 93.6, y: 34.8, w: 0.7, h: 1.18, color: '#cfe4ff' },
  { x: 85.4, y: 20.6, w: 0.58, h: 1.02, color: '#e4d7ff' },
  { x: 90.1, y: 44.2, w: 0.6, h: 1.05, color: '#d7e8ff' },
  { x: 82.4, y: 29.8, w: 0.52, h: 0.92, color: '#c8dcff' },
  { x: 78.6, y: 37.4, w: 0.46, h: 0.82, color: '#d9ecff' },
  { x: 86.8, y: 51.2, w: 0.5, h: 0.88, color: '#fff1d6' },
  { x: 74.8, y: 32.6, w: 0.42, h: 0.74, color: '#cfe4ff' },
  { x: 70.6, y: 40.4, w: 0.36, h: 0.64, color: '#d7e8ff' },
]

const distantGlows = [
  { x: 49.15, y: 48.6, r: 0.38, color: '#c8dcff' },
  { x: 51.05, y: 49.4, r: 0.3, color: '#e4d7ff' },
  { x: 48.35, y: 50.2, r: 0.24, color: '#d9ecff' },
  { x: 50.7, y: 47.8, r: 0.22, color: '#fff4e0' },
]

const headlights = [
  { x0: 28.4, y0: 97.0, x1: 48.7, y1: CITY_VP.y, tone: 'warm' },
  { x0: 36.8, y0: 96.4, x1: 49.2, y1: CITY_VP.y, tone: 'tail' },
  { x0: 44.2, y0: 97.4, x1: 49.6, y1: CITY_VP.y, tone: 'cool' },
  { x0: 55.8, y0: 96.8, x1: 50.4, y1: CITY_VP.y, tone: 'warm' },
  { x0: 64.2, y0: 97.2, x1: 50.8, y1: CITY_VP.y, tone: 'tail' },
  { x0: 73.6, y0: 96.6, x1: 51.3, y1: CITY_VP.y, tone: 'cool' },
]

function rand(min: number, max: number) {
  return min + Math.random() * (max - min)
}

function headlightOpacity(t: number) {
  if (t < 0.07) return t / 0.07
  if (t > 0.7) return Math.max(0, (1 - t) / 0.3)
  return 1
}

function startCityFx() {
  cityFxCtx?.revert()
  cityFxCtx = null

  const root = cityFxRef.value
  if (!root) return

  cityFxCtx = gsap.context(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduceMotion) return

    root.querySelectorAll<SVGRectElement>('.city-fx__window').forEach((el) => {
      const dim = rand(0.04, 0.16)
      const lit = rand(0.28, 0.62)
      gsap.set(el, { opacity: Math.random() < 0.45 ? lit : dim })
      const tl = gsap.timeline({ repeat: -1, delay: rand(0, 5) })
      tl.to(el, { opacity: lit, duration: rand(2.2, 6.2), ease: 'sine.inOut' })
      tl.to(el, { opacity: dim, duration: rand(2.4, 7), ease: 'sine.inOut', delay: rand(0.4, 3.8) })
    })

    root.querySelectorAll<SVGCircleElement>('.city-fx__distant').forEach((el) => {
      gsap.set(el, { opacity: rand(0.04, 0.12) })
      gsap.to(el, {
        opacity: rand(0.16, 0.34),
        duration: rand(3.2, 7.5),
        ease: 'sine.inOut',
        yoyo: true,
        repeat: -1,
        delay: rand(0, 6),
        repeatDelay: rand(2.5, 9),
      })
    })

    root.querySelectorAll<SVGGElement>('.city-fx__headlight').forEach((el, i) => {
      const x0 = Number(el.dataset.x0)
      const y0 = Number(el.dataset.y0)
      const x1 = Number(el.dataset.x1)
      const y1 = Number(el.dataset.y1)
      const halo = el.querySelector('.city-fx__headlight-halo')
      const core = el.querySelector('.city-fx__headlight-core')
      const proxy = { t: 0 }

      gsap.set(el, { opacity: 0 })
      gsap.fromTo(
        proxy,
        { t: 0 },
        {
          t: 1,
          duration: rand(8, 15),
          delay: i < 3 ? rand(0, 0.6) : rand(1.2, 6.5),
          ease: 'power1.out',
          repeat: -1,
          repeatDelay: rand(0.8, 4.5),
          onUpdate: () => {
            const t = proxy.t
            const x = x0 + (x1 - x0) * t
            const y = y0 + (y1 - y0) * t
            const s = 1 - 0.86 * t
            el.setAttribute('transform', `translate(${x} ${y})`)
            halo?.setAttribute('r', String(1.05 * s))
            core?.setAttribute('r', String(0.34 * s))
            el.style.opacity = String(headlightOpacity(t) * 0.7)
          },
          onRepeat: () => {
            el.style.opacity = '0'
          },
        }
      )
    })
  }, root)
}

onMounted(() => {
  startCityFx()
})

onUnmounted(() => {
  cityFxCtx?.revert()
  cityFxCtx = null
})

function randomPulseStyle() {
  const duration = 1.6 + Math.random() * 2.4
  const delay = Math.random() * duration
  return {
    '--pulse-duration': `${duration.toFixed(2)}s`,
    '--pulse-delay': `${delay.toFixed(2)}s`,
  }
}

const neonPulseStyles = Array.from({ length: 5 }, randomPulseStyle)

function goToMixpla() {
  window.open('https://mixpla.online', '_blank', 'noopener,noreferrer')
}

function goToBrands() {
  router.push('/mixdeck')
}
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
@import url("https://fonts.googleapis.com/css?family=Sacramento&display=swap");

@font-face {
  font-family: 'Kaylon';
  src: url('/src/assets/fonts/kaylonbold.otf') format('opentype');
  font-weight: 700;
  font-style: normal;
  font-display: swap;
}

:global(html),
:global(body),
:global(#app) {
  background: #050505;
}

.welcome-page {
  min-height: 100vh;
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  background: #050505;
  color: #f5f5f5;
  font-family: 'Inter', sans-serif;
  padding: 24px clamp(16px, 4vw, 48px);
}

.nav {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 24px;
  padding-bottom: 16px;
}

.logo {
  font-family: 'Kaylon', 'Inter', sans-serif;
  font-weight: 700;
  letter-spacing: 0.24em;
  font-size: clamp(1.1rem, 2vw, 1.6rem);
  color: #c0c0c0;
}

.hero {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 0;
  min-height: 0;
}

.hero-text {
  flex: 0 0 auto;
}

.eyebrow {
  letter-spacing: 0.4em;
  text-transform: uppercase;
  color: #888;
  font-size: 0.75rem;
}

.hero-city-wrap {
  flex: 0 0 auto;
  position: relative;
  height: 420px;
  width: auto;
  overflow: hidden;
}

.hero-city {
  height: 100%;
  width: auto;
  object-fit: contain;
  display: block;
}

.city-fx {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  overflow: hidden;
}

.city-fx__window,
.city-fx__distant,
.city-fx__headlight {
  opacity: 0;
}

.city-fx__headlight-halo {
  opacity: 0.28;
}

.city-fx__headlight-core {
  opacity: 0.95;
}

.city-fx__headlight[data-tone='warm'] .city-fx__headlight-halo { fill: #ffd9a0; }
.city-fx__headlight[data-tone='warm'] .city-fx__headlight-core { fill: #fff6dc; }
.city-fx__headlight[data-tone='tail'] .city-fx__headlight-halo { fill: #ff5a3c; }
.city-fx__headlight[data-tone='tail'] .city-fx__headlight-core { fill: #ffb199; }
.city-fx__headlight[data-tone='cool'] .city-fx__headlight-halo { fill: #7ecfff; }
.city-fx__headlight[data-tone='cool'] .city-fx__headlight-core { fill: #eaf6ff; }

.hero-motto {
  flex: 0 1 auto;
  max-width: 14rem;
  display: flex;
  flex-direction: column;
  gap: 0.25em;
  margin: 0;
  font-size: clamp(1.1rem, 2vw, 1.75rem);
  font-weight: 700;
  line-height: 1.15;
  letter-spacing: 0.04em;
  text-transform: none;
}

.neon-motto {
  text-shadow: 0 0 5px #ffa500, 0 0 15px #ffa500, 0 0 20px #ffa500, 0 0 40px #ffa500, 0 0 60px #ff0000, 0 0 10px #ff8d00, 0 0 98px #ff0000;
  color: #fff6a9;
  text-align: left;
  animation: blink 12s infinite;
  -webkit-animation: blink 12s infinite;
}

.hero-ctas {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 16px;
  margin-top: 0;
}

.cta-item {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
}

.cta-hint {
  color: #888;
  font-size: 0.85rem;
  padding-left: 4px;
}

.cta-button {
  --neon: #ff7a18;
  --neon-soft: rgba(255, 122, 24, 0.55);
  --neon-strong: rgba(255, 122, 24, 0.95);
  border: 1px solid var(--neon) !important;
  background: rgba(0, 0, 0, 0.55) !important;
  color: var(--neon) !important;
  font-weight: 700;
  letter-spacing: 0.08em;
  box-shadow:
    0 0 6px var(--neon-soft),
    0 0 18px var(--neon-soft),
    0 0 36px var(--neon-soft),
    inset 0 0 12px var(--neon-soft);
  text-shadow: 0 0 8px var(--neon-soft), 0 0 16px var(--neon-soft);
  transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease, text-shadow 0.2s ease;
  animation: neon-pulse var(--pulse-duration, 2.4s) ease-in-out var(--pulse-delay, 0s) infinite;
}

.cta-button:hover {
  transform: translateY(-2px);
  box-shadow:
    0 0 8px var(--neon-strong),
    0 0 24px var(--neon-strong),
    0 0 48px var(--neon-soft),
    inset 0 0 16px var(--neon-soft);
}

.neon-orange {
  --neon: #ff7a18;
  --neon-soft: rgba(255, 122, 24, 0.55);
  --neon-strong: rgba(255, 122, 24, 0.95);
  text-transform: uppercase;
}

.neon-cyan {
  --neon: #2ee6ff;
  --neon-soft: rgba(46, 230, 255, 0.5);
  --neon-strong: rgba(46, 230, 255, 0.95);
}

.neon-magenta {
  --neon: #ff2ea6;
  --neon-soft: rgba(255, 46, 166, 0.5);
  --neon-strong: rgba(255, 46, 166, 0.95);
}

.neon-lime {
  --neon: #a8ff2e;
  --neon-soft: rgba(168, 255, 46, 0.5);
  --neon-strong: rgba(168, 255, 46, 0.95);
}

.neon-violet {
  --neon: #b56bff;
  --neon-soft: rgba(181, 107, 255, 0.5);
  --neon-strong: rgba(181, 107, 255, 0.95);
}

@keyframes neon-pulse {
  0%, 100% {
    box-shadow:
      0 0 6px var(--neon-soft),
      0 0 18px var(--neon-soft),
      0 0 36px var(--neon-soft),
      inset 0 0 12px var(--neon-soft);
    text-shadow: 0 0 6px var(--neon-soft), 0 0 12px var(--neon-soft);
  }
  50% {
    box-shadow:
      0 0 10px var(--neon-strong),
      0 0 28px var(--neon-strong),
      0 0 56px var(--neon-soft),
      inset 0 0 18px var(--neon-soft);
    text-shadow: 0 0 10px var(--neon), 0 0 22px var(--neon-strong);
  }
}

.footer {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 16px;
  padding-top: 24px;
  margin-top: auto;
  border-top: 1px solid #1a1a1a;
  align-items: center;
}

.status {
  color: #68ffba;
}

@-webkit-keyframes blink {
  20%,
  24%,
  55% {
    color: #111;
    text-shadow: none;
  }

  0%,
  19%,
  21%,
  23%,
  25%,
  54%,
  56%,
  100% {
    text-shadow: 0 0 5px #ffa500, 0 0 15px #ffa500, 0 0 20px #ffa500, 0 0 40px #ffa500, 0 0 60px #ff0000, 0 0 10px #ff8d00, 0 0 98px #ff0000;
    color: #fff6a9;
  }
}

@keyframes blink {
  20%,
  24%,
  55% {
    color: #111;
    text-shadow: none;
  }

  0%,
  19%,
  21%,
  23%,
  25%,
  54%,
  56%,
  100% {
    text-shadow: 0 0 5px #ffa500, 0 0 15px #ffa500, 0 0 20px #ffa500, 0 0 40px #ffa500, 0 0 60px #ff0000, 0 0 10px #ff8d00, 0 0 98px #ff0000;
    color: #fff6a9;
  }
}

@media (max-width: 480px) {
  .nav {
    flex-direction: column;
  }

  .hero {
    flex-direction: column;
    align-items: flex-start;
    gap: 24px;
  }

  .hero-city-wrap {
    display: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .city-fx {
    display: none;
  }
}
</style>
