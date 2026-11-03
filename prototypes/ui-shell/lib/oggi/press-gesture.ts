// lib/oggi/press-gesture.ts
// Distinguishes tap, scroll, long press and drag for one pointer. Pure: the
// UI feeds Pointer Events and a long-press timer, and acts on the outcome.

export const LONG_PRESS_MS     = 500
/** Movement beyond this before activation means the user is scrolling */
export const MOVE_TOLERANCE_PX = 8

export type PressState =
  | { phase: 'idle' }
  | { phase: 'pending'; pointerId: number; x: number; y: number; t: number }
  | { phase: 'active';  pointerId: number }

export type PressEvent =
  /** `immediate` skips the long press (explicit grip / resize handles) */
  | { type: 'down';   pointerId: number; x: number; y: number; t: number; immediate?: boolean }
  | { type: 'move';   pointerId: number; x: number; y: number }
  | { type: 'timer';  t: number }
  | { type: 'up';     pointerId: number; t: number }
  | { type: 'cancel'; pointerId: number }

export type PressOutcome =
  | 'none'
  | 'activate'   // long press reached (or immediate down): start the interaction
  | 'tap'        // short press without movement: a normal click
  | 'abandon'    // moved or cancelled before activation: probably scrolling
  | 'drag'       // pointer moved while active
  | 'drop'       // released while active: commit
  | 'cancel'     // interrupted while active: restore

export interface PressStep {
  state:   PressState
  outcome: PressOutcome
}

export const IDLE: PressState = { phase: 'idle' }

export function pressStep(state: PressState, event: PressEvent): PressStep {
  switch (state.phase) {
    case 'idle':
      if (event.type !== 'down') return { state, outcome: 'none' }
      if (event.immediate) return { state: { phase: 'active', pointerId: event.pointerId }, outcome: 'activate' }
      return {
        state:   { phase: 'pending', pointerId: event.pointerId, x: event.x, y: event.y, t: event.t },
        outcome: 'none',
      }

    case 'pending':
      if (event.type === 'timer') {
        return event.t - state.t >= LONG_PRESS_MS
          ? { state: { phase: 'active', pointerId: state.pointerId }, outcome: 'activate' }
          : { state, outcome: 'none' }
      }
      if (event.type === 'down' || event.pointerId !== state.pointerId) return { state, outcome: 'none' }
      if (event.type === 'move') {
        const moved = Math.hypot(event.x - state.x, event.y - state.y)
        return moved > MOVE_TOLERANCE_PX ? { state: IDLE, outcome: 'abandon' } : { state, outcome: 'none' }
      }
      if (event.type === 'up') {
        // A press held past the threshold is never a tap, even if the timer was late
        return { state: IDLE, outcome: event.t - state.t < LONG_PRESS_MS ? 'tap' : 'abandon' }
      }
      return { state: IDLE, outcome: 'abandon' }

    case 'active':
      if (event.type === 'timer' || event.type === 'down' || event.pointerId !== state.pointerId) {
        return { state, outcome: 'none' }
      }
      if (event.type === 'move') return { state, outcome: 'drag' }
      if (event.type === 'up')   return { state: IDLE, outcome: 'drop' }
      return { state: IDLE, outcome: 'cancel' }
  }
}
