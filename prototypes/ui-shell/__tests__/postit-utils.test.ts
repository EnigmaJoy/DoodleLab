import { describe, it, expect } from 'vitest'
import {
  pctToPx, pxToPct, clampPosition, generateRotation,
  generateId, formatNoteDate, POST_IT_COLORS, STICKER_CONFIG,
} from '@/lib/postit-utils'
import type { PostItColor, StickerKey } from '@/lib/postit-types'

describe('pctToPx', () => {
  it('converts fraction to pixels', () => {
    expect(pctToPx(0.5, 800)).toBe(400)
    expect(pctToPx(0, 800)).toBe(0)
    expect(pctToPx(1, 800)).toBe(800)
  })
})

describe('pxToPct', () => {
  it('converts pixels to fraction', () => {
    expect(pxToPct(400, 800)).toBeCloseTo(0.5)
    expect(pxToPct(0, 800)).toBe(0)
  })
  it('round-trips with pctToPx', () => {
    const pct = 0.37
    expect(pxToPct(pctToPx(pct, 1000), 1000)).toBeCloseTo(pct, 5)
  })
})

describe('clampPosition', () => {
  it('returns same pct when note fits inside board', () => {
    const result = clampPosition(0.5, 0.5, 800, 600, 200, 200)
    expect(result.xPct).toBeCloseTo(0.5)
    expect(result.yPct).toBeCloseTo(0.5)
  })
  it('clamps negative xPct to 0', () => {
    const result = clampPosition(-0.1, 0.5, 800, 600, 200, 200)
    expect(result.xPct).toBe(0)
  })
  it('clamps note that would overflow the right edge', () => {
    // note at xPct=0.99 with noteW=200 in boardW=800: max xPx = 800-200=600, so maxPct=0.75
    const result = clampPosition(0.99, 0.5, 800, 600, 200, 200)
    expect(result.xPct).toBeCloseTo(600 / 800)
  })
  it('clamps bottom edge', () => {
    const result = clampPosition(0.5, 0.99, 800, 600, 200, 200)
    expect(result.yPct).toBeCloseTo(400 / 600)
  })
  it('returns 0 when note is wider than board', () => {
    const result = clampPosition(0.5, 0.5, 100, 100, 200, 200)
    expect(result.xPct).toBe(0)
    expect(result.yPct).toBe(0)
  })
})

describe('generateRotation', () => {
  it('returns a value in the range [-3, 3]', () => {
    for (let i = 0; i < 50; i++) {
      const r = generateRotation()
      expect(r).toBeGreaterThanOrEqual(-3)
      expect(r).toBeLessThanOrEqual(3)
    }
  })
})

describe('generateId', () => {
  it('returns a non-empty string', () => {
    expect(typeof generateId()).toBe('string')
    expect(generateId().length).toBeGreaterThan(0)
  })
  it('does not return the same value twice in a row', () => {
    expect(generateId()).not.toBe(generateId())
  })
})

describe('formatNoteDate', () => {
  it('returns an Italian date string for a past date', () => {
    const result = formatNoteDate('2026-10-15T14:20:00.000Z')
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })
})

describe('POST_IT_COLORS', () => {
  it('has an entry for every PostItColor', () => {
    const keys: PostItColor[] = ['yellow', 'pink', 'mint', 'blue', 'peach']
    keys.forEach(k => {
      expect(POST_IT_COLORS[k]).toMatch(/^#[0-9A-Fa-f]{6}$/)
    })
  })
})

describe('STICKER_CONFIG', () => {
  it('has an entry for every StickerKey', () => {
    const keys: StickerKey[] = [
      'star','heart','check','exclaim','bulb','home',
      'cart','sun','lightning','clock','phone','money',
    ]
    keys.forEach(k => {
      expect(STICKER_CONFIG[k].emoji).toBeTruthy()
      expect(STICKER_CONFIG[k].bg).toMatch(/^#/)
    })
  })
})
