// lib/oggi/daily-repository.ts
// Data access for daily planning entities. The interface is the contract the
// UI depends on; InMemoryDailyRepository is the only implementation in this
// increment (see PERSISTENCE_MODE). A durable implementation must go through
// the encrypted vault once it exists - never plain localStorage/IndexedDB.

import { ChangeNotifier, createId } from '../store'
import { parseTime, type DayKey } from '../day'
import { getItemsForDate } from '../calendar-mock'
import type {
  CheckIn, EnergyActivity, EnergyLevel, NewTask, Task, TaskPatch, TimeBlock,
} from './types'
import {
  DEFAULT_BLOCK_TITLE, currentTimeZone, fixedIntervals, validatePlacement,
  type FixedInterval, type PlacementError, type Slot,
} from './time-blocks'

export type TaskError =
  | { type: 'empty-title' }
  | { type: 'not-found' }
  /** Re-opening a completed focus while another focus is open */
  | { type: 'focus-open' }
  /** The store refused the write; nothing was changed */
  | { type: 'storage'; message: string }

export type TaskResult =
  | { ok: true;  task: Task }
  | { ok: false; error: TaskError }

export type BlockError =
  | PlacementError
  | { type: 'not-found' }
  /** The store refused the write; nothing was changed */
  | { type: 'storage'; message: string }

export type BlockResult =
  | { ok: true;  block: TimeBlock }
  | { ok: false; error: BlockError }

export interface NewTimeBlock extends Slot {
  title?:  string
  taskId?: string
}

export interface TimeBlockPatch {
  start?:    number
  duration?: number
  title?:    string
}

export interface FocusState {
  active:    Task | null
  completed: Task[]
}

export interface DailyRepository {
  subscribe(listener: () => void): () => void
  getVersion(): number

  // Tasks. A task belongs to exactly one day. Completion, archiving
  // (hidden, kept) and deletion (permanent) are distinct operations, and
  // none of them touches linked time blocks. A failed result changed nothing.
  listTasks(day: DayKey): Task[]
  getTask(id: string): Task | null
  addTask(day: DayKey, input: NewTask): TaskResult
  updateTask(id: string, patch: TaskPatch): TaskResult
  setTaskDone(id: string, done: boolean): TaskResult
  archiveTask(id: string): TaskResult
  /** Permanently removes the task; returns the removed task */
  deleteTask(id: string): TaskResult

  // Focus (a Task with isFocus = true; at most one open per day)
  getFocus(day: DayKey): FocusState
  setFocus(day: DayKey, title: string): Task | null

  // Flexible time blocks. Every write is validated against fixed
  // appointments; a failed result means nothing was changed.
  listTimeBlocks(day: DayKey): TimeBlock[]
  getTimeBlock(id: string): TimeBlock | null
  /** Same rules as create/update, without writing (for live feedback) */
  validateTimeBlock(day: DayKey, slot: Slot): PlacementError | null
  createTimeBlock(day: DayKey, input: NewTimeBlock): BlockResult
  updateTimeBlock(id: string, patch: TimeBlockPatch): BlockResult
  /**
   * Permanently removes this one block; returns the removed block. Linked
   * tasks, appointments, reminders, PostIts, other blocks and the timer are
   * never touched (a task holds no reference back to its blocks).
   */
  deleteTimeBlock(id: string): BlockResult

  // Energy activities
  listEnergyActivities(level: EnergyLevel): EnergyActivity[]
  addEnergyActivity(level: EnergyLevel, title: string): EnergyActivity | null
  deleteEnergyActivity(id: string): boolean

  // Check-in
  getCheckIn(day: DayKey): CheckIn | null
  setCheckIn(day: DayKey, patch: { energy?: number; mood?: number }, now?: number): CheckIn
  clearCheckIn(day: DayKey): void
}

function cleanTitle(title: string): string | null {
  const trimmed = title.trim()
  return trimmed.length > 0 ? trimmed : null
}

function cleanDeadline(deadline: string | undefined): string | undefined {
  if (!deadline) return undefined
  return parseTime(deadline) === null ? undefined : deadline.trim()
}

function clampScale(value: number | undefined): number | undefined {
  if (value === undefined) return undefined
  return Math.max(1, Math.min(5, Math.round(value)))
}

export interface DailyRepositoryOptions {
  /** Protected appointment intervals for a day (default: none) */
  fixedIntervals?: (day: DayKey) => FixedInterval[]
  now?:            () => number
  timeZone?:       () => string
  /**
   * Called before every task and time-block write; a returned message
   * refuses the write. Models a failing store (e.g. a locked vault).
   */
  writeGuard?:     () => string | null
}

export class InMemoryDailyRepository extends ChangeNotifier implements DailyRepository {
  private readonly fixedFor: (day: DayKey) => FixedInterval[]
  private readonly now:      () => number
  private readonly zone:     () => string
  private readonly guard:    () => string | null

  constructor(options: DailyRepositoryOptions = {}) {
    super()
    this.fixedFor = options.fixedIntervals ?? (() => [])
    this.now      = options.now ?? Date.now
    this.zone     = options.timeZone ?? currentTimeZone
    this.guard    = options.writeGuard ?? (() => null)
  }

  private tasks      = new Map<string, Task>()
  private blocks     = new Map<string, TimeBlock>()
  private activities = new Map<string, EnergyActivity>()
  private checkIns   = new Map<DayKey, CheckIn>()

  // -- Tasks ----------------------------------------------------------------

  listTasks(day: DayKey): Task[] {
    // Map iteration preserves insertion order = creation order
    return [...this.tasks.values()].filter(t => t.day === day && !t.archived)
  }

  getTask(id: string): Task | null {
    return this.tasks.get(id) ?? null
  }

  private refused(): TaskResult | null {
    const message = this.guard()
    return message ? { ok: false, error: { type: 'storage', message } } : null
  }

  private store(task: Task): TaskResult {
    this.tasks.set(task.id, task)
    this.notify()
    return { ok: true, task }
  }

  addTask(day: DayKey, input: NewTask): TaskResult {
    const title = cleanTitle(input.title)
    if (!title) return { ok: false, error: { type: 'empty-title' } }
    const refused = this.refused()
    if (refused) return refused
    const now = this.now()
    return this.store({
      id:        createId('task'),
      day,
      title,
      status:    'open',
      priority:  input.priority ?? false,
      deadline:  cleanDeadline(input.deadline),
      isFocus:   false,
      archived:  false,
      createdAt: now,
      updatedAt: now,
    })
  }

  updateTask(id: string, patch: TaskPatch): TaskResult {
    const task = this.tasks.get(id)
    if (!task) return { ok: false, error: { type: 'not-found' } }
    let title = task.title
    if (patch.title !== undefined) {
      const cleaned = cleanTitle(patch.title)
      if (!cleaned) return { ok: false, error: { type: 'empty-title' } }
      title = cleaned
    }
    const priority = patch.priority ?? task.priority
    const deadline = 'deadline' in patch ? cleanDeadline(patch.deadline) : task.deadline
    if (title === task.title && priority === task.priority && deadline === task.deadline) {
      return { ok: true, task }
    }
    const refused = this.refused()
    if (refused) return refused
    return this.store({ ...task, title, priority, deadline, updatedAt: this.now() })
  }

  setTaskDone(id: string, done: boolean): TaskResult {
    const task = this.tasks.get(id)
    if (!task) return { ok: false, error: { type: 'not-found' } }
    if ((task.status === 'done') === done) return { ok: true, task }
    // Re-opening a completed focus must not create a second open focus.
    if (!done && task.isFocus) {
      const open = this.getFocus(task.day).active
      if (open && open.id !== id) return { ok: false, error: { type: 'focus-open' } }
    }
    const refused = this.refused()
    if (refused) return refused
    const now = this.now()
    return this.store(done
      ? { ...task, status: 'done', completedAt: now, updatedAt: now }
      : { ...task, status: 'open', completedAt: undefined, updatedAt: now })
  }

  archiveTask(id: string): TaskResult {
    const task = this.tasks.get(id)
    if (!task) return { ok: false, error: { type: 'not-found' } }
    const refused = this.refused()
    if (refused) return refused
    return this.store({ ...task, archived: true, updatedAt: this.now() })
  }

  deleteTask(id: string): TaskResult {
    const task = this.tasks.get(id)
    if (!task) return { ok: false, error: { type: 'not-found' } }
    const refused = this.refused()
    if (refused) return refused
    this.tasks.delete(id)
    this.notify()
    return { ok: true, task }
  }

  // -- Focus ----------------------------------------------------------------

  getFocus(day: DayKey): FocusState {
    const focusTasks = [...this.tasks.values()]
      .filter(t => t.day === day && t.isFocus && !t.archived)
    return {
      active:    focusTasks.find(t => t.status === 'open') ?? null,
      completed: focusTasks
        .filter(t => t.status === 'done')
        .sort((a, b) => (a.completedAt ?? 0) - (b.completedAt ?? 0)),
    }
  }

  /** Creates the day's focus, or renames the open one. Never creates a second open focus. */
  setFocus(day: DayKey, title: string): Task | null {
    const cleaned = cleanTitle(title)
    if (!cleaned) return null
    const { active } = this.getFocus(day)
    if (active) {
      const renamed = this.updateTask(active.id, { title: cleaned })
      return renamed.ok ? renamed.task : null
    }
    if (this.guard()) return null
    const now = this.now()
    const task: Task = {
      id:        createId('task'),
      day,
      title:     cleaned,
      status:    'open',
      priority:  false,
      isFocus:   true,
      archived:  false,
      createdAt: now,
      updatedAt: now,
    }
    this.tasks.set(task.id, task)
    this.notify()
    return task
  }

  // -- Time blocks ----------------------------------------------------------

  listTimeBlocks(day: DayKey): TimeBlock[] {
    return [...this.blocks.values()]
      .filter(b => b.day === day)
      .sort((a, b) => a.start - b.start)
  }

  getTimeBlock(id: string): TimeBlock | null {
    return this.blocks.get(id) ?? null
  }

  validateTimeBlock(day: DayKey, slot: Slot): PlacementError | null {
    return validatePlacement(day, slot, this.fixedFor(day))
  }

  createTimeBlock(day: DayKey, input: NewTimeBlock): BlockResult {
    const slot = { start: Math.round(input.start), duration: Math.round(input.duration) }
    const error = this.validateTimeBlock(day, slot)
    if (error) return { ok: false, error }
    const refused = this.guard()
    if (refused) return { ok: false, error: { type: 'storage', message: refused } }
    const now = this.now()
    const block: TimeBlock = {
      id:        createId('block'),
      day,
      title:     cleanTitle(input.title ?? '') ?? DEFAULT_BLOCK_TITLE,
      ...slot,
      taskId:    input.taskId,
      timeZone:  this.zone(),
      createdAt: now,
      updatedAt: now,
    }
    this.blocks.set(block.id, block)
    this.notify()
    return { ok: true, block }
  }

  updateTimeBlock(id: string, patch: TimeBlockPatch): BlockResult {
    const block = this.blocks.get(id)
    if (!block) return { ok: false, error: { type: 'not-found' } }
    const slot = {
      start:    Math.round(patch.start    ?? block.start),
      duration: Math.round(patch.duration ?? block.duration),
    }
    const title = patch.title === undefined ? block.title : cleanTitle(patch.title) ?? DEFAULT_BLOCK_TITLE
    if (slot.start === block.start && slot.duration === block.duration && title === block.title) {
      return { ok: true, block }
    }
    const error = this.validateTimeBlock(block.day, slot)
    if (error) return { ok: false, error }
    const refused = this.guard()
    if (refused) return { ok: false, error: { type: 'storage', message: refused } }
    const updated: TimeBlock = { ...block, ...slot, title, updatedAt: this.now() }
    this.blocks.set(id, updated)
    this.notify()
    return { ok: true, block: updated }
  }

  deleteTimeBlock(id: string): BlockResult {
    const block = this.blocks.get(id)
    if (!block) return { ok: false, error: { type: 'not-found' } }
    const refused = this.guard()
    if (refused) return { ok: false, error: { type: 'storage', message: refused } }
    this.blocks.delete(id)
    this.notify()
    return { ok: true, block }
  }

  // -- Energy activities ----------------------------------------------------

  listEnergyActivities(level: EnergyLevel): EnergyActivity[] {
    return [...this.activities.values()].filter(a => a.level === level)
  }

  addEnergyActivity(level: EnergyLevel, title: string): EnergyActivity | null {
    const cleaned = cleanTitle(title)
    if (!cleaned) return null
    const activity: EnergyActivity = { id: createId('activity'), level, title: cleaned }
    this.activities.set(activity.id, activity)
    this.notify()
    return activity
  }

  deleteEnergyActivity(id: string): boolean {
    const removed = this.activities.delete(id)
    if (removed) this.notify()
    return removed
  }

  // -- Check-in -------------------------------------------------------------

  getCheckIn(day: DayKey): CheckIn | null {
    return this.checkIns.get(day) ?? null
  }

  setCheckIn(day: DayKey, patch: { energy?: number; mood?: number }, now = Date.now()): CheckIn {
    const current = this.checkIns.get(day)
    const next: CheckIn = {
      day,
      energy:    'energy' in patch ? clampScale(patch.energy) : current?.energy,
      mood:      'mood'   in patch ? clampScale(patch.mood)   : current?.mood,
      updatedAt: now,
    }
    this.checkIns.set(day, next)
    this.notify()
    return next
  }

  clearCheckIn(day: DayKey): void {
    if (this.checkIns.delete(day)) this.notify()
  }
}

let instance: DailyRepository | null = null
let simulatedFailure: string | null = null

/** Development only: make the next task and time-block writes fail (null to stop) */
export function simulateWriteFailure(message: string | null): void {
  if (process.env.NODE_ENV === 'production') return
  simulatedFailure = message
}

/** Session-wide instance shared by every section that needs daily data */
export function getDailyRepository(): DailyRepository {
  // Fixed appointments come from the same source Calendario reads
  instance ??= new InMemoryDailyRepository({
    fixedIntervals: day => fixedIntervals(getItemsForDate(day)),
    writeGuard:     () => simulatedFailure,
  })
  return instance
}
