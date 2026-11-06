// lib/oggi/day-change.ts
// Midnight behaviour for Oggi (Board 3). The displayed day never changes
// under an active editor; drafts always stay on the day they were started.

import type { DayKey } from '../day'

export type DayChangeDecision =
  | { type: 'none' }
  /** Not editing: quietly follow the new day */
  | { type: 'follow'; to: DayKey }
  /** Editing: keep the displayed day and offer a one-time notice */
  | { type: 'notify'; from: DayKey; to: DayKey }

export interface DayChangeInput {
  /** Day currently shown in Oggi */
  displayedDay:  DayKey
  /** Local day observed at the previous check */
  lastSeenToday: DayKey
  /** Local day now */
  today:         DayKey
  isEditing:     boolean
}

export function decideDayChange(input: DayChangeInput): DayChangeDecision {
  const { displayedDay, lastSeenToday, today, isEditing } = input
  if (today === lastSeenToday) return { type: 'none' }
  // Only react when the user was looking at "today" when it rolled over.
  // If they had already chosen to stay on an older day, leave them there.
  if (displayedDay !== lastSeenToday) return { type: 'none' }
  return isEditing
    ? { type: 'notify', from: displayedDay, to: today }
    : { type: 'follow', to: today }
}
