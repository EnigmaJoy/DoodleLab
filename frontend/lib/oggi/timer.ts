// lib/oggi/timer.ts
// Visual timer state machine. Time is derived from wall-clock timestamps,
// not from counting ticks, so throttled background tabs stay accurate.

export const TIMER_PRESETS_MIN = [10, 25, 45] as const

export type TimerStatus = 'idle' | 'running' | 'paused' | 'finished'

export interface TimerState {
  status:      TimerStatus
  durationMs:  number
  /** Remaining time when not running */
  remainingMs: number
  /** Wall-clock deadline while running */
  endsAt:      number | null
}

export function createTimer(minutes: number): TimerState {
  const durationMs = Math.max(1, minutes) * 60_000
  return { status: 'idle', durationMs, remainingMs: durationMs, endsAt: null }
}

export function startTimer(state: TimerState, now: number): TimerState {
  if (state.status === 'running') return state
  const remaining = state.status === 'finished' ? state.durationMs : state.remainingMs
  return { ...state, status: 'running', remainingMs: remaining, endsAt: now + remaining }
}

export function pauseTimer(state: TimerState, now: number): TimerState {
  if (state.status !== 'running' || state.endsAt === null) return state
  const remainingMs = Math.max(0, state.endsAt - now)
  if (remainingMs === 0) return finish(state)
  return { ...state, status: 'paused', remainingMs, endsAt: null }
}

export function resetTimer(state: TimerState): TimerState {
  return { ...state, status: 'idle', remainingMs: state.durationMs, endsAt: null }
}

/** Advances a running timer to `now`; marks it finished when time is up */
export function tickTimer(state: TimerState, now: number): TimerState {
  if (state.status !== 'running' || state.endsAt === null) return state
  return state.endsAt - now <= 0 ? finish(state) : state
}

export function remainingMs(state: TimerState, now: number): number {
  if (state.status === 'running' && state.endsAt !== null) return Math.max(0, state.endsAt - now)
  return state.remainingMs
}

/** 0 = nothing elapsed, 1 = complete */
export function progress(state: TimerState, now: number): number {
  return 1 - remainingMs(state, now) / state.durationMs
}

/** "MM:SS", rounding up so the display never shows 00:00 before finishing */
export function formatRemaining(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000)
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function finish(state: TimerState): TimerState {
  return { ...state, status: 'finished', remainingMs: 0, endsAt: null }
}
