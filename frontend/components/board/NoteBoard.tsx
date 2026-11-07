'use client'

import { useRef, useState, useEffect, useCallback } from 'react'
import { useRouter }     from 'next/navigation'
import { useNoteContext } from '@/lib/note-context'
import { AppHeader }     from '@/design-system/AppHeader'
import { StickyNote }    from './StickyNote'
import type { NoteColor } from '@/lib/note-types'

const COLORS: NoteColor[] = ['yellow', 'pink', 'mint', 'blue', 'peach']

export function NoteBoard() {
  const router = useRouter()
  const { state, dispatch } = useNoteContext()
  const boardRef  = useRef<HTMLDivElement>(null)
  const [boardSize, setBoardSize] = useState({ w: 0, h: 0 })

  // Track board dimensions so StickyNote can clamp at render time.
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
    <div className="board-screen">
      <AppHeader
        returnVariant="menu"
        onMenuOpen={() => router.push('/?view=menu')}
        title="Lavagna"
        subtitle={`${state.notes.length} post-it`}
        subtitleLive={true}
        viewControl={{
          kind:     'segmented',
          options:  [
            { value: 'free',  label: 'Libera' },
            { value: 'grid',  label: 'Griglia' },
          ],
          value:    state.mode,
          onChange: (v) => handleModeChange(v as 'free' | 'grid'),
        }}
        actions={[{
          kind:  'icon',
          label: 'Aggiungi post-it',
          icon:  (
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5"  y1="12" x2="19" y2="12" />
            </svg>
          ),
          onClick: handleAddNote,
        }]}
      />
      <main className="board-board-wrap">
        <div
          ref={boardRef}
          className="board-board"
          role="application"
          aria-label="Lavagna — bacheca post-it. Usa le frecce per spostare le note, Invio per aprirle."
        >
          {state.mode === 'free' ? (
            state.notes.map(note => (
              <StickyNote
                key={note.id}
                note={note}
                boardRef={boardRef}
                boardSize={boardSize}
                mode="free"
                onMoveCommit={handleMoveCommit}
              />
            ))
          ) : (
            <div className="board-grid-mode">
              {state.notes.map(note => (
                <StickyNote
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
      </main>
    </div>
  )
}
