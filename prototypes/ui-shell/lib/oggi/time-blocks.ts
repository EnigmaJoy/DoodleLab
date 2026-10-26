// lib/oggi/time-blocks.ts
// Scheduling rules for flexible time blocks. Everything here works on real
// time values (local wall-clock minutes), never on pixel positions.
//
// Collision policy:
// - Fixed appointments (calendar events) are protected: a block may not
//   overlap them. Appointments are never moved or shortened.
// - Reminders and PostIts do not occupy a duration: overlap is allowed.
// - Flexible blocks may overlap each other; they are drawn side by side.
//   Two blocks at once is the user's choice, not an error.
// - A block lives inside one local day and never crosses midnight.

import type { CalendarItem } from '../calendar-mock'
import { formatTime, parseDayKey, parseTime, type DayKey } from '../day'

export const SNAP_MINUTES          = 15
export const DEFAULT_BLOCK_MINUTES = 60
export const MIN_BLOCK_MINUTES     = 15
export const DAY_MINUTES           = 24 * 60
export const DEFAULT_BLOCK_TITLE   = 'Blocco di concentrazione'
/**
 * Protected footprint of an appointment without an explicit end. Matches the
 * height the timeline draws for it, so what the user sees is what is blocked.
 */
export const FIXED_WITHOUT_END_MINUTES = 30

export interface Slot {
  start:    number
  duration: number
}

export interface FixedInterval {
  id:    string
  title: string
  start: number
  end:   number
}

export type PlacementError =
  | { type: 'too-short' }
  | { type: 'outside-day' }
  | { type: 'nonexistent-time' }
  | { type: 'overlap'; conflict: FixedInterval }

export function snapMinutes(minutes: number): number {
  return Math.round(minutes / SNAP_MINUTES) * SNAP_MINUTES
}

export function snapUp(minutes: number): number {
  return Math.ceil(minutes / SNAP_MINUTES) * SNAP_MINUTES
}

/** Protected intervals for a day: calendar events only */
export function fixedIntervals(items: readonly CalendarItem[]): FixedInterval[] {
  const result: FixedInterval[] = []
  for (const item of items) {
    if (item.kind !== 'event' || !item.time) continue
    const start = parseTime(item.time)
    if (start === null) continue
    const explicitEnd = item.detail?.timeEnd ? parseTime(item.detail.timeEnd) : null
    const end = explicitEnd !== null && explicitEnd > start ? explicitEnd : start + FIXED_WITHOUT_END_MINUTES
    result.push({ id: item.id, title: item.title, start, end })
  }
  return result
}

/** False for wall-clock times skipped by a daylight-saving jump */
export function localTimeExists(day: DayKey, minutes: number): boolean {
  const base = parseDayKey(day)
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  const date = new Date(base.getFullYear(), base.getMonth(), base.getDate(), h, m)
  return date.getDate() === base.getDate() && date.getHours() === h && date.getMinutes() === m
}

export function validatePlacement(
  day: DayKey, slot: Slot, fixed: readonly FixedInterval[],
): PlacementError | null {
  const { start, duration } = slot
  if (!Number.isFinite(start) || !Number.isFinite(duration)) return { type: 'outside-day' }
  if (duration < MIN_BLOCK_MINUTES) return { type: 'too-short' }
  if (start < 0 || start + duration > DAY_MINUTES) return { type: 'outside-day' }
  if (!localTimeExists(day, start)) return { type: 'nonexistent-time' }
  const end = start + duration
  const conflict = fixed.find(f => start < f.end && f.start < end)
  return conflict ? { type: 'overlap', conflict } : null
}

/** Italian, non-punitive explanation of why a placement is not possible */
export function describePlacementError(error: PlacementError): string {
  switch (error.type) {
    case 'too-short':
      return `La durata minima è di ${MIN_BLOCK_MINUTES} minuti.`
    case 'outside-day':
      return 'Il blocco deve stare dentro la giornata, tra le 00:00 e le 24:00.'
    case 'nonexistent-time':
      return "Quest'ora non esiste oggi per il cambio dell'ora legale. Scegline un'altra."
    case 'overlap':
      return `A quest'ora c'è già "${error.conflict.title}" (${formatTime(error.conflict.start)} - ${formatTime(error.conflict.end)}). Scegli un altro orario.`
  }
}

// --- Gesture proposals (all snapped to 15 minutes) ---------------------------

/** Moves the whole block, keeping its duration */
export function proposeMove(origin: Slot, deltaMinutes: number): Slot {
  return { start: snapMinutes(origin.start + deltaMinutes), duration: origin.duration }
}

/** Top handle: changes start and duration, keeps the end */
export function proposeResizeStart(origin: Slot, deltaMinutes: number): Slot {
  const end = origin.start + origin.duration
  const start = snapMinutes(origin.start + deltaMinutes)
  return { start, duration: end - start }
}

/** Bottom handle: changes end and duration, keeps the start */
export function proposeResizeEnd(origin: Slot, deltaMinutes: number): Slot {
  const end = snapMinutes(origin.start + origin.duration + deltaMinutes)
  return { start: origin.start, duration: end - origin.start }
}

/**
 * First start at or after `after` (rounded up to 15 minutes) where a block of
 * `duration` fits. Used only to PREFILL an editor; the user confirms.
 */
export function nextFreeStart(
  day: DayKey, after: number, duration: number, fixed: readonly FixedInterval[],
): number | null {
  for (let start = snapUp(after); start + duration <= DAY_MINUTES; start += SNAP_MINUTES) {
    if (!validatePlacement(day, { start, duration }, fixed)) return start
  }
  return null
}

export function slotLabel(slot: Slot): string {
  return `${formatTime(slot.start)} - ${formatTime(slot.start + slot.duration)}`
}

/** "90 minuti", always from the stored duration (blocks are >= 15 min) */
export function durationLabel(slot: Slot): string {
  return `${slot.duration} minuti`
}

export function currentTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}
