<template>
  <n-modal
    :show="show"
    :mask-closable="false"
    :close-on-esc="false"
    :closable="false"
    :auto-focus="true"
    transform-origin="center"
    style="width: min(400px, 92vw)"
  >
    <n-card :bordered="false" size="large" role="dialog" aria-modal="true" class="login-card">
      <div class="login-brand">MIXPLA</div>
      <h2 class="login-title">{{ step === 'email' ? t('auth.email_title') : t('auth.code_title') }}</h2>
      <p class="login-subtitle">
        <template v-if="step === 'email'">{{ t('auth.email_subtitle') }}</template>
        <template v-else>{{ t('auth.code_subtitle', { email }) }}</template>
      </p>

      <form v-if="step === 'email'" class="login-form" @submit.prevent="onRequestCode">
        <n-input
          v-model:value="email"
          type="text"
          inputmode="email"
          autocomplete="email"
          size="large"
          :placeholder="t('auth.email_placeholder')"
          :disabled="loading"
          @update:value="clearError"
        />
        <p class="login-error" :class="{ 'login-error--visible': !!error }">{{ error || ' ' }}</p>
        <GsapButton type="primary" :disabled="loading || !email.trim()" block>
          <span>{{ loading ? t('auth.sending') : t('auth.continue') }}</span>
        </GsapButton>
      </form>

      <form v-else class="login-form" @submit.prevent="onVerifyCode">
        <n-input
          v-model:value="code"
          type="text"
          inputmode="numeric"
          autocomplete="one-time-code"
          maxlength="6"
          size="large"
          :placeholder="t('auth.code_placeholder')"
          :disabled="loading || codeLocked"
          @update:value="onCodeInput"
        />
        <p class="login-error" :class="{ 'login-error--visible': !!error }">{{ error || ' ' }}</p>
        <GsapButton
          type="primary"
          :disabled="loading || codeLocked || code.trim().length !== 6"
          block
        >
          <span>{{ loading ? t('auth.verifying') : t('auth.continue') }}</span>
        </GsapButton>

        <div class="login-links">
          <button type="button" class="login-link" :disabled="loading || resending" @click="onResend">
            {{ resending ? t('auth.sending') : t('auth.resend_code') }}
          </button>
          <button type="button" class="login-link" :disabled="loading || resending" @click="goBack">
            {{ t('auth.change_email') }}
          </button>
        </div>
      </form>
    </n-card>
  </n-modal>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { NModal, NCard, NInput } from 'naive-ui'
import GsapButton from '@/components/GsapButton.vue'
import authService, { AuthRequestError } from '@/services/auth'
import { useAuthStore } from '@/stores/auth'

const props = defineProps<{ show: boolean }>()

const { t } = useI18n()
const router = useRouter()
const authStore = useAuthStore()

const step = ref<'email' | 'code'>('email')
const email = ref('')
const code = ref('')
const error = ref('')
const loading = ref(false)
const resending = ref(false)
const failCount = ref(0)
const codeLocked = ref(false)

function clearError() {
  error.value = ''
}

function resetCodeStep() {
  code.value = ''
  failCount.value = 0
  codeLocked.value = false
  error.value = ''
}

function resetAll() {
  step.value = 'email'
  email.value = ''
  resetCodeStep()
  loading.value = false
  resending.value = false
}

watch(
  () => props.show,
  (visible) => {
    if (visible) resetAll()
  }
)

function onCodeInput(value: string) {
  code.value = value.replace(/\D/g, '').slice(0, 6)
  clearError()
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function genericRequestError(err: unknown): string {
  if (err instanceof AuthRequestError) {
    if (err.status === 400) return t('auth.error_email')
    return t('auth.error_send_failed')
  }
  return t('auth.error_send_failed')
}

async function onRequestCode() {
  const trimmed = email.value.trim()
  if (!isValidEmail(trimmed)) {
    error.value = t('auth.error_email')
    return
  }

  loading.value = true
  error.value = ''
  try {
    email.value = trimmed
    await authService.requestOtp(trimmed)
    resetCodeStep()
    step.value = 'code'
  } catch (err) {
    error.value = genericRequestError(err)
  } finally {
    loading.value = false
  }
}

async function onVerifyCode() {
  if (codeLocked.value) return
  const otp = code.value.trim()
  if (otp.length !== 6) {
    error.value = t('auth.error_code_invalid')
    return
  }

  loading.value = true
  error.value = ''
  try {
    await authService.verifyOtp(email.value.trim(), otp)
    const target = authStore.onLoginSuccess()
    await router.replace(target || '/mixdeck')
  } catch {
    failCount.value += 1
    // Never retry the same code — clear the field after any failure.
    code.value = ''
    if (failCount.value >= authService.maxOtpFailures) {
      codeLocked.value = true
      error.value = t('auth.error_code_exhausted')
    } else {
      error.value = t('auth.error_code_invalid')
    }
  } finally {
    loading.value = false
  }
}

async function onResend() {
  resending.value = true
  error.value = ''
  try {
    await authService.requestOtp(email.value.trim())
    resetCodeStep()
  } catch (err) {
    error.value = genericRequestError(err)
  } finally {
    resending.value = false
  }
}

function goBack() {
  step.value = 'email'
  resetCodeStep()
}
</script>

<style scoped>
.login-card {
  border-radius: 12px;
}

.login-brand {
  font-family: 'Oxanium', sans-serif;
  font-weight: 700;
  font-size: 13px;
  letter-spacing: 0.14em;
  opacity: 0.55;
  margin-bottom: 18px;
}

.login-title {
  margin: 0 0 8px;
  font-size: 22px;
  font-weight: 650;
  line-height: 1.25;
}

.login-subtitle {
  margin: 0 0 22px;
  font-size: 14px;
  line-height: 1.45;
  opacity: 0.65;
  word-break: break-word;
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.login-error {
  min-height: 1.35em;
  margin: 2px 0 10px;
  font-size: 13px;
  color: #ff2d95;
  opacity: 0;
}

.login-error--visible {
  opacity: 1;
}

.login-links {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin-top: 14px;
}

.login-link {
  background: none;
  border: none;
  padding: 0;
  font: inherit;
  font-size: 13px;
  color: inherit;
  opacity: 0.65;
  cursor: pointer;
  text-decoration: underline;
  text-underline-offset: 2px;
}

.login-link:hover:not(:disabled) {
  opacity: 1;
}

.login-link:disabled {
  opacity: 0.35;
  cursor: default;
}
</style>
