// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { PALETTES, PALETTE_COUNT } from './palettes'

describe('PALETTES', () => {
  it('has 8 entries', () => {
    expect(PALETTES).toHaveLength(8)
  })

  it('every entry has a valid from hex', () => {
    for (const p of PALETTES) {
      expect(p.from, `palette ${p.id} missing from`).toMatch(/^#[0-9a-f]{6}$/i)
    }
  })

  it('every entry has a valid to hex', () => {
    for (const p of PALETTES) {
      expect(p.to, `palette ${p.id} missing to`).toMatch(/^#[0-9a-f]{6}$/i)
    }
  })

  it('PALETTE_COUNT matches array length', () => {
    expect(PALETTE_COUNT).toBe(PALETTES.length)
  })
})
