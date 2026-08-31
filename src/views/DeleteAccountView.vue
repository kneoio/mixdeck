<template>
  <n-config-provider :theme="darkTheme">
    <div class="privacy-page">
      <header class="nav">
        <div class="logo" @click="router.push('/')">MIXPLA</div>
      </header>

      <article class="privacy-body">
        <h1>Delete your Mixpla account and data</h1>
        <p class="updated">Mixpla listener app and Mixdeck</p>

        <p>
          Use this page to ask Mixpla to delete your account and the data linked to it. This is the
          Mixpla product on Google Play. You can listen as a guest, or sign in through the DJ bot in
          station chat: the bot asks for your email, then sends a one-time code to confirm.
        </p>

        <h2>How to request deletion</h2>
        <ol>
          <li>
            Email
            <a href="mailto:justaidajam@gmail.com">justaidajam@gmail.com</a>
            from the address you used with Mixpla, with the subject “Delete Mixpla account”.
          </li>
          <li>
            Or use
            <router-link to="/help">Mixpla Help</router-link>
            and ask to delete your account.
          </li>
        </ol>
        <p>
          Say whether you use the Mixpla listener app, Mixdeck, or both, and the email you used with
          the DJ bot.
        </p>

        <h2>What we delete</h2>
        <ul>
          <li>Account login and profile data (name, email or phone used to sign in).</li>
          <li>Artist or Mixdeck account records tied to that login.</li>
          <li>Chat history and uploads we can still identify as yours.</li>
        </ul>
        <p>
          We aim to complete deletion within 30 days. Some backups and security logs may remain for
          a limited time, then they expire.
        </p>

        <h2>If you never created an account</h2>
        <p>
          Guest listening only stores an anonymous id on your device. Uninstall Mixpla or clear the
          app’s storage in Android settings to remove it. We do not need an email for that.
        </p>

        <p>
          Privacy policy:
          <router-link to="/privacy">mixpla.io/privacy</router-link>
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
import { NConfigProvider, darkTheme } from 'naive-ui'

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

.privacy-body ul,
.privacy-body ol {
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
