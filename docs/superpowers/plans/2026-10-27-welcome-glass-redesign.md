# Welcome Glass Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Welcome screen with the liquid-glass Google sign-in design, move every screen onto the new 8-palette system, and make auth failures return to Welcome with Italian feedback, without weakening the B-1 OAuth BFF.

**Architecture:** Backend changes are confined to the failure branches of the existing callback and one authorization-URL parameter. The frontend gets one palette source of truth (`lib/palettes.ts`), a static per-palette stylesheet checked against it by tests, an external pre-paint script, a pure Welcome state reducer, and a rewritten `WelcomeScreen` that only navigates to `/api/auth/login`.

**Tech Stack:** Next.js 15.5.28 (App Router, React 19.1), Tailwind 4 + plain CSS, NestJS 10 + Jest + supertest, Keycloak 26.8.1, Vitest + jsdom + Testing Library (new), opentype.js (dev script only).

**Spec:** `docs/superpowers/specs/2026-10-27-welcome-glass-redesign-design.md`

## Global Constraints

- Stay on `feature/oauth`. Never switch branches, create worktrees, stage, commit, push, merge, rebase or reset. Each task ends at a checkpoint where the user reviews; the user decides whether to commit (Conventional Commits, no Claude attribution).
- No new auth endpoints, no popup, no GIS SDK, no postMessage. PKCE, state, nonce, pending-auth cleanup, CSRF and the ACR `'2'` check stay as they are.
- Callback failures: only `${FRONTEND_URL}/?auth_error=cancelled` or `${FRONTEND_URL}/?auth_error=failed`. Nothing from the request is reflected.
- `kc_idp_hint=google` is a UX hint, never a security check.
- `/api/auth/register` stays.
- UI copy is Italian and verbatim from the spec. No emoji in code. No replay button. No privacy link. No "Usa Agenda senza account" control (TODO D-19). No Calendar connect/import UI.
- Copy strings (exact): "Welcome in Agenda" (sr-only h1), "Il tuo spazio per giorni, pensieri e idee.", "Accedi per ritrovare Agenda su tutti i tuoi dispositivi.", "Accedi con Google", "Riprova ad accedere con Google", "Reindirizzamento all'accesso sicuro…", "Accesso annullato: puoi riprovare quando vuoi.", "Accesso non completato", "Non è stato possibile completare l'accesso. Riprova.", "Non riesco a raggiungere Google in questo momento. Controlla la connessione e riprova.", "Note, diario ed esercizi restano in Agenda e non vengono mai inviati a Google." (bold: "non vengono mai inviati a Google"), "Il calendario lo colleghi dopo, solo se vuoi."
- Palette data is copied verbatim from the task (table in Task 4). Default `notte-lavanda`. Storage key `agenda.palette`.
- No inline `<script>` or inline `<style>` elements added. A future CSP `script-src 'self'` must work.
- No tokens, codes, state values, emails or names in logs.
- New npm dependencies are exact-pinned and published at least 14 days before install.
- Live Google + TOTP acceptance is never reported as passed unless it was executed.

## Review Focus

1. Back button from Keycloak/Google restores Welcome from bfcache still in the busy state: expect `scelta` with an enabled button (Task 6, `pageshow persisted resets busy state`).
2. Crafted or repeated query `?auth_error=<script>` or `?auth_error=failed&auth_error=cancelled`: expect plain `scelta`, no message, nothing rendered from the query (Task 5 `parseAuthError`, Task 6 page wiring).
3. `localStorage` throws (Safari private mode, blocked storage): expect the default palette, no exception from the init script or switcher (Task 4).
4. Double-click or Enter-repeat on the Google button: expect exactly one navigation (Task 6).
5. Tab opened in the background or intro interrupted: expect fully visible text and card, no element left at opacity 0 (Task 6, `hidden document skips intro` and timeout cleanup).

---

## File map

Backend (`backend/`)
- Create `src/auth/auth-error-redirect.ts`: allowlist and fixed redirect builder.
- Modify `src/auth/auth.controller.ts`: callback failure branches.
- Modify `src/auth/oidc/oidc-client.service.ts:67-69`: `kc_idp_hint` for both flows.
- Modify `test/app.e2e-spec.ts:219-345`, `test/unit/oidc-client.service.spec.ts`.
- Modify `keycloak/agenda-realm.json`: `registrationAllowed: false`.
- Modify `docs/local-auth-setup.md`: cancel expectation, kcadm procedure, live checklist.

Frontend (`prototypes/ui-shell/`)
- Modify `package.json`: dev deps, `test` script, `generate:welcome-path` script.
- Create `vitest.config.ts`, `test/setup.ts`.
- Rewrite `lib/palettes.ts`. Create `lib/palettePreference.ts`, `app/palettes.css`, `public/palette-init.js`.
- Modify `app/layout.tsx`, `app/globals.css`, `dev/PaletteSwitcher.tsx`.
- Create `lib/welcome-state.ts`.
- Create `scripts/generate-welcome-path.mjs`, generated `lib/welcome-path.ts`.
- Rewrite `components/WelcomeScreen.tsx`. Create `components/GoogleSignInButton.tsx`, `components/welcome-icons.tsx`.
- Modify `components/AppShell.tsx`, `app/page.tsx`.
- Tests in `test/*.test.ts(x)`.

---

### Task 0: Baseline

**Files:** none (outputs in the session scratchpad)

- [ ] **Step 1:** `git branch --show-current` prints `feature/oauth`; `git status --short` shows only the known untracked files (`.idea/conventionalCommit.xml`, the spec and this plan).
- [ ] **Step 2:** Run `pnpm --filter agenda-api typecheck`, `pnpm --filter agenda-api test`, `pnpm --filter agenda-api test:e2e`, `pnpm --filter ui-shell build`. Save output to `<scratchpad>/baseline.txt`. Any pre-existing failure is reported to the user before Task 1 and is not fixed silently.

---

### Task 1: Callback failure redirects and `kc_idp_hint`

**Files:**
- Create: `backend/src/auth/auth-error-redirect.ts`
- Modify: `backend/src/auth/auth.controller.ts` (callback)
- Modify: `backend/src/auth/oidc/oidc-client.service.ts:67-69`
- Test: `backend/test/app.e2e-spec.ts`, `backend/test/unit/oidc-client.service.spec.ts`

**Interfaces:**
- Produces: `export const AUTH_ERROR_CODES = ['cancelled', 'failed'] as const`, `export type AuthErrorCode = typeof AUTH_ERROR_CODES[number]`, `export function authErrorRedirectUrl(frontendUrl: string, code: AuthErrorCode): string` returning `new URL('/?auth_error=' + code, frontendUrl).toString()`.
- Frontend contract (Task 5): query key `auth_error`, values `cancelled | failed`.

- [ ] **Step 1: Rewrite the failing callback e2e tests.** In `app.e2e-spec.ts`, set the frontend base the module uses (`FRONTEND_URL=http://localhost:3000` in the test env setup) and add a helper `expectAuthErrorRedirect(res, code)` that asserts `res.status === 302`, `res.headers.location === \`http://localhost:3000/?auth_error=${code}\``, no `session_id=` or `XSRF-TOKEN=` in `set-cookie`, and an `auth_tx=` cookie with `Max-Age=0`. Change the existing cases:
  - `no auth_tx cookie` -> `failed`
  - `error=access_denied` -> `cancelled`
  - `wrong state`, `expired auth_tx`, second `replay` call -> `failed`
  - `acr absent`, `acr=1` -> `failed`

  Add new cases:
  - `error=server_error` -> `failed`
  - `error=access_denied&state=state-c` with a seeded row for `state-c` -> `cancelled`, and a follow-up `?code=c&state=state-c` with the same cookie -> `failed` (row consumed)
  - `exchangeCode` rejects -> `failed`
  - `error=<script>&error_description=evil` -> location equals exactly `http://localhost:3000/?auth_error=failed`
  - `acr=1`: the in-memory session store has no new entry
  - the success test stays unchanged (302 to `FRONTEND_APP_URL`).
- [ ] **Step 2:** Add the unit test `buildAuthorizationUrl sets kc_idp_hint=google for login and register` in `oidc-client.service.spec.ts`. Also assert that `scope` is still exactly `openid email profile` and that `claims` still requests `acr` `['2']`.
- [ ] **Step 3:** Run `pnpm --filter agenda-api test:e2e` and `pnpm --filter agenda-api test`. Expected: the new and changed cases FAIL (400/401 instead of 302, `kc_idp_hint` missing for login).
- [ ] **Step 4: Implement.**
  - Create `auth-error-redirect.ts` per the Interfaces block.
  - In the callback, replace each `throw` with a private `_failRedirect(res, code, state?)`. It does three things:
    - if `state` and `txId` are present, call `this.pendingAuth.consume(txId, state)` and ignore the result
    - clear `auth_tx` (same attributes as the success path)
    - log `Auth callback failed: <code>` only, then `res.redirect(302, authErrorRedirectUrl(this.frontendUrl, code))`.
  - Map `query.error === 'access_denied'` to `cancelled` and every other failure to `failed`. Keep the order of the checks; the ACR check stays before any session write.
  - Make `this.frontendUrl` throw at construction if it is empty or not an absolute `http(s)` URL.
  - In `oidc-client.service.ts`, set `kc_idp_hint=google` unconditionally and keep the `flow` parameter.
- [ ] **Step 5:** Run `pnpm --filter agenda-api typecheck`, `test`, `test:e2e`. Expected: all pass. `test:integration` is only run if the user has the Docker stack up.
- [ ] **Step 6:** Update `docs/local-auth-setup.md`: the cancellation scenario now ends on Welcome with `?auth_error=cancelled` stripped and the cancel line shown.
- [ ] **Step 7: Checkpoint.** Report the diff summary and test output, then stop for user review. Suggested commit message: `feat(auth): redirect callback failures to welcome with allowlisted codes`.

---

### Task 2: Disable Keycloak self-registration (JSON + running realm)

**Files:**
- Modify: `backend/keycloak/agenda-realm.json` (`"registrationAllowed": false`)
- Modify: `docs/local-auth-setup.md` (new "Realm drift" section)

`docker` is not on this machine's PATH in the agent shell, so the running-realm steps are run by the user (via `! <command>`) or skipped and reported as pending.

- [ ] **Step 1:** Edit the JSON, then check it: `python3 -I -c "import json;print(json.load(open('backend/keycloak/agenda-realm.json'))['registrationAllowed'])"` prints `False`.
- [ ] **Step 2: Inspect the running realm before changing it.** Run these in the `keycloak` container after `kcadm.sh config credentials --server http://localhost:8080 --realm master --user $KEYCLOAK_ADMIN_USER`:
  - `kcadm.sh get realms/agenda --fields registrationAllowed,registrationEmailAsUsername`
  - `kcadm.sh get identity-provider/instances/google -r agenda --fields alias,enabled,firstBrokerLoginFlowAlias,postBrokerLoginFlowAlias,trustEmail,storeToken`
  - `kcadm.sh get authentication/flows/post%20broker%20login%20with%20otp/executions -r agenda`
  - `kcadm.sh get authentication/required-actions/CONFIGURE_TOTP -r agenda`

  Record the output in `<scratchpad>/realm-before.txt`. If any value differs from the static audit in spec section 4, stop and report it.
- [ ] **Step 3:** Run `kcadm.sh update realms/agenda -r agenda -s registrationAllowed=false`, then repeat the first command of Step 2. Expected: `"registrationAllowed" : false`.
- [ ] **Step 4:** Document in `local-auth-setup.md` that `--import-realm` skips an existing realm, list the Step 2/3 commands, and give the rollback `-s registrationAllowed=true`.
- [ ] **Step 5: Checkpoint.** Report the before/after values, or state "running realm not yet updated: requires user". Suggested commit: `chore(keycloak): disable local self-registration`.

---

### Task 3: Frontend test tooling

**Files:**
- Modify: `prototypes/ui-shell/package.json`
- Create: `prototypes/ui-shell/vitest.config.ts`, `prototypes/ui-shell/test/setup.ts`, `prototypes/ui-shell/test/smoke.test.ts`

- [ ] **Step 1:** `pnpm --filter ui-shell add -D -E vitest@4.1.11 jsdom@30.1.2 @testing-library/react@16.3.3 @testing-library/dom@10.4.2`. These were checked on 2026-10-27, all published ≥14 days earlier; vitest 4.x is chosen because vitest 5 requires `@types/node` ≥22 and the project has `^20`. Add the script `"test": "vitest run"`.
- [ ] **Step 2:** Write `vitest.config.ts`:
  - `environment: 'jsdom'`
  - `setupFiles: ['./test/setup.ts']`
  - `include: ['test/**/*.test.{ts,tsx}']`
  - `esbuild: { jsx: 'automatic' }`
  - `resolve.alias` `'@'` -> project root.

  `test/setup.ts` runs `cleanup()` after each test and provides a `matchMedia` stub that returns `matches: false` unless the test overrides it.
- [ ] **Step 3:** `test/smoke.test.ts` asserts `1 + 1 === 2`. Run `pnpm --filter ui-shell test`. Expected: 1 passed. Run `pnpm --filter ui-shell build`. Expected: success (vitest files are not part of the Next build).
- [ ] **Step 4: Checkpoint.** Suggested commit: `chore(ui-shell): add vitest test runner`.

---

### Task 4: Shared palette system

**Files:**
- Rewrite: `prototypes/ui-shell/lib/palettes.ts`
- Create: `prototypes/ui-shell/lib/palettePreference.ts`, `prototypes/ui-shell/app/palettes.css`, `prototypes/ui-shell/public/palette-init.js`
- Modify: `prototypes/ui-shell/app/layout.tsx`, `prototypes/ui-shell/app/globals.css`, `prototypes/ui-shell/dev/PaletteSwitcher.tsx`
- Test: `prototypes/ui-shell/test/palettes.test.ts`, `prototypes/ui-shell/test/palettePreference.test.ts`, `prototypes/ui-shell/test/palette-init.test.ts`

**Interfaces:**
- Produces in `lib/palettes.ts`:
  - `PALETTES` (as const, the exact array below)
  - `type PaletteId = typeof PALETTES[number]['id']`
  - `type Palette = typeof PALETTES[number]`
  - `DEFAULT_PALETTE_ID: PaletteId = 'notte-lavanda'`
  - `PALETTE_STORAGE_KEY = 'agenda.palette'`
  - `isPaletteId(v: unknown): v is PaletteId`
- Produces in `lib/palettePreference.ts`:
  - `readStoredPaletteId(): PaletteId` (try/catch, invalid -> default)
  - `applyPalette(id: PaletteId): void` (sets `document.documentElement.dataset.palette` and stores, storage errors swallowed)
- CSS custom properties on `[data-palette="<id>"]`: `--bg-from`, `--bg-to`, `--glow-1`, `--glow-2`, `--glow-3`, `--ink`.

Palette data (verbatim from the task):

| id | name | from | to | glow | ink |
|---|---|---|---|---|---|
| argilla-petrolio | Argilla e petrolio | #C2410C | #0F766E | #FB923C #2DD4BF #FDBA74 | #9A3412 |
| notte-lavanda | Notte e lavanda | #1E3A8A | #6D28D9 | #818CF8 #C084FC #38BDF8 | #2E2370 |
| bosco-laguna | Bosco e laguna | #14532D | #0E7490 | #4ADE80 #22D3EE #86EFAC | #14532D |
| tramonto | Tramonto | #9F1239 | #C2410C | #FB7185 #FB923C #FDA4AF | #9F1239 |
| inchiostro | Inchiostro | #1F2328 | #2F5BD3 | #60A5FA #818CF8 #93C5FD | #1F2328 |
| prugna-corallo | Prugna e corallo | #581C87 | #BE123C | #C084FC #FB7185 #F0ABFC | #581C87 |
| oliva-ambra | Oliva e ambra | #3F6212 | #A16207 | #A3E635 #FBBF24 #FDE68A | #3F6212 |
| ardesia-salvia | Ardesia e salvia | #334155 | #3F6B5E | #94A3B8 #6EE7B7 #A7F3D0 | #334155 |

- [ ] **Step 1: Write the failing tests.**
  - `palettes.test.ts`:
    - `PALETTES` deep-equals the table above
    - the default is `notte-lavanda`
    - `palettes.css matches lib/palettes.ts`: read `app/palettes.css` with `fs`, parse each `[data-palette="…"] { … }` block with a regex, and assert the set of ids equals `PALETTES` ids and every property equals its source value (case-insensitive hex)
    - `globals.css has no numeric palette selectors or legacy tokens`: no match for `/data-palette="\d/`, `--gradient-start` or `--gradient-end`
    - `default palette vars also apply on :root`: `palettes.css` declares the notte-lavanda values under `:root`, so there is no unstyled frame if the attribute is missing.
  - `palettePreference.test.ts`:
    - stored `tramonto` -> `tramonto`
    - stored `'3'` -> `notte-lavanda`
    - stored garbage -> default
    - `localStorage.getItem` throws -> default, no throw
    - `applyPalette('inchiostro')` sets the dataset and storage
    - `applyPalette` with `setItem` throwing still sets the dataset.
  - `palette-init.test.ts`:
    - the id list embedded in `public/palette-init.js` equals the `PALETTES` ids (extract the array literal with a regex)
    - running the file's source with `new Function(src)()` in jsdom with stored `bosco-laguna` sets `data-palette="bosco-laguna"`; with stored `'3'` leaves `notte-lavanda`; with `localStorage` access throwing does not throw.
- [ ] **Step 2:** Run `pnpm --filter ui-shell test`. Expected: the new tests FAIL.
- [ ] **Step 3: Implement.**
  - `lib/palettes.ts` per Interfaces. Drop `PaletteEntry`, `PALETTE_COUNT` and the numeric ids. Keep the `UI-08` provisional comment only if still true; the task makes these values authoritative, so replace it with a pointer to the spec.
  - `app/palettes.css`: one block per palette plus `:root` defaults. Import it in `layout.tsx` before `globals.css`.
  - `public/palette-init.js`: a plain-ES5 IIFE with try/catch. It reads `localStorage.getItem('agenda.palette')` and, if the value is in its id array, sets `document.documentElement.setAttribute('data-palette', v)`.
  - `layout.tsx`:
    - remove the random pick
    - render `<html lang="it" data-palette="notte-lavanda" suppressHydrationWarning className={…}>`
    - render `<head><script src="/palette-init.js" /></head>` (synchronous, same-origin)
    - load Figtree via `next/font/google` (weights 400/500/600/700, `variable: '--font-ui'`) next to Sacramento
    - set `body { font-family: var(--font-ui), system-ui, sans-serif }` in `globals.css`.
  - `globals.css`:
    - replace every `var(--gradient-start)`/`var(--gradient-end)` with `var(--bg-from)`/`var(--bg-to)`
    - delete the numeric block and the old welcome section (Task 6 adds the new one)
    - keep `--gradient-angle: 90deg`.
  - `PaletteSwitcher.tsx`:
    - state `PaletteId`, initialised to `DEFAULT_PALETTE_ID` and synced in `useEffect` from `readStoredPaletteId()`
    - clicking calls `applyPalette`
    - labels `palette.name`; aria-label `Palette ${name}`
    - toggle text shows the active name
    - update the header comment (persistent storage now exists).
- [ ] **Step 4:** Run `pnpm --filter ui-shell test` and `pnpm --filter ui-shell build`. Expected: all pass, and the build output has no hydration warnings.
- [ ] **Step 5: Browser check** (`pnpm dev`, switcher enabled). Pass criteria:
  - switching each of the 8 palettes updates the background on `/?view=menu`, `/calendario` and one section placeholder
  - after reload the chosen palette appears with no flash of `notte-lavanda` (DevTools "Disable cache", throttled reload)
  - with site storage blocked, the page renders `notte-lavanda` and the console shows no errors.
- [ ] **Step 6: Checkpoint.** Suggested commit: `feat(ui-shell): adopt string-id palette system with persisted preference`.

---

### Task 5: Welcome state machine

**Files:**
- Create: `prototypes/ui-shell/lib/welcome-state.ts`
- Test: `prototypes/ui-shell/test/welcome-state.test.ts`

**Interfaces:**
- Produces:
  - `type AuthErrorCode = 'cancelled' | 'failed'`
  - `parseAuthError(v: string | string[] | undefined): AuthErrorCode | null` (only a single exact allowlisted string is accepted; arrays -> `null`)
  - `type WelcomeState = { kind: 'scelta'; notice: 'cancelled' | null } | { kind: 'reindirizzamento' } | { kind: 'errore'; reason: 'network' | 'failed' }`
  - `type WelcomeEvent = { type: 'SIGN_IN'; online: boolean } | { type: 'PAGE_RESTORED' }`
  - `initialWelcomeState(err: AuthErrorCode | null): WelcomeState`
  - `welcomeReducer(s: WelcomeState, e: WelcomeEvent): WelcomeState`

- [ ] **Step 1: Write the failing tests.**
  - `initialWelcomeState`:
    - `null` -> `{kind:'scelta',notice:null}`
    - `'cancelled'` -> scelta with notice `'cancelled'` (a cancel is not an error)
    - `'failed'` -> `{kind:'errore',reason:'failed'}`.
  - `welcomeReducer`:
    - `SIGN_IN online` from scelta or errore -> `reindirizzamento`
    - `SIGN_IN offline` -> `errore network`
    - `SIGN_IN` while in `reindirizzamento` -> same object (no second navigation)
    - `PAGE_RESTORED` from `reindirizzamento` -> scelta with no notice
    - `PAGE_RESTORED` from other states -> unchanged.
  - `parseAuthError`:
    - `'cancelled'`/`'failed'` accepted
    - `'Cancelled'`, `'<script>'`, `''`, `undefined`, `['failed','cancelled']` -> `null`.
- [ ] **Step 2:** Run `pnpm --filter ui-shell test`. Expected: FAIL (module missing).
- [ ] **Step 3:** Implement as a pure module with no React import.
- [ ] **Step 4:** Run the tests. Expected: PASS.
- [ ] **Step 5: Checkpoint.** Suggested commit: `feat(ui-shell): add welcome sign-in state machine`.

---

### Task 6: Handwriting path, glass Welcome screen and wiring

**Files:**
- Create: `prototypes/ui-shell/scripts/generate-welcome-path.mjs`, `prototypes/ui-shell/lib/welcome-path.ts` (generated, checked in)
- Create: `prototypes/ui-shell/components/GoogleSignInButton.tsx`, `prototypes/ui-shell/components/welcome-icons.tsx`
- Rewrite: `prototypes/ui-shell/components/WelcomeScreen.tsx`
- Modify: `prototypes/ui-shell/components/AppShell.tsx`, `prototypes/ui-shell/app/page.tsx`, `prototypes/ui-shell/app/globals.css` (new WELCOME section)
- Test: `prototypes/ui-shell/test/welcome-path.test.ts`, `prototypes/ui-shell/test/WelcomeScreen.test.tsx`

**Interfaces:**
- Consumes:
  - `welcomeReducer`, `initialWelcomeState`, `parseAuthError`, `AuthErrorCode` (Task 5)
  - the CSS vars from Task 4.
- Produces:
  - `WELCOME_PATH: { viewBox: string; strokes: ReadonlyArray<{ d: string; length: number; delayMs: number; durationMs: number }> }`
  - `WelcomeScreen` props `{ visible: boolean; authError: AuthErrorCode | null; navigate?: (url: string) => void }` (`navigate` defaults to `url => window.location.assign(url)`; it exists for tests)
  - `GoogleSignInButton` props `{ label: string; busy: boolean; onClick: () => void }`.

Path generation:
- [ ] **Step 1:** `pnpm --filter ui-shell add -D -E opentype.js@2.0.0 @fontsource/sacramento@5.3.0`. Add the script `"generate:welcome-path": "node scripts/generate-welcome-path.mjs"`.
- [ ] **Step 2:** Write the failing `welcome-path.test.ts`:
  - `strokes.length > 0`
  - every `length > 0`
  - `delayMs` is non-decreasing and `strokes[0].delayMs === 200`
  - `max(delayMs + durationMs) === 2800` (±1 ms)
  - start x of each stroke (first `M` x) is non-decreasing (left to right)
  - `viewBox` aspect ratio is between 3.0 and 3.8 (about 640x190).
- [ ] **Step 3:** Write the script.
  - Load the Latin 400 `.woff` from `@fontsource/sacramento/files/` with opentype.js and call `font.getPath('Welcome', 0, baseline, 220)`.
  - Split it into closed contours (one stroke per `M`) and sort them by min x.
  - Measure each contour's length by flattening curves into 64 segments each.
  - Map cumulative length fractions through `cubic-bezier(0.45, 0, 0.25, 1)` to times inside the 2600 ms window starting at 200 ms. Each stroke then animates linearly inside its window, so the overall reveal follows the specified easing and runs left to right.
  - Write `lib/welcome-path.ts` with a "generated, do not edit" header and coordinates rounded to 1 decimal.
- [ ] **Step 4:** Run `pnpm --filter ui-shell generate:welcome-path`, then the tests. Expected: PASS.

Screen:
- [ ] **Step 5: Write the failing `WelcomeScreen.test.tsx`** (Testing Library, `navigate` mocked):
  - initial render shows the sr-only h1 "Welcome in Agenda", the h2/p copy, the button "Accedi con Google", both info rows, and the bold fragment inside a `<strong>`
  - no button or link matching `/registrati/i`, `/senza account/i`, `/annulla/i`, `/privacy/i`, `/calendario/i` as a control
  - clicking the button calls `navigate('/api/auth/login')` exactly once, even after two quick clicks and an Enter; the button gets `aria-busy="true"` and a `role=status` element with "Reindirizzamento all'accesso sicuro…" appears
  - with `navigator.onLine` stubbed `false`, the click does not navigate and shows a `role=alert` with the network copy, the h2 "Accesso non completato", and the button relabelled "Riprova ad accedere con Google"
  - `authError='cancelled'` -> `role=status` with the cancel line, no alert
  - `authError='failed'` -> `role=alert` with "Non è stato possibile completare l'accesso. Riprova."
  - `pageshow persisted resets busy state`: after a click, dispatching `new PageTransitionEvent('pageshow', { persisted: true })` (or an `Event` with `persisted` defined) returns to the enabled "Accedi con Google"
  - `auth_error stripped from URL`: with `window.history.replaceState(null,'','/?auth_error=failed')` before render, `location.search` is `''` after mount
  - intro:
    - `matchMedia('(prefers-reduced-motion: reduce)')` true -> the root never gets `welcome--intro`
    - motion allowed -> `welcome--intro` is present after mount and absent after `vi.advanceTimersByTime(3300)`
    - `document.hidden` stubbed true -> no `welcome--intro`
  - the card content region has `aria-live="polite"`.
- [ ] **Step 6:** Run the tests. Expected: FAIL.
- [ ] **Step 7: Implement.**
  - `WelcomeScreen` uses `useReducer(welcomeReducer, authError, initialWelcomeState)`.
    - On `SIGN_IN` reaching `reindirizzamento`, a `useEffect` calls `navigate('/api/auth/login')` once (guarded by a ref).
    - A `pageshow` listener dispatches `PAGE_RESTORED` when `persisted`.
    - A mount effect strips `auth_error` via `replaceState`, preserving other params.
  - Intro:
    - added in a mount effect only if motion is allowed and `!document.hidden`
    - removed on the card's `animationend` or a 3300 ms timeout, whichever comes first.
  - Base CSS is the final visible state. Under `.welcome--intro` only:
    - strokes animate `stroke-dashoffset` from `length` to 0 (inline CSS vars `--len`, `--delay`, `--dur` per path)
    - the fill group runs `opacity 0->1` over 0.8 s from 2.3 s
    - the card runs `fade-in + translateY(14px)` over 600 ms from 2.6 s
    - all with `animation-fill-mode: both`.
  - SVG `aria-hidden`, white, scaled with `width: min(640px, 92vw)`.
  - Content cross-fade: the content wrapper is keyed by `state.kind` with a 200 ms opacity keyframe. Card height changes smoothly with `transition: height 200ms ease` driven by a `ResizeObserver`-measured inner height set through `style.setProperty`.
  - Glows are three `aria-hidden` divs inside a `position: relative` wrapper around the card. Their offsets come from the 1180x820 reference relative to the card's top-left (card left 360, top ≈ 270 at the reference): (-30,30) 300px, (200,150) 320px, (110,-20) 180px. They use `color-mix(in srgb, var(--glow-N) 85%/80%/55%, transparent)` in `radial-gradient(circle, … , transparent 70%)` with blur 10/10/8 px.
  - Glass, inner box and ghost styles exactly per the task section 3. The fallback goes under `@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px)))` with `rgba(255,255,255,0.18)`.
  - Spinner is used only inside the busy button; it is static under reduced motion.
  - Focus ring `2px solid #fff`, offset 3px, on every control; every control at least 44px.
  - `GoogleSignInButton`:
    - fill `#FFFFFF`, 1px `#747775`, text `#1F1F1F`, Figtree 500 14/20, pill, height 48px
    - padding 12px / G / 10px / text / 12px
    - the standard 4-color G as inline SVG paths (official colors `#4285F4 #34A853 #FBBC05 #EA4335`), unmodified
    - never palette-tinted.
  - `welcome-icons.tsx`: lock, calendar and alert line icons, 20px, `stroke="currentColor"`, `aria-hidden`.
  - `AppShell`: drop `handleLogin`/`handleRegister`, accept and forward `authError`.
  - `app/page.tsx`: `authError = parseAuthError(params.auth_error)` (searchParams type widened to `string | string[]`). Pass `initialView` as before.
  - Delete `AUTH_CONFIGURED`/`NEXT_PUBLIC_AUTH_*` usage from the UI.
  - Add a TODO comment for D-19 where the ghost action would be, and a TODO for the privacy footer pointing to spec section 5.
- [ ] **Step 8:** Run `pnpm --filter ui-shell test` and `pnpm --filter ui-shell build`. Expected: all pass.
- [ ] **Step 9: Browser check at 1180x820, 390x844 and 1440x900.**
  - The handwriting draws letter by letter left to right (not all at once), the fill fades, then the card appears.
  - Glows stay behind the card at every size, with no horizontal scroll.
  - Tab order: Google button only (plus the switcher in dev).
  - DevTools reduced-motion emulation: everything visible immediately.
  - A tab opened in the background shows everything when focused.
- [ ] **Step 10: Checkpoint.** Suggested commit: `feat(ui-shell): liquid-glass welcome screen with google sign-in`.

---

### Task 7: Rendered contrast audit and minimal adjustments

**Files:**
- Modify (only if a measurement fails): `prototypes/ui-shell/app/globals.css` (welcome section)
- Modify: spec section 8 (results table)
- Scratch: `<scratchpad>/contrast/measure.mjs`, `<scratchpad>/contrast/analyse.py`, screenshots

- [ ] **Step 1:** With `pnpm dev` running, use the `playwriter` skill. For each of the 8 palettes (set via `localStorage` + reload), in each Welcome state (`scelta`, `?auth_error=cancelled`, `?auth_error=failed`, busy), and at 1180x820 and 390x844:
  - screenshot each text element's bounding box with the text made `color: transparent`, to capture the background only
  - take a second set with the fallback declarations injected (`backdrop-filter: none` + the fallback background), since `@supports` cannot be toggled at runtime
  - capture the same for the radial menu labels and the `/calendario` header, day headers and day numbers (existing sections).
- [ ] **Step 2:** `analyse.py` (run with `python3 -I`, Pillow) takes the lightest pixel in each box, composites the element's computed text color and opacity over it, and reports the WCAG ratio. Pass = ≥ 4.5:1 for all body text, and ≥ 3:1 only where text is ≥ 24px or ≥ 18.66px bold. Results go in a table: palette x element x glass/fallback.
- [ ] **Step 3:** For each failure, apply the smallest change from the approved set, in this order:
  - lower the glow alpha behind the card's text area
  - add a darkening layer inside the card (`linear-gradient` of `rgba(10,10,50,a)` under the glass tint)
  - lower the glass white tint.

  Never change palette hex values. Re-measure after each change.
- [ ] **Step 4:** Failures in existing sections (for example the 55% `.cal-day-header`) are listed with measurements and proposed fixes, and reported to the user. They are fixed only with approval, since they are outside the glass scope.
- [ ] **Step 5:** Fill spec section 8 with before/after values and every adjustment made.
- [ ] **Step 6: Checkpoint.** Suggested commit: `fix(ui-shell): adjust welcome glass for measured contrast`.

---

### Task 8: Full verification and live acceptance

**Files:** `docs/local-auth-setup.md` (live checklist), spec section 6 status

- [ ] **Step 1:** `pnpm --filter agenda-api typecheck && pnpm --filter agenda-api test && pnpm --filter agenda-api test:e2e && pnpm --filter ui-shell test && pnpm --filter ui-shell build`. Expected: all green. Compare with `<scratchpad>/baseline.txt`; any new failure blocks completion.
- [ ] **Step 2: Regression pass in the browser on 2 palettes** (notte-lavanda, oliva-ambra):
  - radial menu opens and closes and its focus behavior is unchanged
  - each section link loads
  - `/calendario` month navigation and the day overlay work
  - logout returns to Welcome.
- [ ] **Step 3: Grep checks** (each must print nothing):
  - `grep -rnE 'data-palette="[0-9]|gradient-start|NEXT_PUBLIC_AUTH_REGISTER|onRegister' prototypes/ui-shell/app prototypes/ui-shell/components prototypes/ui-shell/lib prototypes/ui-shell/dev`
  - `grep -rnE '<script>|dangerouslySetInnerHTML' prototypes/ui-shell/app prototypes/ui-shell/components`
  - a check for hard-coded palette hex values in `components/` and the welcome CSS. The Google button colors and the `#E3F4E6`/`#8CE99A` family are allowlisted; the latter are not used now.
- [ ] **Step 4: Live acceptance (user-run, real Google account + TOTP device).** Run the spec section 6 scenarios plus:
  - the Keycloak login page is never shown (hint) and offers no "Register" link when reached directly at `/realms/agenda/account`
  - a cancel at Google lands on Welcome with the cancel line
  - a first sign-in with a never-seen Google account creates the user and forces TOTP enrollment with `registrationAllowed=false`.

  Record each scenario as **passed / failed / not executed** in `local-auth-setup.md` and spec section 6. Unexecuted scenarios are reported as not executed.
- [ ] **Step 5: Final report to the user:**
  - what was implemented
  - TODOs: D-19 offline use, privacy notice before release, Google Calendar increment, `/api/auth/register` cleanup proposal
  - deviations (spec section 5)
  - contrast results
  - test evidence
  - live-acceptance status.

---

## Rollback strategy

Nothing is committed by the agent, so rollback works on the working tree, task by task, and always with user confirmation, because it discards work.
- **Task 1 (backend):** restore `auth.controller.ts`, `oidc-client.service.ts`, both test files and `local-auth-setup.md`; delete `auth-error-redirect.ts`. The frontend tolerates a missing `auth_error` (plain `scelta`), so Tasks 5-6 still work. The only effect is that failures show the raw 400/401 page again.
- **Task 2 (realm):** `kcadm.sh update realms/agenda -r agenda -s registrationAllowed=true` and restore the JSON. The two are independent: the JSON only affects fresh databases.
- **Task 3/6 dependencies:** restore `prototypes/ui-shell/package.json` and `pnpm-lock.yaml`, then run `pnpm install`.
- **Task 4 (palettes):** restore `lib/palettes.ts`, `layout.tsx`, `globals.css`, `PaletteSwitcher.tsx`; delete `palettes.css`, `palette-init.js`, `palettePreference.ts` and the tests. A stale `agenda.palette` key in browsers is harmless to the old code. Task 4 and Task 6 both edit `globals.css`, so rolling back Task 4 alone also requires rolling back Task 6.
- **Task 6:** restore `WelcomeScreen.tsx`, `AppShell.tsx`, `page.tsx` and the welcome CSS section; delete the new components, script, generated path and tests.
- Recommended: the user commits after each approved checkpoint. Rollback then becomes a `git revert` of one commit, run by the user.
