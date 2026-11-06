// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    back: vi.fn(),
  }),
}))

vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: { user: { email: 'test@example.com' } } }),
}))

const setPaletteIdMock     = vi.fn()
const setVisualEffectsMock = vi.fn()
const setAutoLockMock      = vi.fn()

vi.mock('@/lib/PreferencesContext', () => ({
  usePreferences: () => ({
    preferences: {
      paletteId:       1,
      visualEffects:   true,
      autoLockMinutes: 5,
    },
    setPaletteId:       setPaletteIdMock,
    setVisualEffects:   setVisualEffectsMock,
    setAutoLockMinutes: setAutoLockMock,
  }),
}))

import { Settings } from './Settings'

beforeEach(() => { vi.clearAllMocks() })

describe('Settings', () => {

  it('1. renders a heading "Impostazioni"', () => {
    render(<Settings />)
    expect(screen.getByRole('heading', { name: 'Impostazioni' })).toBeTruthy()
  })

  it('2. back button exists', () => {
    render(<Settings />)
    const back = screen.getByRole('button', { name: /indietro/i })
    expect(back).toBeTruthy()
  })

  it('3. renders 8 palette tiles', () => {
    render(<Settings />)
    const group = screen.getByRole('radiogroup', { name: 'Palette colore' })
    const tiles = group.querySelectorAll('[role="radio"]')
    expect(tiles.length).toBe(8)
  })

  it('4. palette tile 1 is aria-checked (active)', () => {
    render(<Settings />)
    const group = screen.getByRole('radiogroup', { name: 'Palette colore' })
    const firstTile = group.querySelectorAll('[role="radio"]')[0] as HTMLElement
    expect(firstTile.getAttribute('aria-checked')).toBe('true')
  })

  it('5. clicking palette tile 3 calls setPaletteId(3)', () => {
    render(<Settings />)
    const group = screen.getByRole('radiogroup', { name: 'Palette colore' })
    const tile3 = group.querySelectorAll('[role="radio"]')[2] as HTMLElement
    fireEvent.click(tile3)
    expect(setPaletteIdMock).toHaveBeenCalledWith(3)
  })

  it('6. visual effects toggle is aria-checked=true (effects on)', () => {
    render(<Settings />)
    const toggle = screen.getByRole('switch', { name: 'Effetti visivi' })
    expect(toggle.getAttribute('aria-checked')).toBe('true')
  })

  it('7. clicking visual effects toggle calls setVisualEffects(false)', () => {
    render(<Settings />)
    const toggle = screen.getByRole('switch', { name: 'Effetti visivi' })
    fireEvent.click(toggle)
    expect(setVisualEffectsMock).toHaveBeenCalledWith(false)
  })

  it('8. auto-lock control renders 4 segments', () => {
    render(<Settings />)
    const group = screen.getByRole('radiogroup', { name: 'Blocco automatico' })
    const segments = group.querySelectorAll('[role="radio"]')
    expect(segments.length).toBe(4)
  })

  it('9. clicking "30 min" segment calls setAutoLockMinutes(30)', () => {
    render(<Settings />)
    fireEvent.click(screen.getByRole('radio', { name: '30 min' }))
    expect(setAutoLockMock).toHaveBeenCalledWith(30)
  })

  it('10. account row shows user email', () => {
    render(<Settings />)
    expect(screen.getByText('test@example.com')).toBeTruthy()
  })

})
