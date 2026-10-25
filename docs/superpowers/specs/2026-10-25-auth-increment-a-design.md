# Authentication Increment A - Design Specification

**Branch:** feature/oauth
**Date:** 2026-10-25
**Status:** Approved - corrections applied 2026-10-25

---

## 1. Overview

Increment A establishes the authentication foundation for Agenda ADHD without requiring a
configured identity provider. It delivers:

- Minimal NestJS backend (`backend/`) added to the pnpm workspace
- AuthModule with deny-by-default session guard enforcement
- BFF session architecture with a clear boundary for Increment B wiring
- Keycloak JWT validation utility tested independently of a live provider
- Updated Welcome UI with Accedi and Registrati actions
- Relevant automated tests, TypeScript verification and build verification

No mock authenticated sessions are created. No protected resource is accessible. The existing
ui-shell prototype is preserved without modification beyond the Welcome UI change.

D-14, D-15, D-16 and D-19 remain open.

---

## 2. Component responsibilities

| Component | Responsibility |
|---|---|
| Next.js | Welcome UI, login/logout navigation, SSR pages, preliminary UX redirect (not a security boundary) |
| NestJS | Entire OIDC client flow, session issuance and validation, guard enforcement, protected API access, resource authorization |
| Keycloak (D-16 provisional) | Google OIDC federation, post-broker TOTP MFA, token issuance |
| Browser | Sends opaque session cookie only; never holds Keycloak tokens or client secrets |

There is one authentication system. NestJS is its enforcing boundary. Next.js middleware is
a UX aid, not a substitute.

---

## 3. Session architecture (BFF pattern)

### 3.1 What the browser sees

The browser holds one thing: an opaque `session_id` value in an `HttpOnly; SameSite=Lax`
cookie. It never receives a Keycloak access token, refresh token, ID token, or OIDC client
secret.

### 3.2 OIDC client ownership

NestJS is the sole OIDC client and the sole owner of the server-side authentication flow. No
OIDC handling exists in Next.js. The Keycloak client `agenda-bff` is confidential; its client
secret is held only by NestJS.

```
Browser            Next.js (UI)       NestJS (/api)          Keycloak
  |                    |                    |                     |
  |- click Accedi ->   |                    |                     |
  |                    |- redirect to ------+-> /api/auth/login   |
  |<------- redirect to /api/auth/login ---|                     |
  |-- GET /api/auth/login ----------------->|                     |
  |                                         |- generate state,    |
  |                                         |  nonce, code_verifier|
  |                                         |- store them server-side
  |<-- 302 to Keycloak /authorize ----------|                     |
  |-- GET /authorize?...state&code_challenge->                    |
  |                    |                    |<-- Google + TOTP -->|
  |<-- 302 to /api/auth/callback?code&state-+--------------------+
  |-- GET /api/auth/callback -------------->|                     |
  |                                         |- validate state     |
  |                                         |- exchange code (PKCE)|
  |                                         +-- POST /token ------>|
  |                                         |<-- access+refresh --+|
  |                                         |- validate token:    |
  |                                         |  sig, iss, aud,     |
  |                                         |  exp, nonce, ACR    |
  |                                         |- create session     |
  |<-- 302 /?view=menu + Set-Cookie --------|                     |
  |-- GET /api/auth/me + Cookie ----------->|                     |
  |                                         |- look up session    |
  |                                         |- check expiry + ACR |
  |<-- 200 { user } -----------------------|                     |
```

Keycloak client `agenda-bff`:
- Protocol: OIDC
- Access type: Confidential
- Valid redirect URIs: `http://localhost:3001/api/auth/callback` (dev), `https://<domain>/api/auth/callback` (prod)
- Client secret: stored in `KEYCLOAK_CLIENT_SECRET` on NestJS only, never in browser or Next.js

### 3.3 State, nonce and PKCE

NestJS generates all three before redirecting to Keycloak, stores them server-side keyed by a
temporary `auth_state` cookie (short-lived, `HttpOnly; SameSite=Lax; Path=/api/auth`), and
validates them at the callback:

- `state`: an opaque random value; prevents login CSRF
- `nonce`: embedded in the ID token and verified to prevent replay
- `code_verifier`: the PKCE secret; `code_challenge` (S256) is sent to Keycloak; only NestJS
  holds the verifier

Login CSRF: any callback request with a `state` that does not match a stored pending value is
rejected immediately.

### 3.4 Session cookie attributes

| Attribute | Development | Production |
|---|---|---|
| `HttpOnly` | yes | yes |
| `Secure` | no (HTTP) | yes (HTTPS) |
| `SameSite` | `Lax` | `Lax` |
| `Path` | `/` | `/` |
| `Domain` | not set (host-only) | not set (host-only) |
| Name prefix | none | `__Host-` where HTTPS + Path=/ + no Domain are met |

`Path=/` is required so the cookie is sent on both API requests to `/api/*` and page navigations
to `/calendario`, `/lavagna`, etc., enabling the Next.js middleware UX redirect.

No explicit `Domain` attribute is set. This restricts the cookie to exactly the issuing host
(host-only semantics), preventing it from being sent to subdomains.

In production HTTPS deployments the `__Host-` cookie name prefix enforces `Secure; Path=/; no Domain`
at the browser level, providing an additional guarantee that the cookie cannot be downgraded
to HTTP or shared with subdomains.

### 3.5 How Next.js communicates with NestJS

The Next.js middleware reads the session cookie for a UX-only presence check (not a security
check). It redirects unauthenticated visitors away from protected page routes to the Welcome
page. This redirect is revocable and is not the authorization boundary.

Next.js Server Actions and Route Handlers that need private data forward the session cookie to
NestJS via a server-side `fetch`. They do not re-implement session or token validation. The
NestJS guard is the single validation point.

The cookie's `Path=/` means it is sent automatically on all requests to the NestJS host, whether
initiated by the browser directly or proxied through Next.js server-side code.

### 3.6 Session expiry and token refresh

NestJS stores the Keycloak refresh token encrypted inside the session record. Near access token
expiry, NestJS silently exchanges the refresh token for a new access token.

If the refresh fails for any reason (Keycloak session expired, user account disabled, realm
configuration changed), NestJS deletes the local session immediately and returns 401 on the
current request. The browser is directed back to the Welcome page.

### 3.7 Logout and session revocation

Four distinct mechanisms are involved; they are not equivalent:

**Local session invalidation:** NestJS deletes the session record from the store and clears
the session cookie in the response. Immediate and unconditional. Happens on every logout path.

**RP-initiated logout (application-triggered):** After local session deletion, NestJS redirects
the browser to the Keycloak end-session endpoint (`/realms/agenda/protocol/openid-connect/logout`
with the `id_token_hint` and a `post_logout_redirect_uri`). This invalidates the Keycloak SSO
session so the user is not silently re-authenticated by a lingering Keycloak session.

**Keycloak backchannel logout (Keycloak-triggered):** Keycloak POSTs a signed logout token to a
configured NestJS endpoint (`/api/auth/backchannel-logout`). NestJS validates the logout token,
looks up sessions by `sub` or `sid`, and deletes them. This enables propagation of admin-initiated
revocation to active browser sessions without waiting for token refresh. Backchannel logout is a
Keycloak configuration requirement, not an automatic feature.

**Admin-initiated revocation (without backchannel):** If backchannel logout is not yet configured,
revocation is detected only when NestJS attempts to refresh the Keycloak access token. Revocation
latency in this case equals the time until the next refresh attempt, which is bounded by the access
token TTL configured in the Keycloak realm. This latency is a known limitation and will be resolved
by configuring backchannel logout in Increment B.

### 3.8 CSRF protections

`SameSite=Lax` prevents the session cookie from being sent on cross-site sub-resource requests
(XHR, fetch). It does not protect against attacks originating from the same site or from
top-level navigations used for state-changing side effects.

Additional measures:

**Origin validation:** All state-changing NestJS endpoints validate the `Origin` header against a
configurable allowlist (`ALLOWED_ORIGINS`). Requests from unexpected origins are rejected with 403
before any session lookup.

**CSRF token (double-submit):** NestJS issues a short-lived `csrf_token` value in a readable (non-
`HttpOnly`) cookie alongside the session cookie. JavaScript reads this value and includes it in a
custom `X-CSRF-Token` request header for all state-changing API calls. NestJS validates that the
header value matches the stored expected value for the session. This defends against attacks that
can attach cookies but cannot read them.

**Login CSRF:** Protected by the validated `state` parameter (Section 3.3).

**Callback CSRF:** The PKCE `code_verifier` and `nonce` provide additional binding between the
initiation and completion of the OIDC flow.

The CSRF token cookie and Origin validation are Increment B delivery items. Increment A documents
the design; the NestJS configuration skeleton includes `ALLOWED_ORIGINS` as an environment variable.

---

## 4. Repository structure

```
DoodleLab/
  backend/                          -- new pnpm workspace member
    src/
      main.ts
      app.module.ts
      auth/
        auth.module.ts
        guards/
          session.guard.ts          -- APP_GUARD: deny-by-default, session cookie lookup
        decorators/
          public.decorator.ts       -- @Public(): skips all guard checks
          skip-mfa.decorator.ts     -- @SkipMfa(): session+identity required, MFA check skipped
          current-user.decorator.ts -- @CurrentUser(): extracts AuthenticatedUser from request
        token/
          keycloak-token.verifier.ts  -- validates raw Keycloak JWT: sig/iss/aud/exp/nonce/ACR
        types/
          authenticated-user.ts     -- verified token payload shape
          session-record.ts         -- server-side session structure (incl. encrypted refresh token)
      health/
        health.module.ts
        health.controller.ts        -- GET /api/health (@Public)
      config/
        config.module.ts            -- ConfigModule.forRoot with Joi validation schema
        auth.config.ts              -- typed accessor for Keycloak and session config
    test/
      app.e2e-spec.ts
      unit/
        keycloak-token.verifier.spec.ts  -- JWT verifier unit tests (test key pair + JWKS fixture)
        session.guard.spec.ts            -- SessionGuard unit tests (mock session store)
      fixtures/
        jwks.fixture.ts             -- static JWKS containing test RSA public key
        token.factory.ts            -- signs test JWTs with the test private key
    package.json
    tsconfig.json
    nest-cli.json
    .env.example
  prototypes/
    ui-shell/
      components/
        WelcomeScreen.tsx           -- modified: Accedi + Registrati + unavailable state
      -- all other files unchanged
  package.json                      -- updated: adds "backend" to pnpm workspace members
  docs/
    superpowers/specs/
      2026-10-25-auth-increment-a-design.md
```

---

## 5. Guard design

### 5.1 Deny-by-default

`SessionGuard` is registered as `APP_GUARD`. It runs on every incoming request.

Default behavior when no decorator is present:

1. Check `@Public()` metadata: if set, allow immediately
2. Extract `session_id` from the `HttpOnly` cookie
3. If absent: return 401 (generic message only)
4. Look up the session record in the session store
5. If not found or expired: return 401
6. Check stored token expiry; refresh silently if near expiry (Increment B)
7. Verify MFA assurance: stored `acr` must equal `KEYCLOAK_REQUIRED_ACR`
8. If ACR missing or wrong: return 401
9. Check `@SkipMfa()` metadata: if set, step 7-8 is skipped but steps 2-6 still run
10. Attach `AuthenticatedUser` to `request.user`
11. Allow the request

All 401 responses use the same generic body: `{ "statusCode": 401, "message": "Unauthorized" }`.
No token content, session ID, claim values, or internal details are included.

### 5.2 Decorators

`@Public()` - skips all guard checks (steps 2-10). Applied only to `GET /api/health` and
future OIDC callback and backchannel-logout handlers. Applying `@Public()` to an endpoint that
touches private data is a defect requiring review.

`@SkipMfa()` - skips only the MFA assurance check (steps 7-8). Session existence, expiry,
and identity verification remain enforced. Reserved for the MFA enrollment endpoint in Increment B
and any future endpoint explicitly approved for pre-MFA access. Every use requires documented
justification. `@SkipMfa()` does not trust a raw JWT supplied by the browser as a session credential.

No decorator = full session + identity + MFA assurance. Omitting a decorator defaults to
maximum protection.

### 5.3 Authentication vs. authorization

Guards establish who the caller is. Authorization (whether this caller may access this
resource) is enforced in service methods using the verified `AuthenticatedUser` from
`request.user`. Client-supplied user IDs are never trusted. Database queries are always
scoped to the authenticated user's own identifier at the service layer.

### 5.4 MFA assurance design

ACR is a claim inside the Keycloak-signed JWT. It is not user-controllable. Its value is set
by Keycloak based on which authentication executions were satisfied in the flow.

`SessionGuard` checks that the `acr` value stored in the session record (copied from the
token at session creation time) equals `KEYCLOAK_REQUIRED_ACR`. This check fails for:

- Sessions established before the TOTP policy was activated
- Logins through a Keycloak client that does not enforce the post-broker flow
- Resumed Keycloak SSO sessions that bypass the TOTP step
- Any alternative authentication path that did not satisfy OTP

ACR assurance is applied as a separate step after cryptographic token validation, as required
by the architecture. A cryptographically valid token without the required ACR is rejected.

The exact ACR value emitted by the configured Keycloak version and realm client scopes must be
verified during Increment B Keycloak setup. The value used here is `KEYCLOAK_REQUIRED_ACR`
(environment-configured) rather than a hardcoded constant, to accommodate the actual realm
configuration without code changes.

---

## 6. Keycloak token verifier

`keycloak-token.verifier.ts` validates a raw Keycloak access token. It is used at OIDC
callback time (Increment B) to validate the token before creating a session. It is also
tested independently in Increment A using the test fixture.

Validation steps in order:

1. Fetch the public key from `KEYCLOAK_JWKS_URI` (cached; rotates on `kid` mismatch)
2. Verify RS256 signature
3. Verify `iss` equals `KEYCLOAK_ISSUER_URL`
4. Verify `aud` includes `KEYCLOAK_AUDIENCE` (requires Keycloak audience mapper - see Section 8)
5. Verify `exp` is in the future
6. Verify `nbf` and `iat` if present
7. Return typed `AuthenticatedUser` on success; throw on any failure

The verifier does not check `acr`. ACR is checked by `SessionGuard` using the value stored
in the session record at creation time, keeping the two concerns separate.

---

## 7. Welcome UI changes

### 7.1 New actions

The existing single "Inizia" button is replaced by two actions. Both use the same
`buttonReady` animation gate: they are `inert` and `aria-hidden` until the animation completes.

- Primary button: `"Accedi"` - `type="button"`, class `inizia-button` (existing styles preserved)
- Secondary button: `"Prima volta qui? Registrati"` - `type="button"`, class `register-button`
  (visually subordinate; subordinate styling defined in `globals.css`)

`WelcomeScreen` props change: `onStart: () => void` becomes `onLogin: () => void` and
`onRegister: () => void`. `AppShell` supplies both.

### 7.2 Unavailable state

When `NEXT_PUBLIC_AUTH_CONFIGURED` is absent or not `"true"`, clicking either button renders
an accessible inline message rather than triggering a silent no-op or console log:

```tsx
<p role="alert" className="auth-unavailable">
  Autenticazione non ancora disponibile.
</p>
```

No redirect attempt is made. No fake authenticated state is established. The message is
persistent until the user dismisses it or reloads. The `auth-unavailable` class is defined in
`globals.css` using existing palette tokens.

### 7.3 Preserved behaviors

- Sacramento font, animation sequence and replay: unchanged
- Eight-palette system and `data-palette` attribute: unchanged
- `AppView` state machine (`WELCOME`, `MENU_OPEN`, `MENU_CLOSED`): unchanged
- `prevViewRef` focus management: unchanged
- Existing section routes, radial menu and calendar: unchanged

---

## 8. Keycloak realm configuration requirements

These steps are performed in Increment B. Documented here as the checklist.

### 8.1 Google OAuth client

- Create a Google Cloud Project for Agenda ADHD (or use an existing project with a new OAuth
  client - no requirement to create a new project if one already exists)
- Create an OAuth 2.0 credential of type `Web application`
- No additional Google APIs beyond the OAuth consent screen configuration are required for
  Google Sign-In; do not enable unrelated Google API services
- Authorized redirect URI:
  - Dev: `http://localhost:3001/api/auth/callback`
  - Prod: `https://<domain>/api/auth/callback`
- Required values (stored only in NestJS env, never in repo):
  `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`
  These are entered into Keycloak admin only; they are not used directly by NestJS.

### 8.2 Keycloak realm

- Create realm `agenda`
- Confirm the issuer URL matches `KEYCLOAK_ISSUER_URL`

### 8.3 Keycloak OIDC client

One confidential OIDC client: `agenda-bff`

| Property | Value |
|---|---|
| Client ID | `agenda-bff` |
| Access type | Confidential |
| Protocol | OpenID Connect |
| Standard flow | enabled |
| Direct access grants | disabled |
| Valid redirect URIs | `http://localhost:3001/api/auth/callback` (dev) |
| Web origins | `http://localhost:3001` (dev) |

NestJS uses `agenda-bff`'s client secret (`KEYCLOAK_CLIENT_SECRET`) for the token exchange.
Add an **Audience mapper** (mapper type: Audience, included in: access token) that adds
`agenda-bff` to the `aud` claim. NestJS validates `aud` includes `KEYCLOAK_AUDIENCE=agenda-bff`.
Without this mapper the access token audience defaults to `account` and NestJS audience
validation fails.

### 8.4 Google identity provider

- Add Google as a Social identity provider in the Keycloak realm
- Enter the Google OAuth client ID and secret
- Assign the post-broker login flow (below)
- Default scopes: `openid email profile`

### 8.5 Post-broker TOTP authentication flow (critical)

This flow is not automatic and must be explicitly configured. The default Keycloak browser
flow does not enforce TOTP for federated identities.

1. In **Authentication**, create a new flow as a copy of the default First Broker Login flow
2. Add an **OTP Form** execution with mode `REQUIRED` after the identity review step
3. Assign this flow as the **Post Broker Login Flow** on the Google identity provider
4. This enforces OTP enrollment on first Google login and OTP verification on every subsequent
   Google login, even when a Keycloak SSO session exists from a previous request

Verify during Increment B:
- New Google user is prompted for OTP enrollment
- Returning Google user is prompted for OTP verification
- A valid Keycloak SSO session that bypasses the Google IDP does not bypass the OTP step
- Alternate authentication paths (direct Keycloak username/password, other IDPs) enforce the
  same OTP policy

### 8.6 ACR / Level of Assurance mapping

- In realm **Authentication > Policies > Authentication Level of Assurance**
- Map the OTP Form execution to LoA level `2`
- Set `KEYCLOAK_REQUIRED_ACR=2` in NestJS config to match
- Keycloak includes `"acr": "2"` in the access token only when the mapped execution was satisfied
- The exact claim value emitted must be verified against the deployed Keycloak version before
  Increment B test verification; `KEYCLOAK_REQUIRED_ACR` is environment-configured to avoid
  hardcoding a value that may differ between Keycloak versions

### 8.7 Environment variables

**backend/.env.example** (committed; placeholder values only; no secrets):

```
# Keycloak - configure when realm is provisioned (D-16 pending)
KEYCLOAK_ISSUER_URL=http://localhost:8080/realms/agenda
KEYCLOAK_JWKS_URI=http://localhost:8080/realms/agenda/protocol/openid-connect/certs
KEYCLOAK_CLIENT_ID=agenda-bff
KEYCLOAK_CLIENT_SECRET=replace-with-keycloak-client-secret
KEYCLOAK_AUDIENCE=agenda-bff
KEYCLOAK_REQUIRED_ACR=2
KEYCLOAK_CALLBACK_URL=http://localhost:3001/api/auth/callback
KEYCLOAK_POST_LOGOUT_REDIRECT_URI=http://localhost:3000

# Session
SESSION_SECRET=replace-before-any-deployment
SESSION_TTL_SECONDS=3600

# CSRF and origins
ALLOWED_ORIGINS=http://localhost:3000

# Server
PORT=3001
NODE_ENV=development
```

**prototypes/ui-shell/.env.local** additions (gitignored):

```
NEXT_PUBLIC_AUTH_CONFIGURED=false
NEXT_PUBLIC_AUTH_LOGIN_URL=http://localhost:3001/api/auth/login
NEXT_PUBLIC_AUTH_REGISTER_URL=http://localhost:3001/api/auth/login?prompt=create
```

Neither file ever contains real credentials. `KEYCLOAK_CLIENT_SECRET` and
`SESSION_SECRET` are replaced only in the actual `.env` file on the developer's machine,
which is gitignored. Raw session IDs and refresh tokens are never logged.

---

## 9. Tests

### 9.1 Test fixtures

`test/fixtures/jwks.fixture.ts` exports a static JWKS built from a test RSA-2048 key pair
generated once and committed (test-only, no production use). The matching private key is
exported from the same file for use by `token.factory.ts`.

`test/fixtures/token.factory.ts` signs JWTs with the test private key. Named parameters
control `iss`, `aud`, `exp`, `acr`, `sub` and other claims, making each negative case
explicit and readable.

### 9.2 Keycloak token verifier unit tests (`unit/keycloak-token.verifier.spec.ts`)

These tests exercise `keycloak-token.verifier.ts` directly. They use the test key pair and
a mock HTTP handler serving the JWKS fixture. No session store or HTTP server is involved.

| Test | Expected result |
|---|---|
| Valid token (correct sig, iss, aud, exp) | Returns AuthenticatedUser |
| Token signed with different key | Throws |
| Wrong issuer | Throws |
| Wrong audience | Throws |
| Expired token (`exp` in past) | Throws |
| `nbf` in the future | Throws |
| Malformed JWT string | Throws |
| Verifier does not check ACR | Valid token without `acr` claim is accepted by verifier |

The verifier intentionally does not check ACR; that is the guard's responsibility (see 9.3).

### 9.3 SessionGuard unit tests (`unit/session.guard.spec.ts`)

These tests exercise `SessionGuard` with a mock session store. No real tokens or JWKS calls
are made. Sessions are pre-populated in the mock store with controlled `AuthenticatedUser`
values.

| Test | Expected result |
|---|---|
| No session cookie | 401 |
| Session cookie present, not in store | 401 |
| Session cookie present, session expired | 401 |
| Valid session, `acr` equals required value | Request passes; user attached |
| Valid session, `acr` absent | 401 |
| Valid session, `acr` wrong value | 401 |
| `@Public()` route, no cookie | Request passes |
| `@SkipMfa()` route, valid session without `acr` | Request passes |
| `@SkipMfa()` route, no cookie | 401 (session still required) |
| `@SkipMfa()` route, expired session | 401 (expiry still checked) |
| Error response body | Does not contain session ID, token data, or stack trace |

### 9.4 e2e HTTP tests (`test/app.e2e-spec.ts`)

These tests run against the full NestJS application in test mode.

| Test | Expected result |
|---|---|
| `GET /api/health` without cookie | `200 { "status": "ok" }` |
| `GET /api/auth/me` without cookie | `401` |
| `GET /api/auth/me` with fabricated session cookie | `401` |
| `GET /api/auth/me` with a raw Bearer JWT in header | `401` (not a session-based request) |

### 9.5 Pending tests (require live Keycloak - marked `it.todo` with documented reason)

- Real Keycloak token with TOTP ACR accepted and session created
- Token without TOTP ACR (Google-only login, no OTP) rejected at session creation
- Expired access token triggers silent refresh; subsequent request succeeds
- Failed token refresh (revoked Keycloak session) returns 401 and deletes local session
- Logout deletes session, clears cookie, initiates RP-initiated logout redirect
- Backchannel logout notification received from Keycloak triggers session deletion
- Two authenticated users cannot access each other's resources

---

## 10. Session store

In Increment A the store is an in-memory `Map<sessionId, SessionRecord>` injected via the
`SESSION_STORE` provider token. The in-memory store is always empty in Increment A because
no OIDC callback is wired, so all authenticated requests return 401.

The planned production session store is PostgreSQL, using a sessions table in the application
database. This avoids introducing a Redis dependency unless a concrete requirement (session
count, read throughput) justifies it. The `SESSION_STORE` token allows the store implementation
to be swapped in Increment B without changing the guard.

Session records store: session ID (hashed), user identity, session expiry, MFA assurance flag,
and the Keycloak refresh token (encrypted at rest using `SESSION_SECRET`). Raw session IDs and
raw refresh tokens are never logged.

---

## 11. What is not implemented in Increment A

The following are explicitly excluded and not claimed as working:

- Real Google OIDC redirect and callback flow
- Keycloak token exchange
- Session creation from a live provider token
- MFA enrollment or verification UI
- User record in PostgreSQL
- Encrypted vault migration or account binding
- Production session store (PostgreSQL)
- CSRF token issuance (Origin validation skeleton is present in config only)
- D-14, D-15, D-16, D-19 resolution

---

## 12. Open decisions

| ID | Topic | Status |
|---|---|---|
| D-14 | Cryptographic model for local vault | Open |
| D-15 | Key recovery | Open |
| D-16 | Identity provider | Keycloak provisional; open until end-to-end verified |
| D-19 | Offline session limits | Open |
| - | PostgreSQL sessions table schema | Pending Increment B |
| - | Reverse proxy and deployment topology | Open |
| - | `__Host-` cookie name in production | Confirm when HTTPS deployment is configured |
| - | Backchannel logout endpoint configuration in Keycloak | Increment B requirement |
| - | ACR exact claim value for configured Keycloak version | Verify during Increment B setup |
