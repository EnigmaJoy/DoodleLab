// components/today/DayTimeline.tsx
'use client'

import { useRef, useState, type CSSProperties } from 'react'
import { getCalendarRepository } from '@/lib/calendar-repository'
import { getDailyRepository } from '@/lib/today/daily-repository'
import { buildTimeline, layoutLanes, HOUR_PX, MIN_PX, type BlockTimelineEntry, type TimelineEntry } from '@/lib/today/timeline'
import { DEFAULT_BLOCK_MINUTES, SNAP_MINUTES, describePlacementError, proposeMove, proposeResizeEnd, slotLabel } from '@/lib/today/time-blocks'
import { toDayKey, type DayKey } from '@/lib/day'
import { useAnnounce, useRepository } from './shared'
import { BlockActionsDialog, NewBlockDialog } from './TimeBlockDialogs'
import { describeBlockError } from '@/lib/today/daily-repository'
import { GripIcon, MoreIcon, PlusIcon } from './icons'
import { useDragInteraction } from '@/lib/hooks/use-drag-interaction'
import { EntryContent, rangeLabel } from './EntryContent'
import { EntryDialog } from './EntryDialog'
import { formatTime, minutesOfDay } from '@/lib/day'

const HOURS        = Array.from({ length: 24 }, (_, h) => h)
const MIN_ENTRY_PX   = 26  // minimum rendered height for any timeline entry
const ENTRY_TRIM_PX  = 3   // gap subtracted from raw height so entries don't touch
const ENTRY_INSET_PX = 1   // top inset so entries don't sit exactly on the hour line
const LANE_MARGIN_PX = 8   // left margin reserved for the gutter
const LANE_GAP_PX    = 4   // gap between adjacent lane columns

const KIND_LABEL: Record<TimelineEntry['kind'], string> = {
  event:    'Appuntamento',
  block:    'Blocco flessibile',
  reminder: 'Promemoria',
  note:     'PostIt',
}

const GUTTER_PX = 52

type DialogState =
  | { type: 'entry'; entry: TimelineEntry }
  | { type: 'block'; blockId: string }
  | { type: 'new' }

interface Props {
  day:     DayKey
  isToday: boolean
  /** Current local time; draws the "now" line and marks past blocks */
  now:     Date
}

export function DayTimeline({ day, isToday, now }: Props) {
  const repo     = useRepository(getDailyRepository())
  const calRepo  = useRepository(getCalendarRepository())
  const announce = useAnnounce()

  const { timed, untimed } = buildTimeline(calRepo.getItemsForDate(day), repo.listTimeBlocks(day))
  const lanes     = layoutLanes(timed)
  const nowMin    = minutesOfDay(now)
  const isPastDay = day < toDayKey(now)

  const interaction = useDragInteraction({ day, repo, now, isToday, announce })

  const [dialog,   setDialog]   = useState<DialogState | null>(null)
  const addBlockRef              = useRef<HTMLButtonElement>(null)
  const orderAtOpen              = useRef<string[]>([])

  function openBlockActions(blockId: string) {
    orderAtOpen.current = repo.listTimeBlocks(day).map(b => b.id)
    setDialog({ type: 'block', blockId })
  }

  function closeBlockActions(blockId: string) {
    setDialog(null)
    if (repo.getTimeBlock(blockId)) return
    setTimeout(() => {
      const grid  = interaction.gridRef.current
      const order = orderAtOpen.current
      const index = order.indexOf(blockId)
      const survivors = [...order.slice(index + 1), ...order.slice(0, index).reverse()]
      const target = survivors
        .map(id => grid?.querySelector<HTMLElement>(`[data-block-more="${id}"]`))
        .find(Boolean)
      ;(target ?? addBlockRef.current)?.focus()
    }, 0)
  }

  function onGripKey(e: React.KeyboardEvent, block: BlockTimelineEntry['source']) {
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

  const liveMessage = interaction.drag?.error
    ? `${describePlacementError(interaction.drag.error)} Se lasci qui, il blocco resta all'ultimo orario libero (${slotLabel(interaction.drag.lastValid)}).`
    : interaction.feedback

  return (
    <section className="today-card today-timeline-card" aria-labelledby="today-timeline-title">
      <div className="today-card-header">
        <h2 id="today-timeline-title" className="today-card-title">La tua giornata</h2>
        <ul className="today-legend" aria-label="Legenda">
          <li><span className="today-swatch today-swatch--event" aria-hidden="true" />Appuntamento</li>
          <li><span className="today-swatch today-swatch--block" aria-hidden="true" />Blocco flessibile</li>
          <li><span className="today-swatch today-swatch--reminder" aria-hidden="true" />Promemoria</li>
          <li><span className="today-swatch today-swatch--note" aria-hidden="true" />PostIt</li>
        </ul>
      </div>

      {untimed.length > 0 && (
        <div className="today-untimed">
          <span className="today-group-label">Senza orario</span>
          {untimed.map(item => (
            <button key={item.id} type="button" className={`today-chip today-chip--${item.kind}`}
                    onClick={() => setDialog({ type: 'entry', entry: {
                      key: `${item.kind}:${item.id}`, kind: item.kind, title: item.title,
                      start: 0, end: 0, hasEnd: false, source: item,
                    } })}>
              {item.title}
            </button>
          ))}
        </div>
      )}

      <p className="today-muted today-timeline-hint">
        Tieni premuto su un orario libero per creare un blocco, o su un blocco per spostarlo.
      </p>

      <div ref={interaction.scrollRef} className="today-timeline-scroll" tabIndex={0}
           role="region" aria-label="Ore della giornata, scorribile">
        <div
          ref={interaction.gridRef}
          className="today-timeline-grid"
          style={{ height: 24 * HOUR_PX }}
          data-interacting={interaction.drag ? true : undefined}
          onPointerDown={interaction.onPointerDown}
          onPointerMove={interaction.onPointerMove}
          onPointerUp={interaction.onPointerUp}
          onPointerCancel={interaction.onPointerCancel}
          onLostPointerCapture={e => {
            if (e.target === interaction.gridRef.current && interaction.press.current.state.phase === 'active') {
              interaction.onPointerCancel(e)
            }
          }}
        >
          {HOURS.map(h => (
            <div key={h} className="today-hour" style={{ top: h * HOUR_PX }} aria-hidden="true">
              <span className="today-hour-label">{formatTime(h * 60)}</span>
            </div>
          ))}

          {isToday && (
            <div className="today-now-line" style={{ top: nowMin * MIN_PX }} aria-hidden="true" />
          )}

          {interaction.ghost !== null && (
            <div className="today-create-ghost" aria-hidden="true"
                 style={{ top: interaction.ghost * MIN_PX, height: DEFAULT_BLOCK_MINUTES * MIN_PX }}>
              <span>Tieni premuto: blocco alle {formatTime(interaction.ghost)}</span>
            </div>
          )}

          <ol className="today-timeline-items" aria-label="Elementi in ordine di orario">
            {timed.map(entry => {
              const placement = lanes.get(entry.key) ?? { lane: 0, lanes: 1 }
              const horizontal: CSSProperties = {
                left:  `calc(${GUTTER_PX}px + (100% - ${GUTTER_PX + LANE_MARGIN_PX}px) * ${placement.lane / placement.lanes})`,
                width: `calc((100% - ${GUTTER_PX + LANE_MARGIN_PX}px) / ${placement.lanes} - ${LANE_GAP_PX}px)`,
              }

              if (entry.kind !== 'block') {
                return (
                  <li key={entry.key} className={`today-entry today-entry--${entry.kind}`} style={{
                    ...horizontal,
                    top:    entry.start * MIN_PX + ENTRY_INSET_PX,
                    height: Math.max(MIN_ENTRY_PX, (entry.end - entry.start) * MIN_PX - ENTRY_TRIM_PX),
                  }}>
                    <button type="button" className="today-entry-body"
                            onClick={() => setDialog({ type: 'entry', entry })}
                            aria-label={`${KIND_LABEL[entry.kind]}: ${entry.title}, ${rangeLabel(entry)}. Apri dettagli`}>
                      <EntryContent entry={entry} />
                    </button>
                  </li>
                )
              }

              const block  = entry.source
              const active = interaction.drag?.blockId === block.id ? interaction.drag : null
              const slot   = active ? active.proposal : block
              const end    = slot.start + slot.duration
              const isPast = !active && (isPastDay || (isToday && block.start + block.duration <= nowMin))
              const linked = block.taskId ? repo.listTasks(day).find(t => t.id === block.taskId) : undefined

              return (
                <li key={entry.key}
                    className="today-entry today-entry--block"
                    data-block-id={block.id}
                    data-active={active ? true : undefined}
                    data-invalid={active?.error ? true : undefined}
                    data-past={isPast || undefined}
                    style={{
                      ...horizontal,
                      top:    slot.start * MIN_PX + 1,
                      height: Math.max(MIN_ENTRY_PX, Math.max(0, end - slot.start) * MIN_PX - ENTRY_TRIM_PX),
                    }}>
                  <span className="today-resize today-resize--start" data-resize="start" aria-hidden="true" />
                  <button type="button" className="today-entry-handle" data-grip
                          aria-label={`Sposta ${block.title}, ${slotLabel(block)}. Frecce su e giù: 15 minuti. Maiuscolo e frecce: cambia la durata`}
                          onKeyDown={e => onGripKey(e, block)}>
                    <GripIcon size={16} />
                  </button>
                  <button type="button" className="today-entry-body"
                          onClick={() => {
                            if (interaction.suppressClick.current) { interaction.suppressClick.current = false; return }
                            openBlockActions(block.id)
                          }}
                          aria-label={`Blocco flessibile: ${block.title}, ${slotLabel(block)}${isPast ? ', orario passato' : ''}${linked ? `, collegato a ${linked.title}` : ''}. Apri azioni`}>
                    <span className="today-entry-title">{block.title}</span>
                    <span className="today-entry-meta">
                      {slotLabel(slot)} · {isPast ? 'orario passato' : 'flessibile'}{linked ? ' · da Da fare' : ''}
                    </span>
                  </button>
                  <button type="button" className="today-entry-more" data-block-more={block.id}
                          aria-label={`Azioni per ${block.title}`}
                          onClick={() => openBlockActions(block.id)}>
                    <MoreIcon size={16} />
                  </button>
                  <span className="today-resize today-resize--end" data-resize="end" aria-hidden="true" />
                  {active && (
                    <span className="today-live-time" aria-hidden="true">
                      {active.error ? 'Occupato' : slotLabel(active.proposal)}
                    </span>
                  )}
                </li>
              )
            })}
          </ol>
        </div>
      </div>

      <p className="today-block-feedback" role="status">{liveMessage}</p>

      <button ref={addBlockRef} type="button" className="today-add-btn" onClick={() => setDialog({ type: 'new' })}>
        <PlusIcon size={16} /> Aggiungi blocco
      </button>

      {dialog?.type === 'entry' && <EntryDialog entry={dialog.entry} onClose={() => setDialog(null)} />}
      {dialog?.type === 'new' && (
        <NewBlockDialog day={day} isToday={isToday} now={now} onClose={() => setDialog(null)} />
      )}
      {dialog?.type === 'block' && (() => {
        const block = repo.getTimeBlock(dialog.blockId)
        const past  = !!block && (isPastDay || (isToday && block.start + block.duration <= nowMin))
        return (
          <BlockActionsDialog blockId={dialog.blockId} isPast={past} isToday={isToday} now={now}
                              onClose={() => closeBlockActions(dialog.blockId)} />
        )
      })()}
    </section>
  )
}
