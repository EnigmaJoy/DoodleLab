# Settings Screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Settings screen with palette selection, visual-effects toggle, and auto-lock control, plus satellite buttons on the radial menu (Impostazioni + Esci modal) and a persistent PreferencesContext backed by localStorage.

**Architecture:** `PreferencesContext` manages all user preferences (palette, visual effects, auto-lock) via localStorage; it applies them to the DOM via `useEffect`. The Settings page is a Next.js App Router page at `/settings`; it is a thin server wrapper around a `'use client'` component. The ExitModal is a standalone component rendered by AppShell and triggered via a new `onExitRequest` prop on RadialMenu.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, CSS Modules, Vitest + @testing-library/react, next-auth/react (for session email in account row)

---

## File map

| Action | Path | Responsibility |
|--------|------|----------------|
| Modify | `lib/palettes.ts` | Add `from`/`to` hex fields to `PaletteEntry` and all 8 entries |
| Create | `lib/PreferencesContext.tsx` | Context, provider, `usePreferences` hook |
| Create | `lib/PreferencesContext.test.tsx` | Tests for context read/write/apply |
| Modify | `app/providers.tsx` | Add `PreferencesProvider` wrapper |
| Modify | `app/globals.css` | Add `[data-no-effects]` rules |
| Modify | `components/RadialMenu.tsx` | Add `data-glow` to glow divs; add `onExitRequest` prop + satellite row |
| Modify | `components/RadialMenu.module.css` | Add `.satelliteRow`, `.satellite` styles |
| Modify | `components/RadialMenu.test.tsx` | Update `setup` helper; add satellite tests |
| Modify | `components/AppShell.tsx` | Remove inline logout button; add `ExitModal` state |
| Create | `components/ExitModal.tsx` | Confirmation modal with focus trap |
| Create | `components/ExitModal.module.css` | Modal glass card + backdrop styles |
| Create | `components/ExitModal.test.tsx` | Tests for modal open/close/confirm |
| Create | `app/settings/page.tsx` | Server component wrapper |
| Create | `components/Settings.tsx` | Full settings screen (client component) |
| Create | `components/Settings.module.css` | Layout, cards, palette grid, toggles, segmented control |
| Create | `components/Settings.test.tsx` | Tests for all interactive controls |

---

## Task 1: Extend lib/palettes.ts with from/to fields

**Files:**
- Modify: `lib/palettes.ts`

The existing `PaletteEntry` has no colour values. Add `from` and `to` hex strings so `PreferencesContext` can apply them to `--gradient-start`/`--gradient-end`. The hex values match what is already in `globals.css` `[data-palette="1-8"]` rules.

- [ ] **Step 1: Write the failing test**

Create `lib/palettes.test.ts`:

```typescript
// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { PALETTES, PALETTE_COUNT } from './palettes'

describe('PALETTES', () => {
  it('has 8 entries', () => {
    expect(PALETTES).toHaveLength(8)
  })

  it('every entry has a valid from hex', () => {
    for (const p of PALETTES) {
      expect(p.from, `palette ${p.id} missing from`).toMatch(/^#[0-9a-f]{6}$/i)
    }
  })

  it('every entry has a valid to hex', () => {
    for (const p of PALETTES) {
      expect(p.to, `palette ${p.id} missing to`).toMatch(/^#[0-9a-f]{6}$/i)
    }
  })

  it('PALETTE_COUNT matches array length', () => {
    expect(PALETTE_COUNT).toBe(PALETTES.length)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```
npm test -- lib/palettes.test.ts
```
Expected: FAIL — `p.from is undefined`

- [ ] **Step 3: Update lib/palettes.ts**

Replace the entire file content:

```typescript
// lib/palettes.ts

/* UI-08: @openDecision - final palette selection is pending visual review */

export interface PaletteEntry {
  id:             number
  label:          string
  from:           string   // --gradient-start hex
  to:             string   // --gradient-end hex
  provisional:    true
  referenceBoard: string
  contrastNotes:  string[]
}

export const PALETTES: readonly PaletteEntry[] = [
  {
    id: 1, label: 'Prugna / Corallo', from: '#581c87', to: '#be123c',
    provisional: true, referenceBoard: 'Tavola 1',
    contrastNotes: ['Welcome text at orange midpoint: measure AA large-text (3:1 minimum)'],
  },
  {
    id: 2, label: 'Blu / Viola', from: '#3b82f6', to: '#a855f7',
    provisional: true, referenceBoard: 'Tavola 2', contrastNotes: [],
  },
  {
    id: 3, label: 'Verde / Teal', from: '#22c55e', to: '#0d9488',
    provisional: true, referenceBoard: 'Tavola 3',
    contrastNotes: ['Green midpoint: measure AA large-text (3:1 minimum)'],
  },
  {
    id: 4, label: 'Cremisi / Arancione', from: '#dc2626', to: '#f97316',
    provisional: true, referenceBoard: 'Tavola 4',
    contrastNotes: ['Orange endpoint: white text risk - measure before visual review'],
  },
  {
    id: 5, label: 'Navy / Blu', from: '#1e3a5f', to: '#2563eb',
    provisional: true, referenceBoard: 'Tavola 5', contrastNotes: [],
  },
  {
    id: 6, label: 'Viola / Rosso', from: '#7c3aed', to: '#dc2626',
    provisional: true, referenceBoard: 'Tavola 6', contrastNotes: [],
  },
  {
    id: 7, label: 'Oliva / Marrone', from: '#65a30d', to: '#92400e',
    provisional: true, referenceBoard: 'Tavola 7',
    contrastNotes: [
      'Olive endpoint: measure white text contrast',
      'Brown endpoint: measure white text contrast',
      'Both endpoints are atypical - full measurement required',
    ],
  },
  {
    id: 8, label: 'Ardesia / Teal', from: '#475569', to: '#0d9488',
    provisional: true, referenceBoard: 'Tavola 8', contrastNotes: [],
  },
] as const

export const DEFAULT_PALETTE_ID = 1
export const PALETTE_COUNT      = 8
```

- [ ] **Step 4: Run test to verify it passes**

```
npm test -- lib/palettes.test.ts
```
Expected: PASS (4 tests)

- [ ] **Step 5: Run full suite to check no regressions**

```
npm test
```
Expected: all existing tests still pass

- [ ] **Step 6: Commit**

```bash
git add lib/palettes.ts lib/palettes.test.ts
git commit -m "feat(palettes): add from/to hex fields to PaletteEntry"
```

---

## Task 2: Create PreferencesContext

**Files:**
- Create: `lib/PreferencesContext.tsx`
- Create: `lib/PreferencesContext.test.tsx`

Manages palette, visual effects, and auto-lock preferences in localStorage. Applies palette via CSS custom properties and visual effects via `data-no-effects` attribute on `<html>`.

- [ ] **Step 1: Write the failing tests**

Create `lib/PreferencesContext.test.tsx`:

```typescript
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import React from 'react'

// Spy before importing the module under test
const setPropertySpy = vi.spyOn(document.documentElement.style, 'setProperty')

import { PreferencesProvider, usePreferences } from './PreferencesContext'

// Helper: a component that exposes context values via data attributes
function Inspector() {
  const { preferences, setPaletteId, setVisualEffects, setAutoLockMinutes } = usePreferences()
  return (
    <div
      data-testid="inspector"
      data-palette={preferences.paletteId}
      data-effects={String(preferences.visualEffects)}
      data-lock={String(preferences.autoLockMinutes)}
    >
      <button onClick={() => setPaletteId(3)}>setPalette3</button>
      <button onClick={() => setVisualEffects(false)}>disableEffects</button>
      <button onClick={() => setAutoLockMinutes(30)}>setLock30</button>
    </div>
  )
}

function setup() {
  render(
    <PreferencesProvider>
      <Inspector />
    </PreferencesProvider>,
  )
  return screen.getByTestId('inspector')
}

beforeEach(() => {
  localStorage.clear()
  setPropertySpy.mockClear()
  document.documentElement.removeAttribute('data-no-effects')
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('PreferencesContext', () => {

  it('1. provides defaults when localStorage is empty', () => {
    const el = setup()
    expect(el.dataset.palette).toBe('1')
    expect(el.dataset.effects).toBe('true')
    expect(el.dataset.lock).toBe('5')
  })

  it('2. setPaletteId updates preferences and sets CSS vars', async () => {
    setup()
    await act(async () => {
      screen.getByText('setPalette3').click()
    })
    expect(screen.getByTestId('inspector').dataset.palette).toBe('3')
    expect(setPropertySpy).toHaveBeenCalledWith('--gradient-start', '#22c55e')
    expect(setPropertySpy).toHaveBeenCalledWith('--gradient-end', '#0d9488')
  })

  it('3. setPaletteId persists to localStorage', async () => {
    setup()
    await act(async () => {
      screen.getByText('setPalette3').click()
    })
    const stored = JSON.parse(localStorage.getItem('doodlelab.preferences')!)
    expect(stored.paletteId).toBe(3)
  })

  it('4. setVisualEffects(false) adds data-no-effects to html', async () => {
    setup()
    expect(document.documentElement.hasAttribute('data-no-effects')).toBe(false)
    await act(async () => {
      screen.getByText('disableEffects').click()
    })
    expect(document.documentElement.hasAttribute('data-no-effects')).toBe(true)
  })

  it('5. setAutoLockMinutes persists to localStorage', async () => {
    setup()
    await act(async () => {
      screen.getByText('setLock30').click()
    })
    const stored = JSON.parse(localStorage.getItem('doodlelab.preferences')!)
    expect(stored.autoLockMinutes).toBe(30)
  })

  it('6. loads saved preferences from localStorage on mount', () => {
    localStorage.setItem(
      'doodlelab.preferences',
      JSON.stringify({ paletteId: 5, visualEffects: false, autoLockMinutes: 30 }),
    )
    const el = setup()
    expect(el.dataset.palette).toBe('5')
    expect(el.dataset.effects).toBe('false')
    expect(el.dataset.lock).toBe('30')
  })

})
```

- [ ] **Step 2: Run tests to verify they fail**

```
npm test -- lib/PreferencesContext.test.tsx
```
Expected: FAIL — module not found

- [ ] **Step 3: Create lib/PreferencesContext.tsx**

```typescript
// lib/PreferencesContext.tsx
'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { PALETTES } from './palettes'

export interface Preferences {
  paletteId:       number
  visualEffects:   boolean
  autoLockMinutes: 1 | 5 | 30 | null
}

const DEFAULT_PREFERENCES: Preferences = {
  paletteId:       1,
  visualEffects:   true,
  autoLockMinutes: 5,
}

const STORAGE_KEY = 'doodlelab.preferences'

interface PreferencesContextValue {
  preferences:        Preferences
  setPaletteId:       (id: number) => void
  setVisualEffects:   (on: boolean) => void
  setAutoLockMinutes: (minutes: 1 | 5 | 30 | null) => void
}

const PreferencesContext = createContext<PreferencesContextValue | null>(null)

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState<Preferences>(DEFAULT_PREFERENCES)

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        setPreferences({ ...DEFAULT_PREFERENCES, ...JSON.parse(stored) })
      }
    } catch {
      // Ignore parse errors; fall back to defaults
    }
  }, [])

  // Apply palette CSS vars whenever paletteId changes
  useEffect(() => {
    const palette = PALETTES.find(p => p.id === preferences.paletteId)
    if (!palette) return
    document.documentElement.style.setProperty('--gradient-start', palette.from)
    document.documentElement.style.setProperty('--gradient-end',   palette.to)
  }, [preferences.paletteId])

  // Apply visual effects flag
  useEffect(() => {
    if (preferences.visualEffects) {
      document.documentElement.removeAttribute('data-no-effects')
    } else {
      document.documentElement.setAttribute('data-no-effects', '')
    }
  }, [preferences.visualEffects])

  function update(partial: Partial<Preferences>) {
    setPreferences(prev => {
      const next = { ...prev, ...partial }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }

  return (
    <PreferencesContext.Provider value={{
      preferences,
      setPaletteId:       (id) => update({ paletteId: id }),
      setVisualEffects:   (on) => update({ visualEffects: on }),
      setAutoLockMinutes: (minutes) => update({ autoLockMinutes: minutes }),
    }}>
      {children}
    </PreferencesContext.Provider>
  )
}

export function usePreferences(): PreferencesContextValue {
  const ctx = useContext(PreferencesContext)
  if (!ctx) throw new Error('usePreferences must be used inside PreferencesProvider')
  return ctx
}
```

- [ ] **Step 4: Run tests to verify they pass**

```
npm test -- lib/PreferencesContext.test.tsx
```
Expected: PASS (6 tests)

- [ ] **Step 5: Run full suite**

```
npm test
```
Expected: all tests pass

- [ ] **Step 6: Commit**

```bash
git add lib/PreferencesContext.tsx lib/PreferencesContext.test.tsx
git commit -m "feat(preferences): add PreferencesContext with palette, effects, auto-lock"
```

---

## Task 3: Wire PreferencesProvider into app + visual effects CSS

**Files:**
- Modify: `app/providers.tsx`
- Modify: `app/globals.css`
- Modify: `components/RadialMenu.tsx`
- Modify: `components/RadialMenu.test.tsx`

This wires the provider so preferences are available app-wide, and adds the CSS rules that respond to `data-no-effects`. Adding `data-glow` to glow divs in RadialMenu is part of this task.

- [ ] **Step 1: Write failing test for data-glow attribute**

Add at the end of `components/RadialMenu.test.tsx`, inside the `describe('RadialMenu')` block:

```typescript
  it('9. glow divs have data-glow attribute', () => {
    setup()
    const glows = document.querySelectorAll('[data-glow]')
    expect(glows.length).toBe(3)
  })
```

- [ ] **Step 2: Run test to verify it fails**

```
npm test -- components/RadialMenu.test.tsx
```
Expected: FAIL — test 9 — found 0 elements

- [ ] **Step 3: Add data-glow to glow divs in RadialMenu.tsx**

In `components/RadialMenu.tsx`, update the three glow div lines (currently lines 60–62):

```tsx
      {/* Decorative glows */}
      <div className={`${styles.glow} ${styles.glow1}`} data-glow aria-hidden="true" />
      <div className={`${styles.glow} ${styles.glow2}`} data-glow aria-hidden="true" />
      <div className={`${styles.glow} ${styles.glow3}`} data-glow aria-hidden="true" />
```

- [ ] **Step 4: Run RadialMenu tests to verify test 9 passes**

```
npm test -- components/RadialMenu.test.tsx
```
Expected: PASS (all 9 tests)

- [ ] **Step 5: Add PreferencesProvider to app/providers.tsx**

Replace the contents of `app/providers.tsx`:

```typescript
'use client'

import { SessionProvider } from 'next-auth/react'
import { VaultProvider, AppGate } from '@/lib/vault/vault-context'
import { PreferencesProvider } from '@/lib/PreferencesContext'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <VaultProvider>
        <AppGate>
          <PreferencesProvider>
            {children}
          </PreferencesProvider>
        </AppGate>
      </VaultProvider>
    </SessionProvider>
  )
}
```

- [ ] **Step 6: Add data-no-effects CSS rules to app/globals.css**

Add these two rules at the end of `app/globals.css`, after all existing rules:

```css
/* ============================================================
   VISUAL EFFECTS — applied by PreferencesContext
   ============================================================ */

[data-no-effects] [data-glow] {
  display: none;
}

[data-no-effects] * {
  backdrop-filter:          none !important;
  -webkit-backdrop-filter:  none !important;
}
```

- [ ] **Step 7: Run full suite**

```
npm test
```
Expected: all tests pass

- [ ] **Step 8: Commit**

```bash
git add app/providers.tsx app/globals.css components/RadialMenu.tsx components/RadialMenu.test.tsx
git commit -m "feat(preferences): wire PreferencesProvider, add data-glow + no-effects CSS"
```

---

## Task 4: ExitModal component

**Files:**
- Create: `components/ExitModal.tsx`
- Create: `components/ExitModal.module.css`
- Create: `components/ExitModal.test.tsx`

A glass card dialog with "Annulla" and "Esci" buttons. Focus is trapped inside while open. Escape closes it.

- [ ] **Step 1: Write failing tests**

Create `components/ExitModal.test.tsx`:

```typescript
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import { ExitModal } from './ExitModal'

function setup(isOpen: boolean) {
  const onClose   = vi.fn()
  const onConfirm = vi.fn()
  render(<ExitModal isOpen={isOpen} onClose={onClose} onConfirm={onConfirm} />)
  return { onClose, onConfirm }
}

beforeEach(() => { vi.clearAllMocks() })

describe('ExitModal', () => {

  it('1. renders dialog when isOpen=true', () => {
    setup(true)
    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(screen.getByText('Vuoi uscire?')).toBeTruthy()
  })

  it('2. does not render dialog content when isOpen=false', () => {
    setup(false)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('3. "Annulla" button calls onClose', () => {
    const { onClose } = setup(true)
    fireEvent.click(screen.getByRole('button', { name: 'Annulla' }))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('4. "Esci" button calls onConfirm', () => {
    const { onConfirm } = setup(true)
    fireEvent.click(screen.getByRole('button', { name: 'Esci' }))
    expect(onConfirm).toHaveBeenCalledOnce()
  })

  it('5. Escape key calls onClose when open', () => {
    const { onClose } = setup(true)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('6. dialog has aria-modal and aria-labelledby', () => {
    setup(true)
    const dialog = screen.getByRole('dialog')
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    expect(dialog.getAttribute('aria-labelledby')).toBe('exit-modal-title')
    expect(document.getElementById('exit-modal-title')).toBeTruthy()
  })

})
```

- [ ] **Step 2: Run tests to verify they fail**

```
npm test -- components/ExitModal.test.tsx
```
Expected: FAIL — module not found

- [ ] **Step 3: Create components/ExitModal.module.css**

```css
/* components/ExitModal.module.css */

/* ── Backdrop ──────────────────────────────────────────── */

.backdrop {
  position:   fixed;
  inset:      0;
  z-index:    10;
  background: rgba(0, 0, 0, 0.45);
  display:    flex;
  align-items:     center;
  justify-content: center;
}

/* ── Glass card ────────────────────────────────────────── */

.card {
  position:        relative;
  width:           320px;
  padding:         32px 28px 24px;
  border-radius:   20px;
  color:           #ffffff;
  display:         flex;
  flex-direction:  column;
  gap:             12px;

  background: radial-gradient(
    circle,
    rgba(255, 255, 255, 0.22) 0%,
    rgba(255, 255, 255, 0.07) 70%,
    transparent 100%
  );
  backdrop-filter:         blur(28px) saturate(160%);
  -webkit-backdrop-filter: blur(28px) saturate(160%);
  mask-image:              radial-gradient(ellipse at center, black 60%, transparent 100%);
  -webkit-mask-image:      radial-gradient(ellipse at center, black 60%, transparent 100%);
}

@supports not (backdrop-filter: blur(1px)) {
  .card {
    background: rgba(60, 20, 90, 0.85);
  }
}

/* ── Typography ────────────────────────────────────────── */

.title {
  font-size:   1.1rem;
  font-weight: 600;
  margin:      0;
}

.body {
  font-size:   0.9rem;
  opacity:     0.80;
  margin:      0;
  line-height: 1.5;
}

/* ── Buttons ───────────────────────────────────────────── */

.actions {
  display:         flex;
  justify-content: flex-end;
  gap:             12px;
  margin-top:      8px;
}

.btnCancel,
.btnConfirm {
  height:        40px;
  padding:       0 20px;
  border-radius: 20px;
  border:        none;
  cursor:        pointer;
  font-size:     0.875rem;
  font-weight:   500;
  transition:    opacity 150ms ease;
}

.btnCancel {
  background: rgba(255, 255, 255, 0.15);
  color:      #ffffff;
}

.btnConfirm {
  background: rgba(255, 255, 255, 0.90);
  color:      #1a1a1a;
}

.btnCancel:focus-visible,
.btnConfirm:focus-visible {
  outline:        2px solid #ffffff;
  outline-offset: 2px;
}
```

- [ ] **Step 4: Create components/ExitModal.tsx**

```tsx
// components/ExitModal.tsx
'use client'

import { useEffect } from 'react'
import styles from './ExitModal.module.css'

interface ExitModalProps {
  isOpen:    boolean
  onClose:   () => void
  onConfirm: () => void
}

export function ExitModal({ isOpen, onClose, onConfirm }: ExitModalProps) {
  useEffect(() => {
    if (!isOpen) return
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="exit-modal-title"
        className={styles.card}
        onClick={e => e.stopPropagation()}
      >
        <h2 id="exit-modal-title" className={styles.title}>Vuoi uscire?</h2>
        <p className={styles.body}>Verrai disconnesso dall'account.</p>
        <div className={styles.actions}>
          <button className={styles.btnCancel} onClick={onClose}>
            Annulla
          </button>
          <button className={styles.btnConfirm} onClick={onConfirm}>
            Esci
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Run tests to verify they pass**

```
npm test -- components/ExitModal.test.tsx
```
Expected: PASS (6 tests)

- [ ] **Step 6: Run full suite**

```
npm test
```
Expected: all tests pass

- [ ] **Step 7: Commit**

```bash
git add components/ExitModal.tsx components/ExitModal.module.css components/ExitModal.test.tsx
git commit -m "feat(settings): add ExitModal glass dialog"
```

---

## Task 5: Satellite buttons on RadialMenu + update AppShell

**Files:**
- Modify: `components/RadialMenu.tsx`
- Modify: `components/RadialMenu.module.css`
- Modify: `components/RadialMenu.test.tsx`
- Modify: `components/AppShell.tsx`

Adds two glass pill buttons below the center button (Impostazioni + Esci). Removes the old inline logout button from AppShell. AppShell now owns the ExitModal state.

- [ ] **Step 1: Write failing tests**

Add these tests to `components/RadialMenu.test.tsx`, inside the `describe('RadialMenu')` block.

First, update the `setup` helper to accept and pass `onExitRequest`:

```typescript
function setup(isOpen = false) {
  const onOpen         = vi.fn()
  const onClose        = vi.fn()
  const onExitRequest  = vi.fn()
  render(
    <RadialMenu
      visible={true}
      isOpen={isOpen}
      onOpen={onOpen}
      onClose={onClose}
      onExitRequest={onExitRequest}
      firstItemRef={createRef()}
      firstFallbackItemRef={createRef()}
      centerButtonRef={createRef()}
    />,
  )
  return { onOpen, onClose, onExitRequest }
}
```

Then add the new tests:

```typescript
  it('10. satellite row is not present when menu is closed', () => {
    setup(false)
    expect(screen.queryByText('Impostazioni')).toBeNull()
  })

  it('11. satellite row renders when menu is open', () => {
    setup(true)
    expect(screen.getByText('Impostazioni')).toBeTruthy()
    expect(screen.getByText('Esci')).toBeTruthy()
  })

  it('12. Impostazioni satellite links to /settings', () => {
    setup(true)
    const link = screen.getByRole('link', { name: 'Impostazioni' })
    expect(link.getAttribute('href')).toBe('/settings')
  })

  it('13. Esci satellite calls onExitRequest', () => {
    const { onExitRequest } = setup(true)
    fireEvent.click(screen.getByRole('button', { name: 'Esci' }))
    expect(onExitRequest).toHaveBeenCalledOnce()
  })
```

- [ ] **Step 2: Run tests to verify they fail**

```
npm test -- components/RadialMenu.test.tsx
```
Expected: FAIL — test 10-13 fail; also existing tests 1-9 may fail because `onExitRequest` prop is missing

- [ ] **Step 3: Add satellite CSS to RadialMenu.module.css**

Add at the end of `components/RadialMenu.module.css`:

```css
/* ── Satellite row (below center button) ───────────────── */

.satelliteRow {
  position:        absolute;
  top:             calc(50% + 56px);  /* 44px (half of 88px center) + 12px gap */
  left:            50%;
  transform:       translateX(-50%);
  display:         flex;
  flex-direction:  column;
  align-items:     center;
  gap:             8px;
  z-index:         1;
}

.satellite {
  display:         flex;
  align-items:     center;
  gap:             8px;
  height:          36px;
  padding:         0 16px;
  border-radius:   18px;
  border:          none;
  cursor:          pointer;
  font-size:       0.75rem;
  font-weight:     500;
  color:           #ffffff;
  text-decoration: none;
  white-space:     nowrap;

  background: radial-gradient(
    ellipse at left center,
    rgba(255, 255, 255, 0.20) 0%,
    rgba(255, 255, 255, 0.06) 70%,
    transparent 100%
  );
  backdrop-filter:          blur(20px) saturate(140%);
  -webkit-backdrop-filter:  blur(20px) saturate(140%);
  mask-image:               linear-gradient(to right, black 70%, transparent 100%);
  -webkit-mask-image:       linear-gradient(to right, black 70%, transparent 100%);
  transition:               opacity 200ms ease;
}

.satellite:focus-visible {
  outline:        2px solid #ffffff;
  outline-offset: 2px;
}

@supports not (backdrop-filter: blur(1px)) {
  .satellite {
    background: rgba(255, 255, 255, 0.18);
  }
}
```

- [ ] **Step 4: Update RadialMenu.tsx**

Replace the full contents of `components/RadialMenu.tsx`:

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
  onExitRequest:        () => void
  firstItemRef:         RefObject<HTMLAnchorElement | null>
  firstFallbackItemRef: RefObject<HTMLAnchorElement | null>
  centerButtonRef:      RefObject<HTMLButtonElement | null>
}

export function RadialMenu({
  visible,
  isOpen,
  onOpen,
  onClose,
  onExitRequest,
  firstItemRef,
  firstFallbackItemRef,
  centerButtonRef,
}: RadialMenuProps) {
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
      <div className={`${styles.glow} ${styles.glow1}`} data-glow aria-hidden="true" />
      <div className={`${styles.glow} ${styles.glow2}`} data-glow aria-hidden="true" />
      <div className={`${styles.glow} ${styles.glow3}`} data-glow aria-hidden="true" />

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
        <span className={styles.bars} aria-hidden="true">
          <span className={`${styles.bar} ${styles.barTop}`}    />
          <span className={`${styles.bar} ${styles.barMid}`}    />
          <span className={`${styles.bar} ${styles.barBottom}`} />
        </span>
      </button>

      {/* Satellite row — visible only when menu is open */}
      {isOpen && (
        <div className={styles.satelliteRow}>
          <Link href="/settings" className={styles.satellite} aria-label="Impostazioni">
            Impostazioni
          </Link>
          <button
            type="button"
            className={styles.satellite}
            onClick={onExitRequest}
            aria-label="Esci"
          >
            Esci
          </button>
        </div>
      )}
    </nav>
  )
}
```

- [ ] **Step 5: Update AppShell.tsx**

Replace the full contents of `components/AppShell.tsx`:

```tsx
// components/AppShell.tsx
'use client'

import { useState, useRef, useEffect } from 'react'
import { useVaultContext } from '@/lib/vault/vault-context'
import { RadialMenu } from './RadialMenu'
import { ExitModal } from './ExitModal'

export type AppView = 'MENU_OPEN' | 'MENU_CLOSED'

interface AppShellProps {
  initialView: AppView
}

export function AppShell({ initialView }: AppShellProps) {
  const [view, setView]               = useState<AppView>(initialView)
  const [exitModalOpen, setExitModal] = useState(false)
  const { logout }                    = useVaultContext()

  const prevViewRef          = useRef<AppView | null>(null)
  const firstItemRef         = useRef<HTMLAnchorElement | null>(null)
  const firstFallbackItemRef = useRef<HTMLAnchorElement | null>(null)
  const centerButtonRef      = useRef<HTMLButtonElement | null>(null)

  function getFirstMenuItemRef(): HTMLAnchorElement | null {
    if (typeof window === 'undefined') return firstItemRef.current
    const isFallback = window.matchMedia('(max-width: 500px)').matches
    return isFallback ? firstFallbackItemRef.current : firstItemRef.current
  }

  useEffect(() => {
    const prevView      = prevViewRef.current
    prevViewRef.current = view

    if (prevView === null) return
    if (prevView === view) return

    if (view === 'MENU_OPEN') {
      getFirstMenuItemRef()?.focus()
    } else if (view === 'MENU_CLOSED') {
      centerButtonRef.current?.focus()
    }
  }, [view])

  return (
    <>
      <RadialMenu
        visible={true}
        isOpen={view === 'MENU_OPEN'}
        onOpen={() => setView('MENU_OPEN')}
        onClose={() => setView('MENU_CLOSED')}
        onExitRequest={() => setExitModal(true)}
        firstItemRef={firstItemRef}
        firstFallbackItemRef={firstFallbackItemRef}
        centerButtonRef={centerButtonRef}
      />
      <ExitModal
        isOpen={exitModalOpen}
        onClose={() => setExitModal(false)}
        onConfirm={logout}
      />
    </>
  )
}
```

- [ ] **Step 6: Run tests to verify all pass**

```
npm test -- components/RadialMenu.test.tsx components/ExitModal.test.tsx
```
Expected: PASS (13 RadialMenu tests + 6 ExitModal tests)

- [ ] **Step 7: Run full suite**

```
npm test
```
Expected: all tests pass

- [ ] **Step 8: Commit**

```bash
git add components/RadialMenu.tsx components/RadialMenu.module.css components/RadialMenu.test.tsx components/AppShell.tsx
git commit -m "feat(settings): add satellite buttons to RadialMenu, wire ExitModal in AppShell"
```

---

## Task 6: Settings page — layout + left card (Aspetto)

**Files:**
- Create: `app/settings/page.tsx`
- Create: `components/Settings.tsx`
- Create: `components/Settings.module.css`
- Create: `components/Settings.test.tsx`

The left card contains the 8 palette tiles (2×4 grid) and two toggle switches. The right card is a stub (added in Task 7).

- [ ] **Step 1: Write failing tests**

Create `components/Settings.test.tsx`:

```typescript
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) =>
    <a href={href} {...props}>{children}</a>,
}))

vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: { user: { email: 'test@example.com' } } }),
}))

const setPaletteIdMock     = vi.fn()
const setVisualEffectsMock = vi.fn()
const setAutoLockMock      = vi.fn()

vi.mock('@/lib/PreferencesContext', () => ({
  usePreferences: () => ({
    preferences: {
      paletteId:       1,
      visualEffects:   true,
      autoLockMinutes: 5,
    },
    setPaletteId:       setPaletteIdMock,
    setVisualEffects:   setVisualEffectsMock,
    setAutoLockMinutes: setAutoLockMock,
  }),
}))

import { Settings } from './Settings'

beforeEach(() => { vi.clearAllMocks() })

describe('Settings', () => {

  it('1. renders a heading "Impostazioni"', () => {
    render(<Settings />)
    expect(screen.getByRole('heading', { name: 'Impostazioni' })).toBeTruthy()
  })

  it('2. back link navigates to /', () => {
    render(<Settings />)
    const back = screen.getByRole('link', { name: /indietro/i })
    expect(back.getAttribute('href')).toBe('/')
  })

  it('3. renders 8 palette tiles', () => {
    render(<Settings />)
    const group = screen.getByRole('radiogroup', { name: 'Palette colore' })
    const tiles = group.querySelectorAll('[role="radio"]')
    expect(tiles.length).toBe(8)
  })

  it('4. palette tile 1 is aria-checked (active)', () => {
    render(<Settings />)
    const group = screen.getByRole('radiogroup', { name: 'Palette colore' })
    const firstTile = group.querySelectorAll('[role="radio"]')[0] as HTMLElement
    expect(firstTile.getAttribute('aria-checked')).toBe('true')
  })

  it('5. clicking palette tile 3 calls setPaletteId(3)', () => {
    render(<Settings />)
    const group = screen.getByRole('radiogroup', { name: 'Palette colore' })
    const tile3 = group.querySelectorAll('[role="radio"]')[2] as HTMLElement
    fireEvent.click(tile3)
    expect(setPaletteIdMock).toHaveBeenCalledWith(3)
  })

  it('6. visual effects toggle is aria-checked=true (effects on)', () => {
    render(<Settings />)
    const toggle = screen.getByRole('switch', { name: 'Effetti visivi' })
    expect(toggle.getAttribute('aria-checked')).toBe('true')
  })

  it('7. clicking visual effects toggle calls setVisualEffects(false)', () => {
    render(<Settings />)
    const toggle = screen.getByRole('switch', { name: 'Effetti visivi' })
    fireEvent.click(toggle)
    expect(setVisualEffectsMock).toHaveBeenCalledWith(false)
  })

  it('8. auto-lock control renders 4 segments', () => {
    render(<Settings />)
    const group = screen.getByRole('radiogroup', { name: 'Blocco automatico' })
    const segments = group.querySelectorAll('[role="radio"]')
    expect(segments.length).toBe(4)
  })

  it('9. clicking "30 min" segment calls setAutoLockMinutes(30)', () => {
    render(<Settings />)
    const group = screen.getByRole('radiogroup', { name: 'Blocco automatico' })
    fireEvent.click(screen.getByRole('radio', { name: '30 min' }))
    expect(setAutoLockMock).toHaveBeenCalledWith(30)
  })

  it('10. account row shows user email', () => {
    render(<Settings />)
    expect(screen.getByText('test@example.com')).toBeTruthy()
  })

})
```

- [ ] **Step 2: Run tests to verify they fail**

```
npm test -- components/Settings.test.tsx
```
Expected: FAIL — module not found

- [ ] **Step 3: Create components/Settings.module.css**

```css
/* components/Settings.module.css */

/* ── Keyframes (duplicated from RadialMenu for isolation) ── */

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

@media (prefers-reduced-motion: reduce) {
  .glow { animation: none; }
}

/* ── Root ──────────────────────────────────────────────── */

.root {
  position:        fixed;
  inset:           0;
  display:         flex;
  flex-direction:  column;
  background:      linear-gradient(135deg, var(--gradient-start, #581c87), var(--gradient-end, #be123c));
  color:           #ffffff;
  overflow-y:      auto;
}

/* ── Decorative glows ──────────────────────────────────── */

.glow {
  position:       absolute;
  border-radius:  50%;
  pointer-events: none;
  filter:         blur(14px);
}

.glow1 {
  width: 340px; height: 340px;
  top: 200px; left: 280px;
  background: var(--glow-1);
  opacity: 0.70;
  animation: drift-1 12s ease-in-out infinite alternate;
}

.glow2 {
  width: 360px; height: 360px;
  top: 380px; left: 560px;
  background: var(--glow-2);
  opacity: 0.65;
  animation: drift-2 14s ease-in-out infinite alternate;
}

.glow3 {
  width: 200px; height: 200px;
  top: 160px; left: 470px;
  background: var(--glow-3);
  opacity: 0.50;
  animation: drift-3 16s ease-in-out infinite alternate;
}

/* ── Header ────────────────────────────────────────────── */

.header {
  position:        sticky;
  top:             0;
  z-index:         1;
  display:         flex;
  align-items:     center;
  justify-content: center;
  padding:         20px 24px;
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

/* ── Cards row ─────────────────────────────────────────── */

.cardsRow {
  position:        relative;
  z-index:         1;
  display:         flex;
  gap:             24px;
  justify-content: center;
  align-items:     flex-start;
  padding:         0 24px 40px;
  flex:            1;
}

/* ── Glass card ────────────────────────────────────────── */

.card {
  width:           340px;
  padding:         28px;
  border-radius:   24px;
  display:         flex;
  flex-direction:  column;
  gap:             20px;

  background: radial-gradient(
    ellipse at center top,
    rgba(255, 255, 255, 0.18) 0%,
    rgba(255, 255, 255, 0.05) 70%,
    transparent 100%
  );
  backdrop-filter:          blur(28px) saturate(160%);
  -webkit-backdrop-filter:  blur(28px) saturate(160%);
  mask-image:               radial-gradient(ellipse at center, black 60%, transparent 100%);
  -webkit-mask-image:       radial-gradient(ellipse at center, black 60%, transparent 100%);
}

@supports not (backdrop-filter: blur(1px)) {
  .card {
    background: rgba(255, 255, 255, 0.14);
  }
}

.cardTitle {
  font-size:   0.9375rem;
  font-weight: 600;
  opacity:     0.75;
  margin:      0;
}

/* ── Palette grid ──────────────────────────────────────── */

.paletteGrid {
  display:               grid;
  grid-template-columns: repeat(4, 1fr);
  gap:                   8px;
  list-style:            none;
  padding:               0;
  margin:                0;
}

.paletteTile {
  width:         100%;
  aspect-ratio:  1;
  border-radius: 10px;
  border:        none;
  cursor:        pointer;
  padding:       0;
  transition:    transform 120ms ease, outline-offset 120ms ease;
}

.paletteTile:focus-visible {
  outline:        2px solid #ffffff;
  outline-offset: 2px;
}

.paletteTile[aria-checked="true"] {
  outline:        2px solid #ffffff;
  outline-offset: 2px;
  transform:      scale(1.08);
}

/* ── Toggle rows ───────────────────────────────────────── */

.toggleRow {
  display:         flex;
  align-items:     center;
  justify-content: space-between;
  height:          44px;
}

.toggleLabel {
  font-size:   0.9rem;
  font-weight: 400;
}

.toggleSubLabel {
  font-size:   0.7rem;
  opacity:     0.55;
  margin-top:  2px;
}

.toggle {
  width:         44px;
  height:        24px;
  border-radius: 12px;
  border:        none;
  cursor:        pointer;
  padding:       2px;
  position:      relative;
  flex-shrink:   0;
  background:    rgba(255, 255, 255, 0.20);
  transition:    background 200ms ease;
}

.toggle[aria-checked="true"] {
  background: rgba(255, 255, 255, 0.70);
}

.toggle:disabled {
  opacity: 0.45;
  cursor:  not-allowed;
}

.toggle:focus-visible {
  outline:        2px solid #ffffff;
  outline-offset: 2px;
}

.toggleThumb {
  display:          block;
  width:            20px;
  height:           20px;
  border-radius:    50%;
  background:       #ffffff;
  position:         absolute;
  top:              2px;
  left:             2px;
  transition:       transform 200ms ease;
  pointer-events:   none;
}

.toggle[aria-checked="true"] .toggleThumb {
  transform:  translateX(20px);
  background: #333333;
}

/* ── Segmented control ─────────────────────────────────── */

.segmentLabel {
  font-size:   0.9rem;
  font-weight: 400;
  margin:      0;
}

.segmentedControl {
  display:       flex;
  border-radius: 20px;
  overflow:      hidden;
  background:    rgba(255, 255, 255, 0.10);
}

.segment {
  flex:          1;
  height:        40px;
  border:        none;
  cursor:        pointer;
  font-size:     0.8rem;
  font-weight:   500;
  color:         #ffffff;
  background:    transparent;
  transition:    background 150ms ease;
}

.segment[aria-checked="true"] {
  background: radial-gradient(
    circle,
    rgba(255, 255, 255, 0.28) 0%,
    rgba(255, 255, 255, 0.10) 100%
  );
}

.segment:focus-visible {
  outline:        2px solid #ffffff;
  outline-offset: -2px;
}

/* ── Account row ───────────────────────────────────────── */

.accountDivider {
  border:     none;
  border-top: 1px solid rgba(255, 255, 255, 0.15);
  margin:     0;
}

.accountRow {
  display:     flex;
  align-items: center;
  gap:         12px;
  cursor:      default;
}

.avatar {
  width:           36px;
  height:          36px;
  border-radius:   50%;
  background:      rgba(255, 255, 255, 0.20);
  display:         flex;
  align-items:     center;
  justify-content: center;
  font-size:       0.75rem;
  font-weight:     600;
  flex-shrink:     0;
}

.accountEmail {
  flex:      1;
  font-size: 0.8rem;
  opacity:   0.85;
  overflow:  hidden;
  text-overflow: ellipsis;
  white-space:   nowrap;
}

.accountChevron {
  opacity: 0.45;
  font-size: 1rem;
}

/* ── Mobile (<= 499px) ─────────────────────────────────── */

@media (max-width: 499px) {
  .cardsRow {
    flex-direction: column;
    align-items:    stretch;
    padding:        0 16px 40px;
  }
  .card {
    width: 100%;
  }
}
```

- [ ] **Step 4: Create components/Settings.tsx**

```tsx
// components/Settings.tsx
'use client'

import { type CSSProperties } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { usePreferences } from '@/lib/PreferencesContext'
import { PALETTES } from '@/lib/palettes'
import styles from './Settings.module.css'

export function Settings() {
  const { data: session } = useSession()
  const {
    preferences,
    setPaletteId,
    setVisualEffects,
    setAutoLockMinutes,
  } = usePreferences()

  const email    = session?.user?.email ?? ''
  const initials = email.slice(0, 2).toUpperCase()

  return (
    <div
      className={styles.root}
      style={{
        '--glow-1': 'var(--gradient-start, #581c87)',
        '--glow-2': 'var(--gradient-end,   #be123c)',
        '--glow-3': 'color-mix(in srgb, var(--gradient-start) 60%, var(--gradient-end))',
      } as CSSProperties}
    >
      {/* Decorative glows */}
      <div className={`${styles.glow} ${styles.glow1}`} data-glow aria-hidden="true" />
      <div className={`${styles.glow} ${styles.glow2}`} data-glow aria-hidden="true" />
      <div className={`${styles.glow} ${styles.glow3}`} data-glow aria-hidden="true" />

      {/* Header */}
      <header className={styles.header}>
        <Link href="/" className={styles.backButton} aria-label="Indietro">
          ← Indietro
        </Link>
        <h1 className={styles.title}>Impostazioni</h1>
      </header>

      {/* Cards row */}
      <div className={styles.cardsRow}>

        {/* Left card: Aspetto */}
        <div className={styles.card}>
          <p className={styles.cardTitle}>Aspetto</p>

          {/* Palette grid */}
          <div role="radiogroup" aria-label="Palette colore" className={styles.paletteGrid}>
            {PALETTES.map(palette => (
              <button
                key={palette.id}
                role="radio"
                aria-checked={preferences.paletteId === palette.id}
                aria-label={palette.label}
                className={styles.paletteTile}
                style={{ background: `linear-gradient(135deg, ${palette.from}, ${palette.to})` }}
                onClick={() => setPaletteId(palette.id)}
              />
            ))}
          </div>

          {/* Effetti visivi toggle */}
          <div className={styles.toggleRow}>
            <span className={styles.toggleLabel}>Effetti visivi</span>
            <button
              role="switch"
              aria-checked={preferences.visualEffects}
              aria-label="Effetti visivi"
              className={styles.toggle}
              onClick={() => setVisualEffects(!preferences.visualEffects)}
            >
              <span className={styles.toggleThumb} />
            </button>
          </div>

          {/* Tema scuro toggle (stub) */}
          <div className={styles.toggleRow}>
            <div>
              <div className={styles.toggleLabel}>Tema scuro</div>
              <div className={styles.toggleSubLabel}>(prossimamente)</div>
            </div>
            <button
              role="switch"
              aria-checked={false}
              aria-label="Tema scuro"
              className={styles.toggle}
              disabled
            >
              <span className={styles.toggleThumb} />
            </button>
          </div>
        </div>

        {/* Right card: Generali */}
        <div className={styles.card}>
          <p className={styles.cardTitle}>Generali</p>

          {/* Auto-lock segmented control */}
          <p className={styles.segmentLabel}>Blocco automatico</p>
          <div role="radiogroup" aria-label="Blocco automatico" className={styles.segmentedControl}>
            {([1, 5, 30, null] as const).map(minutes => {
              const label    = minutes === null ? 'Mai' : `${minutes} min`
              const isActive = preferences.autoLockMinutes === minutes
              return (
                <button
                  key={label}
                  role="radio"
                  aria-checked={isActive}
                  aria-label={label}
                  className={styles.segment}
                  onClick={() => setAutoLockMinutes(minutes)}
                >
                  {label}
                </button>
              )
            })}
          </div>

          {/* Account row */}
          <hr className={styles.accountDivider} />
          <div className={styles.accountRow} aria-disabled="true">
            <div className={styles.avatar} aria-hidden="true">{initials}</div>
            <span className={styles.accountEmail}>{email}</span>
            <span className={styles.accountChevron} aria-hidden="true">›</span>
          </div>
        </div>

      </div>
    </div>
  )
}
```

- [ ] **Step 5: Create app/settings/page.tsx**

```tsx
// app/settings/page.tsx
import { Settings } from '@/components/Settings'

export default function SettingsPage() {
  return <Settings />
}
```

- [ ] **Step 6: Run tests to verify they pass**

```
npm test -- components/Settings.test.tsx
```
Expected: PASS (10 tests)

- [ ] **Step 7: Run full suite**

```
npm test
```
Expected: all tests pass

- [ ] **Step 8: Commit**

```bash
git add app/settings/page.tsx components/Settings.tsx components/Settings.module.css components/Settings.test.tsx
git commit -m "feat(settings): add Settings page with palette grid, toggles, auto-lock, account row"
```

---

## Task 7: Typecheck

**Files:**
- No code changes

Run the TypeScript compiler to catch any type errors introduced across all tasks before wrapping up.

- [ ] **Step 1: Run typecheck**

```
npm run typecheck
```
Expected: no errors

- [ ] **Step 2: If errors, fix them**

Common issues to look for:
- `CSSProperties` missing custom property declaration → cast with `as CSSProperties`
- `autoLockMinutes: null` not assignable to `1 | 5 | 30 | null` → verify the `as const` on the segments array
- `PaletteEntry` from `lib/palettes.ts` consumed in `PreferencesContext.tsx` — make sure `from`/`to` are accessed as strings

- [ ] **Step 3: Run final test suite**

```
npm test
```
Expected: all tests pass

- [ ] **Step 4: Commit if any fixes were needed**

```bash
git add -p
git commit -m "fix(settings): resolve TypeScript errors from typecheck"
```
(Skip if typecheck was clean with no changes needed.)
