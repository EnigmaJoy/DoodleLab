import { describe, expect, it } from 'vitest'
import { InMemoryDailyRepository } from './daily-repository'
import { EMPTY_DRAFT, draftFromTask, draftToInput, validateDraft } from './task-form'
import type { NewTask } from './types'

const DAY  = '2026-10-26'
const NEXT = '2026-10-27'

function setup(guard?: () => string | null) {
  let clock = 1000
  const repo = new InMemoryDailyRepository({ now: () => clock, writeGuard: guard })
  const tick = (to: number) => { clock = to }
  const add = (input: NewTask, day = DAY) => {
    const r = repo.addTask(day, input)
    if (!r.ok) throw new Error('setup')
    return r.task
  }
  return { repo, tick, add }
}

describe('creating tasks', () => {
  it('creates with title only: open, no deadline, no priority, timestamps', () => {
    const { repo } = setup()
    const r = repo.addTask(DAY, draftToInput({ ...EMPTY_DRAFT, title: '  Rispondere alla mail  ' }))
    expect(r).toMatchObject({ ok: true, task: {
      day: DAY, title: 'Rispondere alla mail', status: 'open', priority: false,
      deadline: undefined, isFocus: false, archived: false, createdAt: 1000, updatedAt: 1000,
    } })
    expect(repo.listTasks(DAY)).toHaveLength(1)
  })

  it('creates with deadline and priority', () => {
    const { repo } = setup()
    const r = repo.addTask(DAY, draftToInput({ title: 'Chiamare il commercialista', deadline: '12:00', priority: true }))
    expect(r).toMatchObject({ ok: true, task: { deadline: '12:00', priority: true } })
  })

  it('rejects an empty or whitespace-only title (form and repository)', () => {
    const { repo } = setup()
    expect(validateDraft({ ...EMPTY_DRAFT, title: '   ' })).toBe('Scrivi che cosa vuoi fare.')
    expect(validateDraft({ ...EMPTY_DRAFT, title: 'x', deadline: '99:99' })).not.toBeNull()
    expect(repo.addTask(DAY, { title: '\t ' })).toEqual({ ok: false, error: { type: 'empty-title' } })
    expect(repo.listTasks(DAY)).toEqual([])
  })

  it('associates the task with the displayed day only', () => {
    const { repo, add } = setup()
    add({ title: 'Domani' }, NEXT)
    expect(repo.listTasks(DAY)).toEqual([])
    expect(repo.listTasks(NEXT).map(t => t.day)).toEqual([NEXT])
  })
})

describe('contextual actions', () => {
  it('sets and removes priority on the same task', () => {
    const { repo, tick, add } = setup()
    const task = add({ title: 'A' })
    tick(2000)
    expect(repo.updateTask(task.id, { priority: true })).toMatchObject({ ok: true, task: { id: task.id, priority: true, updatedAt: 2000 } })
    expect(repo.updateTask(task.id, { priority: false })).toMatchObject({ ok: true, task: { priority: false } })
    expect(repo.listTasks(DAY)).toHaveLength(1)
  })

  it('edits the same task without duplicating it, preserving untouched fields', () => {
    const { repo, tick, add } = setup()
    const task = add({ title: 'Comprare croccantini', deadline: '18:00', priority: true })
    repo.setTaskDone(task.id, true)
    const block = repo.createTimeBlock(DAY, { start: 600, duration: 60, taskId: task.id })
    tick(5000)
    const draft = { ...draftFromTask(repo.getTask(task.id)!), title: 'Comprare croccantini e lettiera' }
    const r = repo.updateTask(task.id, draftToInput(draft))
    expect(r).toMatchObject({ ok: true, task: {
      id: task.id, day: DAY, title: 'Comprare croccantini e lettiera', deadline: '18:00', priority: true,
      status: 'done', completedAt: 1000, createdAt: 1000, updatedAt: 5000,
    } })
    expect(repo.listTasks(DAY)).toHaveLength(1)
    expect(block.ok && repo.getTimeBlock(block.block.id)?.taskId).toBe(task.id)
  })

  it('clears the deadline when the edit leaves it empty', () => {
    const { repo, add } = setup()
    const task = add({ title: 'A', deadline: '09:30' })
    const r = repo.updateTask(task.id, draftToInput({ ...draftFromTask(task), deadline: '' }))
    expect(r.ok && r.task.deadline).toBeUndefined()
  })

  it('an unchanged edit does not write or notify', () => {
    const { repo, add } = setup()
    const task = add({ title: 'A' })
    let notified = 0
    repo.subscribe(() => notified++)
    expect(repo.updateTask(task.id, draftToInput(draftFromTask(task)))).toEqual({ ok: true, task })
    expect(notified).toBe(0)
  })
})

describe('deletion (permanent: a task belongs to exactly one day)', () => {
  it('removes only the task; linked blocks and other tasks stay', () => {
    const { repo, add } = setup()
    const task  = add({ title: 'Chiamare il commercialista' })
    const other = add({ title: 'Altro' })
    const block = repo.createTimeBlock(DAY, { start: 600, duration: 60, taskId: task.id, title: task.title })
    expect(repo.deleteTask(task.id)).toEqual({ ok: true, task })
    expect(repo.getTask(task.id)).toBeNull()
    expect(repo.listTasks(DAY)).toEqual([other])
    expect(repo.listTimeBlocks(DAY)).toEqual(block.ok ? [block.block] : [])
  })

  it('archive is a separate operation that keeps the task', () => {
    const { repo, add } = setup()
    const task = add({ title: 'A' })
    repo.setTaskDone(task.id, true)
    expect(repo.archiveTask(task.id)).toMatchObject({ ok: true, task: { archived: true, status: 'done' } })
    expect(repo.listTasks(DAY)).toEqual([])
    expect(repo.getTask(task.id)).not.toBeNull()
  })
})

describe('completion lifecycle', () => {
  it('done keeps identity and stays listed; reopening restores the same task', () => {
    const { repo, tick, add } = setup()
    const task = add({ title: 'Prenotare la visita', priority: true, deadline: '11:00' })
    tick(3000)
    const done = repo.setTaskDone(task.id, true)
    expect(done).toMatchObject({ ok: true, task: { id: task.id, status: 'done', completedAt: 3000 } })
    expect(repo.listTasks(DAY).filter(t => t.status === 'done').map(t => t.id)).toEqual([task.id])
    const reopened = repo.setTaskDone(task.id, false)
    expect(reopened).toMatchObject({ ok: true, task: { id: task.id, status: 'open', completedAt: undefined, priority: true, deadline: '11:00', archived: false } })
  })

  it('completing a task does not touch its linked block', () => {
    const { repo, add } = setup()
    const task  = add({ title: 'Studiare' })
    const block = repo.createTimeBlock(DAY, { start: 600, duration: 60, taskId: task.id })
    if (!block.ok) throw new Error('setup')
    repo.setTaskDone(task.id, true)
    expect(repo.getTimeBlock(block.block.id)).toEqual(block.block)
  })
})

describe('repository failures', () => {
  it('every refused write returns a storage error and changes nothing', () => {
    let failing: string | null = null
    const { repo, add } = setup(() => failing)
    const task = add({ title: 'A' })
    const snapshot = repo.listTasks(DAY)
    let notified = 0
    repo.subscribe(() => notified++)
    failing = 'archivio non disponibile.'
    const storage = { ok: false, error: { type: 'storage', message: 'archivio non disponibile.' } }
    expect(repo.addTask(DAY, { title: 'B' })).toEqual(storage)
    expect(repo.updateTask(task.id, { priority: true })).toEqual(storage)
    expect(repo.setTaskDone(task.id, true)).toEqual(storage)
    expect(repo.archiveTask(task.id)).toEqual(storage)
    expect(repo.deleteTask(task.id)).toEqual(storage)
    expect(repo.listTasks(DAY)).toEqual(snapshot)
    expect(notified).toBe(0)
  })
})
