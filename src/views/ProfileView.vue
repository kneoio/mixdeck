<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  NAvatar, NTag, NDescriptions, NDescriptionsItem,
  NCard, NSpace, NFlex, NDivider, NSelect, NSpin
} from 'naive-ui'
import { useAuthStore } from '@/stores/auth'
import { useSubscriptionProductsStore } from '@/stores/subscriptionProducts'
import { useUserSubscriptionStore } from '@/stores/userSubscription'
import PageHeader from '@/components/PageHeader.vue'
import GsapButton from '@/components/GsapButton.vue'
import { LOCALE_LABELS, SUPPORTED_LOCALES, saveLocale, type SupportedLocale } from '@/i18n'

const { t, locale } = useI18n()
const authStore = useAuthStore()
const subscriptionProductsStore = useSubscriptionProductsStore()
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

function parseDescription(raw: string | undefined): Record<string, any> {
  if (!raw) return {}
  try { return JSON.parse(raw) } catch { return {} }
}

function qualityLabel(kbps: number | string): string {
  const map: Record<number, string> = { 64: t('brandForm.stream_quality_good'), 96: t('brandForm.stream_quality_great'), 128: t('brandForm.stream_quality_best') }
  return String(kbps).split(',').map(v => map[Number(v.trim())] ?? `${v.trim()} ${t('plans.feat_kbps')}`).join(', ')
}

function durationLabel(val: number | string): string {
  return val === 'infinitely' || val === 0 ? t('plans.feat_duration_nonstop') : `${val} ${t('plans.feat_min')}`
}


const currentPrice = computed(() => {
  const subscribed = subscriptionProductsStore.products.find(p => p.subscribed)
  if (!subscribed) return 0
  return parseDescription(subscribed.description).price ?? 0
})

const planCards = computed(() =>
  subscriptionProductsStore.products
    .filter(p => p.active !== false)
    .map(p => {
      const details = parseDescription(p.description)
      const price = details.price ?? 0
      const features: string[] = []
      if (details.maxStations != null) features.push(`${t('plans.feat_max_stations')}: ${details.maxStations}`)
      if (details.maxSongs != null) features.push(`${t('plans.feat_max_songs')}: ${details.maxSongs.toLocaleString()}`)
      if (details.djTypeId) features.push(`${t('plans.feat_dj_types')}: ${details.djTypeId}`)
      if (details.streamQualityKbps != null) features.push(`${t('plans.feat_stream_quality')}: ${qualityLabel(details.streamQualityKbps)}`)
      if (details.streamDurationMinutes != null) features.push(`${t('plans.feat_stream_duration')}: ${durationLabel(details.streamDurationMinutes)}`)
      if (details.otsAllowed) features.push(t('plans.feat_ots'))
      if (details.bulkUploadAllowed) features.push(t('plans.feat_bulk_upload'))
      if (details.customScriptAllowed) features.push(t('plans.feat_custom_script'))
      const subscribed = p.subscribed ?? false
      const label = subscribed ? t('plans.current') : price > currentPrice.value ? t('profile.upgrade') : t('profile.downgrade')
      return { id: p.id, name: p.name, price, description: details.name ?? '', features, subscribed, label }
    })
)

onMounted(async () => {
  try {
    await Promise.all([
      subscriptionProductsStore.loadProducts(),
      userSubscriptionStore.loadCurrentSubscription(),
    ])
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
        <NSpin :show="subscriptionProductsStore.loading || userSubscriptionStore.loading">

          <!-- Current subscription details -->
          <NDescriptions
            v-if="userSubscriptionStore.subscription"
            label-placement="left"
            :column="1"
            label-style="width: 180px; opacity: 0.55;"
            style="margin-bottom: 20px;"
          >
            <NDescriptionsItem label="Plan">
              <NTag type="info" size="small" round>{{ userSubscriptionStore.subscriptionType }}</NTag>
            </NDescriptionsItem>
            <NDescriptionsItem label="Status">
              <NTag :type="userSubscriptionStore.hasActiveSubscription ? 'success' : 'warning'" size="small" round>
                {{ userSubscriptionStore.subscriptionStatus }}
              </NTag>
            </NDescriptionsItem>
            <NDescriptionsItem label="Max Songs">{{ userSubscriptionStore.maxSongs?.toLocaleString() ?? '—' }}</NDescriptionsItem>
            <NDescriptionsItem label="Stream Quality">{{ userSubscriptionStore.streamQualityKbps != null ? `${userSubscriptionStore.streamQualityKbps} kbps` : '—' }}</NDescriptionsItem>
            <NDescriptionsItem label="Stream Duration">{{ durationLabel(userSubscriptionStore.streamDurationMinutes ?? 0) }}</NDescriptionsItem>
            <NDescriptionsItem label="OTS Allowed">{{ userSubscriptionStore.otsAllowed ? 'Yes' : 'No' }}</NDescriptionsItem>
            <NDescriptionsItem label="Custom Script">{{ userSubscriptionStore.customScriptAllowed ? 'Yes' : 'No' }}</NDescriptionsItem>
            <NDescriptionsItem label="Support Level">{{ userSubscriptionStore.supportLevel }}</NDescriptionsItem>
            <NDescriptionsItem v-if="userSubscriptionStore.codecs.length" label="Codecs">{{ userSubscriptionStore.codecs.join(', ') }}</NDescriptionsItem>
          </NDescriptions>

          <NDivider v-if="userSubscriptionStore.subscription" style="margin: 0 0 20px;" />

        </NSpin>

        <NSpin :show="subscriptionProductsStore.loading">

          <!-- Plan cards -->
          <div v-if="planCards.length" style="display: flex; gap: 16px; flex-wrap: wrap; align-items: stretch;">
            <NCard
              v-for="card in planCards"
              :key="card.id"
              :style="card.subscribed
                ? 'flex: 1; min-width: 180px; border: 1px solid #C2185B; display: flex; flex-direction: column;'
                : 'flex: 1; min-width: 180px; display: flex; flex-direction: column;'"
              content-style="display: flex; flex-direction: column; flex: 1;"
            >
              <div style="margin-bottom: 12px;">
                <NFlex align="center" :size="8" style="margin-bottom: 4px;">
                  <div style="font-size: 15px; font-weight: 700;">{{ card.name }}</div>
                  <NTag v-if="card.subscribed" type="success" size="small" round>{{ t('plans.current') }}</NTag>
                </NFlex>
                <div style="font-size: 22px; font-weight: 800;">
                  €{{ card.price }} <span style="font-size: 12px; font-weight: 400; opacity: 0.5;">/ mo</span>
                </div>
                <div style="font-size: 12px; opacity: 0.55;">{{ card.description }}</div>
              </div>
              <NDivider style="margin: 0 0 12px;" />
              <ul style="list-style: none; padding: 0; margin: 0 0 16px; display: flex; flex-direction: column; gap: 6px; font-size: 12px; flex: 1;">
                <li v-for="feature in card.features" :key="feature">✓ {{ feature }}</li>
              </ul>
              <GsapButton block :disabled="card.subscribed" :type="card.subscribed ? 'default' : 'primary'">
                <span>{{ card.label }}</span>
              </GsapButton>
            </NCard>
          </div>

          <template v-else-if="!subscriptionProductsStore.loading">
            <div style="opacity: 0.55; font-size: 13px;">{{ t('profile.free_plan') }}</div>
          </template>

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
