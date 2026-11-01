// lib/postit-types.ts

export type PostItColor = 'yellow' | 'pink' | 'mint' | 'blue' | 'peach'

export type StickerKey =
  | 'star' | 'heart' | 'check' | 'exclaim' | 'bulb' | 'home'
  | 'cart' | 'sun' | 'lightning' | 'clock' | 'phone' | 'money'

export interface PostItPosition {
  xPct: number   // 0–1 fraction of usable board width
  yPct: number   // 0–1 fraction of usable board height
}

export interface PostIt {
  id:        string
  content:   string
  color:     PostItColor
  rotation:  number          // degrees, range −3…+3, fixed at creation
  position:  PostItPosition
  stickers:  StickerKey[]
  pinned:    boolean
  createdAt: string          // ISO-8601
  updatedAt: string          // ISO-8601
  dueDate?:  string          // ISO-8601, optional
}

export type ViewMode = 'free' | 'grid'

export interface PostItState {
  notes: PostIt[]
  mode:  ViewMode
}

export type PostItAction =
  | { type: 'ADD_NOTE';    payload: Partial<Omit<PostIt, 'id'>> }
  | { type: 'UPDATE_NOTE'; payload: { id: string } & Partial<Omit<PostIt, 'id' | 'position'>> }
  | { type: 'MOVE_NOTE';   payload: { id: string; xPct: number; yPct: number } }
  | { type: 'DELETE_NOTE'; payload: { id: string } }
  | { type: 'TOGGLE_PIN';  payload: { id: string } }
  | { type: 'SET_VIEW';    payload: { mode: ViewMode } }
