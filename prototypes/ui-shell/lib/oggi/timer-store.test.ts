import { describe, expect, it } from 'vitest'
import { TimerStore } from './timer-store'
import { remainingMs, tickTimer } from './timer'
import { InMemoryDailyRepository } from './daily-repository'

describe('timer store (block integration)', () => {
  it('startFor loads the block duration and starts counting down', () => {
    const store = new TimerStore()
    store.startFor(90, 'Blocco di concentrazione', 0)
    expect(store.state.status).toBe('running')
    expect(store.label).toBe('Blocco di concentrazione')
    expect(remainingMs(store.state, 30 * 60_000)).toBe(60 * 60_000)
  })

  it('moving a block does not touch the timer', () => {
    const store = new TimerStore()
    const repo = new InMemoryDailyRepository()
    const r = repo.createTimeBlock('2026-10-26', { start: 600, duration: 60 })
    if (!r.ok) throw new Error('setup')
    const before = store.state
    repo.updateTimeBlock(r.block.id, { start: 720 })
    expect(store.state).toBe(before)
    expect(store.state.status).toBe('idle')
  })

  it('finishing the timer does not complete the linked task', () => {
    const store = new TimerStore()
    const repo = new InMemoryDailyRepository()
    const added = repo.addTask('2026-10-26', { title: 'Studiare' })
    if (!added.ok) throw new Error('setup')
    const task = added.task
    repo.createTimeBlock('2026-10-26', { start: 600, duration: 15, taskId: task.id })
    store.startFor(15, task.title, 0)
    store.update(s => tickTimer(s, 16 * 60_000))
    expect(store.state.status).toBe('finished')
    expect(repo.listTasks('2026-10-26')[0].status).toBe('open')
  })

  it('a timer started from a block keeps running when the block is deleted', () => {
    const store = new TimerStore()
    const repo = new InMemoryDailyRepository()
    const r = repo.createTimeBlock('2026-10-26', { start: 600, duration: 75, title: 'Studio' })
    if (!r.ok) throw new Error('setup')
    store.startFor(r.block.duration, r.block.title, 0)
    const running = store.state
    expect(repo.deleteTimeBlock(r.block.id).ok).toBe(true)
    expect(store.state).toBe(running)
    expect(store.label).toBe('Studio')
    expect(remainingMs(store.state, 0)).toBe(75 * 60_000)
  })
})
