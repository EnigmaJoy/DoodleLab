// components/today/FocusCard.tsx
'use client'

import { useState } from 'react'
import { getDailyRepository } from '@/lib/oggi/daily-repository'
import type { DayKey } from '@/lib/day'
import { describeTaskError } from '@/lib/oggi/task-form'
import { useAnnounce, useRepository } from './shared'
import { PencilIcon, StarIcon } from './icons'

export function FocusCard({ day }: { day: DayKey }) {
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
    const saved = repo.setFocus(day, draft)
    if (!saved) return
    setEditing(false)
    announce(`Focus del giorno: ${saved.title}`)
  }

  function complete() {
    if (!active) return
    const result = repo.setTaskDone(active.id, true)
    announce(result.ok
      ? `Focus completato: ${active.title}. Lo trovi anche in Fatto.`
      : describeTaskError(result.error))
  }

  return (
    <section className="today-focus" aria-labelledby="today-focus-title">
      <div className="today-focus-header">
        <h2 id="today-focus-title" className="today-focus-label">
          <StarIcon size={16} /> Il focus del giorno
        </h2>
        {active && !editing && (
          <button type="button" className="today-icon-btn" onClick={startEditing}
                  aria-label="Modifica il focus del giorno">
            <PencilIcon />
          </button>
        )}
      </div>

      {editing || (!active && !lastDone) ? (
        <form className="today-focus-form" onSubmit={save}>
          <label htmlFor="today-focus-input" className="today-focus-prompt">
            {active ? 'Modifica il focus' : 'Qual è la cosa più importante di oggi?'}
          </label>
          <textarea
            id="today-focus-input"
            className="today-focus-input"
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
          <div className="today-focus-actions">
            {editing && (
              <button type="button" className="today-btn today-btn--quiet" onClick={() => setEditing(false)}>
                Annulla
              </button>
            )}
            <button type="submit" className="today-btn" disabled={draft.trim().length === 0}>
              {active ? 'Salva focus' : 'Imposta focus'}
            </button>
          </div>
        </form>
      ) : active ? (
        <>
          <p className="today-focus-text">{active.title}</p>
          <div className="today-focus-footer">
            <p className="today-focus-help">Una sola cosa importante su cui concentrarti.</p>
            <button type="button" className="today-btn" onClick={complete}>Segna come fatto</button>
          </div>
        </>
      ) : lastDone ? (
        <>
          <p className="today-focus-text today-focus-text--done">
            <s>{lastDone.title}</s>
            <span className="today-focus-done-tag">Fatto</span>
          </p>
          <div className="today-focus-footer">
            <p className="today-focus-help">Fatto. Puoi fermarti qui, o sceglierne un altro.</p>
            <button type="button" className="today-btn" onClick={startEditing}>Scegli un nuovo focus</button>
          </div>
        </>
      ) : null}
    </section>
  )
}
