// lib/journal/journal-repository.ts
// Daily journal entries ("Pensieri del giorno"). Written from Oggi; the
// Quaderno "Diario" view will list the SAME entries via listEntries() -
// there is exactly one entry per local day and no copies.
// Typed text only: handwriting must use the vector-ink architecture once it
// exists, never a raster snapshot stored here.

import { ChangeNotifier, createId } from '../store'
import type { DayKey } from '../day'

export interface JournalEntry {
  id:        string
  day:       DayKey
  body:      string
  createdAt: number
  updatedAt: number
}

export interface JournalRepository {
  subscribe(listener: () => void): () => void
  getVersion(): number
  getEntry(day: DayKey): JournalEntry | null
  /** Writes the body of `day`'s entry, creating it on first non-empty write */
  writeEntry(day: DayKey, body: string, now?: number): JournalEntry | null
  listEntries(): JournalEntry[]
}

export class InMemoryJournalRepository extends ChangeNotifier implements JournalRepository {
  private entries = new Map<DayKey, JournalEntry>()

  getEntry(day: DayKey): JournalEntry | null {
    return this.entries.get(day) ?? null
  }

  writeEntry(day: DayKey, body: string, now = Date.now()): JournalEntry | null {
    const current = this.entries.get(day)
    if (!current) {
      if (body.trim().length === 0) return null
      const entry: JournalEntry = { id: createId('journal'), day, body, createdAt: now, updatedAt: now }
      this.entries.set(day, entry)
      this.notify()
      return entry
    }
    if (current.body === body) return current
    const updated: JournalEntry = { ...current, body, updatedAt: now }
    this.entries.set(day, updated)
    this.notify()
    return updated
  }

  listEntries(): JournalEntry[] {
    return [...this.entries.values()].sort((a, b) => b.day.localeCompare(a.day))
  }
}

let instance: JournalRepository | null = null

export function getJournalRepository(): JournalRepository {
  instance ??= new InMemoryJournalRepository()
  return instance
}
