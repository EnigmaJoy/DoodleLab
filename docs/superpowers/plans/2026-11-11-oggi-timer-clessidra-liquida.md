# Oggi Timer Clessidra Liquida — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the visual timer panel in Oggi with a calm liquid-hourglass design that is glanceable without demanding attention, designed for adults with ADHD.

**Architecture:** `VisualTimer.tsx` is rebuilt around a new `Hourglass` pure component (inline SVG, props-only). The timer logic in `timer.ts` / `timer-store.ts` is untouched. `TodayToolsRow.tsx` gains an `onClose` prop pass-through and an `OPEN_PANEL_EVENT` listener. `SegmentedControl` gets an additive `variant` + `disabled` prop so the timer can render a white-chip active segment.

**Tech Stack:** React 18, Next.js (App Router, `'use client'`), TypeScript, Vitest + @testing-library/react, global CSS (`.today-timer*` classes), CSS modules (SegmentedControl)

---

## File Map

| Action | File |
|---|---|
| Modify | `frontend/design-system/SegmentedControl.tsx` |
| Modify | `frontend/design-system/SegmentedControl.module.css` |
| Modify | `frontend/design-system/SegmentedControl.test.tsx` |
| Modify | `frontend/app/globals.css` (lines 2111–2160 + line 2212) |
| Modify | `frontend/components/today/TodayToolsRow.tsx` |
| Modify | `frontend/components/today/VisualTimer.tsx` |
| Create | `frontend/components/today/VisualTimer.test.tsx` |

---

## Task 1: SegmentedControl — `variant` + `disabled` props

**Files:**
- Modify: `frontend/design-system/SegmentedControl.tsx`
- Modify: `frontend/design-system/SegmentedControl.module.css`
- Modify: `frontend/design-system/SegmentedControl.test.tsx`

- [ ] **Step 1: Write failing tests**

Add to the bottom of `frontend/design-system/SegmentedControl.test.tsx`:

```tsx
  it('6. solid-active variant: active segment has white background class', () => {
    render(
      <SegmentedControl options={OPTIONS} value="grid" onChange={() => {}}
                        variant="solid-active" />
    )
    const active = screen.getByRole('radio', { name: 'Griglia' })
    expect(active.className).toMatch(/solidActive/)
  })

  it('7. disabled prop: all segment buttons are disabled', () => {
    render(<SegmentedControl options={OPTIONS} value="free" onChange={() => {}} disabled />)
    const radios = screen.getAllByRole('radio')
    radios.forEach(r => expect((r as HTMLButtonElement).disabled).toBe(true))
  })
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd frontend && npx vitest run design-system/SegmentedControl.test.tsx
```

Expected: tests 6 and 7 fail.

- [ ] **Step 3: Update `SegmentedControl.tsx`**

Replace the entire file:

```tsx
'use client'

import styles from './SegmentedControl.module.css'

interface Option {
  value: string
  label: string
}

interface SegmentedControlProps {
  options:   Option[]
  value:     string
  onChange:  (value: string) => void
  label?:    string
  variant?:  'solid-active'
  disabled?: boolean
}

export function SegmentedControl({ options, value, onChange, label, variant, disabled }: SegmentedControlProps) {
  return (
    <div
      className={styles.root}
      role="radiogroup"
      aria-label={label}
    >
      {options.map(opt => {
        const isActive = opt.value === value
        const cls = [
          styles.segment,
          isActive && variant === 'solid-active' ? styles.solidActive : '',
        ].filter(Boolean).join(' ')
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={isActive}
            className={cls}
            data-active={isActive || undefined}
            disabled={disabled}
            onClick={() => onChange(opt.value)}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 4: Add `.solidActive` to `SegmentedControl.module.css`**

Append at the end of the file:

```css
.solidActive {
  background: #ffffff;
  color:      var(--ink);
  font-weight: 700;
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd frontend && npx vitest run design-system/SegmentedControl.test.tsx
```

Expected: all 7 tests pass.

- [ ] **Step 6: Commit**

```bash
cd frontend && git add design-system/SegmentedControl.tsx design-system/SegmentedControl.module.css design-system/SegmentedControl.test.tsx
git commit -m "feat(ds): add variant and disabled props to SegmentedControl"
```

---

## Task 2: CSS — new `.today-timer*` block

**Files:**
- Modify: `frontend/app/globals.css` (lines 2111–2160; also line 2212)

- [ ] **Step 1: Replace the old timer CSS block (lines 2111–2160)**

In `frontend/app/globals.css`, find and replace this exact block:

```css
/* -- Timer -- */
.today-timer {
  display:     flex;
  align-items: center;
  gap:         1.25rem;
  flex-wrap:   wrap;
}

.today-timer-controls { flex: 1; min-width: 200px; display: flex; flex-direction: column; gap: 0.375rem; }

.today-timer-time {
  font-size:   2.25rem;
  font-weight: 800;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}

.today-presets { display: flex; gap: 0.375rem; flex-wrap: wrap; }

.today-preset {
  min-height:    44px;
  min-width:     64px;
  padding:       0 0.75rem;
  border-radius: 10px;
  border:        1px solid rgba(70, 50, 20, 0.22);
  background:    var(--paper);
  color:         var(--ink);
  font-size:     0.8125rem;
  font-weight:   600;
  cursor:        pointer;
}

.today-preset[aria-pressed="true"] { border: 2px solid var(--ink); font-weight: 800; }
.today-preset:disabled             { opacity: 0.5; cursor: not-allowed; }

.today-hourglass { flex-shrink: 0; }
.today-hourglass-glass { fill: none; stroke: var(--ink); stroke-width: 2.5; stroke-linejoin: round; }
.today-hourglass-frame { stroke: var(--ink); stroke-width: 4; stroke-linecap: round; }
.today-sand { fill: #f59332; }

.today-sand-stream {
  stroke:           #f59332;
  stroke-width:     2;
  stroke-dasharray: 3 3;
  animation:        today-sand-fall 600ms linear infinite;
}

@keyframes today-sand-fall {
  to { stroke-dashoffset: -6; }
}
```

With:

```css
/* -- Timer (Clessidra liquida) -- */
.today-timer {
  display:     flex;
  align-items: flex-start;
  gap:         20px;
}

.today-timer-halo-wrap {
  flex-shrink:   0;
  border-radius: 8px;
}

.today-timer-halo-wrap[data-finished] {
  animation: today-timer-halo 2.4s ease-in-out forwards;
}

@keyframes today-timer-halo {
  0%   { box-shadow: none; }
  25%  { box-shadow: 0 0 0 14px rgba(255, 255, 255, 0.22); }
  50%  { box-shadow: none; }
  75%  { box-shadow: 0 0 0 14px rgba(255, 255, 255, 0.22); }
  100% { box-shadow: none; }
}

.today-timer-right {
  flex:           1;
  display:        flex;
  flex-direction: column;
  gap:            10px;
  padding-top:    4px;
}

.today-timer-header-row {
  display:         flex;
  align-items:     flex-start;
  justify-content: space-between;
  gap:             8px;
}

.today-timer-time {
  font-size:            30px;
  font-weight:          700;
  line-height:          1;
  font-variant-numeric: tabular-nums;
  color:                var(--text-primary);
}

.today-timer-status {
  font-size:   13px;
  font-weight: 600;
  opacity:     0.85;
  color:       var(--text-primary);
  margin-top:  4px;
}

.today-timer-controls-row {
  display:     flex;
  gap:         8px;
  flex-wrap:   wrap;
  align-items: center;
}

.today-timer-pill {
  display:         inline-flex;
  align-items:     center;
  justify-content: center;
  min-width:       112px;
  height:          44px;
  padding:         0 20px;
  border-radius:   22px;
  border:          none;
  background:      #ffffff;
  color:           var(--ink);
  font-size:       15px;
  font-weight:     700;
  font-family:     inherit;
  cursor:          pointer;
  transition:      opacity 150ms ease;
}

.today-timer-pill:focus-visible {
  outline:        2px solid #ffffff;
  outline-offset: 2px;
}

.today-timer-pill--glass {
  background:              linear-gradient(160deg, rgba(255, 255, 255, 0.18), rgba(255, 255, 255, 0.08));
  backdrop-filter:         blur(28px) saturate(160%);
  -webkit-backdrop-filter: blur(28px) saturate(160%);
  box-shadow:              inset 0 0 0 1px rgba(255, 255, 255, 0.14);
  color:                   #ffffff;
  font-weight:             600;
}

.today-timer-finished-bar {
  display:        flex;
  flex-direction: column;
  gap:            10px;
  padding-top:    12px;
  border-top:     1px solid rgba(255, 255, 255, 0.12);
  color:          var(--text-primary);
  font-size:      14px;
  line-height:    1.4;
}

.today-timer-seconds-toggle {
  align-self:  flex-start;
  background:  none;
  border:      none;
  font-family: inherit;
  font-size:   12px;
  font-weight: 600;
  color:       rgba(255, 255, 255, 0.55);
  cursor:      pointer;
  padding:     0;
  min-height:  44px;
}

.today-timer-seconds-toggle:focus-visible {
  outline:        2px solid #ffffff;
  outline-offset: 2px;
  border-radius:  4px;
}
```

- [ ] **Step 2: Remove the old `.today-sand-stream` reduced-motion rule**

Find and replace this exact line inside the `@media (prefers-reduced-motion: reduce)` block around line 2211:

```css
  .today-sand-stream { display: none; }
```

With nothing (delete the line, keep the rest of the block).

- [ ] **Step 3: Add reduced-motion override for the halo**

After the `@keyframes today-timer-halo` block, the `@media (prefers-reduced-motion: reduce)` near line 2226 already covers all animations via `* { animation: none }`. To also cover the in-app `data-reduce-motion` attribute, add this after the new `.today-timer-halo-wrap[data-finished]` rule (inside the `/* -- Timer -- */` section):

```css
[data-reduce-motion] .today-timer-halo-wrap { animation: none !important; }
```

- [ ] **Step 4: Commit**

```bash
cd frontend && git add app/globals.css
git commit -m "feat(timer): new CSS — Clessidra liquida layout, pills, halo keyframe"
```

---

## Task 3: TodayToolsRow — `onClose` + `OPEN_PANEL_EVENT` listener

**Files:**
- Modify: `frontend/components/today/TodayToolsRow.tsx`

- [ ] **Step 1: Replace the entire file**

```tsx
'use client'

import { useEffect, useState } from 'react'
import type { DayKey } from '@/lib/day'
import { EnergyActivities } from './EnergyActivities'
import { CheckIn } from './CheckIn'
import { VisualTimer } from './VisualTimer'
import { DiaryPanel } from './DiaryPanel'
import { BoltIcon, SmileIcon, HourglassIcon, FeatherIcon } from './icons'
import { IconButton } from '@/design-system/IconButton'

type PanelId = 'energy' | 'checkin' | 'timer' | 'diary'

const TOOLS: Array<{ id: PanelId; label: string; Icon: React.FC<{ size?: number }> }> = [
  { id: 'energy',  label: 'Energia',      Icon: BoltIcon },
  { id: 'checkin', label: 'Umore',        Icon: SmileIcon },
  { id: 'timer',   label: 'Timer visivo', Icon: HourglassIcon },
  { id: 'diary',   label: 'Pensieri',     Icon: FeatherIcon },
]

function CloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
         aria-hidden="true" focusable="false">
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  )
}

export function TodayToolsRow({ day }: { day: DayKey }) {
  const [activePanel, setActivePanel] = useState<PanelId | null>(null)

  // "Inizia 25 minuti" on the focus card dispatches this event to open the timer tray
  useEffect(() => {
    function onOpenPanel(e: Event) {
      const id = (e as CustomEvent<string>).detail as PanelId
      if (TOOLS.some(t => t.id === id)) setActivePanel(id)
    }
    window.addEventListener('today:open-panel', onOpenPanel)
    return () => window.removeEventListener('today:open-panel', onOpenPanel)
  }, [])

  function toggle(id: PanelId) {
    setActivePanel(prev => prev === id ? null : id)
  }

  const closePanel = () => setActivePanel(null)

  return (
    <div className="todayb-tools-section">
      {/* Tray — always render VisualTimer so its state persists even when closed */}
      <div
        className="todayb-tools-tray"
        data-open={activePanel !== null || undefined}
        aria-hidden={activePanel === null}
      >
        <div className="todayb-tools-tray-inner">
          <div style={{ display: activePanel === 'energy' ? 'block' : 'none' }}>
            <EnergyActivities day={day} />
          </div>
          <div style={{ display: activePanel === 'checkin' ? 'block' : 'none' }}>
            <CheckIn day={day} />
          </div>
          {/* VisualTimer always mounted to preserve timer state */}
          <div style={{ display: activePanel === 'timer' ? 'block' : 'none' }}>
            <VisualTimer onClose={closePanel} />
          </div>
          <div style={{ display: activePanel === 'diary' ? 'block' : 'none' }}>
            <DiaryPanel day={day} />
          </div>
        </div>

        {/* Show generic close only for non-timer panels; timer renders its own */}
        {activePanel !== null && activePanel !== 'timer' && (
          <button
            type="button"
            className="todayb-tools-tray-close"
            onClick={closePanel}
            aria-label="Chiudi pannello"
          >
            <CloseIcon />
          </button>
        )}
      </div>

      {/* Tool buttons grid */}
      <div className="todayb-tools-grid" role="group" aria-label="Strumenti">
        {TOOLS.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            className="todayb-tool-btn"
            aria-pressed={activePanel === id}
            onClick={() => toggle(id)}
          >
            <Icon size={20} />
            <span>{label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit 2>&1 | grep TodayToolsRow
```

Expected: no output (no errors).

- [ ] **Step 3: Commit**

```bash
cd frontend && git add components/today/TodayToolsRow.tsx
git commit -m "feat(timer): TodayToolsRow passes onClose to VisualTimer, listens for open-panel event"
```

---

## Task 4: Hourglass SVG component

**Files:**
- Modify: `frontend/components/today/VisualTimer.tsx`
- Create: `frontend/components/today/VisualTimer.test.tsx`

- [ ] **Step 1: Write failing tests for Hourglass geometry**

Create `frontend/components/today/VisualTimer.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import React from 'react'

// Extract for testing — Hourglass is not exported from the module yet.
// Steps below will export it; until then these tests will fail to import.
import { Hourglass } from './VisualTimer'

describe('Hourglass', () => {
  it('1. renders an SVG with aria-hidden', () => {
    const { container } = render(<Hourglass elapsed={0} running={false} finished={false} reducedMotion={false} />)
    const svg = container.querySelector('svg')
    expect(svg).not.toBeNull()
    expect(svg!.getAttribute('aria-hidden')).toBe('true')
  })

  it('2. at elapsed=0 top sand height is 78, bottom height is 0', () => {
    const { container } = render(<Hourglass elapsed={0} running={false} finished={false} reducedMotion={false} />)
    const rects = container.querySelectorAll('[data-sand]')
    const top    = rects[0] as SVGRectElement
    const bottom = rects[1] as SVGRectElement
    expect(Number(top.style.height)).toBeCloseTo(78)
    expect(Number(bottom.style.height)).toBeCloseTo(0)
  })

  it('3. at elapsed=1 top sand height is 0, bottom height is 78', () => {
    const { container } = render(<Hourglass elapsed={1} running={false} finished={false} reducedMotion={false} />)
    const rects = container.querySelectorAll('[data-sand]')
    expect(Number(rects[0].style.height)).toBeCloseTo(0)
    expect(Number(rects[1].style.height)).toBeCloseTo(78)
  })

  it('4. stream is visible when running and not finished', () => {
    const { container } = render(<Hourglass elapsed={0.5} running={true} finished={false} reducedMotion={false} />)
    const stream = container.querySelector('[data-stream]') as SVGElement
    expect(stream.style.opacity).toBe('0.85')
  })

  it('5. stream is hidden when not running', () => {
    const { container } = render(<Hourglass elapsed={0.5} running={false} finished={false} reducedMotion={false} />)
    const stream = container.querySelector('[data-stream]') as SVGElement
    expect(stream.style.opacity).toBe('0')
  })

  it('6. stream is hidden when finished', () => {
    const { container } = render(<Hourglass elapsed={1} running={false} finished={true} reducedMotion={false} />)
    const stream = container.querySelector('[data-stream]') as SVGElement
    expect(stream.style.opacity).toBe('0')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd frontend && npx vitest run components/today/VisualTimer.test.tsx
```

Expected: fail with "does not provide an export named 'Hourglass'".

- [ ] **Step 3: Write the Hourglass component**

Replace the entire `frontend/components/today/VisualTimer.tsx` with just the Hourglass export for now (the full VisualTimer will be rebuilt in Task 5):

```tsx
// components/today/VisualTimer.tsx
'use client'

import { useId } from 'react'

// ── Hourglass ────────────────────────────────────────────────────────────────

export interface HourglassProps {
  elapsed:       number   // 0..1
  running:       boolean
  finished:      boolean
  reducedMotion: boolean
}

export function Hourglass({ elapsed, running, finished, reducedMotion }: HourglassProps) {
  const id    = useId()
  const topId = `${id}-clip-top`
  const botId = `${id}-clip-bottom`

  const clampedElapsed = Math.max(0, Math.min(1, elapsed))
  const remaining = 1 - clampedElapsed

  const topH    = 78 * remaining
  const topY    = 92 - topH
  const bottomH = 78 * clampedElapsed
  const bottomY = 182 - bottomH

  const sandTransition = reducedMotion ? undefined : 'y 1s linear, height 1s linear'
  const streamOpacity  = running && !finished ? 0.85 : 0

  return (
    <svg
      viewBox="0 0 130 196"
      width={130}
      height={196}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <clipPath id={topId}>
          <path d="M14 14h102c0 34-30 52-44 78h-14C44 66 14 48 14 14z" />
        </clipPath>
        <clipPath id={botId}>
          <path d="M58 104h14c14 26 44 44 44 78H14c0-34 30-52 44-78z" />
        </clipPath>
      </defs>

      {/* Glass body */}
      <path
        d="M14 14h102c0 34-30 52-44 78v12c14 26 44 44 44 78H14c0-34 30-52 44-78V92C44 66 14 48 14 14z"
        fill="rgba(255,255,255,0.14)"
      />

      {/* Top sand */}
      <rect
        data-sand=""
        x={0}
        width={130}
        style={{
          y:          `${topY}`,
          height:     `${topH}`,
          fill:       'var(--glow-3)',
          transition: sandTransition,
        } as React.CSSProperties}
        clipPath={`url(#${topId})`}
      />

      {/* Bottom sand */}
      <rect
        data-sand=""
        x={0}
        width={130}
        style={{
          y:          `${bottomY}`,
          height:     `${bottomH}`,
          fill:       'var(--glow-3)',
          transition: sandTransition,
        } as React.CSSProperties}
        clipPath={`url(#${botId})`}
      />

      {/* Stream */}
      <rect
        data-stream=""
        x={63.5}
        y={92}
        width={3}
        height={88}
        rx={1.5}
        style={{
          fill:    'var(--glow-3)',
          opacity: streamOpacity,
        }}
      />

      {/* Caps */}
      <rect x={6}  y={6}   width={118} height={8} rx={4} fill="#FFFDF5" />
      <rect x={6}  y={182} width={118} height={8} rx={4} fill="#FFFDF5" />
    </svg>
  )
}

// ── VisualTimer (stub — rebuilt in Task 5) ───────────────────────────────────

export function VisualTimer({ onClose }: { onClose: () => void }) {
  return <div className="today-timer"><Hourglass elapsed={0} running={false} finished={false} reducedMotion={false} /></div>
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd frontend && npx vitest run components/today/VisualTimer.test.tsx
```

Expected: all 6 Hourglass tests pass.

- [ ] **Step 5: Commit**

```bash
cd frontend && git add components/today/VisualTimer.tsx components/today/VisualTimer.test.tsx
git commit -m "feat(timer): Hourglass SVG component with clip-path sand geometry"
```

---

## Task 5: VisualTimer — layout + controls + status text

**Files:**
- Modify: `frontend/components/today/VisualTimer.tsx`
- Modify: `frontend/components/today/VisualTimer.test.tsx`

- [ ] **Step 1: Write failing tests for layout and status**

The test file header already exists from Task 4. Replace the import block at the top of `frontend/components/today/VisualTimer.test.tsx` with the expanded version below, then **append** only the `describe('VisualTimer', ...)` block at the end of the file:

New import block (replace existing imports at top of file):

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import { Hourglass, VisualTimer } from './VisualTimer'
import { getTimerStore } from '@/lib/today/timer-store'
import { createTimer, startTimer, pauseTimer } from '@/lib/today/timer'
```

New describe block to append at the end of the file:

```tsx
describe('VisualTimer', () => {
  beforeEach(() => {
    getTimerStore().update(() => createTimer(25), null)
  })

  it('7. idle: status text is "pronto, 25 minuti"', () => {
    render(<VisualTimer onClose={() => {}} />)
    expect(screen.getByText('pronto, 25 minuti')).toBeTruthy()
  })

  it('8. idle: primary button label is "Avvia"', () => {
    render(<VisualTimer onClose={() => {}} />)
    expect(screen.getByRole('button', { name: /Avvia/ })).toBeTruthy()
  })

  it('9. idle: "Ricomincia" button is not visible', () => {
    render(<VisualTimer onClose={() => {}} />)
    expect(screen.queryByRole('button', { name: 'Ricomincia' })).toBeNull()
  })

  it('10. running: primary button label is "Pausa"', () => {
    getTimerStore().update(prev => startTimer(prev, Date.now()))
    render(<VisualTimer onClose={() => {}} />)
    expect(screen.getByRole('button', { name: /Pausa/ })).toBeTruthy()
  })

  it('11. paused: primary button label is "Riprendi"', () => {
    const t = Date.now()
    getTimerStore().update(prev => pauseTimer(startTimer(prev, t), t + 1000))
    render(<VisualTimer onClose={() => {}} />)
    expect(screen.getByRole('button', { name: /Riprendi/ })).toBeTruthy()
  })

  it('12. duration selector has options 10, 25, 45', () => {
    render(<VisualTimer onClose={() => {}} />)
    expect(screen.getByRole('radio', { name: '10 min' })).toBeTruthy()
    expect(screen.getByRole('radio', { name: '25 min' })).toBeTruthy()
    expect(screen.getByRole('radio', { name: '45 min' })).toBeTruthy()
  })

  it('13. changing duration to 10 resets the timer to 10 min', () => {
    render(<VisualTimer onClose={() => {}} />)
    fireEvent.click(screen.getByRole('radio', { name: '10 min' }))
    expect(getTimerStore().state.durationMs).toBe(10 * 60_000)
    expect(getTimerStore().state.status).toBe('idle')
  })

  it('14. close button calls onClose', () => {
    const onClose = vi.fn()
    render(<VisualTimer onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: 'Chiudi il timer' }))
    expect(onClose).toHaveBeenCalledOnce()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd frontend && npx vitest run components/today/VisualTimer.test.tsx
```

Expected: tests 7–14 fail (stub VisualTimer renders almost nothing).

- [ ] **Step 3: Implement full VisualTimer**

Replace the entire `frontend/components/today/VisualTimer.tsx`:

```tsx
// components/today/VisualTimer.tsx
'use client'

import { useEffect, useId, useRef, useState } from 'react'
import {
  TIMER_PRESETS_MIN, createTimer, formatRemaining, pauseTimer, progress,
  remainingMs, resetTimer, startTimer, tickTimer,
} from '@/lib/today/timer'
import type { TimerStatus } from '@/lib/today/timer'
import { getTimerStore } from '@/lib/today/timer-store'
import { SegmentedControl } from '@/design-system/SegmentedControl'
import { IconButton } from '@/design-system/IconButton'
import { useRepository } from './shared'

// ── Close icon ───────────────────────────────────────────────────────────────

function CloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
         aria-hidden="true" focusable="false">
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  )
}

// ── Reduced motion hook ──────────────────────────────────────────────────────

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => {
    if (typeof window === 'undefined') return false
    return (
      window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
      !!document.documentElement.dataset.reduceMotion
    )
  })
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const check = () => setReduced(
      mq.matches || !!document.documentElement.dataset.reduceMotion
    )
    mq.addEventListener('change', check)
    return () => mq.removeEventListener('change', check)
  }, [])
  return reduced
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function primaryLabel(status: TimerStatus): string {
  if (status === 'running') return 'Pausa'
  if (status === 'paused')  return 'Riprendi'
  return 'Avvia'
}

function statusText(status: TimerStatus, minutes: number): string {
  if (status === 'idle')     return `pronto, ${minutes} minuti`
  if (status === 'running')  return `restano, su ${minutes}`
  if (status === 'paused')   return `in pausa, su ${minutes}`
  return `su ${minutes} minuti`
}

// ── VisualTimer ──────────────────────────────────────────────────────────────

export function VisualTimer({ onClose }: { onClose: () => void }) {
  const store  = useRepository(getTimerStore())
  const timer  = store.state
  const [now,  setNow]         = useState(() => Date.now())
  const [showSeconds, setShowSeconds] = useState(() => {
    if (typeof window === 'undefined') return false
    try { return localStorage.getItem('today.timer.showSeconds') === 'true' } catch { return false }
  })
  const [announceText, setAnnounceText] = useState('')
  const lastAnnouncedMin = useRef<number>(Infinity)
  const reducedMotion    = useReducedMotion()

  // 1 s interval: tick store + refresh now for display/sand
  useEffect(() => {
    if (timer.status !== 'running') return
    setNow(Date.now())
    const id = setInterval(() => {
      const t = Date.now()
      setNow(t)
      store.update(prev => tickTimer(prev, t))
    }, 1000)
    return () => clearInterval(id)
  }, [timer.status, timer.endsAt, store])

  // Aria-live announcements at 5-min boundaries and finish
  useEffect(() => {
    if (timer.status === 'finished') {
      setAnnounceText('Tempo finito')
      lastAnnouncedMin.current = 0
      return
    }
    if (timer.status === 'running') {
      const leftMin = Math.ceil(remainingMs(timer, now) / 60_000)
      if (leftMin % 5 === 0 && leftMin > 0 && leftMin !== lastAnnouncedMin.current) {
        setAnnounceText(`${leftMin} minuti rimanenti`)
        lastAnnouncedMin.current = leftMin
      }
    }
  }, [timer, now])

  const minutes    = timer.durationMs / 60_000
  const leftMs     = remainingMs(timer, now)
  const elapsed    = progress(timer, now)
  const isFinished = timer.status === 'finished'
  const isRunning  = timer.status === 'running'

  // In reduced motion snap sand to minute boundaries (spec: "update once per minute")
  const displayElapsed = reducedMotion && !isFinished
    ? 1 - Math.ceil(remainingMs(timer, now) / 60_000) / minutes
    : elapsed

  const timeText = isFinished
    ? 'Tempo finito'
    : showSeconds
    ? formatRemaining(leftMs)
    : (() => {
        const m = Math.ceil(leftMs / 60_000)
        return m === 1 ? '1 minuto' : `${m} minuti`
      })()

  function pickPreset(m: number) {
    store.update(() => createTimer(m), null)
    lastAnnouncedMin.current = Infinity
  }

  function handlePrimary() {
    const t = Date.now()
    setNow(t)
    if (timer.status === 'idle' || timer.status === 'paused') {
      setAnnounceText(`Timer avviato, ${minutes} minuti`)
      lastAnnouncedMin.current = minutes
    }
    store.update(prev => prev.status === 'running' ? pauseTimer(prev, t) : startTimer(prev, t))
  }

  function handleReset() {
    store.update(resetTimer)
    lastAnnouncedMin.current = Infinity
  }

  return (
    <div className="today-timer">
      <div
        className="today-timer-halo-wrap"
        data-finished={isFinished || undefined}
      >
        <Hourglass
          elapsed={displayElapsed}
          running={isRunning}
          finished={isFinished}
          reducedMotion={reducedMotion}
        />
      </div>

      <div className="today-timer-right">
        <div className="today-timer-header-row">
          <div>
            <p className="today-timer-time">{timeText}</p>
            <p className="today-timer-status">{statusText(timer.status, minutes)}</p>
          </div>
          <IconButton
            label="Chiudi il timer"
            icon={<CloseIcon />}
            onClick={onClose}
          />
        </div>

        <SegmentedControl
          options={TIMER_PRESETS_MIN.map(m => ({ value: String(m), label: `${m} min` }))}
          value={String(minutes)}
          onChange={v => pickPreset(Number(v))}
          label="Durata"
          variant="solid-active"
          disabled={isRunning}
        />

        {!isFinished && (
          <div className="today-timer-controls-row">
            <button
              type="button"
              className="today-timer-pill"
              onClick={handlePrimary}
              aria-label={`${primaryLabel(timer.status)} timer, ${timeText}`}
            >
              {primaryLabel(timer.status)}
            </button>
            {timer.status !== 'idle' && (
              <button
                type="button"
                className="today-timer-pill today-timer-pill--glass"
                onClick={handleReset}
              >
                Ricomincia
              </button>
            )}
          </div>
        )}

        {isFinished && (
          <div className="today-timer-finished-bar" role="status">
            <p><b>Tempo finito.</b> Fermati un attimo: com'è andata?</p>
            <div className="today-timer-controls-row">
              <button
                type="button"
                className="today-timer-pill"
                onClick={() => {
                  store.startFor(5, store.label)
                  lastAnnouncedMin.current = 5
                }}
              >
                Altri 5 minuti
              </button>
              <button
                type="button"
                className="today-timer-pill today-timer-pill--glass"
                onClick={() => { handleReset(); onClose() }}
              >
                Chiudi
              </button>
            </div>
          </div>
        )}

        <button
          type="button"
          role="switch"
          aria-checked={showSeconds}
          className="today-timer-seconds-toggle"
          onClick={() => {
            const v = !showSeconds
            setShowSeconds(v)
            try { localStorage.setItem('today.timer.showSeconds', String(v)) } catch {}
          }}
        >
          {showSeconds ? 'Mostra i minuti' : 'Mostra i secondi'}
        </button>

        {/* aria-live: announces at start, 5-min boundaries, and finish only */}
        <span className="sr-only" aria-live="polite" aria-atomic="true">
          {announceText}
        </span>
      </div>
    </div>
  )
}

// ── Hourglass ────────────────────────────────────────────────────────────────

export interface HourglassProps {
  elapsed:       number
  running:       boolean
  finished:      boolean
  reducedMotion: boolean
}

export function Hourglass({ elapsed, running, finished, reducedMotion }: HourglassProps) {
  const id    = useId()
  const topId = `${id}-clip-top`
  const botId = `${id}-clip-bottom`

  const clampedElapsed = Math.max(0, Math.min(1, elapsed))
  const remaining = 1 - clampedElapsed

  const topH    = 78 * remaining
  const topY    = 92 - topH
  const bottomH = 78 * clampedElapsed
  const bottomY = 182 - bottomH

  const sandTransition = reducedMotion ? undefined : 'y 1s linear, height 1s linear'
  const streamOpacity  = running && !finished ? 0.85 : 0

  return (
    <svg
      viewBox="0 0 130 196"
      width={130}
      height={196}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <clipPath id={topId}>
          <path d="M14 14h102c0 34-30 52-44 78h-14C44 66 14 48 14 14z" />
        </clipPath>
        <clipPath id={botId}>
          <path d="M58 104h14c14 26 44 44 44 78H14c0-34 30-52 44-78z" />
        </clipPath>
      </defs>

      {/* Glass body */}
      <path
        d="M14 14h102c0 34-30 52-44 78v12c14 26 44 44 44 78H14c0-34 30-52 44-78V92C44 66 14 48 14 14z"
        fill="rgba(255,255,255,0.14)"
      />

      {/* Top sand */}
      <rect
        data-sand=""
        x={0}
        width={130}
        style={{
          y:          `${topY}`,
          height:     `${topH}`,
          fill:       'var(--glow-3)',
          transition: sandTransition,
        } as React.CSSProperties}
        clipPath={`url(#${topId})`}
      />

      {/* Bottom sand */}
      <rect
        data-sand=""
        x={0}
        width={130}
        style={{
          y:          `${bottomY}`,
          height:     `${bottomH}`,
          fill:       'var(--glow-3)',
          transition: sandTransition,
        } as React.CSSProperties}
        clipPath={`url(#${botId})`}
      />

      {/* Stream */}
      <rect
        data-stream=""
        x={63.5}
        y={92}
        width={3}
        height={88}
        rx={1.5}
        style={{
          fill:    'var(--glow-3)',
          opacity: streamOpacity,
        }}
      />

      {/* Caps */}
      <rect x={6}  y={6}   width={118} height={8} rx={4} fill="#FFFDF5" />
      <rect x={6}  y={182} width={118} height={8} rx={4} fill="#FFFDF5" />
    </svg>
  )
}
```

- [ ] **Step 4: Run all tests**

```bash
cd frontend && npx vitest run components/today/VisualTimer.test.tsx
```

Expected: all 14 tests pass.

- [ ] **Step 5: Typecheck**

```bash
cd frontend && npx tsc --noEmit 2>&1 | grep VisualTimer
```

Expected: no output.

- [ ] **Step 6: Commit**

```bash
cd frontend && git add components/today/VisualTimer.tsx components/today/VisualTimer.test.tsx
git commit -m "feat(timer): rebuild VisualTimer — Clessidra liquida layout, controls, accessibility"
```

---

## Task 6: Verify full test suite

- [ ] **Step 1: Run the full test suite**

```bash
cd frontend && npx vitest run
```

Expected: all tests pass. If any existing test breaks, fix it before proceeding.

Common issue: if any file imports the old `Hourglass` interface shape `{ progress, running }`, update to `{ elapsed, running, finished, reducedMotion }`.

- [ ] **Step 2: Typecheck the whole project**

```bash
cd frontend && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit if any fixes were needed**

```bash
cd frontend && git add -p && git commit -m "fix(timer): update callers after VisualTimer interface change"
```

---

## Self-Review Checklist (run before submitting)

Verify each spec requirement has a task:

| Spec requirement | Task |
|---|---|
| Left: Hourglass 130×196 | Task 4 |
| Right: time 30px/700/tabular | Task 5 |
| Right: status line text states | Task 5 |
| Top-right: DS.01 IconButton close | Task 5 |
| Duration SegmentedControl, solid-active | Task 1, 5 |
| Primary pill: Avvia/Pausa/Riprendi | Task 5 |
| Secondary glass pill: Ricomincia | Task 5 |
| Old bordered chips removed | Task 2 (CSS) |
| SVG exact geometry + clip paths | Task 4 |
| Sand color var(--glow-3) | Task 4 |
| Stream 3×88 rect, opacity gated | Task 4 |
| 1s interval (not 250ms) | Task 5 |
| CSS transitions y 1s linear | Task 4 |
| Minutes-only display, ceil, never "0 minuti" | Task 5 |
| showSeconds localStorage | Task 5 |
| Reduced motion: snap to minute, no transition | Task 5 |
| Finished: empty top / full bottom | Task 4, 5 |
| Finished: stream hidden | Task 4 |
| Halo: 2.4s, 2 pulses, forwards | Task 2 (CSS), Task 5 |
| Finished bar: "Tempo finito." message | Task 5 |
| Finished bar: "Altri 5 minuti" pill | Task 5 |
| Finished bar: "Chiudi" resets + closes | Task 5 |
| SVG aria-hidden | Task 4 |
| aria-live: 5-min + finish only | Task 5 |
| role="switch" for showSeconds | Task 5 |
| role="status" for finished bar | Task 5 |
| SegmentedControl disabled while running | Task 1, 5 |
| OPEN_PANEL_EVENT listener | Task 3 |
| TodayToolsRow hides generic close for timer | Task 3 |
| Panel surface: DS.01 glass (no change needed — tray already glass) | — |
