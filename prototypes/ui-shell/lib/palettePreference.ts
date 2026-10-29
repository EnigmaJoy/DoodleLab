// lib/palettePreference.ts
import { DEFAULT_PALETTE_ID, PALETTE_STORAGE_KEY, isPaletteId, type PaletteId } from '@/lib/palettes'

export function readStoredPaletteId(): PaletteId {
  try {
    const v = window.localStorage.getItem(PALETTE_STORAGE_KEY)
    return isPaletteId(v) ? v : DEFAULT_PALETTE_ID
  } catch {
    return DEFAULT_PALETTE_ID
  }
}

export function applyPalette(id: PaletteId): void {
  document.documentElement.dataset.palette = id
  try {
    window.localStorage.setItem(PALETTE_STORAGE_KEY, id)
  } catch {
    /* storage unavailable: preference just isn't persisted */
  }
}
