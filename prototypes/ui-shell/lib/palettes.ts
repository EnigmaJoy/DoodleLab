// lib/palettes.ts

/* UI-08: @openDecision - final palette selection is pending visual review */

export interface PaletteEntry {
  id:             number
  label:          string
  from:           string   // --gradient-start hex
  to:             string   // --gradient-end hex
  provisional:    true
  referenceBoard: string
  contrastNotes:  string[]
}

export const PALETTES: readonly PaletteEntry[] = [
  {
    id: 1, label: 'Prugna / Corallo', from: '#581c87', to: '#be123c',
    provisional: true, referenceBoard: 'Tavola 1',
    contrastNotes: ['Welcome text at orange midpoint: measure AA large-text (3:1 minimum)'],
  },
  {
    id: 2, label: 'Blu / Viola', from: '#3b82f6', to: '#a855f7',
    provisional: true, referenceBoard: 'Tavola 2', contrastNotes: [],
  },
  {
    id: 3, label: 'Verde / Teal', from: '#22c55e', to: '#0d9488',
    provisional: true, referenceBoard: 'Tavola 3',
    contrastNotes: ['Green midpoint: measure AA large-text (3:1 minimum)'],
  },
  {
    id: 4, label: 'Cremisi / Arancione', from: '#dc2626', to: '#f97316',
    provisional: true, referenceBoard: 'Tavola 4',
    contrastNotes: ['Orange endpoint: white text risk - measure before visual review'],
  },
  {
    id: 5, label: 'Navy / Blu', from: '#1e3a5f', to: '#2563eb',
    provisional: true, referenceBoard: 'Tavola 5', contrastNotes: [],
  },
  {
    id: 6, label: 'Viola / Rosso', from: '#7c3aed', to: '#dc2626',
    provisional: true, referenceBoard: 'Tavola 6', contrastNotes: [],
  },
  {
    id: 7, label: 'Oliva / Marrone', from: '#65a30d', to: '#92400e',
    provisional: true, referenceBoard: 'Tavola 7',
    contrastNotes: [
      'Olive endpoint: measure white text contrast',
      'Brown endpoint: measure white text contrast',
      'Both endpoints are atypical - full measurement required',
    ],
  },
  {
    id: 8, label: 'Ardesia / Teal', from: '#475569', to: '#0d9488',
    provisional: true, referenceBoard: 'Tavola 8', contrastNotes: [],
  },
] as const

export const DEFAULT_PALETTE_ID = 1
export const PALETTE_COUNT      = 8
