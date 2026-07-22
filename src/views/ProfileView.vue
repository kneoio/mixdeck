<script setup lang="ts">
import { computed, onMounted, h, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import {
  NAvatar, NTag, NDescriptions, NDescriptionsItem,
  NCard, NSpace, NFlex, NDivider, NSelect
} from 'naive-ui'
import { useAuthStore } from '@/stores/auth'
import { useUserSubscriptionStore } from '@/stores/userSubscription'
import { useThemeStore } from '@/stores/theme'
import PageHeader from '@/components/PageHeader.vue'
import ActionBar from '@/components/ActionBar.vue'
import GsapButton from '@/components/GsapButton.vue'
import GsapSpin from '@/components/GsapSpin.vue'
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
              <component :is="renderStatusTag(userSubscriptionStore.subscriptionStatus, userSubscriptionStore.hasActiveSubscription)" />
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
