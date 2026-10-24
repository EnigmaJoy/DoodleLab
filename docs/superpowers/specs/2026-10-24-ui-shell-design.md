# UI Shell - Technical Design Specification

**Branch:** feature/ui-shell
**Date:** 2026-10-24
**Status:** Revised - pending final review

---

## 1. Overview

This document specifies the technical design for the first UI increment of the Agenda ADHD
application, implemented as an isolated Next.js prototype at `prototypes/ui-shell/` on the
`feature/ui-shell` branch.

The increment covers:

- Welcome screen (Tavole 1-8)
- Radial navigation menu in expanded and compact states (Tavole 9-16 + demo video)
- Six section placeholder routes
- Development-only palette switcher covering all eight visual variants (UI-08 pending)

This document incorporates all refinements from the six design review sessions (Sections 1-6)
and supersedes any earlier partial descriptions.

---

## 2. References

| Document | Version | Role |
|---|---|---|
| Master Prompt - Agenda ADHD | v2.3.7 (47 pp.) | Highest authority; frozen decisions, UI contract |
| UI/UX Design Specification - Agenda ADHD | v1.0 Draft (12 pp.) | Confirmed behaviors, open decisions |
| Agenda - bozze tavole-selection | 23 boards | Visual baseline |
| Screen recording - radial menu open/close | 2026-10-23, 5.4 s | Animation behavior reference |

Source priority: Master Prompt v2.3.7 > UI/UX Spec confirmed behaviors > Tavole visual
baseline > video animation reference.

---

## 3. Scope

### In scope

- Next.js prototype at `prototypes/ui-shell/`
- Welcome screen (WELCOME state)
- Radial navigation menu (MENU_OPEN and MENU_CLOSED states)
- Six section placeholder routes: /oggi, /calendario, /lavagna, /inbox, /quaderno, /esercizi
- Development-only palette switcher for all eight variants
- Shared UI shell: layout, CSS tokens, font loading
- Automated navigation parity and state machine tests

### Explicit exclusions

- Authentication, MFA, user accounts
- Backend services, API calls, database
- Real content for any section
- Settings placement (open decision UI-04)
- iPhone-specific final navigation design (Tavola 23, in revision)
- Persistent user state or storage
- External animation libraries
- External icon libraries
- Final palette selection (open decision UI-08)
- Final font selection (provisional: Dancing Script)
- Final app name (provisional: "agenda")
- Current-section highlight on radial items (open design detail)
- Any application features beyond the six placeholder routes

---

## 4. Architecture and File Structure

### Location

`prototypes/ui-shell/` - completely isolated from any future P-01, P-02, P-03 prototypes.

### Stack

- Next.js 15, App Router
- React 19
- TypeScript, strict mode
- Tailwind CSS v4
- No additional runtime dependencies

### Directory tree

```
prototypes/ui-shell/
- app/
  - layout.tsx              Root layout: loads Dancing Script, sets data-palette="1",
  -                         renders PaletteSwitcher when env variable is set
  - page.tsx                Async server component: reads searchParams prop,
  -                         derives initialView, passes it to AppShell
  - globals.css             All CSS custom properties, palette definitions,
  -                         keyframe animations, reduced-motion overrides
  - oggi/
    - page.tsx
  - calendario/
    - page.tsx
  - lavagna/
    - page.tsx
  - inbox/
    - page.tsx
  - quaderno/
    - page.tsx
  - esercizi/
    - page.tsx
- components/
  - AppShell.tsx            Client component: sole owner of AppView state;
  -                         renders WelcomeScreen and RadialMenu with props
  - WelcomeScreen.tsx       Full-viewport gradient + Welcome heading + Inizia button
  - RadialMenu.tsx          Radial menu rendering; receives state and callbacks via props
  - RadialMenuItem.tsx      Single navigation item: icon + label; receives position + state
  - SectionPlaceholder.tsx  Shared placeholder layout for all six routes
- dev/
  - PaletteSwitcher.tsx     Development-only floating overlay;
  -                         delete this file and its import in layout.tsx to remove permanently
- lib/
  - constants.ts            APP_NAME, MENU_ITEMS (typed, references SECTIONS),
  -                         ITEM_STAGGER_MS
  - palettes.ts             PaletteEntry type, PALETTES array (IDs, labels, metadata only;
  -                         no hex values)
  - sections.ts             SECTIONS: single source of truth for route IDs, labels, titles
  - types.ts                AppView type
- .env.example              Documents NEXT_PUBLIC_SHOW_PALETTE_SWITCHER; committed; no secrets
- .env.local                (gitignored) Sets NEXT_PUBLIC_SHOW_PALETTE_SWITCHER=true for dev
```

### Key isolation rules

1. `dev/PaletteSwitcher.tsx` is the single file to delete for permanent removal of the dev tool.
2. `lib/constants.ts` is the single file to edit for app name, menu items, or geometry.
3. `app/globals.css` is the single source of truth for all palette-dependent colors.
4. `lib/sections.ts` is the single source of truth for section IDs, labels, and route paths.
5. No palette hex values appear anywhere except `globals.css`.
6. No section name is hardcoded in more than one file.

---

## 5. State Machine and Navigation

### AppView type

```ts
// lib/types.ts
export type AppView = 'WELCOME' | 'MENU_OPEN' | 'MENU_CLOSED'
```

### Single state owner: AppShell

`AppShell` is a `'use client'` component and the sole owner of `AppView` state. No child
component holds a copy of this state or calls state-setter functions except through callbacks
passed from `AppShell`.

`page.tsx` is an `async` server component that reads the `searchParams` prop (a Promise in
Next.js 15), derives `initialView`, and passes it to `AppShell` as a prop. No `useSearchParams`,
no Suspense boundary, and no client-side URL reading are required.

```tsx
// app/page.tsx
import { AppShell } from '@/components/AppShell'
import type { AppView } from '@/lib/types'

interface Props {
  searchParams: Promise<{ view?: string }>
}

export default async function Home({ searchParams }: Props) {
  const params = await searchParams
  const initialView: AppView = params.view === 'menu' ? 'MENU_CLOSED' : 'WELCOME'
  return <AppShell initialView={initialView} />
}
```

`AppShell` accepts `initialView` and uses it directly:

```tsx
// components/AppShell.tsx (excerpt)
'use client'

interface AppShellProps {
  initialView: AppView
}

export function AppShell({ initialView }: AppShellProps) {
  const [view, setView] = useState<AppView>(initialView)
  // ...
}
```

This pattern is compatible with Next.js 15 App Router, requires no Suspense fallback, avoids
the React Server/Client boundary issues that arise with `useSearchParams`, and ensures that the
server-rendered HTML already reflects the correct initial view for both `/` and `/?view=menu`.

**`initialView` is an initial-value-only prop.** `useState(initialView)` reads `initialView`
once, on mount. It does not observe subsequent prop changes. This is intentional.

When `handleStart` calls `setView('MENU_OPEN')` and then `router.replace('/?view=menu')`,
Next.js performs a soft navigation: `page.tsx` re-renders on the server with
`searchParams = { view: 'menu' }` and passes `initialView = 'MENU_CLOSED'` to the
still-mounted `AppShell`. Because React does not re-initialize `useState` for prop changes,
`view` remains `'MENU_OPEN'` - the state set by `setView` moments earlier. This is the correct
and expected outcome.

`AppShell` is only ever remounted from scratch when navigating between different routes (e.g.,
from a section route back to `/`). In that case, `useState(initialView)` correctly initializes
to the server-derived `initialView` for the new mount. This is also the correct outcome.

There is no scenario in which a mounted `AppShell` receives an `initialView` update that
should override its current `view` state. If such a scenario is introduced in a future
feature, it requires an explicit `useEffect` with a dependency on `initialView` - not a silent
change to `useState` behavior.

No focus is assigned on any mount scenario; the browser handles initial focus naturally.

### Transition table

| From | Event | To |
|---|---|---|
| WELCOME | Inizia button clicked | MENU_OPEN |
| MENU_OPEN | Center app-name button clicked | MENU_CLOSED |
| MENU_OPEN | Escape key | MENU_CLOSED |
| MENU_OPEN | Radial item (link) clicked | navigate to section route |
| MENU_CLOSED | Compact control clicked | MENU_OPEN |
| Section route | Torna al menu clicked | /?view=menu which initializes MENU_CLOSED (replace navigation - no push) |

### Returning from sections

Section placeholder "Back" links use `href="/?view=menu"`. `AppShell` reads the `view` search
parameter on mount and initializes to `MENU_CLOSED`. No storage and no global state are
required. The Welcome screen is bypassed by URL parameter, not preserved React state.

### URL and browser history synchronization

The WELCOME -> MENU_OPEN transition is the only transition that writes to the URL. All other
menu state changes are React-state-only (no URL change). Section navigation uses Next.js
`<Link>`, which manages the URL naturally.

```tsx
// components/AppShell.tsx (excerpt)
'use client'
import { useRouter } from 'next/navigation'

export function AppShell({ initialView }: AppShellProps) {
  const [view, setView] = useState<AppView>(initialView)
  const router = useRouter()

  function handleStart() {
    setView('MENU_OPEN')
    router.replace('/?view=menu')
  }
  // ...
}
```

`router.replace` (not `push`) is used so that pressing Browser Back from a section route lands
at `/?view=menu` (the menu) rather than replaying the Welcome screen. This keeps history
coherent: the user navigated forward through Welcome into the app; the Welcome screen is not a
destination they return to via Back.

**URL/AppView/history transition table:**

| Scenario | URL | AppView | History effect |
|---|---|---|---|
| Initial visit | `/` | WELCOME | First history entry |
| Inizia clicked | `/?view=menu` | MENU_OPEN | Replaces `/` in history |
| Center close | `/?view=menu` | MENU_CLOSED | No URL change |
| Compact open | `/?view=menu` | MENU_OPEN | No URL change |
| Navigate to section | `/oggi` (etc.) | - (section route) | Pushes to history |
| Torna al menu (replace) | `/?view=menu` | MENU_CLOSED (mount) | Replaces section in history |
| Browser Back from section | `/?view=menu` | MENU_CLOSED (mount) | Back navigation |
| Reload at `/?view=menu` | `/?view=menu` | MENU_CLOSED (mount) | Same entry |
| Direct visit to `/?view=menu` | `/?view=menu` | MENU_CLOSED (mount) | First history entry |

"MENU_CLOSED (mount)" means `AppShell` remounts with `initialView = 'MENU_CLOSED'` from the
server-derived `searchParams`. This is a mount scenario; no programmatic focus is assigned.

**Corresponding test cases** (added to Section 12 state machine tests):

| Test | Assertion |
|---|---|
| Inizia replaces URL | After Inizia click: URL is `/?view=menu`; no new history entry pushed |
| Open/close no URL change | Toggling menu does not change the URL |
| Browser Back lands at menu | After Inizia + section navigation, Browser Back yields `/?view=menu` and MENU_CLOSED |

### Component prop contract

```tsx
// Inside AppShell render:
<WelcomeScreen
  visible={view === 'WELCOME'}
  onStart={handleStart}
/>
<RadialMenu
  visible={view !== 'WELCOME'}
  isOpen={view === 'MENU_OPEN'}
  onOpen={() => setView('MENU_OPEN')}
  onClose={() => setView('MENU_CLOSED')}
/>
```

### Inactive screen isolation

Both `WelcomeScreen` and `RadialMenu` remain in the DOM at all times. Neither is conditionally
rendered. Inactive screens receive:

- `data-hidden` attribute: triggers CSS opacity and visibility transition
- `inert` HTML attribute: removes the element from the accessibility tree and keyboard
  navigation; pointer events are blocked
- `aria-hidden="true"`: redundant safety for older assistive technology

Isolation rules by state:

- WELCOME: `RadialMenu` root element is `inert` and `aria-hidden`
- MENU_OPEN and MENU_CLOSED: `WelcomeScreen` root element is `inert` and `aria-hidden`
- MENU_CLOSED: the radial items container (not the center button) is `inert`; the center
  button remains interactive

Pointer events must remain disabled on inert elements throughout CSS opacity transitions.
The `inert` attribute is the behavioral gate; opacity is cosmetic only.

### Visibility CSS pattern

```css
/* globals.css */
.screen {
  opacity: 1;
  visibility: visible;
  transition: opacity 350ms ease, visibility 0ms 0ms;
}
.screen[data-hidden] {
  opacity: 0;
  visibility: hidden;
  /* visibility: hidden fires after the opacity transition completes */
  transition: opacity 350ms ease, visibility 0ms 350ms;
}
@media (prefers-reduced-motion: reduce) {
  .screen,
  .screen[data-hidden] {
    transition: none;
  }
}
```

### Rapid interaction safety

CSS transition interruption provides cosmetic continuity. Behavioral correctness is guaranteed
by the `inert` attribute, which is applied synchronously with React state changes before any
CSS transition begins. A transitioning-out element that has `inert` set cannot receive input
regardless of visual state.

Tests must verify that `inert` and `aria-hidden` remain synchronized with React state during
rapid repeated open/close cycles, not only at rest states.

### Focus management

Focus assignment is distinguished by scenario type.

**Mount scenarios** - never assign programmatic focus:

| Scenario | Focus behavior |
|---|---|
| Initial visit to `/` (WELCOME) | Browser default; no programmatic focus |
| Direct visit to `/?view=menu` (MENU_CLOSED) | Browser default; no programmatic focus |
| Return from section via back link | Browser default after client-side navigation; no programmatic focus |
| Browser Back or Forward to `/?view=menu` | Browser default; no programmatic focus |
| Reload while on `/?view=menu` | Browser default; no programmatic focus |

`AppShell` uses a `prevViewRef` to distinguish mount from genuine in-app transitions. This
pattern is correct under React Strict Mode (which invokes effects twice in development):

```tsx
const prevViewRef = useRef<AppView | null>(null)

useEffect(() => {
  const prevView = prevViewRef.current
  prevViewRef.current = view

  if (prevView === null) return   // initial mount: no previous view
  if (prevView === view) return   // Strict Mode double-invoke: view unchanged, skip

  // genuine in-app transition: prevView and view differ
  // assign focus based on view
}, [view])
```

Why this is correct:

- On initial mount: `prevView` is `null`. Effect returns immediately. No focus assigned.
- Under React Strict Mode (development only): the effect fires twice with the same `view`.
  On the second fire, `prevView === view`. Effect returns. No focus assigned.
- On a genuine in-app transition: `prevView` differs from `view`. Focus is assigned.

The two-effect `mountedRef` pattern (`useEffect(() => { mountedRef.current = true }, [])` +
a second effect that checks it) is not used. Both effects in that pattern run in the same
React commit; the first sets `mountedRef.current = true` before the second checks it, so the
guard is always bypassed on mount. Under Strict Mode this also fires focus incorrectly on
the second invoke.

No `setTimeout` or `requestAnimationFrame` delays. Focus is assigned only after React has
committed the state change and the target element is confirmed non-inert.

**In-app transitions** - assign programmatic focus:

| Transition | Focus target |
|---|---|
| WELCOME -> MENU_OPEN | First radial item: `a[data-id="oggi"]` |
| MENU_OPEN -> MENU_CLOSED (any trigger) | Center compact control button |
| MENU_CLOSED -> MENU_OPEN | First radial item: `a[data-id="oggi"]` |

When closing via Escape or center button, focus returns to the center button, which is always
focusable when `RadialMenu` is visible (it is not inside the inert items container).

Additional rules:
- `RadialMenu` handles only its internal Escape key listener. All `AppView`-driven focus
  assignment is owned by `AppShell`.
- Focus is never assigned to an element inside an inert container.
- Focus is not stolen when `AppShell` mounts regardless of `initialView`.

### `prefers-reduced-motion`

A single block in `globals.css` disables both durations and delays:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    transition-duration: 0ms !important;
    transition-delay:    0ms !important;
    animation-duration:  0ms !important;
    animation-delay:     0ms !important;
  }
}
```

The final visual state and focus behavior are identical to the animated case; only motion is
removed. The `!important` overrides are contained to this media query block.

---

## 6. Welcome Screen

### Component signature

```tsx
// components/WelcomeScreen.tsx
interface WelcomeScreenProps {
  visible: boolean
  onStart: () => void
}
```

### Markup structure

```tsx
<div
  className="screen welcome-screen"
  data-hidden={!visible || undefined}
  inert={!visible || undefined}
  aria-hidden={!visible}
>
  <main className="welcome-main">
    <h1 className="welcome-heading">Welcome</h1>
    <button className="inizia-button" onClick={onStart} type="button">
      Inizia
    </button>
  </main>
</div>
```

`<main>` is the sole active landmark when WELCOME is the current view. During MENU_OPEN and
MENU_CLOSED the WelcomeScreen container is `inert` and `aria-hidden`, so its `<main>` is
excluded from the accessibility tree. There is never more than one active `<main>` landmark.

### Layout

- `position: fixed; inset: 0` - full viewport, stacked below the RadialMenu layer
- Background: `linear-gradient(var(--gradient-angle), var(--gradient-start), var(--gradient-end))`
- Content centered with flexbox column, `align-items: center`
- Welcome heading at approximately the upper portion of the viewport (provisional reference:
  ~40% from top); this is a visual guide, not a fixed coordinate
- Inizia button below the heading with approximately 2rem gap
- Height: `100dvh` (dynamic viewport height) to handle mobile browser chrome
- Padding accounts for `env(safe-area-inset-*)` on devices with notches or bars

### Responsive behavior

- Heading and button remain usable at different viewport heights, desktop browser zoom levels,
  and both iPad orientations
- Provisional "~40% from top" positioning adapts; it does not use a fixed pixel offset
- iPhone-specific design is excluded from this feature

### Typography - Welcome heading

```css
.welcome-heading {
  font-family: var(--font-welcome);   /* Dancing Script, cursive */
  font-size: clamp(3.5rem, 10vw, 6rem);
  font-weight: 400;
  color: var(--text-primary);
  line-height: 1.1;
  letter-spacing: 0.01em;
}
```

Dancing Script is loaded in `layout.tsx` via `next/font/google` (self-hosted at build time,
no runtime requests to Google Fonts). It is applied only to this heading. The font family is
exposed as `--font-welcome` on `:root`. A generic `cursive` fallback is preserved.

If `next/font` cannot download the font at build time, the build will fail with an error.
Do not silently substitute a different font; report the build failure.

This font choice is provisional. The final selection will be confirmed during visual review
against the original tavole.

### "Inizia" button

```css
.inizia-button {
  background:    var(--btn-surface);
  color:         var(--btn-label);
  min-height:    44px;
  min-width:     44px;
  padding:       0.625rem 2.5rem;
  border-radius: 9999px;
  font-size:     1rem;
  font-weight:   500;
  border:        none;
  cursor:        pointer;
}
.inizia-button:focus-visible {
  outline:        3px solid var(--focus-ring);
  outline-offset: 3px;
  box-shadow:     0 0 0 1px var(--focus-ring-bg);
}
```

`<button>` is used (not `<a>`) because Inizia triggers a state transition, not a URL
navigation.

The dual-layer focus ring (white outline + dark inner shadow via box-shadow) is designed to
remain legible across all eight palette gradients. Legibility must be verified against each
palette as a test requirement; see Section 12 and the contrast measurement requirements below.

### Accessibility

- `<h1>` for the Welcome heading
- `<main>` as the active page landmark when WELCOME is current
- `aria-hidden` on the root element mirrors the `inert` state
- Focus ring visibility across all eight palettes is an acceptance criterion; see A11Y-04
  in Section 12
- Minimum 44x44 CSS px touch target on the button

### Contrast measurement requirements

Contrast must be measured (not estimated) once actual hex values are implemented.

Required measurements per palette:

- White "Welcome" text against the gradient in the region the text occupies (WCAG AA: 3:1 for
  large text >= 24px regular or >= 18.67px bold)
- "Inizia" button label against `--btn-surface` (WCAG AA: 4.5:1 for normal-size text)
- Focus ring against the surrounding gradient background
- Focus ring `box-shadow` layer against the focus ring itself

Known preliminary risk flags (to be replaced with measured results in `lib/palettes.ts`):

| Palette | Risk |
|---|---|
| 1 - Arancione/Teal | Orange midpoint may approach AA large-text threshold |
| 3 - Verde/Teal | Green midpoint may approach AA large-text threshold |
| 4 - Cremisi/Arancione | Orange endpoint white-text risk |
| 7 - Oliva/Marrone | Both endpoints atypical; full measurement required |

Measured results are recorded in `lib/palettes.ts` `contrastNotes`. Failing measurements are
documented as issues; reference palette colors are not silently altered. Any proposed
corrections require explicit approval and visual review before implementation.

---

## 7. Radial Menu

### Component signature

```tsx
// components/RadialMenu.tsx
interface RadialMenuProps {
  visible: boolean
  isOpen:  boolean
  onOpen:  () => void
  onClose: () => void
}
```

### Markup structure

```tsx
<nav
  className="screen radial-menu"
  aria-label="Navigazione principale"
  data-hidden={!visible || undefined}
  inert={!visible || undefined}
  aria-hidden={!visible}
>
  <div className="radial-bg" aria-hidden="true" />
  <div
    className="radial-items"
    id="radial-items"
    inert={!isOpen || undefined}
  >
    {/* 6 x RadialMenuItem */}
  </div>
  <button
    className="radial-center"
    onClick={isOpen ? onClose : onOpen}
    aria-expanded={isOpen}
    aria-controls="radial-items"
    aria-label={isOpen ? 'Chiudi menu' : 'Apri menu'}
  >
    <span
      className="app-name"
      data-hidden={!isOpen || undefined}
      aria-hidden={!isOpen}
    >
      {APP_NAME}
    </span>
    <span
      className="compact-icon"
      data-hidden={isOpen || undefined}
      aria-hidden={isOpen}
    >
      {/* hamburger SVG, aria-hidden="true" */}
    </span>
  </button>
</nav>
```

`<nav>` provides the navigation landmark with an explicit `aria-label` to distinguish it from
any other navigation on the page.

Both center button states (app name and compact icon) remain in the DOM and cross-fade; neither
is conditionally rendered.

Decorative SVG icons are `aria-hidden="true"` throughout.

### Radial item positions and responsive geometry

Six items at evenly-spaced clock positions, angles measured from 12 o'clock (top):

| Item | Clock position | Angle |
|---|---|---|
| Oggi | 12h | 0 degrees |
| Calendario | 2h | 60 degrees |
| Lavagna | 4h | 120 degrees |
| Inbox | 6h | 180 degrees |
| Quaderno | 8h | 240 degrees |
| Esercizi | 10h | 300 degrees |

**Single consistent geometry system:**

JavaScript (in `lib/constants.ts`) computes unit-circle coordinates (radius = 1.0, no pixels).
CSS controls the actual radius through a responsive custom property. CSS multiplies them.

```ts
// lib/constants.ts (excerpt)
const toRad = (deg: number) => (deg - 90) * (Math.PI / 180)

// Unit-circle offsets (radius = 1.0). No pixel values in JS.
// CSS --radial-radius controls the actual distance.
export const ITEM_UNIT_OFFSETS = MENU_ITEMS.map(item => ({
  ...item,
  txUnit: parseFloat(Math.cos(toRad(item.angle)).toFixed(6)),
  tyUnit: parseFloat(Math.sin(toRad(item.angle)).toFixed(6)),
}))
```

In `globals.css`:

```css
:root {
  /* Responsive radius: 160px desktop baseline, scales with viewport.
   * Provisional formula - calibrate during visual review to ensure all items,
   * labels, focus indicators, and touch targets fit without clipping or overlap. */
  --radial-radius: clamp(120px, 20vmin, 160px);
}
```

Each `RadialMenuItem` receives `--tx-unit` and `--ty-unit` as inline style properties. CSS
computes the actual translation:

```css
.radial-item[data-open] {
  transform: translate(
    calc(-50% + var(--tx-unit) * var(--radial-radius)),
    calc(-50% + var(--ty-unit) * var(--radial-radius))
  );
  opacity: 1;
}
```

This is one system: JS handles trigonometry (at module-load time, not at runtime), CSS handles
responsiveness. No fixed pixel offsets appear in JavaScript. No `Math.cos`/`Math.sin` in CSS.

`RADIAL_RADIUS_PX` is removed from `lib/constants.ts`. Item and center sizes are CSS
custom properties (`--radial-item-size`, `--radial-center-size`) in `globals.css`.

### RadialMenuItem component

```tsx
// components/RadialMenuItem.tsx
import Link from 'next/link'

// ...

<Link
  href={`/${item.id}`}
  className="radial-item"
  data-id={item.id}
  data-open={isOpen || undefined}
  style={{
    '--tx-unit': item.txUnit,
    '--ty-unit': item.tyUnit,
    '--stagger': `${index * ITEM_STAGGER_MS}ms`,
  } as CSSProperties}
  aria-label={item.label}
>
  <span className="item-circle">
    <svg aria-hidden="true" focusable="false">{/* icon path */}</svg>
  </span>
  <span className="item-label" aria-hidden="true">{item.label}</span>
</Link>
```

`<Link>` from `next/link` provides client-side navigation (no full page reload). It renders
as `<a>` in the DOM, so all CSS selectors targeting `a[data-id="..."]` and all
keyboard-semantics rules (Enter-only activation for links) remain correct. Plain `<a>` is
not used for internal routes.

`aria-label` on the rendered `<a>` provides the accessible name. `item-label` is hidden from
screen readers to avoid duplication.

Touch target: minimum 44px in both dimensions via transparent padding outside the visible
circle. The visible circle diameter is smaller than the touch target.

### Icons (inline SVG, no library dependency)

| Item | Icon shape |
|---|---|
| Oggi | Sun: circle with 8 rays |
| Calendario | Calendar: rectangle with header and grid lines |
| Lavagna | Grid: 2x2 squares |
| Inbox | Tray: open container with downward arrow |
| Quaderno | Book: two open pages |
| Esercizi | Target: three concentric circles |

These shapes are provisional approximations of the reference tavole. Final icons are confirmed
during visual review.

### Animation

```css
/* Closed state (default) */
.radial-item {
  position: absolute;
  top:  50%;
  left: 50%;
  transform: translate(-50%, -50%);
  opacity: 0;
  transition:
    transform var(--anim-item-expand) var(--anim-item-easing),
    opacity   var(--anim-item-opacity) ease;
  transition-delay: var(--stagger, 0ms);
}

/* Open state */
.radial-item[data-open] {
  transform: translate(
    calc(-50% + var(--tx-unit) * var(--radial-radius)),
    calc(-50% + var(--ty-unit) * var(--radial-radius))
  );
  opacity: 1;
}

@media (prefers-reduced-motion: reduce) {
  .radial-item {
    transition: none;
    transition-delay: 0ms;
  }
}
```

Animation tokens live exclusively in `globals.css` as CSS custom properties. No ANIM object
in TypeScript. No JS writes to CSS properties at runtime.

The single exception is the per-item stagger delay: the stagger value is needed at render time
to generate an inline `--stagger` style per item. This single value lives in `lib/constants.ts`:

```ts
// lib/constants.ts
/** Per-item stagger delay in ms. Applied as inline --stagger per RadialMenuItem. Provisional. */
export const ITEM_STAGGER_MS = 40
```

All other animation values are defined only in `globals.css`:

```css
/* globals.css - animation tokens (all PROVISIONAL; calibrate against reference video) */
:root {
  --anim-screen-fade:      350ms;
  --anim-item-expand:      320ms;
  --anim-item-opacity:     200ms;
  --anim-center-crossfade: 200ms;
  --anim-item-easing:      cubic-bezier(0.34, 1.56, 0, 1);
}
```

The elastic easing is a provisional starting point. Final values require calibration against
the reference video. Do not treat any value as confirmed until that calibration has been done.
Test rapid interactions and interrupted transitions before treating any value as stable.

### Responsive radial geometry

- `--radial-radius` desktop baseline: 160px (provisional)
- Adaptive formula (provisional): `clamp(120px, 20vmin, 160px)`
- Total clearance per item includes: circle diameter, label height, focus ring thickness,
  touch target padding
- Items must not clip the viewport edge or overlap each other on any supported viewport
- Supported viewports: desktop, iPad landscape, iPad portrait
- If the available space cannot accommodate the radial arrangement without clipping or overlap,
  render an accessible linear fallback: a `<ul>` list with the same six links, same ARIA
  semantics, and a back link
- Fallback breakpoint is provisional; determine during visual review
- iPhone-specific final navigation design is excluded

### Keyboard behavior

Native semantics are preserved and not overridden:

- `Tab` / `Shift+Tab`: cycles through interactive elements in DOM order
- Buttons (`<button>`): activated by Enter and Space
- Links (`<a>`): activated by Enter only (native browser behavior; Space is not added)
- `Escape`: closes the menu when in MENU_OPEN only; the handler checks `isOpen` before acting
  and does not interfere with the palette switcher's own Escape handler
- MENU_CLOSED: only the center button is reachable by Tab (items container is `inert`)

The `keydown` listener for Escape is attached in `RadialMenu` via `useEffect` and removed on
cleanup. It calls `onClose` only when `isOpen` is true.

Focus management for `AppView` transitions is owned by `AppShell`. `RadialMenu` manages only
the Escape key listener. There are no duplicate focus effects.

### Interaction feedback

Hover, keyboard-focus, and pressed states are required for all interactive elements. Specific
visual appearances are provisional and subject to visual review.

The current-section highlight visible on Lavagna in some reference tavole (white outline ring)
is an open design detail. It is not implemented in this prototype. Placeholder behavior does
not invent a final form for this detail.

### Contrast requirements

All icons, text, circular borders, and focus indicators must be measured (not estimated)
against all eight palettes. Measurements must reflect the actual item position over the
gradient, not the gradient midpoint. Known preliminary risks are listed in `lib/palettes.ts`.
Reference colors are not silently altered; failures are documented and proposed separately.

---

## 8. Palette System and Development Switcher

### CSS architecture

`app/globals.css` is the single source of truth for all palette-dependent colors.

Shared semantic tokens that are identical across all palettes are defined once in `:root`.
Per-palette selectors override only the values that differ between palettes (primarily the
gradient colors).

```css
/* globals.css */

/* Shared tokens - identical across all palettes */
:root {
  --gradient-angle:  135deg;
  --text-primary:    #ffffff;
  --btn-surface:     rgba(255,255,255,0.90);
  --btn-label:       #1a1a1a;
  --item-border:     rgba(255,255,255,0.70);
  --item-bg:         rgba(255,255,255,0.08);
  --center-bg:       rgba(255,255,255,0.15);
  --center-border:   rgba(255,255,255,0.80);
  --focus-ring:      #ffffff;
  --focus-ring-bg:   rgba(0,0,0,0.40);
}

/*
 * UI-08: final palette selection is an open decision - no palette is approved.
 * All hex values below are PROVISIONAL. Calibrate against reference tavole
 * during visual review before treating any value as confirmed.
 */

[data-palette="1"] {
  /* Tavola 1 - Arancione / Teal - PROVISIONAL */
  --gradient-start: #f97316;
  --gradient-end:   #14b8a6;
}
[data-palette="2"] {
  /* Tavola 2 - Blu / Viola - PROVISIONAL */
  --gradient-start: #3b82f6;
  --gradient-end:   #a855f7;
}
[data-palette="3"] {
  /* Tavola 3 - Verde / Teal - PROVISIONAL */
  --gradient-start: #22c55e;
  --gradient-end:   #0d9488;
}
[data-palette="4"] {
  /* Tavola 4 - Cremisi / Arancione - PROVISIONAL */
  --gradient-start: #dc2626;
  --gradient-end:   #f97316;
}
[data-palette="5"] {
  /* Tavola 5 - Navy / Blu - PROVISIONAL */
  --gradient-start: #1e3a5f;
  --gradient-end:   #2563eb;
}
[data-palette="6"] {
  /* Tavola 6 - Viola / Rosso - PROVISIONAL */
  --gradient-start: #7c3aed;
  --gradient-end:   #dc2626;
}
[data-palette="7"] {
  /* Tavola 7 - Oliva / Marrone - PROVISIONAL */
  --gradient-start: #65a30d;
  --gradient-end:   #92400e;
}
[data-palette="8"] {
  /* Tavola 8 - Ardesia / Teal - PROVISIONAL */
  --gradient-start: #475569;
  --gradient-end:   #0d9488;
}
```

`<html data-palette="1">` is set server-side in `layout.tsx` so palette 1 is active on first
paint with no flash of unstyled content.

### lib/palettes.ts

Metadata only. No color values. No duplication of `globals.css` content.

```ts
/* UI-08: @openDecision - final palette selection is pending visual review */

export interface PaletteEntry {
  id:              number
  label:           string
  provisional:     true
  referenceBoard:  string
  contrastNotes:   string[]  // risks to measure; empty = measurement pending
}

export const PALETTES: readonly PaletteEntry[] = [
  {
    id: 1, label: 'Arancione / Teal', provisional: true,
    referenceBoard: 'Tavola 1',
    contrastNotes: ['Welcome text at orange midpoint: measure AA large-text (3:1 minimum)'],
  },
  {
    id: 2, label: 'Blu / Viola', provisional: true,
    referenceBoard: 'Tavola 2', contrastNotes: [],
  },
  {
    id: 3, label: 'Verde / Teal', provisional: true,
    referenceBoard: 'Tavola 3',
    contrastNotes: ['Green midpoint: measure AA large-text (3:1 minimum)'],
  },
  {
    id: 4, label: 'Cremisi / Arancione', provisional: true,
    referenceBoard: 'Tavola 4',
    contrastNotes: ['Orange endpoint: white text risk - measure before visual review'],
  },
  {
    id: 5, label: 'Navy / Blu', provisional: true,
    referenceBoard: 'Tavola 5', contrastNotes: [],
  },
  {
    id: 6, label: 'Viola / Rosso', provisional: true,
    referenceBoard: 'Tavola 6', contrastNotes: [],
  },
  {
    id: 7, label: 'Oliva / Marrone', provisional: true,
    referenceBoard: 'Tavola 7',
    contrastNotes: [
      'Olive endpoint: measure white text contrast',
      'Brown endpoint: measure white text contrast',
      'Both endpoints are atypical - full measurement required',
    ],
  },
  {
    id: 8, label: 'Ardesia / Teal', provisional: true,
    referenceBoard: 'Tavola 8', contrastNotes: [],
  },
] as const

export const DEFAULT_PALETTE_ID = 1
export const PALETTE_COUNT      = 8
```

### dev/PaletteSwitcher.tsx

```tsx
'use client'
/*
 * DEVELOPMENT TOOL
 * Controlled by NEXT_PUBLIC_SHOW_PALETTE_SWITCHER environment variable.
 * To remove permanently: delete this file and the conditional in app/layout.tsx.
 */
```

Behavior:
- Fixed position outside the app stacking context (highest z-index layer)
- Collapsed by default: shows a small badge with the active palette ID
- Expands on click or Enter/Space to show all eight palette controls
- Switching a palette writes `document.documentElement.dataset.palette = String(id)`
  immediately; no React re-render in the app tree is triggered
- The active palette persists in the `data-palette` attribute even if the overlay is hidden;
  hiding the overlay does not reset the selection
- No interaction with `AppShell` state

Accessibility requirements for the switcher:
- `role="region"` with `aria-label` that includes "sviluppo" and "UI-08 aperta"
- Toggle button: `aria-expanded` synchronized with collapsed/expanded state;
  `aria-controls` referencing the palette list
- Each palette button: `aria-pressed` for active state; `aria-label` includes the palette
  name and a "provvisorio" / provisional notice
- Keyboard-operable: Tab, Enter, Space to select; Escape to collapse
- Visible focus ring on all interactive elements

### Production safety

```tsx
// app/layout.tsx
{process.env.NEXT_PUBLIC_SHOW_PALETTE_SWITCHER === 'true' && <PaletteSwitcher />}
```

- `.env.local` (gitignored): `NEXT_PUBLIC_SHOW_PALETTE_SWITCHER=true`
- `.env.example` (committed, no secrets): documents the variable with instructions
- Production builds without the env variable do not render the switcher
- Do not make claims about complete bundle exclusion (tree-shaking) without inspecting
  actual build output

To enable for a review build: set the env variable explicitly. To remove permanently: delete
`dev/PaletteSwitcher.tsx` and the conditional line in `layout.tsx`.

---

## 9. Section Placeholder Routes

### Single source of truth: lib/sections.ts

```ts
export const SECTIONS = [
  { id: 'oggi',       label: 'Oggi',       title: 'Oggi'       },
  { id: 'calendario', label: 'Calendario', title: 'Calendario' },
  { id: 'lavagna',    label: 'Lavagna',    title: 'Lavagna'    },
  { id: 'inbox',      label: 'Inbox',      title: 'Inbox'      },
  { id: 'quaderno',   label: 'Quaderno',   title: 'Quaderno'   },
  { id: 'esercizi',   label: 'Esercizi',   title: 'Esercizi'   },
] as const

// Derived literal union: 'oggi' | 'calendario' | 'lavagna' | 'inbox' | 'quaderno' | 'esercizi'
export type SectionId = (typeof SECTIONS)[number]['id']

export interface SectionConfig {
  readonly id:    SectionId
  readonly label: string
  readonly title: string
}
```

`SECTIONS` is declared without an explicit type annotation so that TypeScript infers the
narrowest literal types. `SectionId` is derived from `SECTIONS`, not declared separately.
Changing the array automatically updates the union type throughout the codebase.

`MENU_ITEMS` in `lib/constants.ts` uses `SectionId` for its `id` field. Individual page files
use `SectionId` as the type for the section lookup (`SECTIONS.find(s => s.id === 'oggi')`
returns `SectionConfig | undefined`; the non-null assertion `!` is valid because the route
file's id is a known literal from the same array). Page metadata and `SectionPlaceholder`
derive values from `SECTIONS`. No section name or route segment is hardcoded in more than one
place.

### SectionPlaceholder component

```tsx
// components/SectionPlaceholder.tsx
import Link from 'next/link'

interface Props { label: string }

export function SectionPlaceholder({ label }: Props) {
  return (
    <main className="section-placeholder">
      <h1>{label}</h1>
      <p className="not-implemented">
        Questa sezione non è ancora implementata.
      </p>
      <Link href="/?view=menu" replace className="back-link">
        Torna al menu
      </Link>
    </main>
  )
}
```

### Individual page files

Each page is explicit and minimal:

```tsx
// app/oggi/page.tsx
import type { Metadata } from 'next'
import { SECTIONS } from '@/lib/sections'
import { SectionPlaceholder } from '@/components/SectionPlaceholder'

const section = SECTIONS.find(s => s.id === 'oggi')!

export const metadata: Metadata = { title: section.title }

export default function OggiPage() {
  return <SectionPlaceholder label={section.label} />
}
```

The same pattern applies to all six routes.

### Back navigation

`<Link href="/?view=menu" replace>` (renders `<a>`) uses replacement navigation: it replaces
the current section URL in the browser history stack rather than pushing a new entry. This
prevents a history loop where pressing Back from the menu would land on the section the user
just left, then pressing Forward would return to the menu indefinitely.

History model for the replacement-navigation approach:

| Step | Action | History stack (simplified) | Current |
|---|---|---|---|
| 1 | Inizia (replace `/`) | `[/?view=menu]` | 0 |
| 2 | Navigate to /oggi (push) | `[/?view=menu, /oggi]` | 1 |
| 3 | Torna al menu (replace /oggi) | `[/?view=menu, /?view=menu]` | 1 |
| 4 | Browser Back | `[/?view=menu, /?view=menu]` | 0 |
| 5 | Browser Forward | `[/?view=menu, /?view=menu]` | 1 |

At step 4 and 5, navigating Back or Forward only visits `/?view=menu` states - no loop.

If the user visits multiple sections before returning to the menu (e.g., `/oggi` then
`/calendario`), each section push remains in history; only the current section entry is
replaced when Torna al menu is clicked:

| Step | Action | History stack | Current |
|---|---|---|---|
| 1 | Inizia | `[/?view=menu]` | 0 |
| 2 | /oggi push | `[/?view=menu, /oggi]` | 1 |
| 3 | /calendario push | `[/?view=menu, /oggi, /calendario]` | 2 |
| 4 | Torna al menu (replace /calendario) | `[/?view=menu, /oggi, /?view=menu]` | 2 |
| 5 | Browser Back | at /oggi | 1 |
| 6 | Browser Back | at /?view=menu | 0 |

Pressing Back from the menu at step 4 goes to `/oggi` (a previously visited section), then
further Back goes to the original `/?view=menu`. This is correct: the user's actual navigation
path is preserved; only the redundant second `/?view=menu` push is avoided.

Navigating to `/?view=menu` causes `AppShell` to mount with `view = 'MENU_CLOSED'`.
The Welcome screen is not shown.

### Accessible route transitions

- On arriving at a section route: browser default focus behavior; no programmatic focus
- On returning to `/?view=menu`: `AppShell` mounts with `initialView = 'MENU_CLOSED'`; this
  is a mount scenario, not an in-app transition, so no programmatic focus is assigned (see
  Section 5 focus management); the browser handles focus after client-side navigation
- The return link must be reachable via keyboard from any position on the placeholder page
- No focus is left on removed or inert elements during any transition

### Accessibility

- `<main>` is the sole active landmark on section routes
- `<h1>` provides a unique heading per route
- Back link: native `<a>`, descriptive visible text, minimum 44px touch target via padding
- The PaletteSwitcher `<aside>` in the root layout is `role="region"` and does not conflict
  with the `<main>` landmark

---

## 10. Accessibility Requirements

WCAG 2.2 Level AA throughout.

### Active landmark by view

| View | Active landmark |
|---|---|
| WELCOME | `<main>` inside WelcomeScreen |
| MENU_OPEN / MENU_CLOSED | `<nav aria-label="Navigazione principale">` |
| Section route | `<main>` inside SectionPlaceholder |

There is never more than one active `<main>` or unlabeled `<nav>` landmark at a time.

### `inert` attribute

Applied to inactive screen containers, not only to individual elements within them.
Browser support: Chromium 102+, Firefox 112+, Safari 15.5+. No polyfill for this prototype.

| State | Element receiving `inert` |
|---|---|
| WELCOME | RadialMenu root (`<nav>`) |
| MENU_OPEN / MENU_CLOSED | WelcomeScreen root (`<div>`) |
| MENU_CLOSED | Radial items container (`<div id="radial-items">`) |

### Touch targets

All interactive elements: minimum 44x44 CSS px. Transparent padding is used where the visual
element is smaller than the touch target.

### Keyboard navigation

- All interactive elements reachable via Tab in logical DOM order
- Buttons (`<button>`): activated by Enter and Space (native)
- Links (`<a>`): activated by Enter only (native; Space is not artificially added)
- Escape closes menu when MENU_OPEN; no-op when MENU_CLOSED or WELCOME
- No keyboard traps
- No interactive elements inside inert containers are reachable via Tab

### ARIA requirements

| Element | Attribute | Value |
|---|---|---|
| RadialMenu toggle button | `aria-expanded` | reflects `isOpen` |
| RadialMenu toggle button | `aria-controls` | `"radial-items"` |
| RadialMenu toggle button | `aria-label` | `"Chiudi menu"` or `"Apri menu"` |
| RadialMenu root | `aria-label` | `"Navigazione principale"` |
| Inactive screens | `aria-hidden` | `"true"` |
| All decorative SVGs | `aria-hidden` | `"true"` |
| Palette switcher region | `aria-label` | includes "sviluppo" and "UI-08 aperta" |

---

## 11. Animation and Responsive Behavior

### Animation token definitions (provisional)

`globals.css` is the single source of truth for all animation timing values (see Section 7
for the full token block). No ANIM object exists in TypeScript. No JS writes CSS custom
properties at runtime. The only animation-related value in TypeScript is `ITEM_STAGGER_MS`
(used to compute the inline `--stagger` style per item at render time).

All timing values are provisional. Final values require visual calibration against the
reference video. Do not treat any value as confirmed until that calibration has been done.

### Rapid interaction and interrupted transitions

- The `inert` attribute is applied synchronously with React state changes; this is the
  primary safety mechanism for rapid interactions
- CSS transitions interrupted mid-play restart from their current computed value (browser
  default); no additional handling is required for the cosmetic transition
- Tests verify that `inert` and `aria-hidden` remain synchronized during rapid repeated
  open/close cycles (not only at stable rest states)

### Responsive layout

| Viewport | Behavior |
|---|---|
| Desktop (large) | Full radial layout, radius 160px |
| iPad landscape | Adaptive radius via clamp; full radial layout expected |
| iPad portrait | Adaptive radius via clamp; full radial layout expected |
| Very small viewport | Accessible linear fallback list |

Adaptive radius formula (provisional): `clamp(120px, 20vmin, 160px)`

The fallback breakpoint is provisional. It is determined during visual review by measuring the
minimum viewport at which all items, labels, focus rings, and touch targets fit without
clipping or overlap. The fallback renders a `<ul>` with the same six `<a>` links and the same
ARIA semantics as the radial menu.

### `prefers-reduced-motion`

When active: both transition-duration and transition-delay are set to 0ms for all elements.
The final rendered state is visually and functionally identical to the animated path. Focus
behavior is identical.

---

## 12. Testing

No test is marked as passing until it has been executed. All entries below are requirements.

### Automated tests

#### Navigation parity

File: `__tests__/navigation-parity.test.ts`

| Test | Assertion |
|---|---|
| Route coverage | Every `id` in `MENU_ITEMS` has a corresponding directory under `app/` |
| Label parity | Each route renders `<h1>` matching `SECTIONS[id].label` |
| Back link target | Each `SectionPlaceholder` contains `<a href="/?view=menu">` rendered by `<Link replace>` |
| No extra content | Each placeholder renders only: heading, notice, back link |
| RadialMenuItem href | Each item's `href` equals `/${item.id}` |
| Section/menu parity | `SECTIONS` and `MENU_ITEMS` have identical id sets |

#### State machine and AppShell initialization

File: `__tests__/app-shell.test.tsx`

| Test | Assertion |
|---|---|
| Initial state - no param | Renders WELCOME; RadialMenu is inert |
| Direct load /?view=menu | Renders MENU_CLOSED; WelcomeScreen is inert |
| Reload at /?view=menu | Same result as direct load (searchParams re-read server-side) |
| Inizia transition | WELCOME -> MENU_OPEN on button click |
| Center close | MENU_OPEN -> MENU_CLOSED on center button click |
| Compact open | MENU_CLOSED -> MENU_OPEN on compact control click |
| Escape close - MENU_OPEN | MENU_OPEN -> MENU_CLOSED on Escape key |
| Escape no-op - MENU_CLOSED | State unchanged on Escape when MENU_CLOSED |
| Escape no-op - WELCOME | State unchanged on Escape when WELCOME |
| Rapid toggle 10x | `inert` and `aria-hidden` correct on all screen containers after rapid cycling |
| Focus - welcome to open | `a[data-id="oggi"]` focused after WELCOME -> MENU_OPEN (in-app) |
| Focus - open to closed | Center button focused after MENU_OPEN -> MENU_CLOSED (in-app) |
| Focus - closed to open | `a[data-id="oggi"]` focused after MENU_CLOSED -> MENU_OPEN (in-app) |
| No focus steal - initial load | No programmatic focus assigned on initial render (WELCOME) |
| No focus steal - direct /?view=menu | No programmatic focus assigned on mount with MENU_CLOSED |
| No focus steal - return from section | No programmatic focus assigned when AppShell mounts via back-link navigation |
| Production build - initialView | AppShell receives correct initialView from server searchParams |
| Inizia replaces URL | After Inizia click: URL is `/?view=menu`; `router.replace` called (no new history entry) |
| Open/close no URL change | Toggling menu open/closed does not change the URL |
| Browser Back lands at menu | After Inizia + section navigation, Browser Back yields `/?view=menu` and MENU_CLOSED |
| Soft nav - initialView ignored | `router.replace` triggers `page.tsx` re-render with `initialView='MENU_CLOSED'`; already-mounted AppShell remains in MENU_OPEN (useState not re-initialized) |
| Component remount from section | Client-side navigation from `/oggi` to `/?view=menu` causes AppShell to mount fresh; initializes to MENU_CLOSED (distinct from soft nav within same route) |
| Torna al menu - replace nav | Clicking back link replaces section URL in history (no extra push); history entry count does not increase |
| History loop prevention | After Inizia + /oggi + Torna al menu: Browser Back goes to `/?view=menu` (MENU_CLOSED), not back to /oggi |

#### Inert and accessibility isolation

| Test | Assertion |
|---|---|
| WelcomeScreen inert when hidden | `inert` on WelcomeScreen root when `view !== 'WELCOME'` |
| RadialMenu inert when WELCOME | `inert` on RadialMenu root when `view === 'WELCOME'` |
| Items inert when MENU_CLOSED | `inert` on `#radial-items` when `view === 'MENU_CLOSED'` |
| `aria-hidden` parity | `aria-hidden` matches `inert` on all screen containers at every state |
| No tab-reachable hidden element | Tab cycling in WELCOME reaches only Inizia; MENU_CLOSED reaches only center button |
| Inert sync on rapid toggle | After 10 rapid open/close cycles, inert states are correct for the final state |

#### Keyboard semantics

| Test | Assertion |
|---|---|
| Link activation - Enter | Radial item navigates on Enter key |
| Link activation - Space | Radial item does NOT navigate on Space key (native link behavior) |
| Button - Enter and Space | Center button and Inizia button activate on both Enter and Space |
| Back link - Enter | SectionPlaceholder back link navigates on Enter |

### Manual acceptance tests

None of the following tests are considered passed until executed and recorded.

#### Navigation

| ID | Test | Required result |
|---|---|---|
| NAV-01 | Click Inizia | MENU_OPEN; six items visible and reachable by Tab |
| NAV-02 | Click center app-name | MENU_CLOSED; compact control visible; focus on compact control |
| NAV-03 | Click compact control | MENU_OPEN; first item focused |
| NAV-04 | Click Oggi radial item | Navigate to /oggi; section heading "Oggi" visible |
| NAV-05 | Click back link | /?view=menu loads; MENU_CLOSED; Welcome not visible; no focus steal |
| NAV-06 | Return from all six sections | Each section back link returns to MENU_CLOSED; Welcome not visible |
| NAV-07 | Press Escape (MENU_OPEN) | MENU_CLOSED; focus on center button |
| NAV-08 | Press Escape (MENU_CLOSED) | No state change; no errors |
| NAV-09 | Browser Back from section | /?view=menu loads; MENU_CLOSED; Welcome not visible |
| NAV-10 | Browser Forward after Back | Correct view state for the URL in history |
| NAV-11 | Tab through MENU_OPEN | All six items and center button reachable; no inert elements in tab order |
| NAV-12 | Tab in MENU_CLOSED | Only center button reachable |
| NAV-13 | Tab in WELCOME | Only Inizia button reachable |
| NAV-14 | Rapid open/close toggle | No orphaned focus; no stuck inert attributes; layout stable |

#### Palette switcher

| ID | Test | Required result |
|---|---|---|
| PAL-01 | Switch palette | Both Welcome and radial menu update immediately and consistently |
| PAL-02 | All eight palettes | No layout breakage; text visible (flag palettes with contrast risk) |
| PAL-03 | Hide switcher overlay | Active palette unchanged; application UI not affected |
| PAL-04 | Switcher keyboard nav | All eight palettes selectable via keyboard; focus ring visible |
| PAL-05 | Switcher Escape | Switcher collapses; app state unchanged |

#### Accessibility

| ID | Test | Required result |
|---|---|---|
| A11Y-01 | Screen reader - WELCOME | Announces h1 and Inizia button; nothing announced from RadialMenu |
| A11Y-02 | Screen reader - MENU_OPEN | Announces nav landmark label; six link names; center close button |
| A11Y-03 | Screen reader - MENU_CLOSED | Announces only center open button; no radial items announced |
| A11Y-04 | Focus ring - all eight palettes | Focus ring visible on Inizia, center button, and radial items against each palette |
| A11Y-05 | Contrast - Welcome text | Measured ratio recorded per palette; failing palettes flagged |
| A11Y-06 | Contrast - button label | Measured ratio recorded per palette; failing palettes flagged |
| A11Y-07 | Contrast - radial item text | Measured ratio at actual item position; failing palettes flagged |

#### Responsive and motion

| ID | Test | Required result |
|---|---|---|
| RESP-01 | iPad portrait | Radial layout intact; no clipping; all items and controls accessible |
| RESP-02 | iPad landscape | Radial layout intact; no clipping; all items and controls accessible |
| RESP-03 | Desktop viewport narrow | Fallback list activates before items clip or overlap |
| RESP-04 | Browser zoom 200% | Layout intact; heading readable; controls usable |
| RESP-05 | Constrained viewport height | Heading and button remain visible and usable |
| MOT-01 | prefers-reduced-motion | No motion; final visual state correct; focus behavior identical to animated path |
| MOT-02 | Rapid toggle with reduced-motion | State and focus correct with no transitions |

---

## 13. Provisional Values and Implementation Assumptions

| Item | Provisional value | Where to change |
|---|---|---|
| App name | "agenda" | `lib/constants.ts` APP_NAME |
| Radial radius formula | clamp(120px, 20vmin, 160px) | `globals.css` :root --radial-radius |
| Center button diameter | 88px | `globals.css` :root --radial-center-size |
| Item circle diameter | 72px | `globals.css` :root --radial-item-size |
| Item stagger delay | 40ms per item | `lib/constants.ts` ITEM_STAGGER_MS |
| Gradient angle | 135deg | `globals.css` :root --gradient-angle |
| All eight palette hex values | See `globals.css` comments | `globals.css` per-palette blocks |
| Welcome heading size | clamp(3.5rem, 10vw, 6rem) | `globals.css` |
| Welcome heading vertical position | ~40% from top | `globals.css` .welcome-main |
| Font family | Dancing Script 400 | `layout.tsx` + `globals.css` --font-welcome |
| Screen fade duration | 350ms | `globals.css` :root --anim-screen-fade |
| Item expand duration | 320ms | `globals.css` :root --anim-item-expand |
| Item opacity duration | 200ms | `globals.css` :root --anim-item-opacity |
| Item easing | cubic-bezier(0.34, 1.56, 0, 1) | `globals.css` :root --anim-item-easing |
| Center crossfade duration | 200ms | `globals.css` :root --anim-center-crossfade |
| Responsive fallback breakpoint | TBD in visual review | `globals.css` |
| SVG icon shapes | Approximate; not final | `components/RadialMenuItem.tsx` |
| `inert` browser support | No polyfill; Chromium 102+, FF 112+, Safari 15.5+ | Design constraint |

---

## 14. Open Decisions

| ID | Topic | Status |
|---|---|---|
| UI-04 | Settings screen placement | Open - do not implement in this feature |
| UI-08 | Final palette and visual tokens | Open - provisional values in use; switcher provided |
| UI-11 | "Inizia" final destination in full app | Scoped to MENU_OPEN for this prototype |
| - | Final app name | Provisional: "agenda" |
| - | Final font selection | Provisional: Dancing Script |
| - | iPhone navigation final design | In revision per Tavola 23; excluded from this feature |
| - | Current-section highlight on radial items | Open design detail; not implemented |
| - | Animation easing calibration | Provisional; calibrate against reference video |
| - | Responsive fallback layout design | Provisional; determine during visual review |
| - | Contrast corrections for flagged palettes | Measure first; propose corrections separately |

Open decisions must not be resolved autonomously during implementation. Flag any that block
progress rather than choosing a direction.

---

## 15. Explicit Exclusions

The following are confirmed out of scope for `feature/ui-shell`. They must not be implemented
even if technically straightforward:

- Authentication, MFA, user accounts
- Backend services, API calls, database connections
- Real content for any section route
- Persistent user state or local/session storage
- External animation libraries
- External icon libraries
- Application features beyond the six placeholder routes
- Settings screen or final Settings placement
- PWA manifest or service worker
- iPhone-specific final navigation design
- Modifications to palette colors for contrast without explicit approval
- Any resolution of open decisions listed in Section 14
