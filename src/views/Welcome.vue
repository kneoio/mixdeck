<template>
  <n-config-provider :theme="darkTheme">
    <div class="welcome-page">
      <header class="nav">
        <div class="logo">MIXPLA</div>
      </header>

      <section class="hero" id="platform">
        <div class="hero-text">
          <p class="eyebrow neon-motto">{{ t('welcome.motto') }}</p>
          <div class="hero-ctas">
            <div class="cta-item">
              <n-button type="primary" size="large" class="cta-button" @click="goToMixpla">{{ t('welcome.cta_mixplay') }}</n-button>
              <span class="cta-hint">{{ t('welcome.cta_mixplay_hint') }}</span>
            </div>
            <div class="cta-item">
              <n-button size="large" @click="goToBrands">{{ t('welcome.cta_portal') }}</n-button>
              <span class="cta-hint">{{ t('welcome.cta_portal_hint') }}</span>
            </div>
            <div class="cta-item">
              <n-button size="large" @click="router.push('/submission')">{{ t('welcome.cta_submit') }}</n-button>
              <span class="cta-hint">{{ t('welcome.cta_submit_hint') }}</span>
            </div>
            <div class="cta-item">
              <n-button size="large" @click="router.push('/help')">{{ t('welcome.cta_help') }}</n-button>
              <span class="cta-hint">{{ t('welcome.cta_help_hint') }}</span>
            </div>
          </div>
        </div>
        <div class="waveform" aria-hidden="true">
          <span v-for="bar in 32" :key="bar" />
        </div>
      </section>

      <section class="what-is" id="about">
        <div class="section-header">
          <p class="eyebrow">{{ t('welcome.what_is_eyebrow') }}</p>
          <h2>{{ t('welcome.what_is_headline') }}</h2>
          <p class="intro">{{ t('welcome.what_is_intro') }}</p>
        </div>
        <div class="cards">
          <article>
            <h3>{{ t('welcome.card1_title') }}</h3>
            <p>{{ t('welcome.card1_body') }}</p>
          </article>
          <article>
            <h3>{{ t('welcome.card2_title') }}</h3>
            <p>{{ t('welcome.card2_body') }}</p>
          </article>
          <article>
            <h3>{{ t('welcome.card3_title') }}</h3>
            <p>{{ t('welcome.card3_body') }}</p>
          </article>
        </div>
      </section>

      <section class="highlights">
        <div>{{ t('welcome.highlight1') }}</div>
        <div>{{ t('welcome.highlight2') }}</div>
        <div>{{ t('welcome.highlight3') }}</div>
        <div>{{ t('welcome.highlight4') }}</div>
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
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { NButton, NConfigProvider, darkTheme } from 'naive-ui'

const { t } = useI18n()
const router = useRouter()

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

:global(body) {
  background: #050505;
}

.welcome-page {
  min-height: 100vh;
  background: #050505;
  color: #f5f5f5;
  font-family: 'Inter', sans-serif;
  padding: 32px clamp(16px, 4vw, 64px);
}

.nav {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 24px;
  padding-bottom: 32px;
}

.logo {
  font-family: 'Kaylon', 'Inter', sans-serif;
  font-weight: 700;
  letter-spacing: 0.24em;
  font-size: clamp(1.1rem, 2vw, 1.6rem);
  color: #c0c0c0;
}

.hero {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  align-items: center;
  gap: 48px;
  padding: 64px 0;
}

.eyebrow {
  letter-spacing: 0.4em;
  text-transform: uppercase;
  color: #888;
  font-size: 0.75rem;
}

.neon-motto {
  font-size: 0.75rem;
  text-shadow: 0 0 5px #ffa500, 0 0 15px #ffa500, 0 0 20px #ffa500, 0 0 40px #ffa500, 0 0 60px #ff0000, 0 0 10px #ff8d00, 0 0 98px #ff0000;
  color: #fff6a9;
  text-align: left;
  animation: blink 12s infinite;
  -webkit-animation: blink 12s infinite;
  letter-spacing: 0.4em;
  text-transform: uppercase;
}

h1 {
  font-size: clamp(2.5rem, 5vw, 3.8rem);
  margin: 16px 0;
}

.subline {
  font-size: 1.125rem;
  color: #b0b0b0;
}

.hero-ctas {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 16px;
  margin-top: 24px;
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
  background: linear-gradient(120deg, #ff7a18, #af002d 60%, #319197);
  background-size: 200% 200%;
  border: none;
  color: #fff !important;
  font-weight: 700;
  box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.15), 0 15px 45px rgba(255, 122, 24, 0.55);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  animation: gradient-shift 4s ease infinite, cta-glow 2.4s ease-in-out infinite;
}

.cta-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.25), 0 18px 50px rgba(255, 122, 24, 0.7);
}

@keyframes gradient-shift {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}

@keyframes cta-glow {
  0%, 100% { box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.15), 0 15px 45px rgba(255, 122, 24, 0.55); }
  50% { box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.3), 0 20px 60px rgba(255, 122, 24, 0.85); }
}

.waveform {
  display: flex;
  align-items: flex-end;
  gap: 4px;
  height: 160px;
  padding: 24px;
  background: radial-gradient(circle at top, rgba(255,255,255,0.08), transparent 60%);
  border-radius: 16px;
}

.waveform span {
  width: 4px;
  background: linear-gradient(180deg, #58d6ff, #7b5bff);
  border-radius: 2px;
  animation: pulse 15s ease-in-out infinite;
  animation-delay: calc(var(--i) * 0.05s);
}

.waveform span:nth-child(n) {
  --i: 1;
}

.waveform span:nth-child(odd) {
  animation-duration: 1s;
}

.what-is {
  padding: 64px 0;
  border-top: 1px solid #1a1a1a;
}

.section-header h2 {
  margin: 12px 0 8px;
}

.intro {
  max-width: 680px;
  color: #b0b0b0;
}

.cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 24px;
  margin-top: 32px;
}

.cards article {
  padding: 24px;
  border: 1px solid #1f1f1f;
  border-radius: 12px;
  background: #0f0f0f;
}

.highlights {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 16px;
  padding: 48px 0;
  border-top: 1px solid #1a1a1a;
}

.highlights div {
  border: 1px solid #1f1f1f;
  padding: 16px;
  text-align: center;
  border-radius: 12px;
}

.footer {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 16px;
  padding-top: 48px;
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

@keyframes pulse {
  0% { height: 20%; opacity: 0.4; }
  50% { height: 100%; opacity: 1; }
  100% { height: 30%; opacity: 0.4; }
}

@media (max-width: 768px) {
  .nav {
    flex-direction: column;
  }
  .waveform {
    gap: 8px;
  }
  .waveform span:not(:nth-child(3n)) {
    display: none;
  }
  .waveform span {
    animation-duration: 15s;
  }
}
</style>
