'use client'

import { useRef, useState, useEffect, useCallback } from 'react'
import { usePostItContext } from '@/lib/postit-context'
import { LavagnaHeader }   from './LavagnaHeader'
import { PostItNote }      from './PostItNote'
import type { PostItColor } from '@/lib/postit-types'

const COLORS: PostItColor[] = ['yellow', 'pink', 'mint', 'blue', 'peach']

export function LavagnaBoard() {
  const { state, dispatch } = usePostItContext()
  const boardRef  = useRef<HTMLDivElement>(null)
  const [boardSize, setBoardSize] = useState({ w: 0, h: 0 })

  // Track board dimensions so PostItNote can clamp at render time.
  useEffect(() => {
    const board = boardRef.current
    if (!board) return
    const ro = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect
      setBoardSize({ w: width, h: height })
    })
    ro.observe(board)
    return () => ro.disconnect()
  }, [])

  const handleAddNote = useCallback(() => {
    const color = COLORS[Math.floor(Math.random() * COLORS.length)]
    dispatch({
      type: 'ADD_NOTE',
      payload: {
        content:  '',
        color,
        position: { xPct: 0.35 + (Math.random() * 0.1), yPct: 0.35 + (Math.random() * 0.1) },
      },
    })
  }, [dispatch])

  const handleMoveCommit = useCallback((id: string, xPct: number, yPct: number) => {
    dispatch({ type: 'MOVE_NOTE', payload: { id, xPct, yPct } })
  }, [dispatch])

  const handleModeChange = useCallback((mode: 'free' | 'grid') => {
    dispatch({ type: 'SET_VIEW', payload: { mode } })
  }, [dispatch])

  return (
    <main className="lavagna-screen">
      <LavagnaHeader
        noteCount={state.notes.length}
        mode={state.mode}
        onModeChange={handleModeChange}
        onAddNote={handleAddNote}
      />
      <div className="lavagna-board-wrap">
        <div
          ref={boardRef}
          className="lavagna-board"
          role="application"
          aria-label="Lavagna — bacheca post-it. Usa le frecce per spostare le note, Invio per aprirle."
        >
          {state.mode === 'free' ? (
            state.notes.map(note => (
              <PostItNote
                key={note.id}
                note={note}
                boardRef={boardRef}
                boardSize={boardSize}
                mode="free"
                onMoveCommit={handleMoveCommit}
              />
            ))
          ) : (
            <div className="lavagna-grid-mode">
              {state.notes.map(note => (
                <PostItNote
                  key={note.id}
                  note={note}
                  boardRef={boardRef}
                  boardSize={boardSize}
                  mode="grid"
                  onMoveCommit={handleMoveCommit}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
