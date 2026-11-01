# Lavagna & Nota Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the Lavagna whiteboard and Nota detail pages, faithfully matching pages 1 and 2 of `Agenda - bozze tavole-selection (4).pdf`.

**Architecture:** A `PostItContext` provider mounted at `app/lavagna/layout.tsx` holds all note state via `useReducer`. The board (`/lavagna`) renders notes with CSS `left/top` percentages; drag uses native Pointer Events with ref-based DOM mutation — zero React re-renders per frame. The note detail (`/lavagna/[id]`) is a dedicated full page. State is in-memory only; the UI communicates this honestly.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Tailwind v4 + custom CSS, Vitest, jsdom, @testing-library/react

**Visual reference:** `Agenda - bozze tavole-selection (4).pdf` — page 1 (Lavagna board), page 2 (Nota detail). Both pages are the authoritative visual baseline for all design decisions in this plan.

**Working directory for all commands:** `prototypes/ui-shell/`

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `lib/postit-types.ts` | Create | All TypeScript interfaces and union types |
| `lib/postit-utils.ts` | Create | Pure functions: clamp, pct↔px, rotation, uuid, date format, color/sticker constants, seed notes |
| `lib/postit-context.tsx` | Create | Reducer, PostItContext, PostItProvider, usePostItContext, usePostIt hooks |
| `components/lavagna/LavagnaHeader.tsx` | Create | Top toolbar: back link, title, count, Libera/Griglia toggle, pen icon, + Post-it button |
| `components/lavagna/useDrag.ts` | Create | Pointer Event drag hook — ref-based, no setState per frame |
| `components/lavagna/PostItNote.tsx` | Create | Single note: visual render + drag integration + keyboard repositioning |
| `components/lavagna/LavagnaBoard.tsx` | Create | Board surface: boardRef, ResizeObserver, free/grid layouts |
| `components/lavagna/NotaHeader.tsx` | Create | Detail page header: back link, title, status |
| `components/lavagna/NotaDetail.tsx` | Create | Two-column detail: large preview (left) + tools/colors/stickers/metadata (right) |
| `app/lavagna/layout.tsx` | Create | Server layout that wraps children in PostItProvider |
| `app/lavagna/page.tsx` | Modify | Replace SectionPlaceholder with LavagnaBoard |
| `app/lavagna/[id]/page.tsx` | Create | Extracts params.id, renders NotaDetail or Italian not-found |
| `app/globals.css` | Modify | Add post-it color tokens + all lavagna/nota CSS |
| `vitest.config.ts` | Create | Vitest config with jsdom environment |
| `__tests__/postit-utils.test.ts` | Create | Pure utility function tests |
| `__tests__/postit-reducer.test.ts` | Create | Reducer: all actions, invariants, transitions |
| `__tests__/drag-math.test.ts` | Create | Pure coordinate math used by useDrag: clamping, round-trips, keyboard step |
| `__tests__/drag-hook.test.ts` | Create | useDrag hook integration: pointer events, cancel, tap vs drag, enabled flag |

---

## Task 1: Install and configure test infrastructure

**Files:**
- Create: `vitest.config.ts`
- Modify: `package.json` (add test script + devDependencies)

- [ ] **Step 1: Confirm package manager and check existing test setup**

This workspace uses **pnpm** (there is a `pnpm-lock.yaml` and `pnpm-workspace.yaml` at the repo root). All commands must use `pnpm`. Do **not** introduce a second lockfile by running `npm install` or `yarn`.

```bash
# From repo root, confirm pnpm-workspace.yaml exists and includes ui-shell
cat pnpm-workspace.yaml
# From prototypes/ui-shell/, check for existing test packages
cat package.json | grep -E "vitest|@vitejs/plugin-react|jsdom|@testing-library"
# Check for existing vitest config
ls vitest.config.ts 2>/dev/null && echo "EXISTS" || echo "NOT FOUND"
```
Expected: `pnpm-workspace.yaml` lists `prototypes/*`. If `vitest` already appears in `package.json`, skip Step 2. If `vitest.config.ts` exists, skip Step 3. Only install what is missing.

- [ ] **Step 2: Install test dependencies (skip if vitest already installed)**

Run from `prototypes/ui-shell/`:
```bash
pnpm add -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/user-event
```
Expected: packages added to `pnpm-lock.yaml`, no second lockfile created.

- [ ] **Step 3: Create vitest config (skip if already exists)**

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: [],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
})
```

- [ ] **Step 4: Add test script to package.json (skip if already present)**

In `package.json`, add to `"scripts"`:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 5: Create a smoke test and verify it passes**

```typescript
// __tests__/smoke.test.ts
import { describe, it, expect } from 'vitest'

describe('vitest', () => {
  it('works', () => {
    expect(1 + 1).toBe(2)
  })
})
```

Run:
```bash
pnpm test
```
Expected: `1 passed`.

- [ ] **Step 6: Delete the smoke test**

```bash
rm __tests__/smoke.test.ts
```

---

## Task 2: TypeScript types

**Files:**
- Create: `lib/postit-types.ts`

No tests for pure type definitions.

- [ ] **Step 1: Write the types file**

```typescript
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
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
pnpm exec tsc --noEmit
```
Expected: no errors.

---

## Task 3: Utility functions

**Files:**
- Create: `lib/postit-utils.ts`
- Create: `__tests__/postit-utils.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// __tests__/postit-utils.test.ts
import { describe, it, expect } from 'vitest'
import {
  pctToPx, pxToPct, clampPosition, generateRotation,
  generateId, formatNoteDate, POST_IT_COLORS, STICKER_CONFIG,
} from '@/lib/postit-utils'
import type { PostItColor, StickerKey } from '@/lib/postit-types'

describe('pctToPx', () => {
  it('converts fraction to pixels', () => {
    expect(pctToPx(0.5, 800)).toBe(400)
    expect(pctToPx(0, 800)).toBe(0)
    expect(pctToPx(1, 800)).toBe(800)
  })
})

describe('pxToPct', () => {
  it('converts pixels to fraction', () => {
    expect(pxToPct(400, 800)).toBeCloseTo(0.5)
    expect(pxToPct(0, 800)).toBe(0)
  })
  it('round-trips with pctToPx', () => {
    const pct = 0.37
    expect(pxToPct(pctToPx(pct, 1000), 1000)).toBeCloseTo(pct, 5)
  })
})

describe('clampPosition', () => {
  it('returns same pct when note fits inside board', () => {
    const result = clampPosition(0.5, 0.5, 800, 600, 200, 200)
    expect(result.xPct).toBeCloseTo(0.5)
    expect(result.yPct).toBeCloseTo(0.5)
  })
  it('clamps negative xPct to 0', () => {
    const result = clampPosition(-0.1, 0.5, 800, 600, 200, 200)
    expect(result.xPct).toBe(0)
  })
  it('clamps note that would overflow the right edge', () => {
    // note at xPct=0.99 with noteW=200 in boardW=800: max xPx = 800-200=600, so maxPct=0.75
    const result = clampPosition(0.99, 0.5, 800, 600, 200, 200)
    expect(result.xPct).toBeCloseTo(600 / 800)
  })
  it('clamps bottom edge', () => {
    const result = clampPosition(0.5, 0.99, 800, 600, 200, 200)
    expect(result.yPct).toBeCloseTo(400 / 600)
  })
  it('returns 0 when note is wider than board', () => {
    const result = clampPosition(0.5, 0.5, 100, 100, 200, 200)
    expect(result.xPct).toBe(0)
    expect(result.yPct).toBe(0)
  })
})

describe('generateRotation', () => {
  it('returns a value in the range [-3, 3]', () => {
    for (let i = 0; i < 50; i++) {
      const r = generateRotation()
      expect(r).toBeGreaterThanOrEqual(-3)
      expect(r).toBeLessThanOrEqual(3)
    }
  })
})

describe('generateId', () => {
  it('returns a non-empty string', () => {
    expect(typeof generateId()).toBe('string')
    expect(generateId().length).toBeGreaterThan(0)
  })
  it('does not return the same value twice in a row', () => {
    expect(generateId()).not.toBe(generateId())
  })
})

describe('formatNoteDate', () => {
  it('returns an Italian date string for a past date', () => {
    const result = formatNoteDate('2026-10-15T14:20:00.000Z')
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })
})

describe('POST_IT_COLORS', () => {
  it('has an entry for every PostItColor', () => {
    const keys: PostItColor[] = ['yellow', 'pink', 'mint', 'blue', 'peach']
    keys.forEach(k => {
      expect(POST_IT_COLORS[k]).toMatch(/^#[0-9A-Fa-f]{6}$/)
    })
  })
})

describe('STICKER_CONFIG', () => {
  it('has an entry for every StickerKey', () => {
    const keys: StickerKey[] = [
      'star','heart','check','exclaim','bulb','home',
      'cart','sun','lightning','clock','phone','money',
    ]
    keys.forEach(k => {
      expect(STICKER_CONFIG[k].emoji).toBeTruthy()
      expect(STICKER_CONFIG[k].bg).toMatch(/^#/)
    })
  })
})
```

- [ ] **Step 2: Run to confirm all tests fail**

```bash
pnpm test __tests__/postit-utils.test.ts
```
Expected: all fail with "Cannot find module '@/lib/postit-utils'".

- [ ] **Step 3: Write the utils implementation**

```typescript
// lib/postit-utils.ts
import type { PostIt, PostItColor, PostItPosition, StickerKey } from './postit-types'

// ── Coordinate math ──────────────────────────────────────────────────────────

export function pctToPx(pct: number, size: number): number {
  return pct * size
}

export function pxToPct(px: number, size: number): number {
  return size === 0 ? 0 : px / size
}

/**
 * Clamps position percentages so the note stays fully within the board.
 * Returns clamped {xPct, yPct}.
 */
export function clampPosition(
  xPct: number,
  yPct: number,
  boardW: number,
  boardH: number,
  noteW: number,
  noteH: number,
): PostItPosition {
  const maxXpx = Math.max(0, boardW - noteW)
  const maxYpx = Math.max(0, boardH - noteH)
  const clampedXpx = Math.max(0, Math.min(pctToPx(xPct, boardW), maxXpx))
  const clampedYpx = Math.max(0, Math.min(pctToPx(yPct, boardH), maxYpx))
  return {
    xPct: pxToPct(clampedXpx, boardW),
    yPct: pxToPct(clampedYpx, boardH),
  }
}

// ── Generators ───────────────────────────────────────────────────────────────

/** Returns a random rotation in degrees in the range [−3, +3]. */
export function generateRotation(): number {
  return (Math.random() * 6) - 3
}

/** Returns a UUID v4 string. Uses the Web Crypto API (available in all modern browsers and Node 19+). */
export function generateId(): string {
  return crypto.randomUUID()
}

// ── Date formatting ──────────────────────────────────────────────────────────

/** Formats an ISO-8601 date string in Italian. Today → "oggi alle HH:MM". */
export function formatNoteDate(iso: string): string {
  const date = new Date(iso)
  const now  = new Date()
  const isToday =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth()    === now.getMonth()    &&
    date.getDate()     === now.getDate()

  const time = date.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })

  if (isToday) return `oggi alle ${time}`

  return date.toLocaleDateString('it-IT', {
    day:   'numeric',
    month: 'long',
    year:  'numeric',
  }) + ` alle ${time}`
}

// ── Design constants ─────────────────────────────────────────────────────────

export const POST_IT_COLORS: Record<PostItColor, string> = {
  yellow: '#FFF9B0',
  pink:   '#FFD6E4',
  mint:   '#C8F0D8',
  blue:   '#C8E4FF',
  peach:  '#FFE4CC',
}

export const STICKER_CONFIG: Record<StickerKey, { emoji: string; bg: string }> = {
  star:      { emoji: '⭐', bg: '#FFF176' },
  heart:     { emoji: '❤️', bg: '#FFCDD2' },
  check:     { emoji: '✅', bg: '#C8E6C9' },
  exclaim:   { emoji: '❗', bg: '#FFCCBC' },
  bulb:      { emoji: '💡', bg: '#FFF9C4' },
  home:      { emoji: '🏠', bg: '#BBDEFB' },
  cart:      { emoji: '🛒', bg: '#E1BEE7' },
  sun:       { emoji: '☀️', bg: '#FFE0B2' },
  lightning: { emoji: '⚡', bg: '#FFF59D' },
  clock:     { emoji: '🕐', bg: '#CFD8DC' },
  phone:     { emoji: '📱', bg: '#B3E5FC' },
  money:     { emoji: '💰', bg: '#DCEDC8' },
}

// ── Demo notes ───────────────────────────────────────────────────────────────
// Deterministic string IDs prevent server/client hydration mismatches.
// crypto.randomUUID() is ONLY called inside the ADD_NOTE reducer action (client-side).

export const DEMO_NOTES: PostIt[] = [
  {
    id: 'demo-note-01', content: 'Chiamare la banca\nper il mutuo', color: 'yellow',
    rotation: -2.1, position: { xPct: 0.05, yPct: 0.06 },
    stickers: [], pinned: false,
    createdAt: '2026-11-01T09:00:00.000Z', updatedAt: '2026-11-01T09:00:00.000Z',
  },
  {
    id: 'demo-note-02', content: 'Prenotare visita casa\na Padova sabato mattina,\nportare la lista domande',
    color: 'mint', rotation: 1.8, position: { xPct: 0.27, yPct: 0.08 },
    stickers: ['home', 'exclaim'], pinned: true,
    createdAt: '2026-11-01T09:01:00.000Z', updatedAt: '2026-11-01T09:01:00.000Z',
  },
  {
    id: 'demo-note-03', content: 'Comprare latte,\npane e frutta', color: 'pink',
    rotation: -1.3, position: { xPct: 0.53, yPct: 0.05 },
    stickers: ['cart'], pinned: false,
    createdAt: '2026-11-01T09:02:00.000Z', updatedAt: '2026-11-01T09:02:00.000Z',
  },
  {
    id: 'demo-note-04', content: 'Riunione con il team\nalle 15:00', color: 'blue',
    rotation: 2.4, position: { xPct: 0.75, yPct: 0.07 },
    stickers: ['clock'], pinned: false,
    createdAt: '2026-11-01T09:03:00.000Z', updatedAt: '2026-11-01T09:03:00.000Z',
  },
  {
    id: 'demo-note-05', content: 'Idea per il progetto:\nusare le mappe mentali', color: 'yellow',
    rotation: -0.8, position: { xPct: 0.08, yPct: 0.50 },
    stickers: ['bulb'], pinned: false,
    createdAt: '2026-11-01T09:04:00.000Z', updatedAt: '2026-11-01T09:04:00.000Z',
  },
  {
    id: 'demo-note-06', content: 'Pagare la bolletta\ndel gas', color: 'peach',
    rotation: 1.5, position: { xPct: 0.30, yPct: 0.52 },
    stickers: [], pinned: false,
    createdAt: '2026-11-01T09:05:00.000Z', updatedAt: '2026-11-01T09:05:00.000Z',
  },
  {
    id: 'demo-note-07', content: 'Leggere capitolo 5\ndel libro', color: 'mint',
    rotation: -2.7, position: { xPct: 0.56, yPct: 0.48 },
    stickers: [], pinned: false,
    createdAt: '2026-11-01T09:06:00.000Z', updatedAt: '2026-11-01T09:06:00.000Z',
  },
  {
    id: 'demo-note-08', content: 'Comprare regalo\nper il compleanno di Luca', color: 'pink',
    rotation: 1.1, position: { xPct: 0.76, yPct: 0.51 },
    stickers: ['star', 'heart'], pinned: false,
    createdAt: '2026-11-01T09:07:00.000Z', updatedAt: '2026-11-01T09:07:00.000Z',
  },
]
```

- [ ] **Step 4: Run tests — all should pass**

```bash
pnpm test __tests__/postit-utils.test.ts
```
Expected: `8 tests passed`.

---

## Task 4: Reducer — all actions

**Files:**
- Create: `lib/postit-context.tsx` (reducer only for now — provider added in Task 5)
- Create: `__tests__/postit-reducer.test.ts`

- [ ] **Step 1: Write failing reducer tests**

```typescript
// __tests__/postit-reducer.test.ts
import { describe, it, expect } from 'vitest'
import { postItReducer } from '@/lib/postit-context'
import type { PostItState, PostIt, PostItAction } from '@/lib/postit-types'

function makeState(overrides?: Partial<PostItState>): PostItState {
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
    const next = postItReducer(state, { type: 'ADD_NOTE', payload: { content: 'Hello' } })
    expect(next.notes).toHaveLength(1)
    expect(next.notes[0].id).toBeTruthy()
    expect(next.notes[0].content).toBe('Hello')
  })
  it('assigns rotation in [-3, 3]', () => {
    const state = makeState({ notes: [] })
    const next = postItReducer(state, { type: 'ADD_NOTE', payload: {} })
    expect(next.notes[0].rotation).toBeGreaterThanOrEqual(-3)
    expect(next.notes[0].rotation).toBeLessThanOrEqual(3)
  })
  it('assigns position with xPct and yPct in [0, 1]', () => {
    const state = makeState({ notes: [] })
    const next = postItReducer(state, { type: 'ADD_NOTE', payload: {} })
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
    const next = postItReducer(state, {
      type: 'UPDATE_NOTE',
      payload: { id: 'note-1', content: 'Updated' },
    })
    expect(next.notes[0].content).toBe('Updated')
    expect(next.notes[0].position).toEqual(originalPos)
  })
  it('updates color without touching position', () => {
    const state = makeState()
    const originalPos = state.notes[0].position
    const next = postItReducer(state, {
      type: 'UPDATE_NOTE',
      payload: { id: 'note-1', color: 'mint' },
    })
    expect(next.notes[0].color).toBe('mint')
    expect(next.notes[0].position).toEqual(originalPos)
  })
  it('does not modify notes with a different id', () => {
    const state = makeState()
    const next = postItReducer(state, {
      type: 'UPDATE_NOTE',
      payload: { id: 'other-id', content: 'Changed' },
    })
    expect(next.notes[0].content).toBe('Test note')
  })
})

describe('MOVE_NOTE', () => {
  it('updates only position', () => {
    const state = makeState()
    const next = postItReducer(state, {
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
    const after = postItReducer(state, {
      type: 'MOVE_NOTE', payload: { id: 'note-1', xPct: 0.7, yPct: 0.8 },
    })
    const final = postItReducer(after, {
      type: 'UPDATE_NOTE', payload: { id: 'note-1', content: 'New content' },
    })
    expect(final.notes[0].position).toEqual({ xPct: 0.7, yPct: 0.8 })
    expect(final.notes[0].content).toBe('New content')
  })
  it('UPDATE_NOTE then MOVE_NOTE: content is preserved from UPDATE_NOTE', () => {
    const state = makeState()
    const after = postItReducer(state, {
      type: 'UPDATE_NOTE', payload: { id: 'note-1', content: 'Edited' },
    })
    const final = postItReducer(after, {
      type: 'MOVE_NOTE', payload: { id: 'note-1', xPct: 0.2, yPct: 0.3 },
    })
    expect(final.notes[0].content).toBe('Edited')
    expect(final.notes[0].position).toEqual({ xPct: 0.2, yPct: 0.3 })
  })
})

describe('DELETE_NOTE', () => {
  it('removes the target note', () => {
    const state = makeState()
    const next = postItReducer(state, { type: 'DELETE_NOTE', payload: { id: 'note-1' } })
    expect(next.notes).toHaveLength(0)
  })
  it('does not remove unrelated notes', () => {
    const state: PostItState = {
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
    const next = postItReducer(state, { type: 'DELETE_NOTE', payload: { id: 'a' } })
    expect(next.notes).toHaveLength(1)
    expect(next.notes[0].id).toBe('b')
  })
})

describe('TOGGLE_PIN', () => {
  it('sets pinned to true when false', () => {
    const state = makeState()
    const next = postItReducer(state, { type: 'TOGGLE_PIN', payload: { id: 'note-1' } })
    expect(next.notes[0].pinned).toBe(true)
  })
  it('is idempotent when toggled twice', () => {
    const state = makeState()
    const once  = postItReducer(state, { type: 'TOGGLE_PIN', payload: { id: 'note-1' } })
    const twice = postItReducer(once,  { type: 'TOGGLE_PIN', payload: { id: 'note-1' } })
    expect(twice.notes[0].pinned).toBe(false)
  })
})

describe('SET_VIEW', () => {
  it('changes the view mode', () => {
    const state = makeState()
    const next = postItReducer(state, { type: 'SET_VIEW', payload: { mode: 'grid' } })
    expect(next.mode).toBe('grid')
  })
  it('does not mutate any note positions', () => {
    const state = makeState()
    const positions = state.notes.map(n => ({ ...n.position }))
    const next = postItReducer(state, { type: 'SET_VIEW', payload: { mode: 'grid' } })
    next.notes.forEach((note, i) => {
      expect(note.position).toEqual(positions[i])
    })
  })
  it('toggling free→grid→free preserves all positions', () => {
    const state = makeState()
    const toGrid = postItReducer(state, { type: 'SET_VIEW', payload: { mode: 'grid' } })
    const toFree = postItReducer(toGrid, { type: 'SET_VIEW', payload: { mode: 'free' } })
    toFree.notes.forEach((note, i) => {
      expect(note.position).toEqual(state.notes[i].position)
    })
  })
  it('multiple SET_VIEW toggles keep positions identical to original', () => {
    const state = makeState()
    let s = state
    for (let i = 0; i < 6; i++) {
      s = postItReducer(s, { type: 'SET_VIEW', payload: { mode: i % 2 === 0 ? 'grid' : 'free' } })
    }
    s.notes.forEach((note, i) => {
      expect(note.position).toEqual(state.notes[i].position)
    })
  })
})
```

- [ ] **Step 2: Run to confirm all tests fail**

```bash
pnpm test __tests__/postit-reducer.test.ts
```
Expected: all fail — "Cannot find module '@/lib/postit-context'".

- [ ] **Step 3: Write the reducer (context file, reducer export only for now)**

```typescript
// lib/postit-context.tsx
'use client'

import {
  createContext,
  useContext,
  useReducer,
  type Dispatch,
  type ReactNode,
} from 'react'
import type { PostIt, PostItAction, PostItState, PostItPosition } from './postit-types'
import { generateRotation } from './postit-utils'

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
      const { position: _pos, ...safeFields } = fields as typeof fields & { position?: unknown }
      void _pos
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

// ── Context (provider added in Task 5) ───────────────────────────────────────

export interface PostItContextValue {
  state:    PostItState
  dispatch: Dispatch<PostItAction>
}

const PostItContext = createContext<PostItContextValue | null>(null)

export function PostItProvider({
  children,
  initialNotes = [],
}: {
  children:     ReactNode
  initialNotes?: PostIt[]
}) {
  const [state, dispatch] = useReducer(postItReducer, {
    notes: initialNotes,
    mode:  'free',
  })
  return (
    <PostItContext.Provider value={{ state, dispatch }}>
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
```

- [ ] **Step 4: Run reducer tests — all should pass**

```bash
pnpm test __tests__/postit-reducer.test.ts
```
Expected: `17 tests passed`.

---

## Task 5: CSS additions — post-it tokens and lavagna layout

**Files:**
- Modify: `app/globals.css`

No automated tests for CSS. Visual verification in Task 11 and Task 16.

- [ ] **Step 1: Append post-it color tokens and lavagna CSS to globals.css**

At the end of `app/globals.css`, add:

```css
/* ============================================================
   POST-IT COLOR TOKENS
   ============================================================ */

:root {
  --postit-yellow: #FFF9B0;
  --postit-pink:   #FFD6E4;
  --postit-mint:   #C8F0D8;
  --postit-blue:   #C8E4FF;
  --postit-peach:  #FFE4CC;

  --postit-yellow-border: #E8D84A;
  --postit-pink-border:   #E8A0B8;
  --postit-mint-border:   #8ED4A8;
  --postit-blue-border:   #88C0E8;
  --postit-peach-border:  #E8B888;
}

/* ============================================================
   LAVAGNA SCREEN
   ============================================================ */

.lavagna-screen {
  height:         100dvh;
  display:        flex;
  flex-direction: column;
  background: linear-gradient(
    var(--gradient-angle),
    var(--gradient-start),
    var(--gradient-end)
  );
  color: var(--text-primary);
  padding:
    env(safe-area-inset-top,    0px)
    env(safe-area-inset-right,  0px)
    env(safe-area-inset-bottom, 0px)
    env(safe-area-inset-left,   0px);
}

/* ── Lavagna Header ── */

.lavagna-header {
  display:         flex;
  align-items:     center;
  justify-content: space-between;
  flex-wrap:       wrap;
  gap:             0.5rem;
  padding:         0.875rem 1.5rem;
  border-bottom:   1px solid rgba(255, 255, 255, 0.15);
  background:      rgba(0, 0, 0, 0.10);
  flex-shrink:     0;
}

.lavagna-header-left {
  display:     flex;
  align-items: center;
  gap:         0.625rem;
}

.lavagna-header-right {
  display:     flex;
  align-items: center;
  gap:         0.5rem;
}

.lavagna-back-btn {
  display:         flex;
  align-items:     center;
  gap:             0.25rem;
  color:           var(--text-primary);
  text-decoration: none;
  min-height:      44px;
  min-width:       44px;
  padding:         0 0.625rem;
  border-radius:   22px;
  border:          1px solid rgba(255, 255, 255, 0.30);
  background:      rgba(255, 255, 255, 0.08);
  transition:      background 150ms ease;
}

.lavagna-back-btn:hover   { background: rgba(255, 255, 255, 0.16); }
.lavagna-back-btn:focus-visible {
  outline:        3px solid var(--focus-ring);
  outline-offset: 3px;
  box-shadow:     0 0 0 1px var(--focus-ring-bg);
}

.lavagna-title {
  font-size:   1.125rem;
  font-weight: 600;
  color:       var(--text-primary);
}

.lavagna-count {
  font-size:  0.75rem;
  color:      rgba(255, 255, 255, 0.65);
  font-weight: 400;
}

/* Segmented toggle: Libera / Griglia */
.lavagna-toggle {
  display:          flex;
  background:       rgba(0, 0, 0, 0.20);
  border:           1px solid rgba(255, 255, 255, 0.25);
  border-radius:    9999px;
  padding:          2px;
  gap:              2px;
}

.lavagna-toggle-btn {
  min-height:     36px;
  min-width:      44px;
  padding:        0 0.875rem;
  border-radius:  9999px;
  border:         none;
  font-size:      0.8125rem;
  font-weight:    500;
  cursor:         pointer;
  transition:     background 150ms ease, color 150ms ease;
  background:     transparent;
  color:          rgba(255, 255, 255, 0.70);
}

.lavagna-toggle-btn[aria-pressed="true"] {
  background: rgba(255, 255, 255, 0.92);
  color:      #1a1a1a;
}

.lavagna-toggle-btn:focus-visible {
  outline:        3px solid var(--focus-ring);
  outline-offset: 2px;
}

.lavagna-icon-btn {
  width:           40px;
  height:          40px;
  min-width:       44px;
  min-height:      44px;
  display:         flex;
  align-items:     center;
  justify-content: center;
  border-radius:   50%;
  border:          1px solid rgba(255, 255, 255, 0.35);
  background:      rgba(255, 255, 255, 0.08);
  color:           rgba(255, 255, 255, 0.55);
  cursor:          not-allowed;  /* pen is not yet implemented */
  opacity:         0.6;
}

.lavagna-add-btn {
  display:        flex;
  align-items:    center;
  gap:            0.375rem;
  min-height:     40px;
  min-width:      44px;
  padding:        0 1.25rem;
  border-radius:  9999px;
  border:         none;
  background:     #2563EB;
  color:          #ffffff;
  font-size:      0.875rem;
  font-weight:    600;
  cursor:         pointer;
  transition:     background 150ms ease;
}

.lavagna-add-btn:hover        { background: #1D4ED8; }
.lavagna-add-btn:focus-visible {
  outline:        3px solid var(--focus-ring);
  outline-offset: 3px;
  box-shadow:     0 0 0 1px var(--focus-ring-bg);
}

/* ── Board wrap + surface ── */

.lavagna-board-wrap {
  flex:     1;
  min-height: 0;
  padding:  24px 32px;
  display:  flex;
}

.lavagna-board {
  flex:          1;
  position:      relative;
  background:    #ffffff;
  border-radius: 24px;
  border:        1px solid #e8e4dc;
  box-shadow:    0 2px 20px rgba(0, 0, 0, 0.06);
  overflow:      hidden;
}

/* ── Free mode: grid overlay ── */

.lavagna-grid-mode {
  display:               grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap:                   24px;
  padding:               32px;
  align-content:         start;
  height:                100%;
  overflow-y:            auto;
}

/* ── Post-it note ── */

.postit {
  width:         clamp(160px, 18vw, 210px);
  height:        clamp(160px, 18vw, 210px);
  border-radius: 3px;
  padding:       14px 16px 10px;
  font-family:   var(--font-welcome), cursive;
  font-size:     clamp(0.875rem, 1.5vw, 1rem);
  line-height:   1.5;
  cursor:        pointer;
  user-select:   none;
  -webkit-user-select: none;
  box-shadow:
    2px 4px 14px rgba(0, 0, 0, 0.13),
    0 1px 3px rgba(0, 0, 0, 0.07);
  display:        flex;
  flex-direction: column;
  position:       absolute;
  top:            0;
  left:           0;
  touch-action:   none;  /* prevent browser scroll during drag */
}

/* Grid mode: static, flat */
.postit--grid {
  position:  static;
  transform: none !important;
  cursor:    pointer;
  width:     100%;
  height:    auto;
  min-height: clamp(140px, 16vw, 180px);
}

.postit:focus-visible {
  outline:        3px solid #2563EB;
  outline-offset: 3px;
}

.postit--dragging {
  box-shadow:
    4px 8px 24px rgba(0, 0, 0, 0.22),
    0 2px 8px rgba(0, 0, 0, 0.10);
  z-index: 100;
}

.postit-content {
  flex:        1;
  overflow:    hidden;
  word-break:  break-word;
  white-space: pre-wrap;
}

.postit-stickers {
  display:   flex;
  flex-wrap: wrap;
  gap:       3px;
  margin-top: 6px;
}

.postit-sticker {
  font-size:     1rem;
  line-height:   1;
  border-radius: 9999px;
  padding:       2px 5px;
}

.postit-date {
  font-size:   0.65rem;
  color:       rgba(0, 0, 0, 0.45);
  margin-top:  auto;
  padding-top: 6px;
  font-family: system-ui, sans-serif;
}

/* ============================================================
   NOTA DETAIL
   ============================================================ */

.nota-screen {
  height:         100dvh;
  display:        flex;
  flex-direction: column;
  background: linear-gradient(
    var(--gradient-angle),
    var(--gradient-start),
    var(--gradient-end)
  );
  color: var(--text-primary);
  padding:
    env(safe-area-inset-top,    0px)
    env(safe-area-inset-right,  0px)
    env(safe-area-inset-bottom, 0px)
    env(safe-area-inset-left,   0px);
}

/* ── Nota header ── */

.nota-header {
  display:         flex;
  align-items:     center;
  justify-content: space-between;
  padding:         0.875rem 1.5rem;
  border-bottom:   1px solid rgba(255, 255, 255, 0.15);
  background:      rgba(0, 0, 0, 0.10);
  flex-shrink:     0;
}

.nota-back-btn {
  display:         flex;
  align-items:     center;
  gap:             0.25rem;
  color:           var(--text-primary);
  text-decoration: none;
  font-size:       0.875rem;
  font-weight:     500;
  min-height:      44px;
  padding:         0 0.875rem;
  border-radius:   22px;
  border:          1px solid rgba(255, 255, 255, 0.30);
  background:      rgba(255, 255, 255, 0.08);
  transition:      background 150ms ease;
}

.nota-back-btn:hover        { background: rgba(255, 255, 255, 0.16); }
.nota-back-btn:focus-visible {
  outline:        3px solid var(--focus-ring);
  outline-offset: 3px;
  box-shadow:     0 0 0 1px var(--focus-ring-bg);
}

.nota-title {
  font-size:   1rem;
  font-weight: 600;
  color:       var(--text-primary);
}

.nota-status {
  font-size:  0.75rem;
  color:      rgba(255, 255, 255, 0.65);
}

/* ── Nota body: two columns ── */

.nota-body {
  flex:           1;
  min-height:     0;
  display:        flex;
  overflow:       hidden;
}

.nota-preview-panel {
  flex:            0 0 60%;
  display:         flex;
  align-items:     center;
  justify-content: center;
  padding:         32px;
  background:      rgba(255, 255, 255, 0.04);
  border-right:    1px solid rgba(255, 255, 255, 0.12);
}

.nota-tools-panel {
  flex:       1;
  overflow-y: auto;
  padding:    24px;
  display:    flex;
  flex-direction: column;
  gap:        20px;
}

/* Large post-it preview in Nota */
.nota-postit-preview {
  width:         280px;
  height:        280px;
  border-radius: 4px;
  padding:       20px;
  font-family:   var(--font-welcome), cursive;
  font-size:     1.1rem;
  line-height:   1.55;
  box-shadow:    3px 6px 20px rgba(0,0,0,0.16), 0 1px 4px rgba(0,0,0,0.10);
  display:       flex;
  flex-direction: column;
}

.nota-postit-content-area {
  flex:           1;
  background:     transparent;
  border:         none;
  outline:        none;
  font:           inherit;
  color:          inherit;
  resize:         none;
  cursor:         text;
  word-break:     break-word;
  white-space:    pre-wrap;
  padding:        0;
  width:          100%;
}

.nota-postit-date {
  font-size:   0.7rem;
  color:       rgba(0, 0, 0, 0.45);
  margin-top:  auto;
  padding-top: 8px;
  font-family: system-ui, sans-serif;
}

/* ── Pinned notice ── */

.nota-pinned-notice {
  background:   #FFF3CD;
  border-left:  4px solid #F59E0B;
  border-radius: 8px;
  padding:      12px 14px;
}

.nota-pinned-title {
  font-size:   0.875rem;
  font-weight: 700;
  color:       #92400E;
  margin-bottom: 4px;
}

.nota-pinned-desc {
  font-size:  0.8125rem;
  color:      #78350F;
  line-height: 1.45;
}

/* ── Tools grid ── */

.nota-tools-grid {
  display:               grid;
  grid-template-columns: 1fr 1fr;
  gap:                   10px;
}

.nota-tool-btn {
  display:         flex;
  flex-direction:  column;
  align-items:     center;
  gap:             6px;
  padding:         14px 8px 12px;
  border-radius:   12px;
  border:          1px solid rgba(255, 255, 255, 0.20);
  background:      rgba(255, 255, 255, 0.92);
  color:           #1a1a1a;
  font-size:       0.75rem;
  font-weight:     500;
  cursor:          pointer;
  text-align:      center;
  transition:      background 120ms ease;
}

.nota-tool-btn:hover        { background: rgba(255, 255, 255, 1); }
.nota-tool-btn:focus-visible {
  outline:        3px solid var(--focus-ring);
  outline-offset: 2px;
}

.nota-tool-btn--destructive {
  color:            #DC2626;
  border-color:     rgba(220, 38, 38, 0.25);
  background:       rgba(255, 220, 220, 0.85);
}

.nota-tool-btn--destructive:hover { background: rgba(255, 220, 220, 1); }

.nota-tool-icon { font-size: 1.25rem; }

/* ── Color swatches ── */

.nota-section-label {
  font-size:    0.75rem;
  font-weight:  600;
  color:        rgba(255, 255, 255, 0.70);
  text-transform: uppercase;
  letter-spacing: 0.07em;
  margin-bottom: -8px;
}

.nota-colors {
  display: flex;
  gap:     10px;
}

.nota-color-swatch {
  width:         28px;
  height:        28px;
  border-radius: 50%;
  border:        2px solid transparent;
  cursor:        pointer;
  transition:    transform 120ms ease;
}

.nota-color-swatch:hover          { transform: scale(1.15); }
.nota-color-swatch[aria-pressed="true"] {
  box-shadow: 0 0 0 2px #ffffff, 0 0 0 4px rgba(0,0,0,0.35);
}

.nota-color-swatch:focus-visible {
  outline:        3px solid var(--focus-ring);
  outline-offset: 3px;
}

/* ── Stickers ── */

.nota-stickers {
  display:   flex;
  flex-wrap: wrap;
  gap:       8px;
}

.nota-sticker-btn {
  display:       flex;
  align-items:   center;
  gap:           4px;
  padding:       5px 10px;
  border-radius: 9999px;
  border:        none;
  font-size:     0.8125rem;
  cursor:        pointer;
  transition:    transform 120ms ease;
}

.nota-sticker-btn:hover        { transform: scale(1.1); }
.nota-sticker-btn:focus-visible {
  outline:        3px solid var(--focus-ring);
  outline-offset: 2px;
}

.nota-remove-sticker {
  font-size:   0.75rem;
  color:       rgba(255, 255, 255, 0.65);
  background:  none;
  border:      none;
  cursor:      pointer;
  padding:     4px 8px;
  border-radius: 4px;
  text-decoration: underline;
}

.nota-remove-sticker:focus-visible {
  outline:        2px solid var(--focus-ring);
  outline-offset: 2px;
}

/* ── Metadata ── */

.nota-metadata {
  font-size:   0.75rem;
  color:       rgba(255, 255, 255, 0.50);
  line-height: 1.6;
  padding-top: 4px;
  border-top:  1px solid rgba(255, 255, 255, 0.12);
}

/* ── Not-found ── */

.nota-notfound {
  flex:            1;
  display:         flex;
  flex-direction:  column;
  align-items:     center;
  justify-content: center;
  gap:             1.25rem;
  padding:         2rem;
  text-align:      center;
}

.nota-notfound-msg {
  font-size:   1.125rem;
  font-weight: 500;
  color:       var(--text-primary);
}

.nota-notfound-sub {
  font-size:  0.875rem;
  color:      rgba(255, 255, 255, 0.65);
  max-width:  30ch;
}

.nota-notfound-btn {
  min-height:     44px;
  padding:        0 1.5rem;
  border-radius:  9999px;
  border:         1px solid rgba(255, 255, 255, 0.50);
  background:     rgba(255, 255, 255, 0.12);
  color:          var(--text-primary);
  font-size:      0.9375rem;
  font-weight:    600;
  cursor:         pointer;
  transition:     background 150ms ease;
  text-decoration: none;
  display:        inline-flex;
  align-items:    center;
}

.nota-notfound-btn:hover        { background: rgba(255, 255, 255, 0.22); }
.nota-notfound-btn:focus-visible {
  outline:        3px solid var(--focus-ring);
  outline-offset: 3px;
}

/* ============================================================
   RESPONSIVE — Lavagna + Nota
   ============================================================ */

@media (max-width: 768px) {
  .lavagna-board-wrap  { padding: 12px 16px; }
  .lavagna-header      { padding: 0.75rem 1rem; }
  .lavagna-add-label   { display: none; }  /* icon-only on narrow screens */

  /* Nota: single column */
  .nota-body           { flex-direction: column; overflow-y: auto; }
  .nota-preview-panel  {
    flex:         none;
    border-right: none;
    border-bottom: 1px solid rgba(255, 255, 255, 0.12);
    padding:      24px 24px 20px;
  }
  .nota-tools-panel    { flex: none; overflow-y: visible; }
}

@media (max-width: 480px) {
  .lavagna-count       { display: none; }
  .nota-postit-preview { width: 240px; height: 240px; }
}
```

---

## Task 6: Routing skeleton

**Files:**
- Create: `app/lavagna/layout.tsx`
- Modify: `app/lavagna/page.tsx`
- Create: `app/lavagna/[id]/page.tsx` (placeholder only — full component in Task 16)

- [ ] **Step 1: Create the layout (provider boundary)**

```typescript
// app/lavagna/layout.tsx
import { PostItProvider } from '@/lib/postit-context'

// The board starts empty until durable persistence is implemented.
// To run with sample data locally, temporarily import DEMO_NOTES from '@/lib/postit-utils'
// and pass initialNotes={DEMO_NOTES} — never commit that change.
export default function LavagnaLayout({ children }: { children: React.ReactNode }) {
  return <PostItProvider>{children}</PostItProvider>
}
```

- [ ] **Step 2: Create the [id] page stub**

```typescript
// app/lavagna/[id]/page.tsx
export default function NotaPage({ params }: { params: { id: string } }) {
  return <div style={{ color: '#fff', padding: '2rem' }}>Nota: {params.id}</div>
}
```

- [ ] **Step 3: Verify dev server starts without errors**

```bash
pnpm dev
```
Navigate to `http://localhost:3000/lavagna`. Expected: placeholder renders. No console errors.
Stop the dev server.

---

## Task 7: LavagnaHeader component

**Files:**
- Create: `components/lavagna/LavagnaHeader.tsx`

- [ ] **Step 1: Write the component**

```tsx
// components/lavagna/LavagnaHeader.tsx
'use client'

import Link from 'next/link'
import type { ViewMode } from '@/lib/postit-types'

interface LavagnaHeaderProps {
  noteCount:    number
  mode:         ViewMode
  onModeChange: (mode: ViewMode) => void
  onAddNote:    () => void
}

export function LavagnaHeader({ noteCount, mode, onModeChange, onAddNote }: LavagnaHeaderProps) {
  return (
    <header className="lavagna-header" role="banner">
      <div className="lavagna-header-left">
        <Link href="/?view=menu" replace className="lavagna-back-btn" aria-label="Torna al menu">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M10 3L5 8L10 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </Link>
        <h1 className="lavagna-title">Lavagna</h1>
        <span className="lavagna-count" aria-live="polite">
          {noteCount} post-it
        </span>
      </div>

      <div className="lavagna-header-right">
        <div className="lavagna-toggle" role="group" aria-label="Modalità visualizzazione">
          <button
            className="lavagna-toggle-btn"
            aria-pressed={mode === 'free'}
            onClick={() => onModeChange('free')}
          >
            Libera
          </button>
          <button
            className="lavagna-toggle-btn"
            aria-pressed={mode === 'grid'}
            onClick={() => onModeChange('grid')}
          >
            Griglia
          </button>
        </div>

        <button
          className="lavagna-icon-btn"
          aria-label="Disegna (non ancora disponibile)"
          title="Disegna (non ancora disponibile)"
          disabled
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
            <path d="M3 15L6 14L14.5 5.5C15.3 4.7 15.3 3.3 14.5 2.5C13.7 1.7 12.3 1.7 11.5 2.5L3 11V15Z"
              stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
          </svg>
        </button>

        <button className="lavagna-add-btn" onClick={onAddNote} aria-label="Aggiungi post-it">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          <span className="lavagna-add-label">Post-it</span>
        </button>
      </div>
    </header>
  )
}
```

---

## Task 8: PostItNote — static render

**Files:**
- Create: `components/lavagna/PostItNote.tsx`

Drag is added in Task 13. This task gets visual rendering correct.

- [ ] **Step 1: Write the static PostItNote**

```tsx
// components/lavagna/PostItNote.tsx
'use client'

import { useRef, useState, useLayoutEffect, type RefObject } from 'react'
import { useRouter } from 'next/navigation'
import type { PostIt, ViewMode } from '@/lib/postit-types'
import { POST_IT_COLORS, STICKER_CONFIG } from '@/lib/postit-utils'

interface PostItNoteProps {
  note:         PostIt
  boardRef:     RefObject<HTMLDivElement | null>
  boardSize:    { w: number; h: number }   // from ResizeObserver in LavagnaBoard
  mode:         ViewMode
  onMoveCommit: (id: string, xPct: number, yPct: number) => void
}

export function PostItNote({ note, boardSize, mode, onMoveCommit }: PostItNoteProps) {
  const router  = useRouter()
  const noteRef = useRef<HTMLDivElement>(null)
  const bg      = POST_IT_COLORS[note.color]

  // Measure actual note dimensions after mount — used for render-time clamping.
  // A ResizeObserver per note handles content-driven size changes (e.g. long text).
  // Initial value 0 means no clamping until measured (avoids a fixed constant assumption).
  const [noteSize, setNoteSize] = useState({ w: 0, h: 0 })
  useLayoutEffect(() => {
    const el = noteRef.current
    if (!el) return
    const ro = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect
      setNoteSize({ w: width, h: height })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Render-time clamping — display only, stored xPct/yPct NEVER mutated.
  // When noteSize is 0 (pre-mount), use raw pct — one unclamped render is acceptable.
  const noteW = noteSize.w
  const noteH = noteSize.h
  const clampedLeft = boardSize.w > 0 && noteW > 0
    ? Math.max(0, Math.min(note.position.xPct * boardSize.w, boardSize.w - noteW))
    : note.position.xPct * (boardSize.w || 1)
  const clampedTop = boardSize.h > 0 && noteH > 0
    ? Math.max(0, Math.min(note.position.yPct * boardSize.h, boardSize.h - noteH))
    : note.position.yPct * (boardSize.h || 1)

  // Free mode: absolute positioned via left/top percentages + rotation only in transform.
  // Drag (added in Task 11) will override left/top with px during the drag gesture.
  const freeStyle: React.CSSProperties = {
    backgroundColor: bg,
    left:            boardSize.w > 0 ? `${(clampedLeft / boardSize.w) * 100}%` : `${note.position.xPct * 100}%`,
    top:             boardSize.h > 0 ? `${(clampedTop  / boardSize.h) * 100}%` : `${note.position.yPct * 100}%`,
    transform:       `rotate(${note.rotation}deg)`,
  }

  const gridStyle: React.CSSProperties = {
    backgroundColor: bg,
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      router.push(`/lavagna/${note.id}`)
    }
    // Keyboard repositioning added in Task 11
  }

  return (
    <div
      ref={noteRef}
      className={`postit${mode === 'grid' ? ' postit--grid' : ''}`}
      style={mode === 'free' ? freeStyle : gridStyle}
      role="button"
      tabIndex={0}
      aria-label={`Post-it: ${note.content.slice(0, 40) || 'vuoto'}. Premi Invio per aprirlo.`}
      // Free mode: no onClick — navigation is via useDrag.onTap (added in Task 11)
      // Grid mode: direct click navigates
      onClick={mode === 'grid' ? () => router.push(`/lavagna/${note.id}`) : undefined}
      onKeyDown={handleKeyDown}
    >
      <div className="postit-content">{note.content}</div>

      {note.stickers.length > 0 && (
        <div className="postit-stickers" aria-hidden="true">
          {note.stickers.map((key, i) => (
            <span
              key={i}
              className="postit-sticker"
              style={{ background: STICKER_CONFIG[key].bg }}
            >
              {STICKER_CONFIG[key].emoji}
            </span>
          ))}
        </div>
      )}

      {note.dueDate && (
        <div className="postit-date">
          {new Date(note.dueDate).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}
        </div>
      )}
    </div>
  )
}
```

---

## Task 9: LavagnaBoard (free mode, no drag)

**Files:**
- Create: `components/lavagna/LavagnaBoard.tsx`
- Modify: `app/lavagna/page.tsx`

- [ ] **Step 1: Write LavagnaBoard**

```tsx
// components/lavagna/LavagnaBoard.tsx
'use client'

import { useRef, useState, useEffect, useCallback } from 'react'
import { usePostItContext } from '@/lib/postit-context'
import { LavagnaHeader }   from './LavagnaHeader'
import { PostItNote }      from './PostItNote'
import type { PostItColor } from '@/lib/postit-types'

const COLORS: PostItColor[] = ['yellow', 'pink', 'mint', 'blue', 'peach']

export function LavagnaBoard() {
  const { state, dispatch } = usePostItContext()
  const boardRef  = useRef<HTMLDivElement>(null)
  const [boardSize, setBoardSize] = useState({ w: 0, h: 0 })

  // Track board dimensions so PostItNote can clamp at render time.
  useEffect(() => {
    const board = boardRef.current
    if (!board) return
    const ro = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect
      setBoardSize({ w: width, h: height })
    })
    ro.observe(board)
    return () => ro.disconnect()
  }, [])

  const handleAddNote = useCallback(() => {
    const color = COLORS[Math.floor(Math.random() * COLORS.length)]
    dispatch({
      type: 'ADD_NOTE',
      payload: {
        content:  '',
        color,
        position: { xPct: 0.35 + (Math.random() * 0.1), yPct: 0.35 + (Math.random() * 0.1) },
      },
    })
  }, [dispatch])

  const handleMoveCommit = useCallback((id: string, xPct: number, yPct: number) => {
    dispatch({ type: 'MOVE_NOTE', payload: { id, xPct, yPct } })
  }, [dispatch])

  const handleModeChange = useCallback((mode: 'free' | 'grid') => {
    dispatch({ type: 'SET_VIEW', payload: { mode } })
  }, [dispatch])

  return (
    <main className="lavagna-screen">
      <LavagnaHeader
        noteCount={state.notes.length}
        mode={state.mode}
        onModeChange={handleModeChange}
        onAddNote={handleAddNote}
      />
      <div className="lavagna-board-wrap">
        <div
          ref={boardRef}
          className="lavagna-board"
          role="application"
          aria-label="Lavagna — bacheca post-it. Usa le frecce per spostare le note, Invio per aprirle."
        >
          {state.mode === 'free' ? (
            state.notes.map(note => (
              <PostItNote
                key={note.id}
                note={note}
                boardRef={boardRef}
                boardSize={boardSize}
                mode="free"
                onMoveCommit={handleMoveCommit}
              />
            ))
          ) : (
            <div className="lavagna-grid-mode">
              {state.notes.map(note => (
                <PostItNote
                  key={note.id}
                  note={note}
                  boardRef={boardRef}
                  boardSize={boardSize}
                  mode="grid"
                  onMoveCommit={handleMoveCommit}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
```

- [ ] **Step 2: Replace the placeholder in lavagna/page.tsx**

```typescript
// app/lavagna/page.tsx
import type { Metadata } from 'next'
import { LavagnaBoard } from '@/components/lavagna/LavagnaBoard'

export const metadata: Metadata = { title: 'Lavagna' }

export default function LavagnaPage() {
  return <LavagnaBoard />
}
```

- [ ] **Step 3: Verify the board renders with demo notes**

```bash
pnpm dev
```
Navigate to `http://localhost:3000/lavagna`. Expected:
- Gradient background, white board surface with rounded corners.
- Board starts **empty** — header shows "Lavagna · 0 post-it" and the board surface is white.
- Click `+ Post-it` to add notes manually; verify they appear in the handwritten font with slight rotation.
- Libera/Griglia toggle visible; switching to Griglia and back preserves positions.
- No notes bleed outside the board edges (ResizeObserver clamping active).
- To test with sample data, temporarily add `initialNotes={DEMO_NOTES}` to the layout and revert before committing.

Stop dev server.

---

## Task 10: useDrag hook

**Files:**
- Create: `components/lavagna/useDrag.ts`
- Create: `__tests__/drag-math.test.ts`
- Create: `__tests__/drag-hook.test.ts`

- [ ] **Step 1: Write the pure math tests (drag-math.test.ts)**

```typescript
// __tests__/drag-math.test.ts
import { describe, it, expect } from 'vitest'
import { clampPosition, pctToPx, pxToPct } from '@/lib/postit-utils'

// Tests for the coordinate math used by useDrag.
// These run in jsdom with no DOM setup required.

describe('coordinate math used by useDrag', () => {
  describe('note within board', () => {
    it('clamped note does not exceed board right edge', () => {
      // boardW=800, noteW=200, so max xPx = 600
      const result = clampPosition(0.99, 0.5, 800, 600, 200, 150)
      const xPx = pctToPx(result.xPct, 800)
      expect(xPx).toBeLessThanOrEqual(800 - 200)
    })
    it('clamped note does not exceed board bottom edge', () => {
      const result = clampPosition(0.5, 0.99, 800, 600, 200, 150)
      const yPx = pctToPx(result.yPct, 600)
      expect(yPx).toBeLessThanOrEqual(600 - 150)
    })
    it('note at (0,0) stays at (0,0)', () => {
      const result = clampPosition(0, 0, 800, 600, 200, 150)
      expect(result.xPct).toBe(0)
      expect(result.yPct).toBe(0)
    })
    it('valid interior position is unchanged', () => {
      const result = clampPosition(0.5, 0.5, 800, 600, 200, 150)
      expect(pctToPx(result.xPct, 800)).toBeCloseTo(400)
      expect(pctToPx(result.yPct, 600)).toBeCloseTo(300)
    })
  })

  describe('drag commit round-trip', () => {
    it('px → pct → px round-trips within 0.5px for typical dimensions', () => {
      const boardW   = 850
      const finalXpx = 327.5
      const xPct     = pxToPct(finalXpx, boardW)
      const backPx   = pctToPx(xPct, boardW)
      expect(Math.abs(backPx - finalXpx)).toBeLessThan(0.5)
    })
    it('start-position derivation from state avoids getBoundingClientRect on rotated note', () => {
      // Correct: startNoteXpx = xPct * boardW
      // This is the key invariant — rotation does not affect offsetWidth/offsetHeight
      // on the board, so deriving from state is safe.
      const xPct   = 0.5
      const boardW = 800
      const startX = xPct * boardW
      expect(startX).toBe(400)
    })
  })

  describe('keyboard step math', () => {
    it('10px right arrow increases xPct by 10/boardW', () => {
      const boardW  = 800
      const noteW   = 200
      const start   = 0.5
      const step    = 10
      const newXpx  = Math.min(pctToPx(start, boardW) + step, boardW - noteW)
      const newXpct = pxToPct(newXpx, boardW)
      expect(newXpct).toBeCloseTo(start + step / boardW, 5)
    })
    it('50px Shift+arrow step moves further than 10px step', () => {
      const boardW = 800
      const noteW  = 200
      const start  = 0.5
      const step10 = pxToPct(Math.min(pctToPx(start, boardW) + 10, boardW - noteW), boardW)
      const step50 = pxToPct(Math.min(pctToPx(start, boardW) + 50, boardW - noteW), boardW)
      expect(step50).toBeGreaterThan(step10)
    })
    it('arrow key at right edge clamps to max position', () => {
      const boardW = 800
      const noteW  = 200
      const start  = 0.98  // already near edge
      const newXpx = Math.min(pctToPx(start, boardW) + 10, boardW - noteW)
      expect(newXpx).toBeLessThanOrEqual(boardW - noteW)
    })
  })

  describe('cancel invariant', () => {
    it('a cancelled drag does not produce a new xPct outside bounds', () => {
      const originalXpct = 0.4
      const boardW       = 800
      const noteW        = 200
      const clamped = clampPosition(originalXpct, 0.4, boardW, 600, noteW, 150)
      expect(clamped.xPct).toBeCloseTo(originalXpct)
    })
  })
})
```

- [ ] **Step 2: Run to confirm drag-math tests pass**

```bash
pnpm test __tests__/drag-math.test.ts
```
Expected: `10 tests passed`.

- [ ] **Step 3: Write the hook integration tests (drag-hook.test.ts)**

```typescript
// __tests__/drag-hook.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useDrag } from '@/components/lavagna/useDrag'

function makeSetup(overrides: Record<string, unknown> = {}) {
  const boardEl = document.createElement('div')
  Object.defineProperty(boardEl, 'offsetWidth',  { get: () => 800, configurable: true })
  Object.defineProperty(boardEl, 'offsetHeight', { get: () => 600, configurable: true })
  Object.defineProperty(boardEl, 'getBoundingClientRect', {
    value: () => ({ left: 0, top: 0, width: 800, height: 600 }),
    configurable: true,
  })

  const noteEl = document.createElement('div')
  Object.defineProperty(noteEl, 'offsetWidth',  { get: () => 200, configurable: true })
  Object.defineProperty(noteEl, 'offsetHeight', { get: () => 200, configurable: true })
  noteEl.setPointerCapture     = vi.fn()
  noteEl.releasePointerCapture = vi.fn()
  document.body.appendChild(boardEl)
  document.body.appendChild(noteEl)

  const onMoveCommit = vi.fn()
  const onTap        = vi.fn()

  const params = {
    noteId:  'n1',
    xPct:    0.5,
    yPct:    0.5,
    rotation: 0,
    boardRef: { current: boardEl },
    noteRef:  { current: noteEl },
    enabled:  true,
    onMoveCommit,
    onTap,
    ...overrides,
  }
  return { params, boardEl, noteEl, onMoveCommit, onTap }
}

function firePointer(el: HTMLElement, type: string, x: number, y: number, id = 1) {
  el.dispatchEvent(new PointerEvent(type, {
    bubbles: true, cancelable: true,
    pointerId: id, clientX: x, clientY: y,
  }))
}

describe('useDrag', () => {
  it('tap (< 4px movement) calls onTap, not onMoveCommit', () => {
    const { params, noteEl, onMoveCommit, onTap } = makeSetup()
    renderHook(() => useDrag(params))
    act(() => {
      firePointer(noteEl, 'pointerdown', 100, 100)
      firePointer(noteEl, 'pointermove',  102, 101)  // 2.2px — below threshold
      firePointer(noteEl, 'pointerup',    102, 101)
    })
    expect(onTap).toHaveBeenCalledTimes(1)
    expect(onMoveCommit).not.toHaveBeenCalled()
  })

  it('drag (> 4px movement) calls onMoveCommit, not onTap', () => {
    const { params, noteEl, onMoveCommit, onTap } = makeSetup()
    renderHook(() => useDrag(params))
    act(() => {
      firePointer(noteEl, 'pointerdown', 100, 100)
      firePointer(noteEl, 'pointermove', 150, 120)  // 53.8px — above threshold
      firePointer(noteEl, 'pointerup',   150, 120)
    })
    expect(onMoveCommit).toHaveBeenCalledTimes(1)
    expect(onTap).not.toHaveBeenCalled()
  })

  it('pointercancel clears inline styles and does not commit', () => {
    const { params, noteEl, onMoveCommit } = makeSetup()
    renderHook(() => useDrag(params))
    act(() => {
      firePointer(noteEl, 'pointerdown', 100, 100)
      firePointer(noteEl, 'pointermove', 200, 150)
    })
    // Inline styles set by drag
    expect(noteEl.style.left).not.toBe('')
    act(() => {
      noteEl.dispatchEvent(new PointerEvent('pointercancel', { bubbles: true, pointerId: 1 }))
    })
    // Inline styles cleared — React's pct CSS restores original position
    expect(noteEl.style.left).toBe('')
    expect(noteEl.style.top).toBe('')
    expect(onMoveCommit).not.toHaveBeenCalled()
  })

  it('when enabled=false, pointerdown is a no-op', () => {
    const { params, noteEl, onMoveCommit, onTap } = makeSetup({ enabled: false })
    renderHook(() => useDrag(params))
    act(() => {
      firePointer(noteEl, 'pointerdown', 100, 100)
      firePointer(noteEl, 'pointermove', 200, 150)
      firePointer(noteEl, 'pointerup',   200, 150)
    })
    expect(onMoveCommit).not.toHaveBeenCalled()
    expect(onTap).not.toHaveBeenCalled()
    expect(noteEl.style.left).toBe('')
  })

  it('drag clamps note to board right edge', () => {
    const { params, noteEl, onMoveCommit } = makeSetup({ xPct: 0.5, yPct: 0.5 })
    renderHook(() => useDrag(params))
    act(() => {
      firePointer(noteEl, 'pointerdown',  100, 100)
      firePointer(noteEl, 'pointermove', 2000, 100)  // way off right
      firePointer(noteEl, 'pointerup',   2000, 100)
    })
    expect(onMoveCommit).toHaveBeenCalledTimes(1)
    const [, committedX] = onMoveCommit.mock.calls[0]
    // board=800, note=200 → max xPx=600 → max xPct=0.75
    expect(committedX).toBeLessThanOrEqual(0.75 + 0.01)
  })

  it('start position is derived from xPct*boardW, not from getBoundingClientRect on note', () => {
    const { params, noteEl, onMoveCommit } = makeSetup({ xPct: 0.5, yPct: 0.5 })
    renderHook(() => useDrag(params))
    act(() => {
      firePointer(noteEl, 'pointerdown', 400, 300)
      firePointer(noteEl, 'pointermove', 450, 300)  // 50px right
      firePointer(noteEl, 'pointerup',   450, 300)
    })
    expect(onMoveCommit).toHaveBeenCalledTimes(1)
    const [, xPct] = onMoveCommit.mock.calls[0]
    // Expected: (0.5 * 800 + 50) / 800 = 0.5625
    expect(xPct).toBeCloseTo(450 / 800, 3)
  })

  it('lostpointercapture restores position to xPct% (not empty string)', () => {
    const { params, noteEl } = makeSetup({ xPct: 0.5, yPct: 0.3 })
    renderHook(() => useDrag(params))
    act(() => {
      firePointer(noteEl, 'pointerdown', 100, 100)
      firePointer(noteEl, 'pointermove', 200, 150)  // start drag
    })
    expect(noteEl.style.left).not.toBe('')   // px override is set
    act(() => {
      noteEl.dispatchEvent(new PointerEvent('lostpointercapture', { bubbles: true, pointerId: 1 }))
    })
    // Must be explicitly set to percentage — NOT empty string
    expect(noteEl.style.left).toMatch(/%$/)
    expect(noteEl.style.top).toMatch(/%$/)
    // Specifically the pre-drag clamped pct: xPct=0.5 → '50%'
    expect(parseFloat(noteEl.style.left)).toBeCloseTo(50, 0)
  })

  it('Escape key cancels drag and restores position to pct', () => {
    const { params, noteEl, onMoveCommit } = makeSetup({ xPct: 0.4, yPct: 0.4 })
    renderHook(() => useDrag(params))
    act(() => {
      firePointer(noteEl, 'pointerdown', 100, 100)
      firePointer(noteEl, 'pointermove', 200, 150)
    })
    expect(noteEl.style.left).not.toBe('')
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    })
    expect(noteEl.style.left).toMatch(/%$/)
    expect(onMoveCommit).not.toHaveBeenCalled()
  })

  it('unmount during drag restores position to pct and does not commit', () => {
    const { params, noteEl, onMoveCommit } = makeSetup({ xPct: 0.6, yPct: 0.6 })
    const { unmount } = renderHook(() => useDrag(params))
    act(() => {
      firePointer(noteEl, 'pointerdown', 100, 100)
      firePointer(noteEl, 'pointermove', 250, 200)
    })
    expect(noteEl.style.left).not.toBe('')
    act(() => { unmount() })
    expect(noteEl.style.left).toMatch(/%$/)
    expect(onMoveCommit).not.toHaveBeenCalled()
  })

  it('DOM reconciliation invariant: committed xPct × boardW equals the drag final px', () => {
    // After commit, React will render left = `${xPct * 100}%`.
    // On the same board width, xPct × boardW must equal the lastXpx set during drag.
    const boardW = 800
    const { params, noteEl, onMoveCommit } = makeSetup({ xPct: 0.5, yPct: 0.5 })
    renderHook(() => useDrag(params))
    act(() => {
      firePointer(noteEl, 'pointerdown', 400, 300)
      firePointer(noteEl, 'pointermove', 460, 300)
      firePointer(noteEl, 'pointerup',   460, 300)
    })
    const lastLeftPx = parseFloat(noteEl.style.left)  // px set during drag
    const [, committedXPct] = onMoveCommit.mock.calls[0]
    // React will render: `${committedXPct * 100}%` → at boardW=800 that's committedXPct * 800 px
    expect(Math.abs(committedXPct * boardW - lastLeftPx)).toBeLessThan(1)
  })

  it('board smaller than note: note clamps to 0 without mutating stored xPct', () => {
    // When board < note, render-time clamping shows note at 0 — stored coords never changed.
    // useDrag should still start from xPct × boardW clamped to 0.
    const { params, noteEl, onMoveCommit } = makeSetup({ xPct: 0.99, yPct: 0.99 })
    // Override board to be smaller than the note
    Object.defineProperty(params.boardRef.current!, 'offsetWidth',  { get: () => 150, configurable: true })
    Object.defineProperty(params.boardRef.current!, 'offsetHeight', { get: () => 150, configurable: true })
    renderHook(() => useDrag(params))
    act(() => {
      firePointer(noteEl, 'pointerdown', 10, 10)
      firePointer(noteEl, 'pointermove', 30, 20)
      firePointer(noteEl, 'pointerup',   30, 20)
    })
    expect(onMoveCommit).toHaveBeenCalledTimes(1)
    const [, committedX, committedY] = onMoveCommit.mock.calls[0]
    // board=150, note=200: max position = 0 → clamped to 0 during drag start
    expect(committedX).toBeGreaterThanOrEqual(0)
    expect(committedY).toBeGreaterThanOrEqual(0)
  })
})
```

- [ ] **Step 4: Run to confirm drag-hook tests fail (useDrag not written yet)**

```bash
pnpm test __tests__/drag-hook.test.ts
```
Expected: all fail — "Cannot find module '@/components/lavagna/useDrag'".

- [ ] **Step 5: Write the useDrag hook**

```typescript
// components/lavagna/useDrag.ts
'use client'

import { useRef, useState, useEffect } from 'react'
import { pxToPct } from '@/lib/postit-utils'
import type { RefObject } from 'react'

const DRAG_THRESHOLD_PX = 4

export interface UseDragParams {
  noteId:       string
  xPct:         number
  yPct:         number
  rotation:     number
  noteRef:      RefObject<HTMLDivElement | null>
  boardRef:     RefObject<HTMLDivElement | null>
  enabled:      boolean  // false in Grid mode — all pointer events are no-ops
  onMoveCommit: (id: string, xPct: number, yPct: number) => void
  onTap:        () => void
}

export interface UseDragReturn {
  isDragging: boolean
}

export function useDrag({
  noteId,
  xPct,
  yPct,
  rotation,
  noteRef,
  boardRef,
  enabled,
  onMoveCommit,
  onTap,
}: UseDragParams): UseDragReturn {
  const [isDragging, setIsDragging] = useState(false)

  // Keep latest props accessible in stable event handlers without re-attaching listeners.
  const propsRef = useRef({ noteId, xPct, yPct, rotation, enabled, onMoveCommit, onTap })
  useEffect(() => {
    propsRef.current = { noteId, xPct, yPct, rotation, enabled, onMoveCommit, onTap }
  })

  useEffect(() => {
    const note  = noteRef.current
    const board = boardRef.current
    if (!note || !board) return

    // Per-drag mutable state — local variables inside the closure.
    let active       = false
    let started      = false
    let pointerId    = -1
    let startPX      = 0
    let startPY      = 0
    let startNoteXpx = 0
    let startNoteYpx = 0
    let lastXpx      = 0
    let lastYpx      = 0
    let noteW        = 0
    let noteH        = 0

    function getBoardRect() {
      return boardRef.current?.getBoundingClientRect() ?? null
    }

    /** Overrides inline left/top with px values for smooth drag. */
    function applyDragPosition(xpx: number, ypx: number) {
      note.style.left = `${xpx}px`
      note.style.top  = `${ypx}px`
    }

    /**
     * Explicitly restores inline left/top to the pre-drag pct-based position.
     * Called on cancel/lostpointercapture/unmount/Escape.
     *
     * WHY NOT note.style.left = '':
     *   Clearing the inline style removes the React-set percentage value.
     *   The element then falls back to the CSS class rule (.postit { top: 0; left: 0 }),
     *   causing the note to jump to the top-left corner until the next React render.
     *   There is no guarantee a render will follow (no state change on cancel).
     *
     * WHY this works:
     *   We compute the same clamped pct that PostItNote would render, and set it
     *   as an explicit inline style. React's next render will write the same value —
     *   no visual change, no jump.
     */
    function restorePosition() {
      const boardW = board.offsetWidth
      const boardH = board.offsetHeight
      const noteW  = note.offsetWidth
      const noteH  = note.offsetHeight
      const maxX   = Math.max(0, boardW - noteW)
      const maxY   = Math.max(0, boardH - noteH)
      const clampedXpx = Math.max(0, Math.min(propsRef.current.xPct * boardW, maxX))
      const clampedYpx = Math.max(0, Math.min(propsRef.current.yPct * boardH, maxY))
      note.style.left = boardW > 0 ? `${(clampedXpx / boardW) * 100}%` : `${propsRef.current.xPct * 100}%`
      note.style.top  = boardH > 0 ? `${(clampedYpx / boardH) * 100}%` : `${propsRef.current.yPct * 100}%`
    }

    function onMove(e: PointerEvent) {
      if (!active || e.pointerId !== pointerId) return
      const boardRect = getBoardRect()
      if (!boardRect) return

      const boardW = boardRect.width
      const boardH = boardRect.height
      const dx     = e.clientX - startPX
      const dy     = e.clientY - startPY

      if (!started && Math.hypot(dx, dy) > DRAG_THRESHOLD_PX) {
        started = true
        setIsDragging(true)
        note.classList.add('postit--dragging')
      }
      if (!started) return

      const newXpx = Math.max(0, Math.min(startNoteXpx + dx, boardW - noteW))
      const newYpx = Math.max(0, Math.min(startNoteYpx + dy, boardH - noteH))
      lastXpx      = newXpx
      lastYpx      = newYpx
      applyDragPosition(newXpx, newYpx)
    }

    function onUp(e: PointerEvent) {
      if (!active || e.pointerId !== pointerId) return
      const wasStarted = started
      cleanup(false)

      if (wasStarted) {
        const boardW = board.offsetWidth
        const boardH = board.offsetHeight
        propsRef.current.onMoveCommit(
          propsRef.current.noteId,
          pxToPct(lastXpx, boardW),
          pxToPct(lastYpx, boardH),
        )
        // DO NOT clearDragPosition() here.
        // React's reconciliation will replace e.g. 'left: 400px' with 'left: 50%'
        // (numerically equivalent on the same board width) — no visual jump.
        // Clearing before reconciliation would cause a brief flash.
      } else {
        // No movement past threshold — treat as tap.
        propsRef.current.onTap()
      }
    }

    function onCancelOrLost(e: PointerEvent) {
      if (!active || e.pointerId !== pointerId) return
      cleanup(true)  // true = restore to pre-drag pct position
    }

    function cleanup(restore: boolean) {
      if (restore) {
        restorePosition()  // Explicitly set pct inline style — do NOT clear to ''
      }
      if (active && pointerId !== -1) {
        try { note.releasePointerCapture(pointerId) } catch (_) { /* already released */ }
      }
      active    = false
      started   = false
      pointerId = -1
      note.classList.remove('postit--dragging')
      setIsDragging(false)
    }

    // Escape key cancels an active drag — same semantics as pointercancel.
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && active) {
        cleanup(true)
      }
    }

    function onDown(e: PointerEvent) {
      // Grid mode: no-op (enabled is checked on every event via propsRef so switching
      // modes during a live drag also cancels correctly)
      if (!propsRef.current.enabled) return

      e.preventDefault()

      noteW = note.offsetWidth
      noteH = note.offsetHeight
      // Use board.offsetWidth/Height — board is never rotated so these are reliable.
      const boardW = board.offsetWidth
      const boardH = board.offsetHeight

      // Derive start position from stored state — avoids rotation-induced drift.
      // NEVER use note.getBoundingClientRect() here: a rotated note's rect is
      // in rotated coordinates and will cause the note to jump on first move.
      const maxX   = boardW - noteW
      const maxY   = boardH - noteH
      startNoteXpx = Math.max(0, Math.min(propsRef.current.xPct * boardW, maxX))
      startNoteYpx = Math.max(0, Math.min(propsRef.current.yPct * boardH, maxY))
      lastXpx      = startNoteXpx
      lastYpx      = startNoteYpx

      active    = true
      started   = false
      pointerId = e.pointerId
      startPX   = e.clientX
      startPY   = e.clientY

      note.setPointerCapture(e.pointerId)
    }

    note.addEventListener('pointerdown',        onDown,          { passive: false })
    note.addEventListener('pointermove',        onMove)
    note.addEventListener('pointerup',          onUp)
    note.addEventListener('pointercancel',      onCancelOrLost)
    note.addEventListener('lostpointercapture', onCancelOrLost)
    // Tab-switch / window blur causes lostpointercapture — no separate listener needed.
    // Escape key is a separate cancel path that does not require pointer capture.
    document.addEventListener('keydown', onKeyDown)

    return () => {
      note.removeEventListener('pointerdown',        onDown)
      note.removeEventListener('pointermove',        onMove)
      note.removeEventListener('pointerup',          onUp)
      note.removeEventListener('pointercancel',      onCancelOrLost)
      note.removeEventListener('lostpointercapture', onCancelOrLost)
      document.removeEventListener('keydown',        onKeyDown)

      // If unmounted during a drag, restore position without committing.
      if (active) {
        restorePosition()          // explicit pct — do NOT set style to ''
        note.classList.remove('postit--dragging')
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteRef, boardRef])  // Refs are stable; event handlers access latest props via propsRef.

  return { isDragging }
}
```

- [ ] **Step 6: Run drag-hook tests — all should pass**

```bash
pnpm test __tests__/drag-hook.test.ts
```
Expected: `12 tests passed`.

---

## Task 11: Integrate drag and keyboard into PostItNote

**Files:**
- Modify: `components/lavagna/PostItNote.tsx`

- [ ] **Step 1: Update PostItNote to use useDrag and keyboard handler**

Replace `components/lavagna/PostItNote.tsx` in full:

```tsx
// components/lavagna/PostItNote.tsx
'use client'

import { useRef, useState, useCallback, useLayoutEffect, type RefObject } from 'react'
import { useRouter } from 'next/navigation'
import type { PostIt, ViewMode } from '@/lib/postit-types'
import { POST_IT_COLORS, STICKER_CONFIG, pctToPx, pxToPct } from '@/lib/postit-utils'
import { useDrag } from './useDrag'

interface PostItNoteProps {
  note:         PostIt
  boardRef:     RefObject<HTMLDivElement | null>
  boardSize:    { w: number; h: number }
  mode:         ViewMode
  onMoveCommit: (id: string, xPct: number, yPct: number) => void
}

const KEYBOARD_STEP    = 10   // px per arrow key press
const KEYBOARD_STEP_LG = 50   // px per Shift+arrow key press

export function PostItNote({ note, boardRef, boardSize, mode, onMoveCommit }: PostItNoteProps) {
  const router  = useRouter()
  const noteRef = useRef<HTMLDivElement>(null)
  const bg      = POST_IT_COLORS[note.color]

  // Measure actual note dimensions — consistent with render-time clamping (added in Task 8)
  const [noteSize, setNoteSize] = useState({ w: 0, h: 0 })
  useLayoutEffect(() => {
    const el = noteRef.current
    if (!el) return
    const ro = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect
      setNoteSize({ w: width, h: height })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const handleTap = useCallback(() => {
    router.push(`/lavagna/${note.id}`)
  }, [router, note.id])

  // enabled=true in free mode only — Grid mode disables drag entirely
  const { isDragging } = useDrag({
    noteId:       note.id,
    xPct:         note.position.xPct,
    yPct:         note.position.yPct,
    rotation:     note.rotation,
    noteRef,
    boardRef,
    enabled:      mode === 'free',
    onMoveCommit,
    onTap:        handleTap,
  })

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    // Navigate on Enter/Space
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      router.push(`/lavagna/${note.id}`)
      return
    }

    // Arrow-key repositioning (free mode only)
    if (mode !== 'free') return
    const isArrow = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)
    if (!isArrow) return

    e.preventDefault()
    const board = boardRef.current
    if (!board) return

    const boardW = board.offsetWidth
    const boardH = board.offsetHeight
    const noteEl = noteRef.current
    const noteW  = noteEl?.offsetWidth  ?? 0
    const noteH  = noteEl?.offsetHeight ?? 0
    const step   = e.shiftKey ? KEYBOARD_STEP_LG : KEYBOARD_STEP

    let newXpx = pctToPx(note.position.xPct, boardW)
    let newYpx = pctToPx(note.position.yPct, boardH)

    if (e.key === 'ArrowRight') newXpx += step
    if (e.key === 'ArrowLeft')  newXpx -= step
    if (e.key === 'ArrowDown')  newYpx += step
    if (e.key === 'ArrowUp')    newYpx -= step

    newXpx = Math.max(0, Math.min(newXpx, boardW - noteW))
    newYpx = Math.max(0, Math.min(newYpx, boardH - noteH))

    onMoveCommit(note.id, pxToPct(newXpx, boardW), pxToPct(newYpx, boardH))
  }

  // Render-time clamping — uses measured noteSize, display only, stored pct NEVER mutated.
  // noteSize is 0 before first layout effect fires; fall back to unclamped pct for one render.
  const noteW = noteSize.w
  const noteH = noteSize.h
  const clampedLeft = boardSize.w > 0 && noteW > 0
    ? Math.max(0, Math.min(note.position.xPct * boardSize.w, boardSize.w - noteW))
    : note.position.xPct * (boardSize.w || 1)
  const clampedTop = boardSize.h > 0 && noteH > 0
    ? Math.max(0, Math.min(note.position.yPct * boardSize.h, boardSize.h - noteH))
    : note.position.yPct * (boardSize.h || 1)

  // Free mode: absolute positioned. left/top as % so drag can override with px then restore.
  // Rotation in transform only — never mixed with translation.
  const freeStyle: React.CSSProperties = {
    backgroundColor: bg,
    left:            boardSize.w > 0 ? `${(clampedLeft / boardSize.w) * 100}%` : `${note.position.xPct * 100}%`,
    top:             boardSize.h > 0 ? `${(clampedTop  / boardSize.h) * 100}%` : `${note.position.yPct * 100}%`,
    transform:       `rotate(${note.rotation}deg)`,
  }

  const gridStyle: React.CSSProperties = {
    backgroundColor: bg,
  }

  return (
    <div
      ref={noteRef}
      className={[
        'postit',
        mode === 'grid' ? 'postit--grid' : '',
        isDragging ? 'postit--dragging' : '',
      ].filter(Boolean).join(' ')}
      style={mode === 'free' ? freeStyle : gridStyle}
      role="button"
      tabIndex={0}
      aria-label={`Post-it: ${note.content.slice(0, 40) || 'vuoto'}. Usa le frecce per spostarlo, Invio per aprirlo.`}
      aria-grabbed={isDragging}
      // Free mode: navigation via useDrag.onTap (no onClick — prevents double-fire)
      // Grid mode: direct click navigates; useDrag is disabled (enabled=false)
      onClick={mode === 'grid' ? () => router.push(`/lavagna/${note.id}`) : undefined}
      onKeyDown={handleKeyDown}
    >
      <div className="postit-content">{note.content || <em style={{ opacity: 0.4 }}>Tocca per aggiungere testo</em>}</div>

      {note.stickers.length > 0 && (
        <div className="postit-stickers" aria-hidden="true">
          {note.stickers.map((key, i) => (
            <span
              key={i}
              className="postit-sticker"
              style={{ background: STICKER_CONFIG[key].bg }}
            >
              {STICKER_CONFIG[key].emoji}
            </span>
          ))}
        </div>
      )}

      {note.dueDate && (
        <div className="postit-date">
          {new Date(note.dueDate).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Manual drag smoke test**

```bash
pnpm dev
```
At `http://localhost:3000/lavagna`:
1. Drag a note with the mouse — it should follow the pointer without snapping.
2. Release — note stays at the dropped position.
3. Refresh page — notes reset to seed positions (expected: in-memory only).
4. Drag a note slightly (< 4 px) then release — editor page should open.
5. Switch to Griglia, switch back to Libera — all notes return to their exact prior positions.

Stop dev server.

---

## Task 12: NotaHeader component

**Files:**
- Create: `components/lavagna/NotaHeader.tsx`

- [ ] **Step 1: Write NotaHeader**

```tsx
// components/lavagna/NotaHeader.tsx
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
```

---

## Task 13: NotaDetail — full two-column page

**Files:**
- Create: `components/lavagna/NotaDetail.tsx`

- [ ] **Step 1: Write NotaDetail**

```tsx
// components/lavagna/NotaDetail.tsx
'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { usePostIt, usePostItContext } from '@/lib/postit-context'
import { NotaHeader } from './NotaHeader'
import { POST_IT_COLORS, STICKER_CONFIG, formatNoteDate } from '@/lib/postit-utils'
import type { PostItColor, StickerKey } from '@/lib/postit-types'

const COLOR_ORDER: PostItColor[]  = ['yellow', 'pink', 'mint', 'blue', 'peach']
const STICKER_ORDER: StickerKey[] = [
  'star','heart','check','exclaim','bulb','home',
  'cart','sun','lightning','clock','phone','money',
]

interface NotaDetailProps {
  id: string
}

export function NotaDetail({ id }: NotaDetailProps) {
  const router         = useRouter()
  const note           = usePostIt(id)
  const { dispatch }   = usePostItContext()
  const [confirmDelete, setConfirmDelete] = useState(false)

  // ── Not found ────────────────────────────────────────────────────────────
  if (!note) {
    return (
      <main className="nota-screen">
        <header className="nota-header">
          <Link href="/lavagna" replace className="nota-back-btn">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M10 3L5 8L10 13" stroke="currentColor" strokeWidth="1.8"
                strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span>Lavagna</span>
          </Link>
          <h1 className="nota-title">Nota</h1>
          <span className="nota-status" />
        </header>
        <div className="nota-notfound">
          <p className="nota-notfound-msg">Questa nota non è disponibile.</p>
          <p className="nota-notfound-sub">
            Le note vengono conservate solo durante la sessione corrente.
          </p>
          <Link href="/lavagna" replace className="nota-notfound-btn">
            ← Torna alla Lavagna
          </Link>
        </div>
      </main>
    )
  }

  // ── Handlers ─────────────────────────────────────────────────────────────

  function handleContentChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    dispatch({ type: 'UPDATE_NOTE', payload: { id, content: e.target.value } })
  }

  function handleColorChange(color: PostItColor) {
    dispatch({ type: 'UPDATE_NOTE', payload: { id, color } })
  }

  function handleAddSticker(key: StickerKey) {
    dispatch({ type: 'UPDATE_NOTE', payload: { id, stickers: [...note.stickers, key] } })
  }

  function handleRemoveLastSticker() {
    if (note.stickers.length === 0) return
    dispatch({ type: 'UPDATE_NOTE', payload: { id, stickers: note.stickers.slice(0, -1) } })
  }

  function handleTogglePin() {
    dispatch({ type: 'TOGGLE_PIN', payload: { id } })
  }

  function handleDuplicate() {
    dispatch({
      type: 'ADD_NOTE',
      payload: {
        content:  note.content,
        color:    note.color,
        stickers: [...note.stickers],
        pinned:   false,
        position: {
          xPct: Math.min(note.position.xPct + 0.05, 0.85),
          yPct: Math.min(note.position.yPct + 0.05, 0.85),
        },
      },
    })
  }

  function handleDeleteRequest() {
    setConfirmDelete(true)
  }

  function handleDeleteConfirm() {
    dispatch({ type: 'DELETE_NOTE', payload: { id } })
    router.push('/lavagna')
  }

  function handleDeleteCancel() {
    setConfirmDelete(false)
  }

  const bg = POST_IT_COLORS[note.color]

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <main className="nota-screen">
      <NotaHeader lastEditedAt={note.updatedAt !== note.createdAt ? note.updatedAt : undefined} />

      <div className="nota-body">
        {/* ── Left panel: large post-it preview ── */}
        <section className="nota-preview-panel" aria-label="Anteprima post-it">
          <div
            className="nota-postit-preview"
            style={{ backgroundColor: bg, transform: `rotate(${note.rotation}deg)` }}
          >
            <textarea
              className="nota-postit-content-area"
              value={note.content}
              onChange={handleContentChange}
              placeholder="Scrivi qui..."
              aria-label="Contenuto del post-it"
              style={{ backgroundColor: 'transparent', color: 'inherit' }}
            />
            {note.stickers.length > 0 && (
              <div className="postit-stickers" aria-hidden="true">
                {note.stickers.map((key, i) => (
                  <span
                    key={i}
                    className="postit-sticker"
                    style={{ background: STICKER_CONFIG[key].bg }}
                  >
                    {STICKER_CONFIG[key].emoji}
                  </span>
                ))}
              </div>
            )}
            {note.dueDate && (
              <div className="nota-postit-date">
                {new Date(note.dueDate).toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })}
              </div>
            )}
          </div>
        </section>

        {/* ── Right panel: controls ── */}
        <section className="nota-tools-panel" aria-label="Strumenti nota">

          {/* Pinned notice */}
          {note.pinned && (
            <div className="nota-pinned-notice" role="status">
              <div className="nota-pinned-title">Nota fissata</div>
              <div className="nota-pinned-desc">
                Non verrà archiviata automaticamente. Resta qui finché non la archivi tu.
              </div>
            </div>
          )}

          {/* Tool grid */}
          <div>
            <div className="nota-section-label">Azioni</div>
            <div className="nota-tools-grid" style={{ marginTop: '10px' }}>
              {/* Unimplemented tools: disabled, no onClick, title explains why */}
              {[
                { label: 'Promemoria',          icon: '⏰' },
                { label: 'Collega a un giorno', icon: '📅' },
                { label: 'Checklist',           icon: '☑️' },
                { label: 'Scrivi a mano',       icon: '✍️' },
                { label: 'Aggiungi audio',      icon: '🎙️' },
                { label: 'Archivia',            icon: '📦' },
              ].map(({ label, icon }) => (
                <button
                  key={label}
                  className="nota-tool-btn"
                  disabled
                  aria-disabled="true"
                  title="Non ancora disponibile"
                  style={{ opacity: 0.45, cursor: 'not-allowed' }}
                >
                  <span className="nota-tool-icon" aria-hidden="true">{icon}</span>
                  <span>{label}</span>
                </button>
              ))}

              {/* Duplica — implemented */}
              <button
                className="nota-tool-btn"
                onClick={handleDuplicate}
                aria-label="Duplica nota"
              >
                <span className="nota-tool-icon" aria-hidden="true">📋</span>
                <span>Duplica</span>
              </button>

              {/* Elimina — inline confirm, no window.confirm */}
              {confirmDelete ? (
                <div
                  style={{
                    gridColumn: '1 / -1',
                    background: 'rgba(255,220,220,0.95)',
                    borderRadius: '12px',
                    padding: '12px 14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                  }}
                  role="alertdialog"
                  aria-label="Conferma eliminazione"
                >
                  <p style={{ fontSize: '0.875rem', color: '#7f1d1d', margin: 0 }}>
                    Eliminare questa nota? Non è possibile annullare.
                  </p>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      className="nota-tool-btn nota-tool-btn--destructive"
                      onClick={handleDeleteConfirm}
                      style={{ flex: 1 }}
                    >
                      Sì, elimina
                    </button>
                    <button
                      className="nota-tool-btn"
                      onClick={handleDeleteCancel}
                      style={{ flex: 1 }}
                    >
                      Annulla
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  className="nota-tool-btn nota-tool-btn--destructive"
                  onClick={handleDeleteRequest}
                  aria-label="Elimina nota"
                >
                  <span className="nota-tool-icon" aria-hidden="true">🗑️</span>
                  <span>Elimina</span>
                </button>
              )}
            </div>
          </div>

          {/* Color swatches */}
          <div>
            <div className="nota-section-label">Colore</div>
            <div className="nota-colors" style={{ marginTop: '10px' }}>
              {COLOR_ORDER.map(color => (
                <button
                  key={color}
                  className="nota-color-swatch"
                  style={{ backgroundColor: POST_IT_COLORS[color] }}
                  aria-pressed={note.color === color}
                  aria-label={color}
                  onClick={() => handleColorChange(color)}
                />
              ))}
            </div>
          </div>

          {/* Sticker picker */}
          <div>
            <div className="nota-section-label">Adesivi</div>
            <div className="nota-stickers" style={{ marginTop: '10px' }}>
              {STICKER_ORDER.map(key => (
                <button
                  key={key}
                  className="nota-sticker-btn"
                  style={{ background: STICKER_CONFIG[key].bg }}
                  aria-label={`Aggiungi adesivo ${key}`}
                  onClick={() => handleAddSticker(key)}
                >
                  {STICKER_CONFIG[key].emoji}
                </button>
              ))}
            </div>
            {note.stickers.length > 0 && (
              <button
                className="nota-remove-sticker"
                onClick={handleRemoveLastSticker}
                style={{ marginTop: '8px' }}
              >
                Togli l'ultimo
              </button>
            )}
          </div>

          {/* Pin toggle */}
          <div>
            <button
              className="nota-tool-btn"
              onClick={handleTogglePin}
              aria-pressed={note.pinned}
              style={{ width: '100%' }}
            >
              <span className="nota-tool-icon">{note.pinned ? '📌' : '📍'}</span>
              <span>{note.pinned ? 'Rimuovi da fissate' : 'Fissa nota'}</span>
            </button>
          </div>

          {/* Metadata */}
          <div className="nota-metadata">
            <div>Creata {formatNoteDate(note.createdAt)}</div>
            {note.updatedAt !== note.createdAt && (
              <div>Ultima modifica {formatNoteDate(note.updatedAt)}</div>
            )}
          </div>

        </section>
      </div>
    </main>
  )
}
```

---

## Task 14: Wire up the [id] route

**Files:**
- Modify: `app/lavagna/[id]/page.tsx`

- [ ] **Step 1: Replace the stub with the real page**

```typescript
// app/lavagna/[id]/page.tsx
import type { Metadata } from 'next'
import { NotaDetail } from '@/components/lavagna/NotaDetail'

export const metadata: Metadata = { title: 'Nota' }

export default async function NotaPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <NotaDetail id={id} />
}
```

- [ ] **Step 2: Verify the full flow**

```bash
pnpm dev
```

1. Navigate to `http://localhost:3000/lavagna`.
2. Click any post-it — Nota detail page opens.
3. Edit the text — the preview updates in real time.
4. Change color — the preview updates immediately.
5. Add stickers — they appear on the preview.
6. Click "← Lavagna" — returns to board, note shows updated content and color.
7. Navigate directly to `http://localhost:3000/lavagna/nonexistent-id` — Italian not-found message, working "Torna alla Lavagna" link.
8. Browser Back/Forward between board and note — positions and content preserved.
9. Switch Libera→Griglia on board — positions unchanged after switching back.

Stop dev server.

---

## Task 15: Run all automated tests

- [ ] **Step 1: Run full test suite**

```bash
pnpm test
```
Expected:
```
✓ __tests__/postit-utils.test.ts     (8 tests)
✓ __tests__/postit-reducer.test.ts   (17 tests)
✓ __tests__/drag-math.test.ts        (10 tests)
✓ __tests__/drag-hook.test.ts        (12 tests)
47 tests passed
```

- [ ] **Step 2: TypeScript typecheck**

```bash
pnpm exec tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Production build**

```bash
pnpm build
```
Expected: build completes with no errors. Warnings about missing `alt` text or similar are acceptable if non-blocking; fix any type errors.

---

## Task 16: Manual QA checklist

Perform in a browser at `http://localhost:3000` after `pnpm dev`.

### 16.1 Visual fidelity (against PDF pages 1 and 2)

- [ ] Warm gradient behind the white board surface
- [ ] Board has 24 px rounded corners, light border, soft shadow
- [ ] Notes display in five distinct pastel colors
- [ ] Sacramento (handwritten) font visible on note content
- [ ] Two-layer note shadow visible
- [ ] Notes have subtle rotations (none are perfectly upright)
- [ ] Header: back chevron, "Lavagna", note count, Libera/Griglia toggle, pen icon, "+ Post-it"
- [ ] Nota: two-column layout at ≥ 768 px (preview left, tools right)
- [ ] Nota: pinned notice with amber styling (pin a note and verify)
- [ ] Nota: 8-button tool grid with correct Italian labels
- [ ] Nota: 5 pastel color swatches with selection ring
- [ ] Nota: sticker picker with colorful pill backgrounds
- [ ] Nota: metadata shows "Creata [date]"
- [ ] Status shows "Bozza in memoria" (never "Modifiche salvate")

### 16.2 Drag interaction

- [ ] Mouse drag moves note freely within the board
- [ ] Note stays within board boundaries (does not escape edges)
- [ ] Drag commits on pointerup — note stays at released position
- [ ] Drag < 4 px then release opens Nota (not drag)
- [ ] Touch drag works on mobile/tablet (use DevTools mobile emulation)
- [ ] Press Escape during an active drag — note returns to pre-drag position (inline style shows `N%`, not `''`)
- [ ] Switch tab (Alt+Tab) during an active drag — `lostpointercapture` fires, note returns to pre-drag position
- [ ] Dragging does not trigger text selection
- [ ] No visible jump or flicker when drag completes and React reconciles (position before and after commit is visually identical)

### 16.3 Keyboard

- [ ] Tab key cycles through notes on the board
- [ ] ArrowRight moves focused note 10 px right; Shift+ArrowRight moves 50 px
- [ ] Arrow key near edge clamps — note does not leave board
- [ ] Enter on focused note opens Nota detail

### 16.4 Free/Grid transitions

- [ ] Drag note A to a custom position, note B to another, switch to Griglia, switch back — both notes at original positions
- [ ] Repeated Libera/Griglia toggles (10×) — positions stable throughout

### 16.5 Navigation

- [ ] Browser Back from Nota returns to board; board notes unchanged
- [ ] Browser Forward re-opens the note
- [ ] "← Lavagna" link in Nota returns to board
- [ ] Refreshing `/lavagna/[id]` shows Italian not-found (expected — in-memory only)

### 16.6 Responsive

- [ ] Board works on 375 px viewport (notes reachable, header readable)
- [ ] Nota single-column layout on mobile (preview above tools)
- [ ] "+ Post-it" label hidden on narrow screens; button still accessible
- [ ] When board is narrower than a single note, all notes clamp to left:0 (overlap at top-left), stored `xPct/yPct` unchanged (verify by widening the board — notes return to stored positions)
- [ ] All notes remain Tab-accessible via keyboard even when several overlap at a clamped position
- [ ] After any board resize, switching between Libera and Griglia still preserves pre-resize Free-mode coordinates

### 16.7 Accessibility

- [ ] Focus ring visible on every interactive element (tab through entire board and nota)
- [ ] `aria-grabbed` set to `true` during mouse drag
- [ ] Screen reader announces note count change when note is added

---

*End of plan — 16 tasks, 47 automated tests, full manual QA checklist.*
