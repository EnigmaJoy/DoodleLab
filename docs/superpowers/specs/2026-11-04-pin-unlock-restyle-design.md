# PIN Unlock Screen — Restyle Design

**Date:** 2026-11-04
**Branch:** features/localStorage-life-cycle
**Reference board:** 00b Sblocco con PIN

---

## Scope

Restyle `app/unlock/page.tsx` to match board "00b Sblocco con PIN".
UI and interaction only — no changes to cryptography, key derivation, PIN verification, vault unlock flow, storage, or any security logic.
All existing vault-service tests must keep passing.

---

## 1. Files changed

| File | Action |
|------|--------|
| `app/unlock/page.tsx` | Full rewrite |
| `app/unlock/page.module.css` | New |
| `app/unlock/page.test.tsx` | Full rewrite |
| `app/layout.tsx` | Add Figtree font variable |
| `app/globals.css` | **Untouched** |

---

## 2. Palette tokens

The CSS module consumes `--bg-from`, `--bg-to`, `--glow-1`, `--glow-2`, `--glow-3`, `--ink`.
These are not in globals.css today. The component sets them as **inline CSS custom properties on its root `<div>`**, mapping to the existing globals vars:

```tsx
style={{
  '--bg-from': 'var(--gradient-start, #581c87)',
  '--bg-to':   'var(--gradient-end, #be123c)',
  '--glow-1':  'var(--gradient-start, #581c87)',
  '--glow-2':  'var(--gradient-end, #be123c)',
  '--glow-3':  'color-mix(in srgb, var(--gradient-start) 60%, var(--gradient-end))',
  '--ink':     '#140820',
} as React.CSSProperties}
```

No other screen is affected. When globals.css eventually defines these tokens the inline style can be dropped.

> **TODO:** glass surface styles (card background, backdrop-filter, box-shadow) are candidates for a shared CSS module used by sign-in, unlock, and radial menu.

---

## 3. Layout

Full-screen background: `linear-gradient(135deg, var(--bg-from), var(--bg-to))`, white text, font Figtree.

Three decorative glows (`aria-hidden`, `pointer-events: none`) behind the card:
- Glow 1: 340px, position (280px, 200px), `--glow-1`, opacity 0.7, blur 14px
- Glow 2: 360px, position (560px, 380px), `--glow-2`, opacity 0.65, blur 14px
- Glow 3: 200px, position (470px, 160px), `--glow-3`, opacity 0.5, blur 14px

Each glow drifts via `@keyframes drift` (translateX/Y up to 30px, 12s, ease-in-out, infinite alternate).
`@media (prefers-reduced-motion: reduce)` disables both drift and shake.

Centered column, `gap: 20px`:
1. `<h1>` "Bentornata" — Sacramento (`var(--font-welcome)`), 64px, white, line-height 1.1
2. Glass card

---

## 4. Glass card

Width 400px (max 92vw), padding 26px 28px 18px, radius 28px, flex column, gap 18px.

```css
background: linear-gradient(135deg, rgba(255,255,255,0.24), rgba(255,255,255,0.08));
backdrop-filter: blur(28px) saturate(170%);
-webkit-backdrop-filter: blur(28px) saturate(170%);
box-shadow:
  inset 0 0 22px rgba(255,255,255,0.18),
  inset 0 10px 18px -12px rgba(255,255,255,0.6),
  0 24px 60px rgba(20,8,40,0.32);
/* no border */
/* fallback without backdrop-filter: background rgba(255,255,255,0.18) */
```

Card content top to bottom:

### 4a. Heading block
- `<h2>` "Sblocca Agenda" — 20px bold
- `<p>` subtitle — 14px, white at 88%
  - Idle: "Inserisci il tuo PIN di 6 cifre."
  - After `unlock()` returns `true` (before routing): "Fatto, sto aprendo le tue note..."

### 4b. PIN cells
Six cells in a row, centered, gap 8px. Each cell 40×48px, radius 12px.

| State | Style |
|-------|-------|
| Empty | `background: rgba(255,255,255,0.10)`, inset ring 1px `rgba(255,255,255,0.22)` |
| Filled | `background: rgba(255,255,255,0.26)`, centered white dot 12px diameter |
| Active (next to fill) | inset ring 2px `rgba(255,255,255,0.9)` |

Group: `role="img"`, `aria-label="PIN, {n} cifre su 6 inserite"`. Digits never exposed to AT.

The cell row is rendered as `<PinCells key={shakeKey} />`. On every failed attempt `shakeKey` is incremented, re-mounting the component and restarting `@keyframes shake` (translateX: -8, 7, -5, 3, 0 px, 420ms). `prefers-reduced-motion` disables shake; the error line alone provides feedback.

### 4c. Error line
`role="alert"`, centered, 14px semibold white, visible only after a wrong PIN:
> "PIN non corretto. Riprova con calma."

Hidden as soon as the user types any new digit.

### 4d. Keypad
Grid 3 columns × 72px, gap 12px, centered.
Layout: `1 2 3 / 4 5 6 / 7 8 9 / [empty] 0 Cancella`

- Digit keys: 72×72px circles, same glass style as card, white digit 26px weight 500, `aria-label="Cifra {n}"`
- "Cancella": transparent background, 13px semibold, `aria-label="Cancella una cifra"`, removes last digit
- Empty slot: invisible, not focusable

### 4e. Ghost action
Centered, white, underlined (`text-underline-offset: 3px`), min-height 44px, no dropdown arrow.
Label: "Ho dimenticato il PIN"
Opens the recovery modal.

---

## 5. Interaction

Digits come from keypad or physical keyboard (`0–9`; `Backspace` = Cancella; Enter not used).
Input is disabled while `unlock()` is running.

Auto-submit: when `digits.length === 6`, a `useEffect` calls `unlock(digits.join(''))` and immediately clears `digits`. No "Sblocca" button.

**Success:** subtitle switches to "Fatto, sto aprendo le tue note...", then `router.replace('/?view=menu')` (unchanged from today).

**Failure:** clear all 6 cells, show error line, increment `shakeKey`.

**PIN in memory:** kept only as `string[]` state; cleared after every attempt. Never logged.

> **TODO:** add attempt throttling if `vaultService.unlock()` ever adds it.

---

## 6. Recovery modal

`role="dialog"`, `aria-modal="true"`. Focus trapped inside; returns to ghost trigger on close.

**Overlay:** `rgba(20,8,30,0.4)`, `backdrop-filter: blur(6px)`. Clicking overlay closes and clears modal.

**Modal surface:** width 440px, padding 22px 24px, radius 26px, white text.
```css
background: linear-gradient(135deg,
  color-mix(in srgb, var(--bg-from) 93%, transparent),
  color-mix(in srgb, var(--bg-to)   93%, transparent));
box-shadow: inset 0 0 22px rgba(255,255,255,0.18), 0 28px 70px rgba(20,8,40,0.45);
/* no border */
```

Escape or close button closes and clears the modal.

### Step 1 — Explanation
- `<h2>` "Hai dimenticato il PIN?" + 44px close button (`aria-label="Chiudi"`)
- `<p>`: "Le tue note sono protette con il PIN: senza di lui nemmeno Agenda può leggerle. Per questo non esiste un \"reimposta\" automatico."
- Primary white button (min-height 52px, radius 14px, text `var(--ink)`): "Usa la chiave di recupero"
  - Below it, 13px white at 82%: "È il codice che hai salvato durante la configurazione."
  - Clicking → Step 2 (kept value if returning from Step 2)

### Step 2 — Code entry (in-place, same modal)
- `<label>` "Chiave di recupero"
- `<textarea>`: monospace, `font-variant-numeric: tabular-nums`, accepts paste
  - `onInput`: strip spaces/newlines, lowercase
- Counter: "{n} di 64 caratteri" (13px, subdued)
- **Format error** (non-hex chars): "La chiave contiene caratteri non validi: usa solo cifre e lettere da a a f." — shown inline below field, never clears input
- "Recupera" button: disabled until value is exactly 64 chars matching `/^[0-9a-f]{64}$/`
  - While running: form disabled, button text "Sto verificando la chiave..."
  - On `recover()` rejection: "Questa chiave non corrisponde. Controlla di aver copiato tutto il codice." — focus returns to textarea, code kept
  - On success: `router.replace('/?view=menu')` (identical to existing recover flow)
- "Indietro" button: returns to Step 1, keeps typed value
- Close button / Escape: closes modal, clears all state (code, errors, step resets to 1)

> **TODO:** add attempt throttling here if `vaultService.recover()` ever adds it.
> **Note:** `recover()` today only returns `true`/`false` with no "set new PIN" step; wired as-is. If a future ADR adds post-recovery PIN reset, revisit this component.

The recovery code is never logged and is cleared from state after each attempt (success or failure).

---

## 7. Accessibility and motion

- Touch targets ≥ 44px (keys are 72px; ghost button min-height 44px; close button 44px)
- Visible focus ring on every key and button: `2px white outline, offset 2px`
- Text contrast ≥ 4.5:1 on all 8 palettes
- `prefers-reduced-motion: reduce`: disables drift animation on glows and shake on PIN cells; error line is the sole failure signal

---

## 8. Tests (new `page.test.tsx`)

Old tests (testing text input, eye toggle, Sblocca button) are replaced. New coverage:

1. Renders 6 PIN cells and keypad; no text input, no eye toggle
2. Keypad digit click fills a cell
3. Physical keyboard digit fills a cell
4. Backspace / "Cancella" removes last digit
5. 6th digit auto-calls `unlock(pin)` with the correct string
6. Failed unlock: cells cleared, error line shown, `shakeKey` incremented
7. Success: subtitle becomes "Fatto...", then `router.replace('/?view=menu')`
8. New digit typed after error: error line hidden
9. Modal opens on ghost button click; closes on overlay click, Escape, close button
10. Step 1 → Step 2 on "Usa la chiave di recupero"; "Indietro" returns to Step 1, value kept
11. Format error shown for non-hex input; "Recupera" disabled until valid 64-char hex
12. `recover(code)` success → `router.replace('/?view=menu')`
13. `recover(code)` failure → error message shown, focus on textarea, code kept

Vault-service tests (`lib/vault/vault-service.test.ts`) untouched.

---

## 9. What is NOT changed

- Crypto, key derivation, Argon2id parameters
- `vaultService.unlock()` and `vaultService.recover()` implementations
- `useVaultContext` hook and `AppGate` routing logic
- All other pages (`/login`, `/setup`, `/`)
- `globals.css`
