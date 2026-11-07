import { beforeEach, describe, expect, it } from 'vitest'
import { InMemoryDailyRepository } from './daily-repository'
import { LocalStorageAdapter } from '../storage/local-storage-adapter'

const D1 = '2026-10-25'

beforeEach(() => {
  localStorage.clear()
})

describe('updateEnergyActivity', () => {
  it('updates the title and returns the updated activity', () => {
    const repo = new InMemoryDailyRepository()
    const activity = repo.addEnergyActivity('low', 'Original title')!
    const updated = repo.updateEnergyActivity(activity.id, 'Updated title')
    expect(updated).not.toBeNull()
    expect(updated!.id).toBe(activity.id)
    expect(updated!.title).toBe('Updated title')
    expect(updated!.level).toBe('low')
    expect(repo.listEnergyActivities('low')[0].title).toBe('Updated title')
  })

  it('returns null for unknown id', () => {
    const repo = new InMemoryDailyRepository()
    expect(repo.updateEnergyActivity('nonexistent-id', 'Some title')).toBeNull()
  })

  it('returns null for blank title', () => {
    const repo = new InMemoryDailyRepository()
    const activity = repo.addEnergyActivity('high', 'Real title')!
    expect(repo.updateEnergyActivity(activity.id, '   ')).toBeNull()
    // Original title should be unchanged
    expect(repo.listEnergyActivities('high')[0].title).toBe('Real title')
  })
})

describe('localStorage persistence', () => {
  it('task survives reconstruction', () => {
    const adapter = new LocalStorageAdapter()
    const repo1 = new InMemoryDailyRepository({ storage: adapter })
    repo1.addTask(D1, { title: 'Persisted task' })

    const repo2 = new InMemoryDailyRepository({ storage: adapter })
    const tasks = repo2.listTasks(D1)
    expect(tasks).toHaveLength(1)
    expect(tasks[0].title).toBe('Persisted task')
  })

  it('energy activity survives reconstruction', () => {
    const adapter = new LocalStorageAdapter()
    const repo1 = new InMemoryDailyRepository({ storage: adapter })
    repo1.addEnergyActivity('medium', 'Fare una passeggiata')

    const repo2 = new InMemoryDailyRepository({ storage: adapter })
    const activities = repo2.listEnergyActivities('medium')
    expect(activities).toHaveLength(1)
    expect(activities[0].title).toBe('Fare una passeggiata')
  })

  it('checkIn survives reconstruction', () => {
    const adapter = new LocalStorageAdapter()
    const repo1 = new InMemoryDailyRepository({ storage: adapter })
    repo1.setCheckIn(D1, { energy: 4, mood: 3 })

    const repo2 = new InMemoryDailyRepository({ storage: adapter })
    const checkIn = repo2.getCheckIn(D1)
    expect(checkIn).not.toBeNull()
    expect(checkIn!.energy).toBe(4)
    expect(checkIn!.mood).toBe(3)
  })

  it('time block survives reconstruction', () => {
    const adapter = new LocalStorageAdapter()
    const repo1 = new InMemoryDailyRepository({ storage: adapter })
    const result = repo1.createTimeBlock(D1, { start: 540, duration: 60, title: 'Riunione' })
    expect(result.ok).toBe(true)

    const repo2 = new InMemoryDailyRepository({ storage: adapter })
    const blocks = repo2.listTimeBlocks(D1)
    expect(blocks).toHaveLength(1)
    expect(blocks[0].title).toBe('Riunione')
    expect(blocks[0].start).toBe(540)
    expect(blocks[0].duration).toBe(60)
  })
})
