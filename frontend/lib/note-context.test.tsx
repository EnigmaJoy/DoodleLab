// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { ReactNode } from 'react'
import type { StorageAdapter } from './storage/storage-adapter'

// ── Mock getStorageAdapter ────────────────────────────────────────────────────

const mockAdapter: StorageAdapter = {
  read:   vi.fn(),
  write:  vi.fn(),
  remove: vi.fn(),
}

vi.mock('@/lib/store', () => ({
  getStorageAdapter: () => mockAdapter,
}))

// Import after mocks
import { NoteProvider, useNoteContext } from './note-context'

// ── Helpers ───────────────────────────────────────────────────────────────────

function wrapper({ children }: { children: ReactNode }) {
  return <NoteProvider>{children}</NoteProvider>
}

const STORAGE_KEY = 'doodlelab:board:v2'

// ── Tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
})

describe('NoteProvider — initialization', () => {
  it('reads from storage on mount when data is present', () => {
    const stored = JSON.stringify({
      notes: [
        {
          id: 'note-1',
          content: 'Hello',
          color: 'yellow',
          rotation: 0,
          position: { xPct: 0.5, yPct: 0.5 },
          stickers: [],
          pinned: false,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      mode: 'free',
    })
    vi.mocked(mockAdapter.read).mockReturnValue(stored)

    const { result } = renderHook(() => useNoteContext(), { wrapper })

    expect(mockAdapter.read).toHaveBeenCalledWith(STORAGE_KEY)
    expect(result.current.state.notes).toHaveLength(1)
    expect(result.current.state.notes[0].content).toBe('Hello')
  })

  it('starts with empty notes when storage returns null', () => {
    vi.mocked(mockAdapter.read).mockReturnValue(null)

    const { result } = renderHook(() => useNoteContext(), { wrapper })

    expect(mockAdapter.read).toHaveBeenCalledWith(STORAGE_KEY)
    expect(result.current.state.notes).toHaveLength(0)
  })

  it('starts with empty notes when stored JSON is malformed', () => {
    vi.mocked(mockAdapter.read).mockReturnValue('not-valid-json{{{')

    const { result } = renderHook(() => useNoteContext(), { wrapper })

    expect(result.current.state.notes).toHaveLength(0)
  })
})

describe('NoteProvider — adding a note', () => {
  it('writes updated state to storage after ADD_NOTE', async () => {
    vi.mocked(mockAdapter.read).mockReturnValue(null)

    const { result } = renderHook(() => useNoteContext(), { wrapper })

    await act(async () => {
      result.current.dispatch({ type: 'ADD_NOTE', payload: { content: 'New note' } })
    })

    expect(mockAdapter.write).toHaveBeenCalledWith(
      STORAGE_KEY,
      expect.stringContaining('New note'),
    )
  })

  it('write call includes all notes after multiple additions', async () => {
    vi.mocked(mockAdapter.read).mockReturnValue(null)

    const { result } = renderHook(() => useNoteContext(), { wrapper })

    await act(async () => {
      result.current.dispatch({ type: 'ADD_NOTE', payload: { content: 'First' } })
    })
    await act(async () => {
      result.current.dispatch({ type: 'ADD_NOTE', payload: { content: 'Second' } })
    })

    const lastCall = vi.mocked(mockAdapter.write).mock.calls.at(-1)!
    const saved = JSON.parse(lastCall[1])
    expect(saved.notes).toHaveLength(2)
  })
})

describe('NoteProvider — removing a note', () => {
  it('writes updated state to storage after DELETE_NOTE', async () => {
    const existingNote = {
      id: 'note-abc',
      content: 'To delete',
      color: 'pink',
      rotation: 0,
      position: { xPct: 0.5, yPct: 0.5 },
      stickers: [],
      pinned: false,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    }
    vi.mocked(mockAdapter.read).mockReturnValue(
      JSON.stringify({ notes: [existingNote], mode: 'free' }),
    )

    const { result } = renderHook(() => useNoteContext(), { wrapper })

    await act(async () => {
      result.current.dispatch({ type: 'DELETE_NOTE', payload: { id: 'note-abc' } })
    })

    const lastCall = vi.mocked(mockAdapter.write).mock.calls.at(-1)!
    const saved = JSON.parse(lastCall[1])
    expect(saved.notes).toHaveLength(0)
  })
})

describe('useNoteContext', () => {
  it('throws when called outside NoteProvider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    expect(() => renderHook(() => useNoteContext())).toThrow()
    spy.mockRestore()
  })
})
