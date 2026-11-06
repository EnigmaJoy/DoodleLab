# Design System

Reusable UI primitives shared across all screens in DoodleLab.

## Components

| Component | Purpose | Key props |
|-----------|---------|-----------|
| `AppHeader` | Sticky screen header with 4 slots | `returnVariant`, `title`, `viewControl`, `actions` |
| `SegmentedControl` | Pill tab group (`role="radiogroup"`) | `options`, `value`, `onChange` |
| `PeriodStepper` | Prev / Label / Next navigator | `label`, `onPrev`, `onNext`, `onToday` |
| `IconButton` | 44×44 px glass icon button | `label`, `icon`, `onClick` |

## Token reference

| Token | Value | Mobile |
|-------|-------|--------|
| `--header-h` | `76px` | `64px` |
| `--header-px` | `24px` | `16px` |
| `--ctrl-h` | `44px` | — |
| `--ctrl-radius` | `22px` | — |
| `--icon-size` | `18px` | — |
| `--icon-stroke` | `1.6` | — |

**Glass surface (controls — slots C and D):**
`linear-gradient(160deg, rgba(255,255,255,0.18), rgba(255,255,255,0.08))` + `backdrop-filter: blur(28px) saturate(160%)` + `box-shadow: inset 0 0 0 1px rgba(255,255,255,0.14)`

**Glass surface (header on scroll):**
`background: rgba(255,255,255,0.10)` + `backdrop-filter: blur(28px) saturate(160%)` + `box-shadow: inset 0 -1px 0 rgba(255,255,255,0.08)`

**Focus ring:** `outline: 2px solid #ffffff; outline-offset: 2px`

## Rules

- Never add a border or divider to `AppHeader` — the inset shadow on scroll is sufficient.
- `actions` accepts a maximum of 3 items.
- `IconButton.label` is always used as `aria-label` — make it descriptive.
- `AppHeader` renders an `<h1>` for `title` — screens must not render their own `<h1>`.
- `returnVariant="menu"` requires the `onMenuOpen` prop.
- `returnVariant="back"` calls `router.back()` internally — no extra prop needed.

## Modals

A single liquid-glass modal family. All dialog UI uses one of the four types below.

### Components

| Component | Type | Role | Close button |
|-----------|------|------|--------------|
| `ConfirmModal` | Confirmation | `alertdialog` | No — Annulla only |
| `DeleteConfirmModal` | Delete confirmation | `alertdialog` | No — Annulla only |
| `FormModal` | Form / input | `dialog` | X (Chiudi) |
| `ActionsModal` | Action list | `dialog` | X (Chiudi) |

### Props

**ConfirmModal**
```ts
{ title, body, confirmLabel, onConfirm, onClose }
```

**DeleteConfirmModal**
```ts
{ title, chip, body, confirmLabel, onConfirm, onClose, confirmError? }
```
`chip` — short summary label shown below the title (e.g. "Focus block · 19:15 - 20:15").
`confirmError` — if set, button label becomes "Riprova".

**FormModal**
```ts
{ title, confirmLabel, onConfirm, onClose, confirmDisabled?, preventScrimClose?, children }
```
`preventScrimClose` — set to `true` while the form has unsaved input.

**ActionsModal**
```ts
{ eyebrow?, title, meta?, description?, items, onClose }
items: { icon, label, note?, onClick, danger? }[]
```

### useModalState

```ts
const { isOpen, open, close } = useModalState()
```
Focus return is automatic: native `<dialog>` restores focus to the element that called `open()`.

### Token reference (Modal.module.css)

| Token / rule | Value |
|---|---|
| Scrim | `rgba(10,10,40,0.45)` + `blur(14px)` |
| Card background | gradient over `--gradient-start` at 78% opacity |
| Card blur | `blur(40px) saturate(170%)` |
| Card shadow | `inset 0 0 30px rgba(255,255,255,0.10)`, `0 30px 80px rgba(10,10,50,0.40)` |
| Card radius | `28px` |
| Card padding | `28px` |
| Internal gap | `14px` |
| Small width | `420px` |
| Medium width | `500px` |
| Footer button height | `48px` |
| Form field height | `52px`, `font-size: 16px` (prevents iOS zoom) |
| Action row height | `52px`, radius `16px`, gap between rows `6px` |
| Danger row | `color: #FCA5A5`, 8px extra top margin |
| Delete icon circle | `52px`, `rgba(248,113,113,0.20)` |
| Scrim animation | 200ms ease |
| Card animation | 280ms `cubic-bezier(0.22, 1, 0.36, 1)` from `scale(0.96) translateY(8px)` |

### Rules

- **No borders, no divider lines.** Separation uses glass, spacing and shadow only.
- **One primary/danger action per modal.** Annulla is always on the left.
- **X button only in FormModal and ActionsModal.** ConfirmModal and DeleteConfirmModal close via Annulla.
- **Escape and scrim tap close**, except FormModal with `preventScrimClose={true}`.
- **Destructive action row** is always last in ActionsModal. It opens a DeleteConfirmModal — it never deletes directly.
- **Maximum 3 items** in ActionsModal action list (design constraint, not runtime enforcement).
- **Reduced motion:** animations disabled via `@media (prefers-reduced-motion: reduce)`.
