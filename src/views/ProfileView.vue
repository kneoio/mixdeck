<script setup lang="ts">
import { computed, onMounted, h } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import {
  NAvatar, NTag, NDescriptions, NDescriptionsItem,
  NCard, NSpace, NFlex, NDivider, NSelect, NSpin
} from 'naive-ui'
import { useAuthStore } from '@/stores/auth'
import { useUserSubscriptionStore } from '@/stores/userSubscription'
import { useThemeStore } from '@/stores/theme'
import PageHeader from '@/components/PageHeader.vue'
import GsapButton from '@/components/GsapButton.vue'
import { LOCALE_LABELS, SUPPORTED_LOCALES, saveLocale, type SupportedLocale } from '@/i18n'

const appVersion = __APP_VERSION__
const { t, locale } = useI18n()
const router = useRouter()
const authStore = useAuthStore()
const userSubscriptionStore = useUserSubscriptionStore()
const themeStore = useThemeStore()

const profile = computed(() => authStore.userProfile ?? {})

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

const memberSince = computed(() => {
  const ts = profile.value.createdTimestamp
  if (!ts) return '—'
  return new Date(ts).toLocaleDateString(locale.value, { year: 'numeric', month: 'long', day: 'numeric' })
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

onMounted(async () => {
  try {
    await userSubscriptionStore.loadCurrentSubscription()
  } catch {
    // server unavailable
  }
})
</script>

<template>
  <div>
    <PageHeader :title="t('profile.title')" :subtitle="t('profile.subtitle')" />

    <div style="max-width: 760px; display: flex; flex-direction: column; gap: 16px;">

      <!-- Identity -->
      <NCard>
        <NFlex align="center" :size="20" style="margin-bottom: 20px;">
          <NAvatar :size="72" round style="font-size: 28px; background: #7C3AED; color: #fff; flex-shrink: 0;">
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
              <NTag v-if="profile.emailVerified" type="success" size="small" round>
                {{ t('profile.verified') }}
              </NTag>
            </NSpace>
          </NDescriptionsItem>
          <NDescriptionsItem :label="t('profile.member_since')">{{ memberSince }}</NDescriptionsItem>
        </NDescriptions>
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
        <NSpin :show="userSubscriptionStore.loading">

          <NDescriptions
            v-if="userSubscriptionStore.subscription"
            label-placement="left"
            :column="1"
            label-style="width: 180px; opacity: 0.55;"
            style="margin-bottom: 20px;"
          >
            <NDescriptionsItem :label="t('profile.plan')">
              <NTag type="info" size="small" round>{{ formatPlanName(userSubscriptionStore.subscriptionType) }}</NTag>
            </NDescriptionsItem>
            <NDescriptionsItem :label="t('profile.status')">
              <NTag :type="userSubscriptionStore.hasActiveSubscription ? 'success' : 'warning'" size="small" round>
                {{ userSubscriptionStore.subscriptionStatus }}
              </NTag>
            </NDescriptionsItem>
            <NDescriptionsItem :label="t('profile.max_songs')">{{ userSubscriptionStore.maxSongs?.toLocaleString() ?? '—' }}</NDescriptionsItem>
            <NDescriptionsItem :label="t('profile.stream_quality')">{{ userSubscriptionStore.streamQualityKbps != null ? `${userSubscriptionStore.streamQualityKbps} kbps (opus)` : '—' }}</NDescriptionsItem>
            <NDescriptionsItem :label="t('profile.stream_duration')">{{ durationLabel(userSubscriptionStore.streamDurationMinutes ?? 0) }}</NDescriptionsItem>
            <NDescriptionsItem :label="t('profile.custom_script')">{{ userSubscriptionStore.customScriptAllowed ? t('profile.yes') : t('profile.no') }}</NDescriptionsItem>
            <NDescriptionsItem v-if="userSubscriptionStore.codecs.length" :label="t('profile.codecs')">
              <NSpace :size="6">
                <component :is="renderCodecTag(codec)" v-for="codec in userSubscriptionStore.codecs" :key="codec" />
              </NSpace>
            </NDescriptionsItem>
            <NDescriptionsItem v-if="userSubscriptionStore.djType.length" :label="t('profile.dj_type')">{{ userSubscriptionStore.djType.join(', ') }}</NDescriptionsItem>
          </NDescriptions>

          <NDivider v-if="userSubscriptionStore.subscription" style="margin: 0 0 16px;" />

          <GsapButton type="primary" @click="router.push('/plans')">
            <span>{{ t('profile.upgrade') }}</span>
          </GsapButton>

        </NSpin>
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
