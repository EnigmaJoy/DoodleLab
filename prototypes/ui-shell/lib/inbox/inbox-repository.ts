// lib/inbox/inbox-repository.ts
// The single capture repository for the app. Quick capture from any section
// lands here uncategorised; triage into tasks/PostIts/events happens later
// in Inbox. Do not create section-specific capture stores.

import { ChangeNotifier, createId } from '../store'

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
}

export class InMemoryInboxRepository extends ChangeNotifier implements InboxRepository {
  private items: InboxItem[] = []

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
}

let instance: InboxRepository | null = null

export function getInboxRepository(): InboxRepository {
  instance ??= new InMemoryInboxRepository()
  return instance
}
