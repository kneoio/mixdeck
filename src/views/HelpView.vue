<template>
  <n-config-provider class="help-view-root" :theme="darkTheme" :theme-overrides="themeOverrides">
    <n-message-provider>
      <HelpChatPanel />
    </n-message-provider>
  </n-config-provider>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { NConfigProvider, NMessageProvider, darkTheme, type GlobalThemeOverrides } from 'naive-ui'
import HelpChatPanel from '@/components/HelpChatPanel.vue'
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
.help-view-root {
  display: block;
  height: 100vh;
  height: 100dvh;
  overflow: hidden;
}
</style>
