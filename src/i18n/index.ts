import { createI18n } from 'vue-i18n'
import en from '@/locales/en'
import ru from '@/locales/ru'
import de from '@/locales/de'
import fr from '@/locales/fr'
import es from '@/locales/es'
import pt from '@/locales/pt'
import ja from '@/locales/ja'
import ar from '@/locales/ar'
import hi from '@/locales/hi'
import uk from '@/locales/uk'

export const LOCALE_KEY = 'mixdeck_locale'
export const SUPPORTED_LOCALES = ['en', 'ru', 'de', 'fr', 'es', 'pt', 'ja', 'ar', 'hi', 'uk'] as const
export type SupportedLocale = typeof SUPPORTED_LOCALES[number]

export const LOCALE_LABELS: Record<SupportedLocale, string> = {
  en: 'English',
  ru: 'Русский',
  de: 'Deutsch',
  fr: 'Français',
  es: 'Español',
  pt: 'Português',
  ja: '日本語',
  ar: 'العربية',
  hi: 'हिन्दी',
  uk: 'Українська',
}

const RTL_LOCALES = new Set<SupportedLocale>(['ar'])

export function isRtl(locale: SupportedLocale): boolean {
  return RTL_LOCALES.has(locale)
}

export function applyDirection(locale: SupportedLocale) {
  document.documentElement.dir = isRtl(locale) ? 'rtl' : 'ltr'
  document.documentElement.lang = locale
}

export function getSavedLocale(): SupportedLocale {
  const saved = localStorage.getItem(LOCALE_KEY)
  if (saved && SUPPORTED_LOCALES.includes(saved as SupportedLocale)) {
    return saved as SupportedLocale
  }
  const browser = navigator.language.split('-')[0]
  if (SUPPORTED_LOCALES.includes(browser as SupportedLocale)) {
    return browser as SupportedLocale
  }
  return 'en'
}

export function saveLocale(locale: SupportedLocale) {
  localStorage.setItem(LOCALE_KEY, locale)
}

const i18n = createI18n({
  legacy: false,
  locale: getSavedLocale(),
  fallbackLocale: 'en',
  messages: { en, ru, de, fr, es, pt, ja, ar, hi, uk },
})

export default i18n
