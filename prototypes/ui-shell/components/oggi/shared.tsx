// components/oggi/shared.tsx
'use client'

import {
  createContext, useContext, useEffect, useId, useRef, useState, useSyncExternalStore,
} from 'react'
import { ChevronIcon } from './icons'

// --- Repository subscription ------------------------------------------------

interface Observable {
  subscribe(listener: () => void): () => void
  getVersion(): number
}

/** Re-renders the caller whenever the repository changes */
export function useRepository<T extends Observable>(repo: T): T {
  useSyncExternalStore(repo.subscribe, repo.getVersion, repo.getVersion)
  return repo
}

// --- Screen-reader announcements --------------------------------------------

export const AnnounceContext = createContext<(message: string) => void>(() => {})
export const useAnnounce = () => useContext(AnnounceContext)

// --- Expandable panel -------------------------------------------------------

// Panel open/closed state is a UI preference (not private content), so it
// may live in sessionStorage. Unavailable storage falls back to defaults.
const PANEL_STORAGE_KEY = 'oggi.panels'

function readPanelState(): Record<string, boolean> {
  try {
    return JSON.parse(sessionStorage.getItem(PANEL_STORAGE_KEY) ?? '{}')
  } catch {
    return {}
  }
}

function writePanelState(id: string, open: boolean) {
  try {
    sessionStorage.setItem(PANEL_STORAGE_KEY, JSON.stringify({ ...readPanelState(), [id]: open }))
  } catch {
    // Storage blocked: state simply is not remembered
  }
}

const OPEN_PANEL_EVENT = 'oggi:open-panel'

/** Expands a panel from elsewhere in Oggi (e.g. the timer after "Avvia timer") */
export function openPanel(id: string) {
  window.dispatchEvent(new CustomEvent(OPEN_PANEL_EVENT, { detail: id }))
}

interface PanelProps {
  id:        string
  title:     string
  icon:      React.ReactNode
  hint?:     string
  children:  React.ReactNode
}

/**
 * Collapsible panel. Content stays mounted while collapsed (hidden), so a
 * running timer or an unsaved draft is never discarded by closing it.
 */
export function ExpandablePanel({ id, title, icon, hint, children }: PanelProps) {
  const [open, setOpen] = useState(false)
  const contentId = useId()

  useEffect(() => {
    setOpen(readPanelState()[id] ?? false)
    const onOpen = (e: Event) => {
      if ((e as CustomEvent<string>).detail !== id) return
      setOpen(true)
      writePanelState(id, true)
    }
    window.addEventListener(OPEN_PANEL_EVENT, onOpen)
    return () => window.removeEventListener(OPEN_PANEL_EVENT, onOpen)
  }, [id])

  function toggle() {
    setOpen(prev => {
      writePanelState(id, !prev)
      return !prev
    })
  }

  return (
    <section className="oggi-card oggi-panel" data-open={open || undefined}>
      <h3 className="oggi-panel-heading">
        <button
          type="button"
          className="oggi-panel-toggle"
          aria-expanded={open}
          aria-controls={contentId}
          onClick={toggle}
        >
          <span className="oggi-panel-icon">{icon}</span>
          <span className="oggi-panel-title">{title}</span>
          {hint && <span className="oggi-panel-hint">{hint}</span>}
          <span className="oggi-panel-chevron"><ChevronIcon /></span>
        </button>
      </h3>
      <div id={contentId} className="oggi-panel-body" hidden={!open}>
        {children}
      </div>
    </section>
  )
}

// --- Two-step confirmation for destructive actions --------------------------

interface ConfirmActionProps {
  label:        string
  question:     string
  confirmLabel: string
  onConfirm:    () => void
}

export function ConfirmAction({ label, question, confirmLabel, onConfirm }: ConfirmActionProps) {
  const [asking, setAsking] = useState(false)
  if (!asking) {
    return (
      <button type="button" className="oggi-text-btn oggi-text-btn--danger" onClick={() => setAsking(true)}>
        {label}
      </button>
    )
  }
  return (
    <span className="oggi-confirm" role="group" aria-label={question}>
      <span className="oggi-confirm-question">{question}</span>
      <button type="button" className="oggi-text-btn oggi-text-btn--danger" onClick={onConfirm}>
        {confirmLabel}
      </button>
      {/* Safe default: focus lands on Annulla */}
      <button type="button" className="oggi-text-btn" onClick={() => setAsking(false)} autoFocus>
        Annulla
      </button>
    </span>
  )
}

// --- Native modal dialog ----------------------------------------------------

/** Opens a native modal <dialog> on mount (focus trap, Escape, focus return, [data-autofocus]) */
export function useModal(onClose: () => void) {
  const ref        = useRef<HTMLDialogElement>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    dialog.showModal()
    // showModal() focuses the first focusable element (the close button) and
    // ignores React's autoFocus; an explicit [data-autofocus] field wins
    dialog.querySelector<HTMLElement>('[data-autofocus]')?.focus()
    // 'close' is dispatched asynchronously: a stale event from an earlier
    // close() (e.g. Strict Mode effect replay) must not close a reopened dialog
    const handleClose = () => { if (!dialog.open) onCloseRef.current() }
    dialog.addEventListener('close', handleClose)
    return () => {
      dialog.removeEventListener('close', handleClose)
      if (dialog.open) dialog.close()
    }
  }, [])
  return ref
}
