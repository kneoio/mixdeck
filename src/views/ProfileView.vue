<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import {
  NAvatar, NTag, NDescriptions, NDescriptionsItem,
  NCard, NSpace, NFlex, NDivider, NSelect, NSpin
} from 'naive-ui'
import { useAuthStore } from '@/stores/auth'
import { useUserSubscriptionStore } from '@/stores/userSubscription'
import PageHeader from '@/components/PageHeader.vue'
import GsapButton from '@/components/GsapButton.vue'
import { LOCALE_LABELS, SUPPORTED_LOCALES, saveLocale, type SupportedLocale } from '@/i18n'

const { t, locale } = useI18n()
const router = useRouter()
const authStore = useAuthStore()
const userSubscriptionStore = useUserSubscriptionStore()

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
            <NDescriptionsItem label="Plan">
              <NTag type="info" size="small" round>{{ formatPlanName(userSubscriptionStore.subscriptionType) }}</NTag>
            </NDescriptionsItem>
            <NDescriptionsItem label="Status">
              <NTag :type="userSubscriptionStore.hasActiveSubscription ? 'success' : 'warning'" size="small" round>
                {{ userSubscriptionStore.subscriptionStatus }}
              </NTag>
            </NDescriptionsItem>
            <NDescriptionsItem label="Max Songs">{{ userSubscriptionStore.maxSongs?.toLocaleString() ?? '—' }}</NDescriptionsItem>
            <NDescriptionsItem label="Stream Quality">{{ userSubscriptionStore.streamQualityKbps != null ? `${userSubscriptionStore.streamQualityKbps} kbps (opus)` : '—' }}</NDescriptionsItem>
            <NDescriptionsItem label="Stream Duration">{{ durationLabel(userSubscriptionStore.streamDurationMinutes ?? 0) }}</NDescriptionsItem>
            <NDescriptionsItem label="OTS Allowed">{{ userSubscriptionStore.otsAllowed ? 'Yes' : 'No' }}</NDescriptionsItem>
            <NDescriptionsItem label="Custom Script">{{ userSubscriptionStore.customScriptAllowed ? 'Yes' : 'No' }}</NDescriptionsItem>
            <NDescriptionsItem v-if="userSubscriptionStore.codecs.length" label="Codecs">{{ userSubscriptionStore.codecs.join(', ') }}</NDescriptionsItem>
          </NDescriptions>

          <NDivider v-if="userSubscriptionStore.subscription" style="margin: 0 0 16px;" />

          <GsapButton type="primary" @click="router.push('/plans')">
            <span>{{ t('profile.upgrade') }}</span>
          </GsapButton>

        </NSpin>
      </NCard>

      <!-- About -->
      <NCard title="About Mixdeck">
        <NDescriptions label-placement="left" :column="1" label-style="width: 160px; opacity: 0.55;">
          <NDescriptionsItem label="Version">
            <NTag type="default" size="small" round>v0.0.1</NTag>
          </NDescriptionsItem>
        </NDescriptions>
      </NCard>

    </div>
  </div>
</template>
