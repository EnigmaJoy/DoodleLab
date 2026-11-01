// components/lavagna/LavagnaHeader.tsx
'use client'

import Link from 'next/link'
import type { ViewMode } from '@/lib/postit-types'

interface LavagnaHeaderProps {
  noteCount:    number
  mode:         ViewMode
  onModeChange: (mode: ViewMode) => void
  onAddNote:    () => void
}

export function LavagnaHeader({ noteCount, mode, onModeChange, onAddNote }: LavagnaHeaderProps) {
  return (
    <header className="lavagna-header" role="banner">
      <div className="lavagna-header-left">
        <Link href="/?view=menu" replace className="lavagna-back-btn" aria-label="Torna al menu">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M10 3L5 8L10 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </Link>
        <h1 className="lavagna-title">Lavagna</h1>
        <span className="lavagna-count" aria-live="polite">
          {noteCount} post-it
        </span>
      </div>

      <div className="lavagna-header-right">
        <div className="lavagna-toggle" role="group" aria-label="Modalità visualizzazione">
          <button
            className="lavagna-toggle-btn"
            aria-pressed={mode === 'free'}
            onClick={() => onModeChange('free')}
          >
            Libera
          </button>
          <button
            className="lavagna-toggle-btn"
            aria-pressed={mode === 'grid'}
            onClick={() => onModeChange('grid')}
          >
            Griglia
          </button>
        </div>

        <button
          className="lavagna-icon-btn"
          aria-label="Disegna (non ancora disponibile)"
          title="Disegna (non ancora disponibile)"
          disabled
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
            <path d="M3 15L6 14L14.5 5.5C15.3 4.7 15.3 3.3 14.5 2.5C13.7 1.7 12.3 1.7 11.5 2.5L3 11V15Z"
              stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
          </svg>
        </button>

        <button className="lavagna-add-btn" onClick={onAddNote} aria-label="Aggiungi post-it">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          <span className="lavagna-add-label">Post-it</span>
        </button>
      </div>
    </header>
  )
}
