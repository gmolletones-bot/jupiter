import type { Settings, WallpaperPreset, WallpaperRef } from './types'

export const ACCENT_COLORS: { name: string; value: string }[] = [
  { name: 'Azul', value: '#3b82f6' },
  { name: 'Índigo', value: '#6366f1' },
  { name: 'Violeta', value: '#a855f7' },
  { name: 'Rosa', value: '#ec4899' },
  { name: 'Rojo', value: '#ef4444' },
  { name: 'Naranja', value: '#f97316' },
  { name: 'Ámbar', value: '#f59e0b' },
  { name: 'Verde', value: '#22c55e' },
  { name: 'Turquesa', value: '#14b8a6' },
  { name: 'Cian', value: '#06b6d4' }
]

export const WALLPAPERS: { id: WallpaperPreset; name: string }[] = [
  { id: 'ambient', name: 'Tus sonidos' },
  { id: 'aurora', name: 'Aurora' },
  { id: 'neon', name: 'Neón' },
  { id: 'sunset', name: 'Atardecer' },
  { id: 'ocean', name: 'Océano' },
  { id: 'forest', name: 'Bosque' },
  { id: 'midnight', name: 'Medianoche' },
  { id: 'accent', name: 'Tu color' },
  { id: 'plain', name: 'Liso' }
]

/** Night runs from 19:00 to 6:59, for the night wallpaper and greetings. */
export function isNight(date: Date): boolean {
  const hour = date.getHours()
  return hour >= 19 || hour < 7
}

export function activeWallpaper(settings: Settings, date: Date): WallpaperRef {
  return isNight(date) && settings.nightWallpaper ? settings.nightWallpaper : settings.wallpaper
}

/** Wallpapers that need dark text on top (the rest get white text). */
export function isLightWallpaper(wallpaper: WallpaperRef): boolean {
  return wallpaper === 'plain'
}

const PHRASES = {
  morning: [
    'Luz suave de la mañana.',
    'Un café y a empezar.',
    'Hoy es un buen día para crear.',
    'Paso a paso se llega lejos.'
  ],
  afternoon: [
    'Sigue así, vas muy bien.',
    'Una pausa también es avanzar.',
    'La tarde es toda tuya.',
    'Enfócate en lo que importa.'
  ],
  night: [
    'Baja el ritmo y respira.',
    'Las estrellas también trabajan de noche.',
    'Descansar es parte del plan.',
    'Mañana será otro gran día.'
  ]
}

/** Greeting plus a short phrase that changes with the time of day (stable within a day). */
export function greetingFor(date: Date): { greeting: string; phrase: string } {
  const hour = date.getHours()
  const period =
    hour >= 6 && hour < 12 ? 'morning' : hour >= 12 && hour < 20 ? 'afternoon' : 'night'
  const greeting = { morning: 'Buenos días', afternoon: 'Buenas tardes', night: 'Buenas noches' }[
    period
  ]
  const phrases = PHRASES[period]
  return { greeting, phrase: phrases[date.getDate() % phrases.length] }
}

export function formatTime(
  date: Date,
  format: Settings['clockFormat']
): {
  time: string
  suffix: string
} {
  if (format === '24h') {
    return {
      time: date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
      suffix: ''
    }
  }
  const hours = date.getHours() % 12 || 12
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return { time: `${hours}:${minutes}`, suffix: date.getHours() < 12 ? 'AM' : 'PM' }
}

// Base colours; keep in sync with --tabbar-bg / --toolbar-bg / --text in main.css.
const TAB_BAR = {
  light: { background: '#dfe3e8', text: '#16181d' },
  dark: { background: '#17181b', text: '#e6e7ea' }
}
const TOOLBAR = { light: '#f7f8fa', dark: '#26272b' }

function parseHex(hex: string): [number, number, number] {
  const value = hex.replace('#', '')
  const full = value.length === 3 ? [...value].map((c) => c + c).join('') : value
  const n = parseInt(full, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function toHex([r, g, b]: [number, number, number]): string {
  return `#${[r, g, b].map((c) => Math.round(c).toString(16).padStart(2, '0')).join('')}`
}

/** Mixes `amount` (0–1) of colour `a` into colour `b`. */
export function mix(a: string, b: string, amount: number): string {
  const [ca, cb] = [parseHex(a), parseHex(b)]
  return toHex(
    [0, 1, 2].map((i) => ca[i] * amount + cb[i] * (1 - amount)) as [number, number, number]
  )
}

function luminance(color: string): number {
  const [r, g, b] = parseHex(color).map((c) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** Black or white, whichever reads better on `background`. */
export function contrastText(background: string): string {
  return luminance(background) > 0.4 ? '#0b0d12' : '#ffffff'
}

let colorContext: CanvasRenderingContext2D | null | undefined

/** Any CSS colour ("#abc", "rgb(…)", "teal"…) as #rrggbb; undefined if invalid or see-through. */
export function toHexColor(css: string | null | undefined): string | undefined {
  if (!css) return undefined
  colorContext ??= document.createElement('canvas').getContext('2d')
  if (!colorContext) return undefined
  // The canvas normalises colours; an invalid one leaves the previous value.
  colorContext.fillStyle = '#010203'
  colorContext.fillStyle = css
  const value = String(colorContext.fillStyle)
  if (value === '#010203') return undefined
  if (value.startsWith('#')) return value
  const match = value.match(/rgba?\((\d+), (\d+), (\d+)(?:, ([\d.]+))?\)/)
  if (!match || (match[4] !== undefined && Number(match[4]) < 0.6)) return undefined
  return toHex([Number(match[1]), Number(match[2]), Number(match[3])])
}

/** Site colours too close to white or black would just look like a glitch. */
function usableSiteColor(color: string | undefined): color is string {
  if (!color) return false
  const light = luminance(color)
  return light > 0.03 && light < 0.85
}

export interface ChromeColors {
  tabBar: string
  tabBarText: string
  toolbar: string
}

/**
 * Colours of the tab strip and toolbar: the site's theme colour when there is
 * a usable one (strong on the tab strip, subtle on the toolbar), otherwise the
 * accent tint if enabled, otherwise the theme's own greys.
 */
export function chromeColors(
  dark: boolean,
  accent: string,
  tint: boolean,
  siteColors: (string | undefined)[] = []
): ChromeColors {
  const base = dark ? TAB_BAR.dark : TAB_BAR.light
  const toolbar = dark ? TOOLBAR.dark : TOOLBAR.light
  // The page's theme colour first, then its favicon's.
  const siteColor = siteColors.find(usableSiteColor)
  if (siteColor) {
    const tabBar = mix(siteColor, base.background, dark ? 0.55 : 0.7)
    return {
      tabBar,
      tabBarText: contrastText(tabBar),
      toolbar: mix(siteColor, toolbar, dark ? 0.18 : 0.12)
    }
  }
  const tabBar = tint ? mix(accent, base.background, dark ? 0.28 : 0.35) : base.background
  return { tabBar, tabBarText: base.text, toolbar }
}

/** Shrinks an uploaded image so it fits comfortably in local storage. */
export function compressImage(file: File, maxWidth = 2560): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      const scale = Math.min(1, maxWidth / image.width)
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(image.width * scale)
      canvas.height = Math.round(image.height * scale)
      canvas.getContext('2d')?.drawImage(image, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(url)
      resolve(canvas.toDataURL('image/jpeg', 0.85))
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('No se pudo leer la imagen.'))
    }
    image.src = url
  })
}
