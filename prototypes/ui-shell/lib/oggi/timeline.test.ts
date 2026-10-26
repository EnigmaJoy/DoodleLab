import { describe, expect, it } from 'vitest'
import { buildTimeline, layoutLanes } from './timeline'
import type { CalendarItem } from '../calendar-mock'
import type { TimeBlock } from './types'

const event: CalendarItem = {
  id: 'e1', date: '2026-10-26', kind: 'event', title: 'Riunione', time: '09:00',
  detail: { timeEnd: '10:00' },
}
const postit: CalendarItem = { id: 'p1', date: '2026-10-26', kind: 'postit', title: 'Nota', time: '09:30' }
const untimed: CalendarItem = { id: 'p2', date: '2026-10-26', kind: 'postit', title: 'Senza ora' }
const block: TimeBlock = {
  id: 'b1', day: '2026-10-26', title: 'Blocco', start: 630, duration: 90,
  timeZone: 'Europe/Rome', createdAt: 0, updatedAt: 0,
}

describe('buildTimeline', () => {
  it('references source entities instead of copying them', () => {
    const { timed } = buildTimeline([event, postit], [block])
    const eventEntry = timed.find(e => e.key === 'event:e1')!
    expect(eventEntry.source).toBe(event)
    expect(timed.find(e => e.key === 'block:b1')!.source).toBe(block)
  })

  it('uses explicit end times when present and flags inferred ones', () => {
    const { timed } = buildTimeline([event, postit], [])
    expect(timed[0]).toMatchObject({ start: 540, end: 600, hasEnd: true })
    expect(timed[1]).toMatchObject({ start: 570, hasEnd: false })
  })

  it('separates items without a time', () => {
    const { timed, untimed: rest } = buildTimeline([untimed], [])
    expect(timed).toHaveLength(0)
    expect(rest).toEqual([untimed])
  })
})

describe('layoutLanes', () => {
  it('puts overlapping entries side by side and isolated ones full width', () => {
    const { timed } = buildTimeline([event, postit], [block])
    const lanes = layoutLanes(timed)
    expect(lanes.get('event:e1')).toEqual({ lane: 0, lanes: 2 })
    expect(lanes.get('postit:p1')).toEqual({ lane: 1, lanes: 2 })
    expect(lanes.get('block:b1')).toEqual({ lane: 0, lanes: 1 })
  })
})
