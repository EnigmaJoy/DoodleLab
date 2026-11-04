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
