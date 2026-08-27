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
          <div ref="cityFxRef" class="city-fx" aria-hidden="true">
            <span
              v-for="(win, i) in cityWindows"
              :key="'w' + i"
              class="city-fx__window"
              :style="{
                left: win.x + '%',
                top: win.y + '%',
                width: win.w + '%',
                height: win.h + '%',
                background: win.color,
              }"
            />
            <span
              v-for="(glow, i) in distantGlows"
              :key="'d' + i"
              class="city-fx__distant"
              :style="{ left: glow.x + '%', top: glow.y + '%' }"
            />
            <span
              v-for="(light, i) in headlights"
              :key="'h' + i"
              class="city-fx__headlight"
              :class="'city-fx__headlight--' + light.tone"
              :data-x0="light.x0"
              :data-y0="light.y0"
              :data-x1="light.x1"
              :data-y1="light.y1"
            />
          </div>
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
import { nextTick, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { NButton, NConfigProvider, darkTheme } from 'naive-ui'
import gsap from 'gsap'

const { t } = useI18n()
const router = useRouter()

const cityFxRef = ref<HTMLElement | null>(null)
let cityFxCtx: gsap.Context | null = null

/** Image-space % coords. Vanishing point ~ center of the street canyon. */
const CITY_VP = { x: 50, y: 49.8 }

const cityWindows = [
  { x: 5.4, y: 14.8, w: 1.35, h: 2.2, color: '#e7f4ff' },
  { x: 8.8, y: 22.5, w: 1.2, h: 2.0, color: '#d4ebff' },
  { x: 4.2, y: 31.6, w: 1.3, h: 2.1, color: '#fff4dc' },
  { x: 11.8, y: 17.8, w: 1.1, h: 1.85, color: '#dff0ff' },
  { x: 7.4, y: 41.2, w: 1.15, h: 1.9, color: '#cfe4ff' },
  { x: 14.6, y: 26.8, w: 1.0, h: 1.7, color: '#ead9ff' },
  { x: 18.4, y: 34.8, w: 0.9, h: 1.5, color: '#e7f4ff' },
  { x: 10.6, y: 48.4, w: 1.0, h: 1.65, color: '#ffe9c4' },
  { x: 22.2, y: 29.6, w: 0.8, h: 1.35, color: '#d4ebff' },
  { x: 26.4, y: 38.2, w: 0.7, h: 1.15, color: '#dff0ff' },
  { x: 16.2, y: 43.6, w: 0.85, h: 1.4, color: '#fff1d0' },
  { x: 91.2, y: 15.4, w: 1.35, h: 2.2, color: '#e7f4ff' },
  { x: 87.4, y: 24.6, w: 1.2, h: 2.0, color: '#fff4dc' },
  { x: 92.8, y: 33.2, w: 1.3, h: 2.1, color: '#d4ebff' },
  { x: 84.6, y: 18.8, w: 1.1, h: 1.85, color: '#ead9ff' },
  { x: 89.4, y: 42.6, w: 1.15, h: 1.9, color: '#dff0ff' },
  { x: 81.6, y: 28.2, w: 1.0, h: 1.7, color: '#cfe4ff' },
  { x: 77.8, y: 35.8, w: 0.9, h: 1.5, color: '#e7f4ff' },
  { x: 85.8, y: 49.4, w: 1.0, h: 1.65, color: '#ffe9c4' },
  { x: 73.8, y: 31.2, w: 0.8, h: 1.35, color: '#d4ebff' },
  { x: 69.8, y: 39.0, w: 0.7, h: 1.15, color: '#dff0ff' },
  { x: 80.2, y: 44.8, w: 0.85, h: 1.4, color: '#fff1d0' },
]

const distantGlows = [
  { x: 49.2, y: 48.4 },
  { x: 51.1, y: 49.2 },
  { x: 48.3, y: 50.0 },
  { x: 50.6, y: 47.6 },
]

const headlights = [
  { x0: 28.4, y0: 97.0, x1: 48.7, y1: CITY_VP.y, tone: 'warm' },
  { x0: 36.8, y0: 96.4, x1: 49.2, y1: CITY_VP.y, tone: 'tail' },
  { x0: 44.2, y0: 97.4, x1: 49.6, y1: CITY_VP.y, tone: 'cool' },
  { x0: 55.8, y0: 96.8, x1: 50.4, y1: CITY_VP.y, tone: 'warm' },
  { x0: 64.2, y0: 97.2, x1: 50.8, y1: CITY_VP.y, tone: 'tail' },
  { x0: 73.6, y0: 96.6, x1: 51.3, y1: CITY_VP.y, tone: 'cool' },
  { x0: 32.2, y0: 98.2, x1: 49.0, y1: CITY_VP.y, tone: 'cool' },
  { x0: 69.0, y0: 98.0, x1: 51.0, y1: CITY_VP.y, tone: 'warm' },
]

function rand(min: number, max: number) {
  return min + Math.random() * (max - min)
}

function headlightOpacity(t: number) {
  if (t < 0.05) return t / 0.05
  if (t > 0.82) return Math.max(0, (1 - t) / 0.18)
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

    root.querySelectorAll<HTMLElement>('.city-fx__window').forEach((el) => {
      const dim = rand(0.12, 0.28)
      const lit = rand(0.55, 0.95)
      gsap.set(el, { opacity: Math.random() < 0.55 ? lit : dim })
      const tl = gsap.timeline({ repeat: -1, delay: rand(0, 2.4) })
      tl.to(el, { opacity: lit, duration: rand(1.6, 4.2), ease: 'sine.inOut' })
      tl.to(el, { opacity: dim, duration: rand(1.8, 4.8), ease: 'sine.inOut', delay: rand(0.2, 1.8) })
    })

    root.querySelectorAll<HTMLElement>('.city-fx__distant').forEach((el) => {
      gsap.set(el, { opacity: rand(0.12, 0.22) })
      gsap.to(el, {
        opacity: rand(0.35, 0.6),
        duration: rand(2.4, 5.5),
        ease: 'sine.inOut',
        yoyo: true,
        repeat: -1,
        delay: rand(0, 2.5),
        repeatDelay: rand(0.8, 3.5),
      })
    })

    root.querySelectorAll<HTMLElement>('.city-fx__headlight').forEach((el, i) => {
      const x0 = Number(el.dataset.x0)
      const y0 = Number(el.dataset.y0)
      const x1 = Number(el.dataset.x1)
      const y1 = Number(el.dataset.y1)
      const proxy = { t: 0 }

      const place = (t: number) => {
        el.style.left = `${x0 + (x1 - x0) * t}%`
        el.style.top = `${y0 + (y1 - y0) * t}%`
        el.style.transform = `translate(-50%, -50%) scale(${1 - 0.72 * t})`
        el.style.opacity = String(headlightOpacity(t))
      }

      place(0)
      gsap.fromTo(
        proxy,
        { t: 0 },
        {
          t: 1,
          duration: rand(5.5, 9),
          delay: i * 0.85,
          ease: 'none',
          repeat: -1,
          repeatDelay: rand(0.3, 1.8),
          onUpdate: () => place(proxy.t),
        }
      )
    })
  }, root)
}

onMounted(async () => {
  await nextTick()
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
  z-index: 1;
  pointer-events: none;
  overflow: hidden;
  mix-blend-mode: screen;
}

.city-fx__window,
.city-fx__distant,
.city-fx__headlight {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

.city-fx__window {
  border-radius: 1px;
}

.city-fx__distant {
  width: 22px;
  height: 22px;
  margin: 0;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(230, 242, 255, 0.95) 0%, rgba(160, 196, 255, 0.45) 40%, transparent 72%);
  transform: translate(-50%, -50%);
}

.city-fx__headlight {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: radial-gradient(circle, #fff 0%, #ffe7b0 30%, rgba(255, 196, 90, 0.45) 52%, transparent 72%);
  will-change: transform, opacity;
}

.city-fx__headlight--tail {
  background: radial-gradient(circle, #ffe0d6 0%, #ff6a4a 32%, rgba(255, 70, 40, 0.45) 55%, transparent 72%);
}

.city-fx__headlight--cool {
  background: radial-gradient(circle, #fff 0%, #9ad8ff 30%, rgba(80, 180, 255, 0.4) 52%, transparent 72%);
}

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
