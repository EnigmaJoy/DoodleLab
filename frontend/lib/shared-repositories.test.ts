import { describe, expect, it } from 'vitest'
import { InMemoryJournalRepository } from './journal/journal-repository'
import { InMemoryInboxRepository } from './inbox/inbox-repository'

describe('journal repository', () => {
  it('keeps one entry per day with a stable id', () => {
    const repo = new InMemoryJournalRepository()
    const first = repo.writeEntry('2026-10-26', 'Mattina', 1)!
    const second = repo.writeEntry('2026-10-26', 'Mattina tranquilla', 2)!
    expect(second.id).toBe(first.id)
    expect(second.createdAt).toBe(1)
    expect(repo.listEntries()).toHaveLength(1)
  })

  it('does not create an entry for blank text', () => {
    const repo = new InMemoryJournalRepository()
    expect(repo.writeEntry('2026-10-26', '   ')).toBeNull()
    expect(repo.listEntries()).toEqual([])
  })

  it('does not expose another day', () => {
    const repo = new InMemoryJournalRepository()
    repo.writeEntry('2026-10-25', 'Privato')
    expect(repo.getEntry('2026-10-26')).toBeNull()
  })
})

describe('inbox repository', () => {
  it('captures trimmed text without categorising it', () => {
    const repo = new InMemoryInboxRepository()
    const item = repo.capture('  Comprare lampadina ', 'oggi', 5)!
    expect(item).toMatchObject({ text: 'Comprare lampadina', source: 'oggi', createdAt: 5 })
    expect(repo.capture('  ', 'oggi')).toBeNull()
    expect(repo.list()).toHaveLength(1)
  })
})
