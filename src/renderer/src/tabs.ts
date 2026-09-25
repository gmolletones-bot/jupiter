import { loadSession } from './storage'
import type { InternalPage, Settings, Tab } from './types'
import { INTERNAL_PAGES, internalPageOf, NEW_TAB_URL, upgradeInternalUrl } from './url'

let nextId = 1

export function createWebTab(url: string): Tab {
  return {
    id: nextId++,
    kind: 'web',
    initialUrl: url,
    url,
    address: url,
    title: 'Nueva pestaña',
    isLoading: true,
    canGoBack: false,
    canGoForward: false
  }
}

export function createInternalTab(page: InternalPage): Tab {
  const { url, title } = INTERNAL_PAGES[page]
  return {
    id: nextId++,
    kind: page,
    initialUrl: url,
    url,
    address: url,
    title,
    isLoading: false,
    canGoBack: false,
    canGoForward: false
  }
}

export function createNewTabPage(): Tab {
  return {
    id: nextId++,
    kind: 'newtab',
    initialUrl: NEW_TAB_URL,
    url: NEW_TAB_URL,
    address: '',
    title: 'Nueva pestaña',
    isLoading: false,
    canGoBack: false,
    canGoForward: false
  }
}

/** Builds the right kind of tab for a URL, including the internal jupiter:// pages. */
export function createTab(savedUrl: string): Tab {
  const url = upgradeInternalUrl(savedUrl)
  if (url === NEW_TAB_URL) return createNewTabPage()
  const page = internalPageOf(url)
  return page ? createInternalTab(page) : createWebTab(url)
}

export interface TabsState {
  tabs: Tab[]
  activeId: number
}

export type TabsAction =
  | { type: 'open'; tab: Tab; activate: boolean }
  | { type: 'replace'; id: number; tab: Tab }
  | { type: 'close'; id: number; fallback: Tab }
  | { type: 'activate'; id: number }
  | { type: 'cycle'; step: 1 | -1 }
  | { type: 'update'; id: number; patch: Partial<Tab> }

export function createInitialTabs(settings: Settings): TabsState {
  const session = settings.startup === 'restore' ? loadSession() : null
  const tabs = (session?.urls ?? [settings.homePage]).map(createTab)
  const active = tabs[Math.min(session?.activeIndex ?? 0, tabs.length - 1)] ?? tabs[0]
  return { tabs, activeId: active.id }
}

export function tabsReducer(state: TabsState, action: TabsAction): TabsState {
  switch (action.type) {
    case 'open':
      return {
        tabs: [...state.tabs, action.tab],
        activeId: action.activate ? action.tab.id : state.activeId
      }

    case 'replace':
      return {
        tabs: state.tabs.map((tab) => (tab.id === action.id ? action.tab : tab)),
        activeId: state.activeId === action.id ? action.tab.id : state.activeId
      }

    case 'close': {
      const index = state.tabs.findIndex((tab) => tab.id === action.id)
      if (index === -1) return state
      const tabs = state.tabs.filter((tab) => tab.id !== action.id)
      // Closing the last tab leaves a fresh one instead of an empty window.
      if (tabs.length === 0) return { tabs: [action.fallback], activeId: action.fallback.id }
      if (state.activeId !== action.id) return { ...state, tabs }
      const neighbour = tabs[index] ?? tabs[index - 1]
      return { tabs, activeId: neighbour.id }
    }

    case 'activate':
      return { ...state, activeId: action.id }

    case 'cycle': {
      const index = state.tabs.findIndex((tab) => tab.id === state.activeId)
      const next = (index + action.step + state.tabs.length) % state.tabs.length
      return { ...state, activeId: state.tabs[next].id }
    }

    case 'update':
      return {
        ...state,
        tabs: state.tabs.map((tab) => (tab.id === action.id ? { ...tab, ...action.patch } : tab))
      }
  }
}
