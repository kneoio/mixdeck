<template>
  <div>
    <PageHeader :title="t('plans.title')" :subtitle="t('plans.subtitle')" />

    <ActionBar>
      <GsapButton @click="router.push('/profile')"><span>{{ t('common.close') }}</span></GsapButton>
    </ActionBar>

    <GsapSpin :show="subscriptionProductsStore.loading">
      <div v-if="cards.length" style="display: flex; gap: 24px; flex-wrap: wrap; align-items: stretch;">
        <NCard
          v-for="card in cards"
          :key="card.id"
          :class="{ 'plan-glow': card.id === justUpgradedId }"
          :style="card.subscribed ? 'flex: 1; min-width: 240px; max-width: 320px; border: 1px solid var(--vt-c-primary); display: flex; flex-direction: column;' : 'flex: 1; min-width: 240px; max-width: 320px; display: flex; flex-direction: column;'"
          content-style="display: flex; flex-direction: column; flex: 1;"
        >
          <div style="margin-bottom: 16px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <div style="font-size: 18px; font-weight: 700;">{{ card.name }}</div>
              <NTag v-if="card.subscribed" class="current-plan-badge" :class="{ 'plan-glow-badge': card.id === justUpgradedId }" type="success" size="small">{{ t('plans.current') }}</NTag>
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
          <div v-if="!card.subscribed && card.identifier === PRO_IDENTIFIER" style="margin-top: -8px; margin-bottom: 16px; display: flex; gap: 16px;">
            <NInput v-model:value="promoCode" size="small" clearable :placeholder="t('plans.promo_placeholder')" @keyup.enter="redeemPromo" />
            <GsapButton type="error" size="small" :disabled="!promoCode || redeeming" @click="redeemPromo">
              <span>{{ redeeming ? t('plans.processing') : t('plans.promo_apply') }}</span>
            </GsapButton>
          </div>
          <GsapButton
            block
            :disabled="card.subscribed || subscribing === card.identifier"
            :type="card.action === 'upgrade' ? 'primary' : 'default'"
            @click="subscribe(card.identifier, card.price)"
          >
            <span>{{ subscribing === card.identifier ? t('plans.processing') : card.subscribed ? t('plans.current') : card.action === 'upgrade' ? t('plans.upgrade') : t('plans.downgrade') }}</span>
          </GsapButton>
        </NCard>
      </div>
      <NEmpty v-else :description="t('common.no_data')" />
    </GsapSpin>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { NCard, NDivider, NEmpty, NInput, NTag, useMessage } from 'naive-ui'
import GsapButton from '@/components/GsapButton.vue'
import GsapSpin from '@/components/GsapSpin.vue'
import PageHeader from '@/components/PageHeader.vue'
import ActionBar from '@/components/ActionBar.vue'
import { useSubscriptionProductsStore } from '@/stores/subscriptionProducts'
import { useUserSubscriptionStore } from '@/stores/userSubscription'
import nivaroApiService from '@/services/nivaroApi'
import { confirmSubscriptionPayment } from '@/services/stripe'
import { ApiPaymentActionRequiredError, getErrorMessage } from '@/utils/errorHandler'

/** JSON inside each locale string of `localizedDescription` from the API */
interface PlanDescription {
  name?: string
  price?: number
  djTypeId?: string
  maxSongs?: number
  maxStations?: number
  otsAllowed?: boolean
  bulkUploadAllowed?: boolean
  streamQualityKbps?: number
  customScriptAllowed?: boolean
  streamDurationMinutes?: number
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
}

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const message = useMessage()
const subscriptionProductsStore = useSubscriptionProductsStore()
const userSubscriptionStore = useUserSubscriptionStore()
const subscribing = ref<string | null>(null)
const justUpgradedId = ref<string | null>(null)
const promoCode = ref('')
const redeeming = ref(false)
const PRO_IDENTIFIER = 'mixpla_pro'

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

function qualityLabel(kbps: number | string): string {
  const map: Record<number, string> = { 64: t('brandForm.stream_quality_good'), 96: t('brandForm.stream_quality_great'), 128: t('brandForm.stream_quality_best') }
  return String(kbps).split(',').map(v => map[Number(v.trim())] ?? `${v.trim()} ${t('plans.feat_kbps')}`).join(', ')
}

function durationLabel(val: number | string): string {
  return val === 'infinitely' || val === 0 ? t('plans.feat_duration_nonstop') : `${val} ${t('plans.feat_min')}`
}

const cards = computed(() => {
  const subscriptionType = userSubscriptionStore.subscriptionType
  // Backend reports the free tier as subscriptionType "free" (or unset), which doesn't
  // match the "mixpla_free" product identifier — fall back to price-based matching for it.
  const isOnFreePlan = !subscriptionType || subscriptionType === 'free'

  const mapped = (subscriptionProductsStore.products as SubscriptionProductViewEntry[])
    .map((entry) => {
      const name = entry.name || entry.identifier
      const details = parseDescription(entry.description)
      const price = details.price ?? 0
      const features: string[] = []
      if (details.maxStations !== undefined) features.push(`${t('plans.feat_max_stations')}: ${details.maxStations}`)
      if (details.maxSongs !== undefined) features.push(`${t('plans.feat_max_songs')}: ${details.maxSongs.toLocaleString()}`)
      if (details.djTypeId) features.push(`${t('plans.feat_dj_types')}: ${details.djTypeId}`)
      if (details.streamQualityKbps !== undefined) features.push(`${t('plans.feat_stream_quality')}: ${qualityLabel(details.streamQualityKbps)}`)
      if (details.streamDurationMinutes !== undefined) features.push(`${t('plans.feat_stream_duration')}: ${durationLabel(details.streamDurationMinutes)}`)
      if (details.otsAllowed) features.push(t('plans.feat_ots'))
      if (details.bulkUploadAllowed) features.push(t('plans.feat_bulk_upload'))
      if (details.customScriptAllowed) features.push(t('plans.feat_custom_script'))

      return {
        id: entry.id,
        identifier: entry.identifier,
        name,
        price,
        description: details.name ?? '',
        features,
        subscribed: entry.identifier === subscriptionType || (isOnFreePlan && price === 0),
      }
    })

  const currentPrice = mapped.find((c) => c.subscribed)?.price ?? 0

  return mapped.map((card) => ({
    ...card,
    action: card.price > currentPrice ? 'upgrade' : 'downgrade',
  }))
})

onMounted(async () => {
  try {
    // Stripe redirects here after checkout; force-sync in case the webhook hasn't landed yet.
    await userSubscriptionStore.refresh(true)
    await subscriptionProductsStore.loadProducts()

    if (route.query.upgraded) {
      const subscribedCard = cards.value.find((c) => c.subscribed)
      if (subscribedCard) {
        justUpgradedId.value = subscribedCard.id
        setTimeout(() => { justUpgradedId.value = null }, 1800)
      }
      router.replace({ query: {} })
    }
  } catch {
    // server unavailable — empty state shown
  }
})

async function subscribe(planIdentifier: string, price: number) {
  if (planIdentifier === PRO_IDENTIFIER) {
    message.warning(t('plans.pro_not_ready'))
    return
  }
  subscribing.value = planIdentifier
  try {
    if (price === 0) {
      const subscription = await nivaroApiService.cancelSubscription()
      userSubscriptionStore.setSubscription(subscription)
    } else {
      const result = await nivaroApiService.changePlan(planIdentifier)
      if (result.checkoutUrl) {
        window.location.href = result.checkoutUrl
        return
      }
      await userSubscriptionStore.refresh()
    }
    await subscriptionProductsStore.loadProducts()
    message.success(t('plans.subscribe_success'))
  } catch (error) {
    if (error instanceof ApiPaymentActionRequiredError) {
      try {
        await confirmSubscriptionPayment(error.clientSecret)
        await userSubscriptionStore.refresh()
        await subscriptionProductsStore.loadProducts()
        message.success(t('plans.subscribe_success'))
      } catch (confirmError) {
        message.error(getErrorMessage(confirmError))
      }
    } else {
      message.error(getErrorMessage(error))
    }
  } finally {
    subscribing.value = null
  }
}

async function redeemPromo() {
  if (!promoCode.value) return
  redeeming.value = true
  try {
    const subscription = await nivaroApiService.redeemPromoCode(promoCode.value.trim())
    userSubscriptionStore.setSubscription(subscription)
    await subscriptionProductsStore.loadProducts(undefined, undefined, true)
    promoCode.value = ''
    message.success(t('plans.promo_success'))
  } catch (error) {
    message.error(getErrorMessage(error))
  } finally {
    redeeming.value = false
  }
}
</script>

<style scoped>
@keyframes plan-glow-pulse {
  0% { box-shadow: 0 0 0 0 rgba(124, 58, 237, 0); }
  30% { box-shadow: 0 0 22px 4px rgba(124, 58, 237, 0.55); }
  100% { box-shadow: 0 0 0 0 rgba(124, 58, 237, 0); }
}

.plan-glow {
  animation: plan-glow-pulse 1.6s ease-out;
}

@keyframes plan-glow-badge-pulse {
  0% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0); }
  30% { box-shadow: 0 0 10px 3px rgba(34, 197, 94, 0.7); }
  100% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0); }
}

.plan-glow-badge {
  animation: plan-glow-badge-pulse 1.6s ease-out;
}

.current-plan-badge {
  border-radius: 3px !important;
}
</style>
