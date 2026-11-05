// components/today/TaskDialogs.tsx
'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { getDailyRepository, type TaskResult } from '@/lib/oggi/daily-repository'
import {
  EMPTY_DRAFT, describeTaskError, draftFromTask, draftToInput, validateDraft, type TaskDraft,
} from '@/lib/oggi/task-form'
import type { Task } from '@/lib/oggi/types'
import type { DayKey } from '@/lib/day'
import { useAnnounce, useModal, useRepository } from './shared'
import {
  ArchiveIcon, ClockIcon, CloseIcon, PencilIcon, StarIcon, StarOutlineIcon, TrashIcon,
} from './icons'
import { IconButton } from '@/design-system/IconButton'
import modalStyles from '@/design-system/Modal.module.css'

// --- Shared form (create and edit) ------------------------------------------

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
    if (result.ok) { onDone(result.task); return }
    busy.current = false
    setError(describeTaskError(result.error))
  }

  return (
    <form onSubmit={submit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <label htmlFor={fieldId} className="sr-only">Che cosa vuoi fare</label>
      <input
        id={fieldId}
        className={modalStyles.field}
        value={draft.title}
        autoFocus data-autofocus data-draft
        placeholder="Cosa vuoi fare?"
        autoComplete="off"
        required
        aria-invalid={error !== null && draft.title.trim() === ''}
        aria-describedby={errorId}
        onChange={e => change({ title: e.target.value })}
      />
      <div className={modalStyles.formRow}>
        <label htmlFor={deadlineId} className={modalStyles.fieldLabel}>Entro le</label>
        <input
          id={deadlineId}
          type="time"
          className={`${modalStyles.field} ${modalStyles.timeField}`}
          value={draft.deadline}
          aria-describedby={hintId}
          data-draft={draft.deadline !== initial.deadline || undefined}
          onChange={e => change({ deadline: e.target.value })}
        />
        <div className={modalStyles.switchRow}>
          <span className={modalStyles.switchLabel}>Priorità</span>
          <button
            type="button"
            role="switch"
            aria-checked={draft.priority}
            className={modalStyles.switchBtn}
            onClick={() => change({ priority: !draft.priority })}
          >
            <span className={modalStyles.switchThumb} />
          </button>
        </div>
        <span id={hintId} className="sr-only">
          Facoltativo. È una scadenza per l&apos;attività, non un appuntamento né un blocco in agenda.
        </span>
      </div>
      <p className={modalStyles.hint}>Orario e priorità sono facoltativi.</p>
      <p id={errorId} className={modalStyles.feedback} role="status">{error ?? ''}</p>
      <div className={modalStyles.footer}>
        <button type="button" className={modalStyles.cancelBtn} onClick={onCancel}>Annulla</button>
        <button type="submit" className={modalStyles.primaryBtn}>{submitLabel}</button>
      </div>
    </form>
  )
}

// --- Board 1: new task -------------------------------------------------------

export function NewTaskDialog({ day, onClose }: { day: DayKey; onClose: () => void }) {
  const ref      = useModal(onClose)
  const announce = useAnnounce()
  const titleId  = useId()
  const close    = () => ref.current?.close()

  return (
    <dialog
      ref={ref}
      role="dialog"
      aria-modal="true"
      className={`${modalStyles.dialog} ${modalStyles.medium}`}
      aria-labelledby={titleId}
      onClick={e => { if (e.target === e.currentTarget) close() }}
    >
      <div className={modalStyles.card} onClick={e => e.stopPropagation()}>
        <div className={modalStyles.header}>
          <div className={modalStyles.headerText}>
            <h2 id={titleId} className={modalStyles.title}>Nuova attività</h2>
          </div>
          <IconButton label="Chiudi" icon={<CloseIcon />} onClick={close} />
        </div>
        <TaskForm
          initial={EMPTY_DRAFT}
          submitLabel="Aggiungi"
          onSubmit={draft => getDailyRepository().addTask(day, draftToInput(draft))}
          onDone={task => { announce(`Aggiunta a Da fare: ${task.title}`); close() }}
          onCancel={close}
        />
      </div>
    </dialog>
  )
}

// --- Boards 2 and 3: actions, edit, inline delete confirmation ---------------

type View = 'menu' | 'edit' | 'confirm-delete'

interface TaskActionsDialogProps {
  taskId:  string
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
    if (!result.ok) busy.current = false
    run(result, `Eliminata: ${task!.title}`, close)
  }

  function archive() {
    run(repo.archiveTask(task!.id), `Archiviata: ${task!.title}. Non compare più in Oggi.`, close)
  }

  const confirming = view === 'confirm-delete'

  return (
    <dialog
      ref={ref}
      role={confirming ? 'alertdialog' : 'dialog'}
      aria-modal="true"
      className={`${modalStyles.dialog} ${modalStyles.medium}`}
      aria-labelledby={confirming ? `${titleId}-q` : titleId}
      aria-describedby={confirming ? `${titleId}-detail` : descId}
      onClick={e => {
        if (e.target !== e.currentTarget) return
        const hasDraft = ref.current?.querySelector('[data-draft]') !== null
        if (!hasDraft) close()
      }}
      onKeyDown={e => {
        if (e.key !== 'Escape' || view === 'menu') return
        e.preventDefault()
        go('menu', view === 'edit' ? 'edit' : 'delete')
      }}
    >
      <div className={modalStyles.card} onClick={e => e.stopPropagation()}>
        {!confirming && (
          <div className={modalStyles.header}>
            <div className={modalStyles.headerText}>
              <h2 id={titleId} className={modalStyles.title}>
                {view === 'edit' ? 'Modifica attività' : task.title}
              </h2>
              <p id={descId} className={modalStyles.meta}>
                {view !== 'edit' && task.deadline && <span>entro le {task.deadline}</span>}
                {view !== 'edit' && task.priority && <span> · Priorità</span>}
                {view !== 'edit' && isDone && <span> · Fatta</span>}
              </p>
            </div>
            <IconButton label="Chiudi" icon={<CloseIcon />} onClick={close} />
          </div>
        )}

        <div ref={bodyRef}>
          {view === 'menu' && (
            <div className={modalStyles.actionList} role="group" aria-label="Azioni dell'attività">
              {!task.isFocus && (
                <button type="button" className={modalStyles.actionItem}
                        data-focus="priority" onClick={togglePriority}>
                  <span className={modalStyles.actionIcon}>
                    {task.priority ? <StarOutlineIcon /> : <StarIcon />}
                  </span>
                  {task.priority ? 'Togli priorità' : 'Segna come priorità'}
                </button>
              )}
              <button type="button" className={modalStyles.actionItem}
                      data-focus="edit" onClick={() => go('edit', null)}>
                <span className={modalStyles.actionIcon}><PencilIcon /></span>
                Modifica
              </button>
              {!isDone && (
                <button type="button" className={modalStyles.actionItem}
                        onClick={() => onPlan(task)}>
                  <span className={modalStyles.actionIcon}><ClockIcon /></span>
                  Pianifica un blocco
                </button>
              )}
              {isDone && (
                <button type="button" className={modalStyles.actionItem}
                        onClick={archive}>
                  <span className={modalStyles.actionIcon}><ArchiveIcon /></span>
                  Archivia
                </button>
              )}
              <button type="button"
                      className={`${modalStyles.actionItem} ${modalStyles.actionItemDanger}`}
                      data-focus="delete"
                      onClick={() => go('confirm-delete', 'cancel-delete')}>
                <span className={modalStyles.actionIcon}><TrashIcon /></span>
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

          {confirming && (
            <div className={modalStyles.deleteContent}>
              <div className={modalStyles.deleteIconWrap} aria-hidden="true">
                <TrashIcon size={22} />
              </div>
              <h2 id={`${titleId}-q`} className={modalStyles.title}>
                Eliminare &quot;{task.title}&quot;?
              </h2>
              <p id={`${titleId}-detail`} className={modalStyles.body}>
                L&apos;attività verrà tolta da Oggi ed eliminata: non si potrà recuperare.
                {repo.listTimeBlocks(task.day).some(b => b.taskId === task.id) &&
                  ' I blocchi di concentrazione pianificati restano nella giornata.'}
              </p>
              {error && <p className={modalStyles.error} role="alert">{error}</p>}
              <div className={modalStyles.footer}>
                <button type="button" className={modalStyles.cancelBtn}
                        data-focus="cancel-delete" onClick={() => go('menu', 'delete')}>
                  Annulla
                </button>
                <button type="button" className={modalStyles.dangerBtn}
                        onClick={confirmDelete}>
                  Sì, elimina
                </button>
              </div>
            </div>
          )}

          {view !== 'edit' && !confirming && (
            <p className={modalStyles.feedback} role="status">{error ?? ''}</p>
          )}
        </div>
      </div>
    </dialog>
  )
}
