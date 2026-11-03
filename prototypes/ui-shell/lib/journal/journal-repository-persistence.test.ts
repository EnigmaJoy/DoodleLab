import { beforeEach, describe, expect, it } from 'vitest'
import { InMemoryJournalRepository } from './journal-repository'
import { LocalStorageAdapter } from '../storage/local-storage-adapter'

describe('InMemoryJournalRepository — persistence', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('deleteEntry removes entry and returns true', () => {
    const repo = new InMemoryJournalRepository()
    repo.writeEntry('2026-11-03', 'hello')
    const result = repo.deleteEntry('2026-11-03')
    expect(result).toBe(true)
    expect(repo.getEntry('2026-11-03')).toBeNull()
  })

  it('deleteEntry returns false for non-existent day', () => {
    const repo = new InMemoryJournalRepository()
    const result = repo.deleteEntry('2026-01-01')
    expect(result).toBe(false)
  })

  it('writeEntry survives reconstruction (two instances)', () => {
    const storage = new LocalStorageAdapter()
    const repo1 = new InMemoryJournalRepository(storage)
    repo1.writeEntry('2026-11-03', 'persisted body')

    const repo2 = new InMemoryJournalRepository(storage)
    const entry = repo2.getEntry('2026-11-03')
    expect(entry).not.toBeNull()
    expect(entry?.body).toBe('persisted body')
  })

  it('deleteEntry survives reconstruction (deleted entries stay gone)', () => {
    const storage = new LocalStorageAdapter()
    const repo1 = new InMemoryJournalRepository(storage)
    repo1.writeEntry('2026-11-03', 'will be deleted')
    repo1.deleteEntry('2026-11-03')

    const repo2 = new InMemoryJournalRepository(storage)
    expect(repo2.getEntry('2026-11-03')).toBeNull()
  })
})
