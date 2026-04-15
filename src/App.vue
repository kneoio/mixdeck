<template>
  <NConfigProvider :theme="naiveTheme" :theme-overrides="themeOverrides">
    <NLoadingBarProvider :theme-overrides="{
    colorLoading: '#eff605',
    colorError: '#f10505'
  }">
      <NMessageProvider>
        <NGlobalStyle/>
        <RouterView/>
      </NMessageProvider>
    </NLoadingBarProvider>
  </NConfigProvider>
</template>

<script setup lang="ts">
import {RouterView} from 'vue-router'
import {NMessageProvider, NLoadingBarProvider, NGlobalStyle, NConfigProvider} from 'naive-ui'
import {darkTheme, type GlobalThemeOverrides} from 'naive-ui'
import {useThemeStore} from '@/stores/theme'
import {onMounted, computed} from 'vue'

const themeStore = useThemeStore()

const themeOverrides = computed<GlobalThemeOverrides>(() => ({
  common: {
    primaryColor: '#7C3AED',
    primaryColorHover: '#9d5bf4',
    primaryColorPressed: '#6d31d4',
    primaryColorSuppl: '#7C3AED',
    errorColor: '#FF2D95',
    errorColorHover: '#ff5aaa',
    errorColorPressed: '#e0207f',
    errorColorSuppl: '#FF2D95',
    ...(themeStore.isDark ? {textColorDisabled: 'rgba(255,255,255,0.38)'} : {}),
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
}))

const naiveTheme = computed(() => themeStore.isDark ? darkTheme : null)

onMounted(() => {
  themeStore.initializeTheme()
})
</script>

<style scoped>
.n-loading-bar-container {
  height: 6px !important;
  overflow: visible !important;
}

.n-loading-bar {
  height: 100%;
  box-shadow:
      0 0 6px #ecc711,
      0 0 12px #ecc711,
      0 0 20px #ff8d00;
}
</style>