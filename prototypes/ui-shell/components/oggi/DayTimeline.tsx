// components/oggi/DayTimeline.tsx
'use client'

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import Link from 'next/link'
import { CALENDAR_SOURCE_IS_FIXTURE, getItemsForDate } from '@/lib/calendar-mock'
import { getDailyRepository } from '@/lib/oggi/daily-repository'
import { buildTimeline, layoutLanes, type BlockTimelineEntry, type TimelineEntry } from '@/lib/oggi/timeline'
import {
  DEFAULT_BLOCK_MINUTES, SNAP_MINUTES, describePlacementError, proposeMove, proposeResizeEnd,
  proposeResizeStart, slotLabel, snapMinutes, type PlacementError, type Slot,
} from '@/lib/oggi/time-blocks'
import { IDLE, LONG_PRESS_MS, pressStep, type PressEvent, type PressState } from '@/lib/oggi/press-gesture'
import { formatTime, minutesOfDay, toDayKey, type DayKey } from '@/lib/day'
import { GroupItemCard } from '@/components/CalendarView'
import { useAnnounce, useModal, useRepository } from './shared'
import { BlockActionsDialog, NewBlockDialog, describeBlockError } from './TimeBlockDialogs'
import { BellIcon, CalendarIcon, CloseIcon, GripIcon, MoreIcon, NoteIcon, PlusIcon } from './icons'

/** Single source of the timeline scale: rendering and pointer mapping share it */
const HOUR_PX   = 56
const MIN_PX    = HOUR_PX / 60
const GUTTER_PX = 52
const HOURS     = Array.from({ length: 24 }, (_, h) => h)
const EDGE_SCROLL_PX = 40

const KIND_LABEL: Record<TimelineEntry['kind'], string> = {
  event:    'Appuntamento',
  block:    'Blocco flessibile',
  reminder: 'Promemoria',
  postit:   'PostIt',
}

type Mode = 'move' | 'resize-start' | 'resize-end'

const PROPOSE: Record<Mode, (origin: Slot, delta: number) => Slot> = {
  'move':         proposeMove,
  'resize-start': proposeResizeStart,
  'resize-end':   proposeResizeEnd,
}

type PressTarget =
  | { kind: 'block'; blockId: string; mode: Mode }
  | { kind: 'empty'; minute: number }

/** Transient interaction state; the stored block is untouched until drop */
interface Drag {
  blockId:   string
  title:     string
  mode:      Mode
  origin:    Slot
  /** Minute under the pointer when the interaction became active */
  anchor:    number
  proposal:  Slot
  error:     PlacementError | null
  lastValid: Slot
}

function rangeLabel(entry: TimelineEntry): string {
  return entry.hasEnd ? `${formatTime(entry.start)} - ${formatTime(entry.end)}` : formatTime(entry.start)
}

const sameSlot = (a: Slot, b: Slot) => a.start === b.start && a.duration === b.duration

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
  const announce = useAnnounce()
  const { timed, untimed } = buildTimeline(getItemsForDate(day), repo.listTimeBlocks(day))
  const lanes    = layoutLanes(timed)
  const nowMin   = minutesOfDay(now)
  const isPastDay = day < toDayKey(now)

  const scrollRef = useRef<HTMLDivElement>(null)
  const gridRef   = useRef<HTMLDivElement>(null)
  const [dialog,   setDialog]   = useState<DialogState | null>(null)
  // Feedback belongs to the repository version it describes: any later
  // confirmed change (drag, dialog, task) makes it stale and hides it
  const [feedbackState, setFeedbackState] = useState({ text: '', version: -1 })
  const setFeedback = (text: string) => setFeedbackState({ text, version: repo.getVersion() })
  const feedback = feedbackState.version === repo.getVersion() ? feedbackState.text : ''
  const [ghost,    setGhost]    = useState<number | null>(null)
  const [drag,     setDragState] = useState<Drag | null>(null)

  // Gesture bookkeeping lives in refs: pointer handlers need synchronous values
  const press         = useRef<{ state: PressState; target: PressTarget | null; timer: number | null }>(
    { state: IDLE, target: null, timer: null })
  const dragRef       = useRef<Drag | null>(null)
  const suppressClick = useRef(false)
  const addBlockRef   = useRef<HTMLButtonElement>(null)
  // Block order when the actions dialog opened: lets focus land on a
  // neighbour if the block no longer exists when the dialog closes
  const orderAtOpen   = useRef<string[]>([])

  function openBlockActions(blockId: string) {
    orderAtOpen.current = repo.listTimeBlocks(day).map(b => b.id)
    setDialog({ type: 'block', blockId })
  }

  function closeBlockActions(blockId: string) {
    setDialog(null)
    // A surviving block gets focus back from the native dialog (its opener)
    if (repo.getTimeBlock(blockId)) return
    setTimeout(() => {
      const grid  = gridRef.current
      const order = orderAtOpen.current
      const index = order.indexOf(blockId)
      const survivors = [...order.slice(index + 1), ...order.slice(0, index).reverse()]
      const target = survivors
        .map(id => grid?.querySelector<HTMLElement>(`[data-block-more="${id}"]`))
        .find(Boolean)
      ;(target ?? addBlockRef.current)?.focus()
    }, 0)
  }

  function setDrag(next: Drag | null) {
    dragRef.current = next
    setDragState(next)
  }

  // Scroll so the current hour (or 07:00) is near the top, once per day shown
  useLayoutEffect(() => {
    const anchor = isToday ? nowMin - 60 : 7 * 60
    scrollRef.current?.scrollTo({ top: Math.max(0, anchor * MIN_PX) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day])

  // Once an interaction is active, stop touch panning (it never starts before)
  useEffect(() => {
    const grid = gridRef.current
    if (!grid) return
    const blockIfActive = (e: Event) => { if (press.current.state.phase !== 'idle') e.preventDefault() }
    grid.addEventListener('touchmove', blockIfActive, { passive: false })
    grid.addEventListener('contextmenu', blockIfActive)
    return () => {
      grid.removeEventListener('touchmove', blockIfActive)
      grid.removeEventListener('contextmenu', blockIfActive)
      if (press.current.timer !== null) clearTimeout(press.current.timer)
    }
  }, [])

  /** Minute of the day under a viewport Y coordinate (scroll-aware) */
  function minuteAt(clientY: number): number {
    const rect = gridRef.current!.getBoundingClientRect()
    return (clientY - rect.top) / MIN_PX
  }

  // --- Gesture pipeline ------------------------------------------------------

  function feed(event: PressEvent, clientY: number, pointerId: number) {
    const { state, outcome } = pressStep(press.current.state, event)
    press.current.state = state
    switch (outcome) {
      case 'activate': clearTimer(); activate(clientY, pointerId); break
      case 'drag':     updateDrag(clientY); break
      case 'drop':     finish(true); break
      case 'cancel':   finish(false); break
      case 'abandon':
      case 'tap':      clearTimer(); setGhost(null); press.current.target = null; break
    }
  }

  function clearTimer() {
    if (press.current.timer !== null) clearTimeout(press.current.timer)
    press.current.timer = null
  }

  function onPointerDown(e: React.PointerEvent) {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    if (press.current.state.phase !== 'idle') return
    suppressClick.current = false
    const el = e.target as Element
    if (el.closest('[data-block-more]')) return
    const blockEl = el.closest<HTMLElement>('[data-block-id]')
    let target: PressTarget
    let immediate = false
    if (blockEl) {
      const resize = el.closest<HTMLElement>('[data-resize]')
      const mode: Mode = resize ? (resize.dataset.resize === 'start' ? 'resize-start' : 'resize-end') : 'move'
      immediate = !!resize || !!el.closest('[data-grip]')
      target = { kind: 'block', blockId: blockEl.dataset.blockId!, mode }
    } else if (el.closest('.oggi-entry')) {
      return // fixed items: click only, no gestures
    } else {
      target = { kind: 'empty', minute: minuteAt(e.clientY) }
      setGhost(snapMinutes(target.minute))
    }
    press.current.target = target
    const clientY = e.clientY
    const pointerId = e.pointerId
    feed({ type: 'down', pointerId, x: e.clientX, y: clientY, t: performance.now(), immediate }, clientY, pointerId)
    // feed() mutated the state; re-read it without the earlier narrowing
    const afterDown = press.current.state as PressState
    if (afterDown.phase === 'pending') {
      press.current.timer = window.setTimeout(() => {
        press.current.timer = null
        feed({ type: 'timer', t: performance.now() }, clientY, pointerId)
      }, LONG_PRESS_MS)
    }
  }

  function onPointerMove(e: React.PointerEvent) {
    if (press.current.state.phase === 'idle') return
    feed({ type: 'move', pointerId: e.pointerId, x: e.clientX, y: e.clientY }, e.clientY, e.pointerId)
  }

  function onPointerUp(e: React.PointerEvent) {
    feed({ type: 'up', pointerId: e.pointerId, t: performance.now() }, e.clientY, e.pointerId)
  }

  function onPointerCancel(e: React.PointerEvent) {
    feed({ type: 'cancel', pointerId: e.pointerId }, e.clientY, e.pointerId)
  }

  function activate(clientY: number, pointerId: number) {
    const target = press.current.target
    setGhost(null)
    if (!target) return
    try { gridRef.current?.setPointerCapture(pointerId) } catch { /* pointer already gone */ }
    suppressClick.current = true

    if (target.kind === 'empty') {
      const result = repo.createTimeBlock(day, { start: snapMinutes(target.minute), duration: DEFAULT_BLOCK_MINUTES })
      if (!result.ok) {
        setFeedback(describeBlockError(result.error))
        announce(describeBlockError(result.error))
        return
      }
      setFeedback('')
      announce(`Blocco creato: ${result.block.title}, ${slotLabel(result.block)}. Trascina per spostarlo.`)
      // Keep holding to move the new block right away
      press.current.target = { kind: 'block', blockId: result.block.id, mode: 'move' }
      startDrag(result.block.id, 'move', clientY)
      return
    }
    startDrag(target.blockId, target.mode, clientY)
  }

  function startDrag(blockId: string, mode: Mode, clientY: number) {
    const block = repo.getTimeBlock(blockId)
    if (!block) return
    const origin = { start: block.start, duration: block.duration }
    setFeedback('')
    setDrag({
      blockId, title: block.title, mode, origin, anchor: minuteAt(clientY),
      proposal: origin, error: null, lastValid: origin,
    })
  }

  function updateDrag(clientY: number) {
    const current = dragRef.current
    if (!current) return
    autoScroll(clientY)
    const proposal = PROPOSE[current.mode](current.origin, minuteAt(clientY) - current.anchor)
    if (sameSlot(proposal, current.proposal)) return
    const error = repo.validateTimeBlock(day, proposal)
    setDrag({ ...current, proposal, error, lastValid: error ? current.lastValid : proposal })
  }

  function autoScroll(clientY: number) {
    const scroller = scrollRef.current
    if (!scroller) return
    const rect = scroller.getBoundingClientRect()
    if (clientY < rect.top + EDGE_SCROLL_PX)    scroller.scrollBy(0, -12)
    if (clientY > rect.bottom - EDGE_SCROLL_PX) scroller.scrollBy(0, 12)
  }

  function finish(commit: boolean) {
    clearTimer()
    setGhost(null)
    press.current.target = null
    // Swallow only the click synthesized right after this pointerup
    setTimeout(() => { suppressClick.current = false }, 0)
    const current = dragRef.current
    setDrag(null)
    if (!current) return
    const where = slotLabel(current.origin)
    if (!commit) {
      setFeedback(`Spostamento annullato: il blocco è rimasto alle ${where}.`)
      announce(`Spostamento annullato, ${current.title} resta alle ${where}`)
      return
    }
    const target = current.error ? current.lastValid : current.proposal
    if (sameSlot(target, current.origin)) {
      if (current.error) setFeedback(`${describePlacementError(current.error)} Il blocco è rimasto alle ${where}.`)
      return
    }
    const result = repo.updateTimeBlock(current.blockId, target)
    if (!result.ok) {
      // The view re-reads the repository, so it already shows the stored slot
      setFeedback(describeBlockError(result.error))
      announce(describeBlockError(result.error))
      return
    }
    const label = slotLabel(result.block)
    setFeedback(current.error ? `Lì l'orario era occupato: il blocco è all'ultimo orario libero, ${label}.` : '')
    announce(`${result.block.title}: ora ${label}`)
  }

  // --- Keyboard alternative on the grip ---------------------------------------

  function onGripKey(e: React.KeyboardEvent, block: BlockTimelineEntry['source']) {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return
    e.preventDefault()
    const delta = e.key === 'ArrowUp' ? -SNAP_MINUTES : SNAP_MINUTES
    const proposal = e.shiftKey ? proposeResizeEnd(block, delta) : proposeMove(block, delta)
    const result = repo.updateTimeBlock(block.id, proposal)
    if (result.ok) {
      setFeedback('')
      announce(`${result.block.title}: ${slotLabel(result.block)}`)
    } else {
      setFeedback(describeBlockError(result.error))
      announce(describeBlockError(result.error))
    }
  }

  // --- Render ---------------------------------------------------------------

  const liveMessage = drag?.error
    ? `${describePlacementError(drag.error)} Se lasci qui, il blocco resta all'ultimo orario libero (${slotLabel(drag.lastValid)}).`
    : feedback

  return (
    <section className="oggi-card oggi-timeline-card" aria-labelledby="oggi-timeline-title">
      <div className="oggi-card-header">
        <h2 id="oggi-timeline-title" className="oggi-card-title">La tua giornata</h2>
        <ul className="oggi-legend" aria-label="Legenda">
          <li><span className="oggi-swatch oggi-swatch--event" aria-hidden="true" />Appuntamento</li>
          <li><span className="oggi-swatch oggi-swatch--block" aria-hidden="true" />Blocco flessibile</li>
          <li><span className="oggi-swatch oggi-swatch--reminder" aria-hidden="true" />Promemoria</li>
          <li><span className="oggi-swatch oggi-swatch--postit" aria-hidden="true" />PostIt</li>
        </ul>
      </div>

      {CALENDAR_SOURCE_IS_FIXTURE && (
        <p className="oggi-fixture-note">
          Appuntamenti, promemoria e PostIt sono dati di esempio, gli stessi del Calendario.
        </p>
      )}

      {untimed.length > 0 && (
        <div className="oggi-untimed">
          <span className="oggi-group-label">Senza orario</span>
          {untimed.map(item => (
            <button key={item.id} type="button" className={`oggi-chip oggi-chip--${item.kind}`}
                    onClick={() => setDialog({ type: 'entry', entry: {
                      key: `${item.kind}:${item.id}`, kind: item.kind, title: item.title,
                      start: 0, end: 0, hasEnd: false, source: item,
                    } })}>
              {item.title}
            </button>
          ))}
        </div>
      )}

      <p className="oggi-muted oggi-timeline-hint">
        Tieni premuto su un orario libero per creare un blocco, o su un blocco per spostarlo.
      </p>

      <div ref={scrollRef} className="oggi-timeline-scroll" tabIndex={0}
           role="region" aria-label="Ore della giornata, scorribile">
        <div
          ref={gridRef}
          className="oggi-timeline-grid"
          style={{ height: 24 * HOUR_PX }}
          data-interacting={drag ? true : undefined}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
          onLostPointerCapture={e => {
            // Taking capture for the grid releases a child's implicit touch
            // capture; that bubbled event must not cancel the new drag
            if (e.target === gridRef.current && press.current.state.phase === 'active') onPointerCancel(e)
          }}
        >
          {HOURS.map(h => (
            <div key={h} className="oggi-hour" style={{ top: h * HOUR_PX }} aria-hidden="true">
              <span className="oggi-hour-label">{formatTime(h * 60)}</span>
            </div>
          ))}

          {isToday && (
            <div className="oggi-now-line" style={{ top: nowMin * MIN_PX }} aria-hidden="true" />
          )}

          {ghost !== null && (
            <div className="oggi-create-ghost" aria-hidden="true"
                 style={{ top: ghost * MIN_PX, height: DEFAULT_BLOCK_MINUTES * MIN_PX }}>
              <span>Tieni premuto: blocco alle {formatTime(ghost)}</span>
            </div>
          )}

          <ol className="oggi-timeline-items" aria-label="Elementi in ordine di orario">
            {timed.map(entry => {
              const placement = lanes.get(entry.key) ?? { lane: 0, lanes: 1 }
              const horizontal: CSSProperties = {
                left:  `calc(${GUTTER_PX}px + (100% - ${GUTTER_PX + 8}px) * ${placement.lane / placement.lanes})`,
                width: `calc((100% - ${GUTTER_PX + 8}px) / ${placement.lanes} - 4px)`,
              }

              if (entry.kind !== 'block') {
                return (
                  <li key={entry.key} className={`oggi-entry oggi-entry--${entry.kind}`} style={{
                    ...horizontal,
                    top:    entry.start * MIN_PX + 1,
                    height: Math.max(26, (entry.end - entry.start) * MIN_PX - 3),
                  }}>
                    <button type="button" className="oggi-entry-body"
                            onClick={() => setDialog({ type: 'entry', entry })}
                            aria-label={`${KIND_LABEL[entry.kind]}: ${entry.title}, ${rangeLabel(entry)}. Apri dettagli`}>
                      <EntryContent entry={entry} />
                    </button>
                  </li>
                )
              }

              const block    = entry.source
              const active   = drag?.blockId === block.id ? drag : null
              const slot     = active ? active.proposal : block
              const end      = slot.start + slot.duration
              const isPast   = !active && (isPastDay || (isToday && block.start + block.duration <= nowMin))
              const linked   = block.taskId ? repo.listTasks(day).find(t => t.id === block.taskId) : undefined
              return (
                <li key={entry.key}
                    className="oggi-entry oggi-entry--block"
                    data-block-id={block.id}
                    data-active={active ? true : undefined}
                    data-invalid={active?.error ? true : undefined}
                    data-past={isPast || undefined}
                    style={{
                      ...horizontal,
                      top:    slot.start * MIN_PX + 1,
                      height: Math.max(26, Math.max(0, end - slot.start) * MIN_PX - 3),
                    }}>
                  <span className="oggi-resize oggi-resize--start" data-resize="start" aria-hidden="true" />
                  <button type="button" className="oggi-entry-handle" data-grip
                          aria-label={`Sposta ${block.title}, ${slotLabel(block)}. Frecce su e giù: 15 minuti. Maiuscolo e frecce: cambia la durata`}
                          onKeyDown={e => onGripKey(e, block)}>
                    <GripIcon size={16} />
                  </button>
                  <button type="button" className="oggi-entry-body"
                          onClick={() => {
                            if (suppressClick.current) { suppressClick.current = false; return }
                            openBlockActions(block.id)
                          }}
                          aria-label={`Blocco flessibile: ${block.title}, ${slotLabel(block)}${isPast ? ', orario passato' : ''}${linked ? `, collegato a ${linked.title}` : ''}. Apri azioni`}>
                    <span className="oggi-entry-title">{block.title}</span>
                    <span className="oggi-entry-meta">
                      {slotLabel(slot)} · {isPast ? 'orario passato' : 'flessibile'}{linked ? ' · da Da fare' : ''}
                    </span>
                  </button>
                  <button type="button" className="oggi-entry-more" data-block-more={block.id}
                          aria-label={`Azioni per ${block.title}`}
                          onClick={() => openBlockActions(block.id)}>
                    <MoreIcon size={16} />
                  </button>
                  <span className="oggi-resize oggi-resize--end" data-resize="end" aria-hidden="true" />
                  {active && (
                    <span className="oggi-live-time" aria-hidden="true">
                      {active.error ? 'Occupato' : slotLabel(active.proposal)}
                    </span>
                  )}
                </li>
              )
            })}
          </ol>
        </div>
      </div>

      <p className="oggi-block-feedback" role="status">{liveMessage}</p>

      <button ref={addBlockRef} type="button" className="oggi-add-btn" onClick={() => setDialog({ type: 'new' })}>
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

function EntryContent({ entry }: { entry: Exclude<TimelineEntry, BlockTimelineEntry> }) {
  const range = rangeLabel(entry)
  switch (entry.kind) {
    case 'event':
      // Without an end the entry is only 30 minutes tall: keep it on one line
      if (!entry.hasEnd) {
        return (
          <span className="oggi-entry-title">
            <CalendarIcon size={13} /> {entry.title} <span className="oggi-entry-inline-time">{range}</span>
          </span>
        )
      }
      return (
        <>
          <span className="oggi-entry-title"><CalendarIcon size={13} /> {entry.title}</span>
          <span className="oggi-entry-meta">
            {[range, entry.source.detail?.location].filter(Boolean).join(' · ')}
          </span>
        </>
      )
    case 'reminder':
      return (
        <span className="oggi-entry-title">
          <BellIcon size={13} /> Promemoria {range} · {entry.title}
        </span>
      )
    case 'postit':
      return (
        <>
          <span className="oggi-entry-hand">{entry.title}</span>
          <span className="oggi-entry-tag">
            <NoteIcon size={11} /> {range} · PostIt{entry.source.detail?.alsoOn ? ` · anche su ${entry.source.detail.alsoOn}` : ''}
          </span>
        </>
      )
  }
}

/** Read-only detail for calendar items, using Calendario's own card */
function EntryDialog({ entry, onClose }: { entry: TimelineEntry; onClose: () => void }) {
  const ref = useModal(onClose)
  if (entry.kind === 'block') return null
  return (
    <dialog ref={ref} className="oggi-dialog" aria-labelledby="oggi-entry-dialog-title">
      <div className="oggi-dialog-header">
        <div>
          <p className="oggi-group-label">{KIND_LABEL[entry.kind]}</p>
          <h2 id="oggi-entry-dialog-title" className="oggi-card-title">{entry.title}</h2>
        </div>
        <button type="button" className="oggi-icon-btn" onClick={() => ref.current?.close()} aria-label="Chiudi">
          <CloseIcon />
        </button>
      </div>
      <div className="oggi-dialog-body">
        <GroupItemCard item={entry.source} />
        <Link href="/calendario" className="oggi-text-btn">Apri il Calendario</Link>
      </div>
    </dialog>
  )
}
