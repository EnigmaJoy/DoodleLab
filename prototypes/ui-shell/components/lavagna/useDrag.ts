// components/lavagna/useDrag.ts
'use client'

import { useRef, useState, useEffect } from 'react'
import { pxToPct } from '@/lib/postit-utils'
import type { RefObject } from 'react'

const DRAG_THRESHOLD_PX = 4

export interface UseDragParams {
  noteId:       string
  xPct:         number
  yPct:         number
  rotation:     number
  noteRef:      RefObject<HTMLDivElement | null>
  boardRef:     RefObject<HTMLDivElement | null>
  enabled:      boolean  // false in Grid mode — all pointer events are no-ops
  onMoveCommit: (id: string, xPct: number, yPct: number) => void
  onTap:        () => void
}

export interface UseDragReturn {
  isDragging: boolean
}

export function useDrag({
  noteId,
  xPct,
  yPct,
  rotation,
  noteRef,
  boardRef,
  enabled,
  onMoveCommit,
  onTap,
}: UseDragParams): UseDragReturn {
  const [isDragging, setIsDragging] = useState(false)

  // Keep latest props accessible in stable event handlers without re-attaching listeners.
  const propsRef = useRef({ noteId, xPct, yPct, rotation, enabled, onMoveCommit, onTap })
  useEffect(() => {
    propsRef.current = { noteId, xPct, yPct, rotation, enabled, onMoveCommit, onTap }
  })

  useEffect(() => {
    const note  = noteRef.current
    const board = boardRef.current
    if (!note || !board) return

    // Per-drag mutable state — local variables inside the closure.
    let active       = false
    let started      = false
    let pointerId    = -1
    let startPX      = 0
    let startPY      = 0
    let startNoteXpx = 0
    let startNoteYpx = 0
    let lastXpx      = 0
    let lastYpx      = 0
    let noteW        = 0
    let noteH        = 0

    function getBoardRect() {
      return boardRef.current?.getBoundingClientRect() ?? null
    }

    /** Overrides inline left/top with px values for smooth drag. */
    function applyDragPosition(xpx: number, ypx: number) {
      note!.style.left = `${xpx}px`
      note!.style.top  = `${ypx}px`
    }

    /**
     * Explicitly restores inline left/top to the pre-drag pct-based position.
     * Called on cancel/lostpointercapture/unmount/Escape.
     *
     * WHY NOT note.style.left = '':
     *   Clearing the inline style removes the React-set percentage value.
     *   The element then falls back to the CSS class rule (.postit { top: 0; left: 0 }),
     *   causing the note to jump to the top-left corner until the next React render.
     *   There is no guarantee a render will follow (no state change on cancel).
     *
     * WHY this works:
     *   We compute the same clamped pct that PostItNote would render, and set it
     *   as an explicit inline style. React's next render will write the same value —
     *   no visual change, no jump.
     */
    function restorePosition() {
      const boardW = board!.offsetWidth
      const boardH = board!.offsetHeight
      const noteW  = note!.offsetWidth
      const noteH  = note!.offsetHeight
      const maxX   = Math.max(0, boardW - noteW)
      const maxY   = Math.max(0, boardH - noteH)
      const clampedXpx = Math.max(0, Math.min(propsRef.current.xPct * boardW, maxX))
      const clampedYpx = Math.max(0, Math.min(propsRef.current.yPct * boardH, maxY))
      note!.style.left = boardW > 0 ? `${(clampedXpx / boardW) * 100}%` : `${propsRef.current.xPct * 100}%`
      note!.style.top  = boardH > 0 ? `${(clampedYpx / boardH) * 100}%` : `${propsRef.current.yPct * 100}%`
    }

    function onMove(e: PointerEvent) {
      if (!active || e.pointerId !== pointerId) return
      const boardRect = getBoardRect()
      if (!boardRect) return

      const boardW = boardRect.width
      const boardH = boardRect.height
      const dx     = e.clientX - startPX
      const dy     = e.clientY - startPY

      if (!started && Math.hypot(dx, dy) > DRAG_THRESHOLD_PX) {
        started = true
        setIsDragging(true)
        note!.classList.add('postit--dragging')
      }
      if (!started) return

      const newXpx = Math.max(0, Math.min(startNoteXpx + dx, boardW - noteW))
      const newYpx = Math.max(0, Math.min(startNoteYpx + dy, boardH - noteH))
      lastXpx      = newXpx
      lastYpx      = newYpx
      applyDragPosition(newXpx, newYpx)
    }

    function onUp(e: PointerEvent) {
      if (!active || e.pointerId !== pointerId) return
      const wasStarted = started
      cleanup(false)

      if (wasStarted) {
        const boardW = board!.offsetWidth
        const boardH = board!.offsetHeight
        propsRef.current.onMoveCommit(
          propsRef.current.noteId,
          pxToPct(lastXpx, boardW),
          pxToPct(lastYpx, boardH),
        )
        // DO NOT clearDragPosition() here.
        // React's reconciliation will replace e.g. 'left: 400px' with 'left: 50%'
        // (numerically equivalent on the same board width) — no visual jump.
        // Clearing before reconciliation would cause a brief flash.
      } else {
        // No movement past threshold — treat as tap.
        propsRef.current.onTap()
      }
    }

    function onCancelOrLost(e: PointerEvent) {
      if (!active || e.pointerId !== pointerId) return
      cleanup(true)  // true = restore to pre-drag pct position
    }

    function cleanup(restore: boolean) {
      if (restore) {
        restorePosition()  // Explicitly set pct inline style — do NOT clear to ''
      }
      if (active && pointerId !== -1) {
        try { note!.releasePointerCapture(pointerId) } catch (_) { /* already released */ }
      }
      active    = false
      started   = false
      pointerId = -1
      note!.classList.remove('postit--dragging')
      setIsDragging(false)
    }

    // Escape key cancels an active drag — same semantics as pointercancel.
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && active) {
        cleanup(true)
      }
    }

    function onDown(e: PointerEvent) {
      // Grid mode: no-op (enabled is checked on every event via propsRef so switching
      // modes during a live drag also cancels correctly)
      if (!propsRef.current.enabled) return

      e.preventDefault()

      noteW = note!.offsetWidth
      noteH = note!.offsetHeight
      // Use board.offsetWidth/Height — board is never rotated so these are reliable.
      const boardW = board!.offsetWidth
      const boardH = board!.offsetHeight

      // Derive start position from stored state — avoids rotation-induced drift.
      // NEVER use note.getBoundingClientRect() here: a rotated note's rect is
      // in rotated coordinates and will cause the note to jump on first move.
      const maxX   = boardW - noteW
      const maxY   = boardH - noteH
      startNoteXpx = Math.max(0, Math.min(propsRef.current.xPct * boardW, maxX))
      startNoteYpx = Math.max(0, Math.min(propsRef.current.yPct * boardH, maxY))
      lastXpx      = startNoteXpx
      lastYpx      = startNoteYpx

      active    = true
      started   = false
      pointerId = e.pointerId
      startPX   = e.clientX
      startPY   = e.clientY

      note!.setPointerCapture(e.pointerId)
    }

    note!.addEventListener('pointerdown',        onDown,          { passive: false })
    note!.addEventListener('pointermove',        onMove)
    note!.addEventListener('pointerup',          onUp)
    note!.addEventListener('pointercancel',      onCancelOrLost)
    note!.addEventListener('lostpointercapture', onCancelOrLost)
    // Tab-switch / window blur causes lostpointercapture — no separate listener needed.
    // Escape key is a separate cancel path that does not require pointer capture.
    document.addEventListener('keydown', onKeyDown)

    return () => {
      note!.removeEventListener('pointerdown',        onDown)
      note!.removeEventListener('pointermove',        onMove)
      note!.removeEventListener('pointerup',          onUp)
      note!.removeEventListener('pointercancel',      onCancelOrLost)
      note!.removeEventListener('lostpointercapture', onCancelOrLost)
      document.removeEventListener('keydown',        onKeyDown)

      // If unmounted during a drag, restore position without committing.
      if (active) {
        restorePosition()          // explicit pct — do NOT set style to ''
        note!.classList.remove('postit--dragging')
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteRef, boardRef])  // Refs are stable; event handlers access latest props via propsRef.

  return { isDragging }
}
