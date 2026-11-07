// components/today/TaskList.tsx
'use client'

import { useId, useRef, useState } from 'react'
import { getDailyRepository } from '@/lib/today/daily-repository'
import { describeTaskError } from '@/lib/today/task-form'
import type { Task } from '@/lib/today/types'
import { toDayKey, type DayKey } from '@/lib/day'
import { clockNow } from '@/lib/today/clock'
import { useAnnounce, useRepository } from './shared'
import { NewBlockDialog } from './TimeBlockDialogs'
import { NewTaskDialog, TaskActionsDialog } from './TaskDialogs'
import { MoreIcon, PlusIcon, StarIcon } from './icons'

type Dialog =
  | { kind: 'new' }
  | { kind: 'actions'; taskId: string }
  | { kind: 'plan'; task: Task }

export function TaskList({ day }: { day: DayKey }) {
  const repo  = useRepository(getDailyRepository())
  const tasks = repo.listTasks(day)
  // The open focus lives in the focus card; completed focus joins "Fatto"
  const open  = tasks.filter(t => t.status === 'open' && !t.isFocus)
  const done  = tasks.filter(t => t.status === 'done')

  const [dialog, setDialog] = useState<Dialog | null>(null)
  const sectionRef = useRef<HTMLElement>(null)
  // Row order when a task dialog opened: lets focus land on a neighbour
  // if the task no longer exists when the dialog closes
  const orderAtOpen = useRef<string[]>([])

  function openActions(taskId: string) {
    orderAtOpen.current = [...open, ...done].map(t => t.id)
    setDialog({ kind: 'actions', taskId })
  }

  function focusAfterClose(taskId: string | null) {
    setDialog(null)
    // After React has removed the dialog and the row list is current
    setTimeout(() => {
      const section = sectionRef.current
      if (!section) return
      const moreFor = (id: string) => section.querySelector<HTMLElement>(`[data-task-more="${id}"]`)
      let target = taskId ? moreFor(taskId) : null
      if (taskId && !target) {
        const order = orderAtOpen.current
        const index = order.indexOf(taskId)
        const survivors = [...order.slice(index + 1), ...order.slice(0, index).reverse()]
        target = survivors.map(moreFor).find(Boolean) ?? null
      }
      ;(target ?? section.querySelector<HTMLElement>('[data-add-task]'))?.focus()
    }, 0)
  }

  return (
    <section ref={sectionRef} className="today-card today-tasks" aria-labelledby="today-tasks-title">
      <h2 id="today-tasks-title" className="today-card-title">Da fare e fatto</h2>

      <h3 className="today-group-label" id="today-todo-label">Da fare</h3>
      {open.length === 0
        ? <p className="today-empty">Niente in lista per ora.</p>
        : (
          <ul className="today-task-list" aria-labelledby="today-todo-label">
            {open.map(task => <TaskRow key={task.id} task={task} onActions={() => openActions(task.id)} />)}
          </ul>
        )}

      <button type="button" className="today-add-btn" data-add-task onClick={() => setDialog({ kind: 'new' })}>
        <PlusIcon size={16} /> Aggiungi attività
      </button>

      <h3 className="today-group-label" id="today-done-label">Fatto</h3>
      {done.length === 0
        ? <p className="today-empty">Quello che completi resta qui, visibile.</p>
        : (
          <ul className="today-task-list" aria-labelledby="today-done-label">
            {done.map(task => <TaskRow key={task.id} task={task} onActions={() => openActions(task.id)} />)}
          </ul>
        )}

      {dialog?.kind === 'new' && (
        <NewTaskDialog day={day} onClose={() => focusAfterClose(null)} />
      )}
      {dialog?.kind === 'actions' && (
        <TaskActionsDialog
          taskId={dialog.taskId}
          onPlan={task => setDialog({ kind: 'plan', task })}
          onClose={() => focusAfterClose(dialog.taskId)}
        />
      )}
      {dialog?.kind === 'plan' && (() => {
        const now = clockNow()
        return (
          <NewBlockDialog day={dialog.task.day} isToday={dialog.task.day === toDayKey(now)} now={now}
                          task={{ id: dialog.task.id, title: dialog.task.title }}
                          onClose={() => focusAfterClose(dialog.task.id)} />
        )
      })()}
    </section>
  )
}

function TaskRow({ task, onActions }: { task: Task; onActions: () => void }) {
  const repo     = getDailyRepository()
  const announce = useAnnounce()
  const checkId  = useId()
  const isDone   = task.status === 'done'

  function toggleDone() {
    const result = repo.setTaskDone(task.id, !isDone)
    if (!result.ok) {
      announce(describeTaskError(result.error))
      return
    }
    announce(isDone ? `Di nuovo in Da fare: ${task.title}` : `Fatto: ${task.title}. La trovi in Fatto.`)
  }

  return (
    <li className="today-task" data-done={isDone || undefined}>
      <input
        id={checkId}
        type="checkbox"
        className="today-checkbox"
        checked={isDone}
        onChange={toggleDone}
      />
      <label htmlFor={checkId} className="today-task-label">
        <span className="today-task-title">{task.title}</span>
        {task.deadline && <span className="today-task-meta">entro le {task.deadline}</span>}
      </label>
      <span className="today-task-badges">
        {task.isFocus  && <span className="today-badge today-badge--focus"><StarIcon size={11} /> Focus</span>}
        {task.priority && <span className="today-badge today-badge--priority">Priorità</span>}
      </span>
      <button
        type="button"
        className="today-icon-btn today-icon-btn--small today-task-more"
        data-task-more={task.id}
        aria-haspopup="dialog"
        aria-label={`Azioni per ${task.title}`}
        onClick={onActions}
      >
        <MoreIcon />
      </button>
    </li>
  )
}
