// lib/constants.ts
import { SECTIONS } from './sections'
import type { SectionId } from './sections'

export const APP_NAME = 'agenda'

/** Per-item stagger delay in ms. Applied as inline --stagger per RadialMenuItem. Provisional. */
export const ITEM_STAGGER_MS = 55

// Angles are measured from 12 o'clock (top), clockwise.
// toRad subtracts 90 degrees so 0 deg points up, not right.
const toRad = (deg: number) => (deg - 90) * (Math.PI / 180)

interface MenuItem {
  id:     SectionId
  label:  string
  angle:  number
  txUnit: number
  tyUnit: number
}

const MENU_ITEM_ANGLES: Array<{ id: SectionId; angle: number }> = [
  { id: 'oggi',       angle:   0 },   // 12h
  { id: 'calendario', angle:  60 },   // 2h
  { id: 'lavagna',    angle: 120 },   // 4h
  { id: 'inbox',      angle: 180 },   // 6h
  { id: 'quaderno',   angle: 240 },   // 8h
  { id: 'esercizi',   angle: 300 },   // 10h
]

// Unit-circle offsets (radius = 1.0). CSS --radial-radius multiplies these.
// Computed at module-load time; no runtime Math.cos/sin in JSX.
export const MENU_ITEMS: readonly MenuItem[] = MENU_ITEM_ANGLES.map(({ id, angle }) => {
  const section = SECTIONS.find(s => s.id === id)!
  return {
    id,
    label:  section.label,
    angle,
    txUnit: parseFloat(Math.cos(toRad(angle)).toFixed(6)),
    tyUnit: parseFloat(Math.sin(toRad(angle)).toFixed(6)),
  }
})
