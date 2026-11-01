'use client'

import Link from 'next/link'

interface NotaHeaderProps {
  lastEditedAt?: string   // ISO-8601 of most recent UPDATE_NOTE; undefined = never edited
}

export function NotaHeader({ lastEditedAt }: NotaHeaderProps) {
  let statusText = 'Bozza in memoria'
  if (lastEditedAt) {
    const d    = new Date(lastEditedAt)
    const time = d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
    statusText = `In memoria · ${time}`
  }

  return (
    <header className="nota-header" role="banner">
      <Link href="/lavagna" replace className="nota-back-btn" aria-label="Torna alla Lavagna">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M10 3L5 8L10 13" stroke="currentColor" strokeWidth="1.8"
            strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <span>Lavagna</span>
      </Link>
      <h1 className="nota-title">Nota</h1>
      <span className="nota-status" aria-live="polite">{statusText}</span>
    </header>
  )
}
