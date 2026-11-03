'use client'

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type Dispatch,
  type ReactNode,
} from 'react'
import type { Note, NoteAction, NoteState } from './note-types'
import { generateRotation } from './note-utils'

const STORAGE_KEY = 'doodlelab:board:v2'

function loadFromStorage(): NoteState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { notes?: unknown; mode?: unknown }
    if (!Array.isArray(parsed.notes)) return null
    const mode = parsed.mode === 'grid' ? 'grid' : 'free'
    return { notes: parsed.notes as Note[], mode }
  } catch {
    return null
  }
}

function saveToStorage(state: NoteState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Storage full or unavailable — fail silently
  }
}

// ── Reducer ──────────────────────────────────────────────────────────────────

export function noteReducer(state: NoteState, action: NoteAction): NoteState {
  switch (action.type) {
    case 'ADD_NOTE': {
      const now: string = new Date().toISOString()
      const note: Note = {
        id:        crypto.randomUUID(),
        content:   '',
        color:     'yellow',
        rotation:  generateRotation(),
        position:  { xPct: 0.35, yPct: 0.35 },
        stickers:  [],
        pinned:    false,
        createdAt: now,
        updatedAt: now,
        ...action.payload,
      }
      return { ...state, notes: [...state.notes, note] }
    }

    case 'UPDATE_NOTE': {
      const { id, ...fields } = action.payload
      // Explicitly exclude position to enforce the invariant
      const { position: _, ...safeFields } = fields as typeof fields & { position?: unknown }
      return {
        ...state,
        notes: state.notes.map(n =>
          n.id === id
            ? { ...n, ...safeFields, updatedAt: new Date().toISOString() }
            : n
        ),
      }
    }

    case 'MOVE_NOTE': {
      const { id, xPct, yPct } = action.payload
      return {
        ...state,
        notes: state.notes.map(n =>
          n.id === id ? { ...n, position: { xPct, yPct } } : n
        ),
      }
    }

    case 'DELETE_NOTE':
      return {
        ...state,
        notes: state.notes.filter(n => n.id !== action.payload.id),
      }

    case 'TOGGLE_PIN':
      return {
        ...state,
        notes: state.notes.map(n =>
          n.id === action.payload.id ? { ...n, pinned: !n.pinned } : n
        ),
      }

    case 'SET_VIEW':
      // Only mode changes — notes are untouched
      return { ...state, mode: action.payload.mode }

    default:
      return state
  }
}

// ── Context ──────────────────────────────────────────────────────────────────

interface NoteContextValue {
  state:    NoteState
  dispatch: Dispatch<NoteAction>
}

const NoteContext = createContext<NoteContextValue | null>(null)

export function NoteProvider({
  children,
  initialNotes = [],
}: {
  children:      ReactNode
  initialNotes?: Note[]
}) {
  const seed: NoteState = { notes: initialNotes, mode: 'free' }
  const [state, dispatch] = useReducer(
    noteReducer,
    seed,
    (s) => loadFromStorage() ?? s,
  )

  // Persist to localStorage whenever state changes
  useEffect(() => {
    saveToStorage(state)
  }, [state])

  const value = useMemo(() => ({ state, dispatch }), [state, dispatch])
  return (
    <NoteContext.Provider value={value}>
      {children}
    </NoteContext.Provider>
  )
}

export function useNoteContext(): NoteContextValue {
  const ctx = useContext(NoteContext)
  if (!ctx) throw new Error('useNoteContext must be used inside NoteProvider')
  return ctx
}

/** Returns a single note by id, or undefined (e.g. after refresh). */
export function useNote(id: string): Note | undefined {
  const { state } = useNoteContext()
  return state.notes.find(n => n.id === id)
}
