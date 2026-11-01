import { describe, expect, it } from 'vitest'
import { InMemoryDailyRepository } from './daily-repository'
import { DEFAULT_BLOCK_TITLE, fixedIntervals } from './time-blocks'
import { buildTimeline } from './timeline'
import { getItemsForDate, MOCK_ITEMS } from '../calendar-mock'

const DAY = '2026-10-26'
const meetingDay = '2026-10-19' // fixture: events at 09:00 and 16:00 (no end)

function repoWithCalendar(guard?: () => string | null) {
  return new InMemoryDailyRepository({
    fixedIntervals: day => fixedIntervals(getItemsForDate(day)),
    now:            () => 1000,
    timeZone:       () => 'Europe/Rome',
    writeGuard:     guard,
  })
}

describe('creating time blocks', () => {
  it('creates with the default title, a stable id, zone and timestamps', () => {
    const repo = repoWithCalendar()
    const r = repo.createTimeBlock(DAY, { start: 660, duration: 60 })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.block).toMatchObject({
      title: DEFAULT_BLOCK_TITLE, day: DAY, start: 660, duration: 60,
      timeZone: 'Europe/Rome', createdAt: 1000, updatedAt: 1000,
    })
    expect(r.block.id).toMatch(/^block_/)
    expect(repo.listTimeBlocks(DAY)).toEqual([r.block])
  })

  it('links to a task without creating or changing tasks', () => {
    const repo = repoWithCalendar()
    const added = repo.addTask(DAY, { title: 'Chiamare il commercialista' })
    if (!added.ok) throw new Error('setup')
    const task = added.task
    const before = repo.listTasks(DAY)
    const r = repo.createTimeBlock(DAY, { start: 660, duration: 60, title: task.title, taskId: task.id })
    expect(r.ok && r.block.taskId).toBe(task.id)
    expect(repo.listTasks(DAY)).toEqual(before)
    expect(repo.listTasks(DAY)[0].status).toBe('open')
  })

  it('refuses a block over a fixed appointment and stores nothing', () => {
    const repo = repoWithCalendar()
    let notified = 0
    repo.subscribe(() => notified++)
    const r = repo.createTimeBlock(meetingDay, { start: 9 * 60 + 15, duration: 60 })
    expect(r).toMatchObject({ ok: false, error: { type: 'overlap' } })
    expect(repo.listTimeBlocks(meetingDay)).toEqual([])
    expect(notified).toBe(0)
  })

  it('allows a block over a reminder or a PostIt', () => {
    const repo = repoWithCalendar()
    // 2026-10-26 has only a reminder at 09:00
    expect(repo.createTimeBlock(DAY, { start: 9 * 60, duration: 60 }).ok).toBe(true)
  })

  it('allows flexible blocks to overlap each other (drawn side by side)', () => {
    const repo = repoWithCalendar()
    expect(repo.createTimeBlock(DAY, { start: 600, duration: 60 }).ok).toBe(true)
    expect(repo.createTimeBlock(DAY, { start: 630, duration: 60 }).ok).toBe(true)
    expect(repo.listTimeBlocks(DAY)).toHaveLength(2)
  })
})

describe('updating time blocks', () => {
  it('moves keeping identity and bumps updatedAt only', () => {
    let clock = 1000
    const repo = new InMemoryDailyRepository({ now: () => clock })
    const created = repo.createTimeBlock(DAY, { start: 630, duration: 90 })
    if (!created.ok) throw new Error('setup')
    clock = 2000
    const moved = repo.updateTimeBlock(created.block.id, { start: 675 })
    expect(moved).toMatchObject({ ok: true, block: { id: created.block.id, start: 675, duration: 90, createdAt: 1000, updatedAt: 2000 } })
  })

  it('rejects an invalid update and keeps the previous stored state', () => {
    const repo = repoWithCalendar()
    const created = repo.createTimeBlock(meetingDay, { start: 600, duration: 60 })
    if (!created.ok) throw new Error('setup')
    expect(repo.updateTimeBlock(created.block.id, { start: 8 * 60 + 30 })).toMatchObject({ ok: false, error: { type: 'overlap' } })
    expect(repo.updateTimeBlock(created.block.id, { duration: 0 })).toMatchObject({ ok: false, error: { type: 'too-short' } })
    expect(repo.getTimeBlock(created.block.id)).toEqual(created.block)
  })

  it('reports not-found for a deleted block', () => {
    const repo = repoWithCalendar()
    const created = repo.createTimeBlock(DAY, { start: 600, duration: 60 })
    if (!created.ok) throw new Error('setup')
    repo.deleteTimeBlock(created.block.id)
    expect(repo.updateTimeBlock(created.block.id, { start: 700 })).toEqual({ ok: false, error: { type: 'not-found' } })
  })

  it('an empty title falls back to the default', () => {
    const repo = repoWithCalendar()
    const created = repo.createTimeBlock(DAY, { start: 600, duration: 60, title: 'Studio' })
    if (!created.ok) throw new Error('setup')
    expect(repo.updateTimeBlock(created.block.id, { title: '  ' })).toMatchObject({ ok: true, block: { title: DEFAULT_BLOCK_TITLE } })
  })
})

describe('renaming a linked block', () => {
  it('changes only the block title, never the linked task', () => {
    const repo = repoWithCalendar()
    const added = repo.addTask(DAY, { title: 'Chiamare il commercialista', priority: true })
    if (!added.ok) throw new Error('setup')
    const created = repo.createTimeBlock(DAY, { start: 630, duration: 90, title: added.task.title, taskId: added.task.id })
    if (!created.ok) throw new Error('setup')
    const renamed = repo.updateTimeBlock(created.block.id, { title: 'Telefonate' })
    expect(renamed).toMatchObject({ ok: true, block: { id: created.block.id, title: 'Telefonate', start: 630, duration: 90, taskId: added.task.id } })
    expect(repo.listTimeBlocks(DAY)).toHaveLength(1)
    expect(repo.getTask(added.task.id)).toEqual(added.task)
  })
})

describe('deleting time blocks', () => {
  function dayWithEverything(guard?: () => string | null) {
    const repo = repoWithCalendar(guard)
    const open = repo.addTask(DAY, { title: 'Chiamare il commercialista', priority: true, deadline: '12:00' })
    const done = repo.addTask(DAY, { title: 'Prenotare la visita' })
    if (!open.ok || !done.ok) throw new Error('setup')
    repo.setTaskDone(done.task.id, true)
    const linked = repo.createTimeBlock(DAY, { start: 630, duration: 90, title: 'Blocco di concentrazione', taskId: open.task.id })
    const other  = repo.createTimeBlock(DAY, { start: 900, duration: 60, title: 'Studio' })
    const doneLinked = repo.createTimeBlock(DAY, { start: 1000, duration: 30, taskId: done.task.id })
    if (!linked.ok || !other.ok || !doneLinked.ok) throw new Error('setup')
    return { repo, open: open.task.id, done: done.task.id, linked: linked.block, other: other.block, doneLinked: doneLinked.block }
  }

  it('removes exactly the selected block and returns it', () => {
    const { repo, linked, other, doneLinked } = dayWithEverything()
    let notified = 0
    repo.subscribe(() => notified++)
    expect(repo.deleteTimeBlock(linked.id)).toEqual({ ok: true, block: linked })
    expect(repo.getTimeBlock(linked.id)).toBeNull()
    expect(repo.listTimeBlocks(DAY)).toEqual([other, doneLinked])
    expect(notified).toBe(1)
  })

  it('keeps linked tasks with their priority, deadline and completion state', () => {
    const { repo, open, done, linked, doneLinked } = dayWithEverything()
    const tasksBefore = JSON.stringify(repo.listTasks(DAY))
    repo.deleteTimeBlock(linked.id)
    repo.deleteTimeBlock(doneLinked.id)
    expect(JSON.stringify(repo.listTasks(DAY))).toBe(tasksBefore)
    expect(repo.getTask(open)).toMatchObject({ status: 'open', priority: true, deadline: '12:00' })
    expect(repo.getTask(done)).toMatchObject({ status: 'done' })
  })

  it('never touches calendar appointments, reminders or PostIts', () => {
    const snapshot = JSON.stringify(MOCK_ITEMS)
    const { repo, linked } = dayWithEverything()
    repo.deleteTimeBlock(linked.id)
    expect(JSON.stringify(MOCK_ITEMS)).toBe(snapshot)
  })

  it('a second delete of the same block is not-found and changes nothing', () => {
    const { repo, linked, other, doneLinked } = dayWithEverything()
    repo.deleteTimeBlock(linked.id)
    let notified = 0
    repo.subscribe(() => notified++)
    expect(repo.deleteTimeBlock(linked.id)).toEqual({ ok: false, error: { type: 'not-found' } })
    expect(repo.listTimeBlocks(DAY)).toEqual([other, doneLinked])
    expect(notified).toBe(0)
  })

  it('a refused delete keeps the block and does not notify', () => {
    let failing: string | null = null
    const { repo, linked } = dayWithEverything(() => failing)
    const before = repo.listTimeBlocks(DAY)
    let notified = 0
    repo.subscribe(() => notified++)
    failing = 'archivio non disponibile.'
    expect(repo.deleteTimeBlock(linked.id)).toEqual({ ok: false, error: { type: 'storage', message: 'archivio non disponibile.' } })
    expect(repo.listTimeBlocks(DAY)).toEqual(before)
    expect(notified).toBe(0)
    failing = null
    expect(repo.deleteTimeBlock(linked.id).ok).toBe(true)
  })
})

describe('storage failure', () => {
  it('a refused write changes nothing and does not notify', () => {
    let failing: string | null = null
    const repo = repoWithCalendar(() => failing)
    const created = repo.createTimeBlock(DAY, { start: 600, duration: 60 })
    if (!created.ok) throw new Error('setup')
    let notified = 0
    repo.subscribe(() => notified++)
    failing = 'archivio non disponibile.'
    expect(repo.updateTimeBlock(created.block.id, { start: 700 })).toEqual({
      ok: false, error: { type: 'storage', message: 'archivio non disponibile.' },
    })
    expect(repo.createTimeBlock(DAY, { start: 800, duration: 60 }).ok).toBe(false)
    expect(repo.listTimeBlocks(DAY)).toEqual([created.block])
    expect(notified).toBe(0)
  })
})

describe('calendar integrity and rendering', () => {
  it('never mutates calendar appointments', () => {
    const snapshot = JSON.stringify(MOCK_ITEMS)
    const repo = repoWithCalendar()
    repo.createTimeBlock(meetingDay, { start: 9 * 60, duration: 60 })
    repo.createTimeBlock(meetingDay, { start: 11 * 60, duration: 60 })
    expect(JSON.stringify(MOCK_ITEMS)).toBe(snapshot)
  })

  it('timeline position derives from stored minutes after re-read', () => {
    const repo = repoWithCalendar()
    const created = repo.createTimeBlock(DAY, { start: 630, duration: 90 })
    if (!created.ok) throw new Error('setup')
    repo.updateTimeBlock(created.block.id, { start: 675 })
    const entry = buildTimeline([], repo.listTimeBlocks(DAY)).timed[0]
    expect(entry).toMatchObject({ kind: 'block', start: 675, end: 765 })
  })
})
