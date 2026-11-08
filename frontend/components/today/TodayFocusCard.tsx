'use client'

import { useState } from 'react'
import { getDailyRepository } from '@/lib/today/daily-repository'
import type { DayKey } from '@/lib/day'
import { describeTaskError } from '@/lib/today/task-form'
import { getTimerStore } from '@/lib/today/timer-store'
import { openPanel, useAnnounce, useRepository } from './shared'

// Play icon inline (PlayIcon not exported from icons.tsx)
function PlayIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
         aria-hidden="true" focusable="false">
      <polygon points="5 3 19 12 5 21 5 3" fill="currentColor" />
    </svg>
  )
}

// Check icon inline (CheckIcon not exported from icons.tsx)
function CheckIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
         aria-hidden="true" focusable="false">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

export function TodayFocusCard({ day }: { day: DayKey }) {
  const repo     = useRepository(getDailyRepository())
  const announce = useAnnounce()
  const { active, completed } = repo.getFocus(day)
  const lastDone = completed.at(-1) ?? null

  const [editing, setEditing] = useState(false)
  const [draft,   setDraft]   = useState('')

  function startEditing() {
    setDraft(active?.title ?? '')
    setEditing(true)
  }

  function save(e: React.FormEvent) {
    e.preventDefault()
    if (!draft.trim()) return
    const saved = repo.setFocus(day, draft)
    if (!saved) return
    setEditing(false)
    announce(`Focus del giorno: ${saved.title}`)
  }

  function toggleDone() {
    if (active) {
      const result = repo.setTaskDone(active.id, true)
      announce(result.ok
        ? `Focus completato: ${active.title}. Ben fatto!`
        : describeTaskError(result.error))
    } else if (lastDone) {
      const result = repo.setTaskDone(lastDone.id, false)
      announce(result.ok ? `Focus riaperto: ${lastDone.title}` : describeTaskError(result.error))
    }
  }

  function startTimer() {
    const title = active?.title ?? lastDone?.title ?? null
    getTimerStore().startFor(25, title)
    openPanel('timer')
    announce('Timer da 25 minuti avviato')
  }

  const isDone     = !active && !!lastDone
  const focusTitle = active?.title ?? lastDone?.title ?? null
  const showEmpty  = !editing && !active && !lastDone

  return (
    <section className="todayb-card todayb-card--postit todayb-focus-card" aria-labelledby="todayb-focus-title">
      <p id="todayb-focus-title" className="todayb-label">Una cosa, oggi</p>

      {(editing || showEmpty) ? (
        <form onSubmit={save} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <textarea
            className="todayb-focus-input"
            data-draft
            rows={2}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); e.currentTarget.form?.requestSubmit() }
              if (e.key === 'Escape' && editing) setEditing(false)
            }}
            placeholder="Una cosa sola, scritta come ti viene"
            autoFocus={editing}
          />
          <div style={{ display: 'flex', gap: 10 }}>
            {editing && (
              <button type="button" className="todayb-btn-ghost" onClick={() => setEditing(false)}>
                Annulla
              </button>
            )}
            {draft.trim() && (
              <button type="submit" className="todayb-btn-dark">
                {active ? 'Salva' : 'Imposta'}
              </button>
            )}
          </div>
        </form>
      ) : (
        <>
          <p
            className={`todayb-focus-text${isDone ? ' todayb-focus-text--done' : ''}`}
          >
            {isDone ? <s>{focusTitle}</s> : focusTitle}
          </p>
          <div className="todayb-focus-buttons">
            <button type="button" className="todayb-btn-dark" onClick={toggleDone}>
              <CheckIcon />
              {isDone ? 'Fatto, ben fatto' : 'Segna come fatto'}
            </button>
            <button type="button" className="todayb-btn-light" onClick={startTimer}>
              <PlayIcon />
              Inizia 25 minuti
            </button>
          </div>
        </>
      )}

      {!editing && focusTitle && (
        <button type="button" className="todayb-focus-edit-link" onClick={startEditing}>
          Modifica
        </button>
      )}
    </section>
  )
}
