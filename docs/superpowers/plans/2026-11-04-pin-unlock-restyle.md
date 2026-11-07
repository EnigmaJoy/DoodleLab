# PIN Unlock Screen Restyle — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the text-field unlock screen with a numeric keypad + glass card UI matching board "00b Sblocco con PIN", without touching any vault/crypto logic.

**Architecture:** `app/unlock/page.tsx` is fully rewritten as a single file containing three sub-components (`PinCells`, `Keypad`, `RecoveryModal`) plus the page default export. All styles live in a companion CSS module `page.module.css`. Palette tokens that don't yet exist in `globals.css` are injected as inline CSS custom properties on the page root element, mapping to the existing `--gradient-start` / `--gradient-end` vars — no changes to any other file except adding the Figtree font to `layout.tsx`.

**Tech Stack:** Next.js 15 (App Router), React 19, TypeScript, CSS Modules, Vitest, @testing-library/react

---

## File map

| File | Status | Responsibility |
|------|--------|----------------|
| `app/unlock/page.tsx` | Rewrite | All UI: PinCells, Keypad, RecoveryModal, UnlockPage |
| `app/unlock/page.module.css` | Create | Keyframes, layout, glass card, PIN cells, keypad, modal |
| `app/unlock/page.test.tsx` | Rewrite | 13 behavioral tests (see spec §8) |
| `app/layout.tsx` | Modify | Add Figtree font variable |
| `app/globals.css` | **Untouched** | — |
| `lib/vault/vault-context.tsx` | **Untouched** | — |
| `lib/vault/vault-service.ts` | **Untouched** | — |

---

## Task 1: Add Figtree font to layout.tsx

Sacramento is already loaded as `--font-welcome`. Figtree (body text for the unlock screen) is not.

**Files:**
- Modify: `app/layout.tsx`

- [ ] **Step 1: Add Figtree import and variable**

In `app/layout.tsx`, add alongside the existing font imports:

```tsx
// Existing imports stay as-is:
import { Caveat, Sacramento, Kalam } from 'next/font/google'

// Add Figtree:
import { Caveat, Sacramento, Kalam, Figtree } from 'next/font/google'

// Add after the caveat const:
const figtree = Figtree({
  subsets:  ['latin'],
  weight:   ['400', '500', '600', '700'],
  variable: '--font-figtree',
  display:  'swap',
})
```

Then add `${figtree.variable}` to the `className` on `<html>`:

```tsx
<html lang="it" data-palette={paletteId} className={`${sacramento.variable} ${kalam.variable} ${caveat.variable} ${figtree.variable}`}>
```

- [ ] **Step 2: Verify build compiles**

```bash
cd prototypes/ui-shell && pnpm build 2>&1 | tail -5
```

Expected: no TypeScript or Next.js errors about the new font import.

- [ ] **Step 3: Commit**

```bash
git add app/layout.tsx
git commit -m "feat(unlock): add Figtree font variable for unlock screen restyle"
```

---

## Task 2: Create CSS module skeleton

Create `page.module.css` with all keyframes, layout classes, and component styles. This is the full CSS — write it all in one pass so later tasks can import and use classes immediately.

**Files:**
- Create: `app/unlock/page.module.css`

- [ ] **Step 1: Create the file**

Create `app/unlock/page.module.css` with the following content:

```css
/* app/unlock/page.module.css */

/* TODO: glass surface styles (background, backdrop-filter, box-shadow) are
   candidates for a shared CSS module once sign-in, unlock, and radial menu
   are all on the new design. */

/* ── Keyframes ──────────────────────────────────────────────────────────── */

@keyframes drift-1 {
  from { transform: translate(0, 0); }
  to   { transform: translate(20px, 15px); }
}

@keyframes drift-2 {
  from { transform: translate(0, 0); }
  to   { transform: translate(-25px, 20px); }
}

@keyframes drift-3 {
  from { transform: translate(0, 0); }
  to   { transform: translate(15px, -20px); }
}

@keyframes shake {
  0%   { transform: translateX(0); }
  15%  { transform: translateX(-8px); }
  35%  { transform: translateX(7px); }
  55%  { transform: translateX(-5px); }
  75%  { transform: translateX(3px); }
  100% { transform: translateX(0); }
}

@media (prefers-reduced-motion: reduce) {
  .glow  { animation: none !important; }
  .pinRow { animation: none !important; }
}

/* ── Root ───────────────────────────────────────────────────────────────── */

.root {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 20px;
  padding: 2rem;
  background: linear-gradient(135deg, var(--bg-from), var(--bg-to));
  color: #ffffff;
  font-family: var(--font-figtree, system-ui, sans-serif);
  position: relative;
  overflow: hidden;
}

/* ── Decorative glows ───────────────────────────────────────────────────── */

.glow {
  position: absolute;
  border-radius: 50%;
  pointer-events: none;
  filter: blur(14px);
}

.glow1 {
  width: 340px;
  height: 340px;
  top: 200px;
  left: 280px;
  background: radial-gradient(circle, var(--glow-1), transparent 70%);
  opacity: 0.7;
  animation: drift-1 12s ease-in-out infinite alternate;
}

.glow2 {
  width: 360px;
  height: 360px;
  top: 380px;
  left: 560px;
  background: radial-gradient(circle, var(--glow-2), transparent 70%);
  opacity: 0.65;
  animation: drift-2 12s ease-in-out infinite alternate;
}

.glow3 {
  width: 200px;
  height: 200px;
  top: 160px;
  left: 470px;
  background: radial-gradient(circle, var(--glow-3), transparent 70%);
  opacity: 0.5;
  animation: drift-3 12s ease-in-out infinite alternate;
}

/* ── h1 Bentornata ──────────────────────────────────────────────────────── */

.heading {
  font-family: var(--font-welcome);
  font-size: 64px;
  font-weight: 400;
  color: #ffffff;
  line-height: 1.1;
  text-align: center;
  position: relative;
  z-index: 1;
  margin: 0;
}

/* ── Glass card ─────────────────────────────────────────────────────────── */

.card {
  position: relative;
  z-index: 1;
  width: 400px;
  max-width: 92vw;
  padding: 26px 28px 18px;
  border-radius: 28px;
  display: flex;
  flex-direction: column;
  gap: 18px;
  background: linear-gradient(135deg, rgba(255,255,255,0.24), rgba(255,255,255,0.08));
  -webkit-backdrop-filter: blur(28px) saturate(170%);
  backdrop-filter: blur(28px) saturate(170%);
  box-shadow:
    inset 0 0 22px rgba(255,255,255,0.18),
    inset 0 10px 18px -12px rgba(255,255,255,0.6),
    0 24px 60px rgba(20,8,40,0.32);
}

@supports not (backdrop-filter: blur(1px)) {
  .card {
    background: rgba(255,255,255,0.18);
  }
}

/* ── Heading block ──────────────────────────────────────────────────────── */

.cardHeading {
  text-align: center;
}

.cardTitle {
  font-size: 20px;
  font-weight: 700;
  color: #ffffff;
  margin: 0 0 4px;
}

.cardSubtitle {
  font-size: 14px;
  color: rgba(255,255,255,0.88);
  margin: 0;
}

/* ── PIN row ────────────────────────────────────────────────────────────── */

.pinRow {
  display: flex;
  justify-content: center;
  gap: 8px;
  animation: shake 420ms ease-out;
}

.pinCell {
  width: 40px;
  height: 48px;
  border-radius: 12px;
  background: rgba(255,255,255,0.10);
  box-shadow: inset 0 0 0 1px rgba(255,255,255,0.22);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.pinCellFilled {
  background: rgba(255,255,255,0.26);
  box-shadow: none;
}

.pinCellActive {
  box-shadow: inset 0 0 0 2px rgba(255,255,255,0.9);
}

.pinDot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #ffffff;
}

/* ── Error line ─────────────────────────────────────────────────────────── */

.error {
  text-align: center;
  font-size: 14px;
  font-weight: 600;
  color: #ffffff;
  margin: 0;
}

/* ── Keypad ─────────────────────────────────────────────────────────────── */

.keypad {
  display: grid;
  grid-template-columns: repeat(3, 72px);
  gap: 12px;
  justify-content: center;
}

.keyDigit {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  border: none;
  background: linear-gradient(135deg, rgba(255,255,255,0.24), rgba(255,255,255,0.08));
  -webkit-backdrop-filter: blur(28px) saturate(170%);
  backdrop-filter: blur(28px) saturate(170%);
  box-shadow:
    inset 0 0 22px rgba(255,255,255,0.18),
    inset 0 10px 18px -12px rgba(255,255,255,0.6),
    0 24px 60px rgba(20,8,40,0.32);
  color: #ffffff;
  font-size: 26px;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: opacity 150ms ease;
}

.keyDigit:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.keyDigit:focus-visible {
  outline: 2px solid #ffffff;
  outline-offset: 2px;
}

.keyDel {
  width: 72px;
  height: 72px;
  background: transparent;
  border: none;
  color: #ffffff;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  transition: opacity 150ms ease;
}

.keyDel:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.keyDel:focus-visible {
  outline: 2px solid #ffffff;
  outline-offset: 2px;
}

/* ── Ghost action ───────────────────────────────────────────────────────── */

.ghostBtn {
  background: none;
  border: none;
  color: #ffffff;
  font-size: 14px;
  text-decoration: underline;
  text-underline-offset: 3px;
  cursor: pointer;
  min-height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  align-self: center;
  padding: 0;
}

.ghostBtn:focus-visible {
  outline: 2px solid #ffffff;
  outline-offset: 2px;
}

/* ── Modal overlay ──────────────────────────────────────────────────────── */

.overlay {
  position: fixed;
  inset: 0;
  background: rgba(20,8,30,0.4);
  -webkit-backdrop-filter: blur(6px);
  backdrop-filter: blur(6px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

/* ── Modal surface ──────────────────────────────────────────────────────── */

.modal {
  width: 440px;
  max-width: 92vw;
  padding: 22px 24px;
  border-radius: 26px;
  color: #ffffff;
  background: linear-gradient(
    135deg,
    color-mix(in srgb, var(--bg-from) 93%, transparent),
    color-mix(in srgb, var(--bg-to)   93%, transparent)
  );
  box-shadow:
    inset 0 0 22px rgba(255,255,255,0.18),
    0 28px 70px rgba(20,8,40,0.45);
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* ── Modal header ───────────────────────────────────────────────────────── */

.modalHeader {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.modalTitle {
  font-size: 18px;
  font-weight: 700;
  margin: 0;
}

.closeBtn {
  flex-shrink: 0;
  width: 44px;
  height: 44px;
  background: none;
  border: none;
  color: #ffffff;
  font-size: 18px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
}

.closeBtn:focus-visible {
  outline: 2px solid #ffffff;
  outline-offset: 2px;
}

/* ── Modal body ─────────────────────────────────────────────────────────── */

.modalBody {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.modalExplain {
  font-size: 14px;
  line-height: 1.5;
  color: rgba(255,255,255,0.88);
  margin: 0;
}

/* ── Recovery CTA (step 1) ──────────────────────────────────────────────── */

.recoveryCta {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}

.recoveryPrimaryBtn {
  width: 100%;
  min-height: 52px;
  border-radius: 14px;
  border: none;
  background: #ffffff;
  color: var(--ink);
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 150ms ease;
}

.recoveryPrimaryBtn:focus-visible {
  outline: 2px solid #ffffff;
  outline-offset: 2px;
}

.recoveryHint {
  font-size: 13px;
  color: rgba(255,255,255,0.82);
  text-align: center;
  margin: 0;
}

/* ── Recovery code entry (step 2) ───────────────────────────────────────── */

.recoveryLabel {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 14px;
  font-weight: 600;
  color: #ffffff;
}

.recoveryTextarea {
  width: 100%;
  min-height: 80px;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid rgba(255,255,255,0.3);
  background: rgba(255,255,255,0.12);
  color: #ffffff;
  font-family: ui-monospace, 'Courier New', monospace;
  font-variant-numeric: tabular-nums;
  font-size: 13px;
  resize: none;
  box-sizing: border-box;
}

.recoveryTextarea:focus {
  outline: 2px solid #ffffff;
  outline-offset: 2px;
  border-color: transparent;
}

.recoveryCounter {
  font-size: 13px;
  color: rgba(255,255,255,0.6);
  text-align: right;
  margin: 0;
}

.recoveryFieldError {
  font-size: 13px;
  color: rgba(255,255,255,0.9);
  margin: 0;
}

/* ── Recovery actions ───────────────────────────────────────────────────── */

.recoveryActions {
  display: flex;
  gap: 10px;
}

.recoverySubmitBtn {
  flex: 1;
  min-height: 48px;
  border-radius: 12px;
  border: none;
  background: #ffffff;
  color: var(--ink);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 150ms ease;
}

.recoverySubmitBtn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.recoverySubmitBtn:focus-visible {
  outline: 2px solid #ffffff;
  outline-offset: 2px;
}

.recoveryBackBtn {
  min-height: 48px;
  padding: 0 16px;
  border-radius: 12px;
  border: 1px solid rgba(255,255,255,0.35);
  background: rgba(255,255,255,0.12);
  color: #ffffff;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: opacity 150ms ease;
}

.recoveryBackBtn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.recoveryBackBtn:focus-visible {
  outline: 2px solid #ffffff;
  outline-offset: 2px;
}
```

- [ ] **Step 2: Commit**

```bash
git add app/unlock/page.module.css
git commit -m "feat(unlock): add CSS module with keyframes, glass card, keypad, modal styles"
```

---

## Task 3: Write failing tests for PinCells and Keypad

Replace the old test file with the new structure. Write all 13 tests up front (they all fail — the page hasn't been rewritten yet). This gives a clear red baseline.

**Files:**
- Rewrite: `app/unlock/page.test.tsx`

- [ ] **Step 1: Replace the test file**

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'

// ── Mocks ─────────────────────────────────────────────────────────────────

const mockReplace = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
}))

const mockUnlock  = vi.fn()
const mockRecover = vi.fn()
vi.mock('@/lib/vault/vault-context', () => ({
  useVaultContext: () => ({ unlock: mockUnlock, recover: mockRecover }),
}))

import UnlockPage from './page'

// ── Helpers ───────────────────────────────────────────────────────────────

function setup() {
  render(<UnlockPage />)
}

/** Click keypad buttons for each digit in the string. */
function tapDigits(digits: string) {
  for (const d of digits) {
    fireEvent.click(screen.getByRole('button', { name: `Cifra ${d}` }))
  }
}

/** Fire keydown events on document for each character. */
function pressKeys(keys: string) {
  for (const k of keys) {
    fireEvent.keyDown(document, { key: k })
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ── Tests ─────────────────────────────────────────────────────────────────

describe('UnlockPage', () => {

  it('1. renders 6 PIN cells and keypad; no text input, no eye toggle', () => {
    setup()
    expect(screen.getByRole('img', { name: /PIN, 0 cifre su 6 inserite/ })).toBeTruthy()
    for (const d of ['0','1','2','3','4','5','6','7','8','9']) {
      expect(screen.getByRole('button', { name: `Cifra ${d}` })).toBeTruthy()
    }
    expect(screen.getByRole('button', { name: 'Cancella una cifra' })).toBeTruthy()
    expect(screen.queryByRole('textbox')).toBeNull()
    // No eye-toggle: no button with aria-label containing "PIN" (other than the cells group)
    expect(screen.queryByRole('button', { name: /mostra|nascondi/i })).toBeNull()
  })

  it('2. keypad digit click fills a cell', () => {
    setup()
    tapDigits('5')
    expect(screen.getByRole('img', { name: /PIN, 1 cifre su 6 inserite/ })).toBeTruthy()
  })

  it('3. physical keyboard digit fills a cell', () => {
    setup()
    pressKeys('3')
    expect(screen.getByRole('img', { name: /PIN, 1 cifre su 6 inserite/ })).toBeTruthy()
  })

  it('4. Cancella button and Backspace key remove the last digit', () => {
    setup()
    tapDigits('123')
    expect(screen.getByRole('img', { name: /PIN, 3 cifre su 6 inserite/ })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Cancella una cifra' }))
    expect(screen.getByRole('img', { name: /PIN, 2 cifre su 6 inserite/ })).toBeTruthy()

    fireEvent.keyDown(document, { key: 'Backspace' })
    expect(screen.getByRole('img', { name: /PIN, 1 cifre su 6 inserite/ })).toBeTruthy()
  })

  it('5. 6th digit auto-calls unlock(pin) with the correct string', async () => {
    mockUnlock.mockResolvedValue(false)
    setup()
    await act(async () => { tapDigits('123456') })
    expect(mockUnlock).toHaveBeenCalledOnce()
    expect(mockUnlock).toHaveBeenCalledWith('123456')
  })

  it('6. failed unlock: cells cleared, error shown, shakeKey incremented on each attempt', async () => {
    mockUnlock.mockResolvedValue(false)
    setup()

    await act(async () => { tapDigits('000000') })
    expect(screen.getByRole('img', { name: /PIN, 0 cifre su 6 inserite/ })).toBeTruthy()
    expect(screen.getByTestId('pin-error').textContent).toBe(
      'PIN non corretto. Riprova con calma.'
    )

    // Second attempt also fires unlock and shows error
    await act(async () => { tapDigits('111111') })
    expect(mockUnlock).toHaveBeenCalledTimes(2)
    expect(screen.getByTestId('pin-error')).toBeTruthy()
  })

  it('7. success: subtitle switches to Fatto, then routes to /?view=menu', async () => {
    mockUnlock.mockResolvedValue(true)
    setup()
    await act(async () => { tapDigits('123456') })
    expect(screen.getByText('Fatto, sto aprendo le tue note...')).toBeTruthy()
    expect(mockReplace).toHaveBeenCalledWith('/?view=menu')
  })

  it('8. typing any digit after an error hides the error line', async () => {
    mockUnlock.mockResolvedValue(false)
    setup()
    await act(async () => { tapDigits('000000') })
    expect(screen.getByTestId('pin-error')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Cifra 1' }))
    expect(screen.queryByTestId('pin-error')).toBeNull()
  })

  it('9. modal opens on ghost button; closes on close button, overlay click, and Escape', () => {
    setup()
    fireEvent.click(screen.getByTestId('forgot-pin-btn'))
    expect(screen.getByRole('dialog')).toBeTruthy()

    // Close via close button
    fireEvent.click(screen.getByRole('button', { name: 'Chiudi' }))
    expect(screen.queryByRole('dialog')).toBeNull()

    // Close via overlay click
    fireEvent.click(screen.getByTestId('forgot-pin-btn'))
    fireEvent.click(screen.getByTestId('modal-overlay'))
    expect(screen.queryByRole('dialog')).toBeNull()

    // Close via Escape
    fireEvent.click(screen.getByTestId('forgot-pin-btn'))
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('10. step 1 → step 2 on primary button; Indietro returns to step 1 keeping typed value', () => {
    setup()
    fireEvent.click(screen.getByTestId('forgot-pin-btn'))

    // Step 1: code input is not visible
    expect(screen.queryByTestId('recovery-code-input')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Usa la chiave di recupero' }))

    // Step 2: code input is visible
    const textarea = screen.getByTestId('recovery-code-input') as HTMLTextAreaElement
    expect(textarea).toBeTruthy()
    fireEvent.change(textarea, { target: { value: 'abc123' } })

    // Indietro → back to step 1
    fireEvent.click(screen.getByTestId('indietro-btn'))
    expect(screen.queryByTestId('recovery-code-input')).toBeNull()

    // Re-enter step 2: value is preserved
    fireEvent.click(screen.getByRole('button', { name: 'Usa la chiave di recupero' }))
    expect((screen.getByTestId('recovery-code-input') as HTMLTextAreaElement).value).toBe('abc123')
  })

  it('11. format error for non-hex; Recupera disabled until exactly 64 valid hex chars', () => {
    setup()
    fireEvent.click(screen.getByTestId('forgot-pin-btn'))
    fireEvent.click(screen.getByRole('button', { name: 'Usa la chiave di recupero' }))

    // Non-hex input → format error, button disabled
    fireEvent.change(screen.getByTestId('recovery-code-input'), { target: { value: 'xyz' } })
    expect(screen.getByTestId('format-error')).toBeTruthy()
    expect(screen.getByTestId('recupera-btn')).toBeDisabled()

    // 63 valid hex chars → still disabled (too short)
    fireEvent.change(screen.getByTestId('recovery-code-input'), { target: { value: 'a'.repeat(63) } })
    expect(screen.queryByTestId('format-error')).toBeNull()
    expect(screen.getByTestId('recupera-btn')).toBeDisabled()

    // 64 valid hex chars → enabled, no format error
    fireEvent.change(screen.getByTestId('recovery-code-input'), { target: { value: 'a'.repeat(64) } })
    expect(screen.queryByTestId('format-error')).toBeNull()
    expect(screen.getByTestId('recupera-btn')).not.toBeDisabled()
  })

  it('12. recover() success routes to /?view=menu', async () => {
    mockRecover.mockResolvedValue(true)
    setup()
    fireEvent.click(screen.getByTestId('forgot-pin-btn'))
    fireEvent.click(screen.getByRole('button', { name: 'Usa la chiave di recupero' }))

    const validCode = 'ab'.repeat(32) // 64 hex chars
    fireEvent.change(screen.getByTestId('recovery-code-input'), { target: { value: validCode } })
    await act(async () => { fireEvent.click(screen.getByTestId('recupera-btn')) })

    expect(mockRecover).toHaveBeenCalledWith(validCode)
    expect(mockReplace).toHaveBeenCalledWith('/?view=menu')
  })

  it('13. recover() failure shows error message; input kept; focus returns to textarea', async () => {
    mockRecover.mockResolvedValue(false)
    setup()
    fireEvent.click(screen.getByTestId('forgot-pin-btn'))
    fireEvent.click(screen.getByRole('button', { name: 'Usa la chiave di recupero' }))

    const validCode = 'cd'.repeat(32) // 64 hex chars
    fireEvent.change(screen.getByTestId('recovery-code-input'), { target: { value: validCode } })
    await act(async () => { fireEvent.click(screen.getByTestId('recupera-btn')) })

    expect(screen.getByTestId('submit-error').textContent).toBe(
      'Questa chiave non corrisponde. Controlla di aver copiato tutto il codice.'
    )
    // Input keeps the typed code after failure (user can inspect/correct)
    expect((screen.getByTestId('recovery-code-input') as HTMLTextAreaElement).value).toBe(validCode)
    expect(mockReplace).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run tests — expect all to fail**

```bash
cd prototypes/ui-shell && pnpm test app/unlock/page.test.tsx 2>&1 | tail -20
```

Expected: 13 failing tests. The old component still exports from `page.tsx`.

- [ ] **Step 3: Commit the failing tests**

```bash
git add app/unlock/page.test.tsx
git commit -m "test(unlock): write 13 failing tests for new PIN keypad UI"
```

---

## Task 4: Rewrite page.tsx — PinCells and Keypad

Rewrite `app/unlock/page.tsx` with the full new component. Write it in one pass: sub-components first, then the page default export.

**Files:**
- Rewrite: `app/unlock/page.tsx`

- [ ] **Step 1: Write the full component**

Replace the entire contents of `app/unlock/page.tsx`:

```tsx
'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useVaultContext } from '@/lib/vault/vault-context'
import styles from './page.module.css'

// ── PinCells ──────────────────────────────────────────────────────────────
// Rendered with key={shakeKey} so incrementing shakeKey re-mounts this
// component and restarts the CSS shake animation on every failed attempt.

interface PinCellsProps {
  digits: string[]
}

function PinCells({ digits }: PinCellsProps) {
  return (
    <div
      role="img"
      aria-label={`PIN, ${digits.length} cifre su 6 inserite`}
      className={styles.pinRow}
    >
      {Array.from({ length: 6 }, (_, i) => {
        const filled = i < digits.length
        const active = !filled && i === digits.length
        return (
          <div
            key={i}
            className={[
              styles.pinCell,
              filled ? styles.pinCellFilled : '',
              active ? styles.pinCellActive : '',
            ].filter(Boolean).join(' ')}
          >
            {filled && <div className={styles.pinDot} />}
          </div>
        )
      })}
    </div>
  )
}

// ── Keypad ────────────────────────────────────────────────────────────────

type KeypadKey = string | null

const KEYPAD_ROWS: KeypadKey[][] = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  [null, '0', 'del'],
]

interface KeypadProps {
  onDigit: (d: string) => void
  onDelete: () => void
  disabled: boolean
}

function Keypad({ onDigit, onDelete, disabled }: KeypadProps) {
  return (
    <div className={styles.keypad}>
      {KEYPAD_ROWS.flat().map((key, idx) => {
        if (key === null) {
          return <div key={idx} aria-hidden="true" />
        }
        if (key === 'del') {
          return (
            <button
              key="del"
              type="button"
              className={styles.keyDel}
              onClick={onDelete}
              disabled={disabled}
              aria-label="Cancella una cifra"
            >
              Cancella
            </button>
          )
        }
        return (
          <button
            key={key}
            type="button"
            className={styles.keyDigit}
            onClick={() => onDigit(key)}
            disabled={disabled}
            aria-label={`Cifra ${key}`}
          >
            {key}
          </button>
        )
      })}
    </div>
  )
}

// ── RecoveryModal ─────────────────────────────────────────────────────────

type RecoveryStep = 'explain' | 'input'

interface RecoveryModalProps {
  onClose: () => void
  recover: (code: string) => Promise<boolean>
  onSuccess: () => void
}

function RecoveryModal({ onClose, recover, onSuccess }: RecoveryModalProps) {
  const [step,        setStep]        = useState<RecoveryStep>('explain')
  const [code,        setCode]        = useState('')
  const [formatError, setFormatError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [recovering,  setRecovering]  = useState(false)

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const closeBtnRef = useRef<HTMLButtonElement>(null)

  const isValidHex = /^[0-9a-f]{64}$/.test(code)

  // Focus the close button on open
  useEffect(() => {
    closeBtnRef.current?.focus()
  }, [])

  // Focus textarea when entering step 2
  useEffect(() => {
    if (step === 'input') {
      textareaRef.current?.focus()
    }
  }, [step])

  // Escape closes the modal
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  function handleCodeInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const raw = e.target.value.replace(/[\s\n]/g, '').toLowerCase()
    setCode(raw)
    setSubmitError(null)
    if (raw.length > 0 && /[^0-9a-f]/.test(raw)) {
      setFormatError(
        'La chiave contiene caratteri non validi: usa solo cifre e lettere da a a f.'
      )
    } else {
      setFormatError(null)
    }
  }

  async function handleRecover() {
    if (!isValidHex || recovering) return
    setRecovering(true)
    setSubmitError(null)
    const snapshot = code
    const ok = await recover(snapshot)
    if (ok) {
      onSuccess()
    } else {
      setRecovering(false)
      setSubmitError(
        'Questa chiave non corrisponde. Controlla di aver copiato tutto il codice.'
      )
      textareaRef.current?.focus()
    }
  }

  return (
    <div
      className={styles.overlay}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      data-testid="modal-overlay"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="recovery-modal-title"
        className={styles.modal}
      >
        <div className={styles.modalHeader}>
          <h2 id="recovery-modal-title" className={styles.modalTitle}>
            Hai dimenticato il PIN?
          </h2>
          <button
            ref={closeBtnRef}
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="Chiudi"
          >
            ✕
          </button>
        </div>

        {step === 'explain' && (
          <div className={styles.modalBody}>
            <p className={styles.modalExplain}>
              Le tue note sono protette con il PIN: senza di lui nemmeno Agenda può leggerle.
              Per questo non esiste un &ldquo;reimposta&rdquo; automatico.
            </p>
            <div className={styles.recoveryCta}>
              <button
                type="button"
                className={styles.recoveryPrimaryBtn}
                onClick={() => setStep('input')}
              >
                Usa la chiave di recupero
              </button>
              <p className={styles.recoveryHint}>
                È il codice che hai salvato durante la configurazione.
              </p>
            </div>
          </div>
        )}

        {step === 'input' && (
          <div className={styles.modalBody}>
            <label className={styles.recoveryLabel}>
              Chiave di recupero
              <textarea
                ref={textareaRef}
                className={styles.recoveryTextarea}
                value={code}
                onChange={handleCodeInput}
                disabled={recovering}
                spellCheck={false}
                autoComplete="off"
                data-testid="recovery-code-input"
              />
            </label>

            <p className={styles.recoveryCounter}>{code.length} di 64 caratteri</p>

            {formatError && (
              <p
                className={styles.recoveryFieldError}
                role="alert"
                data-testid="format-error"
              >
                {formatError}
              </p>
            )}

            {submitError && (
              <p
                className={styles.recoveryFieldError}
                role="alert"
                data-testid="submit-error"
              >
                {submitError}
              </p>
            )}

            <div className={styles.recoveryActions}>
              <button
                type="button"
                className={styles.recoverySubmitBtn}
                onClick={handleRecover}
                disabled={!isValidHex || recovering}
                data-testid="recupera-btn"
              >
                {recovering ? 'Sto verificando la chiave...' : 'Recupera'}
              </button>
              <button
                type="button"
                className={styles.recoveryBackBtn}
                onClick={() => { setStep('explain'); setSubmitError(null) }}
                disabled={recovering}
                data-testid="indietro-btn"
              >
                Indietro
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── UnlockPage ────────────────────────────────────────────────────────────

export default function UnlockPage() {
  const { unlock, recover } = useVaultContext()
  const router              = useRouter()

  const [digits,    setDigits]    = useState<string[]>([])
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState<string | null>(null)
  const [shakeKey,  setShakeKey]  = useState(0)
  const [showModal, setShowModal] = useState(false)
  const [success,   setSuccess]   = useState(false)

  const ghostRef = useRef<HTMLButtonElement>(null)

  // ── Auto-submit on 6th digit ─────────────────────────────────────────────
  // TODO: add attempt throttling if vaultService.unlock() ever adds it.
  useEffect(() => {
    if (digits.length !== 6) return
    const pin = digits.join('')
    setDigits([])
    setLoading(true)
    unlock(pin).then(ok => {
      if (ok) {
        setSuccess(true)
        router.replace('/?view=menu')
      } else {
        setError('PIN non corretto. Riprova con calma.')
        setShakeKey(k => k + 1)
        setLoading(false)
      }
    })
  }, [digits, unlock, router])

  // ── Physical keyboard ────────────────────────────────────────────────────
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (loading || showModal) return
      if (/^[0-9]$/.test(e.key) && digits.length < 6) {
        setError(null)
        setDigits(d => [...d, e.key])
      } else if (e.key === 'Backspace') {
        setDigits(d => d.slice(0, -1))
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [loading, showModal, digits.length])

  function handleDigit(d: string) {
    if (loading || digits.length >= 6) return
    setError(null)
    setDigits(prev => [...prev, d])
  }

  function handleDelete() {
    if (loading) return
    setDigits(prev => prev.slice(0, -1))
  }

  function handleModalClose() {
    setShowModal(false)
    ghostRef.current?.focus()
  }

  return (
    <div
      className={styles.root}
      style={{
        '--bg-from': 'var(--gradient-start, #581c87)',
        '--bg-to':   'var(--gradient-end, #be123c)',
        '--glow-1':  'var(--gradient-start, #581c87)',
        '--glow-2':  'var(--gradient-end, #be123c)',
        '--glow-3':  'color-mix(in srgb, var(--gradient-start) 60%, var(--gradient-end))',
        '--ink':     '#140820',
      } as React.CSSProperties}
    >
      {/* Decorative glows — behind the card, aria-hidden */}
      <div className={`${styles.glow} ${styles.glow1}`} aria-hidden="true" />
      <div className={`${styles.glow} ${styles.glow2}`} aria-hidden="true" />
      <div className={`${styles.glow} ${styles.glow3}`} aria-hidden="true" />

      <h1 className={styles.heading}>Bentornata</h1>

      <section className={styles.card} aria-label="Sblocca Agenda">
        <div className={styles.cardHeading}>
          <h2 className={styles.cardTitle}>Sblocca Agenda</h2>
          <p className={styles.cardSubtitle}>
            {success
              ? 'Fatto, sto aprendo le tue note...'
              : 'Inserisci il tuo PIN di 6 cifre.'}
          </p>
        </div>

        <PinCells key={shakeKey} digits={digits} />

        {error && (
          <p role="alert" className={styles.error} data-testid="pin-error">
            {error}
          </p>
        )}

        <Keypad onDigit={handleDigit} onDelete={handleDelete} disabled={loading} />

        <button
          ref={ghostRef}
          type="button"
          className={styles.ghostBtn}
          onClick={() => setShowModal(true)}
          data-testid="forgot-pin-btn"
        >
          Ho dimenticato il PIN
        </button>
      </section>

      {showModal && (
        <RecoveryModal
          onClose={handleModalClose}
          recover={recover}
          onSuccess={() => router.replace('/?view=menu')}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Run all 13 tests — expect them to pass**

```bash
cd prototypes/ui-shell && pnpm test app/unlock/page.test.tsx 2>&1 | tail -25
```

Expected: 13 passing, 0 failing.

- [ ] **Step 3: Run the vault-service tests — must still pass**

```bash
cd prototypes/ui-shell && pnpm test lib/vault/vault-service.test.ts 2>&1 | tail -10
```

Expected: all passing (we touched nothing in that file).

- [ ] **Step 4: Typecheck**

```bash
cd prototypes/ui-shell && pnpm typecheck 2>&1 | tail -10
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add app/unlock/page.tsx
git commit -m "feat(unlock): restyle PIN unlock screen — keypad, glass card, recovery modal"
```

---

## Task 5: Run the full test suite

Verify no regressions anywhere in the project.

**Files:** none

- [ ] **Step 1: Run all tests**

```bash
cd prototypes/ui-shell && pnpm test 2>&1 | tail -20
```

Expected: all tests pass. If any test outside `app/unlock/` fails, investigate before proceeding.

- [ ] **Step 2: Commit if all green (no changes needed — this is a verification step)**

If all pass with no changes: no commit needed. If you had to fix a regression, commit the fix separately with a clear message.

---

## Self-review notes

**Spec coverage check:**

| Spec section | Covered by |
|---|---|
| §1 Theme — palette tokens via inline CSS vars | Task 4 step 1 (`style` prop on root div) |
| §2 Layout — full-screen gradient, 3 glows, centered column, h1 Bentornata | Task 2 (CSS), Task 4 (JSX) |
| §3 Glass card — no border, backdrop-filter, fallback | Task 2 (CSS `.card`, `@supports`) |
| §4a Heading block — h2 + subtitle switching on success | Task 4 (`success` state, conditional text) |
| §4b PIN cells — 6 cells, states, aria-label, no digit exposure | Task 4 (`PinCells`) |
| §4c Error line — role=alert, text, hidden on new digit | Task 4 (error state, `handleDigit` clears error) |
| §4d Keypad — 3-col grid, digit circles, Cancella, empty slot | Task 4 (`Keypad`, `KEYPAD_ROWS`) |
| §4e Ghost action — no dropdown arrow, min 44px | Task 2 (CSS `.ghostBtn`), Task 4 |
| §5 Interaction — auto-submit, keyboard, disable-while-loading, success, failure, shake re-trigger | Task 4 (`useEffect` for auto-submit + keyboard) |
| §5 PIN cleared after attempt | Task 4 (`setDigits([])` before calling `unlock`) |
| §6 Recovery modal — overlay, dialog role, focus trap stub, Escape | Task 4 (`RecoveryModal`) |
| §6 Step 1 → step 2 in-place, Indietro keeps value | Task 4 (`RecoveryModal` step state) |
| §6 Format error, counter, Recupera disabled until valid | Task 4 (`handleCodeInput`, `isValidHex`) |
| §6 recover() reject: error shown, input kept, focus back | Task 4 (`handleRecover` failure branch) |
| §6 recover() success: router.replace | Task 4 (`onSuccess` prop) |
| §7 Touch targets ≥ 44px | Task 2 (CSS: keyDigit 72px, keyDel/ghostBtn min-height 44px) |
| §7 Focus ring | Task 2 (`:focus-visible` on all interactive elements) |
| §7 prefers-reduced-motion | Task 2 (`@media` rule disables drift + shake) |
| §8 Tests 1–13 | Task 3 |
| Figtree font | Task 1 |
| Sacramento already loaded as `--font-welcome` | Reused directly — no task needed |

**TODOs left in code (intentional, not gaps):**
- `// TODO: add attempt throttling if vaultService.unlock() ever adds it.` — in `UnlockPage` auto-submit handler
- `/* TODO: glass surface styles … candidates for a shared module */` — in `page.module.css` header

**What is NOT changed:** `globals.css`, `vault-context.tsx`, `vault-service.ts`, `vault-service.test.ts`, all other pages.
