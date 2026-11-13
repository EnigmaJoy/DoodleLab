'use client'

import { useId, useState } from 'react'
import { getDailyRepository } from '@/lib/today/daily-repository'
import type { Task } from '@/lib/today/types'
import type { DayKey } from '@/lib/day'
import { describeTaskError } from '@/lib/today/task-form'
import { useAnnounce, useRepository } from './shared'
import { NewTaskDialog } from './TaskDialogs'

function plural(n: number) {
  return n === 1 ? `${n} fatta oggi` : `${n} fatte oggi`
}

function TodayTaskRow({ task, onToggle }: { task: Task; onToggle: () => void }) {
  const checkId = useId()
  const isDone  = task.status === 'done'
  return (
    <li className="todayb-task-row" data-done={isDone || undefined}>
      <span className="todayb-checkbox-wrap">
        <input
          id={checkId}
          type="checkbox"
          className="todayb-task-check sr-only"
          checked={isDone}
          onChange={onToggle}
          aria-checked={isDone}
        />
        <label
          htmlFor={checkId}
          className="todayb-task-check-label"
          aria-label={`${isDone ? 'Riapri' : 'Segna come fatta'}: ${task.title}`}
        />
      </span>
      <span className="todayb-task-title">{task.title}</span>
    </li>
  )
}

export function TodayNextTasksCard({ day }: { day: DayKey }) {
  const repo     = useRepository(getDailyRepository())
  const announce = useAnnounce()
  const tasks    = repo.listTasks(day)

  // Derived display order: all open (non-focus) first, then all done.
  // Source array is never mutated; task IDs and metadata are unchanged.
  const open         = tasks.filter(t => t.status === 'open' && !t.isFocus)
  const done         = tasks.filter(t => t.status === 'done')
  const displayTasks = [...open, ...done]

  const [showNew, setShowNew] = useState(false)

  function toggleTask(task: Task) {
    const isDone = task.status === 'done'
    const result = repo.setTaskDone(task.id, !isDone)
    if (!result.ok) announce(describeTaskError(result.error))
    else announce(isDone ? `Di nuovo in Da fare: ${task.title}` : `Fatto: ${task.title}`)
  }

  return (
    <section className="todayb-card todayb-tasks-card" aria-labelledby="todayb-tasks-title" data-today="tasks-card">
      <div className="todayb-card-header-row">
        <p id="todayb-tasks-title" className="todayb-label">Prossime cose</p>
        {done.length > 0 && (
          <span className="todayb-tasks-done-badge" aria-label={`${done.length} attività completate oggi`}>
            {plural(done.length)}
          </span>
        )}
      </div>

      {displayTasks.length === 0 ? (
        <p className="todayb-tasks-empty">Niente in lista per ora.</p>
      ) : (
        <ul className="todayb-task-list" aria-label="Prossime attività">
          {displayTasks.map(task => (
            <TodayTaskRow key={task.id} task={task} onToggle={() => toggleTask(task)} />
          ))}
        </ul>
      )}

      <div className="todayb-tasks-footer">
        <button
          type="button"
          className="todayb-tasks-add"
          onClick={() => setShowNew(true)}
        >
          + Aggiungi
        </button>
      </div>

      {showNew && (
        <NewTaskDialog day={day} onClose={() => setShowNew(false)} />
      )}
    </section>
  )
}
