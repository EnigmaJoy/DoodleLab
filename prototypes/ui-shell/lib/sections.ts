// lib/sections.ts
export const SECTIONS = [
  { id: 'oggi',       label: 'Oggi',       title: 'Oggi'       },
  { id: 'calendario', label: 'Calendario', title: 'Calendario' },
  { id: 'lavagna',    label: 'Lavagna',    title: 'Lavagna'    },
  { id: 'inbox',      label: 'Inbox',      title: 'Inbox'      },
  { id: 'quaderno',   label: 'Quaderno',   title: 'Quaderno'   },
  { id: 'esercizi',   label: 'Esercizi',   title: 'Esercizi'   },
] as const

// Derived literal union: 'oggi' | 'calendario' | 'lavagna' | 'inbox' | 'quaderno' | 'esercizi'
export type SectionId = (typeof SECTIONS)[number]['id']

export interface SectionConfig {
  readonly id:    SectionId
  readonly label: string
  readonly title: string
}
