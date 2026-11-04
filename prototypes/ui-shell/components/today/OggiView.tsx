// components/today/OggiView.tsx
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AppHeader } from '@/design-system/AppHeader'
import { clockNow, setClockOffsetMinutes } from '@/lib/oggi/clock'
import { decideDayChange } from '@/lib/oggi/day-change'
import { simulateWriteFailure } from '@/lib/oggi/daily-repository'
import { formatDayHeading, formatDayMonth, toDayKey, type DayKey } from '@/lib/day'
import { AnnounceContext, ExpandablePanel } from './shared'
import { FocusCard } from './FocusCard'
import { DayTimeline } from './DayTimeline'
import { TaskList } from './TaskList'
import { QuickCapture } from './QuickCapture'
import { EnergyActivities } from './EnergyActivities'
import { CheckIn } from './CheckIn'
import { VisualTimer } from './VisualTimer'
import { DiaryPanel } from './DiaryPanel'
import { BoltIcon, FeatherIcon, HourglassIcon, MoonIcon, SmileIcon } from './icons'

const DAY_CHECK_MS = 30_000

// Text entry counts as "actively writing"; checkboxes and buttons do not
const EDITING_SELECTOR =
  'textarea, [contenteditable="true"], input:not([type=checkbox]):not([type=radio]):not([type=button]):not([type=submit])'

interface DayNotice { from: DayKey; to: DayKey }

export function OggiView() {
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
    // Clear first so repeating the same message is announced again
    setAnnouncement('')
    setTimeout(() => setAnnouncement(message), 50)
  }, [])

  const checkDay = useCallback(() => {
    const current = clockNow()
    const todayKey = toDayKey(current)
    setNow(current)
    const lastSeen = lastSeenTodayRef.current
    const shown    = displayedRef.current
    if (!lastSeen || !shown) return

    const root      = rootRef.current
    const active    = document.activeElement
    const isFocusedEditor = !!active && !!root?.contains(active) && active.matches(EDITING_SELECTOR)
    // An unsubmitted draft counts as writing even when its field is not focused
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
      // Do not move focus: the user keeps typing undisturbed
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
      ;(window as unknown as Record<string, unknown>).__oggiDev = {
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
      <div className="today-screen" ref={rootRef}>
        <AppHeader
          returnVariant="menu"
          onMenuOpen={() => router.replace('/?view=menu')}
          meta={displayedDay ? formatDayHeading(displayedDay) : undefined}
          title="Oggi"
          subtitle="La tua giornata, a colpo d'occhio"
          actions={[{
            kind:    'secondary',
            label:   'Calendario',
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
          <p className="today-loading" role="status">Sto preparando la tua giornata...</p>
        ) : (
          // Day-bound components are keyed by day so no draft or edit state
          // can carry over to another date. The timer is not day-bound.
          <main className="today-main">
            <div className="today-col today-col--primary">
              <FocusCard key={`FocusCard-${displayedDay}`} day={displayedDay} />
              <DayTimeline key={`DayTimeline-${displayedDay}`} day={displayedDay} isToday={isToday} now={now} />
            </div>

            <div className="today-col today-col--secondary">
              <TaskList key={`TaskList-${displayedDay}`} day={displayedDay} />
              <QuickCapture />

              <section className="today-more" aria-labelledby="today-more-title">
                <h2 id="today-more-title" className="today-section-label">Altro per oggi</h2>
                <ExpandablePanel id="energy" title="Attività per energia" icon={<BoltIcon />}>
                  <EnergyActivities key={`EnergyActivities-${displayedDay}`} day={displayedDay} />
                </ExpandablePanel>
                <ExpandablePanel id="checkin" title="Energia e umore" hint="facoltativo" icon={<SmileIcon />}>
                  <CheckIn day={displayedDay} />
                </ExpandablePanel>
                <ExpandablePanel id="timer" title="Timer visivo" icon={<HourglassIcon />}>
                  <VisualTimer />
                </ExpandablePanel>
                <ExpandablePanel id="diary" title="Pensieri del giorno" icon={<FeatherIcon />}>
                  <DiaryPanel key={`DiaryPanel-${displayedDay}`} day={displayedDay} />
                </ExpandablePanel>
              </section>

              <p className="today-session-note">
                In questa versione quello che scrivi in Oggi resta solo in questa sessione:
                ricaricando la pagina si perde. Il salvataggio protetto arriverà con il vault cifrato.
              </p>
            </div>
          </main>
        )}
      </div>
    </AnnounceContext.Provider>
  )
}
