import { describe, expect, it } from 'vitest'
import { decideDayChange } from './day-change'
import { toDayKey } from '../day'
import { InMemoryJournalRepository } from '../journal/journal-repository'

describe('midnight transition', () => {
  it('does nothing when the day has not changed', () => {
    expect(decideDayChange({
      displayedDay: '2026-10-25', lastSeenToday: '2026-10-25', today: '2026-10-25', isEditing: true,
    })).toEqual({ type: 'none' })
  })

  it('follows the new day when the user is not editing', () => {
    expect(decideDayChange({
      displayedDay: '2026-10-25', lastSeenToday: '2026-10-25', today: '2026-10-26', isEditing: false,
    })).toEqual({ type: 'follow', to: '2026-10-26' })
  })

  it('keeps the original day and notifies while editing', () => {
    expect(decideDayChange({
      displayedDay: '2026-10-25', lastSeenToday: '2026-10-25', today: '2026-10-26', isEditing: true,
    })).toEqual({ type: 'notify', from: '2026-10-25', to: '2026-10-26' })
  })

  it('does not notify again after the transition was acknowledged', () => {
    // After the notice, lastSeenToday advances to the new day
    expect(decideDayChange({
      displayedDay: '2026-10-25', lastSeenToday: '2026-10-26', today: '2026-10-26', isEditing: true,
    })).toEqual({ type: 'none' })
  })

  it('keeps a draft on the day it was started across midnight', () => {
    const journal = new InMemoryJournalRepository()
    const startedOn = toDayKey(new Date(2026, 9, 25, 23, 58))
    journal.writeEntry(startedOn, 'Oggi ho finalmente')
    // Clock passes midnight; the editor keeps writing to its original day
    const afterMidnight = toDayKey(new Date(2026, 9, 26, 0, 1))
    journal.writeEntry(startedOn, 'Oggi ho finalmente sistemato le carte')
    expect(afterMidnight).toBe('2026-10-26')
    expect(journal.getEntry('2026-10-25')!.body).toBe('Oggi ho finalmente sistemato le carte')
    expect(journal.getEntry('2026-10-26')).toBeNull()
  })
})

describe('local day keys', () => {
  it('uses local date components near midnight', () => {
    expect(toDayKey(new Date(2026, 9, 25, 23, 59, 59))).toBe('2026-10-25')
    expect(toDayKey(new Date(2026, 9, 26, 0, 0, 0))).toBe('2026-10-26')
  })
})
