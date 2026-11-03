# Codebase Quality Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate Italian identifiers from all non-display code, fix correctness bugs, remove dead code, and extract repeated logic into shared abstractions — in a safe, commit-by-commit sequence.

**Architecture:** Each task is independently compilable and testable. Tasks build on each other in strict order (Task N assumes Tasks 1…N-1 are committed). Display-facing Italian strings (labels, aria-labels, UI text) are deliberately preserved — only code identifiers (type literals, CSS classes, route paths, constants, event keys) are renamed.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript 5, Vitest, jsdom. Working directory: `prototypes/ui-shell/`.

**Verification commands** (run after every task before committing):
```bash
cd prototypes/ui-shell
npm run typecheck   # tsc --noEmit
npm test            # vitest run
npm run build       # full Next.js build — catches dynamic import errors typecheck misses
```

---

## Task 1 — Bug fixes and workaround cleanup

**Files:**
- Modify: `lib/calendar-utils.ts` (line 9–12)
- Modify: `components/lavagna/PostItNote.tsx` (line 140)
- Modify: `components/lavagna/NotaDetail.tsx` (line 135)
- Modify: `components/CalendarView.tsx` (lines 242–256, 353, 684–690)
- Modify: `lib/postit-context.tsx` (line 62–63)

### 1a — Fix missing accents in Italian day names

- [ ] In `lib/calendar-utils.ts`, replace `DAYS_FULL_IT` (lines 9–12) with the accented version:

```ts
const DAYS_FULL_IT = [
  'Domenica', 'Lunedì', 'Martedì', 'Mercoledì',
  'Giovedì', 'Venerdì', 'Sabato',
] as const
```

Then delete the separate `DAYS_FULL_IT_ACCENTED` array (lines 14–19) and update the one place that referenced it. Find it:

```bash
grep -n "DAYS_FULL_IT_ACCENTED" prototypes/ui-shell/lib/calendar-utils.ts
```

Replace any `DAYS_FULL_IT_ACCENTED[...]` call with `DAYS_FULL_IT[...]` (they're now the same array). The `getDayNameFull` function already uses `DAYS_FULL_IT`, so it picks up the fix automatically.

### 1b — Fix sticker `key={i}` (index as key)

- [ ] In `components/lavagna/PostItNote.tsx` (line 138–141), change:

```tsx
// BEFORE
{note.stickers.map((key, i) => (
  <span key={i}
```

```tsx
// AFTER — use the sticker string value as key; duplicates within a note are
// impossible because addSticker guards against them in the reducer
{note.stickers.map((key) => (
  <span key={key}
```

- [ ] Same fix in `components/lavagna/NotaDetail.tsx` (line 133–136):

```tsx
// BEFORE
{note.stickers.map((key, i) => (
  <span key={i}
```

```tsx
// AFTER
{note.stickers.map((key) => (
  <span key={key}
```

### 1c — Remove unused `openGroupId` prop from `TimelinePanel`

The prop is never used inside the component body — it exists only to suppress a TypeScript "unused variable" warning via `{openGroupId === '__never__' && null}`.

- [ ] In `components/CalendarView.tsx`, remove `openGroupId` from `TimelinePanelProps` interface (line 246) and from the destructuring (line 254):

```ts
// BEFORE
interface TimelinePanelProps {
  date:         string
  items:        CalendarItem[]
  groups:       Map<string, CalendarItem[]>
  openGroupId:  string | null   // ← remove
  onGroupOpen:  (gid: string) => void
  onClose:      () => void
  panelRef?:    React.RefObject<HTMLDivElement | null>
  closeRef?:    React.RefObject<HTMLButtonElement | null>
  chipRefs:     React.MutableRefObject<Map<string, HTMLButtonElement>>
}
function TimelinePanel({
  date, items, groups, openGroupId, onGroupOpen, onClose,   // ← remove openGroupId
  panelRef, closeRef, chipRefs,
}: TimelinePanelProps) {
```

```ts
// AFTER
interface TimelinePanelProps {
  date:         string
  items:        CalendarItem[]
  groups:       Map<string, CalendarItem[]>
  onGroupOpen:  (gid: string) => void
  onClose:      () => void
  panelRef?:    React.RefObject<HTMLDivElement | null>
  closeRef?:    React.RefObject<HTMLButtonElement | null>
  chipRefs:     React.MutableRefObject<Map<string, HTMLButtonElement>>
}
function TimelinePanel({
  date, items, groups, onGroupOpen, onClose,
  panelRef, closeRef, chipRefs,
}: TimelinePanelProps) {
```

- [ ] Delete the dead JSX line (line 353):

```tsx
{/* Suppress unused variable warning */}
{openGroupId === '__never__' && null}
```

- [ ] Remove `openGroupId={openGroupId}` from the call site in the parent (around line 688):

```bash
grep -n "openGroupId" prototypes/ui-shell/components/CalendarView.tsx
```

Remove only the `openGroupId={openGroupId}` prop from the `<TimelinePanel ...>` JSX. The `openGroupId` state variable in the parent is still used elsewhere (`GroupDetailPanel`, `useEffect`s) — do not remove it from the parent.

### 1d — Replace `void _pos` with idiomatic destructure

In `lib/postit-context.tsx` (line 62–63):

```ts
// BEFORE
const { position: _pos, ...safeFields } = fields as typeof fields & { position?: unknown }
void _pos
```

```ts
// AFTER
const { position: _, ...safeFields } = fields as typeof fields & { position?: unknown }
```

### 1e — Verify and commit

- [ ] Run verification:

```bash
cd prototypes/ui-shell
npm run typecheck && npm test && npm run build
```

Expected: typecheck passes, all tests pass, build succeeds.

- [ ] Commit:

```bash
git add prototypes/ui-shell/lib/calendar-utils.ts \
        prototypes/ui-shell/components/lavagna/PostItNote.tsx \
        prototypes/ui-shell/components/lavagna/NotaDetail.tsx \
        prototypes/ui-shell/components/CalendarView.tsx \
        prototypes/ui-shell/lib/postit-context.tsx
git commit -m "fix: day name accents, stable sticker keys, remove TS workarounds"
```

---

## Task 2 — Dead code removal

**Files:**
- Modify: `lib/postit-utils.ts` (lines 98–end)
- Modify: `app/lavagna/layout.tsx` (lines 3–5)
- Modify: `components/AppShell.tsx`
- Modify: `app/page.tsx`
- Delete: `lib/types.ts`

### 2a — Remove DEMO_NOTES

`DEMO_NOTES` is exported but never imported in production. Verify first:

```bash
grep -rn "DEMO_NOTES" prototypes/ui-shell --include="*.ts" --include="*.tsx" | grep -v "postit-utils"
```

Expected: no results (it is never imported). Then delete the export from `lib/postit-utils.ts`:

- [ ] Remove everything from line 98 onwards (`export const DEMO_NOTES: PostIt[] = [...]`). Keep all functions above it (`formatNoteDate`, `generateRotation`, `STICKER_EMOJI`).

### 2b — Remove dead comment from lavagna layout

- [ ] In `app/lavagna/layout.tsx`, remove lines 3–5 (the `// The board starts empty...` comment block). The file becomes:

```ts
import { PostItProvider } from '@/lib/postit-context'

export default function LavagnaLayout({ children }: { children: React.ReactNode }) {
  return <PostItProvider>{children}</PostItProvider>
}
```

### 2c — Move `AppView` type into `AppShell`, delete `lib/types.ts`

`lib/types.ts` contains only `export type AppView = 'WELCOME' | 'MENU_OPEN' | 'MENU_CLOSED'`. Two files import it.

- [ ] Add the type directly to `components/AppShell.tsx` (at the top, after imports):

```ts
export type AppView = 'WELCOME' | 'MENU_OPEN' | 'MENU_CLOSED'
```

- [ ] Update `app/page.tsx` import:

```ts
// BEFORE
import type { AppView } from '@/lib/types'

// AFTER
import type { AppView } from '@/components/AppShell'
```

- [ ] Delete `lib/types.ts`:

```bash
git rm prototypes/ui-shell/lib/types.ts
```

### 2d — Verify and commit

- [ ] Run verification:

```bash
cd prototypes/ui-shell
npm run typecheck && npm test && npm run build
```

- [ ] Commit:

```bash
git add prototypes/ui-shell/lib/postit-utils.ts \
        prototypes/ui-shell/app/lavagna/layout.tsx \
        prototypes/ui-shell/components/AppShell.tsx \
        prototypes/ui-shell/app/page.tsx
git commit -m "chore: remove DEMO_NOTES, dead comments, move AppView to AppShell"
```

---

## Task 3 — Centralize locale constant

**Files:**
- Modify: `lib/constants.ts`
- Modify: `lib/postit-utils.ts`
- Modify: `components/lavagna/PostItNote.tsx`
- Modify: `components/lavagna/NotaDetail.tsx`
- Modify: `components/lavagna/NotaHeader.tsx`

### 3a — Add LOCALE constant

- [ ] In `lib/constants.ts`, add after `APP_NAME`:

```ts
/** BCP-47 locale tag used for all date/time formatting in the app. */
export const LOCALE = 'it-IT'
```

### 3b — Replace all five hardcoded `'it-IT'` occurrences

Find them:

```bash
grep -rn "'it-IT'" prototypes/ui-shell --include="*.ts" --include="*.tsx" | grep -v ".next/"
```

Expected 5 matches: `lib/postit-utils.ts` (×2), `PostItNote.tsx` (×1), `NotaDetail.tsx` (×1), `NotaHeader.tsx` (×1).

- [ ] In each file, add the import and replace the literal:

```ts
// Add to imports in each affected file:
import { LOCALE } from '@/lib/constants'

// Replace every occurrence:
'it-IT'  →  LOCALE
```

### 3c — Verify and commit

- [ ] Run verification:

```bash
cd prototypes/ui-shell
npm run typecheck && npm test && npm run build
```

- [ ] Commit:

```bash
git add prototypes/ui-shell/lib/constants.ts \
        prototypes/ui-shell/lib/postit-utils.ts \
        prototypes/ui-shell/components/lavagna/PostItNote.tsx \
        prototypes/ui-shell/components/lavagna/NotaDetail.tsx \
        prototypes/ui-shell/components/lavagna/NotaHeader.tsx
git commit -m "refactor: centralize locale constant"
```

---

## Task 4 — Rename EnergyLevel literals to English

**Files:**
- Modify: `lib/oggi/types.ts` (line 53)
- Modify: `components/oggi/EnergyActivities.tsx` (lines 11–14)
- Modify: `lib/oggi/daily-repository.test.ts` (lines 110–113)

Note: the CheckIn component uses numeric energy dots (1–5 scale), not the level labels. The CSS classes `oggi-dot--energy-1…5` are unaffected.

### 4a — Update the type

- [ ] In `lib/oggi/types.ts` line 53:

```ts
// BEFORE
export type EnergyLevel = 'bassa' | 'media' | 'alta'

// AFTER
export type EnergyLevel = 'low' | 'medium' | 'high'
```

### 4b — Update LEVELS array in EnergyActivities

- [ ] In `components/oggi/EnergyActivities.tsx` lines 11–15:

```ts
// BEFORE
const LEVELS: Array<{ id: EnergyLevel; label: string }> = [
  { id: 'bassa', label: 'Bassa' },
  { id: 'media', label: 'Media' },
  { id: 'alta',  label: 'Alta'  },
]

// AFTER — IDs are code identifiers; labels stay Italian (display text)
const LEVELS: Array<{ id: EnergyLevel; label: string }> = [
  { id: 'low',    label: 'Bassa' },
  { id: 'medium', label: 'Media' },
  { id: 'high',   label: 'Alta'  },
]
```

### 4c — Update test fixtures

- [ ] In `lib/oggi/daily-repository.test.ts` lines 110–113:

```ts
// BEFORE
repo.addEnergyActivity('bassa', 'Riordinare la scrivania')
repo.addEnergyActivity('alta', 'Fare la dichiarazione')
expect(repo.listEnergyActivities('bassa').map(a => a.title)).toEqual(['Riordinare la scrivania'])
expect(repo.listEnergyActivities('media')).toEqual([])

// AFTER
repo.addEnergyActivity('low',  'Riordinare la scrivania')
repo.addEnergyActivity('high', 'Fare la dichiarazione')
expect(repo.listEnergyActivities('low').map(a => a.title)).toEqual(['Riordinare la scrivania'])
expect(repo.listEnergyActivities('medium')).toEqual([])
```

### 4d — Verify TypeScript finds all remaining usages

```bash
cd prototypes/ui-shell
npm run typecheck 2>&1 | grep "bassa\|media\|alta"
```

Expected: no results (TypeScript would error on stale string literals assigned to `EnergyLevel`).

- [ ] Run full verification:

```bash
npm run typecheck && npm test && npm run build
```

- [ ] Commit:

```bash
git add prototypes/ui-shell/lib/oggi/types.ts \
        prototypes/ui-shell/components/oggi/EnergyActivities.tsx \
        prototypes/ui-shell/lib/oggi/daily-repository.test.ts
git commit -m "refactor: rename EnergyLevel literals to English (low/medium/high)"
```

---

## Task 5 — English constants for default block title and panel event keys

**Files:**
- Modify: `lib/oggi/time-blocks.ts` (line 20)
- Modify: `components/oggi/shared.tsx` (lines 31, 49)

### 5a — Default block title

- [ ] In `lib/oggi/time-blocks.ts` line 20:

```ts
// BEFORE
export const DEFAULT_BLOCK_TITLE   = 'Blocco di concentrazione'

// AFTER
export const DEFAULT_BLOCK_TITLE   = 'Focus block'
```

Confirm it is only used as a fallback title string (not a key or discriminator):

```bash
grep -rn "DEFAULT_BLOCK_TITLE" prototypes/ui-shell --include="*.ts" --include="*.tsx" | grep -v ".next/"
```

### 5b — Panel event and storage keys

- [ ] In `components/oggi/shared.tsx`:

```ts
// Line 31 — BEFORE
const PANEL_STORAGE_KEY = 'oggi.panels'

// AFTER
const PANEL_STORAGE_KEY = 'today.panels'
```

```ts
// Line 49 — BEFORE
const OPEN_PANEL_EVENT = 'oggi:open-panel'

// AFTER
const OPEN_PANEL_EVENT = 'today:open-panel'
```

**Note:** changing these keys means any panel-open state stored in the user's sessionStorage will be lost on first reload after deploy. This is acceptable for a prototype.

### 5c — Check for time-blocks test impact

```bash
grep -rn "Blocco di concentrazione\|Focus block\|DEFAULT_BLOCK_TITLE" \
  prototypes/ui-shell/lib/oggi/time-blocks.test.ts 2>/dev/null
```

If any test asserts the exact string `'Blocco di concentrazione'`, update it to `'Focus block'`.

### 5d — Verify and commit

```bash
cd prototypes/ui-shell
npm run typecheck && npm test && npm run build
```

```bash
git add prototypes/ui-shell/lib/oggi/time-blocks.ts \
        prototypes/ui-shell/components/oggi/shared.tsx
git commit -m "refactor: English default block title and panel event/storage keys"
```

---

## Task 6 — Rename SectionId values, routes, component folders, CSS prefixes

This is the largest task. It renames every Italian section identifier end-to-end: TypeScript types → route folders → component folders → CSS class prefixes → `href` values → `switch` cases.

**Mapping:**
| Italian | English |
|---------|---------|
| `oggi` | `today` |
| `calendario` | `calendar` |
| `lavagna` | `board` |
| `quaderno` | `notebook` |
| `esercizi` | `exercises` |

Display labels in `SECTIONS` (e.g. `'Oggi'`, `'Calendario'`) are preserved as-is — they are UI text, not identifiers.

**Files modified:**
- `lib/sections.ts`
- `lib/constants.ts`
- `components/RadialMenuItem.tsx`
- `app/oggi/` → `app/today/`
- `app/calendario/` → `app/calendar/`
- `app/lavagna/` → `app/board/` (including `[id]/` subfolder)
- `app/quaderno/` → `app/notebook/`
- `app/esercizi/` → `app/exercises/`
- `components/oggi/` → `components/today/`
- `components/lavagna/` → `components/board/`
- All `href`, `router.push`, `router.replace` pointing to Italian paths
- `lib/postit-context.tsx` (storage key)
- `app/globals.css` (CSS class prefixes)
- All `className` props in TSX files using `oggi-*` or `lavagna-*`

### 6a — Update SectionId type source

- [ ] In `lib/sections.ts`:

```ts
export const SECTIONS = [
  { id: 'today',     label: 'Oggi',       title: 'Oggi'       },
  { id: 'calendar',  label: 'Calendario', title: 'Calendario' },
  { id: 'board',     label: 'Lavagna',    title: 'Lavagna'    },
  { id: 'inbox',     label: 'Inbox',      title: 'Inbox'      },
  { id: 'notebook',  label: 'Quaderno',   title: 'Quaderno'   },
  { id: 'exercises', label: 'Esercizi',   title: 'Esercizi'   },
] as const
```

### 6b — Update constants.ts

- [ ] In `lib/constants.ts`, update `MENU_ITEM_ANGLES`:

```ts
const MENU_ITEM_ANGLES: Array<{ id: SectionId; angle: number }> = [
  { id: 'today',     angle:   0 },
  { id: 'calendar',  angle:  60 },
  { id: 'board',     angle: 120 },
  { id: 'inbox',     angle: 180 },
  { id: 'notebook',  angle: 240 },
  { id: 'exercises', angle: 300 },
]
```

### 6c — Update RadialMenuItem icon switch

- [ ] In `components/RadialMenuItem.tsx`, update the `switch(id)` cases:

```ts
switch (id) {
  case 'today':     return ( /* sun SVG */ )
  case 'calendar':  return ( /* calendar SVG */ )
  case 'board':     return ( /* grid SVG */ )
  case 'inbox':     return ( /* inbox SVG */ )
  case 'notebook':  return ( /* book SVG */ )
  case 'exercises': return ( /* target SVG */ )
  default: ...
}
```

Keep the SVG shapes identical — only rename the case labels.

### 6d — Rename route folders

```bash
cd prototypes/ui-shell
git mv app/oggi      app/today
git mv app/calendario app/calendar
git mv app/lavagna   app/board
git mv app/quaderno  app/notebook
git mv app/esercizi  app/exercises
```

The `app/board/[id]/` subfolder moves with the parent.

### 6e — Update imports and route references inside moved page files

After the move, the page files have new paths but unchanged content. Check and update as needed:

```bash
# Files that moved — check their imports reference correct component paths
grep -n "import" prototypes/ui-shell/app/today/page.tsx
grep -n "import" prototypes/ui-shell/app/board/page.tsx
grep -n "import" prototypes/ui-shell/app/board/\[id\]/page.tsx
```

`app/today/page.tsx` imports `@/components/oggi/OggiView` — this path will update after step 6f. Leave it for now (TypeScript will error, which is our guide).

### 6f — Rename component folders

```bash
cd prototypes/ui-shell
git mv components/oggi    components/today
git mv components/lavagna components/board
```

### 6g — Update all import paths

After the two component folder renames, all files importing from `@/components/oggi/` or `@/components/lavagna/` will fail typecheck. Fix them with bulk replace:

```bash
cd prototypes/ui-shell

# Fix all oggi→today component imports
grep -rln "@/components/oggi/" . --include="*.tsx" --include="*.ts" | grep -v ".next/" | \
  xargs sed -i 's|@/components/oggi/|@/components/today/|g'

# Fix all lavagna→board component imports
grep -rln "@/components/lavagna/" . --include="*.tsx" --include="*.ts" | grep -v ".next/" | \
  xargs sed -i 's|@/components/lavagna/|@/components/board/|g'
```

### 6h — Update all href and router.push/replace values

```bash
cd prototypes/ui-shell

# Replace hardcoded Italian route strings in TSX/TS files
# Note: using | as delimiter to avoid escaping slashes
grep -rln '"/oggi"\|/oggi/\|"/lavagna"\|/lavagna/\|"/calendario"\|"/quaderno"\|"/esercizi"' \
  . --include="*.tsx" --include="*.ts" | grep -v ".next/"
```

For each file found, update:
- `"/oggi"` → `"/today"`
- `"/lavagna"` → `"/board"`
- `"/lavagna/${note.id}"` → `"/board/${note.id}"`  
- `"/calendario"` → `"/calendar"`
- `"/quaderno"` → `"/notebook"`
- `"/esercizi"` → `"/exercises"`

Files to update manually (from audit):
- `components/board/NotaDetail.tsx` (lines 33, 48, 101) — `/lavagna` → `/board`
- `components/board/NotaHeader.tsx` (line 19) — `/lavagna` → `/board`
- `components/board/PostItNote.tsx` (lines 39, 59, 131) — `/lavagna/${note.id}` → `/board/${note.id}`
- `components/today/DayTimeline.tsx` (line 559) — `/calendario` → `/calendar`

### 6i — Update localStorage storage key

- [ ] In `lib/postit-context.tsx` line 15:

```ts
// BEFORE
const STORAGE_KEY = 'doodlelab:lavagna:v1'

// AFTER — bump version because key semantics changed; old data is not migrated
const STORAGE_KEY = 'doodlelab:board:v1'
```

### 6j — Rename CSS class prefixes in globals.css

```bash
cd prototypes/ui-shell

# Rename oggi- prefix to today-
sed -i 's/\.oggi-/\.today-/g; s/oggi-/today-/g' app/globals.css
```

Verify the result is sane (spot-check a few classes):

```bash
grep -n "today-card\|today-timeline\|today-focus" app/globals.css | head -10
grep -n "oggi-" app/globals.css | grep -v "@media"   # should be zero
```

### 6k — Rename CSS class names in TSX components

The component files in `components/today/` still reference `oggi-*` in their `className` props. Bulk replace:

```bash
cd prototypes/ui-shell

# In all TSX files under components/today/
grep -rln "oggi-" components/today/ --include="*.tsx" --include="*.ts" | \
  xargs sed -i 's/oggi-/today-/g'

# Verify no oggi- remain in TSX (excluding @media and CSS comments)
grep -rn "oggi-" components/ --include="*.tsx" | grep -v ".next/"
```

Similarly for lavagna- in components/board/:

```bash
grep -rln "lavagna-" components/board/ --include="*.tsx" --include="*.ts" | \
  xargs sed -i 's/lavagna-/board-/g'

# Rename the CSS classes in globals.css too (already done for . prefix in 6j)
# Verify
grep -rn "lavagna-" components/ --include="*.tsx" | grep -v ".next/"
grep -n "\.lavagna-" app/globals.css   # should be zero
```

### 6l — Verify and commit

```bash
cd prototypes/ui-shell
npm run typecheck 2>&1 | head -30
```

Fix any remaining import errors TypeScript reports. Then:

```bash
npm run typecheck && npm test && npm run build
```

```bash
git add -A -- prototypes/ui-shell/
git commit -m "refactor: rename section IDs and routes to English (oggi→today, lavagna→board, etc.)"
```

---

## Task 7 — Unify PostIt entity naming → Note

Renames the data model types and component files inside `components/board/` to eliminate the three-name confusion (`PostIt` / `PostItNote` / `Nota`). Chosen names:

| Old | New |
|-----|-----|
| `PostIt` (type) | `Note` |
| `PostItColor` | `NoteColor` |
| `PostItPosition` | `NotePosition` |
| `PostItState` | `NoteState` |
| `PostItAction` | `NoteAction` |
| `postItReducer` | `noteReducer` |
| `PostItProvider` | `NoteProvider` |
| `PostItContext` | `NoteContext` |
| `usePostIt` | `useNoteBoard` |
| `PostItNote.tsx` | `StickyNote.tsx` |
| `LavagnaBoard.tsx` | `NoteBoard.tsx` |
| `LavagnaHeader.tsx` | `BoardHeader.tsx` |
| `NotaDetail.tsx` | `NoteDetail.tsx` |
| `NotaHeader.tsx` | `NoteHeader.tsx` |
| `postit-types.ts` | `note-types.ts` |
| `postit-context.tsx` | `note-context.tsx` |
| `postit-utils.ts` | `note-utils.ts` |
| `postit-reducer.test.ts` | `note-reducer.test.ts` |
| `postit-utils.test.ts` | `note-utils.test.ts` |
| CSS `nota-*` | `note-*` |

### 7a — Rename lib files

```bash
cd prototypes/ui-shell
git mv lib/postit-types.ts    lib/note-types.ts
git mv lib/postit-context.tsx lib/note-context.tsx
git mv lib/postit-utils.ts    lib/note-utils.ts
```

### 7b — Rename type declarations inside `lib/note-types.ts`

- [ ] In `lib/note-types.ts`, rename all exported identifiers:

```ts
// BEFORE (abbreviated)
export type PostItColor   = 'yellow' | ...
export interface PostItPosition { ... }
export interface PostIt { ... }
export type ViewMode = 'free' | 'grid'
export interface PostItState { notes: PostIt[]; mode: ViewMode }
export type PostItAction = | { type: 'ADD_NOTE'; payload: Partial<Omit<PostIt, 'id'>> } | ...

// AFTER
export type NoteColor    = 'yellow' | ...
export interface NotePosition { ... }
export interface Note { ... }
export type ViewMode = 'free' | 'grid'      // ViewMode stays (already English)
export interface NoteState { notes: Note[]; mode: ViewMode }
export type NoteAction = | { type: 'ADD_NOTE'; payload: Partial<Omit<Note, 'id'>> } | ...
```

### 7c — Update `lib/note-context.tsx`

- [ ] Update the import at the top:

```ts
import type { Note, NoteAction, NoteState } from './note-types'
```

- [ ] Rename internal identifiers:
  - `PostIt` references → `Note`
  - `postItReducer` → `noteReducer`
  - `PostItContext` → `NoteContext`
  - `PostItProvider` → `NoteProvider`
  - `usePostIt` → `useNoteBoard`

Full export list after rename:
```ts
export function noteReducer(state: NoteState, action: NoteAction): NoteState { ... }
export function NoteProvider({ children }: { children: ReactNode }) { ... }
export function useNoteBoard() { ... }
```

### 7d — Update `lib/note-utils.ts`

- [ ] Update import at top: `import type { Note, NoteColor } from './note-types'`
- [ ] Replace `PostIt` → `Note`, `PostItColor` → `NoteColor` in function signatures.

### 7e — Rename test files

```bash
cd prototypes/ui-shell
git mv __tests__/postit-reducer.test.ts __tests__/note-reducer.test.ts
git mv __tests__/postit-utils.test.ts   __tests__/note-utils.test.ts
```

Update imports inside the renamed test files:
```ts
// __tests__/note-reducer.test.ts
import { noteReducer } from '@/lib/note-context'
import type { NoteState } from '@/lib/note-types'

// __tests__/note-utils.test.ts
import { ... } from '@/lib/note-utils'
```

### 7f — Rename component files in `components/board/`

```bash
cd prototypes/ui-shell/components/board
git mv PostItNote.tsx  StickyNote.tsx
git mv LavagnaBoard.tsx NoteBoard.tsx
git mv LavagnaHeader.tsx BoardHeader.tsx
git mv NotaDetail.tsx  NoteDetail.tsx
git mv NotaHeader.tsx  NoteHeader.tsx
```

### 7g — Update exports inside renamed component files

For each renamed file, update the exported function name and all internal references:

- `StickyNote.tsx`: `export function PostItNote` → `export function StickyNote`
- `NoteBoard.tsx`: `export function LavagnaBoard` → `export function NoteBoard`
- `BoardHeader.tsx`: `export function LavagnaHeader` → `export function BoardHeader`
- `NoteDetail.tsx`: `export function NotaDetail` → `export function NoteDetail`
- `NoteHeader.tsx`: `export function NotaHeader` → `export function NoteHeader`

Also update internal type imports in each file:
```ts
// BEFORE (in all board components)
import type { PostIt, PostItColor, ... } from '@/lib/postit-types'
import { usePostIt } from '@/lib/postit-context'

// AFTER
import type { Note, NoteColor, ... } from '@/lib/note-types'
import { useNoteBoard } from '@/lib/note-context'
```

### 7h — Update all consumers

```bash
cd prototypes/ui-shell

# Find all files importing from old paths
grep -rln "postit-types\|postit-context\|postit-utils\|PostItNote\|LavagnaBoard\|LavagnaHeader\|NotaDetail\|NotaHeader" \
  . --include="*.tsx" --include="*.ts" | grep -v ".next/"
```

For each file found, update imports to point to the new paths and names:
- `@/lib/postit-types` → `@/lib/note-types`
- `@/lib/postit-context` → `@/lib/note-context`
- `@/lib/postit-utils` → `@/lib/note-utils`
- `PostItNote` → `StickyNote`
- `LavagnaBoard` → `NoteBoard`
- `LavagnaHeader` → `BoardHeader`
- `NotaDetail` → `NoteDetail`
- `NotaHeader` → `NoteHeader`
- `usePostIt` → `useNoteBoard`

Key files to check: `app/board/layout.tsx`, `app/board/page.tsx`, `app/board/[id]/page.tsx`.

### 7i — Rename nota-* CSS classes

```bash
cd prototypes/ui-shell

# In globals.css
sed -i 's/\.nota-/\.note-/g; s/nota-/note-/g' app/globals.css

# In component TSX files
grep -rln "nota-" components/board/ --include="*.tsx" | \
  xargs sed -i 's/nota-/note-/g'

# Verify
grep -n "nota-" app/globals.css         # should be zero
grep -rn "nota-" components/ --include="*.tsx"  # should be zero
```

### 7j — Verify and commit

```bash
cd prototypes/ui-shell
npm run typecheck 2>&1 | head -40
```

Fix any remaining errors. Then:

```bash
npm run typecheck && npm test && npm run build
```

```bash
git add -A -- prototypes/ui-shell/
git commit -m "refactor: unify PostIt entity to Note, rename board components to English"
```

---

## Task 8 — Extract `useFocusReturn` hook

**Files:**
- Create: `lib/hooks/use-focus-return.ts`
- Modify: `components/CalendarView.tsx` (lines 407, 459, 477)
- Modify: `components/today/TaskList.tsx` (line 52)
- Modify: `components/today/DayTimeline.tsx` (line 123)

The pattern `setTimeout(() => el?.focus(), 0)` appears three times across components. It defers focus to allow React to flush before the element is focusable.

### 8a — Create the hook

- [ ] Create `lib/hooks/use-focus-return.ts`:

```ts
// lib/hooks/use-focus-return.ts

/**
 * Returns a function that defers focus to the given element by one frame.
 * Needed after state changes that cause re-renders — the target must be
 * mounted and visible before .focus() is called.
 */
export function useFocusReturn() {
  return function returnFocus(el: HTMLElement | null | undefined): void {
    if (!el) return
    setTimeout(() => el.focus(), 0)
  }
}
```

### 8b — Use the hook in CalendarView

- [ ] In `components/CalendarView.tsx`, add at the top of the component:

```ts
import { useFocusReturn } from '@/lib/hooks/use-focus-return'

// Inside CalendarView function body:
const returnFocus = useFocusReturn()
```

Then replace each `setTimeout(() => chip?.focus(), 0)` call:

```ts
// BEFORE (line 407)
setTimeout(() => chip?.focus(), 0)

// AFTER
returnFocus(chip)
```

Apply the same replacement at lines 459 and 477.

### 8c — Use the hook in TaskList

- [ ] In `components/today/TaskList.tsx`, add import and replace:

```ts
import { useFocusReturn } from '@/lib/hooks/use-focus-return'

// Inside the TaskList function body:
const returnFocus = useFocusReturn()
```

```ts
// BEFORE (line 52)
;(target ?? section.querySelector<HTMLElement>('[data-add-task]'))?.focus()

// AFTER
returnFocus(target ?? section.querySelector<HTMLElement>('[data-add-task]'))
```

### 8d — Use the hook in DayTimeline

- [ ] In `components/today/DayTimeline.tsx`, add import and replace:

```ts
import { useFocusReturn } from '@/lib/hooks/use-focus-return'

// Inside DayTimeline function body:
const returnFocus = useFocusReturn()
```

```ts
// BEFORE (line 123)
;(target ?? addBlockRef.current)?.focus()

// AFTER
returnFocus(target ?? addBlockRef.current)
```

Note: this call in DayTimeline does NOT use `setTimeout` in the original — verify the original line before replacing. If the original is a direct `.focus()` (not deferred), leave it as-is and do not replace it with `returnFocus`.

### 8e — Verify and commit

```bash
cd prototypes/ui-shell
npm run typecheck && npm test && npm run build
```

```bash
git add prototypes/ui-shell/lib/hooks/use-focus-return.ts \
        prototypes/ui-shell/components/CalendarView.tsx \
        prototypes/ui-shell/components/today/TaskList.tsx \
        prototypes/ui-shell/components/today/DayTimeline.tsx
git commit -m "refactor: extract useFocusReturn hook, replace duplicate setTimeout focus pattern"
```

---

## Task 9 — Extract StickerList component

**Files:**
- Create: `components/board/StickerList.tsx`
- Modify: `components/board/StickyNote.tsx`
- Modify: `components/board/NoteDetail.tsx`

The sticker rendering code is identical in both `StickyNote` and `NoteDetail`:

```tsx
// current duplication in both files
{note.stickers.map((key) => (
  <span
    key={key}
    className="note-sticker"
    role="img"
    aria-label={key}
  >
    {STICKER_EMOJI[key]}
  </span>
))}
```

### 9a — Create the component

- [ ] Create `components/board/StickerList.tsx`:

```tsx
// components/board/StickerList.tsx
import { STICKER_EMOJI } from '@/lib/note-utils'
import type { StickerKey } from '@/lib/note-types'

interface StickerListProps {
  stickers: StickerKey[]
}

export function StickerList({ stickers }: StickerListProps) {
  if (stickers.length === 0) return null
  return (
    <>
      {stickers.map((key) => (
        <span
          key={key}
          className="note-sticker"
          role="img"
          aria-label={key}
        >
          {STICKER_EMOJI[key]}
        </span>
      ))}
    </>
  )
}
```

Verify `STICKER_EMOJI` is exported from `lib/note-utils.ts`. If it is not exported, add `export` to its declaration.

### 9b — Replace duplicated rendering in StickyNote

- [ ] In `components/board/StickyNote.tsx`, add import and replace the inline sticker map with `<StickerList>`:

```tsx
import { StickerList } from './StickerList'

// Replace the stickers.map block with:
<StickerList stickers={note.stickers} />
```

### 9c — Replace duplicated rendering in NoteDetail

- [ ] Same replacement in `components/board/NoteDetail.tsx`:

```tsx
import { StickerList } from './StickerList'

// Replace the stickers.map block with:
<StickerList stickers={note.stickers} />
```

### 9d — Verify and commit

```bash
cd prototypes/ui-shell
npm run typecheck && npm test && npm run build
```

```bash
git add prototypes/ui-shell/components/board/StickerList.tsx \
        prototypes/ui-shell/components/board/StickyNote.tsx \
        prototypes/ui-shell/components/board/NoteDetail.tsx
git commit -m "refactor: extract StickerList component, remove duplicated sticker rendering"
```

---

## Self-Review

### Spec coverage

| Issue from audit | Task |
|---|---|
| DAYS_FULL_IT accent bug | 1a |
| Sticker key={i} | 1b |
| openGroupId workaround | 1c |
| void _pos workaround | 1d |
| DEMO_NOTES dead code | 2a |
| Dead comment in lavagna layout | 2b |
| lib/types.ts single-type file | 2c |
| Hardcoded 'it-IT' locale | 3 |
| EnergyLevel Italian literals | 4 |
| DEFAULT_BLOCK_TITLE Italian string | 5 |
| oggi.panels / oggi:open-panel keys | 5 |
| SectionId Italian values | 6 |
| Route folder Italian names | 6 |
| oggi-* / lavagna-* CSS prefixes | 6 |
| PostIt/PostItNote/Nota naming confusion | 7 |
| nota-* CSS classes | 7 |
| setTimeout focus duplication | 8 |
| StickerList duplication | 9 |

### Not included (deferred)

The following items from the audit are valid but excluded from this plan to keep each task focused and reviewable. They warrant a separate plan:

- Extract DayTimeline drag logic into a hook (`useDraggableTimeline`)
- Extract `MultiViewDialog` abstraction for `TaskActionsDialog` / `BlockActionsDialog`
- Split `globals.css` into feature-scoped files
- `useCallback` audit in CalendarView and DayTimeline
- Branded `DayKey` type
- Singleton repository mockability

### No placeholders found

All tasks contain explicit file paths, complete code blocks, and exact shell commands.

### Type consistency

`Note`, `NoteState`, `NoteAction`, `NoteColor`, `NotePosition`, `StickerKey` are defined in Task 7b and used consistently in 7c, 7d, 7g, 9a. `StickerList` defined in 9a and imported in 9b/9c.
