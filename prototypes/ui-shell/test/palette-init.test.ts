import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildPaletteInitScript } from '@/lib/paletteInitScript'
import { PALETTES } from '@/lib/palettes'

const run = () => new Function(buildPaletteInitScript())()

beforeEach(() => {
  localStorage.clear()
  document.documentElement.setAttribute('data-palette', 'notte-lavanda')
})
afterEach(() => vi.restoreAllMocks())

describe('buildPaletteInitScript', () => {
  it('applies a stored valid id', () => {
    localStorage.setItem('agenda.palette', 'bosco-laguna')
    run()
    expect(document.documentElement.getAttribute('data-palette')).toBe('bosco-laguna')
  })
  it('ignores an invalid stored value', () => {
    localStorage.setItem('agenda.palette', '3')
    run()
    expect(document.documentElement.getAttribute('data-palette')).toBe('notte-lavanda')
  })
  it('does not throw when storage access throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked') })
    expect(run).not.toThrow()
    expect(document.documentElement.getAttribute('data-palette')).toBe('notte-lavanda')
  })
  it('applies every PALETTES id', () => {
    for (const p of PALETTES) {
      document.documentElement.setAttribute('data-palette', 'notte-lavanda')
      localStorage.setItem('agenda.palette', p.id)
      run()
      expect(document.documentElement.getAttribute('data-palette')).toBe(p.id)
    }
  })
})
