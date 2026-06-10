<template>
  <n-config-provider :theme="darkTheme" :theme-overrides="themeOverrides">
    <div class="submission-page">
      <header class="nav">
        <div class="logo" @click="router.push('/')" style="cursor:pointer">MIXPLA</div>
      </header>

      <section class="submission-hero">
        <p class="eyebrow neon-motto">{{ t('submission.title') }}</p>
        <h1>{{ t('submission.subtitle') }}</h1>
      </section>

      <section class="submission-card">

        <div class="unavailable">
          <h2>{{ t('submission.unavailable_heading') }}</h2>
          <p class="step-body">{{ t('submission.unavailable_body') }}</p>
          <GsapButton @click="router.push('/')"><span>{{ t('submission.back') }}</span></GsapButton>
        </div>

        <template v-if="false">
        <!-- Step 1: Email -->
        <div v-if="step === 1" class="step">
          <h2>{{ t('submission.step1_heading') }}</h2>
          <p class="step-body">{{ t('submission.step1_body') }}</p>
          <div class="field-row">
            <n-input
              v-model:value="email"
              :placeholder="t('submission.email_placeholder')"
              size="large"
              @keydown.enter="sendCode"
            />
          </div>
          <p v-if="fieldError" class="field-error">{{ fieldError }}</p>
          <GsapButton type="primary" :disabled="loading" @click="sendCode">
            <span>{{ t('submission.send_code') }}</span>
          </GsapButton>
        </div>

        <!-- Step 2: OTP Code -->
        <div v-else-if="step === 2" class="step">
          <h2>{{ t('submission.step2_heading') }}</h2>
          <p class="step-body">{{ t('submission.step2_body') }}</p>
          <div class="field-row">
            <n-input
              v-model:value="code"
              :placeholder="t('submission.code_placeholder')"
              size="large"
              @keydown.enter="verify"
            />
          </div>
          <p v-if="fieldError" class="field-error">{{ fieldError }}</p>
          <GsapButton type="primary" :disabled="loading" @click="verify">
            <span>{{ t('submission.verify') }}</span>
          </GsapButton>
        </div>

        <!-- Step 3: Upload + metadata -->
        <div v-else-if="step === 3" class="step">
          <h2>{{ t('submission.step3_heading') }}</h2>

          <div class="field-row">
            <label class="field-label">{{ t('submission.station_label') }}</label>
            <n-select
              v-model:value="stationSlug"
              :options="stationOptions"
              :placeholder="t('submission.station_placeholder')"
              clearable
            />
          </div>

          <div class="field-row">
            <label class="field-label">{{ t('submission.artist_label') }} <span class="required">*</span></label>
            <n-input v-model:value="artistName" :placeholder="t('submission.artist_placeholder')" />
          </div>

          <div class="field-row">
            <label class="field-label">{{ t('submission.genre_label') }} <span class="required">*</span></label>
            <n-select
              v-model:value="genre"
              :options="GENRES.map(g => ({ label: g, value: g }))"
              :placeholder="t('submission.genre_placeholder')"
            />
          </div>

          <div class="field-row">
            <label class="field-label">{{ t('submission.country_label') }}</label>
            <n-input v-model:value="country" :placeholder="t('submission.country_placeholder')" />
          </div>

          <div class="field-row">
            <label class="field-label">{{ t('submission.file_label') }} <span class="required">*</span></label>
            <div class="file-area" @click="fileInputRef?.click()">
              <span v-if="!selectedFile" class="file-hint">{{ t('submission.choose_file') }}</span>
              <span v-else class="file-name">{{ selectedFile?.name }}</span>
              <input ref="fileInputRef" type="file" accept="audio/*" style="display:none" @change="onFileChange" />
            </div>
          </div>

          <n-progress
            v-if="loading"
            type="line"
            :percentage="uploadProgress"
            :show-indicator="false"
            :height="2"
            :border-radius="1"
            :fill-border-radius="1"
            color="#eff605"
            rail-color="rgba(255,255,255,0.12)"
          />

          <n-checkbox v-model:checked="agendaNotify" class="agenda-check">
            {{ t('submission.agenda_notify') }}
          </n-checkbox>

          <div class="agreement-box">
            <n-checkbox v-model:checked="agreed">
              {{ t('submission.agreement') }}
            </n-checkbox>
          </div>

          <div v-if="fieldError" class="error-row">
            <p class="field-error">{{ fieldError }}</p>
            <button class="restart-link" @click="restart">{{ t('submission.start_over') }}</button>
          </div>

          <GsapButton type="primary" :disabled="loading" @click="upload">
            <span>{{ t('submission.submit') }}</span>
          </GsapButton>
        </div>

        <!-- Success -->
        <div v-else-if="step === 4" class="step step--success">
          <div class="success-icon">✓</div>
          <h2>{{ t('submission.success_heading') }}</h2>
          <p class="step-body">{{ t('submission.success_body') }}</p>
          <GsapButton @click="router.push('/')">
            <span>{{ t('submission.back') }}</span>
          </GsapButton>
        </div>
        </template>

      </section>

      <footer class="footer">
        <div class="logo">MIXPLA</div>
        <div class="status">{{ t('welcome.footer_status') }}</div>
        <div class="copyright">© Mixpla</div>
      </footer>
    </div>
  </n-config-provider>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { NConfigProvider, NInput, NProgress, NSelect, NCheckbox, darkTheme, type GlobalThemeOverrides } from 'naive-ui'
import GsapButton from '@/components/GsapButton.vue'
import datanestApiService from '@/services/datanestApi'

const { t } = useI18n()
const router = useRouter()

const themeOverrides: GlobalThemeOverrides = {
  common: {
    primaryColor: '#7C3AED',
    primaryColorHover: '#9d5bf4',
    primaryColorPressed: '#6d31d4',
    primaryColorSuppl: '#7C3AED',
  },
  Button: {
    textColorPrimary: '#ffffff',
    textColorHoverPrimary: '#ffffff',
    textColorPressedPrimary: '#ffffff',
    textColorFocusPrimary: '#ffffff',
  },
}

const GENRES = ['Electronic','House','Techno','Drum & Bass','Hip-Hop','R&B','Pop','Rock','Jazz','Classical','Latin','Ambient','Country','Other']

const step = ref(1)
const email = ref('')
const code = ref('')
const stationSlug = ref<string | null>(null)
const artistName = ref('')
const genre = ref<string | null>(null)
const country = ref('')
const agendaNotify = ref(false)
const agreed = ref(false)
const selectedFile = ref<File | null>(null)
const fileInputRef = ref<HTMLInputElement | null>(null)
const loading = ref(false)
const fieldError = ref('')
const uploadProgress = ref(0)
const stationOptions = ref<{ label: string; value: string }[]>([])

onMounted(async () => {
  stationOptions.value = await datanestApiService.getPublicBrands()
})

async function sendCode() {
  fieldError.value = ''
  if (!email.value.trim() || !email.value.includes('@')) {
    fieldError.value = t('submission.error_email')
    return
  }
  loading.value = true
  try {
    await datanestApiService.requestSubmissionCode(email.value.trim())
    step.value = 2
  } catch (e: any) {
    fieldError.value = e?.message || 'Error sending code.'
  } finally {
    loading.value = false
  }
}

async function verify() {
  fieldError.value = ''
  if (!code.value.trim()) {
    fieldError.value = t('submission.error_code')
    return
  }
  step.value = 3
}

function onFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  selectedFile.value = input.files?.[0] ?? null
}

async function upload() {
  fieldError.value = ''
  if (!artistName.value.trim()) { fieldError.value = t('submission.error_artist'); return }
  if (!genre.value) { fieldError.value = t('submission.error_genre'); return }
  if (!selectedFile.value) { fieldError.value = t('submission.error_file'); return }
  if (!agreed.value) { fieldError.value = t('submission.error_agreement'); return }
  loading.value = true
  uploadProgress.value = 0
  try {
    await datanestApiService.uploadPublicSongChunked(
      selectedFile.value,
      email.value.trim(),
      code.value.trim(),
      (p) => { uploadProgress.value = p },
      { stationSlug: stationSlug.value ?? undefined, artistName: artistName.value.trim(), genre: genre.value, country: country.value.trim() || undefined, agendaNotify: agendaNotify.value },
    )
    step.value = 4
  } catch (e: any) {
    const msg: string = e?.message || 'Upload failed.'
    if (msg.includes('401')) { restart(); return }
    fieldError.value = msg
  } finally {
    loading.value = false
  }
}

function restart() {
  step.value = 1
  email.value = ''
  code.value = ''
  selectedFile.value = null
  uploadProgress.value = 0
  fieldError.value = t('submission.error_code_expired')
}
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

:global(body) {
  background: #050505;
}

.submission-page {
  min-height: 100vh;
  background: #050505;
  color: #f5f5f5;
  font-family: 'Inter', sans-serif;
  padding: 32px clamp(16px, 4vw, 64px);
}

.nav {
  display: flex;
  align-items: center;
  padding-bottom: 32px;
}

.logo {
  font-family: 'Kaylon', 'Inter', sans-serif;
  font-weight: 700;
  letter-spacing: 0.24em;
  font-size: clamp(1.1rem, 2vw, 1.6rem);
  color: #c0c0c0;
}

.submission-hero {
  padding: 48px 0 32px;
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
  animation: blink 12s infinite;
  letter-spacing: 0.4em;
  text-transform: uppercase;
}

h1 {
  font-size: clamp(2rem, 4vw, 3rem);
  margin: 16px 0 0;
}

h2 {
  font-size: 1.4rem;
  margin: 0 0 8px;
}

.submission-card {
  max-width: 520px;
  margin: 0 auto;
  background: #0f0f0f;
  border: 1px solid #1f1f1f;
  border-radius: 16px;
  padding: 40px;
}

.step {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.step-body {
  color: #b0b0b0;
  margin: 0;
  font-size: 0.95rem;
}

.field-row {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.error-row {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.field-error {
  color: #ff6b6b;
  font-size: 0.85rem;
  margin: 0;
}

.restart-link {
  color: #888 !important;
  font-size: 0.82rem;
  text-decoration: underline;
  white-space: nowrap;
}

.field-label {
  font-size: 0.82rem;
  color: #888;
  margin-bottom: 4px;
  display: block;
}

.required {
  color: #FF2D95;
}

.agenda-check {
  margin-top: 4px;
}

.agreement-box {
  background: rgba(255,255,255,0.03);
  border: 1px solid #2a2a2a;
  border-radius: 8px;
  padding: 14px 16px;
  font-size: 0.85rem;
  color: #b0b0b0;
}

.restart-link {
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
}

.unavailable {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px 0;
}

.file-area {
  border: 1px dashed #333;
  border-radius: 10px;
  padding: 32px;
  text-align: center;
  cursor: pointer;
  transition: border-color 0.2s, background 0.2s;
}

.file-area:hover {
  border-color: #7C3AED;
  background: rgba(124, 58, 237, 0.05);
}

.file-hint {
  color: #666;
  font-size: 0.9rem;
}

.file-name {
  color: #b0b0b0;
  font-size: 0.9rem;
  word-break: break-all;
}


.step--success {
  align-items: center;
  text-align: center;
}

.success-icon {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: rgba(104, 255, 186, 0.15);
  border: 2px solid #68ffba;
  color: #68ffba;
  font-size: 1.8rem;
  display: flex;
  align-items: center;
  justify-content: center;
}


.footer {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 16px;
  padding-top: 48px;
  margin-top: 64px;
  border-top: 1px solid #1a1a1a;
  align-items: center;
}

.status {
  color: #68ffba;
}

@keyframes blink {
  20%, 24%, 55% { color: #111; text-shadow: none; }
  0%, 19%, 21%, 23%, 25%, 54%, 100% {
    text-shadow: 0 0 5px #ffa500, 0 0 15px #ffa500, 0 0 20px #ffa500, 0 0 40px #ffa500, 0 0 60px #ff0000, 0 0 10px #ff8d00, 0 0 98px #ff0000;
    color: #fff6a9;
  }
}
</style>
