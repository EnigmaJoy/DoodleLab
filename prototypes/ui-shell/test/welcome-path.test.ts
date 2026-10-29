import { describe, expect, it } from 'vitest'
import { WELCOME_PATH } from '@/lib/welcome-path'

function coords(d: string): Array<[number, number]> {
  const nums = (d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number)
  const pairs: Array<[number, number]> = []
  for (let i = 0; i + 1 < nums.length; i += 2) pairs.push([nums[i]!, nums[i + 1]!])
  return pairs
}

// cubic-bezier(0.45, 0, 0.25, 1), computed here independently of the generator script.
function bez(p1: number, p2: number, t: number): number {
  const u = 1 - t
  return 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t
}

// CSS easing maps time x -> progress y. For a progress y, return the time x(u) with y(u) = y.
function timeForProgress(y: number): number {
  let lo = 0
  let hi = 1
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2
    if (bez(0, 1, mid) < y) lo = mid
    else hi = mid
  }
  return bez(0.45, 0.25, (lo + hi) / 2)
}

describe('WELCOME_PATH', () => {
  const { strokes, viewBox } = WELCOME_PATH

  it('has strokes', () => {
    expect(strokes.length).toBeGreaterThan(0)
  })

  it('every stroke has a positive length', () => {
    for (const s of strokes) expect(s.length).toBeGreaterThan(0)
  })

  it('delays are non-decreasing and start at 200ms', () => {
    expect(strokes[0]!.delayMs).toBe(200)
    for (let i = 1; i < strokes.length; i++) {
      expect(strokes[i]!.delayMs).toBeGreaterThanOrEqual(strokes[i - 1]!.delayMs)
    }
  })

  it('the last stroke ends at 2800ms', () => {
    const end = Math.max(...strokes.map(s => s.delayMs + s.durationMs))
    expect(Math.abs(end - 2800)).toBeLessThanOrEqual(1)
  })

  it('strokes are ordered left to right by their minimum x', () => {
    const minX = strokes.map(s => Math.min(...coords(s.d).map(([x]) => x)))
    for (let i = 1; i < minX.length; i++) {
      expect(minX[i]!).toBeGreaterThanOrEqual(minX[i - 1]!)
    }
  })

  it('every stroke is a single closed contour starting with M', () => {
    for (const s of strokes) {
      expect(s.d.startsWith('M')).toBe(true)
      expect(s.d.match(/M/g)!.length).toBe(1)
    }
  })

  it('viewBox aspect ratio is between 3.0 and 3.8', () => {
    const [, , w, h] = viewBox.split(/\s+/).map(Number)
    const ratio = w! / h!
    expect(ratio).toBeGreaterThanOrEqual(3.0)
    expect(ratio).toBeLessThanOrEqual(3.8)
  })

  it('the last stroke gets at least 200ms (the end of the word does not pop in)', () => {
    expect(strokes[strokes.length - 1]!.durationMs).toBeGreaterThanOrEqual(200)
  })

  it('the stroke holding the 50% length point starts where the easing puts 50% progress', () => {
    const total = strokes.reduce((sum, s) => sum + s.length, 0)
    let acc = 0
    const mid = strokes.find(s => {
      const before = acc
      acc += s.length
      return before <= total / 2 && total / 2 <= acc
    })!
    const expected = 200 + 2600 * timeForProgress(0.5)
    expect(Math.abs(mid.delayMs - expected)).toBeLessThanOrEqual(60)
    // Each stroke draws linearly in its window, so the 50% point itself is also on time.
    const before = strokes.slice(0, strokes.indexOf(mid)).reduce((sum, s) => sum + s.length, 0)
    const halfTime = mid.delayMs + mid.durationMs * ((total / 2 - before) / mid.length)
    expect(Math.abs(halfTime - expected)).toBeLessThanOrEqual(60)
  })
})
