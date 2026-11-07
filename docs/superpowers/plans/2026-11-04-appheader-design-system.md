# AppHeader Design System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a reusable `AppHeader` component with sub-primitives (`IconButton`, `SegmentedControl`, `PeriodStepper`) and migrate all four existing screen headers to it.

**Architecture:** New `design-system/` folder at the project root holds primitives with stable public APIs. `AppHeader` is a sticky header with 4 slots (return button, title block, view control, actions) that is transparent at rest and gains a glass surface when the page scrolls. Each primitive is built test-first. Migrations remove old header markup from each screen file.

**Tech Stack:** React 19, TypeScript, Next.js 15 App Router, CSS Modules, Vitest + @testing-library/react, `useRouter` from `next/navigation`

---

## File Map

| Action | Path |
|--------|------|
| Create | `design-system/IconButton.tsx` |
| Create | `design-system/IconButton.module.css` |
| Create | `design-system/IconButton.test.tsx` |
| Create | `design-system/SegmentedControl.tsx` |
| Create | `design-system/SegmentedControl.module.css` |
| Create | `design-system/SegmentedControl.test.tsx` |
| Create | `design-system/PeriodStepper.tsx` |
| Create | `design-system/PeriodStepper.module.css` |
| Create | `design-system/PeriodStepper.test.tsx` |
| Create | `design-system/AppHeader.tsx` |
| Create | `design-system/AppHeader.module.css` |
| Create | `design-system/AppHeader.test.tsx` |
| Create | `design-system/README.md` |
| Modify | `components/Settings.tsx` |
| Modify | `components/Settings.module.css` |
| Modify | `components/board/NoteBoard.tsx` |
| Delete | `components/board/BoardHeader.tsx` |
| Modify | `components/CalendarView.tsx` |
| Modify | `components/today/OggiView.tsx` |

---

## Task 1: IconButton primitive

**Files:**
- Create: `design-system/IconButton.tsx`
- Create: `design-system/IconButton.module.css`
- Create: `design-system/IconButton.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// design-system/IconButton.test.tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import { IconButton } from './IconButton'

describe('IconButton', () => {
  it('1. renders a button with the given aria-label', () => {
    render(<IconButton label="Aggiungi" icon={<span>+</span>} onClick={() => {}} />)
    expect(screen.getByRole('button', { name: 'Aggiungi' })).toBeTruthy()
  })

  it('2. calls onClick when clicked', () => {
    const onClick = vi.fn()
    render(<IconButton label="Aggiungi" icon={<span>+</span>} onClick={onClick} />)
    fireEvent.click(screen.getByRole('button', { name: 'Aggiungi' }))
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('3. renders the icon node', () => {
    render(<IconButton label="X" icon={<span data-testid="icon">+</span>} onClick={() => {}} />)
    expect(document.querySelector('[data-testid="icon"]')).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```
npx vitest run design-system/IconButton.test.tsx
```

Expected: FAIL — `IconButton` module not found.

- [ ] **Step 3: Create `design-system/IconButton.tsx`**

```tsx
// design-system/IconButton.tsx
'use client'

import type { ReactNode } from 'react'
import styles from './IconButton.module.css'

interface IconButtonProps {
  label:   string
  icon:    ReactNode
  onClick: () => void
}

export function IconButton({ label, icon, onClick }: IconButtonProps) {
  return (
    <button
      type="button"
      className={styles.root}
      onClick={onClick}
      aria-label={label}
    >
      {icon}
    </button>
  )
}
```

- [ ] **Step 4: Create `design-system/IconButton.module.css`**

```css
/* design-system/IconButton.module.css */

.root {
  display:         flex;
  align-items:     center;
  justify-content: center;
  width:           44px;
  height:          44px;
  border-radius:   22px;
  border:          none;
  cursor:          pointer;
  color:           #ffffff;
  flex-shrink:     0;

  background:              linear-gradient(160deg, rgba(255, 255, 255, 0.18), rgba(255, 255, 255, 0.08));
  backdrop-filter:         blur(28px) saturate(160%);
  -webkit-backdrop-filter: blur(28px) saturate(160%);
  box-shadow:              inset 0 0 0 1px rgba(255, 255, 255, 0.14);
}

.root:focus-visible {
  outline:        2px solid #ffffff;
  outline-offset: 2px;
}
```

- [ ] **Step 5: Run tests to verify they pass**

```
npx vitest run design-system/IconButton.test.tsx
```

Expected: PASS 3/3.

- [ ] **Step 6: Commit**

```bash
git add design-system/IconButton.tsx design-system/IconButton.module.css design-system/IconButton.test.tsx
git commit -m "feat(design-system): add IconButton primitive"
```

---

## Task 2: SegmentedControl primitive

**Files:**
- Create: `design-system/SegmentedControl.tsx`
- Create: `design-system/SegmentedControl.module.css`
- Create: `design-system/SegmentedControl.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// design-system/SegmentedControl.test.tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import { SegmentedControl } from './SegmentedControl'

const OPTIONS = [
  { value: 'free',  label: 'Libera' },
  { value: 'grid',  label: 'Griglia' },
]

describe('SegmentedControl', () => {
  it('1. renders a radiogroup', () => {
    render(<SegmentedControl options={OPTIONS} value="free" onChange={() => {}} />)
    expect(screen.getByRole('radiogroup')).toBeTruthy()
  })

  it('2. renders a radio for each option', () => {
    render(<SegmentedControl options={OPTIONS} value="free" onChange={() => {}} />)
    expect(screen.getByRole('radio', { name: 'Libera' })).toBeTruthy()
    expect(screen.getByRole('radio', { name: 'Griglia' })).toBeTruthy()
  })

  it('3. active option has aria-checked="true"', () => {
    render(<SegmentedControl options={OPTIONS} value="grid" onChange={() => {}} />)
    expect(screen.getByRole('radio', { name: 'Griglia' }).getAttribute('aria-checked')).toBe('true')
    expect(screen.getByRole('radio', { name: 'Libera' }).getAttribute('aria-checked')).toBe('false')
  })

  it('4. clicking inactive option calls onChange with its value', () => {
    const onChange = vi.fn()
    render(<SegmentedControl options={OPTIONS} value="free" onChange={onChange} />)
    fireEvent.click(screen.getByRole('radio', { name: 'Griglia' }))
    expect(onChange).toHaveBeenCalledWith('grid')
  })

  it('5. aria-label applied to radiogroup when label prop provided', () => {
    render(
      <SegmentedControl options={OPTIONS} value="free" onChange={() => {}} label="Layout" />
    )
    expect(screen.getByRole('radiogroup', { name: 'Layout' })).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```
npx vitest run design-system/SegmentedControl.test.tsx
```

Expected: FAIL — `SegmentedControl` module not found.

- [ ] **Step 3: Create `design-system/SegmentedControl.tsx`**

```tsx
// design-system/SegmentedControl.tsx
'use client'

import styles from './SegmentedControl.module.css'

interface Option {
  value: string
  label: string
}

interface SegmentedControlProps {
  options:  Option[]
  value:    string
  onChange: (value: string) => void
  label?:   string
}

export function SegmentedControl({ options, value, onChange, label }: SegmentedControlProps) {
  return (
    <div
      className={styles.root}
      role="radiogroup"
      aria-label={label}
    >
      {options.map(opt => (
        <button
          key={opt.value}
          type="button"
          role="radio"
          aria-checked={opt.value === value}
          className={styles.segment}
          data-active={opt.value === value || undefined}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Create `design-system/SegmentedControl.module.css`**

```css
/* design-system/SegmentedControl.module.css */

.root {
  display:       flex;
  height:        44px;
  border-radius: 22px;
  overflow:      hidden;

  background:              linear-gradient(160deg, rgba(255, 255, 255, 0.12), rgba(255, 255, 255, 0.05));
  backdrop-filter:         blur(28px) saturate(160%);
  -webkit-backdrop-filter: blur(28px) saturate(160%);
  box-shadow:              inset 0 0 0 1px rgba(255, 255, 255, 0.14);
}

.segment {
  flex:            1;
  display:         flex;
  align-items:     center;
  justify-content: center;
  border:          none;
  cursor:          pointer;
  color:           rgba(255, 255, 255, 0.65);
  font-size:       0.9375rem;
  font-weight:     600;
  font-family:     inherit;
  background:      transparent;
  transition:      background 150ms ease, color 150ms ease;
  padding:         0 16px;
}

.segment[data-active] {
  background: linear-gradient(160deg, rgba(255, 255, 255, 0.28), rgba(255, 255, 255, 0.12));
  color:      #ffffff;
}

.segment:focus-visible {
  outline:        2px solid #ffffff;
  outline-offset: -2px;
}
```

- [ ] **Step 5: Run tests to verify they pass**

```
npx vitest run design-system/SegmentedControl.test.tsx
```

Expected: PASS 5/5.

- [ ] **Step 6: Commit**

```bash
git add design-system/SegmentedControl.tsx design-system/SegmentedControl.module.css design-system/SegmentedControl.test.tsx
git commit -m "feat(design-system): add SegmentedControl primitive"
```

---

## Task 3: PeriodStepper primitive

**Files:**
- Create: `design-system/PeriodStepper.tsx`
- Create: `design-system/PeriodStepper.module.css`
- Create: `design-system/PeriodStepper.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// design-system/PeriodStepper.test.tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import { PeriodStepper } from './PeriodStepper'

describe('PeriodStepper', () => {
  it('1. renders button aria-label "Mese precedente"', () => {
    render(<PeriodStepper label="nov 2026" onPrev={() => {}} onNext={() => {}} onToday={() => {}} />)
    expect(screen.getByRole('button', { name: 'Mese precedente' })).toBeTruthy()
  })

  it('2. renders button aria-label "Mese successivo"', () => {
    render(<PeriodStepper label="nov 2026" onPrev={() => {}} onNext={() => {}} onToday={() => {}} />)
    expect(screen.getByRole('button', { name: 'Mese successivo' })).toBeTruthy()
  })

  it('3. renders center button aria-label "Vai a oggi" showing the label', () => {
    render(<PeriodStepper label="nov 2026" onPrev={() => {}} onNext={() => {}} onToday={() => {}} />)
    const btn = screen.getByRole('button', { name: 'Vai a oggi' })
    expect(btn).toBeTruthy()
    expect(btn.textContent).toBe('nov 2026')
  })

  it('4. prev click calls onPrev', () => {
    const onPrev = vi.fn()
    render(<PeriodStepper label="nov 2026" onPrev={onPrev} onNext={() => {}} onToday={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'Mese precedente' }))
    expect(onPrev).toHaveBeenCalledOnce()
  })

  it('5. next click calls onNext', () => {
    const onNext = vi.fn()
    render(<PeriodStepper label="nov 2026" onPrev={() => {}} onNext={onNext} onToday={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'Mese successivo' }))
    expect(onNext).toHaveBeenCalledOnce()
  })

  it('6. today click calls onToday', () => {
    const onToday = vi.fn()
    render(<PeriodStepper label="nov 2026" onPrev={() => {}} onNext={() => {}} onToday={onToday} />)
    fireEvent.click(screen.getByRole('button', { name: 'Vai a oggi' }))
    expect(onToday).toHaveBeenCalledOnce()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```
npx vitest run design-system/PeriodStepper.test.tsx
```

Expected: FAIL — `PeriodStepper` module not found.

- [ ] **Step 3: Create `design-system/PeriodStepper.tsx`**

```tsx
// design-system/PeriodStepper.tsx
'use client'

import styles from './PeriodStepper.module.css'

interface PeriodStepperProps {
  label:   string
  onPrev:  () => void
  onNext:  () => void
  onToday: () => void
}

export function PeriodStepper({ label, onPrev, onNext, onToday }: PeriodStepperProps) {
  return (
    <nav className={styles.root} aria-label="Navigazione periodo">
      <button
        type="button"
        className={styles.arrow}
        onClick={onPrev}
        aria-label="Mese precedente"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      <button
        type="button"
        className={styles.today}
        onClick={onToday}
        aria-label="Vai a oggi"
      >
        {label}
      </button>

      <button
        type="button"
        className={styles.arrow}
        onClick={onNext}
        aria-label="Mese successivo"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M6 4L10 8L6 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
    </nav>
  )
}
```

- [ ] **Step 4: Create `design-system/PeriodStepper.module.css`**

```css
/* design-system/PeriodStepper.module.css */

.root {
  display:       flex;
  align-items:   center;
  height:        44px;
  border-radius: 22px;

  background:              linear-gradient(160deg, rgba(255, 255, 255, 0.12), rgba(255, 255, 255, 0.05));
  backdrop-filter:         blur(28px) saturate(160%);
  -webkit-backdrop-filter: blur(28px) saturate(160%);
  box-shadow:              inset 0 0 0 1px rgba(255, 255, 255, 0.14);
}

.arrow {
  display:         flex;
  align-items:     center;
  justify-content: center;
  width:           40px;
  height:          44px;
  flex-shrink:     0;
  border:          none;
  background:      transparent;
  cursor:          pointer;
  color:           rgba(255, 255, 255, 0.80);
}

.arrow:first-child {
  border-radius: 22px 0 0 22px;
}

.arrow:last-child {
  border-radius: 0 22px 22px 0;
}

.arrow:focus-visible {
  outline:        2px solid #ffffff;
  outline-offset: -2px;
}

.today {
  flex:        1;
  min-width:   120px;
  border:      none;
  background:  transparent;
  cursor:      pointer;
  color:       #ffffff;
  font-size:   0.9375rem;
  font-weight: 600;
  font-family: inherit;
  text-align:  center;
  white-space: nowrap;
  padding:     0 4px;
}

.today:focus-visible {
  outline:        2px solid #ffffff;
  outline-offset: -2px;
}
```

- [ ] **Step 5: Run tests to verify they pass**

```
npx vitest run design-system/PeriodStepper.test.tsx
```

Expected: PASS 6/6.

- [ ] **Step 6: Commit**

```bash
git add design-system/PeriodStepper.tsx design-system/PeriodStepper.module.css design-system/PeriodStepper.test.tsx
git commit -m "feat(design-system): add PeriodStepper primitive"
```

---

## Task 4: AppHeader component

**Files:**
- Create: `design-system/AppHeader.tsx`
- Create: `design-system/AppHeader.module.css`
- Create: `design-system/AppHeader.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// design-system/AppHeader.test.tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import React from 'react'

const mockBack = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ back: mockBack }),
}))

import { AppHeader } from './AppHeader'

beforeEach(() => { vi.clearAllMocks() })

function setup(props: Partial<React.ComponentProps<typeof AppHeader>> = {}) {
  const defaults = { returnVariant: 'back' as const, title: 'Test' }
  render(<AppHeader {...defaults} {...props} />)
}

describe('AppHeader', () => {
  it('1. returnVariant="menu" renders button aria-label "Apri menu"', () => {
    setup({ returnVariant: 'menu', onMenuOpen: vi.fn() })
    expect(screen.getByRole('button', { name: 'Apri menu' })).toBeTruthy()
  })

  it('2. returnVariant="menu" click calls onMenuOpen', () => {
    const onMenuOpen = vi.fn()
    setup({ returnVariant: 'menu', onMenuOpen })
    fireEvent.click(screen.getByRole('button', { name: 'Apri menu' }))
    expect(onMenuOpen).toHaveBeenCalledOnce()
  })

  it('3. returnVariant="back" renders button aria-label "Indietro"', () => {
    setup({ returnVariant: 'back' })
    expect(screen.getByRole('button', { name: 'Indietro' })).toBeTruthy()
  })

  it('4. returnVariant="back" click calls router.back()', () => {
    setup({ returnVariant: 'back' })
    fireEvent.click(screen.getByRole('button', { name: 'Indietro' }))
    expect(mockBack).toHaveBeenCalledOnce()
  })

  it('5. title is rendered as h1', () => {
    setup({ title: 'Impostazioni' })
    expect(screen.getByRole('heading', { level: 1, name: 'Impostazioni' })).toBeTruthy()
  })

  it('6. meta and subtitle rendered when provided', () => {
    setup({ meta: 'lunedì 4 novembre', subtitle: '3 post-it' })
    expect(screen.getByText('lunedì 4 novembre')).toBeTruthy()
    expect(screen.getByText('3 post-it')).toBeTruthy()
  })

  it('7. SegmentedControl rendered for segmented viewControl; value change calls onChange', () => {
    const onChange = vi.fn()
    setup({
      viewControl: {
        kind:    'segmented',
        options: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }],
        value:   'a',
        onChange,
      },
    })
    expect(screen.getByRole('radiogroup')).toBeTruthy()
    fireEvent.click(screen.getByRole('radio', { name: 'B' }))
    expect(onChange).toHaveBeenCalledWith('b')
  })

  it('8. PeriodStepper rendered for stepper viewControl; callbacks wired', () => {
    const onPrev  = vi.fn()
    const onNext  = vi.fn()
    const onToday = vi.fn()
    setup({
      viewControl: { kind: 'stepper', label: 'nov 2026', onPrev, onNext, onToday },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Mese precedente' }))
    expect(onPrev).toHaveBeenCalledOnce()
    fireEvent.click(screen.getByRole('button', { name: 'Mese successivo' }))
    expect(onNext).toHaveBeenCalledOnce()
    fireEvent.click(screen.getByRole('button', { name: 'Vai a oggi' }))
    expect(onToday).toHaveBeenCalledOnce()
  })

  it('9. icon action rendered; click calls onClick', () => {
    const onClick = vi.fn()
    setup({
      actions: [{ kind: 'icon', label: 'Aggiungi', icon: <span>+</span>, onClick }],
    })
    fireEvent.click(screen.getByRole('button', { name: 'Aggiungi' }))
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('10. scroll state: sentinel intersection → data-scrolled on header', () => {
    // Mock IntersectionObserver
    let ioCallback: IntersectionObserverCallback
    const mockIo = { observe: vi.fn(), disconnect: vi.fn() }
    vi.stubGlobal('IntersectionObserver', vi.fn((cb: IntersectionObserverCallback) => {
      ioCallback = cb
      return mockIo
    }))

    setup()

    const header = document.querySelector('header')!
    expect(header.hasAttribute('data-scrolled')).toBe(false)

    act(() => {
      ioCallback!(
        [{ isIntersecting: false } as IntersectionObserverEntry],
        mockIo as unknown as IntersectionObserver,
      )
    })

    expect(header.hasAttribute('data-scrolled')).toBe(true)

    vi.unstubAllGlobals()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```
npx vitest run design-system/AppHeader.test.tsx
```

Expected: FAIL — `AppHeader` module not found.

- [ ] **Step 3: Create `design-system/AppHeader.tsx`**

```tsx
// design-system/AppHeader.tsx
'use client'

import { useRef, useState, useEffect, type RefObject } from 'react'
import { useRouter } from 'next/navigation'
import { SegmentedControl } from './SegmentedControl'
import { PeriodStepper }    from './PeriodStepper'
import { IconButton }       from './IconButton'
import styles from './AppHeader.module.css'

// ── Types ────────────────────────────────────────────────────────────────────

type ReturnVariant = 'menu' | 'back'

interface SegmentedControlConfig {
  kind:     'segmented'
  options:  { value: string; label: string }[]
  value:    string
  onChange: (value: string) => void
}

interface PeriodStepperConfig {
  kind:    'stepper'
  label:   string
  onPrev:  () => void
  onNext:  () => void
  onToday: () => void
}

type ViewControl = SegmentedControlConfig | PeriodStepperConfig

interface ActionItem {
  kind:    'icon' | 'secondary' | 'primary'
  label:   string
  icon?:   React.ReactNode
  onClick: () => void
}

export interface AppHeaderProps {
  returnVariant:  ReturnVariant
  onMenuOpen?:    () => void
  title:          string
  meta?:          string
  subtitle?:      string
  viewControl?:   ViewControl
  actions?:       ActionItem[]
  titleLive?:     boolean
  subtitleLive?:  boolean
}

// ── Scroll hook ──────────────────────────────────────────────────────────────

function useScrolled(sentinelRef: RefObject<HTMLDivElement | null>): boolean {
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

// ── Component ────────────────────────────────────────────────────────────────

export function AppHeader({
  returnVariant,
  onMenuOpen,
  title,
  meta,
  subtitle,
  viewControl,
  actions,
  titleLive,
  subtitleLive,
}: AppHeaderProps) {
  const router      = useRouter()
  const sentinelRef = useRef<HTMLDivElement>(null)
  const scrolled    = useScrolled(sentinelRef)

  return (
    <>
      <header
        className={styles.root}
        data-scrolled={scrolled || undefined}
      >
        {/* Slot A — Return */}
        <button
          type="button"
          className={styles.returnBtn}
          onClick={returnVariant === 'menu' ? onMenuOpen : () => router.back()}
          aria-label={returnVariant === 'menu' ? 'Apri menu' : 'Indietro'}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 18 18"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M11 14L6 9L11 4"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className={styles.returnLabel}>
            {returnVariant === 'menu' ? 'Menu' : 'Indietro'}
          </span>
        </button>

        {/* Slot B — Title */}
        <div className={styles.titleBlock}>
          {meta && <p className={styles.meta}>{meta}</p>}
          <h1
            className={styles.title}
            aria-live={titleLive ? 'polite' : undefined}
            aria-atomic={titleLive ? 'true' : undefined}
          >
            {title}
          </h1>
          {subtitle && (
            <p
              className={styles.subtitle}
              aria-live={subtitleLive ? 'polite' : undefined}
              aria-atomic={subtitleLive ? 'true' : undefined}
            >
              {subtitle}
            </p>
          )}
        </div>

        {/* Slot C — View control */}
        {viewControl && (
          <div className={styles.viewControl}>
            {viewControl.kind === 'segmented' ? (
              <SegmentedControl
                options={viewControl.options}
                value={viewControl.value}
                onChange={viewControl.onChange}
              />
            ) : (
              <PeriodStepper
                label={viewControl.label}
                onPrev={viewControl.onPrev}
                onNext={viewControl.onNext}
                onToday={viewControl.onToday}
              />
            )}
          </div>
        )}

        {/* Slot D — Actions */}
        {actions && actions.length > 0 && (
          <div className={styles.actions}>
            {actions.map(action => {
              if (action.kind === 'icon') {
                return (
                  <IconButton
                    key={action.label}
                    label={action.label}
                    icon={action.icon!}
                    onClick={action.onClick}
                  />
                )
              }
              return (
                <button
                  key={action.label}
                  type="button"
                  className={
                    action.kind === 'primary' ? styles.primaryBtn : styles.secondaryBtn
                  }
                  onClick={action.onClick}
                >
                  {action.label}
                </button>
              )
            })}
          </div>
        )}
      </header>

      {/* Sentinel for scroll detection — 1px div right after the sticky header */}
      <div ref={sentinelRef} className={styles.sentinel} aria-hidden="true" />
    </>
  )
}
```

- [ ] **Step 4: Create `design-system/AppHeader.module.css`**

```css
/* design-system/AppHeader.module.css */

/* ── Root ───────────────────────────────────────────────────── */

.root {
  position:    sticky;
  top:         0;
  z-index:     10;
  display:     grid;
  grid-template-columns: auto 1fr auto auto;
  align-items: center;
  gap:         12px;
  height:      76px;
  padding:     0 24px;
  color:       #ffffff;

  /* Transparent at rest */
  background:      transparent;
  backdrop-filter: none;
  transition:
    background     200ms cubic-bezier(0.4, 0, 0.2, 1),
    backdrop-filter 200ms cubic-bezier(0.4, 0, 0.2, 1),
    box-shadow     200ms cubic-bezier(0.4, 0, 0.2, 1);
}

/* Glass surface on scroll */
.root[data-scrolled] {
  background:               rgba(255, 255, 255, 0.10);
  backdrop-filter:          blur(28px) saturate(160%);
  -webkit-backdrop-filter:  blur(28px) saturate(160%);
  box-shadow:               inset 0 -1px 0 rgba(255, 255, 255, 0.08);
}

@media (max-width: 499px) {
  .root {
    height:  64px;
    padding: 0 16px;
    gap:     8px;
  }
}

/* ── Sentinel ───────────────────────────────────────────────── */

.sentinel {
  height:         1px;
  pointer-events: none;
  margin-top:     -1px;
}

/* ── Slot A — Return button ─────────────────────────────────── */

.returnBtn {
  display:     flex;
  align-items: center;
  gap:         6px;
  height:      44px;
  padding:     0 16px;
  border-radius: 22px;
  border:      none;
  cursor:      pointer;
  color:       #ffffff;
  font-family: inherit;
  flex-shrink: 0;

  background:              linear-gradient(160deg, rgba(255, 255, 255, 0.18), rgba(255, 255, 255, 0.08));
  backdrop-filter:         blur(28px) saturate(160%);
  -webkit-backdrop-filter: blur(28px) saturate(160%);
  box-shadow:              inset 0 0 0 1px rgba(255, 255, 255, 0.14);
}

.returnBtn:focus-visible {
  outline:        2px solid #ffffff;
  outline-offset: 2px;
}

.returnLabel {
  font-size:   0.9375rem;
  font-weight: 600;
}

/* ── Slot B — Title block ───────────────────────────────────── */

.titleBlock {
  display:        flex;
  flex-direction: column;
  min-width:      0;
}

.meta {
  margin:        0;
  font-size:     0.9375rem;
  font-weight:   600;
  opacity:       0.75;
  white-space:   nowrap;
  overflow:      hidden;
  text-overflow: ellipsis;
}

.title {
  margin:        0;
  font-size:     1.5rem;
  font-weight:   700;
  line-height:   1.1;
  white-space:   nowrap;
  overflow:      hidden;
  text-overflow: ellipsis;
}

.subtitle {
  margin:      0;
  font-size:   0.8125rem;
  font-weight: 500;
  opacity:     0.70;
}

/* ── Slot C — View control ──────────────────────────────────── */

.viewControl {
  display:     flex;
  align-items: center;
}

/* ── Slot D — Actions ───────────────────────────────────────── */

.actions {
  display:     flex;
  align-items: center;
  gap:         8px;
}

.secondaryBtn {
  height:        44px;
  padding:       0 18px;
  border-radius: 22px;
  border:        none;
  cursor:        pointer;
  color:         #ffffff;
  font-size:     0.9375rem;
  font-weight:   600;
  font-family:   inherit;

  background:              linear-gradient(160deg, rgba(255, 255, 255, 0.18), rgba(255, 255, 255, 0.08));
  backdrop-filter:         blur(28px) saturate(160%);
  -webkit-backdrop-filter: blur(28px) saturate(160%);
  box-shadow:              inset 0 0 0 1px rgba(255, 255, 255, 0.14);
}

.secondaryBtn:focus-visible {
  outline:        2px solid #ffffff;
  outline-offset: 2px;
}

.primaryBtn {
  height:        44px;
  padding:       0 18px;
  border-radius: 22px;
  border:        none;
  cursor:        pointer;
  color:         var(--gradient-start, #581c87);
  font-size:     0.9375rem;
  font-weight:   600;
  font-family:   inherit;
  background:    #ffffff;
}

.primaryBtn:focus-visible {
  outline:        2px solid #ffffff;
  outline-offset: 2px;
}
```

- [ ] **Step 5: Run tests to verify they pass**

```
npx vitest run design-system/AppHeader.test.tsx
```

Expected: PASS 10/10.

- [ ] **Step 6: Commit**

```bash
git add design-system/AppHeader.tsx design-system/AppHeader.module.css design-system/AppHeader.test.tsx
git commit -m "feat(design-system): add AppHeader component"
```

---

## Task 5: Migrate Impostazioni (Settings)

**Files:**
- Modify: `components/Settings.tsx`
- Modify: `components/Settings.module.css`

The Settings header is a sticky `<header>` with a "← Indietro" link and a centered `<h1>`. After migration, `AppHeader` replaces all of that.

- [ ] **Step 1: Update `components/Settings.tsx`**

Add the import at the top of the existing imports block:

```tsx
import { AppHeader } from '@/design-system/AppHeader'
```

Remove the existing header block (lines 38–43):
```tsx
      {/* Header */}
      <header className={styles.header}>
        <Link href="/" className={styles.backButton} aria-label="Indietro">
          ← Indietro
        </Link>
        <h1 className={styles.title}>Impostazioni</h1>
      </header>
```

Replace it with:
```tsx
      <AppHeader
        returnVariant="back"
        title="Impostazioni"
      />
```

Also remove the `Link` import from `next/link` **only if** it is no longer used elsewhere in the file. At the time of this writing, `Link` is only used in the header — so remove:
```tsx
import Link from 'next/link'
```

- [ ] **Step 2: Remove header styles from `components/Settings.module.css`**

Delete the following blocks (they are no longer referenced):

```css
.header {
  position:        sticky;
  top:             0;
  z-index:         1;
  display:         flex;
  align-items:     center;
  justify-content: center;
  padding:         20px 24px;

  /* Prevent card content from bleeding through on scroll */
  background:               linear-gradient(to bottom, rgba(0, 0, 0, 0.18) 0%, transparent 100%);
  backdrop-filter:          blur(10px) saturate(120%);
  -webkit-backdrop-filter:  blur(10px) saturate(120%);
}

.backButton {
  position:        absolute;
  left:            24px;
  display:         flex;
  align-items:     center;
  gap:             6px;
  height:          36px;
  padding:         0 14px;
  border-radius:   18px;
  font-size:       0.8125rem;
  font-weight:     500;
  color:           #ffffff;
  text-decoration: none;

  background: radial-gradient(
    ellipse at left center,
    rgba(255, 255, 255, 0.18) 0%,
    rgba(255, 255, 255, 0.05) 70%,
    transparent 100%
  );
  backdrop-filter:          blur(20px) saturate(140%);
  -webkit-backdrop-filter:  blur(20px) saturate(140%);
  mask-image:               linear-gradient(to right, black 70%, transparent 100%);
  -webkit-mask-image:       linear-gradient(to right, black 70%, transparent 100%);
}

.backButton:focus-visible {
  outline:        2px solid #ffffff;
  outline-offset: 2px;
}

.title {
  font-size:   1.1rem;
  font-weight: 600;
}
```

- [ ] **Step 3: Run the full test suite**

```
npm test
```

Expected: all tests pass. The existing `Settings.test.tsx` tests do not test the header directly (they test palette tiles, toggles, etc.) so they should still pass.

- [ ] **Step 4: Commit**

```bash
git add components/Settings.tsx components/Settings.module.css
git commit -m "feat(settings): migrate header to AppHeader"
```

---

## Task 6: Migrate Lavagna (NoteBoard + delete BoardHeader)

**Files:**
- Modify: `components/board/NoteBoard.tsx`
- Delete: `components/board/BoardHeader.tsx`

`NoteBoard.tsx` currently imports and renders `BoardHeader`. After migration, it uses `AppHeader` directly. `BoardHeader.tsx` is then deleted.

BoardHeader currently shows:
- Back link to `/?view=menu` (opening the menu)
- Title "Lavagna" (hardcoded)
- Note count with `aria-live="polite"`
- Layout toggle: Libera / Griglia (using `aria-pressed`, not `role="radio"`)
- Disabled "Disegna" button (non-functional, removed in migration)
- Add post-it button

- [ ] **Step 1: Update `components/board/NoteBoard.tsx`**

Replace the existing imports:
```tsx
import { BoardHeader }   from './BoardHeader'
```
with:
```tsx
import { useRouter }   from 'next/navigation'
import { AppHeader }   from '@/design-system/AppHeader'
```

Add `const router = useRouter()` at the top of the `NoteBoard` function body (after the existing hooks).

Replace:
```tsx
      <BoardHeader
        noteCount={state.notes.length}
        mode={state.mode}
        onModeChange={handleModeChange}
        onAddNote={handleAddNote}
      />
```

with:
```tsx
      <AppHeader
        returnVariant="menu"
        onMenuOpen={() => router.push('/?view=menu')}
        title="Lavagna"
        subtitle={`${state.notes.length} post-it`}
        subtitleLive={true}
        viewControl={{
          kind:     'segmented',
          options:  [
            { value: 'free',  label: 'Libera' },
            { value: 'grid',  label: 'Griglia' },
          ],
          value:    state.mode,
          onChange: handleModeChange,
        }}
        actions={[{
          kind:  'icon',
          label: 'Aggiungi post-it',
          icon:  (
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5"  y1="12" x2="19" y2="12" />
            </svg>
          ),
          onClick: handleAddNote,
        }]}
      />
```

Change the outer wrapper from `<main className="board-screen">` to `<div className="board-screen">`, and change the inner `<div className="board-board-wrap">` to `<main className="board-board-wrap">`. This preserves:
- the `board-screen` CSS class for styling (unchanged)
- the `main` landmark — moved inward so it wraps only the board content, not the header
- the `<header>` implicit `role="banner"` — only applies when `<header>` is not a descendant of `<article>`, `<aside>`, `<main>`, `<nav>`, or `<section>`; with `<div>` as the outer wrapper, the banner role is correct

> **Note:** `BoardHeader` had `role="banner"` explicitly on its `<header>` — `AppHeader` renders a semantic `<header>` whose implicit role is `banner`, so this is equivalent. The `board-board-wrap` CSS class is unchanged so no CSS rules break.

- [ ] **Step 2: Delete `components/board/BoardHeader.tsx`**

```bash
git rm components/board/BoardHeader.tsx
```

- [ ] **Step 3: Run the full test suite**

```
npm test
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add components/board/NoteBoard.tsx
git commit -m "feat(lavagna): migrate header to AppHeader, remove BoardHeader"
```

---

## Task 7: Migrate Calendario

**Files:**
- Modify: `components/CalendarView.tsx`

The CalendarView header block (lines 581–611) contains a `<Link>` back to the menu, and inline prev/next/today navigation. All of this moves into AppHeader.

- [ ] **Step 1: Update imports in `components/CalendarView.tsx`**

Add at the top of the imports:
```tsx
import { useRouter }  from 'next/navigation'
import { AppHeader }  from '@/design-system/AppHeader'
```

Remove:
```tsx
import Link from 'next/link'
```
(`Link` is only used in the header; after removal it is no longer referenced.)

- [ ] **Step 2: Add `useRouter` inside `CalendarView`**

At the top of the `CalendarView` function body, after the existing state declarations, add:
```tsx
const router = useRouter()
```

- [ ] **Step 3: Replace the header block in the JSX**

Remove the entire header block:
```tsx
      {/* ── Header ── */}
      <header className="cal-header">
        <Link href="/?view=menu" replace className="cal-back-btn" aria-label="Torna al menu">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true" focusable="false">
            <path d="M11 14L6 9L11 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span className="cal-back-label">Menu</span>
        </Link>

        <nav className="cal-nav" aria-label="Navigazione mesi">
          <button type="button" className="cal-nav-btn" onClick={handlePrev} aria-label="Mese precedente">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" focusable="false">
              <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>

          <h1 className="cal-month-title" aria-live="polite" aria-atomic="true">
            {formatMonthYear(year, month)}
          </h1>

          <button type="button" className="cal-nav-btn" onClick={handleNext} aria-label="Mese successivo">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" focusable="false">
              <path d="M6 4L10 8L6 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>

          <button type="button" className="cal-today-btn" onClick={goToToday}>
            Oggi
          </button>
        </nav>
      </header>
```

Replace with:
```tsx
      <AppHeader
        returnVariant="menu"
        onMenuOpen={() => router.push('/?view=menu')}
        title={formatMonthYear(year, month)}
        titleLive={true}
        viewControl={{
          kind:    'stepper',
          label:   formatMonthYear(year, month),
          onPrev:  handlePrev,
          onNext:  handleNext,
          onToday: goToToday,
        }}
      />
```

- [ ] **Step 4: Run the full test suite**

```
npm test
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add components/CalendarView.tsx
git commit -m "feat(calendario): migrate header to AppHeader"
```

---

## Task 8: Migrate Oggi

**Files:**
- Modify: `components/today/OggiView.tsx`

The OggiView header block (lines 123–147) contains a `<Link>` back to the menu, the title, date, and a Calendario link. The "Vai a oggi" conditional button is removed (per design decision). The Calendario link becomes an `actions` entry.

- [ ] **Step 1: Update imports in `components/today/OggiView.tsx`**

Add at the top of the existing imports block:
```tsx
import { useRouter }  from 'next/navigation'
import { AppHeader }  from '@/design-system/AppHeader'
```

Remove these two imports (they are only used in the removed header block):
```tsx
import Link from 'next/link'
```
```tsx
import { BoltIcon, CalendarIcon, FeatherIcon, HourglassIcon, MoonIcon, SmileIcon } from './icons'
```
→ Replace with:
```tsx
import { BoltIcon, FeatherIcon, HourglassIcon, MoonIcon, SmileIcon } from './icons'
```
(`CalendarIcon` was only used in the header link; remove only it, keep the rest.)

- [ ] **Step 2: Add `useRouter` inside `OggiView`**

At the top of the `OggiView` function body, before the state declarations, add:
```tsx
const router = useRouter()
```

- [ ] **Step 3: Replace the header block in the JSX**

Remove the entire header block (starting with `<header className="cal-header today-header">` through `</header>`):
```tsx
        <header className="cal-header today-header">
          <div className="today-header-start">
            <Link href="/?view=menu" replace className="cal-back-btn" aria-label="Torna al menu">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true" focusable="false">
                <path d="M11 14L6 9L11 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span className="cal-back-label">Menu</span>
            </Link>
            <div>
              <h1 className="today-title">
                Oggi{' '}
                <span className="today-title-date">{displayedDay ? formatDayHeading(displayedDay) : ''}</span>
              </h1>
              <p className="today-subtitle">La tua giornata, a colpo d&apos;occhio</p>
            </div>
          </div>
          <div className="today-header-end">
            {displayedDay && !isToday && !notice && (
              <button type="button" className="cal-today-btn" onClick={goToToday}>Vai a oggi</button>
            )}
            <Link href="/calendar" className="cal-back-btn">
              <CalendarIcon /> <span className="cal-back-label">Calendario</span>
            </Link>
          </div>
        </header>
```

Replace with:
```tsx
        <AppHeader
          returnVariant="menu"
          onMenuOpen={() => router.push('/?view=menu')}
          meta={displayedDay ? formatDayHeading(displayedDay) : undefined}
          title="Oggi"
          subtitle="La tua giornata, a colpo d'occhio"
          actions={[{
            kind:    'secondary',
            label:   'Calendario',
            onClick: () => router.push('/calendar'),
          }]}
        />
```

Note: the `goToToday` function defined in the component is still used inside the `notice` section (the day-change banner), so do NOT remove it.

- [ ] **Step 4: Run the full test suite**

```
npm test
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add components/today/OggiView.tsx
git commit -m "feat(oggi): migrate header to AppHeader, remove 'Vai a oggi' shortcut"
```

---

## Task 9: README

**Files:**
- Create: `design-system/README.md`

- [ ] **Step 1: Create `design-system/README.md`**

```markdown
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

All tokens are CSS custom properties. Set them on `:root` or a wrapper element.

| Token | Default | Used by |
|-------|---------|---------|
| `--gradient-start` | `#581c87` | `AppHeader .primaryBtn` text colour |
| `--gradient-end`   | `#be123c` | — |

## Visual language

- **Glass surface:** `linear-gradient(160deg, rgba(255,255,255,0.18), rgba(255,255,255,0.08))` + `backdrop-filter: blur(28px) saturate(160%)` + `box-shadow: inset 0 0 0 1px rgba(255,255,255,0.14)`
- **Focus ring:** `outline: 2px solid #ffffff; outline-offset: 2px`
- **Header height:** 76 px desktop / 64 px mobile (`max-width: 499px`)
- **Control height:** 44 px, border-radius 22 px

## Rules

- Never add a border or divider to AppHeader.
- Max 3 items in `AppHeader` `actions` array.
- `IconButton.label` is always used as `aria-label` — make it descriptive.
```

- [ ] **Step 2: Commit**

```bash
git add design-system/README.md
git commit -m "docs(design-system): add README with token reference"
```

---

## Final check

```
npm test
```

Expected: all tests pass across the full suite.
