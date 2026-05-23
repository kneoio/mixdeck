<template>
  <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 60vh; gap: 24px; text-align: center; padding: 32px;">
    <img src="/logo.svg" alt="Mixdeck" :style="logoStyle" />
    <h2 style="margin: 0;">{{ t('broadcasterWelcome.heading') }}</h2>
    <p style="color: #888; max-width: 480px; margin: 0;">
      {{ t('broadcasterWelcome.body') }}
    </p>
    <button class="welcome-cta" @click="router.push('/brands/new')">
      <span class="welcome-cta__icon">+</span>
      <span>{{ t('broadcasterWelcome.cta') }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
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

<style scoped>
.welcome-cta {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  border: 2px dashed rgba(255, 45, 149, 0.45);
  border-radius: 8px;
  background: transparent;
  color: #FF2D95;
  font-size: 0.84rem;
  font-weight: 500;
  letter-spacing: 0.03em;
  cursor: pointer;
  transition: border-color 0.18s, background 0.18s;
}

.welcome-cta:hover {
  border-color: #FF2D95;
  background: rgba(255, 45, 149, 0.08);
}

.welcome-cta__icon {
  font-size: 1.2rem;
  line-height: 1;
  font-weight: 300;
}
</style>
