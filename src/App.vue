<template>
  <NConfigProvider
    :theme="naiveTheme"
    :theme-overrides="themeOverrides"
    :locale="naiveLocale"
    :date-locale="naiveDateLocale"
  >
    <NLoadingBarProvider :theme-overrides="{
    colorLoading: '#eff605',
    colorError: '#f10505'
  }">
      <NMessageProvider>
        <NGlobalStyle/>
        <RouterView/>
        <NModal
          v-model:show="needRefresh"
          preset="dialog"
          title="Update available"
          :content="`Mixdeck v${__APP_VERSION__} is ready. Reload now to get the latest features and fixes.`"
          positive-text="Update"
          negative-text="Later"
          :mask-closable="false"
          @positive-click="applyUpdate"
        />
      </NMessageProvider>
    </NLoadingBarProvider>
  </NConfigProvider>
</template>

<script setup lang="ts">
import { RouterView } from 'vue-router'
import { NMessageProvider, NLoadingBarProvider, NGlobalStyle, NConfigProvider, NModal } from 'naive-ui'
import { darkTheme, type GlobalThemeOverrides } from 'naive-ui'
import {
  enUS, deDE, esAR, frFR, jaJP, ptBR, ruRU, ukUA, arDZ,
  dateEnUS, dateDeDE, dateEsAR, dateFrFR, dateJaJP, datePtBR, dateRuRU, dateUkUA, dateArDZ,
  type NLocale, type NDateLocale,
} from 'naive-ui'
import { useServiceWorker } from '@/composables/useServiceWorker'
import { useThemeStore } from '@/stores/theme'
import { useAuthStore } from '@/stores/auth'
import { useUserSubscriptionStore } from '@/stores/userSubscription'
import { onMounted, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { applyDirection, type SupportedLocale } from '@/i18n'

const { needRefresh, applyUpdate } = useServiceWorker()
const themeStore = useThemeStore()
const authStore = useAuthStore()
const userSubscriptionStore = useUserSubscriptionStore()
const { locale } = useI18n()

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
  Input: {
    caretColor: themeStore.isDark ? '#eff605' : '#7C3AED',
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
  },
  ...(themeStore.isDark ? {
    Select: {
      optionTextColorActive: '#ffffff',
      optionCheckColor: '#9d5bf4',
    },
    InternalSelectMenu: {
      optionTextColorActive: '#ffffff',
      optionCheckColor: '#9d5bf4',
    },
  } : {}),
}))

const naiveTheme = computed(() => themeStore.isDark ? darkTheme : null)

const naiveLocaleMap: Record<SupportedLocale, NLocale> = {
  en: enUS,
  de: deDE,
  es: esAR,
  fr: frFR,
  ja: jaJP,
  pt: ptBR,
  ru: ruRU,
  uk: ukUA,
  ar: arDZ,
  // Fallback to English where Naive UI doesn't provide built-in locales.
  hi: enUS,
  kk: enUS,
  ka: enUS,
  no: enUS,
  ko: enUS,
}

const naiveDateLocaleMap: Record<SupportedLocale, NDateLocale> = {
  en: dateEnUS,
  de: dateDeDE,
  es: dateEsAR,
  fr: dateFrFR,
  ja: dateJaJP,
  pt: datePtBR,
  ru: dateRuRU,
  uk: dateUkUA,
  ar: dateArDZ,
  hi: dateEnUS,
  kk: dateEnUS,
  ka: dateEnUS,
  no: dateEnUS,
  ko: dateEnUS,
}

const naiveLocale = computed(() => naiveLocaleMap[locale.value as SupportedLocale] ?? enUS)
const naiveDateLocale = computed(() => naiveDateLocaleMap[locale.value as SupportedLocale] ?? dateEnUS)

watch(locale, (val) => applyDirection(val as SupportedLocale), { immediate: true })

watch(() => authStore.isAuthenticated, (isAuthenticated) => {
  if (isAuthenticated) {
    void userSubscriptionStore.loadCurrentSubscription()
  } else {
    userSubscriptionStore.reset()
  }
}, { immediate: true })

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
