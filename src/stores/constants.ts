import { defineStore } from 'pinia'

export const useConstantsStore = defineStore('constants', () => {
  const mostUsedLanguages = [
    { label: 'English', value: 'en-US' },
    { label: 'Español', value: 'es-ES' },
    { label: 'Français', value: 'fr-FR' },
    { label: 'Português', value: 'pt-PT' },
    { label: 'Deutsch', value: 'de-DE' },
    { label: 'हिन्दी', value: 'hi-IN' },
    { label: 'Türkçe', value: 'tr-TR' },
    { label: 'العربية', value: 'ar-XA' },
    { label: '中文', value: 'cmn-CN' },
    { label: 'Български', value: 'bg-BG' },
    { label: 'Latviešu', value: 'lv-LV' },
    { label: 'Svenska', value: 'sv-SE' },
    { label: 'Italiano', value: 'it-IT' },
    { label: '日本語', value: 'ja-JP' },
    { label: '한국어', value: 'ko-KR' },
    { label: 'Suomi', value: 'fi-FI' },
    { label: 'ไทย', value: 'th-TH' },
    { label: 'Українська', value: 'uk-UA' },
    { label: 'Русский', value: 'ru-RU' }
  ]

  const mostUsedLanguagesSimple = [
    { label: 'English', value: 'en' },
    { label: 'Español', value: 'es' },
    { label: 'Français', value: 'fr' },
    { label: 'Português', value: 'pt' },
    { label: 'Deutsch', value: 'de' },
    { label: 'हिन्दी', value: 'hi' },
    { label: 'Türkçe', value: 'tr' },
    { label: 'العربية', value: 'ar' },
    { label: '中文', value: 'zh' },
    { label: 'Български', value: 'bg' },
    { label: 'Latviešu', value: 'lv' },
    { label: 'Svenska', value: 'sv' },
    { label: 'Italiano', value: 'it' },
    { label: '日本語', value: 'ja' },
    { label: '한국어', value: 'ko' },
    { label: 'Suomi', value: 'fi' },
    { label: 'ไทย', value: 'th' },
    { label: 'Українська', value: 'uk' },
    { label: 'Русский', value: 'ru' }
  ]

  const stationFonts = [
    'Goldman', 'Digital Play Italic St', 'Airborne', 'AncientGod', 'Apollo',
    'Cubic', 'DigitalPlay', 'Drexs', 'Elias', 'FutureSallow', 'Goodtime',
    'GameOfSquids', 'Glypic', 'Icklips', 'Moto', 'MontereyPopsicle',
    'PolenticalNeon', 'Venta', 'Conthrax', 'Kaylon', 'Nsecthin', 'Yonder',
  ]

  const stationFontOptions = [
    { label: '— Default —', value: '', type: 'ignored' as const },
    ...stationFonts.map(f => ({ label: f, value: f })),
  ]

  const bitRateOptions = [64, 96, 128, 160, 192, 256, 320].map(v => ({ label: `${v} kbps`, value: v }))

  const countries = [
    { label: 'United States', value: 'US' }, { label: 'United Kingdom', value: 'GB' },
    { label: 'Germany', value: 'DE' }, { label: 'France', value: 'FR' },
    { label: 'Spain', value: 'ES' }, { label: 'Italy', value: 'IT' },
    { label: 'Portugal', value: 'PT' }, { label: 'Brazil', value: 'BR' },
    { label: 'Russia', value: 'RU' }, { label: 'Ukraine', value: 'UA' },
    { label: 'Latvia', value: 'LV' }, { label: 'Georgia', value: 'GE' },
    { label: 'Kazakhstan', value: 'KZ' }, { label: 'Japan', value: 'JP' },
  ]

  const timezones = [
    { label: 'UTC (+0)', value: 'UTC' },
    { label: 'Europe/London', value: 'Europe/London' },
    { label: 'Europe/Paris (+1/+2)', value: 'Europe/Paris' },
    { label: 'Europe/Berlin (+1/+2)', value: 'Europe/Berlin' },
    { label: 'Europe/Kiev (+2/+3)', value: 'Europe/Kiev' },
    { label: 'Europe/Riga (+2/+3)', value: 'Europe/Riga' },
    { label: 'Europe/Istanbul (+3)', value: 'Europe/Istanbul' },
    { label: 'Asia/Dubai (+4)', value: 'Asia/Dubai' },
    { label: 'Asia/Tbilisi (+4)', value: 'Asia/Tbilisi' },
    { label: 'Asia/Tashkent (+5)', value: 'Asia/Tashkent' },
    { label: 'Asia/Almaty (+6)', value: 'Asia/Almaty' },
    { label: 'Asia/Tokyo (+9)', value: 'Asia/Tokyo' },
    { label: 'America/New_York (-5/-4)', value: 'America/New_York' },
    { label: 'America/Los_Angeles (-8/-7)', value: 'America/Los_Angeles' },
    { label: 'America/Sao_Paulo (-3)', value: 'America/Sao_Paulo' },
  ]

  return {
    mostUsedLanguages,
    mostUsedLanguagesSimple,
    stationFontOptions,
    bitRateOptions,
    countries,
    timezones
  }
})
