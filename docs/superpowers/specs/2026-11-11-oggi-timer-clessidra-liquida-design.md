# Oggi – Timer visivo: Clessidra liquida

**Source:** Claude Design board "05j.3 Oggi - Timer visivo calmo", variant B "Clessidra liquida"  
**Goal:** A glanceable, non-distracting timer designed for adults with ADHD. Sand fills slowly and linearly; no warnings, no pulses, no color changes.

---

## Scope

Replace the visual appearance and animation of the timer panel only. Timer logic (`timer.ts`, `timer-store.ts`) is untouched. The focus card, other tool panels, and notification permissions are untouched.

**Files changed:**
1. `frontend/components/today/VisualTimer.tsx` — full JSX redesign + new `Hourglass` component
2. `frontend/components/today/TodayToolsRow.tsx` — close button, OPEN_PANEL_EVENT listener
3. `frontend/design-system/SegmentedControl.tsx` + `SegmentedControl.module.css` — `solid-active` variant
4. `frontend/app/globals.css` — replace `.today-timer*` block; add halo keyframe

---

## Panel layout

The timer lives inside the glass tray opened by the "Timer visivo" tool button (or by "Inizia 25 minuti" on the focus card).

**Panel surface:** `todayb-tools-tray` glass (DS.01, no border). No new container element.

```
┌──────────────────────────────────────────────┐  ← glass tray
│  [hourglass 130×196]  [time]          [✕]   │
│                       [status line]          │
│                       [segmented control]    │
│                       [Avvia] [Ricomincia]   │
└──────────────────────────────────────────────┘
```

- **Left column:** `Hourglass` SVG, 130×196 px, `aria-hidden`.
- **Right column:** stacked, `gap: 8px`.
  - Remaining time: 30px, weight 700, `font-variant-numeric: tabular-nums`.
  - Status line: 13px, weight 600, 85% opacity.
  - Duration `SegmentedControl` (DS.01, `variant="solid-active"`).
  - Control row: primary pill + secondary glass pill.
- **Top-right:** `IconButton` (DS.01), `aria-label="Chiudi il timer"` — rendered by `VisualTimer`, receives `onClose` prop from `TodayToolsRow`.

TodayToolsRow changes:
- Passes `onClose={() => setActivePanel(null)}` to `VisualTimer`.
- Hides its own generic close button when `activePanel === 'timer'`.
- Adds a `window.addEventListener('today:open-panel', ...)` listener so "Inizia 25 minuti" correctly opens the tray.

---

## Status line text

| Timer state | Text |
|---|---|
| `idle` | `"pronto, <n> minuti"` |
| `running` | `"restano, su <n>"` |
| `paused` | `"in pausa, su <n>"` |
| `finished` | `"su <n> minuti"` |

`<n>` = `durationMs / 60_000` (integer, always the total).

---

## Controls

### Duration selector
`SegmentedControl` with options `[{ value: '10', label: '10 min' }, { value: '25', label: '25 min' }, { value: '45', label: '45 min' }]`.

Selected value = `String(timer.durationMs / 60_000)`. Changing duration calls `store.update(() => createTimer(m), null)`.

Disabled while running (`timer.status === 'running'`).

Active segment: `variant="solid-active"` → `background: #ffffff; color: var(--ink); font-weight: 700`.

### Primary pill
White pill, ink text, `min-width: 112px`, height 44px, `border-radius: 22px`.

| State | Label |
|---|---|
| `idle` | `"Avvia"` |
| `running` | `"Pausa"` |
| `paused` | `"Riprendi"` |
| `finished` | — (button hidden; replaced by finished-bar actions) |

### Secondary glass pill
Label `"Ricomincia"`. Glass background (white-alpha), white text, same sizing as primary. Visible only when `timer.status !== 'idle'`. Calls `store.update(resetTimer)`.

### Remove
Old bordered `.today-preset` chips, old `.today-btn--dark` "Avvia" button, low-contrast status text.

---

## Hourglass SVG

Inline SVG, `viewBox="0 0 130 196"`, `width={130}` `height={196}`, `aria-hidden`.

### Structure (top to bottom)
1. **Glass body path** (decorative fill, `rgba(255,255,255,0.14)`):
   ```
   M14 14h102c0 34-30 52-44 78v12c14 26 44 44 44 78H14c0-34 30-52 44-78V92C44 66 14 48 14 14z
   ```
2. **Top cap:** `<rect x=6 y=6 width=118 height=8 rx=4 fill="#FFFDF5" />`
3. **Bottom cap:** `<rect x=6 y=182 width=118 height=8 rx=4 fill="#FFFDF5" />`
4. **Clip paths** (in `<defs>`):
   - `#hg-clip-top`: `M14 14h102c0 34-30 52-44 78h-14C44 66 14 48 14 14z`
   - `#hg-clip-bottom`: `M58 104h14c14 26 44 44 44 78H14c0-34 30-52 44-78z`
5. **Top sand rect** (clipped to `#hg-clip-top`, fill `var(--glow-3)`):
   - `x=0 width=130`
   - `height = 78 * remaining` where `remaining = 1 - elapsed`
   - `y = 92 - height`
6. **Bottom sand rect** (clipped to `#hg-clip-bottom`, fill `var(--glow-3)`):
   - `x=0 width=130`
   - `height = 78 * elapsed`
   - `y = 182 - height`
7. **Stream rect:** `x=63.5 y=92 width=3 height=88 rx=1.5`, fill `var(--glow-3)`, opacity 0.85 when `running && !finished`, else 0.

Clip path IDs are made unique per instance with React's `useId()` to avoid SVG ID collisions.

---

## Motion

### Sand animation (normal motion)
Both sand rects receive inline `style={{ transition: 'y 1s linear, height 1s linear' }}`.

The component's `sandProgress` state (0..1) updates **once per second** via a 1s interval. This creates a visually continuous flow: each second the sand jumps exactly one second's worth, hidden by the 1s linear transition.

```
elapsed   = sandProgress          // 0..1
remaining = 1 - elapsed
topH      = 78 * remaining        // px
topY      = 92 - topH
bottomH   = 78 * elapsed          // px  (clamped to [0, 78])
bottomY   = 182 - bottomH
```

### Finish detection
`tickTimer` is called in the same 1s interval as the sand update. This is sufficient — `endsAt` precision is ms; a 1s poll means finish is detected within 1 second of the actual end.

### Time display
- **Default (no seconds):** format = `"<n> minuti"` / `"1 minuto"`. Ceiling division: `Math.ceil(leftMs / 60_000)`. Shown value never drops to `"0 minuti"` while time remains.
- **With seconds (`showSeconds=true`):** format = `"MM:SS"` using existing `formatRemaining(leftMs)`.
- Both update with the **1s interval** regardless of `showSeconds`. In minutes mode the text visually changes only when the ceiling-minute value decreases, which happens approximately once per minute — but the underlying interval stays at 1s so finish is detected within 1 second in all modes.

### Reduced motion
When `window.matchMedia('(prefers-reduced-motion: reduce)').matches` OR `document.documentElement.dataset.reduceMotion` is set:
- Sand rect `style` omits the `transition` property.
- Sand updates once per minute (interval = 60_000 ms).
- Halo animation is skipped.

### Preference: "Mostra i secondi"
- A `<button role="switch">` below the controls (or toggle link).
- State stored in `localStorage` key `today.timer.showSeconds`.
- Default: `false`.

---

## Finished state

When `timer.status === 'finished'`:
- Top sand rect: `height=0, y=92` (empty top).
- Bottom sand rect: `height=78, y=104` (full bottom).
- Stream: `opacity=0`.
- Primary pill hidden; secondary pill hidden; duration selector disabled.
- Time display replaced with `"Tempo finito"` (same 30px/700 slot).
- **Halo:** apply CSS animation `today-timer-halo 2.4s ease-in-out forwards` to the hourglass wrapper. Skip under reduced motion.

```css
@keyframes today-timer-halo {
  0%   { box-shadow: none; }
  25%  { box-shadow: 0 0 0 14px rgba(255,255,255,0.22); }
  50%  { box-shadow: none; }
  75%  { box-shadow: 0 0 0 14px rgba(255,255,255,0.22); }
  100% { box-shadow: none; }
}
```

- **Finished bar** (`role="status"`, below the main layout):
  ```
  Tempo finito. Fermati un attimo: com'è andata?
  [Altri 5 minuti]  [Chiudi]
  ```
  - "Altri 5 minuti" (white pill): `store.startFor(5, store.label)`.
  - "Chiudi" (glass pill): `store.update(resetTimer)` then `onClose()`.

---

## Accessibility

| Concern | Implementation |
|---|---|
| SVG decorative | `aria-hidden="true"` on `<svg>` |
| Time readout | `<span aria-live="polite" aria-atomic="true">` around time text; value changes only at 5-min boundaries and at finish |
| Duration selector | `SegmentedControl` already `role="radiogroup"` / `role="radio"` |
| "Mostra i secondi" | `<button role="switch" aria-checked={showSeconds}>` |
| Finished bar | `role="status"` |
| All interactive controls | `min-height: 44px`, visible focus rings |

The aria-live element holds a separate `announceText` string (not shown visually). It updates at: start, 5-min boundaries, finish. NOT every second or every minute.

---

## CSS summary (globals.css `.today-timer*` block)

Replace entire block. New classes:

| Class | Purpose |
|---|---|
| `.today-timer` | flex row, `align-items: flex-start`, `gap: 20px` |
| `.today-timer-right` | flex column, `gap: 8px`, `flex: 1`, `padding-top: 4px` |
| `.today-timer-time` | `font-size: 30px; font-weight: 700; font-variant-numeric: tabular-nums; color: var(--text-primary)` |
| `.today-timer-status` | `font-size: 13px; font-weight: 600; opacity: 0.85; color: var(--text-primary)` |
| `.today-timer-pill` | white pill: `background: #fff; color: var(--ink); border: none; border-radius: 22px; min-width: 112px; height: 44px; font-weight: 700; cursor: pointer` |
| `.today-timer-pill--glass` | glass pill: glass gradient, white text, same sizing |
| `.today-timer-controls-row` | `display: flex; gap: 8px; flex-wrap: wrap; align-items: center` |
| `.today-timer-finished-bar` | `display: flex; flex-direction: column; gap: 10px; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.12)` |
| `.today-timer-halo` | animation anchor on hourglass wrapper div |

Existing `.today-sand`, `.today-sand-stream`, `.today-hourglass*`, `.today-preset` classes are removed.

---

## TODOs (outside this task)

- `today.timer.showSeconds` is currently session-only (page refresh resets). Already using `localStorage`; works across sessions.
- If `--glow-3` ever uses a very dark value (custom palette), the sand on glass may have low contrast. Future: consider a minimum luminance fallback.
