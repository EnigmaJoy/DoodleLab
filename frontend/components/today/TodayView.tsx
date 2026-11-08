// components/today/TodayView.tsx
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AppHeader } from '@/design-system/AppHeader'
import { clockNow, setClockOffsetMinutes } from '@/lib/today/clock'
import { decideDayChange } from '@/lib/today/day-change'
import { simulateWriteFailure } from '@/lib/today/daily-repository'
import { formatDayHeading, formatDayMonth, toDayKey, type DayKey } from '@/lib/day'
import { AnnounceContext } from './shared'
import { TodayFocusCard } from './TodayFocusCard'
import { TodayNowCard } from './TodayNowCard'
import { TodayNextTasksCard } from './TodayNextTasksCard'
import { TodayDayTimeline } from './TodayDayTimeline'
import { TodayToolsRow } from './TodayToolsRow'
import { CalendarIcon, MoonIcon } from './icons'

const DAY_CHECK_MS      = 30_000
const ANNOUNCE_DELAY_MS = 50

// Text entry counts as "actively writing"; checkboxes and buttons do not
const EDITING_SELECTOR =
  'textarea, [contenteditable="true"], input:not([type=checkbox]):not([type=radio]):not([type=button]):not([type=submit])'

interface DayNotice { from: DayKey; to: DayKey }

export function TodayView() {
  const router = useRouter()

  // Day state is resolved on the client only: the server cannot know the
  // user's local date, and a mismatch would flash the wrong day.
  const [today,        setToday]        = useState<DayKey | null>(null)
  const [displayedDay, setDisplayedDay] = useState<DayKey | null>(null)
  const [now,          setNow]          = useState<Date>(() => clockNow())
  const [notice,       setNotice]       = useState<DayNotice | null>(null)
  const [announcement, setAnnouncement] = useState('')

  const rootRef          = useRef<HTMLDivElement>(null)
  const lastSeenTodayRef = useRef<DayKey | null>(null)
  const displayedRef     = useRef<DayKey | null>(null)
  const returnFocusRef   = useRef<HTMLElement | null>(null)
  displayedRef.current   = displayedDay

  const announce = useCallback((message: string) => {
    setAnnouncement('')
    setTimeout(() => setAnnouncement(message), ANNOUNCE_DELAY_MS)
  }, [])

  const checkDay = useCallback(() => {
    const current  = clockNow()
    const todayKey = toDayKey(current)
    setNow(current)
    const lastSeen = lastSeenTodayRef.current
    const shown    = displayedRef.current
    if (!lastSeen || !shown) return

    const root      = rootRef.current
    const active    = document.activeElement
    const isFocusedEditor = !!active && !!root?.contains(active) && active.matches(EDITING_SELECTOR)
    const hasUnsavedDraft = !!root && [...root.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('[data-draft]')]
      .some(el => el.value.trim() !== '')
    const isEditing = isFocusedEditor || hasUnsavedDraft
    const decision  = decideDayChange({ displayedDay: shown, lastSeenToday: lastSeen, today: todayKey, isEditing })

    lastSeenTodayRef.current = todayKey
    setToday(todayKey)

    if (decision.type === 'follow') {
      setDisplayedDay(decision.to)
      announce(`È iniziato un nuovo giorno: ${formatDayHeading(decision.to)}`)
    } else if (decision.type === 'notify') {
      returnFocusRef.current = isFocusedEditor ? active as HTMLElement : null
      setNotice({ from: decision.from, to: decision.to })
      announce(`È iniziato un nuovo giorno. La bozza resta nel ${formatDayMonth(decision.from)}.`)
    }
  }, [announce])

  useEffect(() => {
    const todayKey = toDayKey(clockNow())
    lastSeenTodayRef.current = todayKey
    setToday(todayKey)
    setDisplayedDay(todayKey)

    const interval = setInterval(checkDay, DAY_CHECK_MS)
    const onVisible = () => { if (document.visibilityState === 'visible') checkDay() }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', checkDay)

    if (process.env.NODE_ENV !== 'production') {
      ;(window as unknown as Record<string, unknown>).__todayDev = {
        setClockOffsetMinutes: (m: number) => { setClockOffsetMinutes(m); checkDay() },
        simulateWriteFailure,
      }
    }

    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', checkDay)
    }
  }, [checkDay])

  function goToToday() {
    if (!today) return
    setNotice(null)
    setDisplayedDay(today)
    announce(`Ora stai guardando oggi, ${formatDayHeading(today)}`)
  }

  function continueWriting() {
    setNotice(null)
    returnFocusRef.current?.focus()
  }

  const isToday = displayedDay !== null && displayedDay === today

  return (
    <AnnounceContext.Provider value={announce}>
      <div className="todayb-screen" ref={rootRef}>
        {/* Background gradient glow blobs */}
        <div className="todayb-glow todayb-glow--1" aria-hidden="true" />
        <div className="todayb-glow todayb-glow--2" aria-hidden="true" />

        <AppHeader
          returnVariant="menu"
          onMenuOpen={() => router.replace('/?view=menu')}
          meta={displayedDay ? formatDayHeading(displayedDay) : undefined}
          title="Oggi"
          subtitle="Una cosa alla volta"
          actions={[{
            kind:    'icon',
            label:   'Calendario',
            icon:    <CalendarIcon size={20} />,
            onClick: () => router.push('/calendar'),
          }]}
        />

        {notice && (
          <div className="today-day-notice" role="region" aria-label="Nuovo giorno">
            <MoonIcon size={20} />
            <div className="today-day-notice-text">
              <p className="today-day-notice-title">È iniziato un nuovo giorno</p>
              <p>La bozza resta nel {formatDayMonth(notice.from)}, dove l&apos;hai cominciata.</p>
            </div>
            <div className="today-day-notice-actions">
              <button type="button" className="today-btn today-btn--ghost" onClick={continueWriting}>
                Continua a scrivere
              </button>
              <button type="button" className="today-btn" onClick={goToToday}>Vai a oggi</button>
            </div>
          </div>
        )}

        <p className="sr-only" role="status" aria-live="polite">{announcement}</p>

        {displayedDay === null ? (
          <p className="todayb-loading" role="status">Sto preparando la tua giornata...</p>
        ) : (
          <main className="todayb-content">
            {/* TODO: data is session-only (in-memory). Decide a calm, non-alarming
                way to communicate this to the user before persisting to storage. */}
            <div className="todayb-layout">
              <div className="todayb-col-left">
                <TodayFocusCard     key={`focus-${displayedDay}`}    day={displayedDay} />
                <TodayNowCard                                         day={displayedDay} now={now} />
                <TodayNextTasksCard key={`tasks-${displayedDay}`}    day={displayedDay} />
              </div>
              <div className="todayb-col-right">
                <TodayDayTimeline   key={`timeline-${displayedDay}`} day={displayedDay} isToday={isToday} now={now} />
              </div>
            </div>

            <TodayToolsRow key={`tools-${displayedDay}`} day={displayedDay} />
          </main>
        )}
      </div>
    </AnnounceContext.Provider>
  )
}
