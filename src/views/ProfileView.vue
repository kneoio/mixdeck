<script setup lang="ts">
import { computed, onMounted, h, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import {
  NAvatar, NTag, NDescriptions, NDescriptionsItem,
  NCard, NSpace, NFlex, NDivider, NSelect, NInput, NPopconfirm, useMessage
} from 'naive-ui'
import { useAuthStore } from '@/stores/auth'
import { useUserSubscriptionStore } from '@/stores/userSubscription'
import { useThemeStore } from '@/stores/theme'
import PageHeader from '@/components/PageHeader.vue'
import ActionBar from '@/components/ActionBar.vue'
import GsapButton from '@/components/GsapButton.vue'
import GsapSpin from '@/components/GsapSpin.vue'
import authService, { passkeyErrorKind, type PasskeyCredential } from '@/services/auth'
import { LOCALE_LABELS, SUPPORTED_LOCALES, saveLocale, type SupportedLocale } from '@/i18n'

const appVersion = __APP_VERSION__
const { t, locale } = useI18n()
const router = useRouter()
const authStore = useAuthStore()
const userSubscriptionStore = useUserSubscriptionStore()
const themeStore = useThemeStore()

const message = useMessage()
const profile = computed(() => authStore.userProfile ?? {})

const passkeySupported = authService.supportsPasskeys()
const passkeys = ref<PasskeyCredential[]>([])
const passkeysLoading = ref(false)
const passkeyName = ref('')

async function loadPasskeys() {
  passkeysLoading.value = true
  try {
    passkeys.value = await authService.listPasskeys()
  } catch {
    passkeys.value = []
  } finally {
    passkeysLoading.value = false
  }
}

async function onAddPasskey() {
  passkeysLoading.value = true
  try {
    await authService.registerPasskey(passkeyName.value)
    passkeyName.value = ''
    message.success(t('profile.passkey_added'))
    await loadPasskeys()
  } catch (err) {
    const kind = passkeyErrorKind(err)
    if (kind === 'already_registered') message.warning(t('profile.passkey_already'))
    else if (kind !== 'cancelled') message.error(t('profile.passkey_failed'))
  } finally {
    passkeysLoading.value = false
  }
}

async function onRemovePasskey(id: number) {
  passkeysLoading.value = true
  try {
    await authService.removePasskey(id)
    message.success(t('profile.passkey_removed'))
    await loadPasskeys()
  } catch {
    message.error(t('profile.passkey_failed'))
    passkeysLoading.value = false
  }
}

function passkeyLastUsed(p: PasskeyCredential): string {
  return p.last_used_date
    ? t('profile.passkey_last_used', { date: new Date(p.last_used_date).toLocaleDateString(locale.value) })
    : t('profile.passkey_never_used')
}

const fullName = computed(() => {
  const f = profile.value.firstName || ''
  const l = profile.value.lastName || ''
  return [f, l].filter(Boolean).join(' ') || authStore.userName
})

const initials = computed(() => {
  const f = profile.value.firstName?.[0] || ''
  const l = profile.value.lastName?.[0] || ''
  return (f + l).toUpperCase() || authStore.userName.charAt(0).toUpperCase()
})

const localeOptions = SUPPORTED_LOCALES.map(code => ({
  label: LOCALE_LABELS[code],
  value: code,
}))

function onLocaleChange(val: SupportedLocale) {
  locale.value = val
  saveLocale(val)
}

function formatPlanName(raw: string | undefined): string {
  if (!raw) return '—'
  return raw.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function durationLabel(val: number | string): string {
  return val === 'infinitely' || val === 0 ? t('plans.feat_duration_nonstop') : `${val} ${t('plans.feat_min')}`
}

function renderCodecTag(codec: string) {
  const isMp3 = codec === 'MP3' || codec === 'mp3'
  const dark = themeStore.isDark
  const tagColor = isMp3
    ? { color: dark ? 'rgba(34,197,94,0.10)' : 'rgba(34,197,94,0.08)', textColor: dark ? '#22C55E' : '#16A34A', borderColor: 'rgba(34,197,94,0.40)' }
    : { color: dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)', textColor: dark ? 'rgba(255,255,255,0.65)' : 'rgba(0,0,0,0.65)', borderColor: dark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)' }
  return h(NTag, {
    size: 'small',
    bordered: true,
    color: tagColor,
  }, { default: () => codec.toUpperCase() })
}

function renderInfoTag(text: string) {
  const dark = themeStore.isDark
  const tagColor = { color: dark ? 'rgba(59,130,246,0.10)' : 'rgba(59,130,246,0.08)', textColor: dark ? '#3B82F6' : '#2563EB', borderColor: 'rgba(59,130,246,0.40)' }
  return h(NTag, {
    size: 'small',
    bordered: true,
    color: tagColor,
  }, { default: () => text })
}

function renderStatusTag(text: string, active: boolean) {
  const dark = themeStore.isDark
  const tagColor = active
    ? { color: dark ? 'rgba(34,197,94,0.10)' : 'rgba(34,197,94,0.08)', textColor: dark ? '#22C55E' : '#16A34A', borderColor: 'rgba(34,197,94,0.40)' }
    : { color: dark ? 'rgba(245,158,11,0.10)' : 'rgba(245,158,11,0.08)', textColor: dark ? '#F59E0B' : '#D97706', borderColor: 'rgba(245,158,11,0.40)' }
  return h(NTag, {
    size: 'small',
    bordered: true,
    color: tagColor,
  }, { default: () => text })
}

onMounted(async () => {
  if (passkeySupported) void loadPasskeys()
  try {
    await userSubscriptionStore.refresh()
  } catch {
    // server unavailable
  }
})

</script>

<template>
  <div>
    <PageHeader :title="t('profile.title')" :subtitle="t('profile.subtitle')" />

    <ActionBar>
      <GsapButton @click="router.push('/mixdeck')"><span>{{ t('common.close') }}</span></GsapButton>
    </ActionBar>

    <div style="max-width: 760px; display: flex; flex-direction: column; gap: 16px;">

      <!-- Identity -->
      <NCard>
        <NFlex align="center" :size="20" style="margin-bottom: 20px;">
          <NAvatar :size="72" round style="font-size: 28px; background: var(--vt-c-primary); color: #fff; flex-shrink: 0;">
            {{ initials }}
          </NAvatar>
          <div>
            <div style="font-size: 20px; font-weight: 600; line-height: 1.3;">{{ fullName }}</div>
            <div style="opacity: 0.55; font-size: 13px;">{{ authStore.userEmail }}</div>
          </div>
        </NFlex>

        <NDescriptions label-placement="left" :column="1" label-style="width: 160px; opacity: 0.55;">
          <NDescriptionsItem :label="t('profile.username')">{{ authStore.userName || '—' }}</NDescriptionsItem>
          <NDescriptionsItem :label="t('profile.email')">
            <NSpace :size="8" align="center">
              <span>{{ authStore.userEmail || '—' }}</span>
              <component :is="renderStatusTag(t('profile.verified'), true)" v-if="profile.emailVerified" />
            </NSpace>
          </NDescriptionsItem>
        </NDescriptions>
      </NCard>

      <!-- Passkeys -->
      <NCard v-if="passkeySupported" :title="t('profile.passkeys')">
        <p style="opacity: 0.55; font-size: 13px; margin: 0 0 12px;">{{ t('profile.passkeys_subtitle') }}</p>
        <GsapSpin :show="passkeysLoading">
          <div v-if="passkeys.length === 0" style="opacity: 0.55; font-size: 13px; margin-bottom: 16px;">
            {{ t('profile.passkeys_none') }}
          </div>
          <div v-else style="display: flex; flex-direction: column; gap: 10px; margin-bottom: 16px;">
            <NFlex v-for="p in passkeys" :key="p.id" align="center" justify="space-between">
              <div>
                <div>{{ p.name || t('profile.passkey_default_name') }}</div>
                <div style="opacity: 0.55; font-size: 12px;">{{ passkeyLastUsed(p) }}</div>
              </div>
              <NPopconfirm @positive-click="onRemovePasskey(p.id)">
                <template #trigger>
                  <GsapButton><span>{{ t('profile.passkey_remove') }}</span></GsapButton>
                </template>
                {{ t('profile.passkey_remove_confirm') }}
              </NPopconfirm>
            </NFlex>
          </div>
          <NSpace :size="12" align="center">
            <NInput
              v-model:value="passkeyName"
              :placeholder="t('profile.passkey_name_placeholder')"
              maxlength="255"
              style="width: 220px;"
            />
            <GsapButton type="primary" @click="onAddPasskey">
              <span>{{ t('profile.passkey_add') }}</span>
            </GsapButton>
          </NSpace>
        </GsapSpin>
      </NCard>

      <!-- Language -->
      <NCard :title="t('profile.language')">
        <p style="opacity: 0.55; font-size: 13px; margin: 0 0 12px;">{{ t('profile.language_subtitle') }}</p>
        <NSelect
          :value="locale"
          :options="localeOptions"
          style="width: 200px;"
          @update:value="onLocaleChange"
        />
      </NCard>

      <!-- Subscription -->
      <NCard :title="t('profile.subscription')">
        <GsapSpin :show="userSubscriptionStore.loading">

          <NDescriptions
            v-if="userSubscriptionStore.subscription"
            label-placement="left"
            :column="1"
            label-style="width: 180px; opacity: 0.55;"
            style="margin-bottom: 20px;"
          >
            <NDescriptionsItem :label="t('profile.plan')">
              <component :is="renderInfoTag(formatPlanName(userSubscriptionStore.subscriptionType))" />
            </NDescriptionsItem>
            <NDescriptionsItem :label="t('profile.status')">
              <component :is="renderStatusTag(userSubscriptionStore.subscriptionStatus ?? '', userSubscriptionStore.hasActiveSubscription)" />
            </NDescriptionsItem>
          </NDescriptions>

          <div v-else style="margin-bottom: 20px;">
            <NTag type="default" size="small" round>{{ t('profile.free') }}</NTag>
            <p style="opacity: 0.55; font-size: 13px; margin: 8px 0 0;">{{ t('profile.free_plan_desc') }}</p>
          </div>

          <NDivider style="margin: 0 0 16px;" />

          <NSpace :size="12">
            <GsapButton type="primary" @click="router.push('/plans')">
              <span>{{ t('profile.manage_plan') }}</span>
            </GsapButton>
          </NSpace>

        </GsapSpin>
      </NCard>

      <!-- About -->
      <NCard :title="t('profile.about_title')">
        <NDescriptions label-placement="left" :column="1" label-style="width: 160px; opacity: 0.55;">
          <NDescriptionsItem :label="t('profile.version')">
            <NTag type="default" size="small" round>v{{ appVersion }}</NTag>
          </NDescriptionsItem>
        </NDescriptions>
      </NCard>

    </div>
  </div>
</template>
