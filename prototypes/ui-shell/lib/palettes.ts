// lib/palettes.ts

/* UI-08: @openDecision - final palette selection is pending visual review */

export interface PaletteEntry {
  id:             number
  label:          string
  provisional:    true
  referenceBoard: string
  contrastNotes:  string[]
}

export const PALETTES: readonly PaletteEntry[] = [
  {
    id: 1, label: 'Arancione / Teal', provisional: true,
    referenceBoard: 'Tavola 1',
    contrastNotes: ['Welcome text at orange midpoint: measure AA large-text (3:1 minimum)'],
  },
  {
    id: 2, label: 'Blu / Viola', provisional: true,
    referenceBoard: 'Tavola 2', contrastNotes: [],
  },
  {
    id: 3, label: 'Verde / Teal', provisional: true,
    referenceBoard: 'Tavola 3',
    contrastNotes: ['Green midpoint: measure AA large-text (3:1 minimum)'],
  },
  {
    id: 4, label: 'Cremisi / Arancione', provisional: true,
    referenceBoard: 'Tavola 4',
    contrastNotes: ['Orange endpoint: white text risk - measure before visual review'],
  },
  {
    id: 5, label: 'Navy / Blu', provisional: true,
    referenceBoard: 'Tavola 5', contrastNotes: [],
  },
  {
    id: 6, label: 'Viola / Rosso', provisional: true,
    referenceBoard: 'Tavola 6', contrastNotes: [],
  },
  {
    id: 7, label: 'Oliva / Marrone', provisional: true,
    referenceBoard: 'Tavola 7',
    contrastNotes: [
      'Olive endpoint: measure white text contrast',
      'Brown endpoint: measure white text contrast',
      'Both endpoints are atypical - full measurement required',
    ],
  },
  {
    id: 8, label: 'Ardesia / Teal', provisional: true,
    referenceBoard: 'Tavola 8', contrastNotes: [],
  },
] as const

export const DEFAULT_PALETTE_ID = 1
export const PALETTE_COUNT      = 8
