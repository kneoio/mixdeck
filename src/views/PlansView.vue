<template>
  <div>
    <PageHeader :title="t('plans.title')" :subtitle="t('plans.subtitle')" />

    <div style="display: flex; gap: 24px; flex-wrap: wrap; align-items: flex-start;">

      <!-- Free -->
      <NCard style="flex: 1; min-width: 240px; max-width: 320px;">
        <div style="margin-bottom: 16px;">
          <div style="font-size: 18px; font-weight: 700;">{{ t('plans.free') }}</div>
          <div style="font-size: 28px; font-weight: 800; margin: 8px 0;">€0 <span style="font-size: 14px; font-weight: 400; opacity: 0.5;">/ mo</span></div>
          <div style="font-size: 13px; opacity: 0.55;">{{ t('plans.free_desc') }}</div>
        </div>
        <NDivider style="margin: 0 0 16px;" />
        <ul style="list-style: none; padding: 0; margin: 0 0 24px; display: flex; flex-direction: column; gap: 10px; font-size: 13px;">
          <li v-for="f in freeFeatures" :key="f">✓ {{ f }}</li>
        </ul>
        <NButton block disabled>{{ t('plans.current') }}</NButton>
      </NCard>

      <!-- Plus -->
      <NCard style="flex: 1; min-width: 240px; max-width: 320px; border: 1.5px solid #7C3AED;">
        <div style="margin-bottom: 16px;">
          <NFlex align="center" justify="space-between">
            <div style="font-size: 18px; font-weight: 700;">{{ t('plans.plus') }}</div>
            <NTag type="info" size="small" round>{{ t('plans.popular') }}</NTag>
          </NFlex>
          <div style="font-size: 28px; font-weight: 800; margin: 8px 0;">€15 <span style="font-size: 14px; font-weight: 400; opacity: 0.5;">/ mo</span></div>
          <div style="font-size: 13px; opacity: 0.55;">{{ t('plans.plus_desc') }}</div>
        </div>
        <NDivider style="margin: 0 0 16px;" />
        <ul style="list-style: none; padding: 0; margin: 0 0 24px; display: flex; flex-direction: column; gap: 10px; font-size: 13px;">
          <li v-for="f in plusFeatures" :key="f">✓ {{ f }}</li>
        </ul>
        <NButton block type="primary" style="background: #7C3AED; border-color: #7C3AED;">{{ t('plans.upgrade_plus') }}</NButton>
      </NCard>

      <!-- Premium -->
      <NCard style="flex: 1; min-width: 240px; max-width: 320px;">
        <div style="margin-bottom: 16px;">
          <div style="font-size: 18px; font-weight: 700;">{{ t('plans.premium') }}</div>
          <div style="font-size: 28px; font-weight: 800; margin: 8px 0;">€30 <span style="font-size: 14px; font-weight: 400; opacity: 0.5;">/ mo</span></div>
          <div style="font-size: 13px; opacity: 0.55;">{{ t('plans.premium_desc') }}</div>
        </div>
        <NDivider style="margin: 0 0 16px;" />
        <ul style="list-style: none; padding: 0; margin: 0 0 24px; display: flex; flex-direction: column; gap: 10px; font-size: 13px;">
          <li v-for="f in premiumFeatures" :key="f">✓ {{ f }}</li>
        </ul>
        <NButton block>{{ t('plans.upgrade_premium') }}</NButton>
      </NCard>

    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { NCard, NButton, NTag, NDivider, NFlex } from 'naive-ui'
import PageHeader from '@/components/PageHeader.vue'

const { t } = useI18n()

const freeFeatures = [
  '1 station',
  '100 receive listeners',
  '2 GB storage',
  'Bulk upload',
  'AI DJ: Regular, Advanced',
]

const plusFeatures = [
  'Up to 5 stations',
  '500 receive listeners',
  '20 GB storage',
  'Bulk upload',
  'AI DJ: Regular, Advanced, Pro',
  'Priority support',
]

const premiumFeatures = [
  'Unlimited stations',
  'Unlimited receive listeners',
  '100 GB storage',
  'Bulk upload',
  'AI DJ: all modes',
  'Dedicated support',
  'Custom integrations',
]
</script>
