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
import type { PostIt, PostItAction, PostItState } from './postit-types'
import { generateRotation } from './postit-utils'

const STORAGE_KEY = 'doodlelab:lavagna:v1'

function loadFromStorage(): PostItState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { notes?: unknown; mode?: unknown }
    if (!Array.isArray(parsed.notes)) return null
    const mode = parsed.mode === 'grid' ? 'grid' : 'free'
    return { notes: parsed.notes as PostIt[], mode }
  } catch {
    return null
  }
}

function saveToStorage(state: PostItState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Storage full or unavailable — fail silently
  }
}

// ── Reducer ──────────────────────────────────────────────────────────────────

export function postItReducer(state: PostItState, action: PostItAction): PostItState {
  switch (action.type) {
    case 'ADD_NOTE': {
      const now: string = new Date().toISOString()
      const note: PostIt = {
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

export interface PostItContextValue {
  state:    PostItState
  dispatch: Dispatch<PostItAction>
}

const PostItContext = createContext<PostItContextValue | null>(null)

export function PostItProvider({
  children,
  initialNotes = [],
}: {
  children:      ReactNode
  initialNotes?: PostIt[]
}) {
  const seed: PostItState = { notes: initialNotes, mode: 'free' }
  const [state, dispatch] = useReducer(
    postItReducer,
    seed,
    (s) => loadFromStorage() ?? s,
  )

  // Persist to localStorage whenever state changes
  useEffect(() => {
    saveToStorage(state)
  }, [state])

  const value = useMemo(() => ({ state, dispatch }), [state, dispatch])
  return (
    <PostItContext.Provider value={value}>
      {children}
    </PostItContext.Provider>
  )
}

export function usePostItContext(): PostItContextValue {
  const ctx = useContext(PostItContext)
  if (!ctx) throw new Error('usePostItContext must be used inside PostItProvider')
  return ctx
}

/** Returns a single note by id, or undefined (e.g. after refresh). */
export function usePostIt(id: string): PostIt | undefined {
  const { state } = usePostItContext()
  return state.notes.find(n => n.id === id)
}
