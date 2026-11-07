// lib/constants.ts
import { SECTIONS } from './sections'
import type { SectionId } from './sections'

export const APP_NAME = 'agenda'

/** BCP-47 locale tag used for all date/time formatting in the app. */
export const LOCALE = 'it-IT'

/** Ring radius in px: distance from center to each radial item midpoint. */
export const RING_RADIUS_PX = 172

/** Per-item stagger delay in ms on open (item 0 opens first). */
export const OPEN_STAGGER_MS = 40

/** Per-item stagger delay in ms on close (item N-1 closes first). */
export const CLOSE_STAGGER_MS = 25

// Angles are measured clockwise from 12 o'clock (top).
const MENU_ITEM_ANGLES: Array<{ id: SectionId; angle: number }> = [
  { id: 'today',     angle:   0 },   // 12h
  { id: 'calendar',  angle:  60 },   // 2h
  { id: 'board',     angle: 120 },   // 4h
  { id: 'inbox',     angle: 180 },   // 6h
  { id: 'notebook',  angle: 240 },   // 8h
  { id: 'exercises', angle: 300 },   // 10h
]

interface MenuItem {
  id:    SectionId
  label: string
  angle: number   // degrees, clockwise from top (0 = 12h)
}

export const MENU_ITEMS: readonly MenuItem[] = MENU_ITEM_ANGLES.map(({ id, angle }) => {
  const section = SECTIONS.find(s => s.id === id)!
  return { id, label: section.label, angle }
})
