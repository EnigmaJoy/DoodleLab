import { describe, expect, it } from 'vitest'
import { IDLE, LONG_PRESS_MS, MOVE_TOLERANCE_PX, pressStep, type PressEvent, type PressState } from './press-gesture'

function run(events: PressEvent[], start: PressState = IDLE) {
  let state = start
  const outcomes: string[] = []
  for (const event of events) {
    const step = pressStep(state, event)
    state = step.state
    if (step.outcome !== 'none') outcomes.push(step.outcome)
  }
  return { state, outcomes }
}

const down = (t = 0, x = 100, y = 100): PressEvent => ({ type: 'down', pointerId: 1, x, y, t })

describe('press gesture', () => {
  it('a short click is a tap, never an activation', () => {
    expect(run([down(), { type: 'up', pointerId: 1, t: 120 }]).outcomes).toEqual(['tap'])
  })

  it('a still press activates after the long-press delay', () => {
    const r = run([down(), { type: 'timer', t: LONG_PRESS_MS }])
    expect(r.outcomes).toEqual(['activate'])
    expect(r.state.phase).toBe('active')
  })

  it('an early timer does not activate', () => {
    expect(run([down(), { type: 'timer', t: LONG_PRESS_MS - 1 }]).state.phase).toBe('pending')
  })

  it('small jitter is tolerated during the press', () => {
    const r = run([down(), { type: 'move', pointerId: 1, x: 103, y: 104 }, { type: 'timer', t: LONG_PRESS_MS }])
    expect(r.outcomes).toEqual(['activate'])
  })

  it('moving before activation is a scroll and abandons the press', () => {
    const r = run([
      down(),
      { type: 'move', pointerId: 1, x: 100, y: 100 + MOVE_TOLERANCE_PX + 1 },
      { type: 'timer', t: LONG_PRESS_MS },
    ])
    expect(r.outcomes).toEqual(['abandon'])
    expect(r.state).toEqual(IDLE)
  })

  it('browser pointercancel before activation (native scroll) abandons', () => {
    expect(run([down(), { type: 'cancel', pointerId: 1 }]).outcomes).toEqual(['abandon'])
  })

  it('drag after activation, then drop commits', () => {
    const r = run([
      down(), { type: 'timer', t: 600 },
      { type: 'move', pointerId: 1, x: 100, y: 200 },
      { type: 'up', pointerId: 1, t: 900 },
    ])
    expect(r.outcomes).toEqual(['activate', 'drag', 'drop'])
  })

  it('cancellation while active restores (cancel outcome)', () => {
    const r = run([down(), { type: 'timer', t: 600 }, { type: 'cancel', pointerId: 1 }])
    expect(r.outcomes).toEqual(['activate', 'cancel'])
  })

  it('immediate handles activate without waiting', () => {
    expect(run([{ ...down(), immediate: true } as PressEvent]).outcomes).toEqual(['activate'])
  })

  it('ignores a second pointer (multi-touch) during a gesture', () => {
    const r = run([
      down(), { type: 'timer', t: 600 },
      { type: 'move', pointerId: 2, x: 0, y: 0 },
      { type: 'up', pointerId: 2, t: 700 },
    ])
    expect(r.outcomes).toEqual(['activate'])
    expect(r.state.phase).toBe('active')
  })

  it('a long press released before the timer fired is not a tap', () => {
    expect(run([down(), { type: 'up', pointerId: 1, t: LONG_PRESS_MS + 50 }]).outcomes).toEqual(['abandon'])
  })
})
