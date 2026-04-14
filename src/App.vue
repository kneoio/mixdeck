<template>
  <NConfigProvider :theme="naiveTheme" :theme-overrides="themeOverrides">
    <NLoadingBarProvider>
      <NMessageProvider>
        <NGlobalStyle />
        <RouterView />
      </NMessageProvider>
    </NLoadingBarProvider>
  </NConfigProvider>
</template>

<script setup lang="ts">
import { RouterView } from 'vue-router'
import { NMessageProvider, NLoadingBarProvider, NGlobalStyle, NConfigProvider } from 'naive-ui'
import { darkTheme, type GlobalThemeOverrides } from 'naive-ui'
import { useThemeStore } from '@/stores/theme'
import { onMounted, computed } from 'vue'

const themeStore = useThemeStore()

const themeOverrides: GlobalThemeOverrides = {
  common: {
    primaryColor: '#7C3AED',
    primaryColorHover: '#9d5bf4',
    primaryColorPressed: '#6d31d4',
    primaryColorSuppl: '#7C3AED',
    errorColor: '#FF2D95',
    errorColorHover: '#ff5aaa',
    errorColorPressed: '#e0207f',
    errorColorSuppl: '#FF2D95',
  },
  Button: {
    textColorPrimary: '#ffffff',
    textColorHoverPrimary: '#ffffff',
    textColorPressedPrimary: '#ffffff',
    textColorFocusPrimary: '#ffffff',
    textColorError: '#ffffff',
    textColorHoverError: '#ffffff',
    textColorPressedError: '#ffffff',
    textColorFocusError: '#ffffff',
  }
}

const naiveTheme = computed(() => themeStore.isDark ? darkTheme : null)

onMounted(() => {
  themeStore.initializeTheme()
})
</script>
