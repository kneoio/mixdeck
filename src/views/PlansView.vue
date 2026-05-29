<template>
  <div>
    <PageHeader :title="t('plans.title')" :subtitle="t('plans.subtitle')">
      <template #actions>
        <GsapButton @click="router.back()"><span>{{ t('common.close') }}</span></GsapButton>
      </template>
    </PageHeader>

<NSpin :show="subscriptionProductsStore.loading">
      <div v-if="cards.length" style="display: flex; gap: 24px; flex-wrap: wrap; align-items: flex-start;">
        <NCard
          v-for="card in cards"
          :key="card.id"
          style="flex: 1; min-width: 240px; max-width: 320px;"
        >
          <div style="margin-bottom: 16px;">
            <div style="font-size: 18px; font-weight: 700;">{{ card.name }}</div>
            <div style="font-size: 28px; font-weight: 800; margin: 8px 0;">
              €{{ card.price }} <span style="font-size: 14px; font-weight: 400; opacity: 0.5;">/ mo</span>
            </div>
            <div style="font-size: 13px; opacity: 0.55;">{{ card.description }}</div>
          </div>
          <NDivider style="margin: 0 0 16px;" />
          <ul style="list-style: none; padding: 0; margin: 0 0 24px; display: flex; flex-direction: column; gap: 10px; font-size: 13px;">
            <li v-for="feature in card.features" :key="feature">✓ {{ feature }}</li>
          </ul>
          <GsapButton block disabled>
            <span>{{ card.price === 0 ? t('plans.current') : t('plans.coming_soon') }}</span>
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
import { NCard, NDivider, NSpin, NEmpty } from 'naive-ui'
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

/** One row from `payload.viewData.entries` for subscription products */
interface SubscriptionProductViewEntry {
  id: string
  identifier: string
  localizedName: Record<string, string>
  localizedDescription: Record<string, string>
  stripePriceId?: string
  stripeProductId?: string
  active?: boolean
  author?: string
  regDate?: string
  lastModifier?: string
  lastModifiedDate?: string
}

const { t, locale } = useI18n()
const router = useRouter()
const subscriptionProductsStore = useSubscriptionProductsStore()

function pickLocalized(map: Record<string, string> | undefined, locale: string): string | undefined {
  if (!map || typeof map !== 'object') return undefined
  if (map[locale]) return map[locale]
  const short = locale.split('-')[0]
  if (short !== locale && map[short]) return map[short]
  if (map.en) return map.en
  const values = Object.values(map)
  return values[0]
}

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

function getActionLabel(price: number): string {
  if (price === 0) return t('plans.current')
  return t('plans.subscribe')
}

const cards = computed(() =>
  (subscriptionProductsStore.products as SubscriptionProductViewEntry[])
    .filter((entry) => entry.active !== false)
    .map((entry) => {
      const selectedLocale = locale.value || 'en'
      const name =
        pickLocalized(entry.localizedName, selectedLocale) ?? entry.identifier
      const rawDescription = pickLocalized(entry.localizedDescription, selectedLocale)
      const details = parseDescription(rawDescription)
      const features: string[] = [
        `${valueOrUnlimited(details.stations, 'stations')}`,
        `${valueOrUnlimited(details.listeners, 'receive listeners')}`,
        details.storage_gb !== undefined ? `${details.storage_gb} GB storage` : '-',
        details.bitrate_kbps !== undefined ? `${details.bitrate_kbps} kbps bitrate` : '-',
      ]

      if (Array.isArray(details.ai_dj) && details.ai_dj.length > 0) {
        features.push(`AI DJ: ${details.ai_dj.join(', ')}`)
      }
      if (details.bulk_upload) {
        features.push('Bulk upload')
      }
      if (details.priority_support) {
        features.push('Priority support')
      }
      if (details.custom_integrations) {
        features.push('Custom integrations')
      }

      return {
        id: entry.id,
        identifier: entry.identifier,
        name,
        price: details.price ?? 0,
        description: details.name ?? '',
        features,
      }
    })
)

onMounted(async () => {
  await subscriptionProductsStore.loadProducts()
})
</script>
