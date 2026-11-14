import { create } from 'zustand'

export type ThemeMode = 'light' | 'dark' | 'system'
const KEY = 'fs-theme'
const media = () => window.matchMedia('(prefers-color-scheme: dark)')

function read(): ThemeMode {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'light' || v === 'dark' ? v : 'system'
  } catch {
    return 'system'
  }
}

function resolve(mode: ThemeMode) {
  return mode === 'system' ? (media().matches ? 'dark' : 'light') : mode
}

function apply(mode: ThemeMode) {
  document.documentElement.classList.toggle('dark', resolve(mode) === 'dark')
}

interface ThemeState {
  mode: ThemeMode
  resolved: 'light' | 'dark'
  setMode: (m: ThemeMode) => void
}

export const useTheme = create<ThemeState>((set) => ({
  mode: read(),
  resolved: resolve(read()),
  setMode: (mode) => {
    try {
      localStorage.setItem(KEY, mode)
    } catch {
      /* modo privado */
    }
    apply(mode)
    set({ mode, resolved: resolve(mode) })
  },
}))

media().addEventListener('change', () => {
  const { mode } = useTheme.getState()
  if (mode !== 'system') return
  apply(mode)
  useTheme.setState({ resolved: resolve(mode) })
})
