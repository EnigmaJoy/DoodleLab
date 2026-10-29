import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { applyPalette, readStoredPaletteId } from '@/lib/palettePreference'

beforeEach(() => {
  localStorage.clear()
  delete document.documentElement.dataset.palette
})
afterEach(() => vi.restoreAllMocks())

describe('readStoredPaletteId', () => {
  it('returns a stored valid id', () => {
    localStorage.setItem('agenda.palette', 'tramonto')
    expect(readStoredPaletteId()).toBe('tramonto')
  })
  it('falls back for legacy numeric value', () => {
    localStorage.setItem('agenda.palette', '3')
    expect(readStoredPaletteId()).toBe('notte-lavanda')
  })
  it('falls back for garbage', () => {
    localStorage.setItem('agenda.palette', '<script>')
    expect(readStoredPaletteId()).toBe('notte-lavanda')
  })
  it('falls back when getItem throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked') })
    expect(readStoredPaletteId()).toBe('notte-lavanda')
  })
})

describe('applyPalette', () => {
  it('sets dataset and storage', () => {
    applyPalette('inchiostro')
    expect(document.documentElement.dataset.palette).toBe('inchiostro')
    expect(localStorage.getItem('agenda.palette')).toBe('inchiostro')
  })
  it('still sets dataset when setItem throws', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota') })
    expect(() => applyPalette('inchiostro')).not.toThrow()
    expect(document.documentElement.dataset.palette).toBe('inchiostro')
  })
})
