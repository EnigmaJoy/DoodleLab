// components/oggi/CheckIn.tsx
'use client'

import { getDailyRepository } from '@/lib/oggi/daily-repository'
import type { DayKey } from '@/lib/day'
import { useRepository } from './shared'

const STEPS = [1, 2, 3, 4, 5] as const

interface ScaleProps {
  name:   'energy' | 'mood'
  label:  string
  low:    string
  high:   string
  value:  number | undefined
  onPick: (value: number) => void
}

function Scale({ name, label, low, high, value, onPick }: ScaleProps) {
  return (
    <fieldset className="oggi-scale">
      <legend className="oggi-scale-legend">{label}</legend>
      <div className="oggi-scale-row">
        <span className="oggi-scale-end" aria-hidden="true">{low}</span>
        {STEPS.map(step => (
          <label key={step} className={`oggi-dot oggi-dot--${name}-${step}`}
                 data-checked={value === step || undefined}>
            <input type="radio" name={`oggi-checkin-${name}`} value={step}
                   checked={value === step} onChange={() => onPick(step)}
                   aria-label={`${label} ${step} su 5${step === 1 ? `, ${low}` : step === 5 ? `, ${high}` : ''}`} />
            <span className="oggi-dot-mark" aria-hidden="true">{value === step ? '✓' : ''}</span>
          </label>
        ))}
        <span className="oggi-scale-end" aria-hidden="true">{high}</span>
      </div>
    </fieldset>
  )
}

/** Optional ~10-second check-in. Sensitive: kept in memory only. */
export function CheckIn({ day }: { day: DayKey }) {
  const repo    = useRepository(getDailyRepository())
  const checkIn = repo.getCheckIn(day)

  return (
    <div className="oggi-checkin">
      <Scale name="energy" label="Energia" low="bassa" high="alta" value={checkIn?.energy}
             onPick={v => repo.setCheckIn(day, { energy: v })} />
      <Scale name="mood" label="Umore" low="giù" high="su" value={checkIn?.mood}
             onPick={v => repo.setCheckIn(day, { mood: v })} />
      <p className="oggi-muted">Puoi saltarlo quando vuoi: nessun promemoria insistente.</p>
      <p className="oggi-muted">Resta solo in questa sessione e non viene salvato sul dispositivo.</p>
      {checkIn && (
        <button type="button" className="oggi-text-btn" onClick={() => repo.clearCheckIn(day)}>
          Cancella le risposte
        </button>
      )}
    </div>
  )
}
