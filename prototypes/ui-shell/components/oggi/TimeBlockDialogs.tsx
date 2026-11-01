// components/oggi/TimeBlockDialogs.tsx
// Keyboard-complete alternatives to the pointer gestures on time blocks.
// Every write goes through the repository, which applies the same
// validation as dragging; the dialog closes only on a confirmed write.
'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { getDailyRepository, type BlockError, type BlockResult } from '@/lib/oggi/daily-repository'
import {
  DEFAULT_BLOCK_MINUTES, DEFAULT_BLOCK_TITLE, describePlacementError, durationLabel, fixedIntervals,
  nextFreeStart, slotLabel, snapUp, type Slot,
} from '@/lib/oggi/time-blocks'
import { getTimerStore } from '@/lib/oggi/timer-store'
import { getItemsForDate } from '@/lib/calendar-mock'
import { formatDayHeading, formatTime, minutesOfDay, parseTime, type DayKey } from '@/lib/day'
import type { TimeBlock } from '@/lib/oggi/types'
import { openPanel, useAnnounce, useModal, useRepository } from './shared'
import { ClockIcon, CloseIcon, HourglassIcon, PencilIcon, TrashIcon } from './icons'

const DURATION_OPTIONS = [15, 30, 45, 60, 75, 90, 120, 150, 180, 240]

export function describeBlockError(error: BlockError): string {
  if (error.type === 'not-found') return 'Questo blocco non esiste più.'
  if (error.type === 'storage')   return `Non è stato possibile salvare: ${error.message} Il blocco è rimasto com'era.`
  return describePlacementError(error)
}

/** Suggested start for a new block: next free quarter hour today, 09:00 otherwise */
export function suggestedStart(day: DayKey, isToday: boolean, now: Date, duration = DEFAULT_BLOCK_MINUTES): number {
  const fixed = fixedIntervals(getItemsForDate(day))
  const after = isToday ? snapUp(minutesOfDay(now)) : 9 * 60
  return nextFreeStart(day, after, duration, fixed) ?? after
}

// --- Schedule editor ---------------------------------------------------------

interface ScheduleFormProps {
  day:          DayKey
  initial:      Slot & { title?: string }
  showTitle:    boolean
  submitLabel:  string
  hint?:        string
  onSubmit:     (slot: Slot, title: string) => BlockResult
  onDone:       (result: Extract<BlockResult, { ok: true }>) => void
  onCancel:     () => void
}

function ScheduleForm({ day, initial, showTitle, submitLabel, hint, onSubmit, onDone, onCancel }: ScheduleFormProps) {
  const repo    = getDailyRepository()
  const errorId = useId()
  const [title,    setTitle]    = useState(initial.title ?? '')
  const [start,    setStart]    = useState(formatTime(initial.start))
  const [duration, setDuration] = useState(initial.duration)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const startMinutes = parseTime(start)
  const liveError = startMinutes === null
    ? "Scrivi un orario valido, per esempio 10:30."
    : (() => { const e = repo.validateTimeBlock(day, { start: startMinutes, duration }); return e ? describePlacementError(e) : null })()
  const message = submitError ?? liveError
  const options = DURATION_OPTIONS.includes(duration) ? DURATION_OPTIONS : [...DURATION_OPTIONS, duration].sort((a, b) => a - b)

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (startMinutes === null || liveError) return
    const result = onSubmit({ start: startMinutes, duration }, title)
    if (result.ok) onDone(result)
    else setSubmitError(describeBlockError(result.error))
  }

  return (
    <form onSubmit={submit} className="oggi-dialog-body" noValidate>
      {hint && <p className="oggi-muted">{hint}</p>}
      {showTitle && (
        <label className="oggi-field">
          Titolo
          <input className="oggi-input" value={title} data-draft
                 onChange={e => { setTitle(e.target.value); setSubmitError(null) }}
                 placeholder={DEFAULT_BLOCK_TITLE} />
        </label>
      )}
      <div className="oggi-add-form-row">
        <label className="oggi-field">
          Inizio
          <input type="time" className="oggi-input oggi-input--time" value={start} step={900} required
                 aria-invalid={!!message} aria-describedby={errorId} autoFocus={!showTitle}
                 onChange={e => { setStart(e.target.value); setSubmitError(null) }} />
        </label>
        <label className="oggi-field">
          Durata
          <select className="oggi-input" value={duration} aria-describedby={errorId}
                  onChange={e => { setDuration(Number(e.target.value)); setSubmitError(null) }}>
            {options.map(d => <option key={d} value={d}>{d} min</option>)}
          </select>
        </label>
      </div>
      <p id={errorId} className="oggi-block-feedback" role="status">
        {message ?? (startMinutes !== null ? `Dalle ${slotLabel({ start: startMinutes, duration }).replace(' - ', ' alle ')}` : '')}
      </p>
      <div className="oggi-form-actions">
        <button type="button" className="oggi-btn oggi-btn--quiet" onClick={onCancel}>Annulla</button>
        <button type="submit" className="oggi-btn" disabled={!!liveError}>{submitLabel}</button>
      </div>
    </form>
  )
}

function DialogHeader({ titleId, label, title, onClose }: { titleId: string; label?: string; title: string; onClose: () => void }) {
  return (
    <div className="oggi-dialog-header">
      <div>
        {label && <p className="oggi-group-label">{label}</p>}
        <h2 id={titleId} className="oggi-card-title">{title}</h2>
      </div>
      <button type="button" className="oggi-icon-btn" onClick={onClose} aria-label="Chiudi">
        <CloseIcon />
      </button>
    </div>
  )
}

// --- New block (button or task) -------------------------------------------

interface NewBlockDialogProps {
  day:      DayKey
  isToday:  boolean
  now:      Date
  /** When planning for a task: link and prefill the title */
  task?:    { id: string; title: string }
  onClose:  () => void
}

export function NewBlockDialog({ day, isToday, now, task, onClose }: NewBlockDialogProps) {
  const ref      = useModal(onClose)
  const announce = useAnnounce()
  const titleId  = useId()
  const close    = () => ref.current?.close()

  return (
    <dialog ref={ref} className="oggi-dialog" aria-labelledby={titleId}>
      <DialogHeader titleId={titleId} label={task ? 'Pianifica un blocco' : undefined}
                    title={task ? task.title : 'Nuovo blocco flessibile'} onClose={close} />
      <ScheduleForm
        day={day}
        initial={{ start: suggestedStart(day, isToday, now), duration: DEFAULT_BLOCK_MINUTES, title: task?.title ?? '' }}
        showTitle
        submitLabel="Crea blocco"
        hint={task
          ? "Il blocco resta collegato all'attività: l'attività non cambia e non diventa un appuntamento."
          : 'Puoi anche tenere premuto su un orario libero della giornata.'}
        onSubmit={(slot, title) => getDailyRepository().createTimeBlock(day, { ...slot, title, taskId: task?.id })}
        onDone={({ block }) => { announce(`Blocco creato: ${block.title}, ${slotLabel(block)}`); close() }}
        onCancel={close}
      />
    </dialog>
  )
}

// --- Actions for an existing block (boards: block actions, delete confirmation) --

type View = 'menu' | 'time' | 'later' | 'title' | 'confirm-delete'

/** Action to focus when Escape or Annulla steps back from a view */
const RETURN_FOCUS: Record<Exclude<View, 'menu'>, string> = {
  'time':           'time',
  'later':          'later',
  'title':          'title',
  'confirm-delete': 'delete',
}

interface BlockActionsDialogProps {
  blockId:  string
  isPast:   boolean
  isToday:  boolean
  now:      Date
  initialView?: View
  onClose:  () => void
}

/**
 * One modal with internal views: actions, schedule editor, title editor and
 * the delete confirmation. Deletion happens only from the confirmation, runs
 * once, and closes the dialog only after the repository confirms it.
 */
export function BlockActionsDialog({ blockId, isPast, isToday, now, initialView = 'menu', onClose }: BlockActionsDialogProps) {
  const repo     = useRepository(getDailyRepository())
  const timer    = useRepository(getTimerStore())
  const announce = useAnnounce()
  const ref      = useModal(onClose)
  const titleId  = useId()
  const descId   = useId()
  const [view,  setView]  = useState<View>(initialView)
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
  const lastBlock = useRef<TimeBlock | null>(null)
  const current   = repo.getTimeBlock(blockId)
  if (current) lastBlock.current = current
  const block = current ?? lastBlock.current
  if (!block) return null
  const task = block.taskId ? repo.getTask(block.taskId) : null
  const confirming = view === 'confirm-delete'

  function go(next: View, focus: string | null) {
    setError(null)
    returnTo.current = focus
    setView(next)
  }

  function back() {
    if (view !== 'menu') go('menu', RETURN_FOCUS[view])
  }

  function done(message: string) {
    announce(message)
    back()
  }

  function startTimer() {
    // The timer keeps its own lifecycle: the block is not moved, its task is
    // not completed, and deleting the block later does not stop the timer
    timer.startFor(block!.duration, block!.title)
    openPanel('timer')
    announce(`Timer avviato: ${block!.duration} minuti per ${block!.title}`)
    close()
  }

  function confirmDelete() {
    if (busy.current) return
    busy.current = true
    const result = repo.deleteTimeBlock(block!.id)
    if (!result.ok) {
      busy.current = false
      const message = result.error.type === 'not-found'
        ? 'Questo blocco non esiste più nella tua giornata.'
        : 'Non è stato possibile eliminare il blocco: è ancora nella tua giornata. Puoi riprovare.'
      setError(message)
      announce(message)
      return
    }
    // After a success the dialog is closing: further clicks are ignored
    announce(`Blocco eliminato: ${result.block.title}, ${slotLabel(result.block)}`)
    close()
  }

  const running = timer.state.status === 'running'

  return (
    <dialog ref={ref} className="oggi-dialog oggi-dialog--task oggi-dialog--block" data-view={view}
            aria-labelledby={confirming ? `${titleId}-q` : titleId}
            aria-describedby={confirming ? `${titleId}-detail` : descId}
            onKeyDown={e => {
              // Escape steps back from an editor or the confirmation first
              if (e.key !== 'Escape' || view === 'menu') return
              e.preventDefault()
              back()
            }}>
      {!confirming && (
        <div className="oggi-dialog-header">
          <div className="oggi-dialog-heading">
            <p className="oggi-block-kind">Blocco flessibile</p>
            <h2 id={titleId} className="oggi-dialog-title">{block.title}</h2>
            <p id={descId} className="oggi-block-when">
              {isToday
                ? <span className="sr-only">{formatDayHeading(block.day)}, </span>
                : <>{formatDayHeading(block.day)} · </>}
              {slotLabel(block)} · {durationLabel(block)}
              {isPast && <span className="oggi-muted"> · orario passato</span>}
            </p>
          </div>
          <button type="button" className="oggi-icon-btn oggi-dialog-close" onClick={close} aria-label="Chiudi">
            <CloseIcon />
          </button>
        </div>
      )}

      <div ref={bodyRef}>
        {view === 'menu' && (
          <>
            <p className="oggi-block-explain">
              È tuo e flessibile: non è un appuntamento e non viene inviato a nessun calendario esterno.
            </p>
            {task && (
              <p className="oggi-block-explain">
                Collegato all&apos;attività &quot;{task.title}&quot;{task.status === 'done' ? ', già segnata come fatta' : ''}.
              </p>
            )}
            <div className="oggi-action-list" role="group" aria-label="Azioni del blocco">
              {isPast && isToday && (
                <button type="button" className="oggi-action-item" data-focus="later" onClick={() => go('later', null)}>
                  <span className="oggi-action-icon"><ClockIcon /></span>
                  Sposta più tardi
                </button>
              )}
              <button type="button" className="oggi-action-item" data-focus="time" onClick={() => go('time', null)}>
                <span className="oggi-action-icon"><ClockIcon /></span>
                Cambia orario
              </button>
              <button type="button" className="oggi-action-item" data-focus="title" onClick={() => go('title', null)}>
                <span className="oggi-action-icon"><PencilIcon /></span>
                Modifica titolo
              </button>
              <button type="button" className="oggi-action-item" onClick={startTimer}>
                <span className="oggi-action-icon"><HourglassIcon /></span>
                <span className="oggi-action-text">
                  Avvia timer da {block.duration} min
                  {running && <span className="oggi-action-note">Sostituisce il timer in corso</span>}
                </span>
              </button>
              <button type="button" className="oggi-action-item oggi-action-item--danger" data-focus="delete"
                      onClick={() => go('confirm-delete', 'cancel-delete')}>
                <span className="oggi-action-icon"><TrashIcon /></span>
                Elimina blocco
              </button>
            </div>
          </>
        )}

        {(view === 'time' || view === 'later') && (
          <ScheduleForm
            day={block.day}
            initial={view === 'later'
              ? { start: suggestedStart(block.day, isToday, now, block.duration), duration: block.duration }
              : block}
            showTitle={false}
            submitLabel="Conferma orario"
            hint={view === 'later' ? 'Ti propongo il primo orario libero da adesso: puoi cambiarlo.' : undefined}
            onSubmit={slot => repo.updateTimeBlock(block.id, slot)}
            onDone={({ block: b }) => done(`${b.title}: ora ${slotLabel(b)}`)}
            onCancel={back}
          />
        )}

        {view === 'title' && <TitleForm block={block} onDone={done} onCancel={back} />}

        {confirming && (
          <div className="oggi-block-delete" role="group" aria-labelledby={`${titleId}-q`} aria-describedby={`${titleId}-detail`}>
            <span className="oggi-block-delete-icon" aria-hidden="true"><TrashIcon size={22} /></span>
            <h2 id={`${titleId}-q`} className="oggi-dialog-title">Eliminare questo blocco?</h2>
            <p className="oggi-block-delete-summary">{block.title} · {slotLabel(block)}</p>
            <p id={`${titleId}-detail`} className="oggi-block-delete-detail">
              Il blocco viene tolto dalla tua giornata. Appuntamenti e attività restano come sono.
            </p>
            {error && <p className="oggi-block-delete-error" role="alert">{error}</p>}
            <div className="oggi-block-delete-actions">
              {/* Safe default: focus lands on Annulla */}
              <button type="button" className="oggi-btn" data-focus="cancel-delete" onClick={back}>
                Annulla
              </button>
              <button type="button" className="oggi-btn oggi-btn--danger" onClick={confirmDelete}>
                {error ? 'Riprova' : 'Elimina'}
              </button>
            </div>
          </div>
        )}
      </div>
    </dialog>
  )
}

function TitleForm({ block, onDone, onCancel }: { block: TimeBlock; onDone: (m: string) => void; onCancel: () => void }) {
  const [title, setTitle] = useState(block.title)
  const [error, setError] = useState<string | null>(null)

  function submit(e: React.FormEvent) {
    e.preventDefault()
    // Renames this block only; a linked task keeps its own title
    const result = getDailyRepository().updateTimeBlock(block.id, { title })
    if (result.ok) onDone(`Titolo aggiornato: ${result.block.title}`)
    else setError(describeBlockError(result.error))
  }

  return (
    <form onSubmit={submit} className="oggi-dialog-body">
      <label className="oggi-field">
        Titolo
        <input className="oggi-input" value={title} autoFocus data-draft
               onChange={e => { setTitle(e.target.value); setError(null) }} placeholder={DEFAULT_BLOCK_TITLE} />
      </label>
      <p className="oggi-block-feedback" role="status">{error ?? ''}</p>
      <div className="oggi-form-actions">
        <button type="button" className="oggi-btn oggi-btn--quiet" onClick={onCancel}>Annulla</button>
        <button type="submit" className="oggi-btn">Salva titolo</button>
      </div>
    </form>
  )
}
