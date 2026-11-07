# Login Welcome Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ridisegnare `/login` con animazione Welcome + card Google, rimuovere WelcomeScreen, navigare al menu aperto dopo sblocco/setup.

**Architecture:** Tutti i cambiamenti sono in `prototypes/ui-shell/`. La login page incorpora l'animazione Welcome (riutilizzando le classi CSS esistenti con timing aggiornati). WelcomeScreen viene eliminato. AppShell perde il tipo WELCOME e il relativo codice. Le pagine unlock/setup redirigono a `/?view=menu`.

**Tech Stack:** Next.js 15 App Router, React, CSS (globals.css), vitest + Testing Library.

**Working directory:** `prototypes/ui-shell/` — tutti i path, comandi npm e test sono relativi a questa directory.

---

## File Map

| Azione | File | Responsabilità |
|--------|------|----------------|
| Modificare | `app/globals.css` | Aggiornare timing animazione, aggiungere classi login, rimuovere classi welcome/inizia |
| Riscrivere | `app/login/page.tsx` | Nuovo design: sfondo fisso, animazione Welcome, card Google, footer privacy |
| Eliminare | `components/WelcomeScreen.tsx` | Non più necessario |
| Modificare | `components/AppShell.tsx` | Rimuovere `'WELCOME'` da AppView, handleStart(), WelcomeScreen |
| Modificare | `app/page.tsx` | `initialView` senza WELCOME, `view=menu` → MENU_OPEN |
| Modificare | `app/unlock/page.tsx` | Redirect a `/?view=menu` dopo sblocco |
| Modificare | `app/unlock/page.test.tsx` | Aggiornare mock router e assertions |
| Modificare | `app/setup/page.tsx` | Redirect a `/?view=menu` dopo setup |
| Modificare | `app/setup/page.test.tsx` | Aggiornare mock router e assertions |

---

## Task 1: Aggiornare globals.css — timing animazione e classi login

**Files:**
- Modify: `app/globals.css`

- [ ] **Step 1: Aggiornare timing `.welcome-stroke`**

Trovare la riga (circa 187):
```css
animation: draw-stroke 3s cubic-bezier(0.45, 0, 0.25, 1) 0.3s both;
```
Sostituire con:
```css
animation: draw-stroke 2.6s cubic-bezier(0.45, 0, 0.25, 1) 0.2s both;
```

- [ ] **Step 2: Aggiornare timing `.welcome-fill`**

Trovare la riga (circa 193):
```css
animation: fill-in 0.9s ease 2.7s both;
```
Sostituire con:
```css
animation: fill-in 0.8s ease 2.3s both;
```

- [ ] **Step 3: Aggiungere le nuove classi CSS della login page**

Trovare il commento `/* ============================================================` che precede la sezione RADIAL MENU (circa riga 247) e inserire prima di esso:

```css
/* ============================================================
   LOGIN SCREEN
   ============================================================ */

.login-screen {
  position:        fixed;
  inset:           0;
  min-height:      100dvh;
  background:      linear-gradient(135deg, #150d3f 0%, #3d1278 45%, #6b1f8f 75%, #8b2383 100%);
  display:         flex;
  flex-direction:  column;
  align-items:     center;
  justify-content: center;
  overflow:        hidden;
  padding:
    env(safe-area-inset-top, 0px)
    env(safe-area-inset-right, 0px)
    env(safe-area-inset-bottom, 0px)
    env(safe-area-inset-left, 0px);
}

.login-glow-top {
  position:   absolute;
  top:        20%;
  left:       50%;
  transform:  translateX(-50%);
  width:      500px;
  height:     300px;
  background: radial-gradient(ellipse at center, rgba(80, 210, 230, 0.22) 0%, transparent 65%);
  pointer-events: none;
}

.login-glow-bottom {
  position:   absolute;
  bottom:     10%;
  left:       50%;
  transform:  translateX(-50%);
  width:      600px;
  height:     250px;
  background: radial-gradient(ellipse at center, rgba(170, 80, 255, 0.25) 0%, transparent 65%);
  pointer-events: none;
}

.login-replay-btn {
  position:        fixed;
  top:             1.25rem;
  right:           1.25rem;
  z-index:         10;
  display:         flex;
  align-items:     center;
  gap:             0.4rem;
  padding:         0.4rem 0.9rem;
  border-radius:   2rem;
  border:          1px solid rgba(255, 255, 255, 0.30);
  background:      rgba(255, 255, 255, 0.12);
  color:           rgba(255, 255, 255, 0.85);
  font-size:       0.8rem;
  font-weight:     600;
  cursor:          pointer;
  transition:      opacity 150ms ease;
  backdrop-filter: blur(4px);
}

.login-replay-btn:disabled {
  opacity: 0.4;
  cursor:  default;
}

.login-replay-btn:focus-visible {
  outline:        3px solid var(--focus-ring);
  outline-offset: 4px;
}

.login-main {
  position:        relative;
  z-index:         1;
  display:         flex;
  flex-direction:  column;
  align-items:     center;
  gap:             2.5rem;
  padding:         0 clamp(1rem, 5vw, 3rem);
  width:           100%;
  max-width:       600px;
}

.login-card {
  width:            100%;
  max-width:        460px;
  background:       rgba(255, 255, 255, 0.11);
  backdrop-filter:  blur(10px);
  border:           1px solid rgba(255, 255, 255, 0.20);
  border-radius:    1.25rem;
  padding:          1.75rem 2rem;
  display:          flex;
  flex-direction:   column;
  gap:              1rem;
  text-align:       center;
  animation:        slide-up-fade 0.6s ease 2.6s both;
}

.login-card-title {
  font-weight: 700;
  font-size:   1.1rem;
  color:       #ffffff;
  margin:      0;
  line-height: 1.4;
}

.login-card-sub {
  font-size: 0.9rem;
  color:     rgba(255, 255, 255, 0.75);
  margin:    0;
}

.login-google-btn {
  display:         flex;
  align-items:     center;
  justify-content: center;
  gap:             0.75rem;
  padding:         0.75rem 1.5rem;
  border-radius:   50px;
  border:          none;
  background:      #ffffff;
  color:           #1a1a1a;
  font-weight:     700;
  font-size:       1rem;
  cursor:          pointer;
  transition:      opacity 150ms ease;
}

.login-google-btn:hover {
  opacity: 0.92;
}

.login-google-btn:focus-visible {
  outline:        3px solid var(--focus-ring);
  outline-offset: 3px;
}

.login-privacy {
  font-size:  0.82rem;
  color:      rgba(255, 255, 255, 0.60);
  text-align: center;
  margin:     0;
  animation:  slide-up-fade 0.6s ease 2.9s both;
}

.login-privacy-link {
  color:                rgba(255, 255, 255, 0.80);
  text-decoration:      underline;
  text-underline-offset: 3px;
}

@keyframes slide-up-fade {
  from { opacity: 0; transform: translateY(14px); }
  to   { opacity: 1; transform: translateY(0); }
}

```

- [ ] **Step 4: Verificare build CSS (nessun errore di sintassi)**

```bash
cd prototypes/ui-shell && npm run build 2>&1 | grep -E "error|Error" | head -10
```

Expected: nessun errore CSS.

- [ ] **Step 5: Commit**

```bash
git add prototypes/ui-shell/app/globals.css
git commit -m "feat(login): update animation timings and add login screen CSS classes"
```

---

## Task 2: Riscrivere `app/login/page.tsx`

**Files:**
- Modify: `app/login/page.tsx`

- [ ] **Step 1: Sostituire il contenuto di `app/login/page.tsx`**

```tsx
'use client'

import { useCallback, useEffect, useState } from 'react'
import { signIn, useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

// Durata totale animazione in ms (ultimo elemento finisce a 3.5s)
const ANIM_TOTAL_MS = 3500

export default function LoginPage() {
  const { status } = useSession()
  const router     = useRouter()

  const [animKey,     setAnimKey]     = useState(0)
  const [replayReady, setReplayReady] = useState(false)

  // Se già autenticati, redirect a /
  useEffect(() => {
    if (status === 'authenticated') router.replace('/')
  }, [status, router])

  // Abilita il pulsante replay solo dopo che l'animazione è finita
  useEffect(() => {
    setReplayReady(false)
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReduced) {
      setReplayReady(true)
      return
    }
    const t = window.setTimeout(() => setReplayReady(true), ANIM_TOTAL_MS)
    return () => window.clearTimeout(t)
  }, [animKey])

  const handleReplay = useCallback(() => setAnimKey(k => k + 1), [])

  if (status === 'loading') return null

  return (
    <div className="login-screen">
      {/* Strati di glow fissi */}
      <div className="login-glow-top"    aria-hidden="true" />
      <div className="login-glow-bottom" aria-hidden="true" />

      {/* Pulsante replay — top right */}
      <button
        className="login-replay-btn"
        type="button"
        onClick={handleReplay}
        disabled={!replayReady}
        aria-label="Rivedi animazione"
      >
        <svg
          width="14" height="14" viewBox="0 0 24 24"
          fill="none" stroke="currentColor" strokeWidth="2.5"
          strokeLinecap="round" strokeLinejoin="round"
          aria-hidden="true"
        >
          <polyline points="1 4 1 10 7 10" />
          <path d="M3.51 15a9 9 0 1 0 .49-4.95" />
        </svg>
        Rivedi animazione
      </button>

      <main className="login-main">
        {/* Heading accessibile */}
        <h1 className="sr-only">Welcome in Agenda</h1>

        {/* Animazione Welcome */}
        <div className="welcome-text-wrapper" aria-hidden="true">
          <span key={`stroke-${animKey}`} className="welcome-stroke">Welcome</span>
          <span key={`fill-${animKey}`}   className="welcome-fill">Welcome</span>
        </div>

        {/* Card Google — key forza rimount ad ogni replay */}
        <div key={`card-${animKey}`} className="login-card">
          <p className="login-card-title">
            Il tuo spazio per giorni, pensieri e idee.
          </p>
          <p className="login-card-sub">
            Accedi per ritrovare Agenda su tutti i tuoi dispositivi.
          </p>
          <button
            type="button"
            className="login-google-btn"
            onClick={() => signIn('google', { callbackUrl: '/' })}
            data-testid="google-signin-btn"
          >
            <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
              <path fill="#4285F4" d="M44.5 20H24v8.5h11.7C34.1 33.1 29.5 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.1 8 3l6-6C34.5 6.5 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20c11 0 19.7-8 19.7-20 0-1.3-.1-2.7-.2-4z"/>
              <path fill="#34A853" d="M6.3 14.7l7 5.1C15 16.4 19.1 13 24 13c3.1 0 5.9 1.1 8 3l6-6C34.5 6.5 29.6 4 24 4 16.3 4 9.7 8.4 6.3 14.7z"/>
              <path fill="#FBBC05" d="M24 44c5.4 0 10.3-1.8 14-4.9l-6.5-5.4C29.5 35.5 26.9 36 24 36c-5.4 0-10-3.4-11.6-8.1l-7 5.4C8.9 39.9 15.9 44 24 44z"/>
              <path fill="#EA4335" d="M44.5 20H24v8.5h11.7c-.9 2.5-2.6 4.6-4.9 5.9l6.5 5.4C41.2 36.3 44.5 30.7 44.5 24c0-1.3-.1-2.7-.2-4z"/>
            </svg>
            Accedi con Google
          </button>
        </div>

        {/* Footer privacy */}
        <p key={`footer-${animKey}`} className="login-privacy">
          Continuando accetti l&apos;
          <a href="#" className="login-privacy-link">
            informativa sulla privacy
          </a>
          {' '}di Agenda.
        </p>
      </main>
    </div>
  )
}
```

- [ ] **Step 2: Verificare typecheck**

```bash
cd prototypes/ui-shell && npm run typecheck 2>&1 | tail -5
```

Expected: nessun errore.

- [ ] **Step 3: Commit**

```bash
git add prototypes/ui-shell/app/login/page.tsx
git commit -m "feat(login): redesign with Welcome animation, Google card, privacy footer"
```

---

## Task 3: Rimuovere WelcomeScreen + semplificare AppShell + page.tsx

**Files:**
- Delete: `components/WelcomeScreen.tsx`
- Modify: `components/AppShell.tsx`
- Modify: `app/page.tsx`
- Modify: `app/globals.css` (rimozione classi welcome/inizia)

- [ ] **Step 1: Eliminare `components/WelcomeScreen.tsx`**

```bash
rm prototypes/ui-shell/components/WelcomeScreen.tsx
```

- [ ] **Step 2: Sostituire il contenuto di `components/AppShell.tsx`**

```tsx
// components/AppShell.tsx
'use client'

import { useState, useRef, useEffect } from 'react'
import { useVaultContext } from '@/lib/vault/vault-context'
import { RadialMenu } from './RadialMenu'

export type AppView = 'MENU_OPEN' | 'MENU_CLOSED'

interface AppShellProps {
  initialView: AppView
}

export function AppShell({ initialView }: AppShellProps) {
  const [view, setView] = useState<AppView>(initialView)
  const { logout }      = useVaultContext()

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
        firstItemRef={firstItemRef}
        firstFallbackItemRef={firstFallbackItemRef}
        centerButtonRef={centerButtonRef}
      />
      <button
        onClick={logout}
        style={{
          position:     'fixed',
          bottom:       '1.5rem',
          right:        '1.5rem',
          zIndex:       3,
          background:   'rgba(255,255,255,0.12)',
          border:       '1px solid rgba(255,255,255,0.25)',
          borderRadius: '0.5rem',
          color:        'rgba(255,255,255,0.75)',
          fontSize:     '0.8rem',
          padding:      '0.4rem 0.75rem',
          cursor:       'pointer',
        }}
        aria-label="Esci"
      >
        Esci
      </button>
    </>
  )
}
```

- [ ] **Step 3: Sostituire il contenuto di `app/page.tsx`**

```tsx
// app/page.tsx
import { AppShell } from '@/components/AppShell'
import type { AppView } from '@/components/AppShell'

interface Props {
  searchParams: Promise<{ view?: string }>
}

export default async function Home({ searchParams }: Props) {
  const params       = await searchParams
  const initialView: AppView =
    params.view === 'menu' ? 'MENU_OPEN' : 'MENU_CLOSED'
  return <AppShell initialView={initialView} />
}
```

- [ ] **Step 4: Rimuovere le classi CSS obsolete da `app/globals.css`**

Eliminare l'intero blocco dalla riga `/* WELCOME SCREEN */` fino a (e incluso) `@keyframes welcome-button-appear { ... }` — ovvero le classi:
`.welcome-screen`, `.welcome-main`, `.welcome-replay-btn`, `.welcome-replay-btn:focus-visible`, `.inizia-button`, `.inizia-button:not(.ready)`, `.inizia-button:hover`, `.inizia-button:focus-visible`, `@keyframes welcome-button-appear`.

Le classi `.sr-only`, `.welcome-text-wrapper`, `.welcome-stroke`, `.welcome-fill`, `@keyframes draw-stroke`, `@keyframes fill-in` **restano** (usate dalla login page).

Il blocco da rimuovere è:

```css
/* ============================================================
   WELCOME SCREEN
   ============================================================ */

.welcome-screen {
  ...
}

.welcome-main {
  ...
}

/* Visually hidden but available to screen readers */
/* .sr-only { ... }  ← LASCIARE */

/* Tap/click target wrapping the animated "Welcome" text */
.welcome-replay-btn {
  ...
}

.welcome-replay-btn:focus-visible {
  ...
}

/* Grid stacks stroke and fill layers without absolute positioning */
/* .welcome-text-wrapper { ... }  ← LASCIARE */

/* .welcome-stroke, .welcome-fill { ... }  ← LASCIARE */
/* .welcome-stroke { ... }  ← LASCIARE */
/* .welcome-fill { ... }  ← LASCIARE */
/* @keyframes draw-stroke { ... }  ← LASCIARE */
/* @keyframes fill-in { ... }  ← LASCIARE */

.inizia-button {
  ...
}

.inizia-button:not(.ready) {
  ...
}

.inizia-button:hover {
  ...
}

.inizia-button:focus-visible {
  ...
}

@keyframes welcome-button-appear {
  ...
}
```

- [ ] **Step 5: Verificare typecheck**

```bash
cd prototypes/ui-shell && npm run typecheck 2>&1 | tail -5
```

Expected: nessun errore.

- [ ] **Step 6: Eseguire i test**

```bash
cd prototypes/ui-shell && npm test 2>&1 | grep -E "Tests|failed|FAIL"
```

Expected: tutti i test passano (il WelcomeScreen non ha test diretti).

- [ ] **Step 7: Commit**

```bash
git add prototypes/ui-shell/components/AppShell.tsx \
        prototypes/ui-shell/app/page.tsx \
        prototypes/ui-shell/app/globals.css
git rm prototypes/ui-shell/components/WelcomeScreen.tsx
git commit -m "feat(login): remove WelcomeScreen, simplify AppShell, update page.tsx initialView"
```

---

## Task 4: Redirect post-unlock a `/?view=menu` + test

**Files:**
- Modify: `app/unlock/page.tsx`
- Modify: `app/unlock/page.test.tsx`

- [ ] **Step 1: Aggiornare il redirect in `app/unlock/page.tsx`**

Trovare (riga ~46):
```ts
router.push('/')
```
Sostituire con:
```ts
router.replace('/?view=menu')
```

Fare lo stesso per il recovery handler (riga ~63):
```ts
router.push('/')
```
→
```ts
router.replace('/?view=menu')
```

- [ ] **Step 2: Aggiornare i test in `app/unlock/page.test.tsx`**

Sostituire il mock del router (aggiungere `mockReplace`):

```ts
const mockPush    = vi.fn()
const mockReplace = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
}))
```

Aggiornare l'assertion nel test **b** (unlock con successo):
```ts
// Prima:
expect(mockPush).toHaveBeenCalledWith('/')
// Dopo:
expect(mockReplace).toHaveBeenCalledWith('/?view=menu')
```

Aggiornare l'assertion nel test **c** (unlock fallito):
```ts
// Prima:
expect(mockPush).not.toHaveBeenCalled()
// Dopo:
expect(mockReplace).not.toHaveBeenCalled()
```

Aggiornare l'assertion nel test **f** (recover con successo):
```ts
// Prima:
expect(mockPush).toHaveBeenCalledWith('/')
// Dopo:
expect(mockReplace).toHaveBeenCalledWith('/?view=menu')
```

Aggiornare l'assertion nel test **g** (recover fallito):
```ts
// Prima:
expect(mockPush).not.toHaveBeenCalled()
// Dopo:
expect(mockReplace).not.toHaveBeenCalled()
```

- [ ] **Step 3: Eseguire i test unlock**

```bash
cd prototypes/ui-shell && npx vitest run app/unlock/page.test.tsx
```

Expected: 7 test passano.

- [ ] **Step 4: Commit**

```bash
git add prototypes/ui-shell/app/unlock/page.tsx \
        prototypes/ui-shell/app/unlock/page.test.tsx
git commit -m "feat(login): unlock page redirects to /?view=menu after success"
```

---

## Task 5: Redirect post-setup a `/?view=menu` + test

**Files:**
- Modify: `app/setup/page.tsx`
- Modify: `app/setup/page.test.tsx`

- [ ] **Step 1: Aggiornare il redirect in `app/setup/page.tsx`**

Trovare (riga ~76):
```ts
router.push('/')
```
Sostituire con:
```ts
router.replace('/?view=menu')
```

- [ ] **Step 2: Aggiornare i test in `app/setup/page.test.tsx`**

Sostituire il mock del router (aggiungere `mockReplace`):

```ts
const mockPush    = vi.fn()
const mockReplace = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
}))
```

Aggiornare l'assertion nel test **e** (setup con successo + email):
```ts
// Prima:
expect(mockPush).toHaveBeenCalledWith('/')
// Dopo:
expect(mockReplace).toHaveBeenCalledWith('/?view=menu')
```

Aggiornare l'assertion nel test **e** (setup con successo senza email):
```ts
// Prima:
expect(mockPush).toHaveBeenCalledWith('/')
// Dopo:
expect(mockReplace).toHaveBeenCalledWith('/?view=menu')
```

- [ ] **Step 3: Eseguire i test setup**

```bash
cd prototypes/ui-shell && npx vitest run app/setup/page.test.tsx
```

Expected: tutti i test passano.

- [ ] **Step 4: Eseguire la suite completa**

```bash
cd prototypes/ui-shell && npm test 2>&1 | grep -E "Tests|failed|FAIL"
```

Expected: `Tests  244 passed (244)` — nessun fallimento.

- [ ] **Step 5: Build finale**

```bash
cd prototypes/ui-shell && npm run build 2>&1 | tail -20
```

Expected: build pulita, nessun errore TypeScript o CSS.

- [ ] **Step 6: Commit**

```bash
git add prototypes/ui-shell/app/setup/page.tsx \
        prototypes/ui-shell/app/setup/page.test.tsx
git commit -m "feat(login): setup page redirects to /?view=menu after success"
```
