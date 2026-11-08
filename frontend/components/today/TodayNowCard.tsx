'use client'

import { getDailyRepository } from '@/lib/today/daily-repository'
import { getCalendarRepository } from '@/lib/calendar-repository'
import { buildTimeline } from '@/lib/today/timeline'
import { formatTime, minutesOfDay, type DayKey } from '@/lib/day'
import { useRepository } from './shared'

function formatHHMM(now: Date): string {
  const h = String(now.getHours()).padStart(2, '0')
  const m = String(now.getMinutes()).padStart(2, '0')
  return `${h}:${m}`
}

function CountdownRing({ minutes, totalMinutes }: { minutes: number; totalMinutes: number }) {
  const r            = 28
  const circumference = 2 * Math.PI * r
  const fraction     = totalMinutes > 0 ? Math.max(0, Math.min(1, minutes / totalMinutes)) : 0
  const dashOffset   = circumference * (1 - fraction)

  return (
    <svg width="72" height="72" viewBox="0 0 72 72" aria-hidden="true">
      <circle cx="36" cy="36" r={r} fill="none" stroke="rgba(42,35,32,0.1)" strokeWidth="6" />
      <circle
        cx="36" cy="36" r={r} fill="none"
        stroke="var(--gradient-end)"
        strokeWidth="6"
        strokeDasharray={circumference}
        strokeDashoffset={dashOffset}
        strokeLinecap="round"
        style={{ transform: 'rotate(-90deg)', transformOrigin: '50% 50%', transition: 'stroke-dashoffset 1s linear' }}
      />
      <text x="36" y="38" textAnchor="middle" dominantBaseline="middle"
            fill="var(--gradient-end)" fontSize="11" fontWeight="700">
        {minutes}
      </text>
      <text x="36" y="50" textAnchor="middle" fill="rgba(42,35,32,0.5)" fontSize="9">
        min
      </text>
    </svg>
  )
}

export function TodayNowCard({ day, now }: { day: DayKey; now: Date }) {
  const repo    = useRepository(getDailyRepository())
  const calRepo = useRepository(getCalendarRepository())
  const nowMin  = minutesOfDay(now)

  const { timed } = buildTimeline(calRepo.getItemsForDate(day), repo.listTimeBlocks(day))

  const currentEntry = timed.find(e => e.start <= nowMin && e.end > nowMin)
  const nextEntry    = timed.find(e => e.start > nowMin)

  let mainLine: string
  let showRing  = false
  let ringMin   = 0
  let ringTotal = 0

  if (currentEntry) {
    mainLine  = `In corso: ${currentEntry.title}, fino alle ${formatTime(currentEntry.end)}`
    showRing  = true
    ringMin   = Math.max(0, currentEntry.end - nowMin)
    ringTotal = currentEntry.end - currentEntry.start
  } else if (nextEntry) {
    mainLine  = `Tempo libero fino alle ${formatTime(nextEntry.start)}`
    showRing  = true
    ringMin   = Math.max(0, nextEntry.start - nowMin)
    ringTotal = nextEntry.start - nowMin
  } else {
    mainLine = 'Tempo libero fino a stasera'
    showRing = false
  }

  return (
    <section className="todayb-card todayb-now-card" aria-labelledby="todayb-now-title">
      <div className="todayb-now-layout">
        <div className="todayb-now-text">
          <p id="todayb-now-title" className="todayb-label">
            Adesso · {formatHHMM(now)}
          </p>
          <p className="todayb-now-main">{mainLine}</p>
          {nextEntry && (
            <p className="todayb-now-next">
              Poi: <strong>{nextEntry.title}</strong>, {formatTime(nextEntry.start)}
              {nextEntry.hasEnd ? ` - ${formatTime(nextEntry.end)}` : ''}
            </p>
          )}
        </div>
        {showRing && (
          <div className="todayb-now-ring" aria-hidden="true">
            <CountdownRing minutes={ringMin} totalMinutes={ringTotal} />
          </div>
        )}
      </div>
    </section>
  )
}
