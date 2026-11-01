// components/oggi/QuickCapture.tsx
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
    <form className="oggi-capture" onSubmit={submit} aria-label="Cattura rapida">
      <label htmlFor="oggi-capture-input" className="sr-only">Cattura un pensiero</label>
      <div className="oggi-capture-field">
        <input
          id="oggi-capture-input"
          className="oggi-capture-input"
          data-draft
          value={text}
          onChange={e => { setText(e.target.value); if (status) setStatus('') }}
          placeholder="Cattura un pensiero..."
          autoComplete="off"
          aria-describedby="oggi-capture-status"
        />
        <button type="submit" className="oggi-capture-send" disabled={text.trim().length === 0}
                aria-label="Metti nell'Inbox">
          <SendIcon />
        </button>
      </div>
      <p id="oggi-capture-status" className="oggi-capture-status" role="status">
        {status || (count > 0 ? `${count} ${count === 1 ? 'pensiero' : 'pensieri'} nell'Inbox in questa sessione` : '')}
      </p>
    </form>
  )
}
