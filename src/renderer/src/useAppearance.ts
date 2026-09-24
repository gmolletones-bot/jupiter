import { useEffect, useSyncExternalStore } from 'react'
import { contrastText, tabBarColors } from './appearance'
import type { Settings } from './types'

const darkQuery = window.matchMedia('(prefers-color-scheme: dark)')

function subscribeToColorScheme(onChange: () => void): () => void {
  darkQuery.addEventListener('change', onChange)
  return () => darkQuery.removeEventListener('change', onChange)
}

/** Applies the personalization settings as CSS variables and recolours the window buttons. */
export function useAppearance(settings: Settings): void {
  const dark = useSyncExternalStore(subscribeToColorScheme, () => darkQuery.matches)
  const { accentColor, tintTabBar, cornerRadius, animations } = settings

  useEffect(() => {
    const root = document.documentElement
    const tabBar = tabBarColors(dark, accentColor, tintTabBar)
    root.style.setProperty('--accent', accentColor)
    root.style.setProperty('--accent-text', contrastText(accentColor))
    root.style.setProperty('--tabbar-bg', tabBar.background)
    root.style.setProperty('--radius', `${cornerRadius}px`)
    root.dataset.animations = animations ? 'on' : 'off'
    window.api.setTitleBarColors({ color: tabBar.background, symbolColor: tabBar.text })
  }, [dark, accentColor, tintTabBar, cornerRadius, animations])
}
