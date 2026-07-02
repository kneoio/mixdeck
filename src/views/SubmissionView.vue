<template>
  <n-config-provider :theme="darkTheme" :theme-overrides="themeOverrides">
    <div class="submission-page">
      <div class="side-label neon-motto">{{ t('submission.title') }}</div>

      <header class="nav">
        <div class="logo" @click="router.push('/')" style="cursor:pointer">MIXPLA</div>
      </header>

      <div class="page-center">

      <!-- Wizard -->
      <section class="submission-card">

        <!-- Step indicator -->
        <div class="wizard-steps">
          <div class="wizard-step" :class="{ active: step === 1, done: step > 1 }">
            <div class="wizard-dot"><span class="arcade step-led">1</span></div>
          </div>
          <div class="wizard-connector" :class="{ done: step > 1 }" />
          <div class="wizard-step" :class="{ active: step === 2, done: step > 2 }">
            <div class="wizard-dot"><span class="arcade step-led">2</span></div>
          </div>
          <div class="wizard-connector" :class="{ done: step > 2 }" />
          <div class="wizard-step" :class="{ active: step === 3, done: step > 3 }">
            <div class="wizard-dot"><span class="arcade step-led">3</span></div>
          </div>
        </div>

        <!-- Step 1: Auth -->
        <transition name="slide" mode="out-in">
          <div v-if="step === 1" key="auth" class="wizard-body">

            <p class="step-intro">
              Thank you for submitting your track to Mixpla.<br><br>
              Mixpla is a facility to keep your files for DJs that create on the platform. It will not use them without your permission. After upload, you can access your files by registering in Mixpla under the same email — and do anything with them, including delete.
            </p>

            <div class="field-row">
              <label class="field-label">{{ t('submission.email_placeholder') }}</label>
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

            <div class="field-row">
              <label class="field-label">{{ t('submission.code_placeholder') }}</label>
              <div class="field-error-shell" :class="{ 'field-error-shell--active': !!fieldErrors.code }">
                <div class="inline-row">
                  <n-input
                    v-model:value="code"
                    :placeholder="t('submission.code_placeholder')"
                    :disabled="!codeSent"
                    @keydown.enter="verifyAndNext"
                  />
                  <GsapButton type="primary" :disabled="loading || !codeSent" @click="verifyAndNext">
                    <span>{{ t('submission.verify') }}</span>
                  </GsapButton>
                </div>
              </div>
              <div class="field-error-label" :class="{ 'field-error-label--visible': !!fieldErrors.code }">{{ fieldErrors.code || ' ' }}</div>
            </div>

          </div>
        </transition>

        <!-- Step 2: Upload -->
        <transition name="slide" mode="out-in">
          <div v-if="step === 2" key="upload" class="wizard-body">

            <div class="two-col">
              <!-- Artist -->
              <div class="field-row">
                <label class="field-label">{{ t('submission.artist_label') }}</label>
                <div class="field-error-shell" :class="{ 'field-error-shell--active': !!fieldErrors.artistName }">
                  <n-input v-model:value="artistName" :placeholder="t('submission.artist_placeholder')" @input="fieldErrors.artistName = ''" />
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
                    @update:value="fieldErrors.genre = ''"
                  />
                </div>
                <div class="field-error-label" :class="{ 'field-error-label--visible': !!fieldErrors.genre }">{{ fieldErrors.genre || ' ' }}</div>
              </div>
            </div>

            <div class="two-col">
              <!-- Country -->
              <div class="field-row">
                <label class="field-label">{{ t('submission.country_label') }}</label>
                <div class="field-error-shell">
                  <n-input v-model:value="country" :placeholder="t('submission.country_placeholder')" />
                </div>
                <div class="field-error-label" />
              </div>

              <!-- Station -->
              <div class="field-row">
                <label class="field-label">{{ t('submission.station_label') }}</label>
                <n-skeleton v-if="stationsLoading" height="34px" :sharp="false" />
                <n-select
                  v-else
                  v-model:value="stationSlug"
                  :options="stationOptions"
                  :placeholder="t('submission.station_placeholder')"
                  clearable
                />
              </div>
            </div>

            <!-- File -->
            <div class="field-row">
              <label class="field-label">{{ t('submission.file_label') }}</label>
              <div class="field-error-shell" :class="{ 'field-error-shell--active': !!fieldErrors.file }">
                <div
                  class="file-area"
                  :class="{ 'file-area--has-file': !!selectedFile }"
                  @click="fileInputRef?.click()"
                  @dragover.prevent
                  @drop.prevent="onDrop"
                >
                  <span v-if="!selectedFile" class="file-hint">{{ t('submission.choose_file') }}</span>
                  <span v-else class="file-name">🎵 {{ selectedFile.name }}</span>
                  <input ref="fileInputRef" type="file" accept="audio/*" style="display:none" @change="onFileChange" />
                </div>
              </div>
              <div class="field-error-label" :class="{ 'field-error-label--visible': !!fieldErrors.file }">{{ fieldErrors.file || ' ' }}</div>
            </div>

            <!-- Description (optional) -->
            <div class="field-row">
              <label class="field-label">{{ t('submission.description_label') }}</label>
              <n-input
                v-model:value="description"
                type="textarea"
                :rows="3"
                :placeholder="t('submission.description_placeholder')"
              />
            </div>

            <n-progress
              type="line"
              :percentage="uploadProgress"
              :show-indicator="false"
              :height="2"
              :border-radius="1"
              :fill-border-radius="1"
              color="#eff605"
              rail-color="rgba(255,255,255,0.12)"
            />

            <!-- Checkboxes row -->
            <div class="checks-row">
              <n-checkbox v-model:checked="agendaNotify">{{ t('submission.agenda_notify') }}</n-checkbox>
              <div class="field-error-shell" :class="{ 'field-error-shell--active': !!fieldErrors.agreement }">
                <n-collapse :default-expanded-names="['agreement']">
                  <n-collapse-item :title="t('submission.agreement_title')" name="agreement">
                    <div class="agreement-body">
                      <p>{{ t('submission.agreement_text') }}</p>
                      <n-checkbox v-model:checked="agreed" @update:checked="fieldErrors.agreement = ''">
                        {{ t('submission.agreement') }}
                      </n-checkbox>
                    </div>
                  </n-collapse-item>
                </n-collapse>
              </div>
              <div class="field-error-label" :class="{ 'field-error-label--visible': !!fieldErrors.agreement }">{{ fieldErrors.agreement || ' ' }}</div>
            </div>

            <div v-if="fieldErrors.api" class="error-row">
              <p class="field-error">{{ fieldErrors.api }}</p>
              <button class="restart-link" @click="restart">{{ t('submission.start_over') }}</button>
            </div>

            <div class="wizard-actions">
              <button class="back-btn" @click="step = 1">← {{ t('submission.step1_heading') }}</button>
              <GsapButton type="primary" :disabled="loading" @click="upload">
                <span>{{ t('submission.submit') }}</span>
              </GsapButton>
            </div>

          </div>
        </transition>

        <!-- Step 3: Success + Summary -->
        <transition name="slide" mode="out-in">
          <div v-if="step === 3" key="success" class="wizard-body">

            <div class="step step--success">
              <h2>{{ t('submission.success_heading') }}</h2>
              <p class="step-body">{{ t('submission.success_body') }}</p>
            </div>

            <div class="summary-box">
              <div class="summary-row"><span class="summary-label">{{ t('submission.artist_label') }}</span><span>{{ lastSubmission.artistName }}</span></div>
              <div class="summary-row"><span class="summary-label">{{ t('submission.genre_label') }}</span><span>{{ lastSubmission.genre }}</span></div>
              <div class="summary-row" v-if="lastSubmission.stationLabel"><span class="summary-label">{{ t('submission.station_label') }}</span><span>{{ lastSubmission.stationLabel }}</span></div>
              <div class="summary-row"><span class="summary-label">{{ t('submission.file_label') }}</span><span>{{ lastSubmission.fileName }}</span></div>
              <div class="summary-row" v-if="lastSubmission.description"><span class="summary-label">{{ t('submission.description_label') }}</span><span>{{ lastSubmission.description }}</span></div>
            </div>

            <div class="success-actions">
              <GsapButton @click="router.push('/')"><span>{{ t('submission.finish') }}</span></GsapButton>
              <GsapButton type="primary" @click="submitAnother"><span>{{ t('submission.submit_another') }}</span></GsapButton>
            </div>

          </div>
        </transition>

      </section>

      </div><!-- end page-center -->

      <footer class="footer">
        <div class="copyright">© Mixpla</div>
      </footer>
    </div>
  </n-config-provider>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
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

const step = ref(1)
const email = ref('')
const code = ref('')
const codeSent = ref(false)
const verified = ref(false)
const submitted = ref(false)
const stationSlug = ref<string | null>(null)
const artistName = ref('')
const genre = ref<string | null>(null)
const country = ref('')
const agendaNotify = ref(false)
const description = ref('')
const agreed = ref(false)
const selectedFile = ref<File | null>(null)
const fileInputRef = ref<HTMLInputElement | null>(null)
const loading = ref(false)
const uploadProgress = ref(0)
const stationOptions = ref<{ label: string; value: string }[]>([])
const stationsLoading = ref(true)

type ValidationField = 'email' | 'code' | 'artistName' | 'genre' | 'file' | 'agreement' | 'api'
const fieldErrors = ref<Record<ValidationField, string>>({ email: '', code: '', artistName: '', genre: '', file: '', agreement: '', api: '' })

const lastSubmission = computed(() => ({
  artistName: artistName.value,
  genre: genre.value || '',
  stationLabel: stationOptions.value.find(o => o.value === stationSlug.value)?.label || '',
  fileName: selectedFile.value?.name || '',
  description: description.value,
}))

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

async function verifyAndNext() {
  fieldErrors.value.code = ''
  if (!code.value.trim()) {
    fieldErrors.value.code = t('submission.error_code')
    return
  }
  verified.value = true
  step.value = 2
}

function onFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  selectedFile.value = input.files?.[0] ?? null
  if (selectedFile.value) {
    fieldErrors.value.file = ''
    uploadProgress.value = 1 + Math.random() * 2
  }
}

function onDrop(e: DragEvent) {
  const file = e.dataTransfer?.files?.[0]
  if (file && file.type.startsWith('audio/')) {
    selectedFile.value = file
    fieldErrors.value.file = ''
    uploadProgress.value = 1 + Math.random() * 2
  }
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
  uploadProgress.value = 1 + Math.random() * 2
  try {
    await datanestApiService.uploadPublicSongChunked(
      selectedFile.value!,
      email.value.trim(),
      code.value.trim(),
      (p) => { uploadProgress.value = p },
      { stationSlug: stationSlug.value ?? undefined, artistName: artistName.value.trim(), genre: genre.value ?? undefined, country: country.value.trim() || undefined, agendaNotify: agendaNotify.value, description: description.value.trim() || undefined },
    )
    submitted.value = true
    step.value = 3
  } catch (e: any) {
    const msg: string = e?.message || 'Upload failed.'
    if (msg.includes('401')) { restart(); return }
    fieldErrors.value.api = msg
  } finally {
    loading.value = false
  }
}

function submitAnother() {
  submitted.value = false
  selectedFile.value = null
  artistName.value = ''
  genre.value = null
  country.value = ''
  stationSlug.value = null
  agendaNotify.value = false
  agreed.value = false
  description.value = ''
  uploadProgress.value = 0
  fieldErrors.value = { email: '', code: '', artistName: '', genre: '', file: '', agreement: '', api: '' }
  step.value = 2
}

function restart() {
  email.value = ''
  code.value = ''
  codeSent.value = false
  verified.value = false
  submitted.value = false
  step.value = 1
  stationSlug.value = null
  selectedFile.value = null
  uploadProgress.value = 0
  fieldErrors.value = { email: '', code: '', artistName: '', genre: '', file: '', agreement: '', api: t('submission.error_code_expired') }
}
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Press+Start+2P&display=swap');

@font-face {
  font-family: 'Digital Play Italic St';
  src: url('/src/assets/fonts/Digital Play Italic St.ttf') format('truetype');
  font-display: swap;
}

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
  padding: 24px clamp(16px, 4vw, 64px);
  display: flex;
  flex-direction: column;
}

.page-center {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px 0;
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

@keyframes led-pulse {
  0%, 70%, 100% { opacity: 1; text-shadow: 0 0 18px #00FF3C; }
  40% { opacity: 0.25; text-shadow: 0 0 4px #00FF3C; }
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
  padding-bottom: 12px;
}

.logo {
  font-family: 'Kaylon', 'Inter', sans-serif;
  font-weight: 700;
  letter-spacing: 0.24em;
  font-size: clamp(1.1rem, 2vw, 1.6rem);
  color: #c0c0c0;
}

h2 {
  font-size: 1.4rem;
  margin: 0 0 8px;
}

/* Card */
.submission-card {
  width: 100%;
  max-width: 600px;
  background: #0f0f0f;
  border: 1px solid #1f1f1f;
  border-radius: 16px;
  padding: 32px 36px;
}

/* Step indicator */
.wizard-steps {
  display: flex;
  align-items: center;
  gap: 0;
  margin-bottom: 28px;
}

.wizard-step {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.wizard-step span:not(.step-led) {
  font-size: 0.78rem;
  color: #555;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  transition: color 0.3s;
}

.wizard-step.active span:not(.step-led),
.wizard-step.done span:not(.step-led) {
  color: #b0b0b0;
}

.wizard-dot {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 1.5px solid #222;
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.arcade {
  font-family: 'Digital Play Italic St', monospace;
  font-size: 1rem;
  line-height: 1;
}

.step-led {
  color: #00FF3C;
  opacity: 0.25;
  text-shadow: none;
  transition: opacity 0.3s ease, text-shadow 0.3s ease;
}

.wizard-step.active .step-led {
  opacity: 1;
  transition: opacity 0.05s, text-shadow 0.05s;
  animation: led-pulse 0.8s ease-in-out infinite;
}

.wizard-step.done .step-led {
  opacity: 1;
  transition: opacity 0.05s, text-shadow 0.05s;
  text-shadow: 0 0 6px #00FF3C, 0 0 16px #00FF3C, 0 0 36px #00FF3C, 0 0 60px #00FF3C;
}



.wizard-connector {
  flex: 1;
  height: 1px;
  background: #222;
  margin: 0 12px;
  transition: background 0.3s;
}

.wizard-connector.done {
  background: #7C3AED;
}

.step-intro {
  font-size: 0.85rem;
  color: #777;
  line-height: 1.65;
  margin: 0 0 4px;
}

/* Wizard body */
.wizard-body {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

/* Two-col grid */
.two-col {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}

/* Fields */
.field-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.field-label {
  font-size: 0.78rem;
  color: #666;
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
  margin-top: 1px;
  min-height: 12px;
  padding-left: 10px;
  color: #ff4d4f;
  font-size: 10px;
  line-height: 1.3;
  visibility: hidden;
}

.field-error-label--visible {
  visibility: visible;
}

/* Inline row (email + button) */
.inline-row {
  display: flex;
  gap: 10px;
  align-items: center;
}

.inline-row .n-input {
  flex: 1;
}

/* File drop area */
.file-area {
  border: 1px dashed #2a2a2a;
  border-radius: 8px;
  padding: 16px;
  text-align: center;
  cursor: pointer;
  transition: border-color 0.2s, background 0.2s;
}

.file-area:hover {
  border-color: #7C3AED;
  background: rgba(124, 58, 237, 0.04);
}

.file-area--has-file {
  border-color: #7C3AED;
  background: rgba(124, 58, 237, 0.06);
}

.file-hint {
  color: #555;
  font-size: 0.85rem;
}

.file-name {
  color: #b0b0b0;
  font-size: 0.85rem;
  word-break: break-all;
}

/* Checks row */
.checks-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.agreement-body {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 6px 0 2px;
  font-size: 0.83rem;
  color: #999;
  line-height: 1.6;
}

/* Actions */
.wizard-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 4px;
}

.back-btn {
  background: none;
  border: none;
  cursor: pointer;
  color: #555;
  font-size: 0.82rem;
  padding: 0;
  transition: color 0.2s;
}

.back-btn:hover {
  color: #999;
}

/* Error row */
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

/* Success */
.success-actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  justify-content: center;
}

.step--success {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 16px;
  padding: 16px 0;
}

.step-body {
  color: #b0b0b0;
  margin: 0;
  font-size: 0.95rem;
}

.summary-box {
  width: 100%;
  max-width: 420px;
  align-self: center;
  background: #0f0f0f;
  border: 1px solid #1f1f1f;
  border-radius: 8px;
  padding: 14px 18px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.summary-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  font-size: 0.85rem;
  color: #ddd;
  text-align: left;
}

.summary-label {
  color: #777;
  flex-shrink: 0;
}

/* Transitions */
.slide-enter-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}

.slide-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.slide-enter-from {
  opacity: 0;
  transform: translateX(24px);
}

.slide-leave-to {
  opacity: 0;
  transform: translateX(-24px);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* Footer */
.footer {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 16px;
  padding-top: 40px;
  margin-top: 48px;
  border-top: 1px solid #1a1a1a;
  align-items: center;
}

.status {
  color: #68ffba;
}

.copyright {
  color: #444;
  font-size: 0.8rem;
}
</style>
