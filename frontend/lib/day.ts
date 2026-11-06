// lib/day.ts
// Local calendar-day helpers. A DayKey is always derived from LOCAL date
// components (never toISOString, which is UTC and shifts days near midnight).

import { dateString } from './calendar-utils'

/** "YYYY-MM-DD" in the user's local timezone */
export type DayKey = string

const DAY_NAMES_IT = [
  'domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato',
] as const

const MONTHS_IT = [
  'gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
  'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre',
] as const

export function toDayKey(date: Date): DayKey {
  return dateString(date.getFullYear(), date.getMonth(), date.getDate())
}

export function parseDayKey(day: DayKey): Date {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** "lunedì 26 ottobre" */
export function formatDayHeading(day: DayKey): string {
  const date = parseDayKey(day)
  return `${DAY_NAMES_IT[date.getDay()]} ${date.getDate()} ${MONTHS_IT[date.getMonth()]}`
}

/** "26 ottobre" */
export function formatDayMonth(day: DayKey): string {
  const date = parseDayKey(day)
  return `${date.getDate()} ${MONTHS_IT[date.getMonth()]}`
}

/** "HH:MM" -> minutes since local midnight. Returns null for malformed input. */
export function parseTime(time: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time.trim())
  if (!match) return null
  const h = Number(match[1])
  const m = Number(match[2])
  if (h > 23 || m > 59) return null
  return h * 60 + m
}

/** minutes since midnight -> "HH:MM" (clamped to the day) */
export function formatTime(minutes: number): string {
  const clamped = Math.max(0, Math.min(24 * 60 - 1, Math.round(minutes)))
  const h = Math.floor(clamped / 60)
  const m = clamped % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function minutesOfDay(date: Date): number {
  return date.getHours() * 60 + date.getMinutes()
}
