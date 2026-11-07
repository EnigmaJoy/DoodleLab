// components/today/TaskDialogs.tsx
// "Nuova attività" and the per-task actions dialog (boards: create, actions,
// delete confirmation). Every write goes through the daily repository; a
// dialog closes or changes view only after the repository confirms success.
'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { getDailyRepository, type TaskResult } from '@/lib/today/daily-repository'
import {
  EMPTY_DRAFT, describeTaskError, draftFromTask, draftToInput, validateDraft, type TaskDraft,
} from '@/lib/today/task-form'
import type { Task } from '@/lib/today/types'
import type { DayKey } from '@/lib/day'
import { useAnnounce, useModal, useRepository } from './shared'
import {
  ArchiveIcon, ClockIcon, CloseIcon, PencilIcon, StarIcon, StarOutlineIcon, TrashIcon,
} from './icons'

// --- Shared form (create and edit) --------------------------------------------

interface TaskFormProps {
  initial:     TaskDraft
  submitLabel: string
  onSubmit:    (draft: TaskDraft) => TaskResult
  onDone:      (task: Task) => void
  onCancel:    () => void
}

function TaskForm({ initial, submitLabel, onSubmit, onDone, onCancel }: TaskFormProps) {
  const fieldId    = useId()
  const deadlineId = useId()
  const hintId     = useId()
  const errorId    = useId()
  const [draft, setDraft] = useState(initial)
  const [error, setError] = useState<string | null>(null)
  // Single flight: a second submit (double click, repeated Enter) is ignored
  // until the first one has failed; after a success the dialog is leaving.
  const busy = useRef(false)

  function change(patch: Partial<TaskDraft>) {
    setDraft(d => ({ ...d, ...patch }))
    setError(null)
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (busy.current) return
    const invalid = validateDraft(draft)
    if (invalid) { setError(invalid); return }
    busy.current = true
    const result = onSubmit(draft)
    if (result.ok) {
      onDone(result.task)
      return
    }
    busy.current = false
    // Keep what was typed so the user can retry
    setError(describeTaskError(result.error))
  }

  return (
    <form onSubmit={submit} className="today-dialog-body" noValidate>
      <label htmlFor={fieldId} className="sr-only">Che cosa vuoi fare</label>
      <input id={fieldId} className="today-input today-input--title" value={draft.title} autoFocus data-autofocus data-draft
             placeholder="Cosa vuoi fare?" autoComplete="off" required
             aria-invalid={error !== null && draft.title.trim() === ''} aria-describedby={errorId}
             onChange={e => change({ title: e.target.value })} />
      <div className="today-task-form-row">
        <label htmlFor={deadlineId} className="today-inline-field">entro le</label>
        <input id={deadlineId} type="time" className="today-input today-input--time" value={draft.deadline}
               aria-describedby={hintId} data-draft={draft.deadline !== initial.deadline || undefined}
               onChange={e => change({ deadline: e.target.value })} />
        <label className="today-inline-field today-task-form-check">
          <input type="checkbox" className="today-checkbox today-checkbox--form" checked={draft.priority}
                 onChange={e => change({ priority: e.target.checked })} />
          Priorità
        </label>
        <span className="today-task-form-optional" aria-hidden="true">facoltativi</span>
        <span id={hintId} className="sr-only">
          Facoltativo. È una scadenza per l&apos;attività, non un appuntamento né un blocco in agenda.
        </span>
      </div>
      <p id={errorId} className="today-block-feedback" role="status">{error ?? ''}</p>
      <div className="today-form-actions">
        <button type="button" className="today-btn today-btn--plain" onClick={onCancel}>Annulla</button>
        <button type="submit" className="today-btn today-btn--primary">{submitLabel}</button>
      </div>
    </form>
  )
}

function CloseButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" className="today-icon-btn today-dialog-close" onClick={onClick} aria-label="Chiudi">
      <CloseIcon />
    </button>
  )
}

// --- Board 1: new task ----------------------------------------------------------

export function NewTaskDialog({ day, onClose }: { day: DayKey; onClose: () => void }) {
  const ref      = useModal(onClose)
  const announce = useAnnounce()
  const titleId  = useId()
  const close    = () => ref.current?.close()

  return (
    <dialog ref={ref} className="today-dialog today-dialog--task" aria-labelledby={titleId}>
      <div className="today-dialog-header">
        <h2 id={titleId} className="today-dialog-title">Nuova attività</h2>
        <CloseButton onClick={close} />
      </div>
      <TaskForm
        initial={EMPTY_DRAFT}
        submitLabel="Aggiungi"
        onSubmit={draft => getDailyRepository().addTask(day, draftToInput(draft))}
        onDone={task => { announce(`Aggiunta a Da fare: ${task.title}`); close() }}
        onCancel={close}
      />
    </dialog>
  )
}

// --- Boards 2 and 3: actions, edit, inline delete confirmation ------------------

type View = 'menu' | 'edit' | 'confirm-delete'

interface TaskActionsDialogProps {
  taskId:  string
  /** Replaces this dialog with "Pianifica un blocco" for the task */
  onPlan:  (task: Task) => void
  onClose: () => void
}

export function TaskActionsDialog({ taskId, onPlan, onClose }: TaskActionsDialogProps) {
  const repo     = useRepository(getDailyRepository())
  const announce = useAnnounce()
  const ref      = useModal(onClose)
  const titleId  = useId()
  const descId   = useId()
  const [view,  setView]  = useState<View>('menu')
  const [error, setError] = useState<string | null>(null)
  // Where focus goes when the view changes inside the same dialog
  const returnTo = useRef<string | null>(null)
  const bodyRef  = useRef<HTMLDivElement>(null)
  const busy     = useRef(false)
  const close    = () => ref.current?.close()

  useEffect(() => {
    const target = returnTo.current
    if (!target) return
    returnTo.current = null
    bodyRef.current?.querySelector<HTMLElement>(`[data-focus="${target}"]`)?.focus()
  }, [view])

  // Kept from the last render so the dialog can finish closing after a delete
  const lastTask = useRef<Task | null>(null)
  const current  = repo.getTask(taskId)
  if (current) lastTask.current = current
  const task = current ?? lastTask.current
  if (!task) return null
  const isDone = task.status === 'done'

  function go(next: View, focus: string | null) {
    setError(null)
    returnTo.current = focus
    setView(next)
  }

  function run(result: TaskResult, success: string, after: () => void) {
    if (!result.ok) {
      const message = describeTaskError(result.error)
      setError(message)
      announce(message)
      return
    }
    announce(success)
    after()
  }

  function togglePriority() {
    run(repo.updateTask(task!.id, { priority: !task!.priority }),
        task!.priority ? `Priorità tolta: ${task!.title}` : `Segnata come priorità: ${task!.title}`,
        () => setError(null))
  }

  function confirmDelete() {
    if (busy.current) return
    busy.current = true
    const result = repo.deleteTask(task!.id)
    // After a success the dialog is closing: further clicks are ignored
    if (!result.ok) busy.current = false
    run(result, `Eliminata: ${task!.title}`, close)
  }

  function archive() {
    run(repo.archiveTask(task!.id), `Archiviata: ${task!.title}. Non compare più in Oggi.`, close)
  }

  return (
    <dialog ref={ref} className="today-dialog today-dialog--task" aria-labelledby={titleId} aria-describedby={descId}
            onKeyDown={e => {
              // Escape steps back from edit / confirmation to the actions first
              if (e.key !== 'Escape' || view === 'menu') return
              e.preventDefault()
              go('menu', view === 'edit' ? 'edit' : 'delete')
            }}>
      <div className="today-dialog-header">
        <div className="today-dialog-heading">
          <h2 id={titleId} className="today-dialog-title">{view === 'edit' ? 'Modifica attività' : task.title}</h2>
          <p id={descId} className="today-task-summary">
            {view !== 'edit' && task.deadline && <span>entro le {task.deadline}</span>}
            {view !== 'edit' && task.priority && <span className="today-badge today-badge--priority">Priorità</span>}
            {view !== 'edit' && task.isFocus  && <span className="today-badge today-badge--focus"><StarIcon size={11} /> Focus</span>}
            {view !== 'edit' && isDone && <span className="today-badge today-badge--done">Fatta</span>}
          </p>
        </div>
        <CloseButton onClick={close} />
      </div>

      <div ref={bodyRef}>
        {view === 'menu' && (
          <div className="today-action-list" role="group" aria-label="Azioni dell'attività">
            {!task.isFocus && (
              <button type="button" className="today-action-item" data-focus="priority" onClick={togglePriority}>
                <span className="today-action-icon today-action-icon--priority">
                  {task.priority ? <StarOutlineIcon /> : <StarIcon />}
                </span>
                {task.priority ? 'Togli priorità' : 'Segna come priorità'}
              </button>
            )}
            <button type="button" className="today-action-item" data-focus="edit" onClick={() => go('edit', null)}>
              <span className="today-action-icon"><PencilIcon /></span>
              Modifica
            </button>
            {!isDone && (
              <button type="button" className="today-action-item" onClick={() => onPlan(task)}>
                <span className="today-action-icon"><ClockIcon /></span>
                Pianifica un blocco
              </button>
            )}
            {isDone && (
              <button type="button" className="today-action-item" onClick={archive}>
                <span className="today-action-icon"><ArchiveIcon /></span>
                Archivia
              </button>
            )}
            <button type="button" className="today-action-item today-action-item--danger" data-focus="delete"
                    onClick={() => go('confirm-delete', 'cancel-delete')}>
              <span className="today-action-icon"><TrashIcon /></span>
              Elimina
            </button>
          </div>
        )}

        {view === 'edit' && (
          <TaskForm
            initial={draftFromTask(task)}
            submitLabel="Salva"
            onSubmit={draft => repo.updateTask(task.id, draftToInput(draft))}
            onDone={saved => { announce(`Modifiche salvate: ${saved.title}`); go('menu', 'edit') }}
            onCancel={() => go('menu', 'edit')}
          />
        )}

        {view === 'confirm-delete' && (
          <div className="today-delete-confirm" role="group" aria-labelledby={`${titleId}-q`}>
            <p id={`${titleId}-q`} className="today-delete-question">Eliminare &quot;{task.title}&quot;?</p>
            <p className="today-delete-detail">
              L&apos;attività verrà tolta da Oggi ed eliminata: non si potrà recuperare.
              {repo.listTimeBlocks(task.day).some(b => b.taskId === task.id) &&
                ' I blocchi di concentrazione pianificati restano nella giornata.'}
            </p>
            <div className="today-form-actions">
              {/* Safe default: focus lands on Annulla */}
              <button type="button" className="today-btn today-btn--plain" data-focus="cancel-delete"
                      onClick={() => go('menu', 'delete')}>
                Annulla
              </button>
              <button type="button" className="today-btn today-btn--danger" onClick={confirmDelete}>Sì, elimina</button>
            </div>
          </div>
        )}

        {view !== 'edit' && <p className="today-block-feedback" role="status">{error ?? ''}</p>}
      </div>
    </dialog>
  )
}
