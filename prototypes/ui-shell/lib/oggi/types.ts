// lib/oggi/types.ts
import type { DayKey } from '../day'

export type TaskStatus = 'open' | 'done'

/**
 * A task planned for a day. The daily focus is a Task with isFocus = true,
 * so completing the focus follows the same lifecycle as any other task.
 * Completion, archiving and deletion are distinct operations.
 */
export interface Task {
  id:           string
  day:          DayKey
  title:        string
  status:       TaskStatus
  priority:     boolean
  deadline?:    string        // "HH:MM", local time on `day`
  isFocus:      boolean
  archived:     boolean
  createdAt:    number
  updatedAt:    number
  completedAt?: number
}

export interface NewTask {
  title:     string
  priority?: boolean
  /** "HH:MM" deadline ("entro le"); not a start time, never an appointment */
  deadline?: string
}

export type TaskPatch = Partial<Pick<Task, 'title' | 'priority' | 'deadline'>>

/**
 * Flexible, user-owned time block. Never an external calendar event or a
 * reminder. Times are local wall-clock minutes on `day` in `timeZone`; a
 * block never crosses local midnight.
 */
export interface TimeBlock {
  id:        string
  day:       DayKey
  title:     string
  start:     number   // minutes since local midnight
  duration:  number   // minutes
  /** Optional link to an existing Task; the task stays authoritative */
  taskId?:   string
  /** IANA zone the wall-clock times were scheduled in */
  timeZone:  string
  createdAt: number
  updatedAt: number
}

export type EnergyLevel = 'bassa' | 'media' | 'alta'

/** User-defined activity suitable for an energy level. Not day-scoped. */
export interface EnergyActivity {
  id:    string
  level: EnergyLevel
  title: string
}

/** Optional, sensitive self check-in. Values on a 1-5 scale. */
export interface CheckIn {
  day:       DayKey
  energy?:   number
  mood?:     number
  updatedAt: number
}
