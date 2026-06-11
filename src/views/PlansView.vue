<template>
  <div>
    <PageHeader :title="t('plans.title')" :subtitle="t('plans.subtitle')">
      <template #actions>
        <GsapButton @click="router.back()"><span>{{ t('common.close') }}</span></GsapButton>
      </template>
    </PageHeader>

    <NSpin :show="subscriptionProductsStore.loading">
      <div v-if="cards.length" style="display: flex; gap: 24px; flex-wrap: wrap; align-items: stretch;">
        <NCard
          v-for="card in cards"
          :key="card.id"
          :style="card.subscribed ? 'flex: 1; min-width: 240px; max-width: 320px; border: 1px solid #7C3AED; display: flex; flex-direction: column;' : 'flex: 1; min-width: 240px; max-width: 320px; display: flex; flex-direction: column;'"
          content-style="display: flex; flex-direction: column; flex: 1;"
        >
          <div style="margin-bottom: 16px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <div style="font-size: 18px; font-weight: 700;">{{ card.name }}</div>
              <NTag v-if="card.subscribed" type="success" size="small" round>{{ t('plans.current') }}</NTag>
            </div>
            <div style="font-size: 28px; font-weight: 800; margin: 8px 0;">
              €{{ card.price }} <span style="font-size: 14px; font-weight: 400; opacity: 0.5;">/ mo</span>
            </div>
            <div style="font-size: 13px; opacity: 0.55;">{{ card.description }}</div>
          </div>
          <NDivider style="margin: 0 0 16px;" />
          <ul style="list-style: none; padding: 0; margin: 0 0 24px; display: flex; flex-direction: column; gap: 10px; font-size: 13px; flex: 1;">
            <li v-for="feature in card.features" :key="feature">✓ {{ feature }}</li>
          </ul>
          <GsapButton block :disabled="card.subscribed" :type="card.subscribed ? 'default' : 'primary'">
            <span>{{ card.subscribed ? t('plans.current') : t('plans.coming_soon') }}</span>
          </GsapButton>
        </NCard>
      </div>
      <NEmpty v-else :description="t('common.no_data')" />
    </NSpin>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { NCard, NDivider, NSpin, NEmpty, NTag } from 'naive-ui'
import GsapButton from '@/components/GsapButton.vue'
import PageHeader from '@/components/PageHeader.vue'
import { useSubscriptionProductsStore } from '@/stores/subscriptionProducts'

/** JSON inside each locale string of `localizedDescription` from the API */
interface PlanDescription {
  name?: string
  price?: number
  stations?: number
  listeners?: number
  storage_gb?: number
  bitrate_kbps?: number
  ai_dj?: string[]
  bulk_upload?: boolean
  priority_support?: boolean
  custom_integrations?: boolean
}

interface SubscriptionProductViewEntry {
  id: string
  identifier: string
  name: string
  description: string
  stripePriceId?: string
  stripeProductId?: string
  active?: boolean
  subscribed?: boolean
  subscriptionStatus?: string
}

const { t } = useI18n()
const router = useRouter()
const subscriptionProductsStore = useSubscriptionProductsStore()

function parseDescription(raw: string | undefined): PlanDescription {
  if (!raw || typeof raw !== 'string') return {}
  const trimmed = raw.trim()
  if (!trimmed) return {}
  try {
    return JSON.parse(trimmed) as PlanDescription
  } catch {
    return {}
  }
}

function valueOrUnlimited(value: number | undefined, unit: string): string {
  if (value === undefined) return '-'
  if (value < 0) return `Unlimited ${unit}`
  return `${value} ${unit}`
}

const cards = computed(() =>
  (subscriptionProductsStore.products as SubscriptionProductViewEntry[])
    .filter((entry) => entry.active !== false)
    .map((entry) => {
      const name = entry.name || entry.identifier
      const details = parseDescription(entry.description)
      const features: string[] = [
        valueOrUnlimited(details.stations, 'stations'),
        valueOrUnlimited(details.listeners, 'listeners'),
        details.storage_gb !== undefined ? `${details.storage_gb} GB storage` : '-',
        details.bitrate_kbps !== undefined ? `${details.bitrate_kbps} kbps bitrate` : '-',
      ]
      if (Array.isArray(details.ai_dj) && details.ai_dj.length > 0) features.push(`AI DJ: ${details.ai_dj.join(', ')}`)
      if (details.bulk_upload) features.push('Bulk upload')
      if (details.priority_support) features.push('Priority support')
      if (details.custom_integrations) features.push('Custom integrations')

      return {
        id: entry.id,
        identifier: entry.identifier,
        name,
        price: details.price ?? 0,
        description: details.name ?? '',
        features,
        subscribed: entry.subscribed ?? false,
        subscriptionStatus: entry.subscriptionStatus,
      }
    })
)

onMounted(async () => {
  await subscriptionProductsStore.loadProducts()
})
</script>
