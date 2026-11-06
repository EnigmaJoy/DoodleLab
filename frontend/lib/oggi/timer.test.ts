import { describe, expect, it } from 'vitest'
import {
  createTimer, formatRemaining, pauseTimer, progress, remainingMs, resetTimer, startTimer, tickTimer,
} from './timer'

const MIN = 60_000

describe('visual timer', () => {
  it('counts down from wall-clock time', () => {
    const t = startTimer(createTimer(25), 0)
    expect(remainingMs(t, 10 * MIN)).toBe(15 * MIN)
    expect(formatRemaining(remainingMs(t, 10 * MIN))).toBe('15:00')
    expect(progress(t, 10 * MIN)).toBeCloseTo(0.4)
  })

  it('pauses and resumes without losing or gaining time', () => {
    let t = startTimer(createTimer(10), 0)
    t = pauseTimer(t, 4 * MIN)
    expect(t.status).toBe('paused')
    // Time passing while paused does not count
    expect(remainingMs(t, 60 * MIN)).toBe(6 * MIN)
    t = startTimer(t, 60 * MIN)
    expect(remainingMs(t, 61 * MIN)).toBe(5 * MIN)
  })

  it('finishes exactly once and restarts from full duration', () => {
    let t = startTimer(createTimer(10), 0)
    t = tickTimer(t, 10 * MIN)
    expect(t.status).toBe('finished')
    expect(tickTimer(t, 11 * MIN)).toBe(t)
    t = startTimer(t, 20 * MIN)
    expect(remainingMs(t, 20 * MIN)).toBe(10 * MIN)
  })

  it('reset returns to idle at full duration', () => {
    const t = resetTimer(pauseTimer(startTimer(createTimer(45), 0), MIN))
    expect(t).toMatchObject({ status: 'idle', remainingMs: 45 * MIN, endsAt: null })
  })

  it('never shows 00:00 before the end', () => {
    expect(formatRemaining(400)).toBe('00:01')
  })
})
