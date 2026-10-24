// lib/calendar-utils.ts

const MONTHS_IT = [
  'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre',
] as const

// JS getDay() is 0=Sunday. We display Sun last (Mon-first grid).
const DAYS_FULL_IT = [
  'Domenica', 'Lunedi', 'Martedi', 'Mercoledi',
  'Giovedi', 'Venerdi', 'Sabato',
] as const

// Italian day names with proper accents, uppercase, for the overlay header.
// Index matches JS Date.getDay(): 0=Sunday, 1=Monday, …, 6=Saturday
const DAYS_FULL_IT_ACCENTED = [
  'DOMENICA', 'LUNEDÌ', 'MARTEDÌ', 'MERCOLEDÌ',
  'GIOVEDÌ', 'VENERDÌ', 'SABATO',
] as const

export function getDaysInMonth(year: number, month: number): number {
  // month is 0-indexed. new Date(y, m+1, 0) gives last day of month m.
  return new Date(year, month + 1, 0).getDate()
}

// Returns 0 = Monday ... 6 = Sunday (Mon-first grid offset)
export function getFirstDayOffset(year: number, month: number): number {
  const jsDay = new Date(year, month, 1).getDay() // 0=Sun
  return (jsDay + 6) % 7
}

// "Ottobre 2026"
export function formatMonthYear(year: number, month: number): string {
  return `${MONTHS_IT[month]} ${year}`
}

// "Domenica 25 ottobre 2026"
export function formatDayFull(ds: string): string {
  const [y, m, d] = ds.split('-').map(Number)
  // month in ds is 1-indexed; Date constructor is 0-indexed
  const date    = new Date(y, m - 1, d)
  const dayName = DAYS_FULL_IT[date.getDay()]
  return `${dayName} ${d} ${MONTHS_IT[m - 1].toLowerCase()} ${y}`
}

// Produces "YYYY-MM-DD". month is 0-indexed, day is 1-indexed.
export function dateString(year: number, month: number, day: number): string {
  const mm = String(month + 1).padStart(2, '0')
  const dd = String(day).padStart(2, '0')
  return `${year}-${mm}-${dd}`
}

export function prevMonth(year: number, month: number): [number, number] {
  return month === 0 ? [year - 1, 11] : [year, month - 1]
}

export function nextMonth(year: number, month: number): [number, number] {
  return month === 11 ? [year + 1, 0] : [year, month + 1]
}

/** Returns uppercase Italian day name with accent, e.g. "VENERDÌ" */
export function getDayNameFull(ds: string): string {
  const [y, m, d] = ds.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return DAYS_FULL_IT_ACCENTED[date.getDay()]
}

/** Returns "25 ottobre" (day number + lowercase month, no year) */
export function formatDayShort(ds: string): string {
  const [y, m, d] = ds.split('-').map(Number)
  // suppress "unused variable" lint — y is intentionally unused
  void y
  return `${d} ${MONTHS_IT[m - 1].toLowerCase()}`
}
