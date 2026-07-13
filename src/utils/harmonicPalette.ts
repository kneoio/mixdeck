/**
 * Harmonic accent-color generation.
 *
 * The whole "theme customization" feature rests on one idea: the user picks a
 * single base accent colour, and every shade the UI needs (hover, pressed, the
 * lighter variant used in dark mode, etc.) is *derived* from it with colour
 * math so the result always looks coordinated. No backend required — this is
 * pure, instant computation in the browser.
 */

export interface Hsl {
  h: number // 0..360
  s: number // 0..100
  l: number // 0..100
}

/** The full set of shades the app derives from one base accent colour. */
export interface AccentPalette {
  /** The user-chosen base colour. */
  base: string
  /** Lighter, for hover states. */
  hover: string
  /** Darker, for pressed/active states. */
  pressed: string
  /** A lighter tint used as the "primary" in dark mode so it stays legible. */
  light: string
  /** A darker shade used for hovered links / primary-hover in light mode. */
  dark: string
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))

export function hexToHsl(hex: string): Hsl {
  let h = hex.replace('#', '')
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  const r = parseInt(h.slice(0, 2), 16) / 255
  const g = parseInt(h.slice(2, 4), 16) / 255
  const b = parseInt(h.slice(4, 6), 16) / 255

  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const delta = max - min
  let hue = 0
  if (delta !== 0) {
    if (max === r) hue = ((g - b) / delta) % 6
    else if (max === g) hue = (b - r) / delta + 2
    else hue = (r - g) / delta + 4
    hue *= 60
    if (hue < 0) hue += 360
  }
  const l = (max + min) / 2
  const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1))
  return { h: hue, s: s * 100, l: l * 100 }
}

export function hslToHex({ h, s, l }: Hsl): string {
  const sN = clamp(s, 0, 100) / 100
  const lN = clamp(l, 0, 100) / 100
  const c = (1 - Math.abs(2 * lN - 1)) * sN
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = lN - c / 2
  let r = 0, g = 0, b = 0
  if (h < 60) [r, g, b] = [c, x, 0]
  else if (h < 120) [r, g, b] = [x, c, 0]
  else if (h < 180) [r, g, b] = [0, c, x]
  else if (h < 240) [r, g, b] = [0, x, c]
  else if (h < 300) [r, g, b] = [x, 0, c]
  else [r, g, b] = [c, 0, x]
  const toHex = (v: number) =>
    Math.round((v + m) * 255).toString(16).padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

/**
 * Derive the full shade set from a single base accent colour by keeping the
 * hue fixed and nudging lightness/saturation. Same hue everywhere = a
 * coordinated, "harmonic" result rather than clashing hand-picked values.
 */
export function deriveAccentPalette(baseHex: string): AccentPalette {
  const base = hexToHsl(baseHex)
  return {
    base: baseHex,
    hover: hslToHex({ h: base.h, s: base.s, l: clamp(base.l + 10, 0, 92) }),
    pressed: hslToHex({ h: base.h, s: clamp(base.s + 4, 0, 100), l: clamp(base.l - 9, 8, 100) }),
    light: hslToHex({ h: base.h, s: clamp(base.s - 6, 0, 100), l: clamp(base.l + 14, 0, 90) }),
    dark: hslToHex({ h: base.h, s: clamp(base.s + 6, 0, 100), l: clamp(base.l - 14, 6, 100) }),
  }
}

/**
 * A random base colour that is guaranteed to look pleasant: any hue, but with
 * saturation/lightness pinned to a vivid-yet-usable band. This is what the
 * "Generate" / surprise-me button calls.
 */
export function randomAccent(): string {
  const h = Math.floor(Math.random() * 360)
  const s = 62 + Math.random() * 20 // 62..82
  const l = 48 + Math.random() * 12 // 48..60
  return hslToHex({ h, s, l })
}

/** Curated starting points shown as preset swatches. */
export const ACCENT_PRESETS: { name: string; color: string }[] = [
  { name: 'Violet', color: '#7C3AED' },
  { name: 'Indigo', color: '#4F46E5' },
  { name: 'Ocean', color: '#0EA5E9' },
  { name: 'Emerald', color: '#10B981' },
  { name: 'Amber', color: '#F59E0B' },
  { name: 'Rose', color: '#F43F5E' },
]
