# Welcome redesign (liquid-glass card) - design decisions

**Status:** all blockers resolved (2026-10-27). Implementation plan:
`docs/superpowers/plans/2026-10-27-welcome-glass-redesign.md` (awaiting approval).
**Branch:** `feature/oauth`
**Source:** task "Welcome + Google sign-in screen with liquid-glass card" (2026-10-27), reconciled
with Auth Increment A and B-1 designs.

This increment is a visual and UX redesign of the Welcome screen, a migration of the shared
palette system, and two narrow auth adjustments (callback failure redirects, `kc_idp_hint`). It
does not change the OAuth BFF security architecture.

---

## 1. Sign-in flow (keeps B-1 full-page redirect)

- "Accedi con Google" navigates the whole page to `/api/auth/login`. NestJS -> Keycloak ->
  Google -> mandatory TOTP -> verified callback -> session -> redirect to `/?view=menu`.
- No Google Identity Services SDK, no popup windows, no postMessage, no new auth endpoints.
- BFF session, PKCE, state, nonce, CSRF, pending-auth cleanup and the ACR 2 check are unchanged.
- Before navigation the button shows a busy state with the status text
  "Reindirizzamento all'accesso sicuro…" (role=status).
- No "Annulla" button, no "attesa" screen, no Escape-to-cancel: after navigation the app cannot
  cancel the flow.
- When the browser comes back to Welcome from the history (bfcache), the busy state is reset.

### 1.1 Callback failure redirects (resolves B1)

Every failure branch of the existing `GET /api/auth/callback` now answers `302` to a fixed,
trusted destination instead of a raw `400`/`401`:

| Condition | Destination |
|---|---|
| `error=access_denied` (user cancelled at Keycloak or Google) | `${FRONTEND_URL}/?auth_error=cancelled` |
| any other `error` value, missing `auth_tx`, missing code/state, invalid or expired transaction, replay, token exchange failure, ACR not `2` | `${FRONTEND_URL}/?auth_error=failed` |

Rules:
- `FRONTEND_URL` comes from server configuration only. Nothing from the request (query,
  headers, `error_description`) is reflected into the destination.
- The error code is chosen from the allowlist `cancelled | failed`. Anything else is never emitted.
- On every failure: the `auth_tx` cookie is cleared; if a `state` is present the pending-auth row
  is consumed (deleted) so it can never be reused; no session or CSRF cookie is set.
- PKCE, state, nonce validation and the ACR 2 invariant are unchanged and still run before any
  session is created. A failed ACR check after a successful token exchange creates no session.
- Logs record the failure category only, never tokens, codes, state values or personal data.
- An attacker-crafted link to `/?auth_error=…` can only show one of two fixed Italian messages.

### 1.2 Feedback on Welcome

The frontend reads `auth_error` once, validates it against the same allowlist, then removes it
from the URL with `history.replaceState`.

| Input | State | Copy |
|---|---|---|
| `cancelled` | `scelta` + status line (role=status) | "Accesso annullato: puoi riprovare quando vuoi." |
| `failed` | `errore` (role=alert) | "Non è stato possibile completare l'accesso. Riprova." |
| browser offline when the button is pressed | `errore` (role=alert) | "Non riesco a raggiungere Google in questo momento. Controlla la connessione e riprova." |
| absent / unknown / repeated value | `scelta`, no message | - |

The original task copy ended the network message with "non hai perso nulla". That clause is
removed: the UI must not promise that no data was lost.

## 2. Google Calendar connect/import is deferred

- The `calendario` and `importazione` states are not built. No stub adapters, no simulated
  progress, no fake event counts.
- Sign-in requests only `openid email profile`. Calendar is never a prerequisite to use Agenda.
- After login the destination stays `/?view=menu` (radial menu). No automatic jump to the Month view.
- The existing internal Calendario section is unchanged.
- Google Calendar integration becomes its own increment with a backend spec (scopes, token
  lifecycle, import, sync, errors, acceptance tests).
- The "Il calendario lo colleghi dopo, solo se vuoi." info row stays as copy only, with no control.

State machine: `scelta`, `reindirizzamento`, `errore`.

## 3. Palettes: new list as the shared system

- The 8 string-id palettes from the task (ids, names, from, to, glow[3], ink) are authoritative and
  live in `lib/palettes.ts` as the single source of truth.
- Default `notte-lavanda`. The random per-request pick in `app/layout.tsx` is removed.
- CSS custom properties (`--bg-from`, `--bg-to`, `--glow-1..3`, `--ink`) are declared per
  `[data-palette="<id>"]` in a static stylesheet `app/palettes.css`. A unit test fails if it
  differs from `lib/palettes.ts` in any id or value. Every existing screen (Welcome, radial menu,
  Calendario, section placeholders) uses these properties; no numeric selectors remain.
- Selected palette persisted in `localStorage` under `agenda.palette` (visual preference only;
  never auth data or user content).
- Theme restore before first paint uses an external, same-origin, synchronous script
  `/palette-init.js` loaded from `<head>` (`<script src="/palette-init.js" />`). There is no
  checked-in copy: the script is generated by `buildPaletteInitScript()` in
  `lib/paletteInitScript.ts` from `PALETTES`, `DEFAULT_PALETTE_ID` and `PALETTE_STORAGE_KEY`, and
  served by a static route handler `app/palette-init.js/route.ts` (`dynamic = 'force-static'`,
  `Content-Type: text/javascript`), so it can never diverge from `lib/palettes.ts`. No inline
  script and no inline `<style>`, so a future CSP of `script-src 'self'` needs no
  `unsafe-inline`. The script validates the stored value against the generated id list and wraps
  storage access in try/catch; unit tests execute the generated output. `<html>` gets
  `suppressHydrationWarning` for the attribute.
- Audit (2026-10-27): there is no CSP in the repo today (no `headers()` in `next.config.ts`, no
  helmet in NestJS). The mechanism above is CSP-ready, not CSP-tested.
- Compatibility: numeric ids were never persisted (the old switcher had no storage), so nothing
  needs migrating. Any unknown or invalid stored value, including old numeric strings, falls back
  to `notte-lavanda`; no guessed numeric-to-string mapping.
- Dev `PaletteSwitcher` lists the new palettes, writes `data-palette` and `localStorage`.

Numeric references to replace: `app/layout.tsx` (random id, `PALETTE_COUNT`), `app/globals.css`
(`[data-palette="1".."8"]`, `--gradient-start/--gradient-end` used by welcome, radial menu,
section placeholder, calendar), `dev/PaletteSwitcher.tsx`, `lib/palettes.ts`.

Measured white-text contrast on the gradients (all pass 4.5:1): lowest is oliva-ambra `to`
`#A16207` at 4.92:1. Other existing low-opacity text (for example `.cal-day-header` at 55%) is
re-measured in the contrast audit.

## 4. Single Google button; Keycloak self-registration off (resolves B2)

- One primary "Accedi con Google" button for new and returning users, pointing to
  `/api/auth/login`. Keycloak's first broker login creates the account on first Google sign-in;
  TOTP enrollment then verification is required before access (ACR 2 hard invariant).
- `buildAuthorizationUrl` sends `kc_idp_hint=google` for both `login` and `register`. It is a UX
  shortcut only, not a security boundary: Keycloak still enforces the post-broker OTP flow, and
  the callback still enforces ACR 2.
- Keycloak local self-registration is disabled: `registrationAllowed: false` in
  `backend/keycloak/agenda-realm.json` **and** in the running realm. The running realm lives in
  Postgres, and `--import-realm` skips an existing realm, so the JSON edit alone does not change
  it. The running realm is inspected and updated with `kcadm.sh`, and the change is verified live.
- Disabling self-registration must not affect first broker login (which creates users through
  the IdP flow, not the registration form). This is proven by the live acceptance run, not assumed.
- Backend `GET /api/auth/register` is kept unchanged (covered by `backend/test/app.e2e-spec.ts`).
  `NEXT_PUBLIC_AUTH_REGISTER_URL` and the frontend `onRegister` plumbing are removed from the UI.
- No email/password registration system is added.
- Account-conflict and TOTP-setup failures are rendered by Keycloak's own pages (default theme).
  If they end the flow with an error, the user lands on Welcome via section 1.1.

Realm audit (`agenda-realm.json`, static): Google IdP enabled, `firstBrokerLoginFlowAlias =
"first broker login"`, `postBrokerLoginFlowAlias = "post broker login with otp"`
(`auth-otp-form` REQUIRED), `CONFIGURE_TOTP` enabled, `trustEmail = true`, `storeToken = false`.

## 5. Visual spec, with recorded deviations

Unchanged from the task: layout, glass card tokens, Google button branding (custom button, light
theme, never tinted), copy for `scelta` and `errore`, handwriting/card intro animation (class
added after mount, final state as base style, reduced-motion support), backdrop-filter fallback,
focus rings, 44px targets.

Deviations:
- **Google Sans:** not available through `next/font/google` (only "Google Sans Code"). The button
  uses Figtree Medium 14/20, as the task allows.
- **Privacy footer:** omitted. No privacy notice exists, and a link to one would be fake.
  Pre-release requirement: publish the Agenda privacy notice, then restore the footer line
  "Continuando accetti l'informativa sulla privacy di Agenda." with a working link.
- **"Usa Agenda senza account, per ora":** hidden, TODO referencing D-19.
- **Footer animation:** not applicable while the footer is omitted.
- **Contrast adjustments (B5):** where rendered measurement shows text below 4.5:1, minimal
  changes to glass opacity, a darkening overlay or glow intensity are allowed. Each change and
  its before/after measurement is recorded in section 8.

## 6. Mandatory live acceptance

Live Google + TOTP acceptance is mandatory and is reported as **not executed** until someone
runs it with a real Google account and TOTP device. Scenarios: first sign-in (account creation
via first broker login, TOTP enrollment, ACR 2, `/?view=menu`), returning sign-in, cancel at
Google -> Welcome with the cancel line, Keycloak login page shows no self-registration link,
logout then sign-in again.

## 7. Resolved blockers

| Id | Resolution |
|---|---|
| B1 | Section 1.1 |
| B2 | Section 4 |
| B3 | Add `vitest`, `jsdom`, `@testing-library/react`, `@testing-library/dom` as exact-pinned ui-shell dev dependencies |
| B4 | Section 6 |
| B5 | Section 5 (contrast adjustments), results in section 8 |
| B6 | Section 1.2 copy; privacy footer omitted (section 5) |

## 8. Contrast audit results

Measured 2026-10-27 (Task 7) on the rendered page in headless Chrome, at 1180x820 and 390x844,
in the states `scelta`, `?auth_error=cancelled`, `?auth_error=failed` and busy, with
backdrop-filter (glass) and with the `@supports not` fallback forced by injected CSS
(`backdrop-filter: none` + the fallback background), for all 8 palettes.

**Method.** Headless Chrome is driven over the Chrome DevTools Protocol against a local dev
server. The intro is skipped by emulating `prefers-reduced-motion: reduce`, and the scripts wait for
web fonts. Busy is reached by a real click, with the login request answered 204 so the page stays
put. Each text element is made `color: transparent` (icons, spinner and handwriting hidden,
focus outline made transparent), the viewport is captured, and the PNG is read back on a canvas.
The lightest pixel inside each text box (text-node client rects) is taken as the worst-case
background. The element's computed colour, with its alpha times the inherited opacity, is
composited over that pixel, and the WCAG 2 ratio is computed. Focus ring: the Google button is
focused with the keyboard (Tab, `:focus-visible` confirmed, `2px solid #fff`, offset 3px), and white
is compared with the lightest pixel in the bands just outside the ring and in the 3px gap inside
it. Thresholds: 4.5:1 for normal text; 3:1 for text at least 24px or at least 18.66px bold (the 22px
bold h2), and for non-text UI (icons, focus ring). The handwriting is compared with the page gradient.

**Before** (task values), 828 failures out of 1,216 measurements. Every palette failed, in both
modes. The worst was 1.59:1 (info row, `oliva-ambra`, fallback). The cause was the bright glows
(boosted by `saturate(170%)`) seen through a 24% white tint, which put the background at up to
L≈0.5 under white text.

**Adjustments** (Welcome section of `app/globals.css`, all global, no palette hex changed). The
fixes were applied in the approved order, re-measuring each step on the worst palettes:
1. *Glow alpha lowered* to 40% of the original: glow 1/2/3 at 34% / 32% / 22% (were 85 / 80 / 55%),
   via `--welcome-glow-N-alpha`. On its own this was not enough: even with no glows at all,
   `oliva-ambra` info rows measured 2.84:1.
2. *Darkening layer* `--welcome-glass-shade: rgba(10, 10, 50, 0.45)`, under the white tint (second
   background layer of `.welcome-card`, and under the fallback tint). With the original tints,
   passing would need a shade of about 0.65 (`oliva-ambra` info row 4.55-4.63), which made the card
   nearly opaque, so step 3 was used to keep the shade at 0.45.
3. *Glass white tint lowered*: card gradient 0.24→0.16 / 0.08→0.05; fallback 0.18→0.12; inner info
   box 0.10→0.04 (the info box sits over the glow-2 peak and was the limiting element).

Border, highlights, shadow, blur/saturate, radius and all text colours/opacities are unchanged.

**After**: 0 failures. Every text element is at least 4.75:1 (so even the h2 meets 4.5:1), icons
at least 4.38:1, and the focus ring at least 6.09:1.

Minimum ratio per palette and mode, over both viewports and all four states, shown as
before → after. Bold marks a failure.

| Palette | Mode | h2 (≥3) | p (≥4.5) | alert (≥4.5) | cancel-status (≥4.5) | busy-status (≥4.5) | info-row (≥4.5) | info-strong (≥4.5) | info-icon (≥3) | error-icon (≥3) | focus-ring (≥3) | handwriting (≥3) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| notte-lavanda | glass | 3.38 → 7.69 | **2.92** → 6.39 | **2.84** → 6.34 | **2.82** → 6.43 | **3.16** → 6.67 | **2.54** → 5.91 | **2.92** → 7.23 | 3.05 → 7.17 | 3.25 → 5.15 | 3.17 → 7.67 | 7.32 → 7.32 |
| notte-lavanda | fallback | 3.23 → 8.01 | **2.8** → 6.63 | **2.7** → 6.61 | **2.56** → 6.52 | **2.92** → 6.55 | **2.22** → 5.8 | **2.5** → 7.01 | 3.04 → 7.59 | 3.65 → 5.65 | **2.88** → 7.87 | 7.32 → 7.32 |
| argilla-petrolio | glass | **2.54** → 6.4 | **2.15** → 5.31 | **2.11** → 5.3 | **2.1** → 5.55 | **2.29** → 5.9 | **1.94** → 5.19 | **2.14** → 6.25 | **2.37** → 6.19 | **2.54** → 4.39 | **2.32** → 6.43 | 5.39 → 5.39 |
| argilla-petrolio | fallback | **2.49** → 6.72 | **2.2** → 5.62 | **2.17** → 5.67 | **2.08** → 5.6 | **2.29** → 5.64 | **1.82** → 5 | **2.02** → 5.97 | **2.45** → 6.37 | **2.85** → 4.78 | **2.3** → 6.65 | 5.39 → 5.39 |
| bosco-laguna | glass | **2.27** → 6.49 | **2.01** → 5.46 | **1.88** → 5.41 | **1.84** → 5.42 | **2.11** → 5.58 | **1.78** → 5.05 | **1.98** → 6.13 | **2.2** → 6.19 | **2.73** → 4.65 | **2.01** → 6.44 | 5.53 → 5.53 |
| bosco-laguna | fallback | **2.33** → 6.75 | **2.07** → 5.67 | **1.94** → 5.68 | **1.82** → 5.54 | **2.26** → 5.61 | **1.76** → 4.99 | **1.99** → 5.98 | **2.29** → 6.59 | 3.11 → 5.13 | **1.97** → 6.59 | 5.53 → 5.53 |
| tramonto | glass | **2.79** → 6.64 | **2.48** → 5.56 | **2.53** → 5.64 | **2.54** → 5.68 | **2.53** → 5.79 | **2.26** → 5.31 | **2.53** → 6.45 | **2.75** → 6.41 | **2.78** → 4.76 | **2.85** → 6.78 | 5.33 → 5.33 |
| tramonto | fallback | **2.76** → 7.3 | **2.43** → 6.11 | **2.48** → 6.26 | **2.36** → 6.05 | **2.51** → 5.92 | **2** → 5.37 | **2.23** → 6.39 | **2.84** → 7.17 | 3.38 → 5.45 | **2.65** → 7.36 | 5.33 → 5.33 |
| inchiostro | glass | 3.1 → 7.75 | **2.75** → 6.52 | **2.59** → 6.63 | **2.55** → 6.55 | **3.03** → 6.53 | **2.34** → 6.09 | **2.77** → 7.56 | **2.97** → 7.69 | 3.54 → 5.47 | **2.83** → 8.01 | 6.26 → 6.26 |
| inchiostro | fallback | **2.91** → 7.83 | **2.58** → 6.62 | **2.54** → 6.69 | **2.37** → 6.39 | **2.92** → 6.3 | **2.21** → 5.73 | **2.63** → 7.06 | **2.99** → 7.8 | 3.88 → 5.99 | **2.63** → 7.82 | 6.26 → 6.26 |
| prugna-corallo | glass | **2.93** → 7.36 | **2.6** → 6.14 | **2.51** → 6.21 | **2.48** → 6.22 | **2.79** → 6.19 | **2.3** → 5.8 | **2.7** → 7.13 | **2.84** → 7.15 | 3.25 → 5.23 | **2.77** → 7.52 | 6.54 → 6.54 |
| prugna-corallo | fallback | **2.94** → 8.04 | **2.56** → 6.61 | **2.57** → 6.73 | **2.42** → 6.62 | **2.97** → 6.77 | **2.26** → 6 | **2.6** → 7.27 | **2.97** → 7.73 | 3.85 → 5.9 | **2.69** → 7.99 | 6.54 → 6.54 |
| oliva-ambra | glass | **2.14** → 6.2 | **1.88** → 5.26 | **1.78** → 5.2 | **1.75** → 5.18 | **2.08** → 5.54 | **1.68** → 4.85 | **1.91** → 5.8 | **2.02** → 5.88 | **2.52** → 4.38 | **1.88** → 6.1 | 5.07 → 5.07 |
| oliva-ambra | fallback | **2.07** → 6.24 | **1.86** → 5.29 | **1.73** → 5.23 | **1.62** → 5.1 | **2.07** → 5.39 | **1.59** → 4.75 | **1.82** → 5.65 | **2.04** → 6.02 | **2.77** → 4.78 | **1.75** → 6.09 | 5.07 → 5.07 |
| ardesia-salvia | glass | **2.65** → 7.07 | **2.39** → 5.99 | **2.53** → 6.18 | **2.52** → 6.26 | **2.27** → 6.12 | **1.83** → 5.62 | **2.02** → 6.69 | **2.78** → 6.95 | 3.07 → 4.92 | **2.74** → 7.26 | 6.19 → 6.19 |
| ardesia-salvia | fallback | **2.34** → 6.93 | **2.08** → 5.8 | **2.39** → 6.18 | **2.26** → 5.86 | **2.16** → 5.64 | **1.64** → 4.97 | **1.8** → 5.94 | **2.71** → 6.95 | 3.31 → 5.31 | **2.52** → 7.06 | 6.19 → 6.19 |

Not measured by pixels: the Google button label, #1F1F1F on #FFFFFF, is 16.48:1 in every palette,
since the button is never tinted. The focus ring is never clipped by the card's `overflow: hidden`:
in every case the ring (offset + width = 5px) stays inside the card.

**Visual sign-off (2026-10-27): accepted.** The look changed visibly: the glows are at about 40%,
there is a smoky navy shade at 0.45, and the white tints are lower. The user accepted this look
(option a) over a text-only darkening variant or lower contrast. The turbopack
production build (`pnpm --filter ui-shell build`) is also pending, because the user's running dev
server shares `.next`. A webpack `next build` of an identical copy passed.

### Existing sections: reported, not fixed (awaiting approval)

These are outside the glass scope, so they are fixed only with approval. The thresholds are the same
as above.

- **Radial menu `.app-name`** ("agenda", 14px/500, white on the centre button's white 0.15 fill).
  - Method: browser, using the same canvas lightest-pixel technique at 1180x820 and 390x844 with
    the menu open.
  - Result: 3.73-4.39:1 on five palettes, below 4.5. The palettes are `oliva-ambra` 3.73,
    `argilla-petrolio` 3.89, `bosco-laguna` 4.10, `tramonto` 4.23 and `ardesia-salvia` 4.39.
    `notte-lavanda`, `inchiostro` and `prugna-corallo` pass at 5.08-5.34.
  - Proposed fix: lower `--center-bg` to about rgba(255,255,255,0.08), or make the label at
    least 18.66px bold.
  - Everything else in the menu passes: labels, mobile pills, icons and item borders. The centre
    border measures 2.95-4.0 (conservative); it is marginal only on `oliva-ambra` at 390.
- **`/calendario` `.cal-day-header`** (11px/600, white 55%).
  - Method: analytical. White at alpha is composited over the 90deg `--bg-from` → `--bg-to`
    gradient, sampled every 1% with sRGB interpolation, plus the overlay layers.
  - Result: 2.57-3.15:1, failing on all 8 palettes.
  - Proposed fix: raise it to white 95% or more. The analytic minimum is 4.04 at 85%, 4.62 at 95%
    and 4.92 at 100%.
- **`/calendario` day numbers in selected and hover cells** (14px/600 white).
  - Method: analytical, as above.
  - Selected cell (white 0.15) fails on 6 of 8 palettes; the worst is 3.73 (`oliva-ambra`).
  - Hover cell (white 0.13) fails on 4 palettes; the worst is 3.87 (`oliva-ambra`).
  - The plain cell (white 0.07) is 4.32 on `oliva-ambra` only.
  - Proposed fix: a `rgba(0,0,0,0.12-0.15)` scrim on `.cal-body`, or lower cell tints.
- **`/calendario` "Oggi" button** (14px/600, header black 0.10 + white 0.15).
  - Method: analytical, as above.
  - Result: 4.26:1 on `oliva-ambra`; all other palettes pass, at 4.57 or more.
  - Proposed fix: lower its fill to about white 0.08, or use the same header scrim.

## 9. Frontend-only scope on the Mac clone (2026-10-27)

The Welcome visual redesign (Tasks 5-7) is implemented in the Mac clone, restricted to the
frontend presentation layer. OAuth, Keycloak, backend, session and live-integration work
continues on the Windows OAuth checkout.

- The redesigned "Accedi con Google" button calls the existing `AppShell` login handler
  (`NEXT_PUBLIC_AUTH_LOGIN_URL`), and keeps the existing `NEXT_PUBLIC_AUTH_CONFIGURED` gate. When
  sign-in is not configured, the existing copy "Autenticazione non ancora disponibile." is
  shown in the error presentation.
- Loading and error states are presentation only. The `?auth_error=cancelled|failed` feedback
  appears only once the Windows backend emits those redirects (section 1.1); without it the
  screen simply starts in `scelta`.
- `docs/local-auth-setup.md` (Registrati walkthrough, `NEXT_PUBLIC_AUTH_REGISTER_URL`) is not
  edited on the Mac; it is a Windows integration item.
