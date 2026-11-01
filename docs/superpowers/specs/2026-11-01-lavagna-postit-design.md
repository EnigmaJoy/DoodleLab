# Lavagna & Nota — Design Specification (rev 2)

**Date:** 2026-11-01 (revised after review)
**Branch:** `feature/postit-core`
**Visual reference:** `Agenda - bozze tavole-selection (4).pdf` — page 1 (Lavagna board), page 2 (Nota detail). Authoritative visual baseline for all design decisions.
**Scope:** `prototypes/ui-shell` — Lavagna board and Nota detail only.
Unrelated sections (OAuth, Esercizi, Calendario, Oggi, Quaderno, Inbox) are out of scope.

---

## 1. Data Model

### 1.1 `PostIt` type

```typescript
interface PostIt {
  id:        string        // crypto.randomUUID() on creation
  content:   string        // raw text
  color:     PostItColor
  rotation:  number        // degrees; range −3…+3; fixed at creation
  position: {
    xPct:    number        // 0–1 fraction of board's usable width
    yPct:    number        // 0–1 fraction of board's usable height
  }
  stickers:  StickerKey[]
  pinned:    boolean
  createdAt: string        // ISO-8601
  updatedAt: string        // ISO-8601
  dueDate?:  string        // ISO-8601, optional
}
```

### 1.2 Color tokens

```typescript
type PostItColor = 'yellow' | 'pink' | 'mint' | 'blue' | 'peach'

const POST_IT_COLORS: Record<PostItColor, string> = {
  yellow: '#FFF9B0',
  pink:   '#FFD6E4',
  mint:   '#C8F0D8',
  blue:   '#C8E4FF',
  peach:  '#FFE4CC',
}
```

Added to `globals.css` as `--postit-yellow`, etc.

### 1.3 Sticker keys

```typescript
type StickerKey =
  | 'star' | 'heart' | 'check' | 'exclaim' | 'bulb' | 'home'
  | 'cart' | 'sun' | 'lightning' | 'clock' | 'phone' | 'money'
```

### 1.4 Reducer actions

| Action | Payload | Invariant |
|--------|---------|-----------|
| `ADD_NOTE` | `Partial<Omit<PostIt, 'id'>>` | generates id via `crypto.randomUUID()`; sets defaults |
| `UPDATE_NOTE` | `{ id } & Partial<Omit<PostIt, 'id' \| 'position'>>` | **never touches `position`** |
| `MOVE_NOTE` | `{ id; xPct; yPct }` | **only touches `position`** |
| `DELETE_NOTE` | `{ id }` | removes note |
| `TOGGLE_PIN` | `{ id }` | flips `pinned` |
| `SET_VIEW` | `{ mode }` | changes view mode only; never mutates notes |

`UPDATE_NOTE` and `MOVE_NOTE` have strictly non-overlapping field coverage. No code path can overwrite coordinates through a content edit or vice versa.

### 1.5 Coordinate system

Positions are stored as percentages (0–1) of the **usable board area** — the board element's `offsetWidth` and `offsetHeight`. This keeps positions semantically proportional across screen sizes.

Pixel positions are computed at render time from `xPct × boardWidth`. **Render-time clamping** is applied using the note's **actually measured** dimensions (`ResizeObserver` per note, updated on mount and on any layout change), ensuring every note stays fully within the visible board. A fixed constant (e.g. `200px`) must not be used — it would desync rendering from dragging and cause a visible jump at drag start:

```
clampedLeft = max(0, min(xPct × boardW, boardW − noteW))
clampedTop  = max(0, min(yPct × boardH, boardH − noteH))
```

The stored `xPct/yPct` is **never mutated** by this clamping — it is display-only. If the board shrinks and forces a note toward an edge, the note becomes visible at the clamped position; when the board grows back, the note returns to its stored position.

### 1.6 Note IDs

New notes use `crypto.randomUUID()` (available in all target environments: Node 15.6+, all modern browsers, Next.js 15).

Demo/development fixtures use **literal deterministic string IDs** (e.g., `'demo-note-01'`) to prevent hydration mismatches between server-rendered HTML and client initialisation.

### 1.7 Initial state

The default initial state has an **empty notes array**. Demo notes are exported separately as `DEMO_NOTES` and passed to the provider via an optional `initialNotes` prop. This prop must be removed when durable persistence is implemented.

```typescript
const INITIAL_STATE: PostItState = { notes: [], mode: 'free' }
```

---

## 2. Context and Routing Boundary

### 2.1 File structure

```
prototypes/ui-shell/
  app/
    lavagna/
      layout.tsx          ← wraps children in PostItProvider; persistent across board↔nota
      page.tsx            ← renders LavagnaBoard
      [id]/
        page.tsx          ← awaits params Promise, renders NotaDetail
  components/
    lavagna/
      LavagnaBoard.tsx    ← board surface, ResizeObserver, note list
      LavagnaHeader.tsx   ← top toolbar
      PostItNote.tsx      ← individual note: render + drag + keyboard
      useDrag.ts          ← Pointer Event drag hook
      NotaDetail.tsx      ← two-column detail page
      NotaHeader.tsx      ← detail header bar
  lib/
    postit-context.tsx    ← reducer, PostItContext, PostItProvider, hooks
    postit-types.ts       ← all types
    postit-utils.ts       ← pure functions, constants, DEMO_NOTES
  __tests__/
    postit-utils.test.ts
    postit-reducer.test.ts
    drag-math.test.ts     ← pure coordinate calculation tests
    drag-hook.test.ts     ← pointer interaction tests for useDrag
```

### 2.2 Layout boundary

`app/lavagna/layout.tsx` is a Server Component that renders `<PostItProvider>{children}</PostItProvider>`. The board starts with an **empty** notes array — no demo data is injected in production or development builds. `DEMO_NOTES` is exported from `postit-utils.ts` for local developer use only; it must never be imported from `layout.tsx` in a committed change. Next.js App Router keeps the layout mounted across client-side navigation between `/lavagna` and `/lavagna/[id]`, so the notes array is never torn down within a session.

`PostItProvider` accepts:
```typescript
interface PostItProviderProps {
  children:      ReactNode
  initialNotes?: PostIt[]   // defaults to []; remove when persistence exists
}
```

**Persistence:** In-memory only. The UI communicates this via the "Bozza in memoria" status label. Notes are lost on hard refresh, direct URL entry, or session end.

### 2.3 Hooks

```typescript
usePostItContext(): PostItContextValue   // throws if used outside provider
usePostIt(id: string): PostIt | undefined  // returns undefined when note unavailable
```

---

## 3. Lavagna Board Layout

### 3.1 Page structure

```
<main class="lavagna-screen">
  <LavagnaHeader noteCount={n} mode={mode} onModeChange onAddNote />
  <div class="lavagna-board-wrap">
    <div class="lavagna-board" ref={boardRef}>   ← positioning context
      {free:  notes.map(n => <PostItNote boardSize={boardSize} ... />)}
      {grid:  <div class="lavagna-grid-mode">{notes.map(...)}</div>}
    </div>
  </div>
</main>
```

### 3.2 Board visual — matches PDF page 1

- `lavagna-screen`: 100dvh, palette gradient background.
- `lavagna-board-wrap`: fills remaining height; padding `24px 32px` desktop, `12px 16px` mobile.
- `lavagna-board`: `background: #fff`, `border-radius: 24px`, `border: 1px solid #e8e4dc`, `box-shadow: 0 2px 20px rgba(0,0,0,0.06)`, `position: relative`, `overflow: hidden`.

### 3.3 Board sizing (responsive)

`LavagnaBoard` maintains `boardSize: { w: number; h: number }` via a `ResizeObserver` attached to `boardRef`. This value is passed to each `PostItNote` for render-time clamping (§1.5) and used by the drag hook for coordinate conversion.

Initial value is `{ w: 0, h: 0 }`; notes render at unclamped pct positions until the first `useLayoutEffect` fires and measures the board. This brief unclamped state is acceptable (occurs only before hydration completes).

### 3.4 Header — matches PDF page 1

Left: `←` chevron → `/?view=menu`, `"Lavagna"` title (semibold), `"N post-it"` count (muted).
Right: `Libera / Griglia` segmented toggle, pen icon (inactive — renders as visually disabled, no interaction), `+ Post-it` filled blue button.

The pen button has `disabled` attribute and `aria-label="Disegna (non ancora disponibile)"`. It does not use an alert or fake any success.

---

## 4. Post-it Visual Style

Matches PDF page 1 notes.

```css
.postit {
  position:        absolute;
  top:             0;
  left:            0;
  width:           clamp(160px, 18vw, 210px);
  height:          clamp(160px, 18vw, 210px);
  border-radius:   3px;
  padding:         14px 16px 10px;
  font-family:     var(--font-welcome), cursive;
  font-size:       clamp(0.875rem, 1.5vw, 1rem);
  line-height:     1.5;
  box-shadow:      2px 4px 14px rgba(0,0,0,0.13), 0 1px 3px rgba(0,0,0,0.07);
  touch-action:    none;
  user-select:     none;
  cursor:          pointer;
}
```

**Positioning and transform are strictly separated:**
- `left` / `top`: positions the note on the board (percentage-based at rest, overridden with px during drag).
- `transform`: contains **rotation only** — `rotate(Ndeg)`. Translation is never placed in transform. The drag hook never writes to `transform`.

This separation guarantees that drag interactions can never accidentally alter the note's visual rotation.

---

## 5. Free Mode (Libera) — Drag Interaction

### 5.1 Rendering in free mode

React renders each note at rest with render-time-clamped percentages:

```tsx
style={{
  backgroundColor: POST_IT_COLORS[note.color],
  left:            `${clampedLeft / boardSize.w * 100}%`,
  top:             `${clampedTop  / boardSize.h * 100}%`,
  transform:       `rotate(${note.rotation}deg)`,
}}
```

Where `clampedLeft = max(0, min(xPct × boardSize.w, boardSize.w − noteWidth))` and `noteWidth` is the note's `offsetWidth` measured on mount.

When `boardSize.w === 0` (before measurement), fall back to `left: ${xPct * 100}%`.

### 5.2 `useDrag` hook interface

```typescript
interface UseDragParams {
  noteId:       string
  xPct:         number
  yPct:         number
  rotation:     number
  noteRef:      RefObject<HTMLDivElement | null>
  boardRef:     RefObject<HTMLDivElement | null>
  enabled:      boolean    // MUST be false in Grid mode; prevents all drag behaviour
  onMoveCommit: (id: string, xPct: number, yPct: number) => void
  onTap:        () => void // called when pointerup occurs without threshold crossed
}

interface UseDragReturn {
  isDragging: boolean      // true from threshold crossed → pointerup/cancel
}
```

The hook attaches all pointer listeners in a `useEffect` using `addEventListener` (not React synthetic events), with `{ passive: false }` on `pointerdown` to allow `e.preventDefault()`.

### 5.3 Pointer event sequence

**Key invariant — start position computed from stored state, not from DOM geometry:**
On `pointerdown`, the note's start position is computed as:

```
startNoteXpx = propsRef.current.xPct * board.offsetWidth
startNoteYpx = propsRef.current.yPct * board.offsetHeight
```

`getBoundingClientRect()` is **never called on the note element**. The note has a CSS rotation; its bounding rect is the axis-aligned box of the rotated element, which does not equal the unrotated `left/top` position. Reading it would cause position drift on every drag-and-release cycle.

`board.offsetWidth/offsetHeight` are used because the board element is never rotated.

---

**`pointerdown`:**
1. If `propsRef.current.enabled === false` → return immediately. No capture, no state change.
2. `e.preventDefault()` — suppresses touch scroll and text selection.
3. `note.setPointerCapture(e.pointerId)` — routes all subsequent events here.
4. Compute `startNoteXpx = xPct × board.offsetWidth`, `startNoteYpx = yPct × board.offsetHeight`.
5. Record `startPointerX`, `startPointerY` (client coords).
6. Set `active = true`, `started = false`, `lastXpx/lastYpx = startNoteXpx/startNoteYpx`.
7. Read `noteW = note.offsetWidth`, `noteH = note.offsetHeight`.
8. **Do not touch `note.style.left` or `note.style.top`** yet.

**`pointermove`:**
1. Guard: if `e.pointerId !== activePointerId` → return.
2. Compute `Δx = e.clientX − startPointerX`, `Δy = e.clientY − startPointerY`.
3. If `!started && Math.hypot(Δx, Δy) > 4`:
   - Set `started = true`; call `setIsDragging(true)`; add `.postit--dragging` class.
   - **Begin style override only now** — overriding before threshold would cause px↔pct switching on near-zero taps.
4. If `!started` → return.
5. Compute clamped position:
   ```
   newXpx = max(0, min(startNoteXpx + Δx, boardW − noteW))
   newYpx = max(0, min(startNoteYpx + Δy, boardH − noteH))
   ```
6. Direct DOM write — **zero React re-renders per frame:**
   ```
   note.style.left = `${newXpx}px`
   note.style.top  = `${newYpx}px`
   ```
   `note.style.transform` is **not touched** — rotation remains as React left it.
7. Store `lastXpx = newXpx`, `lastYpx = newYpx`.

**`pointerup`:**
1. Guard: `e.pointerId !== activePointerId` → return.
2. Read `wasStarted = started`.
3. Call `finalizeDrag()` (clears flags, releases capture, removes class).
4. If `wasStarted`:
   - Dispatch: `onMoveCommit(noteId, lastXpx / boardW, lastYpx / boardH)`.
   - **Do not clear `note.style.left/top`** — React's reconciliation will replace the inline `'${lastXpx}px'` with its new pct-derived value on the next render. Because `lastXpx / boardW × boardW = lastXpx`, the computed CSS value is numerically identical to the inline value. No visual jump occurs.
5. If `!wasStarted` (tap):
   - Inline style was never mutated (styles only change after threshold). No cleanup needed.
   - Call `onTap()`.

**`pointercancel` and `lostpointercapture`:**
Both are handled by the same function.
1. Guard: `e.pointerId !== activePointerId` → return.
2. Call `finalizeDrag()`.
3. **Restore inline styles to the pre-drag pct position** — do NOT set `style.left = ''`:

   ```typescript
   // WRONG — clears to '' which falls back to CSS class rule .postit { top:0; left:0 }
   // note.style.left = ''

   // CORRECT — explicitly set the same clamped pct that PostItNote would render
   const maxX   = Math.max(0, board.offsetWidth  - note.offsetWidth)
   const maxY   = Math.max(0, board.offsetHeight - note.offsetHeight)
   const clampedXpx = Math.max(0, Math.min(propsRef.current.xPct * board.offsetWidth, maxX))
   const clampedYpx = Math.max(0, Math.min(propsRef.current.yPct * board.offsetHeight, maxY))
   note.style.left = `${(clampedXpx / board.offsetWidth)  * 100}%`
   note.style.top  = `${(clampedYpx / board.offsetHeight) * 100}%`
   ```

   **Why:** Setting `style.left = ''` removes the inline style entirely. The element then
   inherits the CSS class rule (`.postit { position: absolute; top: 0; left: 0 }`), causing
   the note to jump to the top-left corner. There is no guarantee React will re-render
   after a cancel (no state change occurs), so the jump would be permanent until the next
   unrelated render.

4. Do **not** call `onMoveCommit`. Do **not** call `onTap`.

`lostpointercapture` fires when focus leaves the browser window (tab-switch, OS dialog).
This path handles the "switch tabs during drag" QA scenario without any additional listener.

**`keydown` on `document` (Escape key):**
1. Registered while the hook's `useEffect` is active (not just while dragging).
2. If `active === true && e.key === 'Escape'`: call the same cancel function as above.
3. Must be removed in the `useEffect` cleanup.

**Unmount cleanup (`useEffect` return):**
1. Remove all six event listeners (five on `note`, one `keydown` on `document`).
2. If `active === true` (unmounted during a drag): call `restorePosition()`, remove `.postit--dragging`. Do **not** call `onMoveCommit`.

### 5.4 No visual jump guarantee

After `MOVE_NOTE` dispatches and React re-renders, React sets:
```
style.left = `${newXpct * 100}%`
```
On a board of width `boardW`, this resolves to `newXpct × boardW` pixels — which equals `lastXpx` exactly (since `newXpct = lastXpx / boardW`). The inline `'${lastXpx}px'` is replaced by the CSS percentage value; the browser renders both as the same pixel offset. No visual change occurs during reconciliation.

The `transform: rotate(Ndeg)` is present on the element throughout: React set it, the drag hook never touched it. It is identical before and after the drag. No rotation drift.

### 5.5 Touch-scroll suppression

`e.preventDefault()` in `pointerdown` is sufficient for Pointer Events. No additional `touchmove` listener is required. The `{ passive: false }` option on `addEventListener` prevents the browser from upgrading the listener to passive.

### 5.6 Grid mode guard

When `enabled === false` (Grid mode), `pointerdown` returns immediately:
- `setPointerCapture` is never called.
- Inline styles are never mutated.
- `onMoveCommit` is never called.
- `onTap` is never called.

In Grid mode, PostItNote uses a standard `onClick` handler for navigation (the browser's normal click event fires without any drag interference).

---

## 6. Keyboard Repositioning

When a Post-it note has focus in Free mode:

| Key | Step |
|-----|------|
| `Arrow keys` | ±10 px |
| `Shift + Arrow` | ±50 px |
| `Enter` / `Space` | navigate to `/lavagna/[id]` |

Keyboard movement dispatches `MOVE_NOTE` immediately with clamped coordinates — no pending DOM transform state. The reducer is the source of truth.

`aria-grabbed` is set to `true` during an active pointer drag and cleared on completion or cancel. Each note has `tabIndex={0}` in free mode. `aria-label` includes: `"Post-it: [first 40 chars]. Usa le frecce per spostarlo, Invio per aprirlo."`.

The board has `role="application"` with `aria-label="Lavagna — bacheca post-it"`.

---

## 7. Grid Mode (Griglia)

When `mode === 'grid'`:
- Notes render inside `.lavagna-grid-mode` (CSS grid, `auto-fill`, `minmax(200px,1fr)`, `gap:24px`).
- Each note has `position: static`, no `left/top`, `transform: none` (flat appearance in grid).
- `useDrag` receives `enabled={false}` — no drag behaviour is possible.
- `position.xPct/yPct` in state are **never written** during or after Grid mode — `SET_VIEW` mutates only `mode`.

Switching back to Libera: React applies stored `xPct/yPct` via the same render-time clamping logic. All positions are exactly as they were before entering Grid mode.

---

## 8. Nota Detail Page

### 8.1 Header — matches PDF page 2

```
← Lavagna        Nota        Bozza in memoria
```

- `← Lavagna`: `<Link href="/lavagna" replace>`. Font-size 0.875 rem.
- `Nota`: page title, centred, semibold.
- `Bozza in memoria` (right-aligned): default status. After first edit, updates to `"In memoria · HH:MM"`. **Never** shows "Modifiche salvate" — that would misrepresent the in-memory-only state.

### 8.2 Two-column layout (≥ 768 px) — matches PDF page 2

```
┌──────────────────────────────────────────────────┐
│ ← Lavagna              Nota        Bozza in mem. │
├──────────────────────────┬───────────────────────┤
│   Large PostIt preview   │  ┌─ Nota fissata ────┐│
│   (≈280px, rotated,      │  │  (only if pinned) ││
│    shadow, textarea)     │  └───────────────────┘│
│                          │  Tool grid (2 × 4)    │
│                          │  Color swatches (5)   │
│                          │  Sticker picker       │
│                          │  Pin toggle           │
│                          │  Metadata             │
└──────────────────────────┴───────────────────────┘
```

Left panel: 60% width. Large post-it (≈ 280 px), retains rotation and shadow. Content is a `<textarea>` styled transparently over the note background. Editing dispatches `UPDATE_NOTE`.

Right panel: 40% width, scrollable.

### 8.3 Tool grid — matches PDF page 2

Eight rounded white buttons in a 2-column grid:

| Col 1 | Col 2 |
|-------|-------|
| Promemoria | Collega a un giorno |
| Checklist | Scrivi a mano |
| Aggiungi audio | Duplica |
| Archivia | Elimina |

**Unimplemented tools** (Promemoria, Collega, Checklist, Scrivi a mano, Aggiungi audio, Archivia): rendered with `disabled` attribute, `aria-disabled="true"`, and `title="Non ancora disponibile"`. Reduced opacity. No alert, no fake success.

**Duplica**: functional — dispatches `ADD_NOTE` with a copy of the current note at a slightly offset position.

**Elimina**: functional — shows an inline confirmation state ("Sicuro?" / "Sì, elimina" / "Annulla") rather than `window.confirm`. On confirmation, dispatches `DELETE_NOTE` then navigates to `/lavagna` via `router.push('/lavagna')`. `window.history.back()` is not used.

### 8.4 Color swatches

Five 28 px circles. Selected color has a 2 px inset ring. Clicking dispatches `UPDATE_NOTE({color})` — preview updates immediately.

### 8.5 Sticker picker — matches PDF page 2

Two rows of emoji-pill stickers with saturated backgrounds. Clicking appends to `stickers[]` via `UPDATE_NOTE`. "Togli l'ultimo" removes the last sticker.

### 8.6 Metadata

```
Creata [date]  ·  Ultima modifica [time]
```
Populated from actual `createdAt / updatedAt`. If the date is today: `"oggi alle HH:MM"`. No fabricated voice-origin text.

### 8.7 Pinned notice

Shown only when `note.pinned === true`:

```
┌─ Nota fissata ────────────────────────────────┐
│ Non verrà archiviata automaticamente.          │
│ Resta qui finché non la archivi tu.            │
└───────────────────────────────────────────────┘
```
`background: #FFF3CD`, `border-left: 4px solid #F59E0B`.

---

## 9. Not-Found / Stale-ID Handling

When `usePostIt(id)` returns `undefined` (hard refresh, direct URL, unknown ID, session ended):

```
Questa nota non è disponibile.
Le note vengono conservate solo durante la sessione corrente.

[ ← Torna alla Lavagna ]
```

The link uses `<Link href="/lavagna" replace>`. No error boundary is required — this is expected, documented behaviour.

---

## 10. Responsive Layout

**LavagnaBoard** uses a `ResizeObserver` to maintain `boardSize: { w, h }` in state. This value is passed to each `PostItNote`, which measures its own dimensions in `useLayoutEffect` and uses both for render-time clamping (§1.5). Notes are never pushed off-screen by a resize.

| Breakpoint | Board | Nota |
|---|---|---|
| ≥ 1024 px | Full board surface; `overflow: hidden`; notes at stored positions, clamped | Two-column (60/40) |
| 768–1023 px | Same; notes clamp to smaller board dimensions | Two-column (55/45) |
| < 768 px | Board fills height; smaller notes (`clamp(140px, 40vw, 180px)`); header adapts | Single column — preview stacked above tools |
| < 480 px | `+ Post-it` label hidden (icon only); note count hidden | Controls scroll; nothing discarded |

On resize, notes shift visually to their clamped positions but stored `xPct/yPct` is unchanged. When the board grows back, notes return to stored positions.

---

## 11. Testing Scope

### 11.1 Unit — `postit-utils.test.ts`

- `pctToPx` / `pxToPct` round-trip
- `clampPosition`: edges, overflow, note wider than board
- `generateRotation`: always in [−3, +3]
- `generateId`: non-empty, no two consecutive calls collide
- `formatNoteDate`: produces non-empty Italian string
- `POST_IT_COLORS`, `STICKER_CONFIG`: complete coverage of all keys

### 11.2 Unit — `postit-reducer.test.ts`

- `ADD_NOTE`: id assigned, rotation in range, position valid
- `UPDATE_NOTE`: updates fields; `position` unchanged (test MOVE_NOTE → UPDATE_NOTE sequence)
- `MOVE_NOTE`: updates only `position`; all other fields unchanged (test UPDATE_NOTE → MOVE_NOTE sequence)
- `DELETE_NOTE`: removes correct note; others unaffected
- `TOGGLE_PIN`: flips; second call restores
- `SET_VIEW`: mode changes; all `xPct/yPct` unchanged; repeated toggles preserve positions

### 11.3 Pure coordinate tests — `drag-math.test.ts`

Kept strictly separate from hook interaction tests.

- Note at right/bottom edge is clamped
- Note at 0,0 stays at 0,0
- Interior position unchanged
- px → pct → px round-trip within 0.5 px for typical dimensions
- Keyboard step math: 10 px and 50 px steps; clamping at edge

### 11.4 Hook interaction tests — `drag-hook.test.ts`

Tests use `renderHook` from `@testing-library/react` and dispatch `PointerEvent` on a mock DOM element. `setPointerCapture` / `releasePointerCapture` are mocked; `offsetWidth/Height` are mocked with `Object.defineProperty`.

Scenarios tested:
- `pointerdown` → `pointerup` without threshold: `onTap` called, `onMoveCommit` not called, inline styles unchanged
- `pointerdown` → `pointermove` (> 4 px) → `pointerup`: `onMoveCommit` called with clamped coordinates; `onTap` not called
- Right-edge clamp: large move results in `xPct ≤ (boardW − noteW) / boardW`
- Left-edge clamp: large negative move results in `xPct === 0`
- `pointercancel`: `onMoveCommit` not called; inline style set to clamped `N%` (not `''`); `onTap` not called
- `lostpointercapture`: same as `pointercancel`; verifies `style.left` matches `xPct * 100 + '%'`
- Escape key during active drag: same as `pointercancel`; `onMoveCommit` not called
- `enabled=false` (`pointerdown`): no capture, no style mutation, neither callback called
- Unmount during drag: `onMoveCommit` not called; `style.left` restored to pct (not `''`)
- `setPointerCapture` called on `pointerdown`
- Reconciliation invariant: committed `xPct × boardW` equals the inline `left` px value set during drag (within 1 px)
- Board smaller than note: drag clamps to `(0, 0)`, `onMoveCommit` still called with valid coords

---

## 12. Visual Fidelity Checklist

Against PDF pages 1 and 2:

- [ ] Warm gradient background behind the white board surface
- [ ] Board: 24 px rounded corners, light border, soft shadow
- [ ] Five distinct pastel note colors
- [ ] Sacramento handwritten font on note content
- [ ] Two-layer note shadow
- [ ] Subtle note rotations (−3…+3°)
- [ ] Small date labels near note bottom when `dueDate` present
- [ ] Header: back chevron, "Lavagna", count, toggle, inactive pen icon, blue "+ Post-it"
- [ ] Nota: two-column layout at ≥ 768 px (preview left, tools right)
- [ ] Nota: pinned notice with amber styling (pin a note to verify)
- [ ] Nota: 8-button tool grid; unimplemented tools visually disabled
- [ ] Nota: 5 pastel swatches with selection ring
- [ ] Nota: sticker picker with colorful pill backgrounds
- [ ] Nota: metadata from real dates only
- [ ] Status: "Bozza in memoria" (never "Modifiche salvate")
- [ ] Delete: inline confirm state, navigates to `/lavagna` after deletion

---

## 13. Out of Scope

- OAuth / authentication backend
- Esercizi, Calendario, Oggi, Quaderno, Inbox
- Durable persistence (encrypted vault — separate increment)
- Pen / drawing mode (rendered inactive, never alerts)
- Promemoria, Collega, Checklist, Scrivi a mano, Aggiungi audio, Archivia (rendered disabled)
- sessionStorage, localStorage, IndexedDB, any plaintext persistence
- `window.confirm` / `window.alert`
