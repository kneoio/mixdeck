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
        <img class="hero-city" src="/city.png" alt="" />
        <div class="hero-motto neon-motto">
          <span>{{ t('welcome.motto_line1') }}</span>
          <span>{{ t('welcome.motto_line2') }}</span>
        </div>
      </section>

      <footer class="footer">
        <div class="logo">MIXPLA</div>
        <div class="status">{{ t('welcome.footer_status') }}</div>
        <div class="copyright">© Mixpla</div>
        <router-link class="privacy-link" to="/privacy">{{ t('welcome.footer_privacy') }}</router-link>
        <a class="affiliation" href="https://semantyca.com" target="_blank" rel="noopener noreferrer">By Semantyca</a>
      </footer>
    </div>
  </n-config-provider>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { NButton, NConfigProvider, darkTheme } from 'naive-ui'

const { t } = useI18n()
const router = useRouter()

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

.hero-city {
  flex: 0 0 auto;
  height: 420px;
  width: auto;
  object-fit: contain;
  display: block;
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

.privacy-link,
.affiliation {
  color: #888;
  text-decoration: none;
}

.privacy-link:hover,
.affiliation:hover {
  color: #f5f5f5;
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

  .hero-city {
    display: none;
  }
}
</style>
