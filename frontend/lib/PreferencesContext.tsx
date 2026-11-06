// lib/PreferencesContext.tsx
'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { PALETTES, DEFAULT_PALETTE_ID } from './palettes'

export interface Preferences {
  paletteId:       number
  visualEffects:   boolean
  autoLockMinutes: 1 | 5 | 30 | null
}

const DEFAULT_PREFERENCES: Preferences = {
  paletteId:       DEFAULT_PALETTE_ID,
  visualEffects:   true,
  autoLockMinutes: 5,
}

const STORAGE_KEY = 'doodlelab:preferences:v1'

interface PreferencesContextValue {
  preferences:        Preferences
  setPaletteId:       (id: number) => void
  setVisualEffects:   (on: boolean) => void
  setAutoLockMinutes: (minutes: 1 | 5 | 30 | null) => void
}

const PreferencesContext = createContext<PreferencesContextValue | null>(null)

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState<Preferences>(DEFAULT_PREFERENCES)

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        setPreferences({ ...DEFAULT_PREFERENCES, ...JSON.parse(stored) })
      }
    } catch {
      // Ignore parse errors; fall back to defaults
    }
  }, [])

  // Apply palette CSS vars and data-palette attribute whenever paletteId changes
  useEffect(() => {
    const palette = PALETTES.find(p => p.id === preferences.paletteId)
    if (!palette) return
    document.documentElement.setAttribute('data-palette', String(palette.id))
    document.documentElement.style.removeProperty('--gradient-start')
    document.documentElement.style.removeProperty('--gradient-end')
  }, [preferences.paletteId])

  // Apply visual effects flag
  useEffect(() => {
    if (preferences.visualEffects) {
      document.documentElement.removeAttribute('data-no-effects')
    } else {
      document.documentElement.setAttribute('data-no-effects', '')
    }
  }, [preferences.visualEffects])

  // Persist preferences to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences))
  }, [preferences])

  function update(partial: Partial<Preferences>) {
    setPreferences(prev => ({ ...prev, ...partial }))
  }

  return (
    <PreferencesContext.Provider value={{
      preferences,
      setPaletteId:       (id) => update({ paletteId: id }),
      setVisualEffects:   (on) => update({ visualEffects: on }),
      setAutoLockMinutes: (minutes) => update({ autoLockMinutes: minutes }),
    }}>
      {children}
    </PreferencesContext.Provider>
  )
}

export function usePreferences(): PreferencesContextValue {
  const ctx = useContext(PreferencesContext)
  if (!ctx) throw new Error('usePreferences must be used inside PreferencesProvider')
  return ctx
}
