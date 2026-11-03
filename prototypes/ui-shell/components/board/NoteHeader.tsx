'use client'

import Link from 'next/link'
import { LOCALE } from '@/lib/constants'

interface NoteHeaderProps {
  lastEditedAt?: string   // ISO-8601 of most recent UPDATE_NOTE; undefined = never edited
}

export function NoteHeader({ lastEditedAt }: NoteHeaderProps) {
  let statusText = 'Bozza in memoria'
  if (lastEditedAt) {
    const d    = new Date(lastEditedAt)
    const time = d.toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit' })
    statusText = `In memoria · ${time}`
  }

  return (
    <header className="note-header" role="banner">
      <Link href="/board" replace className="note-back-btn" aria-label="Torna alla Lavagna">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M10 3L5 8L10 13" stroke="currentColor" strokeWidth="1.8"
            strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <span>Lavagna</span>
      </Link>
      <h1 className="note-title">Nota</h1>
      <span className="note-status" aria-live="polite">{statusText}</span>
    </header>
  )
}
