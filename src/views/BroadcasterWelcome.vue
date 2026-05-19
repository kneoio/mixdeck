<template>
  <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 60vh; gap: 24px; text-align: center; padding: 32px;">
    <img src="/logo.svg" alt="Mixdeck" :style="logoStyle" />
    <h2 style="margin: 0;">{{ t('broadcasterWelcome.heading') }}</h2>
    <p style="color: #888; max-width: 480px; margin: 0;">
      {{ t('broadcasterWelcome.body') }}
    </p>
    <GsapButton type="primary" size="large" @click="router.push('/brands/new')">
      <span>{{ t('broadcasterWelcome.cta') }}</span>
    </GsapButton>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import GsapButton from '@/components/GsapButton.vue'
import { useThemeStore } from '@/stores/theme'

const { t } = useI18n()
const router = useRouter()
const themeStore = useThemeStore()

const logoStyle = computed(() => ({
  width: '80px',
  height: '80px',
  filter: themeStore.isDark ? 'invert(1)' : 'none',
}))
</script>
