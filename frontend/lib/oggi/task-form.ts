// lib/oggi/task-form.ts
// Draft model shared by the "Nuova attività" and "Modifica" dialogs, so both
// forms validate and write the same fields in the same way.

import { parseTime } from '../day'
import type { NewTask, Task, TaskPatch } from './types'
import type { TaskError } from './daily-repository'

export interface TaskDraft {
  title:    string
  /** "HH:MM" or empty */
  deadline: string
  priority: boolean
}

export const EMPTY_DRAFT: TaskDraft = { title: '', deadline: '', priority: false }

export function draftFromTask(task: Task): TaskDraft {
  return { title: task.title, deadline: task.deadline ?? '', priority: task.priority }
}

/** Italian message for an invalid draft, or null when it can be submitted */
export function validateDraft(draft: TaskDraft): string | null {
  if (draft.title.trim().length === 0) return 'Scrivi che cosa vuoi fare.'
  if (draft.deadline !== '' && parseTime(draft.deadline) === null) return 'Scrivi un orario valido, per esempio 12:00.'
  return null
}

export function draftToInput(draft: TaskDraft): NewTask & TaskPatch {
  return {
    title:    draft.title,
    deadline: draft.deadline === '' ? undefined : draft.deadline,
    priority: draft.priority,
  }
}

export function describeTaskError(error: TaskError): string {
  switch (error.type) {
    case 'empty-title': return 'Scrivi che cosa vuoi fare.'
    case 'not-found':   return 'Questa attività non esiste più.'
    case 'focus-open':  return 'Il focus di oggi è già impostato: completalo prima di riaprire questo.'
    case 'storage':     return `Non è stato possibile salvare: ${error.message} Non è cambiato nulla, puoi riprovare.`
  }
}
