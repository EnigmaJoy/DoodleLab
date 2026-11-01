// components/oggi/TaskList.tsx
'use client'

import { useId, useRef, useState } from 'react'
import { getDailyRepository } from '@/lib/oggi/daily-repository'
import { describeTaskError } from '@/lib/oggi/task-form'
import type { Task } from '@/lib/oggi/types'
import { toDayKey, type DayKey } from '@/lib/day'
import { clockNow } from '@/lib/oggi/clock'
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
    <section ref={sectionRef} className="oggi-card oggi-tasks" aria-labelledby="oggi-tasks-title">
      <h2 id="oggi-tasks-title" className="oggi-card-title">Da fare e fatto</h2>

      <h3 className="oggi-group-label" id="oggi-todo-label">Da fare</h3>
      {open.length === 0
        ? <p className="oggi-empty">Niente in lista per ora.</p>
        : (
          <ul className="oggi-task-list" aria-labelledby="oggi-todo-label">
            {open.map(task => <TaskRow key={task.id} task={task} onActions={() => openActions(task.id)} />)}
          </ul>
        )}

      <button type="button" className="oggi-add-btn" data-add-task onClick={() => setDialog({ kind: 'new' })}>
        <PlusIcon size={16} /> Aggiungi attività
      </button>

      <h3 className="oggi-group-label" id="oggi-done-label">Fatto</h3>
      {done.length === 0
        ? <p className="oggi-empty">Quello che completi resta qui, visibile.</p>
        : (
          <ul className="oggi-task-list" aria-labelledby="oggi-done-label">
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
    <li className="oggi-task" data-done={isDone || undefined}>
      <input
        id={checkId}
        type="checkbox"
        className="oggi-checkbox"
        checked={isDone}
        onChange={toggleDone}
      />
      <label htmlFor={checkId} className="oggi-task-label">
        <span className="oggi-task-title">{task.title}</span>
        {task.deadline && <span className="oggi-task-meta">entro le {task.deadline}</span>}
      </label>
      <span className="oggi-task-badges">
        {task.isFocus  && <span className="oggi-badge oggi-badge--focus"><StarIcon size={11} /> Focus</span>}
        {task.priority && <span className="oggi-badge oggi-badge--priority">Priorità</span>}
      </span>
      <button
        type="button"
        className="oggi-icon-btn oggi-icon-btn--small oggi-task-more"
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
