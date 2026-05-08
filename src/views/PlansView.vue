<template>
  <div>
    <PageHeader :title="t('plans.title')" :subtitle="t('plans.subtitle')">
      <template #actions>
        <NButton @click="router.back()">{{ t('common.close') }}</NButton>
      </template>
    </PageHeader>

    <NSpin :show="subscriptionProductsStore.loading">
      <div v-if="cards.length" style="display: flex; gap: 24px; flex-wrap: wrap; align-items: flex-start;">
        <NCard
          v-for="card in cards"
          :key="card.id"
          :style="card.identifier.includes('plus')
            ? 'flex: 1; min-width: 240px; max-width: 320px; border: 1.5px solid #7C3AED;'
            : 'flex: 1; min-width: 240px; max-width: 320px;'"
        >
          <div style="margin-bottom: 16px;">
            <NFlex align="center" justify="space-between">
              <div style="font-size: 18px; font-weight: 700;">{{ card.name }}</div>
              <NTag v-if="card.identifier.includes('plus')" type="info" size="small" round>
                {{ t('plans.popular') }}
              </NTag>
            </NFlex>
            <div style="font-size: 28px; font-weight: 800; margin: 8px 0;">
              €{{ card.price }} <span style="font-size: 14px; font-weight: 400; opacity: 0.5;">/ mo</span>
            </div>
            <div style="font-size: 13px; opacity: 0.55;">{{ card.description }}</div>
          </div>
          <NDivider style="margin: 0 0 16px;" />
          <ul style="list-style: none; padding: 0; margin: 0 0 24px; display: flex; flex-direction: column; gap: 10px; font-size: 13px;">
            <li v-for="feature in card.features" :key="feature">✓ {{ feature }}</li>
          </ul>
          <NButton
            block
            :disabled="card.price === 0"
            :type="card.identifier.includes('plus') ? 'primary' : 'default'"
            :style="card.identifier.includes('plus') ? 'background: #7C3AED; border-color: #7C3AED;' : undefined"
          >
            {{ getActionLabel(card.identifier, card.price) }}
          </NButton>
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
import { NCard, NButton, NTag, NDivider, NFlex, NSpin, NEmpty } from 'naive-ui'
import PageHeader from '@/components/PageHeader.vue'
import { useSubscriptionProductsStore } from '@/stores/subscriptionProducts'

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

const { t, locale } = useI18n()
const router = useRouter()
const subscriptionProductsStore = useSubscriptionProductsStore()

function parseDescription(raw: string | undefined): PlanDescription {
  if (!raw) return {}
  try {
    return JSON.parse(raw) as PlanDescription
  } catch {
    return {}
  }
}

function valueOrUnlimited(value: number | undefined, unit: string): string {
  if (value === undefined) return '-'
  if (value < 0) return `Unlimited ${unit}`
  return `${value} ${unit}`
}

function getActionLabel(identifier: string, price: number): string {
  if (price === 0) return t('plans.current')
  if (identifier.includes('plus')) return t('plans.upgrade_plus')
  if (identifier.includes('premium')) return t('plans.upgrade_premium')
  return t('plans.current')
}

const cards = computed(() =>
  subscriptionProductsStore.products
    .filter((entry) => entry.active !== false)
    .map((entry) => {
      const selectedLocale = locale.value || 'en'
      const name = entry.localizedName?.[selectedLocale] ?? entry.localizedName?.en ?? entry.identifier
      const rawDescription = entry.localizedDescription?.[selectedLocale] ?? entry.localizedDescription?.en
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
