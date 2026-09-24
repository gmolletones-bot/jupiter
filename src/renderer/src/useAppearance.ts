import { useEffect, useSyncExternalStore } from 'react'
import { chromeColors, contrastText } from './appearance'
import type { Settings } from './types'

const darkQuery = window.matchMedia('(prefers-color-scheme: dark)')

function subscribeToColorScheme(onChange: () => void): () => void {
  darkQuery.addEventListener('change', onChange)
  return () => darkQuery.removeEventListener('change', onChange)
}

/**
 * Applies the personalization settings as CSS variables and recolours the
 * window buttons. The active page's theme and favicon colours tint the chrome.
 */
export function useAppearance(
  settings: Settings,
  themeColor?: string,
  faviconColor?: string,
  mica = false
): void {
  const dark = useSyncExternalStore(subscribeToColorScheme, () => darkQuery.matches)
  const { accentColor, tintTabBar, cornerRadius, animations, siteColors } = settings
  const theme = siteColors ? themeColor : undefined
  const icon = siteColors ? faviconColor : undefined

  useEffect(() => {
    const root = document.documentElement
    const colors = chromeColors(dark, accentColor, tintTabBar, [theme, icon])
    root.style.setProperty('--accent', accentColor)
    root.style.setProperty('--accent-text', contrastText(accentColor))
    root.style.setProperty('--tabbar-bg', colors.tabBar)
    root.style.setProperty('--tabbar-text', colors.tabBarText)
    root.style.setProperty('--toolbar-bg', colors.toolbar)
    root.style.setProperty('--radius', `${cornerRadius}px`)
    root.dataset.animations = animations ? 'on' : 'off'
    root.dataset.mica = mica ? 'on' : 'off'
    // With Mica the window buttons sit on the see-through strip too.
    window.api.setTitleBarColors({
      color: mica ? '#00000000' : colors.tabBar,
      symbolColor: colors.tabBarText
    })
  }, [dark, accentColor, tintTabBar, cornerRadius, animations, theme, icon, mica])
}
