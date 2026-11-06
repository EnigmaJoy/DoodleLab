import { beforeEach, describe, expect, it } from 'vitest'
import { InMemoryInboxRepository } from './inbox-repository'
import { LocalStorageAdapter } from '../storage/local-storage-adapter'

describe('InMemoryInboxRepository — persistence', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('updateItem updates text and returns updated item', () => {
    const repo = new InMemoryInboxRepository()
    const item = repo.capture('original text', 'oggi')!
    const updated = repo.updateItem(item.id, 'updated text')
    expect(updated).not.toBeNull()
    expect(updated?.text).toBe('updated text')
    expect(updated?.id).toBe(item.id)
  })

  it('updateItem returns null for unknown id', () => {
    const repo = new InMemoryInboxRepository()
    const result = repo.updateItem('nonexistent-id', 'some text')
    expect(result).toBeNull()
  })

  it('updateItem returns null for blank text', () => {
    const repo = new InMemoryInboxRepository()
    const item = repo.capture('original', 'oggi')!
    const result = repo.updateItem(item.id, '   ')
    expect(result).toBeNull()
  })

  it('deleteItem removes item and returns true', () => {
    const repo = new InMemoryInboxRepository()
    const item = repo.capture('to delete', 'oggi')!
    const result = repo.deleteItem(item.id)
    expect(result).toBe(true)
    expect(repo.list().find(i => i.id === item.id)).toBeUndefined()
  })

  it('deleteItem returns false for unknown id', () => {
    const repo = new InMemoryInboxRepository()
    const result = repo.deleteItem('nonexistent-id')
    expect(result).toBe(false)
  })

  it('capture survives reconstruction (two instances)', () => {
    const storage = new LocalStorageAdapter()
    const repo1 = new InMemoryInboxRepository(storage)
    const item = repo1.capture('persisted item', 'oggi')!

    const repo2 = new InMemoryInboxRepository(storage)
    const found = repo2.list().find(i => i.id === item.id)
    expect(found).not.toBeUndefined()
    expect(found?.text).toBe('persisted item')
  })

  it('deleteItem survives reconstruction (deleted item stays gone)', () => {
    const storage = new LocalStorageAdapter()
    const repo1 = new InMemoryInboxRepository(storage)
    const item = repo1.capture('will be deleted', 'oggi')!
    repo1.deleteItem(item.id)

    const repo2 = new InMemoryInboxRepository(storage)
    expect(repo2.list().find(i => i.id === item.id)).toBeUndefined()
  })
})
