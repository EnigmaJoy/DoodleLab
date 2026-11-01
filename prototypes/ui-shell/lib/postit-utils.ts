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

  const time = date.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })

  if (isToday) return `oggi alle ${time}`

  return date.toLocaleDateString('it-IT', {
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

// ── Demo notes ───────────────────────────────────────────────────────────────
// Deterministic string IDs prevent server/client hydration mismatches.
// crypto.randomUUID() is ONLY called inside the ADD_NOTE reducer action (client-side).

export const DEMO_NOTES: PostIt[] = [
  {
    id: 'demo-note-01', content: 'Chiamare la banca\nper il mutuo', color: 'yellow',
    rotation: -2.1, position: { xPct: 0.05, yPct: 0.06 },
    stickers: [], pinned: false,
    createdAt: '2026-11-01T09:00:00.000Z', updatedAt: '2026-11-01T09:00:00.000Z',
  },
  {
    id: 'demo-note-02', content: 'Prenotare visita casa\na Padova sabato mattina,\nportare la lista domande',
    color: 'mint', rotation: 1.8, position: { xPct: 0.27, yPct: 0.08 },
    stickers: ['home', 'exclaim'], pinned: true,
    createdAt: '2026-11-01T09:01:00.000Z', updatedAt: '2026-11-01T09:01:00.000Z',
  },
  {
    id: 'demo-note-03', content: 'Comprare latte,\npane e frutta', color: 'pink',
    rotation: -1.3, position: { xPct: 0.53, yPct: 0.05 },
    stickers: ['cart'], pinned: false,
    createdAt: '2026-11-01T09:02:00.000Z', updatedAt: '2026-11-01T09:02:00.000Z',
  },
  {
    id: 'demo-note-04', content: 'Riunione con il team\nalle 15:00', color: 'blue',
    rotation: 2.4, position: { xPct: 0.75, yPct: 0.07 },
    stickers: ['clock'], pinned: false,
    createdAt: '2026-11-01T09:03:00.000Z', updatedAt: '2026-11-01T09:03:00.000Z',
  },
  {
    id: 'demo-note-05', content: 'Idea per il progetto:\nusare le mappe mentali', color: 'yellow',
    rotation: -0.8, position: { xPct: 0.08, yPct: 0.50 },
    stickers: ['bulb'], pinned: false,
    createdAt: '2026-11-01T09:04:00.000Z', updatedAt: '2026-11-01T09:04:00.000Z',
  },
  {
    id: 'demo-note-06', content: 'Pagare la bolletta\ndel gas', color: 'peach',
    rotation: 1.5, position: { xPct: 0.30, yPct: 0.52 },
    stickers: [], pinned: false,
    createdAt: '2026-11-01T09:05:00.000Z', updatedAt: '2026-11-01T09:05:00.000Z',
  },
  {
    id: 'demo-note-07', content: 'Leggere capitolo 5\ndel libro', color: 'mint',
    rotation: -2.7, position: { xPct: 0.56, yPct: 0.48 },
    stickers: [], pinned: false,
    createdAt: '2026-11-01T09:06:00.000Z', updatedAt: '2026-11-01T09:06:00.000Z',
  },
  {
    id: 'demo-note-08', content: 'Comprare regalo\nper il compleanno di Luca', color: 'pink',
    rotation: 1.1, position: { xPct: 0.76, yPct: 0.51 },
    stickers: ['star', 'heart'], pinned: false,
    createdAt: '2026-11-01T09:07:00.000Z', updatedAt: '2026-11-01T09:07:00.000Z',
  },
]
