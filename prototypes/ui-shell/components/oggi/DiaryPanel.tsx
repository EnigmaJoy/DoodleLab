// components/oggi/DiaryPanel.tsx
'use client'

import { useState } from 'react'
import { getJournalRepository } from '@/lib/journal/journal-repository'
import { formatDayMonth, type DayKey } from '@/lib/day'

/**
 * "Pensieri del giorno": writes to the journal entry of `day`. The parent
 * keys this component by day, so the draft is bound to the day it was
 * started on and never moves to another date.
 */
export function DiaryPanel({ day }: { day: DayKey }) {
  const journal = getJournalRepository()
  const [text, setText] = useState(() => journal.getEntry(day)?.body ?? '')
  const hasEntry = journal.getEntry(day) !== null

  function onChange(value: string) {
    setText(value)
    journal.writeEntry(day, value)
  }

  return (
    <div className="oggi-diary">
      <label htmlFor="oggi-diary-input" className="sr-only">
        Pensieri del {formatDayMonth(day)}
      </label>
      <textarea
        id="oggi-diary-input"
        className="oggi-diary-input"
        rows={6}
        value={text}
        onChange={e => onChange(e.target.value)}
        placeholder="Scrivi com'è andata, anche solo una riga."
        aria-describedby="oggi-diary-status"
      />
      <p id="oggi-diary-status" className="oggi-muted">
        {hasEntry
          ? `Collegato al Diario del ${formatDayMonth(day)}. Conservato solo in questa sessione, non ancora salvato in modo permanente.`
          : `Quello che scrivi va nel Diario del ${formatDayMonth(day)}.`}
      </p>
    </div>
  )
}
