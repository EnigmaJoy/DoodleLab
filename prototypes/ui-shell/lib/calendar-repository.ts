// lib/calendar-repository.ts
// Reactive, localStorage-backed repository for calendar items.

import { ChangeNotifier, createId, registerReset, getStorageAdapter } from './store'
import type { StorageAdapter } from './storage/storage-adapter'
import { MOCK_ITEMS } from './calendar-mock'

// ── Types ────────────────────────────────────────────────────────────────────

export type EventKind = 'event' | 'reminder' | 'note'

export interface CalendarItem {
  id:       string
  date:     string        // YYYY-MM-DD
  kind:     EventKind
  title:    string
  time?:    string        // HH:MM
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
  createdAt: string       // ISO-8601
}

export type NewCalendarItem  = Omit<CalendarItem, 'id' | 'createdAt'>
export type CalendarItemPatch = Partial<Omit<CalendarItem, 'id' | 'createdAt'>>

export interface CalendarRepository {
  subscribe(listener: () => void): () => void
  getVersion(): number

  // Read
  getItem(id: string): CalendarItem | undefined
  getItemsForDate(date: string): CalendarItem[]
  getDatesWithItems(): Set<string>
  getGroupsForDate(date: string): Map<string, CalendarItem[]>

  // Write
  addItem(input: NewCalendarItem): CalendarItem
  updateItem(id: string, patch: CalendarItemPatch): CalendarItem | null
  deleteItem(id: string): boolean
}

// ── Storage schema ───────────────────────────────────────────────────────────

const STORAGE_KEY = 'doodlelab:calendar:v1'

interface StoredPayload {
  items: CalendarItem[]
  seededWithFixtures: boolean
}

// ── Implementation ───────────────────────────────────────────────────────────

export class LocalCalendarRepository extends ChangeNotifier implements CalendarRepository {
  private items = new Map<string, CalendarItem>()
  private seededWithFixtures = false
  private adapter: StorageAdapter

  constructor(adapter: StorageAdapter) {
    super()
    this.adapter = adapter
    this.load()
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private load(): void {
    const raw = this.adapter.read(STORAGE_KEY)
    if (raw !== null) {
      try {
        const payload = JSON.parse(raw) as StoredPayload
        if (Array.isArray(payload.items)) {
          this.seededWithFixtures = payload.seededWithFixtures ?? false
          this.items = new Map(payload.items.map(item => [item.id, item]))
          return
        }
      } catch {
        // corrupt data — fall through to seed
      }
    }
    this.seed()
  }

  private seed(): void {
    this.seededWithFixtures = true
    const now = new Date().toISOString()
    this.items = new Map(
      MOCK_ITEMS.map(mockItem => {
        const item: CalendarItem = {
          ...mockItem,
          kind: mockItem.kind === 'postit' ? 'note' : mockItem.kind,
          createdAt: now,
        }
        return [item.id, item]
      })
    )
    this.persist()
  }

  private persist(): void {
    const payload: StoredPayload = {
      items: [...this.items.values()],
      seededWithFixtures: this.seededWithFixtures,
    }
    this.adapter.write(STORAGE_KEY, JSON.stringify(payload))
  }

  private save(): void {
    this.persist()
    this.notify()
  }

  // ── Read ───────────────────────────────────────────────────────────────────

  getItem(id: string): CalendarItem | undefined {
    return this.items.get(id)
  }

  getItemsForDate(date: string): CalendarItem[] {
    return [...this.items.values()].filter(item => item.date === date)
  }

  getDatesWithItems(): Set<string> {
    return new Set([...this.items.values()].map(i => i.date))
  }

  getGroupsForDate(date: string): Map<string, CalendarItem[]> {
    const map = new Map<string, CalendarItem[]>()
    for (const item of this.items.values()) {
      if (item.date === date && item.groupId) {
        const arr = map.get(item.groupId) ?? []
        arr.push(item)
        map.set(item.groupId, arr)
      }
    }
    return map
  }

  // ── Write ──────────────────────────────────────────────────────────────────

  addItem(input: NewCalendarItem): CalendarItem {
    const item: CalendarItem = {
      ...input,
      id: createId('cal'),
      createdAt: new Date().toISOString(),
    }
    this.items.set(item.id, item)
    this.save()
    return item
  }

  updateItem(id: string, patch: CalendarItemPatch): CalendarItem | null {
    const existing = this.items.get(id)
    if (!existing) return null
    const updated: CalendarItem = { ...existing, ...patch }
    this.items.set(id, updated)
    this.save()
    return updated
  }

  deleteItem(id: string): boolean {
    const removed = this.items.delete(id)
    if (removed) {
      this.save()
      return true
    }
    return false
  }
}

// ── Singleton factory ─────────────────────────────────────────────────────────

let instance: CalendarRepository | null = null

registerReset(() => { instance = null })

export function getCalendarRepository(): CalendarRepository {
  if (!instance) {
    instance = new LocalCalendarRepository(getStorageAdapter())
  }
  return instance
}
