<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import {
  NAvatar, NButton, NTag, NDescriptions, NDescriptionsItem,
  NCard, NSpace, NFlex, NDivider, NSelect
} from 'naive-ui'
import { useAuthStore } from '@/stores/auth'
import PageHeader from '@/components/PageHeader.vue'
import { LOCALE_LABELS, SUPPORTED_LOCALES, saveLocale, type SupportedLocale } from '@/i18n'

const { t, locale } = useI18n()
const authStore = useAuthStore()
const router = useRouter()

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
          <NDescriptionsItem :label="t('profile.first_name')">{{ profile.firstName || '—' }}</NDescriptionsItem>
          <NDescriptionsItem :label="t('profile.last_name')">{{ profile.lastName || '—' }}</NDescriptionsItem>
          <NDescriptionsItem :label="t('profile.email')">
            <NSpace :size="8" align="center">
              <span>{{ authStore.userEmail || '—' }}</span>
              <NTag
                :type="profile.emailVerified ? 'success' : 'warning'"
                size="small"
                round
              >
                {{ profile.emailVerified ? t('profile.verified') : t('profile.unverified') }}
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
        <NFlex justify="space-between" align="center" style="margin-bottom: 16px;">
          <div>
            <div style="font-size: 16px; font-weight: 600;">{{ t('profile.free_plan') }}</div>
            <div style="opacity: 0.55; font-size: 13px; margin-top: 2px;">{{ t('profile.free_plan_desc') }}</div>
          </div>
          <NTag type="default" size="medium" round>{{ t('profile.free') }}</NTag>
        </NFlex>

        <NDivider style="margin: 0 0 16px;" />

        <NDescriptions label-placement="left" :column="1" label-style="width: 180px; opacity: 0.55;">
          <NDescriptionsItem :label="t('profile.brands')">1 / 1</NDescriptionsItem>
          <NDescriptionsItem :label="t('profile.listeners_quota')">0 / 100</NDescriptionsItem>
          <NDescriptionsItem :label="t('profile.storage')">0 / 2 GB</NDescriptionsItem>
          <NDescriptionsItem :label="t('profile.bulk_upload')">
            <NTag type="success" size="small" round>{{ t('profile.enabled') }}</NTag>
          </NDescriptionsItem>
          <NDescriptionsItem :label="t('profile.ai_dj')">{{ t('profile.ai_dj_free') }}</NDescriptionsItem>
        </NDescriptions>

        <NDivider style="margin: 16px 0;" />

        <NButton type="primary" style="background: #7C3AED; border-color: #7C3AED;" @click="router.push('/plans')">
          {{ t('profile.upgrade') }}
        </NButton>
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
