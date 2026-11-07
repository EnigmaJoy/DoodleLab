import { describe, it, expect } from 'vitest'
import { noteReducer } from '@/lib/note-context'
import type { NoteState, Note, NoteAction } from '@/lib/note-types'

function makeState(overrides?: Partial<NoteState>): NoteState {
  return {
    notes: [
      {
        id: 'note-1',
        content: 'Test note',
        color: 'yellow',
        rotation: -1,
        position: { xPct: 0.3, yPct: 0.4 },
        stickers: [],
        pinned: false,
        createdAt: '2026-10-01T10:00:00.000Z',
        updatedAt: '2026-10-01T10:00:00.000Z',
      },
    ],
    mode: 'free',
    ...overrides,
  }
}

describe('ADD_NOTE', () => {
  it('adds a note with a generated id', () => {
    const state = makeState({ notes: [] })
    const next = noteReducer(state, { type: 'ADD_NOTE', payload: { content: 'Hello' } })
    expect(next.notes).toHaveLength(1)
    expect(next.notes[0].id).toBeTruthy()
    expect(next.notes[0].content).toBe('Hello')
  })
  it('assigns rotation in [-3, 3]', () => {
    const state = makeState({ notes: [] })
    const next = noteReducer(state, { type: 'ADD_NOTE', payload: {} })
    expect(next.notes[0].rotation).toBeGreaterThanOrEqual(-3)
    expect(next.notes[0].rotation).toBeLessThanOrEqual(3)
  })
  it('assigns position with xPct and yPct in [0, 1]', () => {
    const state = makeState({ notes: [] })
    const next = noteReducer(state, { type: 'ADD_NOTE', payload: {} })
    const { xPct, yPct } = next.notes[0].position
    expect(xPct).toBeGreaterThanOrEqual(0)
    expect(xPct).toBeLessThanOrEqual(1)
    expect(yPct).toBeGreaterThanOrEqual(0)
    expect(yPct).toBeLessThanOrEqual(1)
  })
})

describe('UPDATE_NOTE', () => {
  it('updates content and updatedAt, leaves position untouched', () => {
    const state = makeState()
    const originalPos = state.notes[0].position
    const next = noteReducer(state, {
      type: 'UPDATE_NOTE',
      payload: { id: 'note-1', content: 'Updated' },
    })
    expect(next.notes[0].content).toBe('Updated')
    expect(next.notes[0].position).toEqual(originalPos)
  })
  it('updates color without touching position', () => {
    const state = makeState()
    const originalPos = state.notes[0].position
    const next = noteReducer(state, {
      type: 'UPDATE_NOTE',
      payload: { id: 'note-1', color: 'mint' },
    })
    expect(next.notes[0].color).toBe('mint')
    expect(next.notes[0].position).toEqual(originalPos)
  })
  it('does not modify notes with a different id', () => {
    const state = makeState()
    const next = noteReducer(state, {
      type: 'UPDATE_NOTE',
      payload: { id: 'other-id', content: 'Changed' },
    })
    expect(next.notes[0].content).toBe('Test note')
  })
})

describe('MOVE_NOTE', () => {
  it('updates only position', () => {
    const state = makeState()
    const next = noteReducer(state, {
      type: 'MOVE_NOTE',
      payload: { id: 'note-1', xPct: 0.8, yPct: 0.9 },
    })
    expect(next.notes[0].position).toEqual({ xPct: 0.8, yPct: 0.9 })
    expect(next.notes[0].content).toBe('Test note')
    expect(next.notes[0].color).toBe('yellow')
    expect(next.notes[0].rotation).toBe(-1)
  })
  it('MOVE_NOTE then UPDATE_NOTE: position is preserved from MOVE_NOTE', () => {
    const state = makeState()
    const after = noteReducer(state, {
      type: 'MOVE_NOTE', payload: { id: 'note-1', xPct: 0.7, yPct: 0.8 },
    })
    const final = noteReducer(after, {
      type: 'UPDATE_NOTE', payload: { id: 'note-1', content: 'New content' },
    })
    expect(final.notes[0].position).toEqual({ xPct: 0.7, yPct: 0.8 })
    expect(final.notes[0].content).toBe('New content')
  })
  it('UPDATE_NOTE then MOVE_NOTE: content is preserved from UPDATE_NOTE', () => {
    const state = makeState()
    const after = noteReducer(state, {
      type: 'UPDATE_NOTE', payload: { id: 'note-1', content: 'Edited' },
    })
    const final = noteReducer(after, {
      type: 'MOVE_NOTE', payload: { id: 'note-1', xPct: 0.2, yPct: 0.3 },
    })
    expect(final.notes[0].content).toBe('Edited')
    expect(final.notes[0].position).toEqual({ xPct: 0.2, yPct: 0.3 })
  })
})

describe('DELETE_NOTE', () => {
  it('removes the target note', () => {
    const state = makeState()
    const next = noteReducer(state, { type: 'DELETE_NOTE', payload: { id: 'note-1' } })
    expect(next.notes).toHaveLength(0)
  })
  it('does not remove unrelated notes', () => {
    const state: NoteState = {
      notes: [
        { id: 'a', content: 'A', color: 'yellow', rotation: 0,
          position: { xPct: 0.1, yPct: 0.1 }, stickers: [], pinned: false,
          createdAt: '', updatedAt: '' },
        { id: 'b', content: 'B', color: 'mint', rotation: 0,
          position: { xPct: 0.5, yPct: 0.5 }, stickers: [], pinned: false,
          createdAt: '', updatedAt: '' },
      ],
      mode: 'free',
    }
    const next = noteReducer(state, { type: 'DELETE_NOTE', payload: { id: 'a' } })
    expect(next.notes).toHaveLength(1)
    expect(next.notes[0].id).toBe('b')
  })
})

describe('TOGGLE_PIN', () => {
  it('sets pinned to true when false', () => {
    const state = makeState()
    const next = noteReducer(state, { type: 'TOGGLE_PIN', payload: { id: 'note-1' } })
    expect(next.notes[0].pinned).toBe(true)
  })
  it('is idempotent when toggled twice', () => {
    const state = makeState()
    const once  = noteReducer(state, { type: 'TOGGLE_PIN', payload: { id: 'note-1' } })
    const twice = noteReducer(once,  { type: 'TOGGLE_PIN', payload: { id: 'note-1' } })
    expect(twice.notes[0].pinned).toBe(false)
  })
})

describe('SET_VIEW', () => {
  it('changes the view mode', () => {
    const state = makeState()
    const next = noteReducer(state, { type: 'SET_VIEW', payload: { mode: 'grid' } })
    expect(next.mode).toBe('grid')
  })
  it('does not mutate any note positions', () => {
    const state = makeState()
    const positions = state.notes.map(n => ({ ...n.position }))
    const next = noteReducer(state, { type: 'SET_VIEW', payload: { mode: 'grid' } })
    next.notes.forEach((note, i) => {
      expect(note.position).toEqual(positions[i])
    })
  })
  it('toggling free→grid→free preserves all positions', () => {
    const state = makeState()
    const toGrid = noteReducer(state, { type: 'SET_VIEW', payload: { mode: 'grid' } })
    const toFree = noteReducer(toGrid, { type: 'SET_VIEW', payload: { mode: 'free' } })
    toFree.notes.forEach((note, i) => {
      expect(note.position).toEqual(state.notes[i].position)
    })
  })
  it('multiple SET_VIEW toggles keep positions identical to original', () => {
    const state = makeState()
    let s = state
    for (let i = 0; i < 6; i++) {
      s = noteReducer(s, { type: 'SET_VIEW', payload: { mode: i % 2 === 0 ? 'grid' : 'free' } })
    }
    s.notes.forEach((note, i) => {
      expect(note.position).toEqual(state.notes[i].position)
    })
  })
})
