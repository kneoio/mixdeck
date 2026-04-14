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
    primaryColorHover: '#820009',
    primaryColorPressed: '#620007',
    primaryColorSuppl: '#c20010',
    errorColor: '#FF2D95',
    errorColorHover: '#ff5aaa',
    errorColorPressed: '#e0207f',
    errorColorSuppl: '#FF2D95',
  }
}

const naiveTheme = computed(() => themeStore.isDark ? darkTheme : null)

onMounted(() => {
  themeStore.initializeTheme()
})
</script>
