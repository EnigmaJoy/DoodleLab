// lib/hooks/use-drag-interaction.ts
'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  DEFAULT_BLOCK_MINUTES, SNAP_MINUTES, describePlacementError, proposeMove, proposeResizeEnd,
  proposeResizeStart, slotLabel, snapMinutes, type PlacementError, type Slot,
} from '@/lib/today/time-blocks'
import { MIN_PX } from '@/lib/today/timeline'
import { IDLE, LONG_PRESS_MS, pressStep, type PressEvent, type PressState } from '@/lib/today/press-gesture'
import { minutesOfDay, type DayKey } from '@/lib/day'
import { describeBlockError, type DailyRepository } from '@/lib/today/daily-repository'

const EDGE_SCROLL_PX    = 40
const SCROLL_BACK_MIN   = 60   // minutes before current time to scroll to on today
const DEFAULT_SCROLL_HR = 7    // hour to scroll to on non-today days
const AUTO_SCROLL_PX    = 12   // pixels scrolled per frame during edge-scroll

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

const sameSlot = (a: Slot, b: Slot) => a.start === b.start && a.duration === b.duration

interface UseDragInteractionOptions {
  day:      DayKey
  repo:     DailyRepository
  now:      Date
  isToday:  boolean
  announce: (msg: string) => void
}

export function useDragInteraction({ day, repo, now, isToday, announce }: UseDragInteractionOptions) {
  const nowMin    = minutesOfDay(now)
  const scrollRef = useRef<HTMLDivElement>(null)
  const gridRef   = useRef<HTMLDivElement>(null)

  const [feedbackState, setFeedbackState] = useState({ text: '', version: -1 })
  const setFeedback = (text: string) => setFeedbackState({ text, version: repo.getVersion() })
  const feedback = feedbackState.version === repo.getVersion() ? feedbackState.text : ''

  const [ghost,     setGhost]     = useState<number | null>(null)
  const [drag,      setDragState] = useState<Drag | null>(null)

  const press         = useRef<{ state: PressState; target: PressTarget | null; timer: number | null }>(
    { state: IDLE, target: null, timer: null })
  const dragRef       = useRef<Drag | null>(null)
  const suppressClick = useRef(false)

  // Scroll so the current hour (or 07:00) is near the top, once per day shown
  useLayoutEffect(() => {
    const anchor = isToday ? nowMin - SCROLL_BACK_MIN : DEFAULT_SCROLL_HR * 60
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

  function setDrag(next: Drag | null) {
    dragRef.current = next
    setDragState(next)
  }

  /** Minute of the day under a viewport Y coordinate (scroll-aware) */
  function minuteAt(clientY: number): number {
    const rect = gridRef.current!.getBoundingClientRect()
    return (clientY - rect.top) / MIN_PX
  }

  // --- Gesture pipeline -------------------------------------------------------

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
      const resize  = el.closest<HTMLElement>('[data-resize]')
      const mode: Mode = resize ? (resize.dataset.resize === 'start' ? 'resize-start' : 'resize-end') : 'move'
      immediate = !!resize || !!el.closest('[data-grip]')
      target = { kind: 'block', blockId: blockEl.dataset.blockId!, mode }
    } else if (el.closest('.today-entry')) {
      return // fixed items: click only, no gestures
    } else {
      target = { kind: 'empty', minute: minuteAt(e.clientY) }
      setGhost(snapMinutes(target.minute))
    }
    press.current.target = target
    const clientY   = e.clientY
    const pointerId = e.pointerId
    feed({ type: 'down', pointerId, x: e.clientX, y: clientY, t: performance.now(), immediate }, clientY, pointerId)
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
    if (clientY < rect.top + EDGE_SCROLL_PX)    scroller.scrollBy(0, -AUTO_SCROLL_PX)
    if (clientY > rect.bottom - EDGE_SCROLL_PX) scroller.scrollBy(0, AUTO_SCROLL_PX)
  }

  function finish(commit: boolean) {
    clearTimer()
    setGhost(null)
    press.current.target = null
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
      setFeedback(describeBlockError(result.error))
      announce(describeBlockError(result.error))
      return
    }
    const label = slotLabel(result.block)
    setFeedback(current.error ? `Lì l'orario era occupato: il blocco è all'ultimo orario libero, ${label}.` : '')
    announce(`${result.block.title}: ora ${label}`)
  }

  return {
    drag,
    ghost,
    feedback,
    gridRef,
    scrollRef,
    suppressClick,
    press,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
  }
}
