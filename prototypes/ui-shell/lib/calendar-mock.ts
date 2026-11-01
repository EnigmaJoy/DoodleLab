// lib/calendar-mock.ts

/**
 * MOCK_ITEMS are synthetic development fixtures, not user data. Oggi reads the
 * same items (same ids) as Calendario and labels them as sample data while
 * this flag is true. Replace with a real calendar repository later.
 */
export const CALENDAR_SOURCE_IS_FIXTURE = true

export type EventKind = 'event' | 'reminder' | 'postit'

export interface CalendarItem {
  id:       string
  date:     string     // YYYY-MM-DD
  kind:     EventKind
  title:    string
  time?:    string     // HH:MM
  color?:   'blue' | 'green' | 'orange' | 'purple'
  note?:    string
  groupId?: string
  detail?: {
    location?: string
    calendar?: string
    note?:     string
    alert?:    string
    origin?:   string
    alsoOn?:   string
    repeats?:  string
    timeEnd?:  string
  }
}

export const MOCK_ITEMS: readonly CalendarItem[] = [
  // ---- Oct 5 ----
  { id: 'e1', date: '2026-10-05', kind: 'event',    title: 'Riunione team',      time: '10:00', color: 'blue'   },
  { id: 'e2', date: '2026-10-05', kind: 'reminder', title: 'Pagare bolletta',    time: '09:00' },
  // ---- Oct 12 ----
  { id: 'e3', date: '2026-10-12', kind: 'event',    title: 'Dentista',           time: '15:30', color: 'green'  },
  // ---- Oct 14 ----
  { id: 'e4', date: '2026-10-14', kind: 'event',    title: 'Pranzo con Marco',   time: '13:00', color: 'orange' },
  // ---- Oct 19 ----
  { id: 'e5', date: '2026-10-19', kind: 'event',    title: 'Workshop design',    time: '09:00', color: 'blue'   },
  { id: 'e6', date: '2026-10-19', kind: 'event',    title: 'Call con cliente',   time: '16:00', color: 'blue'   },
  // ---- Oct 25 (today) ----
  { id: 'e7',  date: '2026-10-25', kind: 'event',    title: 'Riunione team',      time: '09:00', color: 'blue'   },
  { id: 'e8',  date: '2026-10-25', kind: 'event',    title: 'Revisione UI',       time: '11:00', color: 'purple' },
  { id: 'p4',  date: '2026-10-25', kind: 'postit',   title: 'Note riunione',      time: '13:00', note: 'Preparare mockup per la review' },
  { id: 'r8',  date: '2026-10-25', kind: 'reminder', title: 'Backup settimanale', time: '18:00' },
  // group g1 at 19:xx
  {
    id: 'g1a', date: '2026-10-25', kind: 'event', title: 'Corso di inglese',
    time: '19:00', groupId: 'g1',
    detail: { timeEnd: '19:45', location: '[Indirizzo]', calendar: 'Personale', note: 'Portare il libro e il quaderno' },
  },
  {
    id: 'g1b', date: '2026-10-25', kind: 'reminder', title: 'Ritirare il pacco',
    time: '19:15', groupId: 'g1',
    detail: { location: '[Punto di ritiro]', alert: '15 minuti prima' },
  },
  {
    id: 'g1c', date: '2026-10-25', kind: 'postit', title: 'Idee per il weekend',
    time: '19:30', groupId: 'g1',
    note: 'Mercatino in centro, giro in bici lungo il fiume',
    detail: { origin: 'Nota vocale dal telefono', alsoOn: 'Lavagna' },
  },
  {
    id: 'g1d', date: '2026-10-25', kind: 'reminder', title: 'Annaffiare le piante',
    time: '19:50', groupId: 'g1',
    detail: { repeats: 'Ogni 3 giorni', alert: "All'ora indicata" },
  },
  // ---- Oct 26 ----
  { id: 'r3', date: '2026-10-26', kind: 'reminder', title: 'Spedire report settimanale', time: '09:00' },
  // ---- Oct 27 ----
  { id: 'p5', date: '2026-10-27', kind: 'postit',   title: 'Da leggere',         time: '10:00', note: '"Shape Up" di Basecamp' },
  // ---- Oct 28 ----
  { id: 'e9', date: '2026-10-28', kind: 'event',    title: 'Aperitivo',          time: '19:30', color: 'orange' },
  // ---- Oct 31 ----
  { id: 'e10', date: '2026-10-31', kind: 'event',   title: 'Halloween party',    time: '21:00', color: 'orange' },
  // ---- Other months with items ----
  { id: 'r1',  date: '2026-10-01', kind: 'reminder', title: 'Inizio mese - check budget',   time: '09:00' },
  { id: 'r2',  date: '2026-10-15', kind: 'reminder', title: 'Meta mese - review obiettivi', time: '10:00' },
  { id: 'p1',  date: '2026-10-07', kind: 'postit',   title: 'Chiamare la mamma',  time: '18:00', note: 'Chiama dopo le 18' },
  { id: 'p2',  date: '2026-10-13', kind: 'postit',   title: 'Idea progetto',      time: '09:00', note: 'Esplorare API geolocalizzazione per la nuova feature' },
  { id: 'p3',  date: '2026-10-20', kind: 'postit',   title: 'Lista spesa',        time: '11:00', note: 'Latte, pane, pasta, verdure' },
  // ---- November ----
  { id: 'e11', date: '2026-11-03', kind: 'event',    title: 'Stand-up mensile',   time: '10:00', color: 'blue' },
  { id: 'p6',  date: '2026-11-10', kind: 'postit',   title: 'Obiettivi novembre', time: '09:00', note: 'Completare il prototipo calendario' },
]

export function getItemsForDate(date: string): CalendarItem[] {
  return MOCK_ITEMS.filter(item => item.date === date)
}

export function getDatesWithItems(): Set<string> {
  return new Set(MOCK_ITEMS.map(item => item.date))
}

/** Returns a Map from groupId → items, for items on the given date that have a groupId */
export function getGroupsForDate(date: string): Map<string, CalendarItem[]> {
  const map = new Map<string, CalendarItem[]>()
  for (const item of MOCK_ITEMS) {
    if (item.date === date && item.groupId) {
      const arr = map.get(item.groupId) ?? []
      arr.push(item)
      map.set(item.groupId, arr)
    }
  }
  return map
}
