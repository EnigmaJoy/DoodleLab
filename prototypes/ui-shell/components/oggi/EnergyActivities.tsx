// components/oggi/EnergyActivities.tsx
'use client'

import { useState } from 'react'
import { getDailyRepository } from '@/lib/oggi/daily-repository'
import type { EnergyLevel } from '@/lib/oggi/types'
import type { DayKey } from '@/lib/day'
import { ConfirmAction, useAnnounce, useRepository } from './shared'
import { PlusIcon } from './icons'

const LEVELS: Array<{ id: EnergyLevel; label: string }> = [
  { id: 'bassa', label: 'Bassa' },
  { id: 'media', label: 'Media' },
  { id: 'alta',  label: 'Alta'  },
]

/**
 * Shows the user's OWN activity list for an energy level. There is no
 * recommendation engine: nothing is inferred or assigned automatically.
 */
export function EnergyActivities({ day }: { day: DayKey }) {
  const repo     = useRepository(getDailyRepository())
  const announce = useAnnounce()
  const [level, setLevel] = useState<EnergyLevel | null>(null)
  const [draft, setDraft] = useState('')
  const activities = level ? repo.listEnergyActivities(level) : []
  const levelLabel = LEVELS.find(l => l.id === level)?.label.toLowerCase()

  function addActivity(e: React.FormEvent) {
    e.preventDefault()
    if (!level) return
    if (repo.addEnergyActivity(level, draft)) setDraft('')
  }

  return (
    <div className="oggi-energy">
      <p className="oggi-muted">Come ti senti adesso? Scegli il livello e ritrova le attività che hai preparato.</p>
      <div className="oggi-segmented" role="radiogroup" aria-label="Livello di energia">
        {LEVELS.map(l => (
          <label key={l.id} className="oggi-segment" data-checked={level === l.id || undefined}>
            <input type="radio" name="oggi-energy-level" value={l.id}
                   checked={level === l.id} onChange={() => setLevel(l.id)} />
            {l.label}
          </label>
        ))}
      </div>

      {level && (
        <>
          {activities.length === 0 ? (
            <p className="oggi-empty">
              Nessuna attività per energia {levelLabel}. Aggiungine una che sai fare in questo stato.
            </p>
          ) : (
            <ul className="oggi-activity-list" aria-label={`Attività per energia ${levelLabel}`}>
              {activities.map(a => (
                <li key={a.id} className="oggi-activity">
                  <span>{a.title}</span>
                  <span className="oggi-activity-actions">
                    <ConfirmAction label="Rimuovi" question={`Rimuovere "${a.title}" dalla lista?`}
                                   confirmLabel="Sì, rimuovi" onConfirm={() => repo.deleteEnergyActivity(a.id)} />
                    <button type="button" className="oggi-icon-btn oggi-icon-btn--accent"
                            aria-label={`Aggiungi a Da fare: ${a.title}`}
                            onClick={() => {
                              if (repo.addTask(day, { title: a.title }).ok) announce(`Aggiunta a Da fare: ${a.title}`)
                            }}>
                      <PlusIcon size={16} />
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
          <form className="oggi-inline-form" onSubmit={addActivity}>
            <label htmlFor="oggi-energy-new" className="sr-only">Nuova attività per energia {levelLabel}</label>
            <input id="oggi-energy-new" className="oggi-input" value={draft} data-draft
                   onChange={e => setDraft(e.target.value)} placeholder={`Nuova attività per energia ${levelLabel}`} />
            <button type="submit" className="oggi-btn oggi-btn--quiet" disabled={draft.trim().length === 0}>
              Aggiungi
            </button>
          </form>
        </>
      )}
    </div>
  )
}
