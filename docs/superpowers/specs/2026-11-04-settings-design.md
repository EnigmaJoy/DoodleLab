# Settings Screen ("Impostazioni") Design

**Date:** 2026-11-04
**Branch:** features/localStorage-life-cycle

---

## Goal

Add a Settings screen accessible from the radial menu that lets the user choose a colour palette, toggle visual effects, and configure auto-lock. Exit the app (logout) is also surfaced here via a satellite button on the radial menu with a confirmation modal.

---

## Section 1: Architecture & data layer

### New files
| File | Purpose |
|------|---------|
| `lib/palettes.ts` | Array of 8 palette objects `{ id, label, from, to }` |
| `lib/PreferencesContext.tsx` | React context + provider; reads/writes `localStorage` |
| `app/settings/page.tsx` | Next.js page, server component wrapper |
| `components/Settings.tsx` | Client component: full settings screen |
| `components/Settings.module.css` | CSS module for settings layout and cards |
| `components/ExitModal.tsx` | Confirmation modal for logout |
| `components/ExitModal.module.css` | CSS module for modal |
| `components/Settings.test.tsx` | Vitest + Testing Library tests |
| `components/ExitModal.test.tsx` | Tests for modal |

### Modified files
| File | Change |
|------|--------|
| `components/RadialMenu.tsx` | Add satellite buttons (Settings + Esci) |
| `components/RadialMenu.module.css` | Add `.satellite` and `.satelliteRow` styles |
| `components/RadialMenu.test.tsx` | Tests for satellite buttons |
| `app/globals.css` | Keep existing `[data-palette="1-8"]` rules untouched |
| `app/layout.tsx` or `AppShell.tsx` | Wrap with `PreferencesProvider` |

### Palette system (parallel, non-destructive)
- Existing `[data-palette="1-8"]` selectors in `globals.css` remain unchanged.
- New `lib/palettes.ts` exports 8 palette objects with `from`/`to` hex values.
- `PreferencesContext` applies a palette by calling:
  ```ts
  document.documentElement.style.setProperty('--gradient-start', palette.from)
  document.documentElement.style.setProperty('--gradient-end',   palette.to)
  ```
  This feeds the same CSS vars already consumed by the radial menu and unlock screen.

### PreferencesContext shape
```ts
interface Preferences {
  paletteId:       string        // default: 'violet-rose' (current default palette)
  visualEffects:   boolean       // default: true
  darkMode:        'auto' | 'on' // stub — no-op for now
  autoLockMinutes: 1 | 5 | 30 | null  // null = never
}
```
Persisted to `localStorage` key `'doodlelab.preferences'` as JSON.
Applied on mount via `useEffect`.

---

## Section 2: Satellite buttons + Esci modal

### Satellite buttons on RadialMenu
Two small glass pill buttons rendered inside `RadialMenu`, positioned below the center button:

```
        [ ⚙ Impostazioni ]
        [ → Esci ]
```

- Each button: `height: 36px`, `border-radius: 18px`, `padding: 0 16px`, liquid-glass surface (same `radial-gradient` + `backdrop-filter` as items), white text, font-size `0.75rem`.
- "Impostazioni" uses `<Link href="/settings">`. Navigation handles the transition — no explicit close needed (RadialMenu is not rendered on the `/settings` route).
- "Esci" is a `<button>` that opens `ExitModal` without closing the menu.
- Both rendered inside a `.satelliteRow` flex column, `gap: 8px`, positioned `absolute` below center via `top: calc(50% + 56px)` (88px center / 2 + gap).
- Visible only when menu is open (`inert` when closed, same pattern as `.items`).
- Props added to `RadialMenu`: `onExitRequest: () => void` (no `onSettings` needed — Link handles navigation).

### ExitModal
Rendered by `AppShell` (or the page that owns the radial menu), triggered by `onExitRequest`.

```
┌─────────────────────────────┐
│   Vuoi uscire?              │
│                             │
│  Verrai disconnesso         │
│  dall'account.              │
│                             │
│  [ Annulla ]  [ Esci ]      │
└─────────────────────────────┘
```

- Glass card (`backdrop-filter` + radial-gradient), `border-radius: 20px`, centered on screen.
- Backdrop: `position: fixed; inset: 0; background: rgba(0,0,0,0.4)`.
- "Annulla": closes modal.
- "Esci": calls existing logout function (from whatever auth context exists), then redirects to `/`.
- Focus trap inside modal while open.
- Escape key closes modal.
- `role="dialog" aria-modal="true" aria-labelledby="exit-modal-title"`.

---

## Section 3: Settings page layout

Route: `/settings` (Next.js App Router page).

**Visual language:** Full-screen gradient background identical to the radial menu (`var(--gradient-start)` → `var(--gradient-end)`, 135°), same 3 decorative glow blobs. Keyframes duplicated in `Settings.module.css` (no shared CSS dependency).

**Structure (iPad landscape, 1180×820):**
```
┌─────────────────────────────────────────────────────────┐
│  ← Indietro              Impostazioni                   │
├────────────────────────┬────────────────────────────────┤
│  Aspetto               │  Generali                      │
│  [palette grid 2×4]    │  Blocco automatico             │
│                        │  [segmented control]           │
│  Effetti visivi  ○──   │  ─────────────────────────     │
│  Tema scuro      ──○   │  [avatar] nome@email     ›     │
└────────────────────────┴────────────────────────────────┘
```

**Header:** `position: sticky; top: 0`. "← Indietro" is a small glass pill `<Link href="/">`. "Impostazioni" is an `<h1>` centered. No card wrapping the header.

**Cards:** Each card is a glass panel:
- `backdrop-filter: blur(28px) saturate(160%)`
- `background: radial-gradient(circle, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.05) 70%, transparent 100%)`
- `border-radius: 24px`
- `padding: 28px`
- No hard border (mask dissolves edge)
- `mask-image: radial-gradient(ellipse at center, black 60%, transparent 100%)`

Cards sit side-by-side in a flex row, centered, `gap: 24px`. Each card `width: 340px` on iPad.

**Mobile (<500px):** Cards stack vertically, `width: 100%`, `margin: 0 16px`.

---

## Section 4: Left card — Aspetto

### Palette tiles (2×4 grid)
- 8 tiles, each `~60×60px`, `border-radius: 12px`
- Each tile background: `linear-gradient(135deg, palette.from, palette.to)`
- Active tile: `outline: 2px solid #ffffff; outline-offset: 2px`
- `role="radiogroup" aria-label="Palette colore"`, each tile `role="radio" aria-checked`
- Click → immediate live preview (CSS vars on `documentElement`) + save to `PreferencesContext`
- Grid: `display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px`

### Palette data (`lib/palettes.ts`)
```ts
export const PALETTES = [
  { id: 'violet-rose',   label: 'Viola Rosa',    from: '#581c87', to: '#be123c' },
  { id: 'ocean-teal',    label: 'Oceano',        from: '#0c4a6e', to: '#0f766e' },
  { id: 'sunset',        label: 'Tramonto',      from: '#7c2d12', to: '#a16207' },
  { id: 'forest',        label: 'Foresta',       from: '#14532d', to: '#065f46' },
  { id: 'midnight',      label: 'Mezzanotte',    from: '#1e1b4b', to: '#312e81' },
  { id: 'rose-gold',     label: 'Oro Rosa',      from: '#881337', to: '#9f1239' },
  { id: 'arctic',        label: 'Artico',        from: '#1e3a5f', to: '#1e40af' },
  { id: 'ember',         label: 'Brace',         from: '#7f1d1d', to: '#92400e' },
] as const
```

### Toggle switches
Two rows below the palette grid. Each row: label left + toggle right, `height: 44px`.

- **Effetti visivi** (`visualEffects: boolean`) — when `false`: glow divs `display: none`, `backdrop-filter` overridden to `none` via a `data-no-effects` attribute on `<html>`. CSS in `globals.css`:
  ```css
  [data-no-effects] .glow { display: none; }
  [data-no-effects] * { backdrop-filter: none !important; -webkit-backdrop-filter: none !important; }
  ```
- **Tema scuro** (`darkMode`) — stub. Switch rendered but `disabled`, with `(prossimamente)` in `0.7rem` muted text beneath the label.

Toggle markup: `<button role="switch" aria-checked={value} aria-label={label}>`.

---

## Section 5: Right card — Generali

### Auto-lock segmented control
- Label: `<p>Blocco automatico</p>` above the control
- 4 segments: `1 min · 5 min · 30 min · Mai`
- Active segment: white glass fill (same liquid-glass radial-gradient)
- Inactive: transparent
- Full card width
- `role="radiogroup"`, each segment `role="radio" aria-checked`
- Persisted as `autoLockMinutes: 1 | 5 | 30 | null` in `PreferencesContext`
- Wired to auto-lock timer in `AppShell` — if timer is hardcoded today, replace with preference value; if no timer exists, control is functional but timer is a stub

### Account info row
- Separated from segmented control by `border-top: 1px solid rgba(255,255,255,0.15)`, `margin-top: 20px`, `padding-top: 16px`
- Left: 36px avatar circle (initials from email, `background: rgba(255,255,255,0.2)`) + email address `font-size: 0.8rem`
- Right: `›` chevron
- `aria-disabled="true"`, no `onClick` — visual scaffolding for future account screen
- No focus ring (not interactive)

---

## Section 6: Accessibility & testing

### Accessibility
- All interactive elements reachable by Tab
- Palette tiles: `role="radiogroup"` + `role="radio" aria-checked`
- Segmented control: same pattern
- Toggle switches: `role="switch" aria-checked`
- Account row: `aria-disabled="true"`, excluded from tab order
- ExitModal: `role="dialog" aria-modal="true"`, focus trap, Escape closes
- `prefers-reduced-motion`: glows static, no transition on palette switch

### Tests (`Settings.test.tsx`)
- Renders both cards
- Palette tile click → `document.documentElement.style.setProperty` called with correct `--gradient-start` / `--gradient-end` values
- Palette tile click → `localStorage` updated
- Active tile has `aria-checked="true"`
- `visualEffects` toggle → `data-no-effects` attribute toggled on `<html>`
- Auto-lock selection → preference stored
- Back link navigates to `/`

### Tests (`ExitModal.test.tsx`)
- Renders when `isOpen={true}`, hidden when `false`
- "Annulla" calls `onClose`
- "Esci" calls logout function and redirects

### Tests (`RadialMenu.test.tsx` additions)
- Satellite buttons render when `isOpen={true}`
- Settings satellite is a link to `/settings`
- Esci satellite calls `onExitRequest`

---

## Out of scope
- Cambia PIN (no `VaultService.changePin` exists yet)
- Dark mode implementation (stub only)
- Account management screen (row is visual scaffolding only)
- Notification preferences
