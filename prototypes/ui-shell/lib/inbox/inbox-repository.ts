// lib/inbox/inbox-repository.ts
// The single capture repository for the app. Quick capture from any section
// lands here uncategorised; triage into tasks/PostIts/events happens later
// in Inbox. Do not create section-specific capture stores.

import { ChangeNotifier, createId, registerReset, getStorageAdapter } from '../store'
import type { StorageAdapter } from '../storage/storage-adapter'

export interface InboxItem {
  id:        string
  text:      string
  source:    string     // section that captured it, e.g. 'oggi'
  createdAt: number
}

export interface InboxRepository {
  subscribe(listener: () => void): () => void
  getVersion(): number
  capture(text: string, source: string, now?: number): InboxItem | null
  list(): InboxItem[]
  updateItem(id: string, text: string): InboxItem | null
  deleteItem(id: string): boolean
}

export class InMemoryInboxRepository extends ChangeNotifier implements InboxRepository {
  private items: InboxItem[] = []
  private storage?: StorageAdapter

  constructor(storage?: StorageAdapter) {
    super()
    this.storage = storage
    if (storage) this.load(storage)
  }

  private load(storage: StorageAdapter): void {
    try {
      const raw = storage.read('doodlelab:inbox:v1')
      if (!raw) return
      const payload = JSON.parse(raw) as { items?: unknown }
      if (!Array.isArray(payload.items)) return
      this.items = payload.items as InboxItem[]
    } catch { /* corrupt data */ }
  }

  protected override notify(): void {
    this.persist()
    super.notify()
  }

  private persist(): void {
    if (!this.storage) return
    this.storage.write('doodlelab:inbox:v1', JSON.stringify({ items: this.items }))
  }

  capture(text: string, source: string, now = Date.now()): InboxItem | null {
    const trimmed = text.trim()
    if (!trimmed) return null
    const item: InboxItem = { id: createId('inbox'), text: trimmed, source, createdAt: now }
    this.items = [...this.items, item]
    this.notify()
    return item
  }

  list(): InboxItem[] {
    return this.items
  }

  updateItem(id: string, text: string): InboxItem | null {
    const trimmed = text.trim()
    if (!trimmed) return null
    const index = this.items.findIndex(i => i.id === id)
    if (index === -1) return null
    const updated: InboxItem = { ...this.items[index], text: trimmed }
    this.items = this.items.map((item, i) => i === index ? updated : item)
    this.notify()
    return updated
  }

  deleteItem(id: string): boolean {
    const before = this.items.length
    this.items = this.items.filter(i => i.id !== id)
    const removed = this.items.length < before
    if (removed) this.notify()
    return removed
  }
}

let inboxInstance: InboxRepository | null = null

registerReset(() => { inboxInstance = null })

export function getInboxRepository(): InboxRepository {
  if (!inboxInstance) {
    inboxInstance = new InMemoryInboxRepository(getStorageAdapter())
  }
  return inboxInstance
}
