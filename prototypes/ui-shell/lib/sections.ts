// lib/sections.ts
export const SECTIONS = [
  { id: 'today',     label: 'Oggi',       title: 'Oggi'       },
  { id: 'calendar',  label: 'Calendario', title: 'Calendario' },
  { id: 'board',     label: 'Lavagna',    title: 'Lavagna'    },
  { id: 'inbox',     label: 'Inbox',      title: 'Inbox'      },
  { id: 'notebook',  label: 'Quaderno',   title: 'Quaderno'   },
  { id: 'exercises', label: 'Esercizi',   title: 'Esercizi'   },
] as const

// Derived literal union: 'today' | 'calendar' | 'board' | 'inbox' | 'notebook' | 'exercises'
export type SectionId = (typeof SECTIONS)[number]['id']

export interface SectionConfig {
  readonly id:    SectionId
  readonly label: string
  readonly title: string
}
