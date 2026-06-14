import { create } from 'zustand'

export type AiProvider = 'openai'

export interface AiSettings {
  enabled: boolean
  provider: AiProvider
  apiKey: string
}

const STORAGE_KEY = 'ai-image-settings'

function loadFromStorage(): AiSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<AiSettings>
      return { enabled: false, provider: 'openai', apiKey: '', ...parsed }
    }
  } catch {}
  return { enabled: false, provider: 'openai', apiKey: '' }
}

interface AiStore {
  settings: AiSettings
  updateSettings: (updates: Partial<AiSettings>) => void
}

export const useAiStore = create<AiStore>((set) => ({
  settings: loadFromStorage(),
  updateSettings: (updates) =>
    set((state) => {
      const next = { ...state.settings, ...updates }
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch {}
      return { settings: next }
    }),
}))
