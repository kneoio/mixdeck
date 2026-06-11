<template>
  <n-config-provider :theme="darkTheme" :theme-overrides="themeOverrides">
    <div class="submission-page">
      <div class="side-label neon-motto">{{ t('submission.title') }}</div>
      <header class="nav">
        <div class="logo" @click="router.push('/')" style="cursor:pointer">MIXPLA</div>
      </header>

      <!-- Success -->
      <section v-if="verified && submitted" class="submission-card">
        <div class="step step--success">
          <div class="success-icon">✓</div>
          <h2>{{ t('submission.success_heading') }}</h2>
          <p class="step-body">{{ t('submission.success_body') }}</p>
          <GsapButton @click="router.push('/')"><span>{{ t('submission.back') }}</span></GsapButton>
        </div>
      </section>

      <!-- Form -->
      <section v-else class="submission-card">
        <div class="form">

          <!-- Email + OTP row -->
          <div class="field-row">
            <label class="field-label">{{ t('submission.step1_heading') }}</label>
            <div class="field-error-shell" :class="{ 'field-error-shell--active': !!fieldErrors.email }">
              <div class="inline-row">
                <n-input
                  v-model:value="email"
                  :placeholder="t('submission.email_placeholder')"
                  :disabled="codeSent"
                  @keydown.enter="sendCode"
                />
                <GsapButton type="primary" :disabled="loading || codeSent" @click="sendCode">
                  <span>{{ t('submission.send_code') }}</span>
                </GsapButton>
              </div>
            </div>
            <div class="field-error-label" :class="{ 'field-error-label--visible': !!fieldErrors.email }">{{ fieldErrors.email || ' ' }}</div>
          </div>

          <div v-if="codeSent" class="field-row">
            <label class="field-label">{{ t('submission.step2_heading') }}</label>
            <div class="field-error-shell" :class="{ 'field-error-shell--active': !!fieldErrors.code }">
              <div class="inline-row">
                <n-input
                  v-model:value="code"
                  :placeholder="t('submission.code_placeholder')"
                  :disabled="verified"
                  @keydown.enter="verify"
                />
                <GsapButton type="primary" :disabled="loading || verified" @click="verify">
                  <span>{{ verified ? '✓' : t('submission.verify') }}</span>
                </GsapButton>
              </div>
            </div>
            <div class="field-error-label" :class="{ 'field-error-label--visible': !!fieldErrors.code }">{{ fieldErrors.code || ' ' }}</div>
          </div>

          <div class="divider" />

          <!-- Station -->
          <div class="field-row">
            <label class="field-label">{{ t('submission.station_label') }}</label>
            <n-skeleton v-if="stationsLoading" height="34px" :sharp="false" />
            <n-select
              v-else
              v-model:value="stationSlugs"
              :options="stationOptions"
              :placeholder="t('submission.station_placeholder')"
              :disabled="!verified"
              multiple
              clearable
            />
          </div>

          <!-- Artist -->
          <div class="field-row">
            <label class="field-label">{{ t('submission.artist_label') }}</label>
            <div class="field-error-shell" :class="{ 'field-error-shell--active': !!fieldErrors.artistName }">
              <n-input v-model:value="artistName" :placeholder="t('submission.artist_placeholder')" :disabled="!verified" @input="fieldErrors.artistName = ''" />
            </div>
            <div class="field-error-label" :class="{ 'field-error-label--visible': !!fieldErrors.artistName }">{{ fieldErrors.artistName || ' ' }}</div>
          </div>

          <!-- Genre -->
          <div class="field-row">
            <label class="field-label">{{ t('submission.genre_label') }}</label>
            <div class="field-error-shell" :class="{ 'field-error-shell--active': !!fieldErrors.genre }">
              <n-select
                v-model:value="genre"
                :options="GENRES.map(g => ({ label: g, value: g }))"
                :placeholder="t('submission.genre_placeholder')"
                :disabled="!verified"
                @update:value="fieldErrors.genre = ''"
              />
            </div>
            <div class="field-error-label" :class="{ 'field-error-label--visible': !!fieldErrors.genre }">{{ fieldErrors.genre || ' ' }}</div>
          </div>

          <!-- Country -->
          <div class="field-row">
            <label class="field-label">{{ t('submission.country_label') }}</label>
            <div class="field-error-shell">
              <n-input v-model:value="country" :placeholder="t('submission.country_placeholder')" :disabled="!verified" />
            </div>
            <div class="field-error-label" />
          </div>

          <!-- File -->
          <div class="field-row">
            <label class="field-label">{{ t('submission.file_label') }}</label>
            <div class="field-error-shell" :class="{ 'field-error-shell--active': !!fieldErrors.file }">
              <div class="file-area" :class="{ 'file-area--disabled': !verified }" @click="verified && fileInputRef?.click()">
                <span v-if="!selectedFile" class="file-hint">{{ t('submission.choose_file') }}</span>
                <span v-else class="file-name">{{ selectedFile?.name }}</span>
                <input ref="fileInputRef" type="file" accept="audio/*" style="display:none" @change="onFileChange" />
              </div>
            </div>
            <div class="field-error-label" :class="{ 'field-error-label--visible': !!fieldErrors.file }">{{ fieldErrors.file || ' ' }}</div>
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

          <!-- DJ agenda -->
          <n-checkbox v-model:checked="agendaNotify" :disabled="!verified">
            {{ t('submission.agenda_notify') }}
          </n-checkbox>

          <!-- Agreement collapse -->
          <div class="field-error-shell" :class="{ 'field-error-shell--active': !!fieldErrors.agreement }">
            <n-collapse :disabled="!verified">
              <n-collapse-item :title="t('submission.agreement_title')" name="agreement">
                <div class="agreement-body">
                  <p>{{ t('submission.agreement_text') }}</p>
                  <n-checkbox v-model:checked="agreed" :disabled="!verified" @update:checked="fieldErrors.agreement = ''">
                    {{ t('submission.agreement') }}
                  </n-checkbox>
                </div>
              </n-collapse-item>
            </n-collapse>
          </div>
          <div class="field-error-label" :class="{ 'field-error-label--visible': !!fieldErrors.agreement }">{{ fieldErrors.agreement || ' ' }}</div>

          <div v-if="fieldErrors.api" class="error-row">
            <p class="field-error">{{ fieldErrors.api }}</p>
            <button class="restart-link" @click="restart">{{ t('submission.start_over') }}</button>
          </div>

          <GsapButton type="primary" :disabled="!verified || loading" @click="upload">
            <span>{{ t('submission.submit') }}</span>
          </GsapButton>

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
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { NConfigProvider, NInput, NProgress, NSelect, NCheckbox, NSkeleton, NCollapse, NCollapseItem, darkTheme, type GlobalThemeOverrides } from 'naive-ui'
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

const email = ref('')
const code = ref('')
const codeSent = ref(false)
const verified = ref(false)
const submitted = ref(false)
const stationSlugs = ref<string[]>([])
const artistName = ref('')
const genre = ref<string | null>(null)
const country = ref('')
const agendaNotify = ref(false)
const agreed = ref(false)
const selectedFile = ref<File | null>(null)
const fileInputRef = ref<HTMLInputElement | null>(null)
const loading = ref(false)
const uploadProgress = ref(0)
const stationOptions = ref<{ label: string; value: string }[]>([])
const stationsLoading = ref(true)

type ValidationField = 'email' | 'code' | 'artistName' | 'genre' | 'file' | 'agreement' | 'api'
const fieldErrors = ref<Record<ValidationField, string>>({ email: '', code: '', artistName: '', genre: '', file: '', agreement: '', api: '' })

onMounted(async () => {
  stationOptions.value = await datanestApiService.getPublicBrands()
  stationsLoading.value = false
})

async function sendCode() {
  fieldErrors.value.email = ''
  if (!email.value.trim() || !email.value.includes('@')) {
    fieldErrors.value.email = t('submission.error_email')
    return
  }
  loading.value = true
  try {
    await datanestApiService.requestSubmissionCode(email.value.trim())
    codeSent.value = true
  } catch (e: any) {
    fieldErrors.value.email = e?.message || 'Error sending code.'
  } finally {
    loading.value = false
  }
}

async function verify() {
  fieldErrors.value.code = ''
  if (!code.value.trim()) {
    fieldErrors.value.code = t('submission.error_code')
    return
  }
  verified.value = true
}

function onFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  selectedFile.value = input.files?.[0] ?? null
  if (selectedFile.value) fieldErrors.value.file = ''
}

async function upload() {
  fieldErrors.value.artistName = ''
  fieldErrors.value.genre = ''
  fieldErrors.value.file = ''
  fieldErrors.value.agreement = ''
  fieldErrors.value.api = ''
  let invalid = false
  if (!artistName.value.trim()) { fieldErrors.value.artistName = t('submission.error_artist'); invalid = true }
  if (!genre.value) { fieldErrors.value.genre = t('submission.error_genre'); invalid = true }
  if (!selectedFile.value) { fieldErrors.value.file = t('submission.error_file'); invalid = true }
  if (!agreed.value) { fieldErrors.value.agreement = t('submission.error_agreement'); invalid = true }
  if (invalid) return
  loading.value = true
  uploadProgress.value = 0
  try {
    await datanestApiService.uploadPublicSongChunked(
      selectedFile.value!,
      email.value.trim(),
      code.value.trim(),
      (p) => { uploadProgress.value = p },
      { stationSlugs: stationSlugs.value.length ? stationSlugs.value : undefined, artistName: artistName.value.trim(), genre: genre.value, country: country.value.trim() || undefined, agendaNotify: agendaNotify.value },
    )
    submitted.value = true
  } catch (e: any) {
    const msg: string = e?.message || 'Upload failed.'
    if (msg.includes('401')) { restart(); return }
    fieldErrors.value.api = msg
  } finally {
    loading.value = false
  }
}

function restart() {
  email.value = ''
  code.value = ''
  codeSent.value = false
  verified.value = false
  submitted.value = false
  stationSlugs.value = []
  selectedFile.value = null
  uploadProgress.value = 0
  fieldErrors.value = { email: '', code: '', artistName: '', genre: '', file: '', agreement: '', api: t('submission.error_code_expired') }
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

.side-label {
  position: fixed;
  left: 16px;
  top: 50%;
  transform: translateY(-50%) rotate(-90deg);
  transform-origin: center center;
  font-size: 0.75rem;
  letter-spacing: 0.4em;
  text-transform: uppercase;
  white-space: nowrap;
  pointer-events: none;
}

.neon-motto {
  text-shadow: 0 0 5px #ffa500, 0 0 15px #ffa500, 0 0 20px #ffa500, 0 0 40px #ffa500, 0 0 60px #ff0000, 0 0 10px #ff8d00, 0 0 98px #ff0000;
  color: #fff6a9;
  animation: blink 12s infinite;
}

@keyframes blink {
  20%, 24%, 55% { color: #111; text-shadow: none; }
  0%, 19%, 21%, 23%, 25%, 54%, 100% {
    text-shadow: 0 0 5px #ffa500, 0 0 15px #ffa500, 0 0 20px #ffa500, 0 0 40px #ffa500, 0 0 60px #ff0000, 0 0 10px #ff8d00, 0 0 98px #ff0000;
    color: #fff6a9;
  }
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
  max-width: 560px;
  margin: 8px auto 0;
  background: #0f0f0f;
  border: 1px solid #1f1f1f;
  border-radius: 16px;
  padding: 40px;
}

.form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.inline-row {
  display: flex;
  gap: 10px;
  align-items: center;
}

.inline-row .n-input {
  flex: 1;
}

.divider {
  height: 1px;
  background: #1f1f1f;
  margin: 4px 0;
}

.field-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field-label {
  font-size: 0.82rem;
  color: #888;
  display: block;
}

.field-error-shell {
  width: 100%;
  border-left: 2px solid transparent;
  padding-left: 8px;
  transition: border-left-color 0.2s ease;
}

.field-error-shell--active {
  border-left-color: rgba(255, 77, 79, 0.95);
}

.field-error-label {
  margin-top: 2px;
  min-height: 12px;
  padding-left: 10px;
  color: #ff4d4f;
  font-size: 11px;
  line-height: 1.3;
  visibility: hidden;
}

.field-error-label--visible {
  visibility: visible;
}

.file-area {
  border: 1px dashed #333;
  border-radius: 10px;
  padding: 28px;
  text-align: center;
  cursor: pointer;
  transition: border-color 0.2s, background 0.2s;
}

.file-area:not(.file-area--disabled):hover {
  border-color: #7C3AED;
  background: rgba(124, 58, 237, 0.05);
}

.file-area--disabled {
  opacity: 0.4;
  cursor: not-allowed;
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

.agreement-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 8px 0 4px;
  font-size: 0.85rem;
  color: #b0b0b0;
  line-height: 1.6;
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
  background: none;
  border: none;
  cursor: pointer;
  color: #888;
  font-size: 0.82rem;
  text-decoration: underline;
  padding: 0;
}

.step-body {
  color: #b0b0b0;
  margin: 0;
  font-size: 0.95rem;
}

.step--success {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 16px;
  padding: 16px 0;
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

</style>
