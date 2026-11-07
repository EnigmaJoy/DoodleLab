# AppHeader Design System Component

**Date:** 2026-11-04
**Branch:** features/localStorage-life-cycle
**Reference:** DS.01 Design system - Header

---

## Goal

Build a reusable `AppHeader` component that every screen uses, enforcing the design system's visual language (liquid glass, Figtree typography, transparent-at-rest / glass-on-scroll). Migrate all four existing screen headers (Oggi, Calendario, Lavagna, Impostazioni) to this component.

---

## Section 1: Architecture & File Structure

New folder `design-system/` at the project root, alongside `components/`:

```
design-system/
  AppHeader.tsx              ← main component
  AppHeader.module.css       ← layout + scroll-state styles
  AppHeader.test.tsx         ← tests
  SegmentedControl.tsx       ← slot C variant 1
  SegmentedControl.module.css
  SegmentedControl.test.tsx
  PeriodStepper.tsx          ← slot C variant 2
  PeriodStepper.module.css
  PeriodStepper.test.tsx
  IconButton.tsx             ← slot D icon action
  IconButton.module.css
  IconButton.test.tsx
  README.md                  ← token reference
```

`design-system/` is separate from `components/` because its modules are **reusable primitives** with stable public APIs, not tied to a single screen. Screens import from `@/design-system/AppHeader` etc.

Existing screen headers are removed and replaced:
- `OggiView.tsx` — remove `.cal-header` / `.today-header` block
- `CalendarView.tsx` — remove `.cal-header` block
- `components/board/BoardHeader.tsx` — file deleted; logic moved inline to `BoardView`
- `Settings.tsx` — remove inline sticky header

---

## Section 2: Component API

```ts
// design-system/AppHeader.tsx

type ReturnVariant = 'menu' | 'back'

interface SegmentedControlProps {
  kind:     'segmented'
  options:  { value: string; label: string }[]
  value:    string
  onChange: (value: string) => void
}

interface PeriodStepperProps {
  kind:    'stepper'
  label:   string          // e.g. "novembre 2026"
  onPrev:  () => void
  onNext:  () => void
  onToday: () => void
}

type ViewControl = SegmentedControlProps | PeriodStepperProps

interface ActionItem {
  kind:     'icon' | 'secondary' | 'primary'
  label:    string          // always required; used as aria-label for icon kind
  icon?:    React.ReactNode // required if kind='icon'
  onClick:  () => void
}

interface AppHeaderProps {
  returnVariant: ReturnVariant
  onMenuOpen?:   () => void   // required if returnVariant='menu'
  title:         string
  meta?:         string       // row above title (e.g. date)
  subtitle?:     string       // row below title (e.g. note count)
  viewControl?:  ViewControl  // slot C — omit if not needed
  actions?:      ActionItem[] // slot D — max 3
  titleLive?:    boolean      // adds aria-live="polite" to title span (Calendario)
  subtitleLive?: boolean      // adds aria-live="polite" to subtitle span (Lavagna)
}
```

**Return button behaviour:**
- `'menu'` → calls `onMenuOpen` (wired through `AppShell`)
- `'back'` → calls `router.back()` internally; no extra prop required

**`actions` max 3:** enforced by documentation in README, not at runtime.

---

## Section 3: Visual Tokens & Scroll Behaviour

### CSS tokens (local to AppHeader.module.css)

```css
.header {
  --header-h:     76px;   /* 64px on mobile */
  --header-px:    24px;   /* 16px on mobile */
  --ctrl-h:       44px;
  --ctrl-radius:  22px;
  --icon-size:    18px;
  --icon-stroke:  1.6;
}
```

### Surfaces

**At rest:** fully transparent — no background, no backdrop-filter. The header floats over the screen's gradient background.

**On scroll:** `background: rgba(255,255,255,0.10)` + `backdrop-filter: blur(28px) saturate(160%)` + `box-shadow: inset 0 -1px 0 rgba(255,255,255,0.08)`. Transition: `200ms cubic-bezier(0.4,0,0.2,1)`. **Never** a solid border or divider.

**Triggered by:** `data-scrolled` attribute on the header element. CSS reacts to `[data-scrolled]`.

### Scroll detection

An `IntersectionObserver` watches a 1px sentinel `<div>` placed immediately below the header. When the sentinel leaves the viewport the header receives `data-scrolled`.

```tsx
// internal hook, not exported
function useScrolled(sentinelRef: RefObject<HTMLDivElement>) {
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => setScrolled(!e.isIntersecting))
    io.observe(el)
    return () => io.disconnect()
  }, [sentinelRef])
  return scrolled
}
```

### Typography (Figtree, already loaded)

| Role | Size | Weight |
|------|------|--------|
| title | 24px | 700 |
| meta | 15px | 600 |
| subtitle | 13px | 500 |
| button label | 15px | 600 |

### Control surfaces (slots C and D)

- **Secondary / icon:** `linear-gradient(160deg, rgba(255,255,255,0.18), rgba(255,255,255,0.08))` + `backdrop-filter: blur(28px) saturate(160%)` + `box-shadow: inset 0 0 0 1px rgba(255,255,255,0.14)`
- **Primary:** `background: #ffffff`, text colour = `var(--gradient-start)` (palette ink)

---

## Section 4: Screen Migration

### Oggi (`components/today/OggiView.tsx`)

```tsx
<AppHeader
  returnVariant="menu"
  onMenuOpen={onMenuOpen}
  meta={formatDate(currentDate)}   // e.g. "mercoledì 4 novembre"
  title="Oggi"
  actions={[{
    kind: 'secondary', label: 'Calendario', onClick: () => router.push('/calendario')
  }]}
/>
```

Removed: `.cal-header`, `.today-header` block, "Vai a oggi" button (removed per design decision).

---

### Calendario (`components/CalendarView.tsx`)

```tsx
<AppHeader
  returnVariant="menu"
  onMenuOpen={onMenuOpen}
  title={monthLabel}
  titleLive={true}
  viewControl={{
    kind:    'stepper',
    label:   monthLabel,
    onPrev:  prevMonth,
    onNext:  nextMonth,
    onToday: goToToday,
  }}
/>
```

Removed: `.cal-header` block, inline prev/next/today buttons.

---

### Lavagna (`components/board/BoardHeader.tsx` → deleted)

Logic moves inline into `BoardView`. `BoardHeader.tsx` is deleted.

```tsx
<AppHeader
  returnVariant="back"
  title={board.title}
  subtitle={`${noteCount} note`}
  subtitleLive={true}
  viewControl={{
    kind:     'segmented',
    options:  [{ value: 'free', label: 'Libera' }, { value: 'grid', label: 'Griglia' }],
    value:    layoutMode,
    onChange: setLayoutMode,
  }}
  actions={[{
    kind: 'icon', label: 'Aggiungi post-it',
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
    onClick: addNote
  }]}
/>
```

Removed: `.board-header`, inline layout toggle, disabled "Disegna" button (was already non-functional).

---

### Impostazioni (`components/Settings.tsx`)

```tsx
<AppHeader
  returnVariant="back"
  title="Impostazioni"
/>
```

Removed: inline sticky header with `← Indietro` and `<h1>`.

---

## Section 5: Accessibility & Testing

### Accessibility

- `<header>` element — implicit `role="banner"`, one per page.
- `title` rendered as `<h1>` — screens remove their own `<h1>`.
- `meta` and `subtitle` as `<p>` elements.
- `subtitle` with `subtitleLive={true}` → `aria-live="polite"` (Lavagna note count).
- `title` with `titleLive={true}` → `aria-live="polite"` (Calendario month label).
- Return "menu" button: `aria-label="Apri menu"`.
- Return "back" button: `aria-label="Indietro"`.
- `SegmentedControl`: `role="radiogroup"`, each segment `role="radio" aria-checked`.
- `PeriodStepper`: prev `aria-label="Mese precedente"`, next `aria-label="Mese successivo"`, today `aria-label="Vai a oggi"`.
- `IconButton`: `aria-label` from required `label` prop.
- Focus ring: `outline: 2px solid #ffffff; outline-offset: 2px` on all interactive elements.

### Tests (`AppHeader.test.tsx`)

1. `returnVariant="menu"` → button `aria-label="Apri menu"`, click calls `onMenuOpen`
2. `returnVariant="back"` → button `aria-label="Indietro"`, click calls `router.back()`
3. `title` rendered as `h1`
4. `meta` and `subtitle` present when provided
5. `SegmentedControl` rendered in slot C; value change calls `onChange`
6. `PeriodStepper` rendered in slot C; prev/next/today call their callbacks
7. Icon action rendered; click calls `onClick`
8. Scroll state: sentinel intersection triggers `data-scrolled` on header

Additional test files: `SegmentedControl.test.tsx`, `PeriodStepper.test.tsx`, `IconButton.test.tsx`.

---

## Out of Scope

- Dark mode adaptations (stub only, matches existing Settings treatment)
- Animation on header mount/unmount (screens handle their own entrance)
- More than 3 actions in slot D (not a use case in current screens)
- Breadcrumb navigation (not needed in flat navigation structure)
