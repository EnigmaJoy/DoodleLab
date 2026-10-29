// lib/palettes.ts
// Single source of truth for palettes. Values are authoritative per
// docs/superpowers/specs/2026-10-27-welcome-glass-redesign-design.md section 3.
// app/palettes.css and the pre-paint init script are checked against / generated from this.

export const PALETTES = [
  { id: 'argilla-petrolio', name: 'Argilla e petrolio', from: '#C2410C', to: '#0F766E', glow: ['#FB923C', '#2DD4BF', '#FDBA74'], ink: '#9A3412' },
  { id: 'notte-lavanda',    name: 'Notte e lavanda',    from: '#1E3A8A', to: '#6D28D9', glow: ['#818CF8', '#C084FC', '#38BDF8'], ink: '#2E2370' },
  { id: 'bosco-laguna',     name: 'Bosco e laguna',     from: '#14532D', to: '#0E7490', glow: ['#4ADE80', '#22D3EE', '#86EFAC'], ink: '#14532D' },
  { id: 'tramonto',         name: 'Tramonto',           from: '#9F1239', to: '#C2410C', glow: ['#FB7185', '#FB923C', '#FDA4AF'], ink: '#9F1239' },
  { id: 'inchiostro',       name: 'Inchiostro',         from: '#1F2328', to: '#2F5BD3', glow: ['#60A5FA', '#818CF8', '#93C5FD'], ink: '#1F2328' },
  { id: 'prugna-corallo',   name: 'Prugna e corallo',   from: '#581C87', to: '#BE123C', glow: ['#C084FC', '#FB7185', '#F0ABFC'], ink: '#581C87' },
  { id: 'oliva-ambra',      name: 'Oliva e ambra',      from: '#3F6212', to: '#A16207', glow: ['#A3E635', '#FBBF24', '#FDE68A'], ink: '#3F6212' },
  { id: 'ardesia-salvia',   name: 'Ardesia e salvia',   from: '#334155', to: '#3F6B5E', glow: ['#94A3B8', '#6EE7B7', '#A7F3D0'], ink: '#334155' },
] as const

export type PaletteId = (typeof PALETTES)[number]['id']
export type Palette = (typeof PALETTES)[number]

export const DEFAULT_PALETTE_ID: PaletteId = 'notte-lavanda'
export const PALETTE_STORAGE_KEY = 'agenda.palette'

export function isPaletteId(v: unknown): v is PaletteId {
  return typeof v === 'string' && PALETTES.some(p => p.id === v)
}
