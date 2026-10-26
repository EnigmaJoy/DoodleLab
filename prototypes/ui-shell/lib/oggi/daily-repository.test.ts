import { describe, expect, it } from 'vitest'
import { InMemoryDailyRepository } from './daily-repository'
import type { NewTask } from './types'

const D1 = '2026-10-25'
const D2 = '2026-10-26'

function add(repo: InMemoryDailyRepository, day: string, input: NewTask) {
  const result = repo.addTask(day, input)
  if (!result.ok) throw new Error('setup')
  return result.task
}

describe('tasks', () => {
  it('rejects empty titles', () => {
    const repo = new InMemoryDailyRepository()
    expect(repo.addTask(D1, { title: '   ' })).toEqual({ ok: false, error: { type: 'empty-title' } })
    expect(repo.listTasks(D1)).toEqual([])
  })

  it('keeps tasks scoped to their own day', () => {
    const repo = new InMemoryDailyRepository()
    repo.addTask(D1, { title: 'Ieri' })
    repo.addTask(D2, { title: 'Oggi' })
    expect(repo.listTasks(D1).map(t => t.title)).toEqual(['Ieri'])
    expect(repo.listTasks(D2).map(t => t.title)).toEqual(['Oggi'])
  })

  it('completion keeps identity and visibility; archive hides; delete removes', () => {
    const repo = new InMemoryDailyRepository({ now: () => 1000 })
    const task = add(repo, D1, { title: 'Chiamare', priority: true, deadline: '12:00' })
    const done = repo.setTaskDone(task.id, true)
    expect(done).toMatchObject({ ok: true, task: { id: task.id, status: 'done', completedAt: 1000 } })
    expect(repo.listTasks(D1)).toHaveLength(1)

    repo.archiveTask(task.id)
    expect(repo.listTasks(D1)).toHaveLength(0)

    const other = add(repo, D1, { title: 'Altro' })
    expect(repo.deleteTask(other.id).ok).toBe(true)
    expect(repo.deleteTask(other.id)).toEqual({ ok: false, error: { type: 'not-found' } })
  })

  it('drops malformed deadlines', () => {
    const repo = new InMemoryDailyRepository()
    expect(add(repo, D1, { title: 'X', deadline: '25:99' }).deadline).toBeUndefined()
  })

  it('notifies subscribers on change', () => {
    const repo = new InMemoryDailyRepository()
    let calls = 0
    repo.subscribe(() => calls++)
    repo.addTask(D1, { title: 'A' })
    expect(calls).toBe(1)
    expect(repo.getVersion()).toBe(1)
  })
})

describe('focus', () => {
  it('allows only one open focus per day', () => {
    const repo = new InMemoryDailyRepository()
    const first = repo.setFocus(D1, 'Prima')!
    const second = repo.setFocus(D1, 'Rinominata')!
    expect(second.id).toBe(first.id)
    expect(repo.getFocus(D1).active?.title).toBe('Rinominata')
  })

  it('keeps completed focus visible and allows a new one', () => {
    const repo = new InMemoryDailyRepository()
    const first = repo.setFocus(D1, 'Prima')!
    repo.setTaskDone(first.id, true)
    const next = repo.setFocus(D1, 'Seconda')!
    const state = repo.getFocus(D1)
    expect(next.id).not.toBe(first.id)
    expect(state.active?.id).toBe(next.id)
    expect(state.completed.map(t => t.id)).toEqual([first.id])
  })

  it('refuses to reopen a completed focus while another is open', () => {
    const repo = new InMemoryDailyRepository()
    const first = repo.setFocus(D1, 'Prima')!
    repo.setTaskDone(first.id, true)
    repo.setFocus(D1, 'Seconda')
    expect(repo.setTaskDone(first.id, false)).toEqual({ ok: false, error: { type: 'focus-open' } })
    expect(repo.getFocus(D1).completed).toHaveLength(1)
  })

  it('does not leak focus between days', () => {
    const repo = new InMemoryDailyRepository()
    repo.setFocus(D1, 'Ieri')
    expect(repo.getFocus(D2).active).toBeNull()
  })
})

describe('check-in', () => {
  it('stores partial values per day and clamps the scale', () => {
    const repo = new InMemoryDailyRepository()
    repo.setCheckIn(D1, { energy: 9 })
    repo.setCheckIn(D1, { mood: 2 })
    expect(repo.getCheckIn(D1)).toMatchObject({ energy: 5, mood: 2 })
    expect(repo.getCheckIn(D2)).toBeNull()
    repo.clearCheckIn(D1)
    expect(repo.getCheckIn(D1)).toBeNull()
  })
})

describe('energy activities', () => {
  it('lists only activities for the chosen level', () => {
    const repo = new InMemoryDailyRepository()
    repo.addEnergyActivity('bassa', 'Riordinare la scrivania')
    repo.addEnergyActivity('alta', 'Fare la dichiarazione')
    expect(repo.listEnergyActivities('bassa').map(a => a.title)).toEqual(['Riordinare la scrivania'])
    expect(repo.listEnergyActivities('media')).toEqual([])
  })
})
