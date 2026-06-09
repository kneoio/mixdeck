<template>
  <n-config-provider :theme="darkTheme">
    <div class="submission-page">
      <header class="nav">
        <div class="logo" @click="router.push('/')" style="cursor:pointer">MIXPLA</div>
      </header>

      <section class="submission-hero">
        <p class="eyebrow neon-motto">{{ t('submission.title') }}</p>
        <h1>{{ t('submission.subtitle') }}</h1>
      </section>

      <section class="submission-card">

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
          <n-button type="primary" size="large" class="cta-button" :loading="loading" @click="sendCode">
            {{ t('submission.send_code') }}
          </n-button>
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
          <n-button type="primary" size="large" class="cta-button" :loading="loading" @click="verify">
            {{ t('submission.verify') }}
          </n-button>
        </div>

        <!-- Step 3: Upload -->
        <div v-else-if="step === 3" class="step">
          <h2>{{ t('submission.step3_heading') }}</h2>
          <div class="file-area" @click="fileInputRef?.click()">
            <span v-if="!selectedFile" class="file-hint">{{ t('submission.choose_file') }}</span>
            <span v-else class="file-name">{{ selectedFile.name }}</span>
            <input ref="fileInputRef" type="file" accept="audio/*" style="display:none" @change="onFileChange" />
          </div>
          <n-progress
            v-if="uploadProgress > 0 && uploadProgress < 100"
            type="line"
            :percentage="uploadProgress"
            :indicator-placement="'inside'"
            style="margin-top: 16px;"
          />
          <p v-if="fieldError" class="field-error">{{ fieldError }}</p>
          <n-button
            type="primary"
            size="large"
            class="cta-button"
            :loading="loading"
            :disabled="!selectedFile"
            @click="upload"
          >
            {{ loading ? t('submission.uploading', { percent: uploadProgress }) : t('submission.submit') }}
          </n-button>
        </div>

        <!-- Success -->
        <div v-else-if="step === 4" class="step step--success">
          <div class="success-icon">✓</div>
          <h2>{{ t('submission.success_heading') }}</h2>
          <p class="step-body">{{ t('submission.success_body') }}</p>
          <n-button size="large" @click="router.push('/')">{{ t('submission.back') }}</n-button>
        </div>

        <div class="step-indicator">
          <span v-for="n in 3" :key="n" :class="['dot', { 'dot--active': step >= n, 'dot--done': step > n }]" />
        </div>

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
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { NButton, NConfigProvider, NInput, NProgress, darkTheme } from 'naive-ui'
import datanestApiService from '@/services/datanestApi'

const { t } = useI18n()
const router = useRouter()

const step = ref(1)
const email = ref('')
const code = ref('')
const selectedFile = ref<File | null>(null)
const fileInputRef = ref<HTMLInputElement | null>(null)
const loading = ref(false)
const fieldError = ref('')
const uploadProgress = ref(0)

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
  if (!selectedFile.value) {
    fieldError.value = t('submission.error_file')
    return
  }
  loading.value = true
  uploadProgress.value = 0
  try {
    await datanestApiService.uploadPublicSongChunked(
      selectedFile.value,
      email.value.trim(),
      code.value.trim(),
      (p) => { uploadProgress.value = p },
    )
    step.value = 4
  } catch (e: any) {
    fieldError.value = e?.message || 'Upload failed.'
  } finally {
    loading.value = false
  }
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

.field-error {
  color: #ff6b6b;
  font-size: 0.85rem;
  margin: 0;
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

.cta-button {
  background: linear-gradient(120deg, #ff7a18, #af002d 60%, #319197);
  border: none;
  color: #fff !important;
  box-shadow: 0 15px 40px rgba(255, 122, 24, 0.35);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  align-self: flex-start;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.cta-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 18px 45px rgba(255, 122, 24, 0.45);
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

.step-indicator {
  display: flex;
  justify-content: center;
  gap: 8px;
  margin-top: 32px;
  padding-top: 24px;
  border-top: 1px solid #1a1a1a;
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #2a2a2a;
  transition: background 0.3s;
}

.dot--active {
  background: #7C3AED;
}

.dot--done {
  background: #68ffba;
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
