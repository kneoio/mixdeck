<script setup lang="ts">
import { computed } from 'vue'
import {
  NAvatar, NButton, NTag, NDescriptions, NDescriptionsItem,
  NCard, NSpace, NFlex, NDivider
} from 'naive-ui'
import { useAuthStore } from '@/stores/auth'
import PageHeader from '@/components/PageHeader.vue'

const authStore = useAuthStore()

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
  return new Date(ts).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
})
</script>

<template>
  <div>
    <PageHeader title="Profile" subtitle="Your account details" />

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
          <NDescriptionsItem label="Username">{{ authStore.userName || '—' }}</NDescriptionsItem>
          <NDescriptionsItem label="First name">{{ profile.firstName || '—' }}</NDescriptionsItem>
          <NDescriptionsItem label="Last name">{{ profile.lastName || '—' }}</NDescriptionsItem>
          <NDescriptionsItem label="Email">
            <NSpace :size="8" align="center">
              <span>{{ authStore.userEmail || '—' }}</span>
              <NTag
                :type="profile.emailVerified ? 'success' : 'warning'"
                size="small"
                round
              >
                {{ profile.emailVerified ? 'Verified' : 'Unverified' }}
              </NTag>
            </NSpace>
          </NDescriptionsItem>
          <NDescriptionsItem label="Member since">{{ memberSince }}</NDescriptionsItem>
        </NDescriptions>
      </NCard>

      <!-- Subscription -->
      <NCard title="Subscription">
        <NFlex justify="space-between" align="center" style="margin-bottom: 16px;">
          <div>
            <div style="font-size: 16px; font-weight: 600;">Free Plan</div>
            <div style="opacity: 0.55; font-size: 13px; margin-top: 2px;">Basic access · up to 3 brands</div>
          </div>
          <NTag type="default" size="medium" round>Free</NTag>
        </NFlex>

        <NDivider style="margin: 0 0 16px;" />

        <NDescriptions label-placement="left" :column="1" label-style="width: 180px; opacity: 0.55;">
          <NDescriptionsItem label="Brands">3 / 3</NDescriptionsItem>
          <NDescriptionsItem label="Listeners">100 / 100</NDescriptionsItem>
          <NDescriptionsItem label="Storage">5 GB / 5 GB</NDescriptionsItem>
          <NDescriptionsItem label="Bulk upload">
            <NTag type="success" size="small" round>Enabled</NTag>
          </NDescriptionsItem>
          <NDescriptionsItem label="AI DJ">
            <NTag type="warning" size="small" round>Pro only</NTag>
          </NDescriptionsItem>
          <NDescriptionsItem label="Renewal">—</NDescriptionsItem>
        </NDescriptions>

        <NDivider style="margin: 16px 0;" />

        <NButton type="primary" style="background: #7C3AED; border-color: #7C3AED;">
          Upgrade to Pro
        </NButton>
      </NCard>

      <!-- Security -->
      <NCard title="Security">
        <NDescriptions label-placement="left" :column="1" label-style="width: 160px; opacity: 0.55;">
          <NDescriptionsItem label="Password">••••••••</NDescriptionsItem>
          <NDescriptionsItem label="2FA">
            <NTag type="warning" size="small" round>Not enabled</NTag>
          </NDescriptionsItem>
          <NDescriptionsItem label="Sessions">1 active</NDescriptionsItem>
        </NDescriptions>

        <NDivider style="margin: 16px 0;" />

        <NSpace>
          <NButton secondary>Change password</NButton>
          <NButton secondary>Enable 2FA</NButton>
        </NSpace>
      </NCard>

    </div>
  </div>
</template>
