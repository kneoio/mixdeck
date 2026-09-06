<template>
  <n-config-provider :theme="darkTheme">
    <div ref="rootRef" class="welcome-page" :class="{ 'is-booted': booted }">
      <header class="nav">
        <div class="logo anim-enter">MIXPLA</div>
      </header>

      <section class="hero" id="platform">
        <div class="hero-vu anim-enter">
          <div class="vu-deck">
            <div class="vu-deck-brand">mixpla</div>

            <div class="vu-vfd hero-motto">
              <span>{{ t('welcome.motto_line1') }}</span>
              <span>{{ t('welcome.motto_line2') }}</span>
            </div>

            <div class="vu-pair">
              <div v-for="ch in channels" :key="ch.id" class="vu-cell">
                <div class="vu-window">
                  <svg class="vu-scale" viewBox="0 0 240 150">
                    <path :d="scale.bgArc" fill="none" stroke="#2a2418" stroke-width="1.1" />
                    <path :d="scale.redArc" fill="none" stroke="#c42a1a" stroke-width="3.2" />
                    <line
                      v-for="(tick, i) in scale.ticks"
                      :key="i"
                      :x1="tick.x1"
                      :y1="tick.y1"
                      :x2="tick.x2"
                      :y2="tick.y2"
                      :stroke="tick.red ? '#c42a1a' : '#1a1710'"
                      :stroke-width="tick.major ? 1.4 : 0.8"
                    />
                    <text
                      v-for="(tick, i) in scale.labels"
                      :key="'lb'+i"
                      :x="tick.x"
                      :y="tick.y"
                      text-anchor="middle"
                      :fill="tick.red ? '#c42a1a' : '#1a1710'"
                      font-size="9"
                      font-weight="700"
                    >{{ tick.text }}</text>
                    <text x="120" y="92" text-anchor="middle" fill="#1a1710" font-size="13" font-weight="700" letter-spacing="0.18em">VU</text>
                  </svg>
                  <div class="vu-needle" :style="{ '--ang': ch.ang }"></div>
                  <div class="vu-pivot"></div>
                  <div class="vu-glass"></div>
                </div>
                <div class="vu-ch-label">
                  <span>{{ ch.id }}</span>
                  <span class="vu-peak" :class="{ on: ch.peak }">▬</span>
                </div>
              </div>
            </div>

            <div class="vu-led-row">
              <div class="vu-leds vu-leds-l">
                <span
                  v-for="(led, i) in leds.left"
                  :key="'l'+i"
                  class="vu-led"
                  :class="[led.zone, { on: led.on }]"
                ></span>
              </div>
              <div class="vu-led-gap"></div>
              <div class="vu-leds vu-leds-r">
                <span
                  v-for="(led, i) in leds.right"
                  :key="'r'+i"
                  class="vu-led"
                  :class="[led.zone, { on: led.on }]"
                ></span>
              </div>
            </div>

            <div class="vu-keys">
              <div class="cta-item">
                <button type="button" class="cta-button neon-orange" @click="goToMixpla">
                  {{ t('welcome.cta_mixplay') }}
                </button>
                <span class="cta-hint">{{ t('welcome.cta_mixplay_hint') }}</span>
              </div>
              <div class="cta-item">
                <button type="button" class="cta-button neon-cyan" @click="goToBrands">
                  {{ t('welcome.cta_portal') }}
                </button>
                <span class="cta-hint">{{ t('welcome.cta_portal_hint') }}</span>
              </div>
              <div class="cta-item">
                <button type="button" class="cta-button neon-magenta" @click="router.push('/submission')">
                  {{ t('welcome.cta_submit') }}
                </button>
                <span class="cta-hint">{{ t('welcome.cta_submit_hint') }}</span>
              </div>
              <div class="cta-item">
                <button type="button" class="cta-button neon-lime" @click="router.push('/ots')">
                  {{ t('welcome.cta_ots') }}
                </button>
                <span class="cta-hint">{{ t('welcome.cta_ots_hint') }}</span>
              </div>
              <div class="cta-item">
                <button type="button" class="cta-button neon-violet" @click="router.push('/help')">
                  {{ t('welcome.cta_help') }}
                </button>
                <span class="cta-hint">{{ t('welcome.cta_help_hint') }}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer class="footer">
        <div class="logo anim-enter">MIXPLA</div>
        <div class="status anim-enter">{{ t('welcome.footer_status') }}</div>
        <div class="copyright anim-enter">© Mixpla</div>
        <router-link class="privacy-link anim-enter" to="/privacy">{{ t('welcome.footer_privacy') }}</router-link>
      </footer>
    </div>
  </n-config-provider>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { NConfigProvider, darkTheme } from 'naive-ui'
import gsap from 'gsap'

const { t } = useI18n()
const router = useRouter()
const rootRef = ref<HTMLElement | null>(null)
const booted = ref(false)

let mm: gsap.MatchMedia | null = null
let raf = 0

const LED_N = 8
const CX = 120
const CY = 138
const R = 108

function dbToAngle(db: number) {
  if (db <= 0) return -52 + ((db + 20) / 20) * 70
  return 18 + (db / 3) * 34
}

function polar(r: number, deg: number) {
  const rad = (deg * Math.PI) / 180
  return { x: CX + r * Math.sin(rad), y: CY - r * Math.cos(rad) }
}

function arcPath(fromDb: number, toDb: number, r: number) {
  const s = polar(r, dbToAngle(fromDb))
  const e = polar(r, dbToAngle(toDb))
  return `M ${s.x.toFixed(1)} ${s.y.toFixed(1)} A ${r} ${r} 0 0 1 ${e.x.toFixed(1)} ${e.y.toFixed(1)}`
}

const DBS = [-20, -10, -7, -5, -3, -1, 0, 1, 2, 3]
const MAJOR = new Set([-20, -10, 0, 3])

const scale = {
  bgArc: arcPath(-20, 0, R),
  redArc: arcPath(0, 3, R),
  ticks: DBS.map((db) => {
    const a = dbToAngle(db)
    const major = MAJOR.has(db)
    const p1 = polar(R, a)
    const p2 = polar(R - (major ? 14 : 8), a)
    return { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, major, red: db >= 0 }
  }),
  labels: DBS.filter((db) => MAJOR.has(db)).map((db) => {
    const p = polar(R - 26, dbToAngle(db))
    return { x: p.x, y: p.y + 3, text: String(db), red: db >= 0 }
  }),
}

const channels = reactive([
  { id: 'L', ang: '-52deg', peak: false },
  { id: 'R', ang: '-52deg', peak: false },
])

const levels = reactive({ l: 0, r: 0 })

function zone(i: number) {
  return i >= LED_N - 1 ? 'red' : i >= LED_N - 3 ? 'yellow' : 'green'
}

const leds = computed(() => {
  const row = (v: number) => {
    const count = Math.round(Math.min(1, Math.max(0, v)) * LED_N)
    return Array.from({ length: LED_N }, (_, i) => ({ on: i < count, zone: zone(i) }))
  }
  return { left: row(levels.l), right: row(levels.r) }
})

function clamp(n: number, a: number, b: number) {
  return Math.min(b, Math.max(a, n))
}

function levelToDb(v: number) {
  return -20 + clamp(v, 0, 1) * 23
}

function goToMixpla() {
  window.open('https://mixpla.online', '_blank', 'noopener,noreferrer')
}

function goToBrands() {
  router.push('/mixdeck')
}

function startMeters() {
  cancelAnimationFrame(raf)
  let tL = 0
  let tR = 0
  const step = (now: number) => {
    const t = now * 0.001
    const beat = 0.55 + 0.45 * Math.sin(t * 2.15)
    tL = clamp(0.28 + 0.42 * beat + 0.16 * Math.sin(t * 11.4) + 0.08 * Math.sin(t * 23.1), 0, 1)
    tR = clamp(0.26 + 0.44 * beat + 0.14 * Math.sin(t * 13.2 + 0.8) + 0.09 * Math.sin(t * 19.6), 0, 1)
    const kL = tL > levels.l ? 0.22 : 0.07
    const kR = tR > levels.r ? 0.22 : 0.07
    levels.l += (tL - levels.l) * kL
    levels.r += (tR - levels.r) * kR
    channels[0].ang = `${dbToAngle(levelToDb(levels.l)).toFixed(2)}deg`
    channels[1].ang = `${dbToAngle(levelToDb(levels.r)).toFixed(2)}deg`
    channels[0].peak = levels.l > 0.84
    channels[1].peak = levels.r > 0.84
    raf = requestAnimationFrame(step)
  }
  raf = requestAnimationFrame(step)
}

onMounted(() => {
  const root = rootRef.value
  if (!root) return

  mm = gsap.matchMedia()
  mm.add(
    {
      motion: '(prefers-reduced-motion: no-preference)',
      reduce: '(prefers-reduced-motion: reduce)',
    },
    (context) => {
      const reduce = Boolean(context.conditions?.reduce)

      if (reduce) {
        gsap.set(root.querySelectorAll('.anim-enter'), { autoAlpha: 1, y: 0, x: 0 })
        booted.value = true
        levels.l = 0.55
        levels.r = 0.48
        channels[0].ang = `${dbToAngle(levelToDb(levels.l))}deg`
        channels[1].ang = `${dbToAngle(levelToDb(levels.r))}deg`
        return
      }

      gsap.set(root.querySelectorAll('.anim-enter'), { autoAlpha: 0, y: 18 })
      booted.value = true
      startMeters()

      const tl = gsap.timeline({ defaults: { ease: 'power2.out' } })
      tl.to(root.querySelector('.nav .logo'), { autoAlpha: 1, y: 0, duration: 0.45 })
      tl.to(root.querySelector('.hero-vu'), { autoAlpha: 1, y: 0, duration: 0.55 }, '-=0.12')
      tl.to(root.querySelectorAll('.footer .anim-enter'), { autoAlpha: 1, y: 0, duration: 0.35, stagger: 0.06 }, '-=0.2')

      const loopsAt = tl.duration()

      const motto = root.querySelector('.hero-motto')
      if (motto) {
        const flicker = gsap.timeline({ delay: loopsAt + 1.2, repeat: -1, repeatDelay: 5.5 })
        flicker
          .to(motto, { opacity: 0.18, duration: 0.05 })
          .to(motto, { opacity: 1, duration: 0.06 })
          .to(motto, { opacity: 0.22, duration: 0.05, delay: 0.14 })
          .to(motto, { opacity: 1, duration: 0.08 })
      }

      return () => {
        cancelAnimationFrame(raf)
        raf = 0
      }
    },
    root,
  )
})

onUnmounted(() => {
  cancelAnimationFrame(raf)
  mm?.revert()
  mm = null
})
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

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

.welcome-page:not(.is-booted) .anim-enter {
  opacity: 0;
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
  padding: 0;
  min-height: 0;
}

.hero-vu {
  flex: 0 1 auto;
  width: min(760px, 94vw);
}

.vu-deck {
  --hi-gold: #c8a24a;
  --hi-vfd: #5ffbe0;
  --hi-led-red: #ff3b30;
  --hi-led-green: #39ff77;
  --hi-led-amber: #ffb300;
  padding: 22px 18px 16px;
  border-radius: 10px;
  border: 4px solid #050506;
  background:
    repeating-linear-gradient(90deg, rgba(255, 255, 255, 0.018) 0 1px, rgba(0, 0, 0, 0.04) 1px 3px),
    linear-gradient(180deg, #2b2b2f 0%, #18181b 42%, #0d0d0f 100%);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.1),
    inset 0 -2px 6px rgba(0, 0, 0, 0.85),
    inset 0 0 0 1px rgba(0, 0, 0, 0.6),
    0 18px 50px rgba(0, 0, 0, 0.75);
}

.vu-deck-brand {
  text-align: center;
  font-weight: 700;
  font-size: 0.78rem;
  letter-spacing: 3px;
  color: var(--hi-gold);
  margin-bottom: 10px;
}

.vu-vfd {
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 0.15em;
  min-height: 4.4rem;
  margin-bottom: 12px;
  padding: 0.7rem 1rem;
  border-radius: 4px;
  overflow: hidden;
  background: radial-gradient(ellipse 90% 70% at 50% 40%, #06241a 0%, #031510 70%, #010a07 100%);
  border: 1px solid #000;
  box-shadow:
    inset 0 0 26px rgba(0, 0, 0, 0.95),
    inset 0 0 0 1px rgba(46, 255, 213, 0.06),
    inset 0 2px 6px rgba(0, 0, 0, 0.9),
    0 1px 0 rgba(255, 255, 255, 0.05);
  color: #c9fff4;
  font-size: clamp(0.95rem, 2.1vw, 1.35rem);
  font-weight: 700;
  letter-spacing: 0.12em;
  line-height: 1.25;
  text-transform: uppercase;
  text-shadow:
    0 0 2px #2effd5,
    0 0 6px rgba(46, 255, 213, 0.95),
    0 0 14px rgba(46, 255, 213, 0.7),
    0 0 28px rgba(46, 255, 213, 0.35);
}

.vu-vfd::before {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: radial-gradient(ellipse 70% 55% at 50% 45%, rgba(46, 255, 213, 0.1), transparent 70%);
}

.vu-vfd::after {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  background:
    repeating-linear-gradient(0deg, rgba(0, 0, 0, 0.3) 0 1px, transparent 1px 3px),
    repeating-linear-gradient(90deg, rgba(0, 0, 0, 0.18) 0 1px, transparent 1px 4px);
  mix-blend-mode: multiply;
}

.vu-vfd span {
  position: relative;
  z-index: 1;
}

.vu-pair {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.vu-window {
  position: relative;
  height: 148px;
  border-radius: 4px;
  overflow: hidden;
  background:
    radial-gradient(ellipse 90% 70% at 50% 40%, #efe0b8 0%, #d7c394 70%, #c4ae78 100%);
  border: 1px solid #000;
  box-shadow:
    inset 0 0 18px rgba(0, 0, 0, 0.28),
    inset 0 2px 6px rgba(0, 0, 0, 0.35),
    0 1px 0 rgba(255, 255, 255, 0.06);
}

.vu-scale {
  display: block;
  width: 100%;
  height: 100%;
  font-family: 'Inter', sans-serif;
}

.vu-needle {
  position: absolute;
  left: 50%;
  bottom: 8%;
  width: 3px;
  height: 80%;
  margin-left: -1.5px;
  background: linear-gradient(180deg, #c42a1a 0 18%, #1a120c 18%);
  clip-path: polygon(50% 0, 100% 6%, 62% 100%, 38% 100%, 0 6%);
  transform-origin: 50% 100%;
  transform: rotate(var(--ang, -52deg));
  box-shadow: 0 0 2px rgba(0, 0, 0, 0.45);
  z-index: 2;
}

.vu-pivot {
  position: absolute;
  left: 50%;
  bottom: 8%;
  width: 14px;
  height: 14px;
  margin-left: -7px;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 30%, #6a6a70, #1c1c1f 70%);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.25), 0 2px 4px rgba(0, 0, 0, 0.6);
  z-index: 3;
}

.vu-glass {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background:
    linear-gradient(120deg, rgba(255, 255, 255, 0.22) 0%, transparent 36%, transparent 62%, rgba(255, 255, 255, 0.08) 100%),
    repeating-linear-gradient(0deg, rgba(0, 0, 0, 0.04) 0 1px, transparent 1px 3px);
  z-index: 4;
}

.vu-ch-label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 6px;
  padding: 0 4px;
  font-size: 0.62rem;
  letter-spacing: 0.14em;
  color: rgba(255, 255, 255, 0.38);
}

.vu-peak {
  color: var(--hi-led-red);
  opacity: 0.22;
  font-size: 14px;
  line-height: 1;
}

.vu-peak.on {
  opacity: 1;
  text-shadow:
    0 0 3px #fff,
    0 0 6px currentColor,
    0 0 16px currentColor;
}

.vu-led-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0;
  margin-top: 10px;
}

.vu-leds {
  display: flex;
  align-items: center;
  gap: 3px;
}

.vu-leds-l {
  flex-direction: row-reverse;
}

.vu-led-gap {
  width: 10px;
  flex-shrink: 0;
}

.vu-led {
  line-height: 1;
}

.vu-led::before {
  content: "▬";
  font-size: 14px;
  line-height: 1;
  opacity: 0.28;
}

.vu-led.red::before { color: var(--hi-led-red); }
.vu-led.yellow::before { color: var(--hi-led-amber); }
.vu-led.green::before { color: var(--hi-led-green); }

.vu-led.on::before {
  opacity: 1;
  text-shadow: 0 0 4px currentColor, 0 0 10px currentColor;
}

.vu-keys {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 8px;
  margin-top: 14px;
}

.cta-item {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 5px;
  min-width: 0;
}

.cta-hint {
  color: rgba(255, 255, 255, 0.32);
  font-size: 0.58rem;
  letter-spacing: 0.02em;
  line-height: 1.25;
  padding: 0 2px;
}

.cta-button {
  --neon: #ff7a18;
  appearance: none;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  width: 100%;
  min-height: 2.4rem;
  border-radius: 4px;
  padding: 0.35rem 0.4rem;
  font-size: 0.58rem;
  font-family: inherit;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  border: 1px solid #050506;
  background: linear-gradient(180deg, #2e2e32, #151517);
  color: #b9b9bf;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.12),
    inset 0 -2px 4px rgba(0, 0, 0, 0.7),
    0 2px 4px rgba(0, 0, 0, 0.6);
  transition: box-shadow 0.08s ease, transform 0.05s ease, color 0.08s ease;
}

.cta-button::before {
  content: "▬";
  font-size: 13px;
  line-height: 1;
  color: var(--neon);
  opacity: 0.28;
}

.cta-button:hover {
  color: #b9b9bf;
}

.cta-button:active {
  transform: translateY(1px);
  color: var(--neon);
  box-shadow: inset 0 2px 5px rgba(0, 0, 0, 0.9);
}

.cta-button:active::before {
  opacity: 1;
  text-shadow: 0 0 4px currentColor, 0 0 10px currentColor;
}

.cta-button:focus-visible {
  outline: 1px solid var(--neon);
  outline-offset: 2px;
}

.neon-orange { --neon: #ff7a18; }
.neon-cyan { --neon: #2ee6ff; }
.neon-magenta { --neon: #ff2ea6; }
.neon-lime { --neon: #a8ff2e; }
.neon-violet { --neon: #b56bff; }

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

.privacy-link {
  color: #888;
  text-decoration: none;
}

.privacy-link:hover {
  color: #f5f5f5;
}

@media (max-width: 640px) {
  .vu-keys {
    grid-template-columns: 1fr 1fr;
  }

  .vu-keys .cta-item:last-child {
    grid-column: 1 / -1;
  }
}
</style>
