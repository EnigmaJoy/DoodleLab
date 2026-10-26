// Node re-reads TZ when it is assigned; pin a zone with DST for these tests
process.env.TZ = 'Europe/Rome'

import { describe, expect, it } from 'vitest'
import {
  DAY_MINUTES, FIXED_WITHOUT_END_MINUTES, durationLabel, fixedIntervals, localTimeExists, nextFreeStart,
  proposeMove, proposeResizeEnd, proposeResizeStart, slotLabel, snapMinutes, validatePlacement,
} from './time-blocks'
import type { CalendarItem } from '../calendar-mock'

const DAY = '2026-10-26'
const meeting: CalendarItem = {
  id: 'e1', date: DAY, kind: 'event', title: 'Riunione', time: '09:00', detail: { timeEnd: '10:00' },
}
const reminder: CalendarItem = { id: 'r1', date: DAY, kind: 'reminder', title: 'Pacco', time: '12:30' }
const postit: CalendarItem   = { id: 'p1', date: DAY, kind: 'postit', title: 'Regalo', time: '14:00' }
const noEnd: CalendarItem    = { id: 'e2', date: DAY, kind: 'event', title: 'Call', time: '16:00' }
const fixed = fixedIntervals([meeting, reminder, postit, noEnd])

describe('snapping', () => {
  it('snaps to the nearest 15 minutes', () => {
    expect(snapMinutes(667)).toBe(660)
    expect(snapMinutes(668)).toBe(675)
    expect(snapMinutes(-3)).toBe(-0)
  })
})

describe('fixed intervals', () => {
  it('protects only appointments, not reminders or PostIts', () => {
    expect(fixed.map(f => f.id)).toEqual(['e1', 'e2'])
  })

  it('protects the drawn footprint of an appointment without an end', () => {
    expect(fixed[1]).toMatchObject({ start: 960, end: 960 + FIXED_WITHOUT_END_MINUTES })
  })
})

describe('validatePlacement', () => {
  it('accepts a free slot', () => {
    expect(validatePlacement(DAY, { start: 630, duration: 60 }, fixed)).toBeNull()
  })

  it('rejects overlap with a fixed appointment, including partial overlap', () => {
    expect(validatePlacement(DAY, { start: 570, duration: 60 }, fixed)).toMatchObject({ type: 'overlap', conflict: { id: 'e1' } })
    expect(validatePlacement(DAY, { start: 495, duration: 60 }, fixed)).toMatchObject({ type: 'overlap' })
  })

  it('allows touching edges of an appointment', () => {
    expect(validatePlacement(DAY, { start: 480, duration: 60 }, fixed)).toBeNull()
    expect(validatePlacement(DAY, { start: 600, duration: 60 }, fixed)).toBeNull()
  })

  it('allows overlapping reminders and PostIts', () => {
    expect(validatePlacement(DAY, { start: 720, duration: 120 }, fixed)).toBeNull()
  })

  it('rejects zero, negative and too short durations', () => {
    expect(validatePlacement(DAY, { start: 600, duration: 0 }, fixed)?.type).toBe('too-short')
    expect(validatePlacement(DAY, { start: 600, duration: -15 }, fixed)?.type).toBe('too-short')
    expect(validatePlacement(DAY, { start: 600, duration: 10 }, fixed)?.type).toBe('too-short')
  })

  it('keeps blocks inside the local day (no crossing midnight)', () => {
    expect(validatePlacement(DAY, { start: 23 * 60, duration: 60 }, fixed)).toBeNull()
    expect(validatePlacement(DAY, { start: 23 * 60 + 30, duration: 60 }, fixed)?.type).toBe('outside-day')
    expect(validatePlacement(DAY, { start: -15, duration: 60 }, fixed)?.type).toBe('outside-day')
    expect(validatePlacement(DAY, { start: NaN, duration: 60 }, fixed)?.type).toBe('outside-day')
  })
})

describe('daylight saving time (Europe/Rome)', () => {
  it('rejects wall-clock times skipped by the spring jump', () => {
    // 2026-03-29: clocks go from 02:00 to 03:00
    expect(localTimeExists('2026-03-29', 2 * 60 + 30)).toBe(false)
    expect(validatePlacement('2026-03-29', { start: 150, duration: 60 }, [])?.type).toBe('nonexistent-time')
    expect(localTimeExists('2026-03-29', 3 * 60)).toBe(true)
  })

  it('accepts the repeated hour in autumn (wall-clock based)', () => {
    // 2026-10-25: 02:00-03:00 happens twice; the wall time exists
    expect(validatePlacement('2026-10-25', { start: 150, duration: 60 }, [])).toBeNull()
  })
})

describe('gesture proposals', () => {
  const origin = { start: 630, duration: 90 } // 10:30 - 12:00

  it('moves keep the duration and snap the start', () => {
    expect(proposeMove(origin, 41)).toEqual({ start: 675, duration: 90 }) // 11:15
    expect(proposeMove(origin, -7)).toEqual({ start: 630, duration: 90 })
  })

  it('top handle keeps the end', () => {
    const r = proposeResizeStart(origin, -30)
    expect(r).toEqual({ start: 600, duration: 120 })
    expect(r.start + r.duration).toBe(720)
  })

  it('bottom handle keeps the start', () => {
    expect(proposeResizeEnd(origin, 44)).toEqual({ start: 630, duration: 135 })
  })

  it('resizing past the opposite edge produces an invalid (non-positive) duration', () => {
    const r = proposeResizeEnd(origin, -120)
    expect(r.duration).toBeLessThanOrEqual(0)
    expect(validatePlacement(DAY, r, [])?.type).toBe('too-short')
  })
})

describe('nextFreeStart', () => {
  it('finds the first free quarter hour after a time, skipping appointments', () => {
    expect(nextFreeStart(DAY, 9 * 60 + 5, 60, fixed)).toBe(600) // after the 09:00-10:00 meeting
  })

  it('returns null when no slot fits before midnight', () => {
    expect(nextFreeStart(DAY, DAY_MINUTES - 30, 60, fixed)).toBeNull()
  })
})

describe('block labels', () => {
  it('derive times and duration from the stored slot', () => {
    expect(slotLabel({ start: 630, duration: 90 })).toBe('10:30 - 12:00')
    expect(durationLabel({ start: 630, duration: 90 })).toBe('90 minuti')
    expect(durationLabel({ start: 630, duration: 45 })).toBe('45 minuti')
  })
})
