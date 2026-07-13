import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  deriveAccentPalette,
  randomAccent,
  type AccentPalette,
} from '@/utils/harmonicPalette'

const ACCENT_STORAGE_KEY = 'accentColor'
const DEFAULT_ACCENT = '#7C3AED'

export const useThemeStore = defineStore('theme', () => {
  const isDark = ref<boolean>(false)
  const accentColor = ref<string>(DEFAULT_ACCENT)

  /** Every shade the UI needs, derived harmonically from the base accent. */
  const accentPalette = computed<AccentPalette>(() => deriveAccentPalette(accentColor.value))

  const initializeTheme = () => {
    const savedTheme = localStorage.getItem('theme')
    if (savedTheme) {
      isDark.value = savedTheme === 'dark'
    } else {
      isDark.value = window.matchMedia('(prefers-color-scheme: dark)').matches
    }

    const savedAccent = localStorage.getItem(ACCENT_STORAGE_KEY)
    if (savedAccent) accentColor.value = savedAccent

    updateTheme()
    applyAccentCssVars()
  }

  const updateTheme = () => {
    const htmlElement = document.documentElement
    if (isDark.value) {
      htmlElement.classList.add('dark')
    } else {
      htmlElement.classList.remove('dark')
    }
  }

  /**
   * Push the derived accent shades into the CSS custom properties that
   * base.css already cascades from, so raw CSS (links, `.primary`, etc.)
   * follows the chosen accent alongside the Naive UI overrides.
   */
  const applyAccentCssVars = () => {
    const p = accentPalette.value
    const root = document.documentElement.style
    root.setProperty('--vt-c-primary', p.base)
    root.setProperty('--vt-c-primary-hover', p.hover)
    root.setProperty('--vt-c-primary-pressed', p.pressed)
    root.setProperty('--vt-c-primary-light', p.light)
    root.setProperty('--vt-c-primary-dark', p.dark)
  }

  const toggleTheme = () => {
    isDark.value = !isDark.value
    localStorage.setItem('theme', isDark.value ? 'dark' : 'light')
    updateTheme()
  }

  const setAccent = (color: string) => {
    accentColor.value = color
    localStorage.setItem(ACCENT_STORAGE_KEY, color)
    applyAccentCssVars()
  }

  /** Surprise-me: generate a random, guaranteed-pleasant accent. */
  const generateAccent = () => {
    setAccent(randomAccent())
  }

  /** Restore the default brand accent and forget the saved preference. */
  const resetAccent = () => {
    accentColor.value = DEFAULT_ACCENT
    localStorage.removeItem(ACCENT_STORAGE_KEY)
    applyAccentCssVars()
  }

  const isDefaultAccent = computed(
    () => accentColor.value.toLowerCase() === DEFAULT_ACCENT.toLowerCase(),
  )

  const themeMode = computed(() => isDark.value ? 'dark' : 'light')

  return {
    isDark,
    themeMode,
    accentColor,
    accentPalette,
    isDefaultAccent,
    initializeTheme,
    toggleTheme,
    setAccent,
    generateAccent,
    resetAccent,
  }
})
