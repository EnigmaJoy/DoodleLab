// lib/calendar-repository.test.ts

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LocalCalendarRepository } from './calendar-repository'
import { LocalStorageAdapter } from './storage/local-storage-adapter'
import { MOCK_ITEMS } from './calendar-mock'

beforeEach(() => {
  localStorage.clear()
})

describe('LocalCalendarRepository', () => {
  it('1. seeds from MOCK_ITEMS on first run, transforming postit → note', () => {
    const repo = new LocalCalendarRepository(new LocalStorageAdapter())
    const postitMocks = MOCK_ITEMS.filter(i => i.kind === 'postit')
    expect(postitMocks.length).toBeGreaterThan(0)

    for (const mock of postitMocks) {
      const item = repo.getItem(mock.id)
      expect(item).toBeDefined()
      expect(item!.kind).toBe('note')
    }

    // Non-postit kinds are preserved
    const eventMock = MOCK_ITEMS.find(i => i.kind === 'event')!
    expect(repo.getItem(eventMock.id)!.kind).toBe('event')
    const reminderMock = MOCK_ITEMS.find(i => i.kind === 'reminder')!
    expect(repo.getItem(reminderMock.id)!.kind).toBe('reminder')
  })

  it('2. loads from localStorage on second construction without re-seeding', () => {
    // First construction seeds and persists
    new LocalCalendarRepository(new LocalStorageAdapter())

    // Mutate stored data to detect if re-seeding would overwrite
    const raw = localStorage.getItem('doodlelab:calendar:v1')!
    const payload = JSON.parse(raw)
    payload.items[0].title = '__MODIFIED__'
    localStorage.setItem('doodlelab:calendar:v1', JSON.stringify(payload))

    const repo2 = new LocalCalendarRepository(new LocalStorageAdapter())
    const modifiedItem = repo2.getItem(payload.items[0].id)
    expect(modifiedItem!.title).toBe('__MODIFIED__')
  })

  it('3. getItemsForDate returns only items for the requested date', () => {
    const repo = new LocalCalendarRepository(new LocalStorageAdapter())
    const targetDate = '2026-10-25'
    const items = repo.getItemsForDate(targetDate)

    expect(items.length).toBeGreaterThan(0)
    for (const item of items) {
      expect(item.date).toBe(targetDate)
    }

    // A date with no items returns empty array
    expect(repo.getItemsForDate('1999-01-01')).toEqual([])
  })

  it('4. getDatesWithItems returns a Set of all dates that have items', () => {
    const repo = new LocalCalendarRepository(new LocalStorageAdapter())
    const dates = repo.getDatesWithItems()

    expect(dates).toBeInstanceOf(Set)
    const mockDates = new Set(MOCK_ITEMS.map(i => i.date))
    for (const d of mockDates) {
      expect(dates.has(d)).toBe(true)
    }
  })

  it('5. getGroupsForDate returns items grouped by groupId for a date', () => {
    const repo = new LocalCalendarRepository(new LocalStorageAdapter())
    const groups = repo.getGroupsForDate('2026-10-25')

    expect(groups).toBeInstanceOf(Map)
    expect(groups.has('g1')).toBe(true)
    const g1 = groups.get('g1')!
    expect(g1.length).toBe(4)
    for (const item of g1) {
      expect(item.groupId).toBe('g1')
      expect(item.date).toBe('2026-10-25')
    }

    // Items without a groupId are not included
    const allG1Ids = g1.map(i => i.id)
    expect(allG1Ids).toContain('g1a')
    expect(allG1Ids).toContain('g1b')
    expect(allG1Ids).toContain('g1c')
    expect(allG1Ids).toContain('g1d')
  })

  it('6. addItem creates an item with generated id and ISO createdAt, persists to localStorage', () => {
    const repo = new LocalCalendarRepository(new LocalStorageAdapter())
    const before = Date.now()

    const item = repo.addItem({
      date: '2026-11-03',
      kind: 'note',
      title: 'Test note',
    })

    expect(item.id).toMatch(/^cal_/)
    expect(item.date).toBe('2026-11-03')
    expect(item.kind).toBe('note')
    expect(item.title).toBe('Test note')

    const createdAt = new Date(item.createdAt).getTime()
    expect(createdAt).toBeGreaterThanOrEqual(before)

    // Persisted: a fresh repo from the same storage sees the item
    const repo2 = new LocalCalendarRepository(new LocalStorageAdapter())
    expect(repo2.getItem(item.id)).toEqual(item)
  })

  it('7. deleteItem removes the item and returns true; returns false for unknown id', () => {
    const repo = new LocalCalendarRepository(new LocalStorageAdapter())
    const item = repo.addItem({ date: '2026-11-03', kind: 'event', title: 'To delete' })

    expect(repo.deleteItem(item.id)).toBe(true)
    expect(repo.getItem(item.id)).toBeUndefined()

    // Calling again returns false
    expect(repo.deleteItem(item.id)).toBe(false)

    // Unknown id also returns false
    expect(repo.deleteItem('nonexistent_id')).toBe(false)
  })

  it('8. updateItem merges patch onto existing item; returns null for unknown id', () => {
    const repo = new LocalCalendarRepository(new LocalStorageAdapter())
    const item = repo.addItem({ date: '2026-11-03', kind: 'event', title: 'Original' })

    const updated = repo.updateItem(item.id, { title: 'Updated', color: 'green' })
    expect(updated).not.toBeNull()
    expect(updated!.id).toBe(item.id)
    expect(updated!.title).toBe('Updated')
    expect(updated!.color).toBe('green')
    expect(updated!.date).toBe('2026-11-03')  // unchanged fields preserved

    // Returns null for unknown id
    expect(repo.updateItem('nonexistent_id', { title: 'X' })).toBeNull()
  })

  it('9. deleteItem calls notify (observable via subscribe)', () => {
    const repo = new LocalCalendarRepository(new LocalStorageAdapter())
    const item = repo.addItem({ date: '2026-11-03', kind: 'note', title: 'Notify test' })

    const listener = vi.fn()
    const unsubscribe = repo.subscribe(listener)

    const versionBefore = repo.getVersion()
    repo.deleteItem(item.id)

    expect(listener).toHaveBeenCalledTimes(1)
    expect(repo.getVersion()).toBe(versionBefore + 1)

    unsubscribe()
  })
})
