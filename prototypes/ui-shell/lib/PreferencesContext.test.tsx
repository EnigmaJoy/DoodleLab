// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import React from 'react'

// Spy before importing the module under test
const setPropertySpy = vi.spyOn(document.documentElement.style, 'setProperty')

import { PreferencesProvider, usePreferences } from './PreferencesContext'

// Helper: a component that exposes context values via data attributes
function Inspector() {
  const { preferences, setPaletteId, setVisualEffects, setAutoLockMinutes } = usePreferences()
  return (
    <div
      data-testid="inspector"
      data-palette={preferences.paletteId}
      data-effects={String(preferences.visualEffects)}
      data-lock={String(preferences.autoLockMinutes)}
    >
      <button onClick={() => setPaletteId(3)}>setPalette3</button>
      <button onClick={() => setVisualEffects(false)}>disableEffects</button>
      <button onClick={() => setAutoLockMinutes(30)}>setLock30</button>
    </div>
  )
}

function setup() {
  render(
    <PreferencesProvider>
      <Inspector />
    </PreferencesProvider>,
  )
  return screen.getByTestId('inspector')
}

beforeEach(() => {
  localStorage.clear()
  setPropertySpy.mockClear()
  document.documentElement.removeAttribute('data-no-effects')
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('PreferencesContext', () => {

  it('1. provides defaults when localStorage is empty', () => {
    const el = setup()
    expect(el.dataset.palette).toBe('1')
    expect(el.dataset.effects).toBe('true')
    expect(el.dataset.lock).toBe('5')
  })

  it('2. setPaletteId updates preferences and sets CSS vars', async () => {
    setup()
    await act(async () => {
      screen.getByText('setPalette3').click()
    })
    expect(screen.getByTestId('inspector').dataset.palette).toBe('3')
    expect(setPropertySpy).toHaveBeenCalledWith('--gradient-start', '#22c55e')
    expect(setPropertySpy).toHaveBeenCalledWith('--gradient-end', '#0d9488')
  })

  it('3. setPaletteId persists to localStorage', async () => {
    setup()
    await act(async () => {
      screen.getByText('setPalette3').click()
    })
    const stored = JSON.parse(localStorage.getItem('doodlelab:preferences:v1')!)
    expect(stored.paletteId).toBe(3)
  })

  it('4. setVisualEffects(false) adds data-no-effects to html', async () => {
    setup()
    expect(document.documentElement.hasAttribute('data-no-effects')).toBe(false)
    await act(async () => {
      screen.getByText('disableEffects').click()
    })
    expect(document.documentElement.hasAttribute('data-no-effects')).toBe(true)
  })

  it('5. setAutoLockMinutes persists to localStorage', async () => {
    setup()
    await act(async () => {
      screen.getByText('setLock30').click()
    })
    const stored = JSON.parse(localStorage.getItem('doodlelab:preferences:v1')!)
    expect(stored.autoLockMinutes).toBe(30)
  })

  it('6. loads saved preferences from localStorage on mount', () => {
    localStorage.setItem(
      'doodlelab:preferences:v1',
      JSON.stringify({ paletteId: 5, visualEffects: false, autoLockMinutes: 30 }),
    )
    const el = setup()
    expect(el.dataset.palette).toBe('5')
    expect(el.dataset.effects).toBe('false')
    expect(el.dataset.lock).toBe('30')
  })

})
