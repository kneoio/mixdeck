<template>
  <n-config-provider class="ask-view-root" :theme="darkTheme" :theme-overrides="themeOverrides">
    <n-message-provider>
      <AskChatPanel />
    </n-message-provider>
  </n-config-provider>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { NConfigProvider, NMessageProvider, darkTheme, type GlobalThemeOverrides } from 'naive-ui'
import AskChatPanel from '@/components/AskChatPanel.vue'
import { useThemeStore } from '@/stores/theme'

const themeStore = useThemeStore()

const themeOverrides = computed<GlobalThemeOverrides>(() => ({
  common: {
    primaryColor: themeStore.accentPalette.base,
    primaryColorHover: themeStore.accentPalette.hover,
    primaryColorPressed: themeStore.accentPalette.pressed,
    primaryColorSuppl: themeStore.accentPalette.base,
  },
  Button: {
    textColorPrimary: '#ffffff',
    textColorHoverPrimary: '#ffffff',
    textColorPressedPrimary: '#ffffff',
    textColorFocusPrimary: '#ffffff',
  },
  Input: {
    heightMedium: '40px',
    fontSizeMedium: '15px',
  },
}))
</script>

<style scoped>
.ask-view-root {
  display: block;
  height: 100vh;
  height: 100dvh;
  overflow: hidden;
}
</style>
