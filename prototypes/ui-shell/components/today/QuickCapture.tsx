// components/today/QuickCapture.tsx
'use client'

import { useState } from 'react'
import { getInboxRepository } from '@/lib/inbox/inbox-repository'
import { useRepository } from './shared'
import { SendIcon } from './icons'

/**
 * Two interactions: focus the field, press Enter. The thought goes to the
 * shared Inbox uncategorised - it never becomes a task, PostIt or diary
 * entry unless the user triages it later.
 */
export function QuickCapture() {
  const inbox = useRepository(getInboxRepository())
  const [text,   setText]   = useState('')
  const [status, setStatus] = useState('')
  const count = inbox.list().length

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const item = inbox.capture(text, 'oggi')
    if (!item) return
    setText('')
    setStatus("Messo nell'Inbox. Lo sistemi quando vuoi.")
  }

  return (
    <form className="today-capture" onSubmit={submit} aria-label="Cattura rapida">
      <label htmlFor="today-capture-input" className="sr-only">Cattura un pensiero</label>
      <div className="today-capture-field">
        <input
          id="today-capture-input"
          className="today-capture-input"
          data-draft
          value={text}
          onChange={e => { setText(e.target.value); if (status) setStatus('') }}
          placeholder="Cattura un pensiero..."
          autoComplete="off"
          aria-describedby="today-capture-status"
        />
        <button type="submit" className="today-capture-send" disabled={text.trim().length === 0}
                aria-label="Metti nell'Inbox">
          <SendIcon />
        </button>
      </div>
      <p id="today-capture-status" className="today-capture-status" role="status">
        {status || (count > 0 ? `${count} ${count === 1 ? 'pensiero' : 'pensieri'} nell'Inbox in questa sessione` : '')}
      </p>
    </form>
  )
}
