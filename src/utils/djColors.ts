import { computed } from 'vue'
import { useThemeVars } from 'naive-ui'

/**
 * One colour per asset, so A, B and C are told apart at a glance in the Assets rows, the lane
 * gutter and the waveforms. They come from Naive UI's own palette, so they follow the app theme.
 */
export function useDjColors() {
  const themeVars = useThemeVars()
  return computed(() => ({
    a: themeVars.value.primaryColor,
    b: themeVars.value.warningColor,
    c: themeVars.value.infoColor,
    d: themeVars.value.successColor,
    /** D outside the actual stitch region: same hue, faded into the background instead of solid. */
    dDim: `color-mix(in srgb, ${themeVars.value.successColor} 35%, transparent)`,
  }))
}
