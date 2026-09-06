<template>
  <n-config-provider :theme="darkTheme">
    <div ref="rootRef" class="welcome-page" :class="{ 'is-booted': booted }">
      <header class="nav">
        <div class="logo anim-enter">MIXPLA</div>
      </header>

      <section class="hero" id="platform">
        <div class="hero-text">
          <div class="hero-ctas">
            <div class="cta-item anim-enter">
              <button type="button" class="cta-button neon-orange" @click="goToMixpla">
                {{ t('welcome.cta_mixplay') }}
              </button>
              <span class="cta-hint">{{ t('welcome.cta_mixplay_hint') }}</span>
            </div>
            <div class="cta-item anim-enter">
              <button type="button" class="cta-button neon-cyan" @click="goToBrands">
                {{ t('welcome.cta_portal') }}
              </button>
              <span class="cta-hint">{{ t('welcome.cta_portal_hint') }}</span>
            </div>
            <div class="cta-item anim-enter">
              <button type="button" class="cta-button neon-magenta" @click="router.push('/submission')">
                {{ t('welcome.cta_submit') }}
              </button>
              <span class="cta-hint">{{ t('welcome.cta_submit_hint') }}</span>
            </div>
            <div class="cta-item anim-enter">
              <button type="button" class="cta-button neon-lime" @click="router.push('/ots')">
                {{ t('welcome.cta_ots') }}
              </button>
              <span class="cta-hint">{{ t('welcome.cta_ots_hint') }}</span>
            </div>
            <div class="cta-item anim-enter">
              <button type="button" class="cta-button neon-violet" @click="router.push('/help')">
                {{ t('welcome.cta_help') }}
              </button>
              <span class="cta-hint">{{ t('welcome.cta_help_hint') }}</span>
            </div>
          </div>
        </div>

        <div class="hero-city anim-enter" aria-hidden="true">
          <svg class="city-svg" viewBox="0 0 400 560" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <filter id="neon-glow" x="-40%" y="-40%" width="180%" height="180%">
                <feGaussianBlur stdDeviation="2.4" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <linearGradient id="horizon-glow" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stop-color="#ff2ea6" stop-opacity="0.35" />
                <stop offset="1" stop-color="#2ee6ff" stop-opacity="0" />
              </linearGradient>
              <linearGradient id="road-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stop-color="#0a1020" />
                <stop offset="1" stop-color="#050508" />
              </linearGradient>
              <linearGradient id="reflect-magenta" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stop-color="#ff2ea6" stop-opacity="0.55" />
                <stop offset="1" stop-color="#ff2ea6" stop-opacity="0" />
              </linearGradient>
              <linearGradient id="reflect-cyan" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stop-color="#2ee6ff" stop-opacity="0.4" />
                <stop offset="1" stop-color="#2ee6ff" stop-opacity="0" />
              </linearGradient>
              <clipPath id="clip-l2">
                <path :d="paths.l2" />
              </clipPath>
              <clipPath id="clip-l3">
                <path :d="paths.l3" />
              </clipPath>
              <clipPath id="clip-r2">
                <path :d="paths.r2" />
              </clipPath>
              <clipPath id="clip-r3">
                <path :d="paths.r3" />
              </clipPath>
              <clipPath id="clip-road">
                <polygon :points="roadPoints" />
              </clipPath>
            </defs>

            <rect class="city-sky" x="0" y="0" width="400" height="560" fill="#050505" />
            <ellipse class="city-glow" cx="200" cy="250" rx="92" ry="36" fill="url(#horizon-glow)" />

            <path class="city-fill" :d="paths.l1" fill="#141422" />
            <path class="city-fill" :d="paths.l2" fill="#10101a" />
            <path class="city-fill" :d="paths.l3" fill="#0c0c14" />
            <path class="city-fill" :d="paths.r1" fill="#141422" />
            <path class="city-fill" :d="paths.r2" fill="#10101a" />
            <path class="city-fill" :d="paths.r3" fill="#0c0c14" />
            <rect
              v-for="tower in towers"
              :key="tower.id"
              class="city-fill"
              :x="tower.x"
              :y="tower.y"
              :width="tower.w"
              :height="tower.h"
              fill="#12121c"
            />

            <polygon class="city-fill city-road-bed" :points="roadPoints" fill="url(#road-fill)" />

            <g class="city-outlines" fill="none" stroke-linejoin="round" stroke-linecap="square">
              <path class="city-draw" :d="paths.l1" stroke="#2ee6ff" stroke-width="1.35" />
              <path class="city-draw" :d="paths.l2" stroke="#5cefff" stroke-width="1.1" />
              <path class="city-draw" :d="paths.l3" stroke="#7af6ff" stroke-width="0.9" />
              <path class="city-draw" :d="paths.r1" stroke="#2ee6ff" stroke-width="1.35" />
              <path class="city-draw" :d="paths.r2" stroke="#5cefff" stroke-width="1.1" />
              <path class="city-draw" :d="paths.r3" stroke="#7af6ff" stroke-width="0.9" />
              <rect
                v-for="tower in towers"
                :key="`${tower.id}-stroke`"
                class="city-draw"
                :x="tower.x"
                :y="tower.y"
                :width="tower.w"
                :height="tower.h"
                stroke="#9af8ff"
                stroke-width="0.8"
              />
              <polygon class="city-draw" :points="roadPoints" stroke="#8ab4ff" stroke-width="1.15" />
              <line class="city-draw" x1="28" y1="28" x2="28" y2="6" stroke="#2ee6ff" stroke-width="1" />
              <line class="city-draw" x1="372" y1="28" x2="372" y2="8" stroke="#2ee6ff" stroke-width="1" />
              <line class="city-draw" x1="200" y1="172" x2="200" y2="148" stroke="#ff2ea6" stroke-width="1" />
            </g>

            <g class="city-windows">
              <rect
                v-for="(win, i) in windows.l1"
                :key="`l1-${i}`"
                class="city-window"
                :x="win.x"
                :y="win.y"
                :width="win.w"
                :height="win.h"
                :fill="win.fill"
              />
              <g clip-path="url(#clip-l2)">
                <rect
                  v-for="(win, i) in windows.l2"
                  :key="`l2-${i}`"
                  class="city-window"
                  :x="win.x"
                  :y="win.y"
                  :width="win.w"
                  :height="win.h"
                  :fill="win.fill"
                />
              </g>
              <g clip-path="url(#clip-l3)">
                <rect
                  v-for="(win, i) in windows.l3"
                  :key="`l3-${i}`"
                  class="city-window"
                  :x="win.x"
                  :y="win.y"
                  :width="win.w"
                  :height="win.h"
                  :fill="win.fill"
                />
              </g>
              <rect
                v-for="(win, i) in windows.r1"
                :key="`r1-${i}`"
                class="city-window"
                :x="win.x"
                :y="win.y"
                :width="win.w"
                :height="win.h"
                :fill="win.fill"
              />
              <g clip-path="url(#clip-r2)">
                <rect
                  v-for="(win, i) in windows.r2"
                  :key="`r2-${i}`"
                  class="city-window"
                  :x="win.x"
                  :y="win.y"
                  :width="win.w"
                  :height="win.h"
                  :fill="win.fill"
                />
              </g>
              <g clip-path="url(#clip-r3)">
                <rect
                  v-for="(win, i) in windows.r3"
                  :key="`r3-${i}`"
                  class="city-window"
                  :x="win.x"
                  :y="win.y"
                  :width="win.w"
                  :height="win.h"
                  :fill="win.fill"
                />
              </g>
              <rect
                v-for="(win, i) in windows.towers"
                :key="`t-${i}`"
                class="city-window"
                :x="win.x"
                :y="win.y"
                :width="win.w"
                :height="win.h"
                :fill="win.fill"
              />
            </g>

            <g class="city-billboards">
              <rect class="city-billboard" x="12" y="70" width="62" height="36" fill="#140018" stroke="#ff2ea6" stroke-width="1.2" />
              <rect class="city-billboard-screen" x="16" y="74" width="54" height="28" fill="#ff2ea6" />
              <rect class="city-billboard" x="326" y="92" width="56" height="32" fill="#001018" stroke="#2ee6ff" stroke-width="1.2" />
              <rect class="city-billboard-screen cyan" x="330" y="96" width="48" height="24" fill="#2ee6ff" />
              <rect class="city-billboard" x="96" y="176" width="30" height="20" fill="#120018" stroke="#b56bff" stroke-width="0.9" />
              <rect class="city-billboard-screen violet" x="99" y="179" width="24" height="14" fill="#b56bff" />
            </g>

            <g class="city-neon-lines" filter="url(#neon-glow)">
              <line class="city-neon" x1="84" y1="46" x2="84" y2="508" stroke="#ff2ea6" stroke-width="3.2" />
              <line class="city-neon" x1="316" y1="46" x2="316" y2="508" stroke="#ff2ea6" stroke-width="3.2" />
              <line class="city-neon" x1="132" y1="168" x2="132" y2="418" stroke="#b56bff" stroke-width="2.1" />
              <line class="city-neon" x1="268" y1="168" x2="268" y2="418" stroke="#b56bff" stroke-width="2.1" />
              <line class="city-neon cyan" x1="44" y1="118" x2="44" y2="300" stroke="#2ee6ff" stroke-width="2" />
              <line class="city-neon cyan" x1="356" y1="128" x2="356" y2="310" stroke="#2ee6ff" stroke-width="2" />
              <circle class="city-neon" cx="28" cy="6" r="2.2" fill="#ff2ea6" stroke="none" />
              <circle class="city-neon" cx="372" cy="8" r="2.2" fill="#2ee6ff" stroke="none" />
              <circle class="city-neon" cx="200" cy="148" r="2.6" fill="#ff2ea6" stroke="none" />
            </g>

            <g clip-path="url(#clip-road)">
              <g class="city-grid" fill="none" stroke="#6f8cff" stroke-opacity="0.35">
                <line
                  v-for="(line, i) in roadGrid"
                  :key="`grid-${i}`"
                  class="city-draw"
                  :x1="line.x1"
                  :y1="line.y1"
                  :x2="line.x2"
                  :y2="line.y2"
                  :stroke-width="line.heavy ? 1.1 : 0.6"
                />
              </g>
              <polygon
                v-for="(lane, i) in laneMarks"
                :key="`lane-${i}`"
                class="city-lane"
                :points="lane.points"
                fill="#fff6a9"
              />
              <polyline
                class="city-scan"
                points="200,542 200,332"
                fill="none"
                stroke="#2ee6ff"
                stroke-width="2"
                stroke-linecap="round"
              />
              <rect class="city-glow" x="81" y="500" width="7" height="48" fill="url(#reflect-magenta)" />
              <rect class="city-glow" x="312" y="500" width="7" height="48" fill="url(#reflect-magenta)" />
              <rect class="city-glow" x="196" y="470" width="8" height="70" fill="url(#reflect-cyan)" />
            </g>

            <g class="city-lamps" filter="url(#neon-glow)">
              <line class="city-draw" x1="102" y1="548" x2="102" y2="458" stroke="#cfd8e6" stroke-width="1.2" />
              <circle class="city-glow lamp" cx="102" cy="456" r="4.5" fill="#f4fbff" />
              <line class="city-draw" x1="298" y1="548" x2="298" y2="458" stroke="#cfd8e6" stroke-width="1.2" />
              <circle class="city-glow lamp" cx="298" cy="456" r="4.5" fill="#f4fbff" />
              <line class="city-draw" x1="142" y1="468" x2="142" y2="402" stroke="#cfd8e6" stroke-width="1" />
              <circle class="city-glow lamp" cx="142" cy="400" r="3.4" fill="#f4fbff" />
              <line class="city-draw" x1="258" y1="468" x2="258" y2="402" stroke="#cfd8e6" stroke-width="1" />
              <circle class="city-glow lamp" cx="258" cy="400" r="3.4" fill="#f4fbff" />
            </g>
          </svg>
        </div>

        <div class="hero-motto neon-motto anim-enter">
          <span>{{ t('welcome.motto_line1') }}</span>
          <span>{{ t('welcome.motto_line2') }}</span>
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
import { onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { NConfigProvider, darkTheme } from 'naive-ui'
import gsap from 'gsap'
import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin'

gsap.registerPlugin(DrawSVGPlugin)

const { t } = useI18n()
const router = useRouter()
const rootRef = ref<HTMLElement | null>(null)
const booted = ref(false)

let mm: gsap.MatchMedia | null = null

const paths = {
  l1: 'M 2 28 H 86 V 548 H 2 Z',
  l2: 'M 86 108 L 136 154 L 136 428 L 86 508 Z',
  l3: 'M 136 154 L 172 200 L 172 358 L 136 408 Z',
  r1: 'M 314 28 H 398 V 548 H 314 Z',
  r2: 'M 314 108 L 264 154 L 264 428 L 314 508 Z',
  r3: 'M 264 154 L 228 200 L 228 358 L 264 408 Z',
}

const roadPoints = '68,548 332,548 214,328 186,328'

const towers = [
  { id: 't1', x: 178, y: 190, w: 11, h: 162 },
  { id: 't2', x: 192, y: 172, w: 16, h: 184 },
  { id: 't3', x: 211, y: 198, w: 10, h: 152 },
]

const WINDOW_FILLS = ['#d7ecff', '#2ee6ff', '#fff6a9', '#ff9ad4', '#b56bff']

type CityWindow = { x: number; y: number; w: number; h: number; fill: string }

function facadeGrid(
  x: number,
  y: number,
  width: number,
  height: number,
  cols: number,
  rows: number,
  seed: number,
): CityWindow[] {
  const padX = width * 0.14
  const padY = height * 0.05
  const innerW = width - padX * 2
  const innerH = height - padY * 2
  const gapX = cols > 1 ? innerW * 0.07 / (cols - 1) : 0
  const gapY = 2.6
  const w = (innerW - gapX * (cols - 1)) / cols
  const h = Math.min(4.4, (innerH - gapY * (rows - 1)) / rows)
  const windows: CityWindow[] = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if ((seed + r * 7 + c * 3) % 11 === 0) continue
      windows.push({
        x: x + padX + c * (w + gapX),
        y: y + padY + r * (h + gapY),
        w: Math.max(1.15, w),
        h: Math.max(1.3, h),
        fill: WINDOW_FILLS[(seed + r + c) % WINDOW_FILLS.length],
      })
    }
  }
  return windows
}

const windows = {
  l1: facadeGrid(2, 28, 84, 520, 5, 20, 1),
  l2: facadeGrid(86, 108, 50, 400, 3, 14, 4),
  l3: facadeGrid(136, 154, 36, 254, 2, 11, 8),
  r1: facadeGrid(314, 28, 84, 520, 5, 20, 2),
  r2: facadeGrid(264, 108, 50, 400, 3, 14, 5),
  r3: facadeGrid(228, 154, 36, 254, 2, 11, 9),
  towers: [
    ...facadeGrid(178, 190, 11, 162, 1, 14, 11),
    ...facadeGrid(192, 172, 16, 184, 1, 16, 12),
    ...facadeGrid(211, 198, 10, 152, 1, 12, 13),
  ],
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}

const roadGrid = (() => {
  const lines: { x1: number; y1: number; x2: number; y2: number; heavy?: boolean }[] = []
  const y0 = 548
  const y1 = 328
  const xL0 = 68
  const xR0 = 332
  const xL1 = 186
  const xR1 = 214
  for (let i = 1; i <= 11; i++) {
    const t = i / 12
    const y = lerp(y0, y1, t)
    lines.push({
      x1: lerp(xL0, xL1, t),
      y1: y,
      x2: lerp(xR0, xR1, t),
      y2: y,
    })
  }
  for (const xb of [96, 124, 152, 176, 224, 248, 276, 304]) {
    const t = (xb - xL0) / (xR0 - xL0)
    lines.push({
      x1: xb,
      y1: y0,
      x2: lerp(xL1, xR1, t),
      y2: y1,
      heavy: xb === 176 || xb === 224,
    })
  }
  return lines
})()

const laneMarks = Array.from({ length: 9 }, (_, i) => {
  const t = i / 9
  const t2 = t + 0.038
  const y1 = lerp(544, 336, t)
  const y2 = lerp(544, 336, t2)
  const w1 = lerp(11, 2.1, t)
  const w2 = lerp(11, 2.1, t2)
  return {
    points: `${200 - w1 / 2},${y1} ${200 + w1 / 2},${y1} ${200 + w2 / 2},${y2} ${200 - w2 / 2},${y2}`,
  }
})

function goToMixpla() {
  window.open('https://mixpla.online', '_blank', 'noopener,noreferrer')
}

function goToBrands() {
  router.push('/mixdeck')
}

function pulseButtons(root: HTMLElement, delay = 0) {
  const buttons = root.querySelectorAll<HTMLElement>('.cta-button')
  buttons.forEach((btn, i) => {
    const neon = getComputedStyle(btn).getPropertyValue('--neon').trim() || '#ff7a18'
    const soft = getComputedStyle(btn).getPropertyValue('--neon-soft').trim() || `${neon}88`
    gsap.fromTo(
      btn,
      {
        boxShadow: `0 0 6px ${soft}, 0 0 16px ${soft}, inset 0 0 10px ${soft}`,
      },
      {
        boxShadow: `0 0 12px ${neon}, 0 0 28px ${soft}, 0 0 48px ${soft}, inset 0 0 16px ${soft}`,
        duration: 1.6 + i * 0.18,
        delay: delay + i * 0.22,
        ease: 'sine.inOut',
        yoyo: true,
        repeat: -1,
      },
    )
  })
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

      gsap.set(root.querySelectorAll('.city-draw, .city-scan'), { drawSVG: reduce ? '100%' : 0 })
      gsap.set(root.querySelectorAll('.city-window, .city-neon, .city-billboard, .city-billboard-screen, .city-glow, .city-fill, .city-lane, .city-scan'), {
        autoAlpha: reduce ? 1 : 0,
      })
      if (reduce) {
        gsap.set(root.querySelectorAll('.anim-enter'), { autoAlpha: 1, y: 0, x: 0 })
        booted.value = true
        return
      }

      gsap.set(root.querySelectorAll('.anim-enter'), { autoAlpha: 0, y: 18 })
      booted.value = true

      const tl = gsap.timeline({ defaults: { ease: 'power2.out' } })
      tl.to(root.querySelector('.nav .logo'), { autoAlpha: 1, y: 0, duration: 0.45 })
      tl.to(root.querySelectorAll('.cta-item'), { autoAlpha: 1, y: 0, duration: 0.42, stagger: 0.08 }, '-=0.15')
      tl.to(root.querySelector('.hero-city'), { autoAlpha: 1, y: 0, duration: 0.5 }, '-=0.28')
      tl.to(root.querySelectorAll('.city-fill'), { autoAlpha: 0.96, duration: 0.35 }, '-=0.2')
      tl.to(root.querySelectorAll('.city-draw'), {
        drawSVG: '100%',
        duration: 1.15,
        stagger: 0.018,
        ease: 'power1.inOut',
      }, '-=0.2')
      tl.to(root.querySelectorAll('.city-window'), {
        autoAlpha: 1,
        duration: 0.35,
        stagger: { each: 0.006, from: 'random' },
      }, '-=0.55')
      tl.to(root.querySelectorAll('.city-billboard, .city-billboard-screen'), { autoAlpha: 1, duration: 0.3, stagger: 0.04 }, '-=0.2')
      tl.to(root.querySelectorAll('.city-neon, .city-glow, .city-lane, .city-scan'), { autoAlpha: 1, duration: 0.4, stagger: 0.03 }, '-=0.15')
      tl.to(root.querySelector('.hero-motto'), { autoAlpha: 1, y: 0, duration: 0.5 }, '-=0.2')
      tl.to(root.querySelectorAll('.footer .anim-enter'), { autoAlpha: 1, y: 0, duration: 0.35, stagger: 0.06 }, '-=0.2')

      const loopsAt = tl.duration()
      pulseButtons(root, loopsAt)

      const cityWindows = root.querySelectorAll<HTMLElement>('.city-window')
      cityWindows.forEach((win, i) => {
        if (i % 4 !== 0) return
        gsap.to(win, {
          opacity: 0.2,
          duration: 0.7 + (i % 5) * 0.15,
          delay: loopsAt + (i % 9) * 0.08,
          yoyo: true,
          repeat: -1,
          ease: 'sine.inOut',
        })
      })

      gsap.to(root.querySelectorAll('.city-neon'), {
        opacity: 0.55,
        duration: 1.4,
        delay: loopsAt,
        yoyo: true,
        repeat: -1,
        stagger: { each: 0.18, from: 'random' },
        ease: 'sine.inOut',
      })

      gsap.to(root.querySelectorAll('.city-billboard-screen'), {
        opacity: 0.25,
        duration: 0.12,
        delay: loopsAt,
        repeat: -1,
        repeatDelay: 2.4,
        yoyo: true,
        stagger: 0.35,
      })

      gsap.fromTo(
        root.querySelector('.city-scan'),
        { drawSVG: '0% 8%' },
        { drawSVG: '92% 100%', duration: 2.6, delay: loopsAt, ease: 'none', repeat: -1 },
      )

      const motto = root.querySelector('.hero-motto')
      if (motto) {
        const flicker = gsap.timeline({ delay: loopsAt + 1.2, repeat: -1, repeatDelay: 5.5 })
        flicker
          .to(motto, { opacity: 0.18, duration: 0.05 })
          .to(motto, { opacity: 1, duration: 0.06 })
          .to(motto, { opacity: 0.22, duration: 0.05, delay: 0.14 })
          .to(motto, { opacity: 1, duration: 0.08 })
      }

      gsap.to(root.querySelectorAll('.lamp'), {
        opacity: 0.7,
        duration: 1.8,
        delay: loopsAt,
        yoyo: true,
        repeat: -1,
        stagger: 0.25,
        ease: 'sine.inOut',
      })
    },
    root,
  )
})

onUnmounted(() => {
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

.welcome-page:not(.is-booted) .anim-enter,
.welcome-page:not(.is-booted) .city-draw,
.welcome-page:not(.is-booted) .city-window,
.welcome-page:not(.is-booted) .city-neon,
.welcome-page:not(.is-booted) .city-billboard,
.welcome-page:not(.is-booted) .city-billboard-screen,
.welcome-page:not(.is-booted) .city-glow,
.welcome-page:not(.is-booted) .city-fill,
.welcome-page:not(.is-booted) .city-lane,
.welcome-page:not(.is-booted) .city-scan {
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
  gap: 12px;
  padding: 0;
  min-height: 0;
}

.hero-text {
  flex: 0 0 auto;
}

.hero-city {
  flex: 0 0 auto;
  height: 420px;
  width: auto;
}

.city-svg {
  display: block;
  height: 420px;
  width: auto;
  overflow: visible;
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
}

.neon-motto {
  text-shadow: 0 0 5px #ffa500, 0 0 15px #ffa500, 0 0 20px #ffa500, 0 0 40px #ffa500, 0 0 60px #ff0000, 0 0 10px #ff8d00, 0 0 98px #ff0000;
  color: #fff6a9;
  text-align: left;
}

.hero-ctas {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 16px;
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
  appearance: none;
  cursor: pointer;
  border-radius: 2px;
  padding: 10px 22px;
  font-size: 0.95rem;
  font-family: inherit;
  border: 1px solid var(--neon);
  background: rgba(0, 0, 0, 0.55);
  color: var(--neon);
  font-weight: 700;
  letter-spacing: 0.08em;
  box-shadow:
    0 0 6px var(--neon-soft),
    0 0 18px var(--neon-soft),
    0 0 36px var(--neon-soft),
    inset 0 0 12px var(--neon-soft);
  text-shadow: 0 0 8px var(--neon-soft), 0 0 16px var(--neon-soft);
  transition: transform 0.2s ease, text-shadow 0.2s ease;
}

.cta-button:hover {
  transform: translateY(-2px);
}

.cta-button:focus-visible {
  outline: 2px solid var(--neon);
  outline-offset: 3px;
}

.neon-orange {
  --neon: #ff7a18;
  --neon-soft: rgba(255, 122, 24, 0.55);
  text-transform: uppercase;
}

.neon-cyan {
  --neon: #2ee6ff;
  --neon-soft: rgba(46, 230, 255, 0.5);
}

.neon-magenta {
  --neon: #ff2ea6;
  --neon-soft: rgba(255, 46, 166, 0.5);
}

.neon-lime {
  --neon: #a8ff2e;
  --neon-soft: rgba(168, 255, 46, 0.5);
}

.neon-violet {
  --neon: #b56bff;
  --neon-soft: rgba(181, 107, 255, 0.5);
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

.privacy-link {
  color: #888;
  text-decoration: none;
}

.privacy-link:hover {
  color: #f5f5f5;
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

  .hero-city {
    display: none;
  }
}
</style>
