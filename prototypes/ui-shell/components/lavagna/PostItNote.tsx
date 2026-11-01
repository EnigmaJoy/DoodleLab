'use client'

import { useRef, useState, useCallback, useLayoutEffect, type RefObject } from 'react'
import { useRouter } from 'next/navigation'
import type { PostIt, ViewMode } from '@/lib/postit-types'
import { POST_IT_COLORS, STICKER_CONFIG, pctToPx, pxToPct } from '@/lib/postit-utils'
import { useDrag } from './useDrag'

interface PostItNoteProps {
  note:         PostIt
  boardRef:     RefObject<HTMLDivElement | null>
  boardSize:    { w: number; h: number }
  mode:         ViewMode
  onMoveCommit: (id: string, xPct: number, yPct: number) => void
}

const KEYBOARD_STEP    = 10   // px per arrow key press
const KEYBOARD_STEP_LG = 50   // px per Shift+arrow key press

export function PostItNote({ note, boardRef, boardSize, mode, onMoveCommit }: PostItNoteProps) {
  const router  = useRouter()
  const noteRef = useRef<HTMLDivElement>(null)
  const bg      = POST_IT_COLORS[note.color]

  // Measure actual note dimensions — consistent with render-time clamping
  const [noteSize, setNoteSize] = useState({ w: 0, h: 0 })
  useLayoutEffect(() => {
    const el = noteRef.current
    if (!el) return
    const ro = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect
      setNoteSize({ w: width, h: height })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const handleTap = useCallback(() => {
    router.push(`/lavagna/${note.id}`)
  }, [router, note.id])

  // enabled=true in free mode only — Grid mode disables drag entirely
  const { isDragging } = useDrag({
    noteId:       note.id,
    xPct:         note.position.xPct,
    yPct:         note.position.yPct,
    rotation:     note.rotation,
    noteRef,
    boardRef,
    enabled:      mode === 'free',
    onMoveCommit,
    onTap:        handleTap,
  })

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    // Navigate on Enter/Space
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      router.push(`/lavagna/${note.id}`)
      return
    }

    // Arrow-key repositioning (free mode only)
    if (mode !== 'free') return
    const isArrow = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)
    if (!isArrow) return

    e.preventDefault()
    const board = boardRef.current
    if (!board) return

    const boardW = board.offsetWidth
    const boardH = board.offsetHeight
    const noteEl = noteRef.current
    const noteW  = noteEl?.offsetWidth  ?? 0
    const noteH  = noteEl?.offsetHeight ?? 0
    const step   = e.shiftKey ? KEYBOARD_STEP_LG : KEYBOARD_STEP

    let newXpx = pctToPx(note.position.xPct, boardW)
    let newYpx = pctToPx(note.position.yPct, boardH)

    if (e.key === 'ArrowRight') newXpx += step
    if (e.key === 'ArrowLeft')  newXpx -= step
    if (e.key === 'ArrowDown')  newYpx += step
    if (e.key === 'ArrowUp')    newYpx -= step

    newXpx = Math.max(0, Math.min(newXpx, boardW - noteW))
    newYpx = Math.max(0, Math.min(newYpx, boardH - noteH))

    onMoveCommit(note.id, pxToPct(newXpx, boardW), pxToPct(newYpx, boardH))
  }

  // Render-time clamping — uses measured noteSize, display only, stored pct NEVER mutated.
  const noteW = noteSize.w
  const noteH = noteSize.h
  const clampedLeft = boardSize.w > 0 && noteW > 0
    ? Math.max(0, Math.min(note.position.xPct * boardSize.w, boardSize.w - noteW))
    : note.position.xPct * (boardSize.w || 1)
  const clampedTop = boardSize.h > 0 && noteH > 0
    ? Math.max(0, Math.min(note.position.yPct * boardSize.h, boardSize.h - noteH))
    : note.position.yPct * (boardSize.h || 1)

  // Free mode: absolute positioned. left/top as % so drag can override with px then restore.
  // Rotation in transform only — never mixed with translation.
  const freeStyle: React.CSSProperties = {
    backgroundColor: bg,
    left:            boardSize.w > 0 ? `${(clampedLeft / boardSize.w) * 100}%` : `${note.position.xPct * 100}%`,
    top:             boardSize.h > 0 ? `${(clampedTop  / boardSize.h) * 100}%` : `${note.position.yPct * 100}%`,
    transform:       `rotate(${note.rotation}deg)`,
  }

  const gridStyle: React.CSSProperties = {
    backgroundColor: bg,
  }

  return (
    <div
      ref={noteRef}
      className={[
        'postit',
        mode === 'grid' ? 'postit--grid' : '',
        isDragging ? 'postit--dragging' : '',
      ].filter(Boolean).join(' ')}
      style={mode === 'free' ? freeStyle : gridStyle}
      role="button"
      tabIndex={0}
      aria-label={`Post-it: ${note.content.slice(0, 40) || 'vuoto'}. Usa le frecce per spostarlo, Invio per aprirlo.`}
      aria-grabbed={isDragging}
      // Free mode: navigation via useDrag.onTap (no onClick — prevents double-fire)
      // Grid mode: direct click navigates; useDrag is disabled (enabled=false)
      onClick={mode === 'grid' ? () => router.push(`/lavagna/${note.id}`) : undefined}
      onKeyDown={handleKeyDown}
    >
      <div className="postit-content">{note.content || <em style={{ opacity: 0.4 }}>Tocca per aggiungere testo</em>}</div>

      {note.stickers.length > 0 && (
        <div className="postit-stickers" aria-hidden="true">
          {note.stickers.map((key, i) => (
            <span
              key={i}
              className="postit-sticker"
              style={{ background: STICKER_CONFIG[key].bg }}
            >
              {STICKER_CONFIG[key].emoji}
            </span>
          ))}
        </div>
      )}

      {note.dueDate && (
        <div className="postit-date">
          {new Date(note.dueDate).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}
        </div>
      )}
    </div>
  )
}
