import { LOCALE } from './constants'
import type { PostIt, PostItColor, PostItPosition, StickerKey } from './postit-types'

// ── Coordinate math ──────────────────────────────────────────────────────────

export function pctToPx(pct: number, size: number): number {
  return pct * size
}

export function pxToPct(px: number, size: number): number {
  return size === 0 ? 0 : px / size
}

/**
 * Clamps position percentages so the note stays fully within the board.
 * Returns clamped {xPct, yPct}.
 */
export function clampPosition(
  xPct: number,
  yPct: number,
  boardW: number,
  boardH: number,
  noteW: number,
  noteH: number,
): PostItPosition {
  const maxXpx = Math.max(0, boardW - noteW)
  const maxYpx = Math.max(0, boardH - noteH)
  const clampedXpx = Math.max(0, Math.min(pctToPx(xPct, boardW), maxXpx))
  const clampedYpx = Math.max(0, Math.min(pctToPx(yPct, boardH), maxYpx))
  return {
    xPct: pxToPct(clampedXpx, boardW),
    yPct: pxToPct(clampedYpx, boardH),
  }
}

// ── Generators ───────────────────────────────────────────────────────────────

/** Returns a random rotation in degrees in the range [−3, +3]. */
export function generateRotation(): number {
  return (Math.random() * 6) - 3
}

/** Returns a UUID v4 string. Uses the Web Crypto API (available in all modern browsers and Node 19+). */
export function generateId(): string {
  return crypto.randomUUID()
}

// ── Date formatting ──────────────────────────────────────────────────────────

/** Formats an ISO-8601 date string in Italian. Today → "oggi alle HH:MM". */
export function formatNoteDate(iso: string): string {
  const date = new Date(iso)
  const now  = new Date()
  const isToday =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth()    === now.getMonth()    &&
    date.getDate()     === now.getDate()

  const time = date.toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit' })

  if (isToday) return `oggi alle ${time}`

  return date.toLocaleDateString(LOCALE, {
    day:   'numeric',
    month: 'long',
    year:  'numeric',
  }) + ` alle ${time}`
}

// ── Design constants ─────────────────────────────────────────────────────────

export const POST_IT_COLORS: Record<PostItColor, string> = {
  yellow: '#FFF9B0',
  pink:   '#FFD6E4',
  mint:   '#C8F0D8',
  blue:   '#C8E4FF',
  peach:  '#FFE4CC',
}

export const STICKER_CONFIG: Record<StickerKey, { emoji: string; bg: string }> = {
  star:      { emoji: '⭐', bg: '#FFF176' },
  heart:     { emoji: '❤️', bg: '#FFCDD2' },
  check:     { emoji: '✅', bg: '#C8E6C9' },
  exclaim:   { emoji: '❗', bg: '#FFCCBC' },
  bulb:      { emoji: '💡', bg: '#FFF9C4' },
  home:      { emoji: '🏠', bg: '#BBDEFB' },
  cart:      { emoji: '🛒', bg: '#E1BEE7' },
  sun:       { emoji: '☀️', bg: '#FFE0B2' },
  lightning: { emoji: '⚡', bg: '#FFF59D' },
  clock:     { emoji: '🕐', bg: '#CFD8DC' },
  phone:     { emoji: '📱', bg: '#B3E5FC' },
  money:     { emoji: '💰', bg: '#DCEDC8' },
}

