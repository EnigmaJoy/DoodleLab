'use client'

import { useRef, useState, type CSSProperties } from 'react'
import { getCalendarRepository } from '@/lib/calendar-repository'
import { getDailyRepository } from '@/lib/today/daily-repository'
import { buildTimeline, layoutLanes, HOUR_PX, MIN_PX, type TimelineEntry } from '@/lib/today/timeline'
import { SNAP_MINUTES, proposeMove, proposeResizeEnd, slotLabel } from '@/lib/today/time-blocks'
import { toDayKey, formatTime, minutesOfDay, type DayKey } from '@/lib/day'
import { useAnnounce, useRepository } from './shared'
import { NewBlockDialog } from './TimeBlockDialogs'
import { describeBlockError } from '@/lib/today/daily-repository'
import { GripIcon, PlusIcon } from './icons'
import { useDragInteraction } from '@/lib/hooks/use-drag-interaction'
import { TodayItemModal } from './TodayItemModal'

const HOURS          = Array.from({ length: 24 }, (_, h) => h)
const MIN_ENTRY_PX   = 24
const ENTRY_TRIM_PX  = 3
const ENTRY_INSET_PX = 1
const LANE_MARGIN_PX = 8
const LANE_GAP_PX    = 4
const GUTTER_PX      = 56

const KIND_LABEL: Record<string, string> = {
  event:    'Appuntamento',
  block:    'Blocco flessibile',
  reminder: 'Promemoria',
  note:     'PostIt',
}

type DialogState =
  | { type: 'entry'; entry: TimelineEntry }
  | { type: 'new' }

interface Props {
  day:     DayKey
  isToday: boolean
  now:     Date
}

export function TodayDayTimeline({ day, isToday, now }: Props) {
  const repo        = useRepository(getDailyRepository())
  const calRepo     = useRepository(getCalendarRepository())
  const announce    = useAnnounce()
  const interaction = useDragInteraction({ day, repo, now, isToday, announce })

  const { timed } = buildTimeline(calRepo.getItemsForDate(day), repo.listTimeBlocks(day))
  const lanes     = layoutLanes(timed)
  const nowMin    = minutesOfDay(now)
  const isPastDay = day < toDayKey(now)

  const [dialog,           setDialog]           = useState<DialogState | null>(null)
  const [morningCollapsed, setMorningCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = sessionStorage.getItem('today.morning-collapsed')
        if (saved) {
          const parsed = JSON.parse(saved) as { day: string; collapsed: boolean }
          if (parsed.day === day) return parsed.collapsed
        }
      } catch { /* ignore */ }
    }
    return isToday && nowMin >= 13 * 60
  })

  function toggleMorningCollapsed() {
    setMorningCollapsed(c => {
      const next = !c
      try { sessionStorage.setItem('today.morning-collapsed', JSON.stringify({ day, collapsed: next })) } catch { /* ignore */ }
      return next
    })
  }
  const addBlockRef = useRef<HTMLButtonElement>(null)

  function onGripKey(e: React.KeyboardEvent, block: { id: string; start: number; duration: number; title: string }) {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return
    e.preventDefault()
    const delta    = e.key === 'ArrowUp' ? -SNAP_MINUTES : SNAP_MINUTES
    const proposal = e.shiftKey ? proposeResizeEnd(block, delta) : proposeMove(block, delta)
    const result   = repo.updateTimeBlock(block.id, proposal)
    if (result.ok) {
      announce(`${result.block.title}: ${slotLabel(result.block)}`)
    } else {
      announce(describeBlockError(result.error))
    }
  }

  // Morning entries: before 13:00
  const morningEntries   = timed.filter(e => e.end <= 13 * 60)
  const shouldAutoCollapse = isToday && nowMin >= 13 * 60

  const MORNING_HOURS      = 6   // 07:00 - 13:00
  const MORNING_PX         = MORNING_HOURS * HOUR_PX
  const COLLAPSED_MORNING_H = 44

  function adjustedTop(minutes: number): number {
    if (!morningCollapsed) return minutes * MIN_PX
    const morningStart = 7 * 60
    const morningEnd   = 13 * 60
    if (minutes < morningStart) return minutes * MIN_PX
    if (minutes < morningEnd)   return morningStart * MIN_PX
    return morningStart * MIN_PX + COLLAPSED_MORNING_H + (minutes - morningEnd) * MIN_PX
  }

  function adjustedHeight(start: number, end: number): number {
    if (!morningCollapsed) return Math.max(MIN_ENTRY_PX, (end - start) * MIN_PX - ENTRY_TRIM_PX)
    const adjStart = adjustedTop(start)
    const adjEnd   = adjustedTop(end)
    return Math.max(MIN_ENTRY_PX, adjEnd - adjStart - ENTRY_TRIM_PX)
  }

  function gridHeight(): number {
    if (!morningCollapsed) return 24 * HOUR_PX
    return 24 * HOUR_PX - MORNING_PX + COLLAPSED_MORNING_H
  }

  return (
    <section className="todayb-card todayb-day-card" aria-labelledby="todayb-day-title" data-today="day-card">
      {/* Header row */}
      <div className="todayb-day-header">
        <p id="todayb-day-title" className="todayb-label">La giornata</p>
        <button
          ref={addBlockRef}
          type="button"
          className="todayb-day-plus"
          aria-label="Aggiungi alla giornata"
          title="Aggiungi alla giornata"
          onClick={() => setDialog({ type: 'new' })}
        >
          <PlusIcon size={20} />
        </button>
      </div>

      {/* Morning collapse row */}
      {shouldAutoCollapse && (
        <button
          type="button"
          className="todayb-morning-row"
          onClick={toggleMorningCollapsed}
          aria-expanded={!morningCollapsed}
        >
          <span className="todayb-morning-label">
            Mattina · 07:00 - 13:00 · {morningEntries.length} {morningEntries.length === 1 ? 'elemento' : 'elementi'}
          </span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
               aria-hidden="true"
               style={{ transform: morningCollapsed ? 'rotate(0deg)' : 'rotate(180deg)', transition: 'transform 200ms ease' }}>
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
      )}

      {/* Timeline scroll container */}
      <div
        ref={interaction.scrollRef}
        className="todayb-timeline-scroll"
        tabIndex={0}
        role="region"
        aria-label="Ore della giornata, scorribile"
      >
        <div
          ref={interaction.gridRef}
          className="todayb-timeline-grid"
          style={{ height: gridHeight() }}
          data-interacting={interaction.drag ? true : undefined}
          onPointerDown={interaction.onPointerDown}
          onPointerMove={interaction.onPointerMove}
          onPointerUp={interaction.onPointerUp}
          onPointerCancel={interaction.onPointerCancel}
          onLostPointerCapture={e => {
            if (e.target === interaction.gridRef.current && interaction.press.current.state.phase !== 'idle') {
              interaction.onPointerCancel(e)
            }
          }}
        >
          {/* Hour rows */}
          {HOURS.map(h => {
            if (morningCollapsed && h >= 7 && h < 13) return null
            const topPx  = adjustedTop(h * 60)
            const isPast = isToday ? (h * 60 + 60 <= nowMin) : isPastDay
            return (
              <div
                key={h}
                className={`todayb-hour${h % 2 === 0 ? ' todayb-hour--alt' : ''}`}
                style={{ top: topPx }}
                data-past={isPast || undefined}
                aria-hidden="true"
              >
                <span className="todayb-hour-label">{String(h).padStart(2, '0')}:00</span>
              </div>
            )
          })}

          {/* Collapsed morning placeholder */}
          {morningCollapsed && (
            <div
              className="todayb-morning-placeholder"
              style={{ top: adjustedTop(7 * 60), height: COLLAPSED_MORNING_H }}
              aria-hidden="true"
            />
          )}

          {/* Now line */}
          {isToday && (
            <div
              className="todayb-now-line"
              style={{ top: adjustedTop(nowMin) }}
              aria-hidden="true"
            >
              <span className="todayb-now-pill">{formatTime(nowMin)}</span>
            </div>
          )}

          {/* Ghost for new block */}
          {interaction.ghost !== null && (
            <div
              className="todayb-create-ghost"
              aria-hidden="true"
              style={{ top: adjustedTop(interaction.ghost), height: 30 * MIN_PX }}
            >
              <span>Tieni premuto: blocco alle {formatTime(interaction.ghost)}</span>
            </div>
          )}

          {/* Timeline items */}
          <ol className="todayb-timeline-items" aria-label="Elementi in ordine di orario">
            {timed.map(entry => {
              // Skip morning entries when collapsed
              if (morningCollapsed && entry.start >= 7 * 60 && entry.end <= 13 * 60) return null

              const placement  = lanes.get(entry.key) ?? { lane: 0, lanes: 1 }
              const horizontal: CSSProperties = {
                left:  `calc(${GUTTER_PX}px + (100% - ${GUTTER_PX + LANE_MARGIN_PX}px) * ${placement.lane / placement.lanes})`,
                width: `calc((100% - ${GUTTER_PX + LANE_MARGIN_PX}px) / ${placement.lanes} - ${LANE_GAP_PX}px)`,
              }
              const topPx    = adjustedTop(entry.start) + ENTRY_INSET_PX
              const heightPx = adjustedHeight(entry.start, entry.end)

              if (entry.kind !== 'block') {
                const isDone = entry.kind === 'reminder' && entry.source.note === '[fatto]'
                return (
                  <li
                    key={entry.key}
                    className={`today-entry todayb-entry todayb-entry--${entry.kind}`}
                    data-done={isDone || undefined}
                    style={{ ...horizontal, top: topPx, height: heightPx }}
                  >
                    <button
                      type="button"
                      className="todayb-entry-body"
                      onClick={() => setDialog({ type: 'entry', entry })}
                      aria-label={`${KIND_LABEL[entry.kind]}: ${entry.title}, ${formatTime(entry.start)}. Tocca per le opzioni`}
                    >
                      <span className="todayb-entry-title">{entry.title}</span>
                      <span className="todayb-entry-time">
                        {formatTime(entry.start)}{entry.hasEnd ? ` - ${formatTime(entry.end)}` : ''}
                      </span>
                    </button>
                  </li>
                )
              }

              // Block
              const block  = entry.source
              const active = interaction.drag?.blockId === block.id ? interaction.drag : null
              const slot   = active ? active.proposal : block
              const end    = slot.start + slot.duration
              const isPast = !active && (isPastDay || (isToday && block.start + block.duration <= nowMin))

              const blockTopPx    = adjustedTop(slot.start) + 1
              const blockHeightPx = adjustedHeight(slot.start, end)

              return (
                <li
                  key={entry.key}
                  className="today-entry todayb-entry todayb-entry--block"
                  data-block-id={block.id}
                  data-active={active ? true : undefined}
                  data-invalid={active?.error ? true : undefined}
                  data-past={isPast || undefined}
                  style={{ ...horizontal, top: blockTopPx, height: Math.max(MIN_ENTRY_PX, blockHeightPx) }}
                >
                  <span className="todayb-resize todayb-resize--start" data-resize="start" aria-hidden="true" />
                  <button
                    type="button"
                    className="todayb-entry-handle"
                    data-grip
                    aria-label={`Sposta ${block.title}, ${slotLabel(block)}. Frecce su e giù: 15 minuti.`}
                    onKeyDown={e => onGripKey(e, block)}
                  >
                    <GripIcon size={14} />
                  </button>
                  <button
                    type="button"
                    className="todayb-entry-body"
                    onClick={() => {
                      if (interaction.suppressClick.current) { interaction.suppressClick.current = false; return }
                      setDialog({ type: 'entry', entry })
                    }}
                    aria-label={`${KIND_LABEL.block}: ${block.title}, ${slotLabel(block)}${isPast ? ', orario passato' : ''}. Tocca per le opzioni, tieni premuto per spostarlo`}
                  >
                    <span className="todayb-entry-title">{block.title}</span>
                    <span className="todayb-entry-time">{slotLabel(slot)}</span>
                  </button>
                  <span className="todayb-resize todayb-resize--end" data-resize="end" aria-hidden="true" />
                  {active && (
                    <span className="todayb-live-time" aria-hidden="true">
                      {active.error ? 'Occupato' : slotLabel(active.proposal)}
                    </span>
                  )}
                </li>
              )
            })}
          </ol>
        </div>
      </div>

      <p className="todayb-block-feedback" role="status">{interaction.feedback}</p>

      {/* Dialogs */}
      {dialog?.type === 'entry' && (
        <TodayItemModal
          entry={dialog.entry}
          day={day}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.type === 'new' && (
        <NewBlockDialog day={day} isToday={isToday} now={now} onClose={() => setDialog(null)} />
      )}
    </section>
  )
}
