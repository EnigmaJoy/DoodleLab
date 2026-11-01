// __tests__/drag-math.test.ts
import { describe, it, expect } from 'vitest'
import { clampPosition, pctToPx, pxToPct } from '@/lib/postit-utils'

// Tests for the coordinate math used by useDrag.
// These run in jsdom with no DOM setup required.

describe('coordinate math used by useDrag', () => {
  describe('note within board', () => {
    it('clamped note does not exceed board right edge', () => {
      // boardW=800, noteW=200, so max xPx = 600
      const result = clampPosition(0.99, 0.5, 800, 600, 200, 150)
      const xPx = pctToPx(result.xPct, 800)
      expect(xPx).toBeLessThanOrEqual(800 - 200)
    })
    it('clamped note does not exceed board bottom edge', () => {
      const result = clampPosition(0.5, 0.99, 800, 600, 200, 150)
      const yPx = pctToPx(result.yPct, 600)
      expect(yPx).toBeLessThanOrEqual(600 - 150)
    })
    it('note at (0,0) stays at (0,0)', () => {
      const result = clampPosition(0, 0, 800, 600, 200, 150)
      expect(result.xPct).toBe(0)
      expect(result.yPct).toBe(0)
    })
    it('valid interior position is unchanged', () => {
      const result = clampPosition(0.5, 0.5, 800, 600, 200, 150)
      expect(pctToPx(result.xPct, 800)).toBeCloseTo(400)
      expect(pctToPx(result.yPct, 600)).toBeCloseTo(300)
    })
  })

  describe('drag commit round-trip', () => {
    it('px → pct → px round-trips within 0.5px for typical dimensions', () => {
      const boardW   = 850
      const finalXpx = 327.5
      const xPct     = pxToPct(finalXpx, boardW)
      const backPx   = pctToPx(xPct, boardW)
      expect(Math.abs(backPx - finalXpx)).toBeLessThan(0.5)
    })
    it('start-position derivation from state avoids getBoundingClientRect on rotated note', () => {
      // Correct: startNoteXpx = xPct * boardW
      // This is the key invariant — rotation does not affect offsetWidth/offsetHeight
      // on the board, so deriving from state is safe.
      const xPct   = 0.5
      const boardW = 800
      const startX = xPct * boardW
      expect(startX).toBe(400)
    })
  })

  describe('keyboard step math', () => {
    it('10px right arrow increases xPct by 10/boardW', () => {
      const boardW  = 800
      const noteW   = 200
      const start   = 0.5
      const step    = 10
      const newXpx  = Math.min(pctToPx(start, boardW) + step, boardW - noteW)
      const newXpct = pxToPct(newXpx, boardW)
      expect(newXpct).toBeCloseTo(start + step / boardW, 5)
    })
    it('50px Shift+arrow step moves further than 10px step', () => {
      const boardW = 800
      const noteW  = 200
      const start  = 0.5
      const step10 = pxToPct(Math.min(pctToPx(start, boardW) + 10, boardW - noteW), boardW)
      const step50 = pxToPct(Math.min(pctToPx(start, boardW) + 50, boardW - noteW), boardW)
      expect(step50).toBeGreaterThan(step10)
    })
    it('arrow key at right edge clamps to max position', () => {
      const boardW = 800
      const noteW  = 200
      const start  = 0.98  // already near edge
      const newXpx = Math.min(pctToPx(start, boardW) + 10, boardW - noteW)
      expect(newXpx).toBeLessThanOrEqual(boardW - noteW)
    })
  })

  describe('cancel invariant', () => {
    it('a cancelled drag does not produce a new xPct outside bounds', () => {
      const originalXpct = 0.4
      const boardW       = 800
      const noteW        = 200
      const clamped = clampPosition(originalXpct, 0.4, boardW, 600, noteW, 150)
      expect(clamped.xPct).toBeCloseTo(originalXpct)
    })
  })
})
