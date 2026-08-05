<template>
  <!-- n-layout paints the themed background; a plain div would leak the white body through. -->
  <n-layout class="login-page">
    <div class="login-panel">
      <div class="login-brand">MIXPLA</div>
      <h1 class="login-title">{{ codeSent ? t('auth.code_title') : t('auth.email_title') }}</h1>
      <p class="login-subtitle">
        <template v-if="codeSent">{{ t('auth.code_subtitle', { email }) }}</template>
        <template v-else>{{ t('auth.email_subtitle') }}</template>
      </p>

      <form class="login-form" @submit.prevent="onSubmit">
        <n-input
          v-model:value="email"
          type="text"
          inputmode="email"
          autocomplete="email"
          size="large"
          autofocus
          :placeholder="t('auth.email_placeholder')"
          :disabled="loading"
          class="login-email-input"
          @update:value="onEmailInput"
        />
        <n-input
          v-model:value="code"
          type="text"
          inputmode="numeric"
          autocomplete="one-time-code"
          maxlength="6"
          size="large"
          :placeholder="t('auth.code_placeholder')"
          :disabled="loading || !codeSent || codeLocked"
          @update:value="onCodeInput"
        />
        <p class="login-error" :class="{ 'login-error--visible': !!error }">{{ error || ' ' }}</p>
        <GsapButton type="primary" :disabled="loading || !canSubmit" block>
          <span>{{ buttonLabel }}</span>
        </GsapButton>

        <div class="login-links" v-if="codeSent">
          <button type="button" class="login-link" :disabled="loading || resending" @click="onResend">
            {{ resending ? t('auth.sending') : t('auth.resend_code') }}
          </button>
        </div>
      </form>
    </div>
  </n-layout>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { NInput, NLayout } from 'naive-ui'
import GsapButton from '@/components/GsapButton.vue'
import authService, { AuthRequestError } from '@/services/auth'
import { useAuthStore } from '@/stores/auth'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

const codeSent = ref(false)
const email = ref('')
const code = ref('')
const error = ref('')
const loading = ref(false)
const resending = ref(false)
const failCount = ref(0)
const codeLocked = ref(false)

const canSubmit = computed(() =>
  codeSent.value ? code.value.trim().length === 6 && !codeLocked.value : !!email.value.trim()
)

const buttonLabel = computed(() => {
  if (codeSent.value) return loading.value ? t('auth.verifying') : t('auth.continue')
  return loading.value ? t('auth.sending') : t('auth.continue')
})

// Already signed in (e.g. back button onto /login) — go straight through.
onMounted(() => {
  if (authStore.isAuthenticated) void router.replace(redirectTarget())
})

/** Only same-origin absolute paths are honoured, so ?redirect= can't bounce elsewhere. */
function redirectTarget(): string {
  const fromQuery = route.query.redirect
  const raw = Array.isArray(fromQuery) ? fromQuery[0] : fromQuery
  if (typeof raw === 'string' && raw.startsWith('/') && !raw.startsWith('//')) return raw
  return authStore.loginRedirectUri || '/mixdeck'
}

function resetCodeStep() {
  code.value = ''
  failCount.value = 0
  codeLocked.value = false
  error.value = ''
}

function onEmailInput(value: string) {
  email.value = value
  error.value = ''
  // The pending code was requested for the previous address — it's void now.
  if (codeSent.value) {
    codeSent.value = false
    resetCodeStep()
  }
}

function onCodeInput(value: string) {
  code.value = value.replace(/\D/g, '').slice(0, 6)
  error.value = ''
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

function onSubmit() {
  if (codeSent.value) void onVerifyCode()
  else void onRequestCode()
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
    codeSent.value = true
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
    const target = redirectTarget()
    authStore.onLoginSuccess()
    await router.replace(target)
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

</script>

<style scoped>
.login-page {
  min-height: 100vh;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.login-panel {
  width: min(400px, 100%);
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

.login-email-input {
  margin-bottom: 10px;
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
  justify-content: flex-start;
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
