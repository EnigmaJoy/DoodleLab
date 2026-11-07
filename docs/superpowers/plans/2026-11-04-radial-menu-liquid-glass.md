# Radial Navigation Menu — Liquid Glass Restyle

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle `RadialMenu` and `RadialMenuItem` to liquid-glass appearance matching board "04b Navigazione radiale - liquid glass", using a CSS module; no changes to routing, focus management, vault logic, or accessibility props.

**Architecture:** New `components/RadialMenu.module.css` owns all visual rules (liquid-glass items, glows with drift animation, hamburger→X transition, spring open/close). Palette tokens injected as inline CSS vars on the `<nav>` root. `lib/constants.ts` updated to remove pre-computed `txUnit`/`tyUnit` in favour of `--angle` degree-based CSS `rotate…translateX…rotate` transform. Old radial section removed from `globals.css`.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, CSS Modules, Vitest + @testing-library/react

---

## File map

| File | Action |
|------|--------|
| `lib/constants.ts` | Remove `txUnit`/`tyUnit`, add `RING_RADIUS_PX`, `OPEN_STAGGER_MS`, `CLOSE_STAGGER_MS` |
| `components/RadialMenu.module.css` | **New** — full visual CSS |
| `components/RadialMenuItem.tsx` | Inject `--angle`/`--stagger`/`--stagger-close`; use module class; update icons |
| `components/RadialMenu.tsx` | Inject palette vars; add glows; replace hamburger SVG with 3 bar spans; use module classes |
| `components/RadialMenu.test.tsx` | **New** — 8 behavioural tests |
| `app/globals.css` | Remove radial section (lines 292–441) and radial-specific `:root` vars |

`AppShell.tsx` and `app/globals.css` lines outside the radial section are **untouched**.

---

## Task 1: Update `lib/constants.ts`

**Files:**
- Modify: `lib/constants.ts`

This task removes the unit-circle pre-computation (`txUnit`, `tyUnit`) that was used by the old CSS translation approach, and adds three new named constants for the new CSS module.

- [ ] **Step 1: Rewrite `lib/constants.ts`**

Replace the entire file with:

```ts
// lib/constants.ts
import { SECTIONS } from './sections'
import type { SectionId } from './sections'

export const APP_NAME = 'agenda'

/** BCP-47 locale tag used for all date/time formatting in the app. */
export const LOCALE = 'it-IT'

/** Ring radius in px: distance from center to each radial item midpoint. */
export const RING_RADIUS_PX = 172

/** Per-item stagger delay in ms on open (item 0 opens first). */
export const OPEN_STAGGER_MS = 40

/** Per-item stagger delay in ms on close (item N-1 closes first). */
export const CLOSE_STAGGER_MS = 25

// Angles are measured clockwise from 12 o'clock (top).
const MENU_ITEM_ANGLES: Array<{ id: SectionId; angle: number }> = [
  { id: 'today',     angle:   0 },   // 12h
  { id: 'calendar',  angle:  60 },   // 2h
  { id: 'board',     angle: 120 },   // 4h
  { id: 'inbox',     angle: 180 },   // 6h
  { id: 'notebook',  angle: 240 },   // 8h
  { id: 'exercises', angle: 300 },   // 10h
]

interface MenuItem {
  id:    SectionId
  label: string
  angle: number   // degrees, clockwise from top (0 = 12h)
}

export const MENU_ITEMS: readonly MenuItem[] = MENU_ITEM_ANGLES.map(({ id, angle }) => {
  const section = SECTIONS.find(s => s.id === id)!
  return { id, label: section.label, angle }
})
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd prototypes/ui-shell && npx tsc --noEmit
```

Expected: errors only in `RadialMenuItem.tsx` (`item.txUnit`, `item.tyUnit` no longer exist). Those are fixed in Task 4.

- [ ] **Step 3: Commit**

```bash
git add lib/constants.ts
git commit -m "refactor(radial-menu): remove txUnit/tyUnit, add RING_RADIUS_PX and stagger constants"
```

---

## Task 2: Write failing tests for `RadialMenu`

**Files:**
- Create: `components/RadialMenu.test.tsx`

Write all tests now so they fail, then make them pass in Tasks 4–5.

- [ ] **Step 1: Create `components/RadialMenu.test.tsx`**

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React, { createRef } from 'react'

// ── Mocks ─────────────────────────────────────────────────────────────────

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) =>
    <a href={href} {...props}>{children}</a>,
}))

import { RadialMenu } from './RadialMenu'
import { MENU_ITEMS } from '@/lib/constants'

// ── Helper ────────────────────────────────────────────────────────────────

function setup(isOpen = false) {
  const onOpen  = vi.fn()
  const onClose = vi.fn()
  render(
    <RadialMenu
      visible={true}
      isOpen={isOpen}
      onOpen={onOpen}
      onClose={onClose}
      firstItemRef={createRef()}
      firstFallbackItemRef={createRef()}
      centerButtonRef={createRef()}
    />,
  )
  return { onOpen, onClose }
}

beforeEach(() => { vi.clearAllMocks() })

// ── Tests ─────────────────────────────────────────────────────────────────

describe('RadialMenu', () => {

  it('1. renders a nav with aria-label "Navigazione principale"', () => {
    setup()
    expect(screen.getByRole('navigation', { name: 'Navigazione principale' })).toBeTruthy()
  })

  it('2. renders 6 radial items each with --angle CSS var and data-id', () => {
    setup()
    for (const item of MENU_ITEMS) {
      const el = document.querySelector(`[data-id="${item.id}"]`) as HTMLElement | null
      expect(el, `missing item ${item.id}`).toBeTruthy()
      const angle = el!.style.getPropertyValue('--angle')
      expect(angle, `--angle missing on ${item.id}`).not.toBe('')
      // --angle is (item.angle - 90)deg; first item (angle=0) → -90deg
      const expected = `${item.angle - 90}deg`
      expect(angle).toBe(expected)
    }
  })

  it('3. renders fallback list with 6 labelled links', () => {
    setup()
    const fallback = screen.getByRole('list', { name: 'Navigazione - lista' })
    expect(fallback).toBeTruthy()
    for (const item of MENU_ITEMS) {
      expect(fallback.querySelector(`a[href="/${item.id}"]`), `missing fallback link for ${item.id}`).toBeTruthy()
    }
  })

  it('4. palette CSS vars injected on root nav', () => {
    setup()
    const nav = screen.getByRole('navigation')
    expect(nav.style.getPropertyValue('--bg-from')).not.toBe('')
    expect(nav.style.getPropertyValue('--glow-1')).not.toBe('')
  })

  it('5. center button click calls onOpen when closed', () => {
    const { onOpen } = setup(false)
    fireEvent.click(screen.getByRole('button', { name: 'Apri menu' }))
    expect(onOpen).toHaveBeenCalledOnce()
  })

  it('6. center button click calls onClose when open', () => {
    const { onClose } = setup(true)
    fireEvent.click(screen.getByRole('button', { name: 'Chiudi menu' }))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('7. Escape key calls onClose when menu is open', () => {
    const { onClose } = setup(true)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('8. Escape key does nothing when menu is already closed', () => {
    const { onClose } = setup(false)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).not.toHaveBeenCalled()
  })

})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd prototypes/ui-shell && npx vitest run components/RadialMenu.test.tsx
```

Expected: several failures (`--angle` not set, palette vars not injected). That is correct — the components are not yet updated.

- [ ] **Step 3: Commit**

```bash
git add components/RadialMenu.test.tsx
git commit -m "test(radial-menu): add failing tests for liquid-glass restyle"
```

---

## Task 3: Create `components/RadialMenu.module.css`

**Files:**
- Create: `components/RadialMenu.module.css`

This file owns all visual treatment. It is consumed by both `RadialMenu.tsx` (Tasks 4–5) and nothing else.

- [ ] **Step 1: Create `components/RadialMenu.module.css`**

```css
/* components/RadialMenu.module.css */

/* TODO: glass surface styles (glow, radial-gradient, backdrop-filter, mask)
   are candidates for a shared CSS module used by sign-in, unlock, and radial menu. */

/* ── Keyframes ─────────────────────────────────────────────── */

@keyframes drift-1 {
  from { transform: translate(0, 0); }
  to   { transform: translate(28px, -22px); }
}

@keyframes drift-2 {
  from { transform: translate(0, 0); }
  to   { transform: translate(-24px, 30px); }
}

@keyframes drift-3 {
  from { transform: translate(0, 0); }
  to   { transform: translate(20px, 18px); }
}

/* ── Reduced motion ────────────────────────────────────────── */

@media (prefers-reduced-motion: reduce) {
  .glow {
    animation: none;
  }
  .item {
    /* collapse spring to a simple fade */
    transition: opacity 150ms linear !important;
    transition-delay: 0ms !important;
  }
}

/* ── Root ──────────────────────────────────────────────────── */

.root {
  position:        fixed;
  inset:           0;
  z-index:         2;
  display:         flex;
  align-items:     center;
  justify-content: center;
  background: linear-gradient(135deg, var(--bg-from), var(--bg-to));
  color: #ffffff;
}

/* ── Decorative glows ──────────────────────────────────────── */

.glow {
  position:       absolute;
  border-radius:  50%;
  pointer-events: none;
  filter:         blur(14px);
}

.glow1 {
  width:      340px;
  height:     340px;
  top:        200px;
  left:       280px;
  background: var(--glow-1);
  opacity:    0.70;
  animation:  drift-1 12s ease-in-out infinite alternate;
}

.glow2 {
  width:      360px;
  height:     360px;
  top:        380px;
  left:       560px;
  background: var(--glow-2);
  opacity:    0.65;
  animation:  drift-2 14s ease-in-out infinite alternate;
}

.glow3 {
  width:      200px;
  height:     200px;
  top:        160px;
  left:       470px;
  background: var(--glow-3);
  opacity:    0.50;
  animation:  drift-3 16s ease-in-out infinite alternate;
}

/* ── Items container ───────────────────────────────────────── */

.items {
  position:        absolute;
  inset:           0;
  display:         flex;
  align-items:     center;
  justify-content: center;
}

/* ── Radial item (112 × 112 px liquid glass) ───────────────── */

/*
 * Positioning: rotate(--angle) translateX(R) rotate(-angle)
 * --angle is stored as (clockwise-from-top degrees - 90), so 0° points right,
 * giving the standard CSS transform-origin convention.
 * Open:  R = 172 px   Closed: R = 60 px (collapses toward center)
 */

.item {
  position:    absolute;
  top:         50%;
  left:        50%;
  width:       112px;
  height:      112px;
  margin-top:  -56px;
  margin-left: -56px;
  border-radius: 50%;
  display:         flex;
  align-items:     center;
  justify-content: center;
  text-decoration: none;
  color:           #ffffff;

  /* Liquid glass — no hard border; mask dissolves edge */
  background: radial-gradient(
    circle,
    rgba(255, 255, 255, 0.22) 0%,
    rgba(255, 255, 255, 0.06) 60%,
    transparent 100%
  );
  backdrop-filter:          blur(28px) saturate(160%);
  -webkit-backdrop-filter:  blur(28px) saturate(160%);
  mask-image:               radial-gradient(circle, black 40%, transparent 100%);
  -webkit-mask-image:       radial-gradient(circle, black 40%, transparent 100%);

  /* Closed (default) state */
  opacity: 0;
  transform: rotate(var(--angle)) translateX(60px) rotate(calc(-1 * var(--angle)));
  transition:
    transform 560ms cubic-bezier(0.34, 1.4, 0.64, 1),
    opacity   220ms ease;
  transition-delay: var(--stagger-close, 0ms);
}

/* Open state — data-open attribute set by RadialMenuItem when isOpen=true */
.item[data-open] {
  opacity: 1;
  transform: rotate(var(--angle)) translateX(172px) rotate(calc(-1 * var(--angle)));
  transition-delay: var(--stagger, 0ms);
}

.item:focus-visible {
  outline:        2px solid #ffffff;
  outline-offset: 2px;
}

@supports not (backdrop-filter: blur(1px)) {
  .item {
    background: rgba(255, 255, 255, 0.18);
  }
}

/* ── Item icon wrapper ─────────────────────────────────────── */

.itemIcon {
  display:         flex;
  align-items:     center;
  justify-content: center;
  flex-shrink:     0;
}

/* ── Radial layout wrapper ─────────────────────────────────── */

.radialLayout {
  /* Visible above 500px. Hidden below by media query. */
}

/* ── Fallback grid (<= 499px) ──────────────────────────────── */

.fallback {
  display:               none;
  grid-template-columns: 1fr 1fr;
  gap:                   12px;
  padding:               0;
  margin:                0;
  list-style:            none;
}

/* Each pill: icon (20 px) + label */
.fallbackItem a {
  display:         flex;
  align-items:     center;
  gap:             10px;
  width:           160px;
  height:          52px;
  padding:         0 20px;
  border-radius:   26px;
  text-decoration: none;
  color:           #ffffff;
  font-size:       0.8125rem;
  font-weight:     500;

  background: radial-gradient(
    ellipse at left center,
    rgba(255, 255, 255, 0.22) 0%,
    rgba(255, 255, 255, 0.06) 70%,
    transparent 100%
  );
  backdrop-filter:          blur(28px) saturate(160%);
  -webkit-backdrop-filter:  blur(28px) saturate(160%);
  mask-image:               linear-gradient(to right, black 70%, transparent 100%);
  -webkit-mask-image:       linear-gradient(to right, black 70%, transparent 100%);
}

.fallbackItem a:focus-visible {
  outline:        2px solid #ffffff;
  outline-offset: 2px;
}

@supports not (backdrop-filter: blur(1px)) {
  .fallbackItem a {
    background: rgba(255, 255, 255, 0.18);
  }
}

@media (max-width: 499px) {
  .radialLayout {
    display: none;
  }
  .fallback {
    display: grid;
  }
}

/* ── Center button ─────────────────────────────────────────── */

.center {
  position:        relative;
  z-index:         1;
  width:           88px;
  height:          88px;
  border-radius:   50%;
  border:          none;
  cursor:          pointer;
  display:         flex;
  align-items:     center;
  justify-content: center;
  color:           #ffffff;

  background: radial-gradient(
    circle,
    rgba(255, 255, 255, 0.28) 0%,
    rgba(255, 255, 255, 0.08) 70%,
    transparent 100%
  );
  backdrop-filter:          blur(28px) saturate(160%);
  -webkit-backdrop-filter:  blur(28px) saturate(160%);
  mask-image:               radial-gradient(circle, black 50%, transparent 100%);
  -webkit-mask-image:       radial-gradient(circle, black 50%, transparent 100%);
}

.center:focus-visible {
  outline:        2px solid #ffffff;
  outline-offset: 2px;
}

@supports not (backdrop-filter: blur(1px)) {
  .center {
    background: rgba(255, 255, 255, 0.22);
  }
}

/* ── Hamburger → X bars ────────────────────────────────────── */

/*
 * Three spans stacked vertically inside .bars.
 * When button has aria-expanded="true", bars transform into an X.
 *
 * Bar spacing: gap 6px, each bar 2px tall.
 * barTop center:    -(1px + 6px + 1px) = -8px from midpoint → shift down +8px for X
 * barBottom center: +8px from midpoint → shift up -8px for X
 */

.bars {
  display:        flex;
  flex-direction: column;
  gap:            6px;
  align-items:    center;
}

.bar {
  display:          block;
  width:            20px;
  height:           2px;
  border-radius:    1px;
  background:       currentColor;
  transform-origin: center;
  flex-shrink:      0;
  transition: transform 280ms ease, opacity 280ms ease;
}

.center[aria-expanded="true"] .barTop {
  transform: translateY(8px) rotate(45deg);
}

.center[aria-expanded="true"] .barMid {
  opacity:   0;
  transform: scaleX(0);
}

.center[aria-expanded="true"] .barBottom {
  transform: translateY(-8px) rotate(-45deg);
}
```

- [ ] **Step 2: Commit**

```bash
git add components/RadialMenu.module.css
git commit -m "feat(radial-menu): add liquid-glass CSS module"
```

---

## Task 4: Restyle `components/RadialMenuItem.tsx`

**Files:**
- Modify: `components/RadialMenuItem.tsx`

Replaces `--tx-unit`/`--ty-unit`/`--stagger` with `--angle`/`--stagger`/`--stagger-close`. Updates all icon SVGs to stroke-only `strokeWidth={1.35}`. Exports `ItemIcon` for use by the fallback list in `RadialMenu.tsx`.

**Angle convention:** `--angle` is `(item.angle − 90)deg`. Subtracting 90 converts "clockwise from top" to the standard CSS coordinate system where 0° points right, so `rotate(var(--angle)) translateX(R) rotate(calc(-1 * var(--angle)))` correctly places items at the original clock positions.

- [ ] **Step 1: Rewrite `components/RadialMenuItem.tsx`**

```tsx
// components/RadialMenuItem.tsx
import { forwardRef, type CSSProperties } from 'react'
import Link from 'next/link'
import { OPEN_STAGGER_MS, CLOSE_STAGGER_MS, MENU_ITEMS } from '@/lib/constants'
import styles from './RadialMenu.module.css'

type MenuItem = (typeof MENU_ITEMS)[number]

interface RadialMenuItemProps {
  item:   MenuItem
  index:  number
  isOpen: boolean
}

export const RadialMenuItem = forwardRef<HTMLAnchorElement, RadialMenuItemProps>(
  function RadialMenuItem({ item, index, isOpen }, ref) {
    return (
      <Link
        href={`/${item.id}`}
        ref={ref}
        className={styles.item}
        data-id={item.id}
        data-open={isOpen || undefined}
        style={{
          '--angle':        `${item.angle - 90}deg`,
          '--stagger':      `${index * OPEN_STAGGER_MS}ms`,
          '--stagger-close': `${(MENU_ITEMS.length - 1 - index) * CLOSE_STAGGER_MS}ms`,
        } as CSSProperties}
        aria-label={item.label}
      >
        <span className={styles.itemIcon} aria-hidden="true">
          <ItemIcon id={item.id} />
        </span>
      </Link>
    )
  },
)

/** Stroke-only icons, strokeWidth 1.35. Exported for use in the fallback list. */
export function ItemIcon({ id }: { id: string }) {
  const common = {
    width: 20, height: 20,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.35,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
    focusable: false,
  }
  switch (id) {
    case 'today':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="4" />
          <line x1="12" y1="2"  x2="12" y2="5" />
          <line x1="12" y1="19" x2="12" y2="22" />
          <line x1="2"  y1="12" x2="5"  y2="12" />
          <line x1="19" y1="12" x2="22" y2="12" />
          <line x1="4.93"  y1="4.93"  x2="7.05"  y2="7.05" />
          <line x1="16.95" y1="16.95" x2="19.07" y2="19.07" />
          <line x1="4.93"  y1="19.07" x2="7.05"  y2="16.95" />
          <line x1="16.95" y1="7.05"  x2="19.07" y2="4.93" />
        </svg>
      )
    case 'calendar':
      return (
        <svg {...common}>
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <line x1="3"  y1="9"  x2="21" y2="9" />
          <line x1="8"  y1="2"  x2="8"  y2="6" />
          <line x1="16" y1="2"  x2="16" y2="6" />
          <line x1="8.5" y1="13.5" x2="8.5" y2="13.5" strokeWidth={2} />
        </svg>
      )
    case 'board':
      return (
        <svg {...common}>
          <rect x="3"  y="3"  width="8" height="8" rx="1" />
          <rect x="13" y="3"  width="8" height="8" rx="1" />
          <rect x="3"  y="13" width="8" height="8" rx="1" />
          <rect x="13" y="13" width="8" height="8" rx="1" />
        </svg>
      )
    case 'inbox':
      return (
        <svg {...common}>
          <path d="M3 12h4l2 3h6l2-3h4" />
          <rect x="3" y="12" width="18" height="9" rx="1" />
          <line x1="12" y1="3" x2="12" y2="9" />
          <polyline points="9,6 12,9 15,6" />
        </svg>
      )
    case 'notebook':
      return (
        <svg {...common}>
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
          <line x1="12" y1="6" x2="12" y2="18" />
        </svg>
      )
    case 'exercises':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="3" />
          <circle cx="12" cy="12" r="7" />
          <circle cx="12" cy="12" r="11" />
        </svg>
      )
    default:
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="6" />
        </svg>
      )
  }
}
```

- [ ] **Step 2: Run tests**

```bash
cd prototypes/ui-shell && npx vitest run components/RadialMenu.test.tsx
```

Expected: test 2 (`--angle CSS var`) now passes. Tests 4–8 still fail because `RadialMenu.tsx` still uses global CSS classes (not the module) and doesn't inject palette vars. That is expected.

- [ ] **Step 3: Commit**

```bash
git add components/RadialMenuItem.tsx
git commit -m "feat(radial-menu): inject --angle/stagger vars; stroke-only icons; export ItemIcon"
```

---

## Task 5: Restyle `components/RadialMenu.tsx`

**Files:**
- Modify: `components/RadialMenu.tsx`

Injects palette CSS vars on `<nav>`, adds three glow divs, replaces the app-name/compact-icon toggle with three hamburger bar `<span>`s, and replaces all global class names with module classes. Keeps `"screen"` global class (needed by AppShell visibility transitions).

- [ ] **Step 1: Rewrite `components/RadialMenu.tsx`**

```tsx
// components/RadialMenu.tsx
'use client'

import { useEffect, type RefObject, type CSSProperties } from 'react'
import Link from 'next/link'
import { MENU_ITEMS } from '@/lib/constants'
import { RadialMenuItem, ItemIcon } from './RadialMenuItem'
import styles from './RadialMenu.module.css'

interface RadialMenuProps {
  visible:              boolean
  isOpen:               boolean
  onOpen:               () => void
  onClose:              () => void
  firstItemRef:         RefObject<HTMLAnchorElement | null>
  firstFallbackItemRef: RefObject<HTMLAnchorElement | null>
  centerButtonRef:      RefObject<HTMLButtonElement | null>
}

export function RadialMenu({
  visible,
  isOpen,
  onOpen,
  onClose,
  firstItemRef,
  firstFallbackItemRef,
  centerButtonRef,
}: RadialMenuProps) {
  // Escape closes the menu only when isOpen is true.
  // If the event originated inside .palette-switcher the PaletteSwitcher
  // handles it independently — the radial menu must not also close.
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && isOpen) {
        const switcher = document.querySelector('.palette-switcher')
        if (switcher?.contains(e.target as Node)) return
        onClose()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  return (
    <nav
      className={`screen ${styles.root}`}
      aria-label="Navigazione principale"
      data-hidden={!visible || undefined}
      inert={!visible || undefined}
      aria-hidden={!visible || undefined}
      style={{
        '--bg-from': 'var(--gradient-start, #581c87)',
        '--bg-to':   'var(--gradient-end,   #be123c)',
        '--glow-1':  'var(--gradient-start, #581c87)',
        '--glow-2':  'var(--gradient-end,   #be123c)',
        '--glow-3':  'color-mix(in srgb, var(--gradient-start) 60%, var(--gradient-end))',
      } as CSSProperties}
    >
      {/* Decorative glows */}
      <div className={`${styles.glow} ${styles.glow1}`} aria-hidden="true" />
      <div className={`${styles.glow} ${styles.glow2}`} aria-hidden="true" />
      <div className={`${styles.glow} ${styles.glow3}`} aria-hidden="true" />

      {/* Items — inert when closed so Tab only reaches the center button */}
      <div
        className={styles.items}
        id="radial-items"
        inert={!isOpen || undefined}
      >
        {/* Radial layout: visible above 500 px */}
        <div className={styles.radialLayout}>
          {MENU_ITEMS.map((item, index) => (
            <RadialMenuItem
              key={item.id}
              item={item}
              index={index}
              isOpen={isOpen}
              ref={index === 0 ? firstItemRef : undefined}
            />
          ))}
        </div>

        {/* Linear fallback: visible below 500 px */}
        <ul className={styles.fallback} aria-label="Navigazione - lista">
          {MENU_ITEMS.map((item, index) => (
            <li key={item.id} className={styles.fallbackItem}>
              <Link
                href={`/${item.id}`}
                aria-label={item.label}
                ref={index === 0 ? firstFallbackItemRef : undefined}
              >
                <span aria-hidden="true"><ItemIcon id={item.id} /></span>
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>

      {/* Center toggle button */}
      <button
        ref={centerButtonRef}
        className={styles.center}
        type="button"
        onClick={isOpen ? onClose : onOpen}
        aria-expanded={isOpen}
        aria-controls="radial-items"
        aria-label={isOpen ? 'Chiudi menu' : 'Apri menu'}
      >
        {/* Hamburger bars animate to X via CSS targeting aria-expanded="true" */}
        <span className={styles.bars} aria-hidden="true">
          <span className={styles.bar + ' ' + styles.barTop}    />
          <span className={styles.bar + ' ' + styles.barMid}    />
          <span className={styles.bar + ' ' + styles.barBottom} />
        </span>
      </button>
    </nav>
  )
}
```

- [ ] **Step 2: Run all RadialMenu tests**

```bash
cd prototypes/ui-shell && npx vitest run components/RadialMenu.test.tsx
```

Expected: all 8 tests pass.

- [ ] **Step 3: Run full test suite to check for regressions**

```bash
cd prototypes/ui-shell && npx vitest run
```

Expected: all tests pass (unlock page tests, vault tests, etc. unaffected).

- [ ] **Step 4: Commit**

```bash
git add components/RadialMenu.tsx
git commit -m "feat(radial-menu): liquid-glass restyle — glows, hamburger→X, spring transitions"
```

---

## Task 6: Clean up `app/globals.css`

**Files:**
- Modify: `app/globals.css`

Remove the radial menu CSS section (now handled entirely by the module) and remove the radial-specific CSS vars from `:root` (now hardcoded or injected inline). The `.screen` visibility rules and all non-radial CSS are **untouched**.

- [ ] **Step 1: Remove radial-specific vars from `:root` in `app/globals.css`**

In the `:root` block (lines ~9–44), delete these lines:

```css
  /* Radial item */
  --item-border: rgba(255, 255, 255, 0.70);
  --item-bg:     rgba(255, 255, 255, 0.08);

  /* Center button */
  --center-bg:     rgba(255, 255, 255, 0.15);
  --center-border: rgba(255, 255, 255, 0.80);

  /* Radial geometry - provisional; calibrate during visual review */
  --radial-radius:      clamp(120px, 20vmin, 160px);
  --radial-center-size: 88px;
  --radial-item-size:   72px;

  /* Animation tokens - PROVISIONAL; calibrate against reference video */
  --anim-item-expand:      500ms;
  --anim-item-opacity:     320ms;
  --anim-center-crossfade: 200ms;
  /* Expo ease-out: fast launch, long smooth deceleration, no bounce */
  --anim-item-easing:      cubic-bezier(0.16, 1, 0.3, 1);
```

Keep: `--gradient-angle`, `--text-primary`, `--btn-surface`, `--btn-label`, `--focus-ring`, `--focus-ring-bg`, `--anim-screen-fade`.

- [ ] **Step 2: Remove the entire RADIAL MENU section**

Delete the block that begins with `/* ============================================================` / `RADIAL MENU` and ends just before `/* ============================================================` / `SECTION PLACEHOLDER`. This is approximately lines 292–441 in the current file. The deleted rules are:

```
.radial-menu { … }
.radial-bg { … }
.radial-items { … }
.radial-item { … }
.radial-item[data-open] { … }
.radial-item:hover … { … }
.radial-item:focus-visible { … }
.item-circle { … }
.item-label { … }
.radial-center { … }
.radial-center:hover { … }
.radial-center:focus-visible { … }
.app-name { … }
.app-name[data-hidden] { … }
.compact-icon { … }
.compact-icon[data-hidden] { … }
```

- [ ] **Step 3: Run full test suite**

```bash
cd prototypes/ui-shell && npx vitest run
```

Expected: all tests pass. The CSS deletion does not affect tests since tests use the CSS module stub.

- [ ] **Step 4: TypeScript check**

```bash
cd prototypes/ui-shell && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add app/globals.css
git commit -m "chore(radial-menu): remove old global CSS; radial styles now in CSS module"
```
