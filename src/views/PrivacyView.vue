<template>
  <n-config-provider :theme="darkTheme">
    <div class="privacy-page">
      <header class="nav">
        <div class="logo" @click="router.push('/')">MIXPLA</div>
      </header>

      <article class="privacy-body">
        <h1>{{ t('privacy.title') }}</h1>
        <p class="updated">{{ t('privacy.updated') }}</p>
        <p>{{ t('privacy.intro') }}</p>

        <h2>{{ t('privacy.who_title') }}</h2>
        <p>{{ t('privacy.who_p1') }}</p>

        <h2>{{ t('privacy.collect_title') }}</h2>
        <p>{{ t('privacy.collect_intro') }}</p>
        <ul>
          <li>{{ t('privacy.collect_anon') }}</li>
          <li>{{ t('privacy.collect_account') }}</li>
          <li>{{ t('privacy.collect_chat') }}</li>
          <li>{{ t('privacy.collect_listen') }}</li>
          <li>{{ t('privacy.collect_broadcaster') }}</li>
          <li>{{ t('privacy.collect_device') }}</li>
          <li>{{ t('privacy.collect_notify') }}</li>
        </ul>
        <p>{{ t('privacy.collect_no_sell') }}</p>

        <h2>{{ t('privacy.use_title') }}</h2>
        <ul>
          <li>{{ t('privacy.use_1') }}</li>
          <li>{{ t('privacy.use_2') }}</li>
          <li>{{ t('privacy.use_3') }}</li>
          <li>{{ t('privacy.use_4') }}</li>
        </ul>

        <h2>{{ t('privacy.share_title') }}</h2>
        <p>{{ t('privacy.share_p') }}</p>

        <h2>{{ t('privacy.retain_title') }}</h2>
        <p>{{ t('privacy.retain_p') }}</p>

        <h2>{{ t('privacy.choices_title') }}</h2>
        <ul>
          <li>{{ t('privacy.choices_1') }}</li>
          <li>{{ t('privacy.choices_2') }}</li>
          <li>{{ t('privacy.choices_3') }}</li>
        </ul>

        <h2>{{ t('privacy.children_title') }}</h2>
        <p>{{ t('privacy.children_p') }}</p>

        <h2>{{ t('privacy.changes_title') }}</h2>
        <p>{{ t('privacy.changes_p') }}</p>

        <h2>{{ t('privacy.contact_title') }}</h2>
        <p>
          {{ t('privacy.contact_before') }}
          <router-link to="/help">{{ t('privacy.contact_help') }}</router-link>.
        </p>
      </article>

      <footer class="footer">
        <div class="logo" @click="router.push('/')">MIXPLA</div>
        <div class="copyright">© Mixpla</div>
      </footer>
    </div>
  </n-config-provider>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { NConfigProvider, darkTheme } from 'naive-ui'

const { t } = useI18n()
const router = useRouter()
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

.privacy-page {
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
  padding-bottom: 16px;
}

.logo {
  font-family: 'Kaylon', 'Inter', sans-serif;
  font-weight: 700;
  letter-spacing: 0.24em;
  font-size: clamp(1.1rem, 2vw, 1.6rem);
  color: #c0c0c0;
  cursor: pointer;
}

.privacy-body {
  max-width: 720px;
  padding: 24px 0 48px;
  line-height: 1.65;
  color: #d8d8d8;
}

.privacy-body h1 {
  margin: 0 0 8px;
  font-size: clamp(1.6rem, 3vw, 2.1rem);
  font-weight: 600;
  color: #f5f5f5;
}

.updated {
  color: #888;
  font-size: 0.9rem;
  margin: 0 0 24px;
}

.privacy-body h2 {
  margin: 32px 0 12px;
  font-size: 1.15rem;
  font-weight: 600;
  color: #f5f5f5;
}

.privacy-body p,
.privacy-body li {
  margin: 0 0 12px;
}

.privacy-body ul {
  padding-left: 1.2em;
  margin: 0 0 12px;
}

.privacy-body a {
  color: #2ee6ff;
  text-decoration: none;
}

.privacy-body a:hover {
  text-decoration: underline;
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

.copyright {
  color: #888;
}

</style>
