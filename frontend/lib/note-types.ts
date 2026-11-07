// lib/note-types.ts

export type NoteColor = 'yellow' | 'pink' | 'mint' | 'blue' | 'peach'

export type StickerKey =
  | 'star' | 'heart' | 'check' | 'exclaim' | 'bulb' | 'home'
  | 'cart' | 'sun' | 'lightning' | 'clock' | 'phone' | 'money'

export interface NotePosition {
  xPct: number   // 0–1 fraction of usable board width
  yPct: number   // 0–1 fraction of usable board height
}

export interface Note {
  id:        string
  content:   string
  color:     NoteColor
  rotation:  number          // degrees, range −3…+3, fixed at creation
  position:  NotePosition
  stickers:  StickerKey[]
  pinned:    boolean
  createdAt: string          // ISO-8601
  updatedAt: string          // ISO-8601
  dueDate?:  string          // ISO-8601, optional
}

export type ViewMode = 'free' | 'grid'

export interface NoteState {
  notes: Note[]
  mode:  ViewMode
}

export type NoteAction =
  | { type: 'ADD_NOTE';    payload: Partial<Omit<Note, 'id'>> }
  | { type: 'UPDATE_NOTE'; payload: { id: string } & Partial<Omit<Note, 'id' | 'position'>> }
  | { type: 'MOVE_NOTE';   payload: { id: string; xPct: number; yPct: number } }
  | { type: 'DELETE_NOTE'; payload: { id: string } }
  | { type: 'TOGGLE_PIN';  payload: { id: string } }
  | { type: 'SET_VIEW';    payload: { mode: ViewMode } }
