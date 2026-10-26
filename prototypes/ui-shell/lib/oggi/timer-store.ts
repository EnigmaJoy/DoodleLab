// lib/oggi/timer-store.ts
// The single visual timer of Oggi. VisualTimer renders it; other features
// (e.g. "Avvia timer" on a time block) load it. Session memory only.

import { ChangeNotifier } from '../store'
import { createTimer, startTimer, type TimerState } from './timer'

export class TimerStore extends ChangeNotifier {
  private _state: TimerState = createTimer(25)
  /** What the countdown is for, e.g. a block title; null for a plain timer */
  private _label: string | null = null

  get state(): TimerState { return this._state }
  get label(): string | null { return this._label }

  update(next: (state: TimerState) => TimerState, label: string | null = this._label): void {
    const state = next(this._state)
    if (state === this._state && label === this._label) return
    this._state = state
    this._label = label
    this.notify()
  }

  /** Replaces the current countdown with `minutes` and starts it */
  startFor(minutes: number, label: string | null, now = Date.now()): void {
    this.update(() => startTimer(createTimer(minutes), now), label)
  }
}

let instance: TimerStore | null = null

export function getTimerStore(): TimerStore {
  instance ??= new TimerStore()
  return instance
}
